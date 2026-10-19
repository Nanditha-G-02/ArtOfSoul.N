import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBlob } from "./api";

/**
 * Teacher voice. Prefers the local Piper voice from the backend (offline, free); if it isn't installed, uses the
 * operating system's built-in voice through the browser (also free and local on Windows). Exposes a 0–1 "mouth"
 * level for the avatar: real audio amplitude for Piper, word-boundary pulses for the browser voice.
 */
let piperAvailable: boolean | null = null;

export function useSpeaker() {
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const [muted, setMutedState] = useState<boolean>(() => { try { return localStorage.getItem("aos.muted") === "1"; } catch { return false; } });
  const [engine, setEngine] = useState<"piper" | "browser" | "none">(piperAvailable === false ? "browser" : "piper");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const raf = useRef<number>(0);
  const token = useRef(0);

  const stop = useCallback(() => {
    token.current++;
    audioRef.current?.pause();
    audioRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    cancelAnimationFrame(raf.current);
    setSpeaking(false); setLevel(0);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const setMuted = (m: boolean) => { setMutedState(m); try { localStorage.setItem("aos.muted", m ? "1" : "0"); } catch { /* ignore */ } if (m) stop(); };

  const browserSpeak = (text: string, my: number) => new Promise<void>((resolve) => {
    if (!("speechSynthesis" in window)) { setEngine("none"); resolve(); return; }
    setEngine("browser");
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    u.voice = voices.find((v) => /en[-_](US|GB|IN)/i.test(v.lang) && /female|zira|aria|jenny|heera|samantha/i.test(v.name))
      ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
    u.rate = 0.98; u.pitch = 1.05;
    u.onboundary = () => { if (token.current === my) { setLevel(0.9); setTimeout(() => setLevel(0.25), 120); } };
    u.onend = u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });

  const speak = useCallback(async (text: string) => {
    stop();
    if (muted || !text.trim()) return;
    const my = ++token.current;
    setSpeaking(true);
    try {
      if (piperAvailable === null) {
        try { piperAvailable = (await (await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/tts/status`)).json()).ready === true; }
        catch { piperAvailable = false; }
      }
      if (piperAvailable) {
        try {
          const blob = await fetchBlob("/api/tts", { text });
          if (token.current !== my) return;
          piperAvailable = true; setEngine("piper");
          const audio = new Audio(URL.createObjectURL(blob));
          audioRef.current = audio;
          try {
            const ctx = ctxRef.current ?? new AudioContext();
            ctxRef.current = ctx;
            const src = ctx.createMediaElementSource(audio);
            const an = ctx.createAnalyser(); an.fftSize = 256;
            src.connect(an); an.connect(ctx.destination);
            const buf = new Uint8Array(an.frequencyBinCount);
            const tick = () => {
              an.getByteTimeDomainData(buf);
              let sum = 0; for (const v of buf) sum += Math.abs(v - 128);
              setLevel(Math.min(1, (sum / buf.length) / 18));
              raf.current = requestAnimationFrame(tick);
            };
            tick();
          } catch { /* analyser unsupported: still play */ }
          await new Promise<void>((res) => { audio.onended = () => res(); audio.onerror = () => res(); audio.play().catch(() => res()); });
          return;
        } catch { piperAvailable = false; }
      }
      if (token.current === my) await browserSpeak(text, my);
    } finally {
      if (token.current === my) { cancelAnimationFrame(raf.current); setSpeaking(false); setLevel(0); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, stop]);

  return { speak, stop, speaking, level, muted, setMuted, engine };
}
