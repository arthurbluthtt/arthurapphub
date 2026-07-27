import data from '../data/apps.json';
import type { AppsData, App, Category } from './types';

export const appsData: AppsData = data as AppsData;
export const categories: Category[] = appsData.categories;
export const apps: App[] = appsData.apps;

export function getCategory(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function getCategoryColor(id: string): string {
  return getCategory(id)?.color ?? '#64748b';
}
