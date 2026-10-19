import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ErrorNote, Loading } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useFetch } from "../lib/hooks";

interface Item { slug: string; name: string; description: string; criterion: string; levels: Record<"needs_work" | "developing" | "solid", string> }
const LEVELS = [["needs_work", "Not yet"], ["developing", "Getting there"], ["solid", "Reliably"]] as const;

export default function Diagnostic() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const { data, error, loading } = useFetch<Item[]>("/api/diagnostic");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(skip: boolean) {
    setBusy(true); setErr(null);
    try { await api.post("/api/diagnostic", { answers: skip ? {} : answers, skip }); await refresh(); nav("/dashboard"); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <Link to="/" className="font-display text-xl">ArtOfSoul<span className="text-coral">.N</span></Link>
      <h1 className="mt-8 text-[2.3rem]">Place yourself on each skill</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Compare your recent work with each description and pick the closest. This is a self-placement, so it only marks skills
        as “in progress”; uploading artwork later is what confirms proficiency or flags gaps. Choose “Unsure” freely, or skip entirely.
      </p>
      {loading && <Loading />}
      <ErrorNote message={error} />
      <ol className="mt-8 grid gap-4">
        {data?.map((it, idx) => (
          <li key={it.slug} className="panel p-5 sm:p-6">
            <h2 className="text-xl"><span className="text-ink-faint">{idx + 1}.</span> {it.name}</h2>
            <p className="mt-1 text-sm text-ink-soft">{it.criterion}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={it.name}>
              {LEVELS.map(([v, label]) => (
                <label key={v} className={`cursor-pointer rounded-2xl border p-3 text-sm ${answers[it.slug] === v ? "border-violet bg-lavender" : "border-line bg-white hover:border-ink-faint"}`}>
                  <input type="radio" className="sr-only" name={it.slug} checked={answers[it.slug] === v} onChange={() => setAnswers({ ...answers, [it.slug]: v })} />
                  <span className="font-semibold">{label}</span><span className="mt-1 block text-ink-soft">{it.levels[v]}</span>
                </label>))}
            </div>
            <button className={`mt-2 text-sm ${answers[it.slug] === "unsure" ? "font-semibold text-violet" : "text-ink-faint"}`}
              onClick={() => setAnswers({ ...answers, [it.slug]: "unsure" })}>Unsure</button>
          </li>))}
      </ol>
      <div className="mt-6"><ErrorNote message={err} /></div>
      <div className="mt-8 flex flex-wrap justify-between gap-3">
        <button className="btn-ghost" disabled={busy} onClick={() => submit(true)}>Skip and pick a topic myself</button>
        <button className="btn-primary" disabled={busy || !Object.keys(answers).length} onClick={() => submit(false)}>
          {busy ? "Saving…" : "Save my placement"}</button>
      </div>
    </div>
  );
}
