import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { classify, Smoother, UNKNOWN, type Point } from './classifier';
import { MotionRecognizer } from './alphabet/motion';

let tracker: HandLandmarker | undefined;
const smoother = new Smoother();
let lastTimestamp = -1;
let researchMode = false;
const motion = new MotionRecognizer();
let motionCandidate: string | null = null;
let motionUntil = 0;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    researchMode = data.researchMode === true;
    try {
      const files = await FilesetResolver.forVisionTasks('/wasm');
      tracker = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate: 'CPU' },
        runningMode: 'VIDEO', numHands: 1,
        minHandDetectionConfidence: 0.65, minHandPresenceConfidence: 0.65, minTrackingConfidence: 0.65,
      });
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'error', message: `Hand tracker could not load. Refresh and try again. ${String(error)}` });
    }
  }
  if (data.type === 'frame') {
    const bitmap: ImageBitmap = data.bitmap;
    try {
      if (!tracker) throw new Error('Tracker is not ready');
      // Reset old votes if the stream was interrupted or paused.
      if (data.timestamp - lastTimestamp > 700) { smoother.reset(); motion.reset(); motionCandidate = null; }
      lastTimestamp = data.timestamp;
      const result = tracker.detectForVideo(bitmap, data.timestamp);
      const landmarks = result.landmarks[0] ?? [];
      const points: Point[] = landmarks.map(p => [p.x, p.y * bitmap.height / bitmap.width, p.z]);
      const inFrame = landmarks.every(p => p.x > 0.015 && p.x < 0.985 && p.y > 0.015 && p.y < 0.985);
      const raw = landmarks.length ? (inFrame ? classify(points) : UNKNOWN) : null;
      const handedness = result.handedness[0]?.[0]?.categoryName ?? '';
      if (researchMode) {
        const event = motion.update(landmarks.length && inFrame ? points : null, data.timestamp, handedness);
        if (event) { motionCandidate = event; motionUntil = data.timestamp + 700; }
        if (!landmarks.length || !inFrame || data.timestamp > motionUntil) motionCandidate = null;
      }
      self.postMessage({ type: 'result', label: smoother.update(raw), landmarks,
        ...(researchMode ? {researchFrame:{t:data.timestamp,points:landmarks.length?points:null,handedness,motionCandidate}} : {}) });
    } catch (error) {
      self.postMessage({ type: 'error', message: `Tracking stopped. Please restart the camera. ${String(error)}` });
    } finally { bitmap.close(); }
  }
};
