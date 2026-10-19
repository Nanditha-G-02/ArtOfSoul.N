import { AnimatePresence, motion } from "motion/react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const LINKS: [string, string][] = [["/roadmap", "Roadmap"], ["/studio", "Studio"], ["/practice", "Practice"], ["/progress", "Progress"]];

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <NavLink to="/" className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden><circle cx="13" cy="16" r="10" fill="#7c4dcc" /><circle cx="20" cy="16" r="10" fill="#d9675e" fillOpacity=".85" /></svg>
      <span className={`${compact ? "hidden sm:inline" : ""} font-display text-xl`}>ArtOfSoul<span className="text-coral">.N</span></span>
    </NavLink>
  );
}

/** Soft colour blobs and a few drifting art marks behind every page. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="blob left-[-8rem] top-[-6rem] h-96 w-96 bg-lavender" />
      <div className="blob right-[-6rem] top-[20%] h-80 w-80 bg-peach" />
      <div className="blob bottom-[-8rem] left-[30%] h-96 w-96 bg-sky" />
      {[["10%", "70%", "#d9675e"], ["85%", "75%", "#23807f"], ["70%", "12%", "#7c4dcc"]].map(([l, t, c], i) => (
        <motion.span key={i} className="absolute block h-3 w-3 rounded-full" style={{ left: l, top: t, background: c, opacity: 0.5 }}
          animate={{ y: [0, -14, 0] }} transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }} />))}
    </div>
  );
}

export default function Shell() {
  const loc = useLocation();
  return (
    <div className="min-h-dvh">
      <Backdrop />
      <header className="sticky top-0 z-20 border-b border-white/60 bg-paper/75 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Brand compact />
          <nav className="flex gap-1 overflow-x-auto" aria-label="Main">
            {LINKS.map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-bold sm:px-3.5 transition-colors ${isActive ? "bg-ink text-paper" : "text-ink-soft hover:bg-white"}`}>{label}</NavLink>))}
          </nav>
        </div>
      </header>
      <AnimatePresence mode="wait">
        <motion.main key={loc.pathname.split("/")[1]} className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
          <Outlet />
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
