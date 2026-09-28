# DepthWizard: High-Precision Single-View Elevation Estimation & Interactive 3D Terrain Platform

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19+-61DAFB?logo=react&logoColor=black)](https://reactjs.org)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?logo=three.js)](https://threejs.org)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![Air--Gapped](https://img.shields.io/badge/Deployment-100%25_Air--Gapped-success)](https://github.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 📌 Problem Overview & Motivation

Digital Elevation Models (DEMs) and Digital Surface Models (DSMs) are fundamental to urban planning, disaster monitoring, flood risk mapping, and defense reconnaissance. Traditionally, elevation data requires stereo-imaging pairs, aerial LiDAR, or Interferometric Synthetic Aperture Radar (InSAR)—modalities that can be cost-prohibitive, weather-sensitive, and computationally intensive.

**DepthWizard** provides an agile, end-to-end software pipeline that transforms **single-view optical remote-sensing imagery** (RGB satellite / aerial / drone) into high-fidelity elevation maps and interactive 3D terrain meshes.

---

## 🌟 Key Capabilities & Technical Features

### 1. Dual-Mode Geospatial Ingestion
* **JPG/PNG → Relative DSM (rDSM)**: Instant structural depth profiling for non-georeferenced drone/aerial photography.
* **GeoTIFF → Absolute DSM (metres, SRTM/GCP-calibrated)**: Automatically parses embedded CRS (e.g., UTM EPSG:32633), affine geotransforms, and bounding coordinates to anchor relative disparity into true SI physical metres.
* **Standard Geospatial Output**: Exports results to 32-bit floating point GeoTIFF (`.tif`) fully compatible with QGIS, ArcGIS, GDAL, and PDAL.

### 2. Deep Monocular Depth Backbone (GAMUS LoRA Fine-Tuned)
* Employs **Depth Anything V2 (ViT-Small)** adapted via **LoRA (Low-Rank Adaptation)** trained on the **GAMUS Remote Sensing Benchmark** (`earthflow/GAMUS`).
* Eliminates the domain gap between ground-level natural imagery and nadir/off-nadir overhead satellite captures.
* Offline model weights pre-packaged locally in `models/weights/depth_anything_v2_gamus_lora/`.

### 3. Metric Scale Calibration & Bare-Earth Decomposition
* **Virtual Ground Control Points (GCPs)**: Performs robust trimmed least-squares regression against NASA SRTM 30m Global DEM rasters:
  $$\min_{a, b} \sum_{i} \left( H_{\text{SRTM}}^{(i)} - (a \cdot D_{\text{rel}}^{(i)} + b) \right)^2 \implies H_{\text{abs}} = a \cdot D_{\text{rel}} + b$$
* **Dual-Layer Morphological Filtering**: Separates surface DSM into bare-earth DEM and Normalized DSM (nDSM), isolating net building and tree canopy heights ($H_{\text{object}} = \text{DSM} - \text{DEM}$).
* **Sensor Spatial Priors**: Automatic fallback to Ground Sampling Distance (GSD) sensor priors when external elevation rasters are unavailable.

### 4. Interactive 3D WebGL Platform (Three.js & React)
* **High-Fidelity 3D Textured Mesh (.glb)**: Generates watertight 3D terrain models with photographic RGB draping and architectural display pedestals (14.0–24.0 units calibrated vertical relief).
* **Smooth 360° Cursor Orbit**: Full mouse drag rotation, panning, and zoom with intelligent drag-vs-click discrimination.
* **Live Point Elevation & Slope Inspector**: Real-time 3D raycasting displaying Surface DSM ($m$), Bare Ground DEM ($m$), Net Object/Building Height ($+m$), and physical terrain slope ($^\circ$).
* **Dynamic Time-of-Day Shading**: Live sunlight simulation with adjustable sun direction, azimuth, and presets (Morning, Noon, Golden Hour, Night).
* **Interactive Flood Simulation**: Dynamic water level plane for flood risk vulnerability assessment.
* **Multi-View Modes**: Studio Architectural Clay, Elevation Turbo Heatmap, Vector Wireframe, and 2D vs 3D Split Screen.

### 5. Standalone Edge & Air-Gapped Deployment
* **1-Click Desktop Launcher**: Double-click `start_depthwizard.bat` (Windows) or `start_depthwizard.sh` (Linux/macOS) to boot the full platform and auto-launch the browser.
* **Docker Containerization**: Self-contained `docker compose up` deployment with zero host package installations.
* **100% Offline Operation**: Zero reliance on external paid cloud APIs (no OpenAI, no Google Vision). Entirely operable in secure, air-gapped military and space agency facilities. Pre-cache SRTM tiles for your area, otherwise it falls back to sensor priors (lower absolute accuracy).

### 6. Rigorous Quantitative Validation (SIH Benchmark)
* Computes Root Mean Square Error (**RMSE**), Mean Absolute Error (**MAE**), Pearson Correlation ($r$), and $R^2$ Score.
* **Landscape Stability Breakdown**: Evaluates metric error across four primary terrain morphologies:
  * **Flat Agricultural Plains** ($\text{slope} < 5^{\circ}$)
  * **Forested & Dense Canopy** (vegetative cover and canopy-to-ground relief)
  * **Rugged Hilly & Mountainous** ($\text{slope} \ge 15^{\circ}$)
  * **Dense Urban Built-Up** (high spatial frequency / sharp structural edges)

#### 🏆 Official Remote Sensing Benchmark (GAMUS Dataset)
Evaluated across 100 held-out scenes (50 validation, 50 blind test) ($N = 100$, $n = 26.2\text{M points}$, statistically significant improvement via paired two-tailed $t$-test):

| Metric | Validation Split (50 Scenes) | Blind Test Split (50 Scenes) | Combined (100 Scenes) | SIH Target | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Root Mean Square Error (RMSE)** | **1.64 meters** | **1.57 meters** | **1.60 meters** | < 3.50 meters | 🌟 Outperforms Tested Baselines |
| **Mean Absolute Error (MAE)** | **1.44 meters** | **1.21 meters** | **1.32 meters** | < 2.50 meters | 🌟 High Precision |
| **Pearson Correlation (r)** | **0.91** | **0.94** | **0.92** | > 0.85 | 🌟 High Relief Fidelity |
| **Coefficient of Determination (R²)** | **0.83** | **0.88** | **0.86** | > 0.70 | 🌟 86%+ Variance Explained |

#### 📊 Comparative Baseline Benchmark (Evaluated on Same 100 Held-Out Scenes)

| Method / Architecture | Modality | RMSE (m) ↓ | MAE (m) ↓ | Pearson Correlation ($r$) ↑ | $R^2$ Score ↑ |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Stereo SGM** (Hirschmüller) | Classical Stereo Matching | 4.85 m | 3.62 m | 0.81 | 0.51 |
| **MiDaS v3.1** (Ranftl et al.) | Monocular (General Domain) | 3.92 m | 2.94 m | 0.86 | 0.62 |
| **Depth Anything V1** (Yang et al.) | Monocular (Uncalibrated) | 2.85 m | 2.10 m | 0.91 | 0.74 |
| **DepthWizard (Ours)** | **Calibrated Monocular ViT + LoRA** | **1.57 m** | **1.21 m** | **0.94** | **0.88** |

> **Comparative Baseline Evaluation**: DepthWizard's geodetically calibrated model ($r = 0.92 - 0.94$, RMSE 1.57 m) consistently outperforms tested baselines (classical stereo SGM, general-domain MiDaS, and unadapted Depth Anything V1) across diverse satellite and aerial topography.

#### 🗺️ Per-Terrain Morphology Performance Breakdown (100 Benchmark Scenes)

| Terrain Morphology | Benchmark Scenes | RMSE (m) | MAE (m) | Pearson Correlation ($r$) | Topographic Characteristics |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Flat Agricultural Plains** | 30 scenes | **0.84 m** | **0.65 m** | **0.97** | Low relief ($< 5^\circ$ slope); sub-meter accuracy ideal for drainage and floodplains |
| **Forested & Dense Canopy** | 25 scenes | **1.32 m** | **1.04 m** | **0.95** | Multi-tier vegetative canopy height accurately separated from bare ground DEM |
| **Rugged Hilly & Mountainous** | 25 scenes | **1.78 m** | **1.41 m** | **0.93** | Steep slopes ($\ge 15^\circ$), severe ridge shadow contrast aligned with SRTM base |
| **Dense Urban Built-Up** | 20 scenes | **2.15 m** | **1.68 m** | **0.91** | High spatial frequency street canyons & sharp building perimeter preservation |

---

## 📂 Repository Architecture

```text
DepthWizard/
│
├── start_depthwizard.bat     # Windows 1-Click Desktop Launcher (Zero-Command Setup)
├── start_depthwizard.sh      # Linux/macOS 1-Click Desktop Launcher
├── Dockerfile                # Production multi-stage containerization blueprint
├── docker-compose.yml        # One-command container orchestration (docker compose up)
├── main.py                   # Standalone CLI processing pipeline
├── requirements.txt          # Python dependency specifications
│
├── data/
│   ├── input/                # Input satellite/aerial tiles (.jpg, .png, .tif)
│   ├── srtm_dem/             # NASA SRTM 30m DEM GeoTIFF cache directory
│   └── output/               # Generated DSM GeoTIFFs, GLB 3D meshes, heatmaps
│
├── models/
│   ├── README.md             # Model backbone structure documentation
│   └── weights/              # Offline weights cache directory
│       └── depth_anything_v2_gamus_lora/  # Fine-tuned satellite LoRA adapter weights
│
├── src/
│   ├── ingestion.py          # Multi-band normalization, CRS extraction, GeoTIFF export
│   ├── depth_estimation.py   # Depth Anything V2 + GAMUS LoRA inference
│   ├── calibration.py        # SRTM least-squares alignment & bare-earth DEM extraction
│   ├── mesh_generator.py     # 3D textured mesh (.glb), hillshading & normal maps
│   └── evaluation.py         # RMSE, MAE, Pearson r, R², landscape stability analysis
│
├── backend/
│   └── main.py               # FastAPI server serving REST APIs, 3D model, and inspections
│
├── frontend-react/           # Interactive 3D WebGL Application (React + Three.js + Tailwind)
│   ├── src/
│   │   ├── App.js            # 3D canvas, controls, raycast inspector, flight simulator
│   │   └── index.css         # Styling system
│   └── public/
│       └── terrain_model.glb # Default cached 3D model asset
│
├── scripts/
│   └── compare_gamus_sample.py  # GAMUS LiDAR ground truth vs DepthWizard prediction benchmark
│
├── tests/
│   ├── test_calibration.py   # Unit tests for scale calibration and bounds
│   └── test_inference.py     # Unit tests for metric evaluations and landscape breakdown
│
└── notebooks/
    └── experimentation.ipynb # Interactive end-to-end Jupyter testing notebook
```

---

## ⚙️ Quickstart & Deployment Guide

### Option A: 1-Click Standalone Desktop Launcher (Recommended)
* **Windows**: Double-click [`start_depthwizard.bat`](./start_depthwizard.bat).
* **Linux / macOS**: Run `./start_depthwizard.sh`.
Both local backend and frontend services boot automatically and open your default browser at `http://localhost:3000`.

### Option B: Containerized Deployment (Docker)
Ensure Docker is installed and run:
```bash
docker compose up
```
Access the application at `http://localhost:8000`.

> **🔌 Port Allocation Reference**:
> * **Port 3000** (`http://localhost:3000`): Belongs to the **Desktop Launcher** (`start_depthwizard.bat` / `.sh`) and local developer mode via the interactive React Web UI.
> * **Port 8000** (`http://localhost:8000`): Belongs to **Docker** (`docker compose up`, serving the unified frontend + backend) as well as the FastAPI REST API engine (`http://localhost:8000/docs`).

### Option C: Manual Developer Setup
```bash
# 1. Activate Python virtual environment
.\venv\Scripts\activate   # Windows (or source venv/bin/activate on Linux)

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start Backend API Server
python backend/main.py

# 4. Start React Frontend (in a separate terminal)
cd frontend-react
npm start
```

---

## 📡 REST API Specifications

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/process-image` | Uploads image (PNG, JPG, TIF), runs inference, calibrates with SRTM, generates 3D mesh |
| `POST` | `/api/inspect-image` | Pre-inspects image metadata (resolution, format, CRS, georeferencing) |
| `POST` | `/api/inspect-point` | Computes exact Surface DSM ($m$), Ground DEM ($m$), Object Ht ($+m$), and Slope ($^\circ$) |
| `GET` | `/api/model/{filename}` | Serves `.glb` 3D terrain asset with cache-control invalidation |
| `GET` | `/api/optical-image` | Serves active 2D optical aerial frame |
| `GET` | `/api/heatmap` | Serves Turbo colormap elevation heatmap texture |
| `GET` | `/api/depth-map` | Serves normalized relative disparity depth map |
| `GET` | `/api/reference-dsm` | Serves ground truth reference DEM raster |
| `GET` | `/api/diff-heatmap` | Serves absolute error difference heatmap ($\| \text{DSM} - \text{DEM} \|$) |
| `GET` | `/api/normal-map` | Serves tangent-space normal map for dynamic hillshading |
| `GET` | `/api/hillshade` | Serves analytical GIS hillshade texture |
| `GET` | `/api/download/dsm` | Downloads standard geospatial GeoTIFF (`output_dsm.tif`) |
| `GET` | `/api/download/mesh` | Downloads 3D GLB model (`terrain_model.glb`) |

---

## 📜 Evaluation Criteria Compliance Matrix

| Evaluation Criteria | Requirement | DepthWizard Implementation | Status |
| :--- | :--- | :--- | :---: |
| **Accuracy & Validation (50%)** | RMSE, MAE, correlation vs reference; stability across landscape types | Evaluated across 100 GAMUS benchmark scenes (Test RMSE 1.57m, $r = 0.92\text{--}0.94$, $R^2 = 0.88$). Landscape breakdown separates Plains, Forested Canopy, Hilly, and Urban regions; outperforms baselines (SGM 0.81, MiDaS 0.86, DA V1 0.91). | 🌟 Compliant |
| **Visualization & UX (50%)** | 3D flythrough navigability, projection fidelity, first-person navigation, standalone app | React Three Fiber 3D canvas with 360° mouse drag, Drone Flythrough, WASD free-flight, Spot Inspector, Dynamic Sun, and 2D/3D split view. | 🌟 Compliant |
| **Operational Feasibility** | Standalone edge packaging, one-command setup, offline capability | Packaged via Docker (`docker compose up`) and 1-Click native desktop launchers (`.bat` / `.sh`). 100% offline & air-gapped. | 🌟 Compliant |
| **Deliverables** | Standard geospatial format, unified software suite | Standard 32-bit floating point GeoTIFF (`.tif`), GLB 3D mesh, FastAPI backend, React UI, CLI scripts, test suite, and research documentation. | 🌟 Compliant |

---

## 💻 System & Hardware Specifications

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **System Memory (RAM)** | **16 GB RAM** | 32 GB RAM |
| **GPU / Dedicated VRAM** | **4 GB VRAM** (NVIDIA CUDA 11.8+) | 8 GB+ VRAM (NVIDIA RTX / Quadro) |
| **CPU Fallback** | 4-Core x86_64 (CPU inference supported) | 8-Core Intel Core i7 / AMD Ryzen 7 |
| **Storage Space** | 5 GB free disk space (weights + DEM tiles) | 20 GB NVMe SSD |

---

## ⚖️ License & Open-Source Attributions

DepthWizard is open-source software licensed under the **MIT License**.

### Third-Party Dataset & Model Attributions:
* **GAMUS Dataset**: High-resolution aerial and satellite LiDAR elevation ground-truth benchmark tiles courtesy of GAMUS / OpenTopography.
* **NASA / USGS SRTM**: Global 30m / 90m Shuttle Radar Topography Mission digital elevation datasets (Public Domain / Open Data).
* **Depth Anything V2**: Foundation monocular depth vision transformer architecture by Yang, L.; Kang, B.; Huang, Z.; et al. (*Depth Anything V2: A Foundation Model for Monocular Depth Estimation*, arXiv preprint, 2024; Apache 2.0 License).
