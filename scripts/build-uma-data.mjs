#!/usr/bin/env node
/**
 * Build script: scrapea game8.co para generar el dataset estático de
 * Umamusume (personajes + cartas + recomendaciones).
 *
 * Fuentes (páginas estáticas, no requieren JS):
 *   - https://game8.co/games/Umamusume-Pretty-Derby/archives/536352  Best Characters (tier list)
 *   - https://game8.co/games/Umamusume-Pretty-Derby/archives/536715  Best Support Cards (tier list)
 *   - https://game8.co/games/Umamusume-Pretty-Derby/archives/<id>     Build guide de cada personaje
 *
 * Salida:
 *   data/uma/characters.json     lista de personajes con {id, name, version, game8Id, icon}
 *   data/uma/cards.json          lista de cartas (deduplicadas) con {id, name, version, game8Id, icon}
 *   data/uma/recommendations.json  map { [characterId]: { scenario, main: [], budget: [], alternates: { speed, power, wit } } }
 *
 * Uso:
 *   node scripts/build-uma-data.mjs
 *
 * Robustez:
 *   - Rate limit: 1.2s entre requests para no abusar.
 *   - Si una página de personaje no parsea, se skipea + warning.
 *   - Si una card referenciada en un build no está en cards.json, se agrega.
 *   - Tolerante a HTML mal-formado de game8 (alts con apostrofes rompen el atributo).
 */

import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'https://game8.co';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const SLEEP_MS = 1200;

const CHARACTERS_INDEX_URL = `${BASE}/games/Umamusume-Pretty-Derby/archives/536352`;
const SUPPORT_INDEX_URL = `${BASE}/games/Umamusume-Pretty-Derby/archives/536715`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return await res.text();
}

/**
 * Slug kebab-case a partir de un nombre + versión.
 *   "Maruzensky (Formula R)" → "maruzensky-formula-r"
 *   "Agnes Tachyon (Q≠0)"    → "agnes-tachyon-q0"
 */
function slugify(name, version) {
  const base = `${name} ${version ?? ''}`.toLowerCase();
  return base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * "Maruzensky (Formula R)" → { name: "Maruzensky", version: "Formula R" }
 * "Special Week"           → { name: "Special Week", version: null }
 */
function parseNameVersion(s) {
  const idx = s.lastIndexOf(' (');
  if (idx === -1 || !s.endsWith(')')) {
    return { name: s.trim(), version: null };
  }
  const name = s.slice(0, idx).trim();
  const version = s.slice(idx + 2, -1).trim();
  if (!name || !version) return { name: s.trim(), version: null };
  return { name, version };
}

/**
 * Parse el tier list de personajes (Best Characters).
 * Filtra entries que terminan en "Support Card" (esas son cartas).
 * Captura icon (data-src) cuando está disponible.
 */
function parseCharacterList(html) {
  const re =
    /href="https:\/\/game8\.co\/games\/Umamusume-Pretty-Derby\/archives\/(\d+)"[^<]*<(?:span[^<]*<img|img)[^>]+alt="([^"]+?)"[^>]+data-src="(https:\/\/(?:img|j-img)\.game8\.co\/[^"]+)"/g;
  const out = new Map();
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = m[1];
    const alt = m[2];
    const icon = m[3];
    if (/Support Card$/i.test(alt)) continue;
    if (out.has(id)) continue;
    const cleaned = alt.replace(/\s+Icon$/i, '').trim();
    const parsed = parseNameVersion(cleaned);
    if (!parsed) continue;
    out.set(id, {
      id: slugify(parsed.name, parsed.version),
      game8Id: id,
      name: parsed.name,
      version: parsed.version,
      icon,
    });
  }
  return [...out.values()];
}

/**
 * Parse una página de tier list de cartas (Best Support Cards).
 * alt termina en "Support Card".
 */
function parseCardList(html) {
  const re =
    /href="https:\/\/game8\.co\/games\/Umamusume-Pretty-Derby\/archives\/(\d+)"[^<]*<(?:span[^<]*<img|img)[^>]+alt="([^"]+? Support Card)"[^>]+data-src="(https:\/\/img\.game8\.co\/[^"]+)"/g;
  const out = new Map();
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = m[1];
    const alt = m[2];
    const icon = m[3];
    if (out.has(id)) continue;
    const cleaned = alt.replace(/\s+Support Card$/i, '').trim();
    const parsed = parseNameVersion(cleaned);
    if (!parsed) continue;
    out.set(id, {
      id: slugify(parsed.name, parsed.version),
      game8Id: id,
      name: parsed.name,
      version: parsed.version,
      icon,
    });
  }
  return [...out.values()];
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Parse la página de build guide de un personaje.
 *
 * Estructura esperada (game8.co), puede variar entre páginas:
 *   <h3>Recommended Support Cards</h3>
 *   <h4><Scenario> Build</h4>     ← primer h4 después del h3 (Grand Live / Grand Concert / Trackblazer / etc)
 *   <table>...Main Build...</table>   (puede tener Main+Budget en una sola tabla)
 *   <h4>Budget Build</h4>         ← opcional, segunda tabla
 *   <table>...Budget...</table>
 *   <h4>Alternate Cards</h4>
 *   <table>
 *     <th colspan=2>Recommended Alternative Support Cards</th>   ← puede estar fuera de <tr>
 *     <tr><th>Speed</th><td>... cards ...</td></tr>
 *     <tr><th>Power</th><td>... cards ...</td></tr>
 *     <tr><th>Wit</th><td>... cards ...</td></tr>
 *   </table>
 */
function parseBuildGuide(html, charName) {
  // El icono del personaje en la página tiene alt="<Name> Icon" (sin la versión).
  // El `charName` que recibimos puede tener la versión (correcta o truncada).
  // Buscamos el primer <img> con alt que matchee el nombre base (sin versión).
  const baseName = charName.split(' (')[0];
  let icon = null;
  const iconRe = new RegExp(
    `<img[^>]+alt=['"]${escapeRegex(baseName)} Icon['"][^>]+data-src=['"]([^'"]+)['"]`,
    'i'
  );
  const iconMatch = iconRe.exec(html);
  if (iconMatch) icon = iconMatch[1];

  // Encontrar "Recommended Support Cards" (h3).
  const targetRe =
    /<h([2-4])[^>]*>(?:<a[^>]*>)?\s*Recommended Support Cards\b[^<]*<\/(?:a|h\1)>/i;
  const m = targetRe.exec(html);
  if (!m) return { icon, recommendations: null };
  const startLevel = Number(m[1]);
  const startIdx = m.index + m[0].length;
  const section = sliceSection(html, startIdx, startLevel);
  if (!section) return { icon, recommendations: null };

  // Primer h4 "X Build" (cualquier scenario): Grand Live, Grand Concert, Trackblazer, etc.
  const primaryBuildMatch = /<h4[^>]*>(?:<a[^>]*>)?\s*([^<]*?Build)\b[^<]*<\/(?:a|h4)>/i.exec(section);
  // h4 "Budget Build" (opcional)
  const budgetBuildMatch = /<h4[^>]*>(?:<a[^>]*>)?\s*Budget Build\b[^<]*<\/(?:a|h4)>/i.exec(section);
  // h4 "Alternate Cards"
  const altCardsMatch = /<h4[^>]*>(?:<a[^>]*>)?\s*Alternate Cards\b[^<]*<\/(?:a|h4)>/i.exec(section);

  let main = [];
  let budget = [];
  const alternates = { speed: [], power: [], wit: [] };
  const cardInfo = new Map(); // id → {name, icon} para enriquecer cards.json

  // Determinar scenario (best-effort — el user solo verá "Grand Live" en la UI).
  const scenarioLabel = primaryBuildMatch ? primaryBuildMatch[1].trim().toLowerCase() : '';
  const scenario = scenarioLabel.includes('trackblazer')
    ? 'trackblazer'
    : scenarioLabel.includes('ura')
    ? 'ura'
    : 'grand_live'; // default + Grand Live + Grand Concert

  // Estructuras intermedias: cada fila del table tiene un label y un set de href IDs.
  // Guardamos los href IDs por label para determinar después cuáles son main/budget/alternates.
  // Los icons los extraemos directamente del bloque (están dentro del <a>...</a>).
  // En la primera pasada capturamos todos los hrefs; después filtramos por las IDs
  // que efectivamente son cards (basado en el set final de recomendaciones).
  const labelToIds = []; // [{label, ids}] en orden
  const allLinks = new Map(); // id → {name, icon}

  // Tabla principal (inmediatamente después del primer h4 "X Build").
  if (primaryBuildMatch) {
    const table = extractTable(section, primaryBuildMatch.index + primaryBuildMatch[0].length);
    if (table) {
      const rows = parseTableRows(table);
      for (const row of rows) {
        const headerMatch = /<th[^>]*>([^<]+)</i.exec(row);
        const label = headerMatch ? headerMatch[1].trim() : '';
        const links = parseAllLinksInBlock(row);
        for (const [k, v] of links) allLinks.set(k, v);
        const ids = [...links.keys()];
        if (ids.length) labelToIds.push({ label: label.toLowerCase(), ids });
      }
      // Si la tabla no tiene "Main Build"/"Budget Build" labels, la primera fila con cards es main.
      const hasLabels = labelToIds.some((x) => x.label.includes('main build') || x.label.includes('budget build'));
      if (!hasLabels && labelToIds.length > 0) {
        main = labelToIds[0].ids;
      } else {
        for (const { label, ids } of labelToIds) {
          if (label.includes('main build')) main = ids;
          else if (label.includes('budget build')) budget = ids;
        }
      }
    }
  }

  // Tabla budget (si está en su propio h4 "Budget Build").
  if (budgetBuildMatch && !budget.length) {
    const table = extractTable(section, budgetBuildMatch.index + budgetBuildMatch[0].length);
    if (table) {
      const rows = parseTableRows(table);
      for (const row of rows) {
        const links = parseAllLinksInBlock(row);
        for (const [k, v] of links) allLinks.set(k, v);
        const ids = [...links.keys()];
        if (ids.length) {
          budget = ids;
          break;
        }
      }
    }
  }

  // Tabla alternate cards.
  if (altCardsMatch) {
    const table = extractTable(section, altCardsMatch.index + altCardsMatch[0].length);
    if (table) {
      const rows = parseTableRows(table);
      for (const row of rows) {
        const headerMatch = /<th[^>]*>([^<]+)</i.exec(row);
        const label = headerMatch ? headerMatch[1].trim().toLowerCase() : '';
        const links = parseAllLinksInBlock(row);
        for (const [k, v] of links) allLinks.set(k, v);
        const ids = [...links.keys()];
        if (!ids.length) continue;
        if (label.includes('speed')) alternates.speed = ids;
        else if (label.includes('power')) alternates.power = ids;
        else if (label.includes('wit')) alternates.wit = ids;
      }
    }
  }

  if (!main.length && !budget.length) return { icon, recommendations: null, cardInfo };

  // Ahora sabemos qué IDs son cards. Construir el cardInfo final solo con esos.
  // Los cards en main/budget/alternates son los que sabemos que son cartas.
  // Los links a personajes en el HTML tienen IDs que NO están en main/budget/alternates.
  // Algunos links "huérfanos" (card IDs que el parser capturó pero no están en recs) los
  // excluimos para no contaminar cards.json con entries de personajes.
  const recCardIds = new Set([
    ...main,
    ...budget,
    ...alternates.speed,
    ...alternates.power,
    ...alternates.wit,
  ]);
  for (const id of allLinks.keys()) {
    if (recCardIds.has(id)) {
      cardInfo.set(id, allLinks.get(id));
    }
  }

  return {
    icon,
    recommendations: {
      scenario,
      main,
      budget,
      alternates,
    },
    cardInfo,
  };
}

function sliceSection(html, startIdx, startLevel) {
  // Buscar el próximo h2..startLevel (igual o menor nivel).
  const endRe = new RegExp(`<h[2-${startLevel}]\\b[^>]*>`, 'gi');
  endRe.lastIndex = startIdx;
  const end = endRe.exec(html);
  const endIdx = end ? end.index : html.length;
  return html.slice(startIdx, endIdx);
}

function extractTable(html, startIdx) {
  const endIdx = html.indexOf('</table>', startIdx);
  if (endIdx === -1) return null;
  return html.slice(startIdx, endIdx);
}

/**
 * Divide una tabla en filas lógicas. game8 a veces tiene un <th colspan=2> como título
 * de la tabla FUERA del primer <tr>, lo que rompe el split ingenuo por </tr>.
 */
function parseTableRows(tableHtml) {
  const rawRows = tableHtml.split(/<\/tr>/i);
  const rows = [];
  for (const chunk of rawRows) {
    const trIdx = chunk.indexOf('<tr');
    if (trIdx === -1) continue;
    rows.push(chunk.slice(trIdx));
  }
  return rows;
}

/**
 * game8 tiene HTML mal-formado cuando el alt contiene apostrofes (e.g. "Let's Get This Party Lit!")
 * — el `"` interno cierra prematuramente el atributo alt, y las palabras "Support" y "Card"
 * quedan separadas como `" support="" card'=""`. Estrategia: matchear solo el href (estable)
 * y verificar que el bloque cercano contenga algo tipo "support ... card" tolerante.
 *
 * Devuelve Map<cardId, { name, icon }> para que el caller pueda enriquecer cards.json
 * con el icon URL extraído del build page.
 */
/**
 * Extrae TODOS los hrefs + sus iconos de un bloque, sin filtrar.
 * Devuelve Map<id, {name, icon}> para que el caller decida qué IDs son cards.
 *
 * Importante: cada <a>...</a> contiene el icon de SU href. Limitamos la búsqueda
 * al </a> más cercano para no llevarnos el icon del siguiente link.
 */
function parseAllLinksInBlock(block) {
  const hrefRe =
    /href=['"]?https:\/\/game8\.co\/games\/Umamusume-Pretty-Derby\/archives\/(\d+)['"]?/g;
  const out = new Map();
  let m;
  while ((m = hrefRe.exec(block)) !== null) {
    const id = m[1];
    if (out.has(id)) continue;
    const aEnd = block.indexOf('</a>', m.index);
    if (aEnd === -1) continue;
    const linkBlock = block.slice(m.index, aEnd);
    const altMatch = linkBlock.match(/alt=["']([^"']+?)(?:["']| support)/i);
    const nameRaw = altMatch ? altMatch[1].trim().replace(/\s+Support\s*Card\s*$/i, '') : '';
    const iconMatch = linkBlock.match(/data-src="(https:\/\/(?:img|j-img)\.game8\.co\/[^"]+\.png\/show)"/);
    out.set(id, {
      name: nameRaw,
      icon: iconMatch ? iconMatch[1] : null,
    });
  }
  return out;
}

async function main() {
  console.log('1) Fetching Best Characters tier list...');
  const charsHtml = await fetchHtml(CHARACTERS_INDEX_URL);
  await sleep(SLEEP_MS);
  console.log('2) Fetching Best Support Cards tier list...');
  const cardsHtml = await fetchHtml(SUPPORT_INDEX_URL);
  await sleep(SLEEP_MS);

  const characters = parseCharacterList(charsHtml);
  const cardsFromIndex = parseCardList(cardsHtml);
  console.log(`  → ${characters.length} personajes, ${cardsFromIndex.length} cartas del index.`);

  // 3) Para cada personaje, fetch la build guide y extraer recomendaciones + icono.
  const recommendations = {};
  const cardIdsFromBuilds = new Set();
  // Metadata extra (name, icon) por card que aparece en builds pero no en el index.
  // La mergeamos con cards.json para que el icon proxy sirva iconos reales.
  const cardExtraInfo = new Map();
  let withRecs = 0;
  let skipped = 0;

  for (let i = 0; i < characters.length; i++) {
    const c = characters[i];
    const url = `${BASE}/games/Umamusume-Pretty-Derby/archives/${c.game8Id}`;
    process.stdout.write(`  [${i + 1}/${characters.length}] ${c.name} (${c.version ?? '—'})... `);
    try {
      const html = await fetchHtml(url);
      await sleep(SLEEP_MS);
      const { icon, recommendations: recs, cardInfo } = parseBuildGuide(html, c.name);
      if (icon) c.icon = icon;
      if (recs) {
        recommendations[c.id] = recs;
        recs.main.forEach((id) => cardIdsFromBuilds.add(id));
        recs.budget.forEach((id) => cardIdsFromBuilds.add(id));
        Object.values(recs.alternates).forEach((arr) => arr.forEach((id) => cardIdsFromBuilds.add(id)));
        withRecs++;
        process.stdout.write('OK\n');
      } else {
        skipped++;
        process.stdout.write('no recs (skipped)\n');
      }
      // Acumular cardInfo de TODOS los personajes scrapeados (incluso los que no tienen recs).
      if (cardInfo) {
        for (const [id, info] of cardInfo) {
          const existing = cardExtraInfo.get(id);
          if (!existing || (info.icon && !existing.icon)) {
            cardExtraInfo.set(id, info);
          }
        }
      }
    } catch (err) {
      skipped++;
      process.stdout.write(`error: ${err.message}\n`);
    }
  }

  // 4) Merge cards: las del index + las que aparecieron en builds (pueden ser nuevas versiones).
  // Si la card ya está en el index, conservamos su name (más limpio) y solo le agregamos
  // el icon URL si el index no lo tenía.
  const cardsById = new Map(cardsFromIndex.map((c) => [c.game8Id, c]));
  let newCards = 0;
  for (const id of cardIdsFromBuilds) {
    const extra = cardExtraInfo.get(id);
    if (!cardsById.has(id)) {
      // Card nueva — usar el name/icon del build page.
      const extraName = extra?.name ?? null;
      const extraVersion = extraName?.includes('(')
        ? extraName.match(/\(([^)]+)\)/)?.[1] ?? null
        : null;
      const baseName = extraName?.replace(/\s*\([^)]+\)\s*$/, '').trim() ?? null;
      cardsById.set(id, {
        id: slugify(baseName ?? `card-${id}`, extraVersion),
        game8Id: id,
        name: baseName,
        version: extraVersion,
        icon: extra?.icon ?? null,
      });
      newCards++;
    } else if (extra?.icon && !cardsById.get(id).icon) {
      // Card existente sin icon — rellenar desde el build page.
      cardsById.get(id).icon = extra.icon;
    }
  }
  const cards = [...cardsById.values()];
  console.log(`\n  → ${withRecs} personajes con recomendaciones, ${skipped} skipeados.`);
  console.log(`  → ${cards.length} cartas totales (${newCards} nuevas desde builds).`);
  const cardsWithIcon = cards.filter((c) => c.icon).length;
  console.log(`  → ${cardsWithIcon} cartas con icon (${cards.length - cardsWithIcon} sin icon).`);

  // 5) Emisión.
  await mkdir('data/uma', { recursive: true });
  await writeFile(
    'data/uma/characters.json',
    JSON.stringify(
      characters.map(({ id, game8Id, name, version, icon }) => ({ id, game8Id, name, version, icon })),
      null,
      2
    )
  );
  await writeFile(
    'data/uma/cards.json',
    JSON.stringify(
      cards.map(({ id, game8Id, name, version, icon }) => ({ id, game8Id, name, version, icon })),
      null,
      2
    )
  );
  await writeFile('data/uma/recommendations.json', JSON.stringify(recommendations, null, 2));

  console.log('\nWrote data/uma/characters.json');
  console.log('Wrote data/uma/cards.json');
  console.log('Wrote data/uma/recommendations.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});