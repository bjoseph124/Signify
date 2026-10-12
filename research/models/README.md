# Experimental artifact — do not deploy

`lightweight-static.json` contains actual learned weights from the single run in
`../scripts/train-static.py`. It is not copied to `web/public`, imported by the app,
or used by the production classifier.

- Data: Ayush Thakur's [ASL Dataset](https://www.kaggle.com/datasets/ayuraj/asl-dataset), version 1, CC0 as declared by the publisher.
- Train: filename groups hand1/hand2/hand3 only; 679 detected hands from 1,315 images.
- Input: 21 aspect-corrected xyz points, subtract wrist, divide by wrist-to-middle-MCP distance. Do not rotate upright or canonicalize handedness. X-reflection was training augmentation.
- Network: 63 → 128 ReLU → 64 ReLU → 24 softmax. StandardScaler is folded into first-layer weights/bias.
- Output labels are explicitly ordered inside the file; J/Z are absent.
- Validation-selected rejection: softmax ≥0.99 and top-two margin ≥0.30 plus in-frame landmarks. These scores are not calibrated confidence.
- Seed 42; 140 iterations; no hyperparameter search.
- SHA-256: `80873b35329a13c59ed716a795c26d47eec61f8803429f5128caf8c360e127b2`.

The existing TypeScript `LandmarkNetwork` can execute these layers after converting
kernel/bias arrays to Float32Array. Real-image conversion parity was checked against
the Python estimator on 40 examples, with no top-label differences. No webcam
accuracy has been established. The external-image results are poor; keep this
artifact as a reproducible negative result, not a new product mode.
