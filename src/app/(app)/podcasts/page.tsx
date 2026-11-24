"use client";
import Link from "next/link";
import { BookOpen, Headphones, Pause, Play, Plus } from "lucide-react";
import { useEpisodes, useWorks } from "@/lib/store";
import { fmtTime, usePlayer } from "@/lib/player";
import { useIsAdmin } from "@/lib/admin-session";
import { PageHeader } from "@/components/ui";

export default function Podcasts() {
  const works = useWorks().filter((w) => w.sections.length);
  const episodes = useEpisodes();
  const { episode: current, playing, time } = usePlayer();
  const { play, toggle, seek } = usePlayer.getState();
  const isAdmin = useIsAdmin();

  return (
    <div>
      <PageHeader kicker="Audio Overviews · NotebookLM" title="Podcasts">
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-parchment-dim">
          Um episódio por livro. O player fica fixo embaixo e continua tocando enquanto você lê ou abre o contexto. Os marcadores de tempo levam direto ao parágrafo.
        </p>
      </PageHeader>
      <div className="mx-auto max-w-5xl space-y-10 px-5 py-8 md:px-10">
        {works.map((w) => (
          <section key={w.id}>
            <h2 className="font-display text-xl text-gold-100">{w.title}</h2>
            <div className="mt-4 space-y-3">
              {w.sections.map((s) => {
                const eps = episodes.filter((e) => e.workId === w.id && e.sectionId === s.id);
                return (
                  <div key={s.id} className="panel rounded-2xl p-4 md:p-5">
                    <div className="flex items-center gap-3">
                      <p className="font-display text-[15px] text-gold-200">{s.title}</p>
                      <span className="ml-auto text-[12px] text-muted">{eps.length ? `${eps.length} episódio${eps.length > 1 ? "s" : ""}` : "sem episódio"}</span>
                    </div>
                    {eps.length === 0 && isAdmin && (
                      <Link href="/admin?tab=podcasts" className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-gold-200">
                        <Plus className="size-4" /> Enviar o podcast deste livro
                      </Link>
                    )}
                    {eps.map((ep) => {
                      const isCur = current?.id === ep.id;
                      return (
                        <div key={ep.id} className="mt-3 rounded-xl border border-line bg-ink-900/60 p-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => (isCur ? toggle() : play(ep))}
                              className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-300 text-ink-950 shadow-[0_0_18px_rgba(217,180,106,.3)]"
                              aria-label="Tocar"
                            >
                              {isCur && playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="ml-0.5 size-5" fill="currentColor" />}
                            </button>
                            <div className="min-w-0">
                              <p className="truncate text-[15px] text-parchment">{ep.title}</p>
                              {ep.description && <p className="line-clamp-2 text-[12.5px] text-muted">{ep.description}</p>}
                            </div>
                            <Headphones className={`ml-auto size-4 shrink-0 ${isCur ? "text-gold-300" : "text-muted"}`} />
                          </div>
                          {ep.chapters.length > 0 && (
                            <ul className="mt-3 divide-y divide-line border-t border-line">
                              {ep.chapters.map((c, i) => {
                                const active = isCur && time >= c.t && (ep.chapters[i + 1]?.t ?? Infinity) > time;
                                return (
                                  <li key={i} className="flex items-center gap-3 py-2">
                                    <button onClick={() => (isCur ? seek(c.t) : play(ep, c.t))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                                      <span className={`w-14 font-mono text-[12px] ${active ? "text-gold-200" : "text-muted"}`}>{fmtTime(c.t)}</span>
                                      <span className={`truncate text-[13.5px] ${active ? "text-gold-100" : "text-parchment-dim"}`}>{c.label}</span>
                                    </button>
                                    {c.paragraph && (
                                      <Link href={`/ler/${w.id}/${s.id}#p-${c.paragraph}`} className="flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-gold-300 hover:border-gold-400">
                                        <BookOpen className="size-3" /> §{c.paragraph}
                                      </Link>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
