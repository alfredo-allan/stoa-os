import Image from 'next/image'
import Link from 'next/link'
import { SmokeCanvas } from '@/components/SmokeCanvas'
import { BASE_WORKS } from '@/content/library'

export default function Landing() {
  const med = BASE_WORKS[0]
  const rows = med.sections.map((s, i) => ({
    i: i + 1,
    t: s.title.toUpperCase(),
    p: s.paragraphs.filter((p) => p.n !== null).length || s.paragraphs.length,
    g: med.guide.some((g) => g.sectionId === s.id) ? 'GUIA' : '—'
  }))

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-ink-950 text-parchment">
      {/* fundo */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(120,88,40,.28),rgba(20,14,8,.4)_38%,#050404_75%)]" />
      <div className="hud-grid absolute inset-0 opacity-70" />
      {/* abertura: véu escuro que se dissolve enquanto a luz revela a cena */}
      <div className="intro-veil pointer-events-none absolute inset-0 bg-[#030202]" />

      {/* linhas HUD */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-0 right-0 top-[40%] h-px origin-center bg-gradient-to-r from-transparent via-gold-400/50 to-transparent md:top-[38%]"
          style={{ animation: 'ray 2.4s ease 1s both' }}
        />
        <div
          className="absolute bottom-0 left-1/2 top-0 w-px origin-top bg-gradient-to-b from-transparent via-gold-400/40 to-transparent"
          style={{ animation: 'rayv 2.4s ease .6s both' }}
        />
        <div className="absolute left-1/2 top-[40%] hidden h-[140vmax] w-px -translate-x-1/2 -translate-y-1/2 rotate-45 bg-gradient-to-b from-transparent via-gold-400/15 to-transparent md:top-[38%] md:block" />
        <div className="absolute left-1/2 top-[40%] hidden h-[140vmax] w-px -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-gradient-to-b from-transparent via-gold-400/15 to-transparent md:top-[38%] md:block" />
      </div>

      {/* cantos */}
      <header
        className="anim-fade absolute inset-x-0 top-0 z-20 flex items-start justify-between p-5 md:p-8"
        style={{ animationDelay: '2.2s' }}>
        <span className="font-sans text-[13px] tracking-[0.18em] text-gold-300 md:text-[15px]">MEDITAÇÕES</span>
        <span className="text-right">
          <span className="block font-sans text-[13px] tracking-[0.16em] text-gold-300 md:text-[15px]">MARCUS AURELIUS</span>
          <span className="block font-mono text-[10px] tracking-[0.2em] text-gold-500 md:text-[11px]">PHILOSOPHIA</span>
        </span>
      </header>

      {/* dados laterais */}
      <div
        className="anim-fade pointer-events-none absolute left-6 top-[34%] z-10 hidden font-mono text-[10.5px] leading-5 text-gold-500/80 lg:block xl:left-10"
        style={{ animationDelay: '2.8s' }}>
        <div className="mb-3 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-gold-400" /> 121 d.C. · ROMA
        </div>
        <div>LAT / 41.8902</div>
        <div>LON / 12.4922</div>
        <div className="mt-4 text-gold-600">CARNUNTUM · 48.11 / 16.86</div>
        <div className="text-gold-600">TA EIS HEAUTON</div>
      </div>
      <div
        className="anim-fade pointer-events-none absolute right-6 top-[28%] z-10 hidden font-mono text-[10.5px] leading-5 text-gold-500/80 lg:block xl:right-10"
        style={{ animationDelay: '3s' }}>
        <div className="mb-2 flex gap-6 text-gold-600">
          <span className="w-28">SECTIO</span>
          <span className="w-8">§</span>
          <span>NOTA</span>
        </div>
        {rows.map((r) => (
          <div key={r.i} className="flex gap-6">
            <span className="w-28">
              {r.i} {r.t}
            </span>
            <span className="w-8">{r.p}</span>
            <span>{r.g}</span>
          </div>
        ))}
      </div>

      {/* medalhão */}
      <div className="absolute left-1/2 top-[40%] z-0 -translate-x-1/2 -translate-y-1/2 md:top-[38%]">
        <div className="relative size-[min(72vw,52vh)] md:size-[min(40vw,44vh)]">
          <div className="anim-pulse absolute -inset-[18%] rounded-full bg-[radial-gradient(circle,rgba(217,180,106,.30),rgba(217,180,106,0)_62%)]" />
          <svg
            viewBox="0 0 100 100"
            className="absolute -inset-[7%] size-[114%] animate-[spin-slow_90s_linear_infinite] opacity-60"
            aria-hidden>
            <circle cx="50" cy="50" r="49" fill="none" stroke="rgba(217,180,106,.35)" strokeWidth=".15" strokeDasharray=".6 1.6" />
            <circle cx="50" cy="50" r="47.6" fill="none" stroke="rgba(217,180,106,.18)" strokeWidth=".1" />
          </svg>
          {/* abertura: ponto de luz que se expande e anel dourado sendo traçado */}
          <div className="intro-core pointer-events-none absolute left-1/2 top-1/2 size-[140%] rounded-full" aria-hidden />
          {/* halo dourado: gradiente radial (substitui o drop-shadow, que era cortado por uma caixa e gerava a sombra quadrada) */}
          <div className="medal-halo pointer-events-none absolute -inset-[30%] rounded-full" aria-hidden />
          {/* margem interna: o medalhão flutua sem encostar no limite da máscara */}
          <div className="anim-medal absolute -inset-[12%] p-[12%]">
            <div className="anim-float relative size-full">
              <Image
                src="/img/medalhao-1100.webp"
                alt="Medalhão com o busto de Marco Aurélio"
                fill
                priority
                sizes="(max-width: 768px) 72vw, 44vw"
                className="rounded-full object-contain"
              />
              {/* abertura: reflexo de luz que atravessa o metal uma vez */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full" aria-hidden>
                <div className="intro-sheen absolute -inset-y-[10%] left-0 w-[45%]" />
              </div>
            </div>
          </div>
          <svg viewBox="0 0 100 100" className="intro-ring pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
            <circle
              cx="50"
              cy="50"
              r="49.4"
              fill="none"
              stroke="url(#introRingGrad)"
              strokeWidth=".7"
              strokeLinecap="round"
              pathLength={100}
            />
            <defs>
              <linearGradient id="introRingGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff3d1" />
                <stop offset=".5" stopColor="#e2b862" />
                <stop offset="1" stopColor="#fff3d1" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* fumaça */}
      <SmokeCanvas className="absolute inset-0 z-10" />

      {/* título */}
      <section className="absolute inset-x-0 bottom-[10%] z-20 flex flex-col items-center px-6 text-center md:bottom-[11%]">
        <h1
          className="anim-up gold-text gold-glow font-display text-[13vw] font-medium leading-none tracking-[0.02em] md:text-[min(7.6vw,112px)]"
          style={{ animationDelay: '2s' }}>
          MEDITAÇÕES
        </h1>
        <p
          className="anim-up mt-4 font-sans text-[12px] tracking-[0.28em] text-gold-200/90 md:text-[15px]"
          style={{ animationDelay: '2.6s' }}>
          IMERSÃO AO ESTOICISMO.
        </p>
        <Link
          href="/inicio"
          className="anim-up btn-gold group relative mt-8 rounded-[4px] px-9 py-3.5 font-sans text-[13px] tracking-[0.22em] outline outline-1 outline-offset-[4px] outline-gold-600/40 md:text-[15px]"
          style={{ animationDelay: '3.2s' }}>
          INICIAR JORNADA
        </Link>
      </section>

      {/* rodapé HUD */}
      <footer
        className="anim-fade absolute inset-x-0 bottom-0 z-20 hidden items-end justify-between p-6 font-mono text-[10.5px] tracking-[0.14em] text-gold-600 md:flex"
        style={{ animationDelay: '3.4s' }}>
        <span>ΤΑ ΕΙΣ ΕΑΥΤΟΝ</span>
        <span className="flex flex-col items-center gap-2">
          <span>
            <span className="text-gold-400">•</span> STOA / 001
          </span>
          <span className="block h-px w-64 bg-gold-700/60">
            <span className="block h-full w-1/3 bg-gold-400/80" />
          </span>
        </span>
        <span>SÊNECA · EPICTETO · MARCO AURÉLIO</span>
      </footer>
      <div className="absolute inset-0 z-[5] bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,.75)_100%)]" />
    </main>
  )
}
