import { useState } from "react";
import { Link } from "react-router-dom";
import { Empty, ErrorNote, Loading, PageHeader, Section, StatusChip } from "../components/ui";
import { api } from "../lib/api";
import { date, minutes, useFetch } from "../lib/hooks";
import type { Lesson, Roadmap } from "../lib/types";

const DOT: Record<Lesson["status"], string> = {
  completed: "bg-violet border-violet", current: "bg-coral border-coral ring-4 ring-rose", upcoming: "bg-white border-ink-faint", skipped: "bg-paper-deep border-line",
};
const CHANGE: Record<string, string> = { remedial_inserted: "Focused practice added", lesson_skipped: "Lesson skipped", remedial_retired: "Focused practice retired" };

export default function RoadmapPage() {
  const { data, error, loading, reload } = useFetch<Roadmap | null>("/api/roadmap");
  const [note, setNote] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  async function act(path: string, body?: unknown, patch = false) {
    try {
      if (patch) await api.patch(path, body); else { const r = await api.post<{ summary: string }>(path); setNote(r.summary); }
      reload();
    } catch (e) { setNote((e as Error).message); }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Empty title="Your roadmap appears once you have a syllabus" action={<Link to="/syllabus" className="btn-primary">Build my syllabus</Link>} />;
  const skillMap = new Map(data.skills.map((s) => [s.slug, s]));
  const highlight = sel ? new Set([sel, ...(skillMap.get(sel)?.prerequisites ?? [])]) : null;

  return (
    <>
      <PageHeader title="Learning roadmap" intro={<>{data.syllabus.title} · about {minutes(data.remaining_minutes)} of practice remaining</>}
        actions={<button className="btn-outline" onClick={() => act("/api/roadmap/revise")}>Check for evidence-based changes</button>} />
      {note && <p className="mb-6 rounded-2xl bg-sky px-4 py-3 text-sm text-teal">{note}</p>}

      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <div>
          {data.stages.map((st) => (
            <section key={st.index} className="mb-8">
              <h2 className="mb-3 text-[1.4rem]">{st.index < 0 ? "Completed earlier" : st.title}</h2>
              <ol className="relative ml-2 border-l-2 border-line pl-6">
                {st.lessons.map((l) => {
                  const dim = highlight && !l.skill_slugs.some((s) => highlight.has(s));
                  return (
                    <li key={l.id} className={`relative pb-5 transition-opacity ${dim ? "opacity-35" : ""}`}>
                      <span className={`absolute -left-[33px] top-1.5 h-3.5 w-3.5 rounded-full border-2 ${DOT[l.status]}`} aria-hidden />
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <h3 className={`text-[1.08rem] font-display ${l.status === "skipped" ? "line-through decoration-ink-faint" : ""}`}>{l.title}</h3>
                        <span className="text-xs text-ink-faint">{minutes(l.est_minutes)}{l.is_milestone ? " · milestone" : ""}{l.kind === "remedial" ? " · focused practice" : ""}</span>
                      </div>
                      <p className="text-sm text-ink-soft">{l.status === "current" ? "In progress now" : l.status === "completed" ? `Completed${l.completed_at ? " " + date(l.completed_at) : ""}` : l.status === "skipped" ? "Skipped on evidence" : "Upcoming"}</p>
                      <div className="mt-1.5 flex flex-wrap gap-2 text-sm">
                        {l.status === "upcoming" && <button className="font-semibold text-violet underline" onClick={() => act(`/api/lessons/${l.id}`, { status: "current" }, true)}>Start now</button>}
                        {l.status === "current" && <button className="font-semibold text-violet underline" onClick={() => act(`/api/lessons/${l.id}`, { status: "completed" }, true)}>Mark complete</button>}
                        {l.status === "skipped" && <button className="font-semibold text-ink-soft underline" onClick={() => act(`/api/lessons/${l.id}`, { status: "upcoming" }, true)}>Restore lesson</button>}
                      </div>
                    </li>);
                })}
              </ol>
            </section>))}
        </div>

        <aside className="space-y-8">
          <div className="panel p-5">
            <h2 className="text-xl">Skill dependencies</h2>
            <p className="mt-1 text-sm text-ink-soft">Select a skill to see the lessons that use it and what it builds on.</p>
            <ul className="mt-4 grid gap-1.5">
              {data.skills.map((s) => (
                <li key={s.slug}>
                  <button onClick={() => setSel(sel === s.slug ? null : s.slug)} aria-pressed={sel === s.slug}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm ${sel === s.slug ? "bg-lavender" : highlight?.has(s.slug) ? "bg-paper-deep" : "hover:bg-paper"}`}>
                    <span>{s.name}</span><StatusChip status={s.status} />
                  </button>
                  {sel === s.slug && !!s.prerequisites.length && <p className="px-3 pt-1 text-xs text-ink-soft">Builds on: {s.prerequisites.map((p) => skillMap.get(p)?.name ?? p).join(", ")}</p>}
                </li>))}
            </ul>
          </div>
          <div>
            <h2 className="text-xl">Why the roadmap changed</h2>
            <ol className="mt-3 grid gap-3">
              {data.versions.map((v) => (
                <li key={v.version} className="rounded-2xl bg-white/70 p-4 text-sm">
                  <p className="text-xs text-ink-faint">Version {v.version} · {date(v.created_at)} · {v.trigger.replace(/_/g, " ")}</p>
                  <p className="mt-1">{v.summary}</p>
                  {v.changes.map((c, i) => (
                    <div key={i} className="mt-2 border-l-2 border-amber pl-3">
                      <p className="font-semibold">{CHANGE[c.type] ?? c.type}: {c.lesson}</p>
                      <p className="text-ink-soft">{c.reason}</p>
                      {!!c.evidence_ids.length && <p className="text-xs text-ink-faint">Based on {c.evidence_ids.length} recorded assessment{c.evidence_ids.length > 1 ? "s" : ""}</p>}
                    </div>))}
                </li>))}
            </ol>
          </div>
        </aside>
      </div>

      <Section title="Assessment history">
        {data.assessments.length ? <ul className="flex flex-wrap gap-2 text-sm">{data.assessments.map((a) => (
          <li key={a.id} className="chip bg-white px-3 py-1 text-ink-soft">{date(a.created_at)} · {a.suitable ? `${a.ratings} skill rating${a.ratings === 1 ? "" : "s"}` : "image unsuitable"}</li>))}</ul>
          : <p className="text-ink-soft">No artwork assessed yet. <Link to="/analysis" className="underline">Upload a piece</Link> to give the roadmap evidence to work with.</p>}
      </Section>
    </>
  );
}
