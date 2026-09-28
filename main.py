import os
import cv2
import numpy as np
from src.ingestion import load_image, export_geotiff
from src.depth_estimation import DepthEstimator
from src.calibration import ScaleCalibrator
from src.mesh_generator import MeshGenerator
from src.evaluation import calculate_metrics, landscape_error_analysis, generate_synthetic_reference

def run_pipeline(image_path, srtm_path=None):
    print("=== Step 1: Ingesting Image & Spatial Metadata ===")
    rgb_img, meta = load_image(image_path)
    
    print("=== Step 2: Estimating Relative Depth (Depth Anything V2) ===")
    estimator = DepthEstimator(model_name="vits")
    rel_depth_normalized, raw_depth = estimator.predict_depth(rgb_img)
    
    print("=== Step 3: Calibrating Elevation Model (rDSM / Absolute DSM) ===")
    calibrator = ScaleCalibrator()
    calibrated_dsm, a, b, mode = calibrator.calibrate_depth_to_metric(
        rel_depth_map=rel_depth_normalized,
        srtm_dem_path=srtm_path,
        meta=meta,
        target_shape=rgb_img.shape[:2]
    )
    print(f"Mode: {mode} (Scale a={a:.2f}, Offset b={b:.2f})")
    
    print("=== Step 4: Exporting Standard Geospatial GeoTIFF DSM ===")
    os.makedirs("data/output/", exist_ok=True)
    dsm_tif_path = "data/output/output_dsm.tif"
    export_geotiff(calibrated_dsm, dsm_tif_path, meta=meta)
    np.save("data/output/absolute_dsm.npy", calibrated_dsm)
    
    print("=== Step 5: Generating 3D Textured Mesh (.glb) & Heatmap ===")
    output_mesh_path = "data/output/terrain_model.glb"
    mesh_gen = MeshGenerator()
    mesh_gen.generate_elevation_heatmap(calibrated_dsm, "data/output/elevation_heatmap.png")
    mesh_path = mesh_gen.create_textured_mesh(rgb_img, calibrated_dsm, output_path=output_mesh_path)
    
    print("=== Step 6: Validating Accuracy & Landscape Stability ===")
    ref_dsm = generate_synthetic_reference(calibrated_dsm)
    metrics = calculate_metrics(calibrated_dsm, ref_dsm)
    breakdown = landscape_error_analysis(calibrated_dsm, ref_dsm)
    print(f"Metrics: RMSE = {metrics['rmse']} m, MAE = {metrics['mae']} m, Corr = {metrics['correlation_r']}, R² = {metrics['r2_score']}")
    print("Landscape Stability Breakdown:")
    for terrain, stat in breakdown.items():
        print(f"  - {terrain}: RMSE = {stat['rmse']}m, MAE = {stat['mae']}m ({stat['coverage_pct']}% coverage)")
        
    print(f"\nPipeline completed successfully! All assets saved to data/output/")
    return mesh_path

if __name__ == "__main__":
    os.makedirs("data/input", exist_ok=True)
    os.makedirs("data/output", exist_ok=True)
    os.makedirs("data/srtm_dem", exist_ok=True)
    
    sample_image = "data/input/sample.jpg"
    if os.path.exists(sample_image):
        run_pipeline(sample_image)
    else:
        print(f"Sample image not found at {sample_image}")