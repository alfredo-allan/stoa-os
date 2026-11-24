"use client";
// Sessão do admin no navegador (leve: usada em todas as páginas para mostrar/esconder controles).
// A proteção de verdade está no servidor (middleware + rotas /api/admin).
import { useEffect } from "react";
import { create } from "zustand";

export type PublishMode = "github" | "local" | "none";
export type StorageMode = "blob" | "local" | "none";

interface AdminState {
  checked: boolean;
  admin: boolean;
  devOpen: boolean;
  publish: PublishMode;
  storage: StorageMode;
  deployedCommit: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

let inflight: Promise<void> | null = null;

export const useAdminState = create<AdminState>((set) => ({
  checked: false,
  admin: false,
  devOpen: false,
  publish: "none",
  storage: "none",
  deployedCommit: null,
  refresh: () => {
    inflight ??= fetch("/api/admin/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) =>
        set({
          checked: true,
          admin: !!d.admin,
          devOpen: !!d.devOpen,
          publish: d.publish ?? "none",
          storage: d.storage ?? "none",
          deployedCommit: d.deployedCommit ?? null,
        }),
      )
      .catch(() => set({ checked: true, admin: false }))
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },
  logout: async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    set({ admin: false, checked: true });
  },
}));

/** true só para o administrador logado. Visitantes nunca veem os controles de admin. */
export function useIsAdmin(): boolean {
  const { checked, admin, refresh } = useAdminState();
  useEffect(() => {
    if (!checked) refresh();
  }, [checked, refresh]);
  return admin;
}

