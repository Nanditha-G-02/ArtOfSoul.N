import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { PaintMark, PencilMark } from "./Art";

const GROUPS: { title: string; links: [string, string][] }[] = [
  { title: "Learn", links: [["/dashboard", "Dashboard"], ["/teacher", "AI art teacher"], ["/syllabus", "My syllabus"], ["/roadmap", "Roadmap"]] },
  { title: "Practise", links: [["/analysis", "Analysis studio"], ["/references", "Reference studio"], ["/portfolio", "Portfolio"]] },
  { title: "You", links: [["/skills", "Skills & progress"], ["/history", "Learning history"], ["/settings", "Settings"]] },
];

function Brand() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden><circle cx="13" cy="16" r="10" fill="#5B3FA0" /><circle cx="20" cy="16" r="10" fill="#D9675E" fillOpacity=".85" /></svg>
      <span className="font-display text-[1.35rem] tracking-tight">ArtOfSoul<span className="text-coral">.N</span></span>
    </Link>
  );
}

function Rail({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, user, signOut } = useAuth();
  const link = ({ isActive }: { isActive: boolean }) =>
    `block rounded-xl px-3 py-2 text-[14.5px] transition-colors ${isActive ? "bg-white text-ink font-semibold shadow-[0_1px_0_#e6dfd4]" : "text-ink-soft hover:text-ink hover:bg-white/60"}`;
  return (
    <nav className="flex h-full flex-col gap-6 px-4 py-6" aria-label="Main">
      <Brand />
      <div className="grid gap-2">
        <NavLink to="/track/pencil" onClick={onNavigate}
          className={({ isActive }) => `flex items-center gap-3 rounded-2xl p-2.5 pr-3 transition-colors ${isActive ? "bg-lavender" : "hover:bg-lavender/60"}`}>
          <PencilMark size={34} />
          <span className="leading-tight"><span className="block text-[14.5px] font-semibold text-violet-deep">Advanced pencil drawing</span>
            {profile?.track === "pencil" && <span className="text-xs text-ink-soft">Your track</span>}</span>
        </NavLink>
        <NavLink to="/track/painting" onClick={onNavigate}
          className={({ isActive }) => `flex items-center gap-3 rounded-2xl p-2.5 pr-3 transition-colors ${isActive ? "bg-rose" : "hover:bg-rose/60"}`}>
          <PaintMark size={34} />
          <span className="leading-tight"><span className="block text-[14.5px] font-semibold text-[#9d3f37]">Advanced painting</span>
            {profile?.track === "painting" && <span className="text-xs text-ink-soft">Your track · {profile.medium}</span>}</span>
        </NavLink>
      </div>
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="mb-1 px-3 text-xs font-semibold text-ink-faint">{g.title}</p>
          <div className="grid gap-0.5">{g.links.map(([to, label]) => <NavLink key={to} to={to} className={link} onClick={onNavigate}>{label}</NavLink>)}</div>
        </div>
      ))}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line px-3 pt-4 text-sm">
        <span className="truncate text-ink-soft">{user?.display_name}</span>
        <button className="font-medium text-ink-soft hover:text-ink" onClick={signOut}>Sign out</button>
      </div>
    </nav>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const wide = loc.pathname.startsWith("/teacher") || loc.pathname.startsWith("/roadmap");
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh overflow-y-auto border-r border-line bg-paper-deep/70 lg:block"><Rail /></aside>
      <div className="flex items-center justify-between border-b border-line bg-paper-deep/70 px-4 py-3 lg:hidden">
        <Brand />
        <button className="btn-outline px-4 py-1.5" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Close" : "Menu"}</button>
      </div>
      {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
        <div className="absolute inset-y-0 left-0 w-[82%] max-w-xs overflow-y-auto bg-paper"><Rail onNavigate={() => setOpen(false)} /></div></div>}
      <main className={`mx-auto w-full px-4 py-8 sm:px-8 lg:py-12 ${wide ? "max-w-6xl" : "max-w-5xl"}`}><Outlet /></main>
    </div>
  );
}
