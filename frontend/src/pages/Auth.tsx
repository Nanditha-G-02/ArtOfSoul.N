import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { HeroArt } from "../components/Art";
import { ErrorNote } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Auth({ mode }: { mode: "login" | "signup" }) {
  const { user, profile, signIn } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to={profile?.onboarding_complete ? loc.state?.from ?? "/dashboard" : "/onboarding"} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = mode === "signup"
        ? await api.post<{ token: string }>("/api/auth/register", { email, password, display_name: name })
        : await api.post<{ token: string }>("/api/auth/login", { email, password });
      await signIn(res.token);
      nav(mode === "signup" ? "/onboarding" : loc.state?.from ?? "/dashboard", { replace: true });
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-14">
        <Link to="/" className="mb-10 font-display text-[1.4rem]">ArtOfSoul<span className="text-coral">.N</span></Link>
        <h1 className="text-[2.4rem]">{mode === "signup" ? "Set up your studio" : "Welcome back to the studio"}</h1>
        <p className="mt-2 text-ink-soft">{mode === "signup" ? "It takes a minute. Your plan, artwork and feedback stay private to you." : "Pick up where your plan left off."}</p>
        <form onSubmit={submit} className="mt-8 grid max-w-sm gap-4">
          {mode === "signup" && <div><label className="label" htmlFor="n">Your name</label>
            <input id="n" className="field" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>}
          <div><label className="label" htmlFor="e">Email</label>
            <input id="e" type="email" className="field" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
          <div><label className="label" htmlFor="p">Password</label>
            <input id="p" type="password" className="field" required minLength={mode === "signup" ? 8 : 1} value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            {mode === "signup" && <p className="mt-1 text-xs text-ink-faint">At least 8 characters.</p>}</div>
          <ErrorNote message={error} />
          <button className="btn-primary mt-2 py-3" disabled={busy}>{busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}</button>
          <p className="text-sm text-ink-soft">
            {mode === "signup" ? <>Already have an account? <Link className="font-semibold text-violet underline" to="/login">Sign in</Link></>
              : <>New here? <Link className="font-semibold text-violet underline" to="/signup">Create an account</Link></>}
          </p>
        </form>
      </div>
      <div className="hidden items-center bg-paper-deep p-12 lg:flex"><HeroArt className="w-full" /></div>
    </div>
  );
}
