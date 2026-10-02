import { Suspense, useMemo, useRef, useEffect, useState, memo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { useCalmMode } from "@/lib/perf";


type Variant = "galaxy" | "nebula-cyan" | "nebula-violet" | "nebula-aurora";

const PALETTES: Record<Variant, { inside: string; outside: string; core: string; distant: string }> = {
  "galaxy":         { inside: "#67e8f9", outside: "#a78bfa", core: "#fef3c7", distant: "#dbeafe" },
  "nebula-cyan":    { inside: "#22d3ee", outside: "#3b82f6", core: "#a5f3fc", distant: "#bae6fd" },
  "nebula-violet":  { inside: "#c084fc", outside: "#7c3aed", core: "#f5d0fe", distant: "#e9d5ff" },
  "nebula-aurora":  { inside: "#34d399", outside: "#8b5cf6", core: "#fbcfe8", distant: "#c7d2fe" },
};

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return r;
}

/** Pause render loop when tab is hidden — saves GPU on mobile. */
function VisibilityPause() {
  const { invalidate, set } = useThree();
  useEffect(() => {
    const on = () => {
      set({ frameloop: document.hidden ? "never" : "always" });
      if (!document.hidden) invalidate();
    };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [invalidate, set]);
  return null;
}

function Galaxy({ variant, count, reducedMotion }: { variant: Variant; count: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const ARMS = 5;
  const RADIUS = 16;
  const SPIN = 1.15;
  const RANDOMNESS = 0.55;
  const RANDOM_POWER = 2.8;

  const { positions, colors, radii } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const radii = new Float32Array(count);
    const inside = new THREE.Color(PALETTES[variant].inside);
    const outside = new THREE.Color(PALETTES[variant].outside);
    for (let i = 0; i < count; i++) {
      const r = Math.pow(Math.random(), 1.6) * RADIUS;
      const branch = (i % ARMS) / ARMS * Math.PI * 2;
      const spin = r * SPIN;
      const rx = Math.pow(Math.random(), RANDOM_POWER) * (Math.random() < 0.5 ? 1 : -1) * RANDOMNESS * r * 0.35;
      const ry = Math.pow(Math.random(), RANDOM_POWER) * (Math.random() < 0.5 ? 1 : -1) * RANDOMNESS * 0.4;
      const rz = Math.pow(Math.random(), RANDOM_POWER) * (Math.random() < 0.5 ? 1 : -1) * RANDOMNESS * r * 0.35;
      const angle = branch + spin;
      positions[i * 3] = Math.cos(angle) * r + rx;
      positions[i * 3 + 1] = ry;
      positions[i * 3 + 2] = Math.sin(angle) * r + rz;
      radii[i] = r;
      const mixed = inside.clone().lerp(outside, Math.min(r / RADIUS, 1));
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }
    return { positions, colors, radii };
  }, [count, variant]);

  useFrame((_, dt) => {
    if (!ref.current || reducedMotion) return;
    // Rotate whole group uniformly (differential effect preserved via later parent tilt).
    // Cheaper than per-star trig each frame.
    ref.current.rotation.y += dt * 0.05;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} count={count} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function DistantStars({ variant, count, reducedMotion }: { variant: Variant; count: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 30 + Math.random() * 40;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(p) * Math.cos(t);
      arr[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      arr[i * 3 + 2] = r * Math.cos(p);
    }
    return arr;
  }, [count]);
  useFrame((_, dt) => {
    if (!ref.current || reducedMotion) return;
    ref.current.rotation.y += dt * 0.01;
  });
  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled>
      <PointMaterial transparent color={PALETTES[variant].distant} size={0.06} sizeAttenuation depthWrite={false} opacity={0.7} />
    </Points>
  );
}

function GalacticCore({ variant, reducedMotion }: { variant: Variant; reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current && !reducedMotion) ref.current.rotation.y += dt * 0.2;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.9, 32, 32]} />
      <meshBasicMaterial color={PALETTES[variant].core} transparent opacity={0.55} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function GalaxyRig({ variant, count, reducedMotion }: { variant: Variant; count: number; reducedMotion: boolean }) {
  return (
    <group rotation={[-0.55, 0, 0]}>
      <GalacticCore variant={variant} reducedMotion={reducedMotion} />
      <Galaxy variant={variant} count={count} reducedMotion={reducedMotion} />
    </group>
  );
}

function HoloBackgroundImpl({ intensity = 1, variant = "galaxy" }: { intensity?: number; variant?: Variant }) {
  const isMobile = useIsMobile();
  const reducedMotion = useReducedMotion();
  const calm = useCalmMode();
  // Mid-range phones/tablets report few logical cores — drop to DPR 1 and a
  // lighter particle budget there so the render loop stays smooth.
  const lowPower =
    typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 4;
  const galaxyCount = lowPower ? 1400 : isMobile ? 2200 : 5500;
  const distantCount = lowPower ? 500 : isMobile ? 900 : 2400;
  const maxDpr = lowPower ? 1 : isMobile ? 1.25 : 1.5;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-opacity duration-300"
      style={{ opacity: (calm ? 0.35 : 0.7) * intensity }}
    >
      <Canvas
        dpr={calm ? 1 : [1, maxDpr]}
        // While the app is busy (search / streaming reply) the loop is frozen —
        // this is what actually frees the GPU on mid-range phones.
        frameloop={calm ? "demand" : "always"}
        resize={{ scroll: false, debounce: { scroll: 50, resize: 120 } }}
        camera={{ position: [0, 4, 18], fov: 60 }}
        gl={{ antialias: !isMobile && !lowPower, alpha: true, powerPreference: "high-performance" }}
      >

        <VisibilityPause />
        <ambientLight intensity={0.3} />
        <Suspense fallback={null}>
          <DistantStars variant={variant} count={distantCount} reducedMotion={reducedMotion} />
          <GalaxyRig variant={variant} count={galaxyCount} reducedMotion={reducedMotion} />
        </Suspense>
      </Canvas>
    </div>
  );
}


/** Memoized: the canvas stays mounted across route changes and only rebuilds
 *  when the variant/intensity actually change. */
export const HoloBackground = memo(HoloBackgroundImpl);
