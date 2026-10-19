import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PaintMark, PencilMark } from "../components/Art";
import { ErrorNote } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Medium, Profile, Track } from "../lib/types";

const STYLES = [
  ["direct", "Direct", "Tell me what to fix and how."],
  ["socratic", "Socratic", "Ask questions so I work it out."],
  ["demonstration", "Demonstration", "Walk me through it step by step."],
  ["balanced", "Balanced", "A mix, depending on the topic."],
] as const;
const MEDIA: [Medium, string, string][] = [
  ["oil", "Oil", "Slow drying, indirect layers, fat-over-lean."],
  ["acrylic", "Acrylic", "Fast drying, value shift, glazing medium."],
  ["watercolor", "Watercolour", "Transparent layers and planned whites."],
];
const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export default function Onboarding() {
  const { profile, setProfile, user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [track, setTrack] = useState<Track | null>(profile?.track ?? null);
  const [medium, setMedium] = useState<Medium | null>(profile?.track === "painting" ? profile.medium : null);
  const [goals, setGoals] = useState(profile?.goals ?? "");
  const [experience, setExperience] = useState(profile?.experience ?? "");
  const [subjects, setSubjects] = useState((profile?.preferred_subjects ?? []).join(", "));
  const [strengths, setStrengths] = useState((profile?.strengths ?? []).join(", "));
  const [difficulties, setDifficulties] = useState((profile?.difficulties ?? []).join(", "));
  const [hours, setHours] = useState(profile?.weekly_hours ?? 6);
  const [style, setStyle] = useState(profile?.teaching_style ?? "balanced");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canNext = step === 0 ? !!track && (track === "pencil" || !!medium) : step === 1 ? goals.trim().length > 8 : true;

  async function finish() {
    setBusy(true); setError(null);
    try {
      const p = await api.patch<Profile>("/api/me/profile", {
        track, medium: track === "painting" ? medium : "graphite", goals, experience,
        preferred_subjects: split(subjects), strengths: split(strengths), difficulties: split(difficulties),
        weekly_hours: hours, teaching_style: style, onboarding_complete: true,
      });
      setProfile(p);
      nav("/assessment");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <p className="text-sm text-ink-faint">Step {step + 1} of 3</p>
      <div className="mt-2 flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-violet" : "bg-line"}`} />)}</div>

      {step === 0 && <>
        <h1 className="mt-8 text-[2.3rem]">Welcome, {user?.display_name}. Which track are you here for?</h1>
        <p className="mt-2 text-ink-soft">You can switch later; completed work is kept.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button onClick={() => { setTrack("pencil"); setMedium(null); }} aria-pressed={track === "pencil"}
            className={`rounded-3xl p-6 text-left transition ring-2 ${track === "pencil" ? "bg-lavender ring-violet" : "bg-white ring-transparent hover:bg-lavender/60"}`}>
            <PencilMark size={44} /><h2 className="mt-3 text-2xl text-violet-deep">Advanced pencil drawing</h2>
            <p className="mt-1 text-sm text-ink-soft">Graphite: structure, value, edges, materials, portrait realism.</p></button>
          <button onClick={() => setTrack("painting")} aria-pressed={track === "painting"}
            className={`rounded-3xl p-6 text-left transition ring-2 ${track === "painting" ? "bg-rose ring-coral" : "bg-white ring-transparent hover:bg-rose/60"}`}>
            <PaintMark size={44} /><h2 className="mt-3 text-2xl text-[#8f3a33]">Advanced painting</h2>
            <p className="mt-1 text-sm text-ink-soft">Colour, light, form and medium-specific handling.</p></button>
        </div>
        {track === "painting" && <fieldset className="mt-8">
          <legend className="text-lg font-display">Which medium will you paint in?</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">{MEDIA.map(([v, l, d]) => (
            <label key={v} className={`cursor-pointer rounded-2xl border p-4 ${medium === v ? "border-teal bg-sky" : "border-line bg-white hover:border-ink-faint"}`}>
              <input type="radio" name="medium" className="sr-only" checked={medium === v} onChange={() => setMedium(v)} />
              <span className="font-semibold">{l}</span><span className="mt-1 block text-sm text-ink-soft">{d}</span></label>))}</div>
        </fieldset>}
      </>}

      {step === 1 && <>
        <h1 className="mt-8 text-[2.3rem]">What do you want to be able to do?</h1>
        <div className="mt-8 grid gap-5">
          <div><label className="label" htmlFor="g">Your goal</label>
            <textarea id="g" className="field min-h-24" value={goals} onChange={(e) => setGoals(e.target.value)}
              placeholder={track === "painting" ? "e.g. Paint luminous still lifes with confident colour harmony" : "e.g. Master realistic graphite portraits with convincing skin and hair"} /></div>
          <div><label className="label" htmlFor="x">Training and experience</label>
            <textarea id="x" className="field min-h-20" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="Courses, years of practice, what you've finished recently" /></div>
          <div><label className="label" htmlFor="s">Subjects you love (comma separated)</label>
            <input id="s" className="field" value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="portraits, still life, landscapes" /></div>
        </div>
      </>}

      {step === 2 && <>
        <h1 className="mt-8 text-[2.3rem]">How should your teacher work with you?</h1>
        <div className="mt-8 grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className="label" htmlFor="st">What already works well</label>
              <input id="st" className="field" value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="proportions, clean darks" /></div>
            <div><label className="label" htmlFor="d">Where you get stuck</label>
              <input id="d" className="field" value={difficulties} onChange={(e) => setDifficulties(e.target.value)} placeholder="soft edges, muddy shadows" /></div>
          </div>
          <div><label className="label" htmlFor="h">Practice time per week: <strong className="text-ink">{hours} hours</strong></label>
            <input id="h" type="range" min={1} max={30} value={hours} onChange={(e) => setHours(+e.target.value)} className="w-full accent-violet" /></div>
          <fieldset><legend className="label">Teaching style</legend>
            <div className="grid gap-2 sm:grid-cols-2">{STYLES.map(([v, l, d]) => (
              <label key={v} className={`cursor-pointer rounded-2xl border p-3.5 ${style === v ? "border-violet bg-lavender" : "border-line bg-white"}`}>
                <input type="radio" className="sr-only" checked={style === v} onChange={() => setStyle(v)} />
                <span className="font-semibold">{l}</span> <span className="text-sm text-ink-soft">— {d}</span></label>))}</div>
          </fieldset>
        </div>
      </>}

      <div className="mt-6"><ErrorNote message={error} /></div>
      <div className="mt-10 flex justify-between">
        <button className="btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        {step < 2 ? <button className="btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</button>
          : <button className="btn-primary" disabled={busy} onClick={finish}>{busy ? "Saving…" : "Save and continue"}</button>}
      </div>
    </div>
  );
}
