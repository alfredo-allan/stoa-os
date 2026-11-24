"use client";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Pause, Play, RotateCcw, RotateCw, X, ListMusic, BookOpen } from "lucide-react";
import { fmtTime, usePlayer } from "@/lib/player";
import { useWorks } from "@/lib/store";
import { useUI } from "./AppShell";

const RATES = [0.8, 1, 1.25, 1.5, 1.75, 2];

export function MiniPlayer() {
  const { episode, playing, time, duration, rate, expanded, error } = usePlayer();
  const { toggle, skip, seek, setRate, setExpanded, close } = usePlayer.getState();
  const works = useWorks();
  const immersive = useUI((s) => s.immersive);
  if (!episode) return null;
  const work = works.find((w) => w.id === episode.workId);
  const section = work?.sections.find((s) => s.id === episode.sectionId);
  const pct = duration ? (time / duration) * 100 : 0;
  const currentChapter = [...episode.chapters].reverse().find((c) => c.t <= time + 0.5);

  return (
    <>
      {/* barra compacta */}
      <div
        className={`fixed inset-x-0 z-40 px-2 transition-[bottom] duration-300 md:left-[84px] md:px-4 ${immersive ? "bottom-[calc(env(safe-area-inset-bottom)+8px)]" : "bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+6px)]"} md:bottom-3`}
      >
        <div className="panel relative mx-auto flex h-[60px] max-w-4xl items-center gap-3 overflow-hidden rounded-2xl pl-2 pr-2 shadow-[0_10px_40px_rgba(0,0,0,.6)]">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gold-400/10">
            <div className="h-full bg-gradient-to-r from-gold-500 to-gold-200" style={{ width: `${pct}%` }} />
          </div>
          <button onClick={() => setExpanded(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <Image src="/img/medalhao-256.png" alt="" width={42} height={42} className={`rounded-full ${playing ? "animate-[spin-slow_18s_linear_infinite]" : ""}`} />
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-parchment">{episode.title}</p>
              <p className="truncate text-[11.5px] text-muted">
                {error ?? (currentChapter ? currentChapter.label : `${work?.title ?? ""} · ${section?.title ?? ""}`)}
              </p>
            </div>
          </button>
          <span className="hidden font-mono text-[11px] text-muted sm:block">
            {fmtTime(time)} / {fmtTime(duration)}
          </span>
          <button onClick={() => skip(-15)} className="hidden size-9 place-items-center rounded-full text-parchment-dim hover:text-gold-200 sm:grid" aria-label="Voltar 15 segundos">
            <RotateCcw className="size-[18px]" />
          </button>
          <button onClick={toggle} className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-300 text-ink-950 shadow-[0_0_20px_rgba(217,180,106,.35)]" aria-label={playing ? "Pausar" : "Tocar"}>
            {playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="ml-0.5 size-5" fill="currentColor" />}
          </button>
          <button onClick={() => skip(30)} className="hidden size-9 place-items-center rounded-full text-parchment-dim hover:text-gold-200 sm:grid" aria-label="Avançar 30 segundos">
            <RotateCw className="size-[18px]" />
          </button>
          <button onClick={close} className="grid size-9 place-items-center rounded-full text-muted hover:text-parchment" aria-label="Fechar player">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* player expandido */}
      {expanded && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center" onClick={() => setExpanded(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="panel safe-bottom relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl p-6 md:max-w-lg md:rounded-3xl"
          >
            <button onClick={() => setExpanded(false)} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-muted hover:text-parchment" aria-label="Recolher">
              <ChevronDown className="size-5" />
            </button>
            <div className="mx-auto mt-2 w-48 md:w-56">
              <Image src="/img/medalhao-560.webp" alt="" width={560} height={560} className={`rounded-full ${playing ? "animate-[spin-slow_60s_linear_infinite]" : ""}`} />
            </div>
            <p className="kicker mt-6 text-center">{work?.title} · {section?.title}</p>
            <h3 className="mt-2 text-center font-display text-xl text-gold-100">{episode.title}</h3>
            {episode.description && <p className="mt-2 text-center text-sm text-parchment-dim">{episode.description}</p>}
            {error && <p className="mt-3 text-center text-sm text-rose-300">{error}</p>}

            <div className="mt-6">
              <input
                type="range"
                className="gold-range w-full"
                min={0}
                max={duration || 0}
                step={1}
                value={time}
                style={{ ["--pct" as string]: `${pct}%` }}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label="Posição"
              />
              <div className="mt-1 flex justify-between font-mono text-[11px] text-muted">
                <span>{fmtTime(time)}</span>
                <span>-{fmtTime(Math.max(0, duration - time))}</span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-6">
              <button onClick={() => skip(-15)} className="grid size-12 place-items-center rounded-full text-parchment hover:text-gold-200" aria-label="Voltar 15s">
                <RotateCcw className="size-6" />
              </button>
              <button onClick={toggle} className="grid size-16 place-items-center rounded-full bg-gold-300 text-ink-950 shadow-[0_0_30px_rgba(217,180,106,.45)]" aria-label={playing ? "Pausar" : "Tocar"}>
                {playing ? <Pause className="size-7" fill="currentColor" /> : <Play className="ml-1 size-7" fill="currentColor" />}
              </button>
              <button onClick={() => skip(30)} className="grid size-12 place-items-center rounded-full text-parchment hover:text-gold-200" aria-label="Avançar 30s">
                <RotateCw className="size-6" />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {RATES.map((r) => (
                <button key={r} onClick={() => setRate(r)} className={`rounded-full px-3 py-1 font-mono text-xs ${rate === r ? "bg-gold-400/20 text-gold-100" : "text-muted hover:text-parchment"}`}>
                  {r}×
                </button>
              ))}
            </div>

            {episode.chapters.length > 0 && (
              <div className="mt-6">
                <p className="kicker mb-2 flex items-center gap-2"><ListMusic className="size-3.5" /> Marcadores de tempo</p>
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {episode.chapters.map((c, i) => {
                    const active = currentChapter === c;
                    return (
                      <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                        <button onClick={() => seek(c.t)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <span className={`font-mono text-xs ${active ? "text-gold-200" : "text-muted"}`}>{fmtTime(c.t)}</span>
                          <span className={`truncate text-sm ${active ? "text-gold-100" : "text-parchment-dim"}`}>{c.label}</span>
                        </button>
                        {c.paragraph && (
                          <Link
                            onClick={() => setExpanded(false)}
                            href={`/ler/${episode.workId}/${episode.sectionId}#p-${c.paragraph}`}
                            className="flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-gold-300 hover:border-gold-400"
                          >
                            <BookOpen className="size-3" /> §{c.paragraph}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
