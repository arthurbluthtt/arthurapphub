# Arquitectura — ArthurAppHub

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Astro 7 (SSR, `prerender: false` en páginas con auth) |
| Adapter | `@astrojs/cloudflare` (Workers) |
| Estilos | Tailwind CSS 4 (`@tailwindcss/vite`) |
| Runtime | Cloudflare Workers (V8 isolates) |
| DB | D1 `arthurapphub-auth-db` (`AUTH_DB`) |
| Assets | R2 `arthurapphub-d2-assets` (`D2_ASSETS`) |
| Deploy | GitHub Actions → `wrangler deploy` en cada push a `main` (~30 s) |

`astro.config.mjs` — `site: 'https://arthurapphub.arthurbluthtt.workers.dev'`, `prefetch: { defaultStrategy: 'hover' }`, `vite.server.watch.ignored: ['**/.wrangler/**']`.

La autenticación de la aplicación no usa `Astro.session`: `astro.config.mjs`
configura el driver local no-op `src/lib/astro-session-null.ts`, por lo que el
adapter no agrega el KV `SESSION`. Las sesiones reales se gestionan
explícitamente en D1 mediante la cookie `hub_sess`.

## Bindings y secrets

`wrangler.jsonc`:

```jsonc
"d1_databases": [{ "binding": "AUTH_DB", "database_name": "arthurapphub-auth-db", "migrations_dir": "./migrations" }]
"r2_buckets":  [{ "binding": "D2_ASSETS", "bucket_name": "arthurapphub-d2-assets" }]
"assets":      { "directory": "./dist", "binding": "ASSETS" }
```

| Secret | Dónde | Para qué |
|---|---|---|
| `AUTH_PEPPER` | Worker Secret + GH Secret | Pepper del PBKDF2 y del `deriveAppPinHash` |
| `INTERNAL_API_SECRET` | Worker Secret + GH Secret | `Authorization: Bearer` en `/api/auth/exchange` |
| `BUNGIE_API_KEY` | Worker Secret | `build:d2-manifest` y proxy de iconos D2 |
| `TMDB_API_KEY` | Worker Secret | `src/lib/media/tmdb.ts` (`search/multi` + details). Si no está, 503 y modo manual |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | GH Secrets | `wrangler deploy` |

Acceso en código: `import { env } from 'cloudflare:workers'` → `env.AUTH_DB`, `env.D2_ASSETS`, `env.AUTH_PEPPER`, etc. (Astro 7, no `Astro.locals.runtime.env`).

D1 local: `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite` (ignorado por Vite watcher).

## Tablas D1

Todas en la misma D1. Ver `migrations/*.sql` para DDL exacto.

| Tabla | Migración | Clave | Índices |
|---|---|---|---|
| `pin_credentials` | 0001 + 0002 | `username` PK | — |
| `sessions` | 0001 | `session_id` | `user_id` |
| `auth_codes` | 0001 | `code` | — |
| `d2_wishlist` | 0003–0005 | `(username, item_hash)` | `(username, found, added_at DESC)` |
| `d2_perk_icons` | 0006–0007 | `(username, perk_name_lower)` | — |
| `uma_wishlist` | 0008 | `(username, character_id)` | `(username, found, added_at DESC)` |
| `subs` | 0009 | `(username, id)` | `(username, active, created_at DESC)` |
| `games` | 0010–0012 | `(username, id)` + UNIQUE parcial `(username, app_id) WHERE app_id IS NOT NULL` | `(username, status)`, `(username, saga) WHERE saga IS NOT NULL` |
| `media` | 0013 | `(username, id)` + UNIQUE parcial `(username, external_id) WHERE external_id IS NOT NULL` | `(username, status)`, `(username, media_type)` |
| `manga` | 0014 | `(username, id)` + UNIQUE parcial | `(username, status)`, `(username, manga_type)` |
| `books` | 0015 | `(username, id)` + UNIQUE parcial (`external_id TEXT`) | `(username, status)`, `(username, book_type)` |
| `anime` | 0016 | `(username, id)` + UNIQUE parcial | `(username, status)`, `(username, anime_type)` |
| `zzz_builds` | 0017–0019 | `(username, id)` + UNIQUE `lower(character_name)` | `(username, w_engine_id)`, `(username, position)` |

R2: `weapons/<hash>.png`, `perks/<hash>.png`, `uma/<id>.png`, `zzz/<type>/<id>.png`.

## Auth — flujo completo

### Registro y login

```
POST /signup  { username, pin }  → hashPin() → INSERT pin_credentials → createSession() → Set-Cookie: hub_sess + hub_user → 302 /
POST /        { username, pin }  → hashPin() mismo path → compara pin_hash → createSession() → Set-Cookie → 302 /
```

- `hashPin(pin, username, pepper)`: `PBKDF2-SHA256(pin + ":" + username + ":" + pepper, salt="arthurapphub-auth-v1", 100k iter)` → 32 bytes base64url. El username entra al input para que el mismo PIN no colisione.
- `SESSION_TTL_MS = 90 días`, `COOKIE_NAME = hub_sess`, `HttpOnly; Secure; SameSite=Lax`. Cookie companion `hub_user` (no-HttpOnly, `Max-Age` igual) para mostrar el username en el header sin query a D1.
- `lookupSession(sessionId)`: cache en memoria 30 s (vive dentro del request; cada request es un isolate nuevo), borra si expiró, retorna `{ username, expiresAt } | null`.

### Hub como Identity Provider (SSO)

```
Usuario en hub (con hub_sess) hace click en card con sso: true
  → GET /api/redir?app=<id>            (con sesión: crea code + 302 a ${app.url}/api/auth/exchange?code=...)
  → App hace POST ${HUB_URL}/api/auth/exchange  Authorization: Bearer INTERNAL_API_SECRET  { code, app }
  → Hub: consumeAuthCode(code, app) → { username } (single-use, 60 s, app debe coincidir)
     → deriveAppPinHash(pin_hash_hub, app, pepper) = sha256(pin_hash_hub + ":" + app + ":" + pepper)
     → { session_token, pin_hash: pinHashApp, expires_at }
  → App guarda y setea su propia cookie
```

- `POST /api/auth/issue` — cookie → code (60 s, para apps que piden code sin pasar por redir).
- `POST /api/auth/exchange` — `Bearer INTERNAL_API_SECRET` + `{ code, app }` → `{ session_token, pin_hash, expires_at }`. Solo `isSsoApp(app)` (`src/lib/apps.ts` deriva la lista de `apps.json`).
- `GET /api/redir?app=<id>` — solo para apps `sso: true`. Con sesión crea un
  code de un solo uso y responde 302 a `${app.url}/api/auth/exchange?code=...`;
  la app externa recibe ese GET y hace el POST autenticado al Hub. Sin sesión,
  responde 302 a `/login?next=...`; para apps internas responde 400 y se usa su
  `redir` local directo.
- `POST /api/auth/logout` — destruye sesión + limpia `hub_sess` y `hub_user`. `POST /api/auth/logout-all` — stub no-op.
- `GET /api/health` — `HEAD` a cada `app.url`, `{ id, ok, status, ms }`, cache 5 min.

### Registro de apps

`src/data/apps.json` — única fuente. `src/lib/apps.ts` (`getAllApps()`, `getSsoApps()`, `findApp(id)`, `isSsoApp(id)`). Campo `sso: boolean` distingue internas (`false`, acceso por cookie directa) de externas (`true`, flujo exchange). Todas las sub-apps actuales son internas.

## Request lifecycle (página con auth)

```ts
// src/pages/media/index.astro (todas las sub-apps igual)
export const prerender = false;
const sessionId = readCookie(Astro.request);
const sess = sessionId ? await lookupSession(env.AUTH_DB, sessionId) : null;
if (!sess) return Astro.redirect('/?next=' + encodeURIComponent('/media'));
const items = await listMedia(env.AUTH_DB, sess.username);
```

- `prerender: false` para que Astro no intente SSG.
- Cliente: filtros/búsqueda/dropdowns 100 % en memoria; mutaciones vía `fetch` a `/<sub-app>/api/*` + eventos `*:added` / `*:edited` para actualizar el DOM sin reload.

## Estructura del proyecto

Ver [INDEX.md](../INDEX.md) para el árbol completo. Resumen:

```
src/
  data/apps.json
  components/{Header,ThemeToggle,StatusDot,AppCard,AppGrid,SearchBar}.astro
  components/{d2,uma,subs,games,media,manga,books,anime,zzz}/
  layouts/BaseLayout.astro
  lib/{auth,internal,apps,types}.ts
  lib/{d2,games,subs,uma,media,manga,books,anime,zzz}/
  pages/{index,login,signup}.astro
  pages/api/{health,redir,auth/*}
  pages/{destiny,umamusume,subs,games,media,manga,books,anime,zzz}/
  styles/global.css
scripts/build-{d2-manifest,uma-data,zzz-data}.mjs
data/{d2,uma,zzz}/
migrations/0001_*.sql … 0019_zzz_position.sql
```
