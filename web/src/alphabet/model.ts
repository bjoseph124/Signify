/** Small, auditable dense-network inference. Only actual learned weights are used. */
import type { Point } from '../classifier';
export const STATIC_LETTERS = [...'ABCDEFGHIKLMNOPQRSTUVWXY'];
export type DenseLayer = { inputs: number; outputs: number; kernel: Float32Array; bias: Float32Array };
export type ModelPrediction = { label: string; score: number; margin: number; probabilities: number[] };
export class LandmarkNetwork {
  constructor(readonly layers: DenseLayer[], readonly labels: string[]) {
    if (labels.join('') !== STATIC_LETTERS.join('')) throw new Error('Expected the ordered 24 static ASL letters');
    if (!layers.length || layers[0].inputs !== 63 || layers.at(-1)!.outputs !== 24) throw new Error('Invalid model dimensions');
    layers.forEach((l, i) => {
      if (l.kernel.length !== l.inputs*l.outputs || l.bias.length !== l.outputs
        || (i > 0 && layers[i-1].outputs !== l.inputs)
        || [...l.kernel, ...l.bias].some(x => !Number.isFinite(x))) throw new Error('Invalid model weights');
    });
  }
  predict(features: number[]): ModelPrediction {
    if (features.length !== 63 || features.some(x => !Number.isFinite(x))) throw new Error('Expected 63 finite features');
    let current = features;
    this.layers.forEach((layer, n) => {
      const next = Array.from(layer.bias);
      for (let i=0;i<layer.inputs;i++) for(let j=0;j<layer.outputs;j++) next[j] += current[i]*layer.kernel[i*layer.outputs+j];
      current = n === this.layers.length-1 ? next : next.map(x=>Math.max(0,x));
    });
    const max = Math.max(...current), exponentials = current.map(x=>Math.exp(x-max));
    const total = exponentials.reduce((a,b)=>a+b,0), probabilities = exponentials.map(x=>x/total);
    const order = probabilities.map((p,i)=>({p,i})).sort((a,b)=>b.p-a.p);
    return { label:this.labels[order[0].i], score:order[0].p, margin:order[0].p-order[1].p, probabilities };
  }
}

/** Exact published AmimulBmeIU architecture; raw xyz, NOT the legacy preprocessing. */
export function loadCandidateWeights(buffer: ArrayBuffer, labels: string[]) {
  if (buffer.byteLength !== 72032) throw new Error('Unexpected candidate weight size');
  const view = new DataView(buffer);
  const values = Float32Array.from({length:buffer.byteLength/4},(_,i)=>view.getFloat32(i*4,true));
  let offset = 0;
  const layers = [[63,128],[128,64],[64,24]].map(([inputs,outputs])=>{
    const kernel = values.slice(offset,offset+inputs*outputs); offset += inputs*outputs;
    const bias = values.slice(offset,offset+outputs); offset += outputs;
    return {inputs,outputs,kernel,bias};
  });
  return new LandmarkNetwork(layers,labels);
}

export function gatePrediction(result: ModelPrediction, minimum = 0.9, margin = 0.25): string {
  // Provisional gates, not calibrated probabilities or an accuracy guarantee.
  return result.score >= minimum && result.margin >= margin ? result.label : 'Unknown';
}

/** Proposed training contract: isotropic, wrist-relative, handedness-canonical input.
 * Retain orientation: rotating the palm upright would erase G/Q and K/P distinctions.
 * Only use with a model trained on this exact representation, never with the candidate.
 */
export function trainingFeatures(points: Point[], handedness: 'Left'|'Right'): number[] | null {
  if (points.length!==21 || points.some(p=>p.length!==3 || p.some(v=>!Number.isFinite(v)))) return null;
  const origin=points[0], scale=Math.hypot(...points[9].map((v,i)=>v-origin[i]));
  if(scale<1e-6) return null;
  return points.flatMap(p=>p.map((v,i)=>(v-origin[i])/scale*(i===0 && handedness==='Left' ? -1:1)));
}
