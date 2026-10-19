import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, tokenStore } from "./api";
import type { Profile, User } from "./types";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => void;
  refresh: () => Promise<void>;
  setProfile: (p: Profile) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setUser(null); setProfile(null); setLoading(false); return; }
    try {
      const me = await api.get<{ user: User; profile: Profile }>("/api/me");
      setUser(me.user); setProfile(me.profile);
    } catch { setUser(null); setProfile(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const out = () => { setUser(null); setProfile(null); };
    window.addEventListener("aos:logout", out);
    return () => window.removeEventListener("aos:logout", out);
  }, [refresh]);

  const signIn = async (token: string) => { tokenStore.set(token); setLoading(true); await refresh(); };
  const signOut = () => { tokenStore.clear(); setUser(null); setProfile(null); };

  return <Ctx.Provider value={{ user, profile, loading, signIn, signOut, refresh, setProfile }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}
