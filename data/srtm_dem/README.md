# SRTM 30m DEM Cache Directory

Place downloaded or cached SRTM 30m DEM GeoTIFF files (`.tif`) here.
DepthWizard's `ScaleCalibrator` (`src/calibration.py`) automatically scans this directory to align georeferenced satellite images with ground truth elevation profiles using linear least-squares regression ($H_{abs} = a \cdot D_{rel} + b$).
