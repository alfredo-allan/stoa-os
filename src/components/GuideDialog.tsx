"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpen, Footprints, Headphones, Landmark, Lightbulb, NotebookPen, Orbit, Quote, X } from "lucide-react";
import type { GuideEntry, Work } from "@/content/types";
import { rangeLabel } from "@/content/library";
import { Markdown } from "./Markdown";
import { useEpisodes } from "@/lib/store";
import { fmtTime, usePlayer } from "@/lib/player";
import { useIsAdmin } from "@/lib/admin-session";

const ICONS: Record<string, typeof Lightbulb> = {
  reflexao: Lightbulb,
  conceitos: Landmark,
  analogia: Orbit,
  pratica: Footprints,
};
const SHORT: Record<string, string> = {
  reflexao: "Reflexão",
  conceitos: "Conceitos",
  analogia: "Analogia",
  pratica: "Prática",
};

export interface GuideTarget {
  workId: string;
  sectionId: string;
  n: number | null;
  entryId?: string;
}

export function GuideDialog({
  work,
  target,
  onClose,
  onNote,
  showReadLink = false,
}: {
  work: Work;
  target: GuideTarget | null;
  onClose: () => void;
  onNote?: (n: number | null) => void;
  showReadLink?: boolean;
}) {
  const [current, setCurrent] = useState<GuideTarget | null>(target);
  useEffect(() => setCurrent(target), [target]);
  const scroller = useRef<HTMLDivElement>(null);
  const [activeField, setActiveField] = useState<string>("");
  const episodes = useEpisodes();
  const play = usePlayer((s) => s.play);

  const section = current ? work.sections.find((s) => s.id === current.sectionId) : undefined;
  const mod = current ? work.guide.find((m) => m.sectionId === current.sectionId) : undefined;
  const entry: GuideEntry | undefined = useMemo(() => {
    if (!current || !mod) return undefined;
    if (current.entryId) return mod.entries.find((e) => e.id === current.entryId);
    return mod.entries.find((e) => e.whole) ?? (current.n !== null ? mod.entries.find((e) => current.n! >= e.from && current.n! <= e.to) : undefined);
  }, [current, mod]);
  const idx = entry && mod ? mod.entries.indexOf(entry) : -1;

  const chapter = useMemo(() => {
    if (!entry || !current) return null;
    for (const ep of episodes.filter((e) => e.workId === current.workId && e.sectionId === current.sectionId)) {
      const c = ep.chapters.find((c) => c.paragraph !== undefined && (entry.whole || (c.paragraph >= entry.from && c.paragraph <= entry.to)));
      if (c) return { ep, c };
    }
    return null;
  }, [entry, episodes, current]);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && mod && idx >= 0 && idx < mod.entries.length - 1) go(1);
      if (e.key === "ArrowLeft" && idx > 0) go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, idx]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setActiveField(entry?.fields[0]?.key ?? "");
  }, [entry]);

  const go = (d: number) => {
    if (!mod) return;
    const next = mod.entries[idx + d];
    if (next && current) setCurrent({ ...current, n: next.from, entryId: next.id });
  };

  const onScroll = () => {
    const el = scroller.current;
    if (!el || !entry) return;
    let act = entry.fields[0]?.key ?? "";
    for (const f of entry.fields) {
      const node = el.querySelector<HTMLElement>(`[data-field="${f.key}"]`);
      if (node && node.offsetTop - el.scrollTop < 160) act = f.key;
    }
    setActiveField(act);
  };

  const jump = (key: string) => {
    const el = scroller.current;
    const node = el?.querySelector<HTMLElement>(`[data-field="${key}"]`);
    if (el && node) el.scrollTo({ top: node.offsetTop - 110, behavior: "smooth" });
  };

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key="guide-overlay"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-[6px] md:items-center md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Contexto do guia de estudos"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 60, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.985 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false}
            className="relative flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-line-strong bg-[linear-gradient(180deg,#17120d,#0c0a08_40%)] shadow-[0_-20px_80px_rgba(0,0,0,.7)] md:h-[88vh] md:max-w-3xl md:rounded-[28px]"
          >
            {/* brilho superior */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,rgba(217,180,106,.14),transparent_70%)]" />

            {/* cabeçalho */}
            <div className="relative z-10 shrink-0 border-b border-line px-5 pb-3 pt-3 md:px-8 md:pt-6">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15 md:hidden" />
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="kicker">
                    Guia de estudos · {mod?.module ?? "—"} {entry && <>· {rangeLabel(entry)}</>}
                  </p>
                  <h2 className="mt-1.5 font-display text-[19px] leading-snug text-gold-100 md:text-2xl">
                    {entry ? (
                      <>
                        <span className="text-gold-400">{section?.title}{!entry.whole && <>, {entry.from === entry.to ? entry.from : `${entry.from}–${entry.to}`}</>}</span>
                        <span className="text-gold-600"> — </span>
                        {entry.title}
                      </>
                    ) : (
                      section?.title
                    )}
                  </h2>
                </div>
                <button onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-parchment-dim transition hover:border-gold-400 hover:text-gold-100" aria-label="Fechar">
                  <X className="size-5" />
                </button>
              </div>
              {entry && entry.fields.length > 1 && (
                <div className="no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1">
                  {entry.fields.map((f) => {
                    const Icon = ICONS[f.key] ?? Lightbulb;
                    const on = activeField === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => jump(f.key)}
                        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition ${on ? "border-gold-400 bg-gold-400/15 text-gold-100" : "border-line text-parchment-dim hover:text-parchment"}`}
                      >
                        <Icon className="size-3.5" /> {SHORT[f.key] ?? f.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* corpo */}
            <div ref={scroller} onScroll={onScroll} className="relative flex-1 overflow-y-auto overscroll-contain px-5 pb-10 pt-6 md:px-10">
              {!entry ? (
                <EmptyGuide sectionTitle={section?.title} n={current.n} />
              ) : (
                <article className="mx-auto max-w-2xl">
                  {entry.from !== entry.to && !entry.whole && current.n !== null && (
                    <p className="mb-4 rounded-xl border border-line bg-gold-400/5 px-4 py-2.5 text-[13px] text-parchment-dim">
                      Esta análise do guia abrange os parágrafos <strong className="text-gold-200">§{entry.from} a §{entry.to}</strong> em conjunto — você abriu a partir do §{current.n}.
                    </p>
                  )}
                  {entry.quote && (
                    <figure className="relative mb-8 rounded-2xl border border-line bg-white/[.02] px-5 py-5 md:px-7">
                      <Quote className="absolute -top-3 left-5 size-6 rounded-full bg-ink-850 p-1 text-gold-400" />
                      <blockquote className="font-serif text-[1.15rem] italic leading-relaxed text-[#f0e4c8]">{entry.quote}</blockquote>
                    </figure>
                  )}
                  {entry.fields.map((f, i) => {
                    const Icon = ICONS[f.key] ?? Lightbulb;
                    return (
                      <section key={f.key + i} data-field={f.key} className="mb-9 scroll-mt-28">
                        <header className="mb-3 flex items-center gap-3">
                          <span className="grid size-9 place-items-center rounded-full border border-gold-500/50 bg-gold-400/10 text-gold-300">
                            <Icon className="size-[18px]" strokeWidth={1.6} />
                          </span>
                          <div>
                            <span className="font-mono text-[10px] tracking-[0.2em] text-gold-600">{String(i + 1).padStart(2, "0")}</span>
                            <h3 className="font-display text-[15px] tracking-wide text-gold-200">{f.label}</h3>
                          </div>
                        </header>
                        <Markdown>{f.md}</Markdown>
                      </section>
                    );
                  })}
                  {entry.extraMd && (
                    <section className="mb-9">
                      <Markdown>{entry.extraMd}</Markdown>
                    </section>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-6">
                    {chapter && (
                      <button
                        onClick={() => play(chapter.ep, chapter.c.t)}
                        className="btn-gold flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                      >
                        <Headphones className="size-4" /> Ouvir no podcast · {fmtTime(chapter.c.t)}
                      </button>
                    )}
                    {onNote && (
                      <button onClick={() => onNote(current.n)} className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-parchment-dim hover:border-gold-400 hover:text-gold-100">
                        <NotebookPen className="size-4" /> Escrever minha reflexão
                      </button>
                    )}
                    {showReadLink && (
                      <Link
                        href={`/ler/${work.id}/${current.sectionId}${entry.whole ? "" : `#p-${entry.from}`}`}
                        className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-parchment-dim hover:border-gold-400 hover:text-gold-100"
                      >
                        <BookOpen className="size-4" /> Ler no livro
                      </Link>
                    )}
                  </div>
                </article>
              )}
            </div>

            {/* navegação entre trechos */}
            {entry && mod && mod.entries.length > 1 && (
              <div className="safe-bottom relative z-10 flex shrink-0 items-center justify-between border-t border-line bg-ink-900/80 px-3 py-2 backdrop-blur md:px-6">
                <button disabled={idx <= 0} onClick={() => go(-1)} className="flex items-center gap-2 rounded-full px-3 py-2 text-[13px] text-parchment-dim enabled:hover:text-gold-100 disabled:opacity-30">
                  <ArrowLeft className="size-4" /> {idx > 0 ? rangeLabel(mod.entries[idx - 1]) : "Início"}
                </button>
                <span className="font-mono text-[11px] text-muted">
                  {idx + 1} / {mod.entries.length}
                </span>
                <button disabled={idx >= mod.entries.length - 1} onClick={() => go(1)} className="flex items-center gap-2 rounded-full px-3 py-2 text-[13px] text-parchment-dim enabled:hover:text-gold-100 disabled:opacity-30">
                  {idx < mod.entries.length - 1 ? rangeLabel(mod.entries[idx + 1]) : "Fim"} <ArrowRight className="size-4" />
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EmptyGuide({ sectionTitle, n }: { sectionTitle?: string; n: number | null }) {
  const isAdmin = useIsAdmin();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <Landmark className="size-10 text-gold-600" strokeWidth={1.2} />
      <h3 className="mt-4 font-display text-lg text-gold-100">Guia ainda não publicado</h3>
      <p className="mt-2 text-sm leading-relaxed text-parchment-dim">
        O contexto do NotebookLM para {sectionTitle}
        {n !== null && <>, §{n}</>} ainda não foi adicionado.
        {isAdmin ? " Cole o módulo do guia no painel Admin (aba “Guia / Contexto”) e publique." : " Em breve ele aparecerá aqui."}
      </p>
      {isAdmin && (
        <Link href="/admin?tab=guia" className="btn-gold mt-6 rounded-full px-5 py-2 text-sm">
          Abrir painel Admin
        </Link>
      )}
    </div>
  );
}
