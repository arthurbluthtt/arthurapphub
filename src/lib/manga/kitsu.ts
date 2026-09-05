/**
 * Wrappers de Kitsu para MangaTracker.
 * Documentación: https://kitsu.docs.apiary.io/
 *
 * Sin API key — endpoint público https://kitsu.io/api/edge
 * - `searchManga(q)` hace GET /api/edge/manga?filter[text]=&page[limit]=8
 * - `getMangaDetails(id)` hace GET /api/edge/manga/{id}
 *
 * Se usa Kitsu porque AniList bloquea IPs de Cloudflare Workers (403)
 * y Jikan depende de MyAnimeList que a veces está caído (504).
 * Cover: `attributes.posterImage.large` (CDN media.kitsu.app).
 */

import type { MangaType } from './store';

const KITSU_BASE = 'https://kitsu.io/api/edge';

export interface SearchResult {
  kitsuId: number;
  mangaType: MangaType;
  title: string;
  coverUrl: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`Kitsu payload invalid ${field}`);
  const text = value.trim();
  return text || undefined;
}

function readKitsuId(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new Error('Kitsu payload invalid id');
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Kitsu payload invalid id');
  }
  return id;
}

function subtypeToMangaType(s: string | undefined): MangaType {
  if (s === 'manhwa') return 'manhwa';
  if (s === 'manhua') return 'manhua';
  return 'manga';
}

function readTitle(attributes: Record<string, unknown>): string {
  const canonicalTitle = readOptionalString(attributes.canonicalTitle, 'canonicalTitle');
  const rawTitles = attributes.titles;
  if (rawTitles !== undefined && rawTitles !== null && !isRecord(rawTitles)) {
    throw new Error('Kitsu payload invalid titles');
  }
  const titles = isRecord(rawTitles) ? rawTitles : {};
  const title =
    canonicalTitle ??
    readOptionalString(titles.en, 'titles.en') ??
    readOptionalString(titles.en_us, 'titles.en_us') ??
    readOptionalString(titles.en_jp, 'titles.en_jp');
  if (!title) throw new Error('Kitsu payload invalid title');
  return title;
}

function readCoverUrl(attributes: Record<string, unknown>): string | null {
  const rawPoster = attributes.posterImage;
  if (rawPoster === undefined || rawPoster === null) return null;
  if (!isRecord(rawPoster)) throw new Error('Kitsu payload invalid posterImage');

  const large = readOptionalString(rawPoster.large, 'posterImage.large');
  const medium = readOptionalString(rawPoster.medium, 'posterImage.medium');
  const coverUrl = large ?? medium;
  if (!coverUrl) return null;
  try {
    const url = new URL(coverUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('invalid protocol');
    }
  } catch {
    throw new Error('Kitsu payload invalid cover URL');
  }
  return coverUrl;
}

interface ParsedMangaResource {
  kitsuId: number;
  mangaType: MangaType;
  title: string;
  coverUrl: string | null;
}

function parseMangaResource(value: unknown): ParsedMangaResource {
  if (!isRecord(value) || !isRecord(value.attributes)) {
    throw new Error('Kitsu payload invalid manga resource');
  }
  const attributes = value.attributes;
  const subtype = readOptionalString(attributes.subtype, 'subtype');
  return {
    kitsuId: readKitsuId(value.id),
    mangaType: subtypeToMangaType(subtype),
    title: readTitle(attributes),
    coverUrl: readCoverUrl(attributes),
  };
}

export async function searchManga(q: string): Promise<SearchResult[]> {
  const url = `${KITSU_BASE}/manga?filter[text]=${encodeURIComponent(q)}&page[limit]=8`;
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.api+json', 'User-Agent': 'ArthurAppHub/1.0' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Kitsu search failed: ${res.status} ${text.slice(0, 400)}`);
  }
  const raw: unknown = await res.json();
  if (!isRecord(raw) || !Array.isArray(raw.data)) {
    throw new Error('Kitsu search payload invalid');
  }

  return raw.data.slice(0, 8).map((resource) => parseMangaResource(resource));
}

export interface MangaDetails {
  kitsuId: number;
  mangaType: MangaType;
  title: string;
  coverUrl: string | null;
}

export async function getMangaDetails(kitsuId: number, mangaType: MangaType): Promise<MangaDetails | null> {
  const url = `${KITSU_BASE}/manga/${kitsuId}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.api+json', 'User-Agent': 'ArthurAppHub/1.0' },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Kitsu details failed: ${res.status} ${text.slice(0, 400)}`);
  }
  const raw: unknown = await res.json();
  if (!isRecord(raw) || !isRecord(raw.data)) {
    throw new Error('Kitsu details payload invalid');
  }
  const parsed = parseMangaResource(raw.data);
  if (parsed.kitsuId !== kitsuId) {
    throw new Error('Kitsu details id mismatch');
  }
  return { ...parsed, mangaType };
}
