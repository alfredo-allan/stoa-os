"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { create } from "zustand";
import { BookOpen, Headphones, Home, Landmark, NotebookPen, ScrollText, Settings2 } from "lucide-react";
import { MiniPlayer } from "./MiniPlayer";
import { usePlayer } from "@/lib/player";
import { useStudy } from "@/lib/store";
import { useIsAdmin } from "@/lib/admin-session";

export const useUI = create<{ immersive: boolean }>(() => ({ immersive: false }));

function useReadHref() {
  const progress = useStudy((s) => s.progress["meditacoes"]);
  return progress ? `/ler/meditacoes/${progress.sectionId}` : "/ler/meditacoes";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const readHref = useReadHref();
  const immersive = useUI((s) => s.immersive);
  const hasEpisode = usePlayer((s) => !!s.episode);
  const isAdmin = useIsAdmin();

  const primary = [
    { href: "/inicio", label: "Início", icon: Home, match: (p: string) => p.startsWith("/inicio") },
    { href: readHref, label: "Livro", icon: BookOpen, match: (p: string) => p.startsWith("/ler") },
    { href: "/contexto", label: "Contexto", icon: ScrollText, match: (p: string) => p.startsWith("/contexto") },
    { href: "/podcasts", label: "Podcasts", icon: Headphones, match: (p: string) => p.startsWith("/podcasts") },
  ];
  const secondary = [
    { href: "/caderno", label: "Caderno", icon: NotebookPen, match: (p: string) => p.startsWith("/caderno") },
    // a aba Admin só aparece para o administrador logado
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Settings2, match: (p: string) => p.startsWith("/admin") }] : []),
  ];

  return (
    <div
      className="min-h-dvh overflow-x-clip"
      style={{ ["--player-h" as string]: hasEpisode ? "68px" : "0px" }}
    >
      {/* Trilho lateral (tablet/desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[84px] flex-col items-center border-r border-line bg-ink-950/90 py-5 backdrop-blur md:flex">
        <Link href="/" className="group mb-6 block" title="Abertura">
          <Image src="/img/medalhao-256.png" alt="Stoa OS" width={44} height={44} className="rounded-full opacity-90 transition group-hover:opacity-100 group-hover:drop-shadow-[0_0_12px_rgba(217,180,106,.5)]" />
        </Link>
        <nav className="flex flex-1 flex-col items-center gap-1">
          {primary.map((it) => (
            <RailItem key={it.label} {...it} active={it.match(path)} />
          ))}
          <div className="my-3 h-px w-8 bg-line" />
          {secondary.map((it) => (
            <RailItem key={it.label} {...it} active={it.match(path)} />
          ))}
        </nav>
        {/* acesso discreto ao admin: o pequeno templo no rodapé do trilho */}
        <Link href={isAdmin ? "/admin" : "/entrar"} aria-label="Área restrita" className="p-1 text-gold-700 transition hover:text-gold-400">
          <Landmark className="size-4" />
        </Link>
      </aside>

      <main className="md:pl-[84px]">
        <div className="pb-[calc(var(--nav-h)+var(--player-h)+env(safe-area-inset-bottom))] md:pb-[calc(var(--player-h)+8px)]">{children}</div>
      </main>

      <MiniPlayer />

      {/* Navegação inferior (celular) */}
      <nav
        className={`safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink-950/92 backdrop-blur-xl transition-transform duration-300 md:hidden ${immersive ? "translate-y-full" : ""}`}
      >
        <div className="grid h-[var(--nav-h)] grid-cols-4">
          {primary.map((it) => {
            const active = it.match(path);
            const Icon = it.icon;
            return (
              <Link key={it.label} href={it.href} className="relative flex flex-col items-center justify-center gap-1">
                {active && <span className="absolute top-0 h-[2px] w-10 rounded-full bg-gold-300 shadow-[0_0_12px_rgba(217,180,106,.8)]" />}
                <Icon className={`size-[22px] ${active ? "text-gold-200" : "text-muted"}`} strokeWidth={1.6} />
                <span className={`text-[10.5px] tracking-wide ${active ? "text-gold-200" : "text-muted"}`}>{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function RailItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Home; active: boolean }) {
  return (
    <Link
      href={href}
      className={`group relative flex w-[68px] flex-col items-center gap-1 rounded-xl py-2.5 transition ${active ? "bg-gold-400/10 text-gold-200" : "text-muted hover:bg-white/[.03] hover:text-parchment"}`}
    >
      {active && <span className="absolute -left-2 top-1/2 h-7 w-[2px] -translate-y-1/2 rounded-full bg-gold-300 shadow-[0_0_10px_rgba(217,180,106,.8)]" />}
      <Icon className="size-[21px]" strokeWidth={1.5} />
      <span className="text-[10px] tracking-wide">{label}</span>
    </Link>
  );
}
