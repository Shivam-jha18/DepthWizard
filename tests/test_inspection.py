import unittest
import numpy as np
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.calibration import extract_dem_and_ndsm

class TestInspectionAndDSM(unittest.TestCase):
    def test_ground_elevation_and_object_height(self):
        """
        Verify that object/canopy height is correctly extracted via
        morphological DEM/nDSM decomposition (DSM - DEM = nDSM).
        """
        # Create a 60x60 synthetic DSM with a flat 100m terrain and a 15m building at center
        dsm = np.full((60, 60), 100.0, dtype=np.float32)
        # Add 15m building in center
        dsm[25:35, 25:35] = 115.0

        dem, ndsm = extract_dem_and_ndsm(dsm, kernel_size=15)

        # Point on top of building (30, 30)
        y, x = 30, 30
        dsm_elev = float(dsm[y, x])
        self.assertEqual(dsm_elev, 115.0)

        ground_elev = float(dem[y, x])
        object_height = float(ndsm[y, x])

        # DEM under the building should be close to 100m bare-earth
        self.assertAlmostEqual(ground_elev, 100.0, delta=3.0)

        # nDSM should be close to 15m building height
        self.assertGreater(object_height, 10.0)

        # On flat terrain, nDSM should be near zero
        flat_ndsm = float(ndsm[5, 5])
        self.assertLess(flat_ndsm, 3.0)

    def test_slope_computation_on_dem(self):
        """Test slope computed from DEM (not DSM) to avoid building contamination"""
        # Create a sloped terrain
        dsm = np.zeros((50, 50), dtype=np.float32)
        for i in range(50):
            dsm[i, :] = 100.0 + i * 2.0  # 2m per pixel slope

        dem, ndsm = extract_dem_and_ndsm(dsm, kernel_size=15)

        # Compute slope on DEM
        dy, dx = np.gradient(dem)
        slope_center = float(np.degrees(np.arctan(np.sqrt(dx[25, 25]**2 + dy[25, 25]**2))))

        # Should detect a meaningful slope
        self.assertGreater(slope_center, 30.0)

    def test_elevation_stats_calculation(self):
        """Test calculation of min, max, and mean elevation"""
        sample_dsm = np.array([[95.0, 100.0], [105.0, 110.0]], dtype=np.float32)
        self.assertAlmostEqual(float(np.min(sample_dsm)), 95.0)
        self.assertAlmostEqual(float(np.max(sample_dsm)), 110.0)
        self.assertAlmostEqual(float(np.mean(sample_dsm)), 102.5)

if __name__ == '__main__':
    unittest.main()

