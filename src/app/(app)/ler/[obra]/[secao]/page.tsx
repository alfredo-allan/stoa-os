"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Reader } from "@/components/reader/Reader";
import { useWork } from "@/lib/store";

export default function LerSecao() {
  const { obra, secao } = useParams<{ obra: string; secao: string }>();
  const work = useWork(obra);
  const section = work?.sections.find((s) => s.id === secao);
  if (!work || !section)
    return (
      <div className="grid min-h-[70dvh] place-items-center p-8 text-center">
        <div>
          <p className="font-display text-xl text-gold-100">Seção não encontrada</p>
          <p className="mt-2 text-sm text-muted">Confira o endereço ou volte ao sumário.</p>
          <Link href="/inicio" className="btn-gold mt-6 inline-block rounded-full px-5 py-2 text-sm">Voltar ao início</Link>
        </div>
      </div>
    );
  return <Reader key={section.id} work={work} section={section} />;
}
