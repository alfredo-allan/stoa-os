"use client";
// Estado local (memória do navegador). Tudo fica em localStorage; arquivos de áudio e
// imagem enviados pelo admin ficam no IndexedDB (ver media.ts).
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useMemo } from "react";
import type { Episode, GuideModule, Illustration, Section, Work } from "@/content/types";
import { BASE_EPISODES, BASE_ILLUSTRATIONS, BASE_WORKS } from "@/content/library";
import { sectionRank } from "@/lib/parser";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---------------------------------------------------------------- preferências
export type ReaderTheme = "noite" | "sepia" | "oled" | "papel";
export type ReaderFont = "garamond" | "literata" | "sans";
export type ReaderWidth = "estreita" | "media" | "larga";

interface PrefsState {
  fontSize: number;
  leading: number;
  width: ReaderWidth;
  font: ReaderFont;
  theme: ReaderTheme;
  set: (p: Partial<Omit<PrefsState, "set">>) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      fontSize: 21,
      leading: 1.75,
      width: "media",
      font: "garamond",
      theme: "noite",
      set: (p) => set(p),
    }),
    { name: "stoa:prefs", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

// ---------------------------------------------------------------- estudo
export type HighlightColor = "gold" | "blue" | "green" | "rose";
export const HIGHLIGHT_COLORS: { id: HighlightColor; label: string; hint: string }[] = [
  { id: "gold", label: "Dourado", hint: "Máximas centrais" },
  { id: "blue", label: "Azul", hint: "Conceitos psicológicos" },
  { id: "green", label: "Verde", hint: "Aplicações práticas" },
  { id: "rose", label: "Rosa", hint: "Dúvidas e questões" },
];
export const DEFAULT_TAGS = ["Amor Fati", "Memento Mori", "Controle", "Logos", "Daemon", "Sympatheia", "Cidadela Interior"];

export interface Highlight {
  id: string;
  workId: string;
  sectionId: string;
  paragraphId: string;
  n: number | null;
  block: number;
  start: number;
  end: number;
  text: string;
  color: HighlightColor;
  note?: string;
  createdAt: string;
  updatedAt: string;
}
export interface Note {
  id: string;
  workId: string;
  sectionId: string;
  paragraphId: string;
  n: number | null;
  text: string;
  createdAt: string;
  updatedAt: string;
}
export interface Bookmark {
  id: string;
  workId: string;
  sectionId: string;
  paragraphId: string;
  n: number | null;
  tags: string[];
  createdAt: string;
}
export interface Progress {
  sectionId: string;
  paragraphId?: string;
  pct: number;
  updatedAt: string;
}

interface StudyState {
  highlights: Highlight[];
  notes: Note[];
  bookmarks: Bookmark[];
  customTags: string[];
  progress: Record<string, Progress>; // por obra (última posição)
  sectionPct: Record<string, number>; // `${workId}/${sectionId}` -> 0..1
  addHighlight: (h: Omit<Highlight, "id" | "createdAt" | "updatedAt">) => string;
  updateHighlight: (id: string, p: Partial<Highlight>) => void;
  removeHighlight: (id: string) => void;
  upsertNote: (n: Omit<Note, "id" | "createdAt" | "updatedAt"> & { id?: string }) => void;
  removeNote: (id: string) => void;
  toggleBookmark: (b: Omit<Bookmark, "id" | "createdAt" | "tags">) => void;
  setBookmarkTags: (paragraphId: string, workId: string, tags: string[]) => void;
  addTag: (t: string) => void;
  setProgress: (workId: string, p: Omit<Progress, "updatedAt">) => void;
  importAll: (d: Partial<StudyState>) => void;
}

const now = () => new Date().toISOString();

export const useStudy = create<StudyState>()(
  persist(
    (set) => ({
      highlights: [],
      notes: [],
      bookmarks: [],
      customTags: [],
      progress: {},
      sectionPct: {},
      addHighlight: (h) => {
        const id = uid();
        set((s) => ({ highlights: [...s.highlights, { ...h, id, createdAt: now(), updatedAt: now() }] }));
        return id;
      },
      updateHighlight: (id, p) =>
        set((s) => ({ highlights: s.highlights.map((h) => (h.id === id ? { ...h, ...p, updatedAt: now() } : h)) })),
      removeHighlight: (id) => set((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) })),
      upsertNote: (n) =>
        set((s) => {
          const existing = n.id ? s.notes.find((x) => x.id === n.id) : undefined;
          if (existing) {
            if (!n.text.trim()) return { notes: s.notes.filter((x) => x.id !== n.id) };
            return { notes: s.notes.map((x) => (x.id === n.id ? { ...x, text: n.text, updatedAt: now() } : x)) };
          }
          if (!n.text.trim()) return {};
          return { notes: [...s.notes, { ...n, id: uid(), createdAt: now(), updatedAt: now() }] };
        }),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      toggleBookmark: (b) =>
        set((s) => {
          const ex = s.bookmarks.find((x) => x.paragraphId === b.paragraphId && x.workId === b.workId);
          if (ex) return { bookmarks: s.bookmarks.filter((x) => x !== ex) };
          return { bookmarks: [...s.bookmarks, { ...b, id: uid(), tags: [], createdAt: now() }] };
        }),
      setBookmarkTags: (paragraphId, workId, tags) =>
        set((s) => ({
          bookmarks: s.bookmarks.map((x) => (x.paragraphId === paragraphId && x.workId === workId ? { ...x, tags } : x)),
        })),
      addTag: (t) => set((s) => (s.customTags.includes(t) || DEFAULT_TAGS.includes(t) ? {} : { customTags: [...s.customTags, t] })),
      setProgress: (workId, p) =>
        set((s) => ({
          progress: { ...s.progress, [workId]: { ...p, updatedAt: now() } },
          sectionPct: {
            ...s.sectionPct,
            [`${workId}/${p.sectionId}`]: Math.max(p.pct, s.sectionPct[`${workId}/${p.sectionId}`] ?? 0),
          },
        })),
      importAll: (d) => set(() => ({ ...d })),
    }),
    { name: "stoa:estudo", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

// ---------------------------------------------------------------- conteúdo (admin)
interface ContentState {
  sectionOverrides: Record<string, Record<string, Section>>; // workId -> sectionId -> Section
  guideOverrides: Record<string, Record<string, GuideModule>>;
  customWorks: Work[];
  episodes: Episode[];
  illustrations: Illustration[];
  hiddenBase: string[];
  setSections: (workId: string, sections: Section[]) => void;
  resetSection: (workId: string, sectionId: string) => void;
  setGuide: (workId: string, mod: GuideModule) => void;
  resetGuide: (workId: string, sectionId: string) => void;
  upsertWork: (w: Work) => void;
  removeWork: (id: string) => void;
  addEpisode: (e: Episode) => void;
  updateEpisode: (id: string, p: Partial<Episode>) => void;
  removeEpisode: (id: string) => void;
  addIllustration: (i: Illustration) => void;
  removeIllustration: (id: string) => void;
  importAll: (d: Partial<ContentState>) => void;
  /** Apaga os rascunhos do admin (depois que foram publicados no repositório). */
  clearDrafts: () => void;
}

export const useContent = create<ContentState>()(
  persist(
    (set) => ({
      sectionOverrides: {},
      guideOverrides: {},
      customWorks: [],
      episodes: [],
      illustrations: [],
      hiddenBase: [],
      setSections: (workId, sections) =>
        set((s) => {
          const cur = { ...(s.sectionOverrides[workId] ?? {}) };
          for (const sec of sections) cur[sec.id] = sec;
          return { sectionOverrides: { ...s.sectionOverrides, [workId]: cur } };
        }),
      resetSection: (workId, sectionId) =>
        set((s) => {
          const cur = { ...(s.sectionOverrides[workId] ?? {}) };
          delete cur[sectionId];
          return { sectionOverrides: { ...s.sectionOverrides, [workId]: cur } };
        }),
      setGuide: (workId, mod) =>
        set((s) => ({
          guideOverrides: { ...s.guideOverrides, [workId]: { ...(s.guideOverrides[workId] ?? {}), [mod.sectionId]: mod } },
        })),
      resetGuide: (workId, sectionId) =>
        set((s) => {
          const cur = { ...(s.guideOverrides[workId] ?? {}) };
          delete cur[sectionId];
          return { guideOverrides: { ...s.guideOverrides, [workId]: cur } };
        }),
      upsertWork: (w) => set((s) => ({ customWorks: [...s.customWorks.filter((x) => x.id !== w.id), w] })),
      removeWork: (id) => set((s) => ({ customWorks: s.customWorks.filter((x) => x.id !== id) })),
      addEpisode: (e) => set((s) => ({ episodes: [...s.episodes, e] })),
      updateEpisode: (id, p) => set((s) => ({ episodes: s.episodes.map((e) => (e.id === id ? { ...e, ...p } : e)) })),
      removeEpisode: (id) =>
        set((s) => ({ episodes: s.episodes.filter((e) => e.id !== id), hiddenBase: [...s.hiddenBase, id] })),
      addIllustration: (i) => set((s) => ({ illustrations: [...s.illustrations, i] })),
      removeIllustration: (id) =>
        set((s) => ({ illustrations: s.illustrations.filter((e) => e.id !== id), hiddenBase: [...s.hiddenBase, id] })),
      importAll: (d) => set(() => ({ ...d })),
      clearDrafts: () =>
        set(() => ({ sectionOverrides: {}, guideOverrides: {}, customWorks: [], episodes: [], illustrations: [], hiddenBase: [] })),
    }),
    { name: "stoa:conteudo", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

// ---------------------------------------------------------------- hidratação
export const useHydrated = create<{ ok: boolean }>(() => ({ ok: false }));
export async function hydrateStores() {
  await Promise.all([usePrefs.persist.rehydrate(), useStudy.persist.rehydrate(), useContent.persist.rehydrate()]);
  useHydrated.setState({ ok: true });
}

// ---------------------------------------------------------------- seletores combinados
function mergeWork(base: Work, sectionOv?: Record<string, Section>, guideOv?: Record<string, GuideModule>): Work {
  let sections = base.sections;
  if (sectionOv && Object.keys(sectionOv).length) {
    const map = new Map(sections.map((s) => [s.id, s]));
    for (const [id, s] of Object.entries(sectionOv)) map.set(id, s);
    sections = [...map.values()].sort((a, b) => sectionRank(a) - sectionRank(b));
  }
  let guide = base.guide;
  if (guideOv && Object.keys(guideOv).length) {
    const map = new Map(guide.map((g) => [g.sectionId, g]));
    for (const [id, g] of Object.entries(guideOv)) map.set(id, g);
    guide = [...map.values()];
  }
  const status = sections.length ? "disponivel" : base.status;
  return { ...base, sections, guide, status };
}

type ContentSlice = Pick<ContentState, "sectionOverrides" | "guideOverrides" | "customWorks" | "episodes" | "illustrations" | "hiddenBase">;

/** Obras do repositório + rascunhos do admin (funciona fora de componentes). */
export function computeWorks(c: Pick<ContentSlice, "sectionOverrides" | "guideOverrides" | "customWorks">): Work[] {
  const { sectionOverrides, guideOverrides, customWorks } = c;
  const ids = new Set<string>();
  const out: Work[] = [];
  for (const w of [...BASE_WORKS.filter((b) => !customWorks.some((x) => x.id === b.id)), ...customWorks]) {
    if (ids.has(w.id)) continue;
    ids.add(w.id);
    out.push(mergeWork(w, sectionOverrides[w.id], guideOverrides[w.id]));
  }
  return out;
}

export function computeEpisodes(c: Pick<ContentSlice, "episodes" | "hiddenBase">): Episode[] {
  return [...BASE_EPISODES.filter((e) => !c.hiddenBase.includes(e.id)), ...c.episodes];
}

export function computeIllustrations(c: Pick<ContentSlice, "illustrations" | "hiddenBase">): Illustration[] {
  return [...BASE_ILLUSTRATIONS.filter((e) => !c.hiddenBase.includes(e.id)), ...c.illustrations];
}

export function useWorks(): Work[] {
  const { sectionOverrides, guideOverrides, customWorks } = useContent();
  return useMemo(() => computeWorks({ sectionOverrides, guideOverrides, customWorks }), [sectionOverrides, guideOverrides, customWorks]);
}

export function useWork(id: string | undefined): Work | undefined {
  const works = useWorks();
  return works.find((w) => w.id === id);
}

export function useEpisodes(): Episode[] {
  const { episodes, hiddenBase } = useContent();
  return useMemo(() => computeEpisodes({ episodes, hiddenBase }), [episodes, hiddenBase]);
}

export function useIllustrations(): Illustration[] {
  const { illustrations, hiddenBase } = useContent();
  return useMemo(() => computeIllustrations({ illustrations, hiddenBase }), [illustrations, hiddenBase]);
}
