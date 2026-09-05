# STATE — ArthurAppHub

> Fuente de verdad operativa del proyecto. `Mavis_STATE.md` y `Mavis_CHANGELOG.md` son históricos de otro agente y no deben usarse para decidir el estado actual.

Estado actual del hub como **Identity Provider** (SSO multi-app) + **lanzador de apps** + **sub-apps internas** (D2 Wishlist + Umamusume Cards + Suscripciones + GameTracker + MediaTracker + MangaTracker + BookTracker + AnimeTracker + ZZZ — **base final**).
Última actualización: 2026-09-04 (revisión de consistencia global cerrada; Fase 10 ZZZ Builds H1-H5 completada).

## AppHub — deploy status

- ✅ Astro v7 + Tailwind 4, deployado como Cloudflare Worker (`arthurapphub.arthurbluthtt.workers.dev`).
- ✅ Auto-deploy en cada push a `main` (`.github/workflows/deploy.yml`), ~30 s.
- ✅ Grid responsivo 6 por fila en desktop ancho: `src/components/AppGrid.astro:15` `grid-cols-1 sm:2 md:3 lg:4 xl:6` + `src/pages/index.astro:72` `contentMaxWidth max-w-6xl xl:max-w-[1760px] 2xl:max-w-[2240px]` (antes 4 max). 9 apps → 6+3, mismo `gap-4 p-5` — hub alineado con Header `max-w-[1760px]` y grids densos de `games`/`destiny`.
- ✅ Status dots online/offline (HEAD a cada `app.url`, cache 5 min).
- ✅ Click en cards abre en la misma pestaña.
- ✅ `apps.json` incluye D2 Wishlist, Umamusume Cards, Suscripciones, GameTracker, **MediaTracker**, **MangaTracker**, **BookTracker**, **AnimeTracker** y **ZZZ 🌀** (9 sub-apps internas). Categorías: `gaming`, `finanzas`, `media`. Las apps externas con SSO se registran cuando se necesiten.
- ✅ **Archivo personal de apps**: la portada permite archivar/restaurar apps sin eliminarlas ni alterar sus rutas. `migrations/0020_app_archive.sql` guarda solo las apps archivadas por `username`; el resto permanece activo por defecto. La sección `Apps archivadas` conserva el acceso a D2, Uma o cualquier otra app.

### ZZZ (sub-app interna) — deploy status — **BASE FINAL 2026-08-31**

- ✅ Migraciones `0017_zzz_builds.sql` (`username,id,character_name UNIQUE lower,cover_url,w_engine_id/name,disc_set_4/2,discs_json,display_stats`) + `0018_zzz_stat_values.sql` (`stat_values TEXT` `[{stat,value}]`, migra `display_stats ["ATK"] → [{stat:"ATK",value:null}]`, mantiene `display_stats` para compat) + `0019_zzz_position.sql` (`position INTEGER` e índice de orden).
- ✅ **H1 storage/legacy**: `stat_values` es canónico; el store conserva `display_stats` en altas/ediciones, lee instalaciones sin `0018`/`0019`, ordena de forma determinista y no intenta persistir reordenamientos si falta `position`.
- ✅ **H2 contrato API/validaciones**: todas las rutas autentican sin asumir que existe la cookie, rechazan bodies que no sean objetos JSON y responden errores `{error}`. Alta/edición validan portadas, W-Engines, Disc Sets, discos, stats y duplicados; búsqueda valida tipo/especialidad y reorden exige la permutación exacta de IDs. `remove` conserva `204` cuando elimina y devuelve `404 {error:"not_found"}` si no existe.
- ✅ **H3 catálogos/pickers/iconos**: `data.ts` valida integridad de IDs, nombres y especialidades (7 agentes, 95 W-Engines, 39 Disc Sets), con lookups normalizados y agente resoluble por ID o nombre. `ZZZPicker` reinicia selección, búsqueda, especialidad, resultados y mensajes; distingue catálogo no disponible de “Sin resultados”. El proxy de iconos usa IDs canónicos para sus claves R2 y conserva el placeholder SVG para faltantes o fallas del CDN.
- ✅ **H4 estado runtime/reordenamiento**: las cards, el contador y los estados vacío/sin coincidencias se sincronizan después de altas, edición y borrado. SSR y runtime comparten el fallback de portada. El drag desktop/móvil conserva la permutación completa, se bloquea con búsqueda activa y revierte el DOM/estado si falla la persistencia.
- ✅ **Card base final + grid fluido + reordenable** `ZzzCard.astro:20` `group flex w-full` `flex-row` `imagen w-[62%] aspect-[1/2] 1080×2160` + `info w-[38%]` + handle `⋮⋮` `data-drag-handle` `absolute left-1 top-1 h-7 w-7 bg-zinc-950/60 cursor-grab touch-manipulation opacity-80 md:opacity-0 md:group-hover:opacity-100` `draggable="true"`. Grid `src/pages/zzz/index.astro:32` `grid gap-3 grid-cols-1 md:2 xl:3 2xl:4` `w-full` 4 por fila sin hueco `d7c33f38`.
  - Info ampliada: `h3 text-lg font-bold`, W-Engine `h-7 w-7 text-sm px-2.5 py-1.5` con icono `h-7`, Disc Sets `h-6 w-6 text-sm px-2.5 py-1.5` con icono `h-6`, ambos `rounded-full bg-zinc-100` con icono `ring-1`, sin `4`/`2` suffix.
  - Stats con valor al lado: `STAT_KEYS 10` (sin `Anomaly Buildup`) `HP/ATK/DEF/Impact/Anomaly Mastery/Proficiency/CRIT Rate/DMG/PEN Ratio/Energy Regen` + `STAT_UNITS %` para `CRIT/PEN/Energy`; `StatValue {stat,value|null}` `max 8`, `text-sm` `px-2.5 py-1.5` `gap-1` `4` máx + `+N más`, legacy `["ATK"]→—`. Patrón documentado en `DESIGN.md` § Spacing como estándar para cards anchas.
- ✅ Foto **manual** `coverUrl` URL `http(s)` opcional; placeholder iniciales si `NULL`. Sin R2 upload.
- ✅ **Scraper** `scripts/build-zzz-data.mjs` (clon `build-uma-data`) fetch Game8 hub `435686` tabla `W-Engine_cell/Type_cell/Rarity_cell` + `446608 discs` (`sleep 1200ms` UA `Mozilla/5.0`, regex href sin comillas + `alt` single-quote + `data-src`) → `data/zzz/{agents.json(7),w-engines.json(95),disc-sets.json(39)}`. Parse `attack 25, anomaly 19, stun 18, support 13, defense 11, rupture 9`=95 (72+upcoming). Fix `zzz-` prefix, `ZZZ - Thorned Rose→Thorned Rose`, `Knight�s→Knight's`. `npm run build:zzz-data` regenera (Vite inline).
- ✅ Catálogos: `agents.json` (7 + Claret/Roxy), `w-engines.json` (95 hard exclusivo `S/A/B`), `disc-sets.json` (39 sin prefijo). Runtime `src/lib/zzz/data.ts` `searchWEngines(q,specialty)/searchDiscSets/searchAgents` ranked `exact>prefix>wordPrefix>substring`, `getDiscSetById` añadido.
- ✅ **Pickers dropdown** `src/components/zzz/ZZZPicker.astro` genérico `name/type` `fixed z-[9999] max-h-72` `sticky search + pills` `getBoundingClientRect` + flip, append a `dialog`/`body`, `window.__zzzPickerGet/Set/Reset`, `fetch /zzz/api/search?type=wengine|disc&q=&specialty=` ranked, pills `Todos + 6 specialties` **dentro** del menú, selección `w_engine_id` (404 unknown). Disc Sets 2 pickers `add-disc4/edit-disc4` + `add-disc2/edit-disc2` con icono `h-6`/`h-4` antes.
- ✅ Dialogs `Add/EditZzzDialog.astro` con `ZZZPicker 3×` + **stats con número**: grid `1→2 cols` rows `checkbox + input number disabled` `step 0.01` `placeholder 0` `disabled:opacity-40`, submit `statValues [{stat,value:null|number 0-100000}]` (legacy `displayStats` → `value:null`), validación `400` si `value` fuera de rango, `409` build única.
- ✅ APIs: `GET /zzz/api/search` (filtrado specialty), `POST /zzz/api/add` 201/409/400 (`statValues` con `isStatValue`), `POST /zzz/api/edit` patch `statValues/displayStats` legacy, `POST /zzz/api/remove` 204, `GET /zzz/api/icon?type=wengine|disc|agent&id=` R2 `zzz/` `public, max-age=2592000, immutable` + placeholder SVG `+ User-Agent arthurapphub/1.0` + `put` fire-and-forget (fix `type=disc` rama faltante).
- ✅ Drag handle 0 deps + `position` persistente: `migrations/0019_zzz_position.sql` `position INTEGER` + `idx_zzz_user_position` + `listZzz ORDER BY COALESCE(position,9999)` + `addZzz MAX+1` + `reorderZzz()` + `POST /zzz/api/reorder {orderedIds}` valida permutación; `src/pages/zzz/index.astro` `mousedown` handle → `canDrag` + `dragstart` solo si `canDrag` y `!currentSearch`, `dragover` `getClosestCard(x,y)` 2D (distancia a `cx,cy`, `before = y<cy || (|y-cy|<h/3 && x<cx)`) + `insertBefore`/`nextSibling`, móvil `touchstart 180ms` mantener pulsado `touchmove` 2D + `touchend` persiste, `persistOrder()` `builds.sort` + `fetch reorder` debounce, `currentSearch` oculta handle y `draggable=false` (`updateDragDisabled`); `buildCard` incluye handle `⋮⋮` + `draggable`; fix Y-only que solo permitía 1º puesto (`b1fdebb5`).
- ✅ Deploy verificación: `GET /zzz` 302 `/?next=/zzz`; la búsqueda de `wengine` con `specialty=anomaly` conserva 19 coincidencias de catálogo y entrega máximo 8 resultados; `disc` 39 sin prefijo; card `w-full` `grid 1→2→3→4` `62/38` `text-lg` `h-7/h-6` + reorden `position` (`1422b92b`).
- ✅ **H5 documentación/verificación**: catálogos sin duplicados, `astro build` correcto y cero errores TypeScript dentro de ZZZ; el smoke desplegado sin sesión confirmó el login gate en `/zzz` y el `401` JSON del API sin datos. Publicado `508e1aa` en `main`; `GET /zzz/api/search?...` devuelve `Content-Type: application/json` y `{error:"unauthorized"}`. El E2E autenticado confirmó picker/búsqueda, alta, duplicado, búsqueda sin coincidencias y persistencia; el drag fue validado manualmente en Edge y los datos temporales se eliminaron al cierre.
### Umamusume Cards (sub-app interna) — deploy status

- ✅ Migración aplicada a D1 remota: `0008_uma_wishlist.sql` (tabla `uma_wishlist`).
- ✅ Script `scripts/build-uma-data.mjs` scrapea game8.co (tier list + build guides de cada personaje). Regenerable con `npm run build:uma-data`. Tolerante a HTML mal-formado (apostrofes en alts, colspan fuera de `<tr>`).
- ✅ Output estático en `data/uma/`: 96 personajes, 106 cartas con icon, 95 personajes con aptitudes y 91 personajes con recomendaciones. Las 5 guías sin recomendaciones tienen layouts viejos; `564 Escapades` está mal clasificado por Game8 como personaje aunque es un skill.
- ✅ Datos regenerados en build (Vite los bundlea inline como módulo JSON).
- ✅ R2 bucket `arthurapphub-d2-assets` reusado con prefix `uma/` (un solo bucket, dos apps).
- ✅ Páginas:
  - `/umamusume` (login requerido): wishlist con filtro Pendientes/Encontradas, aptitudes `Surface/Distance/Pace` y expand "Ver más" para ver Budget + Alternates Speed/Power/Wit.
- ✅ API:
  - `GET /umamusume/api/search?q=&limit=` — typeahead sobre `characters.json` (case-insensitive, ranked).
  - `POST /umamusume/api/add` `{characterId}` — agrega. 409 si duplicado.
  - `POST /umamusume/api/remove` `{characterId}` — DELETE.
  - `POST /umamusume/api/toggle-found` `{characterId}` — toggle found/found_at.
  - `GET /umamusume/api/character/[id]` — `{character, recommendations}` con cards resueltos (icon path incluido); `character.aptitudes` contiene las mejores aptitudes de Game8.
  - `GET /umamusume/api/icon?type=character|card&id=` — R2 con fallback game8 CDN, cache 30 días.
- ✅ Iconos: el proxy hace fallback a CDN y guarda en R2 on-demand. Tarda ~2-3 min la primera carga (cold cache).
- ✅ El scenario label del card muestra el nombre del scenario actual (Grand Live / Trackblazer). Algunas páginas viejas muestran Trackblazer si game8 ya migró a esa version.
- ✅ Grid del character card `2xl:grid-cols-5` → `2xl:grid-cols-4` para que las 6 cartas del Main build entren en una sola fila (antes 5 + 1 wrap). Cada tarjeta de personaje queda ~540px en 2xl en vez de ~365px.

### Decisiones Umamusume

- Snapshot estático JSON commiteado (no scrape runtime). Refresh manual con `npm run build:uma-data` cuando sale nuevo scenario (~cada 2-3 meses). El comando vuelve a consultar Game8 y actualiza `data/uma/characters.json`, `data/uma/cards.json` y `data/uma/recommendations.json`; después revisar el diff, hacer commit y deploy. No hay botón runtime porque el scraping tarda y no debe ejecutarse desde una request web.
- Cards se leen estáticamente desde `recommendations.json` (no se guardan en D1). La wishlist solo guarda el `character_id` + `found`.
- Solo Grand Live (o Trackblazer si game8 ya migró). No histórico (URA / Unity Cup).
- Cada versión del personaje es entry separada (Maruzensky Formula R ≠ Hot☆Summer Night). El user agrega la que tiene.
- Whitelist de categorías por slot no aplica (Umamusume no tiene Barrel/Magazine/Trait como D2).
- Iconos del CDN de game8 (img.game8.co) cacheados en R2. Sin auth para servir (público).

### Suscripciones (sub-app interna) — deploy status

- ✅ Migración aplicada a D1 remota: `0009_subs.sql` (tabla `subs`).
- ✅ Página `/subs` (login requerido): lista de suscripciones + summary superior con **Total del mes** (desglosado por moneda MXN/USD, suma solo de activas) + **Próximo cobro** (próxima sub activa por cobrar, con día y monto).
- ✅ Chip FAB "+ Agregar suscripción" (patrón de la línea base) → dialog con nombre, precio, moneda (MXN/USD) y día de cobro (1-31). El mismo dialog sirve para editar (evento `subs:edit-sub`).
- ✅ Cards: nombre, precio, moneda, día de cobro, toggle **Activa/Pausada**, editar, eliminar. Las pausadas no suman al total.
- ✅ Todo el summary (totales + próximo cobro) se recalcula en el cliente tras cualquier cambio (`subs:subs-changed`).
- ✅ Precio guardado en centavos (enteros, sin floats). Próximo cobro clampeado al último día del mes en meses cortos (31 en feb → 28/29).
- ✅ API:
  - `POST /subs/api/add` `{name, priceCents, currency, billingDay}` — 201 `{sub}`. 400 si name vacío, price<0, currency ≠ MXN/USD o día fuera de 1-31.
  - `POST /subs/api/update` `{id, ...}` — `{sub}`. 404 si no existe.
  - `POST /subs/api/remove` `{id}` — 204.
  - `POST /subs/api/toggle-active` `{id}` — `{active}`.
- ✅ Verificado end-to-end vía curl contra D1 remota (signup → add → toggle → update → remove + cálculo del próximo cobro).
- ✅ Smoke test E2E en browser: agregar MXN + USD, editar, toggle pausada, borrar. **Fix**: colisión de data-attributes (`data-sub-price` / `data-sub-currency` del dialog vs los mismos en las cards) hacía que `querySelector` del dialog resolviera a la card con subs ya renderizadas → `priceInput.value` undefined → "Precio inválido" siempre. Renombrados a `data-sub-dialog-price` / `data-sub-dialog-currency`.
- ✅ Fix hueco derecha (2026-08-31 patrón ZZZ `d7c33f38`): `BaseLayout contentMaxWidth max-w-[1760px] 2xl:max-w-[2240px]` + `grid gap-4 grid-cols-1 sm:2 lg:3 xl:4 2xl:5` (antes `max-w-6xl` + `sm:2 xl:3`) → 5 por fila en ultrawide (4 en xl) sin hueco ni tarjetas muy anchas, alineado con `zzz`/`games`/`destiny` (79ae38c8).

### Decisiones Suscripciones

- Zona horaria fija `America/Mexico_City` para el día de "hoy" (el worker corre en UTC) y para el label del próximo cobro ("12 ago").
- Monedas soportadas: MXN y USD (editable por suscripción). El total se muestra por moneda, ocultando las que no tienen subs activas.
- Pausada ≠ borrada: el toggle permite sacar una sub del total sin perderla.
- Día de cobro elegido con **cuadrícula numérica** (7 columnas, 1-31) en vez de `<select>`; sin selección default, se valida al guardar. Patrón documentado en DESIGN.md.
- Los controles del dialog usan prefijo propio `data-sub-dialog-*` para no colisionar con los data-attributes de las cards (`data-sub-price`, `data-sub-currency`), ya que `querySelector` toma el primer match en el DOM y las cards van antes que el dialog.

### GameTracker (sub-app interna) — deploy status

- ✅ Migraciones aplicadas a D1 remota: `0010_gametracker.sql` (tabla `games`) + `0011_gametracker_manual.sql` (app_id/cover_url nullable + UNIQUE parcial).
- ✅ Página `/games` (login requerido): grid de juegos con portada de Steam (header_image 460x215), título, año de salida y estado actual.
- ✅ Estados: `backlog` (Por jugar, default al agregar), `playing` (Jugando), `finished` (Terminado). Cambio de estado con dropdown custom (patrón del perk dropdown de D2) — el `<select>` nativo abría el popup con estilos del OS (texto gris sobre blanco en dark mode, y desalineado).
- ✅ Filtros por estado (chips pill con conteo, patrón D2/UMA): Todas + 3 estados.
- ✅ Búsqueda de portadas en Steam **sin API key**:
  - `GET /games/api/search?q=` — proxy autenticado a `store.steampowered.com/api/storesearch/` (filtra `type === "app"`, excluye bundles/subs; top 8); `401` sin sesión y `502` si Steam responde inválido o caído.
  - `POST /games/api/add {appId}` — `appdetails?filters=basic,release_date` (una sola request): valida `type === "game"` (rechaza DLC/OST/demo), guarda `name` + `header_image` + año (parseado de `release_date`, "20 Feb, 2024" → 2024). 409 si el appid ya está en la lista.
- ✅ **Juegos fuera de Steam** (migración `0011`): `app_id` y `cover_url` nullable + índice UNIQUE **parcial** (`WHERE app_id IS NOT NULL`) → los manuales no colisionan entre sí ni con el duplicado de Steam. El dialog tiene tabs "Buscar en Steam" / "Agregar manual" (nombre obligatorio 1-80, año 1900-2100 opcional, URL de portada http(s) opcional). Sin portada → placeholder con iniciales. Duplicado manual por nombre case-insensitive → 409.
- ✅ API:
  - `GET /games/api/search?q=` — `{results: [{appId, name, tinyImage}]}`.
  - `POST /games/api/add {appId}` — 201 `{game}` / 400 no-game / 404 no encontrado / 409 duplicado / 502 steam caído.
  - `POST /games/api/add-manual {name, year?, coverUrl?, saga?}` — 201 `{game}` / 400 inválido / 409 duplicado por nombre; `app_id` queda `NULL`.
  - `POST /games/api/set-status {id, status}` — 200 `{game}` / 400 estado o payload inválido / 404 si no existe o no pertenece al usuario.
  - `POST /games/api/remove {id}` — 204.
- ✅ Covers servidas directo del CDN de Steam (URL estable, cacheada por Cloudflare) — a diferencia de game8/Bungie no hace falta proxy R2.
- ✅ **Sagas** (migración `0012`): columna `saga TEXT NULL` + índice parcial `WHERE saga IS NOT NULL`. **El usuario las tipea manualmente** — no hay catálogo ni auto-detect. El campo es texto libre.
- ✅ **UI de sagas**: selector `<select>` en su **propia línea, alineado a la derecha** entre el header y los filter chips de estado (solo aparece si el usuario tiene sagas; "Todas (N)" + una opción por saga con conteo). En los dialogs de Agregar/Editar, el campo saga es un **componente custom `SagaPicker`** (botón dropdown con 2 secciones: "Sin saga" + **sagas que el user ya usó** como lista de sugerencias, y "Otra (escribir manualmente)" al final) — al elegir "Otra..." el botón se convierte en input con autofocus para escribir una saga nueva. El picker de alta es compartido por Steam y manual; la saga elegida se persiste en ambos caminos. **La card NO muestra un pill visible de la saga** (se removió porque descuadraba el layout cuando se agregaba) — la saga se mantiene como `data-saga` en el `<article>` y `data-game-saga` en el botón ✏️ para el filtro y la edición.
- ✅ **Fix dropdown ilegible**: el `<select>` de saga usaba `dark:bg-white/[0.04]` (transparente) → las `<option>` del popup nativo del OS se veían sin fondo. Aplicado patrón de DESIGN.md §"native selects": `dark:bg-zinc-800` + `[&>option]:bg-white [&>option]:text-zinc-900 dark:[&>option]:bg-zinc-800 dark:[&>option]:text-zinc-100` (líneas 181-196).
- ✅ **SagaPicker fixes** (2): (1) el menú se monta dentro del `<dialog>` más cercano (vía `root.closest('dialog')`) porque el `<dialog>` HTML usa top layer y un `position: fixed` en body queda detrás del backdrop; (2) el listener de `scroll` ahora ignora scrolls dentro del propio menú.
- ✅ **Optimizaciones de performance** (3): (1) `setStatus` y `editGame` ahora usan `UPDATE ... RETURNING` (1 query a D1 en vez de 2); (2) `listGames` + `countByStatus` corren en O(N) con un solo `reduce` en vez de O(N×3) con 3 filters; (3) `<img>` con `decoding="async"` y `loading="lazy"` por defecto en cards.
- ✅ **API extendida**:
  - `POST /games/api/add {appId, saga?}` — saga opcional; si no se manda, queda `null` (el user puede agregarla con Editar después).
  - `POST /games/api/add-manual {name, year?, coverUrl?, saga?}` — saga opcional, max 60 chars, validado en cliente y server.
  - `POST /games/api/edit {id, name?, year?, coverUrl?, saga?}` — 200 `{game}` / 400 inválido / 404 no encontrado / 409 nombre duplicado; patch parcial y `saga` acepta string libre o `null` (string vacío → null).
  - `GET /games/api/search?q=` — sin parámetro `saga` (ya no hay catálogo).
- ✅ **Runtime UI verificado en H5**: las cards SSR y dinámicas comparten
  `data-*` y listeners delegados; altas, ediciones, cambios de estado y bajas
  sincronizan el array local y sus conteos/filtros/estados vacíos. Las opciones
  de saga se crean con nodos DOM para conservar texto libre sin interpolar HTML.
  La búsqueda diferencia resultados vacíos de `401`, errores de Steam y fallos
  de red.
- ✅ **Contrato de sagas verificado en H6**: no hay catálogo ni autodetección;
  `SagaPicker` es texto libre compartido por Steam/manual y edición. “Sin saga”
  limpia a `null`, “Otra” permite escribir con autofocus y las altas/editados
  persisten el valor validado (hasta 60 caracteres). El catálogo muerto
  `src/lib/games/sagas.ts` fue retirado.
- ✅ **Layout y documentación verificados en H7**: GameTracker mantiene el
  container ultrawide `1760/2240`, grid `gap-4` de `1→2→3→5→6→7` columnas y
  cover `460×215`; las cards SSR y runtime comparten `data-*` y el fallback de
  imagen `data-game-cover-image`. `INDEX.md`, `DESIGN.md`, `decisions.md` y
  `trackers.md` ya no describen el catálogo eliminado ni un typeahead que no
  existe.

### Decisiones GameTracker

- Búsqueda y detalle de Steam **runtime** (no snapshot estático): la API de Steam es keyless y estable; cada add hace una sola request a `appdetails`.
- `type === "game"` obligatorio al agregar: filtra DLCs, soundtracks y demos que sí aparecen en storesearch (e.g. "Balatro Soundtrack").
- `year` se extrae por regex `/(\d{4})/` del `release_date.date` (cubre "20 Feb, 2024" y "Q4 2025").
- Duplicado Steam = mismo `app_id` por usuario (UNIQUE parcial → 409); duplicado manual = nombre case-insensitive (`isDuplicateName` con `excludeId` para edit).
- Juegos fuera de Steam se agregan **manualmente** (nombre + año + URL de portada opcionales). Sin portada → placeholder con iniciales del nombre. Sin badge de distinción en la card.
- Estado default al agregar: `backlog` (Por jugar).
- **Sagas**: texto libre (sin FK, sin catálogo). El user las tipea manualmente. `editGame` acepta `saga: null` para limpiar.

### MediaTracker (sub-app interna) — deploy status

- ✅ Migración aplicada a D1 remota: `0013_mediatracker.sql` (tabla `media`).
- ✅ Página `/media` (login requerido): grid de items con portada vertical (2:3, posters), título, año, **chip de tipo** (🎬 Peli / 📺 Serie), status dropdown y × borrar. MediaTracker es tracking-only en la card.
- ✅ **Estados**: `backlog` (Por ver, default) | `watching` (Mirando) | `finished` (Terminada). Cambio con dropdown custom (mismo patrón que Games/UMA/D2).
- ✅ **Filtros**: chips de estado (Todas + 3 estados) + **chips de tipo** (Todos + Pelis + Series) — una sola fila cada uno.
- ✅ **Botón Editar removido de la card**: solo quedan status dropdown y botón × borrar. La card es de tracking, no necesita edición inline (el title/cover ya vienen de TMDB al agregar).
- ✅ **Búsqueda en TMDB** (`search/multi`):
  - `GET /media/api/search?q=` — proxy a TMDB. Top 8 resultados filtrados a `media_type in (movie, tv)`, con `tmdbId`, `mediaType`, `title`, `year`, `coverUrl` (w342, CDN estable `image.tmdb.org`), `rating`.
  - `POST /media/api/add {tmdbId, mediaType}` — `details` por separado (movies o tv) con `append_to_response=credits`, guarda `title` + `cover_url` + `year` + `director`/`creator` + primer `genre`. 409 si título duplicado.
- ✅ **Items manuales** (sin TMDB): `POST /media/api/add-manual {mediaType, title, year?, coverUrl?, director?}` — `coverUrl` opcional http(s) → placeholder con iniciales si falta.
- ✅ **Worker Secret `TMDB_API_KEY`**: cargado por Arthur via `wrangler secret put`. Si no está, los endpoints de búsqueda devuelven 503 y la app funciona solo en modo manual.
- ✅ Categoría nueva `media` en `apps.json` con `color: "#fafafa"` (metadata). Icono 🎬.
- ✅ **Layout del grid**: `grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8` con cards `w-full` (antes `flex flex-wrap justify-start gap-3` `w-[120→220]` dejaba hueco a derecha en `1760/2240` — fix fluido `games/zzz` 2026-08-31).
- ✅ **Listeners delegadas en `document`**: los clicks en `data-status-button` y `data-remove-button` se capturan una sola vez al cargar el script (en lugar de uno por card) → funcionan tanto para cards del SSR como para cards creadas en runtime (`media:added`).
- ✅ **Resultados del search en formato card vertical**: grid `grid-cols-3 sm:grid-cols-4 gap-2`, cada card con foto arriba (`aspect-[2/3]`, ancho completo) + título + tipo/año abajo. El placeholder de iniciales es `text-base` (proporcional al card chico).
- ✅ **Cover de card**: `aspect-[4/5]` (poster vertical 0.8 ratio), padding interno `p-1.5`, gap entre filas `gap-1`, fuente del placeholder `text-xl`. Más compacto que el original 2/3.
- ✅ API:
  - `GET /media/api/search?q=` — `{results: [...]}` / `401 {error: unauthorized}` / `502 {error: tmdb_failed}` / `503 {error: tmdb_not_configured}`.
  - `POST /media/api/add {tmdbId, mediaType}` — 201 `{media}` / 400 validación / 404 `{error: tmdb_not_found}` / 409 `{error: duplicate}` / 502 / 503.
  - `POST /media/api/add-manual {mediaType, title, year?, coverUrl?, director?, genre?}` — 201 / 400 / 401 / 409.
  - `POST /media/api/edit {id, mediaType?, title?, year?, coverUrl?, director?, genre?, status?}` — patch parcial 200 `{media}` / errores JSON; se conserva como compatibilidad interna y no se expone desde la card.
  - `POST /media/api/set-status {id, status}` — `UPDATE ... RETURNING` (1 query), errores JSON.
  - `POST /media/api/remove {id}` — 204; 404 `{error: not_found}` si no existe.
- ✅ Cubierta: CDN `image.tmdb.org/t/p/w342` (estable, cacheado por Cloudflare) — sin proxy R2 (a diferencia de game8/Bungie para D2).
- ✅ **Estado runtime**: conteos de estado/tipo representan toda la lista, y los estados vacío/sin coincidencias se recalculan con las cards vivas después de cada alta, cambio de estado, edición o borrado. SSR y runtime comparten el fallback `data-media-cover-image`.
- ✅ **Verificación Fase 6**: `npm run build` pasa fuera del sandbox; `npx tsc --noEmit` no reporta errores dentro de MediaTracker; el preview local redirige `/media` a login y `/media/api/search` sin sesión devuelve `401 {error: unauthorized}`.
- ⚠️ Baseline global de `tsc` al cierre de Fase 9: 4 guards de ZZZ y `bodyRecord` nullable en `src/pages/games/api/add.ts`; AnimeTracker ya no aporta errores TypeScript.
- ✅ Smoke E2E autenticado: TMDB devolvió película y serie; se verificaron alta desde TMDB, rechazo de duplicado, alta manual sin portada, cambio de estado, filtros combinados, estado sin coincidencias y persistencia tras recarga. Los datos temporales se eliminaron manualmente al cierre.

### Decisiones MediaTracker

- **Mismo modelo para pelis y series**: una sola tabla `media` con `media_type` (`movie` | `tv`). Más simple que dos tablas separadas. Permite agregar series con campos específicos después sin romper el schema.
- **Director (movie) / Creador (tv)**: el campo `director` se popula diferente según `media_type` (movies usa `credits.crew[].Director`, series usa `created_by[0].name`).
- **Género**: solo guardamos el primer género (`genres[0].name`) para no inflar la UI. Si Arthur quiere ver todos, se cambia después.
- **Rating**: no incluido en esta versión. Se puede agregar con migración (`ADD COLUMN rating INTEGER`) + UI de 5 estrellas.
- **Sin saga**: el patrón de saga de Games no se replica acá — el espacio de sagas de series/pelis es mucho más amplio y menos útil para "tracking personal".
- **`status` y `UPDATE ... RETURNING`**: misma optimización que Games (1 query a D1 en vez de 2).
- **TMDB como única fuente externa**: a diferencia de Games (Steam runtime) o D2 (Bungie + R2), MediaTracker depende de TMDB para datos enriquecidos. Si TMDB no está configurado, modo manual.

### MangaTracker (sub-app interna) — deploy status

- ✅ Migración aplicada a D1 remota: `0014_mangatracker.sql` (tabla `manga`).
- ✅ Página `/manga` (login requerido): grid de mangas con portada vertical (2:3, Kitsu), título, **chip de tipo** (📚 Manga / 🇰🇷 Manhwa / 🇨🇳 Manhua), status dropdown, ✎ editar, × borrar.
- ✅ **Estados**: `backlog` (Por leer, default) | `reading` (Leyendo) | `finished` (Terminado). Cambio con dropdown custom (mismo patrón que Media/Games).
- ✅ **Filtros**: chips de estado (Todas + 3 estados) + **chips de tipo** (Todos + Manga + Manhwa + Manhua) — una fila cada uno.
- ✅ **Búsqueda en Kitsu** (`kitsu.io/api/edge/manga`):
  - `GET /manga/api/search?q=` — proxy a Kitsu. Top 8 con `kitsuId`, `mangaType`, `title`, `coverUrl` (media.kitsu.app large, CDN estable).
  - `POST /manga/api/add {kitsuId, mangaType}` — `GET /manga/{id}` de Kitsu, guarda `title` + `cover_url` + `manga_type`. 409 si título duplicado.
- ✅ **Items manuales** (sin Kitsu): `POST /manga/api/add-manual {mangaType, title, coverUrl?}` — `coverUrl` opcional http(s) → placeholder con iniciales si falta.
- ✅ **Fallbacks descartados**: AniList `graphql.anilist.co` bloquea IPs de Workers `403 "You have been manually blocked"`; Jikan `api.jikan.moe` depende de MAL y devolvía `504 BadResponseException` durante el deploy. Kitsu es estable desde Workers.
- ✅ **Minimal**: solo `title` + `cover_url` + `manga_type` + `status` — sin año/author/genre (columnas reservables).
- ✅ Categoría `media` en `apps.json` reusada (metadata). Icono 📚.
- ✅ **Layout del grid**: `grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8` con cards `w-full` (antes `flex flex-wrap justify-start gap-3` `w-[120→220]` dejaba hueco a derecha en `1760/2240` — fix fluido `games/zzz` 2026-08-31).
- ✅ **Listeners delegadas en `document`**: clicks en `data-status-button`, `data-edit-button`, `data-remove-button` capturados una sola vez → funcionan para SSR + runtime (`manga:added`/`manga:edited`).
- ✅ **Edit**: dialog `EditMangaDialog` (tipo/título/cover) + `POST /manga/api/edit` patch parcial.
- ✅ API:
  - `GET /manga/api/search?q=` — `{results: [...]}` / `401 unauthorized` / `502 kitsu_failed`.
  - `POST /manga/api/add {kitsuId, mangaType}` — 201 `{manga}` / 400 / 401 / 404 `kitsu_not_found` / 409 `duplicate` / 502 `kitsu_failed`.
  - `POST /manga/api/add-manual {mangaType, title, coverUrl?}` — 201 / 400 / 401 / 409 `duplicate`.
  - `POST /manga/api/edit {id, mangaType?, title?, coverUrl?, status?}` — patch parcial / 400 / 401 / 404 `not_found` / 409 `duplicate`.
  - `POST /manga/api/set-status {id, status}` — `UPDATE ... RETURNING` / 400 / 401 / 404 `not_found`.
  - `POST /manga/api/remove {id}` — 204 / 400 / 401 / 404 `not_found`.
- ✅ Covers: CDN `media.kitsu.app` (estable, cacheado por Cloudflare) — sin proxy R2.
- ✅ Verificado end-to-end (Kitsu search `berserk`→8 results, `one piece`→8, add→201, add-manual→201, remove→204) tras fix AniList 403.

### Decisiones MangaTracker

- **Kitsu como única fuente externa**: AniList bloquea Workers (403) y Jikan es flaky (depende de MAL). Kitsu `api/edge/manga` es público, estable y no necesita key; `subtype` ya distingue manga/manhwa/manhua.
- **Minimal** (título/cover/tipo/estado): sin año/author/genre para UI simple. La tabla guarda solo lo necesario; columnas opcionales se agregan con migración si hace falta.
- **Mismo patrón que MediaTracker**: 6 endpoints, 3 componentes, 1 página, 1 store — clonado de Media con renombres (`media_type→manga_type`, `director→(omitido)`).
- **Contrato H2**: errores JSON uniformes (`unauthorized`, validaciones específicas, `kitsu_not_found`, `not_found`, `duplicate`, `kitsu_failed`); `kitsuId` se valida como entero seguro positivo y el parser rechaza payloads Kitsu incompatibles.
- **Estado runtime**: los conteos de estado/tipo representan todas las cards aunque estén filtradas; altas, edición, cambio de estado y borrado recalculan conteos y estados vacío/sin coincidencias. SSR y runtime comparten fallback de portada.
- **IDs externos INTEGER** (Kitsu id numérico string `"8"` → `Number`). No se usa MangaDx (UUID TEXT) para no cambiar tipo de columna.

### BookTracker (sub-app interna) — deploy status

- ✅ Migración aplicada a D1 remota: `0015_booktracker.sql` (tabla `books`).
- ✅ Página `/books` (login requerido): grid de libros con portada vertical (2:3, Open Library), título, **chip de tipo** (📖 Libro / 📱 Ebook / 🎧 Audiolibro), status dropdown, ✎ editar, × borrar.
- ✅ **Estados**: `backlog` (Por leer, default) | `reading` (Leyendo) | `finished` (Terminado). Cambio con dropdown custom (mismo patrón que Manga/Media/Games).
- ✅ **Filtros**: chips de estado (Todas + 3 estados) + **chips de tipo** (Todos + Libro + Ebook + Audiolibro) — una fila cada uno.
- ✅ **Búsqueda en Open Library** (`openlibrary.org/search.json`):
  - `GET /books/api/search?q=` — proxy a Open Library. Top 8 con `olid` de obra/edición (`/works/OL...W` o `/books/OL...M`), `bookType`, `title`, `coverUrl` (`covers.openlibrary.org`, por `cover_i` o fallback por OLID).
  - `POST /books/api/add {olid, bookType}` — normaliza OLID de obra/edición, valida el detalle y guarda `title` + `cover_url` + `book_type`. 409 si título duplicado.
- ✅ **Items manuales** (sin Open Library): `POST /books/api/add-manual {bookType, title, coverUrl?}` — `coverUrl` opcional http(s) → placeholder con iniciales si falta.
- ✅ **Open Library sin key**: no requiere secret, estable desde Workers (análogo a Kitsu).
- ✅ **Contrato y runtime**: OLID/payloads externos se validan sin coerción; errores JSON uniformes (`unauthorized`, validaciones específicas, `openlibrary_not_found`, `not_found`, `duplicate`, `openlibrary_failed`). Conteos globales y estados vacío/sin coincidencias se recalculan tras altas, edición, cambios de estado y borrado; SSR/runtime comparten fallback de portada.
- ✅ **Minimal**: solo `title` + `cover_url` + `book_type` + `status` — sin autor/año/genre (columnas reservables).
- ✅ Categoría `media` en `apps.json` reusada (metadata). Icono 📖.
- ✅ **Layout del grid**: `grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8` con cards `w-full` (antes `flex flex-wrap justify-start gap-3` `w-[120→220]` dejaba hueco a derecha en `1760/2240` — fix fluido `games/zzz` 2026-08-31).
- ✅ **Listeners delegadas en `document`**: clicks en `data-status-button`, `data-edit-button`, `data-remove-button` capturados una sola vez → funcionan para SSR + runtime (`books:added`/`books:edited`).
- ✅ **Edit**: dialog `EditBookDialog` (tipo/título/cover) + `POST /books/api/edit` patch parcial.
- ✅ API:
  - `GET /books/api/search?q=` — `{results: [...]}` / `401 unauthorized` / `502 openlibrary_failed`.
  - `POST /books/api/add {olid, bookType}` — 201 `{book}` / 400 / 401 / 404 `openlibrary_not_found` / 409 `duplicate` / 502 `openlibrary_failed`.
  - `POST /books/api/add-manual {bookType, title, coverUrl?}` — 201 / 400 / 401 / 409 `duplicate`.
  - `POST /books/api/edit {id, bookType?, title?, coverUrl?, status?}` — patch parcial / 400 / 401 / 404 `not_found` / 409 `duplicate`.
  - `POST /books/api/set-status {id, status}` — `UPDATE ... RETURNING` / 400 / 401 / 404 `not_found`.
  - `POST /books/api/remove {id}` — 204 / 400 / 401 / 404 `not_found`.
- ✅ Covers: CDN `covers.openlibrary.org` (estable, cacheado por Cloudflare) — sin proxy R2.
- ✅ Deploy verificación: `GET /books` → 302 `/?next=/books` (auth gate), `GET /books/api/search?q=test` → 401/200 según auth.

### Decisiones BookTracker

- **Open Library como única fuente externa**: `search.json` + detalle de obra/edición es público, sin key y estable desde Workers (análogo a Kitsu para manga). Google Books descartado (requiere key/cuota). `cover_i` → `covers.openlibrary.org/b/id/{id}-L.jpg`; sin `cover_i` se intenta el cover por OLID y la UI cae a placeholder si tampoco existe.
- **Minimal** (título/cover/tipo/estado): clon 1:1 de MangaTracker. Sin autor/año/genre; columnas opcionales se agregan con migración si hace falta.
- **Mismo patrón que MangaTracker**: 6 endpoints, 3 componentes, 1 página, 1 store — clonado con renombres (`manga_type→book_type`, `kitsuId→olid TEXT`). `external_id` es `TEXT` (OLID `/works/OL...W`) no INTEGER.
- **Tipos**: `book` (📖 Libro) / `ebook` (📱 Ebook) / `audiobook` (🎧 Audiolibro) — iconos primera opción confirmada.

### AnimeTracker (sub-app interna) — deploy status

- ✅ Migración aplicada a D1 remota: `0016_animetracker.sql` (tabla `anime`).
- ✅ Página `/anime` (login requerido): grid de animes con portada vertical (4:5, Kitsu), título, **chip de tipo** (📺 Serie / 🎬 Peli), año, status dropdown, × borrar.
- ✅ **Estados**: `backlog` (Por ver, default) | `watching` (Mirando) | `finished` (Terminado). Cambio con dropdown custom (mismo patrón que Media/Manga/Books).
- ✅ **Filtros**: chips de estado (Todas + 3 estados) + **chips de tipo** (Todos + Serie + Peli) — una fila cada uno.
- ✅ **Búsqueda en Kitsu** (`kitsu.io/api/edge/anime`):
  - `GET /anime/api/search?q=` — proxy a Kitsu. Top 8 con `kitsuId`, `animeType` (tv/movie), `title`, `year` (startDate), `coverUrl` (media.kitsu.app large, CDN estable).
  - `POST /anime/api/add {kitsuId, animeType}` — `GET /anime/{id}` de Kitsu, guarda `title` + `cover_url` + `anime_type` + `year`. 409 si título duplicado.
- ✅ **Items manuales** (sin Kitsu): `POST /anime/api/add-manual {animeType, title, year?, coverUrl?, director?, genre?}` — `coverUrl` opcional http(s) → placeholder con iniciales si falta. Rich: año/director/genre editables.
- ✅ **Kitsu sin key**: no requiere secret, estable desde Workers (análogo a MangaTracker `kitsu.io/api/edge/manga`). No existe rama de “Kitsu no configurado” ni respuesta 503; una falla HTTP, red o payload incompatible se reporta como `502 kitsu_failed` y queda disponible el modo manual.
- ✅ **Rich**: `title` + `cover_url` + `anime_type` + `year` + `director` + `genre` + `status` — copia de MediaTracker, no minimal (Media guarda director/genre/year).
- ✅ Categoría `media` en `apps.json` reusada (metadata). Icono 🌸.
- ✅ **Layout del grid**: `grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8` con cards `w-full` (antes `flex flex-wrap justify-start gap-3` `w-[120→220]` dejaba hueco a derecha en `1760/2240` — fix fluido `games/zzz` 2026-08-31).
- ✅ **Listeners delegadas en `document`**: clicks en `data-status-button`, `data-remove-button` capturados una sola vez → funcionan para SSR + runtime (`anime:added`/`anime:edited`).
- ✅ **Edit**: dialog `EditAnimeDialog` (tipo/título/año/director/cover/genre) + `POST /anime/api/edit` patch parcial (incluye `animeType`).
- ✅ API:
  - `GET /anime/api/search?q=` — `{results: [...]}` / `401 unauthorized` / `502 kitsu_failed`; Kitsu devuelve máximo 8 resultados y el parser rechaza recursos incompatibles.
  - `POST /anime/api/add {kitsuId, animeType}` — `GET /anime/{id}` de Kitsu, guarda `title` + `cover_url` + `anime_type` + `year`; 409 si título o external id duplicado; 404 `kitsu_not_found`; 502 `kitsu_failed`.
  - `POST /anime/api/add-manual {animeType, title, year?, coverUrl?, director?, genre?}` — validación estricta, 201 / 400 / 401 / 409.
  - `POST /anime/api/edit {id, animeType?, title?, year?, coverUrl?, director?, genre?, status?}` — patch parcial estricto / JSON errors; se conserva como compatibilidad interna y la card no expone edición.
  - `POST /anime/api/set-status {id, status}` — `UPDATE ... RETURNING` / JSON errors.
  - `POST /anime/api/remove {id}` — 204 / `404 not_found`; todos los cuerpos deben ser objetos JSON, nunca `null` ni arrays.
- ✅ Covers: CDN `media.kitsu.app` (estable, cacheado por Cloudflare) — sin proxy R2.
- ✅ **Estado runtime**: conteos globales (no dependen del filtro), card vacía y “sin coincidencias” se recalculan tras cada mutación; las portadas SSR y runtime usan el mismo placeholder ante ausencia o error.
- ✅ Smoke de ruta desplegada: `GET /anime` → 302 `/?next=/anime` (auth gate); las APIs requieren sesión y sin ella responden `401 {error: "unauthorized"}`. El smoke autenticado con mutaciones queda pendiente de una sesión de prueba autorizada.

### Decisiones AnimeTracker

- **Kitsu anime como fuente (1A)**: `kitsu.io/api/edge/anime?filter[text]=` + `/anime/{id}` es público, sin key y estable desde Workers (mismo que MangaTracker). Jikan descartado (flaky 504) y AniList bloqueado 403.
- **Rich (2A) copia de MediaTracker**: guarda `year/director/genre` como Media (vs minimal Manga/Books). Director/genre quedan `null` al importar de Kitsu (no expone sin include) y son editables manual; año viene de `startDate`.
- **Tipos tv|movie (3B)**: mapeo `subtype==='movie'?'movie':'tv'` (resto TV/ONA/OVA/special → tv). Simple, mantiene `/media` para pelis/series no-anime y `/anime` solo anime separado como pedido.
- **Estados Por ver/Mirando/Terminado (4)**: `backlog/watching/finished` con labels `Por ver/Mirando/Terminado` (masc. para anime, vs Media `Terminada`).
- **Icono 🌸 Sakura (5)**: `animetracker` `category:media`, separado de `mediatracker` 🎬.

## Identity Provider (SSO multi-app)

- **D1 `arthurapphub-auth-db`** con tablas `pin_credentials` (PK `username`), `sessions`, `auth_codes`.
- **Migraciones aplicadas**: `0001_auth_init.sql`, `0002_username.sql`.
- **Secrets**: `AUTH_PEPPER` y `INTERNAL_API_SECRET` configurados en el worker de `arthurapphub`. También en GH Secrets del repo.
- **Páginas**:
  - `/` (`index.astro`): si no hay sesión → form de login (username + PIN). Si hay sesión → grid de apps. Title cambia según contexto.
  - `/signup`: crear usuario (username + PIN, sin confirmación).
  - `/login`: shim que redirige a `/` (preserva `?next=`).
- **API**:
  - `POST /api/auth/issue` — cookie → code (60 s TTL). App debe tener `sso: true` en `apps.json`.
  - `POST /api/auth/exchange` — Bearer `INTERNAL_API_SECRET` + `{code, app}` → `{session_token, pin_hash, expires_at}`. App con `sso: true`.
  - `POST/GET /api/auth/logout` — destruye sesión hub + limpia cookies (`hub_sess` y `hub_user`).
  - `POST /api/auth/logout-all` — stub simétrico (no-op; el hub no trackea sesiones por app).
  - `GET /api/redir?app=<id>` — con sesión: code + 302 a `${app.url}/api/auth/exchange?code=...`. Sin sesión: 302 a `/login?next=...`. (No se invoca si la app tiene `redir` directo a una ruta interna.)
  - `GET /api/health` — HEAD a cada `app.url`, devuelve `{id, ok, status, ms}` con cache 5 min.
- **Registro de apps**: una sola fuente en `src/data/apps.json`. Campo `sso: true|false`. `lib/apps.ts` exporta `getAllApps()`, `getSsoApps()`, `findApp(id)`, `isSsoApp(id)`. Los handlers SSO consultan `isSsoApp(body.app)` en vez de mantener sets hardcoded. Apps internas (D2 Wishlist) tienen `sso: false` y acceso via cookie `hub_sess` directa.
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
- ✅ Manifest build: 2058 armas con `weaponType` real (Hand Cannon, Auto Rifle, etc — vía `DestinyItemCategoryDefinition`), 2000 perks indexadas; `category` viene de `itemTypeDisplayName` cuando Bungie la proporciona y `perks/match.ts` aplica fallback legacy por nombre cuando falta.
- ✅ Referencias del snapshot saneadas: `perkPoolHashes`/`mainPerkHashes` solo apuntan a hashes presentes en `perks.json`; `mainPerkHashes` puede quedar vacío en armas legacy sin dos sockets principales.
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

### Refresh D2 manifest (~cada season)

```bash
BUNGIE_API_KEY=<key> npm run build:d2-manifest
git add data/d2/weapons-index.json data/d2/perks.json
git commit -m "d2: refresh manifest" && git push
```

### Refresh Umamusume data (~cada nuevo scenario / balance)

```bash
npm run build:uma-data
git add data/uma/characters.json data/uma/cards.json data/uma/recommendations.json
git commit -m "uma: refresh manifest" && git push
```

Script tarda ~2 min (96 requests secuenciales con rate limit 1.2s entre cada uno). Cobertura actual: 91/96 personajes con recomendaciones Grand Live / Trackblazer.

## Próximo

Pendiente en orden de prioridad:

1. Smoke test E2E del GameTracker en el browser (login → /games → search Balatro → agregar → agregar manual (Stella Sora) → cambiar estado con el dropdown custom → filtrar → borrar).
2. Smoke test E2E del Umamusume Cards en el browser (login → /umamusume → search Maruzensky → agregar → ver "Ver más" → toggle found → filter → remove).
3. Agregar una segunda app al SSO (5-10 líneas en la nueva app + 2 entradas en el hub).
4. Si se quiere extender más allá del círculo personal, mejorar el handler de errores en `/api/redir` cuando el hub está caído.
5. **Eliminado**: la entrada de notes-app en `apps.json` y los `app_id` en `ALLOWED_APPS` / `KNOWN_APPS` (de momento vacíos). El worker `notes-app` en Cloudflare sigue corriendo con sus datos hasta que se borre manualmente.
6. Umamusume: refresh de datos si game8 reorganiza o sale nuevo scenario.
7. Umamusume: agregar las 5 páginas que quedaron sin recomendaciones (El Condor Pasa Kukulkan Warrior, Mayano Top Gun Sunlight Bouquet, Special Week Special Dreamer, Special Week Ruler of Japan, "564 Escapades" — esta última es un skill id mal clasificado como character).
8. ~~Suscripciones: smoke test E2E en browser (login → /subs → agregar MXN + USD → ver total y próximo cobro → toggle pausada → editar → borrar)~~ — **hecho 2026-08-11**, incluye fix de colisión de data-attributes del dialog.
9. ~~GameTracker: fallback de agregado manual (sin Steam)~~ — **hecho 2026-08-15** (migración `0011`, dialog con tabs Steam/Manual).

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
- UMA: snapshot estático JSON commiteado, refresh manual con `npm run build:uma-data`.
- UMA: cada personaje muestra las mejores aptitudes de `Surface`, `Distance` y `Pace`; si hay empate se conservan todas.
- UMA: scenario se detecta automáticamente del heading de game8 (Grand Live / Grand Concert / Trackblazer).
- UMA: type-ahead sobre `characters.json` con ranking (exact prefix > word prefix > substring).
- UMA: cards referenciadas en builds que no estaban en `Best Support Cards` se agregan al `cards.json` (merge por `game8Id`).

## Riesgos remanentes

- **Hub caído**: cualquier app externa vinculada mostraría pantalla con "Ir al hub". Actualmente no hay apps externas registradas.
- **Apps futuras** deben implementar `/api/auth/exchange?code=...` (5-10 líneas cada una) + registrar el `app_id` en `ALLOWED_APPS` y `KNOWN_APPS`.
- **CSRF**: Astro v7 bloquea POST sin Origin. Login/signup/logout en el hub son formularios del mismo sitio → OK con Origin implícito del browser. Endpoints JSON (`/api/auth/issue`, `/api/auth/exchange`, `/api/auth/logout-all`) no disparan CSRF porque no son form-like.
- **Logout no revoca sesiones de apps**: el botón "Salir" del hub solo limpia la cookie del hub; las cookies de las apps siguen vivas hasta expirar (90 días). Mejora futura: tracking de sesiones por app con `/api/auth/logout-all` real.
- **`AUTH_PEPPER` legacy en cualquier app externa**: ya no se usa para auth (todo viene del hub). Puede borrarse del worker correspondiente + GH secret si se confirma que la app está desvinculada.
- **`<select>` nativos**: en algunos navegadores OS es coherciano (los options nativos pueden tener contraste bajo si el SO tiene tema claro del sistema). `color-scheme: dark` en `<html>` mitiga esto en navegadores modernos (Chrome/Edge/Safari/Firefox). Fallback adicional: si un día hace falta, `appearance: none` + dropdown custom.
- **UMA scraping**: game8.co puede cambiar la estructura HTML. El script es tolerante a casos comunes (apostrofes en alt, colspan fuera de `<tr>`, headings Trackblazer/Grand Live/Grand Concert) pero un redesign grande rompería el parser. Mitigación: el script loggea skips, hay que monitorear el ratio de cobertura (actual 91/96).
- **R2 bucket compartido**: `arthurapphub-d2-assets` se usa para D2 y UMA. Si una app nueva necesita icons, hay que decidir si comparte bucket (más simple) o crea uno nuevo (más aislado). Por ahora un bucket con prefix por app funciona bien.

## Recap de credenciales actuales

| Recurso | Valor |
|---|---|
| Repo | github.com/arthurbluthtt/arthurapphub |
| Worker | arthurapphub |
| URL producción | https://arthurapphub.arthurbluthtt.workers.dev |
| D1 auth | arthurapphub-auth-db (id `09663bc8-89c0-422f-833f-de9f48b0a8ab`) — tablas: pin_credentials, sessions, auth_codes, d2_wishlist, d2_perk_icons, uma_wishlist, subs, games, **media**, **manga**, **books**, **anime**, **zzz_builds** |
| R2 | arthurapphub-d2-assets (binding `D2_ASSETS`) — reusado por D2 y UMA con prefix `uma/` |
| GH Secrets set | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `INTERNAL_API_SECRET` |
| Worker Secrets | `AUTH_PEPPER` (64 chars random en `~/.config/cloudflare-tokens/hub-pepper.txt`), `INTERNAL_API_SECRET` (en `~/.config/cloudflare-tokens/shared-secret.txt`), `BUNGIE_API_KEY` |
| CF API Token | (cuenta completa — ver `~/.config/cloudflare-tokens/account-wide.pat`, no commitear valor) |
| CF Account ID | (ver `~/.config/cloudflare-tokens/account-id.txt`, no commitear valor) |
| Token guardado en | `~/.config/cloudflare-tokens/account-wide.pat` |
| Diseño canónico | `DESIGN.md` (paleta, tipografía, componentes) — single source of truth |

## Notas para retomar

- Si se agrega una app externa al SSO, basta duplicar el patrón de `src/pages/api/auth/exchange.ts` (~30 líneas) y registrar el `app_id` en `ALLOWED_APPS` y `KNOWN_APPS` del hub.
- Si el hub se rompe, `wrangler dev` localmente con `--remote` puede ayudar a debug.
- El `session_token` que el hub emite ya viene en el formato que la app destino espera (base64Url de 32 bytes random).
- El `pin_hash` per-app se calcula en el hub; las apps lo usan directamente como partition key.
- **D2 perk picker**: si el manifest está desactualizado (falta `perk.category`), el fallback por nombre clasifica por regex (`barrel|sights|scope|launcher` → barrel; `mag|magazine|rounds|cartridge|battery` → magazine; resto → trait). Funciona pero es heurístico — un rebuild elimina la dependencia. **PERO** el whitelist/blacklist actual en `perks/match.ts` es independiente del fallback: si la perk del manifest tiene categoría válida, pasa; si no, depende del fallback legacy.
- **D2 perks manuales**: el usuario tipéa el nombre en cada uno de los 4 inputs (Cañón/Cargador/Rasgo 1/Rasgo 2). El server normaliza la `category` al slot (no usa la del manifest), busca por nombre en el manifest y, si no existe, guarda como "custom" con placeholder SVG inline (sigue funcionando, sin error).
- **D2 dropdown position**: el dropdown usa `position:fixed` con coordenadas del viewport (calculadas vía `getBoundingClientRect()` del input) para escapar el clipping del `<dialog>` nativo. **Atomic reveal**: `position:fixed` + coords se aplican antes de remover `hidden` para evitar que el navegador vea el dropdown con `position:static` (causaba bug "a la mitad"). Re-posicionamiento en scroll/resize del window, con filtro para no reposicionar cuando el scroll ocurre dentro del propio dropdown.
- **D2 scroll lock**: los dialogs lockean `body.overflow:hidden` al abrir y restauran al cerrar, con compensación de scrollbar (`padding-right = scrollbarWidth`) para evitar layout shift.
- **`AUTH_PEPPER` legacy**: el hub ahora deriva todo. Se puede limpiar para reducir superficie en cualquier worker que ya no lo necesite.
