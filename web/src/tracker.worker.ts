import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { classify, Smoother, UNKNOWN, type Point } from './classifier';

let tracker: HandLandmarker | undefined;
const smoother = new Smoother();
let lastTimestamp = -1;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
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
      if (data.timestamp - lastTimestamp > 700) smoother.reset();
      lastTimestamp = data.timestamp;
      const result = tracker.detectForVideo(bitmap, data.timestamp);
      const landmarks = result.landmarks[0] ?? [];
      const points: Point[] = landmarks.map(p => [p.x, p.y * bitmap.height / bitmap.width, p.z]);
      const inFrame = landmarks.every(p => p.x > 0.015 && p.x < 0.985 && p.y > 0.015 && p.y < 0.985);
      const raw = landmarks.length ? (inFrame ? classify(points) : UNKNOWN) : null;
      self.postMessage({ type: 'result', label: smoother.update(raw), landmarks });
    } catch (error) {
      self.postMessage({ type: 'error', message: `Tracking stopped. Please restart the camera. ${String(error)}` });
    } finally { bitmap.close(); }
  }
};
