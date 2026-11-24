"use client";
// Arquivos enviados pelo admin (podcasts, ilustrações) ficam no IndexedDB do navegador,
// porque o localStorage só guarda ~5 MB. São referenciados como "idb:<chave>".
import { get, set, del } from "idb-keyval";
import { useEffect, useState } from "react";
import { uid } from "./store";

export async function saveMediaFile(file: Blob): Promise<string> {
  const key = `media-${uid()}`;
  await set(key, file);
  return `idb:${key}`;
}

export async function deleteMedia(src: string) {
  if (src.startsWith("idb:")) await del(src.slice(4));
}

const cache = new Map<string, string>();

export async function resolveMedia(src: string): Promise<string | null> {
  if (!src) return null;
  if (!src.startsWith("idb:")) return src;
  if (cache.has(src)) return cache.get(src)!;
  const blob = (await get(src.slice(4))) as Blob | undefined;
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  cache.set(src, url);
  return url;
}

export function useMediaUrl(src: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(src && !src.startsWith("idb:") ? src : null);
  useEffect(() => {
    let alive = true;
    if (!src) { setUrl(null); return; }
    resolveMedia(src).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [src]);
  return url;
}

export async function mediaToDataUrl(src: string): Promise<string | null> {
  if (!src.startsWith("idb:")) return src;
  const blob = (await get(src.slice(4))) as Blob | undefined;
  if (!blob) return null;
  return await new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToMedia(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  return saveMediaFile(blob);
}
