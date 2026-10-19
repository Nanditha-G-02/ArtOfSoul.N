import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "../components/Avatar";
import { Backdrop, Brand } from "../components/Shell";
import { useSession } from "../lib/session";

export default function Home() {
  const { profile, user } = useSession();
  const started = !!profile?.onboarding_complete;
  const [wave, setWave] = useState(true);
  useEffect(() => { const t = setTimeout(() => setWave(false), 2600); return () => clearTimeout(t); }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <Backdrop />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5"><Brand />
        {started && <Link to="/progress" className="btn-ghost">My progress</Link>}</header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-5 pb-12 md:grid-cols-[1.1fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <h1 className="text-[2.8rem] leading-[1.05] sm:text-[4rem]">Your personal<br />AI art teacher.</h1>
          <p className="mt-5 max-w-md text-lg text-ink-soft">
            Answer a few questions and get a plan made for you — then learn pencil drawing or painting one friendly lesson at a time.
          </p>
          <div className="mt-8">
            {started
              ? <Link to="/studio" className="btn-big">Continue learning{user ? `, ${user.display_name}` : ""}</Link>
              : <Link to="/start" className="btn-big">Start My Art Journey</Link>}
          </div>
          <p className="mt-5 text-sm text-ink-faint">Runs on your own computer. Free, private, works offline once set up.</p>
        </motion.div>
        <motion.div className="relative mx-auto" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.1 }}>
          <div className="absolute inset-6 -z-10 rounded-full bg-gradient-to-br from-lavender via-peach to-sky" />
          <Avatar mood={wave ? "happy" : "idle"} size={330} />
          <motion.div className="absolute -left-4 top-10 rounded-2xl rounded-br-sm bg-white px-4 py-2 text-[15px] shadow-lg"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
            Hi! I'm Muse. Shall we make art?
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
