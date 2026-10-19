import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorNote, List, Loading, Prose, Thinking } from "../components/ui";
import { api, mediaUrl } from "../lib/api";
import { date, minutes, useFetch } from "../lib/hooks";
import type { Message } from "../lib/types";

const ACTIONS: [string, string][] = [
  ["continue_plan", "Continue my plan"], ["explain_differently", "Explain it differently"], ["visual_reference", "Show me a visual reference"],
  ["harder_exercise", "A more challenging exercise"], ["focused_session", "Create a focused practice session"],
  ["biggest_weakness", "What's my biggest weakness?"], ["review_previous", "Review my previous artwork"], ["why_not_working", "Why isn't my technique working?"],
];

interface Convo { id: number; title: string; created_at: string; lesson_id: number | null }

function Bubble({ m }: { m: Message }) {
  if (m.role === "user") return <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-3 text-paper">{m.content}</div>;
  const courses = (m.meta.sources ?? []).filter((s) => s.url);
  return (
    <div className="max-w-[92%]">
      <div className="rounded-2xl rounded-bl-md border border-line bg-white px-5 py-4"><Prose text={m.content} /></div>
      {m.exercise && <div className="mt-2 rounded-2xl bg-sky/70 p-4 text-[15px]">
        <p className="text-xs text-teal">New {m.exercise.kind} · {minutes(m.exercise.est_minutes)} · {m.exercise.difficulty}</p>
        <h4 className="font-display text-lg">{m.exercise.title}</h4>
        <p className="text-ink-soft">{m.exercise.objective}</p>
        <details className="mt-2"><summary className="cursor-pointer text-sm font-semibold text-teal">Full brief</summary>
          <div className="mt-2 grid gap-3 text-sm">
            <div><strong>Instructions</strong><List ordered items={m.exercise.instructions} /></div>
            <div><strong>Materials</strong><List items={m.exercise.materials} /></div>
            <div><strong>You'll know it's done when</strong><List items={m.exercise.completion_requirements} /></div>
            <div><strong>Evaluation</strong><List items={m.exercise.evaluation_criteria} /></div>
            {!!m.exercise.hints.length && <div><strong>Hints</strong><List items={m.exercise.hints} /></div>}
            <p className="text-ink-faint">Why this: {m.exercise.rationale}</p>
          </div></details>
      </div>}
      {m.reference && <figure className="mt-2 max-w-sm overflow-hidden rounded-2xl border border-line bg-white">
        <img src={mediaUrl(m.reference.url)} alt={`AI-generated reference: ${m.reference.prompt}`} className="w-full" />
        <figcaption className="px-3 py-2 text-xs text-ink-soft"><span className="chip bg-amber-soft text-[#8a6418]">AI-generated reference</span> Not a verified demonstration.</figcaption>
      </figure>}
      {!!courses.length && <p className="mt-1.5 px-1 text-xs text-ink-faint">Curriculum context: {courses.map((c, i) => <a key={i} href={c.url} target="_blank" rel="noreferrer" className="underline">{c.title}{i < courses.length - 1 ? "; " : ""}</a>)}</p>}
    </div>
  );
}

export default function Teacher() {
  const { cid } = useParams();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { lessonId?: number } };
  const list = useFetch<Convo[]>("/api/conversations");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConvo, setLoadingConvo] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // open a lesson-linked session when arriving from a lesson
  useEffect(() => {
    if (cid || !loc.state?.lessonId || started.current) return;
    started.current = true;
    api.post<Convo>(`/api/conversations?lesson_id=${loc.state.lessonId}`).then(async (c) => {
      nav(`/teacher/${c.id}`, { replace: true });
      await list.reload();
      send(undefined, "continue_plan", c.id);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);

  useEffect(() => {
    if (!cid) { setMessages([]); return; }
    setLoadingConvo(true);
    api.get<{ messages: Message[] }>(`/api/conversations/${cid}`).then((c) => setMessages(c.messages))
      .catch((e) => setError(e.message)).finally(() => setLoadingConvo(false));
  }, [cid]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  async function ensureConvo(): Promise<number> {
    if (cid) return +cid;
    const c = await api.post<Convo>("/api/conversations");
    nav(`/teacher/${c.id}`, { replace: true });
    list.reload();
    return c.id;
  }

  async function send(e?: FormEvent, action?: string, forced?: number) {
    e?.preventDefault();
    if (!action && !text.trim()) return;
    setError(null);
    const label = action ? ACTIONS.find((a) => a[0] === action)?.[1] ?? "Thinking" : "Thinking";
    setBusy(action === "visual_reference" ? "Generating a reference image" : action?.includes("exercise") || action === "focused_session" ? "Designing your practice" : `${label}…`);
    const optimistic: Message = { id: -Date.now(), role: "user", content: action ? label : text, created_at: new Date().toISOString(), meta: {} };
    setMessages((m) => [...m, optimistic]);
    const body = action ? { action } : { text };
    if (!action) setText("");
    try {
      const id = forced ?? (await ensureConvo());
      const res = await api.post<Message[]>(`/api/conversations/${id}/messages`, body);
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), ...res]);
      list.reload();
    } catch (err) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      if (!action) setText(optimistic.content);
      setError((err as Error).message);
    } finally { setBusy(null); }
  }

  async function remove(id: number) {
    await api.del(`/api/conversations/${id}`);
    if (cid && +cid === id) nav("/teacher");
    list.reload();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="order-2 lg:order-1">
        <div className="flex items-center justify-between"><h2 className="text-lg">Sessions</h2>
          <button className="text-sm font-semibold text-violet underline" onClick={() => nav("/teacher")}>New</button></div>
        <ul className="mt-3 grid max-h-[60vh] gap-1 overflow-y-auto text-sm">
          {list.data?.map((c) => (
            <li key={c.id} className={`group flex items-center justify-between rounded-xl px-3 py-2 ${cid && +cid === c.id ? "bg-white shadow-[0_1px_0_#e6dfd4]" : "hover:bg-white/60"}`}>
              <Link to={`/teacher/${c.id}`} className="min-w-0 flex-1"><span className="block truncate">{c.title}</span><span className="text-xs text-ink-faint">{date(c.created_at)}</span></Link>
              <button className="ml-2 text-xs text-ink-faint opacity-0 hover:text-coral group-hover:opacity-100 focus:opacity-100" onClick={() => remove(c.id)} aria-label={`Delete ${c.title}`}>Delete</button>
            </li>))}
          {list.data && !list.data.length && <li className="text-ink-faint">Your sessions will be kept here.</li>}
        </ul>
      </aside>

      <section className="order-1 flex min-h-[70vh] flex-col lg:order-2">
        <header className="mb-4">
          <h1 className="text-[2rem]">Your AI art teacher</h1>
          <p className="text-sm text-ink-soft">Remembers your plan, assessments and past sessions. It labels general advice separately from observations of artwork you've uploaded.</p>
        </header>
        <div className="flex-1 space-y-4 rounded-[1.6rem] bg-paper-deep/60 p-4 sm:p-6">
          {loadingConvo && <Loading />}
          {!cid && !messages.length && !busy && <div className="py-6">
            <p className="font-display text-2xl">Where shall we start?</p>
            <p className="mt-1 text-ink-soft">Ask about a technique, or pick one of the actions below.</p>
          </div>}
          {messages.map((m) => <Bubble key={m.id} m={m} />)}
          {busy && <Thinking label={busy} />}
          <div ref={end} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ACTIONS.map(([id, label]) => <button key={id} disabled={!!busy} className="chip border border-line bg-white px-3 py-1.5 text-[13px] text-ink-soft hover:border-violet hover:text-violet" onClick={() => send(undefined, id)}>{label}</button>)}
        </div>
        <div className="mt-3"><ErrorNote message={error} /></div>
        <form onSubmit={send} className="mt-3 flex items-end gap-2">
          <label htmlFor="msg" className="sr-only">Message your teacher</label>
          <textarea id="msg" rows={2} className="field flex-1 resize-none" placeholder="e.g. Why do my shadows look muddy when I layer 6B over 2B?"
            value={text} onChange={(e) => setText(e.target.value)} maxLength={6000}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className="btn-primary h-12" disabled={!!busy || !text.trim()}>Send</button>
        </form>
      </section>
    </div>
  );
}
