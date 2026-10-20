import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { api } from "../lib/api";
import type { Analysis, Artwork } from "../lib/types";
import { TUTOR } from "../lib/tutor";

/* ------------------------------------------------------------------ colour maths (pigment-style mixing) */
const toLin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toSrgb = (c: number) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (rgb: number[]) => "#" + rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");

/** Weighted geometric mean of reflectance — behaves like paint (yellow + blue → green), unlike averaging light. */
export function mixPigments(parts: { hex: string; parts: number }[]): string {
  const total = parts.reduce((n, p) => n + p.parts, 0);
  if (!total) return "#ffffff";
  const out = [0, 1, 2].map((ch) => {
    let logSum = 0;
    for (const p of parts) if (p.parts) logSum += (p.parts / total) * Math.log(Math.max(toLin(hexToRgb(p.hex)[ch]), 0.002));
    return toSrgb(Math.exp(logSum));
  });
  return rgbToHex(out);
}

function lab(hex: string) {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, Y = r * 0.2126 + g * 0.7152 + b * 0.0722, Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
export const deltaE = (a: string, b: string) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

function useRng(seed: number) { return useMemo(() => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }, [seed]); }

function Shell({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return <div><h2 className="text-2xl">{title}</h2><p className="mt-1 text-ink-soft">{hint}</p><div className="mt-5">{children}</div></div>;
}

function Score({ score, total, onAgain }: { score: number; total: number; onAgain?: () => void }) {
  const great = score / total >= 0.8;
  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl bg-meadow-soft/80 p-4">
      <span className="font-display text-3xl font-bold">{score}/{total}</span>
      <span className="text-[15px]">{great ? "Excellent eye!" : score / total >= 0.5 ? "Good — a little more practice will lock it in." : "Tricky one. Try again and look more slowly."}</span>
      {onAgain && <button className="btn-outline ml-auto py-2" onClick={onAgain}>Play again</button>}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ flashcards */
export function Flashcards({ terms, onDone }: { terms: { term: string; meaning: string }[]; onDone: () => void }) {
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  useEffect(() => { if (terms.length && flipped.size === terms.length) onDone(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [flipped.size]);
  return (
    <Shell title="Key words" hint="Tap each card to flip it.">
      <div className="grid gap-3 sm:grid-cols-2" style={{ perspective: 900 }}>
        {terms.map((t, i) => {
          const on = flipped.has(i);
          return (
            <motion.button key={i} onClick={() => setFlipped(new Set(flipped).add(i))} animate={{ rotateY: on ? 180 : 0 }} transition={{ duration: 0.5 }}
              className="relative h-32 rounded-2xl text-left" style={{ transformStyle: "preserve-3d" }} aria-label={on ? `${t.term}: ${t.meaning}` : `Flip card: ${t.term}`}>
              <span className="absolute inset-0 grid place-items-center rounded-2xl bg-ink p-4 text-center text-xl font-bold text-white" style={{ backfaceVisibility: "hidden" }}>{t.term}</span>
              <span className="absolute inset-0 grid place-items-center rounded-2xl bg-white p-4 text-center text-[15px]" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>{t.meaning}</span>
            </motion.button>);
        })}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ order the steps */
export function OrderSteps({ steps, onDone }: { steps: string[]; onDone: (score: number, total: number) => void }) {
  const [seed, setSeed] = useState(1);
  const shuffled = useMemo(() => {
    const idx = steps.map((_, i) => i);
    for (let k = 0; k < 20 && idx.every((v, i) => v === i); k++) idx.sort(() => Math.random() - 0.5);
    return idx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, seed]);
  const [picked, setPicked] = useState<number[]>([]);
  const done = picked.length === steps.length;
  const score = picked.filter((v, i) => v === i).length;
  useEffect(() => { if (done) onDone(score, steps.length); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [done]);
  return (
    <Shell title="Put the steps in order" hint="Tap the steps in the order you'd actually do them.">
      <div className="flex flex-wrap gap-2">
        {shuffled.filter((i) => !picked.includes(i)).map((i) => (
          <motion.button layout key={i} whileTap={{ scale: 0.96 }} onClick={() => setPicked([...picked, i])}
            className="rounded-full bg-white px-4 py-2.5 text-[15px] font-semibold shadow-sm hover:ring-2 hover:ring-ink/20">{steps[i]}</motion.button>))}
      </div>
      <ol className="mt-4 space-y-2">
        {picked.map((v, k) => (
          <motion.li layout key={v} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 ${!done ? "bg-white/80" : v === k ? "bg-meadow-soft" : "bg-rose"}`}>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-sm font-bold text-white">{k + 1}</span>{steps[v]}
            {done && v !== k && <span className="ml-auto text-sm text-ink-soft">should be step {v + 1}</span>}
          </motion.li>))}
      </ol>
      {!done && picked.length > 0 && <button className="btn-ghost mt-2 py-2 text-sm" onClick={() => setPicked(picked.slice(0, -1))}>Undo</button>}
      {done && <Score score={score} total={steps.length} onAgain={() => { setPicked([]); setSeed(seed + 1); }} />}
    </Shell>
  );
}

/* ------------------------------------------------------------------ value matching */
const SCALE = Array.from({ length: 9 }, (_, i) => rgbToHex(Array(3).fill(Math.round(245 - i * (245 - 28) / 8))));
export function ValueMatch({ onDone }: { onDone: (score: number, total: number) => void }) {
  const ROUNDS = 5;
  const [seed, setSeed] = useState(7 + Math.floor(Math.random() * 1000));
  const rnd = useRng(seed);
  const rounds = useMemo(() => Array.from({ length: ROUNDS }, () => ({ target: 1 + Math.floor(rnd() * 7), surround: Math.floor(rnd() * 9) })), [rnd]);
  const [r, setR] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const cur = rounds[r];
  const done = answers.length === ROUNDS;
  const score = answers.filter((a, k) => Math.abs(a - rounds[k].target) <= 0).length;
  const near = answers.filter((a, k) => Math.abs(a - rounds[k].target) === 1).length;
  function pick(v: number) {
    const next = [...answers, v];
    setAnswers(next);
    if (next.length === ROUNDS) onDone(next.filter((a, k) => a === rounds[k].target).length, ROUNDS);
    else setTimeout(() => setR(r + 1), 900);
  }
  return (
    <Shell title="Value-matching game" hint="Which step on the scale matches the small square? The surrounding tone tries to fool your eye — squint!">
      {!done ? <div className="grid items-center gap-6 md:grid-cols-[220px_1fr]">
        <div className="grid aspect-square place-items-center rounded-2xl" style={{ background: SCALE[cur.surround] }}>
          <motion.div key={r} initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="h-20 w-20 rounded-lg" style={{ background: SCALE[cur.target] }} />
        </div>
        <div>
          <p className="mb-2 text-sm text-ink-soft">Round {r + 1} of {ROUNDS}</p>
          <div className="flex overflow-hidden rounded-xl">
            {SCALE.map((c, v) => {
              const answered = answers.length > r;
              const ring = answered && v === cur.target ? "ring-4 ring-meadow z-10" : answered && v === answers[r] ? "ring-4 ring-bloom z-10" : "";
              return <button key={v} disabled={answered} onClick={() => pick(v)} className={`relative h-20 flex-1 ${ring}`} style={{ background: c }} aria-label={`Value ${v + 1}`}>
                <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 text-xs ${v > 4 ? "text-white/80" : "text-ink/60"}`}>{v + 1}</span></button>;
            })}
          </div>
          {answers.length > r && <p className="mt-3 text-[15px]">{answers[r] === cur.target ? "Spot on." : `It was ${cur.target + 1}. ${Math.abs(answers[r] - cur.target) === 1 ? "Very close!" : "The surround shifted how it looked."}`}</p>}
        </div>
      </div> : <>
        <p className="text-[15px]">Exact matches: {score} · one step away: {near}. A light surround makes a value look darker, and a dark surround makes it look lighter — so always judge values against their neighbours.</p>
        <Score score={score} total={ROUNDS} onAgain={() => { setAnswers([]); setR(0); setSeed(seed + 1); }} />
      </>}
    </Shell>
  );
}

/* ------------------------------------------------------------------ colour mixing */
const PIGMENTS: Record<string, { name: string; hex: string }[]> = {
  watercolor: [{ name: "Lemon yellow", hex: "#f3d23a" }, { name: "Permanent rose", hex: "#d2386c" }, { name: "Ultramarine", hex: "#2d3f9e" },
    { name: "Burnt sienna", hex: "#9b4a2a" }, { name: "Water (paper white)", hex: "#fbf8f2" }],
  default: [{ name: "Cadmium yellow", hex: "#f2c230" }, { name: "Cadmium red", hex: "#cf2f2a" }, { name: "Ultramarine", hex: "#2a3d9a" },
    { name: "Burnt sienna", hex: "#9a4a2a" }, { name: "Titanium white", hex: "#f7f5f0" }],
};
export function ColorMixer({ medium, onDone }: { medium: string | null; onDone: (score: number, total: number) => void }) {
  const ROUNDS = 3;
  const pigs = PIGMENTS[medium === "watercolor" ? "watercolor" : "default"];
  const [seed, setSeed] = useState(11 + Math.floor(Math.random() * 1000));
  const rnd = useRng(seed);
  const targets = useMemo(() => Array.from({ length: ROUNDS }, () => {
    const parts = pigs.map(() => 0);
    const n = 2 + Math.floor(rnd() * 2);
    for (let k = 0; k < n; k++) parts[Math.floor(rnd() * pigs.length)] += 1 + Math.floor(rnd() * 3);
    return mixPigments(pigs.map((p, i) => ({ hex: p.hex, parts: parts[i] })));
  }), [rnd, pigs]);
  const [r, setR] = useState(0);
  const [parts, setParts] = useState(pigs.map(() => 0));
  const [results, setResults] = useState<number[]>([]);
  const mixed = mixPigments(pigs.map((p, i) => ({ hex: p.hex, parts: parts[i] })));
  const dE = deltaE(mixed, targets[r] ?? "#ffffff");
  const done = results.length === ROUNDS;
  const verdict = (d: number) => (d < 8 ? "Excellent match" : d < 16 ? "Close" : d < 28 ? "Getting there" : "Far off");
  function submit() {
    const next = [...results, dE];
    setResults(next);
    if (next.length === ROUNDS) onDone(next.filter((d) => d < 16).length, ROUNDS);
    else { setR(r + 1); setParts(pigs.map(() => 0)); }
  }
  return (
    <Shell title="Colour-mixing challenge" hint={`Mix the target with your limited palette. Add "parts" of each pigment — just like on a real palette.${medium === "watercolor" ? " In watercolour, water lightens instead of white." : ""}`}>
      {!done ? <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <div className="flex gap-3">
          <figure className="flex-1"><div className="aspect-square rounded-2xl shadow-inner" style={{ background: targets[r] }} /><figcaption className="mt-1 text-center text-sm">Target {r + 1}/{ROUNDS}</figcaption></figure>
          <figure className="flex-1"><motion.div className="aspect-square rounded-2xl shadow-inner" animate={{ background: mixed }} /><figcaption className="mt-1 text-center text-sm">Your mix</figcaption></figure>
        </div>
        <div className="space-y-2.5">
          {pigs.map((p, i) => (
            <div key={p.name} className="flex items-center gap-3">
              <span className="h-7 w-7 shrink-0 rounded-full ring-2 ring-white" style={{ background: p.hex }} />
              <span className="w-36 text-sm">{p.name}</span>
              <button className="h-8 w-8 rounded-full bg-white font-bold" onClick={() => setParts(parts.map((v, k) => (k === i ? Math.max(0, v - 1) : v)))} aria-label={`Less ${p.name}`}>−</button>
              <span className="w-5 text-center font-bold">{parts[i]}</span>
              <button className="h-8 w-8 rounded-full bg-ink font-bold text-white" onClick={() => setParts(parts.map((v, k) => (k === i ? Math.min(9, v + 1) : v)))} aria-label={`More ${p.name}`}>+</button>
            </div>))}
          <p className="pt-1 text-sm text-ink-soft">{parts.some(Boolean) ? `${verdict(dE)} (difference ${dE.toFixed(0)})` : "Add some paint to start."}</p>
          <button className="btn-big" disabled={!parts.some(Boolean)} onClick={submit}>Lock in this mix</button>
        </div>
      </div> : <>
        <div className="flex gap-3">{targets.map((t, k) => <div key={k} className="text-center text-sm"><div className="h-14 w-14 rounded-xl" style={{ background: t }} />{verdict(results[k])}</div>)}</div>
        <Score score={results.filter((d) => d < 16).length} total={ROUNDS} onAgain={() => { setResults([]); setR(0); setParts(pigs.map(() => 0)); setSeed(seed + 1); }} />
      </>}
    </Shell>
  );
}

/* ------------------------------------------------------------------ quiz */
export interface Question { question: string; options: string[]; answer_index: number; explanation: string }
export function Quiz({ lessonId, questions, onAnswer, onDone }: {
  lessonId: string; questions: Question[]; onAnswer: (correct: boolean, explanation: string) => void; onDone: (score: number) => void }) {
  const [q, setQ] = useState(0);
  const [res, setRes] = useState<{ choice: number; correct: boolean; answer_index: number; explanation: string }[]>([]);
  const cur = questions[q];
  const answered = res[q];
  async function choose(choice: number) {
    const r = await api.post<{ correct: boolean; answer_index: number; explanation: string }>(`/api/lessons/${lessonId}/check`, { choice, question: q });
    const next = [...res]; next[q] = { choice, ...r }; setRes(next);
    onAnswer(r.correct, r.explanation);
    if (q === questions.length - 1) onDone(next.filter((x) => x?.correct).length);
  }
  return (
    <Shell title="Quick quiz" hint={`Question ${q + 1} of ${questions.length}`}>
      <AnimatePresence mode="wait">
        <motion.div key={q} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
          <p className="text-lg font-semibold">{cur.question}</p>
          <div className={`mt-4 grid gap-3 ${cur.options.length === 2 ? "grid-cols-2" : ""}`}>
            {cur.options.map((o, k) => {
              const st = !answered ? "bg-white hover:ring-ink/20" : k === answered.answer_index ? "bg-meadow-soft ring-meadow" : k === answered.choice ? "bg-rose ring-bloom" : "bg-white opacity-50";
              return <motion.button key={k} whileTap={{ scale: 0.98 }} disabled={!!answered} onClick={() => choose(k)}
                className={`rounded-2xl p-4 text-left text-[16px] ring-2 ring-transparent ${st}`}>{o}</motion.button>;
            })}
          </div>
          {answered && <p className="mt-4 text-[15.5px]"><strong>{answered.correct ? "Correct! " : "Not quite. "}</strong>{answered.explanation}</p>}
        </motion.div>
      </AnimatePresence>
      {answered && q < questions.length - 1 && <button className="btn-big mt-5" onClick={() => setQ(q + 1)}>Next question</button>}
      {answered && q === questions.length - 1 && <Score score={res.filter((x) => x?.correct).length} total={questions.length} />}
    </Shell>
  );
}

/* ------------------------------------------------------------------ sketch pad */
const GRADES = [{ g: "2H", a: 0.25, w: 1.6 }, { g: "HB", a: 0.45, w: 2.2 }, { g: "2B", a: 0.7, w: 3 }, { g: "6B", a: 0.95, w: 4.5 }];
const PAINT = ["#16161d", "#4f7032", "#ef6a3f", "#8a6fd0", "#3f6f8f", "#c2923a", "#f2c230", "#ffffff"];
type Stroke = { pts: [number, number, number][]; color: string; alpha: number; width: number; erase: boolean };

export function SketchPad({ lessonId, track, prompt }: { lessonId: string; track: string | null; prompt: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const drawing = useRef<Stroke | null>(null);
  const pencil = track !== "painting";
  const [grade, setGrade] = useState(1);
  const [color, setColor] = useState(PAINT[1]);
  const [size, setSize] = useState(10);
  const [erase, setErase] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState<Analysis | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { redraw(strokes); }, [strokes]);

  function redraw(list: Stroke[]) {
    const c = canvas.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; ctx.fillStyle = pencil ? "#fbfaf7" : "#fdfbf6"; ctx.fillRect(0, 0, c.width, c.height);
    for (const s of list) drawStroke(ctx, s);
  }
  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (let i = 1; i < s.pts.length; i++) {
      const [x0, y0] = s.pts[i - 1], [x1, y1, p] = s.pts[i];
      ctx.globalAlpha = s.erase ? 1 : s.alpha * (0.5 + p * 0.7);
      ctx.strokeStyle = s.erase ? (pencil ? "#fbfaf7" : "#fdfbf6") : s.color;
      ctx.lineWidth = s.width * (0.6 + p * 0.9);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
  }
  const pos = (e: PointerEvent<HTMLCanvasElement>): [number, number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 800, ((e.clientY - r.top) / r.height) * 600, e.pressure && e.pointerType === "pen" ? e.pressure : 0.5];
  };
  function down(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const g = GRADES[grade];
    drawing.current = { pts: [pos(e)], erase, color: pencil ? "#2b2b30" : color, alpha: pencil ? g.a : 0.85, width: erase ? 22 : pencil ? g.w : size };
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    const s = drawing.current; if (!s) return;
    s.pts.push(pos(e));
    const ctx = canvas.current!.getContext("2d")!;
    drawStroke(ctx, { ...s, pts: s.pts.slice(-2) });
  }
  function up() { if (drawing.current && drawing.current.pts.length > 1) setStrokes([...strokes, drawing.current]); drawing.current = null; }

  async function send() {
    setBusy(true); setErr(null); setFb(null);
    try {
      const blob: Blob = await new Promise((res) => canvas.current!.toBlob((b) => res(b!), "image/png"));
      const f = new FormData(); f.append("file", blob, "sketch.png"); f.append("title", "Sketch pad study"); f.append("lesson_id", lessonId);
      f.append("exercise_context", `Quick sketch-pad exercise: ${prompt}`);
      const art = await api.upload<Artwork>("/api/artworks", f);
      setFb(await api.post<Analysis>(`/api/artworks/${art.id}/analyze`, {}));
      api.post(`/api/lessons/${lessonId}/activity`, { kind: "sketch" }).catch(() => {});
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl bg-white/70 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        {pencil ? GRADES.map((g, i) => <button key={g.g} onClick={() => { setGrade(i); setErase(false); }} className={`rounded-full px-3 py-1 font-semibold ${!erase && grade === i ? "bg-ink text-white" : "bg-white"}`}>{g.g}</button>)
          : <>{PAINT.map((c) => <button key={c} onClick={() => { setColor(c); setErase(false); }} aria-label={`Colour ${c}`} className={`h-7 w-7 rounded-full ring-2 ${!erase && color === c ? "ring-ink" : "ring-white"}`} style={{ background: c }} />)}
            <input type="range" min={3} max={30} value={size} onChange={(e) => setSize(+e.target.value)} aria-label="Brush size" className="w-24 accent-ink" /></>}
        <button onClick={() => setErase(!erase)} className={`rounded-full px-3 py-1 font-semibold ${erase ? "bg-ink text-white" : "bg-white"}`}>Eraser</button>
        <button onClick={() => setStrokes(strokes.slice(0, -1))} className="rounded-full bg-white px-3 py-1 font-semibold" disabled={!strokes.length}>Undo</button>
        <button onClick={() => setStrokes([])} className="rounded-full bg-white px-3 py-1 font-semibold" disabled={!strokes.length}>Clear</button>
      </div>
      <canvas ref={canvas} width={800} height={600} className="aspect-[4/3] w-full touch-none rounded-xl shadow-inner" style={{ cursor: "crosshair" }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-label="Sketch pad: draw with your mouse, finger or pen" />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button className="btn-big py-2.5 text-sm" disabled={busy || strokes.length < 3} onClick={send}>{busy ? `${TUTOR.name} is looking…` : `Show ${TUTOR.name} my sketch`}</button>
        <span className="text-xs text-ink-faint">{pencil ? "Pick a grade: 2H is light and hard, 6B soft and dark." : "Pick a colour and brush size."} A pen or tablet adds pressure.</span>
      </div>
      {err && <p className="mt-2 text-sm text-[#8f3a33]">{err}</p>}
      {fb && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 grid gap-2 text-[15px] sm:grid-cols-2">
        {fb.image_suitable ? <>
          <div className="rounded-xl bg-meadow-soft/80 p-3"><strong>Good: </strong>{fb.strengths[0]?.point ?? "Nothing specific confirmed yet."}</div>
          <div className="rounded-xl bg-rose/80 p-3"><strong>Next: </strong>{fb.improvements[0]?.issue ?? "Keep going — add more of the exercise."}</div>
        </> : <div className="rounded-xl bg-amber-soft p-3 sm:col-span-2">{fb.limitations[0] ?? "I couldn't judge this sketch yet."}</div>}
      </motion.div>}
    </div>
  );
}
