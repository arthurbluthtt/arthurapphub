/**
 * Parseo + validación del payload compartido de una suscripción
 * (add / update). Devuelve `{ ok, value }` o `{ ok, error }`.
 */

import {
  clampBillingDay,
  isCurrency,
  MAX_BILLING_DAY,
  MIN_BILLING_DAY,
  type SubInput,
} from './store';

export type ParseResult =
  | { ok: true; value: SubInput }
  | { ok: false; error: string };

export function parseSubInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) return { ok: false, error: 'name required' };
  if (name.length > 100) return { ok: false, error: 'name too long' };

  const priceCents =
    typeof b.priceCents === 'number' && Number.isFinite(b.priceCents)
      ? Math.round(b.priceCents)
      : NaN;
  if (!Number.isInteger(priceCents) || priceCents < 0) {
    return { ok: false, error: 'priceCents invalid' };
  }

  if (!isCurrency(b.currency)) return { ok: false, error: 'currency invalid' };

  const billingDay =
    typeof b.billingDay === 'number' && Number.isFinite(b.billingDay)
      ? Math.round(b.billingDay)
      : NaN;
  if (
    !Number.isInteger(billingDay) ||
    billingDay < MIN_BILLING_DAY ||
    billingDay > MAX_BILLING_DAY
  ) {
    return { ok: false, error: 'billingDay invalid' };
  }

  return {
    ok: true,
    value: {
      name,
      priceCents,
      currency: b.currency,
      billingDay: clampBillingDay(billingDay),
    },
  };
}
