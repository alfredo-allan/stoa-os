import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/auth";
import { commitFiles, type RepoFile } from "@/lib/github";
import { publishMode } from "@/lib/server-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Só estes caminhos podem ser escritos pelo painel.
const ALLOWED = /^content\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(?:json|txt)$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_BYTES = 4_000_000; // limite de corpo das funções da Vercel é ~4,5 MB

function registryFile(ids: string[]): RepoFile {
  const lines = ids.map((id, i) => `import w${i} from "@content/obras/${id}/obra.json";`);
  return {
    path: "src/content/registry.ts",
    content:
      `// Gerado pelo painel Admin ao publicar uma obra nova. Pode editar à mão se precisar.\n` +
      `// Cada obra publicada fica em content/obras/<id>/obra.json.\n` +
      `${lines.join("\n")}\n\n` +
      `export const REGISTERED_WORKS: unknown[] = [${ids.map((_, i) => `w${i}`).join(", ")}];\n`,
  };
}

export async function POST(req: Request) {
  const jar = await cookies();
  if (!(await isAdminRequest(jar.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: "Acesso restrito ao administrador." }, { status: 401 });
  }
  const mode = publishMode();
  if (mode === "none") {
    return NextResponse.json(
      { error: "Publicação não configurada. Defina GITHUB_TOKEN e GITHUB_REPO nas variáveis de ambiente da Vercel." },
      { status: 503 },
    );
  }

  let body: { files?: RepoFile[]; registerWorks?: string[]; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length) return NextResponse.json({ error: "Nada para publicar." }, { status: 400 });

  let total = 0;
  for (const f of files) {
    if (typeof f?.path !== "string" || typeof f?.content !== "string" || !ALLOWED.test(f.path)) {
      return NextResponse.json({ error: `Caminho não permitido: ${String(f?.path)}` }, { status: 400 });
    }
    if (f.path.endsWith(".json")) {
      try {
        JSON.parse(f.content);
      } catch {
        return NextResponse.json({ error: `JSON inválido em ${f.path}` }, { status: 400 });
      }
    }
    total += f.content.length;
  }
  if (total > MAX_BYTES) return NextResponse.json({ error: "Publicação grande demais para um envio." }, { status: 413 });

  const out: RepoFile[] = [...files];
  if (Array.isArray(body.registerWorks) && body.registerWorks.length) {
    const ids = [...new Set(body.registerWorks)];
    if (!ids.every((id) => typeof id === "string" && SLUG.test(id))) {
      return NextResponse.json({ error: "Identificador de obra inválido." }, { status: 400 });
    }
    out.push(registryFile(ids));
  }

  const message = (typeof body.message === "string" && body.message.trim().slice(0, 200)) || "Admin: atualiza conteúdo";

  try {
    if (mode === "github") {
      const r = await commitFiles(out, `${message}\n\nPublicado pelo painel Admin do Stoa OS.`);
      return NextResponse.json({ ok: true, mode, commit: r.sha, url: r.url, files: out.map((f) => f.path) });
    }
    // modo local (npm run dev): grava direto nos arquivos do projeto
    for (const f of out) {
      const abs = join(process.cwd(), f.path);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, f.content, "utf8");
    }
    return NextResponse.json({ ok: true, mode, files: out.map((f) => f.path) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao publicar." }, { status: 502 });
  }
}
