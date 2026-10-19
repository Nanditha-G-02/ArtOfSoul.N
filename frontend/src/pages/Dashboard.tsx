import { Link } from "react-router-dom";
import { PaintMark, PencilMark } from "../components/Art";
import { Empty, ErrorNote, Loading, PageHeader, Section } from "../components/ui";
import { useAuth } from "../lib/auth";
import { date, minutes, useFetch } from "../lib/hooks";
import type { Exercise, Lesson, Profile } from "../lib/types";

interface Dash {
  profile: Profile;
  syllabus: { id: number; title: string; total: number; done: number } | null;
  current_lesson: Lesson | null;
  skill_counts: Record<string, number>;
  last_analysis: { id: number; artwork_id: number; next_milestone: string; created_at: string } | null;
  open_exercises: Exercise[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useFetch<Dash>("/api/dashboard");
  if (loading) return <Loading />;
  if (error || !data) return <ErrorNote message={error} onRetry={reload} />;
  const p = data.profile;
  const pencil = p.track === "pencil";
  const pct = data.syllabus?.total ? Math.round((data.syllabus.done / data.syllabus.total) * 100) : 0;
  const counts = data.skill_counts;
  const assessed = (counts.in_progress ?? 0) + (counts.needs_practice ?? 0) + (counts.proficient ?? 0);

  return (
    <>
      <PageHeader title={`Good to see you, ${user?.display_name.split(" ")[0]}`}
        intro={<span className="inline-flex items-center gap-2">{pencil ? <PencilMark size={22} /> : <PaintMark size={22} />}
          {pencil ? "Advanced pencil drawing" : `Advanced painting · ${p.medium}`} · {p.weekly_hours} h a week</span>} />

      {!data.syllabus ? (
        <Empty title="Let's build your syllabus" tone={pencil ? "violet" : "coral"}
          action={<Link to="/syllabus" className={pencil ? "btn-pencil" : "btn-paint"}>Build my learning roadmap</Link>}>
          Describe your goal and ArtOfSoul.N will assemble an ordered, advanced plan from its curriculum graph and the
          university course records behind it.
        </Empty>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <article className={`rounded-[1.6rem] p-7 ${pencil ? "bg-lavender" : "bg-rose"}`}>
            <p className="text-sm text-ink-soft">{data.syllabus.title}</p>
            {data.current_lesson ? <>
              <h2 className="mt-2 text-[1.9rem]">{data.current_lesson.title}</h2>
              <p className="mt-2 text-ink-soft">{data.current_lesson.objectives[0]}</p>
              <p className="mt-3 text-sm text-ink-soft">{minutes(data.current_lesson.est_minutes)} · {data.current_lesson.stage_title}
                {data.current_lesson.kind === "remedial" && " · focused practice added from your assessments"}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link to="/teacher" state={{ lessonId: data.current_lesson.id }} className={pencil ? "btn-pencil" : "btn-paint"}>Start this lesson with my teacher</Link>
                <Link to="/analysis" className="btn-outline">Upload my attempt</Link>
              </div>
            </> : <h2 className="mt-2 text-2xl">Every lesson is complete. Time for a new goal.</h2>}
          </article>
          <article className="panel p-7">
            <h2 className="text-xl">Plan progress</h2>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-paper-deep" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-gradient-to-r from-violet to-coral" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-sm text-ink-soft">{data.syllabus.done} of {data.syllabus.total} lessons done or skipped</p>
            <h2 className="mt-6 text-xl">Skills with evidence</h2>
            {assessed ? <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-lavender p-2"><dt className="text-xs text-ink-soft">Proficient</dt><dd className="font-display text-2xl">{counts.proficient}</dd></div>
              <div className="rounded-xl bg-sky p-2"><dt className="text-xs text-ink-soft">In progress</dt><dd className="font-display text-2xl">{counts.in_progress}</dd></div>
              <div className="rounded-xl bg-rose p-2"><dt className="text-xs text-ink-soft">Practise</dt><dd className="font-display text-2xl">{counts.needs_practice}</dd></div>
            </dl> : <p className="mt-2 text-sm text-ink-soft">No assessments yet. Upload a piece to the analysis studio to start building evidence.</p>}
            <Link to="/roadmap" className="mt-5 inline-block text-sm font-semibold text-violet underline">Open roadmap</Link>
          </article>
        </div>
      )}

      <Section title="Open practice" aside={<Link className="text-sm font-semibold text-violet underline" to="/teacher">Ask for an exercise</Link>}>
        {data.open_exercises.length ? (
          <ul className="grid gap-3 md:grid-cols-3">{data.open_exercises.map((e) => (
            <li key={e.id} className="panel p-5"><p className="text-xs text-ink-faint">{e.kind === "project" ? "Project" : "Exercise"} · {minutes(e.est_minutes)}</p>
              <h3 className="mt-1 text-lg">{e.title}</h3><p className="mt-1 line-clamp-3 text-sm text-ink-soft">{e.objective}</p></li>))}</ul>
        ) : <p className="text-ink-soft">Nothing assigned. Your teacher can create a focused session based on your recorded gaps.</p>}
      </Section>

      {data.last_analysis && <Section title="Latest feedback">
        <Link to={`/analysis/${data.last_analysis.artwork_id}`} className="panel block p-5 hover:border-ink-faint">
          <p className="text-sm text-ink-faint">{date(data.last_analysis.created_at)}</p>
          <p className="mt-1">Next milestone: {data.last_analysis.next_milestone || "—"}</p>
        </Link>
      </Section>}
    </>
  );
}
