import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url)),require=createRequire(path.join(root,'web/package.json'));
const {build}=require('esbuild'),{chromium}=require('@playwright/test');
await build({entryPoints:[path.join(root,'research/scripts/extract-training.worker.ts')],bundle:true,format:'iife',platform:'browser',
  nodePaths:[path.join(root,'web/node_modules')],outfile:path.join(root,'research/.cache/extract-training.worker.js')});
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<title>Landmark extraction</title>');return;}
    const prefix=url.pathname.startsWith('/research/')?'/research/':null;
    const base=prefix?'research/.cache':'web/dist';
    const file=path.resolve(root,base,decodeURIComponent(prefix?url.pathname.slice(prefix.length):url.pathname.slice(1)));
    if(!file.startsWith(path.resolve(root,base)+path.sep)){res.writeHead(403).end();return;}
    res.setHeader('Content-Type',({'.js':'application/javascript','.wasm':'application/wasm','.json':'application/json','.jpeg':'image/jpeg','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(4188,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page=await browser.newPage();await page.goto('http://127.0.0.1:4188');
  await page.exposeFunction('progress',n=>console.log(`Extracted ${n} images`));
  const manifest=JSON.parse(await readFile(path.join(root,'research/.cache/training-manifest.json'),'utf8'));
  const records=await page.evaluate(async entries=>{
    const worker=new Worker('/research/extract-training.worker.js');
    const response=()=>new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Worker timeout')),30000);
      worker.onmessage=({data})=>{clearTimeout(timer);data.type==='error'?reject(new Error(data.message)):resolve(data);};
      worker.onerror=e=>{clearTimeout(timer);reject(new Error(e.message));};
    });
    let pending=response();worker.postMessage({type:'init'});await pending;
    const records=[];
    for(const entry of entries){
      const bitmap=await createImageBitmap(await(await fetch('/research/images/'+entry.path)).blob());
      pending=response();worker.postMessage({type:'image',bitmap},[bitmap]);records.push({...entry,...await pending});
      if(records.length%200===0)await window.progress(records.length);
    }
    worker.terminate();return records;
  },manifest);
  await writeFile(path.join(root,'research/.cache/training-landmarks.json'),JSON.stringify(records));
  console.log(`Saved ${records.length} real-image records, including detection failures.`);
}finally{await browser?.close();server.close();}
