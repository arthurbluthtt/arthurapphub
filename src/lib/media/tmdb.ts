/**
 * Wrappers de la API de TMDB.
 * Documentación: https://developer.themoviedb.org/reference/intro/getting-started
 *
 * Requiere `TMDB_API_KEY` como Worker Secret (configurado en Cloudflare).
 * - `searchMedia(q, apiKey)` hace `search/multi` y filtra a movie|tv.
 * - `getMediaDetails(tmdbId, mediaType, apiKey)` hace details por separado
 *   según mediaType (movies o tv). Devuelve el subset que guardamos.
 *
 * Cover base: `image.tmdb.org/t/p/w342` (CDN estable, cacheable por Cloudflare).
 * Si la API key no está configurada, los endpoints devuelven error 503
 * para que el cliente caiga al modo manual.
 */

import type { MediaType } from './store';

const TMDB_BASE = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';

export interface SearchResult {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  coverUrl: string | null;
  rating: number | null;
}

interface TmdbSearchMultiRaw {
  results: unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asOptionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : typeof value === 'string' ? value : undefined;
}

function asOptionalNullableString(value: unknown): string | null | undefined {
  return value === null ? null : asOptionalString(value);
}

function asYear(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  return Number.isSafeInteger(year) ? year : null;
}

function coverFromPath(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !value.startsWith('/')) {
    throw new Error('TMDB payload invalid cover path');
  }
  return `${TMDB_IMAGE_BASE}${value}`;
}

export async function searchMedia(q: string, apiKey: string): Promise<SearchResult[]> {
  if (!apiKey) throw new Error('TMDB_API_KEY not configured');
  const url = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(q)}&api_key=${encodeURIComponent(apiKey)}&include_adult=false&language=es-MX&page=1`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`);
  const raw: unknown = await res.json();
  if (!isRecord(raw) || !Array.isArray(raw.results)) {
    throw new Error('TMDB search payload invalid');
  }
  const data = raw as unknown as TmdbSearchMultiRaw;
  const results: SearchResult[] = [];
  for (const rawResult of data.results) {
    if (!isRecord(rawResult)) throw new Error('TMDB search result invalid');
    const mediaType = rawResult.media_type;
    if (mediaType !== 'movie' && mediaType !== 'tv') continue;
    const tmdbId = rawResult.id;
    if (typeof tmdbId !== 'number' || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
      throw new Error('TMDB search result id invalid');
    }
    const titleValue = mediaType === 'movie' ? rawResult.title : rawResult.name;
    if (typeof titleValue !== 'string' || !titleValue.trim()) {
      throw new Error('TMDB search result title invalid');
    }
    const dateValue = mediaType === 'movie' ? rawResult.release_date : rawResult.first_air_date;
    const dateStr = asOptionalString(dateValue);
    if (dateValue !== undefined && dateStr === undefined) {
      throw new Error('TMDB search result date invalid');
    }
    const posterPath = asOptionalNullableString(rawResult.poster_path);
    if (rawResult.poster_path !== undefined && posterPath === undefined) {
      throw new Error('TMDB search result poster invalid');
    }
    const rating = rawResult.vote_average;
    if (rating !== undefined && typeof rating !== 'number') {
      throw new Error('TMDB search result rating invalid');
    }
    const title = titleValue.trim();
    const year = asYear(dateStr);
    const coverUrl = coverFromPath(posterPath);
    results.push({
      tmdbId,
      mediaType,
      title,
      year,
      coverUrl,
      rating: typeof rating === 'number' ? rating : null,
    });
    if (results.length >= 8) break;
  }
  return results;
}

export interface MediaDetails {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  coverUrl: string | null;
  year: number | null;
  director: string | null;
  genre: string | null;
}

function yearFromDate(s: string | undefined): number | null {
  return asYear(s);
}

export async function getMediaDetails(
  tmdbId: number,
  mediaType: MediaType,
  apiKey: string
): Promise<MediaDetails | null> {
  if (!apiKey) throw new Error('TMDB_API_KEY not configured');
  const url = `${TMDB_BASE}/${mediaType}/${tmdbId}?api_key=${encodeURIComponent(apiKey)}&language=es-MX&append_to_response=credits`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`TMDB details failed: ${res.status}`);
  const raw: unknown = await res.json();
  if (!isRecord(raw)) throw new Error('TMDB details payload invalid');
  const data = raw;

  const titleValue = data.title ?? data.name ?? data.original_title ?? data.original_name;
  if (typeof titleValue !== 'string' || !titleValue.trim()) {
    throw new Error('TMDB details title invalid');
  }
  const title = titleValue.trim();

  const poster = data.poster_path;
  const coverUrl = coverFromPath(poster);
  const dateValue = data.release_date ?? data.first_air_date;
  const date = asOptionalString(dateValue);
  if (dateValue !== undefined && date === undefined) {
    throw new Error('TMDB details date invalid');
  }
  const year = yearFromDate(date);

  // Director (movie) o created_by[0].name (tv).
  let director: string | null = null;
  if (mediaType === 'movie') {
    if (data.credits !== undefined && !isRecord(data.credits)) {
      throw new Error('TMDB details credits invalid');
    }
    const crew = isRecord(data.credits) ? data.credits.crew : undefined;
    if (crew !== undefined && !Array.isArray(crew)) {
      throw new Error('TMDB details crew invalid');
    }
    const dir = Array.isArray(crew)
      ? crew.find((entry) => isRecord(entry) && entry.job === 'Director' && typeof entry.name === 'string')
      : undefined;
    director = isRecord(dir) && typeof dir.name === 'string' ? dir.name : null;
  } else {
    const createdBy = data.created_by;
    if (createdBy !== undefined && !Array.isArray(createdBy)) {
      throw new Error('TMDB details creators invalid');
    }
    const creator = Array.isArray(createdBy)
      ? createdBy.find((entry) => isRecord(entry) && typeof entry.name === 'string')
      : undefined;
    director = isRecord(creator) && typeof creator.name === 'string' ? creator.name : null;
  }

  // Primer género
  const genres = data.genres;
  if (genres !== undefined && !Array.isArray(genres)) {
    throw new Error('TMDB details genres invalid');
  }
  const genreEntry = Array.isArray(genres)
    ? genres.find((entry) => isRecord(entry) && typeof entry.name === 'string')
    : undefined;
  const genre = isRecord(genreEntry) && typeof genreEntry.name === 'string' ? genreEntry.name : null;

  return { tmdbId, mediaType, title, coverUrl, year, director, genre };
}
