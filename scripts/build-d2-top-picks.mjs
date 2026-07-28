#!/usr/bin/env node
/**
 * Build script: parsea el archivo DIM-format exportado por lightggtodim
 * (https://github.com/CryoTheRenegade/lightggtodim) y emite top-picks.json
 * en el formato que consume el hub.
 *
 * Prereq:
 *   - Haber corrido `pnpm generate` en una copia local de lightggtodim.
 *   - Copiado dist/wishlists/lightgg-popular-pve.txt → data/d2/source/dim-popular.txt.
 *
 * Uso:
 *   npm run build:d2-picks
 *
 * Output:
 *   data/d2/top-picks.json   { weaponHash: [perkHashA, perkHashB] }
 *
 * Formato DIM de entrada (una línea por roll):
 *   dimwishlist:item=<itemHash>&perks=<barrel>,<mag>,<trait3>,<trait4>#notes:...
 *
 * Sólo nos importan los perks en columnas 3 y 4 (los "main perks" del arma).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const SOURCE = 'data/d2/source/dim-popular.txt';
const OUTPUT = 'data/d2/top-picks.json';

const DIM_LINE = /^dimwishlist:item=(\d+)&perks=([\d,]+)/;

async function build() {
  if (!existsSync(SOURCE)) {
    console.error(`No se encontró ${SOURCE}.`);
    console.error('Corré lightggtodim localmente, copiá el output y reintentá.');
    process.exit(1);
  }

  const raw = await readFile(SOURCE, 'utf8');
  const lines = raw.split(/\r?\n/);

  const picks = Object.create(null);
  let parsed = 0;
  let skipped = 0;

  for (const line of lines) {
    const m = DIM_LINE.exec(line);
    if (!m) continue;
    const weaponHash = m[1];
    const perks = m[2].split(',');
    if (perks.length < 4) {
      skipped++;
      continue;
    }
    // Tomamos columnas 3 y 4 (trait3 + trait4 = "main perks").
    const [trait3, trait4] = perks;
    if (!picks[weaponHash]) {
      picks[weaponHash] = [trait3, trait4];
      parsed++;
    }
  }

  await mkdir('data/d2', { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(picks));

  console.log(`Parsed ${parsed} armas únicas (${skipped} líneas saltadas).`);
  console.log(`Wrote ${OUTPUT}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
