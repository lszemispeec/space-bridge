/** Revision 9: authored console pixels. Run after older exporters. Node + ImageMagick. */
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
const themes=['polar-signal','desert-expedition','neon-orbit'];
const baseline='4a4ab1c050eb2b984429d14f85bfddd5ed331a1a';
const hud={scoreIcon:{x:52,y:265},digits:{x:68,y:265,pitch:8,count:4},modeLabel:{x:116,y:268},lives:{x:52,y:289,pitch:20},sound:{x:166,y:263,w:36,h:16},lights:{x:122,y:288}};
const menu={x:210,y:263,w:36,h:16};
const recesses={scoreMode:{x:48,y:260,w:112,h:22},sound:{x:164,y:260,w:40,h:22},menu:{x:208,y:260,w:40,h:22},lives:{x:48,y:286,w:68,h:22},status:{x:120,y:286,w:10,h:10}};
// Same 3x5 glyphs as the engine. These are preview labels, never baked into the plate.
const glyphs={G:['111','100','101','101','111'],A:['010','101','111','101','101'],M:['101','111','111','101','101'],E:['111','100','110','100','111'],N:['110','101','101','101','101'],U:['101','101','101','101','111']};
function label(im,word,x,y,c){[...word].forEach((ch,i)=>(glyphs[ch]||[]).forEach((row,j)=>[...row].forEach((v,k)=>{if(v==='1')dot(im,x+i*4+k,y+j,c);})));}
const report={revision:9,themes:{}};
for(const theme of themes){
 const dir=path.join(ROOT,'assets',theme),pv=path.join(dir,'previews'),temp=path.join(ROOT,'.scratch/console',theme);fs.mkdirSync(temp,{recursive:true});
 const atlas=JSON.parse(fs.readFileSync(path.join(dir,`${theme}.json`))),sheet=read(path.join(dir,`${theme}.png`)),p=atlas.meta.palette.map(rgba);
 const images={};for(const [n,f]of Object.entries(atlas.frames))images[n]=crop(sheet,f.x,f.y,f.w,f.h);
 const metal=theme==='polar-signal'?[1,2,3,5,7]:theme==='desert-expedition'?[1,2,4,6,8]:[1,2,4,10,12];
 const accent=theme==='polar-signal'?14:theme==='desert-expedition'?11:7,white=theme==='neon-orbit'?15:8;
 const beforeAtlas=JSON.parse(run('git',['show',`${baseline}:assets/${theme}/${theme}.json`],{cwd:ROOT}));
 const beforePath=path.join(temp,'before-sheet.png');fs.writeFileSync(beforePath,run('git',['show',`${baseline}:assets/${theme}/${theme}.png`],{cwd:ROOT,maxBuffer:128e6}));
 const beforeSheet=read(beforePath),beforeImages={};for(const[n,f]of Object.entries(beforeAtlas.frames))beforeImages[n]=crop(beforeSheet,f.x,f.y,f.w,f.h);
 function put(n,im,duration){const f=atlas.frames[n];rect(sheet,f.x,f.y,f.w,f.h,[0,0,0,0]);Object.assign(f,{w:im.w,h:im.h,duration:duration??f.duration});images[n]=im;paste(sheet,im,f.x,f.y);}
 function lever(side,step){const im=blank(24,40),sign=side==='l'?-1:1,kx=12+sign*step*3;
   // Fixed low base, short three-pixel shaft, seven-pixel knob; upper-left light.
   rect(im,2,28,20,10,p[0]);rect(im,3,29,18,7,p[metal[1]]);rect(im,3,29,18,1,p[metal[3]]);rect(im,4,36,16,1,p[metal[0]]);
   const ink=blank(24,40);for(const[x,y]of line([[12,30],[kx,12]])){rect(ink,x-1,y,3,1,p[metal[3]]);dot(ink,x-1,y,p[metal[4]]);}paste(im,contour(ink,p[0]),0,0);
   rect(im,kx-4,7,9,6,p[0]);rect(im,kx-3,6,7,8,p[0]);rect(im,kx-3,7,7,5,p[accent]);rect(im,kx-2,7,5,1,p[white]);rect(im,kx-3,12,7,1,p[metal[0]]);
   rect(im,8,29,9,5,p[0]);rect(im,9,29,7,3,p[metal[2]]);rect(im,9,29,4,1,p[metal[4]]);
   return im;
 }
 const removed=[];
 for(const side of ['l','r']){
   put(`ui.lever.${side}.idle.0`,lever(side,0));
   for(let i=0;i<2;i++)put(`ui.lever.${side}.pull.${i}`,lever(side,i+1),50);
   for(let i=2;i<4;i++){const n=`ui.lever.${side}.pull.${i}`,f=atlas.frames[n];if(f){rect(sheet,f.x,f.y,f.w,f.h,[0,0,0,0]);Reflect.deleteProperty(atlas.frames,n);Reflect.deleteProperty(images,n);}removed.push(n);}
   atlas.animations[`ui.lever.${side}.pull`]={frames:[0,1].map(i=>`ui.lever.${side}.pull.${i}`),loop:false};
   atlas.animations[`ui.lever.${side}.release`]={frames:[`ui.lever.${side}.pull.0`,`ui.lever.${side}.idle.0`],loop:false};
 }
 function room(w,h){const im=blank(w,h,p[0]);
   rect(im,2,2,w-4,h-4,p[metal[0]]);rect(im,3,3,w-6,3,p[metal[2]]);rect(im,4,3,w-8,1,p[metal[3]]);
   rect(im,5,7,w-10,245,p[metal[1]]);rect(im,8,9,w-16,243,p[0]);rect(im,10,10,w-20,242,p[metal[3]]);rect(im,12,11,w-24,241,p[metal[0]]);
   for(const sx of [0,w-16]){rect(im,sx+2,16,4,226,p[metal[2]]);rect(im,sx+3,18,1,222,p[metal[3]]);for(const y of [64,224]){rect(im,sx+8,y,2,2,p[0]);dot(im,sx+8,y,p[metal[3]]);}}
   rect(im,16,12,w-32,240,[0,0,0,0]);
   for(let j=0;j<20;j++)for(let i=0;i<20-j;i++)for(const x of [16+i,w-17-i])dot(im,x,12+j,p[i+j>16?metal[3]:metal[1]]);
   for(let i=0;i<4;i++)for(const[x,y]of [[5+i,10-i],[w-6-i,10-i],[5+i,245+i],[w-6-i,245+i]])dot(im,x,y,p[metal[4]]);
   rect(im,2,252,w-4,h-254,p[metal[1]]);rect(im,2,252,w-4,2,p[metal[3]]);rect(im,4,255,w-8,1,p[metal[0]]);rect(im,4,h-5,w-8,2,p[0]);
   // Exactly five recesses; all share the same one-pixel bevel.
   for(const{x,y,w:pw,h:ph}of Object.values(recesses)){rect(im,x,y,pw,ph,p[metal[0]]);rect(im,x,y,pw,1,p[metal[2]]);rect(im,x,y,1,ph,p[metal[2]]);rect(im,x+1,y+1,pw-2,ph-2,p[0]);}
   return im;
 }
 for(const orientation of ['landscape','portrait']){const cfg=atlas.operatorRoom[orientation];put(cfg.frame,room(cfg.size.w,cfg.size.h));cfg.levers={l:{x:8,y:270},r:{x:cfg.size.w-32,y:270}};}
 for(let i=0;i<4;i++){const im=blank(6,6,p[0]);rect(im,1,1,4,4,p[[metal[1],metal[2],accent,metal[3]][i]]);dot(im,1,1,p[i===2?white:metal[3]]);put(`frame.lights.${i}`,im,600);}
 Object.assign(atlas.operatorRoom,{revision:9,hud,menu,recesses,leverMotion:{pivot:{x:12,y:30},shaftEndpoints:[{x:12,y:12},{x:15,y:12},{x:18,y:12}],maxAngleDegrees:18.4,mirrorForLeft:true}});
 save(sheet,path.join(dir,`${theme}.png`));json(path.join(dir,`${theme}.json`),atlas);
 for(const ext of ['png','json'])fs.copyFileSync(path.join(dir,`${theme}.${ext}`),path.join(ROOT,'public/atlas',`${theme}.${ext}`));
 const at=(dst,n,x,y,ims=images,a=atlas)=>{const f=a.frames[n];paste(dst,ims[n],x-f.ax,y-f.ay);};
 function scene(){const im=blank(320,240);paste(im,images['background.window'],0,0);
   for(const n of ['ambient.sky','ambient.drift'])if(!atlas.retiredAnimations.includes(n))at(im,atlas.animations[n].frames[0],0,0);
   at(im,'rocket.tophatch.open.0',43,169);at(im,'rover.hatch.closed.0',248,180);at(im,'ambient.signal.0',0,0);
   at(im,'cosmonaut.air.spin.1',106,126);at(im,'cosmonaut.air.spin.4',146,90);at(im,'cosmonaut.air.flail.1',206,119);
   [106,146,186,226].forEach((cx,i)=>{at(im,`crater.${i}`,cx,177);if(i===0)at(im,'crater.eyes.peek.2',cx,177);if(i===2)at(im,'crater.tentacle.reach.2',cx,177);at(im,`crater.front.${i}`,cx,177);});at(im,'plate.idle.0',146,181);return im;
 }
 function operator(orientation,step=0,light=2,before=false){const a=before?beforeAtlas:atlas,ims=before?beforeImages:images,cfg=a.operatorRoom[orientation],s=cfg.scene,hud=a.operatorRoom.hud,im=blank(cfg.size.w,cfg.size.h,p[0]);
   paste(im,crop(scene(),s.sx,s.sy,s.w,s.h),s.dx,s.dy);paste(im,ims[cfg.frame],0,0);
   for(const side of ['l','r']){const pos=cfg.levers[side];at(im,`ui.lever.${side}.${step===0?'idle.0':`pull.${step-1}`}`,pos.x,pos.y,ims,a);}
   at(im,'hud.icon.score.0',hud.scoreIcon.x,hud.scoreIcon.y);'0350'.split('').forEach((d,i)=>at(im,`hud.digit.${d}`,hud.digits.x+i*8,hud.digits.y));for(let i=0;i<3;i++)at(im,'hud.icon.life.0',hud.lives.x+i*20,hud.lives.y);at(im,'ui.hud_sound.idle.0',hud.sound.x,hud.sound.y);
   label(im,'GAME A',hud.modeLabel.x,hud.modeLabel.y,p[white]);
   const m=before?{x:232,y:260,w:36,h:16}:menu;
   rect(im,m.x,m.y,m.w,m.h,p[white]);rect(im,m.x+1,m.y+1,m.w-2,m.h-2,p[0]);label(im,'MENU',m.x+10,m.y+5,p[white]);
   at(im,`frame.lights.${light}`,hud.lights.x,hud.lights.y,ims,a);return im;
 }
 function gif(name,ims,delays,scale=1){const args=['-dispose','background'];ims.forEach((im,i)=>{const f=path.join(temp,`${name}-${i}.png`);save(im,f,scale);args.push('-delay',String(delays[i]/10),f);});run('magick',[...args,'-loop','0',path.join(pv,`${name}.gif`)]);}
 const strips=[];
 for(const[name,a]of Object.entries(atlas.animations)){const durations=a.frames.map(n=>atlas.frames[n].duration);strips.push({animation:name,file:`${name}-strip.png`,loop:a.loop,durations});
   if(!name.startsWith('ui.lever.')&&!name.startsWith('frame.'))continue;
   const ims=a.frames.map(n=>images[n]),strip=blank(ims.reduce((s,im)=>s+im.w,0),Math.max(...ims.map(im=>im.h)));let dx=0;for(const im of ims){paste(strip,im,dx,0);dx+=im.w;}save(strip,path.join(pv,`${name}-strip.png`));
   if(!name.startsWith('frame.room.')){save(strip,path.join(pv,`${name}-strip-4x.png`),4);gif(`${name}-4x`,ims,durations,4);}
 }
 json(path.join(pv,'strips.json'),strips);
 for(const orientation of ['landscape','portrait'])for(const scale of [1,4]){save(operator(orientation),path.join(pv,`operator-${orientation}-${scale}x.png`),scale);save(operator(orientation,0,2,true),path.join(pv,`console-before-${orientation}-${scale}x.png`),scale);}
 const steps=[0,1,2,1,0],delays=[300,50,250,50,100];
 gif('levers-cycle-4x',steps.map(step=>{const im=blank(64,48,p[1]);for(const[i,side]of ['l','r'].entries())paste(im,images[`ui.lever.${side}.${step===0?'idle.0':`pull.${step-1}`}`],4+i*32,4);return im;}),delays,4);
 gif('operator-room',steps.map((step,i)=>operator('landscape',step,i%4)),delays);
 const controls=blank(88,92,p[1]);for(const[row,side]of ['l','r'].entries())for(let i=0;i<3;i++)paste(controls,images[`ui.lever.${side}.${i===0?'idle.0':`pull.${i-1}`}`],4+i*28,4+row*44);save(controls,path.join(pv,'levers-1x.png'));save(controls,path.join(pv,'levers-4x.png'),4);
 const index=[];let x=2,y=2,rh=0;for(const[n,im]of Object.entries(images)){if(x+im.w+2>640){x=2;y+=rh+4;rh=0;}index.push({name:n,x,y,w:im.w,h:im.h});x+=im.w+4;rh=Math.max(rh,im.h);}
 const contact=blank(640,y+rh+2,p[1]);for(const f of index)paste(contact,images[f.name],f.x,f.y);save(contact,path.join(pv,'frames-1x.png'));save(contact,path.join(pv,'frames-4x.png'),4);json(path.join(pv,'frame-index.json'),index);
 json(path.join(dir,'revision-9.json'),{baseline,removedFrames:removed,changedFrames:Object.keys(atlas.frames).filter(n=>n.startsWith('frame.')||n.startsWith('ui.lever.')),operatorRoom:atlas.operatorRoom,palette:atlas.meta.palette,paletteUnchanged:true,unchanged:'All other frame pixels, rectangles, anchors, durations, animations, sockets and scene geometry.',integration:'Art-only handoff. Runtime layout, MENU/SND targets and lever timing require Forge integration. Previews are offline compositions.'});
 report.themes[theme]={frames:Object.keys(atlas.frames).length,animations:Object.keys(atlas.animations).length,size:[sheet.w,sheet.h],palette:16};console.log(`${theme}: console and levers exported`);
}
json(path.join(ROOT,'assets/export-report.json'),report);
