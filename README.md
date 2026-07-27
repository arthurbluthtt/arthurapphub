# ArthurAppHub

Hub personal de apps — punto de partida a todas mis herramientas web. Construido con [Astro](https://astro.build), [Tailwind CSS 4](https://tailwindcss.com/) y desplegado en [Cloudflare Pages](https://pages.cloudflare.com/).

URL: <https://arthurapphub.pages.dev>

## Estructura

- `src/data/apps.json` — lista editable de apps (nombre, URL, ícono, categoría).
- `src/components/` — `AppCard`, `AppGrid`, `Header`, `ThemeToggle`, `StatusDot`.
- `src/pages/index.astro` — página principal (pre-renderizada).
- `src/pages/api/health.ts` — endpoint SSR que hace `HEAD` a cada URL y devuelve estado online/offline (cache 5 min).
- `astro.config.mjs` — adapter Cloudflare, Tailwind vía `@tailwindcss/vite`.

## Local

```bash
npm install
npm run dev               # http://localhost:4321
npm run build             # genera dist/
npx wrangler pages dev ./dist   # simula Pages + Functions
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

Commit + push → redeploy automático en Pages.

## Deploy

1. Push a `main` en GitHub.
2. Cloudflare Dashboard → Workers & Pages → `arthurapphub` → Settings → Builds:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION=20`

## Features

- Grid responsive de tarjetas con ícono, nombre, descripción y link externo.
- Toggle dark/light persistente (`localStorage`, respeta `prefers-color-scheme`).
- Indicador de estado online/offline por app (ping `HEAD` al endpoint `/api/health`).
- Sin search bar ni filtros (versión mínima). Se pueden agregar después sin cambios estructurales.
