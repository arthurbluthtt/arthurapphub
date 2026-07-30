# STATE — ArthurAppHub

Estado actual del hub como **Identity Provider** (SSO multi-app) + lanzador de apps + sub-app de wishlist de Destiny 2.
Última actualización: 2026-07-28.

## D2 Wishlist — deploy status

- ✅ Migración `0003_d2_wishlist.sql` aplicada a D1 remota.
- ✅ R2 bucket `arthurapphub-d2-assets` creado.
- ✅ Secret `BUNGIE_API_KEY` configurado en el worker.
- ✅ Manifest build descargado: 2058 armas, 875 perks (`data/d2/weapons-index.json` + `data/d2/perks.json`).
- ✅ Build pasa, deploy pasa, smoke test de rutas OK (200/302/401 según corresponde).
- ✅ **Selección manual de perks**: al agregar un arma, la app lista sus perks (barrel → mag → trait) y el usuario elige 2. Ya no se auto-aplica top picks.
- ⏳ Manifest `category` enriquecido: pendiente re-correr `BUNGIE_API_KEY=... npm run build:d2-manifest` (el fallback por nombre funciona hasta entonces).
- ⏳ Smoke test end-to-end (login → agregar arma → ver card) requiere sesión del browser.

## ¿Qué está hecho?

- Grid responsivo de tarjetas (`src/data/apps.json`), tema dark grey + white details (`DESIGN.md`), toggle de tema, status dots online/offline.
- Cloudflare Worker (`arthurapphub.arthurbluthtt.workers.dev`), deployed y autodeploy via `.github/workflows/deploy.yml`.
- Build pasa limpio, deploys en ~30 s.
- Click en cards abre en misma pestaña (sin `target="_blank"`).
- `apps.json` apunta a `https://notes-app.arthurbluthtt.workers.dev` para Notas.

### Identity Provider

- **D1 `arthurapphub-auth-db`** con tablas `pin_credentials` (PK username), `sessions`, `auth_codes`.
- **Migraciones aplicadas**: `0001_auth_init.sql`, `0002_username.sql` (reemplazó `default` legacy con `username`).
- **Secrets**: `AUTH_PEPPER` y `INTERNAL_API_SECRET` configurados en `arthurapphub` y en `notes-app`. También en GH Secrets de ambos repos.
- **Páginas**:
  - `/` (index.astro): si no hay sesión → form de login (username + PIN). Si hay sesión → grid de apps. Title cambia según contexto.
  - `/signup`: crear usuario (username + PIN, sin confirmación).
  - `/login`: shim que redirige a `/` (preserva `?next=`).
- **API**:
  - `POST /api/auth/issue` — cookie → code (60 s TTL, app=notes-app).
  - `POST /api/auth/exchange` — Bearer + `{code, app}` → `{session_token, pin_hash, expires_at}`.
  - `POST/GET /api/auth/logout` — destruye sesión hub + limpia cookies (`hub_sess` y `hub_user`).
  - `POST /api/auth/logout-all` — stub simétrico (no-op; el hub no trackea sesiones por app).
  - `GET /api/redir?app=<id>` — con sesión: code + 302 a `${app.url}/api/auth/exchange?code=...`. Sin sesión: 302 a `/login?next=...`.
  - `GET /api/health` — HEAD a cada `app.url`, devuelve `{id, ok, status, ms}` con cache 5 min.

### D2 Wishlist (sub-app interna)

- **Página `/destiny`** (login requerido): wishlist de armas de Destiny 2 con filtro (Pendientes/Encontradas/Todas), botón para marcar como encontrada, agregar por nombre con autocomplete desde el manifest de Bungie.
- **Manifest** de Bungie (`BUNGIE_API_KEY` secret) → `data/d2/weapons-index.json` + `perks.json` (bundled en el worker). El build ahora incluye `perk.category` desde `itemTypeDisplayName` de Bungie.
- **Selección manual de perks** (`PerkPicker`): al agregar un arma, el picker lista las perks del `perkPoolHashes` filtradas a categorías `Barrel | Magazine | Trait` (orden: barrel → mag → trait). El usuario elige 2. Fallback por nombre de la perk si `category` está vacío (no se rebuildeó el manifest).
- **Top picks**: **eliminado**. Ya no se auto-aplican ni se importan desde lightggtodim. `data/d2/top-picks.json` y `scripts/build-d2-top-picks.mjs` borrados.
- **Iconos**: primer hit → R2 (`arthurapphub-d2-assets` binding `D2_ASSETS`). Después cache 30 días.
- **D1 tabla `d2_wishlist`** (migration `0003` + `0004` + `0005`): `(username, item_hash, weapon_name, weapon_icon_path, perks_json, found, found_at, added_at)` + índice `(username, found, added_at DESC)`. Cada fila guarda 4 perks (Cañón, Cargador, Rasgo 1, Rasgo 2) en `perks_json`. El usuario tipéa el nombre del perk y el server lo busca por nombre en el manifest; si no existe, se guarda como "custom" con placeholder SVG inline.
- **API**:
  - `GET /destiny/api/search?q=...` — top 10 armas coincidentes (case-insensitive).
  - `GET /destiny/api/weapon-perks?hash=...` — devuelve arma + perks elegibles agrupadas por categoría (para el picker).
  - `POST /destiny/api/add` `{itemHash, perkHashes: [string, string]}` — agrega arma, valida que ambas perks estén en el pool. 409 si duplicado, 400 si perks inválidas.
  - `POST /destiny/api/remove` `{itemHash}` — DELETE.
  - `POST /destiny/api/toggle-found` `{itemHash}` — toggle found/found_at.
  - `GET /destiny/api/icon?type=weapon|perk&hash=...` — R2 con fallback Bungie CDN.
- **Render**: `src/lib/d2/resolver.ts` `resolveWishlistRow(row)` lee perks directo de `row.topPerkHashes` (no de top-picks).
- **Refresh manifest** (sugerido, ~5 min): `BUNGIE_API_KEY=... npm run build:d2-manifest` para poblar `perk.category` real de Bungie.
- **Header**: muestra `username` en el header (visible solo si hay cookie `hub_user`, leída via JS on page load).
- **Algoritmo PIN**: `PBKDF2-SHA256(pin + ":" + username + ":" + pepper, salt="arthurapphub-auth-v1", 100k iter)`. Username entra al input para evitar colisiones entre usuarios con mismo PIN.
- **Per-app partition key**: `pin_hash_app = sha256(pin_hash_hub + ":" + app_id + ":" + pepper)`. El hub calcula; cada app lo guarda como su propia partition key.
- **Astro v7**: usa `import { env } from "cloudflare:workers"` (no `Astro.locals.runtime.env`).
- End-to-end verificado vía curl: login → redir → exchange devuelve `session_token` + `pin_hash` + `expires_at`.

## Próximo

El SSO funciona end-to-end con notes-app y la wishlist de D2 ya toma perks manuales. Las ideas para seguir:

- Re-correr `BUNGIE_API_KEY=... npm run build:d2-manifest` para popular `perk.category` real de Bungie (dejar de depender del fallback por nombre).
- Smoke test end-to-end en el browser (login → /destiny → search → pick → modal → seleccionar 2 perks → agregar → ver card).
- Agregar una segunda app al SSO (5-10 líneas en la nueva app + 2 entradas en el hub).
- Si se quiere extender más allá del círculo personal, mejorar el handler de errores en `/api/redir` cuando el hub está caído (ya muestra la pantalla de notes-app).
- El `AUTH_PEPPER` de notes-app (legacy) ya no se usa — puede limpiarse del worker + GH secret.

### Decisiones tomadas

- **SSO completo** (multi-app desde día 1).
- Auth UI **solo en hub**. Las apps no tienen login propio.
- Login vive en el home (`/`), no en `/login`.
- **Username + PIN** (no solo PIN) para soportar multi-usuario.
- Username normalizado lowercase, `[a-z0-9_-]{3,20}`.
- Sin confirmación de PIN cuando se crea.
- Mismo mensaje de error para "no existe" / "PIN mal" (evita enumeración).
- Secret compartido `INTERNAL_API_SECRET`: 64 chars alfanuméricos random.

## Riesgos remanentes

- **Hub caído**: notes-app muestra pantalla con "Ir al hub". Aceptable para uso personal.
- **CF Bot Fight Mode** en fetch server-to-server: notes-app usa `User-Agent: arthurappnotes-internal/1.0` (no molesta).
- **Apps futuras** deben implementar `/api/auth/exchange?code=...` (5-10 líneas cada una) + registrar el `app_id` en `ALLOWED_APPS` y `KNOWN_APPS`.
- **CSRF**: Astro v7 bloquea POST sin Origin. Login/signup/logout en el hub son formularios del mismo sitio → OK con Origin implícito del browser. Endpoints JSON (`/api/auth/issue`, `/api/auth/exchange`, `/api/auth/logout-all`) no disparan CSRF porque no son form-like.
- **Logout no revoca sesiones de apps**: el botón "Salir" del hub solo limpia la cookie del hub; las cookies de las apps siguen vivas hasta expirar (90 días). Mejora futura: tracking de sesiones por app con `/api/auth/logout-all` real.
- **`AUTH_PEPPER` legacy en notes-app**: ya no se usa para auth (todo viene del hub). Puede borrarse del worker + GH secret.

## Recap de credenciales actuales

| Recurso | Valor |
|---|---|
| Repo | github.com/arthurbluthtt/arthurapphub |
| Worker | arthurapphub |
| URL producción | https://arthurapphub.arthurbluthtt.workers.dev |
| D1 auth | arthurapphub-auth-db (id `09663bc8-89c0-422f-833f-de9f48b0a8ab`) |
| GH Secrets set | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `INTERNAL_API_SECRET` |
| Worker Secrets | `AUTH_PEPPER` (64 chars random en `~/.config/cloudflare-tokens/hub-pepper.txt`), `INTERNAL_API_SECRET` (en `~/.config/cloudflare-tokens/shared-secret.txt`) |
| CF API Token | (cuenta completa — ver `~/.config/cloudflare-tokens/account-wide.pat`, no commitear valor) |
| CF Account ID | (ver `~/.config/cloudflare-tokens/account-id.txt`, no commitear valor) |
| Token guardado en | `~/.config/cloudflare-tokens/account-wide.pat` |
| Diseño canónico | `DESIGN.md` (paleta, tipografía, componentes) |

## Tiempo estimado restante

~0 min — SSO multi-app end-to-end funcionando.

## Notas para retomar

- Empezar por **Próximo** (lista de arriba). Si se agrega una segunda app, basta duplicar el patrón de `src/pages/api/auth/exchange.ts` de notes-app (~30 líneas) y registrar el `app_id` en `ALLOWED_APPS` y `KNOWN_APPS` del hub.
- Si el hub se rompe, `wrangler dev` localmente con `--remote` puede ayudar a debug.
- El `session_token` que el hub emite ya viene en el formato que la app destino espera (base64Url de 32 bytes random).
- El `pin_hash` per-app se calcula en el hub; las apps lo usan directamente como partition key.
- **D2 perk picker**: si el manifest está desactualizado (falta `perk.category`), el fallback por nombre clasifica por regex (`barrel/sights/scope/launcher` → barrel; `mag/magazine/rounds/cartridge/battery` → magazine; resto → trait). Funciona pero es heurístico — un rebuild elimina la dependencia.
- **`AUTH_PEPPER` de notes-app es legacy**: el hub ahora deriva todo. Se puede limpiar para reducir superficie.