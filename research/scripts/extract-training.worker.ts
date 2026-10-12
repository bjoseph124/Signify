import {FilesetResolver,HandLandmarker} from '@mediapipe/tasks-vision';
import {classify,type Point} from '../../web/src/classifier';
let tracker:HandLandmarker;
self.onmessage=async({data})=>{
  try {
    if(data.type==='init'){
      tracker=await HandLandmarker.createFromOptions(await FilesetResolver.forVisionTasks('/wasm'),{
        baseOptions:{modelAssetPath:'/models/hand_landmarker.task',delegate:'CPU'},runningMode:'IMAGE',numHands:1,
        minHandDetectionConfidence:.65,minHandPresenceConfidence:.65,minTrackingConfidence:.65});
      self.postMessage({type:'ready'});return;
    }
    const bitmap:ImageBitmap=data.bitmap;
    try{
      const result=tracker.detect(bitmap),landmarks=result.landmarks[0];
      const points:Point[]|null=landmarks?landmarks.map(p=>[p.x,p.y*bitmap.height/bitmap.width,p.z]):null;
      const inFrame=landmarks?.every(p=>p.x>.015&&p.x<.985&&p.y>.015&&p.y<.985)??false;
      self.postMessage({type:'result',points,inFrame,baseline:points&&inFrame?classify(points):'Unknown'});
    }finally{bitmap.close();}
  }catch(error){self.postMessage({type:'error',message:String(error)});}
};
