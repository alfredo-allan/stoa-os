"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Bookmark, Download, Highlighter, NotebookPen } from "lucide-react";
import { HIGHLIGHT_COLORS, useHydrated, useStudy, useWorks } from "@/lib/store";
import { PageHeader } from "@/components/ui";

type Item =
  | { kind: "hl"; id: string; workId: string; sectionId: string; n: number | null; pid: string; date: string; text: string; color: string; note?: string }
  | { kind: "note"; id: string; workId: string; sectionId: string; n: number | null; pid: string; date: string; text: string }
  | { kind: "bm"; id: string; workId: string; sectionId: string; n: number | null; pid: string; date: string; tags: string[] };

export default function Caderno() {
  const hydrated = useHydrated((s) => s.ok);
  const { highlights, notes, bookmarks } = useStudy();
  const works = useWorks();
  const [filter, setFilter] = useState<"tudo" | "hl" | "note" | "bm">("tudo");
  const [color, setColor] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);

  const items = useMemo<Item[]>(() => {
    const all: Item[] = [
      ...highlights.map((h) => ({ kind: "hl" as const, id: h.id, workId: h.workId, sectionId: h.sectionId, n: h.n, pid: h.paragraphId, date: h.updatedAt, text: h.text, color: h.color, note: h.note })),
      ...notes.map((n) => ({ kind: "note" as const, id: n.id, workId: n.workId, sectionId: n.sectionId, n: n.n, pid: n.paragraphId, date: n.updatedAt, text: n.text })),
      ...bookmarks.map((b) => ({ kind: "bm" as const, id: b.id, workId: b.workId, sectionId: b.sectionId, n: b.n, pid: b.paragraphId, date: b.createdAt, tags: b.tags })),
    ];
    return all
      .filter((i) => filter === "tudo" || i.kind === filter)
      .filter((i) => !color || (i.kind === "hl" && i.color === color))
      .filter((i) => !tag || (i.kind === "bm" && i.tags.includes(tag)))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [highlights, notes, bookmarks, filter, color, tag]);

  const tags = [...new Set(bookmarks.flatMap((b) => b.tags))];
  const where = (i: Item) => {
    const w = works.find((x) => x.id === i.workId);
    const s = w?.sections.find((x) => x.id === i.sectionId);
    return `${w?.title ?? ""} · ${s?.title ?? i.sectionId}${i.n !== null ? `, §${i.n}` : ""}`;
  };
  const href = (i: Item) => `/ler/${i.workId}/${i.sectionId}#${i.n !== null ? `p-${i.n}` : i.pid}`;

  const exportMd = () => {
    let md = "# Meu caderno estoico\n\n";
    for (const i of items) {
      md += `## ${where(i)}\n\n`;
      if (i.kind === "hl") md += `> ${i.text}\n\n${i.note ? i.note + "\n\n" : ""}`;
      if (i.kind === "note") md += `${i.text}\n\n`;
      if (i.kind === "bm") md += `Marcador${i.tags.length ? ` — ${i.tags.join(", ")}` : ""}\n\n`;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = "caderno-estoico.md";
    a.click();
  };

  return (
    <div>
      <PageHeader kicker="Grifos · notas · marcadores" title="Caderno">
        <p className="mt-3 max-w-2xl text-[15px] text-parchment-dim">Tudo o que você marcou, salvo na memória deste navegador.</p>
      </PageHeader>
      <div className="mx-auto max-w-4xl px-5 py-6 md:px-10">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["tudo", "Tudo"],
              ["hl", "Grifos"],
              ["note", "Reflexões"],
              ["bm", "Marcadores"],
            ] as const
          ).map(([id, l]) => (
            <button key={id} onClick={() => { setFilter(id); setColor(null); setTag(null); }} className={`rounded-full border px-3.5 py-1.5 text-[13px] ${filter === id ? "border-gold-400 bg-gold-400/10 text-gold-100" : "border-line text-parchment-dim"}`}>
              {l}
            </button>
          ))}
          <button onClick={exportMd} className="ml-auto flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[13px] text-gold-300 hover:border-gold-400">
            <Download className="size-4" /> Exportar .md
          </button>
        </div>
        {filter === "hl" && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {HIGHLIGHT_COLORS.map((c) => (
              <button key={c.id} onClick={() => setColor(color === c.id ? null : c.id)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] ${color === c.id ? "border-gold-400 text-gold-100" : "border-line text-muted"}`}>
                <span className="size-2.5 rounded-full" style={{ background: `var(--hl-${c.id})`, filter: "saturate(1.6) brightness(1.3)" }} /> {c.hint}
              </button>
            ))}
          </div>
        )}
        {filter === "bm" && tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <button key={t} onClick={() => setTag(tag === t ? null : t)} className={`rounded-full border px-3 py-1 text-[12px] ${tag === t ? "border-gold-400 text-gold-100" : "border-line text-muted"}`}>{t}</button>
            ))}
          </div>
        )}

        <div className="mt-6 space-y-3">
          {hydrated && items.length === 0 && (
            <div className="rounded-3xl border border-dashed border-line p-10 text-center text-sm text-muted">
              Seu caderno está vazio. No leitor, selecione um trecho para grifar ou toque em <NotebookPen className="inline size-4" /> para escrever uma reflexão.
            </div>
          )}
          {items.map((i) => (
            <Link key={i.kind + i.id} href={href(i)} className="panel block rounded-2xl p-4 transition hover:border-gold-500/50 md:p-5">
              <div className="flex items-center gap-2 font-mono text-[10.5px] tracking-wide text-muted">
                {i.kind === "hl" && <Highlighter className="size-3.5 text-gold-400" />}
                {i.kind === "note" && <NotebookPen className="size-3.5 text-gold-400" />}
                {i.kind === "bm" && <Bookmark className="size-3.5 text-gold-400" />}
                <span>{where(i)}</span>
                <span className="ml-auto">{new Date(i.date).toLocaleDateString("pt-BR")}</span>
              </div>
              {i.kind === "hl" && (
                <>
                  <p className="mt-2 font-serif text-[17px] leading-relaxed text-parchment">
                    <mark className="hl rounded px-0.5" data-c={i.color}>{i.text}</mark>
                  </p>
                  {i.note && <p className="mt-2 border-l-2 border-gold-500 pl-3 text-[14px] text-parchment-dim">{i.note}</p>}
                </>
              )}
              {i.kind === "note" && <p className="mt-2 whitespace-pre-wrap font-serif text-[16.5px] leading-relaxed text-parchment">{i.text}</p>}
              {i.kind === "bm" && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {i.tags.length ? i.tags.map((t) => <span key={t} className="rounded-full border border-gold-500/40 px-2.5 py-0.5 text-[12px] text-gold-200">{t}</span>) : <span className="text-[13px] text-muted">Sem tags</span>}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
