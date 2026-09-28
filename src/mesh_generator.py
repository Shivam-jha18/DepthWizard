import os
import numpy as np
import open3d as o3d
import cv2

class MeshGenerator:
    def __init__(self):
        pass

    def generate_elevation_heatmap(self, dsm_map, output_path="data/output/elevation_heatmap.png"):
        """
        Converts elevation DSM map to a vibrant pseudocolor elevation heatmap
        (Turbo colormap: Blue = Low elevation, Green/Yellow = Mid, Red = High peaks).
        """
        # Normalize DSM to 0-255
        d_min, d_max = np.nanmin(dsm_map), np.nanmax(dsm_map)
        if d_max - d_min > 1e-4:
            norm_dsm = ((dsm_map - d_min) / (d_max - d_min) * 255.0).astype(np.uint8)
        else:
            norm_dsm = np.zeros_like(dsm_map, dtype=np.uint8)

        # Apply Turbo / Jet colormap
        heatmap_bgr = cv2.applyColorMap(norm_dsm, cv2.COLORMAP_TURBO)
        heatmap_rgb = cv2.cvtColor(heatmap_bgr, cv2.COLOR_BGR2RGB)
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        cv2.imwrite(output_path, heatmap_bgr)
        print(f"Generated elevation heatmap texture at: {output_path}")
        return heatmap_rgb, output_path

    def generate_depth_visualization(self, rel_depth, output_path="data/output/depth_map.png"):
        """
        Exports a normalized depth map using Inferno colormap for the Depth Map tab.
        """
        d_min, d_max = np.nanmin(rel_depth), np.nanmax(rel_depth)
        if d_max - d_min > 1e-4:
            norm_depth = ((rel_depth - d_min) / (d_max - d_min) * 255.0).astype(np.uint8)
        else:
            norm_depth = (rel_depth * 255.0).astype(np.uint8)
            
        depth_bgr = cv2.applyColorMap(norm_depth, cv2.COLORMAP_INFERNO)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        cv2.imwrite(output_path, depth_bgr)
        return output_path

    def generate_difference_heatmap(self, pred_dsm, ref_dsm, output_path="data/output/diff_heatmap.png"):
        """
        Exports an absolute difference error heatmap (|pred - ref|) with a high-contrast colormap.
        """
        if pred_dsm.shape != ref_dsm.shape:
            ref_dsm = cv2.resize(ref_dsm, (pred_dsm.shape[1], pred_dsm.shape[0]), interpolation=cv2.INTER_LINEAR)
        diff = np.abs(pred_dsm - ref_dsm)
        # Cap visual difference at 5.0m for sharp contrast
        norm_diff = (np.clip(diff / 5.0, 0.0, 1.0) * 255.0).astype(np.uint8)
        diff_bgr = cv2.applyColorMap(norm_diff, cv2.COLORMAP_MAGMA)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        cv2.imwrite(output_path, diff_bgr)
        return output_path

    def generate_normal_map(self, dsm_map, output_path="data/output/normal_map.png", strength=2.5):
        """
        Generates a high-precision tangent-space normal map from DSM elevation
        for dynamic 3D surface hillshading and micro-relief rendering.
        """
        dzdx = cv2.Sobel(dsm_map.astype(np.float32), cv2.CV_32F, 1, 0, ksize=3)
        dzdy = cv2.Sobel(dsm_map.astype(np.float32), cv2.CV_32F, 0, 1, ksize=3)
        norm = np.sqrt((dzdx * strength)**2 + (dzdy * strength)**2 + 1.0)
        nx = (-dzdx * strength) / norm
        ny = (-dzdy * strength) / norm
        nz = 1.0 / norm
        r = ((nx + 1.0) * 0.5 * 255.0).astype(np.uint8)
        g = ((ny + 1.0) * 0.5 * 255.0).astype(np.uint8)
        b = ((nz + 1.0) * 0.5 * 255.0).astype(np.uint8)
        normal_bgr = cv2.merge([b, g, r])
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        cv2.imwrite(output_path, normal_bgr)
        return output_path

    def generate_hillshade(self, dsm_map, output_path="data/output/hillshade.png", azimuth=315.0, altitude=45.0):
        """
        Generates standard GIS analytical hillshade for high-contrast topographic relief.
        """
        dy, dx = np.gradient(dsm_map)
        slope = np.pi / 2.0 - np.arctan(np.sqrt(dx*dx + dy*dy) * 0.1)
        aspect = np.arctan2(-dy, dx)
        az_rad = azimuth * np.pi / 180.0
        alt_rad = altitude * np.pi / 180.0
        shaded = np.sin(alt_rad) * np.sin(slope) + np.cos(alt_rad) * np.cos(slope) * np.cos(az_rad - aspect)
        shaded = np.clip((shaded + 1.0) / 2.0 * 255.0, 0, 255).astype(np.uint8)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        cv2.imwrite(output_path, shaded)
        return output_path

    def create_textured_mesh(self, rgb_image, dsm_map, output_path="data/output/terrain_model.glb", scale_z=1.0):
        """
        Converts an RGB image and a 2D DSM elevation grid into a high-fidelity
        3D textured terrain heightfield mesh (GLB) with pronounced architectural/topographical
        relief, smooth vertex normals, and a solid architectural display plinth.
        """
        import trimesh
        from PIL import Image

        height, width = dsm_map.shape
        print(f"Generating high-fidelity 3D terrain mesh for dimensions: {width}x{height}...")

        # Heightfield grid resolution (360 gives crisp edge contours and ultra-fast 60 FPS Three.js rendering)
        max_dim = 360
        scale = min(1.0, max_dim / max(height, width))
        new_w, new_h = int(width * scale), int(height * scale)

        dsm_resampled = cv2.resize(dsm_map.astype(np.float32), (new_w, new_h), interpolation=cv2.INTER_LINEAR)

        # 1. Subtle Shadow Inversion:
        morph_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        closed = cv2.morphologyEx(dsm_resampled, cv2.MORPH_CLOSE, morph_kernel)
        dsm_resampled = np.maximum(dsm_resampled, closed * 0.96)

        # 2. Edge-Preserving Bilateral Smoothing:
        # Mild filtering keeps roof parapets and mountain ridges crisp while smoothing sensor noise
        dsm_resampled = cv2.bilateralFilter(dsm_resampled, d=5, sigmaColor=2.0, sigmaSpace=2.0)

        # 3. Outer boundary clamp: prevents peripheral edge spikes
        dsm_resampled[0, :] = dsm_resampled[1, :]
        dsm_resampled[-1, :] = dsm_resampled[-2, :]
        dsm_resampled[:, 0] = dsm_resampled[:, 1]
        dsm_resampled[:, -1] = dsm_resampled[:, -2]

        # Calculate horizontal bounds maintaining accurate aspect ratio
        aspect = new_h / new_w
        span_x = 100.0
        span_y = span_x * aspect

        x = np.linspace(-span_x / 2.0, span_x / 2.0, new_w)
        y = np.linspace(span_y / 2.0, -span_y / 2.0, new_h)
        xx, yy = np.meshgrid(x, y)

        # Scale vertical elevation with pronounced 3D relief (20.0 units for clear 3D depth perception)
        elev_min = np.nanmin(dsm_resampled)
        elev_max = np.nanmax(dsm_resampled)
        elev_range = elev_max - elev_min

        if elev_range > 1e-3:
            # Proportional relief height scaled for clear 3D architectural & topographic depth
            # (14.0 to 24.0 units provides pronounced 3D relief without vertical needle distortion)
            relief_height = float(np.clip(elev_range * 0.85, 14.0, 24.0))
            zz = ((dsm_resampled - elev_min) / elev_range) * relief_height * scale_z
        else:
            zz = np.zeros_like(dsm_resampled)

        # Top surface vertices
        top_verts = np.column_stack([xx.ravel(), yy.ravel(), zz.ravel()]).astype(np.float32)

        # Top surface UV coordinates for photographic texture projection
        u = np.linspace(0.0, 1.0, new_w)
        v = np.linspace(1.0, 0.0, new_h)
        uu, vv = np.meshgrid(u, v)
        top_uvs = np.column_stack([uu.ravel(), vv.ravel()]).astype(np.float32)

        # Top surface triangle faces
        indices = np.arange(new_h * new_w).reshape((new_h, new_w))
        i0 = indices[:-1, :-1].ravel()
        i1 = indices[1:, :-1].ravel()
        i2 = indices[:-1, 1:].ravel()
        i3 = indices[1:, 1:].ravel()

        top_faces = np.vstack([
            np.column_stack([i0, i1, i2]),
            np.column_stack([i1, i3, i2])
        ]).astype(np.int32)

        # Optical RGB texture for photographic sharpness
        tex_h, tex_w = rgb_image.shape[:2]
        max_tex = 1024
        if max(tex_h, tex_w) > max_tex:
            scale_t = max_tex / max(tex_h, tex_w)
            tex_rgb = cv2.resize(rgb_image.astype(np.uint8), (int(tex_w * scale_t), int(tex_h * scale_t)), interpolation=cv2.INTER_AREA)
        else:
            tex_rgb = rgb_image.astype(np.uint8)

        tex_img = Image.fromarray(tex_rgb)
        mat_top = trimesh.visual.material.PBRMaterial(
            roughnessFactor=0.68,
            metallicFactor=0.04,
            baseColorTexture=tex_img
        )
        mesh_top = trimesh.Trimesh(
            vertices=top_verts, 
            faces=top_faces, 
            visual=trimesh.visual.TextureVisuals(uv=top_uvs, material=mat_top), 
            process=False
        )
        # Compute smooth vertex normals for dynamic lighting and relief shadows
        mesh_top.vertex_normals

        # 4. Construct Solid Architectural Pedestal (Clean Dark Slate Base)
        top_edge = indices[0, :]
        right_edge = indices[1:, -1]
        bottom_edge = indices[-1, -2::-1]
        left_edge = indices[-2:0:-1, 0]
        boundary = np.concatenate([top_edge, right_edge, bottom_edge, left_edge])

        z_base = float(np.nanmin(zz) - 3.5)
        base_verts = top_verts[boundary].copy()
        base_verts[:, 2] = z_base

        n_bound = len(boundary)
        all_ped_verts = np.vstack([top_verts[boundary], base_verts])

        skirt_faces = []
        for k in range(n_bound):
            next_k = (k + 1) % n_bound
            t1 = k
            t2 = next_k
            b1 = n_bound + k
            b2 = n_bound + next_k
            skirt_faces.append([t1, b1, t2])
            skirt_faces.append([t2, b1, b2])

        # Bottom base cap
        center_base_idx = len(all_ped_verts)
        center_base_vert = np.array([[0.0, 0.0, z_base]], dtype=np.float32)
        all_ped_verts = np.vstack([all_ped_verts, center_base_vert])

        bottom_faces = []
        for k in range(n_bound):
            next_k = (k + 1) % n_bound
            b1 = n_bound + k
            b2 = n_bound + next_k
            bottom_faces.append([center_base_idx, b2, b1])

        ped_faces = np.vstack([
            np.array(skirt_faces, dtype=np.int32), 
            np.array(bottom_faces, dtype=np.int32)
        ])

        # Architectural slate pedestal material
        mat_ped = trimesh.visual.material.PBRMaterial(
            baseColorFactor=[0.09, 0.11, 0.14, 1.0],
            roughnessFactor=0.92,
            metallicFactor=0.08
        )
        mesh_ped = trimesh.Trimesh(vertices=all_ped_verts, faces=ped_faces, process=False)
        mesh_ped.visual.material = mat_ped

        # Combined GLTF scene
        scene = trimesh.Scene([mesh_top, mesh_ped])

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        scene.export(output_path)
        print(f"High-clarity 3D terrain model with architectural pedestal saved to: {output_path}")

        # Also generate normal map and hillshade textures for advanced Three.js rendering
        out_dir = os.path.dirname(output_path)
        self.generate_normal_map(dsm_map, output_path=os.path.join(out_dir, "normal_map.png"))
        self.generate_hillshade(dsm_map, output_path=os.path.join(out_dir, "hillshade.png"))

        return output_path



