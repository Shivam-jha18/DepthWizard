"""
API Dependency & Environment Configuration for DepthWizard Backend
"""

API_DEPENDENCIES = [
    "fastapi>=0.100.0",
    "uvicorn[standard]>=0.23.0",
    "python-multipart>=0.0.6",
    "pydantic>=2.0.0",
    "numpy>=1.24.0",
    "scipy>=1.10.0",
    "rasterio>=1.3.0",
    "open3d>=0.17.0",
    "trimesh>=4.0.0",
    "torch>=2.0.0",
    "transformers>=4.38.0",
    "pillow>=9.5.0",
    "opencv-python>=4.8.0"
]

def check_dependencies():
    import importlib
    missing = []
    for pkg in ["fastapi", "uvicorn", "rasterio", "open3d", "torch", "transformers"]:
        try:
            importlib.import_module(pkg)
        except ImportError:
            missing.append(pkg)
    return missing

if __name__ == "__main__":
    missing = check_dependencies()
    if not missing:
        print("All backend API dependencies are successfully installed!")
    else:
        print(f"Missing dependencies: {missing}")
