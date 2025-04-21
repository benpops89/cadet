import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const Renderer = () => {
  const canvasRef = useRef(null); // Reference for the canvas
  const containerRef = useRef(null); // Reference for the container div

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Get container size
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Create the scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      5000
    );
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);

    scene.background = new THREE.Color(0xf0f0f0); // Light gray

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
    });
    renderer.setSize(width, height);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }

    // Add light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);
    animate();

    // Load STL
    const loader = new STLLoader();
    loader.load("/cube.stl", (geometry) => {
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

      // Center the mesh
      const center = geometry.boundingSphere.center;
      geometry.translate(-center.x, -center.y, -center.z);

      scene.add(mesh);

      // Axes Helpers
      const axesSize = geometry.boundingSphere?.radius || 5;
      const axesHelper = new THREE.AxesHelper(axesSize * 5);
      scene.add(axesHelper);

      // Grid Helpers
      // const gridHelper = new THREE.GridHelper(200, 200, 0x888888, 0xcccccc);
      // scene.add(gridHelper);

      // Position the camera just right
      const radius = geometry.boundingSphere.radius;
      const distance = radius * 2.5;

      camera.position.set(distance, distance, distance);
      camera.lookAt(0, 0, 0);

      controls.target.set(0, 0, 0);
      controls.update();
    });
    // Handle window resize
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
  
  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full"/>
    </div>
  );
};

export default Renderer;
