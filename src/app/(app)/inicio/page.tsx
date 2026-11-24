"use client";
import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import { ArrowRight, Bookmark, BookOpen, Headphones, Highlighter, Landmark, Lock, NotebookPen, Play, Settings2, Sparkles } from "lucide-react";
import { AUTHORS, authorOf } from "@/content/library";
import { useEpisodes, useHydrated, useIllustrations, useStudy, useWorks } from "@/lib/store";
import { usePlayer } from "@/lib/player";
import { useIsAdmin } from "@/lib/admin-session";
import { MediaImage, SectionTitle } from "@/components/ui";

const GREEK: Record<string, string> = { "marco-aurelio": "Μ", seneca: "Σ", epicteto: "Ε" };

export default function Inicio() {
  const works = useWorks();
  const med = works.find((w) => w.id === "meditacoes")!;
  const hydrated = useHydrated((s) => s.ok);
  const study = useStudy();
  const episodes = useEpisodes();
  const illustrations = useIllustrations();
  const play = usePlayer((s) => s.play);
  const isAdmin = useIsAdmin();

  const progress = hydrated ? study.progress[med.id] : undefined;
  const progSection = progress ? med.sections.find((s) => s.id === progress.sectionId) : undefined;
  const progPara = progSection?.paragraphs.find((p) => p.id === progress?.paragraphId);

  // máxima do dia: parágrafo curto, escolhido pela data
  const maxim = useMemo(() => {
    const pool = med.sections
      .filter((s) => s.kind === "livro")
      .flatMap((s) => s.paragraphs.filter((p) => p.n !== null && p.blocks.length === 1 && p.blocks[0].length > 60 && p.blocks[0].length < 260).map((p) => ({ s, p })));
    const day = Math.floor(Date.now() / 86400000);
    return pool[day % pool.length];
  }, [med]);

  const totalPct = useMemo(() => {
    if (!hydrated) return 0;
    const vals = med.sections.map((s) => study.sectionPct[`${med.id}/${s.id}`] ?? 0);
    return vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
  }, [hydrated, med, study.sectionPct]);

  return (
    <div className="pb-10">
      {/* hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_30%,rgba(140,100,40,.25),transparent_55%)]" />
        <div className="hud-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-5 py-10 md:grid-cols-[1fr_auto] md:px-10 md:py-14">
          <div>
            <p className="kicker">Stoa OS · Central de estudos estoicos</p>
            <h1 className="mt-3 font-display text-[2rem] leading-tight text-parchment md:text-5xl">
              Salve. <span className="gold-text">Hoje, reflita.</span>
            </h1>
            {maxim && (
              <Link href={`/ler/${med.id}/${maxim.s.id}#p-${maxim.p.n}`} className="group mt-6 block max-w-2xl">
                <p className="font-mono text-[10.5px] tracking-[0.22em] text-gold-500">MÁXIMA DO DIA · {maxim.s.title.toUpperCase()}, {maxim.p.n}</p>
                <blockquote className="mt-2 border-l-2 border-gold-500/70 pl-4 font-serif text-xl italic leading-relaxed text-[#efe3c6] transition group-hover:text-gold-100 md:text-2xl">
                  “{maxim.p.blocks[0]}”
                </blockquote>
              </Link>
            )}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={progSection ? `/ler/${med.id}/${progSection.id}` : `/ler/${med.id}/${med.sections[0].id}`} className="btn-gold flex items-center gap-2 rounded-full px-5 py-2.5 text-sm">
                <BookOpen className="size-4" /> {progSection ? "Continuar leitura" : "Começar a ler"}
              </Link>
              <Link href="/contexto" className="flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm text-parchment-dim hover:border-gold-400 hover:text-gold-100">
                <Sparkles className="size-4" /> Guia de estudos
              </Link>
            </div>
          </div>
          <div className="relative mx-auto hidden size-56 md:block lg:size-64">
            <div className="anim-pulse absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(217,180,106,.25),transparent_65%)]" />
            <Image src="/img/medalhao-560.webp" alt="Marco Aurélio" fill sizes="256px" className="anim-float rounded-full object-contain" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-5 pt-8 md:px-10">
        {/* continuar + caderno */}
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <Link href={progSection ? `/ler/${med.id}/${progSection.id}` : `/ler/${med.id}/${med.sections[0].id}`} className="panel group rounded-3xl p-5 transition hover:border-gold-500/50 md:p-6">
            <p className="kicker">Sua jornada</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="font-display text-2xl text-gold-100">{progSection ? progSection.title : "Prefácio"}</p>
                <p className="mt-1 text-sm text-parchment-dim">
                  {progSection ? (progPara?.n ? `Você parou no §${progPara.n}` : "Você parou aqui") : "Comece pelo Prefácio e siga até o Livro IV"}
                </p>
              </div>
              <span className="grid size-11 shrink-0 place-items-center rounded-full border border-gold-500/50 text-gold-200 transition group-hover:bg-gold-400/15">
                <ArrowRight className="size-5" />
              </span>
            </div>
            <div className="mt-5">
              <div className="flex justify-between font-mono text-[10.5px] text-muted">
                <span>MEDITAÇÕES</span>
                <span>{Math.round(totalPct * 100)}%</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[.06]">
                <div className="h-full bg-gradient-to-r from-gold-600 to-gold-200" style={{ width: `${totalPct * 100}%` }} />
              </div>
              <div className="mt-3 flex gap-1">
                {med.sections.map((s) => (
                  <span key={s.id} title={s.title} className="h-1 flex-1 rounded-full bg-white/[.06]">
                    <span className="block h-full rounded-full bg-gold-400/80" style={{ width: `${(hydrated ? study.sectionPct[`${med.id}/${s.id}`] ?? 0 : 0) * 100}%` }} />
                  </span>
                ))}
              </div>
            </div>
          </Link>
          <Link href="/caderno" className="panel grid grid-cols-3 gap-2 rounded-3xl p-5 transition hover:border-gold-500/50 md:p-6">
            <p className="kicker col-span-3">Seu caderno</p>
            {[
              { icon: Highlighter, n: study.highlights.length, l: "grifos" },
              { icon: NotebookPen, n: study.notes.length + study.highlights.filter((h) => h.note).length, l: "notas" },
              { icon: Bookmark, n: study.bookmarks.length, l: "marcadores" },
            ].map(({ icon: Icon, n, l }) => (
              <div key={l} className="rounded-2xl bg-white/[.02] p-3 text-center">
                <Icon className="mx-auto size-4 text-gold-400" />
                <p className="mt-1 font-display text-2xl text-gold-100">{hydrated ? n : "–"}</p>
                <p className="text-[11px] text-muted">{l}</p>
              </div>
            ))}
          </Link>
        </div>

        {/* biblioteca */}
        <section>
          <SectionTitle>Biblioteca estoica</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {works.map((w) => {
              const a = authorOf(w);
              const available = w.status === "disponivel" && w.sections.length > 0;
              const inner = (
                <>
                  <div className="relative h-36 overflow-hidden rounded-2xl border border-line bg-[radial-gradient(circle_at_70%_40%,rgba(201,164,92,.18),transparent_60%)]">
                    {w.id === "meditacoes" ? (
                      <Image src="/img/medalhao-560.webp" alt="" width={220} height={220} className="absolute -right-6 -top-8 size-52 rounded-full opacity-90 transition duration-700 group-hover:scale-105" />
                    ) : (
                      <span className="absolute -right-2 -top-6 font-display text-[9rem] leading-none text-gold-400/15">{GREEK[w.authorId] ?? "Σ"}</span>
                    )}
                    <span className="absolute bottom-3 left-4 font-mono text-[10px] tracking-[0.2em] text-gold-400">{a.role.toUpperCase()}</span>
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-xl text-gold-100">{w.title}</p>
                      <p className="text-[13px] text-parchment-dim">{a.name} · {a.dates}</p>
                    </div>
                    {!available && (
                      <span className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">
                        <Lock className="size-3" /> Em breve
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-muted">{w.description}</p>
                  {available && (
                    <p className="mt-3 text-[12px] text-gold-300">
                      {w.sections.length} seções · {w.guide.length} módulos do guia
                    </p>
                  )}
                </>
              );
              return available ? (
                <Link key={w.id} href={`/ler/${w.id}`} className="panel group rounded-3xl p-4 transition hover:border-gold-500/50">
                  {inner}
                </Link>
              ) : (
                <div key={w.id} className="panel rounded-3xl p-4 opacity-70">
                  {inner}
                </div>
              );
            })}
          </div>
        </section>

        {/* guia */}
        <section>
          <SectionTitle action={<Link href="/contexto" className="text-[13px] text-gold-300 hover:text-gold-100">Ver tudo</Link>}>Guia de estudos — Meditações</SectionTitle>
          <div className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-4 md:px-0">
            {med.guide.map((g) => (
              <Link key={g.sectionId} href={`/contexto/${med.id}/${g.sectionId}`} className="panel group w-64 shrink-0 snap-start rounded-2xl p-4 transition hover:border-gold-500/50 md:w-auto">
                <p className="kicker">{g.module}</p>
                <p className="mt-2 font-display text-[15px] leading-snug text-gold-100">{g.title}</p>
                <p className="mt-3 text-[12px] text-muted">{g.entries.length} {g.entries.length === 1 ? "análise" : "análises"}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* podcasts */}
        <section>
          <SectionTitle action={<Link href="/podcasts" className="text-[13px] text-gold-300 hover:text-gold-100">Todos</Link>}>Podcasts</SectionTitle>
          {episodes.length === 0 ? (
            <div className="panel flex flex-col items-start gap-3 rounded-3xl p-5 sm:flex-row sm:items-center">
              <Headphones className="size-8 text-gold-500" strokeWidth={1.3} />
              <p className="flex-1 text-sm text-parchment-dim">Os episódios de cada livro aparecem aqui{isAdmin ? ". Envie os áudios do NotebookLM pelo painel Admin." : " em breve."}</p>
              {isAdmin && <Link href="/admin?tab=podcasts" className="btn-gold rounded-full px-4 py-2 text-sm">Adicionar podcast</Link>}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {episodes.slice(-4).reverse().map((ep) => (
                <button key={ep.id} onClick={() => play(ep)} className="panel flex min-w-0 items-center gap-4 rounded-2xl p-4 text-left transition hover:border-gold-500/50">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-300 text-ink-950"><Play className="ml-0.5 size-5" fill="currentColor" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] text-parchment">{ep.title}</span>
                    <span className="text-[12px] text-muted">{works.find((w) => w.id === ep.workId)?.sections.find((s) => s.id === ep.sectionId)?.title}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {illustrations.length > 0 && (
          <section>
            <SectionTitle>Ilustrações</SectionTitle>
            <div className="columns-2 gap-3 md:columns-3">
              {illustrations.map((il) => (
                <figure key={il.id} className="mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-line">
                  <MediaImage src={il.src} alt={il.title} className="h-auto w-full" />
                  <figcaption className="px-3 py-2 text-[12.5px] text-parchment-dim">{il.title}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-[12.5px] text-muted">
          <p>
            Tríade estoica: {AUTHORS.map((a) => a.name).join(" · ")}. Seus grifos e notas ficam salvos neste navegador.
          </p>
          {isAdmin ? (
            <Link href="/admin" className="flex items-center gap-1.5 text-gold-400 hover:text-gold-200">
              <Settings2 className="size-4" /> Painel Admin
            </Link>
          ) : (
            // acesso discreto (também no celular, onde não há trilho lateral)
            <Link href="/entrar" aria-label="Área restrita" className="p-1 text-gold-700/60 transition hover:text-gold-400">
              <Landmark className="size-3.5" />
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
