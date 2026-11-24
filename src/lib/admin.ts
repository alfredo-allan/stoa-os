"use client";
// Lado do navegador do modo admin: sessão, envio de arquivos e montagem da publicação.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { upload } from "@vercel/blob/client";
import { BASE_EPISODES, BASE_ILLUSTRATIONS, REGISTERED_IDS } from "@/content/library";
import { computeEpisodes, computeIllustrations, computeWorks, useContent } from "@/lib/store";

export { useAdminState, useIsAdmin } from "./admin-session";
export type { PublishMode, StorageMode } from "./admin-session";
import { useAdminState, type PublishMode } from "./admin-session";

// ---------------------------------------------------------------- commit pendente
// Depois de publicar via GitHub, a Vercel leva ~1–2 min para colocar a nova versão no ar.
// Guardamos o commit e só apagamos os rascunhos locais quando o site já roda esse commit.
interface PendingState {
  commit: string | null;
  at: string | null;
  /** impressão digital dos arquivos publicados, para não apagar edições feitas depois */
  fingerprint: string | null;
  set: (commit: string | null, fingerprint?: string | null) => void;
}
export const usePending = create<PendingState>()(
  persist(
    (set) => ({
      commit: null,
      at: null,
      fingerprint: null,
      set: (commit, fingerprint = null) => set({ commit, fingerprint, at: commit ? new Date().toISOString() : null }),
    }),
    { name: "stoa:admin-pendente", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

// ---------------------------------------------------------------- upload de arquivos
function cleanName(name: string) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return (base || "arquivo") + ext;
}

/** Envia o arquivo para o armazenamento do site e devolve a URL pública. */
export async function uploadMedia(file: File, folder: "podcasts" | "ilustracoes", onProgress?: (pct: number) => void): Promise<string> {
  const { storage } = useAdminState.getState();
  if (storage === "blob") {
    const blob = await upload(`${folder}/${cleanName(file.name)}`, file, {
      access: "public",
      handleUploadUrl: "/api/admin/upload",
      multipart: file.size > 20 * 1024 * 1024,
      onUploadProgress: (e) => onProgress?.(Math.round(e.percentage)),
    });
    return blob.url;
  }
  if (storage === "local") {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", folder);
    const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? "Falha no envio");
    return d.url as string;
  }
  throw new Error("Envio de arquivos não configurado (conecte um Vercel Blob ao projeto).");
}

// ---------------------------------------------------------------- publicação
export interface Publication {
  files: { path: string; content: string }[];
  registerWorks?: string[];
  summary: string[];
  skipped: string[];
}

/** Monta os arquivos de conteúdo a partir dos rascunhos do admin. */
export function buildPublication(): Publication {
  const c = useContent.getState();
  const works = computeWorks(c);
  const files: Publication["files"] = [];
  const summary: string[] = [];
  const skipped: string[] = [];

  const changed = new Set<string>([
    ...Object.entries(c.sectionOverrides).filter(([, v]) => Object.keys(v).length).map(([k]) => k),
    ...Object.entries(c.guideOverrides).filter(([, v]) => Object.keys(v).length).map(([k]) => k),
    ...c.customWorks.map((w) => w.id),
  ]);
  const newIds: string[] = [];
  for (const id of changed) {
    const w = works.find((x) => x.id === id);
    if (!w) continue;
    const status = w.sections.length ? "disponivel" : "em-breve";
    const meta = { id: w.id, title: w.title, subtitle: w.subtitle, authorId: w.authorId, description: w.description, status };
    files.push({ path: `content/obras/${w.id}/obra.json`, content: JSON.stringify({ ...meta, sections: w.sections, guide: w.guide }, null, 1) });
    files.push({ path: `content/obras/${w.id}/guia.json`, content: JSON.stringify(w.guide, null, 1) });
    if (!REGISTERED_IDS.includes(w.id)) {
      files.push({ path: `content/obras/${w.id}/meta.json`, content: JSON.stringify(meta, null, 2) });
      newIds.push(w.id);
    }
    const ns = Object.keys(c.sectionOverrides[id] ?? {}).length;
    const ng = Object.keys(c.guideOverrides[id] ?? {}).length;
    summary.push(
      `${w.title}: ${[ns && `${ns} seção(ões) de texto`, ng && `${ng} módulo(s) do guia`, newIds.includes(w.id) && "obra nova"].filter(Boolean).join(", ") || "dados da obra"}`,
    );
  }

  const baseEp = new Set(BASE_EPISODES.map((e) => e.id));
  if (c.episodes.length || c.hiddenBase.some((id) => baseEp.has(id))) {
    const all = computeEpisodes(c);
    const local = all.filter((e) => e.src.startsWith("idb:"));
    skipped.push(...local.map((e) => `Podcast “${e.title}” (arquivo só neste navegador)`));
    files.push({ path: "content/podcasts.json", content: JSON.stringify(all.filter((e) => !e.src.startsWith("idb:")), null, 2) + "\n" });
    summary.push(`Podcasts: ${all.length - local.length} episódio(s) no total`);
  }

  const baseIl = new Set(BASE_ILLUSTRATIONS.map((e) => e.id));
  if (c.illustrations.length || c.hiddenBase.some((id) => baseIl.has(id))) {
    const all = computeIllustrations(c);
    const local = all.filter((e) => e.src.startsWith("idb:"));
    skipped.push(...local.map((e) => `Ilustração “${e.title}” (arquivo só neste navegador)`));
    files.push({ path: "content/ilustracoes.json", content: JSON.stringify(all.filter((e) => !e.src.startsWith("idb:")), null, 2) + "\n" });
    summary.push(`Ilustrações: ${all.length - local.length} no total`);
  }

  return { files, registerWorks: newIds.length ? [...REGISTERED_IDS, ...newIds] : undefined, summary, skipped };
}

export async function publishToSite(pub: Publication, message: string) {
  const r = await fetch("/api/admin/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: pub.files, registerWorks: pub.registerWorks, message }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? `Falha ao publicar (${r.status})`);
  return d as { ok: true; mode: PublishMode; commit?: string; url?: string; files: string[] };
}

export function fingerprint(pub: Publication): string {
  const str = JSON.stringify([pub.files, pub.registerWorks ?? []]);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return `${str.length}:${(h >>> 0).toString(36)}`;
}
