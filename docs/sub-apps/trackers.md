# Trackers — GameTracker, MediaTracker, MangaTracker, BookTracker, AnimeTracker

Familia clonada del mismo patrón. Ver `docs/decisions.md` § Por sub-app para las razones de cada fuente externa. Login requerido en todas.

## Patrón común

```
src/components/<tracker>/{AddDialog,EditDialog,Card}.astro + SearchBar.astro
src/lib/<tracker>/store.ts                 — STATUSES, CRUD (list/add/setStatus/remove/edit)
src/lib/<tracker>/{tmdb,kitsu,openlibrary}.ts         — wrappers de API externa
src/pages/<tracker>/{index.astro, api/{search,add,add-manual,edit,set-status,remove}.ts}
```

- Auth gate con `lookupSession`: las páginas redirigen a `/?next=/<tracker>` y
  las APIs responden `401` cuando no hay sesión.
- Estado default al agregar: `backlog` (Por leer / Por jugar / Por ver). Cambio con dropdown custom (mismo `position:fixed` de D2), filtros por estado + por tipo con chips pill y conteo, `SearchBar` con `data-search` en cada `<article>`.
- Covers directas del CDN externo (sin proxy R2, cacheadas por Cloudflare). Sin portada → placeholder con iniciales.
- Manual: `external_id NULL` + UNIQUE parcial `WHERE external_id IS NOT NULL` (no colisionan entre sí); duplicado manual por título case-insensitive → 409.
- `edit*` patch parcial con `excludeId` para no auto-409 al re-enviar el mismo título. `setStatus` con `UPDATE ... RETURNING` (1 query).
- Listeners delegados en `document` (`data-status-button`, `data-edit/remove-button`) + eventos `*:added` / `*:edited`.
- Grids fluidos `grid gap-3` con `w-full` (fix 2026-08-31 que eliminó el hueco de `flex flex-wrap`):

| Tracker | Grid | Cover |
|---|---|---|
| games | `gap-4 grid-cols-1 sm:2 md:3 lg:5 xl:6 2xl:7` | `460×215` Steam header |
| media | `gap-3 grid-cols-2 sm:3 md:4 lg:5 xl:6 2xl:8` | `4:5` portrait, `p-1.5 gap-1` |
| manga | `gap-3 grid-cols-2 sm:3 md:4 lg:5 xl:6 2xl:8` | `2:3` |
| books | `gap-3 grid-cols-2 sm:3 md:4 lg:5 xl:6 2xl:8` | `2:3` |
| anime | `gap-3 grid-cols-2 sm:3 md:4 lg:5 xl:6 2xl:8` | `4:5` |

## GameTracker — `/games` (Steam + manual, con sagas)

- **Título del modelo**: `games` — `name`, `coverUrl`, `year`, `status` (`backlog` Por jugar / `playing` Jugando / `finished` Terminado), `saga TEXT NULL`, `app_id INTEGER NULL`.
- **Fuente**: Steam sin API key. `GET /games/api/search?q=` → `store.steampowered.com/api/storesearch` (filtra `type==="app"`, excluye bundles; top 8, `tinyImage` 231×87). `POST /games/api/add {appId, saga?}` → `appdetails?filters=basic,release_date` (1 request) → valida `type==="game"` (rechaza DLC/OST/demo), parsea año de `release_date` (`"20 Feb, 2024"` → 2024), `header_image` 460×215.
- **Manual**: `POST /games/api/add-manual {name 1–80, year? entero 1900–2100, coverUrl? http(s), saga? ≤60}`. `app_id NULL`; payload no objeto, tipos inválidos o saga larga → `400`.
- **Sagas**: texto libre, sin catálogo ni auto-detect. UI: `<select>` en línea propia alineado a la derecha (solo si el user tiene sagas) + `SagaPicker` compartido por los dos modos del dialog de alta y por edición (botón dropdown con "Sin saga" + lista de sagas ya usadas por el user + "Otra (escribir manualmente)" → input con autofocus). La card no muestra pill de saga (se removió porque descuadraba). `data-saga` en `<article>` para filtro.
- **Runtime de la UI**: las cards SSR y las creadas por `games:game-added` usan el mismo contrato de `data-*`; el grid delega clicks para status, edición y borrado. El array local se actualiza después de cada mutación y recalcula conteos, filtros, dropdown de sagas, estados vacíos y contador total. Las opciones de saga se crean con DOM/texto, no con HTML interpolado.
- **Layout y covers**: `BaseLayout` usa `max-w-[1760px] 2xl:max-w-[2240px]`; el grid usa `gap-4` y `1→2→3→5→6→7` columnas hasta 2xl. La portada mantiene `aspect-[460/215]`, `loading="lazy"` y `decoding="async"`; el fallback de imagen es común para cards SSR y runtime mediante `data-game-cover-image`.
- **Atributos específicos**: GameTracker usa `data-remove-game` y `data-edit-game` en sus controles (los demás trackers de la familia usan `data-remove-button`/`data-edit-button`); el listener delegado del grid cubre ambos estados de render.
- **Errores de búsqueda**: el dialog distingue resultados vacíos de `401`, fallos HTTP de Steam y errores de red; estos últimos no se presentan como “Sin coincidencias”.
- **Random pick**: el botón `Random pick` elige uniformemente un juego del array vivo con estado `backlog` (Por jugar), evita repetir inmediatamente el anterior y muestra un diálogo con portada, año y saga. Desde el diálogo se puede marcar como `playing`; no requiere migración ni API nueva y se deshabilita cuando no quedan juegos por jugar.
- **Migraciones**: `0010_gametracker.sql` + `0011_gametracker_manual.sql` (UNIQUE parcial) + `0012_games_saga.sql`.

| Método | Ruta | Respuesta |
|---|---|---|
| `GET` | `/games/api/search?q=` | `{results: [{appId, name, tinyImage}]}` / `401` / `502` Steam inválido o caído |
| `POST` | `/games/api/add {appId, saga?}` | `201 {game}` / `400` no-game / `404` / `409` / `502` Steam caído |
| `POST` | `/games/api/add-manual {name, year?, coverUrl?, saga?}` | `201 {game}` / `400` inválido / `409` duplicado por nombre |
| `POST` | `/games/api/edit {id, name?, year?, coverUrl?, saga?}` | `200 {game}` / `400` inválido / `404` no encontrado / `409` nombre duplicado |
| `POST` | `/games/api/set-status {id, status}` | `200 {game}` / `400` inválido / `404` no encontrado |
| `POST` | `/games/api/remove {id}` | `204` |

## MediaTracker — `/media` (TMDB, rich)

- **Modelo**: `media` — `title`, `coverUrl`, `year`, `director`, `genre`, `status` (`backlog` Por ver / `watching` Mirando / `finished` Terminada), `media_type` (`movie` 🎬 / `tv` 📺), `external_id INTEGER NULL`.
- **Fuente**: TMDB (`src/lib/media/tmdb.ts`). `GET /media/api/search?q=` → `search/multi` (filtra `movie|tv`, top 8). `POST /media/api/add {tmdbId, mediaType}` → `details` por tipo con `append_to_response=credits` → `title` + `cover_url` (`image.tmdb.org/t/p/w342`) + `year` + `director` (`credits.crew Director` para movie, `created_by[0]` para tv) + primer `genre`. Requiere `TMDB_API_KEY` (Worker Secret); sin ella 503 y modo manual.
- **Manual**: `POST /media/api/add-manual {mediaType, title, year?, coverUrl?, director?, genre?}`. Los campos se validan estrictamente: no hay coerciones de tipos; `year` es entero 1888–2100 o `null`, y los textos tienen sus límites documentados.
- **Modo de uso**: tracking-only. Las cards solo exponen cambio de estado y borrado; `/media/api/edit` y `EditMediaDialog` se conservan como compatibilidad interna, pero no hay botón de edición visible en la card.
- **Migración**: `0013_mediatracker.sql`. Categoría `media` en `apps.json`.

| Método | Ruta | Respuesta |
|---|---|---|
| `GET` | `/media/api/search?q=` | `{results: [{tmdbId, mediaType, title, year, coverUrl, rating}]}` / `401` / `502 tmdb_failed` / `503 tmdb_not_configured` |
| `POST` | `/media/api/add {tmdbId, mediaType}` | `201 {media}` / `400` / `401` / `404 tmdb_not_found` / `409 duplicate` / `502 tmdb_failed` / `503 tmdb_not_configured` |
| `POST` | `/media/api/add-manual {mediaType, title, year?, coverUrl?, director?, genre?}` | `201 {media}` / `400` / `401` / `409 duplicate` |
| `POST` | `/media/api/edit {id, mediaType?, title?, year?, coverUrl?, director?, genre?, status?}` | `200 {media}` / `400` / `401` / `404 not_found` / `409 duplicate` |
| `POST` | `/media/api/set-status {id, status}` | `200 {media}` / `400` / `401` / `404 not_found` |
| `POST` | `/media/api/remove {id}` | `204` / `400` / `401` / `404 not_found` |

Todas las respuestas de error son JSON `{ "error": "codigo" }`. Los cuerpos que
no sean objetos JSON, incluidos `null` y arrays, responden `400 invalid_body`.
La UI mantiene los conteos de filtros y los estados vacío/sin coincidencias
sincronizados con las cards vivas después de agregar, cambiar estado, editar o
borrar.

## MangaTracker — `/manga` (Kitsu, minimal)

- **Modelo**: `manga` — `title`, `coverUrl`, `status` (`backlog` Por leer / `reading` Leyendo / `finished` Terminado), `manga_type` (`manga` / `manhwa` / `manhua`), `external_id INTEGER NULL`.
- **Fuente**: Kitsu `api/edge/manga` (estable desde Workers). AniList bloquea Workers (403 `You have been manually blocked`); Jikan flaky (504). `GET /manga/api/search?q=` → `filter[text]` top 8; `POST /manga/api/add {kitsuId, mangaType}` → `GET /manga/{id}` → `canonicalTitle` + `posterImage.large` (`media.kitsu.app`) + `subtype`. El parser rechaza IDs, recursos, títulos y portadas incompatibles para devolver `502 kitsu_failed`; una respuesta válida sin elementos sigue siendo `{results: []}`. Minimal: sin año/author/genre.
- **Manual**: `POST /manga/api/add-manual {mangaType, title 1–120, coverUrl?}`.
- **Migración**: `0014_mangatracker.sql`.
- **Errores**: todas las rutas responden `{error: "codigo"}` en errores; `401 unauthorized`, `400 invalid_body` o validación específica, `404 kitsu_not_found/not_found`, `409 duplicate` y `502 kitsu_failed`.

| Método | Ruta |
|---|---|
| `GET` | `/manga/api/search?q=` → `{results: [{kitsuId, mangaType, title, coverUrl}]}` / `401` / `502 kitsu_failed` |
| `POST` | `/manga/api/add {kitsuId, mangaType}` → `201 {manga}` / `400` / `401` / `404 kitsu_not_found` / `409 duplicate` / `502 kitsu_failed` |
| `POST` | `/manga/api/add-manual {mangaType, title, coverUrl?}` → `201 {manga}` / `400` / `401` / `409 duplicate` |
| `POST` | `/manga/api/edit {id, mangaType?, title?, coverUrl?, status?}` → `200 {manga}` / `400` / `401` / `404 not_found` / `409 duplicate` |
| `POST` | `/manga/api/set-status {id, status}` → `200 {manga}` / `400` / `401` / `404 not_found` |
| `POST` | `/manga/api/remove {id}` → `204` / `400` / `401` / `404 not_found` |

## BookTracker — `/books` (Open Library, minimal, clon de manga)

- **Modelo**: `books` — `title`, `coverUrl`, `status` (`backlog` / `reading` / `finished`), `book_type` (`book` 📖 / `ebook` 📱 / `audiobook` 🎧), `external_id TEXT NULL` (OLID `/works/OL...W`).
- **Fuente**: Open Library sin key. `GET /books/api/search?q=` → `search.json?q=&limit=8&fields=key,title,cover_i,edition_key` top 8; `POST /books/api/add {olid, bookType}` acepta OLID de obra (`/works/OL…W`) o edición (`/books/OL…M`) y consulta el endpoint correspondiente, con fallback de portada por OLID cuando no existe `covers[0]`. Payloads incompatibles producen `502 openlibrary_failed`.
- **Migración**: `0015_booktracker.sql`.
- **OLID**: el API acepta únicamente identificadores `OL<dígitos>W/M`, con o sin prefijo `/works/` o `/books/`; no convierte otros tipos silenciosamente.
- **Errores**: todas las rutas responden `{error: "codigo"}`; `401 unauthorized`, `400 invalid_body` o validación específica, `404 openlibrary_not_found/not_found`, `409 duplicate` y `502 openlibrary_failed`.

| Método | Ruta |
|---|---|
| `GET` | `/books/api/search?q=` → `{results: [{olid, bookType, title, coverUrl}]}` / `401` / `502 openlibrary_failed` |
| `POST` | `/books/api/add {olid, bookType}` → `201 {book}` / `400` / `401` / `404 openlibrary_not_found` / `409 duplicate` / `502 openlibrary_failed` |
| `POST` | `/books/api/add-manual {bookType, title, coverUrl?}` → `201 {book}` / `400` / `401` / `409 duplicate` |
| `POST` | `/books/api/edit {id, bookType?, title?, coverUrl?, status?}` → `200 {book}` / `400` / `401` / `404 not_found` / `409 duplicate` |
| `POST` | `/books/api/set-status {id, status}` → `200 {book}` / `400` / `401` / `404 not_found` |
| `POST` | `/books/api/remove {id}` → `204` / `400` / `401` / `404 not_found` |

## AnimeTracker — `/anime` (Kitsu, rich, separado de `/media`)

- **Modelo**: `anime` — `title`, `coverUrl`, `year`, `director`, `genre`, `status` (`backlog` Por ver / `watching` Mirando / `finished` Terminado), `anime_type` (`tv` 📺 Serie / `movie` 🎬 Peli), `external_id INTEGER NULL`. Rich (como Media, no minimal).
- **Fuente**: Kitsu `api/edge/anime`, público y sin secret. `GET /anime/api/search?q=` → `filter[text]` top 8 (`subtype movie→movie`, resto→tv); `POST /anime/api/add {kitsuId, animeType}` → `GET /anime/{id}` → `canonicalTitle`/títulos alternativos + `posterImage.large|medium` + `subtype` + `startDate` (año). `director/genre` quedan `null` al importar y son editables por compatibilidad interna.
- **Manual**: `POST /anime/api/add-manual {animeType, title 1–120, year? entero 1888–2100, coverUrl? http(s), director? ≤120, genre? ≤40}`. No hay rama “Kitsu no configurado”: una caída o respuesta incompatible devuelve `502 kitsu_failed` y el alta manual sigue disponible.
- **Validación**: no se coercionan tipos; `kitsuId` es entero seguro positivo, `animeType` es `tv|movie`, y los campos de edición usan el mismo contrato estricto.
- **Estado UI**: los conteos de estado/tipo consideran todas las cards, incluso con filtros activos; altas, estados, edición, borrado, vacío/sin coincidencias y portadas SSR/runtime se sincronizan en vivo. La card conserva únicamente estado y borrado; no expone edición.
- **Migración**: `0016_animetracker.sql`.

| Método | Ruta |
|---|---|
| `GET` | `/anime/api/search?q=` → `{results: [{kitsuId, animeType, title, year, coverUrl, rating}]}` / `401` / `502 kitsu_failed` |
| `POST` | `/anime/api/add {kitsuId, animeType}` → `201 {anime}` / `400` / `401` / `404 kitsu_not_found` / `409 duplicate` / `502 kitsu_failed` |
| `POST` | `/anime/api/add-manual {animeType, title, year?, coverUrl?, director?, genre?}` → `201 {anime}` / `400` / `401` / `409 duplicate` |
| `POST` | `/anime/api/edit {id, animeType?, title?, year?, coverUrl?, director?, genre?, status?}` → `200 {anime}` / `400` / `401` / `404 not_found` / `409 duplicate` |
| `POST` | `/anime/api/set-status {id, status}` → `200 {anime}` / `400` / `401` / `404 not_found` |
| `POST` | `/anime/api/remove {id}` → `204` / `400` / `401` / `404 not_found` |

Todas las rutas `/anime/api/*` devuelven errores JSON: `401 {error: "unauthorized"}`, `400` con código específico (`invalid_body`, `invalid_kitsu_id`, `invalid_anime_type`, `invalid_title`, `invalid_year`, `invalid_cover_url`, `invalid_director`, `invalid_genre`, `invalid_status`, `no_fields`), `404 {error: "not_found"|"kitsu_not_found"}`, `409 {error: "duplicate"}` y `502 {error: "kitsu_failed"}`.

## Comparativa rápida

| Tracker | Fuente | Key | Tipo | Año | Rich fields | CDN |
|---|---|---|---|---|---|---|
| games | Steam | no | — | ✓ | saga | Steam CDN |
| media | TMDB | `TMDB_API_KEY` | movie/tv | ✓ | director, genre | `image.tmdb.org/t/p/w342` |
| manga | Kitsu (manga) | no | manga/manhwa/manhua | — | — | `media.kitsu.app` |
| books | Open Library | no | book/ebook/audiobook | — | — | `covers.openlibrary.org` |
| anime | Kitsu (anime) | no | tv/movie | ✓ | director, genre | `media.kitsu.app` |
