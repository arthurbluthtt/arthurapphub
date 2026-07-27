# ArthurAppHub

Hub personal de apps — punto de partida a todas mis herramientas web. Construido con [Astro](https://astro.build), [Tailwind CSS 4](https://tailwindcss.com/) y desplegado como [Cloudflare Worker](https://workers.cloudflare.com/).

URL: <https://arthurapphub.arthurbluthtt.workers.dev>

## Estructura

- `src/data/apps.json` — lista editable de apps (nombre, URL, ícono, categoría).
- `src/components/` — `AppCard`, `AppGrid`, `Header`, `ThemeToggle`, `StatusDot`.
- `src/pages/index.astro` — página principal (pre-renderizada).
- `src/pages/api/health.ts` — endpoint SSR que hace `HEAD` a cada URL y devuelve estado online/offline (cache 5 min).
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

## Agregar una app nueva

Editar `src/data/apps.json`:

```json
{
  "id": "mi-app",
  "name": "Mi App",
  "description": "Una línea explicando qué hace",
  "url": "https://app.example.com",
  "icon": "🚀",
  "category": "productividad",
  "tags": ["tag1"],
  "featured": false
}
```

- `icon` puede ser emoji (recomendado para empezar) o ruta a un SVG en `public/apps/<id>.svg`.
- `category` debe existir en `categories[].id`. Para agregar una categoría nueva, sumarla al array `categories`.

Commit + push → redeploy automático via GitHub Action.

## Deploy

Este proyecto usa **Cloudflare Workers** (no Pages — Astro 7 ya no soporta Pages vía el adapter oficial). Auto-deploy vía GitHub Action:

1. Push a `main` en GitHub dispara `.github/workflows/deploy.yml`.
2. Necesita dos secrets en el repo (Settings → Secrets and variables → Actions):
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. El workflow corre `npm ci`, `npm run build` y `wrangler deploy` contra el worker `arthurapphub`.

Para deploys manuales desde la máquina local:

```bash
$env:CLOUDFLARE_API_TOKEN = "cfat_..."
$env:CLOUDFLARE_ACCOUNT_ID = "..."
npx wrangler deploy
```

## Features

- Grid responsive de tarjetas con ícono, nombre, descripción y link externo.
- Toggle dark/light persistente (`localStorage`, respeta `prefers-color-scheme`).
- Indicador de estado online/offline por app (ping `HEAD` al endpoint `/api/health`).
- Static assets servidos por la binding `ASSETS` desde Cloudflare.
- Sin search bar ni filtros (versión mínima). Se pueden agregar después sin cambios estructurales.

## Nota técnica

El adapter de Astro 7 habilita por defecto sesiones con Cloudflare KV (binding `SESSION`). Para evitar requerir permisos KV en el token de deploy, se usa `session: { driver: 'lruCache' }` en `astro.config.mjs` (driver en memoria — irrelevante porque no usamos sesiones). Si en el futuro agregás auth/sesiones, cambiá a `cloudflareKVBinding` y otorgá permiso `Workers KV Storage:Edit` al token.

<!-- last verified 2026-07-26 22:12 Z -->

<!-- retry deploy after ip allowlist fix 22:16:50 -->

<!-- retry with new user api token 22:21:17 -->
