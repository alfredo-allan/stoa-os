// Gera content/obras/<obra>/obra.json a partir das fontes .txt + guia.json
// Uso: npm run content
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseBookText, sectionRank } from "../src/lib/parser.ts";

const root = new URL("../content/obras/", import.meta.url).pathname;
for (const obra of readdirSync(root)) {
  const dir = join(root, obra);
  const metaPath = join(dir, "meta.json");
  if (!existsSync(metaPath)) continue;
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  const fontesDir = join(dir, "fontes");
  const sections = [];
  const warnings = [];
  if (existsSync(fontesDir)) {
    for (const f of readdirSync(fontesDir).sort()) {
      if (!f.endsWith(".txt") && !f.endsWith(".md")) continue;
      const r = parseBookText(readFileSync(join(fontesDir, f), "utf8"), meta.parser ?? {});
      for (const s of r.sections) {
        if (s.kind === "outro" && s.paragraphs.every((p) => p.blocks.join("").replace(/[*\s]/g, "") === "")) continue;
        const i = sections.findIndex((x) => x.id === s.id);
        if (i >= 0) sections[i] = s; else sections.push(s);
      }
      warnings.push(...r.warnings.map((w) => `${f}: ${w}`));
    }
  }
  // Mantém seções publicadas pelo painel Admin que não existem nas fontes .txt
  const obraPath = join(dir, "obra.json");
  if (existsSync(obraPath)) {
    const prev = JSON.parse(readFileSync(obraPath, "utf8"));
    for (const s of prev.sections ?? []) if (!sections.some((x) => x.id === s.id)) sections.push(s);
  }
  sections.sort((a, b) => sectionRank(a) - sectionRank(b));
  const guide = existsSync(join(dir, "guia.json")) ? JSON.parse(readFileSync(join(dir, "guia.json"), "utf8")) : [];
  const { parser, ...rest } = meta;
  writeFileSync(join(dir, "obra.json"), JSON.stringify({ ...rest, sections, guide }, null, 1));
  console.log(`✔ ${obra}: ${sections.map((s) => `${s.title} (${s.paragraphs.filter((p) => p.n).length}§/${s.paragraphs.length})`).join(", ")}`);
  for (const w of warnings) console.warn("  ⚠", w);
}
