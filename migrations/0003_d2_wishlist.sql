CREATE TABLE d2_wishlist (
  username         TEXT NOT NULL,
  item_hash        TEXT NOT NULL,
  weapon_name      TEXT NOT NULL,
  weapon_icon_path TEXT NOT NULL,
  top_perk_hashes  TEXT NOT NULL,
  found            INTEGER NOT NULL DEFAULT 0,
  found_at         INTEGER,
  added_at         INTEGER NOT NULL,
  PRIMARY KEY (username, item_hash)
);

CREATE INDEX idx_d2_wishlist_user ON d2_wishlist(username, found, added_at DESC);
