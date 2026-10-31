"""Read-only pixel audit. Run from any directory with Python 3 and Pillow."""
import json
from pathlib import Path
from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[2]
THEMES = ("polar-signal", "desert-expedition", "neon-orbit")


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def audit(theme):
    directory = ROOT / "assets" / theme
    atlas = json.loads((directory / f"{theme}.json").read_text())
    for extension in ("png", "json"):
        name = f"{theme}.{extension}"
        check((directory / name).read_bytes() == (ROOT / "public/atlas" / name).read_bytes(), f"published copy: {name}")
    palette = {tuple(bytes.fromhex(c[1:])) for c in atlas["meta"]["palette"]}
    image = Image.open(directory / atlas["meta"]["image"]).convert("RGBA")
    check(image.size == tuple(atlas["meta"]["size"][k] for k in ("w", "h")), "PNG size")
    check(len(palette) == 16, "palette length")
    occupied = set()
    crops = {}
    retired_frames = {f for name in atlas.get('retiredAnimations', []) for f in atlas['animations'][name]['frames']}
    for name, frame in atlas["frames"].items():
        x, y, w, h = (frame[k] for k in ("x", "y", "w", "h"))
        check(0 <= x < x + w <= image.width and 0 <= y < y + h <= image.height, name)
        rectangle = {yy * image.width + xx for yy in range(y, y+h) for xx in range(x, x+w)}
        check(not occupied.intersection(rectangle), f"overlap: {name}")
        occupied.update(rectangle)
        crop = image.crop((x, y, x+w, y+h))
        crops[name] = crop
        check(crop.getbbox() is not None or name in retired_frames or name in ('ambient.drift.3', 'crater.eyes.hide.2'), f"empty: {name}")
        if name.startswith("cosmonaut."):
            if name.startswith('cosmonaut.air.'):
                check((w, h, frame['ax'], frame['ay']) == (20, 22, 10, 11), f'air body centre: {name}')
                check(crop.getpixel((10, 11))[3] == 255, f'body at pivot: {name}')
                # A single connected silhouette, including outlined hands/feet.
                opaque = {(x, y) for y in range(h) for x in range(w) if crop.getpixel((x, y))[3]}
                pending = [next(iter(opaque))]
                visited = set(pending)
                while pending:
                    px, py = pending.pop()
                    for point in ((px-1,py),(px+1,py),(px,py-1),(px,py+1)):
                        if point in opaque and point not in visited:
                            visited.add(point)
                            pending.append(point)
                check(visited == opaque, f'detached air pixels: {name}')
            else:
                check(crop.getbbox()[3] == h, f"feet registration: {name}")
                check((w, h, frame['ax'], frame['ay']) == (20, 22, 10, 22), f"actor cell: {name}")
                visible_height = crop.getbbox()[3] - crop.getbbox()[1]
                check(16 <= visible_height <= 20, f"visible actor height: {name}")
            outline = tuple(bytes.fromhex(atlas['meta']['palette'][0][1:]))
            for yy in range(h):
                for xx in range(w):
                    pixel = crop.getpixel((xx, yy))
                    if not pixel[3]:
                        continue
                    boundary = any(
                        nx < 0 or nx >= w or ny < 0 or ny >= h or not crop.getpixel((nx, ny))[3]
                        for nx, ny in ((xx-1, yy), (xx+1, yy), (xx, yy-1), (xx, yy+1))
                    )
                    if boundary:
                        check(pixel[:3] == outline, f"continuous dark contour: {name} {xx},{yy}")
        if name.startswith("ambient."):
            for yy in range(h):
                for xx in range(w):
                    if xx < 32 or xx >= 288 or yy < 30 or (76 <= xx <= 247 and 130 <= yy <= 198):
                        check(crop.getpixel((xx, yy))[3] == 0, f"ambient exclusion: {name} {xx},{yy}")

    for index, pixel in enumerate(image.getdata()):
        check(pixel[3] in (0, 255), f"partial alpha at pixel {index}")
        if pixel[3]:
            check(pixel[:3] in palette, f"off-palette pixel {index}")
            check(index in occupied, f"stray pixel outside frame {index}")
    used = {p[:3] for p in image.getdata() if p[3]}
    check(used == palette, "sheet must use exactly its 16 declared colours")
    check(set(crops["background"].getchannel("A").getdata()) == {255}, "opaque background")
    corridor = crops['background'].crop((76, 130, 248, 168))
    check(len(set(corridor.getdata())) == 1, 'quiet actor corridor')
    gutter = crops['background'].getpixel((4, 152))
    for side in ('left', 'right'):
        check(crops[f'button.{side}.idle.0'].getpixel((0, 0)) == gutter, f'panel-free {side} gutter')
    for name in ('hud.icon.life.0', 'hud.icon.life_empty.0'):
        check(crops[name].size == (14, 16), f'life icon size: {name}')

    check(atlas['sockets']['rocketLedge'] == {'frame': 'rocket.hatch.open.0', 'x': 39, 'y': 30}, 'ledge socket')
    check(crops['rocket.hatch.open.0'].size == (44, 89), 'hatch hull size')
    check(crops['rocket.hatch.open.0'].getpixel((39, 30))[3] == 255, 'solid ledge under foot socket')
    check(len({crops[f'crater.{i}'].tobytes() for i in range(4)}) == 4, 'four distinct crater rims')
    dark = tuple(bytes.fromhex(atlas['meta']['palette'][0][1:]))
    for i in range(4):
        rim = crops[f'crater.{i}']
        check(rim.size == (24, 8), 'rim size')
        check(all(rim.getpixel((x,y)) == (*dark,255) for x in range(5,19) for y in range(3,6)), 'shared creature mouth')
    for name in retired_frames:
        check(crops[name].getbbox() is None, f'retired animation blank: {name}')
    if theme == 'polar-signal':
        check(atlas['retiredAnimations'] == ['ambient.sky'], 'Polar aurora retired')
        sky = tuple(bytes.fromhex(atlas['meta']['palette'][8][1:]))
        check(set(crops['background'].crop((104,35,234,78)).getdata()) == {(*sky,255)}, 'Polar sky clear of curtain and mark')

    for control, width in (('title_theme', 56), ('title_sound', 56), ('hud_sound', 36)):
        states = ('idle', 'pressed') if control == 'title_theme' else ('idle', 'pressed', 'muted', 'muted_pressed')
        pixels = []
        for state in states:
            name = f'ui.{control}.{state}.0'
            frame = atlas['frames'][name]
            check((frame['w'], frame['h'], frame['ax'], frame['ay']) == (width, 16, 0, 0), f'PR4 tap target: {name}')
            pixels.append(crops[name].tobytes())
        check(len(set(pixels)) == len(states), f'UI states must be visibly distinct: {control}')

    # Room pixels may never cover the source scene, including window corners.
    room = atlas['operatorRoom']
    for orientation, size in [('landscape', (352, 288)), ('portrait', (288, 344))]:
        layout = room[orientation]
        surround = crops[layout['frame']]
        check(surround.size == size, f'{orientation} outer dimensions')
        scene = layout['scene']
        window = (scene['dx'], scene['dy'], scene['dx']+scene['w'], scene['dy']+scene['h'])
        check(surround.crop(window).getbbox() is None, f'{orientation} unobscured window')
        check(scene['dy']+scene['h'] == layout['console']['y'], 'console below scene')
        small = Image.open(directory / f'previews/operator-{orientation}-1x.png').convert('RGBA')
        big = Image.open(directory / f'previews/operator-{orientation}-4x.png').convert('RGBA')
        check(small.size == size, 'operator preview size')
        check(small.resize((size[0]*4,size[1]*4), Image.Resampling.NEAREST).tobytes() == big.tobytes(), 'operator exact 4x')
        snd = room['hud']['sound']
        check(small.crop((snd['x'],snd['y'],snd['x']+snd['w'],snd['y']+snd['h'])).tobytes() == crops['ui.hud_sound.idle.0'].tobytes(), 'console sound target')
    for side in ('l', 'r'):
        frames = [f'ui.lever.{side}.idle.0'] + atlas['animations'][f'ui.lever.{side}.pull']['frames']
        check(len(frames) == 5 and len({crops[n].tobytes() for n in frames}) == 5, 'five distinct lever poses')
        for name in frames:
            f = atlas['frames'][name]
            check((f['w'],f['h'],f['ax'],f['ay']) == (24,48,0,0), 'unchanged lever tap cell')
    # Full-open eyes have circular 3/5/5/5/3 whites, including their dark pupil.
    eye = crops['crater.eyes.peek.2']
    eye_white = tuple(bytes.fromhex(atlas['meta']['palette'][15 if theme == 'neon-orbit' else 8][1:]))
    for cx in (8,16):
        for y,width in enumerate((3,5,5,5,3), start=8):
            for x in range(cx-width//2,cx+width//2+1):
                check(eye.getpixel((x,y))[:3] in (eye_white,dark), 'round eye silhouette')
    if theme == 'polar-signal':
        suit = crops['cosmonaut.air.spin.0']
        check(suit.getpixel((9,8))[:3] == tuple(bytes.fromhex('3F7068')), 'dark Polar suit')
        check(suit.getpixel((10,5))[:3] == tuple(bytes.fromhex('FFFAE8')), 'light Polar visor')
    lever_loop = Image.open(directory / 'previews/levers-cycle-4x.gif')
    check(lever_loop.n_frames == 9 and lever_loop.info.get('loop') == 0, 'complete lever cycle')
    cycle = []
    for frame, duration in zip(ImageSequence.Iterator(lever_loop), [300,50,50,50,250,50,50,50,100]):
        check(frame.size == (288,224) and frame.info['duration'] == duration, 'lever cycle geometry/timing')
        check(set(frame.convert('RGB').getdata()) <= palette, 'lever cycle palette')
        cycle.append(frame.convert('RGBA').tobytes())
    check(cycle == list(reversed(cycle)), 'lever release returns through authored poses')

    # Full-screen previews must be an exact integer enlargement, with no new colours.
    native = Image.open(directory / "previews/screen-1x.png").convert("RGBA")
    large = Image.open(directory / "previews/screen-4x.png").convert("RGBA")
    check(native.size == (320, 240), "native screen size")
    check(large.size == (1280, 960), "4x screen size")
    check(native.resize(large.size, Image.Resampling.NEAREST).tobytes() == large.tobytes(), "4x nearest-neighbour")
    for prefix in ('ui-states', 'title-controls', 'airborne-contrast'):
        small = Image.open(directory / f'previews/{prefix}-1x.png').convert('RGBA')
        big = Image.open(directory / f'previews/{prefix}-4x.png').convert('RGBA')
        check(big.size == (small.width * 4, small.height * 4), f'{prefix} size')
        check(small.resize(big.size, Image.Resampling.NEAREST).tobytes() == big.tobytes(), f'{prefix} nearest-neighbour')
    check(native.crop((142, 4, 178, 20)).tobytes() == crops['ui.hud_sound.idle.0'].tobytes(), 'HUD target placement')
    air_crop = Image.open(directory / 'previews/cosmonaut-air-1x.png').convert('RGBA')
    check(air_crop.tobytes() == native.crop((122, 58, 170, 122)).tobytes(), 'unscaled airborne crop')
    for file in (directory / "previews").glob("*.png"):
        colours = Image.open(file).convert("RGBA").getcolors(maxcolors=256)
        check(colours is not None, f"preview colour count: {file.name}")
        for _, pixel in colours:
            check(pixel[3] in (0, 255), f"preview alpha: {file.name}")
            check(not pixel[3] or pixel[:3] in palette, f"preview palette: {file.name}")
    strips = json.loads((directory / "previews/strips.json").read_text())
    check({s["animation"] for s in strips} == set(atlas["animations"]), "every animation needs a strip")
    for entry in strips:
        strip = Image.open(directory / "previews" / entry["file"]).convert("RGBA")
        x = 0
        for name in atlas["animations"][entry["animation"]]["frames"]:
            frame = crops[name]
            check(strip.crop((x, 0, x+frame.width, frame.height)).tobytes() == frame.tobytes(), f"strip source pixels: {name}")
            x += frame.width
        check(strip.width == x, "strip width")
        if entry['animation'].startswith(('cosmonaut.air.', 'crater.eyes.', 'crater.tentacle.', 'ui.lever.', 'frame.lights')):
            large_strip = Image.open(directory / 'previews' / entry['file'].replace('.png', '-4x.png')).convert('RGBA')
            check(strip.resize((strip.width * 4, strip.height * 4), Image.Resampling.NEAREST).tobytes() == large_strip.tobytes(), 'air strip exact 4x')
            loop = Image.open(directory / 'previews' / f"{entry['animation']}-4x.gif")
            check(loop.n_frames == len(entry['durations']), f"GIF frame count: {entry['animation']}")
            check(loop.n_frames == 1 or loop.info.get('loop') == 0, f"GIF looping preview: {entry['animation']}")
            for index, gif_frame in enumerate(ImageSequence.Iterator(loop)):
                source = crops[atlas['animations'][entry['animation']]['frames'][index]]
                expected = source.resize((source.width * 4, source.height * 4), Image.Resampling.NEAREST)
                actual = gif_frame.convert('RGBA')
                check(actual.size == expected.size and gif_frame.info['duration'] == entry['durations'][index], 'loop size/timing')
                for a, b in zip(actual.getdata(), expected.getdata()):
                    check(a[3] == b[3] and (not a[3] or a[:3] == b[:3]), 'air loop pixel fidelity')

    gif = Image.open(directory / "previews/jump-bounce.gif")
    total = 0
    for frame in ImageSequence.Iterator(gif):
        check(frame.size == (320, 240), "GIF size")
        check(frame.info.get("duration", 0) > 0, "GIF delay")
        total += frame.info["duration"]
        check(set(frame.convert("RGB").getdata()) <= palette, "GIF palette")
    check(total == 6000 and gif.info.get("loop") == 0, "six-second looping GIF")
    print(f"{theme}: {len(crops)} frames, 16 colours, binary alpha, bounds, gutters, anchors, UI states, {len(strips)} strips, 6s GIF, exact 4x: PASS")


for theme in THEMES:
    audit(theme)
