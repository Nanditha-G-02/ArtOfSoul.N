import { motion } from "motion/react";
import { Link } from "react-router-dom";
import ModelPicker from "../components/ModelPicker";
import { ErrorNote, Loading, StatusChip } from "../components/ui";
import { mediaUrl } from "../lib/api";
import { date, useFetch } from "../lib/hooks";
import type { Artwork, Lesson, Profile, SkillStatus } from "../lib/types";

interface Prog {
  profile: Profile; syllabus: { title: string; total: number; completed: number } | null; current_lesson: Lesson | null;
  completed_lessons: { id: number; title: string; completed_at: string }[]; checks: { answered: number; correct: number };
  streak_days: number; activities: number;
  skills: { slug: string; name: string; status: SkillStatus }[];
  recent_feedback: { id: number; artwork: Artwork; suitable: boolean; next: string; created_at: string }[];
}
interface Hw {
  os: string; cpu_cores: number; ram_gb: number | null; gpu: { name: string; vram_gb: number } | null; free_disk_gb: number | null;
  recommended_model: string; recommendation_reason: string; current_model: string;
  image_generation: { practical: boolean; note: string };
  ai_roles: Record<string, { provider: string; model: string; configured: boolean; hint: string }>;
  voice: { ready: boolean; voice: string; hint: string };
}

function Ring({ value, total, color, label }: { value: number; total: number; color: string; label: string }) {
  const pct = total ? value / total : 0;
  return (
    <div className="flex flex-col items-center glass p-5">
      <svg viewBox="0 0 100 100" className="h-24 w-24" aria-hidden>
        <circle cx="50" cy="50" r="40" fill="none" stroke="#f3ece2" strokeWidth="10" />
        <motion.circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" transform="rotate(-90 50 50)"
          initial={{ pathLength: 0 }} animate={{ pathLength: pct, opacity: pct ? 1 : 0 }} transition={{ duration: 1 }} />
        <text x="50" y="56" textAnchor="middle" fontSize="20" fontWeight="700" fill="#16161d">{value}/{total}</text>
      </svg>
      <p className="mt-2 text-sm font-bold text-ink-soft">{label}</p>
    </div>
  );
}

export default function Progress() {
  const { data, error, loading } = useFetch<Prog>("/api/progress");
  const hw = useFetch<Hw>("/api/system/hardware");
  if (loading) return <Loading />;
  if (!data) return <ErrorNote message={error} />;
  const prof = data.skills.filter((s) => s.status !== "not_assessed");
  const textRoles = hw.data ? Object.entries(hw.data.ai_roles).filter(([r]) => r !== "image") : [];
  const aiReady = textRoles.length > 0 && textRoles.every(([, s]) => s.configured);

  return (
    <>
      <h1 className="text-[2.3rem]">Your progress</h1>
      {data.current_lesson ? <Link to={`/studio/${data.current_lesson.id}`} className="btn-big mt-4">Continue: {data.current_lesson.title}</Link>
        : !data.syllabus ? <Link to="/start" className="btn-big mt-4">Start My Art Journey</Link> : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass flex items-center gap-3 px-5 py-3">
          <motion.span className="grid h-10 w-10 place-items-center rounded-full bg-bloom text-lg font-bold text-white" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity }}>{data.streak_days}</motion.span>
          <span><strong>day streak</strong><br /><span className="text-sm text-ink-soft">{data.streak_days ? "Keep it going today!" : "Learn something today to start one."}</span></span>
        </motion.div>
        <div className="glass flex items-center gap-3 px-5 py-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-lg font-bold text-white">{data.activities}</span>
          <span><strong>activities played</strong><br /><span className="text-sm text-ink-soft">Games, labs and sketches</span></span>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Ring value={data.syllabus?.completed ?? 0} total={data.syllabus?.total ?? 0} color="#4f7032" label="Lessons finished" />
        <Ring value={data.checks.correct} total={data.checks.answered} color="#3f6f8f" label="Quiz answers correct" />
        <Ring value={data.recent_feedback.filter((f) => f.suitable).length} total={data.recent_feedback.length} color="#ef6a3f" label="Practice pieces reviewed" />
      </div>

      {!!prof.length && <section className="mt-10"><h2 className="text-xl">Skills from your practice</h2>
        <ul className="mt-3 flex flex-wrap gap-2">{prof.map((s) => <li key={s.slug} className="flex items-center gap-2 rounded-full bg-white/80 py-1 pl-3 pr-1 text-sm">{s.name}<StatusChip status={s.status} /></li>)}</ul></section>}

      {!!data.recent_feedback.length && <section className="mt-10"><h2 className="text-xl">Recent practice</h2>
        <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{data.recent_feedback.map((f) => (
          <li key={f.id} className="overflow-hidden rounded-2xl bg-white"><img src={mediaUrl(f.artwork.url)} alt={f.artwork.title} className="aspect-square w-full object-cover" />
            <p className="p-2 text-xs text-ink-soft">{date(f.created_at)}</p></li>))}</ul></section>}

      {!!data.completed_lessons.length && <section className="mt-10"><h2 className="text-xl">Finished lessons</h2>
        <ul className="mt-2 space-y-1">{data.completed_lessons.map((l) => <li key={l.id} className="text-[15px]">✓ {l.title} <span className="text-xs text-ink-faint">{l.completed_at ? date(l.completed_at) : ""}</span></li>)}</ul></section>}

      <section className="mt-12 glass p-6" id="setup">
        <h2 className="text-xl">Setup on this computer</h2>
        {!hw.data ? <Loading label="Checking this computer" /> : <div className="mt-3 grid gap-6 md:grid-cols-2 text-[15px]">
          <div>
            <p>{hw.data.os} · {hw.data.cpu_cores} CPU cores · {hw.data.ram_gb ?? "?"} GB RAM{hw.data.gpu ? ` · ${hw.data.gpu.name} (${hw.data.gpu.vram_gb} GB)` : " · no NVIDIA GPU found"}</p>

          </div>
          <ul className="space-y-1.5">
            <li>AI teacher: <strong className={aiReady ? "text-teal" : "text-coral"}>{aiReady ? "ready" : "not ready"}</strong>
              {!aiReady && textRoles[0] && <span className="block text-sm text-ink-soft">{textRoles.find(([, s]) => !s.configured)?.[1].hint}</span>}</li>
            <li>Voice: <strong>{hw.data.voice.ready ? "local Piper voice" : "built-in system voice"}</strong>
              {!hw.data.voice.ready && <span className="block text-sm text-ink-soft">Optional upgrade: {hw.data.voice.hint}</span>}</li>
            <li>Picture generation: <strong>{hw.data.ai_roles.image?.configured ? "on" : "off (optional)"}</strong>
              <span className="block text-sm text-ink-soft">{hw.data.image_generation.note}</span></li>
          </ul>
        </div>}
        <div className="mt-6 border-t border-white/70 pt-5"><ModelPicker /></div>
      </section>
    </>
  );
}
