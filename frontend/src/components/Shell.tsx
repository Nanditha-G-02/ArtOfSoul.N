import { AnimatePresence, motion } from "motion/react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import Landscape from "./Landscape";

const LINKS: [string, string][] = [["/roadmap", "Roadmap"], ["/studio", "Studio"], ["/practice", "Practice"], ["/progress", "Progress"]];

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="ArtOfSoul.N home">
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden><path d="M16 3c6 6 9 10 9 15a9 9 0 0 1-18 0c0-5 3-9 9-15Z" fill="#ef6a3f" /><circle cx="16" cy="19" r="4" fill="#fff" opacity=".85" /></svg>
      <span className={`${compact ? "hidden sm:inline" : ""} text-[15px] font-bold tracking-tight`}>ArtOfSoul.N</span>
    </Link>
  );
}

/** Floating white pill navigation, as in the reference. */
export function PillNav({ links = LINKS, cta }: { links?: [string, string][]; cta?: { to: string; label: string } }) {
  return (
    <header className="fixed inset-x-0 top-4 z-30 flex justify-center px-3">
      <div className="flex max-w-full items-center gap-1 rounded-full bg-white/90 py-1.5 pl-4 pr-1.5 shadow-[0_8px_30px_-12px_rgba(22,22,29,.35)] backdrop-blur">
        <Brand compact />
        <nav className="mx-1 flex gap-0.5 overflow-x-auto sm:mx-4" aria-label="Main">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) =>
              `whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13.5px] transition-colors sm:px-3 ${isActive ? "font-semibold text-ink" : "text-ink-soft hover:text-ink"}`}>{label}</NavLink>))}
        </nav>
        {cta && <Link to={cta.to} className="whitespace-nowrap rounded-full bg-ink px-4 py-2 text-[13.5px] font-semibold text-white">{cta.label}</Link>}
      </div>
    </header>
  );
}

/** Quiet painted backdrop for inner pages. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-paper">
      <Landscape variant="soft" className="absolute inset-0 h-full w-full" />
    </div>
  );
}

export default function Shell() {
  const loc = useLocation();
  return (
    <div className="min-h-dvh">
      <Backdrop />
      <PillNav />
      <AnimatePresence mode="wait">
        <motion.main key={loc.pathname.split("/")[1]} className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 sm:px-6"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
          <Outlet />
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
