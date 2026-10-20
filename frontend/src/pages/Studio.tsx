import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import Avatar, { type Mood } from "../components/Avatar";
import Demo from "../components/Demos";
import { ColorMixer, Flashcards, OrderSteps, Quiz, SketchPad, ValueMatch, type Question } from "../components/Interactive";
import { ErrorNote, List, Loading, Prose } from "../components/ui";
import { api, mediaUrl } from "../lib/api";
import { minutes, useFetch } from "../lib/hooks";
import { useSession } from "../lib/session";
import { useSpeaker } from "../lib/speech";
import type { AiStatus, Lesson, Message, Reference } from "../lib/types";
import { TUTOR } from "../lib/tutor";

interface Step { title: string; say: string; do: string; demo: string; image_prompt: string }
interface Script {
  intro: string; concept: { summary: string; why_it_works: string }; steps: Step[]; tips: string[]; common_mistakes: string[];
  check: Question | null; quiz?: Question[]; terms?: { term: string; meaning: string }[];
  practice: { task: string; minutes: number; success_criteria: string[] }; next_hint: string;
}
interface Payload { lesson: Lesson; script: Script | null; model: string | null; visuals: Record<string, Reference> }
type SegKind = "intro" | "concept" | "terms" | "step" | "order" | "lab" | "quiz" | "practice";
type Seg = { kind: SegKind; say: string; step?: number; label: string };
const INTERACTIVE: SegKind[] = ["order", "lab", "quiz"];  // narrated playback pauses here for the learner

function quizOf(s: Script): Question[] { return s.quiz?.length ? s.quiz : s.check ? [s.check] : []; }

function segments(s: Script, track: string | null): Seg[] {
  const lab = track === "painting" ? "Let's mix some colour. Match each target using only a few pigments."
    : "Let's train your eye for values. Match each small square to the scale — and watch out, the surroundings will try to trick you.";
  return [
    { kind: "intro", say: s.intro, label: "Welcome" },
    { kind: "concept", say: `${s.concept.summary} ${s.concept.why_it_works}`, label: "The idea" },
    ...(s.terms?.length ? [{ kind: "terms" as const, say: "Here are a few key words. Tap each card to see what it means.", label: "Key words" }] : []),
    ...s.steps.map((st, i) => ({ kind: "step" as const, say: `${st.say} ${st.do}`, step: i, label: `Step ${i + 1}` })),
    ...(s.steps.length >= 3 ? [{ kind: "order" as const, say: "Quick challenge: put the steps we just did back in the right order.", label: "Order" }] : []),
    { kind: "lab", say: lab, label: track === "painting" ? "Colour lab" : "Value lab" },
    ...(quizOf(s).length ? [{ kind: "quiz" as const, say: `Time for a quick quiz. ${quizOf(s)[0].question}`, label: "Quiz" }] : []),
    { kind: "practice", say: `Now it's your turn. ${s.practice.task}`, label: "Practice" },
  ];
}

export default function Studio() {
  const { lessonId } = useParams();
  const progress = useFetch<{ current_lesson: Lesson | null }>(lessonId ? null : "/api/progress");
  if (!lessonId) {
    if (progress.loading) return <Loading label="Finding your lesson" />;
    if (progress.data?.current_lesson) return <Navigate to={`/studio/${progress.data.current_lesson.id}`} replace />;
    return <div className="py-16 text-center"><h1 className="text-3xl">No lesson in progress</h1>
      <Link to="/roadmap" className="btn-big mt-6">Open my roadmap</Link></div>;
  }
  return <Lessonroom key={lessonId} id={lessonId} />;
}

function Lessonroom({ id }: { id: string }) {
  const nav = useNavigate();
  const { profile } = useSession();
  const voice = useSpeaker();
  const ai = useFetch<AiStatus>("/api/system/ai-status");
  const [data, setData] = useState<Payload | null>(null);
  const [phase, setPhase] = useState<"loading" | "preparing" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [bubble, setBubble] = useState("");
  const [cleared, setCleared] = useState<Set<number>>(new Set());  // interactive parts the learner has finished
  const [celebrate, setCelebrate] = useState(false);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgErr, setImgErr] = useState<string | null>(null);
  const [ask, setAsk] = useState("");
  const [askBusy, setAskBusy] = useState(false);
  const convo = useRef<number | null>(null);
  const playRef = useRef(false);

  const prepare = useCallback(async (regenerate = false) => {
    setPhase("preparing"); setError(null);
    try {
      const p = await api.post<Payload>(`/api/lessons/${id}/script${regenerate ? "?regenerate=true" : ""}`);
      setData(p); setI(0); setCleared(new Set()); setPhase("ready");
    } catch (e) { setError((e as Error).message); setPhase("error"); }
  }, [id]);

  useEffect(() => {
    api.get<Payload>(`/api/lessons/${id}/script`).then((p) => {
      if (p.script) { setData(p); setPhase("ready"); } else { setData(p); prepare(); }
    }).catch((e) => { setError(e.message); setPhase("error"); });
    return () => { playRef.current = false; };
  }, [id, prepare]);

  const segs = data?.script ? segments(data.script, profile?.track ?? null) : [];
  const seg = segs[i];

  const say = useCallback(async (text: string) => {
    setBubble(text);
    if (voice.muted) await new Promise((r) => setTimeout(r, Math.max(2500, text.split(" ").length * 330)));
    else await voice.speak(text);
  }, [voice]);

  // speak the segment when it changes (manual navigation)
  useEffect(() => { if (seg && !playRef.current) say(seg.say); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [i, phase]);

  async function play() {
    if (playing) { playRef.current = false; setPlaying(false); voice.stop(); return; }
    playRef.current = true; setPlaying(true);
    for (let k = i; k < segs.length && playRef.current; k++) {
      setI(k);
      await say(segs[k].say);
      if (!playRef.current) break;
      if (INTERACTIVE.includes(segs[k].kind) && !cleared.has(k)) break; // wait for the learner
      await new Promise((r) => setTimeout(r, 700));
    }
    playRef.current = false; setPlaying(false);
  }

  function go(n: number) { playRef.current = false; setPlaying(false); voice.stop(); setSketchOpen(false); setI(Math.max(0, Math.min(segs.length - 1, n))); }

  function finish(kind: "order_steps" | "value_match" | "color_mix" | "flashcards", score?: number, total?: number) {
    setCleared((c) => new Set(c).add(i));
    if (score !== undefined && total) {
      const good = score / total >= 0.8;
      if (good) { setCelebrate(true); setTimeout(() => setCelebrate(false), 2500); }
      say(good ? `Brilliant, ${score} out of ${total}!` : `${score} out of ${total}. Nice effort — you can play again any time.`);
    }
    api.post(`/api/lessons/${id}/activity`, { kind, score, total }).catch(() => {});
  }

  async function picture(step: number) {
    setImgBusy(true); setImgErr(null);
    try {
      const ref = await api.post<Reference>(`/api/lessons/${id}/steps/${step}/visual`);
      setData((d) => d ? { ...d, visuals: { ...d.visuals, [step]: ref } } : d);
    } catch (e) { setImgErr((e as Error).message); } finally { setImgBusy(false); }
  }

  async function sendQuestion() {
    if (!ask.trim()) return;
    setAskBusy(true); setBubble("Let me think about that…");
    try {
      if (!convo.current) convo.current = (await api.post<{ id: number }>(`/api/conversations?lesson_id=${id}`)).id;
      const msgs = await api.post<Message[]>(`/api/conversations/${convo.current}/messages`, { text: ask });
      setAsk("");
      const reply = msgs[msgs.length - 1].content;
      await say(reply);
    } catch (e) { setBubble(""); setError((e as Error).message); } finally { setAskBusy(false); }
  }

  if (phase === "loading") return <Loading label="Opening the studio" />;

  const mood: Mood = phase === "preparing" || askBusy || imgBusy ? "thinking" : voice.speaking ? "talking"
    : celebrate ? "happy" : "idle";
  const visual = seg?.kind === "step" && seg.step !== undefined ? data?.visuals[String(seg.step)] : undefined;
  const imagesOn = ai.data?.image?.configured;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* teacher column */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="relative mx-auto w-fit">
          <Avatar mood={mood} level={voice.level} size={typeof window !== "undefined" && window.innerWidth < 640 ? 160 : 250} tool={profile?.track === "painting" ? "brush" : "pencil"} />
        </div>
        <AnimatePresence mode="wait">
          {(bubble || phase === "preparing") && <motion.div key={bubble.slice(0, 40) || "prep"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="relative mt-8 max-h-72 overflow-y-auto rounded-3xl bg-white/90 p-4 text-[15.5px] shadow-md" aria-live="polite">
            {phase === "preparing" ? "I'm preparing this lesson for you — on a laptop this can take a minute or two." : <Prose text={bubble} />}
          </motion.div>}
        </AnimatePresence>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm">
          <button className="btn-ghost px-4 py-2 text-sm" onClick={() => voice.setMuted(!voice.muted)} aria-pressed={!voice.muted}>{voice.muted ? "Voice off" : "Voice on"}</button>
          {!voice.muted && <span className="text-xs text-ink-faint">{voice.engine === "piper" ? "Local Piper voice" : voice.engine === "browser" ? "Built-in system voice" : ""}</span>}
        </div>
        {phase === "ready" && <div className="mt-4 flex gap-2">
          <label htmlFor="ask" className="sr-only">Ask your teacher</label>
          <input id="ask" className="field" placeholder={`Ask ${TUTOR.name} about this lesson…`} value={ask} onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendQuestion(); }} disabled={askBusy} />
          <button className="btn-primary px-4" onClick={sendQuestion} disabled={askBusy || !ask.trim()}>Ask</button>
        </div>}
      </aside>

      {/* lesson column */}
      <section>
        {data && <>
          <p className="text-sm font-bold text-meadow">{data.lesson.stage_title} · {minutes(data.lesson.est_minutes)}</p>
          <h1 className="text-[2.1rem] leading-tight">{data.lesson.title}</h1>
        </>}

        {phase === "preparing" && <div className="mt-8 grid h-72 place-items-center glass"><Loading label="Writing your lesson" /></div>}
        {phase === "error" && <div className="mt-6 space-y-3"><ErrorNote message={error} /><button className="btn-primary" onClick={() => prepare()}>Try again</button></div>}

        {phase === "ready" && data?.script && seg && <>
          {/* progress dots */}
          <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Lesson steps">
            {segs.map((s, k) => <button key={k} role="tab" aria-selected={k === i} onClick={() => go(k)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${k === i ? "bg-ink text-white" : k < i || cleared.has(k) ? "bg-meadow-soft text-meadow" : "bg-white/80 text-ink-soft"}`}>
              {INTERACTIVE.includes(s.kind) && <span aria-hidden className="mr-1">●</span>}{s.label}</button>)}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}
              className="mt-5 glass p-5 shadow-sm sm:p-7">
              {seg.kind === "intro" && <><h2 className="text-2xl">Welcome to this lesson</h2><p className="mt-2 text-lg">{data.script.intro}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">{data.lesson.objectives.slice(0, 4).map((o, k) => <div key={k} className="rounded-2xl bg-meadow-soft/80 p-3 text-[15px]">{o}</div>)}</div></>}

              {seg.kind === "concept" && <><h2 className="text-2xl">The idea</h2><p className="mt-2 text-lg">{data.script.concept.summary}</p>
                <p className="mt-3 rounded-2xl bg-sky/60 p-4 text-[15.5px]"><strong>Why it works: </strong>{data.script.concept.why_it_works}</p></>}

              {seg.kind === "step" && seg.step !== undefined && (() => { const st = data.script!.steps[seg.step]; return <>
                <p className="text-sm text-ink-faint">Step {seg.step + 1} of {data.script!.steps.length}</p>
                <h2 className="text-2xl">{st.title}</h2>
                <div className="mt-4 grid gap-5 md:grid-cols-[1.2fr_1fr]">
                  <div className="aspect-[10/7]">
                    {visual ? <figure className="flex h-full flex-col"><img src={mediaUrl(visual.url)} alt={st.image_prompt} className="h-full w-full rounded-2xl object-cover" />
                      <figcaption className="mt-2 text-center text-sm"><span className="chip bg-amber-soft text-[#8a6418]">AI-generated reference</span></figcaption></figure>
                      : <Demo id={st.demo} />}
                  </div>
                  <div>
                    <p className="text-lg">{st.say}</p>
                    <p className="mt-3 rounded-2xl bg-peach/70 p-4 font-bold">Try it: <span className="font-normal">{st.do}</span></p>
                    {!visual && imagesOn && <button className="btn-outline mt-4 text-sm" disabled={imgBusy} onClick={() => picture(seg.step!)}>{imgBusy ? "Generating…" : "Show me a picture"}</button>}
                    {!visual && imagesOn === false && <p className="mt-4 text-xs text-ink-faint">Showing an animated demonstration. Generated pictures are optional (see Progress → Setup).</p>}
                    {imgErr && <div className="mt-3"><ErrorNote message={imgErr} /></div>}
                    <button className="btn-big mt-4 py-2.5 text-sm" onClick={() => setSketchOpen(!sketchOpen)} aria-expanded={sketchOpen}>
                      {sketchOpen ? "Close sketch pad" : "Try it here on the sketch pad"}</button>
                  </div>
                </div>
                <AnimatePresence>{sketchOpen && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden">
                  <SketchPad lessonId={id} track={profile?.track ?? null} prompt={`${st.title}: ${st.do}`} /></motion.div>}</AnimatePresence>
              </>; })()}

              {seg.kind === "terms" && data.script.terms && <Flashcards terms={data.script.terms} onDone={() => finish("flashcards")} />}

              {seg.kind === "order" && <OrderSteps steps={data.script.steps.map((st) => st.title)} onDone={(sc, t) => finish("order_steps", sc, t)} />}

              {seg.kind === "lab" && (profile?.track === "painting"
                ? <ColorMixer medium={profile?.medium ?? null} onDone={(sc, t) => finish("color_mix", sc, t)} />
                : <ValueMatch onDone={(sc, t) => finish("value_match", sc, t)} />)}

              {seg.kind === "quiz" && <Quiz lessonId={id} questions={quizOf(data.script)}
                onAnswer={(ok, ex) => { say(`${ok ? "Yes, exactly!" : "Not quite."} ${ex}`); if (ok) { setCelebrate(true); setTimeout(() => setCelebrate(false), 1800); } }}
                onDone={() => setCleared((c) => new Set(c).add(i))} />}

              {seg.kind === "practice" && <>
                <h2 className="text-2xl">Your practice</h2>
                <p className="mt-2 text-lg">{data.script.practice.task}</p>
                <p className="mt-1 text-sm text-ink-soft">About {minutes(data.script.practice.minutes)}</p>
                <h3 className="mt-4 font-bold">You've got it when</h3><List items={data.script.practice.success_criteria} />
                {!!data.script.common_mistakes.length && <><h3 className="mt-4 font-bold">Watch out for</h3><List items={data.script.common_mistakes} /></>}
                {!!data.script.tips.length && <><h3 className="mt-4 font-bold">Tips</h3><List items={data.script.tips} /></>}
                <button className="btn-big mt-6" onClick={() => nav(`/practice/${id}`)}>I've practised — get feedback</button>
              </>}
            </motion.div>
          </AnimatePresence>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button className="btn-ghost" disabled={i === 0} onClick={() => go(i - 1)}>Back</button>
            <button className="btn-primary" onClick={play}>{playing ? "Pause" : i === 0 ? "Play narrated lesson" : "Continue playing"}</button>
            <button className="btn-outline" disabled={i === segs.length - 1} onClick={() => go(i + 1)}>{INTERACTIVE.includes(seg.kind) && !cleared.has(i) ? "Skip" : "Next"}</button>
            <span className="ml-auto text-xs text-ink-faint">Narrated, animated slides · written by {data?.model}
              <button className="ml-2 underline" onClick={() => prepare(true)}>Rewrite lesson</button></span>
          </div>
        </>}
      </section>
    </div>
  );
}
