# ArthurAppHub

Hub personal de apps **y** **Identity Provider (SSO)** para todas las apps vinculadas. Construido con [Astro](https://astro.build), [Tailwind CSS 4](https://tailwindcss.com/) y desplegado como [Cloudflare Worker](https://workers.cloudflare.com/).

URL: <https://arthurapphub.arthurbluthtt.workers.dev>

## Qué hace

- **Lanzador de apps**: grid responsivo de tarjetas (ícono + nombre + descripción + link), tema dark/light persistente, indicador online/offline por app.
- **Identity Provider (SSO)**: el hub maneja la auth (username + PIN de 4 dígitos). Las apps vinculadas consumen identidad vía exchange code. Una vez que el usuario entra su PIN en el hub, queda autenticado en todas las apps.
- **Sub-app `/destiny`**: wishlist de armas de Destiny 2 con búsqueda desde el manifest oficial de Bungie, selección manual de perks (Cañón / Cargador / Rasgo 1 / Rasgo 2), iconos custom, filtros por estado y tipo de arma.

## Estado actual

- Grid responsivo de tarjetas (`src/data/apps.json`).
- Toggle dark/light persistente (`localStorage`, respeta `prefers-color-scheme`).
- `color-scheme: light/dark` sincronizado en `<html>` para que form controls nativos (options de `<select>`, scrollbars) respeten el tema.
- Indicador online/offline por app (HEAD al endpoint `/api/health`, cache 5 min).
- Static assets servidos por el worker.
- Click en cada tarjeta abre en la **misma pestaña**.
- Auto-deploy en cada `push` a `main` vía GitHub Action (~30 s).

### Auth (Identity Provider)

- **Login en el home** (`/`): si no hay sesión, el mismo home muestra el form de username + PIN. Con sesión, muestra el grid de apps. `/login` queda como shim que redirige a `/`.
- **Multi-usuario**: cada usuario tiene su propio `username` (normalizado lowercase, `[a-z0-9_-]{3,20}`) y su propio PIN. El username entra al input del PBKDF2, así dos usuarios con el mismo PIN no colisionan.
- **Mismo error** para "usuario no existe" y "PIN incorrecto" — evita enumeración.
- **Algoritmo PIN**: `PBKDF2-SHA256(pin + ":" + username + ":" + AUTH_PEPPER, salt="arthurapphub-auth-v1", 100k iter)`.
- **Per-app partition key**: `pin_hash = sha256(pin_hash_hub + ":" + app_id + ":" + pepper)`. El hub calcula, la app solo guarda.
- **Sesión**: cookie `hub_sess` HttpOnly + cookie companion `hub_user` (no-HttpOnly, para mostrar username en el header).
- **Códigos de exchange**: 60 s TTL, single-use. La app los consume vía `POST /api/auth/exchange` con Bearer `INTERNAL_API_SECRET`.

## Estructura

```
src/
├── data/
│   └── apps.json                       # lista editable de apps
├── components/
│   ├── Header.astro
│   ├── ThemeToggle.astro
│   ├── StatusDot.astro
│   ├── AppCard.astro
│   ├── AppGrid.astro
│   └── d2/                             # componentes sub-app D2
│       ├── AddWeaponDialog.astro       # modal: search arma + 4 inputs perk
│       ├── CustomPerkIconDialog.astro  # modal: pool de iconos custom
│       ├── PerkSuggestionDropdown...   # (legacy, integrado en AddWeaponDialog)
│       ├── WeaponCard.astro            # card de arma en wishlist
│       └── WeaponFilters.astro         # chips de filtro
├── layouts/
│   └── BaseLayout.astro
├── lib/
│   ├── auth.ts                         # hashPin, sesiones, codes, deriveAppPinHash
│   ├── internal.ts                     # verifyInternal, helpers JSON
│   └── d2/
│       ├── manifest.ts                 # lookup de armas y perks
│       ├── wishlist.ts                 # CRUD de d2_wishlist
│       ├── perkIcons.ts                # CRUD de d2_perk_icons
│       └── resolver.ts                 # resolveWishlistRow(row)
├── pages/
│   ├── index.astro                     # login (sin sesión) o grid (con sesión)
│   ├── signup.astro
│   ├── login.astro                     # shim → /
│   ├── api/
│   │   ├── health.ts                   # status por app (HEAD)
│   │   ├── redir.ts                    # genera code + redirige a la app
│   │   └── auth/
│   │       ├── issue.ts                # cookie → code
│   │       ├── exchange.ts             # code → {session_token, pin_hash, expires_at}
│   │       ├── logout.ts               # destruye sesión hub
│   │       └── logout-all.ts           # stub simétrico (no-op hoy)
│   └── destiny/
│       ├── index.astro                 # página /destiny (wishlist)
│       └── api/
│           ├── search.ts               # autocomplete armas
│           ├── add.ts                  # POST: agregar arma
│           ├── update.ts               # POST: editar perks
│           ├── remove.ts               # POST: eliminar
│           ├── toggle-found.ts         # POST: toggle found
│           ├── icon.ts                 # proxy R2 con fallback Bungie
│           ├── perk-icon.ts            # GET/POST: pool de iconos custom
│           └── perks/
│               └── match.ts            # GET: perks elegibles por slot
├── styles/
│   └── global.css                      # tokens + color-scheme
└── env.d.ts

migrations/
├── 0001_auth_init.sql
├── 0002_username.sql
├── 0003_d2_wishlist.sql
├── 0004_d2_wishlist_perks_json.sql
├── 0005_drop_top_perk_hashes.sql
├── 0006_d2_perk_icons.sql
└── 0007_d2_perk_icons_category.sql

data/d2/
├── weapons-index.json                  # generado por build:d2-manifest
└── perks.json                          # generado por build:d2-manifest

DESIGN.md                               # sistema de diseño (single source of truth)
STATE.md                                # estado + próximos pasos + recap credenciales
astro.config.mjs                        # adapter Cloudflare (Workers), Tailwind 4
.github/workflows/deploy.yml            # auto-deploy a Cloudflare Workers en cada push a main
```

## Local

```bash
npm install
npm run dev                # http://localhost:4321
npm run build              # genera dist/
npx wrangler dev           # simula el worker localmente (con bindings remotos)
```

Requisitos: Node 22.12+.

## Deploy

Push a `main` en GitHub dispara `.github/workflows/deploy.yml`:

1. `npm ci` + `npm run build`
2. `wrangler deploy` con `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` en el repo (GitHub → Settings → Secrets and variables → Actions).

## Agregar una app nueva

El registro vive en un solo lugar: `src/data/apps.json`. Solo se modifica **un archivo** + la app externa implementa su endpoint `/api/auth/exchange` (si es app externa con SSO).

### App interna (sin SSO — accede con cookie `hub_sess` directa)

```json
{
  "id": "mi-app-interna",
  "name": "Mi App",
  "description": "Una línea explicando qué hace",
  "url": "/mi-app",
  "redir": "/mi-app",
  "icon": "🚀",
  "category": "productividad",
  "tags": ["tag1"],
  "featured": false,
  "sso": false
}
```

Si `sso` se omite o es `false`, la app es interna. La card del grid navega directo a `redir`. Si se accede manualmente y no hay sesión, la app redirige a `/?next=...` y maneja su propio gate.

### App externa (con SSO — flujo exchange code)

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
  "featured": false,
  "sso": true
}
```

Con `sso: true`, el hub autoriza a la app a pedir codes (`/api/auth/issue`), consumirlos (`/api/auth/exchange`) y notificar sign-outs (`/api/auth/logout-all`). La app debe implementar `GET|POST /api/auth/exchange?code=...` que llame a `${HUB_URL}/api/auth/exchange` con `Authorization: Bearer ${INTERNAL_API_SECRET}` y body `{code, app: 'mi-app'}`. Recibirá `{session_token, pin_hash, expires_at}` y deberá almacenar la sesión + setear su propia cookie.

La lista de apps con SSO se deriva automáticamente desde `apps.json` vía `lib/apps.ts → isSsoApp(id)`. No hay que tocar handlers ni sets hardcoded.

Commit + push → redeploy automático.

## Features

- Grid responsive de tarjetas con ícono, nombre, descripción y link.
- Toggle dark/light persistente + `color-scheme` sincronizado (form controls nativos respetan el tema).
- Indicador online/offline por app.
- Identity Provider multi-usuario con username + PIN.
- SSO vía exchange code hacia apps vinculadas.
- Header con username del usuario logueado + botón "Salir".
- **Sub-app `/destiny`** — wishlist de armas de Destiny 2.

## D2 Wishlist (sub-app interna)

Una página en `/destiny` (login requerido) que mantiene una wishlist personal de armas de Destiny 2. Al agregar un arma, abrís un modal con 4 inputs manuales para los perks (Cañón, Cargador, Rasgo 1, Rasgo 2) — el server los busca por nombre en el manifest oficial y, si no existen, los guarda como "custom" con placeholder SVG.

### Datos

- **Manifest**: `data/d2/weapons-index.json` + `data/d2/perks.json` generados con `npm run build:d2-manifest`. Necesita `BUNGIE_API_KEY` (gratis en https://www.bungie.net/en/Application).
  - 2058 armas con `weaponType` real (Hand Cannon, Auto Rifle, etc.) vía `DestinyItemCategoryDefinition`.
  - 2000 perks con `category` real (`Barrel` / `Magazine` / `Trait`) vía `itemTypeDisplayName`.
- **Sub-categorías del manifest mapeadas a slots canónicos**: Bungie tiene muchas sub-categorías para armas especiales que son funcionalmente Barrel o Magazine pero el manifest las etiqueta distinto. El endpoint aplica una whitelist por slot:
  - `barrel` ← {Barrel, Bowstring, Scope, Sight, Launcher Barrel, Guard, Enhanced Guard, Stock, Grip, Grips, Handle, Tang, Rail, Praxic Blade Form}
  - `magazine` ← {Magazine, Battery, Arrow}
  - `perk1`/`perk2` ← {Trait, Enhanced Trait}
- **Blacklist global**: Intrinsic, Weapon Ornament, Origin Trait, Enhanced Origin Trait, Weapon Mod, Enhanced Weapon Mod, Memento, Shader, Combat Flair, Resonant Material, Restore Defaults — nunca son perks trackeables y se filtran en todos los slots.
- **Normalización al slot al guardar**: `add.ts`/`update.ts` usan `SLOT_CATEGORY` para que la perk guardada tenga la categoría del slot donde el usuario la puso (no la del manifest). Así "Agile Bowstring" (Trait en manifest) guardada en magazine slot queda con `category: 'Magazine'` y aparece correctamente en futuras aperturas.
- **Fallback de categoría legacy**: si el manifest no tiene `category`, el endpoint `perks/match` clasifica por regex (`barrel|sights|scope|launcher` → barrel; `mag|magazine|rounds|cartridge|battery` → magazine; resto → trait). Es heurístico — un rebuild del manifest elimina la dependencia.
- **Iconos**: primer hit baja desde Bungie CDN → se guarda en R2 (`arthurapphub-d2-assets` binding `D2_ASSETS`). Después se sirve desde R2 con cache de 30 días.
- **Iconos custom**: pool personal del usuario en `d2_perk_icons`. Cada icono tiene `category` asignable (Cañón/Cargador/Rasgo/Sin tipo) para que el picker los filtre correctamente.

### Storage

- D1 tabla `d2_wishlist` (migraciones `0003` + `0004` + `0005`): `(username, item_hash, weapon_name, weapon_icon_path, perks_json, found, found_at, added_at)` + índice `(username, found, added_at DESC)`. Cada fila guarda 4 perks en `perks_json` como `{name, hash, icon, category}` por slot.
- D1 tabla `d2_perk_icons` (migraciones `0006` + `0007`): `(username, perk_name_lower, perk_name_display, icon_path, category, created_at)`.
- R2 bucket `arthurapphub-d2-assets`: `weapons/<hash>.png` + `perks/<hash>.png`.

### UX

- **Filtros por estado** (Todas/Pendientes/Encontradas) + **por tipo de arma** (chips pill con conteo).
- **Type-ahead en inputs de perk**: tres fuentes combinadas con dedup por nombre — (1) perks ya guardadas por el usuario (`d2_wishlist.perks_json`), (2) pool de iconos custom (`d2_perk_icons`), (3) fallback al manifest de Bungie (`listAllPerks()`) **solo cuando hay `q`** para no abrumar con 2000 perks cuando el dropdown abre vacío. Permite typeahead cross-categoría (e.g. tipear "bowstring" en slot magazine).
- **Orden por uso**: `countPerkUses()` cuenta ocurrencias de cada nombre en la wishlist del usuario. Sort: `_score` ASC → `useCount` DESC → nombre ASC. Chip `×N` al lado del nombre cuando `useCount > 1` con tooltip "Usada en N armas".
- **Dropdown fixed-position**: `position:fixed` con coordenadas del viewport (`getBoundingClientRect()` + `z-index:9999`) para escapar el clipping del `<dialog>`. **Atomic reveal**: `position:fixed` + coords se aplican **antes** de remover `hidden` — el navegador nunca ve el dropdown con `position:static` (causaba bug "a la mitad").
- **Re-posicionamiento**: en scroll/resize del window, con filtro para no reposicionar cuando el scroll es interno al propio dropdown.
- **`state.perkConfirmed[slot]`**: evita que el dropdown se reabra con la perk recién seleccionada cuando el usuario vuelve a hacer focus en el input.
- **Sin auto-focus**: el primer perk input no recibe focus automático al abrir el modal de perks (el focus listener disparaba el dropdown). El usuario hace click cuando quiere tipear.
- **Dialogs robustos**: `overflow-y-auto` + `overscroll-contain` (scroll interno no propaga al body) + `lockBodyScroll()` (lockea `body.overflow:hidden` con compensación de scrollbar para evitar layout shift al abrir/cerrar).

### Refrescar manifest (~cada season de D2)

```bash
BUNGIE_API_KEY=<key> npm run build:d2-manifest
git add data/d2/weapons-index.json data/d2/perks.json
git commit -m "d2: refresh manifest" && git push
```

Ver `STATE.md` para el plan completo, próximos pasos y la historia del proyecto.