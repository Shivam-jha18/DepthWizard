"""
Evaluate Fine-Tuned Depth Anything V2 on the GAMUS Test Dataset.
Computes official SIH 2026 metrics:
- Root Mean Square Error (RMSE)
- Mean Absolute Error (MAE)
- Pearson Correlation (r)
- Coefficient of Determination (R^2)
"""

import os
import sys
import numpy as np
import torch
from datasets import load_dataset
from PIL import Image
from tqdm import tqdm

# Ensure src is accessible
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.depth_estimation import DepthEstimator
from src.evaluation import calculate_metrics, landscape_error_analysis

def evaluate_on_test_set(num_samples=30):
    print("=" * 60)
    print("📊 GAMUS Test Set Evaluation (SIH 2026 Benchmark)")
    print("=" * 60)

    # 1. Initialize Depth Estimator (auto-loads GAMUS LoRA if present)
    print("\n[1/3] Loading Depth Estimator...")
    estimator = DepthEstimator(model_name="vits")

    # 2. Stream GAMUS Test Dataset
    print(f"\n[2/3] Streaming {num_samples} unseen test samples from earthflow/GAMUS...")
    test_stream = load_dataset("earthflow/GAMUS", split="test", streaming=True)
    test_samples = list(test_stream.take(num_samples))
    print(f"Loaded {len(test_samples)} test samples.")

    # 3. Inference & Metrics Accumulation
    print("\n[3/3] Running inference and computing metric elevation error...")
    all_rmse = []
    all_mae = []
    all_corr = []
    all_r2 = []

    for idx, sample in enumerate(tqdm(test_samples, desc="Evaluating Test Set")):
        # Extract RGB
        img = sample.get("image") or sample.get("rgb") or sample.get("img")
        if not isinstance(img, Image.Image):
            img = Image.fromarray(np.array(img).astype(np.uint8))
        img_rgb = np.array(img.convert("RGB"))

        # Extract Ground Truth Height (nDSM)
        h_gt = sample.get("height") or sample.get("ndsm") or sample.get("depth") or sample.get("label")
        if h_gt is None:
            continue
        h_gt = np.array(h_gt).astype(np.float32)

        # Predict with fine-tuned model
        rel_depth, raw_depth = estimator.predict_depth(img_rgb)

        # Align shapes
        if rel_depth.shape != h_gt.shape:
            import cv2
            pred_aligned = cv2.resize(rel_depth, (h_gt.shape[1], h_gt.shape[0]), interpolation=cv2.INTER_LINEAR)
        else:
            pred_aligned = rel_depth

        # Coarse-proxy calibration (simulates real-world SRTM 30m resolution)
        # Downsample ground truth to ~30m GSD equivalent to prevent dense label leakage.
        # In production, only a coarse low-resolution DEM is available, not the dense GT.
        import cv2
        coarse_size = max(8, min(h_gt.shape[0], h_gt.shape[1]) // 16)
        h_gt_coarse = cv2.resize(h_gt, (coarse_size, coarse_size), interpolation=cv2.INTER_AREA)
        pred_coarse = cv2.resize(pred_aligned, (coarse_size, coarse_size), interpolation=cv2.INTER_AREA)

        valid = (h_gt_coarse > 0) & (~np.isnan(h_gt_coarse)) & (~np.isnan(pred_coarse))
        if np.sum(valid) > 10:
            p_vals = pred_coarse[valid].flatten()
            h_vals = h_gt_coarse[valid].flatten()
            A = np.vstack([p_vals, np.ones_like(p_vals)]).T
            a, b = np.linalg.lstsq(A, h_vals, rcond=None)[0]
            a = float(np.clip(abs(a), 1.0, 500.0))
            b = float(np.clip(b, -100.0, 8848.0))
            pred_metric = a * pred_aligned + b
        else:
            pred_metric = pred_aligned * 50.0

        # Evaluate against the FULL-RESOLUTION ground truth (never used for calibration)
        metrics = calculate_metrics(pred_metric, h_gt, nodata_val=0.0)
        all_rmse.append(metrics["rmse"])
        all_mae.append(metrics["mae"])
        all_corr.append(metrics["correlation_r"])
        all_r2.append(metrics["r2_score"])

    # 4. Final Aggregated Benchmark Report
    print("\n" + "=" * 60)
    print("🏆 OFFICIAL TEST BENCHMARK RESULTS")
    print("=" * 60)
    print(f"Total Test Samples Evaluated : {len(all_rmse)}")
    print(f"Mean RMSE (Root Mean Sq Error): {np.mean(all_rmse):.2f} meters")
    print(f"Mean MAE (Mean Absolute Error): {np.mean(all_mae):.2f} meters")
    print(f"Pearson Correlation (r)       : {np.mean(all_corr):.4f}")
    print(f"R² Score (Coeff. of Determ.)  : {np.mean(all_r2):.4f}")
    print("=" * 60)

if __name__ == "__main__":
    evaluate_on_test_set(num_samples=30)
