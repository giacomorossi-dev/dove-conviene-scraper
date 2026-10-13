# TODO

## Hosting privato + persistenza server-side

Discusso il 10/05/2026. Da affrontare quando vorremo passare da localStorage a un server permanente con DB.

### Stack scelto (raccomandato)
- **Server**: home server (mini PC / RPi / vecchio laptop) raggiungibile via Tailscale
- **Auth**: nessuno applicativo — Tailscale fa da frontiera (rete privata)
- **DB**: `bun:sqlite` (file `data.db` accanto al server, zero deps)
- **Backup**: cron giornaliero + rclone verso Drive

### Pre-flight ToS Shopfully (art. 2.5(iii))
- [ ] Decidere quante persone useranno l'app
  - solo io / cerchia stretta (≤3): OK come uso personale
  - URL pubblico gated: zona grigia
  - registrazione aperta o servizio commerciale: violazione → STOP

### Phase 1 — DB + endpoint server-side
- [ ] Integrare `bun:sqlite` (`import { Database } from "bun:sqlite"`)
- [ ] Schema iniziale:
  ```sql
  CREATE TABLE presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT, city_slug TEXT,
    flyers_json TEXT, products_json TEXT,
    is_default INTEGER DEFAULT 0,
    created_at INTEGER, updated_at INTEGER
  );
  CREATE TABLE lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at INTEGER, updated_at INTEGER
  );
  CREATE TABLE list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id TEXT NOT NULL,
    product_name TEXT, product_image TEXT,
    price REAL, flyer_name TEXT, flyer_url TEXT, valid_until TEXT,
    added_at INTEGER,
    FOREIGN KEY(list_id) REFERENCES lists(id) ON DELETE CASCADE
  );
  ```
  Single-user → niente tabella `users`.
- [ ] Endpoint REST:
  - presets: `GET / POST / PATCH /:id / DELETE /:id`
  - lists: `GET / POST / PATCH /:id / DELETE /:id`
  - items: `POST /api/lists/:id/items` · `DELETE /api/lists/:id/items/:itemId` · `POST /api/lists/:id/cleanup-expired`

### Phase 2 — Frontend usa il server invece di localStorage
- [ ] Sostituire `loadPresets()/loadLists()` con `fetch('/api/...')` in `App.tsx`
- [ ] Optimistic updates: aggiorna `useState` subito, POST al server in background, rollback su errore
- [ ] Indicator "saving..." discreto in topbar / bottombar
- [ ] (opzionale) cache localStorage write-through per offline-first
- [ ] One-shot button "Importa da localStorage" per migrare i dati esistenti

### Phase 3 — Hosting
- [ ] Scegliere la macchina (RPi 4? mini PC? vecchio laptop sempre acceso?)
- [ ] Installare bun + clone repo + `bun install`
- [ ] `bun run build` per il client; Express serve `dist/` come statico in prod
- [ ] Service systemd per auto-start (`bun run start`)
- [ ] Tailscale installato sulla macchina + sui device che la useranno
- [ ] Verifica accesso via `http://<machine>.<tailnet>.ts.net`

### Phase 4 — Backup & manutenzione
- [ ] Cron giornaliero: snapshot di `data.db` + rclone push su Drive
- [ ] Log rotation (journald basta)
- [ ] Tailscale ha già health check di base

### Decisioni rimandate
- [ ] Auth applicativo (HTTP Basic o sessione bcrypt) — non serve con Tailscale-only; valutare solo se mai si esporrà via tunnel pubblico
- [ ] Tabella `users` + permessi multi-utente — non necessario per uso personale
- [ ] Migrazione a Postgres — improbabile per la scala personale
