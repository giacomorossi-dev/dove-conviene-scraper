# Scaper Conviene

Progetto personale che cerca le offerte nei volantini di
[doveconviene.it](https://www.doveconviene.it): scegli città, insegne e prodotti
(con prezzo massimo opzionale) e ottieni una tabella dei risultati, aggiornata
in streaming mentre i volantini vengono letti. I prodotti si possono salvare in
liste e le ricerche in preset (salvati in `localStorage`).

## Stack

- **Client**: React 19, Vite 8, Tailwind CSS 4, shadcn/ui su Base UI (stile `base-vega`)
- **Server**: Bun + Express 5, scraping con Cheerio (dati strutturati JSON-LD delle pagine)
- **Tooling**: TypeScript 7, ESLint 10, Biome (solo formatter), `bun test`

## Requisiti

- Node 24 (`nvm use`, legge `.nvmrc`; minimo 22.12)
- Bun 1.3

## Avvio

```sh
bun install
bun run dev
```

Avvia il server API su `:3000` e Vite su `:5173` (o la prima porta libera);
Vite inoltra `/api` al server.

## Script

| Script                    | Cosa fa                                                  |
| ------------------------- | -------------------------------------------------------- |
| `bun run dev`             | server API + client in watch                             |
| `bun run build`           | typecheck + build di produzione in `dist/`               |
| `bun run typecheck`       | TypeScript 7 su client, server, test e config            |
| `bun run lint`            | ESLint                                                   |
| `bun run format`          | formatta con Biome (`format:check` per il solo controllo) |
| `bun run test`            | test dei parser e degli helper                           |
| `bun run fixtures:update` | riscarica le pagine usate come fixture dai test          |

## Struttura

```
shared/            tipi e categorie usati da server e client (alias @shared nel client)
server/            API Express (index.ts) e scraper
  scrapers/        parser di città, insegne, volantini + test e __fixtures__
scripts/           script di manutenzione (aggiornamento fixture)
src/               app React
  components/ui/   componenti shadcn (generati dalla CLI)
  lib/             preset e liste (localStorage)
```

## Note

- **Test e fixture**: i test girano su pagine reali salvate in
  `server/scrapers/__fixtures__`. Per sapere se il sito ha cambiato markup:
  `bun run fixtures:update && bun run test`.
- **TypeScript 6 + 7**: TypeScript 7 non espone ancora un'API JS, quindi è
  installato come `@typescript/native` ed esegue il typecheck, mentre il
  pacchetto `typescript` resta alla 6 per typescript-eslint e l'editor.
- **shadcn/ui**: i componenti si aggiungono con `bunx shadcn@latest add <nome>`.
  `src/components/ui` è escluso da Biome, così i file restano identici al
  registry (`bunx shadcn@latest add <nome> --dry-run` mostra eventuali modifiche).
- **Formattazione nell'editor**: installa le estensioni consigliate
  (`.vscode/extensions.json`) e imposta Biome come formatter predefinito.
- **Blame**: `git config blame.ignoreRevsFile .git-blame-ignore-revs` per
  ignorare i commit di sola formattazione.
