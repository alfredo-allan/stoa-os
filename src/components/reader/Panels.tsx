"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, Check, Copy, Minus, NotebookPen, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import type { Section, Work } from "@/content/types";
import { DEFAULT_TAGS, HIGHLIGHT_COLORS, type Highlight, type HighlightColor, usePrefs, useStudy } from "@/lib/store";

// ------------------------------------------------------------------ Gaveta lateral
export function Drawer({ open, onClose, side = "left", children, title }: { open: boolean; onClose: () => void; side?: "left" | "right"; children: React.ReactNode; title: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.aside
            onClick={(e) => e.stopPropagation()}
            initial={{ x: side === "left" ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: side === "left" ? "-100%" : "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className={`absolute inset-y-0 ${side === "left" ? "left-0 border-r" : "right-0 border-l"} flex w-[min(92vw,400px)] flex-col border-line bg-ink-900`}
            aria-label={title}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <p className="font-display text-gold-100">{title}</p>
              <button onClick={onClose} className="grid size-9 place-items-center rounded-full text-muted hover:text-parchment" aria-label="Fechar">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ------------------------------------------------------------------ Sumário + marcadores + busca
export function TocPanel({ work, section, onJump, onClose }: { work: Work; section: Section; onJump: (sectionId: string, anchor?: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"sumario" | "marcadores" | "busca">("sumario");
  const [q, setQ] = useState("");
  const sectionPct = useStudy((s) => s.sectionPct);
  const allBm = useStudy((s) => s.bookmarks);
  const allHl = useStudy((s) => s.highlights);
  const allNotes = useStudy((s) => s.notes);
  const bookmarks = useMemo(() => allBm.filter((b) => b.workId === work.id), [allBm, work.id]);
  const highlights = useMemo(() => allHl.filter((h) => h.workId === work.id), [allHl, work.id]);
  const notes = useMemo(() => allNotes.filter((h) => h.workId === work.id), [allNotes, work.id]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 3) return [];
    const out: { s: Section; pid: string; n: number | null; snippet: string }[] = [];
    for (const s of work.sections)
      for (const p of s.paragraphs) {
        const t = p.blocks.join(" ");
        const i = t.toLowerCase().indexOf(term);
        if (i >= 0) out.push({ s, pid: p.id, n: p.n, snippet: (i > 50 ? "…" : "") + t.slice(Math.max(0, i - 50), i + term.length + 70) + "…" });
        if (out.length > 80) return out;
      }
    return out;
  }, [q, work]);

  const anchorOf = (n: number | null, pid: string) => (n !== null ? `p-${n}` : pid);
  const titleOf = (sid: string) => work.sections.find((s) => s.id === sid)?.title ?? sid;
  const allTags = [...new Set(bookmarks.flatMap((b) => b.tags))];

  return (
    <div>
      <div className="sticky top-0 z-10 flex gap-1 border-b border-line bg-ink-900 px-3 py-2">
        {(["sumario", "marcadores", "busca"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-2 text-[13px] capitalize ${tab === t ? "bg-gold-400/12 text-gold-100" : "text-muted hover:text-parchment"}`}>
            {t === "sumario" ? "Sumário" : t === "marcadores" ? "Marcados" : "Buscar"}
          </button>
        ))}
      </div>

      {tab === "sumario" && (
        <ul className="p-3">
          {work.sections.map((s) => {
            const pct = Math.round((sectionPct[`${work.id}/${s.id}`] ?? 0) * 100);
            const cur = s.id === section.id;
            const guide = work.guide.find((g) => g.sectionId === s.id);
            return (
              <li key={s.id} className="mb-1">
                <button onClick={() => onJump(s.id)} className={`w-full rounded-xl px-3 py-3 text-left transition ${cur ? "bg-gold-400/10" : "hover:bg-white/[.03]"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`font-display text-[15px] ${cur ? "text-gold-100" : "text-parchment"}`}>{s.title}</span>
                    {guide && <Sparkles className="size-3.5 text-gold-400" />}
                    <span className="ml-auto font-mono text-[10.5px] text-muted">{pct}%</span>
                  </div>
                  <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/[.06]">
                    <div className="h-full bg-gradient-to-r from-gold-600 to-gold-300" style={{ width: `${pct}%` }} />
                  </div>
                </button>
                {cur && s.paragraphs.some((p) => p.n !== null) && (
                  <div className="grid grid-cols-7 gap-1 px-2 pb-3 pt-1">
                    {s.paragraphs
                      .filter((p) => p.n !== null)
                      .map((p) => {
                        const hasG = guide?.entries.some((e) => p.n! >= e.from && p.n! <= e.to);
                        const bm = bookmarks.some((b) => b.paragraphId === p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => onJump(s.id, `p-${p.n}`)}
                            className={`relative rounded-lg py-1.5 font-mono text-[12px] transition hover:bg-gold-400/15 ${bm ? "bg-gold-400/15 text-gold-100" : "text-parchment-dim"}`}
                          >
                            {p.n}
                            {hasG && <span className="absolute right-1 top-1 size-1 rounded-full bg-gold-400" />}
                          </button>
                        );
                      })}
                  </div>
                )}
              </li>
            );
          })}
          <li className="px-3 pt-3 text-[11.5px] leading-relaxed text-muted">
            <span className="mr-1 inline-block size-1.5 rounded-full bg-gold-400 align-middle" /> parágrafo com contexto do guia
          </li>
        </ul>
      )}

      {tab === "marcadores" && (
        <div className="p-3">
          {allTags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <button onClick={() => setTagFilter(null)} className={`rounded-full border px-2.5 py-1 text-[11.5px] ${!tagFilter ? "border-gold-400 text-gold-100" : "border-line text-muted"}`}>Todos</button>
              {allTags.map((t) => (
                <button key={t} onClick={() => setTagFilter(t)} className={`rounded-full border px-2.5 py-1 text-[11.5px] ${tagFilter === t ? "border-gold-400 text-gold-100" : "border-line text-muted"}`}>{t}</button>
              ))}
            </div>
          )}
          {bookmarks.length + highlights.length + notes.length === 0 && <p className="p-4 text-sm text-muted">Nada marcado ainda. Selecione um trecho para grifar, ou toque no ícone de marcador de um parágrafo.</p>}
          {bookmarks
            .filter((b) => !tagFilter || b.tags.includes(tagFilter))
            .map((b) => (
              <button key={b.id} onClick={() => onJump(b.sectionId, anchorOf(b.n, b.paragraphId))} className="mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/[.03]">
                <Bookmark className="mt-0.5 size-4 shrink-0 text-gold-400" fill="currentColor" fillOpacity={0.3} />
                <span>
                  <span className="block text-sm text-parchment">{titleOf(b.sectionId)}{b.n !== null && `, §${b.n}`}</span>
                  {b.tags.length > 0 && <span className="text-[11.5px] text-gold-300">{b.tags.join(" · ")}</span>}
                </span>
              </button>
            ))}
          {!tagFilter &&
            highlights.map((h) => (
              <button key={h.id} onClick={() => onJump(h.sectionId, anchorOf(h.n, h.paragraphId))} className="mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/[.03]">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: `var(--hl-${h.color})`, boxShadow: "0 0 0 1px rgba(255,255,255,.15)" }} />
                <span className="min-w-0">
                  <span className="block font-mono text-[10.5px] text-muted">{titleOf(h.sectionId)}{h.n !== null && `, §${h.n}`}</span>
                  <span className="line-clamp-2 font-serif text-[15px] text-parchment">“{h.text}”</span>
                  {h.note && <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-gold-300">{h.note}</span>}
                </span>
              </button>
            ))}
          {!tagFilter &&
            notes.map((n) => (
              <button key={n.id} onClick={() => onJump(n.sectionId, anchorOf(n.n, n.paragraphId))} className="mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/[.03]">
                <NotebookPen className="mt-0.5 size-4 shrink-0 text-gold-400" />
                <span className="min-w-0">
                  <span className="block font-mono text-[10.5px] text-muted">{titleOf(n.sectionId)}{n.n !== null && `, §${n.n}`}</span>
                  <span className="line-clamp-3 text-[13.5px] text-parchment">{n.text}</span>
                </span>
              </button>
            ))}
          <Link href="/caderno" onClick={onClose} className="mt-3 block rounded-xl border border-line px-3 py-2.5 text-center text-sm text-gold-300 hover:border-gold-400">
            Abrir caderno completo
          </Link>
        </div>
      )}

      {tab === "busca" && (
        <div className="p-3">
          <label className="flex items-center gap-2 rounded-xl border border-line bg-ink-850 px-3 py-2.5 focus-within:border-gold-500">
            <Search className="size-4 text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no livro (mín. 3 letras)" className="w-full bg-transparent text-sm text-parchment outline-none placeholder:text-muted" />
          </label>
          <ul className="mt-3">
            {results.map((r) => (
              <li key={r.pid}>
                <button onClick={() => onJump(r.s.id, anchorOf(r.n, r.pid))} className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-white/[.03]">
                  <span className="block font-mono text-[10.5px] text-gold-400">{r.s.title}{r.n !== null && `, §${r.n}`}</span>
                  <span className="font-serif text-[14.5px] text-parchment-dim">{r.snippet}</span>
                </button>
              </li>
            ))}
            {q.trim().length >= 3 && !results.length && <li className="p-3 text-sm text-muted">Nenhum resultado.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Tipografia
export function TypographyPanel({ onClose }: { onClose: () => void }) {
  const p = usePrefs();
  const themes = [
    { id: "noite", label: "Noite", bg: "#0b0907", fg: "#e6dcc6" },
    { id: "sepia", label: "Sépia", bg: "#1a140d", fg: "#ead9b8" },
    { id: "oled", label: "Preto", bg: "#000", fg: "#d9d1c0" },
    { id: "papel", label: "Papel", bg: "#f3ead6", fg: "#2a2117" },
  ] as const;
  return (
    <div className="fixed inset-0 z-[66]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel safe-bottom absolute inset-x-0 bottom-0 rounded-t-3xl p-5 shadow-2xl md:inset-x-auto md:bottom-auto md:right-6 md:top-16 md:w-[340px] md:rounded-2xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 md:hidden" />
        <p className="kicker mb-3">Tamanho da letra</p>
        <div className="flex items-center gap-3">
          <button onClick={() => p.set({ fontSize: Math.max(15, p.fontSize - 1) })} className="grid size-10 place-items-center rounded-full border border-line text-parchment hover:border-gold-400" aria-label="Diminuir letra">
            <Minus className="size-4" />
          </button>
          <input
            type="range"
            min={15}
            max={36}
            value={p.fontSize}
            onChange={(e) => p.set({ fontSize: Number(e.target.value) })}
            className="gold-range flex-1"
            style={{ ["--pct" as string]: `${((p.fontSize - 15) / 21) * 100}%` }}
            aria-label="Tamanho da letra"
          />
          <button onClick={() => p.set({ fontSize: Math.min(36, p.fontSize + 1) })} className="grid size-10 place-items-center rounded-full border border-line text-parchment hover:border-gold-400" aria-label="Aumentar letra">
            <Plus className="size-4" />
          </button>
          <span className="w-8 text-right font-mono text-xs text-muted">{p.fontSize}</span>
        </div>

        <p className="kicker mb-2 mt-5">Tema de leitura</p>
        <div className="grid grid-cols-4 gap-2">
          {themes.map((t) => (
            <button key={t.id} onClick={() => p.set({ theme: t.id })} className={`rounded-xl border p-2 text-center transition ${p.theme === t.id ? "border-gold-400" : "border-line"}`}>
              <span className="mx-auto grid size-9 place-items-center rounded-full font-serif text-base" style={{ background: t.bg, color: t.fg, boxShadow: "inset 0 0 0 1px rgba(201,164,92,.3)" }}>
                Aa
              </span>
              <span className="mt-1 block text-[11px] text-parchment-dim">{t.label}</span>
            </button>
          ))}
        </div>

        <p className="kicker mb-2 mt-5">Fonte</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["garamond", "Garamond", "var(--font-garamond)"],
              ["literata", "Literata", "var(--font-literata)"],
              ["sans", "Sem serifa", "var(--font-inter)"],
            ] as const
          ).map(([id, label, ff]) => (
            <button key={id} onClick={() => p.set({ font: id })} className={`rounded-xl border px-2 py-2.5 text-[15px] ${p.font === id ? "border-gold-400 text-gold-100" : "border-line text-parchment-dim"}`} style={{ fontFamily: ff }}>
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <p className="kicker mb-2">Entrelinha</p>
            <div className="flex gap-1">
              {[1.5, 1.75, 2].map((l) => (
                <button key={l} onClick={() => p.set({ leading: l })} className={`flex-1 rounded-lg border py-1.5 font-mono text-xs ${p.leading === l ? "border-gold-400 text-gold-100" : "border-line text-muted"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="kicker mb-2">Largura</p>
            <div className="flex gap-1">
              {(["estreita", "media", "larga"] as const).map((w, i) => (
                <button key={w} onClick={() => p.set({ width: w })} className={`flex-1 rounded-lg border py-1.5 text-xs ${p.width === w ? "border-gold-400 text-gold-100" : "border-line text-muted"}`} aria-label={w}>
                  {["S", "M", "L"][i]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Barra de seleção (grifar)
export function SelectionBar({
  rect,
  coarse,
  onColor,
  onNote,
  onCopy,
}: {
  rect: DOMRect;
  coarse: boolean;
  onColor: (c: HighlightColor) => void;
  onNote: () => void;
  onCopy: () => void;
}) {
  const style: React.CSSProperties = coarse
    ? { left: "50%", transform: "translateX(-50%)", bottom: "calc(var(--nav-h) + env(safe-area-inset-bottom) + 16px)" }
    : { left: Math.min(window.innerWidth - 300, Math.max(12, rect.left + rect.width / 2 - 150)), top: Math.max(70, rect.top - 60) };
  return (
    <div
      className="panel fixed z-[64] flex max-w-[calc(100vw-16px)] items-center gap-0.5 rounded-full px-1.5 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,.6)]"
      style={style}
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {HIGHLIGHT_COLORS.map((c) => (
        <button key={c.id} onClick={() => onColor(c.id)} title={`${c.label} — ${c.hint}`} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-white/5" aria-label={`Grifar ${c.label}`}>
          <span className="size-5 rounded-full ring-1 ring-white/25" style={{ background: `var(--hl-${c.id})`, filter: "saturate(1.6) brightness(1.3)" }} />
        </button>
      ))}
      <span className="mx-1 h-5 w-px bg-line" />
      <button onClick={onNote} className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-2 text-[13px] text-parchment hover:bg-white/5">
        <NotebookPen className="size-4 text-gold-300" /> Anotar
      </button>
      <button onClick={onCopy} className="flex shrink-0 items-center rounded-full px-2.5 py-2 text-[13px] text-parchment-dim hover:bg-white/5" aria-label="Copiar citação">
        <Copy className="size-4" />
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ Popover de grifo existente
export function HighlightMenu({ h, rect, onClose, onEditNote }: { h: Highlight; rect: DOMRect; onClose: () => void; onEditNote: () => void }) {
  const update = useStudy((s) => s.updateHighlight);
  const remove = useStudy((s) => s.removeHighlight);
  const top = Math.min(window.innerHeight - 220, rect.bottom + 10);
  const left = Math.min(window.innerWidth - 292, Math.max(12, rect.left + rect.width / 2 - 140));
  return (
    <div className="fixed inset-0 z-[64]" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="panel absolute w-[280px] rounded-2xl p-3 shadow-2xl" style={{ top, left }}>
        <div className="flex items-center gap-1">
          {HIGHLIGHT_COLORS.map((c) => (
            <button key={c.id} onClick={() => update(h.id, { color: c.id })} title={c.hint} className="grid size-9 place-items-center rounded-full hover:bg-white/5">
              <span className="grid size-5 place-items-center rounded-full ring-1 ring-white/25" style={{ background: `var(--hl-${c.id})`, filter: "saturate(1.6) brightness(1.3)" }}>
                {h.color === c.id && <Check className="size-3 text-white" />}
              </span>
            </button>
          ))}
          <button onClick={() => { remove(h.id); onClose(); }} className="ml-auto grid size-9 place-items-center rounded-full text-muted hover:text-rose-300" aria-label="Remover grifo">
            <Trash2 className="size-4" />
          </button>
        </div>
        <p className="mt-1 px-1 text-[11px] text-muted">{HIGHLIGHT_COLORS.find((c) => c.id === h.color)?.hint}</p>
        {h.note && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-white/[.03] p-2.5 text-[13.5px] text-parchment">{h.note}</p>}
        <button onClick={onEditNote} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2 text-[13px] text-gold-200 hover:border-gold-400">
          <NotebookPen className="size-4" /> {h.note ? "Editar comentário" : "Adicionar comentário"}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Editor de nota
export function NoteEditor({
  title,
  excerpt,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  title: string;
  excerpt?: string;
  initial: string;
  onSave: (t: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="panel safe-bottom w-full rounded-t-3xl p-5 md:max-w-lg md:rounded-3xl">
        <p className="kicker">{title}</p>
        {excerpt && <blockquote className="mt-3 line-clamp-4 border-l-2 border-gold-500 pl-3 font-serif text-[15px] italic text-parchment-dim">“{excerpt}”</blockquote>}
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Escreva sua reflexão…"
          className="mt-4 w-full resize-y rounded-2xl border border-line bg-ink-850 p-4 font-serif text-[17px] leading-relaxed text-parchment outline-none placeholder:text-muted focus:border-gold-500"
        />
        <div className="mt-3 flex items-center gap-2">
          {onDelete && (
            <button onClick={onDelete} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted hover:text-rose-300">
              <Trash2 className="size-4" /> Excluir
            </button>
          )}
          <button onClick={onClose} className="ml-auto rounded-full px-4 py-2 text-sm text-parchment-dim hover:text-parchment">
            Cancelar
          </button>
          <button onClick={() => onSave(text)} className="btn-gold rounded-full px-5 py-2 text-sm">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Tags do marcador
export function BookmarkTags({ title, tags, onChange, onRemove, onClose }: { title: string; tags: string[]; onChange: (t: string[]) => void; onRemove: () => void; onClose: () => void }) {
  const custom = useStudy((s) => s.customTags);
  const addTag = useStudy((s) => s.addTag);
  const [newTag, setNewTag] = useState("");
  const all = [...DEFAULT_TAGS, ...custom];
  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="panel safe-bottom w-full rounded-t-3xl p-5 md:max-w-md md:rounded-3xl">
        <p className="kicker">Marcador</p>
        <p className="mt-1 font-display text-lg text-gold-100">{title}</p>
        <p className="mt-4 text-[12.5px] text-muted">Tags do marcador</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {all.map((t) => {
            const on = tags.includes(t);
            return (
              <button key={t} onClick={() => onChange(on ? tags.filter((x) => x !== t) : [...tags, t])} className={`rounded-full border px-3 py-1.5 text-[13px] transition ${on ? "border-gold-400 bg-gold-400/15 text-gold-100" : "border-line text-parchment-dim hover:text-parchment"}`}>
                {t}
              </button>
            );
          })}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = newTag.trim();
            if (!t) return;
            addTag(t);
            onChange([...new Set([...tags, t])]);
            setNewTag("");
          }}
        >
          <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Nova tag (ex.: Ataraxia)" className="flex-1 rounded-full border border-line bg-ink-850 px-4 py-2 text-sm text-parchment outline-none focus:border-gold-500" />
          <button className="rounded-full border border-line px-4 text-sm text-gold-200 hover:border-gold-400">Criar</button>
        </form>
        <div className="mt-5 flex">
          <button onClick={onRemove} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted hover:text-rose-300">
            <Trash2 className="size-4" /> Remover marcador
          </button>
          <button onClick={onClose} className="btn-gold ml-auto rounded-full px-5 py-2 text-sm">
            Pronto
          </button>
        </div>
      </div>
    </div>
  );
}
