"""Independent NumPy float32 comparison to browser inference on real image landmarks."""
import hashlib
import json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
weights = np.fromfile(ROOT / 'candidates/group1-shard1of1.bin', dtype='<f4')
offset = 0
layers = []
for inputs, outputs in [(63,128),(128,64),(64,24)]:
    kernel = weights[offset:offset+inputs*outputs].reshape(inputs,outputs)
    offset += inputs*outputs
    bias = weights[offset:offset+outputs]
    offset += outputs
    layers.append((kernel,bias))
labels = json.loads((ROOT/'candidates/labels.json').read_text())
errors, disagreements = [], 0
for row in json.loads((ROOT/'.cache/evaluation-records.json').read_text()):
    if not row['detected']:
        continue
    values = np.array(row['raw'],dtype=np.float32).flatten()
    for index,(kernel,bias) in enumerate(layers):
        values = values @ kernel + bias
        if index < 2:
            values = np.maximum(values,0)
    values = np.exp(values-values.max())
    values /= values.sum()
    errors.append(abs(float(values.max())-row['score']))
    disagreements += labels[int(values.argmax())] != row['prediction']
report = {'reference':'NumPy float32 dense evaluation against TypeScript browser inference on actual extracted image landmarks',
          'examples':len(errors),'top1Disagreements':disagreements,'maximumScoreDifference':max(errors),
          'weightSha256':hashlib.sha256((ROOT/'candidates/group1-shard1of1.bin').read_bytes()).hexdigest()}
(ROOT/'reports/numerical-parity.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
assert disagreements == 0 and max(errors) < 1e-4
