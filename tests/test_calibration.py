import unittest
import numpy as np
import sys
import os

# Ensure repo root is on sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.calibration import ScaleCalibrator, extract_dem_and_ndsm

class TestCalibration(unittest.TestCase):
    def setUp(self):
        self.calibrator = ScaleCalibrator()

    def test_heuristic_rdsm_scaling(self):
        """Test relative DSM calibration when image is non-georeferenced"""
        rel_depth = np.linspace(0, 1, 100).reshape((10, 10)).astype(np.float32)
        meta = {'is_georeferenced': False}
        
        dsm, a, b, mode = self.calibrator.calibrate_depth_to_metric(rel_depth, meta=meta)
        
        self.assertIn("Relative DSM", mode)
        self.assertAlmostEqual(a, 50.0, places=1)
        self.assertAlmostEqual(b, 0.0, places=1)
        self.assertEqual(dsm.shape, (10, 10))
        self.assertAlmostEqual(float(np.max(dsm)), 50.0, places=1)
        self.assertAlmostEqual(float(np.min(dsm)), 0.0, places=1)

    def test_georeferenced_prior_scaling(self):
        """Test fallback prior scaling when image is georeferenced but no SRTM is provided"""
        rel_depth = np.random.rand(20, 20).astype(np.float32)
        meta = {'is_georeferenced': True}
        
        dsm, a, b, mode = self.calibrator.calibrate_depth_to_metric(rel_depth, meta=meta)
        self.assertIn("Absolute DSM", mode)
        self.assertGreater(a, 0.0)
        self.assertEqual(dsm.shape, (20, 20))

    def test_calibrator_state_tracking(self):
        """Verify that calibrator correctly tracks last_aligned_srtm and samples"""
        rel_depth = np.random.rand(20, 20).astype(np.float32)
        meta = {'is_georeferenced': False}
        
        self.calibrator.calibrate_depth_to_metric(rel_depth, meta=meta)
        
        # Non-georeferenced images should not have SRTM alignment
        self.assertIsNone(self.calibrator.last_aligned_srtm)
        self.assertEqual(self.calibrator.last_calibration_samples, 0)

    def test_robust_trimmed_lstsq(self):
        """Test that robust trimmed least-squares rejects outliers"""
        np.random.seed(42)
        d_flat = np.linspace(0, 1, 1000).astype(np.float32)
        h_flat = 80.0 * d_flat + 120.0 + np.random.normal(0, 1.0, 1000).astype(np.float32)
        
        # Add extreme outliers (simulating cloud/shadow contamination)
        h_flat[0:10] = -9999.0
        h_flat[990:1000] = 9999.0
        
        a, b, n_samples = self.calibrator._robust_trimmed_lstsq(d_flat, h_flat, trim_pct=2.5)
        
        # Should recover approximately a=80, b=120 despite outliers
        self.assertAlmostEqual(a, 80.0, delta=5.0)
        self.assertAlmostEqual(b, 120.0, delta=5.0)
        # Should have trimmed some samples
        self.assertLess(n_samples, 1000)


class TestDEMnDSMExtraction(unittest.TestCase):
    def test_building_extraction(self):
        """Verify that a 15m building on 100m terrain is correctly isolated"""
        dsm = np.full((50, 50), 100.0, dtype=np.float32)
        dsm[20:30, 20:30] = 115.0  # 15m building

        dem, ndsm = extract_dem_and_ndsm(dsm, kernel_size=15)

        # DEM should be close to 100m (bare-earth)
        self.assertAlmostEqual(float(np.median(dem)), 100.0, delta=2.0)
        
        # nDSM at building center should be close to 15m
        building_height = float(ndsm[25, 25])
        self.assertGreater(building_height, 10.0)
        
        # nDSM on flat terrain should be close to 0
        flat_height = float(ndsm[5, 5])
        self.assertLess(flat_height, 3.0)

    def test_ndsm_non_negative(self):
        """nDSM should always be >= 0"""
        dsm = np.random.uniform(50, 200, (40, 40)).astype(np.float32)
        dem, ndsm = extract_dem_and_ndsm(dsm, kernel_size=15)
        self.assertTrue(np.all(ndsm >= 0.0))

    def test_dem_smoother_than_dsm(self):
        """DEM should have less variance than DSM (smoother surface)"""
        dsm = np.random.uniform(100, 150, (40, 40)).astype(np.float32)
        # Add sharp building features
        dsm[15:20, 15:20] = 180.0
        
        dem, ndsm = extract_dem_and_ndsm(dsm, kernel_size=15)
        self.assertLessEqual(np.std(dem), np.std(dsm))


if __name__ == '__main__':
    unittest.main()

