import type { Point } from '../classifier';
import packageInfo from '../../package.json';
export type CaptureFrame={t:number;points:Point[]|null;handedness:string;motionCandidate:string|null};
export type Capture={schema:'signify-landmarks-v1';label:string;signer:string;session:string;source:'browser-webcam';trackerVersion:string;coordinates:'unmirrored-image-xyz-aspect-corrected-v1';frames:CaptureFrame[]};
export class CaptureBuffer {
  private clip:Capture|null=null;
  private start=0;
  begin(label:string,signer:string,session:string) {
    if(!/^(?:[A-Z]|Unknown)$/.test(label)||!signer.trim()||!session.trim())throw new Error('Label, anonymous signer ID, and session ID are required.');
    this.clip={schema:'signify-landmarks-v1',label,signer:signer.trim(),session:session.trim(),source:'browser-webcam',trackerVersion:packageInfo.dependencies['@mediapipe/tasks-vision'],coordinates:'unmirrored-image-xyz-aspect-corrected-v1',frames:[]};this.start=0;
  }
  add(frame:CaptureFrame) {
    if(!this.clip||this.clip.frames.length>=180)return;
    if(!this.clip.frames.length)this.start=frame.t;
    if(frame.t-this.start>6000)return;
    this.clip.frames.push({...frame,t:frame.t-this.start,points:frame.points?.map(p=>[...p])??null});
  }
  finish():Capture|null {const clip=this.clip;this.clip=null;return clip;}
  clear(){this.clip=null;}
}
