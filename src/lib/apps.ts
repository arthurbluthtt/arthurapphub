import data from '../data/apps.json';
import type { App, AppsData, Category } from './types';

const appsFile = data as AppsData;

export const categories: Category[] = appsFile.categories ?? [];
export const apps: App[] = appsFile.apps ?? [];

/** Todas las apps registradas (internas + externas con SSO). */
export function getAllApps(): App[] {
  return appsFile.apps ?? [];
}

/** Solo apps que participan del flujo SSO (sso: true explícito). */
export function getSsoApps(): App[] {
  return (appsFile.apps ?? []).filter((a) => a.sso === true);
}

export function findApp(id: string): App | undefined {
  return (appsFile.apps ?? []).find((a) => a.id === id);
}

/** True si la app está autorizada para pedir codes / consumir exchange / etc. */
export function isSsoApp(id: string): boolean {
  return (appsFile.apps ?? []).some((a) => a.id === id && a.sso === true);
}

export function getCategory(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function getCategoryColor(id: string): string {
  return getCategory(id)?.color ?? '#64748b';
}
