# ZZZ Builds — `/zzz`

Builds de Zenless Zone Zero. Login requerido. **Base final 2026-08-31** (grid fluido + reordenable).

## Qué hace

Una build por personaje: foto `1:2` (Hoyoverse `fastcdn`, `w-[62%]` + info `w-[38%]` en `flex w-full`), W-Engine, Disc Sets (4 + 2) y stats con valor al lado. Grid `1→2→3→4` columnas, 4 por fila en `2xl:max-w-[2240px]` sin hueco (`d7c33f38`). Card con ✎/× y drag handle `⋮⋮`.

## Datos

- **Scraper**: `scripts/build-zzz-data.mjs` (clon `build-uma-data`). Hub Game8 `435686` tabla `W-Engine/Type/Rarity` (95 W-Engines: attack 25 / anomaly 19 / stun 18 / support 13 / defense 11 / rupture 9) + discos `446608` (39, sin `ZZZ -` prefix) + agents `435684` (7). `sleep 1200ms`, UA `Mozilla/5.0`, regex tolerate sin comillas + `data-src` → `data/zzz/{agents,w-engines,disc-sets}.json`.
- Catálogos runtime en `src/lib/zzz/data.ts`: `searchWEngines(q, specialty)` / `searchDiscSets` / `searchAgents` ranked `exact>prefix>wordPrefix>substring`.
- **Stats**: 10 `STAT_KEYS` (sin Anomaly Buildup): `HP / ATK / DEF / Impact / Anomaly Mastery / Anomaly Proficiency / CRIT Rate / CRIT DMG / PEN Ratio / Energy Regen` + `STAT_UNITS %` para `CRIT/PEN/Energy`. Valores `number|null`, `max 8`, `step 0.01`.

## Storage

| Tabla | Migraciones | Esquema | Índices |
|---|---|---|---|
| `zzz_builds` | 0017 + 0018 + 0019 | `(username, id, character_name UNIQUE lower, cover_url, w_engine_id/name, disc_set_4/2, discs_json, stat_values TEXT [{stat,value}], display_stats legacy, position INTEGER, created_at, updated_at)` — `display_stats` se mantiene para compat | `idx_zzz_user_character`, `idx_zzz_user_created`, `idx_zzz_user_wengine`, `idx_zzz_user_position` |

`listZzz ORDER BY COALESCE(position, 9999), created_at ASC`; `addZzz MAX(position)+1`.

R2 prefix `zzz/` para `type=wengine|disc|agent`.

## API

| Método | Ruta | Body / Query | Respuesta |
|---|---|---|---|
| `GET` | `/zzz/api/search?type=wengine\|disc&q=&specialty=` | — | `{results}` filtrado por specialty, ranked |
| `POST` | `/zzz/api/add` | `{characterName, coverUrl, wEngineId, discSet4, discSet2, statValues}` | `201 {build}` / `409 {error:"duplicate"}` / `400 {error:<código>}` |
| `POST` | `/zzz/api/edit` | patch `{characterName?, coverUrl?, wEngineId?, discSet4/2?, statValues?/displayStats?}` | `200 {build}` / `404 {error:"not_found"}` / `409 {error:"duplicate"}` / `400 {error:<código>}` |
| `POST` | `/zzz/api/remove` | `{id}` | `204` / `404 {error:"not_found"}` |
| `POST` | `/zzz/api/reorder` | `{orderedIds}` valida strings únicos y permutación exacta → `batch UPDATE position` | `200 {ok:true}` / `400 {error:<código>}` |
| `GET` | `/zzz/api/icon?type=disc\|wengine\|agent&id=` | — | R2 `zzz/` → CDN, `public, max-age=2592000, immutable`, placeholder SVG; solicitudes inválidas devuelven JSON `400` |

Todas las rutas autenticadas devuelven `401 {error:"unauthorized"}` sin sesión. Los bodies que no sean objetos JSON (incluidos `null` y arrays) devuelven `400 {error:"invalid_body"}`. La búsqueda valida `type` y `specialty`, y devuelve máximo 8 resultados. Los catálogos, discos y stats se validan sin coerción; `displayStats` solo se acepta como compatibilidad legacy.

Foto `coverUrl` debe ser `http(s)`, manual, `1:2` `object-cover object-top`; `NULL` → placeholder con iniciales.

## UX

- **Card** `src/components/zzz/ZzzCard.astro`: `group flex w-full flex-row`, imagen `w-[62%] aspect-[1/2]` + info `w-[38%] p-3 gap-2`, `h3 text-lg`, W-Engine `h-7` + Disc `h-6` con `rounded-full bg-zinc-100` y `ring-1`, stats `text-sm gap-1` (4 máx + `+N más`).
- **Dialogs** `Add/EditZzzDialog.astro`: `ZZZPicker` 3× + grid de stats `2 cols` (checkbox + input number `disabled:opacity-40`).
- **ZZZPicker** `src/components/zzz/ZZZPicker.astro`: genérico `fixed z-[9999] max-h-72`, sticky search + pills (`Todos` + 6 specialties) dentro del menú, `getBoundingClientRect` + flip, append a `dialog`/`body`, `window.__zzzPickerGet/Set`, iconos en opciones y card.
- **SearchBar**: `Buscar...` con `data-search` en `characterName`; `currentSearch` recalcula cards visibles, muestra “sin coincidencias” y deshabilita drag (handle oculto, `draggable=false`). El contador y el estado vacío se calculan sobre las cards vivas después de cada mutación.
- **Portadas**: SSR y runtime usan `data-zzz-cover-image`; si la URL falla, se reemplaza por el placeholder con iniciales.
- **Reorden** (0 deps, fix 2D): handle `⋮⋮` `absolute left-1 top-1 h-7 w-7 bg-zinc-950/60 cursor-grab opacity-80 md:opacity-0 md:group-hover:opacity-100`. `mousedown` en handle → `canDrag`; `dragover` `getClosestCard(x,y)` 2D por distancia a `cx,cy`; móvil `touchstart 180ms` + `touchmove` 2D con cancelación al desplazar antes del long-press. `persistOrder()` actualiza el estado local y, si falla `POST /zzz/api/reorder`, restaura la permutación anterior.

## Verificación

- `astro build` final correcto (`ASTRO_BUILD_EXIT=0`).
- `npx tsc --noEmit` no reporta errores en `src/pages/zzz/**` ni `src/lib/zzz/**`; el error de `src/pages/games/api/add.ts(62,17)` queda documentado como baseline externo.
- Catálogos comprobados: 7 agentes, 95 W-Engines y 39 Disc Sets, sin IDs/nombres duplicados y con especialidades válidas.
- Smoke desplegado sin sesión: `/zzz` redirige a `/?next=/zzz` y `GET /zzz/api/search?...` devuelve `401` sin exponer datos. El Worker publicado todavía serializa ese `401` como `text/plain: Unauthorized`; la fuente corregida usa `{error: "unauthorized"}` y requiere publicación para verificar el contrato en producción. El E2E autenticado de búsquedas y mutaciones requiere una sesión/credenciales de prueba autorizadas y permanece pendiente.
