import { cp, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = new URL('../', import.meta.url);
await access(new URL('public/models/hand_landmarker.task', root));
await mkdir(new URL('public/wasm', root), { recursive: true });
await cp(fileURLToPath(new URL('node_modules/@mediapipe/tasks-vision/wasm', root)),
  fileURLToPath(new URL('public/wasm', root)), { recursive: true });
// Classic worker supports the MediaPipe WASM loader's importScripts call.
await build({ entryPoints: [fileURLToPath(new URL('src/tracker.worker.ts', root))],
  outfile: fileURLToPath(new URL('public/tracker.worker.js', root)),
  bundle: true, format: 'iife', platform: 'browser', target: 'es2022', minify: true });
console.log('Local MediaPipe model and WASM assets ready.');
