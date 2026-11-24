import { NextResponse } from "next/server";
import { ADMIN_COOKIE, SESSION_DAYS, checkPassword, createSessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "O acesso de administrador não está configurado (ADMIN_PASSWORD)." }, { status: 503 });
  }
  let password = "";
  try {
    password = String((await req.json())?.password ?? "");
  } catch {}
  if (!(await checkPassword(password))) {
    await new Promise((r) => setTimeout(r, 800)); // freia tentativas em série
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
