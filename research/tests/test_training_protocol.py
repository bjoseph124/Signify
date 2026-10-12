"""Protocol/metric checks; recognition quality comes from real-image reports."""
import importlib.util
from pathlib import Path
import unittest
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('train_static',ROOT/'scripts/train-static.py')
training=importlib.util.module_from_spec(spec)
spec.loader.exec_module(training)


class ProtocolTests(unittest.TestCase):
    def test_normalization_preserves_orientation_and_removes_translation_scale(self):
        p=np.array([[i*.01,i*.02,i*.003] for i in range(21)])
        np.testing.assert_allclose(training.normalize(p),training.normalize(p*3+[.3,.4,.5]),atol=1e-12)
        rotated=p.copy();rotated[:,0]=-p[:,1];rotated[:,1]=p[:,0]
        self.assertFalse(np.allclose(training.normalize(p),training.normalize(rotated)))
        self.assertIsNone(training.normalize(None))
        self.assertIsNone(training.normalize(np.zeros((21,3))))

    def test_accuracy_and_coverage_include_detection_failures(self):
        rows=[{'label':'A','points':None,'prediction':'Unknown'},
              {'label':'A','points':[[0,0,0]],'prediction':'A'},
              {'label':'B','points':[[0,0,0]],'prediction':'A'}]
        result=training.metrics(rows,'prediction')
        self.assertEqual(result['accuracy'],1/3)
        self.assertEqual(result['coverage'],2/3)
        self.assertEqual(result['precisionWhenAccepted'],.5)
        self.assertEqual(training.metrics(rows,'prediction',['A'])['images'],2)

    def test_empty_acceptance_is_undefined_not_perfect(self):
        result=training.metrics([{'label':'A','points':None,'prediction':'Unknown'}],'prediction')
        self.assertIsNone(result['precisionWhenAccepted'])
        self.assertEqual(result['coverage'],0)


if __name__=='__main__':unittest.main()
