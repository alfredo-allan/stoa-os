"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useHydrated, useStudy, useWork } from "@/lib/store";

export default function LerObra() {
  const { obra } = useParams<{ obra: string }>();
  const router = useRouter();
  const work = useWork(obra);
  const hydrated = useHydrated((s) => s.ok);
  const progress = useStudy((s) => s.progress[obra]);
  useEffect(() => {
    if (!hydrated || !work) return;
    const target = progress?.sectionId && work.sections.some((s) => s.id === progress.sectionId) ? progress.sectionId : work.sections[0]?.id;
    if (target) router.replace(`/ler/${work.id}/${target}`);
  }, [hydrated, work, progress, router]);
  return <div className="grid min-h-[60dvh] place-items-center font-mono text-xs tracking-[0.3em] text-gold-600">ABRINDO…</div>;
}
