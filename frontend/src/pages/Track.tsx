import { Link, useParams } from "react-router-dom";
import { PaintMark, PencilMark } from "../components/Art";
import { ErrorNote, Loading, Section } from "../components/ui";
import { useAuth } from "../lib/auth";
import { date, useFetch } from "../lib/hooks";
import type { Course } from "../lib/types";

interface Module { slug: string; title: string; description: string; provenance: string;
  objectives: { skill: string; skill_name: string; tier: number; media: string[]; text: string }[] }

const TIER = ["Refresher", "Core advanced", "Mastery", "Capstone"];

export default function TrackPage() {
  const { track = "pencil" } = useParams();
  const { profile } = useAuth();
  const pencil = track === "pencil";
  const mods = useFetch<Module[]>(`/api/curriculum/modules?track=${track}`);
  const src = useFetch<Course[]>(`/api/curriculum/sources?track=${track}`);

  return (
    <>
      <header className={`-mx-4 mb-10 rounded-none px-6 py-10 sm:mx-0 sm:rounded-[1.8rem] sm:px-10 ${pencil ? "bg-lavender" : "bg-rose"}`}>
        {pencil ? <PencilMark size={52} /> : <PaintMark size={52} />}
        <h1 className={`mt-4 text-[2.4rem] ${pencil ? "text-violet-deep" : "text-[#8f3a33]"}`}>{pencil ? "Advanced pencil drawing" : "Advanced painting"}</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          {pencil ? "Graphite study at an advanced level: structure, light, edges, materials, the figure and finished realism."
            : "Colour, light and form in paint, with oil, acrylic and watercolour taught as separate media where their handling differs."}
        </p>
        {profile?.track !== track && <p className="mt-4 text-sm">This isn't your current track. You can switch in <Link to="/settings" className="underline">Settings</Link>; completed lessons are kept.</p>}
      </header>

      <Section title="Curriculum modules">
        <p className="mb-5 max-w-2xl text-sm text-ink-soft">These modules and objectives are original ArtOfSoul.N content. Your syllabus picks from them according to your goal and evidence.</p>
        {mods.loading && <Loading />}<ErrorNote message={mods.error} />
        <div className="grid gap-4">
          {mods.data?.map((m) => (
            <details key={m.slug} className="panel group p-5 open:bg-white">
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3">
                <span><span className="font-display text-xl">{m.title}</span><span className="ml-3 text-sm text-ink-soft">{m.description}</span></span>
                <span className="text-sm text-ink-faint group-open:hidden">{m.objectives.length} skills</span>
              </summary>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {m.objectives.map((o) => (
                  <li key={o.skill} className="rounded-xl bg-paper p-3.5">
                    <p className="font-semibold">{o.skill_name}</p>
                    <p className="text-xs text-ink-faint">{TIER[o.tier]}{o.media.length ? ` · ${o.media.join(", ")} only` : ""}</p>
                    <p className="mt-1 text-sm text-ink-soft">{o.text}</p>
                  </li>))}
              </ul>
            </details>))}
        </div>
      </Section>

      <Section title="Institutional sources">
        <p className="mb-5 max-w-2xl text-sm text-ink-soft">
          Course records reviewed at each institution's official catalogue. Summaries are our paraphrases; skill links are our
          own mapping (“inferred”). Courses marked “partial” publish no description, so nothing is attributed to them beyond their existence.
        </p>
        {src.loading && <Loading />}<ErrorNote message={src.error} />
        <ul className="grid gap-3">
          {src.data?.map((c) => (
            <li key={c.id} className="panel p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg">{c.course_code} · {c.title}</h3>
                <span className={`chip ${c.verification === "verified" ? "bg-sky text-teal" : "bg-amber-soft text-[#8a6418]"}`}>{c.verification === "verified" ? "Verified description" : "Partial — title only"}</span>
              </div>
              <p className="text-sm text-ink-soft">{c.institution} · {c.level}</p>
              <p className="mt-2 text-[15px]">{c.summary}</p>
              <p className="mt-2 text-xs text-ink-faint">{c.source_type} · reviewed {date(c.last_reviewed)} · <a className="underline" href={c.source_url} target="_blank" rel="noreferrer">Official page</a></p>
            </li>))}
        </ul>
      </Section>
    </>
  );
}
