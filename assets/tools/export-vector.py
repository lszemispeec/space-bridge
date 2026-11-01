"""Author VECTOR on the native pixel grid. Python 3 + Pillow; no resampling.

Accepted actor silhouettes supply registration, not shading. Trace their outer
contours and selected visor details; author scenery, cockpit and vehicle seams
as one-pixel paths. All interior material is black. Run from any directory.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/vector'
PV = OUT / 'previews'
PV.mkdir(parents=True, exist_ok=True)
REFERENCE = ROOT / 'assets/neon-orbit'
atlas = json.loads((REFERENCE / 'neon-orbit.json').read_text())
original = Image.open(REFERENCE / 'neon-orbit.png').convert('RGBA')
source_palette = [tuple(bytes.fromhex(h[1:])) + (255,) for h in atlas['meta']['palette']]
# The contract requires 16 unique entries; only the first four are painted.
PALETTE = ['#000000', '#28E060', '#A0FFB0', '#126832', '#001408', '#002010',
           '#003018', '#004020', '#005028', '#087038', '#108040', '#189048',
           '#20A050', '#38B860', '#60D880', '#C0FFD0']
BLACK, LINE, BRIGHT, DIM = [tuple(bytes.fromhex(h[1:])) + (255,) for h in PALETTE[:4]]
CLEAR = (0, 0, 0, 0)
atlas['meta'].update(theme='vector', image='vector.png', palette=PALETTE)
frames = atlas['frames']
retired = {f for n in atlas['retiredAnimations'] for f in atlas['animations'][n]['frames']}


def dump(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')


def blank(size, color=CLEAR):
    return Image.new('RGBA', size, color)


def boundary(mask, x, y):
    return any((x+dx, y+dy) not in mask for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)])


def trace(src, ink=LINE, detail=False):
    """Keep the accepted opaque silhouette, black inside, a 1px inner edge."""
    out = blank(src.size)
    mask = {(x, y) for y in range(src.height) for x in range(src.width) if src.getpixel((x, y))[3]}
    for x, y in mask:
        edge = boundary(mask, x, y)
        upper_left = (x-1, y) not in mask or (x, y-1) not in mask
        out.putpixel((x, y), (BRIGHT if upper_left and ink == LINE else ink) if edge else BLACK)
    if detail:
        visor = {(x, y) for x, y in mask if src.getpixel((x, y)) == source_palette[15]}
        for x, y in visor:
            if boundary(visor, x, y) and not boundary(mask, x, y):
                out.putpixel((x, y), DIM)
    return out


def suit(src):
    """Trace the authored suit material, including its visor and limb gaps."""
    im = blank(src.size)
    mask = set()
    for y in range(src.height):
        for x in range(src.width):
            c = src.getpixel((x,y))
            if c[3]: im.putpixel((x,y),BLACK)
            if c[3] and c != source_palette[0]: mask.add((x,y))
    for x,y in mask:
        if boundary(mask,x,y):
            im.putpixel((x,y),BRIGHT if (x,y-1) not in mask or (x-1,y) not in mask else LINE)
    return im


def scenery(legacy=False):
    im = blank((320, 240), BLACK)
    d = ImageDraw.Draw(im)
    # Distant faceted horizon stays above the actor corridor (y130..167).
    ridge = [(0,127),(15,110),(25,115),(37,91),(52,118),(67,124),(81,120),
             (96,127),(113,113),(126,125),(143,126),(158,119),(172,123),
             (191,121),(212,124),(233,117),(248,124),(269,102),(280,116),(296,111),(319,127)]
    d.line(ridge, fill=DIM)
    for a,b,c in [(15,110,25),(37,91,45),(113,113,120),(269,102,278),(296,111,307)]:
        d.line([(a,b),(c,128),(a+14,128)], fill=DIM)
    # Angular ringed world: deliberately sparse, with no filled stars or disks.
    planet = [(195,36),(211,30),(229,34),(241,47),(245,63),(238,79),
              (222,86),(205,81),(193,68),(189,51),(195,36)]
    d.line(planet, fill=DIM)
    d.line([(195,36),(205,50),(206,68),(205,81)], fill=DIM)
    d.line([(229,34),(223,50),(225,70),(238,79)], fill=DIM)
    d.line([(189,51),(205,50),(223,50),(241,47)], fill=DIM)
    d.line([(193,68),(206,68),(225,70),(242,70)], fill=DIM)
    d.line([(190,47),(177,44),(174,48),(185,59),(211,72),(246,85),(257,84),
            (259,80),(246,69)], fill=LINE)
    for x,y in [(38,39),(77,62),(124,34),(155,58),(274,39),(293,77)]:
        d.line([(x-1,y),(x+1,y)], fill=DIM)
        d.line([(x,y-1),(x,y+1)], fill=DIM)
    # The traverse remains quiet. Terrain begins below the creature/plate band.
    for pts in [[(0,202),(26,190),(47,201),(77,195),(104,208),(133,197),(162,205),(194,192),(222,204),(252,194),(283,207),(319,193)],
                [(0,230),(32,215),(63,230),(96,220),(129,239)],
                [(148,239),(180,220),(212,234),(244,216),(278,235),(319,222)]]:
        d.line(pts, fill=DIM)
    for pts in [[(26,190),(32,215),(47,201)],[(77,195),(63,230),(104,208)],
                [(133,197),(96,220)],[(194,192),(180,220),(162,205)],
                [(252,194),(244,216),(222,204)],[(283,207),(278,235),(319,222)]]:
        d.line(pts, fill=DIM)
    if legacy:
        d.rectangle((0,0,319,29), fill=BLACK)
        d.rectangle((0,0,31,239), fill=BLACK)
        d.rectangle((288,0,319,239), fill=BLACK)
    return im


def room(src, orientation):
    # Preserve the exact rounded-glass alpha mask; no line crosses the glass.
    im = trace(src, DIM)
    d = ImageDraw.Draw(im)
    layout = atlas['operatorRoom'][orientation]
    recesses = layout.get('recesses', atlas['operatorRoom']['recesses'])
    for r in recesses.values():
        x,y,w,h = (r[k] for k in ('x','y','w','h'))
        d.rectangle((x,y,x+w-1,y+h-1), outline=DIM)
    if orientation == 'side':
        d.line([(48,2),(48,253)], fill=DIM)
        d.line([(399,2),(399,253)], fill=DIM)
    else:
        d.line([(1,252),(im.width-2,252)], fill=DIM)
    return im


def vehicle(src, name):
    im = trace(src)
    d = ImageDraw.Draw(im)
    rocket = name.startswith('rocket')
    if rocket:
        d.line([(8,16),(25,16)], fill=DIM)
        d.line([(8,36),(25,36)], fill=DIM)
        d.line([(8,62),(25,62)], fill=DIM)
        d.rectangle((13,42,21,50), outline=LINE)
        d.line([(16,53),(16,57)], fill=DIM)
        mouth = (16,20,8,12)
    else:
        d.rectangle((18,13,27,20), outline=DIM)
        d.line([(22,13),(22,20)], fill=DIM)
        d.line([(17,27),(28,27)], fill=DIM)
        mouth = (4,12,8,18)
    x,y,w,h = mouth
    d.rectangle((x-1,y-1,x+w,y+h), outline=LINE)
    d.rectangle((x,y,x+w-1,y+h-1), fill=BLACK)
    if '.open.' not in name:
        bottom = y+h-1 if '.closed.' in name or name.startswith('rover.idle') else y+h//2-1
        d.line([(x+2,bottom-2),(x+w-3,bottom-2)], fill=DIM)
        d.line([(x+w//2,y+2),(x+w//2,bottom-2)], fill=DIM)
    # Do not extend vehicle silhouette with authored internal seams.
    im.putalpha(src.getchannel('A'))
    return im


images = {}
for name,f in frames.items():
    src = original.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
    if name in retired:
        im = blank(src.size)
    elif name in ('background', 'background.window'):
        im = scenery(name == 'background')
    elif name.startswith('frame.room.'):
        im = room(src, name.split('.')[2])
    elif name.startswith(('rocket.tophatch.', 'rover.hatch.', 'rover.idle.')):
        im = vehicle(src, name)
    elif name.startswith(('cosmonaut.', 'crater.tentacle.', 'hud.icon.life')):
        im = suit(src)
    elif name.startswith('crater.eyes.'):
        im = blank(src.size)
        whites = {(x,y) for y in range(src.height) for x in range(src.width)
                  if src.getpixel((x,y)) == source_palette[15]}
        # Trace eye whites around the existing pupils. Black still occludes.
        for y in range(src.height):
            for x in range(src.width):
                if src.getpixel((x,y))[3]:
                    im.putpixel((x,y), BLACK)
        for left,right in ((0,12),(12,24)):
            eye = {(x,y) for x,y in whites if left <= x < right}
            filled = set()
            for y in {y for x,y in eye}:
                xs = [x for x,yy in eye if yy==y]
                filled.update((x,y) for x in range(min(xs),max(xs)+1))
            for x,y in filled:
                if boundary(filled,x,y): im.putpixel((x,y), BRIGHT)
                elif src.getpixel((x,y)) == source_palette[0]: im.putpixel((x,y), DIM)
    elif name.startswith('crater.front.'):
        im = blank(src.size)
        mask = {(x,y) for y in range(src.height) for x in range(src.width) if src.getpixel((x,y))[3]}
        for x,y in mask:
            im.putpixel((x,y), DIM if (x,y+1) not in mask else BLACK)
    elif name == 'crater.idle.0' or name in {f'crater.{i}' for i in range(4)}:
        im = blank(src.size)
        im.putalpha(src.getchannel('A'))
        i = int(name[-1]) if name[-1].isdigit() else 0
        ImageDraw.Draw(im).line([(1,4),(5,2),(9+i,1),(16,1),(21,3),(23,4),(18,6),(8,6),(1,4)],fill=DIM)
    elif name.startswith('hud.digit.'):
        im = blank(src.size)
        segments = {'a':[(2,0),(5,0)],'b':[(6,1),(6,3)],'c':[(6,5),(6,8)],
                    'd':[(2,9),(5,9)],'e':[(1,5),(1,8)],'f':[(1,1),(1,3)],'g':[(2,4),(5,4)]}
        active = ['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'][int(name[-1])]
        for s in active: ImageDraw.Draw(im).line(segments[s],fill=BRIGHT)
    elif name.startswith('hud.label.'):
        im = blank(src.size)
        glyphs = {'S':['111','100','111','001','111'],'C':['111','100','100','100','111'],
                  'O':['111','101','101','101','111'],'R':['110','101','110','101','101'],
                  'E':['111','100','110','100','111'],'L':['100','100','100','100','111'],
                  'I':['111','010','010','010','111'],'V':['101','101','101','101','010']}
        word = 'SCORE' if '.score.' in name else 'LIVES'
        for i,ch in enumerate(word):
            for y,row in enumerate(glyphs[ch]):
                for x,v in enumerate(row):
                    if v=='1': im.putpixel((i*4+x+1,y+1),BRIGHT)
    elif name.startswith(('ui.title_', 'ui.hud_')):
        # Outline controls, keep the native one-pixel bitmap lettering readable.
        im = trace(src, DIM)
        speaker_end = 20 if name.startswith('ui.title_') else 15
        speaker = {(x,y) for y in range(src.height) for x in range(speaker_end)
                   if src.getpixel((x,y)) == source_palette[12]}
        for y in range(src.height):
            for x in range(src.width):
                c = src.getpixel((x,y))
                if c in (source_palette[15],source_palette[12]):
                    if x<speaker_end and (x,y) in speaker and not boundary(speaker,x,y):
                        continue
                    im.putpixel((x,y), LINE if 'pressed' in name else BRIGHT)
                elif '.title_theme.' not in name and 2 <= x < speaker_end and 3 <= y <= 12 and c in (source_palette[7],source_palette[11]):
                    im.putpixel((x,y), BRIGHT if c==source_palette[7] else LINE)
    elif name.startswith('frame.lights.'):
        im = trace(src, [DIM,LINE,BRIGHT,LINE][int(name[-1])])
    elif name.startswith('ambient.'):
        im = trace(src, DIM)
    else:
        im = trace(src, detail=True)
    images[name] = im

# Closed compatibility rover must be byte-identical to the production model.
images['rover.idle.0'] = images['rover.hatch.closed.0'].copy()
sheet = blank((atlas['meta']['size']['w'],atlas['meta']['size']['h']))
for n,im in images.items(): sheet.paste(im,(frames[n]['x'],frames[n]['y']))
sheet.save(OUT / 'vector.png')
dump(OUT / 'vector.json',atlas)
(OUT / 'palette.hex').write_text('\n'.join(PALETTE)+'\n')
dump(OUT / 'theme.json', {'id':'vector','name':'VECTOR','atlas':'atlas/vector.json',
     'palette':{'text':PALETTE[2],'accent':PALETTE[1],'overlay':PALETTE[0]},
     'paintedColours':PALETTE[:4], 'reservedColours':PALETTE[4:]})
for ext in ('png','json'):
    (ROOT / 'public/atlas' / f'vector.{ext}').write_bytes((OUT / f'vector.{ext}').read_bytes())


def pair(im, name):
    im.save(PV / f'{name}-1x.png')
    im.resize((im.width*4,im.height*4),Image.Resampling.NEAREST).save(PV / f'{name}-4x.png')


def gif(ims, name, durations, scale=4):
    # Fixed indexed palette avoids quantization and preserves transparent black.
    pal = [0,0,0] + [c for h in PALETTE for c in bytes.fromhex(h[1:])]
    pal += [0]*(768-len(pal))
    indexes = {tuple(bytes.fromhex(h[1:]))+(255,):i+1 for i,h in enumerate(PALETTE)}
    encoded = []
    for im in ims:
        p = Image.new('P',im.size)
        p.putpalette(pal)
        p.putdata([indexes[pixel] if pixel[3] else 0 for pixel in im.getdata()])
        encoded.append(p.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST))
    encoded[0].save(PV / name,save_all=True,append_images=encoded[1:],duration=durations,
                    loop=0,transparency=0,disposal=2,optimize=False)


strips = []
for n,a in atlas['animations'].items():
    ims = [images[f] for f in a['frames']]
    strip = blank((sum(im.width for im in ims),max(im.height for im in ims)))
    x = 0
    for im in ims:
        strip.paste(im,(x,0)); x += im.width
    strip.save(PV / f'{n}-strip.png')
    strip.resize((strip.width*4,strip.height*4),Image.Resampling.NEAREST).save(PV / f'{n}-strip-4x.png')
    durations = [frames[f]['duration'] for f in a['frames']]
    strips.append({'animation':n,'file':f'{n}-strip.png','loop':a['loop'],'durations':durations})
    if n.startswith(('cosmonaut.air.','crater.eyes.','crater.tentacle.','ui.lever.','frame.lights')):
        gif(ims,f'{n}-4x.gif',durations)
dump(PV / 'strips.json',strips)


def at(dst,n,x,y):
    f = frames[n]
    dst.alpha_composite(images[n],(x-f['ax'],y-f['ay']))


def scene(legacy=False, step=0):
    im = images['background' if legacy else 'background.window'].copy()
    for n in ('ambient.sky','ambient.drift','ambient.signal'):
        at(im,atlas['animations'][n]['frames'][step % len(atlas['animations'][n]['frames'])],0,0)
    at(im,'rocket.tophatch.open.0',43,169)
    at(im,'rover.hatch.closed.0',248,180)
    for i,x in enumerate((106,146,186,226)):
        at(im,f'crater.{i}',x,177)
        if i == 0: at(im,'crater.eyes.peek.2',x,177)
        if i == 2: at(im,'crater.tentacle.reach.2',x,177)
        at(im,f'crater.front.{i}',x,177)
    at(im,'plate.idle.0',146,181)
    at(im,f'cosmonaut.air.spin.{(1+step)%8}',106,126)
    at(im,f'cosmonaut.air.spin.{(4+step)%8}',146,90)
    at(im,f'cosmonaut.air.flail.{step%2}',206,119)
    return im


GLYPHS = {'G':['111','100','101','101','111'],'A':['010','101','111','101','101'],
          'M':['101','111','111','101','101'],'E':['111','100','110','100','111'],
          'N':['110','101','101','101','101'],'U':['101','101','101','101','111']}


def label(im,word,x,y):
    for i,ch in enumerate(word):
        for j,row in enumerate(GLYPHS.get(ch,[])):
            for k,v in enumerate(row):
                if v == '1': im.putpixel((x+i*4+k,y+j),BRIGHT)


def operator(orientation,step=0,light=2,screen=None):
    room = atlas['operatorRoom']
    layout = room[orientation]
    s = layout['scene']
    im = blank((layout['size']['w'],layout['size']['h']),BLACK)
    screen = scene() if screen is None else screen
    im.alpha_composite(screen.crop((s['sx'],s['sy'],s['sx']+s['w'],s['sy']+s['h'])),(s['dx'],s['dy']))
    im.alpha_composite(images[layout['frame']])
    hud = layout.get('hud',room['hud'])
    for side in ('l','r'):
        p = layout['levers'][side]
        at(im,f'ui.lever.{side}.'+('idle.0' if step==0 else f'pull.{step-1}'),p['x'],p['y'])
    at(im,'hud.icon.score.0',**hud['scoreIcon'])
    for i,ch in enumerate('0350'): at(im,f'hud.digit.{ch}',hud['digits']['x']+i*hud['digits']['pitch'],hud['digits']['y'])
    label(im,'GAME A',**hud['modeLabel'])
    for i in range(3): at(im,'hud.icon.life.0',hud['lives']['x']+i*hud['lives']['pitch'],hud['lives']['y'])
    at(im,'ui.hud_sound.idle.0',hud['sound']['x'],hud['sound']['y'])
    at(im,f'frame.lights.{light}',**hud['lights'])
    m = layout.get('menu',room['menu'])
    ImageDraw.Draw(im).rectangle((m['x'],m['y'],m['x']+m['w']-1,m['y']+m['h']-1),outline=LINE)
    label(im,'MENU',m['x']+11,m['y']+5)
    return im


for orientation in ('landscape','portrait','side'):
    pair(operator(orientation),f'operator-{orientation}')
    gif([operator(orientation,s) for s in (0,1,2,1,0)],f'operator-{orientation}-cycle-4x.gif',[300,50,250,50,100])

screen = scene(True)
at(screen,'ui.hud_sound.idle.0',142,4)
pair(screen,'screen')
pair(scene(),'airborne-contrast')
pair(screen.crop((122,58,170,122)),'cosmonaut-air')
title = screen.copy()
at(title,'ui.title_theme.idle.0',100,190)
at(title,'ui.title_sound.idle.0',164,190)
pair(title,'title-controls')


def contact(names, name, width=320):
    index=[]; x=y=2; height=0
    for n in names:
        im=images[n]
        if x+im.width+2>width: x=2; y+=height+4; height=0
        index.append({'name':n,'x':x,'y':y,'w':im.width,'h':im.height})
        x+=im.width+4; height=max(height,im.height)
    out=blank((width,y+height+2),BLACK)
    for item in index: out.alpha_composite(images[item['name']],(item['x'],item['y']))
    pair(out,name)
    dump(PV / f'{name}-index.json',index)


contact(list(frames),'frames',640)
(PV / 'frame-index.json').write_bytes((PV / 'frames-index.json').read_bytes())
for name,prefixes in [('cosmonauts',('cosmonaut.',)),('suits',('cosmonaut.','hud.icon.life')),
                      ('creatures',('crater.',)),('vehicles',('rocket.tophatch.','rover.hatch.')),
                      ('levers',('ui.lever.',)),('ui-states',('ui.title_','ui.hud_'))]:
    contact([n for n in frames if n.startswith(prefixes)],name)

for prefix in ('rocket.tophatch','rover.hatch'):
    gif([images[f'{prefix}.{s}.0'] for s in ('closed','opening','open','opening','closed')],
        f'{prefix}-cycle-4x.gif',[300,90,500,90,300])
(PV / 'rocket.hatch-cycle-4x.gif').write_bytes((PV / 'rocket.tophatch-cycle-4x.gif').read_bytes())

lever_ims=[]
for s in ('idle.0','pull.0','pull.1','pull.0','idle.0'):
    im=blank((64,48),BLACK)
    at(im,f'ui.lever.l.{s}',4,4); at(im,f'ui.lever.r.{s}',36,4)
    lever_ims.append(im)
gif(lever_ims,'levers-cycle-4x.gif',[300,50,250,50,100])
gif([operator('landscape',s) for s in (0,1,2,1,0)],'operator-room.gif',[300,50,250,50,100],scale=1)
gif([scene(True,i) for i in range(8)]+[scene(True,0)],'jump-bounce.gif',[660]*8+[720],scale=1)

# Offline hatch-exit pose study: timing here is for art review, not simulation.
exit_ims=[]
for state,pose in [('closed',None),('opening',None),('open',None),('open','emerge.0'),
                   ('open','emerge.1'),('open','emerge.2'),('open',None),('opening',None),('closed',None)]:
    sc=scene()
    sc.paste(images['background.window'].crop((43,80,76,169)),(43,80))
    at(sc,f'rocket.tophatch.{state}.0',43,169)
    if pose: at(sc,f'cosmonaut.{pose}',63,112)
    exit_ims.append(operator('landscape',screen=sc))
gif(exit_ims,'tophatch-exit-4x.gif',[300,90,180,100,100,100,180,90,300])
print(f'VECTOR: {len(frames)} frames, {len(strips)} animation strips; native and exact 4x previews.')
