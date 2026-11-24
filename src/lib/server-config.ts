// Descobre, pelas variáveis de ambiente, como o admin publica conteúdo e guarda arquivos.
// Só para uso no servidor.

export type PublishMode = "github" | "local" | "none";
export type StorageMode = "blob" | "local" | "none";

const isDev = () => process.env.NODE_ENV !== "production";

export function publishMode(): PublishMode {
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) return "github";
  return isDev() ? "local" : "none";
}

export function storageMode(): StorageMode {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  return isDev() ? "local" : "none";
}
