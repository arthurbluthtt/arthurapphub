# Decisiones de arquitectura — ArthurAppHub

Registro de decisiones vigentes. Para el contexto completo de cada sub-app, ver `docs/sub-apps/*` y `docs/architecture.md`.

## Auth / SSO

- **Username + PIN de 4 dígitos** (no solo PIN): soporta multi-usuario. Username normalizado `lowercase`, regex `[a-z0-9_-]{3,20}`. Mismo mensaje de error para "no existe" y "PIN incorrecto" para evitar enumeración.
- **Algoritmo**: `PBKDF2-SHA256(pin + ":" + username + ":" + AUTH_PEPPER, salt="arthurapphub-auth-v1", 100k iter)`. El username entra al input para que el mismo PIN no colisione entre usuarios.
- **Sesión**: cookie `hub_sess` (HttpOnly, `SameSite=Lax`, 90 días) + cookie companion `hub_user` (no-HttpOnly, para mostrar el username en el header sin tocar D1). Lookup con cache en memoria de 30 s (vive dentro del request; en Workers cada request es un isolate nuevo).
- **Per-app partition key**: `sha256(pin_hash_hub + ":" + app_id + ":" + pepper)` calculado por el hub; la app solo guarda.
- **Exchange codes**: 60 s TTL, single-use (`used_at IS NULL` + `UPDATE ... WHERE used_at IS NULL` para evitar race), `app` debe coincidir.
- **Logout**: botón "Salir" solo limpia cookies del hub; las sesiones de apps externas viven hasta expirar. `POST /api/auth/logout-all` es stub simétrico (no-op).
- **Login en el home** (`/`): sin sesión muestra el form; con sesión muestra el grid. `/login` es shim que redirige a `/?next=`.

## Storage

- **Una sola D1** (`arthurapphub-auth-db`) para todas las sub-apps. Un solo R2 (`arthurapphub-d2-assets`) con prefix por app (`uma/`, `zzz/`).
- **UNIQUE parciales** para evitar 409 falsos: `WHERE app_id IS NOT NULL`, `WHERE external_id IS NOT NULL`, etc. Los items manuales (`NULL`) no colisionan entre sí; el duplicado manual se valida por título case-insensitive en la capa de store.
- **Precio en centavos** (`subs.price_cents INTEGER`): sin floats.
- **`UPDATE ... RETURNING`** en `setStatus` / `edit*`: 1 roundtrip a D1 en vez de 2 (UPDATE + SELECT). Verificado que D1 soporta `RETURNING` y `first()` retorna `null` si no hay match (ownership check).
- **Counts en O(N)**: un solo `for` sobre la lista en vez de `STATUSES.map → filter → length` (O(N×3)).

## Sub-apps: patrones comunes

- **Auth gate**: `lookupSession` + `Astro.redirect('/?next=...')` si no hay sesión. Todas las sub-apps son internas (`sso: false`, acceso por cookie `hub_sess` directa).
- **Grids fluidos**: `grid` con `w-full` en la card + breakpoints (`gap-3`/`gap-4`) distribuye el sobrante con `1fr` y elimina el hueco a la derecha que dejaba `flex flex-wrap` con ancho fijo. Ver `DESIGN.md` § Spacing.
- **SearchBar**: `data-search` en cada `<article>` (lowercase), debounce 200 ms, `currentSearch` en memoria (sin `history.replaceState`). Deshabilita drag en ZZZ cuando hay filtro activo. Cards creadas en runtime deben setear `dataset.search`.
- **Status dropdown**: botón custom (no `<select>` nativo) con menú `position:fixed`, coords del viewport, flip si no hay espacio abajo. `z-[9999]`, listeners delegados en `document` para que funcionen en cards del SSR y en cards creadas por `build*Card()`. Menú dentro del `<dialog>` más cercano cuando el picker vive en un dialog (top layer).
- **Listeners delegados**: un solo listener en `document` para `[data-status-button]` / `[data-remove-button]` / `[data-edit-button]` — cubre SSR + runtime (`*:added` / `*:edited`).
- **Filtros**: chips pill con conteo, `aria-pressed`, clases `FILTER_ACTIVE` / `FILTER_INACTIVE`. `applyFilters()` combina `statusOk && typeOk && qOk`.
- **Dialogs**: `<dialog>` nativo con `showModal()`, shell `m-auto max-h-[90vh] w-[min(...,calc(100vw-2rem))]`, `lockBodyScroll()` con compensación de scrollbar, flag `bodyLocked` para evitar doble-lock.

## Por sub-app

### D2 Wishlist

- Perks manuales (4 slots: Cañón / Cargador / Rasgo 1 / Rasgo 2). El usuario tipéa; el server busca por nombre en el manifest y guarda con `category` normalizada al slot (no la del manifest). Si no existe, se guarda como "custom" con placeholder SVG.
- Cross-categoría aceptada (ej. "Agile Bowstring" como Trait → slot magazine). Whitelist por slot + blacklist global (Intrinsic, Weapon Ornament, Origin Trait, etc. — nunca trackeables).
- Fallback legacy por regex si el manifest no tiene `category`; un rebuild elimina la dependencia.
- Type-ahead: 3 fuentes con dedup por nombre — (1) wishlist del user, (2) `d2_perk_icons`, (3) manifest solo si hay `q`. Orden: `_score` ASC → `useCount` DESC → nombre ASC. Chip `×N` si `useCount > 1`.
- Dropdown `position:fixed` con **atomic reveal** (coords antes de remover `hidden`).

### Umamusume

- Snapshot estático JSON commiteado (no scrape runtime). Refresh con `npm run build:uma-data` cuando sale nuevo scenario. El build inlinea los JSON vía Vite.
- Cards no se guardan en D1; la wishlist solo guarda `character_id + found`.
- Aptitudes: se conservan todas las categorías empatadas con la mejor calificación de Game8 (`surface/distance/pace`).

### Suscripciones

- Zona horaria fija `America/Mexico_City` para "hoy" y label de próximo cobro ("12 ago"); días clampeados al último día del mes.
- Monedas MXN/USD; total desglosado por moneda, ocultando las monedas sin suscripciones activas.
- `data-sub-dialog-*` prefijo separado de `data-sub-*` de las cards para no colisionar en `querySelector`.
- Día de cobro con cuadrícula 1–31 (7 columnas) en vez de `<select>`.

### GameTracker

- Búsqueda y detalle runtime contra Steam (sin API key): `storesearch` + `appdetails?filters=basic,release_date`. Solo `type === "game"` (rechaza DLC/OST/demo). Covers servidas directo del CDN de Steam (sin proxy R2).
- `app_id NULL` + UNIQUE parcial para juegos manuales. Duplicado manual por nombre case-insensitive.
- Sagas: texto libre (`TEXT NULL`), sin catálogo ni auto-detect. `SagaPicker` con "Sin saga" + lista de sagas que el user ya usó + "Otra (escribir manualmente)" → input con autofocus; el picker de alta se comparte entre Steam y manual. La card no muestra pill de saga (se removió porque descuadraba).

### Media / Manga / Book / Anime

- Familia clonada del mismo patrón (1 página + 1 store + 2–3 componentes + 6 endpoints). Diferencias solo en fuente externa y columnas.
- **Media** (`media`, rich): TMDB `search/multi` + `details` por `media_type` (`movie`/`tv`), con `append_to_response=credits` para resolver director/creador. Requiere `TMDB_API_KEY` (Worker Secret); si no está, 503 y modo manual. Director: `credits.crew Director` (movie) vs `created_by[0]` (tv). Solo primer género. CDN `image.tmdb.org/t/p/w342`.
- **Media tracking-only**: las cards exponen únicamente estado y borrado. `EditMediaDialog` y `/media/api/edit` permanecen para compatibilidad interna; no se anuncia ni se dispara edición desde la card.
- **Media API**: los endpoints responden errores con JSON uniforme `{error}` (`401 unauthorized`, `400` código de validación, `404 not_found/tmdb_not_found`, `409 duplicate`, `502 tmdb_failed`, `503 tmdb_not_configured`). La validación no coerciona tipos.
- **Media UI viva**: los conteos de estado/tipo representan todas las cards, y los estados vacío/sin coincidencias se recalculan después de cada mutación del DOM. Las imágenes SSR y runtime comparten `data-media-cover-image` y fallback de placeholder.
- **Manga** (minimal): Kitsu `api/edge/manga`. AniList bloqueado 403 desde Workers; Jikan flaky 504. CDN `media.kitsu.app`.
- **Manga API/UI**: los payloads externos y de mutación se validan sin coerción; los errores son JSON con códigos estables y los conteos se calculan sobre todas las cards, no solo las visibles por filtro.
- **Book** (minimal): Open Library `search.json` + detalle de obra/edición (`/works/OL…W` o `/books/OL…M`). Sin key. `external_id TEXT` (OLID). CDN `covers.openlibrary.org`, con fallback por OLID.
- **Book API/UI**: OLID y payloads externos se validan sin coerción; los errores son JSON con códigos estables y los conteos se calculan sobre todas las cards, no solo las visibles por filtro.
- **Anime** (rich): Kitsu `api/edge/anime`. Año desde `startDate`; director/genre `null` al importar, editables después. CDN `media.kitsu.app`.
- **Anime API/UI**: Kitsu es público y no tiene rama de configuración; fallas de Kitsu o payloads incompatibles son `502 kitsu_failed`. Los tipos `tv|movie`, IDs, año y textos se validan sin coerción, con errores JSON uniformes. La edición se conserva internamente, sin botón visible en la card; conteos, filtros, estados vacíos y fallback de portada se actualizan con el estado vivo.

### ZZZ

- Foto manual `1:2` (1080×2160) `w-[62%]` + info `w-[38%]`, `aspect-[1/2] object-cover object-top`.
- `stat_values TEXT [{stat,value|null}]` (10 `STAT_KEYS`, sin Anomaly Buildup), `display_stats` legacy para compat. `position INTEGER` conserva el orden manual; el store mantiene fallbacks de lectura/escritura para instalaciones anteriores a `0018`/`0019`.
- `ZZZPicker` genérico con búsqueda + pills de `specialty` dentro del menú.
- Los catálogos ZZZ se validan al cargar (IDs/nombres únicos y especialidades conocidas); los lookups recortan espacios y los agentes admiten ID o nombre. El nombre del personaje permanece texto libre. Limpiar un picker también reinicia búsqueda, especialidad y estado visual; “Sin resultados” queda separado de errores de sesión/red. El proxy de iconos normaliza las claves R2 al ID canónico y usa placeholder SVG si falta el recurso.
- Las rutas `/zzz/api/*` usan respuestas JSON de error con códigos estables: `unauthorized`, `invalid_body` y validaciones específicas en `400`, `not_found` en `404` y `duplicate` en `409`; `remove` devuelve `204` al borrar. Los payloads de catálogos, discos, stats y reorden no convierten tipos silenciosamente.
- El runtime de ZZZ usa las cards y su `data-zzz-id` como fuente viva para contador, búsqueda y estados vacío/sin coincidencias. Las altas se insertan según `position`, la edición conserva la posición de la card y el orden desktop/móvil se revierte si falla el endpoint de persistencia. El fallback de portada se comparte entre SSR y cards creadas después.
- Reorden por handle `⋮⋮` (0 deps): `mousedown` en handle → `canDrag`; `dragover` 2D por distancia a `cx,cy`; móvil `touchstart 180ms` + `touchmove` 2D; `POST /zzz/api/reorder {orderedIds}` valida permutación, `position 0..n`.
- La verificación H5 separa el smoke de acceso desplegado —`/zzz` redirige a login sin cookie— del E2E autenticado de mutaciones. El build y el TypeScript de ZZZ se validan sin mezclar el error baseline de otra app. Tras publicar `508e1aa`, el Worker confirma `401 {error:"unauthorized"}` con `Content-Type: application/json`; el contrato queda operativo en producción. El E2E autenticado confirmó pickers, altas, duplicado, búsqueda, persistencia y el drag validado manualmente en Edge; los datos temporales fueron eliminados al cierre.

## Infra

- `vite.server.watch.ignored: ['**/.wrangler/**']` para evitar crash `EINVAL lstat .sqlite-wal/.sqlite-shm` en Windows.
- `astro.config.mjs` usa `adapter: cloudflare()` + `site: 'https://arthurapphub.arthurbluthtt.workers.dev'`; el worker final se despliega con `wrangler deploy` vía GitHub Action en cada push a `main`.
