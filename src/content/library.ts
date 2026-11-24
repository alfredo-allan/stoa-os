// Registro das obras. Para adicionar Sêneca ou Epicteto:
// - pelo painel Admin: cadastre a obra, cole o texto e clique em "Publicar no site"
//   (ele cria content/obras/<slug>/obra.json e atualiza src/content/registry.ts);
// - ou à mão: crie content/obras/<slug>/meta.json + fontes/*.txt, rode `npm run content`
//   e acrescente o import em src/content/registry.ts.
import { REGISTERED_WORKS } from "./registry";
import podcasts from "@content/podcasts.json";
import ilustracoes from "@content/ilustracoes.json";
import type { Author, Episode, GuideEntry, Illustration, Section, Work } from "./types";

export const AUTHORS: Author[] = [
  { id: "marco-aurelio", name: "Marco Aurélio", latin: "Marcus Aurelius", dates: "121 – 180 d.C.", role: "O imperador" },
  { id: "seneca", name: "Sêneca", latin: "Lucius Annaeus Seneca", dates: "4 a.C. – 65 d.C.", role: "O estadista" },
  { id: "epicteto", name: "Epicteto", latin: "Epictetus", dates: "50 – 135 d.C.", role: "O escravo liberto" },
];

const PLACEHOLDERS: Work[] = [
  {
    id: "cartas-a-lucilio",
    title: "Cartas a Lucílio",
    subtitle: "Epistulae Morales ad Lucilium",
    authorId: "seneca",
    description: "124 cartas de direção espiritual sobre o tempo, a morte, a amizade e a liberdade interior.",
    status: "em-breve",
    sections: [],
    guide: [],
  },
  {
    id: "enchiridion",
    title: "Enchirídion",
    subtitle: "O manual de Epicteto",
    authorId: "epicteto",
    description: "O manual de bolso do estoicismo: a dicotomia do controle em sua forma mais pura.",
    status: "em-breve",
    sections: [],
    guide: [],
  },
];

const REGISTERED = REGISTERED_WORKS as Work[];
/** Obras que já têm obra.json publicado no repositório. */
export const REGISTERED_IDS: string[] = REGISTERED.map((w) => w.id);
export const BASE_WORKS: Work[] = [...REGISTERED, ...PLACEHOLDERS.filter((p) => !REGISTERED_IDS.includes(p.id))];
export const BASE_EPISODES: Episode[] = podcasts as Episode[];
export const BASE_ILLUSTRATIONS: Illustration[] = ilustracoes as Illustration[];

export function authorOf(work: Pick<Work, "authorId">): Author {
  return AUTHORS.find((a) => a.id === work.authorId) ?? { id: work.authorId, name: work.authorId, latin: "", dates: "", role: "" };
}

export function sectionLabel(s: Pick<Section, "title">) {
  return s.title;
}

export function findGuideFor(work: Work, sectionId: string, n: number | null): { entry: GuideEntry; moduleLabel: string; moduleTitle: string } | null {
  const mod = work.guide.find((m) => m.sectionId === sectionId);
  if (!mod) return null;
  const entry =
    mod.entries.find((e) => e.whole) ??
    (n !== null ? mod.entries.find((e) => n >= e.from && n <= e.to) : undefined);
  if (!entry) return null;
  return { entry, moduleLabel: mod.module, moduleTitle: mod.title };
}

export function paragraphRef(section: Section, n: number | null) {
  return n === null ? section.title : `${section.title}, §${n}`;
}

export function rangeLabel(e: GuideEntry) {
  if (e.whole) return "Seção completa";
  return e.from === e.to ? `§${e.from}` : `§${e.from}–${e.to}`;
}
