# Full-alphabet research: replacement NOT ready

Live six-letter application: **https://signify-tau-six.vercel.app/**.
Feature branch: `feat/full-alphabet-research`. Do not merge or change the default recognizer based on these prototypes.

The owner reports F/I/L/V/W/Y work on their webcam. That working implementation and the Python application remain intact. **This branch does not establish support for all 26 letters.** The tested pretrained candidate failed; there are no real J/Z evaluation recordings yet. The missing model/data cannot be replaced by an alphabetical lookup table or by static images labelled J/Z.

## Decision and model review

Use the verified six-letter rules in production. For the expansion, train a small landmark classifier with a documented preprocessing contract and signer-separated validation; retain a separate temporal detector for J/Z. Start with the local recorder provided here. If thumb occlusion prevents accurate M/N/S/T classification, evaluate a small hand-crop image branch in addition to landmarks, rather than inventing more rules.

Candidates inspected:

| Candidate | Evidence and decision |
| --- | --- |
| [AmimulBmeIU/asl-alphabet-classifier](https://huggingface.co/AmimulBmeIU/asl-alphabet-classifier) | MIT license tag; actual 24-class labels and browser weights available. Architecture and reference preprocessing verified; evaluated below and rejected. Training source, signer split, and full provenance are not documented in its card. |
| [nocontextdoruk/asl-landmark-mlp](https://huggingface.co/nocontextdoruk/asl-landmark-mlp) | CC BY-NC 4.0, 36 static classes including digits and J/Z; random-split metrics do not validate motion or new signers. Not selected. |
| [MediaPipe ASL CNN](https://github.com/punpuniacitizen/MediaPipe-ASL-sign-language-recognition) | Provides an ONNX model and cross-dataset claims, but explicitly excludes trained weights from its code's MIT grant. Redistribution suitability is unresolved; not bundled. |

This is a targeted investigation, not proof that no suitable model exists. No candidate weights or third-party photographs are committed or published in the website. Downloads stay under ignored `research/candidates` and `research/.cache`. Do not treat a license tag as verification of training-data provenance.

## Real evaluation, 2026-10-11

Tested the Amimul model at immutable revision `9e5cde38db66ae889322aeea3c547848676fa96e`.

- Architecture: 63 raw image-coordinate xyz inputs → Dense 128/ReLU → Dense 64/ReLU → Dense 24/softmax. Training dropout is inactive during inference. Parameters come from the actual learned float32 weight file, not hand-authored weights.
- Reference browser [preprocessing](https://huggingface.co/spaces/AmimulBmeIU/asl-alphabet-live-demo/blob/main/index.html): flatten raw xyz. We did not substitute the legacy classifier's normalized features or optimize preprocessing on the test set.
- Dataset: [Dan Rasband ASL Alphabet Test](https://www.kaggle.com/datasets/danrasband/asl-alphabet-test), version 1, labelled **CC0: Public Domain** in the Kaggle metadata saved in `reports/dataset-provenance.json`.
- Protocol: all 720 unique, top-level static-letter JPEGs, 30 per class. Duplicate nested archive copies were excluded. Still images of J/Z and command classes were excluded, because they cannot validate motion. No training used this dataset. Candidate training overlap is unknown.
- Real browser pipeline: Chrome → actual MediaPipe Tasks Vision 1.1.0 / version-1 Hand Landmarker in IMAGE mode → candidate network. Thresholds match the app's tracking settings. This measures isolated photographs, not temporal webcam accuracy.
- Selection gate fixed before evaluation: softmax ≥0.90 and top-two margin ≥0.25, plus the app's in-frame landmark check. These are provisional engineering thresholds, **not calibrated confidence**.

| Result | Observed |
| --- | ---: |
| Images | 720 |
| Hands detected | 669 / 720 (92.9%) |
| Correct top-1, including missed hands as errors | 265 / 720 (36.8%) |
| Top-1 accuracy among detected hands | 39.6% |
| Accepted by score/margin/in-frame gates | 35 / 720 (4.9% coverage) |
| Correct among accepted | 24 / 35 (68.6% precision) |
| Incorrect accepted results | 11 |
| M, N, P, R, S recall | 0% each |

Full per-class counts and confusion matrix: [`reports/candidate-evaluation.json`](reports/candidate-evaluation.json). There is no negative/Unknown benchmark in this evaluation, and no verified signer-independent split. Do not use these figures as population accuracy. Do not tune on these 720 images and continue calling them a fresh test set.

An independent NumPy float32 implementation agreed with TypeScript's top label on all 669 detected hands; maximum top-score difference was `6.19e-7`. See [`reports/numerical-parity.json`](reports/numerical-parity.json). This checks the conversion math; it does not make the classifier accurate.

### Reproduce

From the repository root, with Node 22, installed Chrome, and Python 3.9+:

```sh
npm --prefix web ci
npm --prefix web run build
python3 research/scripts/prepare.py
node research/scripts/evaluate.mjs
.venv/bin/python research/scripts/check_parity.py
```

The first research command downloads approximately 25 MB and verifies SHA-256 hashes. The evaluator starts its own local server on port 4188 and closes it afterward. `CHROME_PATH` overrides the Chrome executable. The NumPy check can use any Python environment with NumPy; the existing Python demo's `.venv` already has it. No physical camera is opened. Raw per-image results remain in `.cache/evaluation-records.json`.

## J/Z prototype and local collection

Run the feature branch locally (`cd web && npm run dev`) and open **`http://127.0.0.1:5173/?lab=alphabet`**. The production URL is not changed by this branch. A Vercel branch preview can use the same query parameter.

The main letter readout still uses the original six-letter rules. The additional research panel has a separate **Motion candidate** readout. It is intentionally not labelled as supported ASL recognition.

`web/src/alphabet/motion.ts` requires a corresponding bent/extended finger shape, then an ordered trajectory from the pinky for J or index fingertip for Z. Coordinates use initial palm scale and retain screen displacement; wrist-centering every frame would erase the movement. J requires descent, a thumb-side hook, upward finish and endpoint pause. Z requires across, diagonal return/down, then across again and a pause. The detector bounds duration, path length, gaps, track jumps, handedness changes, and repeats. No probability is manufactured. The display holds a completed candidate briefly.

The geometry tests cover ordered paths, mirrored Z, stationary poses, incomplete strokes, circles, loss of tracking and invalid input. **They are synthetic logic tests, not J/Z accuracy evaluation.** Real clips may reveal signing variants these rules reject, or accidental movements they accept. No motion scores or success rates are claimed.

The recorder is opt-in inside the panel. Start Camera, enter an anonymous signer ID and session ID, select the actual ground-truth label, and press **Record 4 seconds**. Nothing is stored before that click. A bounded buffer holds timestamps, aspect-corrected xyz landmarks, MediaPipe handedness and candidate events. Missing hands are retained as null frames. Finish/download creates a local JSON file; discard or stop during recording clears the pending buffer. No video/audio is recorded and nothing is uploaded.

Put intentionally collected test clips in ignored `research/captures/` and evaluate them:

```sh
node research/scripts/evaluate-clips.mjs research/captures
```

The script runs the same motion implementation. It reports one correctly labelled event per J/Z clip, no event on negative clips, clip counts, and signer counts. A capture label is a human annotation, not proof it is correctly signed: obtain ASL-fluent review. There are currently **zero real motion clips** in this repository; a usable motion accuracy report does not exist yet.

## Practical training/data plan

1. **Agree on consent and reuse terms.** Recruit ASL-fluent signers or have an ASL-fluent reviewer verify labels. Collect only the data participants agree to share; anonymous IDs are sufficient. Local downloaded files are not automatically a consented training dataset.
2. **Pilot, then broaden coverage.** Start with at least 12 consenting participants: 8 train, 2 validation, 2 locked test. This is a starting target, not a guarantee of statistical sufficiency. Vary hand size, skin tone, mobility, dominant hand, cameras, lighting, distance, and background. Record at least two sessions per signer. Do not count neighbouring video frames as independent examples.
3. **Static data:** all 24 static letters, roughly 20 independently formed holds per class per training signer, with neutral transitions between holds. Record side-facing G/H and downward P/Q naturally; do not force every sign upright. Preserve thumb visibility for M/N/S/T. Collect Unknown examples: resting/open hands, unsupported gestures, transitions, partial hands, and tracking failures. Each clip must have a true label, signer and session ID, source/provenance, and reviewer status.
4. **Static baseline:** use `trainingFeatures()`'s wrist-relative, isotropically scaled 63-vector; canonicalize reflection consistently with capture handedness, but preserve rotation/orientation so G/Q and K/P remain distinguishable. Train **63 → 128 ReLU → 64 ReLU → 25 logits** (24 letters plus explicit Unknown) with class balancing and modest noise/scale augmentation applied only to training data. Export ONNX or TF.js with an immutable manifest and validate Python/browser logits numerically. No such trained artifact currently exists here.
5. **Temporal data:** collect complete J/Z trajectories at slow, normal, and fast speeds, both hands, varied scales. Start with 30 clips per letter per signer. Include at least as many negative clips: held I/D, waving, circles, reverse/incomplete J/Z paths, ordinary repositioning, transitions, and hand dropouts. Annotate stroke onset/end and repetitions. Never train J/Z from their still-image classes.
6. **Temporal baseline:** first evaluate the prototype on held-out signers. If needed, train a small temporal convolutional model on resampled ~32-frame landmark/trajectory sequences with J/Z/background outputs. Retain absolute fingertip displacement relative to the window's initial wrist and scale alongside handshape features. Do not normalize away motion. This requires the real labelled clips above.
7. **Validation:** choose thresholds/temperature and top-two margin using validation signers and negative examples, then freeze them. Report macro-F1, per-class precision/recall, accepted precision **and coverage**, Unknown false accepts, detection failures, handedness breakdown, event-level J/Z recall/false positives, and end-to-end latency. Evaluate using the actual video worker, not only extracted ideal poses.
8. **Promotion gate:** proposed targets before replacement: ≥95% accepted precision and ≥80% coverage overall, no static class below 80% recall, J/Z event recall ≥90%, false motion events ≤1% of negative clips, all measured on unseen signers. These are proposed targets, not results. Increase the test sample size before drawing strong population conclusions. If the baseline misses them, collect targeted examples or test a landmark-plus-image model. Keep the six-letter fallback throughout.

After those checks, expose a clearly named experimental 26-letter mode for webcam acceptance testing. Only merge and change the default once the evaluation and manual tests justify it. No repository visibility changes or production merges are part of this branch.
