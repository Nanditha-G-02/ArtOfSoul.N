import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Avatar from "../components/Avatar";
import { ErrorNote, List, Loading } from "../components/ui";
import { api } from "../lib/api";
import { minutes, useFetch } from "../lib/hooks";
import type { Lesson, Roadmap, Syllabus } from "../lib/types";

const X = [22, 50, 78, 50];
const COLORS = ["#7c4dcc", "#d9675e", "#23807f", "#4f9ccf", "#c2923a"];

function Node({ l, idx, onOpen }: { l: Lesson; idx: number; onOpen: () => void }) {
  const done = l.status === "completed", cur = l.status === "current", skip = l.status === "skipped";
  return (
    <div className="flex w-0 justify-center" style={{ marginLeft: `${X[idx % 4]}%` }}>
    <motion.button onClick={onOpen} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.06, type: "spring", stiffness: 220, damping: 18 }}
      whileHover={{ scale: 1.06 }} className="group relative flex shrink-0 flex-col items-center"
      aria-label={`${l.title} — ${l.status}`}>
      <span className={`relative grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 text-lg font-bold shadow-md ${done ? "border-purple bg-purple text-white" : cur ? "border-coral bg-white text-coral" : skip ? "border-line bg-paper-deep text-ink-faint" : "border-white bg-white text-ink-soft"}`}>
        {done ? "✓" : idx + 1}
        {cur && <motion.span className="absolute inset-[-8px] rounded-full border-2 border-coral" animate={{ scale: [1, 1.18, 1], opacity: [0.8, 0, 0.8] }} transition={{ duration: 2, repeat: Infinity }} />}
        {l.is_milestone && <span className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-amber ring-2 ring-white" title="Milestone" />}
      </span>
      <span className={`mt-2 w-44 text-center text-[15px] font-bold leading-tight ${skip ? "text-ink-faint line-through" : ""}`}>{l.title}</span>
      <span className="text-xs text-ink-faint">{cur ? "You are here" : l.kind === "remedial" ? "Extra practice" : minutes(l.est_minutes)}</span>
    </motion.button>
    </div>
  );
}

function Connector({ from, to, done, color }: { from: number; to: number; done: boolean; color: string }) {
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-14 w-full" aria-hidden>
      <motion.path d={`M${X[from % 4]} 0 C ${X[from % 4]} 22, ${X[to % 4]} 18, ${X[to % 4]} 40`} fill="none"
        stroke={done ? color : "#d9d2e6"} strokeWidth="1.2" strokeDasharray={done ? "0" : "2 2"} vectorEffect="non-scaling-stroke"
        style={{ strokeWidth: 5 }} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
    </svg>
  );
}

export default function RoadmapPage() {
  const loc = useLocation() as { state?: { fresh?: boolean } };
  const rm = useFetch<Roadmap | null>("/api/roadmap");
  const syl = useFetch<Syllabus | null>("/api/syllabus");
  const [open, setOpen] = useState<Lesson | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (rm.loading || syl.loading) return <Loading label="Opening your roadmap" />;
  if (!rm.data || !syl.data) return (
    <div className="grid place-items-center gap-4 py-16 text-center">
      <Avatar mood="idle" size={200} />
      <h1 className="text-3xl">No plan yet</h1>
      <Link to="/start" className="btn-big">Start My Art Journey</Link>
    </div>);

  const lessons = rm.data.stages.flatMap((s) => s.lessons);
  const current = lessons.find((l) => l.status === "current");
  const done = lessons.filter((l) => l.status === "completed").length;
  const latestChange = rm.data.versions.find((v) => v.changes.length);

  async function rebuild() {
    setBusy(true); setErr(null);
    try { await api.post("/api/syllabus", { goal: syl.data!.goal }); await Promise.all([rm.reload(), syl.reload()]); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <section className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-bold text-purple">{loc.state?.fresh ? "Your plan is ready" : "Your learning journey"}</p>
          <h1 className="mt-1 text-[2.3rem] leading-tight">{syl.data.title}</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">{syl.data.overview}</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-3 w-56 overflow-hidden rounded-full bg-white"><motion.div className="h-full rounded-full bg-gradient-to-r from-purple to-coral"
              initial={{ width: 0 }} animate={{ width: `${(done / Math.max(lessons.length, 1)) * 100}%` }} transition={{ duration: 0.8 }} /></div>
            <span className="text-sm text-ink-soft">{done} of {lessons.length} lessons</span>
          </div>
          {current && <Link to={`/studio/${current.id}`} className="btn-big mt-6">Next lesson: {current.title}</Link>}
        </div>
        {!!syl.data.practice_plan?.length && <aside className="rounded-3xl bg-white/80 p-5 md:w-80">
          <h2 className="text-lg">Your practice routine</h2>
          <ul className="mt-2 space-y-2 text-[15px]">{syl.data.practice_plan.map((p, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS[i % 5] }} />{p}</li>)}</ul>
        </aside>}
      </section>

      {latestChange && <div className="mt-6 rounded-2xl bg-amber-soft px-5 py-3 text-[15px]"><strong>Plan updated from your practice: </strong>{latestChange.changes[0].reason}</div>}

      <div className="mx-auto mt-10 max-w-3xl">
        {rm.data.stages.map((st, si) => {
          const offset = rm.data!.stages.slice(0, si).reduce((n, s) => n + s.lessons.length, 0);
          return (
            <section key={st.index} className="mb-2">
              <h2 className="mb-3 text-center text-xl"><span className="rounded-full px-4 py-1 text-white" style={{ background: COLORS[si % 5] }}>{st.index < 0 ? "Completed earlier" : st.title}</span></h2>
              {st.lessons.map((l, k) => {
                const idx = offset + k;
                return <div key={l.id}>
                  {k > 0 && <Connector from={idx - 1} to={idx} done={st.lessons[k - 1].status === "completed"} color={COLORS[si % 5]} />}
                  <Node l={l} idx={idx} onOpen={() => setOpen(l)} />
                </div>;
              })}
            </section>);
        })}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm text-ink-soft">
        <button className="btn-outline" disabled={busy} onClick={rebuild}>{busy ? "Rebuilding — this can take a few minutes…" : "Rebuild my plan"}</button>
        <Link className="btn-ghost" to="/start">Change my answers</Link>
      </div>
      <div className="mx-auto mt-3 max-w-md"><ErrorNote message={err} /></div>

      <AnimatePresence>
        {open && <motion.div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30 p-0 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)}>
          <motion.div role="dialog" aria-modal aria-label={open.title} className="max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-paper p-6 sm:rounded-3xl"
            initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-ink-faint">{open.stage_title} · {minutes(open.est_minutes)}</p>
            <h2 className="mt-1 text-2xl">{open.title}</h2>
            <h3 className="mt-4 font-bold">You'll learn to</h3><List items={open.objectives} />
            {!!open.exercises.length && <><h3 className="mt-4 font-bold">Practice</h3>
              <ul className="mt-1 space-y-2">{open.exercises.map((e, i) => <li key={i} className="rounded-xl bg-white p-3"><strong>{e.title}</strong><p className="text-sm text-ink-soft">{e.brief}</p></li>)}</ul></>}
            <div className="mt-6 flex gap-2">
              {open.status !== "skipped" ? <Link to={`/studio/${open.id}`} className="btn-big">{open.status === "completed" ? "Review lesson" : "Start lesson"}</Link>
                : <button className="btn-outline" onClick={async () => { await api.patch(`/api/lessons/${open.id}`, { status: "upcoming" }); setOpen(null); rm.reload(); }}>Restore this lesson</button>}
              <button className="btn-ghost" onClick={() => setOpen(null)}>Close</button>
            </div>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
    </>
  );
}
