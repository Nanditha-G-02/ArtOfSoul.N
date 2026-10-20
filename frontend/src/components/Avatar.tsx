import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { TUTOR } from "../lib/tutor";

export type Mood = "idle" | "talking" | "thinking" | "happy";

/**
 * The tutor: a portrait that comes alive with the voice. While speaking, a soft halo and a live sound-wave follow
 * the audio level; while the AI is working she shows a "thinking" pill; idle she breathes gently.
 * (A photo isn't lip-synced — that would look uncanny on a still image.)
 */
export default function Avatar({ mood = "idle", level = 0, size = 280, label = true }:
  { mood?: Mood; level?: number; size?: number; tool?: "brush" | "pencil"; label?: boolean }) {
  const still = useReducedMotion();
  const talking = mood === "talking";
  return (
    <div className="relative" style={{ width: size }}>
      <motion.div
        className="relative overflow-hidden rounded-[28px] bg-[#e7ebf3] shadow-[0_24px_60px_-24px_rgba(22,22,29,.45)]"
        style={{ width: size, height: size * 1.08 }}
        animate={still ? undefined : talking ? { scale: 1 + level * 0.012 } : { scale: [1, 1.012, 1] }}
        transition={talking ? { duration: 0.1 } : { duration: 5, repeat: Infinity, ease: "easeInOut" }}>
        <img src={TUTOR.photo} alt={`${TUTOR.name}, your art teacher`} className="h-full w-full object-cover object-[50%_18%]" draggable={false} />
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[28px]"
          animate={{ boxShadow: talking ? `inset 0 0 0 ${3 + level * 5}px rgba(255,255,255,.85)` : "inset 0 0 0 0px rgba(255,255,255,0)" }}
          transition={{ duration: 0.12 }} />
      </motion.div>

      {label && <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
        <AnimatePresence mode="wait">
          <motion.div key={mood} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 whitespace-nowrap rounded-full bg-white/95 px-4 py-2 text-[13px] font-semibold text-ink shadow-lg">
            <span>{TUTOR.name}</span>
            {talking && <span className="flex h-4 items-center gap-[3px]" aria-label="speaking">
              {[0.6, 1, 0.75, 0.9, 0.5].map((k, i) => (
                <motion.span key={i} className="w-[3px] rounded-full bg-ink" animate={{ height: 4 + level * 12 * k + (still ? 0 : (i % 2) * 2) }} transition={{ duration: 0.1 }} />))}
            </span>}
            {mood === "thinking" && <span className="flex gap-1" aria-label="thinking">{[0, 1, 2].map((i) => (
              <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-ink-soft" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />))}</span>}
            {mood === "happy" && <span className="text-meadow">● well done</span>}
            {mood === "idle" && <span className="h-2 w-2 rounded-full bg-meadow" aria-label="ready" />}
          </motion.div>
        </AnimatePresence>
      </div>}
    </div>
  );
}
