// Centralised API client. The browser never sees provider API keys — all AI calls go through the backend.
const BASE = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "aos.token";

export class ApiError extends Error {
  constructor(public status: number, message: string, public kind?: string) {
    super(message);
  }
}

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

export function mediaUrl(path: string) {
  return path.startsWith("http") ? path : `${BASE}${path}`;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const t = tokenStore.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "Can't reach the ArtOfSoul.N server. Check that the backend is running.");
  }
  if (res.status === 401 && t) { tokenStore.clear(); window.dispatchEvent(new Event("aos:logout")); }
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) {
    let msg = data?.detail ?? `Request failed (${res.status})`;
    if (Array.isArray(msg)) msg = msg.map((d: { msg: string }) => d.msg).join("; ");
    throw new ApiError(res.status, msg, data?.kind);
  }
  return data as T;
}

/** Fetch binary content (e.g. synthesized speech) with the session token. */
export async function fetchBlob(path: string, body: unknown): Promise<Blob> {
  const t = tokenStore.get();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, `Request failed (${res.status})`);
  return res.blob();
}

export const api = {
  get: <T,>(p: string) => request<T>("GET", p),
  post: <T,>(p: string, b?: unknown) => request<T>("POST", p, b ?? {}),
  patch: <T,>(p: string, b: unknown) => request<T>("PATCH", p, b),
  put: <T,>(p: string, b: unknown) => request<T>("PUT", p, b),
  del: <T,>(p: string) => request<T>("DELETE", p),
  upload: <T,>(p: string, f: FormData) => request<T>("POST", p, f),
};
