/**
 * Wrappers de Open Library para BookTracker.
 * Docs: https://openlibrary.org/dev/docs/api/search
 *
 * Sin API key — endpoint público https://openlibrary.org
 * - `searchBooks(q)` hace GET /search.json?q=&limit=8&fields=...
 * - `getBookDetails(olid)` hace GET /works/{olid}.json o /books/{olid}.json
 *
 * Cover: `https://covers.openlibrary.org/b/id/{cover_i}-L.jpg`
 *        fallback `https://covers.openlibrary.org/b/olid/{olid}-L.jpg`
 */

import type { BookType } from './store';

export interface SearchResult {
  olid: string;
  bookType: BookType;
  title: string;
  coverUrl: string | null;
}

export interface BookDetails {
  olid: string;
  bookType: BookType;
  title: string;
  coverUrl: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`Open Library payload invalid ${field}`);
  const text = value.trim();
  return text || undefined;
}

function readRequiredTitle(value: unknown, field = 'title'): string {
  const title = readOptionalString(value, field);
  if (!title) throw new Error(`Open Library payload invalid ${field}`);
  return title;
}

function readOlid(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`Open Library payload invalid ${field}`);
  const text = value.trim();
  const match = text.match(/^(?:(\/works\/)|(\/books\/))?(OL\d+[WM])$/);
  if (!match) throw new Error(`Open Library payload invalid ${field}`);
  const prefix = match[1] ?? match[2] ?? (match[3].endsWith('W') ? '/works/' : '/books/');
  if ((prefix === '/works/' && !match[3].endsWith('W')) || (prefix === '/books/' && !match[3].endsWith('M'))) {
    throw new Error(`Open Library payload invalid ${field}`);
  }
  return `${prefix}${match[3]}`;
}

function readOptionalOlid(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return readOlid(value, field);
}

function readCoverId(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Open Library payload invalid ${field}`);
  }
  return value;
}

function readCoverIds(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) throw new Error('Open Library payload invalid covers');
  if (value.length === 0) return null;
  return readCoverId(value[0], 'covers[0]');
}

function buildCoverUrl(coverId: number | null, olid: string | null): string | null {
  if (coverId !== null) return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
  if (!olid) return null;
  const clean = olid.replace('/works/', '').replace('/books/', '');
  return `https://covers.openlibrary.org/b/olid/${clean}-L.jpg`;
}

function parseSearchDoc(value: unknown): SearchResult {
  if (!isRecord(value)) throw new Error('Open Library search payload invalid document');
  const key = readOptionalOlid(value.key, 'key');
  if (value.edition_key !== undefined && !Array.isArray(value.edition_key)) {
    throw new Error('Open Library search payload invalid edition_key');
  }
  const editionKey = Array.isArray(value.edition_key)
    ? value.edition_key.map((entry, index) => readOlid(entry, `edition_key[${index}]`))
    : [];
  const olid = key ?? editionKey[0];
  if (!olid) throw new Error('Open Library search payload missing OLID');
  return {
    olid,
    bookType: 'book',
    title: readRequiredTitle(value.title),
    coverUrl: buildCoverUrl(readCoverId(value.cover_i, 'cover_i'), olid),
  };
}

function normalizeOlid(value: string): string {
  return readOlid(value, 'olid');
}

export async function searchBooks(q: string): Promise<SearchResult[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,cover_i,edition_key`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'ArthurAppHub/1.0' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Open Library search failed: ${res.status} ${text.slice(0, 400)}`);
  }
  const raw: unknown = await res.json();
  if (!isRecord(raw) || !Array.isArray(raw.docs)) {
    throw new Error('Open Library search payload invalid');
  }

  return raw.docs.slice(0, 8).map((doc) => parseSearchDoc(doc));
}

export async function getBookDetails(olid: string, bookType: BookType): Promise<BookDetails | null> {
  const key = normalizeOlid(olid);
  const clean = key.replace('/works/', '').replace('/books/', '');
  const alternate = key.startsWith('/works/') ? `/books/${clean}` : `/works/${clean}`;
  const candidates = [key, alternate];
  const uniq = [...new Set(candidates)];
  for (const k of uniq) {
    const url = `https://openlibrary.org${k}.json`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'ArthurAppHub/1.0' },
    });
    if (res.status === 404) {
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Open Library details failed: ${res.status} ${text.slice(0, 400)}`);
    }
    const raw: unknown = await res.json();
    if (!isRecord(raw)) throw new Error('Open Library details payload invalid');
    const responseKey = readOptionalOlid(raw.key, 'key');
    if (responseKey && responseKey !== k) {
      throw new Error('Open Library details key mismatch');
    }
    const coverId = readCoverIds(raw.covers);
    return {
      olid: k,
      bookType,
      title: readRequiredTitle(raw.title),
      coverUrl: buildCoverUrl(coverId, k),
    };
  }
  return null;
}
