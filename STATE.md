# STATE — ArthurAppHub

Estado actual y plan de migración a **Identity Provider** (SSO multi-app).
Última actualización: 2026-07-28.

## ¿Qué está hecho?

- Grid responsivo de tarjetas (`src/data/apps.json`), tema dark grey + white details (`DESIGN.md`), toggle de tema, status dots online/offline.
- Cloudflare Worker (`arthurapphub.arthurbluthtt.workers.dev`), deployed y autodeploy via `.github/workflows/deploy.yml`.
- Build pasa limpio, deploys en ~30 s.
- Click en cards abre en misma pestaña (sin `target="_blank"`).
- `apps.json` apunta a `https://notes-app.arthurbluthtt.workers.dev` para Notas.
- **Identity Provider (hub)**:
  - D1 `arthurapphub-auth-db` con tablas `pin_credentials`, `sessions`, `auth_codes` (migración `0001_auth_init.sql`).
  - Secrets `AUTH_PEPPER`, `INTERNAL_API_SECRET` configurados en `arthurapphub` y `notes-app`.
  - `INTERNAL_API_SECRET` también en GH Secrets de ambos repos.
  - Páginas `/login`, `/signup` con form de PIN (4 dígitos, sin confirmación).
  - API: `/api/auth/issue` (cookie → code), `/api/auth/exchange` (Bearer + code → session_token + pin_hash), `/api/auth/logout` (limpia cookie hub), `/api/auth/logout-all` (stub simétrico).
  - `/api/redir?app=<id>`: si hay sesión → 302 a `${app.url}/api/auth/exchange?code=...`; si no → 302 a `/login?next=...`.
  - `apps.json` migrado: cada app tiene `url` (health check, base para redir) y `redir` (path en el hub). id del app Notas = `notes-app`.
  - Algoritmo: PIN → `pin_hash_hub` (PBKDF2-SHA256, salt `arthurapphub-auth-v1`, pepper AUTH_PEPPER, 100k iter). Por app, `pin_hash = sha256(pin_hash_hub + ":" + app_id + ":" + pepper)`.
  - End-to-end probado vía curl: login → redir → exchange devuelve `session_token` + `pin_hash` + `expires_at`.
  - Astro v7: usa `import { env } from "cloudflare:workers"` (no `Astro.locals.runtime.env`).

## ¿Qué viene? — SSO multi-app

**Objetivo**: el hub maneja el PIN (login + signup). Las apps vinculadas (Notas hoy; futuras tareas / pronóstico / etc.) consumen identidad via exchange code. El usuario entra su PIN una sola vez y queda autenticado en todas las apps.

### Decisiones tomadas

- **SSO completo** (multi-app desde día 1).
- Auth UI **solo en hub**. Notes-app sin login propio.
- `/login` del hub: form de login por default, link "Crear PIN" abajo.
- Sin confirmación de PIN cuando se crea.
- Secret compartido: 64 chars alfanuméricos random.

### Pasos pendientes (en orden)

#### Preparación

- [x] Generar `INTERNAL_API_SECRET` (64 chars random) → `~/.config/cloudflare-tokens/shared-secret.txt`.
- [x] `wrangler secret put INTERNAL_API_SECRET --name arthurapphub`
- [x] `wrangler secret put INTERNAL_API_SECRET --name notes-app`
- [x] Agregar secret a GH: `arthurbluthtt/arthurapphub` y `arthurbluthtt/arthurappnotes`.

#### Hub — Identity Provider

- [x] Crear D1 `arthurapphub-auth-db` (separado del actual `arthurapphub-db`).
- [x] Crear `migrations/0001_auth_init.sql` con tablas `pin_credentials`, `sessions`, `auth_codes`.
- [x] `wrangler d1 migrations apply arthurapphub-auth-db --remote`.
- [x] Actualizar `wrangler.jsonc`: binding `AUTH_DB` apuntando a `arthurapphub-auth-db`.
- [x] Crear `src/lib/auth.ts` con: `hashPin`, `createSession`, `lookupSession`, `destroySession`, `getPinHash`, `createAuthCode`, `consumeAuthCode`, `revokeAllSessions`, `deriveAppPinHash`. Reusa `AUTH_PEPPER`.
- [x] Crear `src/lib/internal.ts` con `verifyInternal(request)` y helpers JSON.
- [x] Crear `src/pages/login.astro` (form + link a signup + manejo de next).
- [x] Crear `src/pages/signup.astro` (input único + creación de PIN).
- [x] Crear `src/pages/api/auth/issue.ts` (POST): cookie → code (60 s TTL).
- [x] Crear `src/pages/api/auth/exchange.ts` (POST): Bearer + code → session_token + pin_hash + expires_at.
- [x] Crear `src/pages/api/auth/logout-all.ts` (POST): stub simétrico con Bearer.
- [x] Crear `src/pages/api/redir.ts` (GET): redirige a `${app.url}/api/auth/exchange?code=...` o a `/login?next=...`.
- [x] Crear `src/pages/api/auth/logout.ts` (POST/GET): destruye sesión hub + limpia cookie.
- [x] Cambiar `apps.json` para apuntar a `/api/redir?app=<id>` (vía campo `redir`).
- [x] Build + deploy + verificar flujo end-to-end con curl.

#### Notes-App — relying party (en `STATE.md` de arthurappnotes)

- [x] Agregar binding `HUB_URL` (var) y `INTERNAL_API_SECRET` (secret) en wrangler.jsonc.
- [x] Crear `src/lib/internal.ts` con helper `callHub(path, body)`.
- [x] Crear `src/pages/api/auth/exchange.ts` (GET):
  - Query: `?code=...`.
  - Llama `${HUB_URL}/api/auth/exchange` con Bearer secret + body `{code, app: 'notes-app'}`.
  - Guarda `session_token` en `sessions` local (tabla existente).
  - Setea cookie `arthurappnotes_sess`.
  - Redirige a `/app`.
- [x] Crear `src/pages/index.astro` minimal: sin cookie → "Ir al hub" con link a `${HUB_URL}/api/redir?app=notes-app`. Con cookie → redirect `/app`.
- [x] Borrar `src/pages/login.astro` y la lógica de signup local (ya no aplica).
- [x] Middleware: actualizar `PUBLIC_PATHS` para incluir `/` y eliminar `/login`.
- [x] Logout: limpiar cookie local + POST a `${HUB_URL}/api/auth/logout-all` best-effort.
- [x] Build + deploy + verificar flujo end-to-end.

### Recap de credenciales actuales

| Recurso | Valor |
|---|---|
| Repo | github.com/arthurbluthtt/arthurapphub |
| Worker | arthurapphub |
| URL producción | https://arthurapphub.arthurbluthtt.workers.dev |
| D1 auth | arthurapphub-auth-db (id `09663bc8-89c0-422f-833f-de9f48b0a8ab`) |
| GH Secrets set | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `INTERNAL_API_SECRET` |
| Worker Secrets | `AUTH_PEPPER` (nuevo, 64 chars random en `~/.config/cloudflare-tokens/hub-pepper.txt`), `INTERNAL_API_SECRET` (en `~/.config/cloudflare-tokens/shared-secret.txt`) |
| CF API Token | (cuenta completa — ver `~/.config/cloudflare-tokens/account-wide.pat`, no commitear valor) |
| CF Account ID | (ver `~/.config/cloudflare-tokens/account-id.txt`, no commitear valor) |
| Token guardado en | `~/.config/cloudflare-tokens/account-wide.pat` |
| Diseño canónico | `DESIGN.md` (paleta, tipografía, componentes) |

### Riesgos remanentes

- **Hub caído**: notes-app no se puede autenticar (mitigado mostrando pantalla con "Ir al hub").
- **CF Bot Fight Mode** en fetch server-to-server: voy a setear `User-Agent: arthurappnotes-internal/1.0`.
- **Apps futuras** deben implementar `/api/auth/exchange?code=...` (5-10 líneas cada una).
- **CSRF**: Astro v7 bloquea POST sin Origin. Login/signup/logout en el hub son formularios del mismo sitio → OK con Origin implícito del browser. Endpoints JSON (/api/auth/issue, /api/auth/exchange, /api/auth/logout-all) no disparan CSRF porque no son form-like.
- **Logout no revoca sesiones de apps**: el botón "Salir" del hub solo limpia la cookie del hub; las cookies de las apps siguen vivas hasta expirar (90 días). Mejora futura: tracking de sesiones por app.

### Tiempo estimado restante

~0 min — SSO multi-app end-to-end funcionando.

### Notas para retomar

- Empezar por notes-app: agregar `HUB_URL` y `INTERNAL_API_SECRET` al wrangler.jsonc, luego crear `src/pages/api/auth/exchange.ts` (~30 líneas), luego borrar el login local y verificar.
- Si el hub se rompe, `wrangler dev` localmente con `--remote` puede ayudar a debug.
- El session_token del exchange ya viene en el formato que notes-app espera (base64Url de 32 bytes random).
- El pin_hash del exchange se calcula como `sha256(pin_hash_hub + ":" + app_id + ":" + AUTH_PEPPER)` — esto lo derivará el hub, notes-app lo usa como su partition key directamente.