// Original illustrations drawn in SVG for ArtOfSoul.N (no external images).

/** Hero: a graphite sphere study whose shadow side turns into a painted colour study — the two tracks in one image. */
export function HeroArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 520" className={className} role="img"
      aria-label="A graphite-shaded sphere on the left dissolving into loose painted strokes of violet, coral and teal on the right">
      <defs>
        <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="#231f47" strokeWidth="1.1" strokeOpacity=".55" />
        </pattern>
        <pattern id="hatch2" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="#231f47" strokeWidth="0.9" strokeOpacity=".45" />
        </pattern>
        <radialGradient id="tone" cx="35%" cy="32%" r="75%">
          <stop offset="0" stopColor="#fbf7f1" />
          <stop offset=".45" stopColor="#cfc9d8" />
          <stop offset=".78" stopColor="#6d6884" />
          <stop offset=".9" stopColor="#8a849f" />
          <stop offset="1" stopColor="#4b4668" />
        </radialGradient>
        <linearGradient id="fadeR" x1="0" x2="1">
          <stop offset=".35" stopColor="#fff" />
          <stop offset=".75" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="leftHalf"><rect width="640" height="520" fill="url(#fadeR)" /></mask>
        <filter id="paint" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency=".022" numOctaves="3" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="26" />
        </filter>
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" /><feColorMatrix values="0 0 0 0 .14  0 0 0 0 .12  0 0 0 0 .28  0 0 0 .07 0" /></filter>
        <clipPath id="ball"><circle cx="270" cy="250" r="150" /></clipPath>
      </defs>

      {/* paper */}
      <rect width="640" height="520" rx="28" fill="#fffdf9" />

      {/* painted half */}
      <g filter="url(#paint)" opacity=".95">
        <ellipse cx="420" cy="210" rx="150" ry="125" fill="#5b3fa0" opacity=".85" />
        <ellipse cx="470" cy="300" rx="120" ry="90" fill="#d9675e" opacity=".85" />
        <ellipse cx="380" cy="330" rx="95" ry="70" fill="#23807f" opacity=".8" />
        <ellipse cx="515" cy="170" rx="70" ry="55" fill="#f6dccb" />
        <ellipse cx="455" cy="248" rx="38" ry="30" fill="#c2923a" opacity=".9" />
      </g>
      <path d="M330 120 C 420 90, 520 120, 575 200" stroke="#fbf7f1" strokeWidth="10" strokeLinecap="round" fill="none" opacity=".7" />
      <path d="M352 420 C 440 440, 520 420, 570 370" stroke="#3f2a78" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".5" />

      {/* graphite half */}
      <g mask="url(#leftHalf)">
        <ellipse cx="300" cy="412" rx="170" ry="26" fill="#231f47" opacity=".22" />
        <circle cx="270" cy="250" r="150" fill="url(#tone)" />
        <g clipPath="url(#ball)">
          <path d="M120 250 A150 150 0 0 0 420 250 L420 400 L120 400Z" fill="url(#hatch)" opacity=".7" />
          <ellipse cx="330" cy="320" rx="150" ry="120" fill="url(#hatch2)" opacity=".8" />
        </g>
        <circle cx="270" cy="250" r="150" fill="none" stroke="#231f47" strokeOpacity=".35" strokeWidth="1.2" />
        <path d="M150 168 q 40 -60 115 -68" stroke="#231f47" strokeOpacity=".25" fill="none" />
      </g>
      <rect width="640" height="520" rx="28" filter="url(#grain)" />
    </svg>
  );
}

/** Small track mark — graphite value scale. */
export function PencilMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      {["#ece6f8", "#c7bce6", "#9580c8", "#5b3fa0", "#2e1f5c"].map((c, i) => (
        <rect key={c} x={2 + i * 7.4} y={4} width={7.4} height={32} fill={c} rx={i === 0 ? 3 : i === 4 ? 3 : 0} />
      ))}
    </svg>
  );
}

/** Small track mark — painted swatches. */
export function PaintMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="14" cy="15" r="10" fill="#d9675e" />
      <circle cx="26" cy="17" r="10" fill="#23807f" opacity=".9" />
      <circle cx="20" cy="27" r="9" fill="#c2923a" opacity=".9" />
    </svg>
  );
}

/** Quiet still-life sketch used in empty states. */
export function EmptyArt({ tone = "violet" }: { tone?: "violet" | "coral" | "teal" }) {
  const c = { violet: "#5b3fa0", coral: "#d9675e", teal: "#23807f" }[tone];
  return (
    <svg viewBox="0 0 220 120" className="h-24 w-auto" aria-hidden>
      <line x1="10" y1="100" x2="210" y2="100" stroke="#e6dfd4" strokeWidth="2" />
      <path d="M58 100 C 50 70, 66 46, 76 40 L 84 40 C 94 46, 110 70, 102 100Z" fill="none" stroke={c} strokeWidth="1.6" />
      <ellipse cx="80" cy="40" rx="8" ry="2.5" fill="none" stroke={c} strokeWidth="1.4" />
      <circle cx="140" cy="84" r="16" fill={c} opacity=".18" />
      <circle cx="140" cy="84" r="16" fill="none" stroke={c} strokeWidth="1.6" />
      <rect x="166" y="70" width="26" height="30" rx="3" fill="none" stroke="#8c88a8" strokeWidth="1.4" />
    </svg>
  );
}
