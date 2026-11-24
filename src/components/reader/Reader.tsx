"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Headphones, List, Play, Sparkles, Type } from "lucide-react";
import type { Section, Work } from "@/content/types";
import { authorOf, rangeLabel } from "@/content/library";
import { useEpisodes, useHydrated, useIllustrations, usePrefs, useStudy, type Highlight, type HighlightColor, type Note } from "@/lib/store";
import { usePlayer } from "@/lib/player";
import { useMediaUrl } from "@/lib/media";
import { useUI } from "../AppShell";
import { GuideDialog, type GuideTarget } from "../GuideDialog";
import { ParagraphView } from "./Paragraph";
import { BookmarkTags, Drawer, HighlightMenu, NoteEditor, SelectionBar, TocPanel, TypographyPanel } from "./Panels";

const WIDTHS = { estreita: "34rem", media: "40rem", larga: "48rem" };
const FONTS = { garamond: "var(--font-garamond), Georgia, serif", literata: "var(--font-literata), Georgia, serif", sans: "var(--font-inter), system-ui, sans-serif" };

interface Sel {
  pid: string;
  block: number;
  start: number;
  end: number;
  text: string;
  rect: DOMRect;
}

type NoteTarget = { kind: "para"; pid: string; n: number | null; noteId?: string; excerpt: string } | { kind: "hl"; h: Highlight };

export function Reader({ work, section }: { work: Work; section: Section }) {
  const router = useRouter();
  const prefs = usePrefs();
  const hydrated = useHydrated((s) => s.ok);
  const study = useStudy();
  const episodes = useEpisodes().filter((e) => e.workId === work.id && e.sectionId === section.id);
  const illustrations = useIllustrations().filter((i) => i.workId === work.id && i.sectionId === section.id);
  const play = usePlayer((s) => s.play);
  const author = authorOf(work);
  const mod = work.guide.find((g) => g.sectionId === section.id);

  const [guide, setGuide] = useState<GuideTarget | null>(null);
  const [toc, setToc] = useState(false);
  const [typo, setTypo] = useState(false);
  const [sel, setSel] = useState<Sel | null>(null);
  const [hlMenu, setHlMenu] = useState<{ h: Highlight; rect: DOMRect } | null>(null);
  const [note, setNote] = useState<NoteTarget | null>(null);
  const [tagFor, setTagFor] = useState<{ pid: string; n: number | null } | null>(null);
  const [pct, setPct] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [coarse, setCoarse] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  const idx = work.sections.findIndex((s) => s.id === section.id);
  const prev = work.sections[idx - 1];
  const next = work.sections[idx + 1];

  useEffect(() => setCoarse(window.matchMedia("(pointer: coarse)").matches), []);

  // ------------------------------------------------ dados por parágrafo
  const hlByP = useMemo(() => {
    const m = new Map<string, Highlight[]>();
    for (const h of study.highlights) if (h.workId === work.id && h.sectionId === section.id) m.set(h.paragraphId, [...(m.get(h.paragraphId) ?? []), h]);
    return m;
  }, [study.highlights, work.id, section.id]);
  const notesByP = useMemo(() => {
    const m = new Map<string, Note[]>();
    for (const n of study.notes) if (n.workId === work.id && n.sectionId === section.id) m.set(n.paragraphId, [...(m.get(n.paragraphId) ?? []), n]);
    return m;
  }, [study.notes, work.id, section.id]);
  const bmSet = useMemo(() => new Set(study.bookmarks.filter((b) => b.workId === work.id).map((b) => b.paragraphId)), [study.bookmarks, work.id]);

  const guideLabelFor = useCallback(
    (n: number | null) => {
      if (!mod) return null;
      const whole = mod.entries.find((e) => e.whole);
      if (whole) return "Seção";
      if (n === null) return null;
      const e = mod.entries.find((e) => n >= e.from && n <= e.to);
      return e ? rangeLabel(e) : null;
    },
    [mod],
  );

  // ------------------------------------------------ rolagem: progresso, imersão, posição
  useEffect(() => {
    let lastY = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setPct(max > 0 ? Math.min(1, y / max) : 1);
        const goingDown = y > lastY + 4;
        const goingUp = y < lastY - 4;
        if (goingDown && y > 200) useUI.setState({ immersive: true });
        if (goingUp || y < 120) useUI.setState({ immersive: false });
        lastY = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      useUI.setState({ immersive: false });
    };
  }, []);

  // salva o parágrafo visível
  useEffect(() => {
    if (!hydrated) return;
    const nodes = textRef.current?.querySelectorAll<HTMLElement>("[data-pid].group");
    if (!nodes?.length) return;
    const total = nodes.length;
    let timer: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!vis) return;
        const el = vis.target as HTMLElement;
        const i = [...nodes].indexOf(el);
        clearTimeout(timer);
        timer = setTimeout(() => {
          useStudy.getState().setProgress(work.id, { sectionId: section.id, paragraphId: el.dataset.pid, pct: total > 1 ? (i + 1) / total : 1 });
        }, 400);
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    nodes.forEach((n) => io.observe(n));
    return () => { io.disconnect(); clearTimeout(timer); };
  }, [hydrated, work.id, section.id]);

  // âncora (#p-20) ou retomar leitura
  useEffect(() => {
    if (!hydrated) return;
    const hash = decodeURIComponent(window.location.hash.slice(1));
    let target: HTMLElement | null = null;
    if (hash) target = document.getElementById(hash);
    else {
      const pr = useStudy.getState().progress[work.id];
      if (pr && pr.sectionId === section.id && pr.paragraphId) {
        target = document.querySelector<HTMLElement>(`.group[data-pid="${pr.paragraphId}"]`);
        if (target && target !== textRef.current?.querySelector(".group")) {
          const n = section.paragraphs.find((p) => p.id === pr.paragraphId)?.n;
          setToast(n ? `Retomando do §${n}` : "Retomando de onde você parou");
          setTimeout(() => setToast(null), 2600);
        } else target = null;
      }
    }
    if (target) {
      const t = target;
      setTimeout(() => {
        t.scrollIntoView({ block: "start", behavior: hash ? "smooth" : "auto" });
        if (hash) { t.classList.add("para-flash"); setTimeout(() => t.classList.remove("para-flash"), 2300); }
      }, 60);
    }
  }, [hydrated, section.id, work.id, section.paragraphs]);

  // ------------------------------------------------ seleção de texto → grifo
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const read = () => {
      const s = window.getSelection();
      if (!s || s.isCollapsed || !s.rangeCount) { setSel(null); return; }
      const range = s.getRangeAt(0);
      const startEl = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement) as HTMLElement | null;
      const blockEl = startEl?.closest<HTMLElement>("p[data-block]");
      if (!blockEl || !textRef.current?.contains(blockEl)) { setSel(null); return; }
      const pre = document.createRange();
      pre.selectNodeContents(blockEl);
      pre.setEnd(range.startContainer, range.startOffset);
      const start = pre.toString().length;
      let end: number;
      if (blockEl.contains(range.endContainer)) {
        const pre2 = document.createRange();
        pre2.selectNodeContents(blockEl);
        pre2.setEnd(range.endContainer, range.endOffset);
        end = pre2.toString().length;
      } else end = blockEl.textContent?.length ?? start;
      const full = blockEl.textContent ?? "";
      // ajusta para palavras inteiras
      let a = start, b = end;
      while (a > 0 && /\S/.test(full[a - 1]) && /\S/.test(full[a])) a--;
      while (b < full.length && /\S/.test(full[b]) && b > 0 && /\S/.test(full[b - 1])) b++;
      const text = full.slice(a, b).trim();
      if (text.length < 2) { setSel(null); return; }
      setSel({ pid: blockEl.dataset.pid!, block: Number(blockEl.dataset.block), start: a, end: b, text, rect: range.getBoundingClientRect() });
    };
    const onChange = () => { clearTimeout(t); t = setTimeout(read, 180); };
    document.addEventListener("selectionchange", onChange);
    return () => { document.removeEventListener("selectionchange", onChange); clearTimeout(t); };
  }, []);

  const pById = useCallback((pid: string) => section.paragraphs.find((p) => p.id === pid), [section.paragraphs]);

  const applyColor = (color: HighlightColor, thenNote = false) => {
    if (!sel) return;
    const p = pById(sel.pid);
    const id = study.addHighlight({ workId: work.id, sectionId: section.id, paragraphId: sel.pid, n: p?.n ?? null, block: sel.block, start: sel.start, end: sel.end, text: sel.text, color });
    window.getSelection()?.removeAllRanges();
    setSel(null);
    if (thenNote) {
      const h = useStudy.getState().highlights.find((x) => x.id === id);
      if (h) setNote({ kind: "hl", h });
    }
  };

  const jump = (sectionId: string, anchor?: string) => {
    setToc(false);
    if (sectionId === section.id && anchor) {
      const el = document.getElementById(anchor);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (el) { el.classList.add("para-flash"); setTimeout(() => el.classList.remove("para-flash"), 2300); }
      history.replaceState(null, "", `#${anchor}`);
    } else router.push(`/ler/${work.id}/${sectionId}${anchor ? `#${anchor}` : ""}`);
  };

  const vars = {
    "--reader-size": `${prefs.fontSize}px`,
    "--reader-leading": String(prefs.leading),
    fontFamily: FONTS[prefs.font],
  } as React.CSSProperties;

  const paraCount = section.paragraphs.filter((p) => p.n !== null).length;

  return (
    <div className="reader min-h-dvh" data-theme={prefs.theme}>
      {/* barra superior */}
      <header className="sticky top-0 z-30 border-b border-[var(--r-line)] bg-[color-mix(in_srgb,var(--r-bg)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-2 md:px-6">
          <button onClick={() => setToc(true)} className="grid size-10 place-items-center rounded-full text-[var(--r-muted)] hover:text-[var(--r-accent)]" aria-label="Sumário e marcadores">
            <List className="size-5" />
          </button>
          <div className="min-w-0 flex-1 px-1 text-center">
            <p className="truncate font-mono text-[9.5px] tracking-[0.22em] text-[var(--r-muted)] uppercase">{work.title} · {author.name}</p>
            <p className="truncate font-display text-[15px] text-[var(--r-accent)]">{section.title}</p>
          </div>
          {mod && (
            <button onClick={() => setGuide({ workId: work.id, sectionId: section.id, n: null, entryId: mod.entries[0]?.id })} className="hidden items-center gap-1.5 rounded-full border border-[var(--r-line)] px-3 py-1.5 text-[12px] text-[var(--r-accent)] hover:border-[var(--r-accent)] sm:flex">
              <Sparkles className="size-3.5" /> Guia
            </button>
          )}
          <button onClick={() => setTypo((v) => !v)} className="grid size-10 place-items-center rounded-full text-[var(--r-muted)] hover:text-[var(--r-accent)]" aria-label="Tipografia e tema">
            <Type className="size-5" />
          </button>
        </div>
        <div className="h-[2px] w-full bg-transparent">
          <div className="h-full bg-gradient-to-r from-gold-600 via-gold-400 to-gold-200 transition-[width] duration-150" style={{ width: `${pct * 100}%` }} />
        </div>
      </header>

      <div className={`mx-auto px-5 pb-24 pt-10 transition-opacity duration-300 md:px-8 ${hydrated ? "opacity-100" : "opacity-0"}`} style={{ ...vars, maxWidth: WIDTHS[prefs.width] }}>
        {/* abertura da seção */}
        <div className="mb-10 text-center">
          <p className="font-mono text-[10.5px] tracking-[0.28em] text-[var(--r-muted)] uppercase">{author.latin || author.name}</p>
          <h1 className="mt-3 font-display text-[2.4rem] leading-tight text-[var(--r-accent)] md:text-5xl">{section.title}</h1>
          <p className="mt-2 font-serif text-[15px] italic text-[var(--r-muted)]">
            {paraCount ? `${paraCount} meditações` : `${section.paragraphs.length} parágrafos`}
            {mod ? ` · ${mod.module}` : ""}
          </p>
          <div className="mx-auto mt-6 h-px w-40 bg-gradient-to-r from-transparent via-[var(--r-accent)] to-transparent opacity-50" />
        </div>

        {(mod || episodes.length > 0) && (
          <div className="mb-10 grid gap-3 font-sans sm:grid-cols-2">
            {mod && (
              <button
                onClick={() => setGuide({ workId: work.id, sectionId: section.id, n: null, entryId: mod.entries[0]?.id })}
                className="group rounded-2xl border border-[var(--r-line)] bg-[var(--r-surface)] p-4 text-left transition hover:border-[var(--r-accent)]"
              >
                <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-[var(--r-accent)] uppercase">
                  <Sparkles className="size-3.5" /> Guia de estudos · {mod.module}
                </span>
                <span className="mt-1.5 block font-display text-[14.5px] leading-snug text-[var(--r-fg)]">{mod.title}</span>
                <span className="mt-1 block text-[12px] text-[var(--r-muted)]">{mod.entries.length} análises · toque em “Contexto” em cada parágrafo</span>
              </button>
            )}
            {episodes.map((ep) => (
              <button key={ep.id} onClick={() => play(ep)} className="group flex items-center gap-3 rounded-2xl border border-[var(--r-line)] bg-[var(--r-surface)] p-4 text-left transition hover:border-[var(--r-accent)]">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--r-accent)] text-[var(--r-bg)]">
                  <Play className="ml-0.5 size-5" fill="currentColor" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] text-[var(--r-accent)] uppercase">
                    <Headphones className="size-3.5" /> Podcast
                  </span>
                  <span className="mt-0.5 block truncate text-[14px] text-[var(--r-fg)]">{ep.title}</span>
                  <span className="block text-[12px] text-[var(--r-muted)]">{ep.chapters.length ? `${ep.chapters.length} marcadores de tempo` : "Ouça enquanto lê"}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {illustrations.map((il) => (
          <SectionIllustration key={il.id} src={il.src} title={il.title} caption={il.caption} />
        ))}

        <div ref={textRef} className="space-y-1">
          {section.paragraphs.map((p, i) => (
            <ParagraphView
              first={i === 0}
              key={p.id}
              p={p}
              highlights={hlByP.get(p.id) ?? []}
              notes={notesByP.get(p.id) ?? []}
              bookmarked={bmSet.has(p.id)}
              guideLabel={guideLabelFor(p.n)}
              footnotes={section.footnotes}
              onGuide={() => setGuide({ workId: work.id, sectionId: section.id, n: p.n })}
              onBookmark={() => {
                if (!bmSet.has(p.id)) study.toggleBookmark({ workId: work.id, sectionId: section.id, paragraphId: p.id, n: p.n });
                setTagFor({ pid: p.id, n: p.n });
              }}
              onNote={(noteId) => setNote({ kind: "para", pid: p.id, n: p.n, noteId, excerpt: p.blocks[0].slice(0, 240) })}
              onHighlightClick={(h, el) => setHlMenu({ h, rect: el.getBoundingClientRect() })}
            />
          ))}
        </div>

        {section.footnotes.length > 0 && (
          <div className="mt-12 border-t border-[var(--r-line)] pt-5 font-sans text-[13.5px] text-[var(--r-muted)]">
            {section.footnotes.map((f) => (
              <p key={f.mark} className="mb-1.5"><sup className="mr-1 text-[var(--r-accent)]">{f.mark}</sup>{f.text}</p>
            ))}
          </div>
        )}

        {/* navegação entre seções */}
        <nav className="mt-16 grid grid-cols-2 gap-3 font-sans">
          {prev ? (
            <Link href={`/ler/${work.id}/${prev.id}`} className="rounded-2xl border border-[var(--r-line)] p-4 transition hover:border-[var(--r-accent)]">
              <span className="flex items-center gap-1 text-[11px] text-[var(--r-muted)]"><ArrowLeft className="size-3.5" /> Anterior</span>
              <span className="mt-1 block font-display text-[15px] text-[var(--r-accent)]">{prev.title}</span>
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`/ler/${work.id}/${next.id}`} className="rounded-2xl border border-[var(--r-line)] p-4 text-right transition hover:border-[var(--r-accent)]">
              <span className="flex items-center justify-end gap-1 text-[11px] text-[var(--r-muted)]">Próximo <ArrowRight className="size-3.5" /></span>
              <span className="mt-1 block font-display text-[15px] text-[var(--r-accent)]">{next.title}</span>
            </Link>
          ) : <span />}
        </nav>
      </div>

      {toast && (
        <div className="fixed left-1/2 top-20 z-40 -translate-x-1/2 rounded-full border border-line-strong bg-ink-850/95 px-4 py-2 font-sans text-[13px] text-gold-100 shadow-xl backdrop-blur">
          {toast}
        </div>
      )}

      {sel && !note && (
        <SelectionBar
          rect={sel.rect}
          coarse={coarse}
          onColor={(c) => applyColor(c)}
          onNote={() => applyColor("gold", true)}
          onCopy={() => {
            const p = pById(sel.pid);
            navigator.clipboard?.writeText(`“${sel.text}” — Marco Aurélio, ${work.title}, ${section.title}${p?.n ? `, ${p.n}` : ""}`);
            window.getSelection()?.removeAllRanges();
            setSel(null);
          }}
        />
      )}

      {hlMenu && (
        <HighlightMenu
          h={study.highlights.find((x) => x.id === hlMenu.h.id) ?? hlMenu.h}
          rect={hlMenu.rect}
          onClose={() => setHlMenu(null)}
          onEditNote={() => {
            const h = study.highlights.find((x) => x.id === hlMenu.h.id);
            setHlMenu(null);
            if (h) setNote({ kind: "hl", h });
          }}
        />
      )}

      {note && note.kind === "hl" && (
        <NoteEditor
          title={`Comentário no grifo · ${section.title}${note.h.n ? `, §${note.h.n}` : ""}`}
          excerpt={note.h.text}
          initial={note.h.note ?? ""}
          onClose={() => setNote(null)}
          onSave={(t) => { study.updateHighlight(note.h.id, { note: t.trim() || undefined }); setNote(null); }}
          onDelete={note.h.note ? () => { study.updateHighlight(note.h.id, { note: undefined }); setNote(null); } : undefined}
        />
      )}
      {note && note.kind === "para" && (
        <NoteEditor
          title={`Reflexão · ${section.title}${note.n ? `, §${note.n}` : ""}`}
          excerpt={note.excerpt}
          initial={note.noteId ? study.notes.find((x) => x.id === note.noteId)?.text ?? "" : ""}
          onClose={() => setNote(null)}
          onSave={(t) => { study.upsertNote({ id: note.noteId, workId: work.id, sectionId: section.id, paragraphId: note.pid, n: note.n, text: t }); setNote(null); }}
          onDelete={note.noteId ? () => { study.removeNote(note.noteId!); setNote(null); } : undefined}
        />
      )}

      {tagFor && (
        <BookmarkTags
          title={`${section.title}${tagFor.n ? `, §${tagFor.n}` : ""}`}
          tags={study.bookmarks.find((b) => b.paragraphId === tagFor.pid && b.workId === work.id)?.tags ?? []}
          onChange={(tags) => study.setBookmarkTags(tagFor.pid, work.id, tags)}
          onRemove={() => { study.toggleBookmark({ workId: work.id, sectionId: section.id, paragraphId: tagFor.pid, n: tagFor.n }); setTagFor(null); }}
          onClose={() => setTagFor(null)}
        />
      )}

      <Drawer open={toc} onClose={() => setToc(false)} title={work.title}>
        <TocPanel work={work} section={section} onJump={jump} onClose={() => setToc(false)} />
      </Drawer>
      {typo && <TypographyPanel onClose={() => setTypo(false)} />}

      <GuideDialog
        work={work}
        target={guide}
        onClose={() => setGuide(null)}
        onNote={(n) => {
          const p = n !== null ? section.paragraphs.find((x) => x.n === n) : section.paragraphs[0];
          setGuide(null);
          if (p) setNote({ kind: "para", pid: p.id, n: p.n, excerpt: p.blocks[0].slice(0, 240) });
        }}
      />
    </div>
  );
}

function SectionIllustration({ src, title, caption }: { src: string; title: string; caption?: string }) {
  const url = useMediaUrl(src);
  if (!url) return null;
  return (
    <figure className="mb-10 overflow-hidden rounded-2xl border border-[var(--r-line)]">
      <Image src={url} alt={title} width={1200} height={800} unoptimized className="h-auto w-full" />
      <figcaption className="bg-[var(--r-surface)] px-4 py-3 font-sans text-[13px] text-[var(--r-muted)]">
        <span className="text-[var(--r-fg)]">{title}</span>
        {caption && <> — {caption}</>}
      </figcaption>
    </figure>
  );
}
