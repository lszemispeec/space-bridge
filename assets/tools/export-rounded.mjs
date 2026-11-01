/** Rounded viewport handoff. Run after the console and side exporters. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync as run } from 'node:child_process';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const json = (p,v) => fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const blank = (w,h,c=[0,0,0,0]) => ({w,h,data:Buffer.from(Array(w*h).fill(c).flat())});
const rgba = h => [...Buffer.from(h.slice(1),'hex'),255];
function dot(im,x,y,c){if(x>=0&&x<im.w&&y>=0&&y<im.h)im.data.set(c,(y*im.w+x)*4);}
function rect(im,x,y,w,h,c){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)dot(im,xx,yy,c);}
function read(p){const [w,h]=run('magick',['identify','-format','%w %h',p]).toString().split(' ').map(Number);return {w,h,data:run('magick',[p,'-depth','8','RGBA:-'],{maxBuffer:128e6})};}
function save(im,p,scale=1){
 if(scale===1&&fs.existsSync(p)){const old=read(p);if(old.w===im.w&&old.h===im.h&&old.data.equals(im.data))return;}
 run('magick',['-size',`${im.w}x${im.h}`,'-depth','8','RGBA:-','-scale',`${scale*100}%`,'-define','png:exclude-chunks=date,time','-define','png:color-type=6',p],{input:im.data,maxBuffer:128e6});
}
function crop(im,x,y,w,h){const out=blank(w,h);for(let j=0;j<h;j++)im.data.copy(out.data,j*w*4,((y+j)*im.w+x)*4,((y+j)*im.w+x+w)*4);return out;}
function paste(dst,src,x,y){for(let j=0;j<src.h;j++)for(let i=0;i<src.w;i++){const o=(j*src.w+i)*4;if(src.data[o+3])dot(dst,x+i,y+j,src.data.subarray(o,o+4));}}


import { roundViewport, WINDOW_CORNER_RADIUS } from './rounded-viewport.mjs';

const baseline = '751cd3c72d2a9d77872b4f890898f572570c5e97';
const themes = ['polar-signal', 'desert-expedition', 'neon-orbit'];
for (const theme of themes) {
  const dir = path.join(ROOT, 'assets', theme), pv = path.join(dir, 'previews');
  const temp = path.join(ROOT, '.scratch/rounded', theme);
  fs.mkdirSync(temp, { recursive: true });
  const atlas = JSON.parse(fs.readFileSync(path.join(dir, `${theme}.json`)));
  const sheet = read(path.join(dir, `${theme}.png`)), p = atlas.meta.palette.map(rgba);
  const metal = theme === 'polar-signal' ? [1,2,3,5,7] : theme === 'desert-expedition' ? [1,2,4,6,8] : [1,2,4,10,12];
  const images = {};
  for (const [n,f] of Object.entries(atlas.frames)) images[n] = crop(sheet,f.x,f.y,f.w,f.h);
  const changedFrames = [];
  for (const orientation of ['landscape', 'portrait', 'side']) {
    const cfg = atlas.operatorRoom[orientation], frame = images[cfg.frame], s = cfg.scene;
    // Remove the four old diagonal glints; restore their underlying rail inks.
    const offsetX = orientation === 'side' ? 48 : 0;
    const offsetY = orientation === 'side' ? -4 : 0;
    const width = orientation === 'side' ? 352 : frame.w;
    for (let i = 0; i < 4; i++) {
      for (const x of [5+i, width-6-i]) {
        dot(frame, x+offsetX, 10-i+offsetY, p[metal[1]]);
        dot(frame, x+offsetX, 245+i+offsetY, p[i === 3 ? 0 : metal[1]]);
        if (orientation === 'side') dot(frame, x+offsetX, 254-i, p[metal[1]]);
      }
    }
    roundViewport(frame, s, p, metal);
    delete cfg.windowCornerCut;
    cfg.windowCornerRadius = WINDOW_CORNER_RADIUS;
    const f = atlas.frames[cfg.frame];
    rect(sheet,f.x,f.y,f.w,f.h,[0,0,0,0]);paste(sheet,frame,f.x,f.y);
    save(frame,path.join(pv,`frame.room.${orientation}-strip.png`));
    changedFrames.push(cfg.frame);
  }
  save(sheet,path.join(dir,`${theme}.png`));json(path.join(dir,`${theme}.json`),atlas);
  for (const ext of ['png','json']) fs.copyFileSync(path.join(dir,`${theme}.${ext}`),path.join(ROOT,'public/atlas',`${theme}.${ext}`));
  const at = (dst,n,x,y) => {const f=atlas.frames[n];paste(dst,images[n],x-f.ax,y-f.ay);};
  function scene() {
    const im=blank(320,240);paste(im,images['background.window'],0,0);
    for(const n of ['ambient.sky','ambient.drift'])if(!atlas.retiredAnimations.includes(n))at(im,atlas.animations[n].frames[0],0,0);
    at(im,'rocket.tophatch.open.0',43,169);at(im,'rover.hatch.closed.0',248,180);at(im,'ambient.signal.0',0,0);
    at(im,'cosmonaut.air.spin.1',106,126);at(im,'cosmonaut.air.spin.4',146,90);at(im,'cosmonaut.air.flail.1',206,119);
    [106,146,186,226].forEach((cx,i)=>{at(im,`crater.${i}`,cx,177);if(i===0)at(im,'crater.eyes.peek.2',cx,177);if(i===2)at(im,'crater.tentacle.reach.2',cx,177);at(im,`crater.front.${i}`,cx,177);});at(im,'plate.idle.0',146,181);
    return im;
  }
  // Retain the exact accepted controls/readouts in the offline compositions.
  // Only pixels changed in the room frame are recomposited over the same scene.
  function refresh(preview, orientation, scale=1) {
    const cfg=atlas.operatorRoom[orientation], s=cfg.scene, f=atlas.frames[cfg.frame];
    const oldAtlas=JSON.parse(run('git',['show',`${baseline}:assets/${theme}/${theme}.json`],{cwd:ROOT}));
    const oldSheetPath=path.join(temp,'before-sheet.png');
    fs.writeFileSync(oldSheetPath,run('git',['show',`${baseline}:assets/${theme}/${theme}.png`],{cwd:ROOT,maxBuffer:128e6}));
    const oldF=oldAtlas.frames[cfg.frame], oldFrame=crop(read(oldSheetPath),oldF.x,oldF.y,oldF.w,oldF.h);
    const background=blank(f.w,f.h,p[0]);paste(background,crop(scene(),s.sx,s.sy,s.w,s.h),s.dx,s.dy);
    const frame=images[cfg.frame];
    for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++){
      const o=(y*f.w+x)*4;
      if(frame.data.subarray(o,o+4).equals(oldFrame.data.subarray(o,o+4)))continue;
      const ink=frame.data[o+3]?frame.data.subarray(o,o+4):background.data.subarray(o,o+4);
      rect(preview,x*scale,y*scale,scale,scale,ink);
    }
    return preview;
  }
  for(const orientation of ['landscape','portrait','side']){
    const name=`operator-${orientation}-1x.png`;
    const native=refresh(read(path.join(pv,name)),orientation);
    save(native,path.join(pv,name));save(native,path.join(pv,`operator-${orientation}-4x.png`),4);
    if(theme==='polar-signal' && orientation==='landscape'){
      const beforePath=path.join(temp,'before.png');
      fs.writeFileSync(beforePath,run('git',['show',`${baseline}:assets/${theme}/previews/${name}`],{cwd:ROOT,maxBuffer:128e6}));
      const compare=blank(80,36,p[0]);
      paste(compare,crop(read(beforePath),4,2,36,36),0,0);
      paste(compare,crop(native,4,2,36,36),44,0);
      save(compare,path.join(pv,'viewport-corner-before-after-8x.png'),8);
    }
    if(theme==='polar-signal' && orientation==='side'){
      const phone=read(path.join(pv,'iphone16pro-landscape-mock.png'));paste(phone,native,213,22);
      save(phone,path.join(pv,'iphone16pro-landscape-mock.png'));save(phone,path.join(pv,'iphone16pro-landscape-mock-dpr3.png'),3);
    }
  }
  for(const [name,orientation,scale] of [['operator-room','landscape',1],['operator-side-cycle-4x','side',4]]){
    // Always encode from the accepted animation, avoiding palette/order drift
    // when an already encoded GIF is fed through another export.
    const input=path.join(temp,`before-${name}.gif`);
    fs.writeFileSync(input,run('git',['show',`${baseline}:assets/${theme}/previews/${name}.gif`],{cwd:ROOT,maxBuffer:128e6}));
    const delays=run('magick',['identify','-format','%T ',input]).toString().trim().split(/\s+/);
    run('magick',[input,'-coalesce',path.join(temp,`${name}-%d.png`)]);
    const args=['-dispose','background'];
    delays.forEach((delay,i)=>{const file=path.join(temp,`${name}-${i}.png`);save(refresh(read(file),orientation,scale),file);args.push('-delay',delay,file);});
    run('magick',[...args,'-loop','0',path.join(pv,`${name}.gif`)]);
  }
  // Refresh room frames on the full-sheet contact study, retaining its layout.
  const contact=read(path.join(pv,'frames-1x.png'));
  const index=JSON.parse(fs.readFileSync(path.join(pv,'frame-index.json')));
  for(const f of index.filter(f=>changedFrames.includes(f.name))){rect(contact,f.x,f.y,f.w,f.h,p[1]);paste(contact,images[f.name],f.x,f.y);}
  save(contact,path.join(pv,'frames-1x.png'));save(contact,path.join(pv,'frames-4x.png'),4);
  json(path.join(dir,'revision-11.json'),{baseline,changedFrames,windowCornerRadius:WINDOW_CORNER_RADIUS,palette:atlas.meta.palette,
    lighting:'Upper left; ink 0 outline; existing theme bevel inks; four rail rivets.',
    unchanged:'Frame rectangles, anchors, durations, animations, gameplay pixels, panels, controls, readouts and tap zones.',
    previews:'Offline compositions at native resolution and exact nearest-neighbour 4x. Corner comparison: before left, after right, 8x.'});
  console.log(`${theme}: rounded viewport, three layouts, native/4x previews and loops exported`);
}
