"""Prepare one CC0 dataset with filename-group holdouts, never random frame splits."""
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
archive = Path(sys.argv[1]) if len(sys.argv)>1 else root/'.cache/ayuraj-v1.zip'
if hashlib.sha256(archive.read_bytes()).hexdigest() != '780fab7aac5ed147733cdbacb7714b4dd5aa44664607ef8d784baad6b24e157d':
    raise ValueError('Training archive checksum mismatch; do not silently use changed data.')
records=[]
seen=set()
with zipfile.ZipFile(archive) as z:
    for name in sorted(z.namelist()):
        match=re.fullmatch(r'asl_dataset/([a-z])/(hand[1-5]_[^/]+\.jpeg)',name)
        if not match or match[1].upper() not in 'ABCDEFGHIKLMNOPQRSTUVWXY': continue
        data=z.read(name);digest=hashlib.sha256(data).hexdigest()
        if digest in seen: continue
        seen.add(digest)
        group=match[2].split('_')[0]
        split='validation' if group=='hand4' else 'heldout_group' if group=='hand5' else 'train'
        relative=f'training/{match[1]}/{match[2]}'
        dest=root/'.cache/images'/relative;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
        records.append({'path':relative,'label':match[1].upper(),'sha256':digest,'group':group,'split':split})
test=json.loads((root/'.cache/manifest.json').read_text())
for item in test:
    if item['sha256'] in seen: raise ValueError('Exact train/external-test duplicate found')
    records.append({**item,'group':'danrasband','split':'external_test'})
(root/'.cache/training-manifest.json').write_text(json.dumps(records))
report={'source':'https://www.kaggle.com/datasets/ayuraj/asl-dataset','version':1,'license':'CC0: Public Domain',
        'archiveSHA256':hashlib.sha256(archive.read_bytes()).hexdigest(),
        'splitCounts':{s:sum(r['split']==s for r in records) for s in ['train','validation','heldout_group','external_test']},
        'splitNote':'hand1/2/3 train, hand4 validation, hand5 held out. Filename groups are NOT verified signer IDs.',
        'deduplication':'Exact SHA-256 within training source; exclude duplicate nested archive copy; assert no exact overlap with external test.'}
(root/'reports/training-data.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
