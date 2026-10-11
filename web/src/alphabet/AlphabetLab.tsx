import { useEffect, useRef, useState } from 'react';
import { CaptureBuffer, type Capture, type CaptureFrame } from './capture';

export function AlphabetLab({live,frame,subscribe}:{live:boolean;frame:CaptureFrame|null;subscribe:(listener:((frame:CaptureFrame)=>void)|null)=>void}) {
  const buffer=useRef(new CaptureBuffer());
  const [label,setLabel]=useState('J'),[signer,setSigner]=useState(''),[session,setSession]=useState('session-1');
  const [recording,setRecording]=useState(false),[clip,setClip]=useState<Capture|null>(null),[message,setMessage]=useState('');
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const finish=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;const result=buffer.current.finish();setRecording(false);setClip(result);};
  useEffect(()=>{subscribe(f=>buffer.current.add(f));return()=>{subscribe(null);buffer.current.clear();if(timer.current)clearTimeout(timer.current);};},[subscribe]);
  useEffect(()=>{if(!live){buffer.current.clear();setRecording(false);if(timer.current)clearTimeout(timer.current);}},[live]);
  const begin=()=>{
    try{buffer.current.begin(label,signer,session);setClip(null);setMessage('');setRecording(true);timer.current=setTimeout(finish,4000);}
    catch(e){setMessage(String(e));}
  };
  const download=()=>{
    if(!clip)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(clip)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`signify-${clip.label}-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <section className="alphabet-lab" aria-labelledby="lab-title"><span className="eyebrow">OPT-IN RESEARCH LAB</span><h2 id="lab-title">Help the alphabet grow.</h2>
    <p>The 24-letter candidate failed our real-image evaluation. Your main result still uses the working six-letter classifier. J/Z below are unvalidated motion candidates, not confirmed ASL recognition.</p>
    <div className="motion-readout" aria-live="polite">Motion candidate: <strong>{live?frame?.motionCandidate??'Unknown':'Unknown'}</strong></div>
    <p>Try an I handshape tracing J with your pinky, or an extended index tracing Z. Finish with a brief pause. A moving handshape alone is not enough. Direction and thresholds need real signer validation.</p>
    <details><summary>Record a local evaluation sample</summary><p>Only after you press Record: store up to four seconds of landmark coordinates in memory. No video, audio, or uploads. Download saves a JSON file to your device. Use an anonymous signer ID; review consent and dataset terms before sharing.</p>
      <div className="lab-fields"><label>Ground-truth label<select value={label} disabled={recording} onChange={e=>setLabel(e.target.value)}>{[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ','Unknown'].map(l=><option key={l}>{l}</option>)}</select></label>
        <label>Anonymous signer ID<input value={signer} disabled={recording} onChange={e=>setSigner(e.target.value)} placeholder="signer-01" maxLength={64}/></label>
        <label>Session ID<input value={session} disabled={recording} onChange={e=>setSession(e.target.value)} maxLength={64}/></label></div>
      <div className="lab-actions"><button className="button start-button" disabled={!live||recording} onClick={begin}>Record 4 seconds</button><button className="button stop-button" disabled={!recording} onClick={finish}>Finish sample</button><button className="button" disabled={!clip?.frames.length} onClick={download}>Download sample</button><button className="button" onClick={()=>{buffer.current.clear();setClip(null);setRecording(false);if(timer.current)clearTimeout(timer.current);}}>Discard</button></div>
      <p role="status">{message||(recording?'Recording landmarks locally…':clip?`${clip.frames.length} frames ready. Ground truth: ${clip.label}. Nothing uploaded.`:'Start the camera, choose the true label, then record. Include Unknown and no-hand examples.')}</p>
    </details></section>;
}
