import { useState } from "react";
import { Link } from "react-router-dom";
import { Empty, ErrorNote, Loading, PageHeader } from "../components/ui";
import { api, mediaUrl } from "../lib/api";
import { date, useFetch } from "../lib/hooks";
import type { Artwork } from "../lib/types";

export default function Portfolio() {
  const { data, error, loading, setData } = useFetch<Artwork[]>("/api/artworks");
  const [pair, setPair] = useState<number[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (id: number) => setPair((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]));
  async function remove(a: Artwork) {
    if (!confirm(`Delete “${a.title}” and its feedback? This can't be undone.`)) return;
    try { await api.del(`/api/artworks/${a.id}`); setData((data ?? []).filter((x) => x.id !== a.id)); setPair((p) => p.filter((x) => x !== a.id)); }
    catch (e) { setErr((e as Error).message); }
  }
  const chosen = (data ?? []).filter((a) => pair.includes(a.id)).sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <>
      <PageHeader title="My portfolio" intro="Every piece you've uploaded, oldest to newest when compared. Select two to see them side by side."
        actions={<Link to="/analysis" className="btn-primary">Upload artwork</Link>} />
      <ErrorNote message={error ?? err} />
      {chosen.length === 2 && <div className="mb-10 grid gap-4 rounded-[1.6rem] bg-ink p-4 sm:grid-cols-2 sm:p-6">
        {chosen.map((a) => <figure key={a.id}><img src={mediaUrl(a.url)} alt={a.title} className="w-full rounded-xl" />
          <figcaption className="mt-2 text-sm text-[#e6e2f5]">{a.title} · {date(a.created_at)} · <Link to={`/analysis/${a.id}`} className="underline">feedback</Link></figcaption></figure>)}
      </div>}
      {loading && <Loading />}
      {data && !data.length && <Empty title="Your portfolio starts with one upload" action={<Link to="/analysis" className="btn-primary">Upload artwork</Link>}>
        Pieces you upload for analysis are collected here so you can see how your work changes over time.</Empty>}
      <ul className="columns-1 gap-5 sm:columns-2 lg:columns-3">
        {data?.map((a) => (
          <li key={a.id} className={`group relative mb-5 break-inside-avoid overflow-hidden rounded-2xl border-2 bg-white ${pair.includes(a.id) ? "border-coral" : "border-transparent"}`}>
            <Link to={`/analysis/${a.id}`}><img src={mediaUrl(a.url)} alt={a.title} className="w-full" loading="lazy" /></Link>
            <div className="flex items-start justify-between gap-2 p-3.5">
              <div><p className="font-display text-lg leading-tight">{a.title}</p>
                <p className="text-xs text-ink-faint">{date(a.created_at)} · {a.analysis_count ? `${a.analysis_count} analysis${a.analysis_count > 1 ? "es" : ""}` : "not analysed"}</p></div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                <button onClick={() => toggle(a.id)} className="font-semibold text-violet">{pair.includes(a.id) ? "Selected" : "Compare"}</button>
                <button onClick={() => remove(a)} className="text-ink-faint hover:text-coral">Delete</button>
              </div>
            </div>
          </li>))}
      </ul>
    </>
  );
}
