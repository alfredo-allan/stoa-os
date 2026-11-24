# Stoa OS — Central de estudos estoicos

Plataforma de leitura e estudo das *Meditações* de Marco Aurélio (e, em seguida, Sêneca e Epicteto), com guia de estudos do NotebookLM por parágrafo, podcasts, grifos, notas e marcadores.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Zustand (localStorage) · IndexedDB (áudios/imagens) · Framer Motion.

## Rodar

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Deploy recomendado: Vercel. Veja **Modo admin e deploy** abaixo.

## Páginas

| Rota | O que é |
|---|---|
| `/` | Abertura: fumaça revelando o medalhão de Marco Aurélio |
| `/inicio` | Central: máxima do dia, continuar leitura, biblioteca, guia, podcasts, caderno |
| `/ler/meditacoes/livro-4` | Leitor (fonte grande, 4 temas, sumário, busca, grifos, notas, marcadores, progresso) |
| `/contexto` | Guia de estudos por módulo (conteúdo integral do NotebookLM) |
| `/podcasts` | Episódios por livro, com marcadores de tempo que levam ao parágrafo |
| `/caderno` | Todos os grifos, reflexões e marcadores (exporta .md) |
| `/admin` | (só administrador) Colar texto do livro, guia, podcasts, ilustrações, obras, backup e **Publicar no site** |
| `/entrar` | Login do administrador (acesso discreto pelo pequeno templo no rodapé do trilho lateral e da página Início) |

No celular há navegação fixa no rodapé (Início, Livro, Contexto, Podcasts) e o mini-player fica logo acima dela.

## Estrutura de conteúdo (modular)

```
content/
  obras/
    meditacoes/
      meta.json          # título, autor, descrição
      fontes/*.txt       # texto transcrito, como foi colado
      guia.json          # módulos do NotebookLM, trecho a trecho (sem resumo)
      obra.json          # GERADO por `npm run content`
  podcasts.json          # episódios publicados para todos (áudios em public/podcasts)
  ilustracoes.json       # ilustrações publicadas para todos (imagens em public/ilustracoes)
```

Cada obra tem **seções** (Prefácio, Livro I…, ou Cartas), cada seção tem **parágrafos numerados** (§) e, opcionalmente, um **módulo do guia** cujos trechos cobrem um intervalo de parágrafos (`from`–`to`). O pop-up do leitor abre só o trecho que contém o parágrafo clicado.

### Adicionar Sêneca ou Epicteto

1. Pelo painel: aba **Obras** → cadastrar; aba **Texto do livro** → colar; aba **Guia** → colar o módulo.
2. Clique em **Publicar no site**: o painel grava `content/obras/<slug>/obra.json`, `guia.json`, `meta.json` e registra a obra em `src/content/registry.ts`.
3. Ou direto no repositório: criar `content/obras/<slug>/meta.json` + `fontes/*.txt`, rodar `npm run content` e acrescentar o import em `src/content/registry.ts`. (O `npm run content` preserva seções que foram publicadas pelo painel e não existem nas fontes.)

## Modo admin e deploy (Vercel)

Visitantes só leem. O administrador entra em `/entrar` com a senha e passa a ver a aba Admin e os atalhos de edição.

**Como a publicação funciona.** A Vercel não deixa o site gravar arquivos. Então, ao clicar em **Publicar no site**, o painel faz um commit no GitHub (API do GitHub, token numa variável de ambiente) com os arquivos de `content/`. A Vercel vê o commit e publica a nova versão sozinha em 1–2 minutos. Enquanto isso, o admin continua vendo o rascunho; quando a nova versão entra no ar, os rascunhos locais são limpos automaticamente.

**Áudios e imagens** vão para o **Vercel Blob** (envio direto do navegador, sem passar pelo limite de 4,5 MB das funções). Só a URL entra em `content/podcasts.json`. Os áudios que já estão em `public/podcasts` continuam funcionando.

**Proteção.** `src/middleware.ts` bloqueia `/admin` e `/api/admin/*` sem um cookie de sessão válido (httpOnly, assinado com HMAC, 14 dias). As rotas de escrita conferem a sessão de novo e só aceitam caminhos dentro de `content/`.

### Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Obrigatória | O que é |
|---|---|---|
| `ADMIN_PASSWORD` | sim | Senha do admin. Trocar a senha encerra todas as sessões. |
| `GITHUB_TOKEN` | sim, para publicar | Token *fine-grained* do GitHub com acesso só a este repositório e permissão **Contents: Read and write**. |
| `GITHUB_REPO` | sim, para publicar | `seu-usuario/nome-do-repositorio` |
| `GITHUB_BRANCH` | não | Branch de produção (padrão `main`). |
| `BLOB_READ_WRITE_TOKEN` | sim, para enviar áudios/imagens | Criada sozinha ao conectar um Blob store: Vercel → Storage → Create → Blob → conectar ao projeto. |
| `ADMIN_SESSION_SECRET` | não | Chave do cookie; se vazia, usa a senha. |

Modelo em `.env.example`.

### Rodando no computador

Sem `ADMIN_PASSWORD` no `.env.local`, `npm run dev` abre o admin sem senha, **Publicar no site** grava direto nos arquivos do projeto e os uploads vão para `public/podcasts` e `public/ilustracoes` (aí é só fazer commit). Para testar o login localmente, coloque `ADMIN_PASSWORD=...` no `.env.local`.

## O parser de texto (`src/lib/parser.ts`)

Recebe o texto cru e:
- remove números de página, cabeçalhos corridos (MEDITAÇÕES / MARCO AURÉLIO), separadores `***`, escapes e negritos de Markdown e frases como “Aqui está a transcrição…”;
- extrai notas de rodapé (bloco depois de `____`) e liga o `¹` do texto à nota;
- junta parágrafos quebrados pela virada de página, inclusive palavras hifenizadas (`na-` / `turais`);
- detecta `Livro N` e os parágrafos `1.`, `2.`… **em sequência**, mesmo com tudo numa linha só (e entende `Livro 11. Herdei` como Livro 1, §1);
- divide blocos muito longos sem quebras (ex.: Prefácio) em parágrafos legíveis, por frases.

`parseGuideText` faz o mesmo para o guia: cabeçalhos `Livro IV, 5-6 — Título`, `Seção 3: Título` ou `§ 3 — Título`, e os campos Reflexão Central / Conceitos / Analogia / Aplicação Prática, sem cortar nada.

## Observações sobre o conteúdo atual

- O guia dos PDFs foi extraído na íntegra e conferido palavra por palavra contra o PDF. Os termos gregos que vinham corrompidos no PDF (■) foram restaurados (ex.: ἡγεμονικόν, ἄσκησις, συμπάθεια, ἀδοξία).
- No arquivo do Livro III só o §1 vinha numerado; os §2–16 foram numerados conforme as citações do guia (Módulo 3).
- Ainda não há guia para a Introdução e o Livro II; o pop-up mostra um aviso e o atalho para o Admin.

## Dados locais

Grifos, notas, marcadores, progresso e preferências de leitura de cada visitante ficam no navegador dele (`localStorage`). Os rascunhos do admin também ficam no navegador até serem publicados. A aba **Backup** exporta/importa tudo. Para vários alunos com contas e sincronização, o próximo passo é um backend (ex.: Supabase) com a mesma estrutura de dados.
