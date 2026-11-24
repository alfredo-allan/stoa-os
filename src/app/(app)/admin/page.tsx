"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, CloudUpload, Database, ExternalLink, FileText, Headphones, ImageIcon, Library, LogOut, RotateCcw, Sparkles, Trash2, Upload } from "lucide-react";
import type { Section, Work } from "@/content/types";
import { AUTHORS } from "@/content/library";
import { DEFAULT_HEADERS, intToRoman, parseBookText, parseGuideText } from "@/lib/parser";
import { uid, useContent, useEpisodes, useHydrated, useIllustrations, useStudy, useWorks } from "@/lib/store";
import { dataUrlToMedia, deleteMedia, mediaToDataUrl } from "@/lib/media";
import { buildPublication, fingerprint, publishToSite, uploadMedia, useAdminState, useIsAdmin, usePending } from "@/lib/admin";
import { fmtTime, parseChapters } from "@/lib/player";
import { MediaImage, PageHeader } from "@/components/ui";
import { Markdown } from "@/components/Markdown";

const TABS = [
  { id: "texto", label: "Texto do livro", icon: FileText },
  { id: "guia", label: "Guia / Contexto", icon: Sparkles },
  { id: "podcasts", label: "Podcasts", icon: Headphones },
  { id: "ilustracoes", label: "Ilustrações", icon: ImageIcon },
  { id: "obras", label: "Obras", icon: Library },
  { id: "backup", label: "Backup", icon: Database },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function AdminPage() {
  return (
    <Suspense>
      <Admin />
    </Suspense>
  );
}

function Admin() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as TabId) || "texto";
  return (
    <div>
      <PageHeader kicker="Painel do administrador" title="Admin">
        <p className="mt-3 max-w-3xl text-[14.5px] leading-relaxed text-parchment-dim">
          Cole o texto de um livro e ele é formatado automaticamente em parágrafos numerados. Adicione o guia do NotebookLM, os podcasts e as ilustrações. O que você salva aqui vira um rascunho (só você vê); clique em “Publicar no site” para que todos os visitantes vejam.
        </p>
      </PageHeader>
      <PublishBar />
      <div className="sticky top-0 z-20 border-b border-line bg-ink-950/90 backdrop-blur">
        <div className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-2 md:px-8">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => router.replace(`/admin?tab=${t.id}`)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13px] transition ${tab === t.id ? "bg-gold-400/15 text-gold-100" : "text-muted hover:text-parchment"}`}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-10">
        {tab === "texto" && <TextoTab />}
        {tab === "guia" && <GuiaTab />}
        {tab === "podcasts" && <PodcastsTab />}
        {tab === "ilustracoes" && <IlustracoesTab />}
        {tab === "obras" && <ObrasTab />}
        {tab === "backup" && <BackupTab />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- helpers de UI
const input = "w-full rounded-xl border border-line bg-ink-850 px-3.5 py-2.5 text-[14px] text-parchment outline-none placeholder:text-muted focus:border-gold-500";
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] text-parchment-dim">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-muted">{hint}</span>}
    </label>
  );
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`panel rounded-3xl p-5 md:p-6 ${className}`}>{children}</div>;
}
function Flash({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-200">
      <CheckCircle2 className="size-4" /> {msg}
    </p>
  );
}
function useFlash() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg, setMsg] as const;
}
function ErrorNote({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {msg}
    </p>
  );
}

// ---------------------------------------------------------------- PUBLICAR
function PublishBar() {
  const router = useRouter();
  useIsAdmin(); // carrega a configuração (publicação/armazenamento)
  const { publish, devOpen, deployedCommit, refresh, logout } = useAdminState();
  const pending = usePending();
  const content = useContent();
  const { sectionOverrides, guideOverrides, customWorks, episodes, illustrations, hiddenBase, clearDrafts } = content;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pub = useMemo(() => buildPublication(), [sectionOverrides, guideOverrides, customWorks, episodes, illustrations, hiddenBase]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ text: string; url?: string } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const hasChanges = pub.files.length > 0;
  const hydrated = useHydrated((s) => s.ok);
  const [pendingReady, setPendingReady] = useState(false);
  useEffect(() => {
    Promise.resolve(usePending.persist.rehydrate()).then(() => setPendingReady(true));
  }, []);

  // quando o site já roda o commit publicado, os rascunhos viraram conteúdo oficial: limpa.
  useEffect(() => {
    if (!hydrated || !pendingReady || !pending.commit) return;
    if (deployedCommit && deployedCommit === pending.commit) {
      if (pending.fingerprint === fingerprint(buildPublication())) clearDrafts();
      pending.set(null);
      setDone({ text: "A nova versão já está no ar para todos." });
      return;
    }
    const t = setInterval(() => refresh(), 20000);
    return () => clearInterval(t);
  }, [hydrated, pendingReady, pending, deployedCommit, refresh, clearDrafts]);

  const doPublish = async () => {
    setBusy(true);
    setErr(null);
    setDone(null);
    try {
      const message = `Admin: ${pub.summary.join("; ")}`.slice(0, 200);
      const r = await publishToSite(pub, message);
      if (r.mode === "github" && r.commit) {
        pending.set(r.commit, fingerprint(pub));
        setDone({ text: "Publicado! A Vercel está gerando a nova versão do site (leva 1–2 minutos). Seus rascunhos continuam aqui até ela entrar no ar.", url: r.url });
      } else {
        clearDrafts();
        setDone({ text: `Arquivos gravados no projeto: ${r.files.join(", ")}. Faça commit e push quando quiser.` });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao publicar.");
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pt-5 md:px-10">
      <div className="panel rounded-3xl p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <CloudUpload className="size-5 text-gold-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-parchment">
              {hasChanges ? `${pub.summary.length} alteração(ões) em rascunho` : pending.commit ? "Publicação enviada, aguardando a nova versão entrar no ar…" : "Nenhuma alteração pendente"}
            </p>
            {hasChanges && <p className="text-[12px] text-muted">{pub.summary.join(" · ")}</p>}
          </div>
          {hasChanges && (
            <button
              onClick={() => (confirmDiscard ? (clearDrafts(), setConfirmDiscard(false)) : setConfirmDiscard(true))}
              onBlur={() => setConfirmDiscard(false)}
              className="rounded-full px-3 py-2 text-[12.5px] text-muted hover:text-rose-300"
            >
              {confirmDiscard ? "Clique de novo para descartar" : "Descartar rascunhos"}
            </button>
          )}
          <button disabled={!hasChanges || busy || publish === "none"} onClick={doPublish} className="btn-gold rounded-full px-5 py-2 text-sm disabled:opacity-40">
            {busy ? "Publicando…" : "Publicar no site"}
          </button>
          {!devOpen && (
            <button
              onClick={async () => { await logout(); router.replace("/inicio"); }}
              className="grid size-9 place-items-center rounded-full text-muted hover:text-parchment"
              aria-label="Sair do modo admin"
              title="Sair do modo admin"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
        {publish === "none" && (
          <p className="mt-3 text-[12.5px] text-amber-200">Publicação não configurada: defina GITHUB_TOKEN e GITHUB_REPO nas variáveis de ambiente da Vercel.</p>
        )}
        {devOpen && (
          <p className="mt-3 text-[12.5px] text-muted">Modo desenvolvimento: o admin está aberto sem senha e “Publicar” grava direto nos arquivos do projeto{publish === "github" ? " (aqui está configurado para comitar no GitHub)" : ""}.</p>
        )}
        {pub.skipped.length > 0 && (
          <p className="mt-3 text-[12.5px] text-amber-200">Não serão publicados (o arquivo existe só neste navegador): {pub.skipped.join("; ")}. Envie o arquivo de novo para publicar.</p>
        )}
        {pending.commit && !hasChanges && (
          <button onClick={() => { clearDrafts(); pending.set(null); }} className="mt-2 text-[12px] text-muted hover:text-gold-200">
            O site já atualizou? Limpar aviso
          </button>
        )}
        <ErrorNote msg={err} />
        {done && (
          <p className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-200">
            <CheckCircle2 className="size-4" /> {done.text}
            {done.url && (
              <a href={done.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                ver commit <ExternalLink className="size-3.5" />
              </a>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function WorkSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const works = useWorks();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
      {works.map((w) => (
        <option key={w.id} value={w.id}>
          {w.title} — {AUTHORS.find((a) => a.id === w.authorId)?.name ?? w.authorId}
        </option>
      ))}
    </select>
  );
}
function SectionSelect({ work, value, onChange, allowEmpty }: { work?: Work; value: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
      {allowEmpty && <option value="">— nenhuma —</option>}
      {work?.sections.map((s) => (
        <option key={s.id} value={s.id}>
          {s.title}
        </option>
      ))}
    </select>
  );
}
function titleToSection(title: string): { id: string; title: string; number?: number } {
  const m = title.trim().match(/^(?:livro|book)\s+([IVXLC]+|\d+)$/i);
  if (m) {
    const raw = m[1].toUpperCase();
    const n = /^\d+$/.test(raw) ? parseInt(raw, 10) : [...raw].reduce((acc, ch, i, arr) => {
      const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
      return acc + (v[arr[i + 1]] > v[ch] ? -v[ch] : v[ch]);
    }, 0);
    return { id: `livro-${n}`, title: `Livro ${intToRoman(n)}`, number: n };
  }
  const id = title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "texto";
  return { id, title: title.trim() || "Texto" };
}

// ---------------------------------------------------------------- TEXTO
function TextoTab() {
  const works = useWorks();
  const [workId, setWorkId] = useState("meditacoes");
  const [raw, setRaw] = useState("");
  const [headers, setHeaders] = useState(DEFAULT_HEADERS.join(", "));
  const [fallback, setFallback] = useState("Livro V");
  const [msg, setMsg] = useFlash();
  const { sectionOverrides, setSections, resetSection } = useContent();
  const work = works.find((w) => w.id === workId);

  const parsed = useMemo(() => {
    if (!raw.trim()) return null;
    const fb = titleToSection(fallback);
    const r = parseBookText(raw, {
      runningHeaders: headers.split(",").map((h) => h.trim()).filter(Boolean),
      defaultSectionId: fb.id,
      defaultSectionTitle: fb.title,
    });
    r.sections = r.sections.map((s) => (s.kind === "outro" && s.id === fb.id && fb.number ? { ...s, kind: "livro" as const, number: fb.number } : s));
    return r;
  }, [raw, headers, fallback]);

  const overrides = Object.values(sectionOverrides[workId] ?? {});

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card>
        <h3 className="font-display text-lg text-gold-100">Colar texto transcrito</h3>
        <p className="mt-1 text-[13px] text-muted">
          Aceita o texto do jeito que vem: com números de página, cabeçalhos “MEDITAÇÕES / MARCO AURÉLIO”, separadores ***, notas de rodapé, negritos de Markdown ou tudo numa linha só. Ele detecta “Livro N” e os parágrafos “1.”, “2.”… em sequência.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Obra">
            <WorkSelect value={workId} onChange={setWorkId} />
          </Field>
          <Field label="Título se o texto não tiver cabeçalho" hint="Ex.: Livro V, Carta 1, Prefácio">
            <input value={fallback} onChange={(e) => setFallback(e.target.value)} className={input} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Cabeçalhos corridos a remover (separados por vírgula)">
            <input value={headers} onChange={(e) => setHeaders(e.target.value)} className={input} />
          </Field>
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={16}
          placeholder={"Livro 5\n\n1. Ao amanhecer, quando te custar levantar…\n\n2. …"}
          className={`${input} mt-3 font-mono text-[12.5px] leading-relaxed`}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] text-parchment-dim hover:border-gold-400">
            <Upload className="size-4" /> Abrir .txt / .md
            <input type="file" accept=".txt,.md,text/plain" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setRaw(await f.text()); }} />
          </label>
          <button
            disabled={!parsed?.sections.length}
            onClick={() => {
              if (!parsed) return;
              setSections(workId, parsed.sections);
              setMsg(`${parsed.sections.length} seção(ões) salva(s) em ${work?.title} como rascunho. Você já vê no leitor; publique para todos verem.`);
              setRaw("");
            }}
            className="btn-gold ml-auto rounded-full px-5 py-2 text-sm disabled:opacity-40"
          >
            Salvar rascunho
          </button>
        </div>
        <Flash msg={msg} />

        {overrides.length > 0 && (
          <div className="mt-6 border-t border-line pt-4">
            <p className="kicker mb-2">Seções em rascunho (ainda não publicadas)</p>
            {overrides.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-1.5 text-[13.5px]">
                <span className="text-parchment">{s.title}</span>
                <span className="text-muted">{s.paragraphs.filter((p) => p.n !== null).length}§</span>
                <button onClick={() => resetSection(workId, s.id)} className="ml-auto flex items-center gap-1 text-[12px] text-muted hover:text-rose-300">
                  <RotateCcw className="size-3.5" /> Restaurar original
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="lg:max-h-[calc(100dvh-140px)] lg:overflow-y-auto">
        <h3 className="font-display text-lg text-gold-100">Pré-visualização</h3>
        {!parsed && <p className="mt-2 text-[13px] text-muted">Cole um texto para ver como ele será formatado.</p>}
        {parsed && (
          <>
            {parsed.warnings.map((w, i) => (
              <p key={i} className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-100">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {w}
              </p>
            ))}
            {parsed.sections.map((s) => (
              <PreviewSection key={s.id} s={s} exists={!!work?.sections.some((x) => x.id === s.id)} />
            ))}
          </>
        )}
      </Card>
    </div>
  );
}

function PreviewSection({ s, exists }: { s: Section; exists: boolean }) {
  const [all, setAll] = useState(false);
  const shown = all ? s.paragraphs : s.paragraphs.slice(0, 4);
  return (
    <div className="mt-5 rounded-2xl border border-line p-4">
      <div className="flex items-center gap-2">
        <p className="font-display text-gold-200">{s.title}</p>
        <span className="font-mono text-[11px] text-muted">id: {s.id}</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${exists ? "bg-amber-500/15 text-amber-200" : "bg-emerald-500/15 text-emerald-200"}`}>{exists ? "substitui a atual" : "nova seção"}</span>
      </div>
      <p className="mt-1 text-[12px] text-muted">
        {s.paragraphs.filter((p) => p.n !== null).length} parágrafos numerados · {s.paragraphs.length} blocos · {s.footnotes.length} notas de rodapé
      </p>
      <div className="mt-3 space-y-3 font-serif text-[15px] leading-relaxed text-parchment-dim">
        {shown.map((p) => (
          <div key={p.id}>
            {p.n !== null && <span className="mr-2 font-display text-[13px] text-gold-400">§{p.n}</span>}
            {p.blocks.map((b, i) => (
              <p key={i} className={i ? "mt-1.5" : "inline"}>{b.length > 400 && !all ? b.slice(0, 400) + "…" : b}</p>
            ))}
          </div>
        ))}
      </div>
      {s.paragraphs.length > 4 && (
        <button onClick={() => setAll((v) => !v)} className="mt-3 text-[12.5px] text-gold-300 hover:text-gold-100">
          {all ? "Mostrar menos" : `Ver todos os ${s.paragraphs.length}`}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- GUIA
function GuiaTab() {
  const works = useWorks();
  const [workId, setWorkId] = useState("meditacoes");
  const work = works.find((w) => w.id === workId);
  const [sectionId, setSectionId] = useState("");
  const [moduleLabel, setModuleLabel] = useState("Módulo 5");
  const [title, setTitle] = useState("");
  const [raw, setRaw] = useState("");
  const [msg, setMsg] = useFlash();
  const { guideOverrides, setGuide, resetGuide } = useContent();

  useEffect(() => {
    if (work && !work.sections.some((s) => s.id === sectionId)) setSectionId(work.sections.at(-1)?.id ?? "");
  }, [work, sectionId]);

  const parsed = useMemo(() => (raw.trim() && sectionId ? parseGuideText(raw, sectionId, moduleLabel) : null), [raw, sectionId, moduleLabel]);
  const existing = work?.guide.find((g) => g.sectionId === sectionId);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h3 className="font-display text-lg text-gold-100">Publicar módulo do guia (NotebookLM)</h3>
        <p className="mt-1 text-[13px] text-muted">
          Cole o texto completo do módulo. Cada trecho começa com um cabeçalho como <code className="text-gold-300">Livro V, 3-4 — Título</code>, <code className="text-gold-300">Seção 3: Título</code> ou <code className="text-gold-300">§ 3 — Título</code>, seguido da citação e dos campos Reflexão Central, Conceitos Estoicos, Analogia Contemporânea e Aplicação Prática. Nada é cortado: todo o texto vai para o pop-up.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Obra"><WorkSelect value={workId} onChange={setWorkId} /></Field>
          <Field label="Seção do livro"><SectionSelect work={work} value={sectionId} onChange={setSectionId} /></Field>
          <Field label="Rótulo do módulo"><input value={moduleLabel} onChange={(e) => setModuleLabel(e.target.value)} className={input} /></Field>
          <Field label="Título do módulo"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Livro V — …" className={input} /></Field>
        </div>
        {existing && <p className="mt-3 text-[12.5px] text-amber-200">Esta seção já tem um módulo ({existing.module}, {existing.entries.length} análises). Salvar vai substituí-lo.</p>}
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={16} placeholder={"Livro V, 1 — Título da análise\n“Citação do trecho…”\n1. Reflexão Central: …\n2. Desconstrução dos Conceitos Estoicos: …\n3. Analogia Contemporânea: …\n4. Aplicação Prática: …"} className={`${input} mt-3 font-mono text-[12.5px]`} />
        <div className="mt-3 flex items-center gap-2">
          <button
            disabled={!parsed?.module.entries.length}
            onClick={() => {
              if (!parsed) return;
              setGuide(workId, { ...parsed.module, title: title || `${work?.sections.find((s) => s.id === sectionId)?.title ?? ""}` });
              setMsg(`Módulo salvo com ${parsed.module.entries.length} análises (rascunho).`);
              setRaw("");
            }}
            className="btn-gold ml-auto rounded-full px-5 py-2 text-sm disabled:opacity-40"
          >
            Salvar módulo
          </button>
        </div>
        <Flash msg={msg} />
        {Object.keys(guideOverrides[workId] ?? {}).length > 0 && (
          <div className="mt-6 border-t border-line pt-4">
            <p className="kicker mb-2">Módulos em rascunho (ainda não publicados)</p>
            {Object.values(guideOverrides[workId]).map((g) => (
              <div key={g.sectionId} className="flex items-center gap-3 py-1.5 text-[13.5px]">
                <span className="text-parchment">{g.module} · {g.sectionId}</span>
                <button onClick={() => resetGuide(workId, g.sectionId)} className="ml-auto flex items-center gap-1 text-[12px] text-muted hover:text-rose-300">
                  <RotateCcw className="size-3.5" /> Restaurar
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card className="lg:max-h-[calc(100dvh-140px)] lg:overflow-y-auto">
        <h3 className="font-display text-lg text-gold-100">Pré-visualização</h3>
        {!parsed && <p className="mt-2 text-[13px] text-muted">Cole o texto do guia para ver os trechos reconhecidos.</p>}
        {parsed?.warnings.map((w, i) => (
          <p key={i} className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-100">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {w}
          </p>
        ))}
        {parsed?.module.introMd && (
          <div className="mt-4 rounded-2xl border border-line p-4">
            <p className="kicker mb-2">Introdução do módulo</p>
            <Markdown>{parsed.module.introMd}</Markdown>
          </div>
        )}
        {parsed?.module.entries.map((e) => (
          <details key={e.id} className="mt-3 rounded-2xl border border-line p-4">
            <summary className="cursor-pointer">
              <span className="font-display text-gold-300">§{e.from}{e.to !== e.from && `–${e.to}`}</span> <span className="text-parchment">{e.title}</span>
              <span className="ml-2 text-[11.5px] text-muted">{e.fields.map((f) => f.label).join(" · ")}</span>
            </summary>
            {e.quote && <p className="mt-3 font-serif italic text-parchment-dim">{e.quote}</p>}
            {e.fields.map((f) => (
              <div key={f.key} className="mt-3">
                <p className="text-[12px] text-gold-400">{f.label}</p>
                <Markdown>{f.md}</Markdown>
              </div>
            ))}
          </details>
        ))}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- PODCASTS
function PodcastsTab() {
  const works = useWorks();
  const episodes = useEpisodes();
  const { addEpisode, removeEpisode } = useContent();
  const [workId, setWorkId] = useState("meditacoes");
  const work = works.find((w) => w.id === workId);
  const [sectionId, setSectionId] = useState(work?.sections[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [chapters, setChapters] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useFlash();
  const storage = useAdminState((s) => s.storage);
  useEffect(() => {
    if (work && !work.sections.some((s) => s.id === sectionId)) setSectionId(work.sections[0]?.id ?? "");
  }, [work, sectionId]);
  const parsedCh = parseChapters(chapters);

  const save = async () => {
    if (!file && !url.trim()) return;
    setBusy("Enviando…");
    setErr(null);
    let src = url.trim();
    if (file) {
      try {
        src = await uploadMedia(file, "podcasts", (p) => setBusy(`Enviando… ${p}%`));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Falha no envio do áudio.");
        setBusy(null);
        return;
      }
    }
    addEpisode({
      id: uid(),
      workId,
      sectionId,
      title: title.trim() || `${work?.title} — ${work?.sections.find((s) => s.id === sectionId)?.title}`,
      description: description.trim() || undefined,
      src,
      chapters: parsedCh,
      createdAt: new Date().toISOString(),
    });
    setBusy(null);
    setTitle(""); setDescription(""); setUrl(""); setFile(null); setChapters("");
    setMsg("Episódio adicionado ao rascunho. Clique em “Publicar no site” para todos ouvirem.");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h3 className="font-display text-lg text-gold-100">Novo episódio</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Obra"><WorkSelect value={workId} onChange={setWorkId} /></Field>
          <Field label="Livro / seção"><SectionSelect work={work} value={sectionId} onChange={setSectionId} /></Field>
        </div>
        <div className="mt-3 space-y-3">
          <Field label="Título"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Livro IV — A Cidadela Interior" className={input} /></Field>
          <Field label="Descrição (opcional)"><input value={description} onChange={(e) => setDescription(e.target.value)} className={input} /></Field>
          <Field label="Arquivo de áudio" hint={storage === "none" ? "Envio de arquivos não configurado: conecte um Vercel Blob ao projeto ou use uma URL." : storage === "local" ? "MP3/M4A/WAV do NotebookLM. Em desenvolvimento, vai para public/podcasts." : "MP3/M4A/WAV do NotebookLM. Vai para o armazenamento do site (Vercel Blob)."}>
            <input type="file" accept="audio/*" disabled={storage === "none"} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-[13px] text-parchment-dim file:mr-3 file:rounded-full file:border file:border-gold-500/50 file:bg-transparent file:px-4 file:py-2 file:text-gold-200" />
          </Field>
          <Field label="…ou URL pública do áudio" hint="Um link https ou /podcasts/arquivo.m4a (arquivo já presente em public/podcasts).">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… ou /podcasts/livro-4.mp3" className={input} />
          </Field>
          <Field label="Marcadores de tempo (um por linha)" hint="Formato: 00:00 | §1 | Título — o § é opcional e cria o atalho para o parágrafo.">
            <textarea value={chapters} onChange={(e) => setChapters(e.target.value)} rows={6} placeholder={"00:00 | Abertura\n02:15 | §1 | O fogo que converte obstáculos\n06:40 | §3 | A cidadela interior"} className={`${input} font-mono text-[12.5px]`} />
          </Field>
          {parsedCh.length > 0 && <p className="text-[12px] text-muted">{parsedCh.length} marcadores reconhecidos: {parsedCh.map((c) => `${fmtTime(c.t)}${c.paragraph ? ` §${c.paragraph}` : ""}`).join(", ")}</p>}
        </div>
        <div className="mt-4 flex">
          <button disabled={!!busy || (!file && !url.trim())} onClick={save} className="btn-gold ml-auto rounded-full px-5 py-2 text-sm disabled:opacity-40">
            {busy ?? "Adicionar episódio"}
          </button>
        </div>
        <ErrorNote msg={err} />
        <Flash msg={msg} />
      </Card>
      <Card>
        <h3 className="font-display text-lg text-gold-100">Episódios ({episodes.length})</h3>
        {episodes.length === 0 && <p className="mt-2 text-[13px] text-muted">Nenhum episódio ainda.</p>}
        <ul className="mt-3 divide-y divide-line">
          {episodes.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-3">
              <Headphones className="size-4 text-gold-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] text-parchment">{e.title}</p>
                <p className="text-[12px] text-muted">{works.find((w) => w.id === e.workId)?.sections.find((s) => s.id === e.sectionId)?.title} · {e.chapters.length} marcadores · {e.src.startsWith("idb:") ? "arquivo só neste navegador (não será publicado)" : e.src.replace(/^https:\/\/[^/]+\//, "")}</p>
              </div>
              <button onClick={async () => { await deleteMedia(e.src); removeEpisode(e.id); }} className="grid size-9 place-items-center rounded-full text-muted hover:text-rose-300" aria-label="Excluir">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- ILUSTRAÇÕES
function IlustracoesTab() {
  const works = useWorks();
  const items = useIllustrations();
  const { addIllustration, removeIllustration } = useContent();
  const [workId, setWorkId] = useState("meditacoes");
  const work = works.find((w) => w.id === workId);
  const [sectionId, setSectionId] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useFlash();
  const storage = useAdminState((s) => s.storage);

  const save = async () => {
    if (!file && !url.trim()) return;
    setBusy(true);
    setErr(null);
    let src = url.trim();
    if (file) {
      try {
        src = await uploadMedia(file, "ilustracoes");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Falha no envio da imagem.");
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    addIllustration({ id: uid(), workId, sectionId: sectionId || undefined, title: title.trim() || "Ilustração", caption: caption.trim() || undefined, src, createdAt: new Date().toISOString() });
    setTitle(""); setCaption(""); setUrl(""); setFile(null);
    setMsg("Ilustração adicionada ao rascunho" + (sectionId ? " (página inicial e topo da seção)." : " (página inicial).") + " Publique para todos verem.");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h3 className="font-display text-lg text-gold-100">Nova ilustração</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Obra"><WorkSelect value={workId} onChange={setWorkId} /></Field>
          <Field label="Exibir no topo de (opcional)"><SectionSelect work={work} value={sectionId} onChange={setSectionId} allowEmpty /></Field>
        </div>
        <div className="mt-3 space-y-3">
          <Field label="Título"><input value={title} onChange={(e) => setTitle(e.target.value)} className={input} /></Field>
          <Field label="Legenda"><input value={caption} onChange={(e) => setCaption(e.target.value)} className={input} /></Field>
          <Field label="Imagem" hint={storage === "none" ? "Envio de arquivos não configurado: conecte um Vercel Blob ou use uma URL." : undefined}>
            <input type="file" accept="image/*" disabled={storage === "none"} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-[13px] text-parchment-dim file:mr-3 file:rounded-full file:border file:border-gold-500/50 file:bg-transparent file:px-4 file:py-2 file:text-gold-200" />
          </Field>
          <Field label="…ou URL"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/ilustracoes/cidadela.webp" className={input} /></Field>
        </div>
        <div className="mt-4 flex">
          <button disabled={busy || (!file && !url.trim())} onClick={save} className="btn-gold ml-auto rounded-full px-5 py-2 text-sm disabled:opacity-40">{busy ? "Enviando…" : "Adicionar"}</button>
        </div>
        <ErrorNote msg={err} />
        <Flash msg={msg} />
      </Card>
      <Card>
        <h3 className="font-display text-lg text-gold-100">Galeria ({items.length})</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {items.map((i) => (
            <figure key={i.id} className="relative overflow-hidden rounded-2xl border border-line">
              <MediaImage src={i.src} alt={i.title} className="aspect-[4/3] w-full object-cover" />
              <figcaption className="px-3 py-2 text-[12px] text-parchment-dim">{i.title}</figcaption>
              <button onClick={async () => { await deleteMedia(i.src); removeIllustration(i.id); }} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/60 text-parchment hover:text-rose-300" aria-label="Excluir">
                <Trash2 className="size-4" />
              </button>
            </figure>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- OBRAS
function ObrasTab() {
  const works = useWorks();
  const { customWorks, upsertWork, removeWork } = useContent();
  const [authorId, setAuthorId] = useState("seneca");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useFlash();
  const slug = title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h3 className="font-display text-lg text-gold-100">Cadastrar obra</h3>
        <p className="mt-1 text-[13px] text-muted">Cada obra segue a mesma estrutura das Meditações: seções (livros/cartas), parágrafos numerados, guia por seção e podcasts. Depois de cadastrar, cole o texto na aba “Texto do livro”.</p>
        <div className="mt-4 space-y-3">
          <Field label="Autor">
            <select value={authorId} onChange={(e) => setAuthorId(e.target.value)} className={input}>
              {AUTHORS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Título" hint={slug ? `Endereço: /ler/${slug}` : undefined}><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Diatribes" className={input} /></Field>
          <Field label="Subtítulo"><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={input} /></Field>
          <Field label="Descrição"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={input} /></Field>
        </div>
        <div className="mt-4 flex">
          <button
            disabled={!slug}
            onClick={() => {
              upsertWork({ id: slug, title: title.trim(), subtitle: subtitle.trim() || undefined, authorId, description: description.trim(), status: "em-breve", sections: [], guide: [] });
              setMsg(`Obra “${title}” criada. Agora cole o texto dela na aba Texto do livro.`);
              setTitle(""); setSubtitle(""); setDescription("");
            }}
            className="btn-gold ml-auto rounded-full px-5 py-2 text-sm disabled:opacity-40"
          >
            Criar obra
          </button>
        </div>
        <Flash msg={msg} />
      </Card>
      <Card>
        <h3 className="font-display text-lg text-gold-100">Obras</h3>
        <ul className="mt-3 divide-y divide-line">
          {works.map((w) => (
            <li key={w.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] text-parchment">{w.title}</p>
                <p className="text-[12px] text-muted">{AUTHORS.find((a) => a.id === w.authorId)?.name} · {w.sections.length} seções · {w.guide.length} módulos · {w.sections.length ? "disponível" : "em breve"}</p>
              </div>
              {customWorks.some((c) => c.id === w.id) && (
                <button onClick={() => removeWork(w.id)} className="grid size-9 place-items-center rounded-full text-muted hover:text-rose-300" aria-label="Excluir obra">
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- BACKUP
function download(name: string, data: string, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
}

function BackupTab() {
  const works = useWorks();
  const [withMedia, setWithMedia] = useState(true);
  const [msg, setMsg] = useFlash();
  const [busy, setBusy] = useState(false);

  const exportAll = async () => {
    setBusy(true);
    const content = { ...useContent.getState() };
    const study = { ...useStudy.getState() };
    let media: Record<string, string> = {};
    if (withMedia) {
      const srcs = [...content.episodes.map((e) => e.src), ...content.illustrations.map((i) => i.src)].filter((s) => s.startsWith("idb:"));
      for (const s of srcs) {
        const d = await mediaToDataUrl(s);
        if (d) media[s] = d;
      }
    } else media = {};
    const strip = <T extends object>(o: T) => JSON.parse(JSON.stringify(o, (_k, v) => (typeof v === "function" ? undefined : v)));
    download(`stoa-os-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, content: strip(content), study: strip(study), media }));
    setBusy(false);
  };

  const importAll = async (f: File) => {
    setBusy(true);
    try {
      const data = JSON.parse(await f.text());
      const map: Record<string, string> = {};
      for (const [k, v] of Object.entries<string>(data.media ?? {})) map[k] = await dataUrlToMedia(v);
      const fix = (src: string) => map[src] ?? src;
      if (data.content) {
        data.content.episodes = (data.content.episodes ?? []).map((e: { src: string }) => ({ ...e, src: fix(e.src) }));
        data.content.illustrations = (data.content.illustrations ?? []).map((e: { src: string }) => ({ ...e, src: fix(e.src) }));
        useContent.getState().importAll(data.content);
      }
      if (data.study) useStudy.getState().importAll(data.study);
      setMsg("Backup importado.");
    } catch {
      setMsg("Arquivo inválido.");
    }
    setBusy(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h3 className="font-display text-lg text-gold-100">Backup completo</h3>
        <p className="mt-1 text-[13px] text-muted">Leva tudo para outro navegador ou computador: textos colados, guias, podcasts, ilustrações, grifos, notas e marcadores.</p>
        <label className="mt-4 flex items-center gap-2 text-[13.5px] text-parchment-dim">
          <input type="checkbox" checked={withMedia} onChange={(e) => setWithMedia(e.target.checked)} className="accent-[#c9a45c]" /> Incluir arquivos de áudio e imagem (arquivo maior)
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={busy} onClick={exportAll} className="btn-gold rounded-full px-5 py-2 text-sm">Exportar backup</button>
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-5 py-2 text-sm text-parchment-dim hover:border-gold-400">
            <Upload className="size-4" /> Importar backup
            <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importAll(e.target.files[0])} />
          </label>
        </div>
        <Flash msg={msg} />
      </Card>
      <Card>
        <h3 className="font-display text-lg text-gold-100">Exportar arquivos (manual)</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          O normal é usar o botão “Publicar no site” no topo. Se preferir fazer à mão, exporte a obra e substitua <code className="text-gold-300">content/obras/&lt;obra&gt;/obra.json</code> no repositório (e <code className="text-gold-300">content/podcasts.json</code> para os episódios).
        </p>
        <ul className="mt-4 divide-y divide-line">
          {works.filter((w) => w.sections.length).map((w) => (
            <li key={w.id} className="flex items-center gap-3 py-2.5">
              <span className="flex-1 text-[14px] text-parchment">{w.title}</span>
              <button
                onClick={() => {
                  const { id, title, subtitle, authorId, description, sections, guide } = w;
                  download(`${id}.obra.json`, JSON.stringify({ id, title, subtitle, authorId, description, status: "disponivel", sections, guide }, null, 1));
                }}
                className="rounded-full border border-line px-3 py-1.5 text-[12.5px] text-gold-300 hover:border-gold-400"
              >
                Exportar obra.json
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={() => {
            const { episodes, illustrations } = useContent.getState();
            download("podcasts.json", JSON.stringify(episodes.filter((e) => !e.src.startsWith("idb:")), null, 1));
            download("ilustracoes.json", JSON.stringify(illustrations.filter((e) => !e.src.startsWith("idb:")), null, 1));
          }}
          className="mt-3 rounded-full border border-line px-3 py-1.5 text-[12.5px] text-gold-300 hover:border-gold-400"
        >
          Exportar podcasts.json e ilustracoes.json (somente itens com URL)
        </button>
      </Card>
    </div>
  );
}
