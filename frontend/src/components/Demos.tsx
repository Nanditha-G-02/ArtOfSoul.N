import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/** Animated visual demonstrations (original SVG animations). They loop while a lesson step is shown. */

const loop = (duration: number, delay = 0) => ({ duration, delay, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" as const });

function Frame({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <figure className="flex h-full w-full flex-col">
      <svg viewBox="0 0 400 280" className="h-full w-full" role="img" aria-label={caption}>
        <rect width="400" height="280" rx="18" fill="#fffdf9" />
        {children}
      </svg>
      <figcaption className="mt-2 text-center text-sm text-ink-soft">{caption}</figcaption>
    </figure>
  );
}

function Draw({ d, stroke = "#231f47", w = 2, delay = 0, dur = 1.4 }: { d: string; stroke?: string; w?: number; delay?: number; dur?: number }) {
  const still = useReducedMotion();
  return <motion.path d={d} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round"
    initial={{ pathLength: still ? 1 : 0 }} animate={{ pathLength: 1 }} transition={still ? undefined : loop(dur, delay)} />;
}

function Appear({ children, delay = 0, dur = 0.8 }: { children: ReactNode; delay?: number; dur?: number }) {
  const still = useReducedMotion();
  return <motion.g initial={{ opacity: still ? 1 : 0 }} animate={{ opacity: still ? 1 : [0, 1, 1, 0] }}
    transition={still ? undefined : { duration: 6, times: [0, 0.15, 0.85, 1], delay, repeat: Infinity, repeatDelay: 0.6 }}>{children}</motion.g>;
}

const VALUES = ["#f7f4ef", "#ddd8d2", "#bdb6b0", "#958e8a", "#6e6766", "#4a4346", "#231f27"];

const DEMOS: Record<string, () => ReactNode> = {
  value_scale: () => <Frame caption="Build a value scale from paper white to your darkest dark">
    {VALUES.map((c, i) => <Appear key={c} delay={i * 0.35}><rect x={40 + i * 46} y={90} width={44} height={100} rx="6" fill={c} stroke="#e6dfd4" /></Appear>)}
    <text x="40" y="220" fontSize="13" fill="#57537a">light</text><text x="324" y="220" fontSize="13" fill="#57537a">dark</text>
  </Frame>,
  sphere_shading: () => <Frame caption="Light, halftone, core shadow, reflected light and cast shadow">
    <circle cx="300" cy="50" r="16" fill="#f4c64f" />
    <Draw d="M288 60 L230 110" stroke="#c2923a" w={1.5} />
    <Appear><ellipse cx="215" cy="226" rx="90" ry="16" fill="#231f47" opacity=".25" /></Appear>
    <circle cx="180" cy="150" r="70" fill="#ddd8d2" />
    <Appear delay={0.4}><path d="M180 80 A70 70 0 0 1 250 150 A70 70 0 0 1 180 220 C 225 190, 230 120, 180 80Z" fill="#6e6766" /></Appear>
    <Appear delay={0.8}><path d="M228 200 C 240 180, 246 165, 247 150" stroke="#958e8a" strokeWidth="6" fill="none" /></Appear>
    <Appear delay={1.2}><ellipse cx="160" cy="125" rx="18" ry="14" fill="#f7f4ef" /></Appear>
  </Frame>,
  hatching: () => <Frame caption="Layer hatching, then cross-hatching, to build tone">
    {Array.from({ length: 14 }, (_, i) => <Draw key={`a${i}`} d={`M${70 + i * 18} 200 L${110 + i * 18} 80`} w={1.6} delay={i * 0.05} />)}
    {Array.from({ length: 10 }, (_, i) => <Draw key={`b${i}`} d={`M${200 + i * 14} 80 L${160 + i * 14} 200`} w={1.4} delay={1 + i * 0.05} />)}
    {Array.from({ length: 6 }, (_, i) => <Draw key={`c${i}`} d={`M${270 + i * 10} 200 L${270 + i * 10} 80`} w={1.2} delay={2 + i * 0.05} />)}
  </Frame>,
  edge_control: () => <Frame caption="Hard edges catch the eye; soft and lost edges let forms turn away">
    <defs><linearGradient id="soft" x1="0" x2="1"><stop offset="0" stopColor="#4a4346" /><stop offset="1" stopColor="#4a4346" stopOpacity="0" /></linearGradient></defs>
    <rect x="60" y="70" width="110" height="140" rx="4" fill="#4a4346" />
    <Appear><rect x="170" y="70" width="90" height="140" fill="url(#soft)" /></Appear>
    <text x="64" y="232" fontSize="13" fill="#57537a">hard</text><text x="200" y="232" fontSize="13" fill="#57537a">soft → lost</text>
    <Draw d="M60 60 L170 60" stroke="#d9675e" w={3} />
  </Frame>,
  perspective: () => <Frame caption="Lines converge to a vanishing point on the horizon">
    <Draw d="M20 120 L380 120" stroke="#4f9ccf" w={1.5} />
    <circle cx="200" cy="120" r="4" fill="#d9675e" />
    {[[90, 180], [90, 240], [150, 180], [150, 240]].map(([x, y], i) => <Draw key={i} d={`M${x} ${y} L200 120`} stroke="#8c88a8" w={1} delay={0.4 + i * 0.15} />)}
    <Appear delay={1.2}><path d="M90 180 L150 180 L150 240 L90 240Z M150 180 L172 152 L172 196 L150 240" fill="#ece6f8" stroke="#5b3fa0" strokeWidth="2" /></Appear>
  </Frame>,
  proportion: () => <Frame caption="The eyes sit about halfway down the head">
    <ellipse cx="200" cy="140" rx="70" ry="95" fill="#fde3d3" stroke="#57537a" strokeWidth="2" />
    <Draw d="M130 140 L270 140" stroke="#d9675e" />
    <Draw d="M200 45 L200 235" stroke="#8c88a8" w={1} delay={0.3} />
    <Draw d="M140 185 L260 185" stroke="#23807f" delay={0.6} />
    <Draw d="M150 205 L250 205" stroke="#c2923a" delay={0.9} />
    <Appear delay={1.2}><ellipse cx="172" cy="140" rx="12" ry="7" fill="#231f47" /><ellipse cx="228" cy="140" rx="12" ry="7" fill="#231f47" /></Appear>
  </Frame>,
  color_temperature: () => {
    const still = useReducedMotion();
    return <Frame caption="Warm light, cool shadows — temperature shifts, not just value">
      <motion.circle cx="200" cy="140" r="80" animate={still ? undefined : { fill: ["#e8b48a", "#f2c28e", "#e8b48a"] }} transition={{ duration: 4, repeat: Infinity }} fill="#e8b48a" />
      <path d="M200 60 A80 80 0 0 1 280 140 A80 80 0 0 1 200 220 C 255 190, 260 100, 200 60Z" fill="#6f78a8" opacity=".85" />
      <circle cx="80" cy="60" r="18" fill="#f4c64f" />
      <text x="110" y="250" fontSize="13" fill="#c2554d">warm light</text><text x="250" y="250" fontSize="13" fill="#4f6fae">cool shadow</text>
    </Frame>;
  },
  color_mixing: () => {
    const still = useReducedMotion();
    return <Frame caption="Complements meet in a rich neutral — no black needed">
      <motion.circle cy="140" r="55" fill="#d9675e" opacity=".9" animate={still ? { cx: 150 } : { cx: [110, 165, 110] }} transition={{ duration: 4, repeat: Infinity }} />
      <motion.circle cy="140" r="55" fill="#23807f" opacity=".9" animate={still ? { cx: 250 } : { cx: [290, 235, 290] }} transition={{ duration: 4, repeat: Infinity }} />
      <motion.circle cx="200" cy="140" r="26" fill="#7d6a62" animate={still ? undefined : { opacity: [0, 1, 0] }} transition={{ duration: 4, repeat: Infinity }} />
    </Frame>;
  },
  glazing: () => <Frame caption="Thin transparent layers build colour and depth">
    <rect x="80" y="70" width="240" height="140" rx="10" fill="#fdf8f2" stroke="#e6dfd4" />
    {[["#f4c64f", 90, 80], ["#d9675e", 140, 100], ["#7c4dcc", 190, 120]].map(([c, x, y], i) =>
      <Appear key={i} delay={i * 0.6}><rect x={x as number} y={y as number} width="110" height="90" rx="8" fill={c as string} opacity=".45" style={{ mixBlendMode: "multiply" }} /></Appear>)}
  </Frame>,
  composition: () => {
    const still = useReducedMotion();
    return <Frame caption="Place the focal point near a third, not dead centre">
      {[133, 266].map((x) => <Draw key={x} d={`M${x} 20 L${x} 260`} stroke="#d6cfe8" w={1.5} />)}
      {[93, 186].map((y) => <Draw key={y} d={`M20 ${y} L380 ${y}`} stroke="#d6cfe8" w={1.5} delay={0.3} />)}
      <motion.circle r="20" fill="#d9675e" animate={still ? { cx: 266, cy: 93 } : { cx: [200, 266, 266, 200], cy: [140, 93, 93, 140] }}
        transition={{ duration: 5, repeat: Infinity, times: [0, 0.35, 0.8, 1] }} />
    </Frame>;
  },
  atmosphere: () => <Frame caption="Far shapes get lighter, softer and cooler">
    <rect x="0" y="0" width="400" height="280" rx="18" fill="#e7f1f8" />
    <Appear><path d="M0 170 L70 110 L140 150 L220 95 L300 140 L400 105 L400 280 L0 280Z" fill="#b9cde0" /></Appear>
    <Appear delay={0.5}><path d="M0 210 L90 150 L170 190 L260 140 L340 185 L400 160 L400 280 L0 280Z" fill="#7f95b8" /></Appear>
    <Appear delay={1}><path d="M0 250 L110 200 L210 235 L300 195 L400 230 L400 280 L0 280Z" fill="#3f4a6e" /></Appear>
  </Frame>,
  brushwork: () => <Frame caption="Vary pressure and direction: each stroke describes form">
    <Draw d="M60 200 C 120 120, 180 110, 240 150" stroke="#7c4dcc" w={14} />
    <Draw d="M90 230 C 160 200, 230 210, 330 170" stroke="#d9675e" w={9} delay={0.7} />
    <Draw d="M180 90 C 220 70, 280 80, 330 110" stroke="#23807f" w={5} delay={1.4} />
  </Frame>,
};

export const DEMO_IDS = Object.keys(DEMOS);

export default function Demo({ id }: { id: string }) {
  const D = DEMOS[id] ?? DEMOS.value_scale;
  return <D key={id} />;
}
