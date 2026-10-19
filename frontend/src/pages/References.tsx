import { useState } from "react";
import { Empty, ErrorNote, Loading, PageHeader, Section, Thinking } from "../components/ui";
import { api, mediaUrl } from "../lib/api";
import { useAuth } from "../lib/auth";
import { date, useFetch } from "../lib/hooks";
import type { AiStatus, Reference } from "../lib/types";

const PURPOSES: [string, string, string][] = [
  ["subject", "Reference subject", "A clean photographic subject with one clear light."],
  ["tonal", "Tonal study", "High-contrast, easy to read as value masses."],
  ["lighting", "Lighting arrangement", "Your subject under a specific light set-up."],
  ["composition", "Composition variation", "A crop with a strong focal point and negative space."],
  ["inspiration", "Painting inspiration", "A finished, painterly image to study for mood."],
];

interface Palette { name: string; label: string; pigments: { pigment: string; hex: string; role: string }[]; mixtures: { name: string; hex: string; recipe: string }[]; notes: string[] }

export default function References() {
  const { profile } = useAuth();
  const refs = useFetch<Reference[]>("/api/references");
  const status = useFetch<AiStatus>("/api/system/ai-status");
  const [purpose, setPurpose] = useState("subject");
  const [subject, setSubject] = useState("");
  const [lighting, setLighting] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [pal, setPal] = useState<Palette | null>(null);
  const [palBusy, setPalBusy] = useState(false);
  const [palErr, setPalErr] = useState<string | null>(null);
  const imageReady = status.data?.image?.configured;

  async function gen() {
    setBusy(true); setErr(null);
    try { const r = await api.post<Reference>("/api/references", { purpose, subject, lighting }); refs.setData([r, ...(refs.data ?? [])]); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function palette() {
    setPalBusy(true); setPalErr(null);
    try { setPal(await api.post<Palette>("/api/palettes", { brief })); } catch (e) { setPalErr((e as Error).message); } finally { setPalBusy(false); }
  }

  return (
    <>
      <PageHeader title="Reference studio" intro="Generate practice references and palette ideas. Everything made here is labelled as AI-generated so it never mixes with your own work or with verified demonstrations." />
      {status.data && !imageReady && <div className="mb-6 rounded-2xl bg-amber-soft px-5 py-4 text-[15px]">
        Image generation isn't configured on this server (it needs <code>OPENAI_API_KEY</code> for <code>{status.data.image.model}</code>). Until then, set up the subject from life:
        one lamp at about 45°, a dark backdrop, and photograph it square-on — or ask your teacher to describe a set-up.</div>}

      <div className="panel grid gap-5 p-6">
        <fieldset><legend className="label">What kind of reference?</legend>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">{PURPOSES.map(([v, l, d]) => (
            <label key={v} className={`cursor-pointer rounded-2xl border p-3 text-sm ${purpose === v ? "border-teal bg-sky" : "border-line bg-white hover:border-ink-faint"}`}>
              <input type="radio" className="sr-only" checked={purpose === v} onChange={() => setPurpose(v)} /><strong>{l}</strong><span className="mt-1 block text-ink-soft">{d}</span></label>))}</div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div><label className="label" htmlFor="subj">Subject</label>
            <input id="subj" className="field" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={profile?.track === "painting" ? "Copper pot, lemons and a linen cloth" : "An elderly man's hands holding a glass"} /></div>
          {purpose === "lighting" && <div><label className="label" htmlFor="li">Lighting</label>
            <input id="li" className="field" value={lighting} onChange={(e) => setLighting(e.target.value)} placeholder="warm key light, cool rim light" /></div>}
        </div>
        <ErrorNote message={err} />
        <div><button className="btn-primary" onClick={gen} disabled={busy || subject.trim().length < 3 || !imageReady}>Generate reference</button></div>
        {busy && <Thinking label="Generating — usually 15–40 seconds" />}
      </div>

      <Section title="Your generated references">
        {refs.loading && <Loading />}
        {refs.data && !refs.data.length && <Empty title="Nothing generated yet" tone="teal">References you generate are kept here with the exact prompt used.</Empty>}
        <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3">{refs.data?.map((r) => (
          <li key={r.id} className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-line bg-white">
            <img src={mediaUrl(r.url)} alt={`AI-generated ${r.purpose} reference`} className="w-full" loading="lazy" />
            <div className="p-3 text-sm"><span className="chip bg-amber-soft text-[#8a6418]">{r.label}</span>
              <p className="mt-1.5 text-ink-soft">{r.prompt}</p><p className="mt-1 text-xs text-ink-faint">{date(r.created_at)} · {r.model}</p></div>
          </li>))}</ul>
      </Section>

      <Section title="Palette suggestions">
        <div className="panel p-6">
          <label className="label" htmlFor="pb">Describe the painting or mood</label>
          <div className="flex flex-wrap gap-2"><input id="pb" className="field flex-1" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Late-afternoon interior, warm light through a window, quiet greys" />
            <button className="btn-paint" disabled={palBusy || brief.trim().length < 3} onClick={palette}>Suggest a palette</button></div>
          <div className="mt-3"><ErrorNote message={palErr} /></div>
          {palBusy && <Thinking label="Mixing ideas" />}
          {pal && <div className="mt-5">
            <h3 className="text-xl">{pal.name}</h3>
            <div className="mt-3 flex flex-wrap gap-3">{pal.pigments.map((p) => (
              <div key={p.pigment} className="w-32"><div className="h-16 rounded-xl border border-line" style={{ background: p.hex }} />
                <p className="mt-1 text-sm font-semibold">{p.pigment}</p><p className="text-xs text-ink-soft">{p.role}</p></div>))}</div>
            <h4 className="mt-5 font-semibold">Premixed strings</h4>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">{pal.mixtures.map((m) => (
              <li key={m.name} className="flex items-center gap-3 text-sm"><span className="h-9 w-9 shrink-0 rounded-lg border border-line" style={{ background: m.hex }} /><span><strong>{m.name}</strong> — {m.recipe}</span></li>))}</ul>
            {!!pal.notes.length && <ul className="mt-4 list-disc pl-5 text-sm text-ink-soft">{pal.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
            <p className="mt-3 text-xs text-ink-faint">{pal.label}</p>
          </div>}
        </div>
      </Section>
    </>
  );
}
