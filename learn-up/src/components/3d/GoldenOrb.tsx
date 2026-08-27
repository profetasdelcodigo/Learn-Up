"use client";
import { Canvas } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Float } from "@react-three/drei";

export default function GoldenOrb() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.6}>
        <Sphere args={[1, 64, 64]}>
          <MeshDistortMaterial
            color="#d4af37"
            emissive="#f3e5ab"
            emissiveIntensity={0.15}
            roughness={0.2}
            metalness={0.9}
            distort={0.3}
            speed={2}
          />
        </Sphere>
      </Float>
    </Canvas>
  );
}
