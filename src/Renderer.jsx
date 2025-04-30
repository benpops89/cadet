import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { readFile, BaseDirectory } from "@tauri-apps/plugin-fs";

const Renderer = ({ modelPath }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const meshRef = useRef(null);

  // Set up scene, camera, renderer, lights, controls
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    console.log("hello");

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 5000);
    camera.position.set(5, 5, 5);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
    });
    renderer.setSize(width, height);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Save references
    meshRef.current = { scene, camera, renderer, controls };

    const handleResize = () => {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Load STL when filePath changes
  useEffect(() => {
    console.log("modelPath changed:", modelPath);
    if (!modelPath || !meshRef.current) return;

    const loadSTL = async () => {
      const { scene, camera, controls } = meshRef.current;
      const loader = new STLLoader();
      
      const arrayBuffer = await readFile(modelPath, { baseDir: BaseDirectory.AppData });
      const geometry = loader.parse(arrayBuffer.buffer);
      
      // Clean up previous mesh
      if (meshRef.current.mesh) {
        scene.remove(meshRef.current.mesh);
        meshRef.current.mesh.geometry.dispose();
        meshRef.current.mesh.material.dispose();
      }

      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const material = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        roughness: 1,
        metalness: 0,
        flatShading: true,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Center geometry
      const center = geometry.boundingSphere.center;
      geometry.translate(-center.x, -center.y, -center.z);

      scene.add(mesh);
      meshRef.current.mesh = mesh;

      const radius = geometry.boundingSphere.radius;
      const distance = radius * 2.5;
      camera.position.set(distance, distance, distance);
      camera.lookAt(0, 0, 0);

      controls.target.set(0, 0, 0);
      controls.update();

      // Optional: add axes helper
      const axesSize = geometry.boundingSphere?.radius || 5;
      const axesHelper = new THREE.AxesHelper(axesSize * 5);
      scene.add(axesHelper);
    };

    loadSTL();
  }, [modelPath]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
    </div>
  );
};

export default Renderer;
