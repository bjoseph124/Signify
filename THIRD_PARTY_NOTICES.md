# Third-party notices

Signify's original code is licensed under the [MIT License](LICENSE). The third-party components below retain their own licenses and attribution requirements.

| Component | Use | License / source |
| --- | --- | --- |
| MediaPipe Tasks Vision | Browser hand tracking and WASM runtime | Apache-2.0; [upstream](https://github.com/google-ai-edge/mediapipe), [license copy](web/public/licenses/mediapipe-LICENSE.txt) |
| MediaPipe Hand Landmarker, float16 v1 | Bundled, unmodified hand-tracking model | Apache-2.0; [model provenance, hash, and model card](web/public/models/NOTICE.md) |
| React and React DOM | Browser interface | MIT; [upstream](https://github.com/facebook/react), [license copy](web/public/licenses/react-LICENSE.txt) |
| Scheduler | React runtime dependency | MIT; [license copy](web/public/licenses/scheduler-LICENSE.txt) |

The browser build serves these license copies under `/licenses/`. MediaPipe's upstream license file includes an additional notice for its text-language-detector utilities; it is preserved verbatim. Third-party attribution is provided through these separate license files and the model notice at `web/public/models/NOTICE.md`; it is not embedded in the generated JavaScript bundles.

Vite, TypeScript, Vitest, Playwright, esbuild, and their dependencies are development tools installed through npm. Their individual licenses remain in the installed packages; exact versions are in `web/package-lock.json`. Python dependencies are installed separately through `requirements.txt`: MediaPipe (Apache-2.0), OpenCV (Apache-2.0, with bundled third-party notices), and NumPy (BSD-3-Clause, with bundled third-party notices). Refer to the installed distributions for complete notices.

The production branch includes no third-party ASL image dataset, alphabet-classification weights, photographs, or font files. It uses system fonts and SVG artwork defined in the application source. The README screenshot shows this project's interface with the camera off.

The separate `feat/full-alphabet-research` branch contains experimental code, evaluation reports, and a trained classifier with its own provenance documentation. Nothing from that experiment is integrated into production. Making the repository public also exposes that branch and its history.
