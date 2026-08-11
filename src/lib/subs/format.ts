/**
 * Formato de dinero + cálculo del próximo cobro para la sub-app Suscripciones.
 *
 * La fecha de "hoy" se resuelve en la zona del usuario (America/Mexico_City)
 * para no desfasar el día de cobro cerca de los límites del mes (el worker
 * corre en UTC).
 */

import type { SubRow } from './store';

export interface NextDate {
  year: number;
  month: number;
  day: number;
}

export interface TodayParts {
  year: number;
  month: number;
  day: number;
}

const TZ = 'America/Mexico_City';
const CURRENCY_FMT_CACHE = new Map<string, Intl.NumberFormat>();
const MONTH_DAY_FMT = new Intl.DateTimeFormat('es-MX', {
  timeZone: TZ,
  day: 'numeric',
  month: 'short',
});

function currencyFmt(currency: string): Intl.NumberFormat {
  let f = CURRENCY_FMT_CACHE.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    });
    CURRENCY_FMT_CACHE.set(currency, f);
  }
  return f;
}

export function formatPrice(cents: number, currency: string): string {
  return currencyFmt(currency).format(cents / 100);
}

export function todayParts(): TodayParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getDate();
}

/**
 * Próxima fecha de cobro de una sub: el `billing_day` se clampea al último día
 * del mes en meses cortos (31 en febrero → 28/29) y salta al mes siguiente si
 * el día ya pasó.
 */
export function nextChargeDate(
  sub: Pick<SubRow, 'billingDay'>,
  today: TodayParts = todayParts()
): NextDate {
  const dim = daysInMonth(today.year, today.month);
  const day = Math.min(sub.billingDay, dim);
  if (day >= today.day) return { year: today.year, month: today.month, day };
  const year = today.month === 12 ? today.year + 1 : today.year;
  const month = today.month === 12 ? 1 : today.month + 1;
  return { year, month, day: Math.min(sub.billingDay, daysInMonth(year, month)) };
}

export function formatMonthDay(date: NextDate): string {
  // Mediodía UTC: en America/Mexico_City (UTC-6) sigue siendo el mismo día.
  return MONTH_DAY_FMT.format(new Date(Date.UTC(date.year, date.month - 1, date.day, 12)));
}

export function dateSortKey(date: NextDate): number {
  return date.year * 10000 + date.month * 100 + date.day;
}

/** Próxima sub activa por cobrar (más cercana; empate → la más antigua). */
export function nextCharge(
  subs: SubRow[],
  today: TodayParts = todayParts()
): { sub: SubRow; date: NextDate } | null {
  let best: { sub: SubRow; date: NextDate } | null = null;
  for (const sub of subs) {
    if (!sub.active) continue;
    const date = nextChargeDate(sub, today);
    if (
      !best ||
      dateSortKey(date) < dateSortKey(best.date) ||
      (dateSortKey(date) === dateSortKey(best.date) && sub.createdAt < best.sub.createdAt)
    ) {
      best = { sub, date };
    }
  }
  return best;
}

/** Total del mes en centavos por moneda, solo subs activas. */
export function totalsByCurrency(subs: SubRow[]): Partial<Record<string, number>> {
  const totals: Record<string, number> = {};
  for (const sub of subs) {
    if (!sub.active) continue;
    totals[sub.currency] = (totals[sub.currency] ?? 0) + sub.priceCents;
  }
  return totals;
}
