# Data pipelines — scripts `build:*`

Los tres scripts generan snapshots estáticos que Vite bundlea inline. No se ejecutan desde una request web.

## `build:d2-manifest` — `scripts/build-d2-manifest.mjs`

**Qué genera**: `data/d2/weapons-index.json` (2058 armas) + `data/d2/perks.json` (2000 perks).

**Requiere**: `BUNGIE_API_KEY` (gratis en https://www.bungie.net/en/Application).

```bash
BUNGIE_API_KEY=<key> npm run build:d2-manifest
git add data/d2/weapons-index.json data/d2/perks.json
git commit -m "d2: refresh manifest" && git push
```

**Qué hace**: baja `DestinyManifest` + `DestinyInventoryItemDefinition` + `DestinyItemCategoryDefinition`, extrae `weaponType` (Hand Cannon, Auto Rifle, …) y `category` de perks (`Barrel` / `Magazine` / `Trait` vía `itemTypeDisplayName`), mapea sub-categorías y filtra blacklist.

**Cuándo refrescar**: ~cada season de D2.

## `build:uma-data` — `scripts/build-uma-data.mjs`

**Qué genera**: `data/uma/characters.json` (96 entradas, 95 con aptitudes) + `cards.json` (106 cartas con icon) + `recommendations.json` (91 personajes con Main, Budget opcional y Alternates).

**Sin key**. Scrapea `game8.co` (Best Characters + Best Support Cards tier lists + Build Guide de cada personaje).

```bash
npm run build:uma-data
git add data/uma/characters.json data/uma/cards.json data/uma/recommendations.json
git commit -m "uma: refresh manifest" && git push
```

**Detalles**: 96 requests secuenciales con `sleep 1200ms` (~2 min). Tolerante a HTML mal-formado (apostrofes en `alt` con `"` interno, `colspan` fuera de `<tr>`). Heading del scenario detectado automáticamente (Grand Live / Trackblazer / Grand Concert). Cards referenciadas que no estaban en la tier list se agregan por `game8Id`. Iconos `img.game8.co` → R2 `uma/` on-demand. Cobertura actual 95/96 con aptitudes y 91/96 con recomendaciones; solo 15/91 guías publican Budget de 6 cartas.

**Cuándo refrescar**: ~cada nuevo scenario (~2–3 meses). Revisar el diff antes de commitear.

## `build:zzz-data` — `scripts/build-zzz-data.mjs`

**Qué genera**: `data/zzz/agents.json` (7) + `w-engines.json` (95) + `disc-sets.json` (39).

**Sin key**. Scrapea Game8: hub `435686` tabla `W-Engine/Type/Rarity` + discos `446608` + agents `435684`.

```bash
npm run build:zzz-data
git add data/zzz/agents.json data/zzz/w-engines.json data/zzz/disc-sets.json
git commit -m "zzz: refresh data" && git push
```

**Detalles**: clon de `build-uma-data`, `sleep 1200ms`, UA `Mozilla/5.0`, regex que tolera `href` sin comillas + `alt` con single-quote + `data-src`, fix `zzz-` prefix y `ZZZ - Thorned Rose` → `Thorned Rose`. Parsea 95 W-Engines (attack 25 / anomaly 19 / stun 18 / support 13 / defense 11 / rupture 9).

**Cuándo refrescar**: cuando Game8 agregue personajes/W-Engines/discos.
