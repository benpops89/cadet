import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { readFile, BaseDirectory } from "@tauri-apps/plugin-fs";

const Renderer = ({ modelPath, modelRevision }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const meshRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modelInfo, setModelInfo] = useState(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showAxes, setShowAxes] = useState(true);
  const [hasModel, setHasModel] = useState(false);
  const axesHelperRef = useRef(null);

  // Set up scene, camera, renderer, lights, controls
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e1e1e);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 5000);
    camera.position.set(5, 5, 5);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x1e1e1e, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 2.0;

    const ambientLight = new THREE.AmbientLight(0x404040, 2.5);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight1.position.set(1, 1, 1).normalize();
    directionalLight1.castShadow = true;
    directionalLight1.shadow.mapSize.width = 2048;
    directionalLight1.shadow.mapSize.height = 2048;
    directionalLight1.shadow.camera.near = 0.5;
    directionalLight1.shadow.camera.far = 50;
    directionalLight1.shadow.camera.left = -10;
    directionalLight1.shadow.camera.right = 10;
    directionalLight1.shadow.camera.top = 10;
    directionalLight1.shadow.camera.bottom = -10;
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight2.position.set(-1, -1, -1).normalize();
    scene.add(directionalLight2);

    const hemisphereLight = new THREE.HemisphereLight(0x80ccff, 0x404040, 0.5);
    scene.add(hemisphereLight);

    const axesHelper = new THREE.AxesHelper(25);
    axesHelper.visible = false; // Initially hidden until model loads
    scene.add(axesHelper);
    axesHelperRef.current = axesHelper;

    let animationFrameId = 0;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    meshRef.current = { scene, camera, renderer, controls, axesHelper };

    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    
    // Use ResizeObserver to detect container size changes (works with draggable divider)
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(containerRef.current);
    
    window.addEventListener("resize", handleResize);

    // Don't call updateHelpers here - axes should only show after model loads

    return () => {
      cancelAnimationFrame(animationFrameId);

      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);

      if (meshRef.current) {
        const { scene, renderer, axesHelper } = meshRef.current;
        if (scene && renderer) {
          scene.traverse((object) => {
            if (object.isMesh) {
              object.geometry.dispose();
              if (object.material) {
                if (Array.isArray(object.material)) {
                  object.material.forEach(material => material.dispose());
                } else {
                  object.material.dispose();
                }
              }
            }
          });

          if (axesHelper) {
            axesHelper.geometry.dispose();
            axesHelper.material.dispose();
          }
        }
        renderer.dispose();
      }
    };
  }, []);

  // Update auto-rotate setting
  useEffect(() => {
    if (meshRef.current && meshRef.current.controls) {
      meshRef.current.controls.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Update helper visibility (only if model has been loaded)
  useEffect(() => {
    if (axesHelperRef.current && hasModel) {
      axesHelperRef.current.visible = showAxes;
    }
  }, [showAxes, hasModel]);

  // Load STL when filePath changes
  useEffect(() => {
    if (!modelPath || !meshRef.current) return;

    const loadSTL = async () => {
      setIsLoading(true);
      try {
        const { scene, camera, controls } = meshRef.current;
        const loader = new STLLoader();

        const arrayBuffer = await readFile(modelPath, { baseDir: BaseDirectory.AppData });
        const geometry = loader.parse(arrayBuffer.buffer);

        if (meshRef.current.mesh) {
          scene.remove(meshRef.current.mesh);
          meshRef.current.mesh.geometry.dispose();
          meshRef.current.mesh.material.dispose();
        }

        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        const boundingBox = geometry.boundingBox;
        const size = new THREE.Vector3();
        boundingBox.getSize(size);

        setModelInfo({
          dimensions: `W: ${size.x.toFixed(2)}mm H: ${size.y.toFixed(2)}mm D: ${size.z.toFixed(2)}mm`,
          volume: `${(size.x * size.y * size.z).toFixed(2)} mm³`,
          vertices: geometry.attributes.position.count
        });

        const material = new THREE.MeshStandardMaterial({
          color: 0x9ca3af,
          roughness: 0.3,
          metalness: 0.6,
          flatShading: false,
          side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const center = geometry.boundingSphere.center;
        geometry.translate(-center.x, -center.y, -center.z);

        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = Math.PI;
        scene.add(mesh);
        meshRef.current.mesh = mesh;

        const radius = geometry.boundingSphere.radius;
        const distance = radius * 2.5;
        camera.position.set(distance, distance, distance);
        camera.lookAt(0, 0, 0);

        controls.target.set(0, 0, 0);
        controls.update();

        // Show axes helper after model is loaded
        setHasModel(true);
        if (axesHelperRef.current && showAxes) {
          axesHelperRef.current.visible = true;
        }

      } catch (error) {
        console.error("Error loading STL:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSTL();
  }, [modelPath, modelRevision]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* 3D Viewport */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]/80 z-10">
            <div className="w-10 h-10 border-3 border-gray-600 border-t-gray-400 animate-spin rounded-full"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Renderer;
