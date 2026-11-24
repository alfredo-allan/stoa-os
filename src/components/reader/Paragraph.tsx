"use client";
import { memo, useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, MessageSquarePlus, Sparkles } from "lucide-react";
import type { Footnote, Paragraph as P } from "@/content/types";
import type { Highlight, Note } from "@/lib/store";

const SUPS = "¹²³⁴⁵⁶⁷⁸⁹";

interface Props {
  p: P;
  highlights: Highlight[];
  notes: Note[];
  bookmarked: boolean;
  guideLabel: string | null; // "§19–20" | "Seção" | null
  first?: boolean;
  footnotes: Footnote[];
  onGuide: () => void;
  onBookmark: () => void;
  onNote: (noteId?: string) => void;
  onHighlightClick: (h: Highlight, el: HTMLElement) => void;
}

function segments(text: string, hls: Highlight[]) {
  if (!hls.length) return [{ text, h: null as Highlight | null }];
  const owner: (Highlight | null)[] = new Array(text.length).fill(null);
  for (const h of [...hls].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    for (let i = Math.max(0, h.start); i < Math.min(text.length, h.end); i++) owner[i] = h;
  }
  const out: { text: string; h: Highlight | null }[] = [];
  let cur = { text: "", h: owner[0] };
  for (let i = 0; i < text.length; i++) {
    if (owner[i] !== cur.h) {
      if (cur.text) out.push(cur);
      cur = { text: "", h: owner[i] };
    }
    cur.text += text[i];
  }
  if (cur.text) out.push(cur);
  return out;
}

function withFootnotes(text: string, footnotes: Footnote[], keyBase: string) {
  if (!footnotes.length || ![...SUPS].some((s) => text.includes(s))) return text;
  const parts: React.ReactNode[] = [];
  let buf = "";
  [...text].forEach((ch, i) => {
    const idx = SUPS.indexOf(ch);
    const fn = idx >= 0 ? footnotes.find((f) => f.mark === String(idx + 1)) : undefined;
    if (fn) {
      if (buf) parts.push(buf);
      buf = "";
      parts.push(<FootnoteMark key={keyBase + i} ch={ch} fn={fn} />);
    } else buf += ch;
  });
  if (buf) parts.push(buf);
  return parts;
}

function FootnoteMark({ ch, fn }: { ch: string; fn: Footnote }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <sup
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer px-0.5 text-[var(--r-accent)]"
        title={fn.text}
      >
        {ch}
      </sup>
      {open && (
        <span
          contentEditable={false}
          onClick={() => setOpen(false)}
          className="absolute left-1/2 top-full z-30 mt-2 block w-64 -translate-x-1/2 rounded-xl border border-line-strong bg-ink-850 p-3 font-sans text-[13px] not-italic leading-snug text-parchment shadow-xl select-none"
        >
          <span className="kicker mb-1 block">Nota {fn.mark}</span>
          {fn.text}
        </span>
      )}
    </span>
  );
}

export const ParagraphView = memo(function ParagraphView({
  p,
  highlights,
  notes,
  bookmarked,
  guideLabel,
  first,
  footnotes,
  onGuide,
  onBookmark,
  onNote,
  onHighlightClick,
}: Props) {
  const byBlock = useMemo(() => {
    const m = new Map<number, Highlight[]>();
    for (const h of highlights) m.set(h.block, [...(m.get(h.block) ?? []), h]);
    return m;
  }, [highlights]);

  const anchor = p.n !== null ? `p-${p.n}` : p.id;

  return (
    <div id={anchor} data-pid={p.id} className="group relative scroll-mt-24 rounded-xl py-3 transition-colors">
      <div className="mb-1.5 flex min-h-8 items-center gap-2 font-sans">
        {p.n !== null ? (
          <button
            onClick={onGuide}
            className="flex items-baseline gap-1 rounded-md pr-1 font-display text-[15px] font-semibold text-[var(--r-accent)] transition hover:brightness-125"
            title={guideLabel ? "Abrir contexto do guia" : "Sem guia publicado"}
          >
            <span className="text-[11px] opacity-70">§</span>
            {p.n}
          </button>
        ) : null}
        {guideLabel && (
          <button
            onClick={onGuide}
            className={`flex items-center gap-1.5 rounded-full border border-[var(--r-line)] bg-[color-mix(in_srgb,var(--r-accent)_8%,transparent)] px-2.5 py-1 text-[11.5px] text-[var(--r-accent)] transition hover:border-[var(--r-accent)] ${p.n === null && !first ? "opacity-0 group-hover:opacity-100 focus:opacity-100 max-md:opacity-70" : ""}`}
          >
            <Sparkles className="size-3.5" /> {p.n === null && first ? "Abrir contexto do guia" : "Contexto"}{guideLabel !== "Seção" && guideLabel !== `§${p.n}` ? ` · ${guideLabel}` : ""}
          </button>
        )}
        <div className="ml-auto flex items-center gap-0.5 opacity-50 transition group-hover:opacity-100 max-md:opacity-60">
          <button onClick={onBookmark} className="grid size-8 place-items-center rounded-full text-[var(--r-muted)] hover:text-[var(--r-accent)]" aria-label={bookmarked ? "Remover marcador" : "Marcar parágrafo"} title="Marcador">
            {bookmarked ? <BookmarkCheck className="size-[17px] text-[var(--r-accent)]" fill="currentColor" fillOpacity={0.25} /> : <Bookmark className="size-[17px]" />}
          </button>
          <button onClick={() => onNote()} className="grid size-8 place-items-center rounded-full text-[var(--r-muted)] hover:text-[var(--r-accent)]" aria-label="Escrever nota" title="Nota / reflexão">
            <MessageSquarePlus className="size-[17px]" />
          </button>
        </div>
      </div>

      <div className="reader-text">
        {p.blocks.map((b, bi) => (
          <p
            key={bi}
            data-block={bi}
            data-pid={p.id}
            onClick={(e) => {
              const mark = (e.target as HTMLElement).closest("mark[data-hid]") as HTMLElement | null;
              if (!mark) return;
              const sel = window.getSelection();
              if (sel && !sel.isCollapsed) return;
              const h = highlights.find((x) => x.id === mark.dataset.hid);
              if (h) onHighlightClick(h, mark);
            }}
          >
            {segments(b, byBlock.get(bi) ?? []).map((s, si) =>
              s.h ? (
                <mark key={si} className="hl" data-hid={s.h.id} data-c={s.h.color} data-note={s.h.note ? "1" : undefined}>
                  {withFootnotes(s.text, footnotes, `${bi}-${si}-`)}
                </mark>
              ) : (
                <span key={si}>{withFootnotes(s.text, footnotes, `${bi}-${si}-`)}</span>
              ),
            )}
          </p>
        ))}
      </div>

      {notes.length > 0 && (
        <div className="mt-3 space-y-2 font-sans">
          {notes.map((n) => (
            <button
              key={n.id}
              onClick={() => onNote(n.id)}
              className="block w-full rounded-xl border-l-2 border-[var(--r-accent)] bg-[var(--r-surface)] px-4 py-2.5 text-left text-[14.5px] leading-relaxed text-[var(--r-fg)] opacity-90 transition hover:opacity-100"
            >
              <span className="kicker mb-1 block !text-[9.5px]">Minha reflexão</span>
              <span className="whitespace-pre-wrap">{n.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
