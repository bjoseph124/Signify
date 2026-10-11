// Replay explicitly collected real landmark clips through the actual motion code.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(path.join(root,'web/package.json'));
const {build}=require('esbuild');
if(!process.argv[2])throw new Error('Usage: node research/scripts/evaluate-clips.mjs <directory of real capture JSON files>');
await build({entryPoints:[path.join(root,'web/src/alphabet/motion.ts')],bundle:true,platform:'node',format:'cjs',outfile:path.join(root,'research/.cache/motion.cjs')});
const {MotionRecognizer}=require(path.join(root,'research/.cache/motion.cjs'));
const directory=path.resolve(process.argv[2]),rows=[];
for(const name of (await readdir(directory)).filter(n=>n.endsWith('.json')).sort()){
  const clip=JSON.parse(await readFile(path.join(directory,name),'utf8'));
  if(clip.schema!=='signify-landmarks-v1'||clip.source!=='browser-webcam'||!clip.signer||!clip.session||!Array.isArray(clip.frames)||clip.frames.length<10
    ||!/^(?:[A-Z]|Unknown)$/.test(clip.label))throw new Error(`Invalid or too-short capture: ${name}`);
  const detector=new MotionRecognizer(),events=[];let previous=-Infinity;
  for(const frame of clip.frames){
    if(!Number.isFinite(frame.t)||frame.t<=previous)throw new Error(`Non-increasing timestamp: ${name}`);
    previous=frame.t;
    const event=detector.update(frame.points,frame.t,frame.handedness);
    if(event)events.push({label:event,t:frame.t});
  }
  rows.push({file:name,label:clip.label,signer:clip.signer,session:clip.session,events,
    matched:clip.label==='J'||clip.label==='Z'?events.length===1&&events[0].label===clip.label:events.length===0});
}
if(!rows.length)throw new Error('No real recordings supplied; motion accuracy cannot be evaluated.');
const report={protocol:'One correctly labelled event per J/Z clip; zero motion events on negative clips. No tuning on these clips.',
  clipCount:rows.length,signerCount:new Set(rows.map(r=>r.signer)).size,
  J:{total:rows.filter(r=>r.label==='J').length,correct:rows.filter(r=>r.label==='J'&&r.matched).length},
  Z:{total:rows.filter(r=>r.label==='Z').length,correct:rows.filter(r=>r.label==='Z'&&r.matched).length},
  negatives:{total:rows.filter(r=>!['J','Z'].includes(r.label)).length,falsePositiveClips:rows.filter(r=>!['J','Z'].includes(r.label)&&!r.matched).length},rows};
await writeFile(path.join(root,'research/.cache/motion-evaluation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined},null,2));
