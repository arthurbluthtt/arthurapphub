# ArthurAppHub

Hub personal de apps **y** Identity Provider (SSO) para todas las apps vinculadas.
Construido con [Astro](https://astro.build), [Tailwind CSS 4](https://tailwindcss.com/) y desplegado como [Cloudflare Worker](https://workers.cloudflare.com/).

URL: <https://arthurapphub.arthurbluthtt.workers.dev>

## Qué hace

- **Lanzador de apps**: grid responsivo de tarjetas (ícono + nombre + descripción + link), tema dark/light persistente, indicador online/offline por app.
- **Identity Provider**: el hub maneja la auth (username + PIN de 4 dígitos). Las apps vinculadas (hoy solo Notas) consumen identidad via exchange code. Una vez que el usuario entra su PIN en el hub, queda autenticado en todas las apps.

## Estado actual

- Grid responsivo de tarjetas (`src/data/apps.json`).
- Toggle dark/light persistente (`localStorage`, respeta `prefers-color-scheme`).
- Indicador online/offline por app (ping `HEAD` al endpoint `/api/health`).
- Static assets servidos por la binding `ASSETS` desde Cloudflare.
- Click en cada tarjeta abre en la **misma pestaña**.
- Auto-deploy en cada `push` a `main` vía GitHub Action.

### Auth (Identity Provider)

- **Login en el home** (`/`): si no hay sesión, el mismo home muestra el form de username + PIN. Con sesión, muestra el grid de apps. `/login` queda como shim que redirige a `/`.
- **Multi-usuario**: cada usuario tiene su propio `username` (normalizado lowercase, `[a-z0-9_-]{3,20}`) y su propio PIN. El username entra al input del PBKDF2, así dos usuarios con el mismo PIN no colisionan.
- **Mismo error** para "usuario no existe" y "PIN incorrecto" — evita enumeración.
- **Algoritmo PIN**: `PBKDF2-SHA256(pin + ":" + username + ":" + AUTH_PEPPER, salt="arthurapphub-auth-v1", 100k iter)`.
- **Per-app partition key**: `pin_hash = sha256(pin_hash_hub + ":" + app_id + ":" + pepper)`. El hub calcula, la app solo guarda.
- **Sesión**: cookie `hub_sess` HttpOnly + cookie companion `hub_user` (no-HttpOnly, para mostrar username en el header).
- **Códigos de exchange**: 60 s TTL, single-use. La app los consume via POST `/api/auth/exchange` con Bearer `INTERNAL_API_SECRET`.

## Estructura

- `src/data/apps.json` — lista editable de apps (cada app tiene `url` para health check + `redir` que apunta a `/api/redir?app=<id>`).
- `src/components/` — `AppCard`, `AppGrid`, `Header`, `ThemeToggle`, `StatusDot`.
- `src/pages/index.astro` — login (sin sesión) o grid de apps (con sesión).
- `src/pages/signup.astro` — crear usuario.
- `src/pages/login.astro` — shim que redirige a `/`.
- `src/pages/api/health.ts` — endpoint SSR que hace `HEAD` a cada `app.url` y devuelve estado online/offline (cache 5 min).
- `src/pages/api/redir.ts` — genera code + redirige a `${app.url}/api/auth/exchange?code=...` (o a `/login?next=...` si no hay sesión).
- `src/pages/api/auth/issue.ts` — emite code (POST, cookie).
- `src/pages/api/auth/exchange.ts` — consume code (POST, Bearer).
- `src/pages/api/auth/logout.ts` — destruye sesión hub + limpia cookies.
- `src/pages/api/auth/logout-all.ts` — stub simétrico (no-op hoy).
- `src/lib/auth.ts` — `hashPin`, `createSession`, `lookupSession`, `createAuthCode`, `consumeAuthCode`, `deriveAppPinHash`, helpers de cookie.
- `src/lib/internal.ts` — `verifyInternal`, helpers JSON.
- `migrations/0001_auth_init.sql` — tablas `pin_credentials`, `sessions`, `auth_codes`.
- `migrations/0002_username.sql` — borra `default` legacy, reemplaza `pin_credentials.user_id` con `username`.
- `DESIGN.md` — sistema de diseño (paleta, tipografía, componentes). Single source of truth.
- `astro.config.mjs` — adapter Cloudflare (Workers), Tailwind vía `@tailwindcss/vite`.
- `.github/workflows/deploy.yml` — auto-deploy a Cloudflare Workers en cada push a `main`.

## Local

```bash
npm install
npm run dev                # http://localhost:4321
npm run build              # genera dist/
npx wrangler dev           # simula el worker localmente
```

Requisitos: Node 22.12+.

## Deploy

Push a `main` en GitHub dispara `.github/workflows/deploy.yml`:

1. `npm ci` + `npm run build`
2. `wrangler deploy` con `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` en el repo (GitHub → Settings → Secrets and variables → Actions).

## Agregar una app nueva

1. Sumar entrada en `src/data/apps.json`:

```json
{
  "id": "mi-app",
  "name": "Mi App",
  "description": "Una línea explicando qué hace",
  "url": "https://app.example.com",
  "redir": "/api/redir?app=mi-app",
  "icon": "🚀",
  "category": "productividad",
  "tags": ["tag1"],
  "featured": false
}
```

2. La app debe implementar `GET /api/auth/exchange?code=...` que llame a `${HUB_URL}/api/auth/exchange` con `Authorization: Bearer ${INTERNAL_API_SECRET}` y body `{code, app: 'mi-app'}`. Recibirá `{session_token, pin_hash, expires_at}` y deberá almacenar la sesión + setear su propia cookie.
3. Registrar el `app_id` en `ALLOWED_APPS` (en `src/pages/api/auth/issue.ts`) y `KNOWN_APPS` (en `src/pages/api/auth/exchange.ts`).
4. Commit + push → redeploy automático.

## Features

- Grid responsive de tarjetas con ícono, nombre, descripción y link.
- Toggle dark/light persistente.
- Indicador online/offline por app.
- Static assets servidos por la binding `ASSETS`.
- Identity Provider multi-usuario con username + PIN.
- SSO via exchange code hacia apps vinculadas.
- **Sub-app `/destiny`** — wishlist de armas de Destiny 2 con autocompletado desde el manifest oficial de Bungie, perks "más usadas" importadas desde [lightggtodim](https://github.com/CryoTheRenegade/lightggtodim), imágenes cacheadas en R2, filtro (Pendientes/Encontradas/Todas), botón para marcar armas como conseguidas.

Ver `STATE.md` para el plan completo y la historia del proyecto.

## D2 Wishlist (sub-app)

Una página interna en `/destiny` que mantiene una wishlist personal de armas de Destiny 2 con las perks más populares según la comunidad (vía lightggtodim).

### Datos

- **Manifest**: `data/d2/weapons-index.json` + `data/d2/perks.json` generados con `npm run build:d2-manifest`. Necesita `BUNGIE_API_KEY` (gratis en https://www.bungie.net/en/Application).
- **Top picks**: `data/d2/top-picks.json` generado con `npm run build:d2-picks`. Lee `data/d2/source/dim-popular.txt` (output de lightggtodim en formato DIM-wishlist).
- **Iconos**: primer hit baja desde Bungie CDN → se guarda en R2 (`arthurapphub-d2-assets`). Después se sirve desde R2 con cache de 30 días.

### Storage

- D1 tabla `d2_wishlist` (migración `migrations/0003_d2_wishlist.sql`): `(username, item_hash, weapon_name, weapon_icon_path, top_perk_hashes, found, found_at, added_at)`.
- R2 bucket `arthurapphub-d2-assets`: `weapons/<hash>.png` + `perks/<hash>.png`.

### Refrescar top picks (~cada season de D2)

```bash
# 1. En una copia local de lightggtodim:
pnpm generate

# 2. Copiar el output a este repo:
cp dist/wishlists/lightgg-popular-pve.txt ../arthurapphub/data/d2/source/dim-popular.txt

# 3. Regenerar el JSON consumido por el hub:
cd ../arthurapphub
npm run build:d2-picks
git add data/d2/top-picks.json && git commit -m "d2: refresh top picks" && git push
```