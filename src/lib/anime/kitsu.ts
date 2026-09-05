/**
 * Wrappers de Kitsu para AnimeTracker.
 * Documentación: https://kitsu.docs.apiary.io/
 *
 * Sin API key — endpoint público https://kitsu.io/api/edge
 * - `searchAnime(q)` hace GET /api/edge/anime?filter[text]=&page[limit]=8
 * - `getAnimeDetails(id)` hace GET /api/edge/anime/{id}
 *
 * Se usa Kitsu porque AniList bloquea IPs de Cloudflare Workers (403)
 * y Jikan depende de MyAnimeList que a veces está caído (504).
 * Cover: `attributes.posterImage.large` (CDN media.kitsu.app).
 */

import type { AnimeType } from './store';

const KITSU_BASE = 'https://kitsu.io/api/edge';

export interface SearchResult {
  kitsuId: number;
  animeType: AnimeType;
  title: string;
  year: number | null;
  coverUrl: string | null;
  rating: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readOptionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error(`Kitsu payload invalid ${field}`);
  const text = value.trim();
  return text || null;
}

function readOptionalUrl(value: unknown, field: string): string | null {
  const text = readOptionalString(value, field);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
  } catch {
    throw new Error(`Kitsu payload invalid ${field}`);
  }
  return text;
}

function subtypeToAnimeType(value: string | null): AnimeType {
  return value?.toLowerCase() === 'movie' ? 'movie' : 'tv';
}

function yearFromDate(value: unknown): number | null {
  const date = readOptionalString(value, 'startDate');
  if (!date) return null;
  const match = /^(\d{4})(?:-|$)/.exec(date);
  const year = match ? Number(match[1]) : NaN;
  if (!Number.isSafeInteger(year) || year < 1888 || year > 2100) {
    throw new Error('Kitsu payload invalid startDate');
  }
  return year;
}

function readRating(value: unknown): number | null {
  const raw = readOptionalString(value, 'averageRating');
  if (!raw) return null;
  const rating = Number(raw);
  if (!Number.isFinite(rating) || rating < 0 || rating > 100) {
    throw new Error('Kitsu payload invalid averageRating');
  }
  return rating;
}

function readTitle(attributes: Record<string, unknown>): string {
  const canonical = readOptionalString(attributes.canonicalTitle, 'canonicalTitle');
  const titles = attributes.titles;
  if (titles !== undefined && titles !== null && !isRecord(titles)) {
    throw new Error('Kitsu payload invalid titles');
  }
  const titleMap = isRecord(titles) ? titles : {};
  const en = readOptionalString(titleMap.en, 'titles.en');
  const enUs = readOptionalString(titleMap.en_us, 'titles.en_us');
  const enJp = readOptionalString(titleMap.en_jp, 'titles.en_jp');
  const title = canonical ?? en ?? enUs ?? enJp;
  if (!title) throw new Error('Kitsu payload missing title');
  return title;
}

function readResource(value: unknown, includeRating: boolean): SearchResult {
  if (!isRecord(value) || typeof value.id !== 'string' || !/^[1-9]\d*$/.test(value.id)) {
    throw new Error('Kitsu payload invalid id');
  }
  const kitsuId = Number(value.id);
  if (!Number.isSafeInteger(kitsuId) || kitsuId <= 0) throw new Error('Kitsu payload invalid id');
  if (!isRecord(value.attributes)) throw new Error('Kitsu payload missing attributes');
  const attributes = value.attributes;
  const subtype = readOptionalString(attributes.subtype, 'subtype');
  const posterImage = attributes.posterImage;
  if (posterImage !== undefined && posterImage !== null && !isRecord(posterImage)) {
    throw new Error('Kitsu payload invalid posterImage');
  }
  const poster = isRecord(posterImage) ? posterImage : {};
  const coverUrl = readOptionalUrl(poster.large ?? poster.medium, 'posterImage');
  return {
    kitsuId,
    animeType: subtypeToAnimeType(subtype),
    title: readTitle(attributes),
    year: yearFromDate(attributes.startDate),
    coverUrl,
    rating: includeRating ? readRating(attributes.averageRating) : null,
  };
}

export async function searchAnime(q: string): Promise<SearchResult[]> {
  const url = `${KITSU_BASE}/anime?filter[text]=${encodeURIComponent(q)}&page[limit]=8`;
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.api+json', 'User-Agent': 'ArthurAppHub/1.0' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Kitsu search failed: ${res.status} ${text.slice(0, 400)}`);
  }
  const data: unknown = await res.json();
  if (!isRecord(data) || !Array.isArray(data.data)) throw new Error('Kitsu payload missing data');
  return data.data.slice(0, 8).map((resource) => readResource(resource, true));
}

export interface AnimeDetails {
  kitsuId: number;
  animeType: AnimeType;
  title: string;
  coverUrl: string | null;
  year: number | null;
  director: string | null;
  genre: string | null;
}

export async function getAnimeDetails(kitsuId: number, animeType: AnimeType): Promise<AnimeDetails | null> {
  if (!Number.isSafeInteger(kitsuId) || kitsuId <= 0) throw new Error('Invalid kitsuId');
  if (animeType !== 'tv' && animeType !== 'movie') throw new Error('Invalid animeType');
  const url = `${KITSU_BASE}/anime/${kitsuId}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.api+json', 'User-Agent': 'ArthurAppHub/1.0' },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Kitsu details failed: ${res.status} ${text.slice(0, 400)}`);
  }
  const data: unknown = await res.json();
  if (!isRecord(data) || !isRecord(data.data)) throw new Error('Kitsu payload missing data');
  const parsed = readResource(data.data, false);
  if (parsed.kitsuId !== kitsuId) throw new Error('Kitsu payload id mismatch');
  return {
    kitsuId: parsed.kitsuId,
    animeType,
    title: parsed.title,
    coverUrl: parsed.coverUrl,
    year: parsed.year,
    director: null,
    genre: null,
  };
}
