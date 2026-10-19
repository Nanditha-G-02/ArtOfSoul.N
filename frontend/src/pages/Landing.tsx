import { Link } from "react-router-dom";
import { HeroArt, PaintMark, PencilMark } from "../components/Art";
import { useAuth } from "../lib/auth";
import { useFetch } from "../lib/hooks";
import type { Course } from "../lib/types";

const PENCIL = ["Light families & edge control", "Layered graphite", "Reflective & transparent surfaces", "Drapery", "Facial anatomy & portrait realism", "Hair, hands & the figure", "Atmospheric landscape", "Portfolio direction"];
const PAINT = ["Colour temperature & harmony", "Value grouping in colour", "Oil: fat-over-lean & glazing", "Acrylic drying control", "Watercolour glazing & whites", "Skin tones", "Complex & coloured light", "Visual storytelling"];

const LOOP = [
  ["Tell it where you are", "Track, medium, goals, time, and a rubric-based self-placement you can skip."],
  ["Get a syllabus built for you", "Ordered by a skill-prerequisite graph and grounded in published university course descriptions."],
  ["Learn in the studio", "A mentor that remembers your plan and history, and says when it's giving opinion rather than evidence."],
  ["Upload your work", "A vision model describes what's visible; a separate assessment pass rates skills against explicit rubrics."],
  ["Watch the plan adapt", "Repeated gaps insert focused practice; demonstrated skills let you move on. Every change shows its evidence."],
];

export default function Landing() {
  const { user } = useAuth();
  const { data: sources } = useFetch<Course[]>("/api/curriculum/sources");
  const institutions = [...new Set((sources ?? []).map((s) => s.institution))];
  const start = user ? "/dashboard" : "/signup";

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <span className="flex items-center gap-2.5">
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden><circle cx="13" cy="16" r="10" fill="#5B3FA0" /><circle cx="20" cy="16" r="10" fill="#D9675E" fillOpacity=".85" /></svg>
          <span className="font-display text-[1.4rem]">ArtOfSoul<span className="text-coral">.N</span></span>
        </span>
        <nav className="flex items-center gap-2">
          {user ? <Link className="btn-primary" to="/dashboard">Open my studio</Link> : <>
            <Link className="btn-ghost" to="/login">Sign in</Link>
            <Link className="btn-primary" to="/signup">Create account</Link></>}
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-14">
        <div className="hero-settle">
          <h1 className="text-[2.9rem] leading-[1.04] sm:text-[4.1rem]">Master your art.<br />Guided by intelligence.</h1>
          <p className="mt-5 max-w-[34rem] text-[1.08rem] text-ink-soft">
            An intelligent art mentor that understands your work, personalises your learning, and helps you develop advanced
            pencil drawing and painting skills.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={user ? "/teacher" : "/signup"} className="btn-primary px-6 py-3">Meet your AI art teacher</Link>
            <Link to={user ? "/syllabus" : "/signup"} className="btn-outline px-6 py-3">Build my learning roadmap</Link>
          </div>
          <p className="mt-6 text-sm text-ink-faint">For artists past the basics. Two tracks, nothing else.</p>
        </div>
        <HeroArt className="w-full drop-shadow-[0_30px_60px_rgba(35,31,71,0.14)]" />
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-5 sm:px-8 md:grid-cols-2">
        <article className="rounded-[1.75rem] bg-lavender p-7 sm:p-9">
          <PencilMark size={48} />
          <h2 className="mt-4 text-3xl text-violet-deep">Advanced pencil drawing</h2>
          <p className="mt-2 text-ink-soft">Graphite taken to finished realism: structure first, then value, edges and materials.</p>
          <ul className="mt-5 grid gap-x-4 gap-y-1.5 text-[14.5px] sm:grid-cols-2">{PENCIL.map((t) => <li key={t} className="text-violet-deep">{t}</li>)}</ul>
          <Link to={start} className="btn-pencil mt-7">Start the pencil track</Link>
        </article>
        <article className="rounded-[1.75rem] bg-rose p-7 sm:p-9">
          <PaintMark size={48} />
          <h2 className="mt-4 text-3xl text-[#8f3a33]">Advanced painting</h2>
          <p className="mt-2 text-ink-soft">Oil, acrylic and watercolour taught as different media, because they are.</p>
          <ul className="mt-5 grid gap-x-4 gap-y-1.5 text-[14.5px] sm:grid-cols-2">{PAINT.map((t) => <li key={t} className="text-[#8f3a33]">{t}</li>)}</ul>
          <Link to={start} className="btn-paint mt-7">Start the painting track</Link>
        </article>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <h2 className="max-w-xl text-[2.2rem]">How the teaching loop works</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-5">
          {LOOP.map(([t, d], i) => (
            <li key={t} className="border-t-2 pt-4" style={{ borderColor: ["#5b3fa0", "#3f2a78", "#23807f", "#d9675e", "#c2923a"][i] }}>
              <span className="font-display text-2xl text-ink-faint">{i + 1}</span>
              <h3 className="mt-1 text-lg">{t}</h3>
              <p className="mt-1 text-sm text-ink-soft">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-ink text-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <h2 className="text-[2.1rem] text-paper">Grounded in real course descriptions</h2>
            <p className="mt-4 text-[#cfcbe6]">
              The curriculum is original to ArtOfSoul.N. It was mapped against the published catalogue descriptions of
              advanced drawing and painting courses at the institutions listed here, each linked to its official page.
              None of them endorse or certify this platform.
            </p>
            <Link to={user ? "/track/pencil" : "/signup"} className="btn mt-6 bg-paper text-ink hover:bg-white">See the sources</Link>
          </div>
          <ul className="grid content-start gap-x-6 gap-y-2 text-[15px] text-[#e6e2f5] sm:grid-cols-2">
            {institutions.length ? institutions.map((i) => <li key={i} className="border-b border-white/10 pb-2">{i}</li>)
              : <li className="text-[#cfcbe6]">Start the backend to load the source list.</li>}
          </ul>
        </div>
      </section>
      <footer className="mx-auto max-w-6xl px-5 py-8 text-sm text-ink-faint sm:px-8">
        ArtOfSoul.N · AI feedback is a teaching aid, not a substitute for your own judgement or a human critique.
      </footer>
    </div>
  );
}
