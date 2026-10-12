import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(path.join(root,'web/package.json'));
await require('esbuild').build({entryPoints:[path.join(root,'web/src/alphabet/model.ts')],bundle:true,platform:'node',format:'cjs',outfile:path.join(root,'research/.cache/model-runtime.cjs')});
const {LandmarkNetwork}=require(path.join(root,'research/.cache/model-runtime.cjs'));
const artifact=JSON.parse(await readFile(path.join(root,'research/.cache/lightweight-static-model.json')));
const model=new LandmarkNetwork(artifact.layers.map(l=>({...l,kernel:Float32Array.from(l.kernel),bias:Float32Array.from(l.bias)})),artifact.labels);
const cases=JSON.parse(await readFile(path.join(root,'research/.cache/lightweight-parity.json')));
let maxError=0,disagreements=0;
for(const c of cases){const result=model.predict(c.features);const expected=c.probabilities.indexOf(Math.max(...c.probabilities));if(result.label!==artifact.labels[expected])disagreements++;
  c.probabilities.forEach((p,i)=>maxError=Math.max(maxError,Math.abs(result.probabilities[i]-p)));}
if(disagreements||maxError>1e-4)throw new Error('Export parity failed');
const report={realImageExamples:cases.length,top1Disagreements:disagreements,maximumProbabilityDifference:maxError};
await writeFile(path.join(root,'research/reports/lightweight-parity.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
