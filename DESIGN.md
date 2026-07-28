# Design system — ArthurAppHub

Este es el **diseño canónico** de ArthurAppHub. Cualquier cambio de colores / tipografía / spacing debe venir acá primero, después propagarse al código.

## Filosofía

- **Fondo gris obscuro neutro** (zinc, sin tintes azules ni cálidos) + **detalles blancos** (`#ffffff` puro).
- Minimalismo: cero adornos, jerarquía por tamaño y contraste, no por color.
- Tipografía de sistema (cero descarga de fonts).
- Una sola paleta sirve para los dos modos (light/dark) — solo invierte intensidades.

## Paleta

### Dark mode (`.dark`, default si el SO lo prefiere)

| Token            | Color     | Uso                                            |
| ---------------- | --------- | ---------------------------------------------- |
| **bg**           | `#0a0a0a` | Fondo de la página                             |
| **fg**           | `#fafafa` | Texto principal y headings                     |
| **muted**        | `#71717a` | Texto secundario (descripciones, metadata)      |
| **border**       | `rgba(255,255,255,0.10)` | Bordes sutiles de tarjetas y separadores |
| **card-bg**      | `rgba(255,255,255,0.025)` | Fondo de tarjeta (vidrio sobre bg) |
| **card-hover**   | `rgba(255,255,255,0.04)`  | Fondo de tarjeta en hover            |
| **detail-white** | `#ffffff` | Acentos altos: logos, headings, hover icons     |

### Light mode (sin `.dark`)

| Token            | Color     | Uso                                            |
| ---------------- | --------- | ---------------------------------------------- |
| **bg**           | `#fafafa` | Fondo de la página                             |
| **fg**           | `#18181b` | Texto principal y headings                     |
| **muted**        | `#71717a` | Texto secundario                               |
| **border**       | `#e4e4e7` | Bordes sutiles (zinc-200)                      |
| **card-bg**      | `#ffffff` | Fondo de tarjeta                              |
| **card-hover-border** | `#d4d4d8` | Borde de tarjeta en hover                  |
| **detail-white** | `#0a0a0a` | Acentos altos: logos, headings (invertido)     |

## Cómo se aplica

- `bg-zinc-200` / `dark:border-white/10` para bordes estándar.
- `text-zinc-500` para muted (idéntico en ambos modos, intencional).
- `text-zinc-900 dark:text-white` para headings (fg).
- `bg-white/[0.025]` + `backdrop-blur` para tarjetas (vidrio sutil).
- Hover: `hover:border-white/25` (dark) o `hover:border-zinc-300` (light) + `hover:-translate-y-0.5` lift.
- Para acentos usar **siempre** `text-white` en dark, `text-zinc-900` en light (nunca colores saturados como indigo).

## Tipografía

- **Familia**: stack del sistema vía `--font-sans` en `src/styles/global.css`:
  `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, ...`
- **Heading page**: `text-3xl font-bold tracking-tight`
- **Heading card**: `font-semibold` (sin `font-bold`)
- **Body**: `text-sm` en cards, default 16px fuera
- **Metadata uppercase**: `text-[10px] font-medium uppercase tracking-wider text-zinc-500`

## Spacing / radius

- **Cards**: `rounded-2xl` (16px) + `p-5` (20px)
- **Botones / chips**: `rounded-lg` (8px)
- **Indicador de estado**: `h-2 w-2 rounded-full`
- **Container**: `max-w-6xl mx-auto px-4`
- **Gap entre cards**: `gap-4` (16px)
- **Padding de página**: `py-10` arriba del main

## Componentes

### `Header.astro`

- `border-b` con `border-zinc-200 dark:border-white/10`.
- Logo: `text-zinc-900 dark:text-white font-semibold`, tracking tight.
- Metadata (cantidad de apps): `text-xs uppercase tracking-wider text-zinc-500`.

### `AppCard.astro`

- Card de cristal: `dark:bg-white/[0.025]` sobre `bg-zinc-200`/`dark:border-white/10`.
- Hover sutil: border más opaco (`white/25`) + lift de 2px + bg ligeramente más opaco.
- Nombre del app: `text-zinc-900 dark:text-white font-semibold`.
- Descripción: `text-zinc-500` (idéntica en ambos modos).
- Categoría: bullet `h-1 w-1 rounded-full` + label en uppercase tracking.
- Emoji icono: sin alteración (siempre a color para dar carácter).

### `StatusDot.astro`

- Verde (`#10b981`) = online. Rojo (`#ef4444`) = offline. Gris zinc = unknown.
- Funcional, no decorativo — no se cambia al rebranding.

### `ThemeToggle.astro`

- Botón cuadrado `p-2` con icono sol/luna.
- Hover: `bg-white/10` + icono blanco (dark) o `bg-zinc-100` + texto zinc-900 (light).

## Convenciones

- **No usar colores saturados** (indigo, blue, green) salvo en indicadores semánticos (status online/offline).
- **No usar bg gradients**.
- **No usar sombras dramáticas** — solo `hover:shadow-lg` en cards.
- **Cambios de paleta futuros**: editar solo este archivo + `src/styles/global.css`. Los tokens en componentes ya están parametrizados por modo.

## Cómo agregar una app manteniendo el diseño

1. Sumar entrada en `src/data/apps.json` con `icon` (emoji ideal), `category`, etc.
2. Si la categoría es nueva, agregarla al array `categories`. Usar `color: "#fafafa"` (no se renderiza, pero queda como metadata para futuro).
3. Listo — el componente se encarga del estilo.

## Categorías disponibles

- **productividad** — apps de trabajo/notas (color `#3b82f6`, solo metadata).
- **gaming** — apps de juegos (D2 Wishlist, etc.). Color `#fafafa` (metadata).

Cuando se sume una nueva, agregar arriba siguiendo el patrón.
