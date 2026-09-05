# ArthurAppHub — Index

Mapa navegable. Si no sabés por dónde empezar, **arrancá acá**.

Hub personal + Identity Provider (SSO) + 9 sub-apps internas. Astro 7 + Tailwind 4 + Cloudflare Workers.
URL: https://arthurapphub.arthurbluthtt.workers.dev

---

## Documentos

| Doc | Para qué |
|---|---|
| [README.md](README.md) | Qué hace, quickstart, deploy, agregar app nueva |
| [DESIGN.md](DESIGN.md) | Sistema de diseño canónico (single source of truth para styling) |
| [docs/architecture.md](docs/architecture.md) | Stack, bindings D1/R2, flujo SSO, lifecycle del Worker |
| [docs/decisions.md](docs/decisions.md) | Decisiones de arquitectura vigentes |
| [docs/data-pipelines.md](docs/data-pipelines.md) | Scripts `build:*` — scrapeo, outputs y refresh |
| [docs/plan-revision-consistencia.md](docs/plan-revision-consistencia.md) | Plan y checklist de revisión por fase y sub-app |
| [docs/sub-apps/d2.md](docs/sub-apps/d2.md) | D2 Wishlist |
| [docs/sub-apps/uma.md](docs/sub-apps/uma.md) | Umamusume Cards |
| [docs/sub-apps/subs.md](docs/sub-apps/subs.md) | Suscripciones |
| [docs/sub-apps/zzz.md](docs/sub-apps/zzz.md) | ZZZ Builds |
| [docs/sub-apps/trackers.md](docs/sub-apps/trackers.md) | GameTracker, MediaTracker, Manga, Book, Anime |
| [docs/sessions/STATE.md](docs/sessions/STATE.md) | Estado operativo vigente del proyecto |
| [docs/sessions/](docs/sessions/) | Logs históricos; `Mavis_STATE.md` y `Mavis_CHANGELOG.md` no son operativos |
| [AGENTS.md](AGENTS.md) | Instrucciones para AI agents |

---

## Mapa del proyecto

```
AppHub/
├── src/
│   ├── data/apps.json
│   ├── components/
│   │   ├── Header.astro
│   │   ├── ThemeToggle.astro
│   │   ├── StatusDot.astro
│   │   ├── AppCard.astro
│   │   ├── AppGrid.astro          # 6 por fila en xl
│   │   ├── SearchBar.astro        # Buscar... + clear ×
│   │   ├── d2/
│   │   │   ├── AddWeaponDialog.astro
│   │   │   ├── CustomPerkIconDialog.astro
│   │   │   └── WeaponCard.astro
│   │   ├── uma/
│   │   │   ├── AddCharacterDialog.astro
│   │   │   └── SupportCardList.astro
│   │   ├── subs/
│   │   │   ├── AddSubDialog.astro
│   │   │   └── SubCard.astro
│   │   ├── games/
│   │   │   ├── AddGameDialog.astro
│   │   │   ├── EditGameDialog.astro
│   │   │   └── SagaPicker.astro
│   │   ├── media/
│   │   │   ├── AddMediaDialog.astro
│   │   │   ├── EditMediaDialog.astro
│   │   │   └── MediaCard.astro
│   │   ├── manga/
│   │   │   ├── AddMangaDialog.astro
│   │   │   ├── EditMangaDialog.astro
│   │   │   └── MangaCard.astro
│   │   ├── books/
│   │   │   ├── AddBookDialog.astro
│   │   │   ├── EditBookDialog.astro
│   │   │   └── BookCard.astro
│   │   ├── anime/
│   │   │   ├── AddAnimeDialog.astro
│   │   │   ├── EditAnimeDialog.astro
│   │   │   └── AnimeCard.astro
│   │   └── zzz/
│   │       ├── ZzzCard.astro       # flex 62/38 + handle ⋮⋮
│   │       ├── ZZZPicker.astro     # genérico fixed + pills
│   │       ├── AddZzzDialog.astro
│   │       └── EditZzzDialog.astro
│   ├── layouts/BaseLayout.astro
│   ├── lib/
│   │   ├── auth.ts                 # hashPin, sesiones, codes, deriveAppPinHash
│   │   ├── internal.ts             # verifyInternal
│   │   ├── apps.ts                 # helpers de apps.json
│   │   ├── types.ts
│   │   ├── d2/{manifest,wishlist,perkIcons,resolver}.ts
│   │   ├── uma/{data,wishlist}.ts
│   │   ├── subs/{store,validate,format}.ts
│   │   ├── games/store.ts
│   │   ├── media/{store,tmdb}.ts
│   │   ├── manga/{store,kitsu}.ts
│   │   ├── books/{store,openlibrary}.ts
│   │   ├── anime/{store,kitsu}.ts
│   │   └── zzz/{store,data,constants}.ts
│   ├── pages/
│   │   ├── index.astro             # / → login o grid
│   │   ├── login.astro             # shim → /
│   │   ├── signup.astro
│   │   ├── api/{health,redir,auth/*}
│   │   └── {destiny,umamusume,subs,games,media,manga,books,anime,zzz}/
│   │       └── index.astro + api/{search,add,add-manual,edit,set-status,remove,...}
│   ├── styles/global.css
│   └── env.d.ts
├── data/
│   ├── d2/{weapons-index,perks}.json
│   ├── uma/{characters,cards,recommendations}.json
│   └── zzz/{agents,w-engines,disc-sets}.json
├── scripts/build-{d2-manifest,uma-data,zzz-data}.mjs
├── migrations/0001_*.sql … 0019_zzz_position.sql
├── docs/
│   ├── architecture.md
│   ├── decisions.md
│   ├── data-pipelines.md
│   ├── sub-apps/{d2,uma,subs,zzz,trackers}.md
│   └── sessions/
│       ├── STATE.md                  # estado operativo vigente
│       ├── Mavis_STATE.md             # histórico de otro agente, no operativo
│       └── Mavis_CHANGELOG.md         # histórico de otro agente, no operativo
├── DESIGN.md
├── README.md
├── INDEX.md
├── AGENTS.md
├── astro.config.mjs
├── wrangler.jsonc
└── package.json
```

---

## Tareas comunes

| Tarea | Dónde mirar |
|---|---|
| Agregar una app nueva | `README.md` → "Agregar una app nueva" + `docs/architecture.md` → Registro de apps |
| Cambiar paleta / componente | `DESIGN.md` |
| Entender el flujo SSO | `docs/architecture.md` → Auth |
| Detalle de una sub-app / su API | `docs/sub-apps/*.md` |
| Decisiones y por qué | `docs/decisions.md` |
| Refrescar datos (manifests) | `docs/data-pipelines.md` |
| Migrar DB | `migrations/` + `wrangler d1 migrations apply arthurapphub-auth-db --remote` |
