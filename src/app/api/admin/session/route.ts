import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminOpenInDev, isAdminRequest } from "@/lib/auth";
import { publishMode, storageMode } from "@/lib/server-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const admin = await isAdminRequest(jar.get(ADMIN_COOKIE)?.value);
  if (!admin) return NextResponse.json({ admin: false }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(
    {
      admin: true,
      devOpen: adminOpenInDev(),
      publish: publishMode(),
      storage: storageMode(),
      // commit que está no ar (a Vercel expõe esta variável automaticamente)
      deployedCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
