# Design system — ArthurAppHub

> Ver también: [INDEX.md](INDEX.md) (mapa), [docs/architecture.md](docs/architecture.md) (stack), [docs/decisions.md](docs/decisions.md) (decisiones).

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
- **Container**: `max-w-6xl mx-auto px-4` (default). `max-w-[1760px]` en xl, `max-w-[2240px]` en 2xl para hub (6 por fila en `AppGrid`) y sub-apps con grids densos (`games xl:6`, `destiny xl:6`, `zzz` fluido `1→2→3→4`, `subs` `1→2→3→4→5` 5 por fila fix hueco).
- **Gap entre cards**: `gap-4` (16px) estándar. `gap-3` (12px) para grids fluidos con cards anchas. `gap-6` para grids más amplios.
- **Hub grid**: `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6` en `AppGrid.astro`. Ver `STATE.md` hub deploy.
- **Grid fluido para cards anchas (ZZZ estándar)**: usar cuando la card es ancha (>300px) o split interno (ej. ZZZ `w-[62%]/38%` `aspect-[1/2]`). Patrón: `grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4` + card `flex w-full` (nunca `w-[500px]` fijo). El `1fr` distribuye el sobrante y elimina el hueco a la derecha (`flex flex-wrap justify-start` con ancho fijo dejaba ~150px: `3*588+24=1788 > 1760` no entraba la 4ª). Interno `w-[62%] imagen aspect-[1/2] 1080×2160` + `w-[38%] info` escala con la celda. Requiere `BaseLayout contentMaxWidth="max-w-[1760px] 2xl:max-w-[2240px]"`. Usar también en `buildCard()` JS (`a.className='flex w-full ...'`). Ver `STATE.md` ZZZ deploy `d7c33f38` (4 por fila en 2xl sin hueco).
- **Grid fluido portrait para cards angostas (media/manga/book/anime)**: `grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8` + card `w-full` (antes `flex flex-wrap justify-start gap-3` + `w-[120→220]` dejaba hueco a derecha en `1760/2240`). `aspect-[2/3]` (manga/book) / `aspect-[4/5]` (media/anime) se mantiene. `games` usa variante `gap-4 grid-cols-1 sm:2 md:3 lg:5 xl:6 2xl:7` por cover `460/215` más ancha.
- **Padding de página**: `py-10` arriba del main

## Componentes — línea base (lanzador de apps)

### `Header.astro`

- `border-b` con `border-zinc-200 dark:border-white/10`.
- Logo: `text-zinc-900 dark:text-white font-semibold`, tracking tight.
- Metadata (cantidad de apps): `text-xs uppercase tracking-wider text-zinc-500`.
- Username (si logueado): `text-sm text-zinc-500` (visible solo si hay cookie `hub_user`, leída via JS).
- Salir: chip pequeño `rounded-full border border-zinc-200 dark:border-white/10` con hover.

### `AppGrid.astro` / `AppCard.astro`

- **Grid**: `grid-cols-1 sm:2 md:3 lg:4 xl:6` + `gap-4` + `contentMaxWidth max-w-6xl xl:max-w-[1760px] 2xl:max-w-[2240px]` en `index.astro` (hub 6 por fila en xl, 9 apps → 6+3).
- **Card** de cristal: `dark:bg-white/[0.025]` sobre `bg-zinc-200`/`dark:border-white/10`.
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

### Día picker (cuadrícula numérica)

Para elegir un día del mes sin scrollear un `<select>` (ej: día de cobro en Suscripciones). Preferible a un `<select>` cuando el rango es fijo y chico (1-31):

- **Container**: `grid grid-cols-7 gap-1` (7 columnas, como las semanas de un calendario).
- **Botón base**: `grid h-8 place-items-center rounded-lg border border-zinc-200 text-xs tabular-nums text-zinc-700 transition dark:border-white/10 dark:text-zinc-200`.
- **Hover (solo si NO está seleccionado)**: `hover:border-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10` — se quitan al seleccionar para no pisar el fondo invertido (toggle por `classList.toggle`).
- **Seleccionado**: `border-transparent bg-zinc-900 text-white dark:bg-white dark:text-zinc-900` (mismo lenguaje de chips activos) + `aria-pressed="true"`.
- **Sin selección default**: el submit valida que haya un día elegido y muestra el error inline (no hay día preseleccionado al abrir).
- Al editar, el estado se restaura desde el valor guardado (misma función de render que el click).

### Filtros (chips de estado / tipo)

Para filtros pill con conteo:

- **Container**: `flex flex-wrap items-center gap-2`.
- **Chip base**: `rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/10`.
- **Chip activo**: `bg-zinc-900 text-white dark:bg-white dark:text-zinc-900` (invertido, alto contraste).
- **Conteo**: agregar `<span class="ml-1.5 text-zinc-500">12</span>` (sin fondo propio, hereda color del chip).

### Buscador (SearchBar)
Para listas con muchas tarjetas (D2, Uma, trackers, ZZZ, Subs). Patrón `src/components/SearchBar.astro` `Buscar...`:
- **Input**: `rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white` con icono `⌕` `absolute left-3` y clear `×` `absolute right-2` `data-search-clear hidden` hasta tener valor.
- **Dataset**: cada `<article>` lleva `data-search={name.toLowerCase()}` (D2 solo `name`, Uma `name+" "+version`, Games `name+" "+saga`, Media/Manga/Book/Anime `title`, ZZZ `characterName`, Subs `name`). `w-full` + `grid` fluido ya registrado.
- **JS**: `let currentSearch=""` + debounce 200ms `setTimeout 200` sobre `input` → `currentSearch=(value).trim().toLowerCase()` + `toggleClear()` + `applyFilters()` / `applySearch()`. Clear button `click` → resetea y `focus()`. Sin URL (`history.replaceState`), solo memoria — combina con `statusOk && typeOk && qOk` en `applyFilters`. En ZZZ `currentSearch` deshabilita drag (handle oculto, `draggable=false`) — limpiar `Buscar...` para reordenar.
- **Construcción runtime**: `build*Card()` setea `article.dataset.search = (title/name).toLowerCase()` para que el filtro aplique a cards creadas tras `added`/`edited`.

### Reordenar ZZZ (drag handle, 0 deps, fix 2D)
Para ordenar por importancia. Patrón handle `⋮⋮` `src/components/zzz/ZzzCard.astro` + `src/pages/zzz/index.astro`:
- **Handle**: `<button data-drag-handle aria-label="Arrastrar" title="Arrastrar para ordenar (mantener pulsado en móvil)" class="absolute left-1 top-1 z-10 grid h-7 w-7 place-items-center rounded bg-zinc-950/60 text-white backdrop-blur cursor-grab active:cursor-grabbing touch-manipulation opacity-80 md:opacity-0 md:group-hover:opacity-100">⋮⋮</button>` siempre visible en móvil (`opacity-80`), hover en desktop. Se oculta si `Buscar...` tiene texto (`currentSearch` → `draggable=false` + `display:none` + `title "Limpia la búsqueda para reordenar"`).
- **Card**: `group draggable="true"` + `data-zzz-card data-zzz-id data-search`. `grid gap-3 grid-cols-1 md:2 xl:3 2xl:4` mantiene layout. Solo se permite drag si `mousedown` vino del handle (`canDrag` + `pendingHandleCard`), no de toda la card (evita conflicto con ✎/×).
- **JS 0 deps — desktop**: `mousedown` sobre handle → `canDrag=true` + `pendingHandleCard`; `dragstart` valida `canDrag && pendingHandleCard && !currentSearch` → `dragId/dragEl` + `dragging opacity-50 ring-2`. `dragover` `preventDefault` + `getClosestCard(x,y)` 2D (distancia a `cx = left+width/2, cy = top+height/2`, excluye `.dragging` y `.hidden`, `before = y<cy || (|y-cy|<h/3 && x<cx)`) → `insertBefore(dragEl, closest)` o `closest.nextSibling` / `appendChild`. `drop/dragend` limpia y `persistOrder()`.
- **JS 0 deps — móvil**: `touchstart` sobre handle + `setTimeout 180ms` (mantener aplastado) activa `dragging`, `touchmove` con `clientX/clientY` → mismo `getClosestCard(x,y)` 2D, `touchend` persiste. Sin este fix Y-only (`y < top+height/2`) siempre insertaba en el 1º puesto en grid 2D.
- **Persistencia**: `persistOrder() → orderedIds=[...grid.querySelectorAll('[data-zzz-card]')].map(el=>el.dataset.zzzId)` → `builds.sort` local + `POST /zzz/api/reorder {orderedIds}`.
- **API**: `POST /zzz/api/reorder` valida permutación exacta `reorderZzz()` (`position 0..n`, `batch UPDATE position`, `idx_zzz_user_position`).
- **Store**: `migrations/0019_zzz_position.sql` `position INTEGER` + `idx_zzz_user_position`, `listZzz ORDER BY COALESCE(position,9999), created_at ASC`, `addZzz MAX(position)+1`.

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
