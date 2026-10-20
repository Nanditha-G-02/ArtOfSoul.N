import { motion } from "motion/react";
import { Link } from "react-router-dom";
import Avatar from "../components/Avatar";
import Landscape from "../components/Landscape";
import { PillNav } from "../components/Shell";
import { useSession } from "../lib/session";
import { TUTOR } from "../lib/tutor";

const STEPS: [string, string][] = [
  ["Tell me about you", "A few quick questions: pencil or painting, your level, your goal and your time."],
  ["Get your roadmap", "A lesson plan made for you, in the right order, sized to your day."],
  ["Learn with me", "I talk you through each lesson with animated demonstrations, then check your practice."],
];

export default function Home() {
  const { profile, user } = useSession();
  const started = !!profile?.onboarding_complete;
  const primary = started ? { to: "/studio", label: "Continue learning" } : { to: "/start", label: "Start My Art Journey" };

  return (
    <div>
      <PillNav links={started ? [["/roadmap", "Roadmap"], ["/studio", "Studio"], ["/progress", "Progress"]] : [["#how", "How it works"], ["#teacher", `Meet ${TUTOR.name}`]]}
        cta={started ? { to: "/studio", label: "Continue" } : { to: "/start", label: "Start" }} />

      <section className="relative flex min-h-[100dvh] flex-col items-center overflow-hidden">
        <Landscape className="absolute inset-0 h-full w-full" />
        <motion.div className="relative z-10 mt-[22vh] flex flex-col items-center px-5 text-center"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}>
          <span className="rounded-full bg-white/75 px-3.5 py-1 text-[12.5px] font-medium text-ink shadow-sm backdrop-blur">Free · runs on your own computer</span>
          <h1 className="mt-5 text-[2.7rem] leading-[1.02] sm:text-[4.6rem]">Your personal<br className="sm:hidden" /> AI art teacher.</h1>
          <p className="mt-4 max-w-md text-[17px] text-ink-soft">
            {started && user ? `Welcome back, ${user.display_name}. Your next lesson is waiting.` : "Learn pencil drawing or painting with a teacher who plans your lessons and looks at your work."}
          </p>
          <div className="mt-8 flex items-center gap-5">
            <Link to={primary.to} className="btn-light">{primary.label}</Link>
            {!started && <a href="#how" className="text-[15px] font-semibold text-ink">See how it works</a>}
          </div>
        </motion.div>
        <a href="#how" className="absolute bottom-7 z-10 rounded-full bg-ink/45 px-4 py-1.5 text-[11px] font-semibold tracking-[0.2em] text-white backdrop-blur">SCROLL ↓</a>
      </section>

      <section id="teacher" className="bg-paper">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-5 py-24 md:grid-cols-[auto_1fr]">
          <div className="mx-auto"><Avatar size={300} mood="idle" /></div>
          <div>
            <h2 className="text-[2.2rem] sm:text-[2.8rem]">Hi, I'm {TUTOR.name}.</h2>
            <p className="mt-3 max-w-lg text-[17px] text-ink-soft">
              I'll teach you one friendly lesson at a time, speak each step out loud, show you how it's done, and give honest
              feedback on photos of your practice.
            </p>
            <ol id="how" className="mt-10 grid gap-6 sm:grid-cols-3">
              {STEPS.map(([t, d], i) => (
                <li key={t}>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
                  <h3 className="mt-3 text-lg">{t}</h3>
                  <p className="mt-1 text-[15px] text-ink-soft">{d}</p>
                </li>))}
            </ol>
            <Link to={primary.to} className="btn-big mt-10">{primary.label}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
