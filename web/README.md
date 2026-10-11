# Signify — browser ASL playground

React + TypeScript + Vite, with MediaPipe **Tasks Vision HandLandmarker** in a dedicated worker. The original Python application remains at the repository root and runs independently.

The six-letter classifier is a direct TypeScript port of `../recognition.py`: **F, I, L, V, W, Y**. This does **not** use MediaPipe's basic Gesture Recognizer. Tracking supplies 21 landmarks; our geometry rules produce the letters.

## Local development

Install Node **22** and npm. From the repository root:

```sh
cd web
npm ci
npm run dev
```

Open the printed localhost URL (normally http://127.0.0.1:5173). Click **Start Camera**, allow camera permission, and keep one upright hand fully in view, palm facing the camera. Either hand can be used. Select a letter card to see its pose cue. **Stop Camera** or **Esc** releases all camera tracks and terminates inference. Hiding/leaving the tab also stops the camera; return and explicitly start it again.

For production locally:

```sh
npm run build
npm run preview
```

No environment variables, API keys, Python server, database, or paid inference service is required. The first load downloads the hand model (~7.8 MB) and the WASM runtime from the site itself. Network access is needed to load these assets; webcam frames are never uploaded. The app has no recording, analytics, or external font requests. Hosting providers still receive ordinary asset requests.

## Deployment through GitHub and Vercel

The intended repository name is **Signify**. Commit both versions, keeping `.venv`, `node_modules`, `dist`, secrets, and test artifacts excluded by the included ignore files.

1. Push this repository to GitHub.
2. Open [Vercel New Project](https://vercel.com/new), sign in, and import **Signify** from GitHub. Grant Vercel access to that repository if needed.
3. Set **Root Directory: `web`**. Choose **Vite** and Node **22.x**.
4. Use **Install: `npm ci`**, **Build: `npm run build`**, **Output: `dist`**. `web/vercel.json` supplies these settings and camera/privacy headers.
5. Deploy. Visit the resulting HTTPS URL and test Start/Stop Camera. Ensure production deployment protection is disabled if the site should be accessible to everyone.

Vercel automatically redeploys subsequent pushes to the production branch, typically `main`. The GitHub repository may be private while the deployed site is public. No GitHub Pages setup is needed.

Optional authenticated CLI path, starting from the repository root:

```sh
cd web
npx vercel login
npx vercel
npx vercel --prod
```

For CLI deployment from `web`, use the current directory as the project root; don't set another nested `web` root. For GitHub import, use `web` relative to the repository root. See [Vercel's Vite guide](https://vercel.com/docs/frameworks/frontend/vite) and [Git integration](https://vercel.com/docs/git).

HTTPS (or localhost) is mandatory for browser webcam access. The Vercel deployment provides HTTPS. Avoid embedding the site in an iframe; camera access is restricted to the same origin.

## Recognition and performance

- `src/classifier.ts` preserves Python's normalized distances, joint-angle thresholds, orientation checks, and six-of-eight-frame smoothing. Twenty-seven fixtures generated with the Python classifier test matching results under reflection/scaling and invalid inputs.
- `src/tracker.worker.ts` uses the Tasks Vision video tracker. It corrects y for frame aspect ratio and rejects landmarks near frame edges. Rendering mirrors both the video and landmark overlay; geometry is reflection invariant.
- `src/useCamera.ts` sends at most one frame at a time, caps processing at about 25 FPS, skips duplicate video frames, and scales inference input to 640 pixels wide. Inference stays off the main thread. The UI updates as results arrive instead of queuing old frames.
- The worker is bundled as a classic worker because the MediaPipe WASM loader uses `importScripts`. The build copies version-matched WASM files from the installed package. The official version-1 landmark model is checked into `public/models`; its provenance and hash are in `NOTICE.md`.
- No-hand, partial-hand, ambiguous, inactive, and error conditions display **Unknown**. The video separately says **No hand detected** when applicable. Short unknown interruptions can retain a letter for two processed frames; three clear it. Losing the hand clears votes immediately. A stream gap resets votes, and a stalled tracker stops the camera with a retry message.

## Honest limitations

This is an experimental static handshape demo, **not a full ASL alphabet model or translator**. Only F/I/L/V/W/Y are supported. J and Z require movement and remain unsupported. The initial J handshape may appear as I. Unsupported signs and arbitrary poses can look like a supported shape and be misclassified.

No letter probabilities or confidence scores exist; none are shown. The tracking thresholds are internal MediaPipe thresholds, not letter confidence. Accuracy has not been measured with real signers. Lighting, angle, hand size, occlusion, and signing variation matter. Python and Tasks Vision use different tracking APIs, so identical classifier logic does not guarantee identical live landmark estimates.

Try a current desktop Chrome, Edge, or Safari. Browser support depends on WebAssembly, workers, OffscreenCanvas, and createImageBitmap. Browser tests here use Chrome; Safari/iOS/Android and physical webcams require separate testing. A responsive layout alone does not establish mobile tracking compatibility.

## Validation

```sh
npm test
npm run build
npm run test:browser
```

Browser tests use installed Google Chrome and a simulated webcam, never the physical camera. On another OS, set `CHROME_PATH` to Chrome's executable before running them. They start and stop their own production preview server on port 4173. Screenshots appear in ignored `test-results/`.

Coverage includes Python/TypeScript rule parity, prediction smoothing, responsive layout, hints, actual local WASM/model initialization and inference on a fake camera, permission denial, late permission cleanup, model-loading failure, Stop, and restart. These verify application behavior, **not ASL accuracy**.

Verified locally on the development Mac: production build, 32 unit tests, Chrome browser tests, and desktop/mobile screenshot inspection. The Python files and tests remain intact. Physical hand recognition and non-Chrome browser behavior still require hands-on validation.

Before announcing a public release, check both hands and all supported letters on physical desktop/mobile cameras, denied/revoked permissions, Stop/Esc, tab switching, slow networks, and stable letter transitions. Verify that your deployment has no sign-in gate.

## Troubleshooting

- **Camera denied:** use the browser's site controls to allow Camera. On macOS, enable the browser in **System Settings → Privacy & Security → Camera**, then restart it. Audio permission is never requested.
- **Camera busy or missing:** close FaceTime/Zoom, reconnect your camera, then retry.
- **No permission prompt on a phone/LAN address:** plain HTTP on a LAN IP is not a secure context. Use the deployed HTTPS URL.
- **Tracker won't load:** check DevTools Network for `/models/hand_landmarker.task`, `/tracker.worker.js`, and `/wasm/*`. Ensure `npm run build` ran and Vercel's root is `web`. These files must be served as assets, not rewritten to HTML.
- **Browser unsupported:** update the browser, try desktop Chrome, and check the console. Worker or WASM restrictions can prevent startup.
- **Always Unknown:** use even lighting, face your palm toward the lens, keep fingers upright and away from frame edges, and hold a supported shape for a moment.
- **Install/build failure:** check Node 22, run `npm ci` inside `web`, and share the complete error. The lockfile pins exact dependency versions.

Primary API reference: [MediaPipe Hand Landmarker for Web](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js).
