// Runs real image -> browser MediaPipe -> learned network. No mocked predictions.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(path.join(root,'web/package.json'));
const {build}=require('esbuild'),{chromium}=require('@playwright/test');
await build({entryPoints:[path.join(root,'research/scripts/evaluate.worker.ts')],bundle:true,format:'iife',platform:'browser',
  nodePaths:[path.join(root,'web/node_modules')],outfile:path.join(root,'research/.cache/evaluate.worker.js')});
const mime={'.js':'application/javascript','.wasm':'application/wasm','.json':'application/json','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/') {res.setHeader('Content-Type','text/html');res.end('<title>Signify evaluation</title>');return;}
    const routes={'/candidate/':'research/candidates/','/images/':'research/.cache/images/','/eval/':'research/.cache/'};
    const prefix=Object.keys(routes).find(p=>url.pathname.startsWith(p));
    const base=prefix?routes[prefix]:'web/dist/';
    const suffix=decodeURIComponent(prefix?url.pathname.slice(prefix.length):url.pathname.slice(1));
    const file=path.resolve(root,base,suffix);
    if(!file.startsWith(path.resolve(root,base)+path.sep)) {res.writeHead(403).end();return;}
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  } catch {res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(4188,'127.0.0.1',resolve));
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const page=await browser.newPage();await page.goto('http://127.0.0.1:4188');
  const manifest=JSON.parse(await readFile(path.join(root,'research/.cache/manifest.json'),'utf8'));
  const results=await page.evaluate(async entries=>{
    const worker=new Worker('/eval/evaluate.worker.js');
    const message=()=>new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Evaluation worker timed out')),30000);
      worker.onmessage=({data})=>{clearTimeout(timeout);data.type==='error'?reject(new Error(data.message)):resolve(data);};
      worker.onerror=e=>{clearTimeout(timeout);reject(new Error(e.message));};
    });
    let pending=message();worker.postMessage({type:'init'});await pending;
    const results=[];
    for(const entry of entries) {
      const bitmap=await createImageBitmap(await (await fetch('/images/'+entry.path)).blob());
      pending=message();worker.postMessage({type:'image',bitmap},[bitmap]);
      results.push({...entry,...await pending});
    }
    worker.terminate();return results;
  },manifest);
  const labels=[...'ABCDEFGHIKLMNOPQRSTUVWXY'];
  const stats=rows=>{
    const detected=rows.filter(r=>r.detected),accepted=rows.filter(r=>r.accepted!=='Unknown');
    return {total:rows.length,detected:detected.length,correct:rows.filter(r=>r.prediction===r.label).length,
      accuracy:rows.filter(r=>r.prediction===r.label).length/rows.length,
      accuracyOnDetected:detected.length?detected.filter(r=>r.prediction===r.label).length/detected.length:null,
      accepted:accepted.length,correctAccepted:accepted.filter(r=>r.accepted===r.label).length,
      coverage:accepted.length/rows.length,precisionWhenAccepted:accepted.length?accepted.filter(r=>r.accepted===r.label).length/accepted.length:null};
  };
  const report={dataset:'danrasband/asl-alphabet-test v1',model:'AmimulBmeIU/asl-alphabet-classifier@9e5cde38db66ae889322aeea3c547848676fa96e',
    protocol:'All 24 static classes; every image; no training or threshold tuning on this set; IMAGE mode; original published raw xyz preprocessing.',
    caveats:['Training-set overlap cannot be excluded because candidate training provenance is unpublished.','Static photographs do not evaluate J/Z or webcam temporal behavior.','No signer IDs; not a verified signer-independent evaluation.'],
    thresholds:{minimumSoftmax:0.9,minimumMargin:0.25},overall:stats(results),perClass:Object.fromEntries(labels.map(l=>[l,stats(results.filter(r=>r.label===l))])),
    confusion:Object.fromEntries(labels.map(l=>[l,Object.fromEntries([...labels,'Unknown'].map(p=>[p,results.filter(r=>r.label===l&&r.prediction===p).length]))]))};
  await writeFile(path.join(root,'research/reports/candidate-evaluation.json'),JSON.stringify(report,null,2)+'\n');
  await writeFile(path.join(root,'research/.cache/evaluation-records.json'),JSON.stringify(results));
  console.log(JSON.stringify(report.overall,null,2));
} finally {await browser?.close();server.close();}
