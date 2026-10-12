"""One fixed small MLP, group-separated calibration and untouched external evaluation.

No random-frame test split, hyperparameter search, or production model installation.
"""
import csv
import hashlib
import json
import warnings
from pathlib import Path

import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits

ROOT=Path(__file__).resolve().parents[1]
LETTERS=list('ABCDEFGHIKLMNOPQRSTUVWXY')
SIX=list('FILVWY')


def normalize(points):
    if points is None:
        return None
    p=np.asarray(points,dtype=np.float64)
    if p.shape!=(21,3) or not np.isfinite(p).all():
        return None
    p=p-p[0]
    scale=np.linalg.norm(p[9])
    return None if scale<1e-6 else (p/scale).flatten()


def metrics(rows,key,labels=LETTERS):
    subset=[r for r in rows if r['label'] in labels]
    accepted=[r for r in subset if r[key]!='Unknown']
    correct=sum(r[key]==r['label'] for r in subset)
    detected=sum(r['points'] is not None for r in subset)
    return {'images':len(subset),'detected':detected,'correct':correct,
            'accuracy':correct/len(subset) if subset else None,
            'accepted':len(accepted),'coverage':len(accepted)/len(subset) if subset else None,
            'precisionWhenAccepted':sum(r[key]==r['label'] for r in accepted)/len(accepted) if accepted else None}


def experiment():
    records=json.loads((ROOT/'.cache/training-landmarks.json').read_text())
    train=[r for r in records if r['split']=='train' and normalize(r['points']) is not None]
    if sorted(set(r['label'] for r in train))!=LETTERS:
        raise ValueError('At least one static class has no training landmarks; stop this experiment.')
    x=np.array([normalize(r['points']) for r in train]); y=np.array([r['label'] for r in train])
    # Both reflections are training augmentation, never extra test observations.
    reflected=x.reshape(-1,21,3).copy();reflected[:,:,0]*=-1
    x=np.concatenate([x,reflected.reshape(-1,63)]);y=np.concatenate([y,y])
    scaler=StandardScaler().fit(x)
    model=MLPClassifier(hidden_layer_sizes=(128,64),activation='relu',solver='adam',alpha=.001,
                        batch_size=64,learning_rate_init=.001,max_iter=250,random_state=42,
                        early_stopping=False,n_iter_no_change=20,tol=1e-4)
    with warnings.catch_warnings(record=True) as caught,threadpool_limits(limits=2):
        model.fit(scaler.transform(x),y)
    assert list(model.classes_)==LETTERS
    for row in records:
        features=normalize(row['points'])
        if features is None:
            row.update(top1='Unknown',score=0.,margin=0.)
        else:
            p=model.predict_proba(scaler.transform([features]))[0];order=np.argsort(p)[::-1]
            row.update(top1=LETTERS[order[0]],score=float(p[order[0]]),margin=float(p[order[0]]-p[order[1]]))

    def accept(row,threshold,margin):
        return row['top1'] if row['inFrame'] and row['score']>=threshold and row['margin']>=margin else 'Unknown'

    validation=[r for r in records if r['split']=='validation']
    options=[]
    for threshold in [.5,.6,.7,.8,.9,.95,.99]:
        for margin in [.1,.2,.3]:
            for row in validation: row['gated']=accept(row,threshold,margin)
            result=metrics(validation,'gated')
            if result['accepted']>=20 and result['precisionWhenAccepted']>=.9:
                options.append((result['coverage'],result['precisionWhenAccepted'],threshold,margin))
    if options:
        _,_,threshold,margin=max(options)
        calibration='Max validation coverage with >=90% accepted precision and >=20 accepted images; validation only.'
    else:
        threshold,margin=.9,.25
        calibration='No validation gate met target. Report fixed provisional 0.90/0.25 gate; not calibrated.'
    for row in records:row['gated']=accept(row,threshold,margin)

    def summarize(split):
        rows=[r for r in records if r['split']==split]
        return {'ungated':metrics(rows,'top1'),'gated':metrics(rows,'gated'),'baseline':metrics(rows,'baseline'),
                'sharedSix':{key:metrics(rows,key,SIX) for key in ['top1','gated','baseline']},
                'perLetter':{l:{key:metrics(rows,key,[l]) for key in ['top1','gated','baseline']} for l in LETTERS},
                'confusion':{key:{l:{p:sum(r['label']==l and r[key]==p for r in rows) for p in LETTERS+['Unknown']} for l in LETTERS} for key in ['top1','gated','baseline']}}
    report={'model':'MLP 63 -> 128 ReLU -> 64 ReLU -> 24 softmax; seed 42; one fit',
            'preprocessing':'Aspect-corrected xyz; subtract wrist; divide by wrist-to-middle-MCP distance; training-only StandardScaler; x-reflection augmentation. Orientation preserved.',
            'trainingImages':sum(r['split']=='train' for r in records),'trainingDetected':len(train),'iterations':int(model.n_iter_),
            'warnings':[str(w.message) for w in caught],'threshold':threshold,'margin':margin,'calibration':calibration,
            'limitations':['Filename hand groups are not verified signer identities.','Only two image sources; no real webcam clips or Unknown negatives.','External set was inspected in the previous candidate evaluation; this fit and gate do not use its labels.','Reported coverage includes detector failures and in-frame gate; scores are not calibrated confidence.'],
            'splits':{s:summarize(s) for s in ['validation','heldout_group','external_test']}}
    (ROOT/'reports/lightweight-static.json').write_text(json.dumps(report,indent=2)+'\n')
    with (ROOT/'reports/lightweight-per-letter.csv').open('w') as file:
        writer=csv.writer(file,lineterminator="\n");writer.writerow(['split','letter','images','detected','top1_accuracy','gated_accuracy','coverage','accepted_precision','baseline_accuracy','baseline_coverage'])
        for split,summary in report['splits'].items():
            for letter,stats in summary['perLetter'].items():
                a,b,c=stats['top1'],stats['gated'],stats['baseline']
                writer.writerow([split,letter,a['images'],a['detected'],a['accuracy'],b['accuracy'],b['coverage'],b['precisionWhenAccepted'],c['accuracy'],c['coverage']])
    for key in ['top1','gated','baseline']:
        with (ROOT/f'reports/lightweight-confusion-{key}.csv').open('w') as file:
            writer=csv.writer(file,lineterminator="\n");writer.writerow(['true/predicted']+LETTERS+['Unknown'])
            for letter,row in report['splits']['external_test']['confusion'][key].items():writer.writerow([letter]+list(row.values()))

    # Fold standardization into layer 1 for the existing browser dense-network evaluator.
    kernels=[w.copy() for w in model.coefs_];biases=[b.copy() for b in model.intercepts_]
    kernels[0]=kernels[0]/scaler.scale_[:,None]
    biases[0]=biases[0]-(scaler.mean_/scaler.scale_)@model.coefs_[0]
    artifact={'schema':'signify-static-mlp-v1','labels':LETTERS,'preprocessing':'wrist-palm-scale-v1',
              'experimental':True,'webcamValidated':False,'threshold':threshold,'margin':margin,
              'layers':[{'inputs':int(w.shape[0]),'outputs':int(w.shape[1]),'kernel':w.flatten().tolist(),'bias':b.tolist()} for w,b in zip(kernels,biases)]}
    destination=ROOT/'.cache/lightweight-static-model.json';destination.write_text(json.dumps(artifact))
    (ROOT/'.cache/lightweight-predictions.json').write_text(json.dumps(records))
    # Real held-out examples for Python/TypeScript conversion parity; not synthetic accuracy tests.
    examples=[r for r in records if r['split']=='external_test' and r['points'] is not None][:40]
    parity=[{'features':normalize(r['points']).tolist(),'probabilities':model.predict_proba(scaler.transform([normalize(r['points'])]))[0].tolist()} for r in examples]
    (ROOT/'.cache/lightweight-parity.json').write_text(json.dumps(parity))
    print(json.dumps({s:{k:v for k,v in d.items() if k in ['ungated','gated','baseline','sharedSix']} for s,d in report['splits'].items()},indent=2))
    print('Model artifact (research only):',destination,'SHA256',hashlib.sha256(destination.read_bytes()).hexdigest())


if __name__=='__main__':experiment()
