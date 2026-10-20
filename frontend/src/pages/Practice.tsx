import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import { ErrorNote, List } from "../components/ui";
import { api, mediaUrl } from "../lib/api";
import { date, titleCase, useFetch } from "../lib/hooks";
import { useSpeaker } from "../lib/speech";
import type { Analysis, Artwork, Lesson } from "../lib/types";

const WAIT = ["Looking closely at your artwork…", "Noting what's visible: values, edges, proportions, colour…", "Comparing with the lesson's goals…", "Writing your feedback…"];

export default function Practice() {
  const { lessonId } = useParams();
  const nav = useNavigate();
  const voice = useSpeaker();
  const progress = useFetch<{ current_lesson: Lesson | null }>("/api/progress");
  const lid = lessonId ?? (progress.data?.current_lesson ? String(progress.data.current_lesson.id) : undefined);
  const lesson = useFetch<{ lesson: Lesson; script: { practice: { task: string; success_criteria: string[] } } | null }>(lid ? `/api/lessons/${lid}/script` : null);
  const history = useFetch<Analysis[]>("/api/analyses");
  const [file, setFile] = useState<File | null>(null);
  const [art, setArt] = useState<Artwork | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const preview = file ? URL.createObjectURL(file) : art ? mediaUrl(art.url) : null;

  useEffect(() => { if (!busy) return; const t = setInterval(() => setTick((x) => x + 1), 7000); return () => clearInterval(t); }, [busy]);

  async function submit() {
    if (!file) return;
    setBusy(true); setError(null); setResult(null); setTick(0);
    try {
      const f = new FormData();
      f.append("file", file);
      f.append("title", lesson.data ? `Practice: ${lesson.data.lesson.title}` : "Practice piece");
      if (lid) f.append("lesson_id", lid);
      if (lesson.data?.script) f.append("exercise_context", lesson.data.script.practice.task);
      const a = await api.upload<Artwork>("/api/artworks", f);
      setArt(a); setFile(null);
      const r = await api.post<Analysis>(`/api/artworks/${a.id}/analyze`, {});
      setResult(r); history.reload();
      const line = r.image_suitable
        ? `${r.strengths[0] ? `I like this: ${r.strengths[0].point}.` : ""} ${r.improvements[0] ? `Next, let's work on this: ${r.improvements[0].issue}.` : ""}`
        : "I couldn't see this photo clearly enough to judge it. Could you retake it in even light?";
      voice.speak(line);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function finishLesson() {
    if (!lid) return;
    await api.patch(`/api/lessons/${lid}`, { status: "completed" });
    const p = await api.get<{ current_lesson: Lesson | null }>("/api/progress");
    nav(p.current_lesson ? `/studio/${p.current_lesson.id}` : "/progress");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <section>
        <h1 className="text-[2.2rem]">Practice & feedback</h1>
        {lesson.data && <p className="mt-1 text-ink-soft">For “{lesson.data.lesson.title}”{lesson.data.script ? `: ${lesson.data.script.practice.task}` : ""}</p>}

        <label className={`mt-6 flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed p-4 text-center transition ${preview ? "border-ink bg-white" : "border-line bg-white/60 hover:border-ink"}`}>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setArt(null); }} />
          {preview ? <img src={preview} alt="Your artwork" className="max-h-96 rounded-2xl object-contain" />
            : <><span className="font-display text-2xl">Add a photo of your work</span>
              <span className="mt-2 max-w-sm text-sm text-ink-soft">Take it straight-on in daylight, filling the frame, without flash glare.</span></>}
        </label>
        <div className="mt-4 flex gap-3">
          <button className="btn-big" disabled={!file || busy} onClick={submit}>Get feedback</button>
          {file && !busy && <button className="btn-ghost" onClick={() => setFile(null)}>Choose another</button>}
        </div>
        <div className="mt-4"><ErrorNote message={error} /></div>
      </section>

      <section>
        <div className="flex items-end gap-4">
          <Avatar mood={busy ? "thinking" : voice.speaking ? "talking" : result?.image_suitable ? "happy" : "idle"} level={voice.level} size={150} />
          <div className="mb-6 rounded-3xl rounded-bl-sm bg-white px-5 py-3 shadow-md">
            {busy ? <AnimatePresence mode="wait"><motion.p key={tick} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{WAIT[Math.min(tick, WAIT.length - 1)]}</motion.p></AnimatePresence>
              : result ? "Here's what I noticed." : "Upload your practice and I'll take a look."}
          </div>
        </div>
        {busy && <p className="mt-2 text-sm text-ink-faint">The vision model runs on your computer — this can take a few minutes.</p>}

        {result && !result.image_suitable && <div className="mt-4 rounded-3xl bg-amber-soft p-5">
          <h2 className="text-xl">I couldn't judge this photo reliably</h2><List items={result.limitations} />
          <p className="mt-2 text-sm">Nothing was recorded. Retake it straight-on in even light and try again.</p></div>}

        {result?.image_suitable && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-4">
          {!!result.limitations.length && <p className="rounded-2xl bg-amber-soft px-4 py-2 text-sm">Photo limits I noticed: {result.limitations.join(" ")}</p>}
          <div className="rounded-3xl bg-meadow-soft/80 p-5"><h2 className="text-xl text-meadow">What you did well</h2>
            {result.strengths.length ? <List items={result.strengths.map((s) => s.point)} /> : <p className="text-sm text-ink-soft">Nothing specific could be confirmed from the photo.</p>}</div>
          <div className="rounded-3xl bg-rose/80 p-5"><h2 className="text-xl text-[#8f3a33]">What to improve</h2>
            <ul className="mt-1 space-y-2">{result.improvements.map((s, k) => <li key={k}><strong>{s.issue}</strong><br /><span className="text-sm text-ink-soft">Why: {s.reason}</span></li>)}</ul></div>
          {!!result.corrective_steps.length && <div className="glass p-5"><h2 className="text-xl">Next time, try</h2><List ordered items={result.corrective_steps} /></div>}
          {!!result.exercises.length && <div className="rounded-3xl bg-sky/80 p-5"><h2 className="text-xl">Recommended next exercise</h2>
            <p className="mt-1"><strong>{result.exercises[0].title}</strong> — {result.exercises[0].brief}</p></div>}
          {!!result.skill_ratings.length && <p className="text-sm text-ink-soft">Recorded for your roadmap: {result.skill_ratings.map((r) => `${titleCase(r.skill_slug)} (${r.rating.replace("_", " ")})`).join(", ")}</p>}
          <details className="text-sm"><summary className="cursor-pointer text-ink-soft">What the model actually saw</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">{result.observations.map((o, k) => <li key={k}>{o.dimension} · {o.location}: {o.observation} <span className="text-ink-faint">({o.confidence} confidence)</span></li>)}</ol></details>
          {lid && <div className="flex flex-wrap gap-3 pt-2">
            <button className="btn-big" onClick={finishLesson}>Finish lesson & continue</button>
            <Link to="/roadmap" className="btn-outline">See my roadmap</Link></div>}
        </motion.div>}

        {!result && !busy && !!history.data?.length && <div className="mt-8">
          <h2 className="text-lg">Earlier practice</h2>
          <ul className="mt-3 grid grid-cols-3 gap-3">{history.data.slice(0, 6).map((h) => h.artwork && <li key={h.id}>
            <img src={mediaUrl(h.artwork.url)} alt={h.artwork.title} className="aspect-square w-full rounded-xl object-cover" />
            <p className="mt-1 text-xs text-ink-faint">{date(h.created_at)}</p></li>)}</ul></div>}
      </section>
    </div>
  );
}
