# AGENTS.md — Instrucciones para AI agents

## Dev server

Usar background mode:

```
astro dev --background
```

Gestión: `astro dev stop` / `astro dev status` / `astro dev logs`.

`vite.server.watch.ignored: ['**/.wrangler/**']` ya está configurado para evitar el crash `EINVAL lstat .sqlite-wal` en Windows.

## Dónde está la doc

| Doc | Qué contiene |
|---|---|
| `INDEX.md` | Mapa navegable — empezar acá |
| `README.md` | Qué hace, quickstart, deploy, agregar app |
| `DESIGN.md` | **Single source of truth** para paleta, tipografía y componentes (chips, dialogs, dropdowns, grids fluidos, etc.) |
| `docs/architecture.md` | Stack, bindings D1/R2, flujo SSO, lifecycle |
| `docs/decisions.md` | Decisiones vigentes (por qué se hizo X) |
| `docs/data-pipelines.md` | Scripts `build:*` y refresh |
| `docs/sub-apps/*.md` | Detalle por sub-app (storage, API, UX) |
| `docs/sessions/` | Logs de sesión archivados |

## Convenciones

- **Idioma**: doc y comentarios en español; código en inglés.
- **Patrón nuevo → `DESIGN.md` primero**, después propagar al código. No inventar estilos fuera de `DESIGN.md` § Extensiones.
- **Decisión nueva → `docs/decisions.md`**.
- **Sub-app nueva**: clonar el patrón de `docs/sub-apps/trackers.md` (store + componentes + páginas + API). Ver `README.md` → "Agregar una app nueva".
- **Clases/data-attributes** en `kebab-case`: `data-add-weapon-chip`, `data-saga-filter`, etc.
- **Migrations**: `migrations/NNNN_nombre.sql`, aplicar con `wrangler d1 migrations apply arthurapphub-auth-db --remote`.
- No commitear secrets. No crear `.md` nuevos en la raíz sin necesidad.

## Referencias externas

- Astro routing/components/content: https://docs.astro.build/en/guides/routing/ etc.
- Cloudflare Workers / D1 / R2: https://developers.cloudflare.com/
