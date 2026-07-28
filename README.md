# ArthurAppHub

Hub personal de apps — punto de partida a todas mis herramientas web. Construido con [Astro](https://astro.build), [Tailwind CSS 4](https://tailwindcss.com/) y desplegado como [Cloudflare Worker](https://workers.cloudflare.com/).

URL: <https://arthurapphub.arthurbluthtt.workers.dev>

## Estado actual

- Grid responsivo de tarjetas con ícono, nombre, descripción y link.
- Toggle dark/light persistente (`localStorage`, respeta `prefers-color-scheme`).
- Indicador online/offline por app (ping `HEAD` al endpoint `/api/health`).
- Static assets servidos por la binding `ASSETS` desde Cloudflare.
- Click en cada tarjeta abre en la **misma pestaña** (sin `target="_blank"`).
- Auto-deploy en cada `push` a `main` vía GitHub Action.

## Estructura

- `src/data/apps.json` — lista editable de apps (nombre, URL, ícono, categoría).
- `src/components/` — `AppCard`, `AppGrid`, `Header`, `ThemeToggle`, `StatusDot`.
- `src/pages/index.astro` — página principal (pre-renderizada).
- `src/pages/api/health.ts` — endpoint SSR que hace `HEAD` a cada URL y devuelve estado online/offline (cache 5 min).
- `DESIGN.md` — sistema de diseño (paleta, tipografía, componentes). Single source of truth.
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

## Deploy

Push a `main` en GitHub dispara `.github/workflows/deploy.yml`:

1. `npm ci` + `npm run build`
2. `wrangler deploy` con los secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` en el repo (GitHub → Settings → Secrets and variables → Actions).

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
- Commit + push → redeploy automático.

## Próximo: SSO multi-app

Este hub se va a transformar en **Identity Provider** para todas las apps vinculadas. Hoy solo Notas; cuando se sumen más (tareas, pronóstico, etc.), compartirán el mismo PIN.

Ver `STATE.md` para el plan completo de migración.

## Features

- Grid responsive de tarjetas con ícono, nombre, descripción y link.
- Toggle dark/light persistente.
- Indicador online/offline por app.
- Static assets servidos por la binding `ASSETS`.
- Sin search bar ni filtros (versión mínima).
