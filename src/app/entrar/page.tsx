"use client";
import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { useAdminState } from "@/lib/admin-session";

export default function EntrarPage() {
  return (
    <Suspense>
      <Entrar />
    </Suspense>
  );
}

function Entrar() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const dest = next && next.startsWith("/admin") ? next : "/admin";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r || !r.ok) {
      setErr(d.error ?? "Não foi possível entrar.");
      return;
    }
    await useAdminState.getState().refresh();
    router.replace(dest);
  };

  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <form onSubmit={submit} className="panel w-full max-w-sm rounded-3xl p-7 text-center">
        <Image src="/img/medalhao-256.png" alt="" width={64} height={64} className="mx-auto rounded-full opacity-90" />
        <p className="kicker mt-5">Stoa OS</p>
        <h1 className="mt-1 font-display text-2xl text-gold-100">Área do administrador</h1>
        <label className="mt-6 block text-left">
          <span className="mb-1.5 block text-[12.5px] text-parchment-dim">Senha</span>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-850 px-3.5 focus-within:border-gold-500">
            <Lock className="size-4 text-muted" />
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent py-2.5 text-[14px] text-parchment outline-none"
            />
          </div>
        </label>
        {err && <p className="mt-3 text-[13px] text-rose-300">{err}</p>}
        <button disabled={busy || !password} className="btn-gold mt-5 w-full rounded-full px-5 py-2.5 text-sm disabled:opacity-40">
          {busy ? "Entrando…" : "Entrar"}
        </button>
        <Link href="/inicio" className="mt-4 inline-block text-[12.5px] text-muted hover:text-parchment">
          Voltar ao início
        </Link>
      </form>
    </div>
  );
}
