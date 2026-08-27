"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Icosahedron } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

function RotatingIcosahedron() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.3;
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <Icosahedron ref={meshRef} args={[1, 1]} scale={1.2}>
      <meshStandardMaterial
        color="#F0C850"
        emissive="#d4af37"
        emissiveIntensity={0.5}
        wireframe={true}
        transparent={true}
        opacity={0.8}
      />
    </Icosahedron>
  );
}

export default function JarvisOrb3D() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }} style={{ width: "100%", height: "100%", pointerEvents: "none" }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 10]} intensity={2} />
      <RotatingIcosahedron />
    </Canvas>
  );
}
