import { motion, useReducedMotion } from "motion/react";

export type Mood = "idle" | "talking" | "thinking" | "happy";

/**
 * "Muse", the ArtOfSoul.N teacher — an original 2D character drawn in SVG.
 * `level` (0–1) drives the mouth while speaking; blinking, breathing and the brush wave are idle animations.
 */
export default function Avatar({ mood = "idle", level = 0, size = 280, tool = "brush" }:
  { mood?: Mood; level?: number; size?: number; tool?: "brush" | "pencil" }) {
  const still = useReducedMotion();
  const open = mood === "talking" ? 2 + level * 11 : 0;
  return (
    <motion.svg viewBox="0 0 260 300" width={size} height={size * 300 / 260} role="img"
      aria-label={`Your AI art teacher, ${mood === "talking" ? "speaking" : mood === "thinking" ? "thinking" : "smiling"}`}
      animate={still ? undefined : { y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
      <defs>
        <radialGradient id="av-skin" cx="45%" cy="40%" r="65%"><stop offset="0" stopColor="#fde3d3" /><stop offset="1" stopColor="#f2c3a8" /></radialGradient>
        <linearGradient id="av-smock" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#b79cf0" /><stop offset="1" stopColor="#7c4dcc" /></linearGradient>
      </defs>

      {/* body / smock */}
      <motion.g animate={still ? undefined : { scaleY: [1, 1.015, 1] }} transition={{ duration: 3.2, repeat: Infinity }} style={{ originY: "100%" }}>
        <path d="M58 300 C 60 228, 92 204, 130 204 C 168 204, 200 228, 202 300 Z" fill="url(#av-smock)" />
        <path d="M110 206 L130 236 L150 206" fill="none" stroke="#fdf8f2" strokeWidth="5" strokeLinecap="round" />
        <circle cx="96" cy="262" r="6" fill="#f6dccb" /><circle cx="112" cy="272" r="5" fill="#d9675e" /><circle cx="100" cy="282" r="4" fill="#23807f" />
      </motion.g>

      {/* waving arm with tool */}
      <motion.g style={{ originX: "196px", originY: "250px" }}
        animate={still ? undefined : mood === "talking" ? { rotate: [0, -10, 4, -6, 0] } : mood === "happy" ? { rotate: [0, -18, 0] } : { rotate: [0, -3, 0] }}
        transition={{ duration: mood === "talking" ? 2.2 : 3.5, repeat: Infinity, ease: "easeInOut" }}>
        <path d="M188 246 C 214 232, 226 206, 222 186" stroke="#9d7be0" strokeWidth="18" strokeLinecap="round" fill="none" />
        <circle cx="222" cy="182" r="11" fill="url(#av-skin)" />
        {tool === "brush" ? <g transform="rotate(-28 222 160)">
          <rect x="219" y="128" width="6" height="44" rx="3" fill="#c2923a" />
          <rect x="218" y="122" width="8" height="10" fill="#cfcbd8" />
          <path d="M218 122 C 218 110, 222 104, 222 100 C 222 104, 226 110, 226 122 Z" fill="#d9675e" />
        </g> : <g transform="rotate(-24 222 160)">
          <rect x="219" y="122" width="7" height="48" rx="1.5" fill="#f4c64f" />
          <path d="M219 122 L222.5 108 L226 122 Z" fill="#f6dccb" /><path d="M221.5 112 L222.5 108 L223.5 112 Z" fill="#231f47" />
        </g>}
      </motion.g>

      {/* neck + head */}
      <rect x="117" y="182" width="26" height="28" rx="10" fill="#f2c3a8" />
      <g>
        <path d="M66 112 C 60 52, 104 30, 132 32 C 172 34, 204 62, 196 120 C 194 150, 190 170, 182 178 L 80 178 C 72 168, 68 146, 66 112 Z" fill="#3f2a78" />
        <ellipse cx="130" cy="118" rx="58" ry="66" fill="url(#av-skin)" />
        <path d="M74 98 C 86 60, 126 52, 150 60 C 170 66, 184 82, 188 100 C 170 84, 142 76, 112 80 C 96 82, 84 88, 74 98 Z" fill="#3f2a78" />
        {/* beret */}
        <path d="M70 70 C 76 34, 186 26, 194 66 C 196 80, 150 82, 128 80 C 104 80, 68 84, 70 70 Z" fill="#d9675e" />
        <rect x="128" y="22" width="6" height="12" rx="3" fill="#c2554d" />
        {/* cheeks */}
        <ellipse cx="96" cy="140" rx="11" ry="7" fill="#f4a3a0" opacity=".55" />
        <ellipse cx="164" cy="140" rx="11" ry="7" fill="#f4a3a0" opacity=".55" />
        {/* eyes */}
        <motion.g style={{ originY: "118px" }} animate={still ? undefined : { scaleY: [1, 1, 0.1, 1, 1] }}
          transition={{ duration: 4.5, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1] }}>
          {mood === "happy" ? <>
            <path d="M98 120 q 9 -10 18 0" stroke="#231f47" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M144 120 q 9 -10 18 0" stroke="#231f47" strokeWidth="4" fill="none" strokeLinecap="round" />
          </> : <>
            <ellipse cx="107" cy="118" rx="7" ry="9" fill="#231f47" /><circle cx="109.5" cy="114.5" r="2.5" fill="#fff" />
            <ellipse cx="153" cy="118" rx="7" ry="9" fill="#231f47" /><circle cx="155.5" cy="114.5" r="2.5" fill="#fff" />
          </>}
        </motion.g>
        <path d={mood === "thinking" ? "M96 100 q 10 -6 20 -2 M142 98 q 10 -4 20 2" : "M96 101 q 10 -6 20 -1 M144 100 q 10 -5 20 1"}
          stroke="#3f2a78" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        {/* mouth */}
        {mood === "talking"
          ? <motion.ellipse cx="130" cy="152" rx={9 + level * 3} animate={{ ry: open }} transition={{ duration: 0.08 }} fill="#7a2f3c" />
          : mood === "thinking" ? <path d="M120 154 q 10 -4 20 2" stroke="#7a2f3c" strokeWidth="4" fill="none" strokeLinecap="round" />
            : <path d="M114 148 q 16 16 32 0" stroke="#7a2f3c" strokeWidth="4.5" fill={mood === "happy" ? "#7a2f3c" : "none"} strokeLinecap="round" />}
      </g>

      {/* thinking dots */}
      {mood === "thinking" && <g>{[0, 1, 2].map((i) => (
        <motion.circle key={i} cx={206 + i * 16} cy={52 - i * 10} r={5 + i * 2} fill="#ece6f8" stroke="#7c4dcc" strokeWidth="2"
          animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />))}</g>}
    </motion.svg>
  );
}
