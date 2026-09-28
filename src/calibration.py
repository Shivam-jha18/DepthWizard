import os
import glob
import math
import io
import urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling, transform_bounds
from rasterio.merge import merge
import cv2

class ScaleCalibrator:
    def __init__(self, srtm_cache_dir="data/srtm_dem"):
        self.srtm_cache_dir = srtm_cache_dir
        os.makedirs(self.srtm_cache_dir, exist_ok=True)
        # Store the last aligned SRTM raster for downstream validation
        self.last_aligned_srtm = None
        self.last_calibration_samples = 0

    def fetch_online_dem_for_bounds(self, meta):
        """
        Fetches global SRTM/Terrain DEM tiles from AWS Open Data (elevation-tiles-prod)
        for the bounding box of the input georeferenced raster.
        Saves merged GeoTIFF into self.srtm_cache_dir for instant reuse.
        """
        try:
            img_crs = meta.get('crs')
            img_bounds = meta.get('bounds')
            if not img_crs or not img_bounds:
                return None

            bounds_4326 = transform_bounds(
                img_crs, "EPSG:4326",
                img_bounds.left, img_bounds.bottom,
                img_bounds.right, img_bounds.top
            )
            lon_min, lat_min, lon_max, lat_max = bounds_4326

            # Ensure valid bounds within standard global coverage
            lat_min = max(-85.0, min(85.0, float(lat_min)))
            lat_max = max(-85.0, min(85.0, float(lat_max)))
            lon_min = max(-180.0, min(180.0, float(lon_min)))
            lon_max = max(-180.0, min(180.0, float(lon_max)))

            cache_name = f"dem_{lon_min:.2f}_{lat_min:.2f}_{lon_max:.2f}_{lat_max:.2f}.tif"
            cache_path = os.path.join(self.srtm_cache_dir, cache_name)
            if os.path.exists(cache_path) and os.path.getsize(cache_path) > 1024:
                print(f"Using cached online SRTM DEM: {cache_path}")
                return cache_path

            # Determine appropriate zoom level based on geographic extent
            span = max(abs(lon_max - lon_min), abs(lat_max - lat_min))
            if span > 1.0:
                zoom = 10
            elif span > 0.3:
                zoom = 11
            else:
                zoom = 12

            def deg2num(lat_deg, lon_deg, z):
                lat_rad = math.radians(lat_deg)
                n = 2.0 ** z
                xtile = int((lon_deg + 180.0) / 360.0 * n)
                ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
                return (xtile, ytile)

            x_min, y_max = deg2num(lat_min, lon_min, zoom)
            x_max, y_min = deg2num(lat_max, lon_max, zoom)

            # Cap the number of tiles to avoid huge downloads (fallback to lower zoom if needed)
            if (abs(x_max - x_min) + 1) * (abs(y_max - y_min) + 1) > 36:
                zoom = max(8, zoom - 1)
                x_min, y_max = deg2num(lat_min, lon_min, zoom)
                x_max, y_min = deg2num(lat_max, lon_max, zoom)

            tile_coords = [
                (zoom, x, y)
                for x in range(min(x_min, x_max), max(x_min, x_max) + 1)
                for y in range(min(y_min, y_max), max(y_min, y_max) + 1)
            ]

            def download_tile(z, x, y):
                url = f"https://s3.amazonaws.com/elevation-tiles-prod/geotiff/{z}/{x}/{y}.tif"
                try:
                    req = urllib.request.Request(url, headers={'User-Agent': 'DepthWizard/1.0'})
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        data = resp.read()
                        return rasterio.open(io.BytesIO(data))
                except Exception:
                    return None

            print(f"Fetching {len(tile_coords)} SRTM/Terrain tiles from AWS Open Data (zoom={zoom})...")
            with ThreadPoolExecutor(max_workers=8) as executor:
                datasets = list(filter(None, executor.map(lambda c: download_tile(*c), tile_coords)))

            if not datasets:
                print("Failed to download online SRTM tiles.")
                return None

            mosaic, out_trans = merge(datasets)
            out_meta = datasets[0].meta.copy()
            out_meta.update({
                "driver": "GTiff",
                "height": mosaic.shape[1],
                "width": mosaic.shape[2],
                "transform": out_trans,
                "crs": datasets[0].crs
            })

            for ds in datasets:
                ds.close()

            with rasterio.open(cache_path, "w", **out_meta) as dest:
                dest.write(mosaic)

            print(f"Successfully downloaded and cached SRTM reference DEM: {cache_path}")
            return cache_path
        except Exception as e:
            print(f"Error fetching online SRTM DEM: {e}")
            return None

    def _check_spatial_overlap(self, meta, srtm_src):
        """
        Checks whether the input image and SRTM DEM have spatial overlap
        by transforming both bounding boxes to a common CRS (EPSG:4326).
        Returns True if they intersect.
        """
        try:
            img_crs = meta.get('crs')
            img_bounds = meta.get('bounds')
            if not img_crs or not img_bounds:
                return False

            # Transform both to WGS84 for comparison
            img_bounds_4326 = transform_bounds(img_crs, "EPSG:4326",
                                                img_bounds.left, img_bounds.bottom,
                                                img_bounds.right, img_bounds.top)
            srtm_bounds_4326 = transform_bounds(srtm_src.crs, "EPSG:4326",
                                                 srtm_src.bounds.left, srtm_src.bounds.bottom,
                                                 srtm_src.bounds.right, srtm_src.bounds.top)

            # Check bounding box intersection
            x_overlap = (img_bounds_4326[0] < srtm_bounds_4326[2]) and (img_bounds_4326[2] > srtm_bounds_4326[0])
            y_overlap = (img_bounds_4326[1] < srtm_bounds_4326[3]) and (img_bounds_4326[3] > srtm_bounds_4326[1])
            return x_overlap and y_overlap
        except Exception as e:
            print(f"Spatial overlap check failed: {e}")
            return True  # Assume overlap if check fails, let reprojection handle it

    def _robust_trimmed_lstsq(self, d_flat, h_flat, trim_pct=2.5):
        """
        Robust trimmed least-squares regression.
        Removes extreme percentile outliers (clouds, shadows, water, SRTM voids)
        before fitting H = a * D + b.

        Args:
            d_flat: Flattened relative depth values (1D)
            h_flat: Flattened SRTM height values (1D)
            trim_pct: Percentage of extreme residuals to trim from each tail
        
        Returns:
            a (float): Scale factor
            b (float): Offset
            n_samples (int): Number of valid samples used in final fit
        """
        # Initial unconstrained fit
        A = np.vstack([d_flat, np.ones(len(d_flat))]).T
        a_init, b_init = np.linalg.lstsq(A, h_flat, rcond=None)[0]

        # Compute residuals and trim outliers
        residuals = h_flat - (a_init * d_flat + b_init)
        lower = np.percentile(residuals, trim_pct)
        upper = np.percentile(residuals, 100.0 - trim_pct)
        inlier_mask = (residuals >= lower) & (residuals <= upper)

        if np.sum(inlier_mask) < 50:
            # Not enough inliers after trimming, use all points
            a, b = a_init, b_init
            n_samples = len(d_flat)
        else:
            # Refit on inliers only
            A_trim = np.vstack([d_flat[inlier_mask], np.ones(np.sum(inlier_mask))]).T
            a, b = np.linalg.lstsq(A_trim, h_flat[inlier_mask], rcond=None)[0]
            n_samples = int(np.sum(inlier_mask))

        # Enforce physically realistic constraints
        # Scale must be positive (depth and height should correlate positively)
        a = float(np.clip(abs(a), 5.0, 500.0))
        b = float(np.clip(b, -100.0, 8848.0))  # Max Earth elevation (Everest)

        return a, b, n_samples

    def calibrate_depth_to_metric(self, rel_depth_map, srtm_dem_path=None, meta=None, target_shape=None):
        """
        Converts scale-agnostic relative depth map into:
        1. Absolute Metric DSM (for georeferenced GeoTIFF imagery aligned with SRTM 30m DEM).
        2. Relative Digital Surface Model (rDSM) for non-georeferenced imagery (PNG/JPG).
        
        Uses robust trimmed least-squares regression: H_abs = a * D_rel + b

        Returns:
            calibrated_dsm (np.ndarray): Calibrated elevation array
            a (float): Scale factor
            b (float): Vertical offset
            mode_name (str): Calibration mode description
        """
        self.last_aligned_srtm = None
        self.last_calibration_samples = 0

        if target_shape is None:
            target_shape = rel_depth_map.shape[:2]

        is_georeferenced = meta.get('is_georeferenced', False) if meta else False

        # If srtm_dem_path not provided, check srtm_cache_dir for matching .tif files or auto-download
        if not srtm_dem_path and is_georeferenced:
            srtm_candidates = glob.glob(os.path.join(self.srtm_cache_dir, "*.tif"))
            for candidate in srtm_candidates:
                try:
                    with rasterio.open(candidate) as srtm_check:
                        if self._check_spatial_overlap(meta, srtm_check):
                            srtm_dem_path = candidate
                            print(f"Auto-discovered matching SRTM DEM from cache: {srtm_dem_path}")
                            break
                except Exception:
                    continue

            # If no cached overlapping DEM found, auto-fetch global DEM from AWS Open Data
            if not srtm_dem_path:
                print("No local cached SRTM DEM matched bounding box. Auto-fetching from AWS Open Data...")
                srtm_dem_path = self.fetch_online_dem_for_bounds(meta)

        # Case 1: Georeferenced Imagery with SRTM DEM available
        if srtm_dem_path and os.path.exists(srtm_dem_path):
            try:
                with rasterio.open(srtm_dem_path) as srtm_src:
                    # Verify spatial overlap before expensive reprojection
                    if meta and not self._check_spatial_overlap(meta, srtm_src):
                        print("Warning: SRTM DEM does not spatially overlap with input image. Skipping SRTM alignment.")
                        raise ValueError("No spatial overlap between image and SRTM DEM.")

                    srtm_data = srtm_src.read(1).astype(np.float32)
                    srtm_nodata = srtm_src.nodata

                    if srtm_data.shape != target_shape:
                        resampled_srtm = np.empty(target_shape, dtype=np.float32)
                        reproject(
                            source=rasterio.band(srtm_src, 1),
                            destination=resampled_srtm,
                            src_transform=srtm_src.transform,
                            src_crs=srtm_src.crs,
                            dst_transform=meta.get('transform', srtm_src.transform) if meta else srtm_src.transform,
                            dst_crs=meta.get('crs', srtm_src.crs) if meta else srtm_src.crs,
                            resampling=Resampling.bilinear
                        )
                        srtm_data = resampled_srtm

                    # Clamp bathymetric ocean values (< 0m) to sea level (0m)
                    if np.nanmin(srtm_data) < -50.0:
                        srtm_data = np.where(np.isfinite(srtm_data) & (srtm_data < 0.0), 0.0, srtm_data)

                valid_mask = ~np.isnan(srtm_data) & np.isfinite(srtm_data)
                if srtm_nodata is not None:
                    valid_mask &= (srtm_data != srtm_nodata)
                valid_mask &= (srtm_data != -32768) & (srtm_data != -9999)
                valid_mask &= ~np.isnan(rel_depth_map) & np.isfinite(rel_depth_map)
                
                if np.sum(valid_mask) > 50:
                    # Prioritize land/topographic control points (elevation > 0.5m) over flat open water
                    terrain_mask = valid_mask & (srtm_data > 0.5)
                    fit_mask = terrain_mask if np.sum(terrain_mask) > 500 else valid_mask

                    d_flat = rel_depth_map[fit_mask].flatten()
                    h_flat = srtm_data[fit_mask].flatten()
                    
                    a, b, n_samples = self._robust_trimmed_lstsq(d_flat, h_flat, trim_pct=2.5)
                    self.last_calibration_samples = n_samples
                    
                    absolute_dsm = (rel_depth_map * a) + b
                    self.last_aligned_srtm = srtm_data

                    print(f"SRTM Metric Alignment successful: a={a:.2f}, b={b:.2f} ({n_samples} inlier samples)")
                    return absolute_dsm, a, b, "Absolute DSM (SRTM Calibrated)"
                else:
                    print(f"Warning: Insufficient valid SRTM overlap ({np.sum(valid_mask)} pixels). Falling back.")
            except Exception as e:
                print(f"SRTM alignment error ({str(e)}). Falling back to prior scaling.")

        # Fallback 1: Georeferenced raster with sensor spatial prior
        if is_georeferenced:
            print("Georeferenced GeoTIFF detected. Applying remote sensing elevation prior.")
            a = 85.0
            b = 110.0
            absolute_dsm = (rel_depth_map * a) + b
            return absolute_dsm, a, b, "Absolute DSM (Spatial Prior)"

        # Fallback 2: Non-georeferenced optical image (rDSM)
        print("Non-georeferenced optical image (PNG/JPG). Generating Relative Digital Surface Model (rDSM).")
        a = 50.0
        b = 0.0
        rdsm = rel_depth_map * a
        return rdsm, a, b, "Relative DSM (rDSM)"


def extract_dem_and_ndsm(dsm, kernel_size=25):
    """
    Extracts bare-earth DEM from DSM using morphological opening (grayscale),
    then computes normalized DSM (nDSM = object/building/canopy height).
    
    This is the standard remote sensing approach used by PDAL, WhiteboxTools,
    and ISPRS photogrammetry workflows.

    Args:
        dsm (np.ndarray): Digital Surface Model (2D elevation array)
        kernel_size (int): Diameter of the structuring element. Should be
                           larger than the largest expected building footprint
                           in pixels. Default 25px works for most satellite scenes.

    Returns:
        dem (np.ndarray): Bare-earth Digital Elevation Model
        ndsm (np.ndarray): Normalized DSM (object heights above ground)
    """
    dsm_f32 = dsm.astype(np.float32)

    # Morphological opening = erosion followed by dilation
    # This removes features narrower than the structuring element (buildings, trees)
    # while preserving the underlying ground surface
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    dem = cv2.morphologyEx(dsm_f32, cv2.MORPH_OPEN, kernel)

    # Apply gentle Gaussian smoothing to remove morphological artifacts at building edges
    dem = cv2.GaussianBlur(dem, (7, 7), sigmaX=2.0)

    # Normalized DSM: net above-ground object height
    ndsm = np.maximum(0.0, dsm_f32 - dem)

    return dem, ndsm


if __name__ == "__main__":
    calibrator = ScaleCalibrator()
    dummy_depth = np.random.rand(100, 100).astype(np.float32)
    dsm, a, b, mode = calibrator.calibrate_depth_to_metric(dummy_depth, meta={'is_georeferenced': False})
    print(f"Result: {mode}, a={a}, b={b}")

    # Test DEM/nDSM extraction
    dummy_dsm = np.full((50, 50), 100.0, dtype=np.float32)
    dummy_dsm[20:30, 20:30] = 115.0  # 15m building
    dem, ndsm = extract_dem_and_ndsm(dummy_dsm, kernel_size=15)
    print(f"DEM range: {dem.min():.1f} - {dem.max():.1f}")
    print(f"nDSM range: {ndsm.min():.1f} - {ndsm.max():.1f}")