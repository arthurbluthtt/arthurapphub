/**
 * Carga los JSON estáticos de Umamusume (generados por scripts/build-uma-data.mjs).
 * En el runtime, estos archivos se importan como módulos JSON — Astro/Vite los bundle
 * en el build (tamaños pequeños: ~20KB cada uno).
 */

import charactersData from '../../../data/uma/characters.json';
import cardsData from '../../../data/uma/cards.json';
import recommendationsData from '../../../data/uma/recommendations.json';

export interface UmaCharacter {
  id: string;
  game8Id: string;
  name: string;
  version: string | null;
  icon: string | null;
  aptitudes: {
    surface: string[];
    distance: string[];
    pace: string[];
  } | null;
}

export interface UmaCard {
  id: string;
  game8Id: string;
  name: string | null;
  version: string | null;
  icon: string | null;
}

export type Scenario = 'grand_live' | 'trackblazer' | 'ura';

export interface UmaRecommendations {
  scenario: Scenario;
  main: string[]; // card game8Ids
  budget: string[]; // card game8Ids
  alternates: {
    speed: string[];
    power: string[];
    wit: string[];
  };
}

export const characters: UmaCharacter[] = charactersData as UmaCharacter[];
export const cards: UmaCard[] = cardsData as UmaCard[];
export const recommendations = recommendationsData as Record<string, UmaRecommendations>;

const characterById = new Map<string, UmaCharacter>();
for (const c of characters) characterById.set(c.id, c);

const cardByGame8Id = new Map<string, UmaCard>();
for (const c of cards) cardByGame8Id.set(c.game8Id, c);

export function getCharacter(id: string): UmaCharacter | null {
  return characterById.get(id) ?? null;
}

export function getCard(game8Id: string): UmaCard | null {
  return cardByGame8Id.get(game8Id) ?? null;
}

export function searchCharacters(query: string, limit = 10): UmaCharacter[] {
  const q = query.trim().toLowerCase();
  if (!q) return characters.slice(0, limit);
  // Score: exact prefix > word prefix > substring.
  const scored: Array<{ c: UmaCharacter; score: number }> = [];
  for (const c of characters) {
    const name = c.name.toLowerCase();
    const version = (c.version ?? '').toLowerCase();
    const full = `${name} ${version}`.trim();
    let score = -1;
    if (full.startsWith(q)) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (name.split(/\s+/).some((w) => w.startsWith(q))) score = 2;
    else if (full.includes(q)) score = 3;
    if (score >= 0) scored.push({ c, score });
  }
  scored.sort((a, b) => a.score - b.score || a.c.name.localeCompare(b.c.name));
  return scored.slice(0, limit).map((s) => s.c);
}

export function getRecommendations(characterId: string): UmaRecommendations | null {
  return recommendations[characterId] ?? null;
}
