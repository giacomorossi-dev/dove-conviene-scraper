# Pagina Preset — design

Data: 2026-10-15 · Stato: implementato

> La vista "Le mie liste" citata qui è stata poi sostituita dalla lista della
> spesa: vedi `2026-10-15-shopping-list-design.md`.

## Obiettivo

I preset si gestiscono in una pagina dedicata, **Preset**, invece che dalla
pagina Risultati e dalla barra in basso.

Un preset è un insieme riutilizzabile di **insegne** e **prodotti da cercare**,
indipendente dalla località. La pagina Risultati diventa: scegli il preset →
Cerca → risultati.

## Decisioni prese

- **Gestione nella pagina Preset.**
  - Nella pagina Preset si crea un preset vuoto, se ne crea uno partendo da un
    altro (duplica), lo si modifica e lo si elimina.
  - La pagina Risultati non modifica più insegne e prodotti.
- **La località resta nella barra in alto** e non fa più parte del preset.
- **Selezione delle insegne indipendente dalla zona.**
  - Si scelgono insegne dall'elenco nazionale salvato in `data/`.
  - Nessuna indicazione o filtro "in zona": lo stesso preset vale ovunque.
- **Catene locali escluse per ora.** Esistono solo nelle pagine "nelle
  vicinanze" di dc e non sono nell'elenco nazionale.
- **Nessun preset predefinito.** Si può eliminare qualsiasi preset. Senza
  preset si mostra uno stato vuoto (`Empty` di shadcn).
- **Finestra a passi per creazione e modifica:** ① Nome → ② Insegne → ③ Prodotti.
- **Insegne con `Item` + `Checkbox`, non `RadioGroup`.** Il RadioGroup permette
  una sola scelta, mentre le insegne sono una selezione multipla.
- **Nessun router.** Si aggiunge una vista allo switch che esiste già.

## Fuori ambito

- Catene locali.
- Indicazioni "in zona".
- Scan e download dei volantini.
- Unità di prezzo (€/kg).
- Router e URL per pagina.
- Modifiche al server.

## Dati

### Modello

```ts
interface Preset {
  id: string;
  name: string;
  retailers: string[];      // slug delle insegne, es. "conad-city"
  products: ProductQuery[]; // { name, maxPrice? }, invariato
  createdAt: number;
  updatedAt: number;
}
```

- Nome, logo e categoria di un'insegna vengono dall'elenco in `data/`
  (`GET /api/retailers`). Il preset tiene solo gli slug.
- Spariscono `place`, `legacyCity`, `default` e `flyers`.
- Sparisce anche la risoluzione all'avvio delle città dei preset vecchi
  (`resolveCityName`), perché la località non sta più nel preset.

### Salvataggio

- I preset restano nel `localStorage` del browser, con la stessa chiave di oggi.
- Si continua a salvare l'id del preset attivo.

### Località

Oggi la località scelta si salva dentro il preset attivo. Uscendo dal preset
va salvata per conto suo:

- si salva nel `localStorage` con la chiave `dove-conviene:place` ogni volta
  che cambia;
- all'avvio si usa quella salvata;
- se manca, si usa la località che aveva il preset attivo nel vecchio formato;
- se manca anche quella, si usa Rimini.

### Migrazione dei preset salvati

La conversione avviene al caricamento:

- **`flyers` → `retailers`.** Delle voci si tiene lo `slug`.
- **Voci senza slug** (preset molto vecchi, salvate per nome):
  - l'elenco arriva dopo il caricamento dei preset, quindi la migrazione mette
    i loro nomi in un campo temporaneo `legacyRetailerNames?: string[]`;
  - appena l'elenco è disponibile, `usePresets` li abbina per nome esatto e li
    aggiunge a `retailers` nei preset che restituisce (lettura, riepilogo,
    ricerca, modifica);
  - i nomi senza corrispondenza si scartano;
  - nel `localStorage` il campo resta fino al primo salvataggio del preset, che
    scrive gli slug e lo toglie.
- **Campi rimossi:** `place`, `city`, `citySlug`, `legacyCity` e `default` si
  ignorano.

### Slug sconosciuti

Se un'insegna salvata non è più nell'elenco:

- non si mostra e la ricerca la ignora;
- sparisce dal preset al primo salvataggio di quel preset.

## Struttura

| Unità | Tipo | Responsabilità |
|---|---|---|
| `src/lib/presets.ts` | funzioni pure | Modello, migrazione, creazione, nome "Copia di …", controllo nome duplicato, scelta del nuovo preset attivo dopo un'eliminazione |
| `src/lib/usePresets.ts` | hook | Stato dei preset e del preset attivo, persistenza; azioni create / update / remove / setActive |
| `src/lib/useCatalog.ts` | hook | Elenco delle insegne e stato della costruzione (`/api/retailers`, `/api/retailers/status`, aggiornamento). Estratto da `useRetailers` senza la parte "in zona" |
| `src/lib/retailerFilter.ts` | funzione pura | Filtro per nome (senza maiuscole né accenti), categoria e "solo selezionate" |
| `RetailerSelect` | componente riutilizzabile | Selezione multipla delle insegne con filtri |
| `PresetsView` | pagina | Elenco dei preset e azioni |
| `PresetEditorDialog` | componente | Finestra a passi per creare, duplicare e modificare |
| `PresetSummary` | componente | Riepilogo in sola lettura del preset attivo nella pagina Risultati |

Da shadcn si aggiungono `item`, `avatar`, `badge`, `checkbox`, `select` ed
`empty`. shadcn non ha uno stepper: la barra dei passi è un componente
semplice dentro `PresetEditorDialog`.

La barra in alto diventa "Risultati · Preset · Le mie liste", e il tipo `View`
diventa `"main" | "presets" | "lists"`.

## Interfaccia

### `RetailerSelect`

Props:

```ts
{
  value: string[];
  onChange: (slugs: string[]) => void;
}
```

- **Filtri**, combinati tra loro:
  - `Input` per nome, che cerca una parte del nome ignorando maiuscole e
    accenti;
  - `Select` per categoria, con "Tutte" più le 16 categorie di
    `shared/categories.ts`;
  - pulsante "**N selezionate**" che mostra solo le insegne scelte. È
    disattivato quando N = 0.
- **Elenco:** in ordine alfabetico. Ogni riga è un
  `Item render={<label />}` con:
  - `ItemMedia` con l'`Avatar` del logo e le iniziali come ripiego;
  - `ItemContent` con il nome e un `Badge` per la categoria;
  - `ItemActions` con la `Checkbox`.
- **Selezione:** il clic su qualsiasi punto della riga spunta la casella.
- **Nessun risultato:** "Nessuna insegna trovata".
- **Elenco non pronto:**
  - in caricamento, spinner;
  - durante la prima costruzione, barra di avanzamento come oggi;
  - in errore, messaggio con "Riprova".
- **In fondo:** "937 insegne, aggiornate il … · Aggiorna", come oggi.
- **Prestazioni:** con 937 righe tutte visibili. Se il rendering risulta lento,
  si caricano le righe a pezzi durante lo scorrimento. Va verificato in
  sviluppo.

### `PresetsView` — pagina Preset

- **Intestazione:** "Preset" e il pulsante "Nuovo preset".
- **Una riga `Item` per preset**, in ordine alfabetico, con:
  - nome;
  - "N insegne · M prodotti";
  - i primi loghi;
  - le azioni Modifica, Duplica ed Elimina.
- **Elimina** chiede conferma con `ConfirmDialog`: "Eliminare il preset «X»?".
- **Senza preset**, stato `Empty`:
  - icona;
  - titolo "Nessun preset";
  - descrizione "Crea un preset con le insegne e i prodotti da cercare";
  - pulsante "Crea preset".

### `PresetEditorDialog`

- **Modalità:**
  - *crea*: vuoto;
  - *duplica*: copia di un preset, con nome "Copia di X", oppure
    "Copia di X (2)" e così via se quel nome esiste già;
  - *modifica*.
- **Barra dei passi** in alto: ① Nome — ② Insegne — ③ Prodotti.
  - *Crea* e *duplica* procedono in ordine con Indietro e Avanti. Salva compare
    all'ultimo passo.
  - *Modifica*: i passi sono cliccabili e Salva è sempre attivo.
- **Passo Nome:**
  - nome obbligatorio;
  - non può coincidere con quello di un altro preset, senza distinguere
    maiuscole e minuscole e ignorando gli spazi ai bordi;
  - l'errore compare sotto il campo.
- **Passo Insegne:** `RetailerSelect`.
- **Passo Prodotti:** `ProductsChipsInput`, quello che c'è già, con la sintassi
  `nome, prezzo`.
- **Preset vuoto:** si può salvare un preset senza insegne o senza prodotti
  ("crearne uno vuoto").
- **Chiusura con modifiche non salvate:** `ConfirmDialog` "Scartare le
  modifiche?".
- **Dopo il salvataggio:** il preset creato o duplicato diventa quello attivo.
- **Su mobile** la finestra occupa quasi tutto lo schermo.

### Pagina Risultati

- **Sopra i risultati, `PresetSummary` del preset attivo:**
  - nome;
  - loghi delle insegne, al massimo 8 più "+N";
  - prodotti come etichette;
  - link "Modifica", che apre `PresetEditorDialog` in modifica.
- **Barra in basso:**
  - selezione del preset, solo la scelta, in ordine alfabetico (si tolgono
    rinomina, duplica ed elimina dal menu);
  - pulsante **Cerca**, l'attuale "Run".
- **Cerca è disattivato** senza preset attivo, oppure con un preset senza
  insegne (tra quelle nell'elenco) o senza prodotti. Una località c'è sempre.
- **Cambio di preset:** cambiando il preset attivo, i risultati della ricerca
  precedente si svuotano.
- **La barra in basso** compare solo nella pagina Risultati.
- **Senza preset:** stato `Empty` con "Crea preset", che passa alla pagina
  Preset e apre la finestra in modalità *crea*.
- **La ricerca invariata lato server:**
  - gli slug del preset si traducono in voci dell'elenco con `toSelection`;
  - si manda `{ place, flyers, products }` come oggi.
- **Elimina il preset attivo:** diventa attivo il preset modificato più di
  recente tra quelli rimasti, oppure nessuno.

### Cosa si rimuove

- `RetailerPicker` e `Flyer`, il selettore a fisarmonica con le tessere.
- `PresetNameDialog` e `PresetDeleteDialog`.
- "Aggiorna preset", "Reimposta" e `isPresetDirty`.
- La parte "in zona" di `useRetailers` lato client. La rotta
  `/api/retailers/nearby` resta sul server, che la usa per la ricerca.

## Verifica

- **`bun test`**, per le funzioni pure:
  - migrazione dei preset: con slug, solo nome, campi vecchi;
  - nome "Copia di …" con numerazione;
  - controllo dei nomi duplicati;
  - nuovo preset attivo dopo un'eliminazione;
  - filtro delle insegne: nome con accenti e maiuscole, categoria, solo
    selezionate, combinazioni.
- **`bun run typecheck`**, **`bun run lint`** e **`bun run format:check`**.
- **Prova nel browser** con playwright-core e Chromium, simulando la risposta di
  `/api/scraper`:
  - stato vuoto, poi crea un preset passo per passo usando i filtri;
  - modifica saltando direttamente a un passo;
  - duplica, con il nome "Copia di …";
  - elimina, anche del preset attivo;
  - avviso "Scartare le modifiche?";
  - ricerca dalla pagina Risultati e riepilogo del preset;
  - controllo a 390 px di larghezza (mobile).
