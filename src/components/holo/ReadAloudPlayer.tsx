import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Pause, Square, RotateCcw, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  estimateSeconds,
  formatTime,
  getVoices,
  isSupported,
  pause,
  play,
  restart,
  seek,
  setRate,
  setVoice,
  skip,
  stop,
  toggle,
  useReadAloud,
} from "@/lib/read-aloud";

const RATES = [0.75, 1, 1.25, 1.5, 2];

/** Small inline trigger placed next to any AI answer. */
export function SpeakButton({ id, text, label, className }: { id: string; text: string; label?: string; className?: string }) {
  const s = useReadAloud();
  const active = s.id === id && s.playing;
  if (!text) return null;
  return (
    <button
      type="button"
      onClick={() => toggle(id, text, label)}
      aria-label={active ? "Pause read aloud" : "Read aloud"}
      className={cn(
        "hud-text text-[9px] flex items-center gap-1 transition py-1 min-h-[32px]",
        active ? "text-glow-cyan" : "text-[oklch(0.6_0.1_220)] hover:text-glow-cyan",
        className,
      )}
    >
      {active ? <Pause className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
      {active ? "pause" : "listen"}
    </button>
  );
}

/** Persistent audiobook transport bar. Mounted once in the dashboard shell. */
export function ReadAloudBar() {
  const s = useReadAloud();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSupported()) return;
    const load = () => setVoices(getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const activeSession = s.id !== null && s.sentences.length > 0;

  useEffect(() => {
    if (!activeSession) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === " ") {
        e.preventDefault();
        if (s.playing) pause();
        else if (s.id) play(s.id, s.sentences.join(" "), s.label);
      } else if (e.key === "ArrowRight") { e.preventDefault(); skip(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); skip(-1); }
      else if (e.key.toLowerCase() === "r") { e.preventDefault(); restart(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSession, s.playing, s.id, s.sentences, s.label]);

  if (!activeSession) return null;

  const total = estimateSeconds(s.sentences, 0, s.sentences.length, s.rate);
  const elapsed = estimateSeconds(s.sentences, 0, s.index, s.rate);

  return (
    <AnimatePresence>
      <motion.div
        ref={barRef}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ duration: 0.18 }}
        role="region"
        aria-label="Read aloud player"
        className="fixed z-50 inset-x-2 sm:inset-x-auto sm:right-6 sm:w-[26rem] bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6"
      >
        <div className="holo-panel neon-border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="hud-text text-[9px] text-[oklch(0.82_0.16_220)] truncate">{s.label || "READ ALOUD"}</span>
            <span className="hud-text text-[9px] text-[oklch(0.6_0.1_220)] tabular-nums">
              {formatTime(elapsed)} / {formatTime(total)}
            </span>
          </div>

          <p className="text-[13px] leading-snug text-[oklch(0.95_0.03_220)] line-clamp-2 min-h-[2.2em]">
            <mark className="bg-[oklch(0.85_0.2_200/0.18)] text-inherit rounded px-1">{s.sentences[s.index]}</mark>
          </p>

          <input
            type="range"
            min={0}
            max={Math.max(0, s.sentences.length - 1)}
            value={s.index}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            className="w-full accent-[oklch(0.85_0.2_200)] h-6"
          />

          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <Ctrl label="Restart" onClick={restart}><RotateCcw className="w-4 h-4" /></Ctrl>
              <Ctrl label="Skip back" onClick={() => skip(-1)}><SkipBack className="w-4 h-4" /></Ctrl>
              <Ctrl
                label={s.playing ? "Pause" : "Play"}
                onClick={() => (s.playing ? pause() : s.id && play(s.id, s.sentences.join(" "), s.label))}
                primary
              >
                {s.playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Ctrl>
              <Ctrl label="Skip forward" onClick={() => skip(1)}><SkipForward className="w-4 h-4" /></Ctrl>
              <Ctrl label="Stop" onClick={stop}><Square className="w-4 h-4" /></Ctrl>
            </div>
            <button
              onClick={() => setOpen((o) => !o)}
              className="hud-text text-[9px] px-2 min-h-[36px] text-[oklch(0.7_0.12_220)] hover:text-glow-cyan"
              aria-expanded={open}
            >
              {s.rate}× ▾
            </button>
          </div>

          {open && (
            <div className="space-y-2 pt-1 border-t border-[oklch(0.7_0.15_220/0.2)]">
              <div className="flex flex-wrap gap-1">
                {RATES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRate(r)}
                    className={cn(
                      "hud-text text-[9px] px-2.5 py-2 rounded border transition",
                      s.rate === r
                        ? "text-glow-cyan border-[oklch(0.85_0.2_200/0.6)] bg-[oklch(0.85_0.2_200/0.1)]"
                        : "text-[oklch(0.7_0.12_220)] border-[oklch(0.7_0.15_220/0.25)]",
                    )}
                  >
                    {r}×
                  </button>
                ))}
              </div>
              <select
                value={s.voiceURI ?? ""}
                onChange={(e) => setVoice(e.target.value || null)}
                aria-label="Voice"
                className="w-full px-2 py-2 min-h-[40px] rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-xs"
              >
                <option value="">Default voice</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <p className="hud-text text-[8px] text-[oklch(0.55_0.08_220)]">SPACE PLAY/PAUSE · ←/→ SKIP · R RESTART</p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Ctrl({ label, onClick, children, primary }: { label: string; onClick: () => void; children: React.ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid place-items-center w-9 h-9 rounded-md border transition",
        primary
          ? "border-[oklch(0.85_0.2_200/0.6)] text-[oklch(0.95_0.05_200)] bg-[oklch(0.85_0.18_200/0.18)] hover:bg-[oklch(0.85_0.18_200/0.3)]"
          : "border-[oklch(0.7_0.15_220/0.25)] text-[oklch(0.75_0.12_220)] hover:text-glow-cyan",
      )}
    >
      {children}
    </button>
  );
}
