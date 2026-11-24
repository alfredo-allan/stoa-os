// Parser do texto transcrito: recebe o texto "cru" colado (de PDF, OCR, Google Docs,
// Markdown...) e devolve seções e parágrafos numerados prontos para o leitor.
//
// O que ele limpa/trata:
//  - números de página soltos, cabeçalhos corridos (MEDITAÇÕES / MARCO AURÉLIO), separadores *** e ---
//  - escapes de Markdown (1\.), negritos **...**, frases de assistente ("Aqui está a transcrição...")
//  - notas de rodapé (bloco após ____ ) e marcadores ¹ ² ³ no texto
//  - parágrafos quebrados pela virada de página (inclusive palavras hifenizadas "na- / turais")
//  - textos "achatados" em uma única linha: detecta "Livro 2" e "1. ", "2. "... em sequência
//  - "Livro 11. Herdei" (título grudado no §1) vira Livro 1 + §1

import type { Footnote, Paragraph, Section, SectionKind } from "../content/types";

export interface ParseOptions {
  /** cabeçalhos corridos a remover (comparação exata por linha, sem caixa) */
  runningHeaders?: string[];
  /** título da seção quando o texto não traz cabeçalho ("Livro 5"...) */
  defaultSectionTitle?: string;
  defaultSectionId?: string;
  /** blocos maiores que isso (em caracteres) e sem quebras são divididos por frases */
  splitLongAt?: number;
}

export interface ParseResult {
  sections: Section[];
  warnings: string[];
}

export const DEFAULT_HEADERS = ["MEDITAÇÕES", "MARCO AURÉLIO", "MARCUS AURELIUS", "MEDITACOES", "MARCO AURELIO"];

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
export function romanToInt(s: string): number {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]];
    const next = ROMAN[s[i + 1]];
    total += next && next > v ? -v : v;
  }
  return total;
}
export function intToRoman(n: number): string {
  const map: [number, string][] = [
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [v, r] of map) while (n >= v) { out += r; n -= v; }
  return out;
}

const TERMINAL = /[.!?…:;”"»)\]]$/;
const UPPER_START = /^[“"«(—–\-¿¡A-ZÀ-ÖØ-Þ]/;
const LOWER_START = /^[a-zà-öø-ÿ]/;

function cleanInline(s: string): string {
  return s
    .replace(/ /g, " ")
    .replace(/\\([.\-*_#[\]()!>+])/g, "$1")
    .replace(/\*\*|__/g, "")
    .replace(/(^|\s)\*(\S[^*]*\S)\*(?=\s|$|[.,;:!?])/g, "$1$2")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function isAssistantChatter(line: string): boolean {
  return /^(aqui est[áa]|segue (abaixo )?a|claro[,!]|perfeito[,!]|abaixo est[áa])/i.test(line) && /transcri|texto|livro/i.test(line);
}

interface RawBlock {
  text: string;
}

function preprocess(raw: string, headers: string[], footnotes: Footnote[]): RawBlock[] {
  const H = new Set(headers.map((h) => h.trim().toUpperCase()));
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const kept: string[] = [];
  let footMode = false;
  for (const original of lines) {
    let line = original.replace(/^#{1,6}\s+/, "").trim();
    if (/^_{4,}$/.test(line)) { footMode = true; continue; }
    if (/^(\*\s*){3,}$|^-{3,}$|^={3,}$|^•{3,}$/.test(line)) { footMode = false; kept.push(""); continue; }
    const bare = cleanInline(line);
    if (/^\d{1,4}$/.test(bare)) { footMode = false; kept.push(""); continue; } // número de página
    if (H.has(bare.toUpperCase())) { kept.push(""); continue; }
    if (isAssistantChatter(bare)) continue;
    if (footMode) {
      if (!bare) continue;
      const m = bare.match(/^([0-9]{1,2}|[¹²³⁴⁵⁶⁷⁸⁹*†])[.)]?\s+(.+)$/);
      if (m) footnotes.push({ mark: toPlainDigit(m[1]), text: m[2] });
      else if (footnotes.length) footnotes[footnotes.length - 1].text += " " + bare;
      continue;
    }
    line = bare;
    kept.push(line);
  }

  // Agrupa em blocos. Se quase não há linhas vazias, cada linha é um bloco.
  const nonEmpty = kept.filter((l) => l).length;
  const empties = kept.length - nonEmpty;
  const linePerBlock = nonEmpty > 6 && empties < nonEmpty * 0.15;
  const blocks: RawBlock[] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.length) blocks.push({ text: joinLines(cur) });
    cur = [];
  };
  for (const l of kept) {
    if (!l) { flush(); continue; }
    if (linePerBlock) { cur.push(l); flush(); continue; }
    cur.push(l);
  }
  flush();

  // Junta blocos separados por virada de página.
  const merged: RawBlock[] = [];
  for (const b of blocks) {
    const prev = merged[merged.length - 1];
    if (prev && LOWER_START.test(b.text)) {
      if (/[A-Za-zÀ-ÿ]-$/.test(prev.text)) { prev.text = prev.text.slice(0, -1) + b.text; continue; }
      if (!TERMINAL.test(prev.text)) { prev.text = prev.text + " " + b.text; continue; }
    }
    merged.push({ ...b });
  }
  return merged;
}

function joinLines(lines: string[]): string {
  let out = "";
  for (const l of lines) {
    if (!out) { out = l; continue; }
    if (/[A-Za-zÀ-ÿ]-$/.test(out) && LOWER_START.test(l)) out = out.slice(0, -1) + l;
    else out += " " + l;
  }
  return out;
}

const SUP: Record<string, string> = { "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
function toPlainDigit(s: string) {
  return SUP[s] ?? s;
}

type Token =
  | { type: "heading"; kind: SectionKind; title: string; number?: number }
  | { type: "num"; n: number }
  | { type: "text"; text: string }
  | { type: "break" };

const NAMED_HEADINGS: [RegExp, SectionKind, string][] = [
  [/^(PREF[ÁA]CIO|Pref[áa]cio)(?=\s|[A-ZÀ-Ö]|$)/, "prefacio", "Prefácio"],
  [/^(INTRODU[ÇC][ÃA]O|Introdu[çc][ãa]o)(?=\s|[A-ZÀ-Ö]|$)/, "introducao", "Introdução"],
  [/^(APRESENTA[ÇC][ÃA]O|Apresenta[çc][ãa]o)(?=\s|[A-ZÀ-Ö]|$)/, "introducao", "Apresentação"],
];

/** Varre cada bloco à procura de títulos de livro e números de parágrafo em sequência. */
function tokenize(blocks: RawBlock[]): Token[] {
  const tokens: Token[] = [];
  let currentBook: number | null = null;
  let lastN: number | null = null;

  for (const b of blocks) {
    tokens.push({ type: "break" });
    let rest = b.text;
    let atStart = true;

    // títulos nomeados no início do bloco
    for (const [re, kind, title] of NAMED_HEADINGS) {
      const m = rest.match(re);
      if (m) {
        tokens.push({ type: "heading", kind, title });
        lastN = null;
        rest = rest.slice(m[0].length).trim();
        break;
      }
    }

    // procura marcadores dentro do bloco
    const re = /(?:^|(?<=[.!?…"”»)]\s{1,3})|(?<=^\s*))(?:(LIVRO|Livro)\s+([IVXLC]+|\d+)(?=[\s.:—–-]|$)|(\d{1,3})\.\s+(?=\S))/g;
    let cursor = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rest))) {
      const before = rest.slice(cursor, m.index);
      if (m[1]) {
        // Livro N
        const raw = m[2];
        let bookN: number;
        let inlineFirst: number | null = null;
        let consumed = m[0].length;
        if (/^[IVXLC]+$/.test(raw)) bookN = romanToInt(raw);
        else {
          bookN = parseInt(raw, 10);
          const after = rest.slice(m.index + m[0].length);
          // "Livro 11. Herdei" => Livro 1 + §1 ; "Livro 21. Comece" => Livro 2 + §1
          if (/^\.\s/.test(after) && raw.length > 1 && raw.endsWith("1")) {
            const prefix = parseInt(raw.slice(0, -1), 10);
            if (currentBook === null || prefix === currentBook + 1) {
              bookN = prefix;
              inlineFirst = 1;
              consumed += 1; // consome o ponto
            }
          }
        }
        const expected: number = currentBook === null ? bookN : currentBook + 1;
        if (bookN !== expected) continue; // menção a outro livro dentro do texto
        if (before.trim()) tokens.push({ type: "text", text: before.trim() });
        tokens.push({ type: "heading", kind: "livro", title: `Livro ${intToRoman(bookN)}`, number: bookN });
        currentBook = bookN;
        lastN = null;
        if (inlineFirst) { tokens.push({ type: "num", n: 1 }); lastN = 1; }
        cursor = m.index + consumed;
        re.lastIndex = cursor;
        atStart = false;
        continue;
      }
      const n = parseInt(m[3], 10);
      const expected = lastN === null ? 1 : lastN + 1;
      const startOfBlock = rest.slice(0, m.index).trim() === "";
      if (n !== expected) continue;
      if (!startOfBlock && !atStart && !/[.!?…"”»)]\s*$/.test(rest.slice(0, m.index))) continue;
      const after = rest.slice(m.index + m[0].length);
      if (!UPPER_START.test(after)) continue;
      if (before.trim()) tokens.push({ type: "text", text: before.trim() });
      tokens.push({ type: "num", n });
      lastN = n;
      cursor = m.index + m[0].length;
      atStart = false;
    }
    const tail = rest.slice(cursor).trim();
    if (tail) tokens.push({ type: "text", text: tail });
  }
  return tokens;
}

function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const sentences = text.match(/[^.!?…]+(?:[.!?…]+["”»)]?|$)\s*/g) ?? [text];
  const target = Math.max(500, Math.round(max / 2));
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur.length + s.length > target && cur.length > target * 0.6) {
      out.push(cur.trim());
      cur = "";
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function slugForHeading(kind: SectionKind, title: string, number?: number) {
  if (kind === "livro" && number) return `livro-${number}`;
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const KIND_RANK: Record<string, number> = { prefacio: 0, introducao: 1, livro: 2, carta: 2, capitulo: 2, outro: 3 };
export function sectionRank(s: { kind: string; number?: number }) {
  return (KIND_RANK[s.kind] ?? 3) * 1000 + (s.number ?? 0);
}

export function parseBookText(raw: string, opts: ParseOptions = {}): ParseResult {
  const warnings: string[] = [];
  const footnotes: Footnote[] = [];
  const blocks = preprocess(raw, opts.runningHeaders ?? DEFAULT_HEADERS, footnotes);
  const tokens = tokenize(blocks);
  const maxLen = opts.splitLongAt ?? 1400;

  const sections: Section[] = [];
  let sec: Section | null = null;
  let para: Paragraph | null = null;
  let introIdx = 0;
  let pendingBreak = true;

  const ensureSection = () => {
    if (!sec) {
      const id = opts.defaultSectionId ?? "texto";
      sec = { id, title: opts.defaultSectionTitle ?? "Texto", kind: "outro", paragraphs: [], footnotes: [] };
      sections.push(sec);
    }
    return sec;
  };

  for (const t of tokens) {
    if (t.type === "break") { pendingBreak = true; continue; }
    if (t.type === "heading") {
      const id = slugForHeading(t.kind, t.title, t.number);
      sec = { id, title: t.title, kind: t.kind, number: t.number, paragraphs: [], footnotes: [] };
      sections.push(sec);
      para = null;
      introIdx = 0;
      continue;
    }
    const s = ensureSection();
    if (t.type === "num") {
      para = { id: `${s.id}-p${t.n}`, n: t.n, blocks: [] };
      s.paragraphs.push(para);
      pendingBreak = false;
      continue;
    }
    // texto
    const pieces = splitLong(t.text, maxLen);
    if (!para || (para.n === null && pendingBreak)) {
      // parágrafo sem número (texto corrido)
      for (const piece of pieces) {
        para = { id: `${s.id}-i${introIdx++}`, n: null, blocks: [piece] };
        s.paragraphs.push(para);
      }
    } else if (para.blocks.length && !pendingBreak) {
      para.blocks[para.blocks.length - 1] += " " + pieces[0];
      para.blocks.push(...pieces.slice(1));
    } else {
      para.blocks.push(...pieces);
    }
    pendingBreak = false;
  }

  // distribui notas de rodapé para as seções onde o marcador aparece
  for (const f of footnotes) {
    const sup = Object.entries(SUP).find(([, d]) => d === f.mark)?.[0];
    const target =
      sections.find((s) => s.paragraphs.some((p) => p.blocks.some((b) => (sup && b.includes(sup)) || b.includes(`[${f.mark}]`)))) ??
      sections[sections.length - 1];
    if (target) target.footnotes.push(f);
  }

  for (const s of sections) {
    const nums = s.paragraphs.filter((p) => p.n !== null).length;
    if (s.kind === "livro" && nums === 0) warnings.push(`${s.title}: nenhum parágrafo numerado encontrado (verifique se o texto tem "1.", "2."...).`);
    const long = s.paragraphs.filter((p) => p.n !== null && p.blocks.join(" ").length > 6000);
    if (long.length) warnings.push(`${s.title}: §${long.map((p) => p.n).join(", §")} ficaram muito longos; pode haver numeração faltando no texto.`);
  }
  if (!sections.length) warnings.push("Nenhum texto reconhecido.");
  sections.sort((a, b) => sectionRank(a) - sectionRank(b));
  return { sections, warnings };
}

// ---------------------------------------------------------------------------
// Parser do guia (texto do NotebookLM colado no admin)
// Reconhece cabeçalhos como "Livro IV, 5-6 — Título", "Seção 3: Título", "§ 12 — Título"
// e os campos Reflexão Central / Conceitos Estoicos / Analogia Contemporânea / Aplicação Prática.
// Nada é resumido: todo texto entre um cabeçalho e o próximo vai para o trecho.

import type { GuideEntry, GuideField, GuideModule } from "../content/types";

const FIELD_DEFS: { key: string; re: RegExp }[] = [
  { key: "reflexao", re: /^(?:#+\s*)?(?:\*\*)?(?:\d\.\s*)?(Reflex[ãa]o Central[^:\n]*?)(?:\*\*)?\s*:?\s*(?:\*\*)?\s*/i },
  { key: "conceitos", re: /^(?:#+\s*)?(?:\*\*)?(?:\d\.\s*)?((?:Desconstru[çc][ãa]o (?:dos Conceitos )?Estoic[ao]s?|Conceitos Estoicos)[^:\n]*?)(?:\*\*)?\s*:?\s*(?:\*\*)?\s*/i },
  { key: "analogia", re: /^(?:#+\s*)?(?:\*\*)?(?:\d\.\s*)?(Analogias?(?: Contempor[âa]neas?)?)(?:\*\*)?\s*:?\s*(?:\*\*)?\s*/i },
  { key: "pratica", re: /^(?:#+\s*)?(?:\*\*)?(?:\d\.\s*)?(Aplica[çc][ãa]o Pr[áa]tica[^:\n]*?)(?:\*\*)?\s*:?\s*(?:\*\*)?\s*/i },
];

const ENTRY_RE = /^(?:#+\s*)?(?:\*\*)?(?:(?:Livro|LIVRO)\s+[IVXLC\d]+\s*,\s*|Se[çc][ãa]o\s+|§\s*|Medita[çc][ãa]o\s+)(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?(?:\*\*)?\s*(?:[—:–-]\s*(.*))?$/;

export function parseGuideText(raw: string, sectionId: string, moduleLabel = "Módulo"): { module: GuideModule; warnings: string[] } {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const intro: string[] = [];
  const entries: (GuideEntry & { _lines: string[] })[] = [];
  let cur: (GuideEntry & { _lines: string[] }) | null = null;
  let curField: GuideField | null = null;
  const warnings: string[] = [];

  for (const line of lines) {
    const s = line.trim();
    const em = s.match(ENTRY_RE);
    if (em) {
      const from = parseInt(em[1], 10);
      const to = em[2] ? parseInt(em[2], 10) : from;
      cur = {
        id: `${sectionId}-${from}${to !== from ? "-" + to : ""}`,
        from,
        to,
        title: (em[3] ?? "").replace(/\*\*/g, "").trim(),
        quote: "",
        fields: [],
        _lines: [],
      };
      entries.push(cur);
      curField = null;
      continue;
    }
    if (!cur) { intro.push(line); continue; }
    let matched = false;
    for (const f of FIELD_DEFS) {
      const fm = s.match(f.re);
      if (fm && fm[0].length > 0 && fm[1]) {
        curField = { key: f.key, label: fm[1].trim(), md: s.slice(fm[0].length) };
        cur.fields.push(curField);
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (curField) curField.md += "\n" + line;
    else if (!cur.quote && /^>?\s*[“"«]/.test(s)) cur.quote = s.replace(/^>\s*/, "");
    else if (cur.quote && !cur.fields.length && s && !/[”"»]\s*$/.test(cur.quote)) cur.quote += " " + s;
    else cur._lines.push(line);
  }

  const clean: GuideEntry[] = entries.map(({ _lines, ...e }) => {
    const extra = _lines.join("\n").trim();
    e.fields = e.fields.map((f) => ({ ...f, md: f.md.trim() }));
    if (!e.fields.length && extra) e.fields.push({ key: "texto", label: "Análise", md: extra });
    else if (extra) e.extraMd = extra;
    if (!e.fields.length) warnings.push(`§${e.from}: nenhum campo reconhecido.`);
    return e;
  });
  if (!clean.length) warnings.push("Nenhum trecho encontrado. Use cabeçalhos como “Livro IV, 5-6 — Título” ou “Seção 3: Título”.");

  const introText = intro.join("\n").trim();
  return {
    module: { sectionId, module: moduleLabel, title: "", introMd: introText, outroMd: "", entries: clean },
    warnings,
  };
}
