"use client";
import Image from "next/image";
import { useMediaUrl } from "@/lib/media";

export function PageHeader({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="relative overflow-hidden border-b border-line px-5 pb-8 pt-10 md:px-10 md:pt-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(201,164,92,.12),transparent_60%)]" />
      <div className="relative mx-auto max-w-6xl">
        <p className="kicker">{kicker}</p>
        <h1 className="gold-text mt-2 font-display text-3xl md:text-[2.6rem]">{title}</h1>
        {children}
      </div>
    </header>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="font-display text-[17px] tracking-wide text-gold-100">{children}</h2>
      {action}
    </div>
  );
}

export function MediaImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const url = useMediaUrl(src);
  if (!url) return <div className={`animate-pulse bg-ink-800 ${className}`} />;
  return <Image src={url} alt={alt} width={800} height={600} unoptimized className={className} />;
}
