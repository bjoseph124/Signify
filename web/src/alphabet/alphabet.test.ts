import {describe,it,expect} from 'vitest';
import {LandmarkNetwork,gatePrediction,trainingFeatures,STATIC_LETTERS} from './model';
import {MotionRecognizer,matchTrajectory,motionHandshape} from './motion';
import {CaptureBuffer} from './capture';
import fixtures from '../python-fixtures.json';
import type {Point} from '../classifier';

const path=(vertices:number[][])=>vertices.flatMap((v,i)=>{
  if(i===vertices.length-1)return Array.from({length:5},(_,j)=>({x:v[0],y:v[1],t:(i*6+j)*40}));
  const next=vertices[i+1];return Array.from({length:6},(_,j)=>({x:v[0]+(next[0]-v[0])*j/6,y:v[1]+(next[1]-v[1])*j/6,t:(i*6+j)*40}));
});
describe('experimental motion logic — synthetic paths, NOT accuracy validation',()=>{
  it('requires an ordered down-and-hook J with an endpoint pause',()=>{
    expect(matchTrajectory(path([[0,0],[0,1],[.5,.6]]),'J')).toBe(true);
    expect(matchTrajectory(path([[0,0],[0,1],[0,1]]),'J')).toBe(false);
    expect(matchTrajectory(path([[0,0],[0,1],[-.5,.6]]),'J')).toBe(false);
    expect(matchTrajectory(path([[0,0],[0,1],[.5,.6]]).slice(0,-4),'J')).toBe(false);
  });
  it('requires three Z strokes, rejects one stroke, circles, and stationary points',()=>{
    expect(matchTrajectory(path([[0,0],[.9,0],[0,.8],[.9,.8]]),'Z')).toBe(true);
    expect(matchTrajectory(path([[0,0],[-.9,0],[0,.8],[-.9,.8]]),'Z')).toBe(true);
    for(const v of [[[0,0],[1,0],[1,0]],[[0,0],[0,0],[0,0]],[[0,0],[1,0],[1,1],[0,1],[0,0]]])expect(matchTrajectory(path(v),'Z')).toBe(false);
  });
  it('rejects a static hand and resets when tracking is lost or handedness changes',()=>{
    const p=fixtures.find(f=>f.name==='I/1/2.5')!.points as Point[];
    expect(motionHandshape(p)).toBe('J');
    const detector=new MotionRecognizer();
    for(let i=0;i<40;i++)expect(detector.update(p,i*40,'Right')).toBeNull();
    expect(detector.update(null,2000,'Right')).toBeNull();
    expect(detector.update(p,2040,'Left')).toBeNull();
    expect(detector.update(p,2000,'Left')).toBeNull();
  });
  it('refuses invalid or unrelated handshapes',()=>{
    expect(motionHandshape([])).toBeNull();
    expect(motionHandshape(fixtures.find(f=>f.name==='W/1/2.5')!.points as Point[])).toBeNull();
  });
});
describe('learned-model safety and exact feature contract',()=>{
  it('keeps flat learned outputs Unknown and rejects malformed models',()=>{
    const layer={inputs:63,outputs:24,kernel:new Float32Array(63*24),bias:new Float32Array(24)};
    const prediction=new LandmarkNetwork([layer],STATIC_LETTERS).predict(new Array(63).fill(0));
    expect(prediction.score).toBeCloseTo(1/24);expect(gatePrediction(prediction)).toBe('Unknown');
    expect(()=>new LandmarkNetwork([layer],['A'])).toThrow();
    expect(()=>new LandmarkNetwork([layer],STATIC_LETTERS).predict([NaN])).toThrow();
  });
  it('checks margin in addition to model score',()=>{
    expect(gatePrediction({label:'A',score:.93,margin:.1,probabilities:[]})).toBe('Unknown');
    expect(gatePrediction({label:'A',score:.93,margin:.8,probabilities:[]})).toBe('A');
  });
  it('normalizes isotropically but preserves orientation',()=>{
    const p=fixtures.find(f=>f.name==='L/1/2.5')!.points as Point[];
    const a=trainingFeatures(p,'Right')!;
    const shifted=p.map(q=>q.map((v,i)=>v*2+[.3,.2,.1][i]) as Point);
    trainingFeatures(shifted,'Right')!.forEach((v,i)=>expect(v).toBeCloseTo(a[i]));
    const reflected=p.map(([x,y,z])=>[-x,y,z] as Point);
    trainingFeatures(reflected,'Left')!.forEach((v,i)=>expect(v).toBeCloseTo(a[i]));
    expect(trainingFeatures(p.map(([x,y,z])=>[-y,x,z] as Point),'Right')).not.toEqual(a);
    expect(trainingFeatures([],'Right')).toBeNull();
  });
});
describe('explicit local sample recording',()=>{
  it('collects nothing before Record, validates metadata, bounds data, and clears',()=>{
    const b=new CaptureBuffer();const frame={t:0,points:null,handedness:'',motionCandidate:null};
    b.add(frame);expect(b.finish()).toBeNull();expect(()=>b.begin('J','','session')).toThrow();
    b.begin('J','anonymous-1','session-1');
    for(let i=0;i<200;i++)b.add({...frame,t:i*20});
    const clip=b.finish()!;expect(clip.frames).toHaveLength(180);expect(clip.label).toBe('J');
    b.begin('Unknown','anonymous-1','session-1');b.clear();expect(b.finish()).toBeNull();
  });
});
