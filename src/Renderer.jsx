import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

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
      1000
    );
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
    });
    renderer.setSize(width, height);

    // Add light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    // Load STL
    const loader = new STLLoader();
    loader.load("/cube.stl", (geometry) => {
      const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
      const mesh = new THREE.Mesh(geometry, material);

      // Optional: center geometry if needed
      geometry.center();

      scene.add(mesh);

      // Only render once
      renderer.render(scene, camera);
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
