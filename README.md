# ArthurAppHub

Hub personal de apps **+ Identity Provider (SSO)** para todas las apps vinculadas. Astro 7 + Tailwind CSS 4 + Cloudflare Workers.

**URL**: https://arthurapphub.arthurbluthtt.workers.dev

## Qué es

- **Lanzador de apps**: grid responsivo de tarjetas (ícono + nombre + descripción + link), tema dark/light persistente, indicador online/offline por app.
- **Identity Provider**: el hub maneja la auth (username + PIN de 4 dígitos). Las apps vinculadas consumen identidad vía exchange code. Una vez que el usuario entra su PIN en el hub, queda autenticado en todas las apps.
- **9 sub-apps internas** (todas con login, acceso por cookie `hub_sess`):

| Sub-app | Ruta | Qué guarda |
|---|---|---|
| D2 Wishlist | `/destiny` | Armas de Destiny 2 + 4 perks manuales |
| Uma Cards | `/umamusume` | Personajes de Umamusume + cartas recomendadas |
| Suscripciones | `/subs` | Gastos mensuales MXN/USD |
| GameTracker | `/games` | Juegos (Steam + manual, con sagas) |
| MediaTracker | `/media` | Pelis/series no-anime (TMDB) |
| MangaTracker | `/manga` | Mangas (Kitsu) |
| BookTracker | `/books` | Libros (Open Library) |
| AnimeTracker | `/anime` | Animes (Kitsu) |
| ZZZ Builds | `/zzz` | Builds de Zenless Zone Zero |

Ver detalle de cada una en `docs/sub-apps/`.

## Requisitos

Node 22.12+.

## Quickstart

```bash
npm install
npm run dev                # http://localhost:4321
npm run build              # genera dist/
npx wrangler dev           # simula el worker (con bindings remotos)
```

Al iniciar el dev server, usar background mode (`astro dev --background`). Ver `AGENTS.md`.

## Deploy

Push a `main` dispara `.github/workflows/deploy.yml` (`npm ci` → `npm run build` → `wrangler deploy`, ~30 s). Requiere `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en GitHub Secrets.

## Agregar una app nueva

El registro vive en `src/data/apps.json` — solo ese archivo + la app externa implementa `POST /api/auth/exchange` si es con SSO.

**Interna** (`sso: false`, acceso por cookie directa):

```json
{ "id": "mi-app", "name": "Mi App", "description": "...", "url": "/mi-app", "redir": "/mi-app", "icon": "🚀", "category": "productividad", "sso": false }
```

**Externa** (`sso: true`, flujo exchange code):

```json
{ "id": "mi-app", "name": "Mi App", "description": "...", "url": "https://app.example.com", "redir": "/api/redir?app=mi-app", "icon": "🚀", "category": "productividad", "sso": true }
```

La lista de apps con SSO se deriva de `apps.json` vía `lib/apps.ts → isSsoApp(id)`. Commit + push → redeploy automático.

## Documentación

| Doc | Para qué |
|---|---|
| [INDEX.md](INDEX.md) | Mapa navegable del proyecto |
| [DESIGN.md](DESIGN.md) | Sistema de diseño canónico (paleta, componentes) |
| [docs/architecture.md](docs/architecture.md) | Stack, bindings, flujo SSO, lifecycle |
| [docs/sub-apps/d2.md](docs/sub-apps/d2.md) | D2 Wishlist |
| [docs/sub-apps/uma.md](docs/sub-apps/uma.md) | Umamusume |
| [docs/sub-apps/subs.md](docs/sub-apps/subs.md) | Suscripciones |
| [docs/sub-apps/zzz.md](docs/sub-apps/zzz.md) | ZZZ |
| [docs/sub-apps/trackers.md](docs/sub-apps/trackers.md) | GameTracker, MediaTracker, Manga, Book, Anime |
| [docs/data-pipelines.md](docs/data-pipelines.md) | Scripts `build:*` y refresh |
| [docs/decisions.md](docs/decisions.md) | Decisiones de arquitectura vigentes |
| [docs/plan-revision-consistencia.md](docs/plan-revision-consistencia.md) | Plan de revisión estructural y de consistencia |
| [docs/sessions/STATE.md](docs/sessions/STATE.md) | Estado operativo vigente |
| [docs/sessions/](docs/sessions/) | Logs históricos; `Mavis_*` no es documentación operativa |
