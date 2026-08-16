# ArthurAppHub — Index

Mapa navegable del proyecto. Single entry point: si no sabés por dónde empezar, **arrancá acá**.

AppHub es un hub personal de apps **+ Identity Provider (SSO)** + sub-apps internas de wishlist de Destiny 2 y Umamusume. Astro 7 + Tailwind 4 + Cloudflare Workers.

URL producción: <https://arthurapphub.arthurbluthtt.workers.dev>

---

## Documentos

| Doc | Para qué |
|---|---|
| **[README.md](README.md)** | Qué hace, cómo correrlo, deploy, agregar app nueva. Onboarding. |
| **[STATE.md](STATE.md)** | Estado actual de deploy, próximos pasos, decisiones tomadas, riesgos, recap de credenciales. |
| **[DESIGN.md](DESIGN.md)** | Sistema de diseño canónico: paleta, tipografía, componentes base + extensiones (chips flotantes, dialogs, dropdowns, selects, filtros, cards). Single source of truth para styling. |
| **[AGENTS.md](AGENTS.md)** / **[CLAUDE.md](CLAUDE.md)** | Instrucciones para AI agents que trabajan en el repo (cómo correr el dev server, links a docs de Astro). |
| **[INDEX.md](INDEX.md)** | Este archivo — mapa navegable. |

---

## Mapa del proyecto

```
AppHub/
├── src/
│   ├── data/
│   │   └── apps.json                       # Lista editable de apps del hub
│   ├── components/
│   │   ├── Header.astro                    # Logo + username + botón Salir
│   │   ├── ThemeToggle.astro               # Toggle dark/light
│   │   ├── StatusDot.astro                 # Indicador online/offline
│   │   ├── AppCard.astro                   # Tarjeta de app (lanzador)
│   │   ├── AppGrid.astro                   # Grid responsivo de cards
│   │   └── d2/                             # Sub-app D2 Wishlist
│   │       ├── AddWeaponDialog.astro       # Modal: search arma + 4 inputs perk
│   │       ├── CustomPerkIconDialog.astro  # Modal: pool de iconos custom
│   │       └── WeaponCard.astro            # Card de arma en la wishlist
│   │   └── uma/                            # Sub-app Umamusume Cards
│   │       ├── AddCharacterDialog.astro    # Modal: search personaje + agregar
│   │       └── SupportCardList.astro       # Lista de cartas (icon + tooltip)
│   │   └── subs/                           # Sub-app Suscripciones
│   │       ├── AddSubDialog.astro          # Chip FAB + dialog agregar/editar
│   │       └── SubCard.astro               # Card de suscripción (toggle activa)
│   │   └── games/                          # Sub-app GameTracker
│   │       └── AddGameDialog.astro         # Chip FAB + dialog buscar en Steam
│   ├── layouts/
│   │   └── BaseLayout.astro                # HTML shell + scripts de bootstrap
│   ├── lib/
│   │   ├── auth.ts                         # hashPin, sesiones, codes, deriveAppPinHash
│   │   ├── internal.ts                     # verifyInternal (Bearer INTERNAL_API_SECRET)
│   │   ├── apps.ts                         # Helpers para apps.json
│   │   ├── types.ts                        # Tipos compartidos
│   │   ├── d2/                             # Lib D2
│   │   │   ├── manifest.ts                 # Lookup de armas/perks + filtrado por categoría
│   │   │   ├── wishlist.ts                 # CRUD d2_wishlist
│   │   │   ├── perkIcons.ts                # CRUD d2_perk_icons
│   │   │   └── resolver.ts                 # resolveWishlistRow(row) → shape para el cliente
│   │   └── uma/                            # Lib UMA
│   │       ├── data.ts                     # Carga characters/cards/recommendations + search
│   │       └── wishlist.ts                 # CRUD uma_wishlist (D1)
│   │   └── subs/                           # Lib Suscripciones
│   │       ├── store.ts                    # CRUD subs + CURRENCIES + validación de tipos
│   │       ├── validate.ts                 # parseSubInput (add/update)
│   │       └── format.ts                   # formatPrice, nextCharge, totalsByCurrency
│   │   └── games/                          # Lib GameTracker
│   │       └── store.ts                    # STATUSES + CRUD games (D1)
│   ├── pages/
│   │   ├── index.astro                     # / → login (sin sesión) o grid (con sesión)
│   │   ├── login.astro                     # /login → shim que redirige a /
│   │   ├── signup.astro                    # /signup → crear usuario
│   │   ├── api/
│   │   │   ├── health.ts                   # GET /api/health → status por app
│   │   │   ├── redir.ts                    # GET /api/redir?app= → code + 302
│   │   │   └── auth/
│   │   │       ├── issue.ts                # POST /api/auth/issue (cookie → code; sso:true)
│   │   │       ├── exchange.ts             # POST /api/auth/exchange (code → session_token)
│   │   │       ├── logout.ts               # POST/GET /api/auth/logout
│   │   │       └── logout-all.ts           # POST /api/auth/logout-all (stub no-op)
│   │   ├── destiny/                        # Sub-app D2 Wishlist
│   │   │   ├── index.astro                 # /destiny → wishlist
│   │   │   └── api/
│   │   │       ├── search.ts               # GET /destiny/api/search?q=
│   │   │       ├── add.ts                  # POST /destiny/api/add
│   │   │       ├── update.ts               # POST /destiny/api/update
│   │   │       ├── remove.ts               # POST /destiny/api/remove
│   │   │       ├── toggle-found.ts         # POST /destiny/api/toggle-found
│   │   │       ├── icon.ts                 # GET /destiny/api/icon?type=&hash=
│   │   │       ├── perk-icon.ts            # GET/POST /destiny/api/perk-icon
│   │   │       └── perks/
│   │   │           └── match.ts            # GET /destiny/api/perks/match?q=&slot=&limit=
│   │   └── umamusume/                      # Sub-app Umamusume Cards
│   │       ├── index.astro                 # /umamusume → wishlist
│   │       └── api/
│   │           ├── search.ts               # GET /umamusume/api/search?q=
│   │           ├── add.ts                  # POST /umamusume/api/add
│   │           ├── remove.ts               # POST /umamusume/api/remove
│   │           ├── toggle-found.ts         # POST /umamusume/api/toggle-found
│   │           ├── icon.ts                 # GET /umamusume/api/icon?type=character|card&id=
│   │       └── character/[id].ts       # GET /umamusume/api/character/[id] → recs
│   │   └── subs/                        # Sub-app Suscripciones
│   │       ├── index.astro              # /subs → wishlist (total + próximo cobro)
│   │       └── api/
│   │           ├── add.ts               # POST /subs/api/add
│   │           ├── update.ts            # POST /subs/api/update
│   │           ├── remove.ts            # POST /subs/api/remove
│   │           └── toggle-active.ts     # POST /subs/api/toggle-active
│   │   └── games/                       # Sub-app GameTracker
│   │       ├── index.astro              # /games → grid de juegos (portada + año + estado)
│   │       └── api/
│   │           ├── search.ts            # GET /games/api/search?q= (Steam storesearch)
│   │           ├── add.ts               # POST /games/api/add (appdetails + tipo game)
│   │           ├── set-status.ts        # POST /games/api/set-status
│   │           └── remove.ts            # POST /games/api/remove
│   ├── styles/
│   │   └── global.css                      # Tokens CSS + color-scheme sync
│   └── env.d.ts                            # Tipos del env (cloudflare:workers)
│
├── migrations/                             # D1 migrations (apply con wrangler d1 migrations apply)
│   ├── 0001_auth_init.sql                  # Tablas pin_credentials, sessions, auth_codes
│   ├── 0002_username.sql                   # Reemplaza user_id legacy con username
│   ├── 0003_d2_wishlist.sql                # Tabla d2_wishlist
│   ├── 0004_d2_wishlist_perks_json.sql     # Agrega perks_json
│   ├── 0005_drop_top_perk_hashes.sql       # Drop columna top_perk_hashes (legacy)
│   ├── 0006_d2_perk_icons.sql              # Tabla d2_perk_icons
│   ├── 0007_d2_perk_icons_category.sql     # Agrega category a d2_perk_icons
│   ├── 0008_uma_wishlist.sql               # Tabla uma_wishlist
│   ├── 0009_subs.sql                       # Tabla subs (suscripciones)
│   └── 0010_gametracker.sql                # Tabla games (gametracker)
│
├── data/d2/                                # Generado por build:d2-manifest
│   ├── weapons-index.json                  # 2058 armas con weaponType real
│   └── perks.json                          # 2000 perks con category real
├── data/uma/                                # Generado por build:uma-data
│   ├── characters.json                     # 96 personajes, 95 con aptitudes
│   ├── cards.json                          # 106 cartas con icon
│   └── recommendations.json                # 91 personajes con Main+Budget+Alternates
│
├── scripts/
│   ├── build-d2-manifest.mjs               # Genera data/d2/* desde Bungie API
│   └── build-uma-data.mjs                  # Genera data/uma/* desde game8.co
│
├── public/
│   └── favicon.svg
│
├── .github/workflows/
│   └── deploy.yml                          # Auto-deploy a Cloudflare Workers en cada push a main
│
├── wrangler.jsonc                          # Config del Worker (bindings D1, R2, env)
├── astro.config.mjs                        # Adapter Cloudflare + Tailwind 4 vía @tailwindcss/vite
├── tsconfig.json
├── worker-configuration.d.ts               # Tipos de los bindings (regenerado con wrangler types)
├── package.json
├── README.md                               # Onboarding
├── STATE.md                                # Estado actual + próximos pasos
├── DESIGN.md                               # Sistema de diseño
├── INDEX.md                                # Este archivo
├── AGENTS.md / CLAUDE.md                   # Instrucciones para AI agents
└── .nvmrc                                  # Node version (22.12+)
```

---

## API — Auth (hub)

| Method | Path | Body / Query | Respuesta |
|---|---|---|---|
| POST | `/api/auth/issue` | cookie `hub_sess` | `{ code, app, expires_at }` (60 s TTL) |
| POST | `/api/auth/exchange` | Bearer `INTERNAL_API_SECRET` + `{ code, app }` | `{ session_token, pin_hash, expires_at }` |
| POST / GET | `/api/auth/logout` | — | destruye sesión hub + limpia cookies |
| POST | `/api/auth/logout-all` | — | stub simétrico (no-op hoy) |
| GET | `/api/redir?app=<id>` | — | 302 a `${app.url}/api/auth/exchange?code=...` (con sesión) o a `/login?next=...` (sin sesión) |
| GET | `/api/health` | — | `{ results: [{ id, ok, status, ms }] }` (cache 5 min) |

## API — D2 Wishlist (sub-app)

| Method | Path | Body / Query | Respuesta |
|---|---|---|---|
| GET | `/destiny/api/search?q=` | — | `{ result: { hash, name, tier, damage, icon } }` o `{ result: null }` |
| GET | `/destiny/api/perks/match?q=&slot=&limit=` | — | `{ results: [...], groups: [{ key, label, perks: [...] }] }` |
| POST | `/destiny/api/add` | `{ itemHash, barrel, magazine, perk1, perk2 }` | `{ weapon }` (409 si duplicado, 400 si perks inválidas) |
| POST | `/destiny/api/update` | `{ itemHash, barrel, magazine, perk1, perk2 }` | `{ weapon }` |
| POST | `/destiny/api/remove` | `{ itemHash }` | `{ ok: true }` |
| POST | `/destiny/api/toggle-found` | `{ itemHash }` | `{ weapon }` |
| GET | `/destiny/api/icon?type=weapon\|perk&hash=` | — | imagen (R2 con fallback Bungie CDN, cache 30 días) |
| GET/POST | `/destiny/api/perk-icon` | — | `{ icons: [{ perkName, iconPath, category }] }` |
| POST | `/destiny/api/perk-icon` | `{ perkName, iconPath, category }` o `{ perkName, setCategory: true, category }` o `{ perkName, delete: true }` | `{ ok: true }` |

## API — Umamusume Cards (sub-app)

| Method | Path | Body / Query | Respuesta |
|---|---|---|---|
| GET | `/umamusume/api/search?q=&limit=` | — | `{ results: [{ id, name, version, icon, aptitudes }] }` (top 10-30) |
| POST | `/umamusume/api/add` | `{ characterId }` | `{ ok: true, character }` o 409 si duplicado |
| POST | `/umamusume/api/remove` | `{ characterId }` | 204 |
| POST | `/umamusume/api/toggle-found` | `{ characterId }` | `{ found, foundAt }` |
| GET | `/umamusume/api/character/[id]` | — | `{ character: { ..., aptitudes }, recommendations: { scenario, main, budget, alternates: { speed, power, wit } } }` |
| GET | `/umamusume/api/icon?type=character\|card&id=` | — | imagen (R2 con fallback game8 CDN, cache 30 días, prefix `uma/`) |

## API — Suscripciones (sub-app)

| Method | Path | Body / Query | Respuesta |
|---|---|---|---|
| POST | `/subs/api/add` | `{ name, priceCents, currency, billingDay }` | 201 `{ sub }` (400 si name vacío, price<0, currency ≠ MXN/USD o día fuera de 1-31) |
| POST | `/subs/api/update` | `{ id, name, priceCents, currency, billingDay }` | `{ sub }` (404 si no existe) |
| POST | `/subs/api/remove` | `{ id }` | 204 (404 si no existe) |
| POST | `/subs/api/toggle-active` | `{ id }` | `{ active }` (404 si no existe) |

## API — GameTracker (sub-app)

| Method | Path | Body / Query | Respuesta |
|---|---|---|---|
| GET | `/games/api/search?q=` | — | `{ results: [{ appId, name, tinyImage }] }` (top 8, solo `type === "app"`) |
| POST | `/games/api/add` | `{ appId }` | 201 `{ game }` (400 no-game, 404 no encontrado, 409 duplicado, 502 steam caído) |
| POST | `/games/api/set-status` | `{ id, status }` | `{ game }` (404 si no existe, 400 status inválido) |
| POST | `/games/api/remove` | `{ id }` | 204 |

Los datos vienen de la API de Steam (sin key): `storesearch` para buscar y `appdetails?filters=basic,release_date` para name + header_image + año al agregar.

---

## Storage

### D1 — `arthurapphub-auth-db`

| Tabla | Schema |
|---|---|
| `pin_credentials` | `(username PK, pin_hash, created_at)` |
| `sessions` | `(id PK, username, created_at, expires_at)` |
| `auth_codes` | `(code PK, username, app, expires_at, consumed_at)` |

### D1 — sub-app D2 (`arthurapphub-d2-assets` no — D2 también usa la misma `arthurapphub-auth-db`)

| Tabla | Schema |
|---|---|
| `d2_wishlist` | `(username, item_hash, weapon_name, weapon_icon_path, perks_json, found, found_at, added_at)` + índice `(username, found, added_at DESC)` |
| `d2_perk_icons` | `(username, perk_name_lower, perk_name_display, icon_path, category, created_at)` |

### D1 — sub-app Umamusume (`arthurapphub-auth-db`)

| Tabla | Schema |
|---|---|
| `uma_wishlist` | `(username, character_id, found, found_at, added_at)` + índice `(username, found, added_at DESC)` |

### D1 — sub-app Suscripciones (`arthurapphub-auth-db`)

| Tabla | Schema |
|---|---|
| `subs` | `(username, id, name, price_cents, currency, billing_day, active, created_at)` + índice `(username, active, created_at DESC)` |

### D1 — sub-app GameTracker (`arthurapphub-auth-db`)

| Tabla | Schema |
|---|---|
| `games` | `(username, id, app_id, name, cover_url, year, status, created_at, updated_at)` + UNIQUE `(username, app_id)` + índice `(username, status, created_at DESC)` |

| `status` | Label |
|---|---|
| `backlog` | Por jugar (default) |
| `playing` | Jugando |
| `dropped` | Dropeado |
| `finished` | Terminado |

### R2 — `arthurapphub-d2-assets` (binding `D2_ASSETS`)

| Prefix | Contenido |
|---|---|
| `weapons/<hash>.png` | Iconos de armas D2 (cache desde Bungie CDN) |
| `perks/<hash>.png` | Iconos de perks D2 (cache desde Bungie CDN) |
| `uma/characters/<id>.png` | Iconos de personajes UMA (cache desde game8 CDN) |
| `uma/cards/<game8Id>.png` | Iconos de cartas UMA (cache desde game8 CDN) |

---

## Scripts npm

| Script | Comando | Uso |
|---|---|---|
| `dev` | `astro dev --background` | Dev server local en `:4321`. Background mode (ver AGENTS.md). |
| `build` | `astro build` | Build producción → `dist/` |
| `preview` | `astro preview` | Sirve `dist/` localmente |
| `astro` | `astro` | CLI de Astro |
| `generate-types` | `wrangler types` | Regenera `worker-configuration.d.ts` con los tipos de los bindings |
| `build:d2-manifest` | `node scripts/build-d2-manifest.mjs` | Regenera `data/d2/*.json` desde Bungie API (necesita `BUNGIE_API_KEY`) |
| `build:uma-data` | `node scripts/build-uma-data.mjs` | Regenera `data/uma/*.json` desde game8.co (Best Characters + Best Support Cards tier lists + 96 build guides, incluyendo aptitudes) |

---

## Deploy

Push a `main` → `.github/workflows/deploy.yml`:

1. `npm ci`
2. `npm run build`
3. `wrangler deploy`

**Secrets requeridos** (en GitHub repo → Settings → Secrets):

- `CLOUDFLARE_API_TOKEN` — token de cuenta
- `CLOUDFLARE_ACCOUNT_ID` — ID de cuenta
- `INTERNAL_API_SECRET` — secret compartido con las apps vinculadas

**Worker secrets** (configurados con `wrangler secret put`):

- `AUTH_PEPPER` — pepper PBKDF2
- `INTERNAL_API_SECRET` — mismo que en GitHub
- `BUNGIE_API_KEY` — key de Bungie API para D2 manifest

---

## Tareas comunes (cómo hacer X)

| Tarea | Dónde mirar |
|---|---|
| Agregar una app nueva al hub | [README.md → "Agregar una app nueva"](README.md#agregar-una-app-nueva) |
| Cambiar paleta / tipografía / componente | [DESIGN.md → "Cómo agregar una app manteniendo el diseño"](DESIGN.md#cómo-agregar-una-app-manteniendo-el-diseño) + [DESIGN.md → "Extensiones de la línea base"](DESIGN.md#extensiones-de-la-línea-base-d2-wishlist) |
| Migrar DB | `migrations/NNN_*.sql` + `wrangler d1 migrations apply arthurapphub-auth-db --remote` |
| Regenerar manifest D2 | `BUNGIE_API_KEY=... npm run build:d2-manifest` |
| Debuggear el hub | `wrangler dev --remote` |
| Debuggear un dialog | [DESIGN.md → "Dialogs modales"](DESIGN.md#dialogs-modales) (scroll lock, fixed-position, etc.) |
| Ver próximos pasos | [STATE.md → "Próximo"](STATE.md#próximo) |
| Ver decisiones tomadas y riesgos | [STATE.md → "Decisiones tomadas"](STATE.md#decisiones-tomadas) + [STATE.md → "Riesgos remanentes"](STATE.md#riesgos-remanentes) |
| Ver credenciales / endpoints / bindings | [STATE.md → "Recap de credenciales actuales"](STATE.md#recap-de-credenciales-actuales) |
