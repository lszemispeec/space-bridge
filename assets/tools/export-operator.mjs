/** Current native-pixel art revision. Node + ImageMagick; no raster rotation or filtering. */
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
function line(points){const pts=[];for(let n=1;n<points.length;n++){let [x,y]=points[n-1];const [xx,yy]=points[n],dx=Math.abs(xx-x),dy=-Math.abs(yy-y),sx=x<xx?1:-1,sy=y<yy?1:-1;let e=dx+dy;for(;;){pts.push([x,y]);if(x===xx&&y===yy)break;const e2=e*2;if(e2>=dy){e+=dy;x+=sx;}if(e2<=dx){e+=dx;y+=sy;}}}return pts;}
function contour(ink,dark){const im=blank(ink.w,ink.h);for(let y=0;y<ink.h;y++)for(let x=0;x<ink.w;x++)if(ink.data[(y*ink.w+x)*4+3])for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]])dot(im,x+dx,y+dy,dark);paste(im,ink,0,0);return im;}
const source=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/airborne-pixels.json')));
const suits=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/polar-suit-pixels.json')));
const themes=['polar-signal','desert-expedition','neon-orbit'];
const grabPaths=[[[12,28],[8,25],[6,21],[6,17],[9,15],[12,16]],[[12,28],[8,26],[6,21],[8,17],[14,17],[17,20],[15,23],[10,23],[8,20]],[[12,28],[8,26],[7,23],[10,21],[15,22],[17,25],[14,27],[10,26]],[[12,29],[9,28],[8,25],[12,23],[16,25],[15,28],[12,28]],[[12,29],[10,28],[12,27],[14,28]]];
const report={revision:7,themes:{}};
for(const theme of themes){
 const dir=path.join(ROOT,'assets',theme),pv=path.join(dir,'previews'),temp=path.join(ROOT,'.scratch/operator',theme);fs.mkdirSync(temp,{recursive:true});
 const atlas=JSON.parse(fs.readFileSync(path.join(dir,`${theme}.json`))),sheet0=read(path.join(dir,`${theme}.png`)),p=atlas.meta.palette.map(rgba);
 const images={};for(const [n,f]of Object.entries(atlas.frames))images[n]=crop(sheet0,f.x,f.y,f.w,f.h);
 const oldNames=Object.keys(atlas.frames).filter(n=>!n.startsWith('frame.')&&!n.startsWith('ui.lever.')&&n!=='background.window');
 const changed=[];
 function replace(n,im){images[n]=im;changed.push(n);}
 function add(n,im,duration=1000){images[n]=im;atlas.frames[n]={x:0,y:0,w:im.w,h:im.h,ax:0,ay:0,duration};}
 function anim(n,ims,duration,loop){ims.forEach((im,i)=>add(`${n}.${i}`,im,duration));atlas.animations[n]={frames:ims.map((_,i)=>`${n}.${i}`),loop};}
 const metal=theme==='polar-signal'?[1,2,3,5,7]:theme==='desert-expedition'?[1,2,4,6,8]:[1,2,4,10,12];
 const accent=theme==='polar-signal'?14:theme==='desert-expedition'?11:7;
 const white=theme==='neon-orbit'?15:8;
 // Independent lever key poses: vertical, anticipation, tilt, pull, full pull.
 // Base and pivot never move; shaft and knob move on whole pixels.
 function lever(side,step){const im=blank(40,64),sign=side==='l'?-1:1;
   rect(im,2,43,36,19,p[0]);rect(im,3,44,34,16,p[metal[1]]);rect(im,4,44,32,2,p[metal[3]]);rect(im,4,60,32,1,p[metal[0]]);
   for(const x of [6,33])for(const y of [48,57]){rect(im,x,y,2,2,p[metal[4]]);dot(im,x+1,y+1,p[0]);}
   rect(im,10,47,20,9,p[0]);rect(im,11,48,18,6,p[metal[0]]);
   const positions=[[0,5],[-sign,4],[sign*3,12],[sign*7,22],[sign*11,31]], [dx,ky]=positions[step],kx=20+dx;
   const ink=blank(40,64);for(const [x,y]of line([[20,51],[kx,ky+7]])){rect(ink,x-2,y,5,1,p[metal[3]]);dot(ink,x-2,y,p[metal[4]]);}
   paste(im,contour(ink,p[0]),0,0);
   rect(im,kx-7,ky+1,15,9,p[0]);rect(im,kx-6,ky,13,11,p[0]);rect(im,kx-6,ky+1,13,8,p[accent]);rect(im,kx-5,ky+1,11,2,p[white]);rect(im,kx-6,ky+8,13,1,p[metal[1]]);rect(im,kx+4,ky+4,2,2,p[metal[4]]);
   rect(im,15,49,11,6,p[0]);rect(im,16,49,9,3,p[metal[3]]);rect(im,17,49,3,1,p[white]);
   for(let i=0;i<3;i++)rect(im,14+i*5,58,3,1,p[i<step?accent:metal[0]]);
   return im;
 }
 for(const side of ['l','r']){anim(`ui.lever.${side}.idle`,[lever(side,0)],1000,true);anim(`ui.lever.${side}.pull`,[1,2,3,4].map(i=>lever(side,i)),50,false);atlas.animations[`ui.lever.${side}.release`]={frames:[2,1,0].map(i=>`ui.lever.${side}.pull.${i}`).concat(`ui.lever.${side}.idle.0`),loop:false};}
 // Two chamfered upper mullions and tiny diagonal reflections frame the glass.
 function room(portrait){const w=portrait?288:352,h=portrait?344:320,im=blank(w,h,p[0]);
   rect(im,2,2,w-4,h-4,p[metal[0]]);rect(im,3,3,w-6,3,p[metal[2]]);rect(im,4,3,w-8,1,p[metal[3]]);
   rect(im,5,7,w-10,245,p[metal[1]]);rect(im,8,9,w-16,243,p[0]);rect(im,10,10,w-20,242,p[metal[3]]);
   rect(im,12,11,w-24,241,p[metal[0]]);
   // Angled corner struts and long side rails, never inside the cut-out.
   for(const sx of [0,w-16]){rect(im,sx+2,16,4,226,p[metal[2]]);rect(im,sx+3,18,1,222,p[metal[3]]);for(const y of [24,76,128,180,232]){rect(im,sx+8,y,3,3,p[0]);dot(im,sx+8,y,p[metal[4]]);}
     for(let i=0;i<6;i++){dot(im,sx+7+i,12-i,p[metal[4]]);dot(im,sx+7+i,244+i,p[metal[2]]);}}
   for(const x of [30,64,w-66,w-32]){rect(im,x,6,3,3,p[0]);dot(im,x,6,p[metal[4]]);}
   rect(im,14,20,1,24,p[metal[4]]);rect(im,w-15,196,1,26,p[metal[3]]);
   // Only the 20px upper corner chamfers and sparse glass glints enter the window.
   rect(im,16,12,w-32,240,[0,0,0,0]);
   for(let j=0;j<20;j++)for(let i=0;i<20-j;i++)for(const x of [16+i,w-17-i])dot(im,x,12+j,p[i+j>16?metal[3]:metal[1]]);
   for(const [xx,yy]of [[18,24],[24,18],[30,12]])for(const x of [xx,w-1-xx]){rect(im,x,yy,3,3,p[0]);dot(im,x,yy,p[metal[4]]);}
   for(let i=0;i<6;i++)dot(im,42+i,20+i,p[theme==='polar-signal'?12:white]);
   for(let i=0;i<4;i++)dot(im,40+i,25+i,p[metal[3]]);
   rect(im,2,252,w-4,h-254,p[metal[1]]);rect(im,2,252,w-4,2,p[metal[3]]);rect(im,4,255,w-8,1,p[metal[0]]);rect(im,4,h-5,w-8,2,p[0]);
   function panel(x,y,pw,ph){rect(im,x-1,y-1,pw+2,ph+2,p[metal[3]]);rect(im,x,y,pw,ph,p[0]);rect(im,x+1,y+ph-1,pw-2,1,p[metal[0]]);}
   panel(52,258,56,22);panel(76,288,64,22);panel(184,258,44,22);panel(110,260,30,11);
   panel(184,288,44,22);for(let x=190;x<225;x+=5)rect(im,x,294,2,10,p[metal[2]]);
   for(const x of [7,w-8])for(const y of [258,h-10]){rect(im,x-1,y-1,3,3,p[0]);dot(im,x-1,y-1,p[metal[4]]);}
   for(const x of [6,w-50]){rect(im,x,279,44,28,p[0]);rect(im,x+1,280,42,26,p[metal[0]]);rect(im,x+2,280,40,1,p[metal[3]]);}
   if(!portrait){panel(242,260,52,18);for(let x=248;x<290;x+=5)rect(im,x,265,2,8,p[metal[2]]);rect(im,248,262,12,1,p[accent]);}
   if(portrait){rect(im,52,324,184,9,p[metal[0]]);for(let x=58;x<232;x+=8)rect(im,x,326,3,5,p[metal[2]]);}
   return im;
 }
 anim('frame.room.landscape',[room(false)],1000,true);anim('frame.room.portrait',[room(true)],1000,true);
 anim('frame.lights',[0,1,2,3].map(k=>{const im=blank(20,6,p[0]);for(let i=0;i<3;i++){rect(im,2+i*6,1,4,3,p[i===k||k===3?accent:metal[0]]);if(i===k||k===3)rect(im,2+i*6,1,2,1,p[white]);}return im;}),300,true);
 atlas.operatorRoom={
   background:'background.window',
   landscape:{size:{w:352,h:320},frame:'frame.room.landscape.0',scene:{sx:0,sy:0,w:320,h:240,dx:16,dy:12},console:{x:0,y:252,w:352,h:68},levers:{l:{x:8,y:240},r:{x:304,y:240}},leverTapZones:{l:{x:20,y:164,w:24,h:48},r:{x:308,y:164,w:24,h:48}},windowCornerCut:20},
   portrait:{size:{w:288,h:344},frame:'frame.room.portrait.0',scene:{sx:32,sy:0,w:256,h:240,dx:16,dy:12},console:{x:0,y:252,w:288,h:92},levers:{l:{x:8,y:240},r:{x:240,y:240}},leverTapZones:{l:{x:20,y:292,w:24,h:48},r:{x:244,y:292,w:24,h:48}},windowCornerCut:20,controlStrip:{x:16,y:288,w:256,h:56}},
   hud:{scoreIcon:{x:56,y:262},digits:{x:72,y:262,pitch:8,count:4},modeLabel:{x:112,y:266},lives:{x:80,y:290,pitch:20},sound:{x:188,y:260,w:36,h:16},lights:{x:152,y:298}},
 };
 add('background.window',read(path.join(dir,'window-plate.png')));
 // Round whites: 3/5/5/5/3 pixel rows, surrounded by a one-pixel contour.
 // Peeking reveals the same circle from below; blinking squeezes its height.
 function eyes(level,look=0,blink=false){const ink=blank(24,16);if(!level)return ink;
   const rows=blink?(level===1?[3]:[3,5,3]):[3,5,5,5,3].slice(0,level===1?1:level===2?3:5);
   const y0=13-rows.length;
   for(const cx of [8,16]){rows.forEach((w,j)=>rect(ink,cx-Math.floor(w/2),y0+j,w,1,p[white]));if(rows.length>1){dot(ink,cx+look,y0+Math.floor(rows.length/2),p[0]);if(rows.length===5)dot(ink,cx+look,y0+3,p[0]);}}
   return contour(ink,p[0]);
 }
 for(const [n,ims]of Object.entries({'peek':[eyes(1),eyes(2),eyes(3)],'blink':[eyes(2,0,true),eyes(1,0,true),eyes(3)],'look.l':[eyes(3,-1)],'look.r':[eyes(3,1)],'hide':[eyes(2),eyes(1),eyes(0)]}))ims.forEach((im,i)=>replace(`crater.eyes.${n}.${i}`,im));
 if(theme==='polar-signal'){
   for(const [n,rows]of Object.entries(suits.frames)){const im=blank(rows[0].length,rows.length);rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(c!=='.')dot(im,x,y,p[parseInt(c,16)]);}));replace(n,im);}
   for(const {name,rows}of source.frames){const ink=blank(20,22);rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(c!=='.')dot(ink,x,y,p[source.themeIndices[theme][c]]);}));replace(name,contour(ink,p[0]));}
   grabPaths.forEach((points,i)=>{const ink=blank(24,32),pts=line(points);pts.forEach(([x,y])=>rect(ink,x-1,y-1,3,3,p[13]));pts.forEach(([x,y],j)=>{dot(ink,x-1,y,p[14]);if(j%4===0)dot(ink,x,y,p[15]);});const im=blank(24,32);if(i<4)paste(im,images['cosmonaut.air.flail.0'],2,[6,9,14,22][i]);paste(im,contour(ink,p[0]),0,0);rect(im,0,30,24,2,[0,0,0,0]);replace(`crater.tentacle.grab.${i}`,im);});
 }
 const additions=Object.keys(atlas.frames).filter(n=>!oldNames.includes(n));
 const baseH=Math.max(...oldNames.map(n=>atlas.frames[n].y+atlas.frames[n].h))+1;
 let x=1,y=baseH+1,rh=0;for(const n of additions){const f=atlas.frames[n];if(x+f.w+1>1024){x=1;y+=rh+2;rh=0;}Object.assign(f,{x,y});x+=f.w+2;rh=Math.max(rh,f.h);}
 const sheet=blank(1024,y+rh+1);for(const [n,f]of Object.entries(atlas.frames))paste(sheet,images[n],f.x,f.y);
 atlas.meta.size={w:sheet.w,h:sheet.h};save(sheet,path.join(dir,`${theme}.png`));json(path.join(dir,`${theme}.json`),atlas);
 for(const ext of ['png','json'])fs.copyFileSync(path.join(dir,`${theme}.${ext}`),path.join(ROOT,'public/atlas',`${theme}.${ext}`));
 function gif(name,ims,delays,scale=1){const args=['-dispose','background'];ims.forEach((im,i)=>{const f=path.join(temp,`${name}-${i}.png`);save(im,f,scale);args.push('-delay',String(delays[i]/10),f);});run('magick',[...args,'-loop','0',path.join(pv,`${name}.gif`)]);}
 const strips=[];for(const [name,a]of Object.entries(atlas.animations)){const ims=a.frames.map(n=>images[n]),strip=blank(ims.reduce((sum,im)=>sum+im.w,0),Math.max(...ims.map(im=>im.h)));let dx=0;for(const im of ims){paste(strip,im,dx,0);dx+=im.w;}
   save(strip,path.join(pv,`${name}-strip.png`));
   if(!name.startsWith('ambient.')&&!name.startsWith('frame.room.'))save(strip,path.join(pv,`${name}-strip-4x.png`),4);
   const durations=a.frames.map(n=>atlas.frames[n].duration);strips.push({animation:name,file:`${name}-strip.png`,loop:a.loop,durations});
   if(name.startsWith('cosmonaut.air.')||name.startsWith('crater.')&&name!=='crater.idle'||name.startsWith('ui.lever.')||name==='frame.lights')gif(`${name}-4x`,ims,durations,4);
 }
 json(path.join(pv,'strips.json'),strips);
 const at=(dst,n,px,py)=>{const f=atlas.frames[n];paste(dst,images[n],px-f.ax,py-f.ay);};
 function scene(ms=0,grab=false,legacy=false){const im=blank(320,240);paste(im,images[legacy?'background':'background.window'],0,0);
   for(const n of ['ambient.sky','ambient.drift'])if(!atlas.retiredAnimations.includes(n)){const a=atlas.animations[n];at(im,a.frames[Math.floor(ms/500)%a.frames.length],0,0);}
   at(im,'rocket.hatch.open.0',43,169);at(im,'rover.idle.0',248,180);at(im,'ambient.signal.0',0,0);
   at(im,'cosmonaut.ledge.stand.0',82,110);at(im,'cosmonaut.air.spin.1',106,126);at(im,'cosmonaut.air.spin.4',146,90);at(im,'cosmonaut.air.flail.1',206,119);
   [106,146,186,226].forEach((cx,i)=>{at(im,`crater.${i}`,cx,177);if(i===0)at(im,`crater.eyes.peek.${Math.floor(ms/200)%3}`,cx,177);if(i===2)at(im,`crater.tentacle.${grab?'grab':'reach'}.${Math.floor(ms/160)%(grab?5:4)}`,cx,177);at(im,`crater.front.${i}`,cx,177);});at(im,'plate.idle.0',146,181);
   if(legacy){at(im,'button.left.idle.0',4,152);at(im,'button.right.idle.0',292,152);at(im,'hud.icon.score.0',40,8);'0350'.split('').forEach((d,i)=>at(im,`hud.digit.${d}`,56+i*8,8));[212,232,252].forEach(cx=>at(im,'hud.icon.life.0',cx,7));at(im,'ui.hud_sound.idle.0',142,4);}
   return im;
 }
 function operator(orientation,ms=400){const cfg=atlas.operatorRoom[orientation],im=blank(cfg.size.w,cfg.size.h,p[0]),s=cfg.scene;
   paste(im,crop(scene(ms),s.sx,s.sy,s.w,s.h),s.dx,s.dy);paste(im,images[cfg.frame],0,0);
   const step=[0,0,1,2,3,4,4,3,2,1,0,0][Math.floor(ms/100)%12];
   for(const side of ['l','r']){const pos=cfg.levers[side];at(im,`ui.lever.${side}.${step===0?'idle.0':`pull.${step-1}`}`,pos.x,pos.y);}
   const hud=atlas.operatorRoom.hud;at(im,'hud.icon.score.0',hud.scoreIcon.x,hud.scoreIcon.y);'0350'.split('').forEach((d,i)=>at(im,`hud.digit.${d}`,hud.digits.x+i*8,hud.digits.y));for(let i=0;i<3;i++)at(im,'hud.icon.life.0',hud.lives.x+i*20,hud.lives.y);at(im,'ui.hud_sound.idle.0',hud.sound.x,hud.sound.y);at(im,`frame.lights.${Math.floor(ms/300)%4}`,hud.lights.x,hud.lights.y);
   // Native mode glyph for the offline study; runtime text is engine-owned.
   ['01110','10001','11111','10001','10001'].forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='1')dot(im,hud.modeLabel.x+x,hud.modeLabel.y+y,p[white]);}));
   return im;
 }
 // Keep the unframed legacy study for old integrations; current studies are operator-*.
 const screen=scene(400,false,true);save(screen,path.join(pv,'screen-1x.png'));save(screen,path.join(pv,'screen-4x.png'),4);save(crop(screen,122,58,48,64),path.join(pv,'cosmonaut-air-1x.png'));save(screen,path.join(pv,'airborne-contrast-1x.png'));save(screen,path.join(pv,'airborne-contrast-4x.png'),4);
 at(screen,'ui.title_theme.idle.0',100,190);at(screen,'ui.title_sound.idle.0',164,190);save(screen,path.join(pv,'title-controls-1x.png'));save(screen,path.join(pv,'title-controls-4x.png'),4);
 for(const orientation of ['landscape','portrait']){const im=operator(orientation);save(im,path.join(pv,`operator-${orientation}-1x.png`));save(im,path.join(pv,`operator-${orientation}-4x.png`),4);}
 gif('operator-room',Array.from({length:12},(_,i)=>operator('landscape',i*100)),Array(12).fill(100));
 gif('jump-bounce',Array.from({length:30},(_,i)=>scene(i*200,i>=15,true)),Array(30).fill(200));
 const index=[];x=2;y=2;rh=0;for(const [n,im]of Object.entries(images)){if(x+im.w+2>640){x=2;y+=rh+4;rh=0;}index.push({name:n,x,y,w:im.w,h:im.h});x+=im.w+4;rh=Math.max(rh,im.h);}
 const contact=blank(640,y+rh+2,p[1]);for(const f of index)paste(contact,images[f.name],f.x,f.y);save(contact,path.join(pv,'frames-1x.png'));save(contact,path.join(pv,'frames-4x.png'),4);json(path.join(pv,'frame-index.json'),index);
 const groups=[['crater.0','crater.1','crater.2','crater.3'],...['peek','blink','look.l','look.r','hide'].map(n=>atlas.animations[`crater.eyes.${n}`].frames),atlas.animations['crater.tentacle.reach'].frames,atlas.animations['crater.tentacle.grab'].frames];
 const board=blank(160,204,p[1]),review=[];let by=4;for(const names of groups){let bx=4,h=0;for(const n of names){const im=images[n];paste(board,im,bx,by);review.push({name:n,x:bx,y:by});bx+=im.w+4;h=Math.max(h,im.h);}by+=h+6;}save(board,path.join(pv,'creatures-1x.png'));save(board,path.join(pv,'creatures-4x.png'),4);json(path.join(pv,'creatures-index.json'),review);
 const controls=blank(224,140,p[1]);for(const [row,side]of ['l','r'].entries())for(let i=0;i<5;i++)paste(controls,images[`ui.lever.${side}.${i===0?'idle.0':`pull.${i-1}`}`],4+i*44,4+row*70);save(controls,path.join(pv,'levers-1x.png'));save(controls,path.join(pv,'levers-4x.png'),4);
 gif('levers-cycle-4x',[0,1,2,3,4,3,2,1,0].map(step=>{const im=blank(104,72,p[1]);for(const [i,side]of ['l','r'].entries())paste(im,images[`ui.lever.${side}.${step===0?'idle.0':`pull.${step-1}`}`],4+i*56,4);return im;}),[300,50,50,50,250,50,50,50,100],4);
 const actorNames=Object.keys(images).filter(n=>n.startsWith('cosmonaut.')||n.startsWith('hud.icon.life'));
 const actors=blank(288,Math.ceil(actorNames.length/12)*26+4,p[5]);actorNames.forEach((n,i)=>paste(actors,images[n],4+(i%12)*24,4+Math.floor(i/12)*26));save(actors,path.join(pv,'suits-1x.png'));save(actors,path.join(pv,'suits-4x.png'),4);json(path.join(pv,'suits-index.json'),actorNames);
 json(path.join(dir,'revision-7.json'),{addedFrames:['background.window'],changedFrames:additions.filter(n=>n.startsWith('ui.lever.')||n.startsWith('frame.room.')),unchanged:'All pre-room scenery, actors, eyes, vehicles and old background pixels; all animation sequences and durations.',sheetSize:atlas.meta.size,operatorRoom:atlas.operatorRoom,paletteUnchanged:true});report.themes[theme]={frames:Object.keys(atlas.frames).length,animations:Object.keys(atlas.animations).length,size:[sheet.w,sheet.h],palette:16};
 console.log(`${theme}: ${report.themes[theme].frames} frames / ${report.themes[theme].animations} animations`);
}
json(path.join(ROOT,'assets/export-report.json'),report);
