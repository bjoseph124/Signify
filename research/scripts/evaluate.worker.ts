import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { loadCandidateWeights, gatePrediction } from '../../web/src/alphabet/model';
import { classify, type Point } from '../../web/src/classifier';
let tracker: HandLandmarker;
let network: ReturnType<typeof loadCandidateWeights>;
self.onmessage = async ({data}) => {
  try {
    if(data.type==='init') {
      const files=await FilesetResolver.forVisionTasks('/wasm');
      tracker=await HandLandmarker.createFromOptions(files,{
        baseOptions:{modelAssetPath:'/models/hand_landmarker.task',delegate:'CPU'},
        runningMode:'IMAGE',numHands:1,minHandDetectionConfidence:0.65,
        minHandPresenceConfidence:0.65,minTrackingConfidence:0.65,
      });
      network=loadCandidateWeights(await (await fetch('/candidate/group1-shard1of1.bin')).arrayBuffer(),await (await fetch('/candidate/labels.json')).json());
      self.postMessage({type:'ready'});
    } else {
      const bitmap:ImageBitmap=data.bitmap;
      try {
        const landmarks=tracker.detect(bitmap).landmarks[0];
        if(!landmarks) {self.postMessage({type:'result',detected:false,prediction:'Unknown',accepted:'Unknown',baseline:'Unknown'});return;}
        const prediction=network.predict(landmarks.flatMap(p=>[p.x,p.y,p.z]));
        const points:Point[]=landmarks.map(p=>[p.x,p.y*bitmap.height/bitmap.width,p.z]);
        const inFrame=landmarks.every(p=>p.x>0.015&&p.x<0.985&&p.y>0.015&&p.y<0.985);
        self.postMessage({type:'result',detected:true,prediction:prediction.label,accepted:inFrame?gatePrediction(prediction):'Unknown',
          score:prediction.score,margin:prediction.margin,baseline:inFrame?classify(points):'Unknown',points,raw:landmarks.map(p=>[p.x,p.y,p.z])});
      } finally {bitmap.close();}
    }
  } catch(e) {self.postMessage({type:'error',message:String(e)});}
};
