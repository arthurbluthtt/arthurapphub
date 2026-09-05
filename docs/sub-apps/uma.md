# Umamusume Cards — `/umamusume`

Wishlist de personajes de Umamusume: Pretty Derby con cartas de soporte recomendadas (game8.co). Login requerido.

## Qué hace

Para cada personaje agregado se muestran sus mejores aptitudes (`Surface` / `Distance` / `Pace`) y las cartas recomendadas del meta actual: Main build (6 cartas) + Budget build cuando la guía lo publica + Alternates agrupados por Speed/Power/Wit del scenario actual. Filtro por estado (Todas / Pendientes / Encontradas), type-ahead en el buscador y expand "Ver más".

## Datos

- **Snapshot estático**: `data/uma/characters.json` (96 entradas, 95 con aptitudes) + `cards.json` (106 cartas con icon) + `recommendations.json` (91 personajes con recomendaciones; 4 guías con layouts viejos no tienen recs y `564 Escapades` está mal clasificado como personaje por Game8). Generados con `npm run build:uma-data`.
- **Cobertura de Budget**: actualmente 15 de 91 recomendaciones incluyen 6 cartas Budget; las otras 76 no publican Budget y la UI las omite.
- Aptitudes: se conservan todas las categorías empatadas con la mejor calificación de Game8 (`aptitudes.surface/distance/pace`).
- Iconos cacheados `img.game8.co` → R2 prefix `uma/` vía `GET /umamusume/api/icon`.

Ver `docs/data-pipelines.md` para el refresco del scrapeo.

## Storage

| Tabla | Migración | Esquema | Índices |
|---|---|---|---|
| `uma_wishlist` | 0008 | `(username, character_id, found, found_at, added_at)` — solo `character_id + found`; las cartas se leen de `recommendations.json` | `(username, found, added_at DESC)` |

Vite bundlea los JSON estáticos inline como módulos.

## API

| Método | Ruta | Body / Query | Respuesta |
|---|---|---|---|
| `GET` | `/umamusume/api/search?q=&limit=` | `limit` entero opcional, acotado a 1–30 (default 10) | `{results: Character[]}` ranked (exact prefix > word prefix > substring) |
| `POST` | `/umamusume/api/add` | `{characterId}` | `201` / `409` duplicado |
| `POST` | `/umamusume/api/remove` | `{characterId}` | `204` |
| `POST` | `/umamusume/api/toggle-found` | `{characterId}` | `{found, foundAt}` |
| `GET` | `/umamusume/api/character/[id]` | — | `{character, recommendations}` con cards resueltos |
| `GET` | `/umamusume/api/icon?type=character\|card&id=` | — | imagen (R2 → game8 fallback), cache 30 días |

## UX

- Container ancho `max-w-[1760px] 2xl:max-w-[2240px]`, grid `2xl:grid-cols-4` (6 cartas del Main en una fila).
- Labels de scenario (Grand Live / Trackblazer) según el heading de Game8.
