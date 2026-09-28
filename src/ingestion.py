import os
import rasterio
from rasterio.transform import from_bounds
from PIL import Image
import numpy as np

def load_image(file_path):
    """
    Loads an optical satellite image. Supports both GeoTIFF (.tif, .tiff) 
    and standard non-georeferenced formats (.jpg, .jpeg, .png).
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext in ['.tif', '.tiff']:
        with rasterio.open(file_path) as src:
            image_data = src.read()  # Shape: (Channels, Height, Width)
            # Transpose to (Height, Width, Channels)
            image_data = np.transpose(image_data, (1, 2, 0))
            
            # Handle multi-band imagery (e.g. 4-band RGB+NIR) or single-band
            if image_data.shape[2] > 3:
                image_data = image_data[:, :, :3]
            elif image_data.shape[2] == 1:
                image_data = np.repeat(image_data, 3, axis=2)

            # Stretch 16-bit/float satellite data to standard 8-bit RGB (2-98% percentile)
            if image_data.dtype != np.uint8:
                p2, p98 = np.percentile(image_data, (2, 98))
                if p98 - p2 > 1e-4:
                    image_data = np.clip((image_data.astype(np.float32) - p2) / (p98 - p2) * 255.0, 0, 255).astype(np.uint8)
                else:
                    image_data = np.clip(image_data, 0, 255).astype(np.uint8)

            meta = {
                'crs': src.crs,
                'transform': src.transform,
                'bounds': src.bounds,
                'height': image_data.shape[0],
                'width': image_data.shape[1],
                'is_georeferenced': (src.crs is not None)
            }
        print(f"Loaded Georeferenced GeoTIFF. CRS: {meta['crs']}")
        return image_data, meta
        
    elif ext in ['.jpg', '.jpeg', '.png']:
        img = Image.open(file_path).convert('RGB')
        # Resize large images to a maximum of 1024x1024 for faster processing on CPU
        img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        image_data = np.array(img)
        meta = {
            'is_georeferenced': False,
            'crs': None,
            'transform': None,
            'bounds': None,
            'height': image_data.shape[0],
            'width': image_data.shape[1]
        }
        print(f"Loaded Non-Georeferenced Image (PNG/JPG). Resized to: {image_data.shape[1]}x{image_data.shape[0]}")
        return image_data, meta
    else:
        raise ValueError(f"Unsupported file extension: {ext}")

def export_geotiff(dsm_data, output_path, meta=None):
    """
    Exports elevation DSM array as a standard geospatial GeoTIFF raster.
    Conforms to standard geospatial GIS formats (32-bit floating point).
    """
    height, width = dsm_data.shape[:2]
    
    if meta and meta.get('is_georeferenced') and meta.get('crs'):
        crs = meta['crs']
        transform = meta['transform']
    else:
        # Default Cartesian / local metric coordinate reference system for rDSM
        crs = "EPSG:3857" # Web Mercator default projection
        transform = from_bounds(0, 0, width, height, width, height)

    profile = {
        'driver': 'GTiff',
        'dtype': rasterio.float32,
        'count': 1,
        'height': height,
        'width': width,
        'crs': crs,
        'transform': transform,
        'nodata': -9999.0
    }
    
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with rasterio.open(output_path, 'w', **profile) as dst:
        dst.write(dsm_data.astype(np.float32), 1)
        
    print(f"Exported High-Fidelity GeoTIFF DSM to: {output_path}")
    return output_path

if __name__ == "__main__":
    test_path = "data/input/sample.jpg"
    if os.path.exists(test_path):
        img, metadata = load_image(test_path)
        print(f"Image shape: {img.shape}")