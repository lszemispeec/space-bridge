"""Side-room handoff audit: preservation, native geometry and preview fidelity."""
import json
import runpy
from pathlib import Path
from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[2]
THEMES = ('polar-signal', 'desert-expedition', 'neon-orbit')


def box(r):
    return (r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])


def inside(a, b, inset=0):
    ax, ay, ar, ab = box(a)
    bx, by, br, bb = box(b)
    return bx + inset <= ax < ar <= br - inset and by + inset <= ay < ab <= bb - inset


def separate(a, b):
    ax, ay, ar, ab = box(a)
    bx, by, br, bb = box(b)
    return ar <= bx or br <= ax or ab <= by or bb <= ay


audit = runpy.run_path(str(ROOT / 'assets/tools/verify-rounded.py'))['audit']

reference = None
for theme in THEMES:
    root = ROOT / 'assets' / theme
    a = json.loads((root / f'{theme}.json').read_text())
    image = Image.open(root / f'{theme}.png').convert('RGBA')
    # The rounded viewport audit owns exact pixel/metadata preservation.
    audit(theme)
    side = a['operatorRoom']['side']
    assert side['size'] == {'w': 448, 'h': 256}
    assert side['scene'] == {'sx': 0, 'sy': 0, 'w': 320, 'h': 240, 'dx': 64, 'dy': 8}
    assert side['windowCornerRadius'] == 20
    if reference is not None:
        assert side == reference['operatorRoom']['side']
        assert a['frames'] == reference['frames']
        assert a['animations'] == reference['animations']
    reference = a
    f = a['frames'][side['frame']]
    assert (f['w'], f['h'], f['ax'], f['ay'], f['duration']) == (448, 256, 0, 0, 1000)
    window = {'x': 64, 'y': 8, 'w': 320, 'h': 240}
    boxes = list(side['recesses'].values()) + list(side['leverTapZones'].values())
    for i, rect in enumerate(boxes):
        assert inside(rect, dict(x=0, y=0, **side['size']))
        assert separate(rect, window)
        assert all(separate(rect, other) for other in boxes[i+1:])
    hud = side['hud']
    contents = {
        'scoreMode': [dict(hud['scoreIcon'], w=12, h=12), dict(hud['digits'], w=32, h=10), dict(hud['modeLabel'], w=23, h=5)],
        'lives': [dict(hud['lives'], w=2* hud['lives']['pitch']+14, h=16)],
        'sound': [hud['sound']], 'menu': [side['menu']], 'status': [dict(hud['lights'], w=6, h=6)]
    }
    for name, rects in contents.items():
        for i, rect in enumerate(rects):
            assert inside(rect, side['recesses'][name], inset=1), name
            assert all(separate(rect, other) for other in rects[i+1:]), name
    assert hud['digits']['pitch'] == 8 and hud['digits']['count'] == 4
    assert hud['lives']['pitch'] >= 14
    for hand in ('l', 'r'):
        tap = side['leverTapZones'][hand]
        assert tap['w'] >= 24 and tap['h'] >= 48 and tap['y'] >= 128
        assert inside(tap, side['panels'][hand])
        assert inside(dict(side['levers'][hand], w=24, h=40), tap)
    snd, menu = (side['recesses'][k] for k in ('sound', 'menu'))
    assert (snd['w'], snd['h']) == (menu['w'], menu['h'])
    assert menu['y'] - snd['y'] - snd['h'] == 4
    pv = root / 'previews'
    small = Image.open(pv / 'operator-side-1x.png').convert('RGBA')
    big = Image.open(pv / 'operator-side-4x.png').convert('RGBA')
    assert small.size == (448, 256) and big.size == (1792, 1024)
    assert small.resize(big.size, Image.Resampling.NEAREST).tobytes() == big.tobytes()
    # Readouts use the existing unscaled source sprites in the actual preview.
    for name, rect in [('hud.icon.score.0', hud['scoreIcon']), ('ui.hud_sound.idle.0', hud['sound'])] + [(f'hud.digit.{d}', dict(x=hud['digits']['x']+i*8, y=hud['digits']['y'])) for i, d in enumerate('0350')] + [('hud.icon.life.0', dict(x=hud['lives']['x']+i*14, y=hud['lives']['y'])) for i in range(3)]:
        f = a['frames'][name]
        src = image.crop(box(f))
        dst = small.crop(box(dict(rect, w=f['w'], h=f['h'])))
        for s, d in zip(src.getdata(), dst.getdata()):
            assert not s[3] or s == d, name
    cycle = Image.open(pv / 'operator-side-cycle-4x.gif')
    assert cycle.n_frames == 5 and cycle.info['loop'] == 0
    frames = []
    palette = {tuple(bytes.fromhex(c[1:])) for c in a['meta']['palette']}
    for frame, duration in zip(ImageSequence.Iterator(cycle), (300, 50, 250, 50, 100)):
        assert frame.size == big.size and frame.info['duration'] == duration
        assert set(frame.convert('RGB').getdata()) <= palette
        frames.append(frame.convert('RGBA').tobytes())
    assert frames == list(reversed(frames)), 'loop returns without jump'
    print(f'{theme}: rounded frame; side geometry, readouts, controls, native/4x and loop PASS')

pv = ROOT / 'assets/polar-signal/previews'
mock = Image.open(pv / 'iphone16pro-landscape-mock.png').convert('RGBA')
physical = Image.open(pv / 'iphone16pro-landscape-mock-dpr3.png').convert('RGBA')
assert mock.size == (874, 300) and physical.size == (2622, 900)
assert mock.resize(physical.size, Image.Resampling.NEAREST).tobytes() == physical.tobytes()
assert mock.crop((213, 22, 661, 278)).tobytes() == Image.open(pv / 'operator-side-1x.png').convert('RGBA').tobytes()
print('Reported iPhone viewport: 448x256 CSS room, exact 3 device pixels per room pixel PASS')
