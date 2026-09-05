# Suscripciones — `/subs`

Control de gastos de suscripciones mensuales (MXN/USD). Login requerido.

## Qué hace

Lista de suscripciones con nombre, precio por mes, moneda (MXN/USD) y día de cobro (1–31). Chip FAB "+ Agregar suscripción" abre dialog para crear o editar; cada card tiene toggle Activa/Pausada, editar y eliminar. Summary superior con **Total del mes** (suma de activas, desglosado por moneda y ocultando las monedas sin activas) y **Próximo cobro** (sub activa más cercana con fecha `12 ago`).

## Storage

| Tabla | Migración | Esquema | Índices |
|---|---|---|---|
| `subs` | 0009 | `(username, id, name, price_cents, currency, billing_day, active, created_at)` — precio en centavos (enteros, sin floats) | `(username, active, created_at DESC)` |

## API

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| `POST` | `/subs/api/add` | `{name, priceCents, currency, billingDay}` | `201 {sub}` / `400` inválido |
| `POST` | `/subs/api/update` | `{id, name, priceCents, currency, billingDay}` | `{sub}` / `404` |
| `POST` | `/subs/api/remove` | `{id}` | `204` |
| `POST` | `/subs/api/toggle-active` | `{id}` | `{active}` |

Validación: `name` no vacío, `priceCents` entero no negativo, `currency` en `MXN|USD`, `billingDay` entero 1–31.

Las respuestas `{sub}` incluyen `id`, `name`, `priceCents`, `currency`,
`billingDay`, `active` y `createdAt`.

## UX

- Summary recalculado en cliente tras agregar/editar/toggle/eliminar (`subs:subs-changed`).
- Próximo cobro clampeado al último día del mes (31 en feb → 28/29); fecha "hoy" en `America/Mexico_City` (el Worker corre en UTC).
- Día de cobro con **cuadrícula 1–31** (7 columnas, patrón `DESIGN.md` § Día picker), sin selección default.
- Dialog usa prefijo `data-sub-dialog-*` separado de `data-sub-*` de las cards para no colisionar en `querySelector`.
- Layout: `BaseLayout contentMaxWidth max-w-[1760px] 2xl:max-w-[2240px]` + `grid gap-4 grid-cols-1 sm:2 lg:3 xl:4 2xl:5` (5 por fila en ultrawide).
