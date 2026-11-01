"""Independent VECTOR pixel/preview audit, complementing art-assets.test.ts.

The older verify-art.py also audits historical revisions and shaded-theme
colour rules. Those remain unchanged; this audit checks the wireframe style.
"""
import json
from pathlib import Path
from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / 'assets/vector'
PV = DIR / 'previews'
atlas = json.loads((DIR / 'vector.json').read_text())
reference = json.loads((ROOT / 'assets/neon-orbit/neon-orbit.json').read_text())
reference_sheet = Image.open(ROOT / 'assets/neon-orbit/neon-orbit.png').convert('RGBA')
sheet = Image.open(DIR / 'vector.png').convert('RGBA')
palette = [tuple(bytes.fromhex(h[1:]))+(255,) for h in atlas['meta']['palette']]
BLACK, LINE, BRIGHT, DIM = palette[:4]
assert len(set(palette)) == 16
assert sheet.size == tuple(atlas['meta']['size'][k] for k in ('w','h'))
assert atlas['meta']['theme'] == 'vector' and atlas['meta']['image'] == 'vector.png'
for key in reference.keys() - {'meta'}:
    assert atlas[key] == reference[key], f'contract drift: {key}'
for ext in ('png','json'):
    assert (DIR / f'vector.{ext}').read_bytes() == (ROOT / 'public/atlas' / f'vector.{ext}').read_bytes()
assert (DIR / 'palette.hex').read_text().splitlines() == atlas['meta']['palette']
assert json.loads((DIR / 'theme.json').read_text())['palette'] == {
    'text':'#A0FFB0','accent':'#28E060','overlay':'#000000'}

occupied = Image.new('1',sheet.size)
images = {}
retired = {f for n in atlas['retiredAnimations'] for f in atlas['animations'][n]['frames']}
for n,f in atlas['frames'].items():
    x,y,w,h = (f[k] for k in ('x','y','w','h'))
    box = (x,y,x+w,y+h)
    assert 0 <= x < x+w <= sheet.width and 0 <= y < y+h <= sheet.height, n
    assert not occupied.crop(box).getbbox(), f'overlapping cell: {n}'
    occupied.paste(1,box)
    im = sheet.crop(box)
    images[n] = im
    colours = set(im.getdata())
    assert all(p[3] in (0,255) for p in colours), f'partial alpha: {n}'
    assert {p for p in colours if p[3]} <= set(palette[:4]), f'off-palette or reserved ink: {n}'
    if n in retired or n in ('ambient.drift.3','crater.eyes.hide.2'):
        assert not im.getbbox(), f'retired frame visible: {n}'
    else:
        assert any(p in (LINE,BRIGHT,DIM) for p in colours), f'invisible frame: {n}'
    # Solid colour blocks would read as shaded/fill art, not native wire paths.
    for yy in range(h-2):
        for xx in range(w-2):
            assert not all(im.getpixel((xx+dx,yy+dy)) in (LINE,BRIGHT,DIM)
                           for dx in range(3) for dy in range(3)), f'3x3 green fill: {n} at {xx},{yy}'
    if n.startswith('cosmonaut.'):
        src = reference_sheet.crop(box)
        assert im.getchannel('A').tobytes() == src.getchannel('A').tobytes(), f'actor silhouette: {n}'
        if '.air.' in n: assert im.getpixel((10,11))[3] == 255, f'body pivot: {n}'
        else: assert im.getbbox()[3] == h, f'feet registration: {n}'
for pixel,cell in zip(sheet.getdata(),occupied.getdata()):
    assert cell or pixel[3] == 0, 'stray pixel outside frame'

for n in ('background','background.window'):
    im=images[n]
    assert set(im.getchannel('A').getdata()) == {255}, n
    assert set(im.crop((76,130,248,168)).getdata()) == {BLACK}, 'quiet actor corridor'
assert images['background'].crop((32,30,288,240)).tobytes() == images['background.window'].crop((32,30,288,240)).tobytes()

for prefix,mouth in [('rocket.tophatch',(16,20,8,12)),('rover.hatch',(4,12,8,18))]:
    states=[images[f'{prefix}.{s}.0'] for s in ('closed','opening','open')]
    assert len({s.tobytes() for s in states}) == 3, 'distinct shutter poses'
    assert len({s.getchannel('A').tobytes() for s in states}) == 1, 'stable vehicle silhouette'
    x,y,w,h=mouth
    assert set(states[2].crop((x,y,x+w,y+h)).getdata()) == {BLACK}, 'open mouth'
    for yy in range(states[0].height):
        for xx in range(states[0].width):
            if not (x<=xx<x+w and y<=yy<y+h):
                assert len({s.getpixel((xx,yy)) for s in states}) == 1, 'shutter-only change'
assert images['rover.idle.0'].tobytes() == images['rover.hatch.closed.0'].tobytes()
assert len({images[f'crater.{i}'].tobytes() for i in range(4)}) == 4
assert images['crater.eyes.look.l.0'].tobytes() != images['crater.eyes.look.r.0'].tobytes()
assert len({images[f'frame.lights.{i}'].tobytes() for i in range(4)}) >= 3
for control in ('title_theme','title_sound','hud_sound'):
    states=[im.tobytes() for n,im in images.items() if n.startswith(f'ui.{control}.')]
    assert len(set(states)) == len(states), f'indistinguishable button: {control}'
for side in ('l','r'):
    poses=[images[f'ui.lever.{side}.{s}'] for s in ('idle.0','pull.0','pull.1')]
    assert len({im.tobytes() for im in poses}) == 3
    assert len({im.crop((0,29,24,40)).tobytes() for im in poses}) == 1, 'stationary lever base'
for orientation in ('landscape','portrait','side'):
    layout=atlas['operatorRoom'][orientation]
    im=images[layout['frame']]
    s=layout['scene']; r=layout['windowCornerRadius']
    for y in range(s['h']):
        for x in range(s['w']):
            cx,cy=min(x,s['w']-1-x),min(y,s['h']-1-y)
            opaque=cx<r and cy<r and (r-cx-.5)**2+(r-cy-.5)**2>r*r
            assert bool(im.getpixel((x+s['dx'],y+s['dy']))[3]) == opaque, f'glass mask: {orientation}'

strips=json.loads((PV / 'strips.json').read_text())
assert {e['animation'] for e in strips} == set(atlas['animations'])
for entry in strips:
    strip=Image.open(PV / entry['file']).convert('RGBA'); x=0
    anim=atlas['animations'][entry['animation']]
    assert entry['loop'] == anim['loop']
    assert entry['durations'] == [atlas['frames'][n]['duration'] for n in anim['frames']]
    for n in anim['frames']:
        im=images[n]
        assert strip.crop((x,0,x+im.width,im.height)).tobytes() == im.tobytes(), f'strip source: {n}'
        x+=im.width
    assert strip.width == x
    if entry['animation'].startswith(('cosmonaut.air.','crater.eyes.','crater.tentacle.','ui.lever.','frame.lights')):
        loop=Image.open(PV / f"{entry['animation']}-4x.gif")
        assert loop.n_frames == len(anim['frames']), entry['animation']
        for i,actual in enumerate(ImageSequence.Iterator(loop)):
            expected=images[anim['frames'][i]]
            expected=expected.resize((expected.width*4,expected.height*4),Image.Resampling.NEAREST)
            assert actual.info['duration'] == entry['durations'][i], entry['animation']
            for a,b in zip(actual.convert('RGBA').getdata(),expected.getdata()):
                assert a[3] == b[3] and (not a[3] or a==b), entry['animation']

for file in PV.glob('*.png'):
    im=Image.open(file).convert('RGBA')
    assert {p for p in im.getdata() if p[3]} <= set(palette[:4]), file.name
    if '-4x' in file.name:
        native=PV / file.name.replace('-4x','-1x')
        if not native.exists(): native=PV / file.name.replace('-4x','')
        small=Image.open(native).convert('RGBA')
        assert im.size == (small.width*4,small.height*4)
        assert small.resize(im.size,Image.Resampling.NEAREST).tobytes() == im.tobytes(), file.name
for file in PV.glob('*.gif'):
    im=Image.open(file)
    assert im.info.get('loop') == 0
    for f in ImageSequence.Iterator(im):
        assert f.info['duration'] > 0
        rgba=f.convert('RGBA')
        assert {p for p in rgba.getdata() if p[3]} <= set(palette[:4]), file.name
        if '-4x' in file.name:
            native=rgba.resize((rgba.width//4,rgba.height//4),Image.Resampling.NEAREST)
            assert native.resize(rgba.size,Image.Resampling.NEAREST).tobytes() == rgba.tobytes(), file.name
for name in ('levers-cycle-4x.gif','operator-landscape-cycle-4x.gif','operator-portrait-cycle-4x.gif',
             'operator-side-cycle-4x.gif','tophatch-exit-4x.gif','jump-bounce.gif'):
    im=Image.open(PV / name)
    first=im.convert('RGBA').tobytes(); im.seek(im.n_frames-1)
    assert im.convert('RGBA').tobytes() == first, f'loop seam: {name}'
print(f'VECTOR PASS: {len(images)} frames; {len(strips)} strips; 3 greens + black; exact contract, binary alpha, clear glass, hatch states, pixel grid and loop seams.')
