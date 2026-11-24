import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/auth";
import { storageMode } from "@/lib/server-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOLDERS = ["podcasts", "ilustracoes"] as const;

function safeName(name: string) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "arquivo";
  return `${base}-${Date.now().toString(36)}${ext}`;
}

export async function POST(req: Request) {
  const jar = await cookies();
  if (!(await isAdminRequest(jar.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: "Acesso restrito ao administrador." }, { status: 401 });
  }
  const mode = storageMode();

  // Produção: o navegador envia o arquivo direto para o Vercel Blob; aqui só autorizamos o envio.
  if (mode === "blob") {
    try {
      const body = (await req.json()) as HandleUploadBody;
      const json = await handleUpload({
        body,
        request: req,
        onBeforeGenerateToken: async (pathname) => {
          const folder = pathname.split("/")[0];
          if (!FOLDERS.includes(folder as (typeof FOLDERS)[number])) throw new Error("Pasta não permitida.");
          return {
            allowedContentTypes: folder === "podcasts" ? ["audio/*", "video/mp4"] : ["image/*"],
            maximumSizeInBytes: 300 * 1024 * 1024,
            addRandomSuffix: true,
          };
        },
      });
      return NextResponse.json(json);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Falha no envio." }, { status: 400 });
    }
  }

  // Desenvolvimento (npm run dev): grava em public/<pasta>/ para você comitar depois.
  if (mode === "local") {
    const form = await req.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") ?? "");
    if (!(file instanceof File) || !FOLDERS.includes(folder as (typeof FOLDERS)[number])) {
      return NextResponse.json({ error: "Arquivo ou pasta inválidos." }, { status: 400 });
    }
    const name = safeName(file.name);
    const dir = join(process.cwd(), "public", folder);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ url: `/${folder}/${name}` });
  }

  return NextResponse.json(
    { error: "Envio de arquivos não configurado. Conecte um Vercel Blob ao projeto (cria BLOB_READ_WRITE_TOKEN)." },
    { status: 503 },
  );
}
