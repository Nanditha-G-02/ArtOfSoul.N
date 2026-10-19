import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { SkillStatus } from "../lib/types";
import { EmptyArt } from "./Art";

export function PageHeader({ title, intro, actions }: { title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-[2.15rem] sm:text-[2.5rem]">{title}</h1>
        {intro && <p className="mt-2 text-ink-soft">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

const STATUS: Record<SkillStatus, { label: string; cls: string }> = {
  not_assessed: { label: "Not assessed", cls: "bg-paper-deep text-ink-soft" },
  in_progress: { label: "In progress", cls: "bg-sky text-teal" },
  needs_practice: { label: "Needs practice", cls: "bg-rose text-[#a8443c]" },
  proficient: { label: "Proficient", cls: "bg-lavender text-violet-deep" },
};

export function StatusChip({ status }: { status: SkillStatus }) {
  const s = STATUS[status];
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-ink-soft" role="status">
      <span className="relative inline-flex h-3 w-12">
        {[0, 1, 2].map((i) => (
          <span key={i} className="absolute top-0 h-3 w-3 rounded-full animate-pulse"
            style={{ left: i * 16, background: ["#5b3fa0", "#d9675e", "#23807f"][i], animationDelay: `${i * 160}ms` }} />
        ))}
      </span>
      {label}…
    </div>
  );
}

export function Thinking({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-lavender/60 px-4 py-3 text-sm text-violet-deep" role="status">
      <span className="h-2 w-2 animate-ping rounded-full bg-violet" /> {label}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  if (!message) return null;
  const config = /API_KEY|not set on the server|rejected the API key|Ollama|ollama pull|isn't running|turned off/.test(message);
  return (
    <div className="rounded-2xl border border-[#efc4be] bg-rose/60 px-4 py-3 text-sm text-[#8f3a33]" role="alert">
      <p>{message}</p>
      {config && <p className="mt-1">The local AI isn't ready. Check <Link className="underline" to="/progress#setup">Progress → Setup</Link>.</p>}
      {onRetry && <button className="mt-2 font-semibold underline" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Empty({ title, children, action, tone }: { title: string; children?: ReactNode; action?: ReactNode; tone?: "violet" | "coral" | "teal" }) {
  return (
    <div className="panel flex flex-col items-start gap-3 px-7 py-9">
      <EmptyArt tone={tone} />
      <h2 className="text-2xl">{title}</h2>
      {children && <div className="max-w-xl text-ink-soft">{children}</div>}
      {action}
    </div>
  );
}

/** Minimal, safe renderer for the teacher's markdown-ish prose (no HTML injection). */
export function Prose({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
      part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part.startsWith("*") && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em> : part);
  return (
    <div className="prose-art space-y-3 leading-relaxed">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (/^#{1,4}\s/.test(lines[0]) && lines.length === 1)
          return <h3 key={i} className="pt-1 text-lg">{lines[0].replace(/^#+\s/, "")}</h3>;
        if (lines.every((l) => /^\s*[-*•]\s/.test(l)))
          return <ul key={i} className="list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*•]\s/, ""))}</li>)}</ul>;
        if (lines.every((l) => /^\s*\d+[.)]\s/.test(l)))
          return <ol key={i} className="list-decimal space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s/, ""))}</li>)}</ol>;
        return <p key={i}>{lines.map((l, j) => <span key={j}>{j > 0 && <br />}{inline(l.replace(/^#+\s/, ""))}</span>)}</p>;
      })}
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[1.45rem]">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function List({ items, ordered }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return <Tag className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>{items.map((x, i) => <li key={i}>{x}</li>)}</Tag>;
}
