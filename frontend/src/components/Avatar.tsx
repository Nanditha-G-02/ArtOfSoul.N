import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { TUTOR } from "../lib/tutor";

export type Mood = "idle" | "talking" | "thinking" | "happy";

const PAINT = ["#ef6a3f", "#8a6fd0", "#4f7032", "#f2c230", "#3f6f8f", "#f4934e"];

/**
 * The tutor. Animation layers:
 * - entrance: the card settles in with a small turn
 * - idle: slow "breathing" zoom and drift on the portrait, gentle float of the card
 * - hover: the card tilts toward the pointer
 * - talking: a rotating paint-colour halo glows with the voice, the portrait nods slightly with the audio level,
 *   paint dots rise around her, and a live sound-wave shows in the name tag
 * - thinking: the halo turns slowly in soft grey and dots orbit
 * - happy: a burst of paint splashes
 * (A still photo isn't lip-synced; that looks uncanny.)
 */
export default function Avatar({ mood = "idle", level = 0, size = 280, label = true }:
  { mood?: Mood; level?: number; size?: number; tool?: "brush" | "pencil"; label?: boolean }) {
  const still = useReducedMotion();
  const talking = mood === "talking", thinking = mood === "thinking";
  const h = size * 1.08;

  // pointer tilt
  const rx = useMotionValue(0), ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 120, damping: 14 }), sry = useSpring(ry, { stiffness: 120, damping: 14 });
  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (still) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 12);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 12);
  }

  // one splash burst each time she becomes happy
  const [burst, setBurst] = useState(0);
  const prev = useRef(mood);
  useEffect(() => { if (mood === "happy" && prev.current !== "happy") setBurst((b) => b + 1); prev.current = mood; }, [mood]);

  return (
    <motion.div className="relative" style={{ width: size, perspective: 900 }}
      initial={still ? false : { opacity: 0, scale: 0.9, rotate: -3, y: 16 }} animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
      transition={{ type: "spring", stiffness: 110, damping: 14 }}>
      {/* colour halo */}
      <motion.div aria-hidden className="absolute -inset-3 rounded-[36px] blur-md"
        style={{ background: thinking ? "conic-gradient(from 0deg, #cfd3dd, #f4f4f6, #cfd3dd, #f4f4f6, #cfd3dd)"
          : `conic-gradient(from 0deg, ${PAINT.join(", ")}, ${PAINT[0]})` }}
        animate={still ? { opacity: talking ? 0.6 : 0 } : { rotate: 360, opacity: talking ? 0.45 + level * 0.5 : thinking ? 0.7 : mood === "happy" ? 0.7 : 0.18 }}
        transition={{ rotate: { duration: thinking ? 6 : 10, repeat: Infinity, ease: "linear" }, opacity: { duration: 0.15 } }} />

      <motion.div onPointerMove={onMove} onPointerLeave={() => { rx.set(0); ry.set(0); }}
        style={{ rotateX: srx, rotateY: sry, transformStyle: "preserve-3d" }}
        animate={still ? undefined : { y: [0, -6, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="relative">
        <div className="relative overflow-hidden rounded-[28px] bg-[#e7ebf3] shadow-[0_24px_60px_-24px_rgba(22,22,29,.5)]" style={{ width: size, height: h }}>
          <motion.img src={TUTOR.photo} alt={`${TUTOR.name}, your art teacher`} draggable={false}
            className="h-full w-full object-cover object-[50%_18%]" style={{ originY: 0.35 }}
            animate={still ? undefined : talking
              ? { scale: 1.06 + level * 0.015, rotate: (level - 0.4) * 1.4, y: -level * 4, x: 0 }
              : { scale: [1.04, 1.08, 1.04], x: [0, -4, 0], y: [0, -3, 0], rotate: 0 }}
            transition={talking ? { duration: 0.12 } : { duration: 9, repeat: Infinity, ease: "easeInOut" }} />
          {/* soft light sweep */}
          {!still && <motion.div aria-hidden className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
            initial={{ x: "-120%" }} animate={{ x: "420%" }} transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 6, ease: "easeInOut" }} />}
          <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[28px]"
            animate={{ boxShadow: talking ? `inset 0 0 0 ${3 + level * 5}px rgba(255,255,255,.85)` : "inset 0 0 0 0px rgba(255,255,255,0)" }}
            transition={{ duration: 0.12 }} />
        </div>

        {/* rising paint dots while talking */}
        <AnimatePresence>{talking && !still && PAINT.map((c, i) => (
          <motion.span key={c} aria-hidden className="absolute rounded-full" style={{ background: c, width: 8 + (i % 3) * 3, height: 8 + (i % 3) * 3, left: `${8 + i * 16}%`, bottom: -6 }}
            initial={{ opacity: 0, y: 0 }} animate={{ opacity: [0, 0.9, 0], y: -h * (0.35 + (i % 3) * 0.12) }} exit={{ opacity: 0 }}
            transition={{ duration: 2.4 + (i % 3) * 0.5, repeat: Infinity, delay: i * 0.35, ease: "easeOut" }} />))}</AnimatePresence>

        {/* orbiting dots while thinking */}
        {thinking && !still && <motion.div aria-hidden className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
          {[0, 1, 2].map((i) => <span key={i} className="absolute h-3 w-3 rounded-full" style={{ background: PAINT[i], left: "50%", top: -10, transform: `rotate(${i * 120}deg) translateY(0)`, transformOrigin: `0 ${h / 2 + 10}px` }} />)}
        </motion.div>}

        {/* happy splash burst */}
        <AnimatePresence>{burst > 0 && mood === "happy" && !still && Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2, d = size * (0.55 + (i % 3) * 0.12);
          return <motion.span key={`${burst}-${i}`} aria-hidden className="absolute left-1/2 top-1/2 rounded-full" style={{ background: PAINT[i % PAINT.length], width: 10, height: 10 }}
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }} animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.9, scale: 1.2, opacity: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 1.1, ease: "easeOut" }} />;
        })}</AnimatePresence>
      </motion.div>

      {label && <div className="absolute -bottom-4 left-1/2 z-10 -translate-x-1/2">
        <AnimatePresence mode="wait">
          <motion.div key={mood} initial={{ opacity: 0, y: 6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 whitespace-nowrap rounded-full bg-white/95 px-4 py-2 text-[13px] font-semibold text-ink shadow-lg">
            <span>{TUTOR.name}</span>
            {talking && <span className="flex h-4 items-center gap-[3px]" aria-label="speaking">
              {[0.6, 1, 0.75, 0.9, 0.5].map((k, i) => (
                <motion.span key={i} className="w-[3px] rounded-full bg-ink" animate={{ height: 4 + level * 12 * k + (still ? 0 : (i % 2) * 2) }} transition={{ duration: 0.1 }} />))}
            </span>}
            {thinking && <span className="flex gap-1" aria-label="thinking">{[0, 1, 2].map((i) => (
              <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-ink-soft" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />))}</span>}
            {mood === "happy" && <span className="text-meadow">well done!</span>}
            {mood === "idle" && <motion.span className="h-2 w-2 rounded-full bg-meadow" aria-label="ready" animate={still ? undefined : { scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 2, repeat: Infinity }} />}
          </motion.div>
        </AnimatePresence>
      </div>}
    </motion.div>
  );
}
