/**
 * Optional CRT post-process: a WebGL2 pass over the finished room canvas.
 * The game logic and the Canvas 2D drawing never see it. The room canvas
 * is uploaded as a texture every frame and drawn at device resolution with
 * scanlines, a slight curvature, a vignette, bloom, chromatic aberration,
 * a dot-matrix mask and phosphor persistence, each weighted by the chosen
 * preset (`src/config/display.ts`). With every weight at zero the pass is
 * not used at all, so "Off" is the renderer's own pixels.
 *
 * Two passes: a low-resolution "process" pass computes the bloom and the
 * persistence at twice the room's size, so the heavy 24-sample loop runs
 * on a few hundred thousand fragments, not on every device pixel; the
 * "screen" pass then warps, splits, masks and darkens at device resolution
 * with three texture reads per fragment, which holds 60 fps on a phone.
 *
 * The effect is a port of the fragment shader below to a two-pass WebGL2
 * pipeline with uniforms in place of its constants:
 *
 *   CRT Shader with Chromatic Aberration, Glow, Scanlines, Dot Matrix and Transparency
 *   https://github.com/luiscarlospando/crt-shader-with-chromatic-aberration-glow-scanlines-dot-matrix
 *
 *   MIT License
 *
 *   Copyright (c) 2024 Luis Carlos Pando
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *   SOFTWARE.
 */
import type { ShaderParams } from '../config/display';

/** The process pass runs at this many texels per room pixel. */
const PROCESS_SCALE = 2;

/** sRGB and Oklab conversions and the bloom sample ring, from the source shader. */
const OKLAB_GLSL = `
float f(float x) {
  if (x >= 0.0031308) return 1.055 * pow(x, 1.0 / 2.4) - 0.055;
  return 12.92 * x;
}
float f_inv(float x) {
  if (x >= 0.04045) return pow((x + 0.055) / 1.055, 2.4);
  return x / 12.92;
}
vec4 toOklab(vec4 rgb) {
  vec3 c = vec3(f_inv(rgb.r), f_inv(rgb.g), f_inv(rgb.b));
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  float l_ = pow(l, 1.0 / 3.0);
  float m_ = pow(m, 1.0 / 3.0);
  float s_ = pow(s, 1.0 / 3.0);
  return vec4(
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    rgb.a);
}
vec4 toRgb(vec4 oklab) {
  vec3 c = oklab.rgb;
  float l_ = c.r + 0.3963377774 * c.g + 0.2158037573 * c.b;
  float m_ = c.r - 0.1055613458 * c.g - 0.0638541728 * c.b;
  float s_ = c.r - 0.0894841775 * c.g - 1.2914855480 * c.b;
  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;
  vec3 linear_srgb = vec3(
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
  return vec4(clamp(f(linear_srgb.r), 0.0, 1.0), clamp(f(linear_srgb.g), 0.0, 1.0), clamp(f(linear_srgb.b), 0.0, 1.0), oklab.a);
}
const vec3 samples[24] = vec3[24](
  vec3(0.1693761725038636, 0.9855514761735895, 1.0),
  vec3(-1.333070830962943, 0.4721463328627773, 0.7071067811865475),
  vec3(-0.8464394909806497, -1.51113870578065, 0.5773502691896258),
  vec3(1.554155680728463, -1.2588090085709776, 0.5),
  vec3(1.681364377589461, 1.4741145918052656, 0.4472135954999579),
  vec3(-1.2795157692199817, 2.088741103228784, 0.4082482904638631),
  vec3(-2.4575847530631187, -0.9799373355024756, 0.3779644730092272),
  vec3(0.5874641440200847, -2.7667464429345077, 0.35355339059327373),
  vec3(2.997715703369726, 0.11704939884745152, 0.3333333333333333),
  vec3(0.41360842451688395, 3.1351121305574803, 0.31622776601683794),
  vec3(-3.167149933769243, 0.9844599011770256, 0.30151134457776363),
  vec3(-1.5736713846521535, -3.0860263079123245, 0.2886751345948129),
  vec3(2.888202648340422, -2.1583061557896213, 0.2773500981126146),
  vec3(2.7150778983300325, 2.5745586041105715, 0.2672612419124244),
  vec3(-2.1504069972377464, 3.2211410627650165, 0.2581988897471611),
  vec3(-3.6548858794907493, -1.6253643308191343, 0.25),
  vec3(1.0130775986052671, -3.9967078676335834, 0.24253562503633297),
  vec3(4.229723673607257, 0.33081361055181563, 0.23570226039551587),
  vec3(0.40107790291173834, 4.340407413572593, 0.22941573387056174),
  vec3(-4.319124570236028, 1.159811599693438, 0.22360679774997896),
  vec3(-1.9209044802827355, -4.160543952132907, 0.2182178902359924),
  vec3(3.8639122286635708, -2.6589814382925123, 0.21320071635561041),
  vec3(3.3486228404946234, 3.4331800232609, 0.20851441405707477),
  vec3(-2.8769733643574344, 3.9652268864187157, 0.20412414523193154));
`;

const VERTEX_GLSL = `#version 300 es
uniform float u_flipY;
out vec2 v_uv;
void main() {
  // One triangle that covers the screen; the texture rows run top-down, so the screen pass flips v.
  vec2 pos = vec2((gl_VertexID == 1) ? 3.0 : -1.0, (gl_VertexID == 2) ? 3.0 : -1.0);
  vec2 uv = pos * 0.5 + 0.5;
  v_uv = vec2(uv.x, mix(uv.y, 1.0 - uv.y, u_flipY));
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

/** Bloom and persistence at the process resolution. The constants are the source shader's. */
const PROCESS_GLSL = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform sampler2D u_srcSoft;
uniform sampler2D u_prev;
uniform vec2 u_srcSize;
uniform float u_glow;
uniform float u_persistence;
in vec2 v_uv;
out vec4 o;
const float DIM_CUTOFF = 0.28;
const float BRIGHT_CUTOFF = 0.65;
const float BRIGHT_BOOST = 1.0;
const float DIM_GLOW = 0.05;
const float BRIGHT_GLOW = 0.10;
const float COLOR_GLOW = 0.3;
// The ring of samples reaches 4.3 steps; this step puts its edge about two room pixels out.
const float GLOW_STEP = 0.47;
${OKLAB_GLSL}
void main() {
  vec4 source = toOklab(texture(u_src, v_uv));
  vec4 dest = source;
  if (u_glow > 0.0) {
    if (source.x > DIM_CUTOFF) {
      dest.x *= BRIGHT_BOOST;
    } else {
      vec2 step = vec2(GLOW_STEP) / u_srcSize;
      vec3 glow = vec3(0.0);
      for (int i = 0; i < 24; i++) {
        vec3 s = samples[i];
        float weight = s.z;
        vec4 c = toOklab(texture(u_srcSoft, v_uv + s.xy * step));
        if (c.x > DIM_CUTOFF) {
          glow.yz += c.yz * weight * COLOR_GLOW;
          glow.x += c.x * weight * (c.x <= BRIGHT_CUTOFF ? DIM_GLOW : BRIGHT_GLOW);
        }
      }
      dest.xyz += glow * u_glow;
    }
  }
  vec3 rgb = toRgb(dest).rgb;
  if (u_persistence > 0.0) rgb = max(rgb, texture(u_prev, v_uv).rgb * u_persistence);
  o = vec4(rgb, 1.0);
}
`;

/** Curvature, aberration, scanlines, mask and vignette at device resolution. */
const SCREEN_GLSL = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_srcSize;
uniform float u_time;
uniform float u_scanlines;
uniform float u_curvature;
uniform float u_vignette;
uniform float u_aberration;
uniform float u_mask;
in vec2 v_uv;
out vec4 o;
const float PI = 3.14159265;
// The source shader's drifting aberration amount; divided by its last period so 1 is the typical value.
float offsetFunction(float t) {
  float amount = 1.0;
  const float periods[4] = float[4](6.0, 16.0, 19.0, 27.0);
  for (int i = 0; i < 4; i++) amount *= 1.0 + 0.5 * sin(t * periods[i]);
  return amount;
}
vec2 curve(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  vec2 off = abs(p.yx) * u_curvature;
  p = p + p * off * off * 4.0 + p * u_curvature * 0.5;
  return p * 0.5 + 0.5;
}
void main() {
  vec2 uv = curve(v_uv);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    o = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  float split = u_aberration * offsetFunction(u_time) / u_srcSize.x;
  vec3 col;
  col.r = texture(u_tex, vec2(uv.x - split, uv.y)).r;
  col.g = texture(u_tex, uv).g;
  col.b = texture(u_tex, vec2(uv.x + split, uv.y)).b;
  float line = cos(uv.y * u_srcSize.y * PI);
  float scanline = line * line * u_scanlines;
  vec2 maskPos = gl_FragCoord.xy;
  float mask = 1.0 - u_mask * (0.5 + 0.5 * sin(maskPos.x * PI) * sin(maskPos.y * PI));
  vec2 d = uv - 0.5;
  float vignette = 1.0 - u_vignette * smoothstep(0.15, 0.6, dot(d, d));
  o = vec4(mix(col * mask * vignette, vec3(0.0), scanline), 1.0);
}
`;

export interface CrtPass {
  /** True after the context was lost and until the browser restores it; `render` draws nothing meanwhile. */
  readonly lost: boolean;
  /** Sets the output size in device pixels. */
  resize(width: number, height: number): void;
  /** Draws `source` through the preset. Returns false when nothing was drawn. */
  render(source: HTMLCanvasElement, params: ShaderParams, timeSec: number): boolean;
  dispose(): void;
}

export interface CrtHooks {
  onLost(): void;
  onRestored(): void;
}

/** Whether `getContext` yields a WebGL2 context; the only thing the fallback needs to know. */
export function webgl2Available(canvas: HTMLCanvasElement): boolean {
  try {
    return canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

interface Program {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Cannot create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader) ?? '';
    gl.deleteShader(shader);
    throw new Error(`Shader did not compile: ${log}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, fragment: string, uniformNames: string[]): Program {
  const program = gl.createProgram();
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_GLSL);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    throw new Error(`Program did not link: ${gl.getProgramInfoLog(program) ?? ''}`);
  }
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of ['u_flipY', ...uniformNames]) uniforms[name] = gl.getUniformLocation(program, name);
  return { program, uniforms };
}

function makeTexture(gl: WebGL2RenderingContext, filter: number): WebGLTexture {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function makeSampler(gl: WebGL2RenderingContext, filter: number): WebGLSampler {
  const sampler = gl.createSampler();
  gl.samplerParameteri(sampler, gl.TEXTURE_MIN_FILTER, filter);
  gl.samplerParameteri(sampler, gl.TEXTURE_MAG_FILTER, filter);
  gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return sampler;
}

/**
 * Creates the pass on `canvas`, or returns null when WebGL2 is not
 * available, so the caller keeps the plain 2D output. The hooks fire on a
 * context loss and its restoration; the pass rebuilds itself on restore.
 */
export function createCrtPass(canvas: HTMLCanvasElement, hooks: CrtHooks): CrtPass | null {
  let gl: WebGL2RenderingContext | null;
  try {
    gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const ctx = gl;

  let lost = false;
  let process: Program;
  let screen: Program;
  let sourceTexture: WebGLTexture;
  let nearest: WebGLSampler;
  let linear: WebGLSampler;
  let vao: WebGLVertexArrayObject;
  /** Ping-pong targets of the process pass, and the index of the one holding the last result. */
  let targets: { texture: WebGLTexture; framebuffer: WebGLFramebuffer }[] = [];
  let current = 0;
  let processSize = { w: 0, h: 0 };
  let primed = false;

  const build = (): void => {
    process = link(ctx, PROCESS_GLSL, ['u_src', 'u_srcSoft', 'u_prev', 'u_srcSize', 'u_glow', 'u_persistence']);
    screen = link(ctx, SCREEN_GLSL, ['u_tex', 'u_srcSize', 'u_time', 'u_scanlines', 'u_curvature', 'u_vignette', 'u_aberration', 'u_mask']);
    sourceTexture = makeTexture(ctx, ctx.NEAREST);
    nearest = makeSampler(ctx, ctx.NEAREST);
    linear = makeSampler(ctx, ctx.LINEAR);
    vao = ctx.createVertexArray();
    targets = [];
    processSize = { w: 0, h: 0 };
    primed = false;
  };

  const ensureTargets = (w: number, h: number): void => {
    if (processSize.w === w && processSize.h === h && targets.length === 2) return;
    for (const t of targets) {
      ctx.deleteTexture(t.texture);
      ctx.deleteFramebuffer(t.framebuffer);
    }
    targets = [0, 1].map(() => {
      const texture = makeTexture(ctx, ctx.NEAREST);
      ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, w, h, 0, ctx.RGBA, ctx.UNSIGNED_BYTE, null);
      const framebuffer = ctx.createFramebuffer();
      ctx.bindFramebuffer(ctx.FRAMEBUFFER, framebuffer);
      ctx.framebufferTexture2D(ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, texture, 0);
      return { texture, framebuffer };
    });
    ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
    processSize = { w, h };
    primed = false;
  };

  const onLost = (e: Event): void => {
    e.preventDefault();
    lost = true;
    hooks.onLost();
  };
  const onRestored = (): void => {
    build();
    lost = false;
    hooks.onRestored();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  build();

  return {
    get lost() {
      return lost;
    },
    resize(width, height) {
      canvas.width = width;
      canvas.height = height;
    },
    render(source, params, timeSec) {
      if (lost || ctx.isContextLost()) return false;
      const srcW = source.width;
      const srcH = source.height;
      if (srcW === 0 || srcH === 0) return false;

      ctx.bindVertexArray(vao);
      ctx.activeTexture(ctx.TEXTURE0);
      ctx.bindTexture(ctx.TEXTURE_2D, sourceTexture);
      ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, false);
      ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, source);

      let input = sourceTexture;
      const processed = params.glow > 0 || params.persistence > 0;
      if (processed) {
        ensureTargets(srcW * PROCESS_SCALE, srcH * PROCESS_SCALE);
        const next = 1 - current;
        const prev = targets[current];
        const target = targets[next];
        if (!prev || !target) return false;
        ctx.bindFramebuffer(ctx.FRAMEBUFFER, target.framebuffer);
        ctx.viewport(0, 0, processSize.w, processSize.h);
        ctx.useProgram(process.program);
        ctx.uniform1f(process.uniforms.u_flipY ?? null, 0);
        ctx.activeTexture(ctx.TEXTURE0);
        ctx.bindTexture(ctx.TEXTURE_2D, sourceTexture);
        ctx.bindSampler(0, nearest);
        ctx.activeTexture(ctx.TEXTURE1);
        ctx.bindTexture(ctx.TEXTURE_2D, sourceTexture);
        ctx.bindSampler(1, linear);
        ctx.activeTexture(ctx.TEXTURE2);
        ctx.bindTexture(ctx.TEXTURE_2D, prev.texture);
        ctx.bindSampler(2, nearest);
        ctx.uniform1i(process.uniforms.u_src ?? null, 0);
        ctx.uniform1i(process.uniforms.u_srcSoft ?? null, 1);
        ctx.uniform1i(process.uniforms.u_prev ?? null, 2);
        ctx.uniform2f(process.uniforms.u_srcSize ?? null, srcW, srcH);
        ctx.uniform1f(process.uniforms.u_glow ?? null, params.glow);
        // The first frame has no previous one to persist.
        ctx.uniform1f(process.uniforms.u_persistence ?? null, primed ? params.persistence : 0);
        ctx.drawArrays(ctx.TRIANGLES, 0, 3);
        current = next;
        primed = true;
        input = target.texture;
      }

      ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
      ctx.viewport(0, 0, canvas.width, canvas.height);
      ctx.useProgram(screen.program);
      ctx.uniform1f(screen.uniforms.u_flipY ?? null, 1);
      ctx.activeTexture(ctx.TEXTURE0);
      ctx.bindTexture(ctx.TEXTURE_2D, input);
      ctx.bindSampler(0, nearest);
      ctx.uniform1i(screen.uniforms.u_tex ?? null, 0);
      ctx.uniform2f(screen.uniforms.u_srcSize ?? null, srcW, srcH);
      ctx.uniform1f(screen.uniforms.u_time ?? null, timeSec);
      ctx.uniform1f(screen.uniforms.u_scanlines ?? null, params.scanlines);
      ctx.uniform1f(screen.uniforms.u_curvature ?? null, params.curvature);
      ctx.uniform1f(screen.uniforms.u_vignette ?? null, params.vignette);
      ctx.uniform1f(screen.uniforms.u_aberration ?? null, params.aberration);
      ctx.uniform1f(screen.uniforms.u_mask ?? null, params.mask);
      ctx.drawArrays(ctx.TRIANGLES, 0, 3);
      return true;
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      const ext = ctx.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    },
  };
}
