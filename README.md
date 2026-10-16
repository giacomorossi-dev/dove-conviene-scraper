# Scaper Conviene

Progetto personale che cerca le offerte nei volantini di
[doveconviene.it](https://www.doveconviene.it): scegli località (città o CAP), insegne e prodotti
(con prezzo massimo opzionale) e ottieni i risultati raggruppati per prodotto,
dal più conveniente, aggiornati in streaming mentre i volantini vengono letti. I prodotti si possono mettere
nella lista della spesa (carrello nei risultati) e le ricerche in preset (insegne + prodotti, gestiti nella pagina Preset e
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

Il server API ascolta solo su `127.0.0.1`: può avviare una lunga lettura di dc
dal tuo IP, quindi non è raggiungibile dalla rete locale. Per aprirlo di
proposito ad altri dispositivi: `HOST=0.0.0.0 bun run dev`.

### Dati locali e prima configurazione

Ogni installazione tiene i propri dati nella cartella `data/` (esclusa da git;
un'altra cartella con la variabile `DATA_DIR`):

- `retailers.json`: l'elenco nazionale delle insegne di dc (~950, con categoria,
  logo e tipo negozio/marchio). **Al primo avvio** il server lo costruisce da
  solo dalle sitemap di dc e l'app mostra l'avanzamento: finché non è pronto
  non si possono scegliere insegne né cercare (il pulsante Cerca dice perché).
- `retailers.partial.json`: i progressi di una costruzione in corso, per
  riprendere dopo un riavvio.

La costruzione va **piano apposta** (una pagina ogni 1,5-2,5 s, una pausa di un
minuto ogni 50 pagine, poi un controllo negozio/marchio da altre città: circa
un'ora) e tutte le richieste a dc passano da un'unica coda, una alla volta:
raffiche di richieste fanno rifiutare le connessioni e rischiano il ban
dell'IP. Se dc risponde "troppe richieste" o va in errore, **tutta la coda**
rallenta (e rispetta `Retry-After`). L'elenco si **aggiorna** da solo in
background se ha più di 7 giorni, oppure con "Aggiorna" nell'app; quello
vecchio resta in uso finché il nuovo non è completo, e anche se il nuovo è
vuoto o molto più corto (sotto l'80%: probabilmente dc ha cambiato le pagine).

Le catene locali (presenti solo in una zona) non sono nelle sitemap e per ora
non si possono scegliere.

### Ricerca

Cerca legge, una alla volta, le pagine dei volantini delle insegne del preset
vicini alla località scelta e mostra l'avanzamento. Un prodotto corrisponde se
il nome contiene tutte le parole cercate, in qualsiasi ordine e senza badare
agli accenti; il prezzo massimo è opzionale. I volantini che dc non dà vengono
segnalati e la ricerca prosegue con gli altri; si può annullare, e cambiare
preset o località la interrompe. Le pagine dei volantini restano in memoria per
un'ora: ripetere la ricerca con altri prodotti non costa richieste a dc.

## Script

| Script                    | Cosa fa                                                  |
| ------------------------- | -------------------------------------------------------- |
| `bun run dev`             | server API + client in watch (`dev:server`, `dev:client` separati) |
| `bun run build`           | typecheck + build del client in `dist/`                  |
| `bun run preview`         | apre la build di `dist/` (serve il server API acceso)    |
| `bun run typecheck`       | TypeScript 7 su client, server, test e config            |
| `bun run lint`            | ESLint                                                   |
| `bun run format`          | formatta con Biome (`format:check` per il solo controllo) |
| `bun run test`            | test di server e client (in CI anche con fuso America/Los_Angeles) |
| `bun run fixtures:update` | riscarica le pagine usate come fixture dai test          |
| `bun run retailers:update` | ricostruisce l'elenco insegne in `data/` (a server spento) |

## Struttura

```
shared/            tipi e categorie usati da server e client (alias @shared nel client)
server/            server Bun
  index.ts         avvio (porta 3000, solo 127.0.0.1 salvo HOST)
  app.ts           rotte Express (/api/places, /api/retailers, /api/scraper)
  catalog-store.ts elenco insegne in data/: prima costruzione e aggiornamenti
  places.ts        suggerimenti località e ricerca inversa (Photon)
  session.ts       sessione dc posizionata sulle coordinate scelte
  http.ts          richieste a dc: coda una alla volta, pause e nuovi tentativi
  ttl-cache.ts     cache a tempo (sessioni, pagine vicine, volantini)
  scrapers/        catalogo, volantini vicini, ricerca + test e __fixtures__
scripts/           script di manutenzione (fixture, elenco insegne)
src/               app React
  components/ui/   componenti shadcn (generati dalla CLI)
  lib/             preset, lista della spesa e località (localStorage), ricerca,
                   filtri e ordinamenti, con i loro test
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
