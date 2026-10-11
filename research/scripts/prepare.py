"""Fetch pinned public research assets, verify hashes, extract only static test images.

Run from any directory with Python 3.9+. These files are ignored by Git and are
never copied into the production website. No pretrained model is enabled by this.
"""
import hashlib
import json
from pathlib import Path, PurePosixPath
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REVISION = '9e5cde38db66ae889322aeea3c547848676fa96e'
BASE = f'https://huggingface.co/AmimulBmeIU/asl-alphabet-classifier/resolve/{REVISION}/'
ASSETS = [
    ('candidates/model.json', BASE+'tfjs/model.json', 'fa4dbb215a169e65411f8ae05c0eb2d9e4acb09de52638ce8a4779c358a915f0'),
    ('candidates/labels.json', BASE+'labels.json', '6291dc03de372e67c347cc8b73890a293b409e2f309837577a3703a55cadf083'),
    ('candidates/group1-shard1of1.bin', BASE+'tfjs/group1-shard1of1.bin', '01c13bd7803114a40e3a847ec9868a46b8aacb9373e2fb0f079ccbafa9af5cc0'),
    ('.cache/evaluation.zip', 'https://www.kaggle.com/api/v1/datasets/download/danrasband/asl-alphabet-test?datasetVersionNumber=1', 'bab93fa1d7f1f0a92c8f6bafc0a487a0cdeec720aa13662a8962c8ebbfee8575'),
]


def prepare():
    for relative, url, expected in ASSETS:
        dest = ROOT / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            with urllib.request.urlopen(url, timeout=90) as response:
                data = response.read()
            if hashlib.sha256(data).hexdigest() != expected:
                raise ValueError(f'Hash mismatch for {relative}; source changed. Do not use unverified files.')
            dest.write_bytes(data)
        if hashlib.sha256(dest.read_bytes()).hexdigest() != expected:
            raise ValueError(f'Cached hash mismatch: {relative}')
    records = []
    with zipfile.ZipFile(ROOT / '.cache/evaluation.zip') as archive:
        for name in sorted(archive.namelist()):
            parts = PurePosixPath(name).parts
            if len(parts) != 2 or len(parts[0]) != 1 or parts[0] not in 'ABCDEFGHIKLMNOPQRSTUVWXY' or not name.endswith('.jpg'):
                continue
            data = archive.read(name)
            target = ROOT / '.cache/images' / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            records.append({'path': name, 'label': parts[0], 'sha256': hashlib.sha256(data).hexdigest()})
    if len(records) != 720:
        raise ValueError(f'Expected 720 static images; got {len(records)}')
    (ROOT / '.cache/manifest.json').write_text(json.dumps(records))
    print('Verified candidate files and 720 CC0 static test images. No training performed.')


if __name__ == '__main__':
    prepare()
