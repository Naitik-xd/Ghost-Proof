import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeCanvasProps {
  isDark: boolean;
  isAnalyzing?: boolean;
}

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({ isDark, isAnalyzing = false }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isDarkRef = useRef(isDark);
  const isAnalyzingRef = useRef(isAnalyzing);

  useEffect(() => {
    isDarkRef.current = isDark;
    isAnalyzingRef.current = isAnalyzing;
  }, [isDark, isAnalyzing]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let frameId = 0;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 280;

    // Detect software rendering
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 7);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Group for all animated elements
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Central Core: Geometric Dual-Mesh
    const coreGeo = new THREE.IcosahedronGeometry(1.6, 1);
    const coreWireMat = new THREE.MeshBasicMaterial({
      color: isDarkRef.current ? 0x10b981 : 0x059669,
      wireframe: true,
      transparent: true,
      opacity: isDarkRef.current ? 0.35 : 0.45,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreWireMat);
    mainGroup.add(coreMesh);

    // Inner glowing sphere
    const innerGeo = new THREE.SphereGeometry(1.1, 16, 16);
    const innerMat = new THREE.MeshBasicMaterial({
      color: isDarkRef.current ? 0x064e3b : 0xa7f3d0,
      transparent: true,
      opacity: isDarkRef.current ? 0.2 : 0.35,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    mainGroup.add(innerMesh);

    // Orbit Ring 1 (Torus)
    const ringGeo1 = new THREE.TorusGeometry(2.3, 0.015, 8, 64);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: isDarkRef.current ? 0x34d399 : 0x0d9488,
      transparent: true,
      opacity: 0.5,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = Math.PI / 3;
    mainGroup.add(ring1);

    // Orbit Ring 2 (Torus)
    const ringGeo2 = new THREE.TorusGeometry(2.7, 0.012, 8, 64);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: isDarkRef.current ? 0x6ee7b7 : 0x047857,
      transparent: true,
      opacity: 0.35,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.y = Math.PI / 4;
    mainGroup.add(ring2);

    // Constellation Particles
    const particleCount = 75;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSeeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const radius = 2.0 + Math.random() * 2.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = radius * Math.cos(phi);
      particleSeeds[i] = Math.random() * 100;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: isDarkRef.current ? 0xa7f3d0 : 0x059669,
      size: 0.065,
      transparent: true,
      opacity: 0.8,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    mainGroup.add(particles);

    // Mouse movement interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetX = x * 0.4;
      targetY = y * 0.3;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const speedMultiplier = isAnalyzingRef.current ? 3.5 : 1.0;

      // Smooth mouse follow
      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;

      mainGroup.rotation.y += delta * 0.25 * speedMultiplier;
      mainGroup.rotation.x = mouseY * 0.5;
      mainGroup.rotation.z = mouseX * 0.3;

      coreMesh.rotation.y += delta * 0.35 * speedMultiplier;
      coreMesh.rotation.x -= delta * 0.15 * speedMultiplier;

      ring1.rotation.z += delta * 0.4 * speedMultiplier;
      ring2.rotation.x += delta * 0.3 * speedMultiplier;

      // Update theme colors dynamically
      const dark = isDarkRef.current;
      coreWireMat.color.setHex(dark ? 0x10b981 : 0x059669);
      coreWireMat.opacity = dark ? 0.35 : 0.45;
      innerMat.color.setHex(dark ? 0x064e3b : 0xa7f3d0);
      particleMat.color.setHex(dark ? 0xa7f3d0 : 0x059669);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);

      coreGeo.dispose();
      coreWireMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="w-full h-full min-h-[220px] sm:min-h-[280px] relative pointer-events-none"
      aria-hidden="true"
    />
  );
};
