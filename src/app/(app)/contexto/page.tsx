"use client";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useWorks } from "@/lib/store";
import { authorOf } from "@/content/library";
import { PageHeader } from "@/components/ui";

export default function Contexto() {
  const works = useWorks().filter((w) => w.sections.length);
  return (
    <div>
      <PageHeader kicker="Contexto do livro" title="Guia de estudos">
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-parchment-dim">
          Análises exaustivas geradas no NotebookLM, organizadas por módulo. No leitor, toque em <span className="text-gold-200">“Contexto”</span> em qualquer parágrafo para abrir só o trecho correspondente.
        </p>
      </PageHeader>
      <div className="mx-auto max-w-6xl space-y-10 px-5 py-8 md:px-10">
        {works.map((w) => (
          <section key={w.id}>
            <p className="kicker">{authorOf(w).name}</p>
            <h2 className="mt-1 font-display text-xl text-gold-100">{w.title}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {w.sections.map((s) => {
                const g = w.guide.find((x) => x.sectionId === s.id);
                return g ? (
                  <Link key={s.id} href={`/contexto/${w.id}/${s.id}`} className="panel group flex items-start gap-4 rounded-2xl p-5 transition hover:border-gold-500/50">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full border border-gold-500/40 bg-gold-400/10 text-gold-300">
                      <Sparkles className="size-5" strokeWidth={1.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="kicker">{g.module} · {s.title}</span>
                      <span className="mt-1 block font-display text-[16px] leading-snug text-gold-100">{g.title}</span>
                      <span className="mt-2 block text-[12.5px] text-muted">{g.entries.length} {g.entries.length === 1 ? "análise" : "análises"}</span>
                    </span>
                    <ArrowRight className="mt-1 size-4 text-gold-500 transition group-hover:translate-x-1" />
                  </Link>
                ) : (
                  <div key={s.id} className="flex items-center gap-4 rounded-2xl border border-dashed border-line p-5 opacity-60">
                    <span className="grid size-11 place-items-center rounded-full border border-line text-muted">
                      <Sparkles className="size-5" strokeWidth={1.2} />
                    </span>
                    <span>
                      <span className="block font-display text-[15px] text-parchment-dim">{s.title}</span>
                      <span className="text-[12.5px] text-muted">Guia ainda não publicado</span>
                    </span>
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
