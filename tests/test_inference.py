import unittest
import numpy as np
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.evaluation import calculate_metrics, landscape_error_analysis

class TestEvaluationAndMetrics(unittest.TestCase):
    def test_calculate_metrics_identical(self):
        """Zero error test when prediction matches reference perfectly"""
        ref = np.random.uniform(100, 200, (50, 50)).astype(np.float32)
        pred = ref.copy()
        
        metrics = calculate_metrics(pred, ref)
        self.assertAlmostEqual(metrics['rmse'], 0.0, places=2)
        self.assertAlmostEqual(metrics['mae'], 0.0, places=2)
        self.assertAlmostEqual(metrics['r2_score'], 1.0, places=2)
        self.assertAlmostEqual(metrics['correlation_r'], 1.0, places=2)

    def test_calculate_metrics_with_known_offset(self):
        """Test RMSE and MAE under constant elevation offset"""
        ref = np.zeros((20, 20), dtype=np.float32)
        pred = np.full((20, 20), 5.0, dtype=np.float32)
        
        metrics = calculate_metrics(pred, ref)
        self.assertAlmostEqual(metrics['rmse'], 5.0, places=2)
        self.assertAlmostEqual(metrics['mae'], 5.0, places=2)
        self.assertAlmostEqual(metrics['bias'], 5.0, places=2)

    def test_landscape_breakdown_structure(self):
        """Test terrain morphology classification"""
        pred = np.random.uniform(50, 150, (40, 40)).astype(np.float32)
        ref = pred + np.random.normal(0, 1.0, (40, 40)).astype(np.float32)
        
        breakdown = landscape_error_analysis(pred, ref)
        self.assertIn("Flat Plains", breakdown)
        self.assertIn("Hilly / Mountainous", breakdown)
        self.assertIn("Urban / Structural", breakdown)

if __name__ == '__main__':
    unittest.main()
