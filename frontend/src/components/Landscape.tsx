import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { memo, useMemo } from "react";

/**
 * Original painted landscape (SVG): dawn sky, rocky peak, valley, trees, a cottage and a wildflower meadow.
 * `variant="full"` is the home-page hero with parallax; `variant="soft"` is a quiet backdrop for inner pages.
 */

function rng(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

const FLOWER = ["#f07a3a", "#f4934e", "#8a6fd0", "#a78be6", "#f6f0e6", "#e9e1f5", "#ef6a3f"];

const Meadow = memo(function Meadow({ blur = false }: { blur?: boolean }) {
  const { grass, flowers, big } = useMemo(() => {
    const r = rng(7);
    const grass = Array.from({ length: 520 }, () => {
      const x = r() * 1600, y = 800 + r() ** 0.7 * 200, h = 18 + r() * 46 * ((y - 780) / 200 + 0.4), lean = (r() - 0.5) * 18;
      return { d: `M${x.toFixed(1)} ${y.toFixed(1)} q ${(lean / 2).toFixed(1)} ${(-h / 2).toFixed(1)} ${lean.toFixed(1)} ${(-h).toFixed(1)}`,
        c: r() > 0.5 ? "#4f7032" : "#6d8c3f", w: 1 + r() * 1.6 };
    });
    const flowers = Array.from({ length: 420 }, () => {
      const t = r() ** 0.8, y = 790 + t * 210, x = r() * 1600;
      return { x, y, rad: 1.6 + t * 7 * (0.6 + r() * 0.6), c: FLOWER[Math.floor(r() * FLOWER.length)] };
    }).sort((a, b) => a.y - b.y);
    const big = Array.from({ length: 26 }, () => ({ x: r() * 1600, y: 955 + r() * 60, rad: 16 + r() * 22, c: FLOWER[Math.floor(r() * FLOWER.length)] }));
    return { grass, flowers, big };
  }, []);
  return (
    <g>
      <path d="M0 790 C 300 770, 600 800, 900 785 S 1400 770, 1600 790 L1600 1000 L0 1000Z" fill="url(#ls-meadow)" />
      <g className="ls-sway">{grass.map((g, i) => <path key={i} d={g.d} stroke={g.c} strokeWidth={g.w} fill="none" strokeLinecap="round" opacity=".85" />)}</g>
      <g className="ls-sway ls-sway-2">{flowers.map((f, i) => <circle key={i} cx={f.x} cy={f.y} r={f.rad} fill={f.c} />)}</g>
      {blur && <g filter="url(#ls-blur)" opacity=".9">{big.map((f, i) => <circle key={i} cx={f.x} cy={f.y} r={f.rad} fill={f.c} />)}</g>}
    </g>
  );
});

function Sky() {
  return <>
    <rect width="1600" height="1000" fill="url(#ls-sky)" />
    <circle cx="1000" cy="610" r="340" fill="url(#ls-sun)" />
  </>;
}

function Far() {
  return <g>
    <path d="M560 640 L700 560 L780 590 L900 520 L1010 585 L1120 545 L1250 470 L1360 520 L1470 480 L1600 540 L1600 700 L560 700Z" fill="url(#ls-far)" />
    <path d="M1250 470 L1290 500 L1270 505 L1310 530 L1360 520 L1300 488Z" fill="#f4eef2" opacity=".65" />
    <rect width="1600" height="1000" fill="url(#ls-haze)" />
  </g>;
}

function Peak() {
  return <g>
    <path d="M0 600 L0 260 L60 190 L110 210 L170 120 L215 150 L260 95 L300 140 L345 230 L400 330 L455 440 L520 560 L600 700 L0 720Z" fill="url(#ls-rock)" />
    <path d="M260 95 L300 140 L345 230 L400 330 L455 440 L520 560 L470 560 L410 430 L350 300 L300 200Z" fill="#f2ddd2" opacity=".55" />
    <path d="M170 120 L215 150 L200 260 L160 380 L120 470 L100 420 L140 300Z" fill="#e8d2ca" opacity=".45" />
    {[[180, 160, 150, 420], [235, 140, 210, 470], [300, 150, 290, 480], [120, 230, 90, 470], [350, 250, 360, 520]].map(([x1, y1, x2, y2], i) =>
      <path key={i} d={`M${x1} ${y1} Q ${(x1 + x2) / 2 + 12} ${(y1 + y2) / 2} ${x2} ${y2}`} stroke="#8f7c86" strokeWidth="2" fill="none" opacity=".35" />)}
    <rect x="0" y="0" width="700" height="1000" fill="url(#ls-haze)" opacity=".5" />
  </g>;
}

function Hills() {
  return <g>
    <path d="M1000 660 C 1150 600, 1330 560, 1600 590 L1600 820 L960 820Z" fill="url(#ls-hill-r)" />
    <path d="M0 610 C 140 600, 260 640, 380 690 C 520 750, 720 760, 900 735 C 1050 715, 1250 720, 1600 760 L1600 860 L0 860Z" fill="url(#ls-valley)" />
    <path d="M0 610 C 140 600, 260 640, 380 690 C 470 728, 560 748, 640 760 L0 800Z" fill="url(#ls-hill-l)" />
    <path d="M610 735 C 760 700, 980 690, 1180 720" stroke="#f5e3a6" strokeWidth="10" fill="none" opacity=".35" strokeLinecap="round" />
    {/* cottage */}
    <g transform="translate(70 655)">
      <path d="M0 40 L60 6 L128 22 L128 40Z" fill="#2f3340" />
      <rect x="8" y="38" width="112" height="44" fill="#ece5da" />
      <rect x="8" y="38" width="38" height="44" fill="#d9cfc2" />
      <rect x="70" y="52" width="14" height="14" fill="#5b5f6b" /><rect x="94" y="52" width="14" height="14" fill="#5b5f6b" />
    </g>
    {/* trees */}
    {[[560, 700, 1], [600, 712, 0.75], [1045, 640, 1.35], [1110, 655, 0.7], [700, 690, 0.45]].map(([x, y, s], i) => (
      <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
        <rect x="-4" y="0" width="8" height="40" fill="#3c2e22" />
        <ellipse cx="0" cy="-14" rx="42" ry="38" fill="#6b4a2b" />
        <ellipse cx="-12" cy="-22" rx="26" ry="24" fill="#8a5d33" />
        <ellipse cx="14" cy="-8" rx="24" ry="20" fill="#56391f" />
      </g>))}
  </g>;
}

function Defs() {
  return <defs>
    <linearGradient id="ls-sky" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stopColor="#b8c2d6" /><stop offset=".35" stopColor="#d9d6e2" /><stop offset=".58" stopColor="#f3dccf" /><stop offset=".7" stopColor="#f8e4d4" />
    </linearGradient>
    <radialGradient id="ls-sun"><stop offset="0" stopColor="#fff4e6" stopOpacity=".95" /><stop offset="1" stopColor="#fff4e6" stopOpacity="0" /></radialGradient>
    <linearGradient id="ls-far" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#b9adc4" /><stop offset="1" stopColor="#d8c7cc" /></linearGradient>
    <linearGradient id="ls-haze" x1="0" x2="0" y1="0" y2="1"><stop offset=".45" stopColor="#f7e3d6" stopOpacity="0" /><stop offset=".7" stopColor="#f7e3d6" stopOpacity=".55" /><stop offset=".8" stopColor="#f7e3d6" stopOpacity="0" /></linearGradient>
    <linearGradient id="ls-rock" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#b9a4a6" /><stop offset=".55" stopColor="#c9b1aa" /><stop offset="1" stopColor="#9a8a6a" /></linearGradient>
    <linearGradient id="ls-hill-l" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#8f9d3e" /><stop offset=".6" stopColor="#c1a649" /><stop offset="1" stopColor="#d9b863" /></linearGradient>
    <linearGradient id="ls-hill-r" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#7f9a52" /><stop offset="1" stopColor="#5f7f3e" /></linearGradient>
    <linearGradient id="ls-valley" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#b8b85f" /><stop offset=".5" stopColor="#8fa148" /><stop offset="1" stopColor="#6c8a3c" /></linearGradient>
    <linearGradient id="ls-meadow" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6d8b3f" /><stop offset="1" stopColor="#2f4a23" /></linearGradient>
    <filter id="ls-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7" /></filter>
  </defs>;
}

export default function Landscape({ variant = "full", className = "" }: { variant?: "full" | "soft"; className?: string }) {
  const still = useReducedMotion();
  const { scrollY } = useScroll();
  const far = useTransform(scrollY, [0, 800], [0, still ? 0 : 60]);
  const mid = useTransform(scrollY, [0, 800], [0, still ? 0 : 30]);
  if (variant === "soft") {
    return (
      <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
        <Defs /><Sky /><Far /><Peak /><Hills />
        <path d="M0 790 C 300 770, 600 800, 900 785 S 1400 770, 1600 790 L1600 1000 L0 1000Z" fill="url(#ls-meadow)" />
        <rect width="1600" height="1000" fill="#fbf6f1" opacity=".62" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice" className={className} role="img"
      aria-label="A painted dawn landscape: a rocky peak, a sunlit valley with trees and a cottage, and a meadow of orange and purple wildflowers">
      <Defs /><Sky />
      <motion.g style={{ y: far }}><Far /></motion.g>
      <motion.g style={{ y: mid }}><Peak /><Hills /></motion.g>
      <Meadow blur />
    </svg>
  );
}
