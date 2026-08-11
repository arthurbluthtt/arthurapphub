# Design system — ArthurAppHub

Este es el **diseño canónico** de ArthurAppHub. Cualquier cambio de colores / tipografía / spacing debe venir acá primero, después propagarse al código.

La línea base la define el **lanzador de apps** (grid + header + theme toggle). La sub-app **D2 Wishlist** la **extiende** con un set de patrones más rico (modales, dropdowns, chips flotantes, filtros) que se convierten en el **estándar** para cualquier futura app vinculada al hub. Si vas a agregar una app nueva, seguí esta guía completa.

## Filosofía

- **Fondo gris obscuro neutro** (zinc, sin tintes azules ni cálidos) + **detalles blancos** (`#ffffff` puro).
- Minimalismo: cero adornos, jerarquía por tamaño y contraste, no por color.
- Tipografía de sistema (cero descarga de fonts).
- Una sola paleta sirve para los dos modos (light/dark) — solo invierte intensidades.
- **Componentes interactivos con el mismo lenguaje**: bordes sutiles, hover lift, focus rings blancos, animaciones cortas (≤150ms).
- **`color-scheme` sincronizado** con el tema (CSS en `global.css`): `html { color-scheme: light }`, `html.dark { color-scheme: dark }`. Así los form controls nativos (options de `<select>`, scrollbars) respetan el tema sin override custom.

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
| **select-bg**    | `#27272a` | Fondo sólido de `<select>` en dark mode (`zinc-800`) — distinguible del dialog |

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
| **select-bg**    | `#ffffff` | Fondo de `<select>` en light mode              |

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
- **Input uppercase / chip label**: `text-xs font-medium uppercase tracking-wider`

## Spacing / radius

- **Cards**: `rounded-2xl` (16px) + `p-5` (20px)
- **Botones / chips**: `rounded-lg` (8px)
- **Chips pequeños** (filtros, iconos): `rounded-full` (pill) + `px-3 py-1.5 text-xs`
- **Indicador de estado**: `h-2 w-2 rounded-full`
- **Container**: `max-w-6xl mx-auto px-4` (default). `max-w-[1760px]` en xl, `max-w-[2240px]` en 2xl para sub-apps con grids densos.
- **Gap entre cards**: `gap-4` (16px). `gap-6` para grids más amplios.
- **Padding de página**: `py-10` arriba del main

## Componentes — línea base (lanzador de apps)

### `Header.astro`

- `border-b` con `border-zinc-200 dark:border-white/10`.
- Logo: `text-zinc-900 dark:text-white font-semibold`, tracking tight.
- Metadata (cantidad de apps): `text-xs uppercase tracking-wider text-zinc-500`.
- Username (si logueado): `text-sm text-zinc-500` (visible solo si hay cookie `hub_user`, leída via JS).
- Salir: chip pequeño `rounded-full border border-zinc-200 dark:border-white/10` con hover.

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

## Extensiones de la línea base (D2 Wishlist)

D2 Wishlist extiende el lenguaje del lanzador con un set de patrones que se vuelven el **estándar** para sub-apps que requieren interacción rica. Si agregás una app que necesita modales, dropdowns, filtros o chips flotantes, usá exactamente estos patrones.

### Chips flotantes (FAB)

Para acciones primarias que deben estar siempre accesibles sin interrumpir el contenido (ej: "+ Agregar arma", "✦ Icono perk"):

- **Posición**: `fixed bottom-X right-4` con `z-30` (queda por encima del contenido, debajo del dialog).
- **Shape**: `rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 shadow-md` + variante dark con `dark:bg-zinc-800 dark:text-white`.
- **Hover**: `hover:-translate-y-0.5 hover:shadow-lg` (mismo lift que las cards).
- **Stack vertical**: usar `bottom-4` para el primario y `bottom-16` (con `gap-12` ≈ `bottom-4 + 3rem`) para el secundario. Mantener `right-4` consistente.

### Dialogs modales

Usar `<dialog>` nativo con `showModal()`. Patrón obligatorio:

- **Shell**: `m-auto max-h-[90vh] w-[min(<width>,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl dark:border-white/10 dark:bg-zinc-900 dark:text-white`.
- **Backdrop**: `backdrop:bg-zinc-900/95 dark:backdrop:bg-zinc-950/95` (oscurece fuerte para foco).
- **Header**: `flex items-center gap-3 border-b border-zinc-200 p-4 dark:border-white/10` con título + subtítulo (`text-xs uppercase tracking-wider text-zinc-500`) + botón cerrar (`grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-white/10`).
- **Body**: `p-4` con el contenido. Si el contenido puede ser largo, agregar `max-h-[60vh] overflow-y-auto` al contenedor interno.
- **Footer**: `flex items-center justify-end gap-3 border-t border-zinc-200 p-4 dark:border-white/10` con botones alineados a la derecha.
- **Status bar** (errores / mensajes): `m-0 border-t border-zinc-200 px-4 py-2 text-center text-xs text-zinc-500 dark:border-white/10`, con `text-red-500 dark:text-red-400` para errores.

**Crítico — scroll lock del body**: el `<dialog>` nativo con backdrop translúcido **no bloquea el scroll del body de forma confiable** en todos los navegadores. Implementar `lockBodyScroll()` / `unlockBodyScroll()`:

```js
let bodyLocked = false;
function lockBodyScroll() {
  if (bodyLocked) return;
  bodyLocked = true;
  const sbw = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.overflow = 'hidden';
  if (sbw > 0) document.body.style.paddingRight = sbw + 'px';
}
function unlockBodyScroll() {
  if (!bodyLocked) return;
  bodyLocked = false;
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
}
```

Llamar `lockBodyScroll()` antes de `dialog.showModal()` en **todos** los puntos de apertura (chip click, edit flow, custom event). Llamar `unlockBodyScroll()` en `closeDialog()`. El flag `bodyLocked` evita doble-lock cuando hay múltiples puntos de apertura (ej: `chip.click` + evento `destiny:open-add-weapon`).

### Dropdowns (perk picker)

Cuando se necesita un dropdown que escapa el clipping del `<dialog>`, usar el patrón **fixed-position** calculado por JS:

- **Shell CSS**: `fixed z-[9999] mt-1 hidden max-h-72 overflow-y-auto rounded-lg border border-zinc-300 bg-white p-1 text-zinc-900 shadow-2xl ring-1 ring-black/5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100` — `position:fixed` se aplica desde el CSS inicial (no esperar al JS), así nunca se renderiza con `position:static`.
- **JS** (`positionDropdown(slot)`):
  - Calcular `getBoundingClientRect()` del input asociado.
  - Setear `top`/`left`/`width`/`maxHeight` en coords de viewport.
  - Invertir `top`↔`bottom` según `spaceBelow < minSpace && spaceAbove > spaceBelow`.
  - `z-index: 9999` (queda por encima del backdrop).
- **Atomic reveal — crítico**: `positionDropdown(slot)` se invoca **antes** de `classList.remove('hidden')` en `renderPerkSuggestions`. El navegador nunca ve el dropdown sin posicionamiento (causa raíz del bug "a la mitad" original, donde un frame intermedio con `position:static` desincronizaba las coords).
- **No auto-focus**: nunca hacer `perkInputs[0].focus()` al cargar el dialog, porque el focus listener dispara el fetch+render del dropdown y se abre solo. El usuario hace click en el input cuando quiere tipear.
- **Re-posicionamiento en scroll/resize** del window, **con filtro** para no reposicionar cuando el scroll es interno al propio dropdown (`dropdown.contains(e.target)`).
- **No reabrir tras selección**: usar un flag `state.perkConfirmed[slot]` que el `input` handler respeta para evitar re-render cuando el valor coincide con el último confirmado. Limpiar el flag cuando el usuario edita el valor.

### Listas (chips de filtro)

Para listas de filtros (estado, tipo de arma, etc.) usar chips pill con conteo:

- **Container**: `flex flex-wrap items-center gap-2`.
- **Chip base**: `rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/10`.
- **Chip activo**: `bg-zinc-900 text-white dark:bg-white dark:text-zinc-900` (invertido, alto contraste).
- **Conteo**: badge pequeño dentro del chip con `bg-white/20` o `bg-zinc-200 dark:bg-white/10`. El número va separado visualmente (`ml-1.5 text-zinc-500`).

### Orden de resultados en dropdowns

Cuando el dropdown muestra perks/items con un ranking útil:

1. **Score de match** (rankMatch: exact > prefix > word-prefix > -1) — siempre primero.
2. **Popularidad / uso** del usuario (cuántas veces aparece en su wishlist/historial) — desempate secundario.
3. **Nombre alfabético** — desempate final.

Cada item con `useCount > 1` muestra un chip `×N` (estilo `bg-zinc-200 px-1 text-[10px] tabular-nums dark:bg-white/10`) con tooltip "Usada en N armas".

### Selects nativos

Para que los options nativos respeten el tema, **aplicar fondo sólido distinguible** (no `bg-white/[X]` con opacidad baja) en ambos modos:

```html
<select class="... border-zinc-300 bg-white ... dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
```

Más importante aún: **el `<html>` debe tener `color-scheme`** sincronizado con el tema (`global.css` ya lo hace):

```css
html { color-scheme: light; }
html.dark { color-scheme: dark; }
```

Sin esto, los options nativos se renderizan con los colores del SO (fondo blanco + texto oscuro) y heredan el `text-white` del select = invisible.

### Filtros (chips de estado / tipo)

Para filtros pill con conteo:

- **Container**: `flex flex-wrap items-center gap-2`.
- **Chip base**: `rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/10`.
- **Chip activo**: `bg-zinc-900 text-white dark:bg-white dark:text-zinc-900` (invertido, alto contraste).
- **Conteo**: agregar `<span class="ml-1.5 text-zinc-500">12</span>` (sin fondo propio, hereda color del chip).

### Cards de armas (D2 Wishlist)

- **Container**: `flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-zinc-900 shadow-sm dark:border-white/10 dark:bg-zinc-900 dark:text-white` (más chico que `AppCard` — es un item de grid, no una card de entrada).
- **Header**: ícono del arma + nombre (`font-semibold truncate`) + tier badge (si aplica) + botón editar (`grid h-7 w-7 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-white/10`).
- **Perks**: 2 filas (Cañón+Cargador arriba, Rasgo 1+Rasgo 2 abajo). Cada perk: ícono 24px + nombre truncado.
- **Footer**: chip "Encontrada" con toggle (`bg-emerald-500/10 text-emerald-700 dark:text-emerald-400`) cuando `found=true`.

## Convenciones

- **No usar colores saturados** (indigo, blue, green) salvo en indicadores semánticos (status online/offline, badges de armas exotic/legendary, "Encontrada").
- **No usar bg gradients**.
- **No usar sombras dramáticas** — solo `hover:shadow-lg` en cards.
- **`<dialog>` siempre con scroll lock** del body. Sin excepciones.
- **Cambios de paleta futuros**: editar solo este archivo + `src/styles/global.css`. Los tokens en componentes ya están parametrizados por modo.
- **Nombres de clases/data-attributes** en kebab-case: `data-add-weapon-chip`, `data-perk-icon-dialog`, etc.
- **Botones primarios**: `bg-zinc-900 text-white dark:bg-white dark:text-zinc-900`. **Secundarios**: `border border-zinc-200 dark:border-white/10`. **Destructivos**: `text-red-500 hover:bg-red-500/10`.

## Cómo agregar una app manteniendo el diseño

1. Sumar entrada en `src/data/apps.json` con `icon` (emoji ideal), `category`, etc.
2. Si la categoría es nueva, agregarla al array `categories`. Usar `color: "#fafafa"` (no se renderiza, pero queda como metadata para futuro).
3. Si la app necesita interacción rica (modales, dropdowns, filtros, chips flotantes): **usar los patrones de la sección "Extensiones de la línea base"** de este mismo archivo. No reinventar el estilo.
4. Listo — el componente se encarga del estilo.

## Categorías disponibles

- **productividad** — apps de trabajo/notas (color `#3b82f6`, solo metadata).
- **gaming** — apps de juegos (D2 Wishlist, etc.). Color `#fafafa` (metadata).
- **finanzas** — apps de dinero/gastos (Suscripciones). Color `#fafafa` (metadata).

Cuando se sume una nueva, agregar arriba siguiendo el patrón.