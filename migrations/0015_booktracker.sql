-- Migración: tabla `books` para la sub-app BookTracker.
-- Cada fila = un libro del usuario con su estado.
-- `book_type` distingue libro físico ('book'), ebook ('ebook') y audiolibro ('audiobook').
-- `external_id` es el OLID de Open Library (TEXT, ej. OL123W o /works/OL123W). `cover_url` apunta al CDN covers.openlibrary.org.
-- `status` es uno de: backlog (Por leer, default) | reading (Leyendo) | finished (Terminado).
-- La UNIQUE (username, external_id) es PARCIAL: solo aplica si external_id IS NOT NULL. Los items manuales (external_id NULL) no colisionan entre sí.

CREATE TABLE IF NOT EXISTS books (
  username     TEXT NOT NULL,
  id           TEXT NOT NULL,
  external_id  TEXT,
  book_type    TEXT NOT NULL CHECK (book_type IN ('book', 'ebook', 'audiobook')),
  title        TEXT NOT NULL,
  cover_url    TEXT,
  status       TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'reading', 'finished')),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (username, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_books_user_external
  ON books(username, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_books_user_status
  ON books(username, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_books_user_type
  ON books(username, book_type, created_at DESC);
