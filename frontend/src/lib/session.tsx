import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, tokenStore } from "./api";
import type { Profile, User } from "./types";

// Local single-learner mode: no sign-up. The backend issues a session for the one learner on this computer.
interface SessionState {
  user: User | null; profile: Profile | null; ready: boolean; error: string | null;
  refresh: () => Promise<void>; setProfile: (p: Profile) => void;
}
const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      if (tokenStore.get()) {
        try {
          const me = await api.get<{ user: User; profile: Profile }>("/api/me");
          setUser(me.user); setProfile(me.profile); setError(null); return;
        } catch { tokenStore.clear(); }
      }
      const s = await api.post<{ token: string; user: User; profile: Profile }>("/api/local/session");
      tokenStore.set(s.token); setUser(s.user); setProfile(s.profile); setError(null);
    } catch (e) { setError((e as Error).message); }
    finally { setReady(true); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return <Ctx.Provider value={{ user, profile, ready, error, refresh, setProfile }}>{children}</Ctx.Provider>;
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSession outside provider");
  return c;
}
