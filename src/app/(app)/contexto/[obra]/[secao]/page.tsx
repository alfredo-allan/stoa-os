"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, BookOpen, Sparkles } from "lucide-react";
import { useWork } from "@/lib/store";
import { rangeLabel } from "@/content/library";
import { Markdown } from "@/components/Markdown";
import { GuideDialog, type GuideTarget } from "@/components/GuideDialog";

export default function ModuloGuia() {
  const { obra, secao } = useParams<{ obra: string; secao: string }>();
  const work = useWork(obra);
  const [target, setTarget] = useState<GuideTarget | null>(null);
  const section = work?.sections.find((s) => s.id === secao);
  const mod = work?.guide.find((g) => g.sectionId === secao);
  if (!work || !section || !mod)
    return (
      <div className="grid min-h-[60dvh] place-items-center p-8 text-center">
        <div>
          <p className="font-display text-xl text-gold-100">Módulo não encontrado</p>
          <Link href="/contexto" className="btn-gold mt-6 inline-block rounded-full px-5 py-2 text-sm">Voltar ao guia</Link>
        </div>
      </div>
    );

  const idx = work.guide.indexOf(mod);
  return (
    <div>
      <header className="relative overflow-hidden border-b border-line px-5 pb-8 pt-6 md:px-10 md:pt-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,164,92,.14),transparent_60%)]" />
        <div className="relative mx-auto max-w-4xl">
          <Link href="/contexto" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-gold-200">
            <ArrowLeft className="size-4" /> Guia de estudos
          </Link>
          <p className="kicker mt-6">{mod.module} · {work.title}</p>
          <h1 className="gold-text mt-2 font-display text-[1.7rem] leading-tight md:text-[2.4rem]">{mod.title}</h1>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/ler/${work.id}/${section.id}`} className="btn-gold flex items-center gap-2 rounded-full px-4 py-2 text-sm">
              <BookOpen className="size-4" /> Ler {section.title}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8 md:px-10">
        {mod.introMd && (
          <section className="mb-10 rounded-3xl border border-line bg-white/[.015] p-5 md:p-7">
            <Markdown>{mod.introMd}</Markdown>
          </section>
        )}

        <p className="kicker mb-3">Análises ({mod.entries.length})</p>
        <ol className="grid gap-2.5">
          {mod.entries.map((e) => (
            <li key={e.id}>
              <button onClick={() => setTarget({ workId: work.id, sectionId: section.id, n: e.from, entryId: e.id })} className="panel group flex w-full items-start gap-4 rounded-2xl p-4 text-left transition hover:border-gold-500/50 md:p-5">
                <span className="min-w-16 shrink-0 rounded-xl border border-gold-500/30 bg-gold-400/5 px-2 py-2 text-center font-display text-[14px] text-gold-200">
                  {e.whole ? "Íntegra" : rangeLabel(e)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15.5px] leading-snug text-gold-100">{e.title}</span>
                  {e.quote && <span className="mt-1.5 line-clamp-2 block font-serif text-[15px] italic text-parchment-dim">{e.quote}</span>}
                </span>
                <Sparkles className="mt-1 size-4 shrink-0 text-gold-500 transition group-hover:text-gold-200" />
              </button>
            </li>
          ))}
        </ol>

        {mod.outroMd && (
          <section className="mt-12">
            <Markdown>{mod.outroMd}</Markdown>
          </section>
        )}

        <nav className="mt-14 grid grid-cols-2 gap-3">
          {idx > 0 ? (
            <Link href={`/contexto/${work.id}/${work.guide[idx - 1].sectionId}`} className="rounded-2xl border border-line p-4 hover:border-gold-500/50">
              <span className="text-[11px] text-muted">Módulo anterior</span>
              <span className="mt-1 block font-display text-[14px] text-gold-200">{work.guide[idx - 1].module}</span>
            </Link>
          ) : <span />}
          {idx < work.guide.length - 1 ? (
            <Link href={`/contexto/${work.id}/${work.guide[idx + 1].sectionId}`} className="rounded-2xl border border-line p-4 text-right hover:border-gold-500/50">
              <span className="text-[11px] text-muted">Próximo módulo</span>
              <span className="mt-1 block font-display text-[14px] text-gold-200">{work.guide[idx + 1].module}</span>
            </Link>
          ) : <span />}
        </nav>
      </div>

      <GuideDialog work={work} target={target} onClose={() => setTarget(null)} showReadLink />
    </div>
  );
}
