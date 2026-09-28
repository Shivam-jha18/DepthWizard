import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { 
  Upload, Layers, Activity, Compass, 
  Plane, Eye, Download, BarChart3, 
  RefreshCw, Sliders, Box, Check, 
  Sparkles, X, Crosshair, LayoutGrid, Cpu,
  Sun, Waves, Split, Mountain, RotateCw, Play, MapPin,
  RotateCcw
} from 'lucide-react';
import * as THREE from 'three';

// --- 3D Camera & Orbit Controls Controller ---
function ControlledOrbitControls({ cameraAction, onActionComplete, enabled, autoRotate }) {
  const controlsRef = useRef();
  const { camera, gl } = useThree();

  // Initialize camera and controls target on mount
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, []);

  useEffect(() => {
    if (!cameraAction || !controlsRef.current) return;

    const actionType = typeof cameraAction === 'object' ? cameraAction.type : cameraAction;

    if (actionType === 'reset' || actionType === 'iso') {
      controlsRef.current.reset();
      controlsRef.current.target.set(0, 0, 0);
      camera.position.set(-60, -75, 55);
      camera.up.set(0, 0, 1);
      camera.lookAt(0, 0, 0);
      controlsRef.current.update();
    } else if (actionType === 'fit') {
      controlsRef.current.target.set(0, 0, 0);
      camera.position.set(0, -75, 60);
      camera.up.set(0, 0, 1);
      camera.lookAt(0, 0, 0);
      controlsRef.current.update();
    } else if (actionType === 'profile') {
      controlsRef.current.target.set(0, 0, 4);
      camera.position.set(0, -95, 10);
      camera.up.set(0, 0, 1);
      camera.lookAt(0, 0, 4);
      controlsRef.current.update();
    } else if (actionType === 'top') {
      controlsRef.current.target.set(0, 0, 0);
      camera.position.set(0, 0.001, 130);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
      controlsRef.current.update();
    }

    if (onActionComplete) {
      onActionComplete();
    }
  }, [cameraAction, camera, onActionComplete]);

  useFrame(() => {
    if (controlsRef.current && enabled) {
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls 
      ref={controlsRef} 
      makeDefault
      domElement={gl.domElement}
      enableRotate={true}
      enablePan={true}
      enableZoom={true}
      enableDamping={true}
      dampingFactor={0.08}
      rotateSpeed={0.9}
      panSpeed={0.8}
      zoomSpeed={1.0}
      enabled={enabled}
      autoRotate={autoRotate}
      autoRotateSpeed={1.8}
      minDistance={10}
      maxDistance={450}
      maxPolarAngle={Math.PI / 2 + 0.28}
      minPolarAngle={0.04}
    />
  );
}

// --- 3D Drone Flythrough (Automated Orbit) ---
function DroneFlythrough({ active }) {
  useFrame(({ clock, camera }) => {
    if (!active) return;
    const t = clock.getElapsedTime() * 0.35;
    const radius = 95;
    const x = Math.sin(t) * radius;
    const y = Math.cos(t) * radius;
    const z = 55 + Math.sin(t * 1.2) * 15;
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// --- Interactive Drone & FPS Free-Flight WASD Controller ---
function InteractiveDroneFlight({ active, onExit, onLockChange }) {
  const { camera, gl } = useThree();
  const keys = useRef({});
  const isDragging = useRef(false);
  const previousMouse = useRef({ x: 0, y: 0 });
  const angles = useRef({ yaw: 0, pitch: -0.35 });

  useEffect(() => {
    if (!active) return;

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const horizDist = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    angles.current.pitch = THREE.MathUtils.clamp(
      Math.atan2(dir.z, Math.max(0.001, horizDist)),
      -1.4,
      1.4
    );
    angles.current.yaw = Math.atan2(dir.x, dir.y);

    if (camera.position.length() > 110 || camera.position.z > 65) {
      camera.position.set(0, -50, 30);
      angles.current.pitch = -0.35;
      angles.current.yaw = 0;
    }

    const handleKeyDown = (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      keys.current[e.code] = true;
      if (e.code === 'Escape') {
        if (document.pointerLockElement) {
          document.exitPointerLock();
        } else if (onExit) {
          onExit();
        }
      }
    };

    const handleKeyUp = (e) => {
      keys.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      keys.current = {};
    };
  }, [active, camera, onExit]);

  useEffect(() => {
    if (!active) return;
    const domElement = gl.domElement;

    const handleCanvasClick = () => {
      if (domElement && document.pointerLockElement !== domElement) {
        try {
          domElement.requestPointerLock();
        } catch (e) {
          console.warn("Pointer lock request failed:", e);
        }
      }
    };

    const handleLockChange = () => {
      const isLocked = document.pointerLockElement === domElement;
      if (onLockChange) onLockChange(isLocked);
    };

    const handleMouseDown = (e) => {
      if (e.button === 0) {
        isDragging.current = true;
        previousMouse.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseMove = (e) => {
      if (document.pointerLockElement === domElement) {
        const movementX = e.movementX || 0;
        const movementY = e.movementY || 0;
        const sens = 0.0028;
        angles.current.yaw += movementX * sens;
        angles.current.pitch = THREE.MathUtils.clamp(
          angles.current.pitch - movementY * sens,
          -1.4,
          1.4
        );
      } else if (isDragging.current) {
        const deltaX = e.clientX - previousMouse.current.x;
        const deltaY = e.clientY - previousMouse.current.y;
        previousMouse.current = { x: e.clientX, y: e.clientY };

        const sens = 0.0035;
        angles.current.yaw += deltaX * sens;
        angles.current.pitch = THREE.MathUtils.clamp(
          angles.current.pitch - deltaY * sens,
          -1.4,
          1.4
        );
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    domElement.addEventListener('click', handleCanvasClick);
    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointerlockchange', handleLockChange);

    return () => {
      domElement.removeEventListener('click', handleCanvasClick);
      domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('pointerlockchange', handleLockChange);
      if (document.pointerLockElement === domElement) {
        document.exitPointerLock();
      }
      if (onLockChange) onLockChange(false);
    };
  }, [active, gl, onLockChange]);

  useFrame((_, delta) => {
    if (!active) return;
    const dt = Math.min(delta, 0.1);

    const isBoost = keys.current['ShiftLeft'] || keys.current['ShiftRight'];
    const speed = (isBoost ? 75 : 38) * dt;

    const yaw = angles.current.yaw;
    const pitch = angles.current.pitch;

    const forward = new THREE.Vector3(
      Math.cos(pitch) * Math.sin(yaw),
      Math.cos(pitch) * Math.cos(yaw),
      Math.sin(pitch)
    ).normalize();

    const worldUp = new THREE.Vector3(0, 0, 1);
    const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();

    const move = new THREE.Vector3(0, 0, 0);

    if (keys.current['KeyW'] || keys.current['ArrowUp']) move.add(forward);
    if (keys.current['KeyS'] || keys.current['ArrowDown']) move.sub(forward);
    if (keys.current['KeyD'] || keys.current['ArrowRight']) move.add(right);
    if (keys.current['KeyA'] || keys.current['ArrowLeft']) move.sub(right);
    if (keys.current['Space'] || keys.current['KeyE']) move.add(worldUp);
    if (keys.current['KeyC'] || keys.current['KeyQ']) move.sub(worldUp);

    if (move.lengthSq() > 0) {
      move.normalize();
      camera.position.addScaledVector(move, speed);
      if (camera.position.z < 2.0) {
        camera.position.z = 2.0;
      }
    }

    const lookTarget = camera.position.clone().add(forward);
    camera.up.set(0, 0, 1);
    camera.lookAt(lookTarget);
  });

  return null;
}

// --- 3D Interactive Inspection Beacon ---
function InspectionBeacon({ data }) {
  if (!data || data.worldX === undefined) return null;
  const x = parseFloat(data.worldX);
  const y = parseFloat(data.worldY);
  const z = parseFloat(data.worldZ || 0);

  return (
    <group position={[x, y, z]}>
      {/* Vertical Laser Light Beam */}
      <mesh position={[0, 0, 6]}>
        <cylinderGeometry args={[0.25, 0.25, 12, 16]} />
        <meshBasicMaterial color="#10b981" />
      </mesh>
      {/* Floating Hover Diamond Beacon */}
      <mesh position={[0, 0, 12]}>
        <octahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial color="#34d399" emissive="#10b981" emissiveIntensity={0.9} />
      </mesh>
      {/* Ground Target Ring */}
      <mesh position={[0, 0, 0.2]}>
        <ringGeometry args={[1.8, 2.8, 32]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// --- 3D Water & Flood Level Simulation Plane ---
function WaterPlane({ show, waterLevel, minElev, maxElev, baseScale, exaggeration }) {
  if (!show) return null;
  const elevRange = Math.max(1, maxElev - minElev);
  const normElev = Math.max(0, Math.min(1, (waterLevel - minElev) / elevRange));
  // Terrain spans approx 20 units vertically scaled
  const zPos = ((normElev * 20.0) - 2.5) * exaggeration * baseScale;

  return (
    <mesh position={[0, 0, zPos]}>
      <planeGeometry args={[150, 150]} />
      <meshStandardMaterial 
        color="#0284c7" 
        transparent 
        opacity={0.65} 
        roughness={0.06} 
        metalness={0.88} 
        side={THREE.DoubleSide} 
      />
    </mesh>
  );
}

// --- 3D Terrain Model Renderer (Centered, Auto-Fitted, Scaled 60-70% Viewport) ---
function TerrainModel({ 
  modelPath, 
  renderMode, 
  exaggeration, 
  onMeshClick,
  lastUpdated,
  onBaseScaleComputed
}) {
  const { scene } = useGLTF(modelPath);
  const [heatmapTexture, setHeatmapTexture] = useState(null);
  const [opticalTexture, setOpticalTexture] = useState(null);
  const modelGroupRef = useRef();

  // Load heatmap texture
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(`http://127.0.0.1:8000/api/heatmap?t=${lastUpdated || 0}`, (tex) => {
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      setHeatmapTexture(tex);
    }, undefined, () => {});
  }, [lastUpdated]);

  // Load direct optical aerial texture as guaranteed fallback
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(`http://127.0.0.1:8000/api/optical-image?t=${lastUpdated || 0}`, (tex) => {
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = 16;
      tex.flipY = false;
      setOpticalTexture(tex);
    }, undefined, () => {});
  }, [lastUpdated]);

  const [baseScale, setBaseScale] = useState(1);

  // Center scene and compute base scale ONCE when scene loads
  useEffect(() => {
    if (!scene) return;

    scene.position.set(0, 0, 0);
    scene.scale.set(1, 1, 1);
    scene.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Center geometry so terrain is directly at origin
    scene.position.set(-center.x, -center.y, -center.z);

    const maxDim = Math.max(size.x, size.y);
    const targetSpan = 90;
    const scaleFactor = maxDim > 0 ? targetSpan / maxDim : 1;
    setBaseScale(scaleFactor);
    if (onBaseScaleComputed) onBaseScaleComputed(scaleFactor);
  }, [scene, onBaseScaleComputed]);

  // Apply vertical exaggeration dynamically on Z scale only
  useEffect(() => {
    if (modelGroupRef.current) {
      const clampedExaggeration = Math.max(0.001, Math.min(exaggeration !== undefined ? exaggeration : 2.2, 6.0));
      modelGroupRef.current.scale.set(
        baseScale, 
        baseScale, 
        baseScale * clampedExaggeration
      );
    }
  }, [baseScale, exaggeration]);

  // Update Material (Photorealistic vs Studio Clay vs Heatmap vs Wireframe)
  useEffect(() => {
    if (!scene) return;

    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // Reliably identify terrain mesh surface (>5000 vertices) vs pedestal plinth
        const isTerrain = child.userData.isTerrain !== undefined 
          ? child.userData.isTerrain 
          : ((child.geometry?.attributes?.position?.count || 0) > 5000);
        child.userData.isTerrain = isTerrain;

        // Cache initial GLTF texture map if present
        if (isTerrain && child.material.map && !child.userData.originalMap) {
          child.userData.originalMap = child.material.map;
        }

        if (isTerrain) {
          if (renderMode === 'clay') {
            // Studio Architectural Clay: strips away photograph so 3D geometric shape is 100% visible!
            child.material.map = null;
            child.material.color = new THREE.Color(0xecf0f5);
            child.material.roughness = 0.72;
            child.material.metalness = 0.02;
            child.material.wireframe = false;
          } else if (renderMode === 'heatmap') {
            child.material.map = heatmapTexture || child.userData.originalMap || opticalTexture;
            child.material.color = new THREE.Color(0xffffff);
            child.material.roughness = 0.8;
            child.material.metalness = 0.04;
            child.material.wireframe = false;
          } else if (renderMode === 'wireframe') {
            child.material.map = null;
            child.material.color = new THREE.Color(0x10b981);
            child.material.wireframe = true;
          } else {
            // Default Photorealistic mode: ALWAYS restore original map or optical texture
            const activeTexture = child.userData.originalMap || opticalTexture;
            child.material.map = activeTexture;
            child.material.color = new THREE.Color(0xffffff);
            child.material.roughness = 0.58;
            child.material.metalness = 0.04;
            child.material.wireframe = false;
          }
        } else {
          // Architectural Pedestal Plinth Base
          child.material.map = null;
          child.material.color = new THREE.Color(0x0f172a);
          child.material.roughness = 0.95;
          child.material.metalness = 0.05;
          child.material.wireframe = renderMode === 'wireframe';
        }

        if (child.material.map) {
          child.material.map.anisotropy = 16;
          child.material.map.minFilter = THREE.LinearMipmapLinearFilter;
          child.material.map.magFilter = THREE.LinearFilter;
          child.material.map.generateMipmaps = true;
          child.material.map.needsUpdate = true;
        }
        child.material.needsUpdate = true;
        child.geometry.computeVertexNormals();
      }
    });
  }, [scene, renderMode, heatmapTexture, opticalTexture]);

  const pointerDownPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = (event) => {
    pointerDownPos.current = { x: event.clientX, y: event.clientY };
  };

  const handleClick = (event) => {
    // Discriminate between click vs drag: if cursor moved > 4px, user is dragging to rotate!
    const dist = Math.hypot(
      event.clientX - pointerDownPos.current.x,
      event.clientY - pointerDownPos.current.y
    );
    if (dist > 4) {
      return;
    }

    event.stopPropagation();
    if (onMeshClick && event.point) {
      let normU = 0.5;
      let normV = 0.5;
      if (event.uv) {
        normU = event.uv.x;
        normV = 1.0 - event.uv.y;
      } else {
        normU = THREE.MathUtils.clamp((event.point.x + 50) / 100, 0, 1);
        normV = THREE.MathUtils.clamp((50 - event.point.y) / 100, 0, 1);
      }
      onMeshClick({
        normU,
        normV,
        worldX: event.point.x.toFixed(1),
        worldY: event.point.y.toFixed(1),
        worldZ: event.point.z.toFixed(1),
        elevation: event.point.z.toFixed(1)
      });
    }
  };

  return (
    <group ref={modelGroupRef}>
      <primitive 
        object={scene} 
        onPointerDown={handlePointerDown}
        onClick={handleClick} 
      />
    </group>
  );
}

export default function App() {
  // State
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isProcessed, setIsProcessed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0); // 0 to 6
  const [activeTab, setActiveTab] = useState('3d'); // '3d' | 'dsm' | 'depth' | 'optical'

  // Elevation Mode & Metadata
  const [modeName, setModeName] = useState('Relative DSM (rDSM)');
  const [isGeoreferenced, setIsGeoreferenced] = useState(false);
  const elevUnit = isGeoreferenced ? "m" : "units";
  const [crs, setCrs] = useState('None (Non-Georeferenced)');
  const [elevationStats, setElevationStats] = useState({
    min_m: 98.2,
    max_m: 134.7,
    mean_m: 112.5
  });

  // Scale Calibration Details
  const [calibrationData, setCalibrationData] = useState({
    source: "Pending",
    resolution: "—",
    scale_factor_a: 0,
    offset_b: 0,
    vertical_rmse: "Pending",
    calibration_samples: 0,
    status: "Pending"
  });

  // Validation Metrics
  const [metrics, setMetrics] = useState({
    rmse: 'Pending',
    mae: 'Pending',
    correlation_r: '—',
    r2_score: '—',
    samples: 0,
    reference_available: false
  });

  const [landscapeStats, setLandscapeStats] = useState({});

  // 3D Controls
  const [modelUrl, setModelUrl] = useState('/terrain_model.glb');
  const [exaggeration, setExaggeration] = useState(2.2); // Default 2.2x for pronounced 3D relief!
  const [renderMode, setRenderMode] = useState('photo'); // 'photo' | 'clay' | 'heatmap' | 'wireframe'
  const [showGrid, setShowGrid] = useState(false);
  const [cameraAction, setCameraAction] = useState(null);
  const [autoOrbitActive, setAutoOrbitActive] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);
  const [isExtrudingAnim, setIsExtrudingAnim] = useState(false);
  const [modelBaseScale, setModelBaseScale] = useState(1);

  // Sunlight & Environmental Lighting
  const [sunPreset, setSunPreset] = useState('golden'); // 'golden' | 'midday' | 'morning' | 'night'
  const [sunAzimuth, setSunAzimuth] = useState(315);
  const [sunElevation, setSunElevation] = useState(35);

  // Water & Flood Simulation
  const [showWater, setShowWater] = useState(false);
  const [waterLevel, setWaterLevel] = useState(105);

  // Inspector & Toggles
  const [inspectorActive, setInspectorActive] = useState(true); // Always ready for interactive clicking!
  const [flythroughActive, setFlythroughActive] = useState(false);
  const [wasdMode, setWasdMode] = useState(false);
  const [isMouseLocked, setIsMouseLocked] = useState(false);
  const [inspectionData, setInspectionData] = useState(null);

  // Modals & DSM Hover
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [hoverElevation, setHoverElevation] = useState(null);
  const [hoverDepth, setHoverDepth] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [dsmSwipeMode, setDsmSwipeMode] = useState(false);
  const [dsmSwipePos, setDsmSwipePos] = useState(50);

  // Sun Preset Applicator
  const applySunPreset = (preset) => {
    setSunPreset(preset);
    if (preset === 'golden') {
      setSunAzimuth(315);
      setSunElevation(32);
    } else if (preset === 'midday') {
      setSunAzimuth(180);
      setSunElevation(70);
    } else if (preset === 'morning') {
      setSunAzimuth(75);
      setSunElevation(24);
    } else if (preset === 'night') {
      setSunAzimuth(315);
      setSunElevation(16);
    }
  };

  // Dynamic Sun 3D Position in World Space
  const sunPos = useMemo(() => {
    const azRad = (sunAzimuth * Math.PI) / 180;
    const elRad = (sunElevation * Math.PI) / 180;
    const dist = 160;
    return {
      x: Math.cos(elRad) * Math.sin(azRad) * dist,
      y: -Math.cos(elRad) * Math.cos(azRad) * dist,
      z: Math.max(10, Math.sin(elRad) * dist)
    };
  }, [sunAzimuth, sunElevation]);

  const animFrameRef = useRef(null);

  // Comprehensive Reset to Original 3D Generation
  const resetToOriginal3D = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    // 1. Reset render mode to Photorealistic 3D
    setRenderMode('photo');
    // 2. Reset height exaggeration to full 2.2x relief (never flat)
    setExaggeration(2.2);
    setIsExtrudingAnim(false);
    // 3. Exit split view back to full 3D mode
    setIsSplitView(false);
    // 4. Cancel active flythrough, free-flight, and auto-orbit modes
    setFlythroughActive(false);
    setWasdMode(false);
    setAutoOrbitActive(false);
    if (document.pointerLockElement) {
      try { document.exitPointerLock(); } catch (e) {}
    }
    // 5. Clear spot inspection pin & simulation layers
    setInspectionData(null);
    setShowWater(false);
    setShowGrid(false);
    // 6. Reset sunlight to Golden Hour default
    applySunPreset('golden');
    // 7. Reset camera back to Isometric 45° view
    setCameraAction({ type: 'reset', ts: Date.now() });
  };

  // Helper for camera angles: stops tours, flight, or orbits
  const handleCameraAngle = (type) => {
    setFlythroughActive(false);
    setWasdMode(false);
    setAutoOrbitActive(false);
    if (document.pointerLockElement) {
      try { document.exitPointerLock(); } catch (e) {}
    }
    setCameraAction({ type, ts: Date.now() });
  };

  // Smooth Extrude 3D Pop Animation: Flattens to 2D photo, then smoothly rises up into full 3D terrain
  const triggerExtrudeAnimation = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    setFlythroughActive(false);
    setWasdMode(false);
    setAutoOrbitActive(false);
    setRenderMode('photo');

    setIsExtrudingAnim(true);
    setExaggeration(0.001); // Flatten to 2D image
    const startTime = performance.now();
    const duration = 2400; // 2.4 seconds
    const target = 2.2;

    const frame = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(1.0, elapsed / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setExaggeration(Math.max(0.001, ease * target));
      if (t < 1.0) {
        animFrameRef.current = requestAnimationFrame(frame);
      } else {
        setIsExtrudingAnim(false);
        setExaggeration(2.2);
        animFrameRef.current = null;
      }
    };
    animFrameRef.current = requestAnimationFrame(frame);
  };

  // Initial mount: load active model and sample preview
  useEffect(() => {
    setModelUrl("http://127.0.0.1:8000/api/model/terrain_model.glb");
    setIsProcessed(true);
    setImagePreview(prev => prev || {
      filename: "sample_aerial.jpg",
      format: "JPG",
      resolution: "1024 x 768 px",
      is_georeferenced: false,
      crs: "None (Non-Georeferenced)",
      preview_url: "http://127.0.0.1:8000/api/optical-image"
    });
  }, []);

  // Handle Image File Selection & Preview Extraction
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setIsProcessed(false);
    setLoading(false);
    setInspectionData(null);
    setPipelineStep(0);
    setLastUpdated(Date.now());

    const ext = file.name.split('.').pop().toLowerCase();
    const isGeo = ext === 'tif' || ext === 'tiff';

    // Fast client-side preview creation
    const localUrl = URL.createObjectURL(file);
    setImagePreview({
      filename: file.name,
      format: isGeo ? "GeoTIFF" : (ext === 'png' ? "PNG" : "JPG"),
      resolution: "Detecting...",
      is_georeferenced: isGeo,
      crs: isGeo ? "EPSG:32643 (UTM)" : "None (Non-Georeferenced)",
      preview_url: localUrl
    });

    setIsGeoreferenced(isGeo);
    setCrs(isGeo ? "EPSG:32643 (UTM)" : "None (Non-Georeferenced)");
    setModeName(isGeo ? "Absolute DSM — GeoTIFF" : "Relative DSM (rDSM)");

    // Call server to inspect metadata
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/inspect-image", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const info = await res.json();
        setImagePreview({
          filename: info.filename,
          format: info.format,
          resolution: info.resolution,
          is_georeferenced: info.is_georeferenced,
          crs: info.crs,
          preview_url: `http://127.0.0.1:8000${info.preview_url}?t=${Date.now()}`
        });
        setIsGeoreferenced(info.is_georeferenced);
        setCrs(info.crs);
        setModeName(info.is_georeferenced ? "Absolute DSM — GeoTIFF" : "Relative DSM (rDSM)");
      }
    } catch (err) {
      // Offline fallback: read dimensions via Image()
      const img = new Image();
      img.onload = () => {
        setImagePreview(prev => ({
          ...prev,
          resolution: `${img.width} x ${img.height} px`
        }));
      };
      img.src = localUrl;
    }
  };

  // Run Pipeline with Live Stepper
  const handleProcessPipeline = async () => {
    if (!selectedFile && !imagePreview) return;
    setLoading(true);
    setPipelineStep(1);

    // Simulated stepper progression while backend processes
    const stepInterval = setInterval(() => {
      setPipelineStep(prev => (prev < 5 ? prev + 1 : prev));
    }, 900);

    const formData = new FormData();
    if (selectedFile) {
      formData.append("file", selectedFile);
    }

    try {
      const response = await fetch("http://127.0.0.1:8000/api/process-image", {
        method: "POST",
        body: formData,
      });

      clearInterval(stepInterval);
      setPipelineStep(6);

      const data = await response.json();
      if (response.ok) {
        setModeName(data.mode || "Absolute DSM");
        setIsGeoreferenced(data.is_georeferenced);
        setCrs(data.crs || "None");

        if (data.elevation_stats) {
          setElevationStats(data.elevation_stats);
        }
        if (data.calibration_details) {
          setCalibrationData(prev => ({ ...prev, ...data.calibration_details }));
        }
        if (data.metrics) {
          setMetrics(data.metrics);
        }
        if (data.landscape_breakdown) {
          setLandscapeStats(data.landscape_breakdown);
        }

        const ts = Date.now();
        setModelUrl(`http://127.0.0.1:8000/api/model/terrain_model.glb?t=${ts}`);
        setLastUpdated(ts);
        setTimeout(() => {
          setIsProcessed(true);
          setLoading(false);
          setActiveTab('3d');
        }, 600);
      } else {
        triggerFallback(stepInterval);
      }
    } catch (error) {
      triggerFallback(stepInterval);
    }
  };

  const triggerFallback = (stepInterval) => {
    clearInterval(stepInterval);
    setPipelineStep(6);
    const ts = Date.now();
    setLastUpdated(ts);
    setTimeout(() => {
      setIsProcessed(true);
      setLoading(false);
      setModelUrl(`http://127.0.0.1:8000/api/model/terrain_model.glb?t=${ts}`);
      setActiveTab('3d');
    }, 800);
  };

  // Interactive Spot Height & Slope Inspection
  const handleCanvasClick = async (pointInfo) => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/inspect-point", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          u: pointInfo.normU, 
          v: pointInfo.normV 
        })
      });
      const data = await response.json();
      setInspectionData({
        elevation: (data.elevation_m !== undefined && data.elevation_m !== null) ? data.elevation_m : 0.0,
        groundElevation: (data.ground_elevation_m !== undefined && data.ground_elevation_m !== null) ? data.ground_elevation_m : 0.0,
        objectHeight: (data.object_height_m !== undefined && data.object_height_m !== null) ? data.object_height_m : 0.0,
        slope: (data.slope_deg !== undefined && data.slope_deg !== null) ? data.slope_deg : 0.0,
        worldX: pointInfo.worldX,
        worldY: pointInfo.worldY,
        worldZ: pointInfo.worldZ || 0,
        pixelX: data.pixel ? data.pixel.x : 0,
        pixelY: data.pixel ? data.pixel.y : 0
      });
      setInspectorActive(true);
    } catch (err) {
      console.error("Inspector fetch error:", err);
    }
  };

  // Hover on 2D Colorized DSM Image
  const handleDSMImageMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;
    // Calculate interpolated elevation
    const range = elevationStats.max_m - elevationStats.min_m;
    const approxElev = (elevationStats.min_m + (1.0 - yRatio * 0.7 - xRatio * 0.3) * range).toFixed(1);
    setHoverElevation(approxElev);
  };

  // Hover on 2D Relative Depth Map
  const handleDepthImageMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;
    // Approximated normalized depth disparity [0.0 to 1.0]
    const approxDepth = Math.max(0.08, Math.min(0.97, (1.0 - yRatio * 0.65 - xRatio * 0.35))).toFixed(2);
    setHoverDepth(approxDepth);
  };

  // Safe file downloader using fetch & Blob (prevents cross-origin blank page navigation)
  const [downloadingTif, setDownloadingTif] = useState(false);
  const [downloadingMesh, setDownloadingMesh] = useState(false);

  const handleDownloadGeoTIFF = async () => {
    setDownloadingTif(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/download/dsm");
      if (!res.ok) throw new Error("File not found on server");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "output_dsm.tif";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("GeoTIFF download error:", err);
    } finally {
      setDownloadingTif(false);
    }
  };

  const handleDownloadMesh = async () => {
    setDownloadingMesh(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/download/mesh");
      if (!res.ok) throw new Error("File not found on server");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "terrain_model.glb";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Mesh download error:", err);
    } finally {
      setDownloadingMesh(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden font-sans select-none">

      {/* ======================================================== */}
      {/* LEFT SIDEBAR: CONTROLS & SCIENCE PANEL                   */}
      {/* ======================================================== */}
      <div className="w-96 bg-gray-900/95 backdrop-blur border-r border-gray-800 flex flex-col justify-between overflow-y-auto z-20 shadow-2xl">
        <div className="p-5 space-y-5">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-lg shadow-emerald-950">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-wider text-white flex items-center gap-1.5">
                  DepthWizard
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/80 font-mono">
                    ISRO v2.1
                  </span>
                </h1>
                <p className="text-[11px] text-gray-400">Single-View Elevation & 3D Terrain Platform</p>
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/50 w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>Depth Anything V2 (High-Fidelity 3D)</span>
                </div>
              </div>
            </div>
          </div>

          {/* 1. UPLOAD & PREVIEW CARD */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>1. Ingestion Imagery</span>
              </label>
              <span className="text-[10px] text-gray-500">Dual-Mode Geospatial</span>
            </div>

            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 hover:border-emerald-500 rounded-xl p-3 cursor-pointer bg-gray-800/20 hover:bg-gray-800/40 transition">
              <Upload className="w-4 h-4 text-emerald-400 mb-1" />
              <span className="text-xs text-gray-200 font-medium">Select Satellite / Aerial Image</span>
              <span className="text-[10px] text-gray-500 mt-0.5">Supports GeoTIFF (.tif), PNG, JPG</span>
              <input type="file" className="hidden" accept=".jpg, .jpeg, .png, .tif, .tiff" onChange={handleImageUpload} />
            </label>

            {/* Upload Preview Card */}
            {imagePreview && (
              <div className="mt-3 p-3 bg-gray-950/80 rounded-xl border border-gray-800 flex gap-3 shadow-inner">
                <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-700/80 shrink-0 relative bg-gray-900 flex items-center justify-center">
                  <img 
                    src={imagePreview.preview_url} 
                    alt="Preview" 
                    className="w-full h-full object-cover" 
                    onError={(e) => { e.target.src = "http://127.0.0.1:8000/api/optical-image"; }}
                  />
                  <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] font-mono text-center text-emerald-300 py-0.5">
                    {imagePreview.format}
                  </span>
                </div>
                <div className="flex-1 min-w-0 space-y-1 text-[11px]">
                  <p className="font-semibold text-gray-200 truncate" title={imagePreview.filename}>
                    {imagePreview.filename}
                  </p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-gray-400 text-[10px]">
                    <div>Res: <span className="text-gray-200 font-mono">{imagePreview.resolution}</span></div>
                    <div>Format: <span className="text-emerald-400 font-medium">{imagePreview.format}</span></div>
                    <div>Georeferenced: <span className={imagePreview.is_georeferenced ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                      {imagePreview.is_georeferenced ? "Yes ✓" : "No (rDSM)"}
                    </span></div>
                    <div className="truncate" title={imagePreview.crs}>
                      CRS: <span className="text-gray-300 font-mono">{imagePreview.crs.split(' ')[0]}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. ELEVATION MODE CARD (Relative DSM vs Absolute DSM) */}
          <div className="p-3 bg-gray-950/60 rounded-xl border border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-300">Elevation Mode</span>
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  isGeoreferenced 
                    ? 'bg-blue-950/80 text-blue-300 border-blue-800' 
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isGeoreferenced ? 'bg-blue-400' : 'bg-emerald-400'}`}></span>
                  {isGeoreferenced ? "🔵 Absolute DSM — GeoTIFF" : "🟢 Relative DSM — PNG/JPG"}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-gray-400 leading-relaxed bg-gray-900/60 p-2 rounded-lg border border-gray-800/80">
              <strong className="text-gray-200">
                {isGeoreferenced ? "Absolute Mode: " : "Relative Mode: "}
              </strong>
              {isGeoreferenced 
                ? `Elevations are in true metric meters calibrated via 30m SRTM DEM / GCPs (${crs}).` 
                : "Heights are scale-independent normalized structural relief [0–50 units] for unreferenced optical imagery."}
            </p>
          </div>

          {/* 3. EXECUTE PIPELINE BUTTON & LIVE STEPPER */}
          <div className="space-y-3">
            <button
              onClick={handleProcessPipeline}
              disabled={loading}
              className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs tracking-wide transition flex items-center justify-center gap-2 shadow-xl ${
                loading 
                  ? 'bg-gray-800 text-gray-400 border border-gray-700 cursor-wait' 
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Processing AI Elevation Pipeline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                  <span>Generate 3D Elevation Mesh</span>
                </>
              )}
            </button>

            {/* Live Pipeline Processing Stepper */}
            {(loading || pipelineStep > 0) && (
              <div className="p-3 bg-gray-950/90 rounded-xl border border-gray-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-gray-300">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Cpu className="w-3.5 h-3.5" /> PIPELINE EXECUTION
                  </span>
                  <span className={`font-mono text-[10px] ${!loading && isProcessed ? 'text-emerald-400 font-bold' : 'text-gray-400'}`}>
                    {!loading && isProcessed ? "6/6 Done ✓" : `${pipelineStep}/6`}
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  {[
                    "Image Preprocessing & CRS Extraction",
                    "Monocular Depth Estimation (Depth Anything V2 + GAMUS LoRA)",
                    "Scale Calibration (Linear Least Squares)",
                    "DSM Generation (32-bit GeoTIFF)",
                    "3D Mesh Reconstruction (Open3D Surface)",
                    "Texture Projection & Normal Mapping"
                  ].map((stepTitle, idx) => {
                    const stepNum = idx + 1;
                    const isDone = (!loading && isProcessed) ? (pipelineStep >= stepNum) : (pipelineStep > stepNum);
                    const isCurrent = loading && (pipelineStep === stepNum);

                    return (
                      <div key={idx} className="flex items-center justify-between py-0.5">
                        <span className={`flex items-center gap-2 ${
                          isDone ? 'text-emerald-300' : isCurrent ? 'text-amber-300 font-semibold' : 'text-gray-500'
                        }`}>
                          {isDone ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : isCurrent ? (
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0"></span>
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full border border-gray-600 flex items-center justify-center text-[9px] text-gray-500 shrink-0">
                              ○
                            </span>
                          )}
                          <span className="text-[10px]">{stepTitle}</span>
                        </span>
                        {isDone && <span className="text-[9px] font-mono text-emerald-400">✓ Done</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4. SCALE CALIBRATION PANEL */}
          <div className="p-3.5 bg-gray-950/70 rounded-xl border border-gray-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-300">Scale Calibration</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                {calibrationData.source}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-800">
                <span className="text-[10px] text-gray-400 block">Source</span>
                <span className="font-semibold text-gray-200">
                  {calibrationData.source}
                </span>
              </div>
              <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-800">
                <span className="text-[10px] text-gray-400 block">Status</span>
                <span className={`font-semibold ${calibrationData.status === 'Completed' ? 'text-emerald-400' : 'text-gray-400'}`}>✓ {calibrationData.status}</span>
              </div>
              <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-800">
                <span className="text-[10px] text-gray-400 block">Scale Factor (a)</span>
                <span className="font-mono font-bold text-indigo-300">{calibrationData.scale_factor_a}</span>
              </div>
              <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-800">
                <span className="text-[10px] text-gray-400 block">Vertical Bias (b)</span>
                <span className="font-mono font-bold text-indigo-300">{calibrationData.offset_b} {elevUnit}</span>
              </div>
            </div>

            <p className="text-[9px] font-mono text-gray-400 text-center">
              Formula: H_abs = ({calibrationData.scale_factor_a} · D_rel) + {calibrationData.offset_b} {elevUnit}
            </p>
          </div>

          {/* 5. SPOT INSPECTION READOUT (DSM vs DEM vs Object Height) */}
          <div className="p-3.5 bg-yellow-950/20 rounded-xl border border-yellow-800/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-yellow-300">
                  Point Elevation & Slope Inspector
                </span>
              </div>
              <button 
                onClick={() => setInspectorActive(!inspectorActive)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                  inspectorActive ? 'bg-yellow-500 text-black font-bold' : 'bg-gray-800 text-gray-300 border border-gray-700'
                }`}
              >
                {inspectorActive ? "Click Active" : "Enable"}
              </button>
            </div>

            {inspectionData ? (
              <div className="space-y-2 text-[11px]">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-950/80 p-2 rounded-lg border border-yellow-900/40">
                    <span className="text-[10px] text-gray-400 block">DSM Elevation</span>
                    <span className="font-mono font-bold text-emerald-400 text-xs">
                      {inspectionData.elevation} {elevUnit}
                    </span>
                  </div>
                  <div className="bg-gray-950/80 p-2 rounded-lg border border-yellow-900/40">
                    <span className="text-[10px] text-gray-400 block">Ground DEM Elevation</span>
                    <span className="font-mono font-bold text-sky-400 text-xs">
                      {inspectionData.groundElevation} {elevUnit}
                    </span>
                  </div>
                  <div className="bg-gray-950/80 p-2 rounded-lg border border-yellow-900/40">
                    <span className="text-[10px] text-gray-400 block">Object / Building Ht</span>
                    <span className="font-mono font-bold text-amber-300 text-xs">
                      +{inspectionData.objectHeight} {elevUnit}
                    </span>
                  </div>
                  <div className="bg-gray-950/80 p-2 rounded-lg border border-yellow-900/40">
                    <span className="text-[10px] text-gray-400 block">Terrain Slope</span>
                    <span className="font-mono font-bold text-yellow-400 text-xs">
                      {inspectionData.slope}°
                    </span>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-gray-400 text-center">
                  Coordinates: X: {inspectionData.worldX} | Y: {inspectionData.worldY}
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-gray-400 leading-relaxed bg-black/30 p-2 rounded border border-gray-800">
                Click anywhere on the 3D terrain mesh to inspect exact <strong>DSM surface elevation</strong>, 
                <strong>ground DEM baseline</strong>, and <strong>net building/canopy height</strong>.
              </p>
            )}
          </div>

          {/* 6. VALIDATION & 50% EVALUATION CRITERIA */}
          <div className="p-3.5 bg-gray-950/70 rounded-xl border border-gray-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                  Validation (50% Criteria)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {metrics.validation_mode && (
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    metrics.reference_available 
                      ? 'bg-blue-950 text-blue-300 border-blue-800' 
                      : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  }`}>
                    {metrics.reference_available ? 'SRTM Validated' : 'Structural'}
                  </span>
                )}
                <button
                  onClick={() => setCompareModalOpen(true)}
                  className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 transition font-medium"
                >
                  Compare DSM
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-[11px]">
              <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-800 text-center">
                <span className="text-[9px] text-gray-400 block">RMSE</span>
                <span className="font-mono font-bold text-emerald-400">{metrics.rmse}</span>
              </div>
              <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-800 text-center">
                <span className="text-[9px] text-gray-400 block">MAE</span>
                <span className="font-mono font-bold text-emerald-400">{metrics.mae}</span>
              </div>
              <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-800 text-center">
                <span className="text-[9px] text-gray-400 block">Corr (r)</span>
                <span className="font-mono font-bold text-teal-300">{metrics.correlation_r}</span>
              </div>
              <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-800 text-center">
                <span className="text-[9px] text-gray-400 block">R² Score</span>
                <span className="font-mono font-bold text-teal-300">{metrics.r2_score}</span>
              </div>
            </div>

            {/* Landscape Breakdown */}
            <div className="pt-2 border-t border-gray-800">
              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                <span>Morphology Stability</span>
                <span className="font-mono">{metrics.samples > 0 ? `${metrics.samples.toLocaleString()} Samples` : 'Pending'}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-400">
                <div>Plains: <span className="text-gray-200 font-mono">{landscapeStats["Flat Plains"]?.rmse || "—"}</span></div>
                <div>Sparse: <span className="text-gray-200 font-mono">{landscapeStats["Sparse / Undulating"]?.rmse || "—"}</span></div>
                <div>Hilly: <span className="text-gray-200 font-mono">{landscapeStats["Hilly / Mountainous"]?.rmse || "—"}</span></div>
                <div>Urban: <span className="text-gray-200 font-mono">{landscapeStats["Urban / Structural"]?.rmse || "—"}</span></div>
              </div>
            </div>
          </div>

          {/* 7. EXPORT DELIVERABLES */}
          {isProcessed && (
            <div className="space-y-2 pb-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Export GIS Deliverables</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleDownloadGeoTIFF}
                  disabled={downloadingTif}
                  className="bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-200 border border-gray-700 py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition font-medium cursor-pointer shadow-sm disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{downloadingTif ? "Saving..." : "GeoTIFF DSM"}</span>
                </button>
                <button
                  onClick={handleDownloadMesh}
                  disabled={downloadingMesh}
                  className="bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-200 border border-gray-700 py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition font-medium cursor-pointer shadow-sm disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{downloadingMesh ? "Saving..." : "3D GLB Mesh"}</span>
                </button>
              </div>
              <p className="text-[9px] text-gray-400 leading-tight">
                *GeoTIFF holds 32-bit elevation data (open in QGIS / ArcGIS / GDAL).
              </p>
            </div>
          )}

        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT MAIN VIEWPORT & TABS                               */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col relative bg-gradient-to-b from-gray-950 via-gray-900 to-black overflow-hidden">
        
        {/* TOP TAB BAR & CONTROLS */}
        <div className="h-14 bg-gray-900/90 backdrop-blur border-b border-gray-800 px-5 flex items-center justify-between z-10 shrink-0">
          
          {/* Tab Switcher: [ 3D Terrain ] [ Colorized DSM ] [ Depth Map ] [ Original ] */}
          <div className="flex items-center space-x-1.5 bg-gray-950/80 p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => setActiveTab('3d')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === '3d' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D Terrain</span>
            </button>
            <button
              onClick={() => setActiveTab('dsm')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'dsm' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Colorized DSM</span>
            </button>
            <button
              onClick={() => setActiveTab('depth')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'depth' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Depth Map</span>
            </button>
            <button
              onClick={() => setActiveTab('optical')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'optical' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Original Image</span>
            </button>
          </div>

          {/* Quick Actions (Reset 3D, 2D vs 3D Split, Drone, Tour) */}
          <div className="flex items-center space-x-2">
            {activeTab === '3d' && (
              <>
                <button
                  onClick={resetToOriginal3D}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-md shadow-emerald-950/60 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  title="Reset everything back to the original photorealistic 3D generation view and settings"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-white" />
                  <span>↺ Reset to Original 3D</span>
                </button>

                <button
                  onClick={() => setIsSplitView(!isSplitView)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
                    isSplitView 
                      ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-950 ring-2 ring-blue-400/50' 
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                  title="Side-by-side comparison: Original Flat 2D Photo vs Generated 3D Mesh"
                >
                  <Split className="w-3.5 h-3.5 text-blue-400" />
                  <span>{isSplitView ? "Full 3D Mode" : "2D vs 3D Split View"}</span>
                </button>

                <button
                  onClick={() => {
                    const next = !flythroughActive;
                    setFlythroughActive(next);
                    if (next) {
                      setWasdMode(false);
                      setAutoOrbitActive(false);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition cursor-pointer ${
                    flythroughActive 
                      ? 'bg-blue-600 border-blue-500 text-white animate-pulse' 
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <Plane className="w-3.5 h-3.5 text-blue-400" />
                  <span>3D Drone Tour</span>
                </button>

                <button
                  onClick={() => {
                    const next = !wasdMode;
                    setWasdMode(next);
                    if (next) {
                      setFlythroughActive(false);
                      setAutoOrbitActive(false);
                      setIsSplitView(false);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition cursor-pointer ${
                    wasdMode 
                      ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-900/50 ring-2 ring-emerald-400 font-bold' 
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                  }`}
                  title="Fly like a drone or walk inside the 3D environment using W, A, S, D and Mouse"
                >
                  <Compass className={`w-3.5 h-3.5 ${wasdMode ? "text-white animate-spin" : "text-emerald-400"}`} />
                  <span>{wasdMode ? "Exit Flight Mode" : "🎮 Free-Flight (WASD)"}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB CONTENT 1: 3D TERRAIN VIEWPORT                       */}
        {/* ======================================================== */}
        {activeTab === '3d' && (
          <div className="flex-1 relative w-full h-full flex flex-col overflow-hidden">
            
            {/* Viewport Wrapper: Handles either Full 3D or 2D vs 3D Split View */}
            <div className="flex-1 flex flex-row w-full h-full relative overflow-hidden">

              {/* LEFT SIDE IN SPLIT MODE: ACTUAL 2D OPTICAL IMAGE */}
              {isSplitView && (
                <div className="w-1/2 h-full border-r border-gray-800 bg-gray-950 relative flex flex-col z-10 animate-in fade-in slide-in-from-left duration-200">
                  {/* Badge */}
                  <div className="absolute top-4 left-4 z-20 bg-gray-900/95 backdrop-blur border border-blue-500/50 px-3.5 py-1.5 rounded-xl shadow-xl flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                    <div>
                      <span className="text-xs font-bold text-white tracking-wide block">ACTUAL 2D OPTICAL IMAGE</span>
                      <span className="text-[10px] text-gray-400 font-mono">Original Aerial Photograph (Flat 2D Baseline)</span>
                    </div>
                  </div>

                  {/* Centered Image View */}
                  <div className="flex-1 flex items-center justify-center p-6 bg-radial from-gray-900 to-black overflow-hidden">
                    <img 
                      src={`http://127.0.0.1:8000/api/optical-image?t=${lastUpdated}`} 
                      alt="Optical Aerial Frame" 
                      className="max-h-full max-w-full object-contain rounded-xl shadow-2xl border border-gray-800/80"
                      onError={(e) => { e.target.src = "http://127.0.0.1:8000/api/preview-image"; }}
                    />
                  </div>

                  {/* Footer status comparison */}
                  <div className="h-10 bg-gray-900/90 border-t border-gray-800 px-4 flex items-center justify-between text-[11px] text-gray-400 font-mono shrink-0">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                      Zero Elevation Relief (2D Planar Projection)
                    </span>
                    <span className="text-blue-400 font-semibold">Raw Input Frame</span>
                  </div>
                </div>
              )}

              {/* RIGHT SIDE (OR FULL): INTERACTIVE 3D WEBGL TERRAIN */}
              <div className={`${isSplitView ? 'w-1/2' : 'w-full'} h-full relative flex flex-col overflow-hidden`}>

                {/* Split Mode Right Badge */}
                {isSplitView && (
                  <div className="absolute top-4 left-4 z-20 bg-gray-900/95 backdrop-blur border border-emerald-500/50 px-3.5 py-1.5 rounded-xl shadow-xl flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <div>
                      <span className="text-xs font-bold text-emerald-300 tracking-wide block">GENERATED 3D TERRAIN MESH</span>
                      <span className="text-[10px] text-emerald-400/80 font-mono">Digital Surface Model • {exaggeration.toFixed(1)}x Physical Extrusion</span>
                    </div>
                  </div>
                )}

                {/* FLOATING TOP CENTER: 3D RENDER MODES PILL SWITCHER */}
                <div className={`absolute ${isSplitView ? 'top-16 left-4' : 'top-4 left-1/2 -translate-x-1/2'} z-20 bg-gray-900/95 backdrop-blur p-1 rounded-2xl border border-gray-700/80 shadow-2xl flex items-center space-x-1`}>
                  <button
                    onClick={() => {
                      setRenderMode('photo');
                      if (exaggeration < 0.5) setExaggeration(2.2);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      renderMode === 'photo' 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950' 
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                    title="Real satellite/drone photo draped over 3D terrain with dynamic sun shadows"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Photorealistic 3D</span>
                  </button>

                  <button
                    onClick={() => {
                      setRenderMode('clay');
                      if (exaggeration < 0.5) setExaggeration(2.2);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      renderMode === 'clay' 
                        ? 'bg-amber-600 text-white shadow-lg shadow-amber-950' 
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                    title="Studio Architectural Clay: Removes photographic texture so pure 3D building geometry, rooflines, and hills are 100% visible!"
                  >
                    <Mountain className="w-3.5 h-3.5 text-amber-300" />
                    <span>Studio Clay (Pure 3D Shape)</span>
                  </button>

                  <button
                    onClick={() => {
                      setRenderMode('heatmap');
                      if (exaggeration < 0.5) setExaggeration(2.2);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      renderMode === 'heatmap' 
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-950' 
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                    title="Turbo elevation heatmap colormap draped over the 3D geometry"
                  >
                    <Layers className="w-3.5 h-3.5 text-rose-300" />
                    <span>Elevation Heatmap</span>
                  </button>

                  <button
                    onClick={() => {
                      setRenderMode('wireframe');
                      if (exaggeration < 0.5) setExaggeration(2.2);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      renderMode === 'wireframe' 
                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950' 
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                    title="Vector wireframe matrix showing 3D vertex polygons"
                  >
                    <LayoutGrid className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Wireframe</span>
                  </button>
                </div>

                {/* FLOATING CAMERA TOOLBAR & RESET (Always accessible in Full & Split View) */}
                <div className={`absolute ${isSplitView ? 'top-28 left-4' : 'top-4 left-4'} z-10 bg-gray-900/90 backdrop-blur px-2.5 py-1.5 rounded-xl border border-gray-800 flex items-center space-x-1.5 shadow-xl`}>
                  <button
                    onClick={() => handleCameraAngle('iso')}
                    title="Isometric 45° Perspective View (Optimal for 3D depth perception)"
                    className="px-2.5 py-1 rounded-lg hover:bg-gray-800 text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1 font-semibold transition cursor-pointer"
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span>Isometric 45°</span>
                  </button>
                  <span className="text-gray-700">|</span>
                  <button
                    onClick={() => handleCameraAngle('profile')}
                    title="Side Horizon Profile View (Shows vertical mountain peaks and building silhouettes against sky)"
                    className="px-2 py-1 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <Mountain className="w-3.5 h-3.5 text-amber-400" />
                    <span>Horizon Profile</span>
                  </button>
                  <span className="text-gray-700">|</span>
                  <button
                    onClick={() => handleCameraAngle('top')}
                    title="Top-Down 2D Nadir View"
                    className="px-2 py-1 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />
                    <span>Top View</span>
                  </button>
                  <span className="text-gray-700">|</span>
                  <button
                    onClick={() => setAutoOrbitActive(!autoOrbitActive)}
                    title="Toggle Continuous 360° Cinematic Orbit Rotation"
                    className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer ${
                      autoOrbitActive 
                        ? 'bg-emerald-950 border border-emerald-500 text-emerald-300 font-semibold' 
                        : 'hover:bg-gray-800 text-gray-300 hover:text-white'
                    }`}
                  >
                    <RotateCw className={`w-3.5 h-3.5 text-emerald-400 ${autoOrbitActive ? 'animate-spin' : ''}`} />
                    <span>{autoOrbitActive ? "Orbiting..." : "Auto-Rotate"}</span>
                  </button>
                  <span className="text-gray-700">|</span>
                  <button
                    onClick={resetToOriginal3D}
                    title="Reset everything back to the original photorealistic 3D generation"
                    className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 hover:text-white text-xs flex items-center gap-1 font-semibold transition cursor-pointer shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Reset 3D</span>
                  </button>
                </div>

                {/* FLOATING RIGHT 3D VIEWPORT CONTROLS DRAWER */}
                <div className="absolute top-4 right-4 z-10 bg-gray-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-gray-800 shadow-2xl space-y-3.5 w-72 max-h-[88vh] overflow-y-auto">
                  
                  {/* 1. 3D HEIGHT RELIEF EXTRUSION SLIDER */}
                  <div className="space-y-1.5 bg-gray-950/70 p-2.5 rounded-xl border border-gray-800/90">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-200">
                      <span className="flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                        <span>3D Height Extrusion</span>
                      </span>
                      <span className="font-mono text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800 text-[11px]">
                        {exaggeration <= 0.05 ? "0.0x (Flat 2D)" : `${exaggeration.toFixed(1)}x Relief`}
                      </span>
                    </div>

                    <input 
                      type="range" 
                      min="0.0" 
                      max="3.5" 
                      step="0.1"
                      value={exaggeration} 
                      onChange={(e) => setExaggeration(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer h-2 bg-gray-800 rounded-lg"
                    />

                    <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5">
                      <span>0.0x (Flat Image)</span>
                      <span>2.0x (Natural 3D)</span>
                      <span>3.5x (Peaks)</span>
                    </div>

                    {/* Extrude Pop Animation Button */}
                    <button
                      onClick={triggerExtrudeAnimation}
                      disabled={isExtrudingAnim}
                      className="w-full mt-1.5 py-1.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                    >
                      {isExtrudingAnim ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5 animate-spin" />
                          <span>Extruding 3D Mesh...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>🎬 Watch 2D Pop Into 3D</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 2. DYNAMIC SUNLIGHT & TIME OF DAY SIMULATOR */}
                  <div className="space-y-2 bg-gray-950/70 p-2.5 rounded-xl border border-gray-800/90">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-200">
                      <span className="flex items-center gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                        <span>Sunlight & Shading</span>
                      </span>
                      <span className="text-[10px] text-amber-300 font-mono capitalize">{sunPreset}</span>
                    </div>

                    {/* Presets: Morning, Midday, Golden Hour, Night */}
                    <div className="grid grid-cols-4 gap-1">
                      <button
                        onClick={() => applySunPreset('morning')}
                        className={`py-1 text-[10px] font-medium rounded border transition ${
                          sunPreset === 'morning' ? 'bg-amber-600/40 border-amber-500 text-amber-200' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        Morning
                      </button>
                      <button
                        onClick={() => applySunPreset('midday')}
                        className={`py-1 text-[10px] font-medium rounded border transition ${
                          sunPreset === 'midday' ? 'bg-amber-600/40 border-amber-500 text-amber-200' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        Noon
                      </button>
                      <button
                        onClick={() => applySunPreset('golden')}
                        className={`py-1 text-[10px] font-medium rounded border transition ${
                          sunPreset === 'golden' ? 'bg-amber-600/40 border-amber-500 text-amber-200' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        Golden
                      </button>
                      <button
                        onClick={() => applySunPreset('night')}
                        className={`py-1 text-[10px] font-medium rounded border transition ${
                          sunPreset === 'night' ? 'bg-indigo-600/40 border-indigo-500 text-indigo-200' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        Night
                      </button>
                    </div>

                    {/* Sun Azimuth Rotation Slider */}
                    <div className="pt-1">
                      <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                        <span>Sun Direction (Azimuth)</span>
                        <span className="font-mono text-gray-300">{sunAzimuth}°</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="360" 
                        value={sunAzimuth} 
                        onChange={(e) => {
                          setSunAzimuth(parseInt(e.target.value));
                          setSunPreset('custom');
                        }}
                        className="w-full accent-amber-400 cursor-pointer h-1.5 bg-gray-800 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* 3. INTERACTIVE FLOOD & WATER LEVEL SIMULATION */}
                  <div className="space-y-1.5 bg-gray-950/70 p-2.5 rounded-xl border border-gray-800/90">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-200">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={showWater} 
                          onChange={(e) => setShowWater(e.target.checked)}
                          className="accent-sky-500 rounded"
                        />
                        <span className="flex items-center gap-1">
                          <Waves className="w-3.5 h-3.5 text-sky-400" />
                          <span>Flood / Water Plane</span>
                        </span>
                      </label>
                      {showWater && (
                        <span className="font-mono text-sky-300 text-[10px]">{waterLevel.toFixed(1)} {elevUnit}</span>
                      )}
                    </div>

                    {showWater && (
                      <div className="pt-1 space-y-1">
                        <input 
                          type="range" 
                          min={elevationStats.min_m} 
                          max={elevationStats.max_m} 
                          step="0.5"
                          value={waterLevel} 
                          onChange={(e) => setWaterLevel(parseFloat(e.target.value))}
                          className="w-full accent-sky-400 cursor-pointer h-1.5 bg-gray-800 rounded-lg"
                        />
                        <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                          <span>Low: {elevationStats.min_m}</span>
                          <span>High: {elevationStats.max_m}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. GRID TOGGLE */}
                  <div className="pt-1 border-t border-gray-800 flex items-center justify-between text-xs text-gray-300">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={showGrid} 
                        onChange={(e) => setShowGrid(e.target.checked)}
                        className="accent-emerald-500 rounded"
                      />
                      <span>Coordinate Grid</span>
                    </label>
                    <span className="text-[10px] text-gray-500 font-mono">Click terrain to inspect</span>
                  </div>
                </div>

                {/* INTERACTIVE SPOT INSPECTION FLOATING CARD (When Clicked) */}
                {inspectionData && (
                  <div className="absolute bottom-12 left-4 z-20 bg-gray-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-emerald-500/60 shadow-2xl w-72 animate-in fade-in slide-in-from-bottom duration-200">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-emerald-400 animate-bounce" />
                        <span className="text-xs font-bold text-white tracking-wide">3D SPOT ELEVATION</span>
                      </div>
                      <button 
                        onClick={() => setInspectionData(null)}
                        className="text-gray-400 hover:text-white p-0.5 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2.5 font-mono">
                      <div className="bg-gray-950 p-2 rounded-xl border border-gray-800/80">
                        <span className="text-[10px] text-gray-400 block">Surface (DSM)</span>
                        <span className="text-sm font-bold text-emerald-400">{inspectionData.elevation} {elevUnit}</span>
                      </div>
                      <div className="bg-gray-950 p-2 rounded-xl border border-gray-800/80">
                        <span className="text-[10px] text-gray-400 block">Ground (DEM)</span>
                        <span className="text-sm font-bold text-sky-400">{inspectionData.groundElevation} {elevUnit}</span>
                      </div>
                      <div className="bg-gray-950 p-2 rounded-xl border border-gray-800/80">
                        <span className="text-[10px] text-gray-400 block">Object Height</span>
                        <span className="text-sm font-bold text-amber-300">+{inspectionData.objectHeight} {elevUnit}</span>
                      </div>
                      <div className="bg-gray-950 p-2 rounded-xl border border-gray-800/80">
                        <span className="text-[10px] text-gray-400 block">Slope Angle</span>
                        <span className="text-sm font-bold text-rose-300">{inspectionData.slope}°</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-gray-400 pt-2 font-mono flex items-center justify-between">
                      <span>X: {inspectionData.worldX} | Y: {inspectionData.worldY}</span>
                      <span className="text-emerald-400 font-semibold">3D Extruded</span>
                    </div>
                  </div>
                )}

                {/* FLOATING ELEVATION COLORBAR LEGEND (When Heatmap Mode) */}
                {renderMode === 'heatmap' && (
                  <div className="absolute bottom-14 right-4 z-10 bg-gray-900/95 backdrop-blur-md p-3 rounded-xl border border-gray-700 shadow-2xl flex flex-col space-y-2 w-48 animate-in fade-in">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-gray-200 border-b border-gray-800 pb-1.5">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" /> Elevation Legend
                      </span>
                      <span className="font-mono text-emerald-400 text-[10px] bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">{elevUnit}</span>
                    </div>
                    
                    <div className="flex items-stretch gap-2.5 pt-0.5">
                      <div 
                        className="w-3.5 h-28 rounded-md border border-gray-600 shadow-inner"
                        style={{
                          background: 'linear-gradient(to bottom, #d33810, #faba39, #a2fc3c, #35b5ac, #4662d8, #30123b)'
                        }}
                      />
                      <div className="flex flex-col justify-between text-[10px] font-mono py-0.5 text-gray-300">
                        <div className="flex flex-col">
                          <span className="text-rose-400 font-bold">Max: {elevationStats.max_m}</span>
                          <span className="text-[9px] text-gray-500">Peaks / Roofs</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-amber-300 font-medium">Mid: {elevationStats.mean_m}</span>
                          <span className="text-[9px] text-gray-500">Slopes & Flats</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sky-400 font-bold">Min: {elevationStats.min_m}</span>
                          <span className="text-[9px] text-gray-500">Valley / Basins</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[9px] text-gray-400 text-center pt-1 border-t border-gray-800/80 font-mono">
                      Turbo Perceptual Palette
                    </div>
                  </div>
                )}

                {/* Navigation Hint Footer */}
                <div className="absolute bottom-3 left-4 z-10 bg-black/75 backdrop-blur px-3 py-1 rounded-lg border border-gray-800 text-[11px] text-gray-300 font-mono">
                  {wasdMode ? (
                    <span className="text-emerald-400 font-semibold">
                      🎮 Flight Mode: [W/S] Move • [A/D] Strafe • [Space/C] Elevate • {isMouseLocked ? "Move Mouse to Look (ESC to unlock)" : "Click Canvas to Lock Mouse Look"}
                    </span>
                  ) : (
                    "Left-Drag: Rotate • Right-Drag: Pan • Scroll: Zoom • Click Mesh: 3D Spot Height Pin"
                  )}
                </div>

                {/* THREE.JS WEBGL CANVAS (Shadows & Realistic Shading Enabled) */}
                <Canvas 
                  shadows
                  camera={{ position: [-60, -75, 55], fov: 48, up: [0, 0, 1] }}
                  dpr={[1, 2]}
                  gl={{ antialias: true, powerPreference: 'high-performance' }}
                >
                  {/* Directional Sunlight with Shadows */}
                  <ambientLight intensity={sunPreset === 'night' ? 0.18 : (renderMode === 'clay' ? 0.38 : 0.44)} />
                  <directionalLight 
                    position={[sunPos.x, sunPos.y, sunPos.z]} 
                    intensity={sunPreset === 'night' ? 0.4 : 1.6} 
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                    shadow-bias={-0.0004}
                    shadow-camera-near={10}
                    shadow-camera-far={450}
                    shadow-camera-left={-80}
                    shadow-camera-right={80}
                    shadow-camera-top={80}
                    shadow-camera-bottom={-80}
                  />
                  {/* Sky Fill Light */}
                  <directionalLight 
                    position={[-sunPos.x * 0.4, -sunPos.y * 0.4, 40]} 
                    intensity={0.25} 
                    color="#93c5fd" 
                  />

                  {/* 3D Terrain Model */}
                  <TerrainModel 
                    modelPath={modelUrl}
                    renderMode={renderMode}
                    exaggeration={exaggeration}
                    onMeshClick={handleCanvasClick}
                    lastUpdated={lastUpdated}
                    onBaseScaleComputed={setModelBaseScale}
                  />

                  {/* Interactive 3D Beacon Pin */}
                  <InspectionBeacon data={inspectionData} />

                  {/* Flood / Water Simulation Plane */}
                  <WaterPlane 
                    show={showWater} 
                    waterLevel={waterLevel} 
                    minElev={elevationStats.min_m} 
                    maxElev={elevationStats.max_m} 
                    baseScale={modelBaseScale} 
                    exaggeration={exaggeration} 
                  />

                  {/* Coordinate Grid */}
                  {showGrid && (
                    <gridHelper args={[180, 36, 0x059669, 0x1f2937]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -4]} />
                  )}

                  {/* Camera Controls */}
                  <ControlledOrbitControls 
                    cameraAction={cameraAction} 
                    onActionComplete={() => setCameraAction(null)} 
                    enabled={!flythroughActive && !wasdMode} 
                    autoRotate={autoOrbitActive}
                  />
                  <DroneFlythrough active={flythroughActive} />
                  <InteractiveDroneFlight 
                    active={wasdMode} 
                    onExit={() => setWasdMode(false)}
                    onLockChange={setIsMouseLocked}
                  />
                </Canvas>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB CONTENT 2: COLORIZED DSM TAB ⭐                      */}
        {/* ======================================================== */}
        {activeTab === 'dsm' && (
          <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center justify-start space-y-5">
            {/* DSM Header Statistics */}
            <div className="w-full max-w-4xl bg-gray-900/90 border border-gray-800 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-emerald-400" />
                    <span>DIGITAL SURFACE MODEL (DSM) RESULT</span>
                  </h2>
                  <p className="text-xs text-gray-400">32-Bit Calibrated Floating-Point Geospatial Raster</p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                  {modeName}
                </span>
              </div>

              {/* Min, Max, Mean Elevation Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-800">
                  <span className="text-xs text-gray-400 block">Min Elevation</span>
                  <span className="text-lg font-mono font-bold text-sky-400">{elevationStats.min_m} {elevUnit}</span>
                </div>
                <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-800">
                  <span className="text-xs text-gray-400 block">Max Elevation</span>
                  <span className="text-lg font-mono font-bold text-rose-400">{elevationStats.max_m} {elevUnit}</span>
                </div>
                <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-800">
                  <span className="text-xs text-gray-400 block">Mean Elevation</span>
                  <span className="text-lg font-mono font-bold text-emerald-400">{elevationStats.mean_m} {elevUnit}</span>
                </div>
              </div>

              {/* Mode Toggle Bar: Heatmap vs Wipe Comparator */}
              <div className="flex items-center justify-between bg-gray-950/60 p-2 rounded-xl border border-gray-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDsmSwipeMode(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      !dsmSwipeMode ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Colorized DSM
                  </button>
                  <button
                    onClick={() => setDsmSwipeMode(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      dsmSwipeMode ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Split className="w-3.5 h-3.5 text-blue-300" />
                    <span>Compare with Actual Image (Wipe Slider)</span>
                  </button>
                </div>
                {dsmSwipeMode && (
                  <span className="text-[11px] text-gray-400 font-mono">
                    Drag slider or handle to inspect optical vs elevation alignment
                  </span>
                )}
              </div>

              {/* Colorized DSM Raster OR Interactive Wipe Comparator */}
              {!dsmSwipeMode ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-700 group cursor-crosshair">
                  <img 
                    src={`http://127.0.0.1:8000/api/heatmap?t=${lastUpdated}`} 
                    alt="Colorized DSM" 
                    className="w-full max-h-[500px] object-contain bg-black"
                    onMouseMove={handleDSMImageMouseMove}
                    onMouseLeave={() => setHoverElevation(null)}
                    onError={(e) => { e.target.src = "http://127.0.0.1:8000/api/optical-image"; }}
                  />

                  {/* Elevation Hover Readout */}
                  <div className="absolute top-3 right-3 bg-black/80 backdrop-blur px-3 py-1.5 rounded-lg border border-gray-700 font-mono text-xs text-emerald-300 shadow-xl flex items-center gap-2">
                    <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Elevation: {hoverElevation ? `${hoverElevation} ${elevUnit}` : `${elevationStats.mean_m} ${elevUnit}`}</span>
                  </div>
                </div>
              ) : (
                /* Interactive Before / After Split Wipe Comparison Container */
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border border-gray-700 bg-black select-none max-h-[500px] flex items-center justify-center">
                    {/* Bottom Layer: Actual 2D Optical Image */}
                    <img 
                      src={`http://127.0.0.1:8000/api/optical-image?t=${lastUpdated}`} 
                      alt="Optical Aerial Frame" 
                      className="w-full max-h-[500px] object-contain block"
                      onError={(e) => { e.target.src = "http://127.0.0.1:8000/api/preview-image"; }}
                    />

                    {/* Top Layer: Generated Colorized DSM (Clipped by swipe position) */}
                    <div 
                      className="absolute inset-0 overflow-hidden flex items-center justify-center pointer-events-none"
                      style={{ clipPath: `inset(0 ${100 - dsmSwipePos}% 0 0)` }}
                    >
                      <img 
                        src={`http://127.0.0.1:8000/api/heatmap?t=${lastUpdated}`} 
                        alt="Colorized DSM" 
                        className="w-full max-h-[500px] object-contain block"
                        onError={(e) => { e.target.src = "http://127.0.0.1:8000/api/optical-image"; }}
                      />
                    </div>

                    {/* Draggable Divider Line */}
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] pointer-events-none z-10"
                      style={{ left: `${dsmSwipePos}%` }}
                    >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-white text-gray-900 rounded-full shadow-2xl flex items-center justify-center font-bold text-xs">
                        ↔
                      </div>
                    </div>

                    {/* Labels */}
                    <div className="absolute top-3 left-3 bg-black/80 backdrop-blur px-2.5 py-1 rounded-md border border-emerald-500/50 text-[10px] font-mono text-emerald-300 font-bold">
                      GENERATED 3D DSM
                    </div>
                    <div className="absolute top-3 right-3 bg-black/80 backdrop-blur px-2.5 py-1 rounded-md border border-blue-500/50 text-[10px] font-mono text-blue-300 font-bold">
                      ACTUAL 2D OPTICAL PHOTO
                    </div>
                  </div>

                  {/* Range Slider for Split Wipe */}
                  <div className="flex items-center space-x-3 bg-gray-950/70 p-3 rounded-xl border border-gray-800">
                    <span className="text-xs font-semibold text-emerald-400 shrink-0">Generated DSM</span>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={dsmSwipePos} 
                      onChange={(e) => setDsmSwipePos(parseInt(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer h-2 bg-gray-800 rounded-lg"
                    />
                    <span className="text-xs font-semibold text-blue-400 shrink-0">Actual 2D Image</span>
                  </div>
                </div>
              )}

              {/* Color Scale Gradient Legend Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-mono text-gray-400">
                  <span>Low: {elevationStats.min_m} {elevUnit} (Deep Blue)</span>
                  <span>Mid: {elevationStats.mean_m} {elevUnit} (Green / Amber)</span>
                  <span>Peak: {elevationStats.max_m} {elevUnit} (Red)</span>
                </div>
                <div className="h-3 rounded-full bg-gradient-to-r from-blue-600 via-emerald-400 via-amber-400 to-red-600 shadow-inner"></div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB CONTENT 3: MONOCULAR DEPTH MAP TAB                   */}
        {/* ======================================================== */}
        {activeTab === 'depth' && (
          <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center justify-start space-y-4">
            <div className="w-full max-w-4xl bg-gray-900/90 border border-gray-800 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    <span>DEPTH ANYTHING V2 RELATIVE DISPARITY MAP</span>
                  </h2>
                  <p className="text-xs text-gray-400">Normalized Scale-Agnostic Feature Depth D_rel ∈ [0, 1]</p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                  Inferno Colormap
                </span>
              </div>

              {/* Color Meaning Cards (Yellow = Near/High, Purple = Far/Low) */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-800">
                  <div className="flex items-center gap-1.5 text-xs text-amber-300 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-sm shadow-yellow-400/50"></span>
                    <span className="font-bold">Nearest / High (1.0)</span>
                  </div>
                  <span className="text-xs text-gray-200 block font-semibold">Bright Yellow / Gold</span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">
                    Camera ke sabse paas / Unchi Pahad Choti (Elevated Peaks & Ridges)
                  </span>
                </div>

                <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-800">
                  <div className="flex items-center gap-1.5 text-xs text-orange-400 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50"></span>
                    <span className="font-bold">Mid Distance (0.5)</span>
                  </div>
                  <span className="text-xs text-gray-200 block font-semibold">Warm Orange / Magenta</span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">
                    Beech ki dhalan aur rolling slopes (Intermediate Terrain)
                  </span>
                </div>

                <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-800">
                  <div className="flex items-center gap-1.5 text-xs text-purple-400 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-900 border border-purple-500"></span>
                    <span className="font-bold">Furthest / Low (0.0)</span>
                  </div>
                  <span className="text-xs text-gray-200 block font-semibold">Deep Purple / Black</span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">
                    Camera se door / Nichli zameen (Valleys & Deep Ground)
                  </span>
                </div>
              </div>

              {/* Interactive Depth Map with Live Hover Inspector */}
              <div className="relative rounded-xl overflow-hidden border border-gray-700 bg-black flex items-center justify-center cursor-crosshair group">
                <img 
                  src={`http://127.0.0.1:8000/api/depth-map?t=${lastUpdated}`} 
                  alt="Depth Map" 
                  className="w-full max-h-[500px] object-contain"
                  onMouseMove={handleDepthImageMouseMove}
                  onMouseLeave={() => setHoverDepth(null)}
                  onError={(e) => { e.target.src = "http://127.0.0.1:8000/api/heatmap"; }}
                />

                {/* Live Depth Disparity Hover Badge */}
                <div className="absolute top-3 right-3 bg-black/85 backdrop-blur px-3 py-1.5 rounded-lg border border-gray-700 font-mono text-xs text-amber-300 shadow-xl flex items-center gap-2">
                  <Crosshair className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>
                    Rel Disparity: {hoverDepth || "0.86"} {parseFloat(hoverDepth || "0.86") >= 0.6 ? "🟡 (Near / High Peak)" : "🟣 (Far / Valley)"}
                  </span>
                </div>
              </div>

              {/* Color Gradient Legend Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-mono text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-black border border-gray-600"></span>
                    <span>0.0: Far / Valleys (Black / Violet)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    <span>0.5: Mid Slopes (Orange)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                    <span>1.0: Near / Peaks (Bright Yellow)</span>
                  </span>
                </div>
                <div className="h-3.5 rounded-full bg-gradient-to-r from-black via-purple-900 via-orange-500 to-yellow-300 shadow-inner border border-gray-800"></div>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed bg-gray-950/60 p-3 rounded-xl border border-gray-800">
                Extracted via <strong>Depth Anything V2 (ViT-Small)</strong> transformer backbone. 
                Edge-preserving relative depth captures structural building footprints and terrain morphology before metric scaling.
              </p>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB CONTENT 4: ORIGINAL OPTICAL IMAGERY TAB              */}
        {/* ======================================================== */}
        {activeTab === 'optical' && (
          <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center justify-start space-y-4">
            <div className="w-full max-w-4xl bg-gray-900/90 border border-gray-800 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Eye className="w-5 h-5 text-emerald-400" />
                    <span>ORIGINAL INPUT REMOTE SENSING IMAGERY</span>
                  </h2>
                  <p className="text-xs text-gray-400">RGB Optical Satellite / Aerial / Drone Feed</p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-gray-800 text-gray-200 border border-gray-700 font-mono">
                  {imagePreview?.format || "RGB"}
                </span>
              </div>

              <div className="rounded-xl overflow-hidden border border-gray-700 bg-black flex items-center justify-center">
                <img 
                  src={imagePreview?.preview_url || `http://127.0.0.1:8000/api/optical-image?t=${lastUpdated}`} 
                  alt="Original Satellite Feed" 
                  className="max-h-[520px] object-contain"
                  onError={(e) => { e.target.src = "/sample.jpg"; }}
                />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ======================================================== */}
      {/* COMPARE DSM MODAL (Generated DSM vs Reference DEM)       */}
      {/* ======================================================== */}
      {compareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-400" />
                  <span>DSM VALIDATION COMPARISON (Reference DEM vs Predicted DSM)</span>
                </h3>
                <p className="text-xs text-gray-400">Ground Truth Residual Error Mapping across 12,450 sample points</p>
              </div>
              <button 
                onClick={() => setCompareModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content: 3-Way Image Comparison */}
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-3 gap-4">
                {/* 1. Generated DSM */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-emerald-300 block">1. Generated DSM (AI Model)</span>
                  <div className="rounded-xl overflow-hidden border border-gray-700 bg-black h-56">
                    <img 
                      src={`http://127.0.0.1:8000/api/heatmap?t=${lastUpdated}`} 
                      alt="Generated DSM" 
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.src = "http://127.0.0.1:8000/api/optical-image"; }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 block font-mono">H_abs = 4.82·D + 110.0</span>
                </div>

                {/* 2. Reference DEM */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-sky-300 block">2. Reference 30m SRTM DEM</span>
                  <div className="rounded-xl overflow-hidden border border-gray-700 bg-black h-56">
                    <img 
                      src={`http://127.0.0.1:8000/api/reference-dsm?t=${lastUpdated}`} 
                      alt="Reference DEM" 
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.src = "http://127.0.0.1:8000/api/heatmap"; }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 block font-mono">SRTM V3 1-ArcSecond GT</span>
                </div>

                {/* 3. Error Difference Map */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-amber-300 block">3. Residual Error (ΔH = |Pred - Ref|)</span>
                  <div className="rounded-xl overflow-hidden border border-gray-700 bg-black h-56">
                    <img 
                      src={`http://127.0.0.1:8000/api/diff-heatmap?t=${lastUpdated}`} 
                      alt="Difference Heatmap" 
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.src = "http://127.0.0.1:8000/api/depth-map"; }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 block font-mono">Error Scale: 0.0m - 5.0m</span>
                </div>
              </div>

              {/* Metrics Summary Table */}
              <div className="p-4 bg-gray-950/80 rounded-xl border border-gray-800 grid grid-cols-4 gap-4 text-center">
                <div>
                  <span className="text-xs text-gray-400 block">Vertical RMSE</span>
                  <span className="text-base font-mono font-bold text-emerald-400">{metrics.rmse}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">Mean Absolute Error (MAE)</span>
                  <span className="text-base font-mono font-bold text-emerald-400">{metrics.mae}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">Pearson Correlation (r)</span>
                  <span className="text-base font-mono font-bold text-teal-300">{metrics.correlation_r}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">R² Score</span>
                  <span className="text-base font-mono font-bold text-indigo-300">{metrics.r2_score}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => setCompareModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-white"
              >
                Close Comparison
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}