# Lista della spesa — design

Data: 2026-10-15 · Stato: da approvare

## Obiettivo

Le liste multiple ("Le mie liste": nomi, colori, cuore) diventano un'unica
**lista della spesa**. Dai risultati si aggiunge un prodotto con il carrello.
Nella pagina "Lista della spesa":

- i prodotti si segnano come acquistati;
- sono raggruppati per volantino;
- si ordinano per scadenza e si filtrano per insegna.

## Decisioni prese

- **Una sola lista**, chiamata "Lista della spesa".
- **Carrello** al posto del cuore nei risultati: un clic aggiunge, un altro
  toglie, senza menu né conferma.
- **Prodotto acquistato:**
  - resta nel suo gruppo, barrato e in grigio, in fondo al gruppo;
  - si può togliere la spunta;
  - "Rimuovi acquistati" fa pulizia.
- **Solo prodotti dai volantini:** nessun prodotto aggiunto a mano, per ora.
- **Liste esistenti:** i loro prodotti confluiscono nella lista della spesa,
  senza perdere dati.
- **Volantini scaduti:** restano visibili con l'etichetta "Scaduto"; si
  tolgono con "Rimuovi scaduti".
- **Codice:** un modello dedicato. Il vecchio codice delle liste si elimina,
  invece di riusarlo con una lista "di sistema".

## Fuori ambito

- Prodotti liberi e quantità.
- Link alla pagina del volantino (`flyerPage`): arriverà con la lettura dei
  volantini via Qwen.
- Sincronizzazione tra schede.
- Modifiche al server.

## Dati

```ts
interface ShoppingItem {
  productName: string;
  productImage: string | null;
  price: number | null;
  flyerName: string;      // insegna, come oggi
  flyerUrl: string;       // volantino: identifica il gruppo
  validUntil: string | null;
  retailerSlug?: string;  // per il logo; manca nei prodotti salvati prima
  addedAt: number;
  purchased: boolean;
}
```

- **Identità di un prodotto:** `itemKey`, cioè `flyerUrl::productName::price`,
  come oggi. Lo stesso prodotto non entra due volte.
- **Salvataggio:**
  - `localStorage`, chiave `dove-conviene:shopping-list`;
  - se la chiave manca o non è leggibile, la lista è vuota;
  - le voci non valide si scartano.
- **Migrazione:**
  - se `dove-conviene:shopping-list` non esiste, si costruisce dai prodotti di
    tutte le liste in `dove-conviene:lists`, senza doppioni e con
    `purchased: false`;
  - `dove-conviene:lists` resta com'è: non si cancella e non si usa più.
- **Logo:**
  - i prodotti aggiunti dai risultati salvano lo slug del volantino
    (`Flyer.slug`);
  - nella pagina il logo arriva dall'elenco insegne;
  - senza slug, o con uno slug non più in elenco, si mostrano le iniziali.

## Struttura

| Unità | Tipo | Responsabilità |
|---|---|---|
| `src/lib/shopping.ts` | funzioni pure | Modello, lettura e scrittura, migrazione dalle liste, aggiungi/togli, acquistato, rimuovi acquistati/scaduti, raggruppamento per volantino con ordinamento, insegne presenti |
| `src/lib/useShoppingList.ts` | hook | Stato della lista e salvataggio |
| `src/components/CartButton.tsx` | componente | Carrello nei risultati |
| `src/components/ShoppingListView.tsx` | pagina | Barra filtri, gruppi, stato vuoto |

- **Restano da `lists.ts`**, spostati in `shopping.ts`:
  - `RowData`, la riga dei risultati, a cui si aggiunge `retailerSlug?`;
  - `itemKey`;
  - `isExpired`.
- **Si eliminano:**
  - il resto di `lists.ts`: `List`, colori, `createList`, `findItemList`;
  - `ListsView`, `ListEditDialog` e `SaveToListMenu`.
- **`App.tsx`:**
  - perde gli stati e le finestre delle liste;
  - la vista `"lists"` diventa `"shopping"`;
  - la voce nella barra in alto diventa "Lista della spesa".

## Interfaccia

### Risultati (`ResultsTable`)

- **La colonna "Lista"** diventa una colonna senza titolo con `CartButton`.
- **`CartButton`:**
  - icona `ShoppingCart`;
  - se il prodotto è in lista, l'icona è piena e del colore primario, con
    `aria-pressed="true"`;
  - etichette accessibili "Aggiungi alla lista della spesa" e "Togli dalla
    lista della spesa";
  - un clic aggiunge o toglie.
- **Props di `ResultsTable`:** `lists`, `onAddToList`, `onRequestNewList`,
  `onRequestRemove` ed `emptyMessage` diventano `isInCart(row)` e
  `onToggleCart(row)`.

### Barra in alto

- **Voci:** Risultati · Preset · **Lista della spesa**.
- **Contatore:** accanto a "Lista della spesa", un `Badge` con il numero di
  prodotti non acquistati. Non compare quando è 0.

### Pagina "Lista della spesa"

**Barra degli strumenti**, in alto:

- `Select` **ordinamento**: "Scadenza più vicina" (default) oppure "Scadenza
  più lontana";
- `Select` **insegna**: "Tutte le insegne" più le insegne presenti in lista,
  in ordine alfabetico;
- se l'insegna scelta sparisce dalla lista, il filtro torna su "Tutte";
- "**Rimuovi acquistati (N)**" e "**Rimuovi scaduti (N)**", disattivati quando
  N = 0. Contano tutta la lista, non solo quello che il filtro mostra.

**Un gruppo (`Card`) per volantino**, cioè per `flyerUrl`:

- **Intestazione:**
  - logo (`Avatar`) e nome dell'insegna;
  - "Scade il 21/10/2026", oppure il `Badge` "Scaduto", oppure nulla se la
    data manca;
  - "3 prodotti · 1 acquistato";
  - link "Apri volantino", che apre una nuova scheda.
- **Ordine dei gruppi:** per data di scadenza, nel verso scelto. I volantini
  senza data vanno sempre in fondo. A parità di data, ordine alfabetico per
  insegna.
- **Ordine dei prodotti:** prima quelli da acquistare, poi gli acquistati;
  dentro ciascun blocco, in ordine di aggiunta.
- **Ogni prodotto** è un `Item` usato come `<label>`, come nella scelta delle
  insegne. Il clic in qualsiasi punto della riga spunta la `Checkbox`
  "acquistato". La riga contiene:
  - foto, se c'è;
  - nome e prezzo;
  - un pulsante × "Togli", che non spunta la casella.
- **Prodotto acquistato:** nome barrato e riga in grigio.
- **Lista vuota:** stato `Empty` con:
  - titolo "La lista della spesa è vuota";
  - descrizione "Aggiungi i prodotti dai risultati con il carrello";
  - pulsante "Vai ai risultati".
- **Filtro senza risultati:** "Nessun prodotto per questa insegna".

## Verifica

- **`bun test`**, per le funzioni pure di `shopping.ts`:
  - migrazione dalle liste, con doppioni tra liste diverse e liste vuote;
  - lettura con dati mancanti, rotti o con voci non valide;
  - aggiungi, togli, aggiungi di nuovo lo stesso prodotto;
  - segna e togli acquistato;
  - rimuovi acquistati;
  - rimuovi scaduti: oggi non è scaduto, ieri sì, senza data non è scaduto;
  - raggruppamento: due ordinamenti, volantini senza data in fondo in entrambi,
    acquistati in fondo al gruppo;
  - insegne presenti, in ordine alfabetico e senza doppioni.
- **`bun run typecheck`**, **`bun run lint`** e **`bun run format:check`**.
- **Prova nel browser**, con `/api/scraper` simulato:
  - aggiunta e rimozione col carrello dai risultati;
  - contatore nella barra in alto;
  - spunta acquistato cliccando sulla riga e sulla casella, una volta sola;
  - la × toglie senza spuntare;
  - ordinamenti e filtro per insegna;
  - rimuovi acquistati e scaduti;
  - migrazione da liste vecchie inserite nel `localStorage`;
  - stato vuoto e "Vai ai risultati";
  - controllo a 390 px.
