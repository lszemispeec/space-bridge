/** Native-pixel hatch and creature art. Run from any directory; needs ImageMagick. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync as run } from 'node:child_process';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const json = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
const blank = (w,h,c=[0,0,0,0]) => ({w,h,data:Buffer.from(Array(w*h).fill(c).flat())});
const rgba = hex => [...Buffer.from(hex.slice(1),'hex'),255];
function dot(im,x,y,c) { if(x>=0&&x<im.w&&y>=0&&y<im.h)im.data.set(c,(y*im.w+x)*4); }
function rect(im,x,y,w,h,c) { for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)dot(im,i,j,c); }
function read(p) {const [w,h]=run('magick',['identify','-format','%w %h',p]).toString().split(' ').map(Number);return {w,h,data:run('magick',[p,'-depth','8','RGBA:-'],{maxBuffer:128e6})};}
function save(im,p,scale=1) {
 if(scale===1&&fs.existsSync(p)){const old=read(p);if(old.w===im.w&&old.h===im.h&&old.data.equals(im.data))return;}
 run('magick',['-size',`${im.w}x${im.h}`,'-depth','8','RGBA:-','-scale',`${scale*100}%`,'-define','png:exclude-chunks=date,time','-define','png:color-type=6',p],{input:im.data,maxBuffer:128e6});
}
function crop(im,x,y,w,h) {const out=blank(w,h);for(let j=0;j<h;j++)im.data.copy(out.data,j*w*4,((y+j)*im.w+x)*4,((y+j)*im.w+x+w)*4);return out;}
function paste(dst,src,x,y) {for(let j=0;j<src.h;j++)for(let i=0;i<src.w;i++){const o=(j*src.w+i)*4;if(src.data[o+3])dot(dst,x+i,y+j,src.data.subarray(o,o+4));}}
function line(points) {const result=[];for(let n=1;n<points.length;n++){let [x,y]=points[n-1];const [xx,yy]=points[n],dx=Math.abs(xx-x),dy=-Math.abs(yy-y),sx=x<xx?1:-1,sy=y<yy?1:-1;let e=dx+dy;for(;;){result.push([x,y]);if(x===xx&&y===yy)break;const e2=2*e;if(e2>=dy){e+=dy;x+=sx;}if(e2<=dx){e+=dx;y+=sy;}}}return result;}
function contour(ink,dark) {const out=blank(ink.w,ink.h);for(let y=0;y<ink.h;y++)for(let x=0;x<ink.w;x++)if(ink.data[(y*ink.w+x)*4+3])for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]])dot(out,x+dx,y+dy,dark);paste(out,ink,0,0);return out;}
const themes=['polar-signal','desert-expedition','neon-orbit'];
const creatureAnims=['crater.eyes.peek','crater.eyes.blink','crater.eyes.look.l','crater.eyes.look.r','crater.eyes.hide','crater.tentacle.reach','crater.tentacle.grab'];
const newFrame = n => /^(rocket\.hatch\.|cosmonaut\.ledge\.|crater\.[0-3]$|crater\.front\.[1-3]$|crater\.eyes\.|crater\.tentacle\.)/.test(n);
// Each row is independently specified: rounded, broken boulder, slanted fissure, scalloped.
const rims=[
 [[8,15],[5,18],[3,20],[1,22],[0,23],[2,21],[5,18],[8,15]],
 [[3,6],[2,18],[1,21],[0,22],[1,23],[3,22],[4,19],[6,16]],
 [[14,17],[10,21],[6,23],[3,22],[0,20],[1,18],[4,15],[5,9]],
 [[5,8],[3,18],[2,20],[0,23],[1,22],[0,21],[3,20],[7,17]],
];
const reachPaths=[[[12,28],[12,25],[14,24]],[[12,28],[10,24],[10,20],[12,18]],[[12,28],[9,24],[8,19],[9,14],[12,11],[16,12],[17,15],[15,17]],[[12,28],[11,27],[12,26],[14,27]]];
const grabPaths=[[[12,28],[8,25],[6,21],[6,17],[9,15],[12,16]],[[12,28],[8,26],[6,21],[8,17],[14,17],[17,20],[15,23],[10,23],[8,20]],[[12,28],[8,26],[7,23],[10,21],[15,22],[17,25],[14,27],[10,26]],[[12,29],[9,28],[8,25],[12,23],[16,25],[15,28],[12,28]],[[12,29],[10,28],[12,27],[14,28]]];
const report={revision:5,themes:{}};
for(const theme of themes){
 const dir=path.join(ROOT,'assets',theme),pv=path.join(dir,'previews');
 const atlas=JSON.parse(fs.readFileSync(path.join(dir,`${theme}.json`)));
 const sheet0=read(path.join(dir,`${theme}.png`)),p=atlas.meta.palette.map(rgba);
 const get=n=>{const f=atlas.frames[n];return crop(sheet0,f.x,f.y,f.w,f.h);};
 const suit=theme==='neon-orbit'?12:8,mid=theme==='neon-orbit'?11:6;
 const tent=theme==='polar-signal'?[13,14,15]:theme==='desert-expedition'?[10,11,13]:[5,7,15];
 const terrain=theme==='polar-signal'?[1,3,5]:theme==='desert-expedition'?[2,4,7]:[2,5,7];
 const additions={},images={},animations={};
 function add(name,im,ax,ay,duration){images[name]=im;additions[name]={x:0,y:0,w:im.w,h:im.h,ax,ay,duration};}
 function anim(name,ims,ax,ay,durations,loop=false){const names=ims.map((im,i)=>{const n=`${name}.${i}`;add(n,im,ax,ay,Array.isArray(durations)?durations[i]:durations);return n;});animations[name]={frames:names,loop};}
 // Existing hull is retained as the base; the new upper airlock and gantry are pixel-native.
 function hatch(width){const im=blank(44,89);paste(im,get('rocket.door_closed.0'),0,0);
   rect(im,12,9,15,21,p[0]);rect(im,11,11,17,19,p[0]);rect(im,12,11,15,18,p[mid]);rect(im,13,10,13,1,p[suit]);rect(im,14,11,12,19,p[0]);
   rect(im,12,14,1,3,p[tent[0]]);dot(im,12,25,p[suit]);
   if(width){rect(im,14,11,width,18,p[tent[0]]);rect(im,14,11,1,18,p[tent[1]]);if(width>4)rect(im,14+width-3,19,1,3,p[suit]);}
   rect(im,26,12,1,2,p[tent[2]]);rect(im,24,30,20,3,p[0]);rect(im,24,30,19,1,p[suit]);rect(im,24,31,19,1,p[terrain[1]]);
   for(const [x,y]of line([[25,39],[36,33]]))dot(im,x,y,p[0]);
   // The old low red panel becomes a closed maintenance cover, not a second exit.
   rect(im,14,64,9,17,p[mid]);rect(im,15,65,1,14,p[suit]);rect(im,20,68,1,1,p[0]);rect(im,20,75,1,1,p[0]);
   return im;}
 anim('rocket.hatch.closed',[hatch(12)],0,89,1000,true);
 anim('rocket.hatch.opening',[hatch(8),hatch(4),hatch(0)],0,89,90);
 anim('rocket.hatch.open',[hatch(0)],0,89,1000,true);
 anim('rocket.hatch.closing',[hatch(4),hatch(8),hatch(12)],0,89,90);
 // Existing helmet/suit design, braced arm for the ledge; foot registration unchanged.
 for(const [pose,old]of [['stand','cosmonaut.idle.0'],['crouch','cosmonaut.crouch.0']]){
   const im=get(old);const y=pose==='stand'?11:14;
   rect(im,12,y,6,4,p[0]);rect(im,13,y+1,4,2,p[suit]);
   anim(`cosmonaut.ledge.${pose}`,[im],10,22,1000,true);
 }
 rims.forEach((rows,i)=>{const im=blank(24,8),front=blank(24,8);
   rows.forEach(([a,b],y)=>{rect(im,a,y,b-a+1,1,p[terrain[0]]);if(y<3)rect(im,a+1,y,Math.max(1,b-a-1),1,p[terrain[y===0?2:1]]);});
   rect(im,5,3,14,3,p[0]);rect(im,3,4,18,1,p[0]);
   // Uneven lit lip and rocks differ by variant, while the central opening stays shared.
   if(i===1){rect(im,1,0,4,3,p[terrain[0]]);rect(im,2,0,2,1,p[terrain[2]]);rect(im,20,1,3,3,p[terrain[1]]);}
   if(i===2){rect(im,0,5,5,1,p[terrain[1]]);rect(im,20,0,4,2,p[terrain[0]]);rect(im,21,0,2,1,p[terrain[2]]);}
   if(i===3){rect(im,10,0,3,2,[0,0,0,0]);rect(im,1,5,2,2,p[terrain[1]]);rect(im,20,5,3,2,p[terrain[1]]);}
   const chips=[[[4,2],[18,2],[7,6]],[[2,2],[19,3],[16,6]],[[17,1],[2,5],[6,6]],[[4,1],[20,3],[11,6]]][i];
   chips.forEach(([x,y])=>rect(im,x,y,2,1,p[terrain[2]]));
   for(let y=6;y<8;y++)for(let x=0;x<24;x++){const o=(y*24+x)*4;if(im.data[o+3])dot(front,x,y,im.data.subarray(o,o+4));}
   add(`crater.${i}`,im,12,4,1000);if(i===0)images['crater.front.0']=front;else add(`crater.front.${i}`,front,12,4,1000);
 });
 function eyes(height=3,look=0){const im=blank(24,16);if(!height)return im;const y=13-height;
   for(const x of [7,14]){rect(im,x-1,y-1,5,height+2,p[0]);rect(im,x,y,3,height,p[suit]);if(height>1)dot(im,x+1+look,y+Math.min(1,height-1),p[0]);}
   return im;}
 anim('crater.eyes.peek',[eyes(1),eyes(2),eyes(3)],12,12,[120,120,300]);
 anim('crater.eyes.blink',[eyes(2),eyes(1),eyes(3)],12,12,[80,80,160]);
 anim('crater.eyes.look.l',[eyes(3,-1)],12,12,400,true);
 anim('crater.eyes.look.r',[eyes(3,1)],12,12,400,true);
 anim('crater.eyes.hide',[eyes(2),eyes(1),eyes(0)],12,12,[100,100,160]);
 function tentacle(points){const ink=blank(24,32);const pts=line(points);pts.forEach(([x,y])=>rect(ink,x-1,y-1,3,3,p[tent[0]]));pts.forEach(([x,y],i)=>{dot(ink,x-1,y,p[tent[1]]);if(i%4===0)dot(ink,x,y,p[tent[2]]);});return contour(ink,p[0]);}
 anim('crater.tentacle.reach',reachPaths.map(tentacle),12,28,[120,160,240,160]);
 const victim=get('cosmonaut.air.flail.0');
 // The flail's opaque feet end at local y20; offset 6 registers them at world y175.
 anim('crater.tentacle.grab',grabPaths.map((points,i)=>{const im=blank(24,32);if(i<4)paste(im,victim,2,[6,9,14,22][i]);paste(im,tentacle(points),0,0);rect(im,0,30,24,2,[0,0,0,0]);return im;}),12,28,[100,120,140,140,160]);
 // Aurora is only in Polar's sky overlay; also remove its separate green sky mark.
 const bg=get('background');
 if(theme==='polar-signal'){
   const repair=read(path.join(dir,'sky-repair.png'));paste(bg,repair,210,40);
   for(let i=0;i<4;i++)images[`ambient.sky.${i}`]=blank(320,240);
   atlas.retiredAnimations=['ambient.sky'];
 }else atlas.retiredAnimations=[];
 images.background=bg;
 atlas.sockets={rocketLedge:{frame:'rocket.hatch.open.0',x:39,y:30}};
 const old=Object.entries(atlas.frames).filter(([n])=>!newFrame(n));
 const baseH=Math.max(...old.map(([,f])=>f.y+f.h))+1;
 let x=1,y=baseH+1,rowH=0;
 for(const [name,f]of Object.entries(additions)){if(x+f.w+1>1024){x=1;y+=rowH+2;rowH=0;}Object.assign(f,{x,y});x+=f.w+2;rowH=Math.max(rowH,f.h);atlas.frames[name]=f;}
 const sheet=blank(1024,y+rowH+1);paste(sheet,crop(sheet0,0,0,1024,baseH),0,0);
 for(const [n,im]of Object.entries(images)){const f=atlas.frames[n];rect(sheet,f.x,f.y,f.w,f.h,[0,0,0,0]);paste(sheet,im,f.x,f.y);}
 Object.assign(atlas.animations,animations);atlas.meta.size={w:sheet.w,h:sheet.h};
 const frame=n=>{const f=atlas.frames[n];return crop(sheet,f.x,f.y,f.w,f.h);};
 save(sheet,path.join(dir,`${theme}.png`));json(path.join(dir,`${theme}.json`),atlas);
 for(const ext of ['png','json'])fs.copyFileSync(path.join(dir,`${theme}.${ext}`),path.join(ROOT,'public/atlas',`${theme}.${ext}`));
 // Regenerate every animation strip, including retired transparent compatibility frames.
 const strips=[];
 for(const [name,a]of Object.entries(atlas.animations)){
   const ims=a.frames.map(frame),strip=blank(ims.reduce((n,i)=>n+i.w,0),Math.max(...ims.map(i=>i.h)));let dx=0;ims.forEach(im=>{paste(strip,im,dx,0);dx+=im.w;});
   save(strip,path.join(pv,`${name}-strip.png`));
   if(name in animations)save(strip,path.join(pv,`${name}-strip-4x.png`),4);
   strips.push({animation:name,file:`${name}-strip.png`,loop:a.loop,durations:a.frames.map(f=>atlas.frames[f].duration)});
 }
 json(path.join(pv,'strips.json'),strips);
 const at=(dst,n,px,py)=>{const f=atlas.frames[n];paste(dst,frame(n),px-f.ax,py-f.ay);};
 function scene(ms=0,grab=false){const im=frame('background');
   for(const n of ['ambient.sky','ambient.drift'])if(!atlas.retiredAnimations.includes(n))at(im,atlas.animations[n].frames[Math.floor(ms/500)%atlas.animations[n].frames.length],0,0);
   at(im,'rocket.hatch.open.0',43,169);at(im,'rover.idle.0',248,180);at(im,'ambient.signal.0',0,0);
   at(im,'cosmonaut.ledge.stand.0',82,110);at(im,'cosmonaut.air.spin.1',106,126);at(im,'cosmonaut.air.spin.4',146,90);at(im,'cosmonaut.air.flail.1',206,119);
   [106,146,186,226].forEach((cx,i)=>{at(im,`crater.${i}`,cx,177);if(i===0)at(im,`crater.eyes.peek.${Math.floor(ms/200)%3}`,cx,177);if(i===2)at(im,`crater.tentacle.${grab?'grab':'reach'}.${Math.floor(ms/160)%(grab?5:4)}`,cx,177);if(i===3)at(im,`crater.eyes.look.${Math.floor(ms/500)%2?'l':'r'}.0`,cx,177);at(im,`crater.front.${i}`,cx,177);});
   at(im,'plate.idle.0',146,181);at(im,'button.left.idle.0',4,152);at(im,'button.right.idle.0',292,152);
   at(im,'hud.icon.score.0',40,8);'0350'.split('').forEach((d,i)=>at(im,`hud.digit.${d}`,56+i*8,8));[212,232,252].forEach(cx=>at(im,'hud.icon.life.0',cx,7));at(im,'ui.hud_sound.idle.0',142,4);return im;
 }
 const screen=scene();save(screen,path.join(pv,'screen-1x.png'));save(screen,path.join(pv,'screen-4x.png'),4);
 save(crop(screen,122,58,48,64),path.join(pv,'cosmonaut-air-1x.png'));
 save(screen,path.join(pv,'airborne-contrast-1x.png'));save(screen,path.join(pv,'airborne-contrast-4x.png'),4);
 at(screen,'ui.title_theme.idle.0',100,190);at(screen,'ui.title_sound.idle.0',164,190);save(screen,path.join(pv,'title-controls-1x.png'));save(screen,path.join(pv,'title-controls-4x.png'),4);
 // Full-frame contact sheet with a theme-palette background.
 const contactIndex=[];x=2;y=2;rowH=0;
 for(const [n,f]of Object.entries(atlas.frames)){if(x+f.w+2>640){x=2;y+=rowH+4;rowH=0;}contactIndex.push({name:n,x,y,w:f.w,h:f.h});x+=f.w+4;rowH=Math.max(rowH,f.h);}
 const contact=blank(640,y+rowH+2,p[1]);contactIndex.forEach(c=>paste(contact,frame(c.name),c.x,c.y));json(path.join(pv,'frame-index.json'),contactIndex);save(contact,path.join(pv,'frames-1x.png'));save(contact,path.join(pv,'frames-4x.png'),4);
 const temp=path.join(ROOT,'.scratch','environment',theme);fs.mkdirSync(temp,{recursive:true});
 function gif(name,ims,delays,scale=1){const args=['-dispose','background'];ims.forEach((im,i)=>{const dest=path.join(temp,`${name}-${i}.png`);save(im,dest,scale);args.push('-delay',String(delays[i]/10),dest);});run('magick',[...args,'-loop','0',path.join(pv,`${name}.gif`)]);}
 for(const name of creatureAnims){const a=atlas.animations[name];gif(name+'-4x',a.frames.map(frame),a.frames.map(n=>atlas.frames[n].duration),4);}
 const hatchSeq=['rocket.hatch.closed.0',...atlas.animations['rocket.hatch.opening'].frames,'rocket.hatch.open.0',...atlas.animations['rocket.hatch.closing'].frames];
 gif('rocket.hatch-cycle-4x',hatchSeq.map(frame),[400,90,90,90,500,90,90,90],4);
 const study=Array.from({length:30},(_,i)=>scene(i*200,i>=15));gif('jump-bounce',study,Array(30).fill(200));
 // Compact review sheet: rims, eye sets, reach and grab; rows documented by JSON.
 const groups=[['crater.0','crater.1','crater.2','crater.3'],...creatureAnims.map(n=>atlas.animations[n].frames)];
 const board=blank(160,204,p[1]);let by=4;const review=[];
 for(const names of groups){let bx=4;let h=0;for(const n of names){const im=frame(n);paste(board,im,bx,by);review.push({name:n,x:bx,y:by});bx+=im.w+4;h=Math.max(h,im.h);}by+=h+6;}
 save(board,path.join(pv,'creatures-1x.png'));save(board,path.join(pv,'creatures-4x.png'),4);json(path.join(pv,'creatures-index.json'),review);
 json(path.join(dir,'revision-5.json'),{addedFrames:Object.keys(additions),changedFrames:theme==='polar-signal'?['background','ambient.sky.0','ambient.sky.1','ambient.sky.2','ambient.sky.3','crater.front.0']:['crater.front.0'],sheetSize:atlas.meta.size,sockets:atlas.sockets,retiredAnimations:atlas.retiredAnimations});
 report.themes[theme]={frames:Object.keys(atlas.frames).length,animations:Object.keys(atlas.animations).length,size:[sheet.w,sheet.h],palette:16,rocketLedge:[82,110]};
}
json(path.join(ROOT,'assets/export-report.json'),report);
