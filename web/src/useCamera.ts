import { useCallback, useEffect, useRef, useState } from 'react';
import { NO_HAND, UNKNOWN } from './classifier';
import type { CaptureFrame } from './alphabet/capture';

type Landmark = { x: number; y: number; z: number };
type Status = 'idle' | 'requesting' | 'loading' | 'live' | 'error';
const edges = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
export function cameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera permission was denied. Allow camera access in your browser’s address bar and macOS Privacy & Security settings, then try again.';
  if (name === 'NotFoundError') return 'No camera found. Connect a webcam and try again.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'Your camera could not start. Close other camera apps, check your system permissions, and try again.';
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function useCamera(researchMode = false) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [label, setLabel] = useState(UNKNOWN);
  const [error, setError] = useState('');
  const [fps, setFps] = useState(0);
  const [aspect, setAspect] = useState(4 / 3);
  const [researchFrame, setResearchFrame] = useState<CaptureFrame|null>(null);
  const frameListener = useRef<((frame:CaptureFrame)=>void)|null>(null);
  const subscribeFrames = useCallback((listener:((frame:CaptureFrame)=>void)|null) => { frameListener.current = listener; }, []);
  const generation = useRef(0);
  const resources = useRef<{ stream?: MediaStream; worker?: Worker; raf?: number; timer?: ReturnType<typeof setTimeout> }>({});

  const release = useCallback(() => {
    generation.current++;
    const active = resources.current;
    if (active.raf) cancelAnimationFrame(active.raf);
    clearTimeout(active.timer);
    active.worker?.terminate();
    active.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    resources.current = {};
    if (video.current) { video.current.pause(); video.current.srcObject = null; }
    const layer = canvas.current;
    layer?.getContext('2d')?.clearRect(0, 0, layer.width, layer.height);
  }, []);
  const stop = useCallback(() => { release(); setStatus('idle'); setLabel(UNKNOWN); setFps(0); setError(''); }, [release]);

  const start = useCallback(async () => {
    release();
    const id = generation.current;
    const current = () => generation.current === id;
    const fail = (message: string) => {
      if (!current()) return;
      release(); setStatus('error'); setError(message); setLabel(UNKNOWN); setFps(0);
    };
    setError(''); setLabel(UNKNOWN); setStatus('requesting');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      fail('Camera access needs HTTPS or localhost in a supported browser. Open the secure site URL in Safari, Chrome, or Edge.'); return;
    }
    if (!window.Worker || !window.createImageBitmap || !window.OffscreenCanvas) {
      fail('This browser is missing features needed for local hand tracking. Please use a recent version of Safari, Chrome, or Edge.'); return;
    }
    try {
      // A late permission result is disposed even after Stop or component unmount.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
        facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 },
      } });
      if (!current()) { stream.getTracks().forEach(t => t.stop()); return; }
      resources.current.stream = stream;
      stream.getVideoTracks().forEach(t => { t.onended = () => fail('The camera disconnected or access was revoked. Reconnect it and start again.'); });
      const element = video.current!;
      element.srcObject = stream;
      resources.current.timer = setTimeout(() => fail('Camera startup timed out. Stop other camera apps and try again.'), 20_000);
      await element.play();
      if (!current()) return;
      clearTimeout(resources.current.timer);
      setAspect(element.videoWidth / element.videoHeight || 4 / 3);
      setStatus('loading');
      const worker = new Worker('/tracker.worker.js');
      resources.current.worker = worker;
      resources.current.timer = setTimeout(() => fail('The hand tracker took too long to load. Check your connection and try again.'), 45_000);
      let busy = false, ready = false, lastVideo = -1, lastSent = 0, lastResult = performance.now(), previousResult = 0;
      const draw = (landmarks: Landmark[]) => {
        const layer = canvas.current;
        if (!layer) return;
        layer.width = element.videoWidth; layer.height = element.videoHeight;
        const ctx = layer.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, layer.width, layer.height);
        if (!landmarks.length) return;
        ctx.strokeStyle = '#c8f481'; ctx.lineWidth = 3;
        for (const [a, b] of edges) {
          ctx.beginPath(); ctx.moveTo(landmarks[a].x * layer.width, landmarks[a].y * layer.height);
          ctx.lineTo(landmarks[b].x * layer.width, landmarks[b].y * layer.height); ctx.stroke();
        }
        for (const p of landmarks) {
          ctx.beginPath(); ctx.arc(p.x * layer.width, p.y * layer.height, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#fcfff4'; ctx.fill(); ctx.strokeStyle = '#496641'; ctx.stroke();
        }
      };
      worker.onmessage = ({ data }) => {
        if (!current()) return;
        if (data.type === 'ready') {
          clearTimeout(resources.current.timer); ready = true; lastResult = performance.now(); setStatus('live');
        }
        if (data.type === 'error') fail(data.message);
        if (data.type === 'result') {
          busy = false; lastResult = performance.now();
          setLabel(data.label === NO_HAND ? UNKNOWN : data.label);
          setHandVisible(data.landmarks.length > 0);
          draw(data.landmarks);
          if (previousResult) setFps(Math.round(1000 / (lastResult - previousResult)));
          previousResult = lastResult;
          if (researchMode && data.researchFrame) { setResearchFrame(data.researchFrame); frameListener.current?.(data.researchFrame); }
        }
      };
      worker.onerror = () => fail('The hand-tracking worker could not run. Refresh the page or try a newer browser.');
      worker.postMessage({ type: 'init', researchMode });
      const tick = async (now: number) => {
        if (!current()) return;
        resources.current.raf = requestAnimationFrame(tick);
        if (!ready) return;
        if (now - lastResult > 3000) { fail('The video or tracker stopped responding. Start the camera again.'); return; }
        if (busy || now - lastSent < 40 || element.readyState < 2 || lastVideo === element.currentTime) return;
        busy = true; lastSent = now; lastVideo = element.currentTime;
        try {
          const bitmap = await createImageBitmap(element, { resizeWidth: 640, resizeHeight: Math.round(640 * element.videoHeight / element.videoWidth) });
          if (!current()) { bitmap.close(); return; }
          worker.postMessage({ type: 'frame', bitmap, timestamp: now }, [bitmap]);
        } catch (e) { fail(cameraError(e)); }
      };
      resources.current.raf = requestAnimationFrame(tick);
    } catch (e) { fail(cameraError(e)); }
  }, [release, researchMode]);
  const [handVisible, setHandVisible] = useState(false);
  useEffect(() => {
    const hidden = () => { if (document.hidden) stop(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') stop(); };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', stop);
    window.addEventListener('keydown', key);
    return () => { release(); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', stop); window.removeEventListener('keydown', key); };
  }, [release, stop]);
  return { video, canvas, status, label, error, fps, aspect, handVisible, start, stop, researchFrame, subscribeFrames };
}
