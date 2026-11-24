"use client";
// Player global: um único <audio> no layout raiz, então a reprodução continua
// ao navegar entre páginas, abrir o leitor ou os pop-ups de contexto.
import { create } from "zustand";
import { useEffect, useRef } from "react";
import type { Episode } from "@/content/types";
import { resolveMedia } from "./media";

interface PlayerState {
  episode: Episode | null;
  playing: boolean;
  time: number;
  duration: number;
  rate: number;
  expanded: boolean;
  pendingSeek: number | null;
  error: string | null;
  play: (e: Episode, at?: number) => void;
  toggle: () => void;
  seek: (t: number) => void;
  skip: (d: number) => void;
  setRate: (r: number) => void;
  setExpanded: (v: boolean) => void;
  close: () => void;
}

export const usePlayer = create<PlayerState>((set, get) => ({
  episode: null,
  playing: false,
  time: 0,
  duration: 0,
  rate: 1,
  expanded: false,
  pendingSeek: null,
  error: null,
  play: (e, at) => {
    const cur = get().episode;
    if (cur?.id === e.id) set({ playing: true, pendingSeek: at ?? null });
    else set({ episode: e, playing: true, time: at ?? 0, duration: 0, pendingSeek: at ?? 0, error: null });
  },
  toggle: () => set((s) => ({ playing: !s.playing })),
  seek: (t) => set({ pendingSeek: t, time: t }),
  skip: (d) => set((s) => ({ pendingSeek: Math.max(0, Math.min(s.duration || Infinity, s.time + d)) })),
  setRate: (r) => set({ rate: r }),
  setExpanded: (v) => set({ expanded: v }),
  close: () => set({ episode: null, playing: false, time: 0, duration: 0, expanded: false }),
}));

const LS_KEY = "stoa:player";

export function AudioEngine() {
  const ref = useRef<HTMLAudioElement>(null);
  const episode = usePlayer((s) => s.episode);
  const playing = usePlayer((s) => s.playing);
  const rate = usePlayer((s) => s.rate);
  const pendingSeek = usePlayer((s) => s.pendingSeek);

  // restaura último episódio (pausado)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (saved?.episode) usePlayer.setState({ episode: saved.episode, time: saved.time ?? 0, pendingSeek: saved.time ?? 0, rate: saved.rate ?? 1, playing: false });
    } catch {}
  }, []);

  // carrega a fonte
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    if (!episode) { a.removeAttribute("src"); a.load(); return; }
    let alive = true;
    resolveMedia(episode.src).then((url) => {
      if (!alive || !url) { if (alive) usePlayer.setState({ error: "Arquivo de áudio não encontrado neste navegador.", playing: false }); return; }
      if (a.src !== url) { a.src = url; a.load(); }
      if (usePlayer.getState().playing) a.play().catch(() => usePlayer.setState({ playing: false }));
    });
    return () => { alive = false; };
  }, [episode]);

  useEffect(() => {
    const a = ref.current;
    if (!a || !a.src) return;
    if (playing) a.play().catch(() => usePlayer.setState({ playing: false }));
    else a.pause();
  }, [playing]);

  useEffect(() => { if (ref.current) ref.current.playbackRate = rate; }, [rate]);

  useEffect(() => {
    const a = ref.current;
    if (!a || pendingSeek === null) return;
    const apply = () => { a.currentTime = pendingSeek; usePlayer.setState({ pendingSeek: null, time: pendingSeek }); };
    if (a.readyState >= 1) apply();
    else a.addEventListener("loadedmetadata", apply, { once: true });
  }, [pendingSeek]);

  // salva posição
  useEffect(() => {
    const id = setInterval(() => {
      const { episode, time, rate } = usePlayer.getState();
      try { localStorage.setItem(LS_KEY, JSON.stringify({ episode, time, rate })); } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // Media Session (controles na tela bloqueada do celular)
  useEffect(() => {
    if (!episode || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: episode.title,
      artist: "Stoa OS · Meditações",
      artwork: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
    });
    navigator.mediaSession.setActionHandler("play", () => usePlayer.setState({ playing: true }));
    navigator.mediaSession.setActionHandler("pause", () => usePlayer.setState({ playing: false }));
    navigator.mediaSession.setActionHandler("seekbackward", () => usePlayer.getState().skip(-15));
    navigator.mediaSession.setActionHandler("seekforward", () => usePlayer.getState().skip(30));
  }, [episode]);

  return (
    <audio
      ref={ref}
      preload="metadata"
      onTimeUpdate={(e) => usePlayer.setState({ time: e.currentTarget.currentTime })}
      onLoadedMetadata={(e) => usePlayer.setState({ duration: e.currentTarget.duration })}
      onDurationChange={(e) => usePlayer.setState({ duration: e.currentTarget.duration })}
      onEnded={() => usePlayer.setState({ playing: false })}
      onPause={() => usePlayer.getState().playing && usePlayer.setState({ playing: false })}
      onPlay={() => !usePlayer.getState().playing && usePlayer.setState({ playing: true })}
      className="hidden"
    />
  );
}

export function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

export function parseTime(s: string): number | null {
  const parts = s.trim().split(":").map((x) => parseInt(x, 10));
  if (!parts.length || parts.some((x) => isNaN(x))) return null;
  return parts.reduce((acc, x) => acc * 60 + x, 0);
}

/** "00:00 | §1 | Título" ou "00:00 §1 Título" ou "00:00 Título" */
export function parseChapters(text: string) {
  const out: { t: number; label: string; paragraph?: number }[] = [];
  for (const line of text.split("\n")) {
    const m = line.trim().match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*[|\-–—]?\s*(?:§\s*(\d{1,3})\s*[|\-–—:]?\s*)?(.*)$/);
    if (!m) continue;
    const t = parseTime(m[1]);
    if (t === null) continue;
    out.push({ t, paragraph: m[2] ? parseInt(m[2], 10) : undefined, label: m[3].trim() || (m[2] ? `§${m[2]}` : "Capítulo") });
  }
  return out.sort((a, b) => a.t - b.t);
}
