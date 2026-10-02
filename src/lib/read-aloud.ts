import { useSyncExternalStore } from "react";

/**
 * Audiobook-style speech engine.
 * Module-level singleton so playback position survives route changes.
 */

export type ReadAloudState = {
  id: string | null;
  label: string;
  sentences: string[];
  index: number;
  playing: boolean;
  rate: number;
  voiceURI: string | null;
};

const WPS = 2.7; // spoken words per second at 1x

let state: ReadAloudState = {
  id: null,
  label: "",
  sentences: [],
  index: 0,
  playing: false,
  rate: 1,
  voiceURI: null,
};

const listeners = new Set<() => void>();
function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const getSnapshot = () => state;
const getServerSnapshot = () => state;

export function useReadAloud() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function stripMarkdown(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\|/g, " ")
    .replace(/[#*_`~]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function splitSentences(text: string): string[] {
  const clean = stripMarkdown(text);
  if (!clean) return [];
  const parts = clean.match(/[^.!?\n]+[.!?]*/g) ?? [clean];
  const out: string[] = [];
  for (const raw of parts) {
    const s = raw.trim();
    if (!s) continue;
    // keep chunks reasonable so Chrome doesn't stall on very long utterances
    if (s.length > 240) {
      for (const piece of s.match(/.{1,240}(\s|$)/g) ?? [s]) {
        const p = piece.trim();
        if (p) out.push(p);
      }
    } else out.push(s);
  }
  return out;
}

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

export function isSupported() {
  return synth() !== null;
}

export function getVoices(): SpeechSynthesisVoice[] {
  return synth()?.getVoices() ?? [];
}

let keepAlive: ReturnType<typeof setInterval> | null = null;
function startKeepAlive() {
  // Chrome pauses long speech after ~15s; a periodic resume keeps it going.
  if (keepAlive) return;
  keepAlive = setInterval(() => {
    const s = synth();
    if (!s) return;
    if (state.playing && s.speaking) s.resume();
  }, 8000);
}
function stopKeepAlive() {
  if (keepAlive) clearInterval(keepAlive);
  keepAlive = null;
}

function speakCurrent() {
  const s = synth();
  if (!s) return;
  const sentence = state.sentences[state.index];
  if (!sentence) {
    stop();
    return;
  }
  s.cancel();
  const u = new SpeechSynthesisUtterance(sentence);
  u.rate = state.rate;
  if (state.voiceURI) {
    const v = getVoices().find((x) => x.voiceURI === state.voiceURI);
    if (v) u.voice = v;
  }
  u.onend = () => {
    if (!state.playing) return;
    if (state.index >= state.sentences.length - 1) {
      state.playing = false;
      state.index = 0;
      stopKeepAlive();
      emit();
      return;
    }
    state.index += 1;
    emit();
    speakCurrent();
  };
  u.onerror = () => {
    state.playing = false;
    stopKeepAlive();
    emit();
  };
  s.speak(u);
  startKeepAlive();
}

/** Start (or resume) reading a piece of text. Position is kept per id. */
export function play(id: string, text: string, label = "AI response") {
  const s = synth();
  if (!s) return;
  if (state.id !== id) {
    state.id = id;
    state.label = label;
    state.sentences = splitSentences(text);
    state.index = 0;
  } else if (state.sentences.length === 0) {
    state.sentences = splitSentences(text);
  }
  if (state.sentences.length === 0) return;
  state.playing = true;
  emit();
  speakCurrent();
}

export function pause() {
  const s = synth();
  if (!s) return;
  s.cancel(); // keeps state.index — resume re-speaks the current sentence
  state.playing = false;
  stopKeepAlive();
  emit();
}

export function toggle(id: string, text: string, label?: string) {
  if (state.id === id && state.playing) pause();
  else play(id, text, label);
}

export function stop() {
  synth()?.cancel();
  state.playing = false;
  state.index = 0;
  state.id = null;
  state.sentences = [];
  stopKeepAlive();
  emit();
}

export function restart() {
  state.index = 0;
  emit();
  if (state.playing) speakCurrent();
}

export function seek(index: number) {
  if (state.sentences.length === 0) return;
  state.index = Math.min(state.sentences.length - 1, Math.max(0, index));
  emit();
  if (state.playing) speakCurrent();
}

export function skip(delta: number) {
  seek(state.index + delta);
}

export function setRate(rate: number) {
  state.rate = rate;
  emit();
  if (state.playing) speakCurrent();
}

export function setVoice(voiceURI: string | null) {
  state.voiceURI = voiceURI;
  emit();
  if (state.playing) speakCurrent();
}

/** Rough seconds for a sentence range, used for the progress timings. */
export function estimateSeconds(sentences: string[], from: number, to: number, rate: number) {
  let words = 0;
  for (let i = from; i < to && i < sentences.length; i++) {
    words += (sentences[i].match(/\S+/g) ?? []).length;
  }
  return Math.round(words / (WPS * rate));
}

export function formatTime(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
