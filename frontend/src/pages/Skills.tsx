import { useState } from "react";
import { ErrorNote, Loading, PageHeader, StatusChip } from "../components/ui";
import { api } from "../lib/api";
import { date, useFetch } from "../lib/hooks";
import type { SkillRow, SkillStatus } from "../lib/types";

interface Ev { id: number; rating: string; source: string; note: string; created_at: string }
const SOURCE: Record<string, string> = { artwork_analysis: "Artwork analysis", diagnostic: "Self-placement", self_report: "Self-report", lesson: "Lesson" };
const TIER = ["Refreshers", "Core advanced", "Mastery", "Capstone"];

function Row({ s, onChanged }: { s: SkillRow; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [ev, setEv] = useState<Ev[] | null>(null);
  const [edit, setEdit] = useState<SkillStatus>(s.status);
  const [err, setErr] = useState<string | null>(null);
  async function expand() {
    setOpen(!open);
    if (!ev) try { setEv(await api.get<Ev[]>(`/api/skills/${s.slug}/evidence`)); } catch (e) { setErr((e as Error).message); }
  }
  async function save() {
    try { await api.put(`/api/skills/${s.slug}`, { status: edit, note: "" }); onChanged(); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <li className="border-b border-line py-3">
      <button className="flex w-full items-center justify-between gap-3 text-left" onClick={expand} aria-expanded={open}>
        <span><span className="font-medium">{s.name}</span> <span className="text-xs text-ink-faint">{s.domain}{s.evidence_count ? ` · ${s.evidence_count} record${s.evidence_count > 1 ? "s" : ""}` : ""}</span></span>
        <span className="flex items-center gap-2">{s.user_override && <span className="text-xs text-ink-faint">set by you</span>}<StatusChip status={s.status} /></span>
      </button>
      {open && <div className="mt-3 grid gap-3 rounded-xl bg-white p-4 text-sm">
        <p className="text-ink-soft">{s.explanation}</p>
        {ev && (ev.length ? <ul className="grid gap-1">{ev.map((e) => <li key={e.id}>{date(e.created_at)} · {SOURCE[e.source] ?? e.source}: <strong>{e.rating.replace("_", " ")}</strong>{e.note && <span className="text-ink-soft"> — {e.note}</span>}</li>)}</ul>
          : <p className="text-ink-faint">No evidence yet.</p>)}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <label htmlFor={`o-${s.slug}`} className="text-ink-soft">Correct this status:</label>
          <select id={`o-${s.slug}`} className="field w-auto py-1.5" value={edit} onChange={(e) => setEdit(e.target.value as SkillStatus)}>
            <option value="not_assessed">Not assessed</option><option value="in_progress">In progress</option>
            <option value="needs_practice">Needs practice</option><option value="proficient">Proficient</option></select>
          <button className="btn-outline py-1.5" disabled={edit === s.status} onClick={save}>Save</button>
          <span className="text-xs text-ink-faint">Manual changes are labelled and are replaced by the next artwork evidence.</span>
        </div>
        <ErrorNote message={err} />
      </div>}
    </li>
  );
}

export default function Skills() {
  const { data, error, loading, reload } = useFetch<SkillRow[]>("/api/skills/profile");
  if (loading) return <Loading />;
  const tiers = [0, 1, 2, 3].map((t) => (data ?? []).filter((s) => s.tier === t));
  const count = (st: SkillStatus) => (data ?? []).filter((s) => s.status === st).length;
  return (
    <>
      <PageHeader title="Skills and progress" intro="Each skill is tracked on its own, from recorded evidence. There's no single overall score." />
      <ErrorNote message={error} />
      <div className="mb-8 flex flex-wrap gap-3 text-sm">
        {(["proficient", "in_progress", "needs_practice", "not_assessed"] as SkillStatus[]).map((st) => <span key={st} className="flex items-center gap-2"><StatusChip status={st} /> {count(st)}</span>)}
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        {tiers.map((list, t) => !!list.length && (
          <section key={t}><h2 className="text-xl">{TIER[t]}</h2><ul className="mt-2">{list.map((s) => <Row key={s.slug} s={s} onChanged={reload} />)}</ul></section>))}
      </div>
    </>
  );
}
