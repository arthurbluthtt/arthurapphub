# STATE — ArthurAppHub

Estado actual del hub como **Identity Provider** (SSO multi-app) + lanzador de apps + sub-app de wishlist de Destiny 2.
Última actualización: 2026-07-28.

## D2 Wishlist — deploy status

- ✅ Migración `0003_d2_wishlist.sql` aplicada a D1 remota.
- ✅ R2 bucket `arthurapphub-d2-assets` creado.
- ✅ Secret `BUNGIE_API_KEY` configurado en el worker.
- ✅ Manifest build descargado: 2058 armas, 875 perks (`data/d2/weapons-index.json` + `data/d2/perks.json`).
- ✅ Build pasa, deploy pasa, smoke test de rutas OK (200/302/401 según corresponde).
- ⏳ `top-picks.json` vacío — pendiente de correr lightggtodim localmente y `npm run build:d2-picks`.
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
- **Manifest** de Bungie (`BUNGIE_API_KEY` secret) → `data/d2/weapons-index.json` + `perks.json` (bundled en el worker).
- **Top picks**: import desde [lightggtodim](https://github.com/CryoTheRenegade/lightggtodim) (DIM-format) → `data/d2/top-picks.json`. Fallback: 2 primeras perks del pool.
- **Iconos**: primer hit → R2 (`arthurapphub-d2-assets` binding `D2_ASSETS`). Después cache 30 días.
- **D1 tabla `d2_wishlist`** (migración `0003`): `(username, item_hash, weapon_name, weapon_icon_path, top_perk_hashes, found, found_at, added_at)` + índice `(username, found, added_at DESC)`.
- **API**:
  - `GET /destiny/api/search?q=...` — top 10 armas coincidentes (case-insensitive).
  - `POST /destiny/api/add` `{itemHash}` — agrega arma, resuelve top picks o fallback. 409 si duplicado.
  - `POST /destiny/api/remove` `{itemHash}` — DELETE.
  - `POST /destiny/api/toggle-found` `{itemHash}` — toggle found/found_at.
  - `GET /destiny/api/icon?type=weapon|perk&hash=...` — R2 con fallback Bungie CDN.
- **Refresh top picks**: correr lightggtodim localmente → copiar `dist/wishlists/lightgg-popular-pve.txt` → `data/d2/source/dim-popular.txt` → `npm run build:d2-picks` → commit.
- **Header**: muestra `username` en el header (visible solo si hay cookie `hub_user`, leída via JS on page load).
- **Algoritmo PIN**: `PBKDF2-SHA256(pin + ":" + username + ":" + pepper, salt="arthurapphub-auth-v1", 100k iter)`. Username entra al input para evitar colisiones entre usuarios con mismo PIN.
- **Per-app partition key**: `pin_hash_app = sha256(pin_hash_hub + ":" + app_id + ":" + pepper)`. El hub calcula; cada app lo guarda como su propia partition key.
- **Astro v7**: usa `import { env } from "cloudflare:workers"` (no `Astro.locals.runtime.env`).
- End-to-end verificado vía curl: login → redir → exchange devuelve `session_token` + `pin_hash` + `expires_at`.

## Próximo

El SSO funciona end-to-end con notes-app. Las ideas para seguir:

- Agregar una segunda app al SSO (5-10 líneas en la nueva app + 2 entradas en el hub).
- Si se quiere extender más allá del círculo personal, mejorar el handler de errores en `/api/redir` cuando el hub está caído (ya muestra la pantalla de notes-app).
- Considerar mover el `+ Lista` style button al hub para que las apps tengan sus propias acciones rápidas (no aplica — el hub solo lanza apps).
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
- **`AUTH_PEPPER` de notes-app es legacy**: el hub ahora deriva todo. Se puede limpiar para reducir superficie.