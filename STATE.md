# STATE — ArthurAppHub

Estado actual del hub como **Identity Provider** (SSO multi-app) + **lanzador de apps** + **sub-app de wishlist de Destiny 2**.
Última actualización: 2026-07-30.

## AppHub — deploy status

- ✅ Astro v7 + Tailwind 4, deployado como Cloudflare Worker (`arthurapphub.arthurbluthtt.workers.dev`).
- ✅ Auto-deploy en cada push a `main` (`.github/workflows/deploy.yml`), ~30 s.
- ✅ Grid responsivo de tarjetas (`src/data/apps.json`), tema dark/light persistente con `color-scheme` sincronizado (form controls nativos respetan el tema).
- ✅ Status dots online/offline (HEAD a cada `app.url`, cache 5 min).
- ✅ Click en cards abre en la misma pestaña.
- ✅ Container ancho del destiny escalado: `max-w-6xl` (default) → `max-w-[1760px]` en xl → `max-w-[2240px]` en 2xl. Header escalado progresivamente.
- ✅ `apps.json` apunta a `https://notes-app.arthurbluthtt.workers.dev` para Notas (única app vinculada al SSO hoy).

### Identity Provider (SSO multi-app)

- **D1 `arthurapphub-auth-db`** con tablas `pin_credentials` (PK `username`), `sessions`, `auth_codes`.
- **Migraciones aplicadas**: `0001_auth_init.sql`, `0002_username.sql`.
- **Secrets**: `AUTH_PEPPER` y `INTERNAL_API_SECRET` en `arthurapphub` y en `notes-app`. También en GH Secrets de ambos repos.
- **Páginas**:
  - `/` (`index.astro`): si no hay sesión → form de login (username + PIN). Si hay sesión → grid de apps. Title cambia según contexto.
  - `/signup`: crear usuario (username + PIN, sin confirmación).
  - `/login`: shim que redirige a `/` (preserva `?next=`).
- **API**:
  - `POST /api/auth/issue` — cookie → code (60 s TTL, app=`notes-app`).
  - `POST /api/auth/exchange` — Bearer `INTERNAL_API_SECRET` + `{code, app}` → `{session_token, pin_hash, expires_at}`.
  - `POST/GET /api/auth/logout` — destruye sesión hub + limpia cookies (`hub_sess` y `hub_user`).
  - `POST /api/auth/logout-all` — stub simétrico (no-op; el hub no trackea sesiones por app).
  - `GET /api/redir?app=<id>` — con sesión: code + 302 a `${app.url}/api/auth/exchange?code=...`. Sin sesión: 302 a `/login?next=...`.
  - `GET /api/health` — HEAD a cada `app.url`, devuelve `{id, ok, status, ms}` con cache 5 min.
- **Algoritmo PIN**: `PBKDF2-SHA256(pin + ":" + username + ":" + pepper, salt="arthurapphub-auth-v1", 100k iter)`. Username entra al input para evitar colisiones entre usuarios con mismo PIN.
- **Per-app partition key**: `pin_hash_app = sha256(pin_hash_hub + ":" + app_id + ":" + pepper)`. El hub calcula; cada app lo guarda como su propia partition key.
- **Astro v7**: usa `import { env } from "cloudflare:workers"` (no `Astro.locals.runtime.env`).
- End-to-end verificado vía curl: login → redir → exchange devuelve `session_token` + `pin_hash` + `expires_at`.

### Header & UX

- Muestra `username` en el header (visible solo si hay cookie `hub_user`, leída via JS on page load).
- Botón "Salir" limpia cookies del hub (apps siguen con sesión propia hasta expirar).

## D2 Wishlist (sub-app interna) — deploy status

- ✅ Migraciones aplicadas a D1 remota: `0003_d2_wishlist.sql`, `0004_d2_wishlist_perks_json.sql`, `0005_drop_top_perk_hashes.sql`, `0006_d2_perk_icons.sql`, `0007_d2_perk_icons_category.sql`.
- ✅ R2 bucket `arthurapphub-d2-assets` creado (binding `D2_ASSETS`).
- ✅ Secret `BUNGIE_API_KEY` configurado en el worker.
- ✅ Manifest build: 2058 armas con `weaponType` real (Hand Cannon, Auto Rifle, etc — vía `DestinyItemCategoryDefinition`), 2000 perks con `category` real (`Barrel` / `Magazine` / `Trait` vía `itemTypeDisplayName`).
- ✅ Selección manual de **4 perks por arma**: **Cañón / Cargador / Rasgo 1 / Rasgo 2**. Usuario tipéa el nombre; server busca en el manifest por nombre y guarda con `category` normalizada al slot (no del manifest). Perks no encontradas se guardan como "custom" con placeholder SVG inline.
- ✅ Type-ahead en inputs de perk (`/destiny/api/perks/match?q=&slot=&limit=30`). Tres fuentes combinadas con dedup por nombre: (1) userPool de la wishlist del usuario, (2) pool de iconos custom (`d2_perk_icons`), (3) fallback al manifest de Bungie (`listAllPerks()`) **solo cuando hay `q`** para no abrumar con 2000 perks cuando el dropdown abre vacío. Permite typeahead cross-categoría (e.g. tipear "bowstring" en slot magazine).
- ✅ **Whitelist de categorías por slot** en el filtro del dropdown + **blacklist de categorías inválidas**. Map: `barrel` ← {Barrel, Bowstring, Scope, Sight, Launcher Barrel, Guard, Enhanced Guard, Stock, Grip, Grips, Handle, Tang, Rail, Praxic Blade Form}; `magazine` ← {Magazine, Battery, Arrow}; `perk1/perk2` ← {Trait, Enhanced Trait}. Blacklist global: Intrinsic, Weapon Ornament, Origin Trait, Enhanced Origin Trait, Weapon Mod, Enhanced Weapon Mod, Memento, Shader, Combat Flair, Resonant Material, Restore Defaults — estas nunca son perks trackeables.
- ✅ **Orden por uso**: `countPerkUses()` cuenta ocurrencias de cada nombre en la wishlist del usuario (across all slots + weapons). Sort del dropdown: score ASC → useCount DESC → nombre ASC. Chip `×N` al lado del nombre cuando `useCount > 1` con tooltip "Usada en N armas".
- ✅ No auto-focus del primer perk input al cambiar a vista perks (causaba que el focus listener abriera el dropdown automáticamente). El usuario hace click cuando quiere tipear.
- ✅ Pool de iconos custom (`d2_perk_icons`) con tipo asignable (Cañón/Cargador/Rasgo/Sin tipo). Migración `0006` + `0007` aplicada.
- ✅ Botón editar en cada card → modal abre con los 4 inputs pre-llenados.
- ✅ Chip "✦ Icono perk" arriba del "+ Agregar arma" → dialog `CustomPerkIconDialog` para gestionar iconos custom (agregar URL + asignar/cambiar tipo inline + borrar).
- ✅ Filtros por estado (Todas/Pendientes/Encontradas) + por tipo de arma (chips pill por tipo con conteo).
- ✅ Container ancho escalado en ultrawide (`max-w-[1760px] 2xl:max-w-[2240px]`) — grid de 8 columnas en 2xl.
- ✅ Dropdown de perks: `position:fixed` con coordenadas del viewport (calculadas vía `getBoundingClientRect()` del input) para escapar el clipping del `<dialog>` nativo. **Atomic reveal**: `position:fixed` + coords se aplican **antes** de remover `hidden` (en `renderPerkSuggestions` se invoca `positionDropdown` antes de `classList.remove('hidden')`), así el navegador nunca ve el dropdown con `position:static` (causa del bug "a la mitad" original). Re-posicionamiento en scroll/resize del window, con filtro para no reposicionar cuando el scroll ocurre dentro del propio dropdown.
- ✅ `state.perkConfirmed[slot]` evita que el dropdown se reabra automáticamente después de seleccionar una perk (el focus listener reabría con la perk ya seleccionada).
- ✅ Dialogs con `overflow-y-auto` + `overscroll-contain` (scroll interno no propaga al body) + `lockBodyScroll()` que setea `body.overflow:hidden` con compensación de scrollbar (compensación evita layout shift al abrir/cerrar).
- ✅ `color-scheme: light/dark` en `html` (CSS global) para que los form controls nativos (options de `<select>`, scrollbars) respeten el tema de la página.

### Páginas D2

- `/destiny` (login requerido): wishlist con filtros, agregar, editar, marcar como encontrada, eliminar.

### API D2

- `GET /destiny/api/search?q=` — top 10 armas coincidentes (case-insensitive).
- `GET /destiny/api/perks/match?q=&slot=&limit=` — perks elegibles por slot (`barrel` | `magazine` | `perk1` | `perk2`). Vacío = todas.
- `POST /destiny/api/add` `{itemHash, barrel, magazine, perk1, perk2}` — agrega arma. 409 si duplicado, 400 si perks inválidas.
- `POST /destiny/api/update` `{itemHash, barrel, magazine, perk1, perk2}` — edita perks de un arma existente.
- `POST /destiny/api/remove` `{itemHash}` — DELETE.
- `POST /destiny/api/toggle-found` `{itemHash}` — toggle `found` / `found_at`.
- `GET /destiny/api/icon?type=weapon|perk&hash=` — R2 con fallback Bungie CDN, cache 30 días.
- `GET/POST /destiny/api/perk-icon` — listar / agregar / borrar / set-category iconos custom del pool del usuario.

### Storage D2

- D1 tabla `d2_wishlist`: `(username, item_hash, weapon_name, weapon_icon_path, perks_json, found, found_at, added_at)` + índice `(username, found, added_at DESC)`. Cada fila guarda 4 perks en `perks_json`.
- D1 tabla `d2_perk_icons`: `(username, perk_name_lower, perk_name_display, icon_path, category, created_at)` para el pool de iconos custom.
- R2 bucket `arthurapphub-d2-assets`: `weapons/<hash>.png` + `perks/<hash>.png`.

### Render

- `src/lib/d2/resolver.ts` `resolveWishlistRow(row)` arma el shape final para el cliente.

### Refresh manifest (~cada season de D2)

```bash
BUNGIE_API_KEY=<key> npm run build:d2-manifest
git add data/d2/weapons-index.json data/d2/perks.json
git commit -m "d2: refresh manifest" && git push
```

## Próximo

Pendiente en orden de prioridad:

1. Smoke test end-to-end final en el browser (login → /destiny → search → modal → escribir 4 perks con typeahead cross-categoría → agregar → editar perks → toggle found → filter por tipo → reload).
2. Agregar una segunda app al SSO (5-10 líneas en la nueva app + 2 entradas en el hub).
3. Si se quiere extender más allá del círculo personal, mejorar el handler de errores en `/api/redir` cuando el hub está caído.
4. El `AUTH_PEPPER` de notes-app (legacy) ya no se usa — puede limpiarse del worker + GH secret.

## Decisiones tomadas

- **SSO completo** (multi-app desde día 1).
- Auth UI **solo en hub**. Las apps no tienen login propio.
- Login vive en el home (`/`), no en `/login`.
- **Username + PIN** (no solo PIN) para soportar multi-usuario.
- Username normalizado lowercase, `[a-z0-9_-]{3,20}`.
- Sin confirmación de PIN cuando se crea.
- Mismo mensaje de error para "no existe" / "PIN mal" (evita enumeración).
- Secret compartido `INTERNAL_API_SECRET`: 64 chars alfanuméricos random.
- D2 perks manuales (no auto top-picks) — el usuario decide qué perks trackear.
- D2 perks custom (placeholder SVG) si el manifest no tiene la perk — el usuario tipéa y el server la guarda sin fallar.
- D2 perks cross-categoría aceptadas (e.g. "Agile Bowstring" del manifest como Trait va en columna Cañón de los arcos) — el manifiesto de Bungie tiene sub-categorías como Bowstring/Scope/Sight/Battery/Arrow que son funcionalmente Barrel o Magazine pero no usan esos nombres. **Whitelist por slot** mapea cada sub-categoría a su slot canónico.
- D2 perks categorías inválidas (Intrinsic, Weapon Ornament, Origin Trait, Weapon Mod, Memento, Shader, etc.) **filtradas siempre** vía blacklist global — nunca aparecen en el dropdown.
- D2 perks `category` se normaliza al slot al guardar (`add.ts`/`update.ts` usan `SLOT_CATEGORY`). Si el usuario guardó "Agile Bowstring" en slot magazine, queda con `category: 'Magazine'` en la wishlist y aparece correctamente en futuras aperturas del dropdown magazine sin tipear.
- D2 iconos custom con tipo asignable para que el picker los filtre correctamente.
- D2 orden del dropdown por uso: las perks más usadas primero (count desde `d2_wishlist.perks_json`).

## Riesgos remanentes

- **Hub caído**: notes-app muestra pantalla con "Ir al hub". Aceptable para uso personal.
- **CF Bot Fight Mode** en fetch server-to-server: notes-app usa `User-Agent: arthurappnotes-internal/1.0` (no molesta).
- **Apps futuras** deben implementar `/api/auth/exchange?code=...` (5-10 líneas cada una) + registrar el `app_id` en `ALLOWED_APPS` y `KNOWN_APPS`.
- **CSRF**: Astro v7 bloquea POST sin Origin. Login/signup/logout en el hub son formularios del mismo sitio → OK con Origin implícito del browser. Endpoints JSON (`/api/auth/issue`, `/api/auth/exchange`, `/api/auth/logout-all`) no disparan CSRF porque no son form-like.
- **Logout no revoca sesiones de apps**: el botón "Salir" del hub solo limpia la cookie del hub; las cookies de las apps siguen vivas hasta expirar (90 días). Mejora futura: tracking de sesiones por app con `/api/auth/logout-all` real.
- **`AUTH_PEPPER` legacy en notes-app**: ya no se usa para auth (todo viene del hub). Puede borrarse del worker + GH secret.
- **`<select>` nativos**: en algunos navegadores OS es coherciano (los options nativos pueden tener contraste bajo si el SO tiene tema claro del sistema). `color-scheme: dark` en `<html>` mitiga esto en navegadores modernos (Chrome/Edge/Safari/Firefox). Fallback adicional: si un día hace falta, `appearance: none` + dropdown custom.

## Recap de credenciales actuales

| Recurso | Valor |
|---|---|
| Repo | github.com/arthurbluthtt/arthurapphub |
| Worker | arthurapphub |
| URL producción | https://arthurapphub.arthurbluthtt.workers.dev |
| D1 auth | arthurapphub-auth-db (id `09663bc8-89c0-422f-833f-de9f48b0a8ab`) |
| R2 | arthurapphub-d2-assets (binding `D2_ASSETS`) |
| GH Secrets set | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `INTERNAL_API_SECRET` |
| Worker Secrets | `AUTH_PEPPER` (64 chars random en `~/.config/cloudflare-tokens/hub-pepper.txt`), `INTERNAL_API_SECRET` (en `~/.config/cloudflare-tokens/shared-secret.txt`), `BUNGIE_API_KEY` |
| CF API Token | (cuenta completa — ver `~/.config/cloudflare-tokens/account-wide.pat`, no commitear valor) |
| CF Account ID | (ver `~/.config/cloudflare-tokens/account-id.txt`, no commitear valor) |
| Token guardado en | `~/.config/cloudflare-tokens/account-wide.pat` |
| Diseño canónico | `DESIGN.md` (paleta, tipografía, componentes) — single source of truth |

## Notas para retomar

- Si se agrega una segunda app al SSO, basta duplicar el patrón de `src/pages/api/auth/exchange.ts` de notes-app (~30 líneas) y registrar el `app_id` en `ALLOWED_APPS` y `KNOWN_APPS` del hub.
- Si el hub se rompe, `wrangler dev` localmente con `--remote` puede ayudar a debug.
- El `session_token` que el hub emite ya viene en el formato que la app destino espera (base64Url de 32 bytes random).
- El `pin_hash` per-app se calcula en el hub; las apps lo usan directamente como partition key.
- **D2 perk picker**: si el manifest está desactualizado (falta `perk.category`), el fallback por nombre clasifica por regex (`barrel|sights|scope|launcher` → barrel; `mag|magazine|rounds|cartridge|battery` → magazine; resto → trait). Funciona pero es heurístico — un rebuild elimina la dependencia. **PERO** el whitelist/blacklist actual en `perks/match.ts` es independiente del fallback: si la perk del manifest tiene categoría válida, pasa; si no, depende del fallback legacy.
- **D2 perks manuales**: el usuario tipéa el nombre en cada uno de los 4 inputs (Cañón/Cargador/Rasgo 1/Rasgo 2). El server normaliza la `category` al slot (no usa la del manifest), busca por nombre en el manifest y, si no existe, guarda como "custom" con placeholder SVG inline (sigue funcionando, sin error).
- **D2 dropdown position**: el dropdown usa `position:fixed` con coordenadas del viewport (calculadas vía `getBoundingClientRect()` del input) para escapar el clipping del `<dialog>` nativo. **Atomic reveal**: `position:fixed` + coords se aplican antes de remover `hidden` para evitar que el navegador vea el dropdown con `position:static` (causaba bug "a la mitad"). Re-posicionamiento en scroll/resize del window, con filtro para no reposicionar cuando el scroll ocurre dentro del propio dropdown.
- **D2 scroll lock**: los dialogs lockean `body.overflow:hidden` al abrir y restauran al cerrar, con compensación de scrollbar (`padding-right = scrollbarWidth`) para evitar layout shift.
- **`AUTH_PEPPER` de notes-app es legacy**: el hub ahora deriva todo. Se puede limpiar para reducir superficie.