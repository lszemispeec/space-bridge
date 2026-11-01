"""Audit rounded viewport pixels and preservation against the accepted room art."""
import io
import json
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BASE = '751cd3c72d2a9d77872b4f890898f572570c5e97'
THEMES = ('polar-signal', 'desert-expedition', 'neon-orbit')


def previous(path):
    return subprocess.check_output(['git', 'show', f'{BASE}:{path}'], cwd=ROOT)


def box(f):
    return f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']


def audit(theme):
    directory = ROOT / 'assets' / theme
    atlas = json.loads((directory / f'{theme}.json').read_text())
    old = json.loads(previous(f'assets/{theme}/{theme}.json'))
    sheet = Image.open(directory / f'{theme}.png').convert('RGBA')
    before = Image.open(io.BytesIO(previous(f'assets/{theme}/{theme}.png'))).convert('RGBA')
    assert atlas['meta'] == old['meta']
    assert atlas['frames'] == old['frames'], 'names, rectangles, anchors and durations'
    assert atlas['animations'] == old['animations']
    normalized = json.loads(json.dumps(atlas))
    for orientation in ('landscape', 'portrait', 'side'):
        layout = normalized['operatorRoom'][orientation]
        assert 'windowCornerCut' not in layout
        assert layout.pop('windowCornerRadius') == 20
        layout['windowCornerCut'] = 20
    assert normalized == old, 'only radius metadata changes'
    palette = {tuple(bytes.fromhex(c[1:])) for c in atlas['meta']['palette']}
    assert all(a in (0, 255) and (not a or (r, g, b) in palette) for r, g, b, a in sheet.getdata())
    restored = sheet.copy()
    for orientation in ('landscape', 'portrait', 'side'):
        layout = atlas['operatorRoom'][orientation]
        f, s = atlas['frames'][layout['frame']], layout['scene']
        frame, old_frame = sheet.crop(box(f)), before.crop(box(f))
        restored.paste(old_frame, (f['x'], f['y']))
        assert frame.getchannel('A').getextrema() == (0, 255)
        # The outer silhouette and controls beyond the sill stay exactly fixed.
        for edge in ((0, 0, f['w'], 2), (0, f['h']-2, f['w'], f['h']), (0, 0, 2, f['h']), (f['w']-2, 0, f['w'], f['h'])):
            assert frame.crop(edge).getchannel('A').tobytes() == old_frame.crop(edge).getchannel('A').tobytes()
        preserved = [(0, 0, 48, 256), (400, 0, 448, 256)] if orientation == 'side' else [(0, 254, f['w'], f['h'])]
        for region in preserved:
            assert frame.crop(region).tobytes() == old_frame.crop(region).tobytes(), 'panels and console preserved'
        radius = layout['windowCornerRadius']
        opaque = set()
        for y in range(s['h']):
            for x in range(s['w']):
                cx, cy = min(x, s['w']-1-x), min(y, s['h']-1-y)
                expected = cx < radius and cy < radius and (radius-cx-0.5)**2 + (radius-cy-0.5)**2 > radius**2
                actual = frame.getpixel((s['dx']+x, s['dy']+y))[3] == 255
                assert actual == expected, (theme, orientation, x, y, 'quarter-circle mask')
                if actual:
                    opaque.add((x+s['sx'], y+s['sy']))
        assert len(opaque) == 336, 'four symmetric radius-20 corners'
        # Test every vehicle/hatch pose, plate slot, and crater pose at scene anchors.
        for name, sprite in atlas['frames'].items():
            positions = []
            if name.startswith('rocket.tophatch.'):
                positions = [(43, 169)]
            elif name.startswith('rover.hatch.'):
                positions = [(248, 180)]
            elif name.startswith('plate.'):
                positions = [(x, 181) for x in (106, 146, 186, 226)]
            elif name.startswith('crater.'):
                positions = [(x, 177) for x in (106, 146, 186, 226)]
            if not positions:
                continue
            art = sheet.crop(box(sprite))
            for px, py in positions:
                pixels = {(px+x-sprite['ax'], py+y-sprite['ay']) for y in range(sprite['h']) for x in range(sprite['w']) if art.getpixel((x,y))[3]}
                assert not pixels & opaque, (orientation, name, 'gameplay clearance')
        preview = Image.open(directory / f'previews/operator-{orientation}-1x.png').convert('RGBA')
        enlarged = Image.open(directory / f'previews/operator-{orientation}-4x.png').convert('RGBA')
        assert preview.resize((f['w']*4, f['h']*4), Image.Resampling.NEAREST).tobytes() == enlarged.tobytes()
        assert {pixel[:3] for pixel in preview.getdata()} <= palette
        assert set(preview.getchannel('A').getdata()) == {255}
        old_preview = Image.open(io.BytesIO(previous(f'assets/{theme}/previews/operator-{orientation}-1x.png'))).convert('RGBA')
        for y in range(f['h']):
            for x in range(f['w']):
                if frame.getpixel((x,y)) == old_frame.getpixel((x,y)):
                    assert preview.getpixel((x,y)) == old_preview.getpixel((x,y)), 'preview unchanged beyond frame edit'
        strip = Image.open(directory / f'previews/frame.room.{orientation}-strip.png').convert('RGBA')
        assert strip.tobytes() == frame.tobytes()
    assert restored.tobytes() == before.tobytes(), 'every unrelated sheet pixel preserved'
    for ext in ('png', 'json'):
        assert (directory / f'{theme}.{ext}').read_bytes() == (ROOT / 'public/atlas' / f'{theme}.{ext}').read_bytes()
    print(f'{theme}: all three rounded masks, gameplay clearance, palette, controls, preservation and 1x/4x PASS')


if __name__ == '__main__':
    for theme in THEMES:
        audit(theme)
