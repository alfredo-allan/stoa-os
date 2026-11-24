// Modelo de conteúdo do Stoa OS.
// Toda obra (Meditações, Cartas a Lucílio, Diatribes...) segue esta mesma estrutura.

export type SectionKind = "prefacio" | "introducao" | "livro" | "carta" | "capitulo" | "outro";

export interface Footnote {
  mark: string; // "1", "2"...
  text: string;
}

export interface Paragraph {
  /** id estável: `${sectionId}-p${n}` ou `${sectionId}-i${idx}` para parágrafos sem número */
  id: string;
  /** número da meditação (§). null para textos corridos como Prefácio e Introdução */
  n: number | null;
  /** blocos de texto (um parágrafo numerado pode ter vários blocos) */
  blocks: string[];
}

export interface Section {
  id: string; // "prefacio", "livro-4"
  title: string; // "Livro IV"
  kind: SectionKind;
  number?: number;
  paragraphs: Paragraph[];
  footnotes: Footnote[];
}

export interface GuideField {
  key: "reflexao" | "conceitos" | "analogia" | "pratica" | string;
  label: string;
  md: string;
}

export interface GuideEntry {
  id: string;
  /** primeiro e último § cobertos pela análise (inclusive). */
  from: number;
  to: number;
  /** a análise cobre a seção inteira (ex.: Prefácio) */
  whole?: boolean;
  title: string;
  quote: string;
  fields: GuideField[];
  extraMd?: string;
}

export interface GuideModule {
  sectionId: string;
  module: string; // "Módulo 4"
  title: string;
  introMd: string;
  outroMd: string;
  entries: GuideEntry[];
}

export interface Chapter {
  t: number; // segundos
  label: string;
  paragraph?: number;
}

export interface Episode {
  id: string;
  workId: string;
  sectionId: string;
  title: string;
  description?: string;
  /** URL pública (/podcasts/x.mp3, https://...) ou `idb:<chave>` para arquivos enviados pelo admin */
  src: string;
  chapters: Chapter[];
  createdAt: string;
}

export interface Illustration {
  id: string;
  workId?: string;
  sectionId?: string;
  title: string;
  caption?: string;
  src: string; // URL ou idb:<chave>
  createdAt: string;
}

export interface Author {
  id: string;
  name: string;
  latin: string;
  dates: string;
  role: string;
}

export interface Work {
  id: string; // slug
  title: string;
  subtitle?: string;
  authorId: string;
  description: string;
  status: "disponivel" | "em-breve";
  sections: Section[];
  guide: GuideModule[];
}
