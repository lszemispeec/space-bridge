/** Side-console art only. Run last; existing frame pixels and metadata stay fixed. */
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

const themes = ['polar-signal', 'desert-expedition', 'neon-orbit'];
const baseline = '4b0b641f86e02388d8b418565b25e83001af6fad';
const side = {
 size: {w:448,h:256}, frame:'frame.room.side.0',
 scene:{sx:0,sy:0,w:320,h:240,dx:64,dy:8},
 panels:{l:{x:0,y:0,w:64,h:256},r:{x:384,y:0,w:64,h:256}},
 levers:{l:{x:14,y:180},r:{x:410,y:180}},
 leverTapZones:{l:{x:6,y:160,w:40,h:80},r:{x:402,y:160,w:40,h:80}},
 windowCornerCut:20,
 hud:{scoreIcon:{x:7,y:22},digits:{x:10,y:40,pitch:8,count:4},modeLabel:{x:21,y:26},
      lives:{x:5,y:61,pitch:14},sound:{x:404,y:21,w:36,h:16},lights:{x:419,y:72}},
 menu:{x:404,y:47,w:36,h:16},
 recesses:{scoreMode:{x:4,y:18,w:44,h:36},lives:{x:4,y:58,w:44,h:22},
           sound:{x:402,y:18,w:40,h:22},menu:{x:402,y:44,w:40,h:22},status:{x:417,y:70,w:10,h:10}}
};
const glyphs={G:['111','100','101','101','111'],A:['010','101','111','101','101'],M:['101','111','111','101','101'],E:['111','100','110','100','111'],N:['110','101','101','101','101'],U:['101','101','101','101','111']};
function label(im,word,x,y,c){[...word].forEach((ch,i)=>(glyphs[ch]||[]).forEach((row,j)=>[...row].forEach((v,k)=>{if(v==='1')dot(im,x+i*4+k,y+j,c);})));}

for (const theme of themes) {
 const dir=path.join(ROOT,'assets',theme),pv=path.join(dir,'previews');
 const atlas=JSON.parse(fs.readFileSync(path.join(dir,`${theme}.json`)));
 const old=read(path.join(dir,`${theme}.png`)),p=atlas.meta.palette.map(rgba);
 const images={};for(const[n,f]of Object.entries(atlas.frames))images[n]=crop(old,f.x,f.y,f.w,f.h);
 const metal=theme==='polar-signal'?[1,2,3,5,7]:theme==='desert-expedition'?[1,2,4,6,8]:[1,2,4,10,12];
 const white=theme==='neon-orbit'?15:8;
 const plate=blank(448,256,p[0]);
 rect(plate,2,2,444,252,p[metal[0]]);
 for(const x of [2,400]){
   rect(plate,x,4,46,248,p[metal[1]]);
   rect(plate,x+2,4,42,1,p[metal[3]]);
   rect(plate,x+2,250,42,2,p[0]);
 }
 // Transfer the accepted 16px rails and every glass/mullion pixel unchanged.
 // Crop four outer top rows to leave the requested eight-pixel top frame.
 const original=images[atlas.operatorRoom.landscape.frame];
 const surround=crop(original,0,4,352,248);
 // Copy includes transparent glass; paste() intentionally skips transparent ink.
 rect(plate,64,8,320,240,[0,0,0,0]);paste(plate,surround,48,0);
 paste(plate,crop(original,0,4,352,8),48,248);
 for(const{x,y,w,h}of Object.values(side.recesses)){
   rect(plate,x,y,w,h,p[metal[0]]);rect(plate,x,y,w,1,p[metal[2]]);
   rect(plate,x,y,1,h,p[metal[2]]);rect(plate,x+1,y+1,w-2,h-2,p[0]);
 }
 const previous=atlas.frames[side.frame];
 const frame=previous??{x:0,y:old.h+2,w:448,h:256,ax:0,ay:0,duration:1000};
 const sheet=blank(old.w,Math.max(old.h,frame.y+frame.h+2));paste(sheet,old,0,0);
 rect(sheet,frame.x,frame.y,frame.w,frame.h,[0,0,0,0]);paste(sheet,plate,frame.x,frame.y);
 atlas.frames[side.frame]=frame;images[side.frame]=plate;
 atlas.animations['frame.room.side']={frames:[side.frame],loop:true};
 atlas.operatorRoom.side=side;atlas.meta.size={w:sheet.w,h:sheet.h};
 save(sheet,path.join(dir,`${theme}.png`));json(path.join(dir,`${theme}.json`),atlas);
 for(const ext of ['png','json'])fs.copyFileSync(path.join(dir,`${theme}.${ext}`),path.join(ROOT,'public/atlas',`${theme}.${ext}`));
 const at=(dst,n,x,y)=>{const f=atlas.frames[n];paste(dst,images[n],x-f.ax,y-f.ay);};
 function scene(){const im=blank(320,240);paste(im,images['background.window'],0,0);
   for(const n of ['ambient.sky','ambient.drift'])if(!atlas.retiredAnimations.includes(n))at(im,atlas.animations[n].frames[0],0,0);
   at(im,'rocket.tophatch.open.0',43,169);at(im,'rover.hatch.closed.0',248,180);at(im,'ambient.signal.0',0,0);
   at(im,'cosmonaut.air.spin.1',106,126);at(im,'cosmonaut.air.spin.4',146,90);at(im,'cosmonaut.air.flail.1',206,119);
   [106,146,186,226].forEach((cx,i)=>{at(im,`crater.${i}`,cx,177);if(i===0)at(im,'crater.eyes.peek.2',cx,177);if(i===2)at(im,'crater.tentacle.reach.2',cx,177);at(im,`crater.front.${i}`,cx,177);});at(im,'plate.idle.0',146,181);return im;
 }

 function operator(step=0,light=2){
   const im=blank(448,256,p[0]),hud=side.hud;
   paste(im,scene(),64,8);paste(im,plate,0,0);
   for(const key of ['l','r']){const pos=side.levers[key];at(im,`ui.lever.${key}.${step===0?'idle.0':`pull.${step-1}`}`,pos.x,pos.y);}
   at(im,'hud.icon.score.0',hud.scoreIcon.x,hud.scoreIcon.y);
   '0350'.split('').forEach((d,i)=>at(im,`hud.digit.${d}`,hud.digits.x+i*hud.digits.pitch,hud.digits.y));
   label(im,'GAME A',hud.modeLabel.x,hud.modeLabel.y,p[white]);
   for(let i=0;i<3;i++)at(im,'hud.icon.life.0',hud.lives.x+i*hud.lives.pitch,hud.lives.y);
   at(im,'ui.hud_sound.idle.0',hud.sound.x,hud.sound.y);
   const m=side.menu;rect(im,m.x,m.y,m.w,m.h,p[white]);rect(im,m.x+1,m.y+1,m.w-2,m.h-2,p[0]);
   label(im,'MENU',m.x+11,m.y+5,p[white]);at(im,`frame.lights.${light}`,hud.lights.x,hud.lights.y);
   return im;
 }
 const screen=operator();
 for(const scale of [1,4])save(screen,path.join(pv,`operator-side-${scale}x.png`),scale);
 save(plate,path.join(pv,'frame.room.side-strip.png'));
 const strips=JSON.parse(fs.readFileSync(path.join(pv,'strips.json'))).filter(s=>s.animation!=='frame.room.side');
 strips.push({animation:'frame.room.side',file:'frame.room.side-strip.png',loop:true,durations:[1000]});
 json(path.join(pv,'strips.json'),strips);
 // Preview existing lever motion in the new placement; first and last poses match.
 const steps=[0,1,2,1,0],delays=[300,50,250,50,100],args=['-dispose','background'];
 const temp=path.join(ROOT,'.scratch/side',theme);fs.mkdirSync(temp,{recursive:true});
 for(const[i,step]of steps.entries()){
   const f=path.join(temp,`${i}.png`);save(operator(step),f,4);args.push('-delay',String(delays[i]/10),f);
 }
 run('magick',[...args,'-loop','0',path.join(pv,'operator-side-cycle-4x.gif')]);
 if(theme==='polar-signal'){
   // Reported Safari content viewport, not a browser capture or a device shell.
   const phone=blank(874,300,p[0]);paste(phone,screen,213,22);
   save(phone,path.join(pv,'iphone16pro-landscape-mock.png'));
   save(phone,path.join(pv,'iphone16pro-landscape-mock-dpr3.png'),3);
 }
 json(path.join(dir,'revision-10.json'),{baseline,addedFrames:[side.frame],operatorRoomSide:side,
   palette:atlas.meta.palette,paletteUnchanged:true,
   unchanged:'Every existing frame, animation, layout, preview, anchor and duration. Upper-left lighting; palette-0 one-pixel outline.',
   integration:'Art-only. Select side layout and its local hud/menu/recesses; map input through scene offset. Existing layouts retain shared HUD. Runtime integration is separate.',
   mock:theme==='polar-signal'?{viewportCss:{w:874,h:300},dpr:3,devicePixelsPerRoomPixel:3,roomCss:{x:213,y:22,w:448,h:256},kind:'Offline in-game art composition; not a Safari capture.'}:null});
 console.log(`${theme}: side room, contract, native/4x previews and lever cycle exported`);
}
