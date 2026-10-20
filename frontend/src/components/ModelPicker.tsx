import { motion } from "motion/react";
import { useState } from "react";
import { tokenStore } from "../lib/api";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";

interface Profile { id: string; label: string; text: string; vision: string; needs: string; about: string; installed: Record<string, boolean> }
interface Info { profiles: Profile[]; current: string | null; recommended: string; roles: Record<string, string>; ollama_running: boolean }

/** Choose AI quality; downloads any missing model through Ollama with live progress. */
export default function ModelPicker() {
  const info = useFetch<Info>("/api/system/models");
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ model: string; pct: number; status: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function pull(model: string) {
    setProgress({ model, pct: 0, status: "starting" });
    const t = tokenStore.get();
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/system/models/pull`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify({ model }),
    });
    if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const ev = JSON.parse(line);
        if (ev.error) throw new Error(ev.error);
        setProgress({ model, status: ev.status ?? "", pct: ev.total ? Math.round((ev.completed ?? 0) / ev.total * 100) : 0 });
      }
    }
  }

  async function choose(p: Profile) {
    setBusy(p.id); setMsg(null);
    try {
      for (const m of [...new Set([p.text, p.vision])]) if (!p.installed[m]) await pull(m);
      await api.post("/api/system/models/profile", { profile: p.id });
      setMsg(`${p.label} is now active.`); setProgress(null); info.reload();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  }

  if (!info.data) return null;
  const current = info.data.current ?? (info.data.roles.teacher.includes("e2b") ? "fast" : info.data.roles.teacher.includes("12b") ? "accurate" : "balanced");
  return (
    <div>
      <h3 className="text-lg">AI quality</h3>
      <p className="text-sm text-ink-soft">Larger models are more accurate but slower and need more memory. Recommended for this computer: <strong>{info.data.profiles.find((p) => p.id === info.data!.recommended)?.label}</strong>.</p>
      {!info.data.ollama_running && <p className="mt-2 text-sm text-[#8f3a33]">Ollama isn't running, so models can't be downloaded right now.</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {info.data.profiles.map((p) => {
          const active = current === p.id;
          const missing = Object.entries(p.installed).filter(([, ok]) => !ok).map(([m]) => m);
          return (
            <motion.div key={p.id} whileHover={{ y: -3 }} className={`rounded-2xl p-4 ring-2 ${active ? "bg-ink text-white ring-ink" : "bg-white/85 ring-transparent"}`}>
              <div className="flex items-center justify-between"><strong>{p.label}</strong>
                {p.id === info.data!.recommended && <span className={`chip ${active ? "bg-white/20" : "bg-meadow-soft text-meadow"}`}>recommended</span>}</div>
              <p className={`mt-1 text-xs ${active ? "text-white/75" : "text-ink-soft"}`}>{p.about}</p>
              <p className={`mt-2 text-xs ${active ? "text-white/75" : "text-ink-faint"}`}>Needs: {p.needs}<br />Teacher: {p.text}<br />Vision: {p.vision}</p>
              {!active && <button className="btn-outline mt-3 w-full py-2 text-sm" disabled={!!busy || !info.data!.ollama_running} onClick={() => choose(p)}>
                {busy === p.id ? "Working…" : missing.length ? `Download & use` : "Use this"}</button>}
              {active && <p className="mt-3 text-sm font-semibold">In use</p>}
            </motion.div>);
        })}
      </div>
      {progress && <div className="mt-4">
        <p className="text-sm">Downloading {progress.model}: {progress.status} {progress.pct ? `${progress.pct}%` : ""}</p>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/10"><motion.div className="h-full bg-meadow" animate={{ width: `${progress.pct}%` }} /></div>
      </div>}
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </div>
  );
}
