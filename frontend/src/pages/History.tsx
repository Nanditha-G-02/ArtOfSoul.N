import { Link } from "react-router-dom";
import { Empty, ErrorNote, Loading, PageHeader } from "../components/ui";
import { useFetch } from "../lib/hooks";

interface Rec { id: number; kind: string; summary: string; ref_type: string | null; ref_id: number | null; created_at: string }
const COLOR: Record<string, string> = { analysis: "#d9675e", syllabus: "#5b3fa0", lesson: "#3f2a78", teacher: "#23807f", exercise: "#c2923a", project: "#c2923a", reference: "#8c88a8", artwork: "#d9675e", diagnostic: "#5b3fa0" };

export default function History() {
  const { data, error, loading } = useFetch<Rec[]>("/api/history?limit=300");
  if (loading) return <Loading />;
  const days = new Map<string, Rec[]>();
  for (const r of data ?? []) {
    const d = new Date(r.created_at).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    days.set(d, [...(days.get(d) ?? []), r]);
  }
  const link = (r: Rec) => r.ref_type === "conversation" ? `/teacher/${r.ref_id}` : r.ref_type === "syllabus" ? "/syllabus" : r.ref_type === "lesson" ? "/roadmap" : r.ref_type === "artwork" ? `/analysis/${r.ref_id}` : null;
  return (
    <>
      <PageHeader title="Learning history" intro="Everything you've done in the studio, newest first." />
      <ErrorNote message={error} />
      {data && !data.length && <Empty title="Nothing here yet">Your sessions, uploads, lessons and plan changes will appear here.</Empty>}
      {[...days.entries()].map(([d, recs]) => (
        <section key={d} className="mb-8">
          <h2 className="mb-3 text-lg">{d}</h2>
          <ul className="grid gap-2">{recs.map((r) => {
            const to = link(r);
            const body = <><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLOR[r.kind] ?? "#8c88a8" }} />
              <span className="flex-1">{r.summary}</span><span className="text-xs text-ink-faint">{new Date(r.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span></>;
            return <li key={r.id}>{to ? <Link to={to} className="flex gap-3 rounded-xl bg-white/70 px-4 py-2.5 hover:bg-white">{body}</Link>
              : <div className="flex gap-3 rounded-xl bg-white/70 px-4 py-2.5">{body}</div>}</li>;
          })}</ul>
        </section>))}
    </>
  );
}
