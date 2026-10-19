import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import Avatar, { type Mood } from "../components/Avatar";
import Demo from "../components/Demos";
import { ErrorNote, List, Loading, Prose } from "../components/ui";
import { api, mediaUrl } from "../lib/api";
import { minutes, useFetch } from "../lib/hooks";
import { useSession } from "../lib/session";
import { useSpeaker } from "../lib/speech";
import type { AiStatus, Lesson, Message, Reference } from "../lib/types";

interface Step { title: string; say: string; do: string; demo: string; image_prompt: string }
interface Script {
  intro: string; concept: { summary: string; why_it_works: string }; steps: Step[]; tips: string[]; common_mistakes: string[];
  check: { question: string; options: string[]; answer_index: number; explanation: string } | null;
  practice: { task: string; minutes: number; success_criteria: string[] }; next_hint: string;
}
interface Payload { lesson: Lesson; script: Script | null; model: string | null; visuals: Record<string, Reference> }
type Seg = { kind: "intro" | "concept" | "step" | "check" | "practice"; say: string; step?: number };

function segments(s: Script): Seg[] {
  return [
    { kind: "intro", say: s.intro },
    { kind: "concept", say: `${s.concept.summary} ${s.concept.why_it_works}` },
    ...s.steps.map((st, i) => ({ kind: "step" as const, say: `${st.say} ${st.do}`, step: i })),
    ...(s.check ? [{ kind: "check" as const, say: s.check.question }] : []),
    { kind: "practice", say: `Now it's your turn. ${s.practice.task}` },
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
  const [answer, setAnswer] = useState<{ choice: number; correct: boolean; explanation: string; answer_index: number } | null>(null);
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
      setData(p); setI(0); setAnswer(null); setPhase("ready");
    } catch (e) { setError((e as Error).message); setPhase("error"); }
  }, [id]);

  useEffect(() => {
    api.get<Payload>(`/api/lessons/${id}/script`).then((p) => {
      if (p.script) { setData(p); setPhase("ready"); } else { setData(p); prepare(); }
    }).catch((e) => { setError(e.message); setPhase("error"); });
    return () => { playRef.current = false; };
  }, [id, prepare]);

  const segs = data?.script ? segments(data.script) : [];
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
      if (segs[k].kind === "check") break; // wait for the learner to answer
      await new Promise((r) => setTimeout(r, 700));
    }
    playRef.current = false; setPlaying(false);
  }

  function go(n: number) { playRef.current = false; setPlaying(false); voice.stop(); setI(Math.max(0, Math.min(segs.length - 1, n))); }

  async function choose(choice: number) {
    try {
      const r = await api.post<{ correct: boolean; explanation: string; answer_index: number }>(`/api/lessons/${id}/check`, { choice });
      setAnswer({ choice, ...r });
      say(`${r.correct ? "Yes, exactly!" : "Not quite."} ${r.explanation}`);
    } catch (e) { setError((e as Error).message); }
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
    : answer?.correct && seg?.kind === "check" ? "happy" : "idle";
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
            className="relative mt-2 max-h-72 overflow-y-auto rounded-3xl bg-white p-4 text-[15.5px] shadow-md" aria-live="polite">
            {phase === "preparing" ? "I'm preparing this lesson for you — on a laptop this can take a minute or two." : <Prose text={bubble} />}
          </motion.div>}
        </AnimatePresence>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm">
          <button className="btn-ghost px-4 py-2 text-sm" onClick={() => voice.setMuted(!voice.muted)} aria-pressed={!voice.muted}>{voice.muted ? "Voice off" : "Voice on"}</button>
          {!voice.muted && <span className="text-xs text-ink-faint">{voice.engine === "piper" ? "Local Piper voice" : voice.engine === "browser" ? "Built-in system voice" : ""}</span>}
        </div>
        {phase === "ready" && <div className="mt-4 flex gap-2">
          <label htmlFor="ask" className="sr-only">Ask your teacher</label>
          <input id="ask" className="field" placeholder="Ask Muse about this lesson…" value={ask} onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendQuestion(); }} disabled={askBusy} />
          <button className="btn-primary px-4" onClick={sendQuestion} disabled={askBusy || !ask.trim()}>Ask</button>
        </div>}
      </aside>

      {/* lesson column */}
      <section>
        {data && <>
          <p className="text-sm font-bold text-purple">{data.lesson.stage_title} · {minutes(data.lesson.est_minutes)}</p>
          <h1 className="text-[2.1rem] leading-tight">{data.lesson.title}</h1>
        </>}

        {phase === "preparing" && <div className="mt-8 grid h-72 place-items-center rounded-3xl bg-white/70"><Loading label="Writing your lesson" /></div>}
        {phase === "error" && <div className="mt-6 space-y-3"><ErrorNote message={error} /><button className="btn-primary" onClick={() => prepare()}>Try again</button></div>}

        {phase === "ready" && data?.script && seg && <>
          {/* progress dots */}
          <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Lesson steps">
            {segs.map((s, k) => <button key={k} role="tab" aria-selected={k === i} aria-label={`Part ${k + 1}: ${s.kind}`} onClick={() => go(k)}
              className={`h-2.5 rounded-full transition-all ${k === i ? "w-10 bg-purple" : k < i ? "w-5 bg-lavender" : "w-5 bg-white"}`} />)}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}
              className="mt-5 rounded-[1.75rem] bg-white/85 p-5 shadow-sm sm:p-7">
              {seg.kind === "intro" && <><h2 className="text-2xl">Welcome to this lesson</h2><p className="mt-2 text-lg">{data.script.intro}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">{data.lesson.objectives.slice(0, 4).map((o, k) => <div key={k} className="rounded-2xl bg-lavender/60 p-3 text-[15px]">{o}</div>)}</div></>}

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
                  </div>
                </div>
              </>; })()}

              {seg.kind === "check" && data.script.check && <>
                <h2 className="text-2xl">Quick check</h2><p className="mt-2 text-lg">{data.script.check.question}</p>
                <div className="mt-4 grid gap-3">{data.script.check.options.map((o, k) => {
                  const state = !answer ? "" : k === answer.answer_index ? "ring-teal bg-sky" : k === answer.choice ? "ring-coral bg-rose" : "opacity-60";
                  return <motion.button key={k} whileTap={{ scale: 0.98 }} disabled={!!answer} onClick={() => choose(k)}
                    className={`rounded-2xl bg-white p-4 text-left text-[16px] ring-2 ring-transparent hover:ring-lavender ${state}`}>{o}</motion.button>;
                })}</div>
                {answer && <p className="mt-4 text-[15.5px]"><strong>{answer.correct ? "Well done! " : "Good try. "}</strong>{answer.explanation}</p>}
              </>}

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
            <button className="btn-outline" disabled={i === segs.length - 1 || (seg.kind === "check" && !answer)} onClick={() => go(i + 1)}>Next</button>
            <span className="ml-auto text-xs text-ink-faint">Narrated, animated slides · written by {data?.model}
              <button className="ml-2 underline" onClick={() => prepare(true)}>Rewrite lesson</button></span>
          </div>
        </>}
      </section>
    </div>
  );
}
