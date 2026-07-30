import data from '../data/apps.json';
import type { Category, App } from './types';

interface AppData {
  id: string;
  name: string;
  description: string;
  url: string;
  redir?: string;
  icon: string;
  category: string;
  tags?: string[];
  featured?: boolean;
  /**
   * Si true, la app participa del flujo SSO del hub (exchange code + session
   * token + pin_hash derivable). Si false (u omitido), la app es interna y se
   * accede directamente con la cookie `hub_sess` (no requiere exchange).
   */
  sso?: boolean;
}

interface AppsFile {
  categories: Category[];
  apps: AppData[];
}

const appsFile = data as AppsFile;

export const categories: Category[] = appsFile.categories ?? [];
export const apps: App[] = (appsFile.apps ?? []) as App[];

/** Todas las apps registradas (internas + externas con SSO). */
export function getAllApps(): AppData[] {
  return appsFile.apps ?? [];
}

/** Solo apps que participan del flujo SSO (sso: true explícito). */
export function getSsoApps(): AppData[] {
  return (appsFile.apps ?? []).filter((a) => a.sso === true);
}

export function findApp(id: string): AppData | undefined {
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
