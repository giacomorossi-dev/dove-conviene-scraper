# Scaper Conviene

Progetto personale che cerca le offerte nei volantini di
[doveconviene.it](https://www.doveconviene.it): scegli località (città o CAP), insegne e prodotti
(con prezzo massimo opzionale) e ottieni una tabella dei risultati, aggiornata
in streaming mentre i volantini vengono letti. I prodotti si possono salvare in
liste e le ricerche in preset (insegne + prodotti, gestiti nella pagina Preset e
salvati in `localStorage`; la località resta nella barra in alto).

## Stack

- **Client**: React 19, Vite 8, Tailwind CSS 4, shadcn/ui su Base UI (stile `base-vega`)
- **Server**: Bun + Express 5, scraping con Cheerio (dati strutturati JSON-LD delle pagine)
- **Località**: suggerimenti di comuni, frazioni e CAP da [Photon](https://photon.komoot.io)
  (OpenStreetMap); i volantini sono quelli "nelle vicinanze" delle coordinate scelte
- **Tooling**: TypeScript 7, ESLint 10, Biome (solo formatter), `bun test`

## Requisiti

- Node 24 (`nvm use`, legge `.nvmrc`)
- Bun 1.3

## Avvio

```sh
bun install
bun run dev
```

Avvia il server API su `:3000` e Vite su `:5180` (fissa, così non si scontra
con altri progetti sulla 5173: se è occupata Vite si ferma invece di cambiarla);
Vite inoltra `/api` al server. L'app è su http://localhost:5180.

### Dati locali e prima configurazione

Ogni installazione tiene i propri dati nella cartella `data/` (esclusa da git;
un'altra cartella con la variabile `DATA_DIR`):

- `retailers.json`: l'elenco nazionale delle insegne di dc (~950, con categoria,
  logo e tipo negozio/marchio). **Al primo avvio** il server lo costruisce da
  solo dalle sitemap di dc e l'app mostra l'avanzamento; nel frattempo si
  vedono già le insegne con volantini vicino alla località scelta.
- `retailers.partial.json`: i progressi di una costruzione in corso, per
  riprendere dopo un riavvio.

La costruzione va **piano apposta** (una pagina ogni 1,5-2,5 s, una pausa di un
minuto ogni 50 pagine: circa 45 minuti) e tutte le richieste a dc passano da
un'unica coda, una alla volta: raffiche di richieste fanno rifiutare le
connessioni e rischiano il ban dell'IP. L'elenco si **aggiorna** da solo in
background se ha più di 7 giorni, oppure con "Aggiorna" nell'app; quello
vecchio resta in uso finché il nuovo non è completo.

Le insegne locali (catene presenti solo in una zona) non sono nelle sitemap:
arrivano dalle pagine "nelle vicinanze" della località scelta, lette solo per
le categorie che apri o cerchi.

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
| `bun run retailers:update` | ricostruisce l'elenco insegne in `data/` (a server spento) |

## Struttura

```
shared/            tipi e categorie usati da server e client (alias @shared nel client)
server/            API Express (index.ts) e scraper
  catalog-store.ts elenco insegne in data/: prima costruzione e aggiornamenti
  places.ts        suggerimenti località e ricerca inversa (Photon)
  session.ts       sessione dc posizionata sulle coordinate scelte
  http.ts          richieste a dc: coda una alla volta e nuovi tentativi
  scrapers/        catalogo, insegne in zona, volantini + test e __fixtures__
scripts/           script di manutenzione (fixture, elenco insegne)
src/               app React
  components/ui/   componenti shadcn (generati dalla CLI)
  lib/             preset, liste e località (localStorage), filtri insegne
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
