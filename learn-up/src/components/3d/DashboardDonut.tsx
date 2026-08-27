"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Torus } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

function RotatingDonut() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.5;
      meshRef.current.rotation.y += delta * 0.8;
    }
  });

  return (
    <Torus ref={meshRef} args={[1, 0.4, 32, 64]} scale={0.8}>
      <meshStandardMaterial
        color="#8B5CF6"
        emissive="#A78BFA"
        emissiveIntensity={0.2}
        roughness={0.1}
        metalness={0.8}
      />
    </Torus>
  );
}

export default function DashboardDonut() {
  return (
    <Canvas camera={{ position: [0, 0, 4] }} style={{ width: 40, height: 40, pointerEvents: "none" }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 2, 2]} intensity={1} />
      <RotatingDonut />
    </Canvas>
  );
}
