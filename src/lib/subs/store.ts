/**
 * CRUD para la sub-app Suscripciones. Misma forma que `lib/uma/wishlist.ts`:
 * cada fila = una suscripción mensual del usuario, en la misma D1
 * (`arthurapphub-auth-db`).
 *
 * El precio se guarda en centavos (enteros) para evitar errores de floats.
 * Solo las suscripciones `active = 1` suman al total del mes.
 */

export const CURRENCIES = ['MXN', 'USD'] as const;
export type SubCurrency = (typeof CURRENCIES)[number];

export const MIN_BILLING_DAY = 1;
export const MAX_BILLING_DAY = 31;

export interface SubRow {
  id: string;
  name: string;
  priceCents: number;
  currency: SubCurrency;
  billingDay: number;
  active: boolean;
  createdAt: number;
}

export interface SubInput {
  name: string;
  priceCents: number;
  currency: SubCurrency;
  billingDay: number;
}

interface D1Row {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  billing_day: number;
  active: number;
  created_at: number;
}

export function isCurrency(v: unknown): v is SubCurrency {
  return typeof v === 'string' && (CURRENCIES as readonly string[]).includes(v);
}

export function clampBillingDay(day: number): number {
  return Math.min(MAX_BILLING_DAY, Math.max(MIN_BILLING_DAY, day));
}

function toRow(r: D1Row): SubRow {
  return {
    id: r.id,
    name: r.name,
    priceCents: r.price_cents,
    currency: isCurrency(r.currency) ? r.currency : 'MXN',
    billingDay: r.billing_day,
    active: r.active === 1,
    createdAt: r.created_at,
  };
}

export async function listSubs(db: D1Database, username: string): Promise<SubRow[]> {
  const res = await db
    .prepare(
      `SELECT id, name, price_cents, currency, billing_day, active, created_at
       FROM subs
       WHERE username = ?
       ORDER BY active DESC, created_at ASC`
    )
    .bind(username)
    .all<D1Row>();
  return (res.results ?? []).map(toRow);
}

export async function addSub(
  db: D1Database,
  username: string,
  sub: SubInput,
  id: string
): Promise<SubRow> {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO subs
         (username, id, name, price_cents, currency, billing_day, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
    )
    .bind(username, id, sub.name, sub.priceCents, sub.currency, sub.billingDay, now)
    .run();
  return {
    id,
    name: sub.name,
    priceCents: sub.priceCents,
    currency: sub.currency,
    billingDay: sub.billingDay,
    active: true,
    createdAt: now,
  };
}

export async function updateSub(
  db: D1Database,
  username: string,
  id: string,
  sub: SubInput
): Promise<SubRow | null> {
  const row = await db
    .prepare(
      `UPDATE subs
       SET name = ?, price_cents = ?, currency = ?, billing_day = ?
       WHERE username = ? AND id = ?
       RETURNING id, name, price_cents, currency, billing_day, active, created_at`
    )
    .bind(sub.name, sub.priceCents, sub.currency, sub.billingDay, username, id)
    .first<D1Row>();
  return row ? toRow(row) : null;
}

export async function removeSub(
  db: D1Database,
  username: string,
  id: string
): Promise<boolean> {
  const res = await db
    .prepare('DELETE FROM subs WHERE username = ? AND id = ?')
    .bind(username, id)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function toggleActive(
  db: D1Database,
  username: string,
  id: string
): Promise<{ active: boolean } | null> {
  const current = await db
    .prepare('SELECT active FROM subs WHERE username = ? AND id = ?')
    .bind(username, id)
    .first<{ active: number }>();
  if (!current) return null;
  const nextActive = current.active === 1 ? 0 : 1;
  await db
    .prepare('UPDATE subs SET active = ? WHERE username = ? AND id = ?')
    .bind(nextActive, username, id)
    .run();
  return { active: nextActive === 1 };
}
