# Plan de revisión de consistencia — ArthurAppHub

## Objetivo

Revisar el proyecto app por app para encontrar diferencias entre código,
schema, APIs, UI y documentación. El trabajo se hará por partes.

No modificar código hasta autorizar explícitamente la corrección de cada
hallazgo.

## Fuente de verdad

- `docs/sessions/STATE.md` es el estado vigente del proyecto.
- `docs/sessions/Mavis_STATE.md` y `Mavis_CHANGELOG.md` son históricos de otro
  agente y no se usan para decidir el estado actual.
- `INDEX.md`, `README.md`, `DESIGN.md`, `docs/architecture.md` y
  `docs/decisions.md` deben quedar alineados con `STATE.md`.

## Método por app

1. Comparar documentación contra código, rutas, APIs y migraciones.
2. Clasificar cada diferencia como funcional, de seguridad, de tipos,
   documental o simplemente histórica.
3. Entregar hallazgos con archivo, línea, impacto y propuesta.
4. Esperar autorización (`Procede`) antes de modificar.
5. Aplicar la corrección de esa app.
6. Ejecutar build y pruebas proporcionales al cambio.
7. Actualizar la documentación correspondiente.

## Orden de trabajo

### 0. Estructuración del proyecto

Antes de revisar cada app, ordenar la estructura lógica y documental del
proyecto sin cambiar su comportamiento:

- Inventariar las carpetas, páginas, componentes, stores, APIs, migraciones,
  scripts y datos actuales.
- Definir qué archivos son fuente activa, documentación operativa, referencia
  técnica o histórico archivado.
- Mantener `docs/sessions/STATE.md` como estado vigente.
- Marcar `Mavis_STATE.md` y `Mavis_CHANGELOG.md` como históricos de otro agente,
  fuera del flujo operativo.
- Revisar si `STATE.md` raíz eliminado y los documentos de `docs/sessions/`
  están representados correctamente en el mapa del proyecto.
- Alinear `INDEX.md` con la estructura real, incluyendo nombres de archivos,
  rutas y sub-apps existentes.
- Separar inconsistencias de documentación de inconsistencias de código para
  no mezclar ambas clases de cambios.
- Confirmar el inventario de las 9 apps actuales, sus rutas y sus migraciones.
- Registrar archivos obsoletos o duplicados para decisión posterior; no
  borrarlos automáticamente.

Resultado esperado: un mapa único y confiable del proyecto, con una distinción
clara entre documentación vigente, históricos y pendientes.

#### Resultado de Fase 0 — 2026-09-02

- Inventario confirmado: 9 sub-apps registradas en `src/data/apps.json`, con
  rutas correspondientes en `src/pages/` y migraciones `0001–0019` presentes.
- `docs/sessions/STATE.md` queda identificado como estado operativo vigente.
- `docs/sessions/Mavis_STATE.md` y `Mavis_CHANGELOG.md` quedan identificados
  como históricos no operativos; se conservan y no se eliminan.
- `INDEX.md`, `README.md` y `DESIGN.md` reflejan el conteo real de 9 apps y el
  plan de revisión.
- No se modificó lógica de aplicación, esquema, APIs ni configuración de
  ejecución durante esta fase.
- Las referencias del inventario que correspondían al Hub (build, SSO, `next`,
  URL canónica y tipos compartidos) se atendieron en la Fase 1. Los nombres
  heredados de AniList quedan separados para la futura revisión de MangaTracker.

## Hallazgos de Fase 1 — Hub

Diagnóstico realizado el 2026-09-02. Las correcciones autorizadas se aplicaron
y verificaron durante la Fase 1.

1. **Build — cerrado el 2026-09-02.** Dentro del sandbox, `npm run build`
   fallaba al cargar `astro.config.mjs` con `require is not defined` porque
   `esbuild` no podía iniciar su proceso nativo (`spawn EPERM`). Ejecutado
   fuera del sandbox, el mismo build completó correctamente con Astro 7.1.3,
   `@astrojs/cloudflare` 14.1.4, Vite 8.1.5 y Node 24.18.0. No requiere una
   corrección de código. La configuración de sesiones obsoleta se resolvió en
   el hallazgo 7 de esta fase.
2. **Tipos de entorno — cerrado el 2026-09-03.** `src/env.d.ts` ahora amplía
   `Cloudflare.Env`, que es el namespace usado por `cloudflare:workers`, y
   declara `AUTH_PEPPER`, `INTERNAL_API_SECRET`, `BUNGIE_API_KEY` y el secreto
   opcional `TMDB_API_KEY`. MediaTracker y el proxy R2 de ZZZ usan ahora
   `env.TMDB_API_KEY` y `env.D2_ASSETS` directamente, sin casts manuales.
3. **Redirección abierta — cerrado el 2026-09-03.** Se añadió
   `safeNextPath()` en `src/lib/auth.ts` y se aplicó en login, signup y el
   shim `/login`. Solo se conservan rutas locales que empiezan con `/`; se
   rechazan URLs absolutas, destinos scheme-relative (`//host`), barras
   invertidas y caracteres de control.
4. **Contrato SSO — cerrado el 2026-09-03.** `src/pages/api/redir.ts` ahora
   verifica `isSsoApp()` antes de crear un code. Las apps internas responden
   400 en ese endpoint y continúan usando su `redir` local; las apps externas
   mantienen el flujo GET hacia su endpoint y POST autenticado al Hub. Se
   aclaró el contrato en `docs/architecture.md`.
5. **Tipos del registro — cerrado el 2026-09-03.** `src/lib/apps.ts` ahora
   reutiliza `App`/`AppsData` desde `src/lib/types.ts`; se eliminó `AppData` y
   el cast de `apps`. El tipo compartido incluye `sso` y mantiene `tags` como
   opcional, igual que el registro y los ejemplos de alta de apps.
6. **URL canónica — cerrado el 2026-09-03.** Se eligió
   `https://arthurapphub.arthurbluthtt.workers.dev`, que ya usaban el deploy,
   `apps.json` y README. Se actualizó `astro.config.mjs` y la documentación de
   arquitectura/decisiones.
7. **Configuración ambigua — cerrado el 2026-09-03.** Astro 7.1.3 no ofrece
   un driver `null` y, sin una configuración explícita, el adapter activa por
   defecto el KV `SESSION`. Se configuró el driver local no-op
   `src/lib/astro-session-null.ts`; así el adapter no agrega ese binding y la
   autenticación real continúa usando D1 y la cookie `hub_sess`. La decisión
   quedó documentada en `docs/architecture.md`.

El build global queda verificado. La validación adicional `npx tsc --noEmit`
mantiene errores baseline únicamente en APIs de sub-apps posteriores; no
bloquea el build de producción.

## Hallazgos de Fase 2 — D2 Wishlist

Diagnóstico realizado el 2026-09-03. Las correcciones autorizadas se aplicaron
y verificaron durante la Fase 2.

1. **Tier ausente en la card — P2 — CERRADO 2026-09-03.** Se propagó `tier`
   desde el manifest y el resolver hacia la card SSR, la card dinámica y las
   respuestas de las APIs de alta/actualización. La card ahora muestra el badge
   `Exótico` o `Legendario` cuando el dato está disponible.
2. **Contrato de búsqueda documentado incorrectamente — P2 — CERRADO 2026-09-03.**
   `docs/sub-apps/d2.md` ahora refleja `{result: Weapon | null}`, la única mejor
   coincidencia y sus prioridades exacta/prefijo/substring, además del caso sin
   resultados que consume `AddWeaponDialog`.
3. **Fallback de categorías no implementado — P2 — CERRADO 2026-09-03.**
   `match.ts` ahora resuelve por nombre las perks sin `category` usando el
   fallback documentado (`barrel|sights|scope|launcher` → `Barrel`;
   `mag|magazine|rounds|cartridge|battery` → `Magazine`; resto → `Trait`),
   antes de aplicar whitelist y blacklist por slot. Esto cubre tanto wishlist
   legacy como resultados del manifest.
4. **Error de TypeScript en el endpoint de perks — P1 técnico — CERRADO 2026-09-03.**
   `match.ts` ahora ordena usando `_score` internamente y construye un array
   público sin ese campo mediante destructuring, evitando el `delete` inválido.
   `tsc` ya no reporta errores dentro de D2; conserva errores baseline en
   configuración de sesiones y otras sub-apps.
5. **Snapshot con referencias incompletas — P3 — CERRADO 2026-09-03.** El
   generador ahora filtra `perkPoolHashes` y `mainPerkHashes` contra los hashes
   realmente emitidos en `perks.json`; el snapshot existente fue saneado y la
   validación devuelve 0 referencias faltantes. Las 544 armas sin
   `mainPerkHashes` quedan documentadas como caso legacy esperado, no como
   referencia inválida.

La validación del snapshot confirmó 2058 armas y 2000 perks, sin hashes de arma
duplicados; sí hay nombres de arma repetidos entre variantes del catálogo.

## Hallazgos de Fase 3 — Umamusume Cards

Diagnóstico realizado el 2026-09-03. Las correcciones autorizadas se aplicaron
y verificaron durante la Fase 3.

1. **Filtro y toggle de “Encontrada” ausentes en la UI — P1 funcional — CERRADO 2026-09-03.**
   `src/pages/umamusume/index.astro` ahora renderiza tabs
   `Todas/Pendientes/Encontradas`, conserva `data-found` en cards SSR y runtime,
   y usa `POST /umamusume/api/toggle-found` para actualizar estado, etiqueta,
   contadores y visibilidad sin recargar.
2. **Cards agregadas en runtime omiten Alternates — P1 funcional — CERRADO 2026-09-03.**
   `buildCharacterArticle()` ahora construye dentro de “Ver más” las mismas
   agrupaciones `Speed/Power/Wit` que el render SSR, usando las cards resueltas
   por `/umamusume/api/character/[id]`.
3. **Status de alta no coincide con la documentación — P2 de contrato — CERRADO 2026-09-03.**
   `src/pages/umamusume/api/add.ts` ahora devuelve `201` en la respuesta exitosa,
   alineado con `docs/sub-apps/uma.md` y con las demás sub-apps.
4. **Cobertura de Budget sobreafirmada — P2 documental/datos — CERRADO 2026-09-03.**
   Se corrigieron `docs/sub-apps/uma.md` y `docs/data-pipelines.md` para indicar
   que Budget es opcional: actualmente 15/91 guías tienen 6 cartas Budget y
   76/91 no lo publican. La UI ya ocultaba correctamente el bloque vacío, por lo
   que no fue necesario inventar datos ni cambiar el parser.
5. **Cobertura de aptitudes y entradas sin recomendaciones — P3 documental — CERRADO 2026-09-03.**
   `docs/sub-apps/uma.md` y `docs/data-pipelines.md` ahora distinguen 96
   entradas totales, 95 con aptitudes y 91 con recomendaciones. También aclaran
   que son cuatro guías con layouts viejos más `564 Escapades`, entrada que Game8
   clasificó erróneamente como personaje y que no tiene aptitudes.
6. **`limit` negativo no se valida — P2 de entrada API — CERRADO 2026-09-03.**
   `/umamusume/api/search` ahora normaliza `limit` como entero entre 1 y 30 y
   usa 10 si falta o no es un entero válido; el rango quedó documentado.
7. **Respuesta de toggle incompleta en la documentación — P3 de contrato — CERRADO 2026-09-03.**
   La tabla de `docs/sub-apps/uma.md` ahora documenta `{found, foundAt}`, que
   coincide con la respuesta real de `toggle-found.ts`.

## Hallazgos de Fase 4 — Suscripciones

Diagnóstico realizado el 2026-09-03. Las correcciones autorizadas se aplicaron
y verificaron durante la Fase 4.

1. **Zona horaria divergente en el próximo cobro — P2 funcional — CERRADO 2026-09-03.**
   El cálculo dinámico de `src/pages/subs/index.astro` ahora usa explícitamente
   `America/Mexico_City`, tanto para determinar "hoy" como para formatear la
   fecha, alineado con `src/lib/subs/format.ts` y el SSR.
2. **Contadores superiores quedan obsoletos — P2 funcional — CERRADO 2026-09-03.**
   El encabezado ahora tiene `data-subs-count` y se recalcula junto con el
   resumen después de agregar, eliminar o cambiar el estado de una suscripción.
3. **Validación redondea valores que deberían ser enteros — P2 de entrada API — CERRADO 2026-09-03.**
   `parseSubInput()` ahora exige `priceCents` como entero seguro no negativo y
   `billingDay` como entero entre 1 y 31, sin redondear payloads fraccionarios.
   La documentación refleja el contrato.
4. **Payloads con `id` no string pueden terminar en 500 — P2 de entrada API — CERRADO 2026-09-03.**
   `remove.ts` y `toggle-active.ts` ahora comprueban que el JSON sea un objeto
   y que `id` sea string antes de aplicar `trim()`. Bodies como `null` o
   `{id: 123}` responden `400` de forma consistente.
5. **Respuesta de edición incompleta — P2 de contrato — CERRADO 2026-09-03.**
   `updateSub()` ahora usa `UPDATE ... RETURNING` y `/update` devuelve la fila
   completa con `active` y `createdAt`, igual que el modelo `SubRow`; la
   documentación explicita los campos de `{sub}`.
6. **Moneda pausada aparece como total `0` — P3 semántico/UX — CERRADO 2026-09-03.**
   El SSR y `renderSummary()` ahora muestran solo monedas con suscripciones
   activas. Una moneda cuyas suscripciones están todas pausadas se oculta en
   vez de mostrar un total `0`; la decisión quedó reflejada en la documentación.

Confirmaciones sin hallazgo: las monedas admitidas son `MXN|USD`, el precio se
guarda en `price_cents`, el picker cubre los días 1–31 y el aislamiento
`data-sub-dialog-*` frente a `data-sub-*` está aplicado.

### 1. Hub

- Resolver el fallo actual de `npm run build` (`require is not defined`).
- Alinear el contrato SSO: redirect GET frente a exchange POST.
- Validar de forma segura el parámetro `next` en login y signup.
- Corregir el conteo de apps: el registro actual contiene 9, no 10.
- URL canónica definida: `https://arthurapphub.arthurbluthtt.workers.dev`.
- Unificar los tipos `App` y `AppData`, incluyendo `sso` y `tags`.
- Declarar `TMDB_API_KEY` en los tipos de entorno.
- Retirar referencias documentales obsoletas a Mavis y al antiguo AniList.
- Verificar login, signup, logout, health, redir y rutas principales.

### 2. D2 Wishlist

- Comparar manifest, perks, iconos, filtros, estados y APIs.
- Revisar el badge de tier documentado pero no visible en las cards.
- Verificar agregar, editar, marcar encontrada y eliminar.

### 3. Umamusume Cards

- Revisar snapshots, cobertura de personajes y recomendaciones.
- Confirmar escenario, búsqueda, wishlist, “Ver más” e iconos R2.
- Revisar pendientes reales frente a históricos.

### 4. Suscripciones

- Revisar MXN/USD, precios en centavos, días de cobro y zona horaria.
- Verificar próximo cobro, resumen dinámico, edición y pausa.
- Confirmar el aislamiento de `data-sub-dialog-*`.

### 5. GameTracker — plan operativo de Fase 5

Objetivo: contrastar el modelo de juegos, Steam, modo manual, estados, edición,
filtros, sagas y cards dinámicas sin mezclar esta app con Media/Manga/Book/Anime.

Orden de trabajo:

1. **Baseline y fuentes:** revisar `docs/sessions/STATE.md`,
   `docs/sub-apps/trackers.md`, `docs/decisions.md`, migraciones `0010–0012`,
   `src/lib/games/*`, `src/pages/games/*` y `src/components/games/*`. Registrar
   solo diferencias reproducibles; no modificar código durante el diagnóstico.
2. **H1 — Storage y ownership:** comparar columnas `app_id`, `cover_url`,
   `year`, `status`, `saga`, `created_at`, índices y UNIQUE parcial contra
   `GameRow`, `listGames()` y las comprobaciones por usuario.
3. **H2 — Steam search/add:** verificar `storesearch`, filtros de juegos frente
   a bundles/DLC/OST/demo, `appdetails`, `header_image`, año, `appId`, errores
   `404/409/502` y contrato de respuestas.
4. **H3 — Agregado manual:** revisar validación de nombre, año, portada y saga,
   duplicados case-insensitive, `app_id NULL`, errores `400/409` y respuesta
   completa de la card.
5. **H4 — Estados y edición:** comprobar estados permitidos
   `backlog/playing/finished`, estado default, patch parcial, edición de
   manuales/Steam, `set-status`, ownership y respuestas `404`/`409`.
6. **H5 — UI y runtime:** verificar SSR y cards creadas dinámicamente, dropdown
   custom, listeners delegados, búsqueda, filtros con conteos, estados vacíos,
   edición, borrado y actualización del array local después de cada mutación.
7. **H6 — Sagas:** confirmar que la saga siga siendo texto libre, sin catálogo ni
   autodetección; revisar `SagaPicker`, “Sin saga”, “Otra”, filtro por saga,
   limpieza y persistencia en alta/edición.
8. **H7 — Layout y documentación:** comparar grid fluido, cover Steam, ancho
   ultrawide, atributos `data-*`, `docs/sub-apps/trackers.md`, `STATE.md` y
   `decisions.md`; separar inconsistencias documentales de las funcionales.
9. **Verificación final:** tras cada `Procede`, ejecutar validaciones
   proporcionales y actualizar el hallazgo. Al cerrar la app, realizar el smoke
   test pendiente: login → `/games` → buscar Balatro → agregar → agregar manual
   Stella Sora → cambiar estado → filtrar → borrar.

#### Resultado H1 — 2026-09-03

**H1 verificado sin inconsistencia funcional.** La forma final de `games` tras
`0010–0012` coincide con `GameRow`: `app_id` y `cover_url` son anulables,
`saga` es `TEXT NULL`, y el índice UNIQUE de Steam es parcial por usuario.
`listGames()`, `addGame()`, `setStatus()`, `editGame()` y `removeGame()` aplican
el `username` en sus consultas; no se detectó una vía de lectura o mutación
fuera del ownership. No requiere corrección de código; H2 continúa con Steam.

#### Hallazgos H2 — Steam search/add — 2026-09-03

1. **Búsqueda Steam sin auth gate — P2 de seguridad/consistencia — CERRADO 2026-09-03.**
   `src/pages/games/api/search.ts` ahora valida `hub_sess`, alineando el proxy
   con el requisito de login de los trackers.
2. **`appId` se coacciona con `Number()` — P2 de entrada API — CERRADO 2026-09-03.**
   `add.ts` ahora exige un body objeto y un entero positivo seguro; valores como
   `true`, `[123]` o `null` responden `400` sin consultar Steam.
3. **`type` de Steam no se exige estrictamente — P2 de integridad — CERRADO 2026-09-03.**
   El alta ahora exige `data.type === 'game'`; si falta el tipo, rechaza el
   resultado en vez de aceptar una respuesta incompleta.
4. **JSON estructuralmente inválido de Steam puede producir 500 — P2 de
   resiliencia — CERRADO 2026-09-03.** `search.ts` y `add.ts` validan ahora la
   forma de las respuestas antes de leerlas y devuelven `502` cuando Steam
   responde con JSON válido pero incompatible.

Confirmaciones sin hallazgo: `storesearch` usa `type === 'app'` y top 8,
`appdetails` se consulta una vez, el año se extrae por regex y el duplicado por
`app_id` queda protegido por el UNIQUE parcial por usuario.

#### Hallazgos H3 — Agregado manual — 2026-09-03

1. **Body `null` podía terminar en 500 — P2 de entrada API — CERRADO 2026-09-03.**
   `add-manual.ts` valida ahora que el JSON sea un objeto y responde `400` para
   `null` o arrays antes de leer `name`.
2. **Año con coerción implícita — P2 de entrada API — CERRADO 2026-09-03.**
   El endpoint acepta `year` como entero seguro entre 1900 y 2100, o `null`/
   ausencia; booleanos, arrays, strings y fracciones inválidas responden `400`.
3. **Portada con tipos inválidos podía convertirse en `NULL` — P2 de entrada
   API — CERRADO 2026-09-03.** `coverUrl` exige string vacío opcional o URL
   `http(s)` válida; cualquier otro tipo o protocolo responde `400`.
4. **Saga larga se truncaba silenciosamente — P2 de integridad — CERRADO
   2026-09-03.** La saga manual exige string de hasta 60 caracteres y responde
   `400` si excede el límite; el valor persistido conserva el texto completo.

Confirmaciones sin hallazgo: el duplicado manual usa `lower(name)` por usuario,
`app_id` se envía como `NULL`, el estado inicial proviene de `DEFAULT_STATUS` y
`addGame()` devuelve el `GameRow` completo para construir la card dinámica.

#### Hallazgos H4 — Estados y edición — 2026-09-03

1. **Comparación con `NaN` siempre falsa — P1 técnico — CERRADO 2026-09-03.**
   `edit.ts` usa ahora `Number.isNaN()` y rechaza años inválidos antes de
   construir el patch para D1.
2. **Body y campos editables podían producir 500 o coerción implícita — P2 de
   entrada API — CERRADO 2026-09-03.** `edit.ts` valida body objeto, año como
   entero seguro, portada `http(s)` y saga string de hasta 60 caracteres; los
   payloads inválidos responden `400`.
3. **`set-status` aplicaba `.trim()` a valores no string — P2 de entrada API —
   CERRADO 2026-09-03.** El endpoint valida body e `id` antes de leerlos y
   conserva `400` para estados fuera de `backlog/playing/finished`.

Confirmaciones sin hallazgo: `DEFAULT_STATUS` es `backlog`, `setStatus()` y
`editGame()` actualizan mediante `UPDATE ... RETURNING`, el patch no permite
campos fuera de `name/year/coverUrl/saga`, y todas las mutaciones incluyen el
`username`; el nombre duplicado devuelve `409` y un id ajeno devuelve `404`.

#### Hallazgos H5 — UI y runtime — 2026-09-03

1. **Opciones de saga construidas con HTML de entrada — P2 de integridad de UI —
   CERRADO 2026-09-03.** `rebuildSagaOptions()` construye ahora cada
   `<option>` con `createElement`, `value` y `textContent`; una saga con
   caracteres de markup ya no puede alterar el dropdown.
2. **El primer alta dejaba ocultos los filtros — P2 funcional — CERRADO
   2026-09-03.** El evento `games:game-added` sincroniza ahora toda la
   visibilidad después de insertar la card, incluyendo el grupo de filtros por
   estado y los estados vacíos.
3. **Fallo de Steam presentado como búsqueda vacía — P2 UX/resiliencia —
   CERRADO 2026-09-03.** El dialog comprueba `res.ok` y muestra sesión expirada,
   error HTTP o error de red; `401/502` ya no se confunden con “Sin
   coincidencias”. Cada nueva búsqueda limpia el error anterior si el servicio
   vuelve a responder correctamente.
4. **Búsqueda de card con selector compuesto por id — P3 robustez — CERRADO
   2026-09-03.** `findCard()` compara `dataset.gameId` sobre las cards
   existentes y no concatena el id en un selector CSS.

Confirmaciones sin hallazgo: las cards SSR y dinámicas comparten los mismos
`data-*`, el grid y resultados usan listeners delegados, el status y la
edición actualizan el array local, y las mutaciones recalculan conteos,
opciones, filtros, estados vacíos y contador del encabezado según corresponde.
#### Hallazgos H6 — Sagas — 2026-09-04

1. **Catálogo/autodetector muerto contrario al contrato — P2 de mantenimiento —
   CERRADO 2026-09-04.** Se eliminó `src/lib/games/sagas.ts`, que no tenía
   consumidores pero describía un catálogo seed y `detectSaga()`; la fuente de
   saga vuelve a ser exclusivamente el texto introducido por el usuario.
2. **Alta Steam coaccionaba y truncaba `saga` — P2 de integridad — CERRADO
   2026-09-04.** `/games/api/add` ahora exige string opcional de hasta 60
   caracteres, igual que alta manual y edición, antes de consultar Steam.
3. **Saga no se persistía al alta desde Steam — P2 funcional — CERRADO
   2026-09-04.** `SagaPicker` se comparte entre los modos Steam y manual, y el
   alta Steam envía su valor junto con `appId`.
4. **Filtro de saga tenía callback fuera del alcance de su estado — P2 runtime —
   CERRADO 2026-09-04.** `__addGameDialogSetSaga` vive ahora dentro del guard de
   inicialización y conserva acceso a `currentSaga`, `debounce` y `runSearch`.
5. **El picker detectaba siempre modo botón — P3 runtime — CERRADO 2026-09-04.**
   `getMode()` deriva el modo del input visible, por lo que “Otra”, Enter, Blur
   y Escape conservan una transición coherente.

Confirmaciones sin hallazgo: “Sin saga” limpia a `null`, “Otra” permite texto
libre con autofocus, la edición hidrata y puede limpiar la saga, el filtro usa
el valor exacto de `data-saga`, y no hay autodetección del nombre del juego.
La lista de sugerencias del picker refleja las sagas existentes al cargar la
página; el usuario siempre puede crear otra mediante “Otra”.

#### Resultado H7 — Layout y documentación — 2026-09-04

1. **Fallback de portada distinto entre SSR y runtime — P2 funcional — CERRADO
   2026-09-04.** Las imágenes SSR y las creadas por `buildGameCard()` comparten
   ahora `data-game-cover-image` y un listener de error delegado que aplica el mismo
   placeholder seguro.
2. **`INDEX.md` referenciaba el catálogo eliminado — P3 documental — CERRADO
   2026-09-04.** El árbol del proyecto refleja ahora solo `src/lib/games/store.ts`.
3. **Decisiones hablaba de typeahead inexistente — P3 documental — CERRADO
   2026-09-04.** `decisions.md` y `STATE.md` describen la lista de sugerencias
   de sagas usadas y la posibilidad de escribir otra libremente.

Confirmaciones sin hallazgo: `DESIGN.md` y el código coinciden en container
`max-w-[1760px] 2xl:max-w-[2240px]`, grid `gap-4` con `1→2→3→5→6→7`
columnas, cover `aspect-[460/215]`, `loading/decoding` y cards que ocupan la
celda. Los `data-*` SSR/runtime están alineados; la diferencia nominal
`data-remove-game`/`data-edit-game` frente a los trackers clonados queda
documentada como específica de GameTracker, no como una colisión.

GameTracker queda cerrado hasta H7. El único pendiente operativo separado de
esta auditoría es el smoke test E2E en browser indicado en `STATE.md`.

### 6. MediaTracker — completada 2026-09-04

- [x] Auth y cuerpos JSON estrictos: cookie ausente, `null` y arrays responden JSON `401/400` coherente.
- [x] TMDB: validación de payload, `append_to_response=credits`, máximo 8 resultados y diferenciación `502 tmdb_failed` / `503 tmdb_not_configured`.
- [x] Mutaciones: validación sin coerción, rangos y límites estrictos; `mediaType` soportado por el patch interno; `404 not_found` documentado para borrado.
- [x] UI runtime: conteos globales, filtros, altas/ediciones/cambios/borrados y estados vacío/sin coincidencias sincronizados; búsqueda por `dataset.mediaId`; fallback SSR/runtime unificado.
- [x] Alta dialog: reset completo al abrir y mensajes explícitos para sesión, TMDB, red y validaciones.
- [x] Documentación actualizada en `docs/sub-apps/trackers.md`, `docs/sessions/STATE.md` y `docs/decisions.md`; no se tocaron `Mavis_*`.
- [x] Verificación técnica: build, TypeScript del alcance MediaTracker y contrato `401` JSON sin sesión.
- [x] Baseline documentado: el `tsc` global aún reporta 6 guards de AnimeTracker, 4 guards de ZZZ y 1 nullable de GameTracker, todos fuera del alcance de MediaTracker.
- [x] Smoke test autenticado completado: búsqueda TMDB (película y serie), alta desde TMDB, duplicado, alta manual sin portada, cambio de estado, filtros combinados, estado sin coincidencias y persistencia tras recarga. Los datos temporales fueron eliminados manualmente al cierre.

### 7. MangaTracker

- Normalizar la inconsistencia Kitsu/AniList en archivos, tipos, payloads,
  comentarios, errores y documentación.
- Confirmar que la normalización no rompa datos existentes.

#### H1 — Identidad Kitsu/AniList — completado 2026-09-04

- [x] Wrapper renombrado de `anilist.ts` a `kitsu.ts`.
- [x] Contratos y payloads renombrados de `anilistId` a `kitsuId`.
- [x] `external_id` y los datos existentes se mantienen sin migración.
- [x] Imports, tags, comentarios, `INDEX.md`, documentación activa y `STATE.md` alineados con Kitsu.
- [x] Verificación: build Astro completo correcto y `tsc` sin errores dentro de MangaTracker; los errores baseline quedan fuera de este alcance.

#### H2 — Contrato Kitsu y estado runtime — completado 2026-09-04

- [x] Payloads Kitsu estrictos: IDs, recursos, títulos y portadas incompatibles producen `502 kitsu_failed`.
- [x] Errores JSON uniformes en búsqueda, altas, edición, estado y borrado; cuerpos `null`/arrays producen `400 invalid_body`.
- [x] Fallback compartido entre cards SSR/runtime; conteos globales y estados vacío/sin coincidencias recalculados tras cada mutación.
- [x] Documentación de contrato y verificación actualizada en `trackers.md`, `STATE.md` y `decisions.md`.

### 8. BookTracker

#### H1 — Open Library, OLID y portadas — completado 2026-09-04

- [x] Open Library validada con máximo 8 resultados y payloads estrictos.
- [x] OLID normalizado para obras (`/works/OL…W`) y ediciones (`/books/OL…M`), manteniendo `external_id TEXT` sin migración.
- [x] Detalle, `covers[0]` y fallback por OLID alineados con los tipos `book|ebook|audiobook`.

#### H2 — API, edición y estado runtime — completado 2026-09-04

- [x] Endpoints de búsqueda, alta, alta manual, edición, estado y borrado con errores JSON uniformes y validación sin coerción.
- [x] Edición interna acepta `bookType`, `title`, `coverUrl` y `status`; duplicados y `404 not_found` documentados.
- [x] Conteos globales, filtros, altas, edición, cambios de estado, borrado, estados vacío/sin coincidencias y fallback SSR/runtime sincronizados.
- [x] Documentación actualizada en `trackers.md`, `STATE.md` y `decisions.md`; sin migraciones nuevas.
- [x] Verificación técnica: build Astro correcto y cero errores TypeScript dentro de BookTracker.

### 9. AnimeTracker

#### H1 — Kitsu y contrato de tipos — completado 2026-09-04

- [x] Eliminada la rama obsoleta “Kitsu no configurado” y la respuesta 503; Kitsu no requiere secret y las fallas quedan en `502 kitsu_failed`.
- [x] Parser Kitsu estricto: IDs, recursos, atributos, títulos, fechas, ratings y portadas incompatibles producen `502`; búsqueda limitada a 8 resultados.
- [x] Alta Kitsu valida `kitsuId` como entero seguro positivo y `animeType` estrictamente `tv|movie`; la alta manual valida año, URL y límites de textos sin coerción.

#### H2 — API, edición y estado runtime — completado 2026-09-04

- [x] Endpoints Anime con sesión null-safe, cuerpos solo objeto JSON y errores uniformes (`401`, `400` específicos, `404`, `409`, `502`).
- [x] `/anime/api/edit` acepta estrictamente `animeType`, `title`, `year`, `coverUrl`, `director`, `genre` y `status`; permanece como compatibilidad interna sin edición visible en la card.
- [x] Conteos globales, filtros combinados, altas, edición, cambios de estado, borrado, estados vacío/sin coincidencias y fallback SSR/runtime sincronizados.
- [x] Documentación actualizada en `trackers.md`, `STATE.md` y `decisions.md`; no se crearon migraciones ni se tocaron `Mavis_*`.
- [x] Verificación técnica: cero errores TypeScript dentro de AnimeTracker; los errores baseline de otras apps se mantienen documentados fuera de esta fase.

### 10. ZZZ Builds

#### H1 — Schema, store y compatibilidad legacy — completado 2026-09-04

- [x] Confirmadas las migraciones `0017–0019`; no se creó ninguna migración nueva.
- [x] `stat_values` queda como formato canónico y `display_stats` como alias legacy de lectura/escritura.
- [x] `listZzz`, `addZzz` y `editZzz` toleran instalaciones anteriores a `0018`/`0019` mediante fallbacks de columnas y mantienen el orden determinista.
- [x] `position` se conserva para el orden manual; instalaciones sin `0019` siguen siendo legibles y reportan que no pueden persistir reordenamientos.
- [x] Datos existentes preservados; no se tocaron `Mavis_*`.

#### H2 — Contrato API y validaciones — completado 2026-09-04

- [x] Sesión null-safe y cuerpos JSON estrictamente objeto; `null`, arrays y JSON inválido responden `400 {error: "invalid_body"}`.
- [x] Alta y edición validan nombre de personaje, portada `http(s)`, W-Engine/Disc Sets del catálogo, discos con slots únicos y stats canónicos/legacy sin coerciones ni duplicados.
- [x] Búsqueda valida `type` (`wengine|disc|agent`) y `specialty`; se mantiene el límite de 8 resultados.
- [x] Reorden valida `orderedIds` como lista de strings únicos y exige la permutación exacta de las builds del usuario.
- [x] Errores uniformes JSON: `401 unauthorized`, `400` con código específico, `404 not_found`, `409 duplicate`; el borrado correcto conserva `204`.

#### H3 — Catálogos, pickers e iconos — completado 2026-09-04

- [x] Catálogos validados: 7 agentes, 95 W-Engines y 39 Disc Sets, sin IDs/nombres duplicados y con especialidades conocidas.
- [x] Lookups canónicos normalizan espacios y soportan agente por ID o nombre; el nombre del personaje continúa siendo texto libre, sin forzar un picker nuevo.
- [x] El picker conserva selección y búsqueda actuales, pero su limpieza reinicia valor, búsqueda, especialidad, resultados y mensajes; los errores de sesión/red quedan separados de “Sin resultados”.
- [x] El menú limita su altura a un mínimo seguro al hacer flip en ventanas pequeñas.
- [x] El proxy de iconos normaliza el ID canónico antes de leer/escribir R2; faltantes o fallas del CDN mantienen el placeholder SVG.

#### H4 — Estado runtime y reordenamiento — completado 2026-09-04

- [x] El estado vivo de cards sincroniza altas, edición, borrado y contador; las altas respetan la posición asignada por el store y las ediciones reemplazan la card correcta por `data-zzz-id`.
- [x] Búsqueda, estado vacío y estado “sin coincidencias” se recalculan después de cada mutación; el contador siempre refleja las cards actuales.
- [x] El fallback de portada es común para SSR y runtime, con placeholder de iniciales cuando falla una URL.
- [x] Reordenamiento desktop y móvil conserva la permutación completa, deshabilita drag mientras hay búsqueda y restaura el orden anterior si la API falla.
- [x] El gesto móvil cancela el long-press cuando el usuario empieza a desplazarse; el orden usa el mismo flujo de persistencia en ambos dispositivos.

#### H5 — Documentación y verificación — completado 2026-09-04

- [x] Documentación actualizada en `docs/sub-apps/zzz.md`, `docs/sessions/STATE.md` y `docs/decisions.md`; no se crearon migraciones ni se tocaron `Mavis_*`.
- [x] Catálogos verificados: 7 agentes, 95 W-Engines y 39 Disc Sets; sin IDs/nombres duplicados y con especialidades conocidas.
- [x] `npx tsc --noEmit`: cero errores dentro de `src/pages/zzz/**` y `src/lib/zzz/**`; queda únicamente el error baseline preexistente de `src/pages/games/api/add.ts(62,17)`.
- [x] `astro build`: correcto (`ASTRO_BUILD_EXIT=0`).
- [x] Smoke desplegado sin sesión: `/zzz` exige login y conserva `next=/zzz`; `GET /zzz/api/search?...` responde `401` sin cookie y no expone datos.
- [x] Publicada la versión `508e1aa` en `main` y repetido el smoke de contrato: el Worker devuelve `401`, `Content-Type: application/json` y `{error: "unauthorized"}` sin cookie.
- [x] Smoke autenticado E2E: búsqueda y picker por especialidad, alta con sets/stats, duplicado, búsqueda sin coincidencias y persistencia tras recarga. El drag fue validado manualmente en Edge y los datos temporales se eliminaron manualmente al cierre.

## Cierre global

- Alinear todos los documentos con el estado real.
- Confirmar conteo de apps, rutas, migraciones y secrets.
- Decidir qué hacer con archivos históricos y restos obsoletos.
- Ejecutar build final y pruebas de rutas/API.

## Estado del plan

- [x] Plan creado.
- [x] Fase 0: estructuración del proyecto.
- [x] Hub revisado inicialmente.
- [x] Correcciones del hub autorizadas.
- [x] D2 revisado y corregido.
- [x] Umamusume revisado y corregido.
- [x] Suscripciones revisado y corregido.
- [x] GameTracker H1-H7 revisado y corregido.
- [x] MediaTracker revisado y corregido.
- [x] MangaTracker revisado y corregido (H1 y H2 completados).
- [x] BookTracker revisado y corregido (H1 y H2 completados).
- [x] AnimeTracker revisado y corregido (H1 y H2 completados).
- [x] ZZZ revisado y corregido (H1-H5 completados).
- [x] Consistencia global cerrada (las mejoras futuras fuera de la auditoría permanecen en `STATE.md`).
