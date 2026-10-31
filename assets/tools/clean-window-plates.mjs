/** Palette/grid cleanup of built-in imagegen extensions; accepted centre pixels stay exact.
 * Usage: node assets/tools/clean-window-plates.mjs <directory with <theme>-generated.png>
 * Production results are committed as assets/<theme>/window-plate.png.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync as run } from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url));
const input=process.argv[2];if(!input)throw Error('Supply the generated-image directory');
for(const theme of ['polar-signal','desert-expedition','neon-orbit']){
 const dir=path.join(root,'assets',theme),atlas=JSON.parse(fs.readFileSync(path.join(dir,`${theme}.json`)));
 const p=atlas.meta.palette.map(h=>[...Buffer.from(h.slice(1),'hex'),255]);
 const generated=run('magick',[path.join(input,`${theme}-generated.png`),'-filter','point','-resize','320x240!','-depth','8','RGBA:-'],{maxBuffer:1e6});
 const f=atlas.frames.background;
 const original=run('magick',[path.join(dir,`${theme}.png`),'-crop',`${f.w}x${f.h}+${f.x}+${f.y}`,'+repage','-depth','8','RGBA:-'],{maxBuffer:1e6});
 const data=Buffer.alloc(320*240*4);
 const put=(x,y,c)=>data.set(c,(y*320+x)*4);
 const old=(x,y)=>original.subarray((y*320+x)*4,(y*320+x)*4+4);
 for(let y=0;y<240;y++)for(let x=0;x<320;x++){
   if(x>=32&&x<288&&y>=30){put(x,y,old(x,y));continue;}
   if(y<30){put(x,y,p[theme==='polar-signal'?8:theme==='desert-expedition'?11:0]);continue;}
   // Polar's extension has no stars; delete isolated generated flecks above the mountains.
   if(theme==='polar-signal'&&y<60){put(x,y,p[8]);continue;}
   // Preserve the horizon/road heights and clean seams at the original crop boundary.
   if(y>=125&&y<190||x===30||x===31||x===288||x===289){put(x,y,old(x<32?32:287,y));continue;}
   const offset=(y*320+x)*4;let best=0,distance=Infinity;
   p.forEach((colour,i)=>{const d=colour.slice(0,3).reduce((sum,c,k)=>sum+(c-generated[offset+k])**2,0);if(d<distance){distance=d;best=i;}});
   put(x,y,p[best]);
 }
 // Sparse native stars distinguish Neon's new top sky from a UI band.
 if(theme==='neon-orbit')for(const [x,y,i]of [[12,13,12],[306,24,15],[230,12,11]])put(x,y,p[i]);
 run('magick',['-size','320x240','-depth','8','RGBA:-','-define','png:exclude-chunks=date,time','-define','png:color-type=6',path.join(dir,'window-plate.png')],{input:data});
 console.log(`${theme}: preserved centre 256×210; 23040 extension pixels on palette`);
}
