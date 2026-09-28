"""
Download a test tile from GAMUS, run DepthWizard inference,
and generate a 4-panel Ground Truth vs Predicted Comparison figure.
"""

import os
import cv2
import h5py
import numpy as np
import matplotlib.pyplot as plt
from huggingface_hub import hf_hub_download
import torch

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.depth_estimation import DepthEstimator
from src.evaluation import calculate_metrics

def main():
    print("=" * 65)
    print("GAMUS Ground Truth vs DepthWizard Prediction Benchmark")
    print("=" * 65)

    os.makedirs("data/input", exist_ok=True)
    os.makedirs("data/output", exist_ok=True)

    # 1. Download official test tile
    print("[1/5] Fetching unseen test tile DC_03_26 from earthflow/GAMUS...")
    rgb_h5_path = hf_hub_download(repo_id="earthflow/GAMUS", filename="images/test/DC_03_26_RGB.h5", repo_type="dataset")
    hgt_h5_path = hf_hub_download(repo_id="earthflow/GAMUS", filename="heights/test/DC_03_26_AGL.h5", repo_type="dataset")

    # 2. Extract arrays
    print("[2/5] Extracting satellite RGB and LiDAR ground truth...")
    with h5py.File(rgb_h5_path, "r") as f_rgb:
        rgb_img = np.array(f_rgb["image"]).astype(np.uint8)

    with h5py.File(hgt_h5_path, "r") as f_hgt:
        lidar_gt = np.array(f_hgt["image"]).astype(np.float32)

    # Clean LiDAR ground truth (clamp invalid or missing values)
    lidar_gt = np.clip(lidar_gt, 0.0, 60.0)

    # Save satellite input image to data/input
    input_png_path = "data/input/gamus_test_satellite.png"
    cv2.imwrite(input_png_path, cv2.cvtColor(rgb_img, cv2.COLOR_RGB2BGR))
    print(f" -> Saved input satellite image: {input_png_path}")

    # 3. Run DepthWizard Depth Estimation
    print("[3/5] Running DepthWizard inference (Depth Anything V2 + GAMUS LoRA)...")
    estimator = DepthEstimator(model_name="vits")
    rel_depth, raw_depth = estimator.predict_depth(rgb_img)

    # 4. Calibrate predicted depth to metric meters using least-squares fit (ScaleCalibrator method)
    print("[4/5] Aligning predicted relief with ground truth...")
    mask_active = lidar_gt > 0.5
    if np.sum(mask_active) > 100:
        p_act = rel_depth[mask_active]
        r_act = lidar_gt[mask_active]
        slope, intercept = np.polyfit(p_act, r_act, 1)
        pred_elev = slope * rel_depth + intercept
    else:
        pred_elev = rel_depth * 25.0
    pred_elev = np.clip(pred_elev, 0.0, None)

    # Calculate rigorous validation metrics
    metrics = calculate_metrics(pred_elev, lidar_gt)
    corr_val = metrics.get('correlation_r', 0.0)
    r2_val = metrics.get('r2_score', 0.0)

    print("\n" + "=" * 45)
    print("VALIDATION RESULTS (DepthWizard vs Real LiDAR):")
    print(f"   * RMSE (Root Mean Sq Error): {metrics['rmse']:.2f} m")
    print(f"   * MAE (Mean Absolute Error):  {metrics['mae']:.2f} m")
    print(f"   * Pearson Correlation (r):   {corr_val:.3f}")
    print(f"   * Coefficient of Det (R2):   {r2_val:.3f}")
    print("=" * 45 + "\n")

    # 5. Generate Combined 4-Panel Visualization with True 3D Surface
    print("[5/5] Generating combined comparison visualization with true 3D surface...")
    fig = plt.figure(figsize=(24, 6))

    # Panel 1: Optical Satellite Image
    ax1 = fig.add_subplot(1, 4, 1)
    ax1.imshow(rgb_img)
    ax1.set_title("1. Satellite Imagery (Optical RGB)\n[Input to DepthWizard]", fontsize=12, fontweight="bold", pad=10)
    ax1.axis("off")

    # Panel 2: Ground Truth LiDAR
    ax2 = fig.add_subplot(1, 4, 2)
    im1 = ax2.imshow(lidar_gt, cmap="turbo", vmin=0, vmax=35)
    ax2.set_title("2. Ground Truth LiDAR (AGL)\n[Real Airborne LiDAR Measurement]", fontsize=12, fontweight="bold", pad=10)
    ax2.axis("off")
    plt.colorbar(im1, ax=ax2, fraction=0.046, pad=0.04, label="Height (m)")

    # Panel 3: True 3D Perspective Terrain Heightfield
    ax3 = fig.add_subplot(1, 4, 3, projection="3d")
    h_sub, w_sub = 128, 128
    pred_sub = cv2.resize(pred_elev, (w_sub, h_sub), interpolation=cv2.INTER_AREA)
    X = np.linspace(0, 100, w_sub)
    Y = np.linspace(0, 100, h_sub)
    X, Y = np.meshgrid(X, Y)
    surf = ax3.plot_surface(X, Y, pred_sub, cmap="turbo", vmin=0, vmax=35, linewidth=0, antialiased=True, rstride=1, cstride=1)
    ax3.view_init(elev=38, azim=-55)
    ax3.set_title("3. DepthWizard 3D Surface Mesh\n[Perspective Heightfield Projection]", fontsize=12, fontweight="bold", pad=12)
    ax3.set_zlabel("Elev (m)", fontsize=9, labelpad=2)
    ax3.set_xticks([])
    ax3.set_yticks([])
    ax3.tick_params(axis='z', labelsize=8)

    # Panel 4: Error Difference Map
    ax4 = fig.add_subplot(1, 4, 4)
    diff_map = np.abs(pred_elev - lidar_gt)
    im3 = ax4.imshow(diff_map, cmap="inferno", vmin=0, vmax=10)
    ax4.set_title(f"4. Error Heatmap (|Pred - LiDAR|)\nRMSE: {metrics['rmse']:.2f}m | r: {corr_val:.2f}", fontsize=12, fontweight="bold", pad=10)
    ax4.axis("off")
    plt.colorbar(im3, ax=ax4, fraction=0.046, pad=0.04, label="Abs Error (m)")

    plt.suptitle("DepthWizard vs Airborne LiDAR Ground Truth (GAMUS Test Benchmark)", fontsize=15, fontweight="bold", y=0.98)
    plt.tight_layout()

    out_comparison_path = "data/output/gamus_lidar_vs_depthwizard.png"
    plt.savefig(out_comparison_path, dpi=200, bbox_inches="tight")
    plt.close()
    print(f"SUCCESS! Combined comparison image saved to: {out_comparison_path}")

if __name__ == "__main__":
    main()
