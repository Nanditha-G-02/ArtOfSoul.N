import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Empty, ErrorNote, List, Loading, PageHeader, Section, Thinking } from "../components/ui";
import { api, mediaUrl } from "../lib/api";
import { date, titleCase, useFetch } from "../lib/hooks";
import type { Analysis, Artwork, Lesson, Syllabus } from "../lib/types";

type Region = { x: number; y: number; w: number; h: number };
const RATING: Record<string, string> = { solid: "bg-lavender text-violet-deep", developing: "bg-sky text-teal", needs_work: "bg-rose text-[#8f3a33]" };
const RATING_LABEL: Record<string, string> = { solid: "Solid", developing: "Developing", needs_work: "Needs work" };

function Uploader() {
  const nav = useNavigate();
  const loc = useLocation() as { state?: { lessonId?: number } };
  const syl = useFetch<Syllabus | null>("/api/syllabus");
  const [file, setFile] = useState<File | null>(null);
  const [ref, setRef] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [ctx, setCtx] = useState("");
  const [lessonId, setLessonId] = useState<string>(loc.state?.lessonId ? String(loc.state.lessonId) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = file ? URL.createObjectURL(file) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setError(null);
    try {
      let refId: number | undefined;
      if (ref) {
        const fr = new FormData(); fr.append("file", ref); fr.append("title", `Reference for ${title || "study"}`); fr.append("kind", "reference");
        refId = (await api.upload<Artwork>("/api/artworks", fr)).id;
      }
      const f = new FormData();
      f.append("file", file); f.append("title", title || "Untitled study"); f.append("exercise_context", ctx);
      if (lessonId) f.append("lesson_id", lessonId);
      if (refId) f.append("reference_artwork_id", String(refId));
      const art = await api.upload<Artwork>("/api/artworks", f);
      nav(`/analysis/${art.id}`, { state: { autoAnalyze: true } });
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  const lessons: Lesson[] = syl.data?.lessons.filter((l) => l.status !== "skipped") ?? [];
  return (
    <form onSubmit={submit} className="panel grid gap-6 p-6 md:grid-cols-[1fr_1.1fr]">
      <label className={`flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center ${file ? "border-violet bg-lavender/40" : "border-line bg-paper hover:border-ink-faint"}`}>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {preview ? <img src={preview} alt="Selected artwork preview" className="max-h-72 rounded-xl object-contain" />
          : <><span className="font-display text-xl">Choose a photo of your work</span><span className="mt-1 text-sm text-ink-soft">JPEG, PNG or WEBP, up to 12 MB. Shoot square-on in even, indirect light.</span></>}
      </label>
      <div className="grid content-start gap-4">
        <div><label className="label" htmlFor="t">Title</label><input id="t" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Portrait study, week 3" /></div>
        <div><label className="label" htmlFor="c">What were you trying to do? (optional)</label>
          <textarea id="c" className="field min-h-20" value={ctx} onChange={(e) => setCtx(e.target.value)} placeholder="The exercise brief, or what you want feedback on" /></div>
        {!!lessons.length && <div><label className="label" htmlFor="l">Link to a lesson (optional)</label>
          <select id="l" className="field" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
            <option value="">No lesson</option>{lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select></div>}
        <div><label className="label" htmlFor="r">Reference you worked from (optional)</label>
          <input id="r" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" onChange={(e) => setRef(e.target.files?.[0] ?? null)} /></div>
        <ErrorNote message={error} />
        <button className="btn-primary" disabled={!file || busy}>{busy ? "Uploading…" : "Upload and analyse"}</button>
      </div>
    </form>
  );
}

function RegionPicker({ src, region, onChange }: { src: string; region: Region | null; onChange: (r: Region | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const pos = (e: PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  return (
    <div ref={box} className="relative cursor-crosshair touch-none select-none overflow-hidden rounded-2xl bg-paper-deep"
      onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); start.current = pos(e); onChange(null); }}
      onPointerMove={(e) => { if (!start.current) return; const p = pos(e), s = start.current;
        onChange({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) }); }}
      onPointerUp={() => { start.current = null; if (region && (region.w < 0.03 || region.h < 0.03)) onChange(null); }}>
      <img src={src} alt="Your artwork" className="block w-full" draggable={false} />
      {region && <div className="pointer-events-none absolute border-2 border-coral bg-coral/10 shadow-[0_0_0_9999px_rgba(35,31,71,0.35)]"
        style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.w * 100}%`, height: `${region.h * 100}%` }} />}
    </div>
  );
}

function AnalysisView({ a }: { a: Analysis }) {
  const obs = (ids: number[]) => ids.map((i) => i + 1).join(", ");
  if (!a.image_suitable) return (
    <div className="rounded-2xl bg-amber-soft p-5">
      <h3 className="text-xl">This photo couldn't be assessed reliably</h3>
      <List items={a.limitations} />
      <p className="mt-2 text-sm text-ink-soft">No skill ratings were recorded. Retake it square-on, in even daylight, filling the frame, and upload again.</p>
    </div>);
  return (
    <div className="grid gap-8">
      {!!a.limitations.length && <p className="rounded-xl bg-amber-soft px-4 py-2 text-sm">Photo limits noted: {a.limitations.join(" ")}</p>}
      <div>
        <h3 className="text-xl">What the vision model observed</h3>
        <ol className="mt-3 grid gap-2">{a.observations.map((o, i) => (
          <li key={i} className="flex gap-3 rounded-xl bg-white p-3 text-[15px]">
            <span className="font-display text-ink-faint">{i + 1}</span>
            <span><strong>{o.dimension}</strong> · {o.location}<br />{o.observation}
              <span className={`ml-2 text-xs ${o.confidence === "low" ? "text-coral" : "text-ink-faint"}`}>{o.confidence} confidence</span></span>
          </li>))}</ol>
      </div>
      {a.reference_comparison && <div><h3 className="text-xl">Against your reference</h3><p className="mt-1 whitespace-pre-line text-ink-soft">{a.reference_comparison}</p></div>}
      <div className="grid gap-6 md:grid-cols-2">
        <div><h3 className="text-xl text-violet-deep">Strengths</h3>
          <ul className="mt-2 grid gap-2">{a.strengths.map((s, i) => <li key={i} className="rounded-xl bg-lavender/60 p-3 text-[15px]">{s.point} <span className="text-xs text-ink-faint">(obs. {obs(s.observation_ids)})</span></li>)}</ul></div>
        <div><h3 className="text-xl text-[#8f3a33]">To improve</h3>
          <ul className="mt-2 grid gap-2">{a.improvements.map((s, i) => <li key={i} className="rounded-xl bg-rose/70 p-3 text-[15px]"><strong>{s.issue}</strong><br />
            <span className="text-ink-soft">Why it matters: {s.reason}</span> <span className="text-xs text-ink-faint">({titleCase(s.skill_slug)} · obs. {obs(s.observation_ids)})</span></li>)}</ul></div>
      </div>
      <div><h3 className="text-xl">Corrective steps for the next attempt</h3><List ordered items={a.corrective_steps} /></div>
      {!!a.exercises.length && <div><h3 className="text-xl">Targeted exercises</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">{a.exercises.map((e, i) => <li key={i} className="rounded-xl bg-sky/70 p-3"><strong>{e.title}</strong><p className="text-sm text-ink-soft">{e.brief}</p></li>)}</ul></div>}
      <div className="grid gap-6 md:grid-cols-2">
        <div><h3 className="text-xl">Skill evidence recorded</h3>
          {a.skill_ratings.length ? <ul className="mt-2 grid gap-1.5">{a.skill_ratings.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-[15px]"><span>{titleCase(r.skill_slug)}</span><span className={`chip ${RATING[r.rating]}`}>{RATING_LABEL[r.rating]}</span></li>))}</ul>
            : <p className="text-ink-soft">The observations didn't directly evidence any rubric skill, so nothing was recorded.</p>}
        </div>
        <div><h3 className="text-xl">Next</h3>
          <p className="mt-1">{a.next_milestone}</p>
          {!!a.suggested_lessons.length && <p className="mt-2 text-sm">Related lessons: {a.suggested_lessons.map((l) => l.title).join("; ")}. <Link to="/roadmap" className="underline">See roadmap</Link></p>}
        </div>
      </div>
      <p className="text-xs text-ink-faint">Observations by {a.model_vision}; rubric assessment by {a.model_assessment}. Ratings without a cited observation are discarded automatically.</p>
    </div>
  );
}

function Workspace({ id }: { id: string }) {
  const loc = useLocation() as { state?: { autoAnalyze?: boolean } };
  const nav = useNavigate();
  const { data, error, loading, reload } = useFetch<Artwork & { reference: Artwork | null; analyses: Analysis[] }>(`/api/artworks/${id}`);
  const others = useFetch<Artwork[]>("/api/artworks");
  const [region, setRegion] = useState<Region | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shown, setShown] = useState(0);
  const [compare, setCompare] = useState<string>("");
  const auto = useRef(false);

  async function run() {
    setBusy(true); setErr(null);
    try { await api.post(`/api/artworks/${id}/analyze`, { region }); setShown(0); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (loc.state?.autoAnalyze && !auto.current && data && !data.analyses.length) {
      auto.current = true;
      nav(".", { replace: true, state: {} });
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorNote message={error} />;
  const a = data.analyses[shown];
  const cmp = others.data?.find((o) => String(o.id) === compare);

  return (
    <>
      <PageHeader title={data.title} intro={<>{date(data.created_at)}{data.exercise_context && <> · {data.exercise_context}</>}</>}
        actions={<Link to="/analysis" className="btn-outline">Upload another</Link>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <RegionPicker src={mediaUrl(data.url)} region={region} onChange={setRegion} />
          <p className="mt-2 text-sm text-ink-soft">{region ? "Focus region selected — the analysis will look closely here too." : "Drag on the image to focus feedback on one area (optional)."}
            {region && <button className="ml-2 underline" onClick={() => setRegion(null)}>Clear</button>}</p>
        </div>
        <div className="grid content-start gap-4">
          {data.reference && <figure><img src={mediaUrl(data.reference.url)} alt="Your reference" className="rounded-2xl" /><figcaption className="mt-1 text-sm text-ink-soft">Your reference</figcaption></figure>}
          <div><label className="label" htmlFor="cmp">Compare side by side with an earlier piece</label>
            <select id="cmp" className="field" value={compare} onChange={(e) => setCompare(e.target.value)}>
              <option value="">Choose a piece</option>{others.data?.filter((o) => o.id !== data.id).map((o) => <option key={o.id} value={o.id}>{o.title} · {date(o.created_at)}</option>)}
            </select></div>
          {cmp && <figure><img src={mediaUrl(cmp.url)} alt={cmp.title} className="rounded-2xl" /><figcaption className="mt-1 text-sm text-ink-soft">{cmp.title} · <Link className="underline" to={`/analysis/${cmp.id}`}>open its feedback</Link></figcaption></figure>}
          <button className="btn-primary" onClick={run} disabled={busy}>{data.analyses.length ? "Analyse again" : "Analyse this piece"}{region ? " (with focus region)" : ""}</button>
          {busy && <Thinking label="Observing the image, then assessing it against the rubrics — a few minutes on local models" />}
          <ErrorNote message={err} />
        </div>
      </div>
      <Section title="Feedback" aside={data.analyses.length > 1 ? (
        <select className="field w-auto py-1.5 text-sm" value={shown} onChange={(e) => setShown(+e.target.value)} aria-label="Choose analysis">
          {data.analyses.map((x, i) => <option key={x.id} value={i}>{date(x.created_at)}{x.region ? " · focus region" : ""}</option>)}</select>) : undefined}>
        {a ? <AnalysisView a={a} /> : !busy && <p className="text-ink-soft">No analysis yet.</p>}
      </Section>
    </>
  );
}

export default function AnalysisPage() {
  const { aid } = useParams();
  const recent = useFetch<Analysis[]>(aid ? null : "/api/analyses");
  if (aid) return <Workspace id={aid} />;
  return (
    <>
      <PageHeader title="Artwork analysis studio" intro="Upload a finished study or work in progress. Feedback is grounded in what's visible in the photo and mapped to explicit rubrics." />
      <Uploader />
      <Section title="Recent feedback">
        {recent.loading && <Loading />}
        {recent.data && !recent.data.length && <Empty title="No feedback yet" tone="teal">Your first upload starts your evidence record. Skills move to “proficient” only after repeated solid results in assessed artwork.</Empty>}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recent.data?.map((x) => x.artwork && (
            <li key={x.id}><Link to={`/analysis/${x.artwork.id}`} className="panel block overflow-hidden hover:border-ink-faint">
              <img src={mediaUrl(x.artwork.url)} alt={x.artwork.title} className="aspect-[4/3] w-full object-cover" />
              <div className="p-4"><p className="font-display text-lg">{x.artwork.title}</p>
                <p className="text-sm text-ink-soft">{date(x.created_at)} · {x.image_suitable ? `${x.skill_ratings.length} skill rating${x.skill_ratings.length === 1 ? "" : "s"}` : "photo unsuitable"}</p></div>
            </Link></li>))}
        </ul>
      </Section>
    </>
  );
}
