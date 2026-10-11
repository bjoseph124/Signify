# Sign Pop ✨

The separate **Signify web app** is in [`web/`](web/README.md): React + TypeScript, browser-local MediaPipe tracking, and Vercel deployment instructions. The Python demo below is preserved.

A small, local Python webcam playground for **six static ASL letters: F, I, L, V, W, Y**. OpenCV mirrors the video; MediaPipe tracks and draws 21 hand landmarks; conservative geometry rules suggest a letter. No account, training, recording, uploads, or runtime downloads.

This is an experimental fingerspelling practice demo, not a full alphabet classifier or sign-language translator. Rules have no calibrated confidence, so none is displayed. Unknown shapes are rejected where possible, but unsupported letters and other gestures can still resemble supported shapes. Real signing accuracy has not been measured.

## Quick start on macOS

Use **Python 3.9–3.12** (3.11 recommended for a new installation), and **macOS 13 or later** for the pinned Apple Silicon OpenCV wheel. The dependencies deliberately pin MediaPipe 0.10.21, which includes the legacy `solutions.hands` API and bundled tracking models. Newer releases can change/remove that API. Both Intel and Apple Silicon macOS wheels are provided by this pinned MediaPipe release; the installation here uses native Apple Silicon Python 3.9.

From Terminal in this folder:

```sh
python3 --version
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python app.py
```

If your default Python is outside the supported range, install Python 3.11 from [python.org](https://www.python.org/downloads/macos/) and use `python3.11 -m venv .venv` in a fresh environment. Installation requires internet; running the demo does not. An environment created during development may already exist in this folder; activate it and run `python app.py`.

Allow Camera access when macOS prompts. If denied, open **System Settings → Privacy & Security → Camera**, enable the application launching Python (Terminal, iTerm, or your IDE), then fully quit and reopen it. The prompt may identify Python or the host application. Run from an ordinary Terminal session if an embedded terminal does not prompt. Camera permissions and the live window must be checked on your Mac.

Click the video window so keyboard controls reach it:

| Key | Action |
| --- | --- |
| Q or Esc | Quit and release camera |
| H | Toggle the pose hints |
| R | Reset smoothing |
| Ctrl+C in Terminal | Quit |

The window close button also exits. To select another camera: `python app.py --camera 1` (try 0, 1, or 2 individually).

## Try a letter

Use one hand, palm facing the camera, fingers generally upright. Keep the whole hand in frame with a little margin. Use even lighting and hold the shape for about half a second. Either hand is supported by reflection-invariant distances and angles; both still need physical testing.

| Letter | Shape cue |
| --- | --- |
| F | Touch index fingertip to thumb in a circle; other three fingers extended |
| I | Pinky extended; other fingers folded and thumb tucked across them |
| L | Index up, thumb out sideways; remaining fingers folded |
| V | Index and middle extended and spread; others folded, thumb tucked |
| W | Index, middle, ring extended and spread; pinky folded, thumb tucked |
| Y | Thumb and pinky extended; other fingers folded |

These cues describe the supported shapes, not a replacement for learning from an ASL instructor. The matcher checks joint bending, relative distances, thumb placement, and separation of fingers. It rejects sideways/edge-on hands and ambiguous geometry. Detection may need adjustment for your hand, mobility, camera angle, or occlusion.

**J and Z are unsupported:** they require movement. No motion classifier is implemented; the beginning of J can look like I. The other unsupported letters are A, B, C, D, E, G, H, K, M, N, O, P, Q, R, S, T, U, and X.

Smoothing uses a six-of-eight-frame vote. A changed candidate shows `Unknown` until stable; one or two unknown frames can retain the previous letter, but three clear it. Losing the hand clears history immediately and shows `No hand detected`. FPS is measured throughput, not confidence.

## Why a rule subset rather than a downloaded ASL model?

I reviewed public pretrained candidates but could not establish sufficient webcam validation and suitability to adopt one as a reputable default. This is a limited review, not a claim that no suitable pretrained model exists:

- [ASL Landmark MLP model card](https://huggingface.co/nocontextdoruk/asl-landmark-mlp) documents preprocessing and a noncommercial license, but reports a random static-image split and classifies J/Z as static classes. That does not establish motion recognition or performance on your webcam.
- [MediaPipe ASL CNN repository](https://github.com/punpuniacitizen/MediaPipe-ASL-sign-language-recognition) provides weights and discusses evaluation, but distinguishes code licensing from dataset-derived weight licensing; I did not independently validate its weights, licensing suitability, or live performance.
- [SignLanguageProject domain-gap report](https://github.com/ridhi9898/SignLanguageProject) illustrates why image-test accuracy alone is insufficient for a live demo.

MediaPipe supplies **hand tracking only**, not ASL letter recognition. See [MediaPipe Hands documentation](https://chuoling.github.io/mediapipe/solutions/hands.html) and the [pinned package](https://pypi.org/project/mediapipe/0.10.21/). No generic gesture labels are being repurposed as a full alphabet.

## Checks without a webcam

```sh
python -m unittest discover -s tests -v
python app.py --self-test
python app.py --preview preview.png
python -m pip check
```

Unit tests check geometric transformations, ambiguous/invalid inputs, and temporal behavior using synthetic landmarks. They do **not** establish recognition accuracy. The self-test initializes the actual bundled MediaPipe model and runs a blank image through it. The preview renders the interface with a placeholder, not a real camera frame.

Verified in this workspace: dependency installation and `pip check`, six unit tests, Python compilation, CLI help, visual inspection of the generated preview, and bundled-model blank-image inference on Apple M3 with Python 3.9.6. The inference check required execution outside the sandbox to create a macOS graphics context. Physical webcam recognition has not been tested.

Physical acceptance check: launch the app, confirm permission and mirrored movement, observe all 21 landmarks, try each supported letter on both hands, switch shapes, remove your hand, try unsupported/open-palm shapes, and test Q/Esc/window close. Check that J/Z are never displayed. Real camera image quality, recognition accuracy, frame rate, and OS window behavior require this check.

## Troubleshooting

- **No matching distribution:** confirm Python is 3.9–3.12 and `python -m pip --version` points into `.venv`. On Apple Silicon use native arm64 Python, rather than mixing Rosetta and native packages. `python -c "import platform; print(platform.machine())"` prints the architecture. Do not remove version pins to fix the error; share the complete install output instead.
- **Camera unavailable/black:** check permissions above, close Zoom/FaceTime or other camera users, reconnect external cameras, and try `--camera 1`. A lost stream exits with an error after repeated failed reads.
- **No window / GUI not implemented:** this app requires a local graphical desktop. Do not use headless OpenCV. In the activated environment run `python -m pip uninstall opencv-python opencv-python-headless opencv-contrib-python-headless opencv-contrib-python`, then `python -m pip install -r requirements.txt` to restore the single OpenCV distribution.
- **`mediapipe` has no `solutions`:** run `python -m pip install -r requirements.txt`; ensure no local file is named `mediapipe.py` or `cv2.py`.
- **`Could not create an NSOpenGLPixelFormat` / `kGpuService`:** run from a normal local Terminal session with a logged-in desktop. The macOS hand-tracking pipeline needs a graphics context even though much of its inference uses the CPU; a restricted sandbox can block startup.
- **NumPy ABI/import error:** create a fresh environment using the supported Python range and install the exact requirements. Avoid reusing an environment with TensorFlow or other unrelated ML packages.
- **Always Unknown / wrong letters:** improve lighting, move the hand away from frame edges, face the palm toward the lens, keep fingers upright, and exaggerate finger separation gently. Press R after repositioning. Occlusions and perspective can defeat the heuristics; no measured accuracy is promised.

For help, share the command you ran, full error text, macOS version, Python version, and `python -m pip check` output. No camera image is needed to diagnose installation errors.
