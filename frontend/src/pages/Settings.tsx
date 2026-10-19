import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorNote, PageHeader, Section } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useFetch } from "../lib/hooks";
import type { AiStatus, Medium, Profile, Track } from "../lib/types";

const ROLE: Record<string, string> = {
  teacher: "Art teacher conversations", curriculum: "Syllabus generation", vision: "Artwork observation", assessment: "Rubric assessment",
  coordinator: "Request routing & memory", exercise: "Exercises & palettes", image: "Reference images",
};

export default function Settings() {
  const { profile, setProfile, signOut } = useAuth();
  const nav = useNavigate();
  const status = useFetch<AiStatus>("/api/system/ai-status");
  const usage = useFetch<Record<string, { calls: number; errors: number; input_tokens: number; output_tokens: number }>>("/api/system/usage");
  const [p, setP] = useState<Profile | null>(profile);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!p) return null;
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => { setP({ ...p, [k]: v }); setSaved(false); };

  async function save() {
    setErr(null);
    try {
      const body = { track: p!.track, medium: p!.track === "painting" ? p!.medium : "graphite", goals: p!.goals, experience: p!.experience,
        weekly_hours: p!.weekly_hours, teaching_style: p!.teaching_style, memory_notes: p!.memory_notes,
        preferred_subjects: p!.preferred_subjects, strengths: p!.strengths, difficulties: p!.difficulties };
      setProfile(await api.patch<Profile>("/api/me/profile", body)); setSaved(true);
    } catch (e) { setErr((e as Error).message); }
  }
  async function exportData() {
    const data = await api.get("/api/me/export");
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "artofsoul-data.json"; a.click(); URL.revokeObjectURL(url);
  }
  async function deleteAccount() {
    if (!confirm("Delete your account, artwork and all learning records permanently?")) return;
    await api.del("/api/me"); signOut(); nav("/");
  }
  const listField = (k: "preferred_subjects" | "strengths" | "difficulties", label: string) => (
    <div><label className="label" htmlFor={k}>{label}</label>
      <input id={k} className="field" value={p[k].join(", ")} onChange={(e) => set(k, e.target.value.split(",").map((s) => s.trimStart()))} /></div>);

  return (
    <>
      <PageHeader title="Settings" />
      <Section title="Learning profile">
        <div className="panel grid gap-5 p-6 sm:grid-cols-2">
          <div><label className="label" htmlFor="tr">Track</label>
            <select id="tr" className="field" value={p.track ?? ""} onChange={(e) => set("track", e.target.value as Track)}>
              <option value="pencil">Advanced pencil drawing</option><option value="painting">Advanced painting</option></select></div>
          {p.track === "painting" && <div><label className="label" htmlFor="md">Painting medium</label>
            <select id="md" className="field" value={p.medium === "graphite" ? "" : p.medium ?? ""} onChange={(e) => set("medium", e.target.value as Medium)}>
              <option value="" disabled>Choose…</option><option value="oil">Oil</option><option value="acrylic">Acrylic</option><option value="watercolor">Watercolour</option></select></div>}
          <div className="sm:col-span-2"><label className="label" htmlFor="gl">Goals</label><textarea id="gl" className="field min-h-20" value={p.goals} onChange={(e) => set("goals", e.target.value)} /></div>
          {listField("preferred_subjects", "Preferred subjects")}{listField("strengths", "Strengths")}{listField("difficulties", "Difficulties")}
          <div><label className="label" htmlFor="wh">Hours per week</label><input id="wh" type="number" min={1} max={60} className="field" value={p.weekly_hours} onChange={(e) => set("weekly_hours", +e.target.value)} /></div>
          <div><label className="label" htmlFor="ts">Teaching style</label>
            <select id="ts" className="field" value={p.teaching_style} onChange={(e) => set("teaching_style", e.target.value)}>
              <option value="balanced">Balanced</option><option value="direct">Direct</option><option value="socratic">Socratic</option><option value="demonstration">Demonstration</option></select></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="mem">What your teacher remembers about you</label>
            <textarea id="mem" className="field min-h-28" value={p.memory_notes} onChange={(e) => set("memory_notes", e.target.value)} maxLength={4000} />
            <p className="mt-1 text-xs text-ink-faint">Updated from your conversations every few messages. Edit or clear anything that's wrong.</p></div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button className="btn-primary" onClick={save}>Save profile</button>
            {saved && <span className="text-sm text-teal">Saved. Rebuild your syllabus to apply a new track, medium or goal.</span>}
          </div>
          <div className="sm:col-span-2"><ErrorNote message={err} /></div>
        </div>
      </Section>

      <Section title="AI models on this server">
        <p className="mb-3 text-sm text-ink-soft">By default everything runs on free local models through Ollama on this computer — nothing is sent to a paid service. Models are set in the backend's .env file.</p>
        <ul className="panel divide-y divide-line">
          {status.data && Object.entries(status.data).map(([role, s]) => (
            <li key={role} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <span>{ROLE[role] ?? role}{!s.configured && s.hint && <span className="block text-xs text-ink-faint">{s.hint}</span>}</span>
              <span className="flex items-center gap-3"><code className="text-ink-soft">{s.provider}:{s.model}</code>
                <span className={`chip ${s.configured ? "bg-sky text-teal" : "bg-rose text-[#8f3a33]"}`}>{s.configured ? "Ready" : "Not ready"}</span>
                {s.free && <span className="chip bg-lavender text-violet-deep">Free · local</span>}
                {usage.data?.[role] && <span className="text-xs text-ink-faint">{usage.data[role].calls} calls by you</span>}</span>
            </li>))}
        </ul>
      </Section>

      <Section title="Privacy">
        <div className="flex flex-wrap gap-3">
          <button className="btn-outline" onClick={exportData}>Download my data</button>
          <button className="btn border border-[#efc4be] text-[#8f3a33] hover:bg-rose" onClick={deleteAccount}>Delete my account</button>
        </div>
        <p className="mt-3 text-sm text-ink-soft">Uploaded photos are re-encoded on arrival, which removes camera metadata such as location. Images are served only through signed links that expire.</p>
      </Section>
    </>
  );
}
