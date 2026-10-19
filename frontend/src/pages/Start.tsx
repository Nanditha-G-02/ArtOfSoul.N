import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "../components/Avatar";
import { Backdrop, Brand } from "../components/Shell";
import { ErrorNote } from "../components/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useSpeaker } from "../lib/speech";
import type { Profile } from "../lib/types";

interface Opt { value: string | number; label: string; hint?: string }
interface Q { id: string; ask: string; kind: "single" | "multi" | "text"; options?: Opt[]; options_by_track?: Record<string, Opt[]>;
  allow_custom?: boolean; placeholder?: string; when?: Record<string, string> }

const NAME_Q: Q = { id: "name", ask: "First, what should I call you?", kind: "text", placeholder: "Your name" };
const WAIT = ["Reading your answers…", "Choosing the right skills in the right order…", "Writing lessons for your level…", "Adding practice for your daily time…", "Almost there…"];

export default function Start() {
  const nav = useNavigate();
  const { user, setProfile } = useSession();
  const voice = useSpeaker();
  const [qs, setQs] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({ name: user?.display_name === "Artist" ? "" : user?.display_name ?? "" });
  const [i, setI] = useState(0);
  const [custom, setCustom] = useState("");
  const [phase, setPhase] = useState<"ask" | "building" | "error">("ask");
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => { api.get<Q[]>("/api/journey/questions").then((q) => setQs([NAME_Q, ...q])).catch((e) => setError(e.message)); }, []);
  const visible = useMemo(() => qs.filter((q) => !q.when || Object.entries(q.when).every(([k, v]) => answers[k] === v)), [qs, answers]);
  const q = visible[i];
  const options = q?.options ?? q?.options_by_track?.[String(answers.track ?? "pencil")] ?? [];
  useEffect(() => { if (q && phase === "ask") voice.speak(q.ask); setCustom(""); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q?.id, phase]);
  useEffect(() => { if (phase !== "building") return; const t = setInterval(() => setTick((x) => x + 1), 6000); return () => clearInterval(t); }, [phase]);

  const value = q ? answers[q.id] : undefined;
  const canNext = q?.kind === "text" ? (q.id === "name" || String(value ?? "").trim().length >= 3)
    : q?.kind === "multi" ? (Array.isArray(value) && value.length > 0) || custom.trim().length > 1 : value !== undefined;

  function choose(v: string | number) {
    if (q.kind === "multi") {
      const cur = (answers[q.id] as (string | number)[]) ?? [];
      setAnswers({ ...answers, [q.id]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
    } else {
      setAnswers({ ...answers, [q.id]: v });
      setTimeout(() => setI((n) => n + 1), 280);
    }
  }

  async function next() {
    let a = answers;
    if (q.kind === "multi" && custom.trim()) { a = { ...a, [q.id]: [...((a[q.id] as string[]) ?? []), custom.trim()] }; setAnswers(a); }
    if (i + 1 < visible.length) { setI(i + 1); return; }
    await build(a);
  }

  async function build(a: Record<string, unknown>) {
    setPhase("building"); setError(null); voice.speak("Lovely. Give me a moment while I plan your lessons.");
    try {
      const p = await api.post<Profile>("/api/journey/answers", {
        name: a.name ?? "", track: a.track, medium: a.track === "painting" ? a.medium : null, level: a.level,
        artwork_types: a.artwork_types ?? [], goal: a.goal, daily_minutes: a.daily_minutes, techniques: a.techniques ?? [],
      });
      setProfile(p);
      await api.post("/api/syllabus", { goal: String(a.goal) });
      nav("/roadmap", { state: { fresh: true } });
    } catch (e) { setError((e as Error).message); setPhase("error"); voice.stop(); }
  }

  useEffect(() => { if (visible.length && i >= visible.length) setI(visible.length - 1); }, [visible.length, i]);

  return (
    <div className="min-h-dvh">
      <Backdrop />
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5"><Brand />
        <button className="btn-ghost text-sm" onClick={() => voice.setMuted(!voice.muted)} aria-pressed={!voice.muted}>{voice.muted ? "Voice off" : "Voice on"}</button></header>
      <main className="mx-auto grid max-w-5xl items-start gap-6 px-5 pb-16 md:grid-cols-[260px_1fr]">
        <div className="mx-auto md:sticky md:top-8"><Avatar mood={phase === "building" ? "thinking" : voice.speaking ? "talking" : "idle"} level={voice.level} size={240} /></div>

        <section>
          {phase === "ask" && q && <>
            <div className="mb-5 flex gap-1.5" aria-label={`Question ${i + 1} of ${visible.length}`}>
              {visible.map((_, k) => <span key={k} className={`h-2 flex-1 rounded-full transition-colors ${k <= i ? "bg-purple" : "bg-white"}`} />)}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={q.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
                <div className="relative mb-6 inline-block rounded-3xl rounded-tl-sm bg-white px-6 py-4 shadow-md">
                  <h1 className="text-[1.75rem] sm:text-[2.1rem]">{q.ask}</h1>
                </div>

                {q.kind === "text" ? (
                  <input autoFocus className="field py-4 text-lg" placeholder={q.placeholder} value={String(value ?? "")} maxLength={q.id === "name" ? 60 : 500}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" && canNext) next(); }} />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {options.map((o, k) => {
                      const sel = q.kind === "multi" ? ((value as unknown[]) ?? []).includes(o.value) : value === o.value;
                      const tint = ["from-lavender", "from-peach", "from-sky", "from-coral-soft"][k % 4];
                      return (
                        <motion.button key={String(o.value)} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} onClick={() => choose(o.value)} aria-pressed={sel}
                          className={`rounded-2xl bg-gradient-to-br ${tint} to-white p-5 text-left ring-2 transition ${sel ? "ring-purple" : "ring-transparent"}`}>
                          <span className="block text-lg font-bold">{o.label}</span>
                          {o.hint && <span className="text-sm text-ink-soft">{o.hint}</span>}
                        </motion.button>);
                    })}
                  </div>
                )}
                {q.allow_custom && <input className="field mt-3" placeholder="Something else? Type it here" value={custom} onChange={(e) => setCustom(e.target.value)} />}

                <div className="mt-8 flex justify-between">
                  <button className="btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
                  {(q.kind !== "single") && <button className="btn-primary" disabled={!canNext} onClick={next}>{i + 1 === visible.length ? "Make my plan" : q.id === "name" && !String(value ?? "").trim() ? "Skip" : "Next"}</button>}
                </div>
              </motion.div>
            </AnimatePresence>
          </>}

          {phase === "building" && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-6">
            <h1 className="text-[2rem]">Planning your lessons</h1>
            <AnimatePresence mode="wait"><motion.p key={tick} className="mt-3 text-lg text-ink-soft" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {WAIT[Math.min(tick, WAIT.length - 1)]}</motion.p></AnimatePresence>
            <div className="mt-6 h-2 w-full max-w-md overflow-hidden rounded-full bg-white">
              <motion.div className="h-full w-1/3 rounded-full bg-gradient-to-r from-purple via-coral to-teal" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
            </div>
            <p className="mt-6 text-sm text-ink-faint">The AI runs on your computer, so this can take a few minutes. Keep this tab open.</p>
          </motion.div>}

          {phase === "error" && <div className="pt-6">
            <h1 className="text-[2rem]">I couldn't finish your plan</h1>
            <div className="mt-4"><ErrorNote message={error} /></div>
            <div className="mt-6 flex gap-3"><button className="btn-primary" onClick={() => build(answers)}>Try again</button>
              <button className="btn-ghost" onClick={() => { setPhase("ask"); setI(0); }}>Change my answers</button></div>
          </div>}
          {phase === "ask" && !q && <ErrorNote message={error} />}
        </section>
      </main>
    </div>
  );
}
