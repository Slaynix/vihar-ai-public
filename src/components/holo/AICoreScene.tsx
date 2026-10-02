import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Icosahedron, Torus, Sphere } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

function Core() {
  const inner = useRef<THREE.Mesh>(null);
  const outer = useRef<THREE.Mesh>(null);
  useFrame((state, dt) => {
    if (inner.current) {
      inner.current.rotation.y += dt * 0.4;
      inner.current.rotation.x += dt * 0.2;
    }
    if (outer.current) {
      outer.current.rotation.y -= dt * 0.15;
      outer.current.rotation.z += dt * 0.08;
    }
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, state.mouse.x * 0.6, 0.04);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, state.mouse.y * 0.4, 0.04);
    state.camera.lookAt(0, 0, 0);
  });
  return (
    <group>
      <Sphere ref={inner} args={[1.05, 64, 64]}>
        <MeshDistortMaterial
          color="#22d3ee"
          emissive="#7c3aed"
          emissiveIntensity={1.4}
          distort={0.55}
          speed={2.4}
          roughness={0.15}
          metalness={0.4}
        />
      </Sphere>
      <Icosahedron ref={outer} args={[1.8, 1]}>
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.5}
          wireframe
          transparent
          opacity={0.55}
        />
      </Icosahedron>
    </group>
  );
}

function Rings() {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  const c = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (a.current) { a.current.rotation.x += dt * 0.4; a.current.rotation.y += dt * 0.2; }
    if (b.current) { b.current.rotation.y += dt * 0.3; b.current.rotation.z += dt * 0.15; }
    if (c.current) { c.current.rotation.z += dt * 0.25; c.current.rotation.x -= dt * 0.1; }
  });
  return (
    <group>
      <Torus ref={a} args={[2.6, 0.02, 16, 200]}>
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={2.2} />
      </Torus>
      <Torus ref={b} args={[3.1, 0.015, 16, 200]}>
        <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={2} />
      </Torus>
      <Torus ref={c} args={[3.7, 0.012, 16, 200]}>
        <meshStandardMaterial color="#f0abfc" emissive="#f0abfc" emissiveIntensity={1.8} />
      </Torus>
    </group>
  );
}

function OrbitDots() {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (group.current) group.current.rotation.y += dt * 0.5; });
  const dots = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    const r = 3.1;
    return [Math.cos(angle) * r, Math.sin(angle * 2) * 0.4, Math.sin(angle) * r] as const;
  });
  return (
    <group ref={group}>
      {dots.map((p, i) => (
        <mesh key={i} position={p as unknown as [number, number, number]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={3} />
        </mesh>
      ))}
    </group>
  );
}

export function AICoreScene() {
  return (
    <Canvas dpr={[1, 1.6]} camera={{ position: [0, 0, 7.5], fov: 55 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.35} />
      <pointLight position={[5, 5, 5]} intensity={2} color="#22d3ee" />
      <pointLight position={[-5, -3, -3]} intensity={1.5} color="#a78bfa" />
      <Suspense fallback={null}>
        <Core />
        <Rings />
        <OrbitDots />
        <EffectComposer>
          <Bloom intensity={1.2} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
