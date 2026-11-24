// Faz um commit com vários arquivos de uma vez no GitHub (API Git Data).
// Usa GITHUB_TOKEN, GITHUB_REPO ("dono/repositorio") e GITHUB_BRANCH (padrão: main).
// A Vercel percebe o novo commit e publica uma nova versão do site sozinha.

export interface RepoFile {
  path: string;
  content: string; // texto UTF-8
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status} em ${path}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export async function commitFiles(files: RepoFile[], message: string): Promise<{ sha: string; url: string }> {
  const branch = process.env.GITHUB_BRANCH || "main";
  const ref = await gh<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(branch)}`);
  const parentSha = ref.object.sha;
  const parent = await gh<{ tree: { sha: string } }>(`/git/commits/${parentSha}`);

  const tree = [];
  for (const f of files) {
    const blob = await gh<{ sha: string }>(`/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: f.content, encoding: "utf-8" }),
    });
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const newTree = await gh<{ sha: string }>(`/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: parent.tree.sha, tree }),
  });
  const commit = await gh<{ sha: string; html_url: string }>(`/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: newTree.sha, parents: [parentSha] }),
  });
  // force: false → se alguém fez push no meio do caminho, falha em vez de sobrescrever.
  await gh(`/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  return { sha: commit.sha, url: commit.html_url };
}
