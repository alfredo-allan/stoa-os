import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/auth";

// Protege o painel (/admin) e as rotas de escrita (/api/admin/*).
// Login e consulta de sessão ficam abertos.
const OPEN_API = ["/api/admin/login", "/api/admin/session", "/api/admin/logout"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (OPEN_API.includes(pathname)) return NextResponse.next();

  const ok = await isAdminRequest(req.cookies.get(ADMIN_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Acesso restrito ao administrador." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
