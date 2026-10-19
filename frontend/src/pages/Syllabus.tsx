import { useState } from "react";
import { Link } from "react-router-dom";
import { Empty, ErrorNote, List, Loading, PageHeader, Section, Thinking } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { date, minutes, titleCase, useFetch } from "../lib/hooks";
import type { Course, Lesson, Syllabus } from "../lib/types";

const EXAMPLES: Record<string, string[]> = {
  pencil: ["I want to master realistic graphite portrait drawing.", "Render glass, chrome and water convincingly in graphite.", "Draw atmospheric landscapes with real depth."],
  painting: ["I want to improve advanced oil painting and colour harmony.", "I want to develop professional-level still-life painting skills.", "Paint portraits with convincing, varied skin tones."],
};

function LessonCard({ l, sources }: { l: Lesson; sources: Map<number, Course> }) {
  const [open, setOpen] = useState(l.status === "current");
  return (
    <li className={`rounded-2xl border p-5 ${l.status === "current" ? "border-violet bg-white" : "border-line bg-white/70"} ${l.status === "skipped" ? "opacity-60" : ""}`}>
      <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          <span className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
            {l.status === "current" && <span className="chip bg-violet text-white">Current</span>}
            {l.status === "completed" && <span className="chip bg-lavender text-violet-deep">Completed</span>}
            {l.status === "skipped" && <span className="chip bg-paper-deep">Skipped — evidence of proficiency</span>}
            {l.kind === "remedial" && <span className="chip bg-rose text-[#8f3a33]">Focused practice</span>}
            {l.is_milestone && <span className="chip bg-amber-soft text-[#8a6418]">Milestone</span>}
            {minutes(l.est_minutes)}
          </span>
          <span className="mt-1 block font-display text-xl">{l.title}</span>
        </span>
        <span className="text-ink-faint">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="mt-4 grid gap-4 text-[15px] md:grid-cols-2">
        <div><h4 className="font-semibold">Objectives</h4><List items={l.objectives} /></div>
        <div><h4 className="font-semibold">Assessment criteria</h4><List items={l.assessment_criteria} /></div>
        {l.studio_assignment && <div className="md:col-span-2"><h4 className="font-semibold">Studio assignment</h4><p className="text-ink-soft">{l.studio_assignment}</p></div>}
        {!!l.exercises.length && <div className="md:col-span-2"><h4 className="font-semibold">Exercises</h4>
          <ul className="mt-1 grid gap-2 sm:grid-cols-2">{l.exercises.map((e, i) => <li key={i} className="rounded-xl bg-paper p-3"><strong>{e.title}</strong><p className="text-sm text-ink-soft">{e.brief}</p></li>)}</ul></div>}
        <div className="text-sm text-ink-soft md:col-span-2">
          Skills: {l.skill_slugs.map(titleCase).join(", ")}
          {!!l.prerequisite_slugs.length && <> · Builds on: {l.prerequisite_slugs.map(titleCase).join(", ")}</>}
          {!!l.source_course_ids.length && <> · Informed by: {l.source_course_ids.map((id) => sources.get(id)).filter(Boolean)
            .map((c, i) => <a key={i} className="underline" href={c!.source_url} target="_blank" rel="noreferrer">{c!.institution} {c!.course_code}{i < l.source_course_ids.length - 1 ? ", " : ""}</a>)}</>}
        </div>
        {l.status !== "completed" && <div className="flex gap-2 md:col-span-2">
          <Link to="/teacher" state={{ lessonId: l.id }} className="btn-outline py-1.5">Study with my teacher</Link>
          <Link to="/analysis" state={{ lessonId: l.id }} className="btn-ghost py-1.5">Upload attempt</Link>
        </div>}
      </div>}
    </li>
  );
}

export default function SyllabusPage() {
  const { profile } = useAuth();
  const { data, error, loading, setData } = useFetch<Syllabus | null>("/api/syllabus");
  const versions = useFetch<{ version: number; title: string; goal: string; status: string; change_summary: string; created_at: string }[]>("/api/syllabus/versions");
  const [goal, setGoal] = useState(profile?.goals ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function generate() {
    setBusy(true); setErr(null);
    try { setData(await api.post<Syllabus>("/api/syllabus", { goal })); setEditing(false); versions.reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  if (loading) return <Loading />;
  const sources = new Map((data?.sources ?? []).map((c) => [c.id, c]));
  const stages = data ? [...new Map(data.lessons.map((l) => [l.stage_index, l.stage_title])).entries()].sort((a, b) => a[0] - b[0]) : [];

  const form = (
    <div className="panel p-6">
      <label htmlFor="goal" className="font-display text-xl">What do you want to master?</label>
      <textarea id="goal" className="field mt-3 min-h-24" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={600} />
      <div className="mt-3 flex flex-wrap gap-2">{(EXAMPLES[profile?.track ?? "pencil"]).map((x) => (
        <button key={x} className="chip bg-paper-deep px-3 py-1 text-ink-soft hover:text-ink" onClick={() => setGoal(x)}>{x}</button>))}</div>
      <p className="mt-4 text-sm text-ink-soft">Uses your track{profile?.medium && profile.track === "painting" ? ` (${profile.medium})` : ""}, {profile?.weekly_hours} h/week, and every skill assessment on record.
        {data && " Completed lessons will be carried over."}</p>
      <div className="mt-4"><ErrorNote message={err} /></div>
      <div className="mt-4 flex gap-2">
        <button className="btn-primary" disabled={busy || goal.trim().length < 8} onClick={generate}>{data ? "Rebuild my syllabus" : "Build my syllabus"}</button>
        {data && <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>}
      </div>
      {busy && <div className="mt-4"><Thinking label="Retrieving curriculum, ordering prerequisites and drafting your plan — local models can take several minutes on a laptop" /></div>}
    </div>
  );

  return (
    <>
      <PageHeader title="My personalised syllabus"
        intro={data ? <>Version {data.version} · built {date(data.created_at)} for “{data.goal}”</> : "Built from your goals, evidence and the curriculum graph."}
        actions={data && !editing ? <button className="btn-outline" onClick={() => { setGoal(data.goal); setEditing(true); }}>Change goal or rebuild</button> : undefined} />
      <ErrorNote message={error} />
      {(!data || editing) && form}
      {!data && !busy && <div className="mt-6"><Empty title="No syllabus yet">Describe a goal above. You'll get 3–5 stages of advanced lessons, each with objectives, a studio assignment, exercises, assessment criteria and links to the course records that informed it.</Empty></div>}

      {data && <>
        {data.change_summary && <div className="mt-6 rounded-2xl bg-amber-soft px-5 py-4 text-[15px]"><strong>What changed: </strong>{data.change_summary}</div>}
        <Section title={data.title}>
          <p className="max-w-3xl text-ink-soft">{data.overview}</p>
          {!!data.expected_outcomes.length && <div className="mt-4"><h3 className="text-lg">Expected outcomes</h3><List items={data.expected_outcomes} /></div>}
        </Section>
        {stages.map(([idx, title]) => (
          <Section key={idx} title={idx < 0 ? "Completed earlier" : title}>
            <ol className="grid gap-3">{data.lessons.filter((l) => l.stage_index === idx).map((l) => <LessonCard key={l.id} l={l} sources={sources} />)}</ol>
          </Section>))}
        <Section title="Sources behind this plan">
          {data.sources.length ? <ul className="grid gap-2 text-[15px]">{data.sources.map((c) => (
            <li key={c.id}><a className="font-semibold underline" href={c.source_url} target="_blank" rel="noreferrer">{c.institution} — {c.course_code} {c.title}</a>
              <span className="text-ink-soft"> · {c.verification === "verified" ? "verified catalogue description" : "partial record"}, reviewed {date(c.last_reviewed)}</span></li>))}</ul>
            : <p className="text-ink-soft">No institutional source was cited for this plan; it draws on ArtOfSoul.N's own curriculum.</p>}
          <p className="mt-3 text-sm text-ink-faint">ArtOfSoul.N lessons are original. Sources informed the research; this plan is not certified or endorsed by any institution. Generated by {data.model}.</p>
        </Section>
        {versions.data && versions.data.length > 1 && <Section title="Earlier versions">
          <ul className="grid gap-2 text-sm">{versions.data.filter((v) => v.status === "archived").map((v) => (
            <li key={v.version} className="text-ink-soft">v{v.version} · {date(v.created_at)} · “{v.goal}”</li>))}</ul>
        </Section>}
      </>}
    </>
  );
}
