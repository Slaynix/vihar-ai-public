import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Global "calm mode" store.
 *
 * Any screen can ask the app to stop burning GPU (e.g. while a network search
 * is running). The 3D background subscribes and freezes its render loop, which
 * is what actually removes the frame drops — not just lowering opacity.
 *
 * Module-level singleton + useSyncExternalStore so toggling it never re-renders
 * the React tree above the subscriber.
 */

let calmCount = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getSnapshot = () => calmCount > 0;
const getServerSnapshot = () => false;

/** Read whether the app is currently in calm (low-GPU) mode. */
export function useCalmMode() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Imperative begin/end pair. Reference counted so overlapping callers are safe. */
export function beginCalm() {
  calmCount += 1;
  if (calmCount === 1) emit();
}

export function endCalm() {
  calmCount = Math.max(0, calmCount - 1);
  if (calmCount === 0) emit();
}

/** Hold calm mode for as long as `active` is true. */
export function useCalmWhile(active: boolean) {
  useEffect(() => {
    if (!active) return;
    beginCalm();
    return () => endCalm();
  }, [active]);
}

export type DeviceTier = "low" | "mobile" | "desktop";

/** Cheap device capability tier, resolved once after hydration. */
export function useDeviceTier(): DeviceTier {
  const [tier, setTier] = useState<DeviceTier>("desktop");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const compute = () => {
      const cores = navigator.hardwareConcurrency ?? 8;
      const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
      if (cores <= 4 || mem <= 4) return setTier("low");
      setTier(mq.matches ? "mobile" : "desktop");
    };
    compute();
    mq.addEventListener("change", compute);
    return () => mq.removeEventListener("change", compute);
  }, []);
  return tier;
}

/** Debounce any value. */
export function useDebounced<T>(value: T, delay = 450): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
