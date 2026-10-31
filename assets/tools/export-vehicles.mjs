/** Revision 8: native vehicle models and built-in hatch art. Node + ImageMagick; no raster rotation or filtering. */
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
const themes=['polar-signal','desert-expedition','neon-orbit'];
const report={revision:8,themes:{}};
for(const theme of themes){
 const dir=path.join(ROOT,'assets',theme),pv=path.join(dir,'previews'),temp=path.join(ROOT,'.scratch/vehicles',theme);fs.mkdirSync(temp,{recursive:true});
 const atlas=JSON.parse(fs.readFileSync(path.join(dir,`${theme}.json`))),sheet0=read(path.join(dir,`${theme}.png`)),p=atlas.meta.palette.map(rgba);
 const images={};for(const [n,f]of Object.entries(atlas.frames))images[n]=crop(sheet0,f.x,f.y,f.w,f.h);
 const metal=theme==='polar-signal'?[1,3,5,7,8]:theme==='desert-expedition'?[1,3,5,6,8]:[1,8,9,10,12];
 const accent=theme==='polar-signal'?14:theme==='desert-expedition'?15:7;
 const white=metal[4];
 // All silhouettes and seams are native integer pixels. Light comes from upper left.
 function rocket(shutter){
   const im=blank(33,89);
   // Stepped nose, continuous dark perimeter, cylindrical flat-shaded hull.
   for(let y=0;y<22;y++){const half=Math.min(9,Math.floor(y/2));rect(im,16-half,y,half*2+1,1,p[0]);if(half>0){rect(im,17-half,y,half*2-1,1,p[metal[2]]);rect(im,17-half,y,Math.max(1,half-1),1,p[metal[4]]);}}
   rect(im,6,21,21,55,p[0]);rect(im,7,21,19,53,p[metal[2]]);rect(im,8,22,3,51,p[metal[4]]);rect(im,23,22,3,51,p[metal[1]]);
   rect(im,11,22,2,51,p[metal[3]]);
   // Small inset upper hatch: 8x12 mouth, with its entire rim inside the hull.
   rect(im,14,18,12,16,p[0]);rect(im,15,19,10,14,p[metal[3]]);rect(im,16,20,8,12,p[0]);
   if(shutter){rect(im,16,20,shutter,12,p[metal[1]]);rect(im,16,20,shutter,1,p[metal[4]]);rect(im,16,21,1,11,p[metal[2]]);if(shutter>3)rect(im,16+shutter-2,25,1,3,p[accent]);}
   dot(im,15,23,p[accent]);dot(im,24,29,p[metal[4]]);
   // Porthole and shallow service seams; no ground-level door.
   rect(im,13,41,8,8,p[0]);rect(im,14,40,6,10,p[0]);rect(im,14,42,6,6,p[metal[1]]);rect(im,14,42,4,2,p[metal[4]]);dot(im,18,46,p[metal[2]]);
   rect(im,7,36,19,2,p[metal[1]]);rect(im,8,36,14,1,p[metal[3]]);
   rect(im,7,62,19,2,p[metal[1]]);rect(im,8,62,14,1,p[metal[3]]);
   rect(im,14,53,2,5,p[accent]);rect(im,18,53,2,5,p[metal[1]]);
   // Fins taper into stable feet. All three states keep the same silhouette.
   for(let y=64;y<84;y++){const edge=Math.max(1,6-Math.floor((y-64)/4));rect(im,edge,y,7-edge,1,p[0]);rect(im,edge+1,y,Math.max(1,5-edge),1,p[metal[3]]);rect(im,27,y,6-edge,1,p[0]);if(5-edge>0)rect(im,27,y,5-edge,1,p[metal[1]]);}
   rect(im,11,75,12,9,p[0]);rect(im,13,76,8,6,p[metal[1]]);rect(im,14,77,2,4,p[metal[2]]);
   rect(im,0,84,8,5,p[0]);rect(im,1,85,6,2,p[metal[3]]);rect(im,25,84,8,5,p[0]);rect(im,26,85,6,2,p[metal[1]]);
   return im;
 }
 function rover(shutter){
   const im=blank(33,38);
   // Antenna and cab are part of this same model; no separate door overlay.
   rect(im,23,0,1,9,p[0]);rect(im,22,0,3,2,p[accent]);rect(im,21,8,6,3,p[0]);rect(im,22,8,4,1,p[metal[3]]);
   rect(im,3,10,25,2,p[0]);rect(im,2,12,29,18,p[0]);rect(im,1,18,31,11,p[0]);
   rect(im,3,12,26,16,p[metal[2]]);rect(im,4,12,23,2,p[metal[4]]);rect(im,27,15,3,13,p[metal[1]]);
   // Left side entrance is 8x18, just below the native cosmonaut height.
   rect(im,3,11,11,20,p[0]);rect(im,4,12,8,18,p[0]);
   if(shutter){rect(im,4,12,shutter,18,p[metal[1]]);rect(im,4,12,shutter,1,p[metal[4]]);rect(im,4,13,1,17,p[metal[3]]);if(shutter>3)rect(im,4+shutter-2,20,1,3,p[accent]);}
   rect(im,14,15,14,9,p[0]);rect(im,15,16,11,6,p[metal[1]]);rect(im,15,16,9,2,p[metal[4]]);rect(im,21,16,1,6,p[0]);
   rect(im,16,26,9,1,p[metal[1]]);rect(im,29,24,2,3,p[accent]);rect(im,0,30,33,2,p[0]);rect(im,1,30,30,1,p[metal[3]]);
   for(const x of [3,13,23]){rect(im,x,31,7,7,p[0]);rect(im,x-1,32,9,4,p[0]);rect(im,x+1,32,5,4,p[metal[1]]);rect(im,x+2,32,3,2,p[metal[3]]);dot(im,x+3,34,p[metal[4]]);}
   return im;
 }
 const retired=Object.keys(atlas.animations).filter(n=>n.startsWith('rocket.door')||n.startsWith('rocket.hatch.')||n.startsWith('rover.door'));
 atlas.retiredAnimations=[...new Set([...atlas.retiredAnimations,...retired])];
 for(const name of retired)for(const n of atlas.animations[name].frames){const f=atlas.frames[n];images[n]=blank(f.w,f.h);}
 // Keep the old idle entry useful, but its pixels now match the built-in closed model.
 for(const n of atlas.animations['rover.idle'].frames)images[n]=rover(8);
 const additions=[];
 for(const [prefix,draw]of [['rocket.tophatch',rocket],['rover.hatch',rover]]){
   for(const [state,width,duration]of [['closed',8,1000],['opening',4,90],['open',0,1000]]){
     const n=`${prefix}.${state}.0`,im=draw(width);additions.push(n);images[n]=im;
     atlas.frames[n]={x:0,y:0,w:im.w,h:im.h,ax:0,ay:im.h,duration};
     atlas.animations[`${prefix}.${state}`]={frames:[n],loop:state!=='opening'};
   }
   atlas.animations[`${prefix}.closing`]={frames:[`${prefix}.opening.0`],loop:false};
 }
 // Keep the historical socket readable by older clients, but explicitly retire it.
 atlas.retiredSockets=['rocketLedge'];
 atlas.sockets.rocketTopHatch={frame:'rocket.tophatch.open.0',x:20,y:32};
 atlas.sockets.roverHatch={frame:'rover.hatch.open.0',x:8,y:30};
 atlas.vehicleModels={rocket:{anchor:{x:43,y:169},mouth:'rocketTopHatch',hatch:{x:16,y:20,w:8,h:12}},rover:{anchor:{x:248,y:180},mouth:'roverHatch',hatch:{x:4,y:12,w:8,h:18}},gantry:'retired'};
 // Append only these new frames; keep every existing rectangle stable on reruns.
 const existing=Object.keys(atlas.frames).filter(n=>!additions.includes(n));
 let x=1,y=Math.max(...existing.map(n=>atlas.frames[n].y+atlas.frames[n].h))+2,rh=0;
 for(const n of additions){const f=atlas.frames[n];if(x+f.w+1>1024){x=1;y+=rh+2;rh=0;}Object.assign(f,{x,y});x+=f.w+2;rh=Math.max(rh,f.h);}
 const sheet=blank(1024,y+rh+1);for(const [n,f]of Object.entries(atlas.frames))paste(sheet,images[n],f.x,f.y);
 atlas.meta.size={w:sheet.w,h:sheet.h};save(sheet,path.join(dir,`${theme}.png`));json(path.join(dir,`${theme}.json`),atlas);
 for(const ext of ['png','json'])fs.copyFileSync(path.join(dir,`${theme}.${ext}`),path.join(ROOT,'public/atlas',`${theme}.${ext}`));
 // Offline scale-in reference only. Every size/position is integral; no subpixel motion.
 function mockExit(dst,step){
   const poses=[null,null,null,[6,7,63,112],[8,10,63,112],[10,12,64,112],[12,14,66,111],[16,18,70,109],[20,22,76,108],[20,22,84,114],[20,22,94,135],[20,22,106,175],null,null];
   const pose=poses[step];if(!pose)return;
   const [w,h,px,py]=pose,src=images[step>8?'cosmonaut.descend.0':'cosmonaut.emerge.2'],im=blank(w,h);
   for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){const offset=(Math.floor(yy*src.h/h)*src.w+Math.floor(xx*src.w/w))*4;dot(im,xx,yy,src.data.subarray(offset,offset+4));}
   paste(dst,im,px-Math.floor(w/2),py-h);
 }
 function gif(name,ims,delays,scale=1){const args=['-dispose','background'];ims.forEach((im,i)=>{const f=path.join(temp,`${name}-${i}.png`);save(im,f,scale);args.push('-delay',String(delays[i]/10),f);});run('magick',[...args,'-loop','0',path.join(pv,`${name}.gif`)]);}
 const strips=[];for(const [name,a]of Object.entries(atlas.animations)){const ims=a.frames.map(n=>images[n]),strip=blank(ims.reduce((sum,im)=>sum+im.w,0),Math.max(...ims.map(im=>im.h)));let dx=0;for(const im of ims){paste(strip,im,dx,0);dx+=im.w;}
   save(strip,path.join(pv,`${name}-strip.png`));
   if(!name.startsWith('ambient.')&&!name.startsWith('frame.room.'))save(strip,path.join(pv,`${name}-strip-4x.png`),4);
   const durations=a.frames.map(n=>atlas.frames[n].duration);strips.push({animation:name,file:`${name}-strip.png`,loop:a.loop,durations});
   if(name.startsWith('cosmonaut.air.')||name.startsWith('crater.')&&name!=='crater.idle'||name.startsWith('ui.lever.')||name==='frame.lights')gif(`${name}-4x`,ims,durations,4);
 }
 json(path.join(pv,'strips.json'),strips);
 const at=(dst,n,px,py)=>{const f=atlas.frames[n];paste(dst,images[n],px-f.ax,py-f.ay);};
 function scene(ms=0,grab=false,legacy=false,exitStep=null){const im=blank(320,240);paste(im,images[legacy?'background':'background.window'],0,0);
   for(const n of ['ambient.sky','ambient.drift'])if(!atlas.retiredAnimations.includes(n)){const a=atlas.animations[n];at(im,a.frames[Math.floor(ms/500)%a.frames.length],0,0);}
   at(im,exitStep===null?'rocket.tophatch.open.0':exitStep<2?'rocket.tophatch.closed.0':exitStep===2?'rocket.tophatch.opening.0':'rocket.tophatch.open.0',43,169);at(im,'rover.hatch.closed.0',248,180);at(im,'ambient.signal.0',0,0);
   at(im,'cosmonaut.air.spin.1',106,126);at(im,'cosmonaut.air.spin.4',146,90);at(im,'cosmonaut.air.flail.1',206,119);
   [106,146,186,226].forEach((cx,i)=>{at(im,`crater.${i}`,cx,177);if(i===0)at(im,`crater.eyes.peek.${Math.floor(ms/200)%3}`,cx,177);if(i===2)at(im,`crater.tentacle.${grab?'grab':'reach'}.${Math.floor(ms/160)%(grab?5:4)}`,cx,177);at(im,`crater.front.${i}`,cx,177);});at(im,'plate.idle.0',146,181);
   if(legacy){at(im,'button.left.idle.0',4,152);at(im,'button.right.idle.0',292,152);at(im,'hud.icon.score.0',40,8);'0350'.split('').forEach((d,i)=>at(im,`hud.digit.${d}`,56+i*8,8));[212,232,252].forEach(cx=>at(im,'hud.icon.life.0',cx,7));at(im,'ui.hud_sound.idle.0',142,4);}
   if(exitStep!==null)mockExit(im,exitStep);
   return im;
 }
 function operator(orientation,ms=400,exitStep=null){const cfg=atlas.operatorRoom[orientation],im=blank(cfg.size.w,cfg.size.h,p[0]),s=cfg.scene;
   paste(im,crop(scene(ms,false,false,exitStep),s.sx,s.sy,s.w,s.h),s.dx,s.dy);paste(im,images[cfg.frame],0,0);
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

 // A closed -> partial -> open -> exit -> empty -> close loop, with matching seam.
 const steps=[0,1,2,3,4,5,6,7,8,9,10,11,12,12,2,0];
 gif('tophatch-exit-4x',steps.map(step=>operator('landscape',400,step)),[400,150,90,100,100,100,100,100,100,100,100,100,150,150,90,400],4);
 const vehicleBoard=blank(160,142,p[1]);
 for(let i=0;i<3;i++){const state=['closed','opening','open'][i];paste(vehicleBoard,images[`rocket.tophatch.${state}.0`],4+i*50,4);paste(vehicleBoard,images[`rover.hatch.${state}.0`],4+i*50,100);}
 save(vehicleBoard,path.join(pv,'vehicles-1x.png'));save(vehicleBoard,path.join(pv,'vehicles-4x.png'),4);
 // Replace the obsolete hatch-cycle preview with the current full-model states.
 gif('rocket.hatch-cycle-4x',['closed','opening','open','opening','closed'].map(state=>images[`rocket.tophatch.${state}.0`]),[400,90,500,90,400],4);
 json(path.join(dir,'revision-8.json'),{addedFrames:additions,retiredAnimations:retired,retiredSockets:atlas.retiredSockets,vehicleModels:atlas.vehicleModels,paletteUnchanged:true,unchanged:'All pre-existing frame rectangles, actor pixels, room plates, backgrounds and creatures.',integration:'Select one new full-model frame per vehicle. Replace the retired ledge spawn with the mouth socket. Mock scale-in is preview-only.'});
 report.themes[theme]={frames:Object.keys(atlas.frames).length,animations:Object.keys(atlas.animations).length,size:[sheet.w,sheet.h],palette:16};
 console.log(`${theme}: ${report.themes[theme].frames} frames / ${report.themes[theme].animations} animations`);
}
json(path.join(ROOT,'assets/export-report.json'),report);
