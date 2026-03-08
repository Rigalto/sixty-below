# TECHNICAL REFERENCE — Sixty-Below

> Ce document décrit le *comment* : architecture du kernel, budgets, algorithmes, API publique des modules.
> Pour la vision, les mécaniques et le gameplay → voir `DESIGN.md`.
> Ce document est la référence fournie à l'IA pour qu'elle utilise correctement les fonctions existantes
> et respecte les contraintes de performance.

---

## 0. Contraintes de Performance (Critiques — Budget 16 ms)

* **Zéro allocation mémoire (GC) dans les boucles `update` et `render`.**
* Opérations bitwise et TypedArrays en priorité.
* Interdit dans les hot paths : `map`, `filter`, `forEach` → utiliser `for` ou `for…of`.
* Interdit : chaînes de caractères comme clés dans les boucles critiques.
* Tout listener EventBus dépassant **0,1 ms** doit déléguer au `MicroTasker`.

---

## 1. Kernel

Le Kernel est l'ensemble des modules sans dépendance métier. Il peut être testé en isolation totale.
**Règle :** aucun module métier (Layer 4+) ne doit importer depuis le kernel en sens inverse.

### 1.1 Couches du Kernel

```
Layer 0 — constant.mjs    Zéro dépendance. Chargé par tous les modules.
Layer 1 — utils.mjs       Dépend de Layer 0 uniquement.
           database.mjs   Dépend de Layer 0 uniquement.
Layer 2 — core.mjs        Dépend de Layer 0 + Layer 1.
```

---

## 2. `constant.mjs` (Layer 0)

Aucune dépendance externe autorisée.

### Exports

| Constante | Type | Valeur | Description |
|---|---|---|---|
| `FPS` | number | 60 | Fréquence cible |
| `FRAME_DURATION` | number | ~16,66 ms | Durée d'une frame |
| `TIME_BUDGET` | object | — | Budgets par phase (voir ci-dessous) |
| `STATE` | enum | 0–3 | États de la state machine |
| `OVERLAYS` | object | — | Définition des calques (state + zIndex) |
| `UI_LAYOUT` | object | — | Z-index des widgets HUD |
| `WORLD_WIDTH` | number | 1024 | Largeur monde en tuiles |
| `WORLD_HEIGHT` | number | 512 | Hauteur monde en tuiles |
| `CANVAS_WIDTH` | number | 1024 | Largeur canvas en px |
| `CANVAS_HEIGHT` | number | 768 | Hauteur canvas en px |
| `SEA_LEVEL` | number | 56 | Niveau de la mer en tuiles |
| `WORLD_WIDTH_SHIFT` | number | 11 | `2^11 = 1024` — shift pour index ligne |
| `CHUNK_SHIFT` | number | 4 | `2^4 = 16` — shift pour coordonnées chunk |
| `CHUNK_MASK` | number | `0b1111` | Masque position locale dans un chunk |
| `NODES` | object | — | Définitions des tuiles par nom |
| `NODES_LOOKUP` | Array | — | Lookup par code numérique |
| `TILE_TYPE` | enum | — | Types de tuiles |
| `TILE_FLAG` | bitmask | — | Flags (SOLID, LIQUID…) |
| `MICROTASK` | object | — | Config priorité/capacité des microtâches |
| `DB_CONFIG` | object | — | Config IndexedDB (NAME, VERSION, DEBUG) |

### Budgets Temps [`TIME_BUDGET`]

| Phase | Budget | Contenu |
|---|---|---|
| `UPDATE` | 3 ms | Physique, déplacement joueur/faune, TimeManager |
| `RENDER` | 4 ms | Dessin tuiles visibles + entités (`#game-layer`) |
| `MICROTASK` | 5 ms | Pathfinding, génération, updates UI secondaires |
| `DOM` | 4 ms | Browser overhead (GC, Event Loop) |

*Total moteur : 12 ms. Les 4 ms DOM sont gérées par le navigateur.*

### Patterns d'Usage — `NODES` / `NODES_LOOKUP`

```javascript
// 1. Écriture dans la grille (TypedArray) → code numérique
import { NODES } from './constant.mjs'
const tileCode = NODES.CLAY.code
chunk.data[index] = tileCode

// 2. Manipulation abstraite (Inventaire, UI) → objet complet par nom
const tileDesc = NODES.CLAY

// 3. Lecture dans une boucle critique (Hot Path) → lookup par code
import { NODES_LOOKUP, TILE_FLAG } from './constant.mjs'
const tileDesc = NODES_LOOKUP[tileCode]
if (tileDesc.flags & TILE_FLAG.SOLID) { … }
```

---

## 3. `utils.mjs` (Layer 1)

### Class `EventBus` (Singleton : `eventBus`)

| Méthode | Signature | Description |
|---|---|---|
| `on` | `(event: string, cb: function): void` | Abonnement |
| `off` | `(event: string, cb: function): void` | Désabonnement |
| `emit` | `(event: string, data: any): void` | Publication |

**Règle :** appel direct des callbacks (pas de queue). Si le listener dépasse 0,1 ms → déléguer au `MicroTasker`.

---

### Class `MicroTasker` (Singleton : `microTasker`)

Exécute des tâches fractionnées dans le temps résiduel de la frame.

| Méthode/Getter | Signature | Description |
|---|---|---|
| `init` | `(): void` | Vide la file et les stats |
| `initDebug` | `(mapping: object): void` | — |
| `enqueue` | `(fn, priority, capacityUnits, ...args): void` | Enfile une tâche répétable |
| `enqueueOnce` | `(fn, priority, capacityUnits, ...args): void` | Enfile une tâche unique |
| `clear` | `(): void` | Vide la file |
| `update` | `(budgetMs: number): void` | Appelé **uniquement** par `GameCore` |
| `queueSize` | `number` (getter) | Taille de la file |
| `resetStats` | `(): void` | — |
| `debugStats` | `(): string` | — |

**Pattern d'usage obligatoire :**
```javascript
import { MICROTASK } from './constant.mjs'
import { microTasker } from './utils.mjs'

// 1. Config depuis les constantes (obligatoire)
const { priority, capacity } = MICROTASK.SYSTEM_ACTION_NAME

// 2. Enregistrement — les fonctions anonymes sont interdites
//    this.myMethod doit être bindée à this au préalable
microTasker.enqueue(this.myMethod, priority, capacity, arg1, arg2)
```

*`capacity` : 1 unité = 0,25 ms de budget alloué.*

---

### Class `TaskScheduler` (Singleton : `taskScheduler`)

Gère les tâches longues inter-frames (ex : sauvegarde auto toutes les 2 s, craft long).
Tableau trié par timestamp d'exécution, recherche dichotomique, suppression lazy (flag `deleted`).

| Méthode | Signature | Description |
|---|---|---|
| `init` | `(time: number): void` | Vide la file, initialise le temps de référence |
| `enqueue` | `(id, delayMs, fn, priority, capacity): void` | Planifie une tâche |
| `update` | `(currentTime: number): void` | Appelé **uniquement** par `GameCore` |

---

### Class `TimeManager` (Singleton : `timeManager`)

| Méthode | Signature | Description |
|---|---|---|
| `init` | `(timestamp, weather, nextWeather): void` | Initialise depuis le gamestate |
| `update` | `(dt: number): void` | Avance le temps monde |

Émet `time/sky-color-changed` quand la couleur du ciel doit changer.

---

### `seededRNG`

Générateur pseudo-aléatoire déterministe. Utilisé pour la génération procédurale reproductible.

| Méthode | Description |
|---|---|
| `randomPerlinScaled(x, seed, amplitude, frequency)` | Bruit de Perlin mis à l'échelle |

---

## 4. `database.mjs` (Layer 1)

Wrapper IndexedDB bas niveau. **Aucune connaissance du domaine métier.**
Proxy universel : toutes les opérations d'une session transitent par cette classe.

### Class `DataBase` (Singleton : `database`)

| Méthode | Signature | Description |
|---|---|---|
| `init` | `(): Promise<void>` | Ouverture DB + demande de persistance. Appelé par `GameCore.boot()`. |
| `setGameState` | `(key, value, tx?): Promise` | Écrit un K/V dans `gamestate` |
| `getGameStateValue` | `(key): Promise<any>` | Lit une valeur (déconseillé en runtime) |
| `getAllGameState` | `(): Promise<object>` | Lit tout le gamestate → `{key: value, …}` |
| `batchSetGameState` | `(updates: Array<{key,value}>): Promise` | Écriture multiple en une transaction |
| `addOrUpdateRecord` | `(storeName, record, tx?): Promise` | Upsert générique |
| `getRecordByKey` | `(storeName, key): Promise` | Lecture par clé primaire |
| `readAllFromObjectStore` | `(storeName): Promise<Array>` | Lecture complète d'un store |
| `addMultipleRecords` | `(storeName, items): Promise` | Insertion en masse |
| `clearObjectStore` | `(storeName): Promise` | Vide un store |
| `clearAllObjectStores` | `(): Promise` | Reset complet (nouveau monde) |
| `openTransaction` | `(storeName, mode): IDBTransaction` | Transaction manuelle |
| `batchUpdate` | `(operations): Promise` | Lot d'opérations mixtes en une transaction |
| `backupDatabase` | `(): Promise` | Export JSON (debug) |
| `restoreDatabase` | `(file): Promise` | Import JSON (debug) |

---

## 5. `core.mjs` (Layer 2)

### Class `GameCore` (Singleton : `gameCore`)

Point d'entrée unique du moteur.

| Méthode | Signature | Description |
|---|---|---|
| `boot` | `(): Promise<void>` | Phase technique one-time : assets, DB, hydratation, DOM |
| `startSession` | `(): Promise<void>` | Lance une partie (nouveau monde ou chargement) |
| `consumeDebugTrigger` | `(): boolean` | Lecture unique du flag debug (touche `²`) |

**Cycle de `boot()` :**
1. `loadAssets()` (bloquant)
2. `database.init()`
3. Hydratation des données statiques (nodes, items)
4. `mouseManager.init()`

**Cycle de `startSession()` :**
1. `database.getAllGameState()` → chargement en une requête
2. Injection dans chaque Manager : `timeManager.init(…)`, `playerManager.init(…)`…
3. Chargement des chunks
4. Démarrage de la game loop

---

### Class `InputManager` / `KeyboardManager` (dans `core.mjs`)

`KeyboardManager` est l'**autorité de l'état du jeu** via une pile d'overlays (`#overlayStack`).

**Signals d'input :**
* `directions` : bitmask lu en polling à chaque frame (mouvement).
* `EventBus` : actions one-shot (overlay, slot, action…).

**Routing hiérarchique :** Combat > Creation > Aide > Craft > Inventory > Exploration.

**Ouverture/Fermeture d'overlay :**
* Un overlay ne peut s'ouvrir que si son `zIndex` est ≥ celui du sommet de la pile.
* Toggle : si l'overlay est déjà au sommet → fermeture.

---

## 6. `assets.mjs` (Layer 3)

| Export | Signature | Description |
|---|---|---|
| `loadAssets` | `(): Promise<void>` | Charge toutes les images/sons |
| `resolveAssetData` | `(codeStr): {imgId, sx, sy, sw, sh, isAutoTile}` | Résout une string image en UV pré-calculées |
| `IMAGE_FILES` | `Array<string>` | Liste des fichiers image |

**Zero-Cost Runtime :** les coordonnées de texture sont calculées **une seule fois** au boot via `resolveAssetData`. Le renderer accède à des entiers, jamais à des strings ni des calculs de grille pendant la frame.

---

## 7. `world.mjs` (Layer 4)

### Class `ChunkManager` (Singleton : `chunkManager`)

Maître unique de la donnée monde. Le renderer et la persistence **ne font que lire/consommer**.

| Méthode | Signature | Description |
|---|---|---|
| `init` | `(savedChunks: Array): void` | Hydrate le buffer depuis la DB. Lève une erreur si count ≠ 2048. |
| `getTile` | `(x, y): number` | Hot path. Pas de bounds checking (Ghost Cells). |
| `setTile` | `(x, y, code): void` | Écriture avec dirty flags (render + save). |
| `setGenTile` | `(x, y, code): void` | Écriture rapide sans dirty flags — **génération uniquement**. |
| `getChunkData` | `(chunkIndex): Uint8Array` | Retourne une copie des 256 octets du chunk. |
| `getChunkSaveData` | `(chunkIndex): {key, index, chunk}` | DTO pour la persistence. |
| `consumeRenderDirtyChunks` | `(): Set<number> \| null` | Clone + vide la liste render dirty. Appelé par le Renderer. |
| `consumeSaveDirty` | `(): Set<number> \| null` | Clone + vide la liste save dirty. Appelé par SaveManager. |
| `processWorldToChunks` | `(): Array<{key, chunk}>` | Conversion complète monde → chunks. Fin de génération uniquement. |
| `getRawData` | `(): Uint8Array` | Accès direct au buffer (init/génération). |

**Adressage :**
```javascript
const index = (y << 10) | x          // Index mondial → tuile
const chunkKey = (cy << 6) | cx      // Index chunk (64 chunks de large)
const cx = chunkIndex & 0x3F         // Décodage X chunk
const cy = chunkIndex >> 6           // Décodage Y chunk
```

---

## 8. `render.mjs` (Layer 4)

### Class `Camera` (Singleton : `camera`)

Responsable uniquement des mathématiques de projection et du culling.

| Méthode/Propriété | Description |
|---|---|
| `worldToCanvas(wx, wy)` | Conversion pixel monde → pixel canvas |
| `canvasToWorld(cx, cy)` | Conversion pixel canvas → pixel monde |
| `displayChunks` | `Array` — chunks visibles (cible du render) |
| `preloadChunks` | `Set` — chunks en bordure (cible du cache) |
| `unpurgeableChunks` | `Set` — chunks à garder en RAM pendant la purge |
| `setZoom` | Écoute `render/set-zoom` (EventBus). Zoom 100%–200%. |
| `logicalWidth` / `logicalHeight` | Dimensions logiques = `VIEWPORT / zoom` |

---

### Class `WorldRenderer` (Singleton : `worldRenderer`)

Ne stocke aucune donnée de jeu. Lit exclusivement `ChunkManager`.

* **Cache :** Pool d'`OffscreenCanvas` par chunk visible.
* **Purge :** Suppression des images de chunks trop éloignés (~12 s).
* **Budget Render :** Applique décalage + zoom, affiche les chunks visibles.
* **Budget MicroTask :** Génération des images de chunk (micro-tâches).

---

### Class `SkyRenderer` (Singleton : `skyRenderer`)

Canvas opaque (`alpha: false`). Écoute `time/sky-color-changed` → `fillRect` plein.

| Méthode | Signature | Description |
|---|---|---|
| `updateSkyColor` | `(color: string): void` | Remplit le canvas avec la couleur hex/rgb |

---

### Class `LightRenderer` (Singleton : `lightRenderer`)

#### Algorithme "Surface & Punch" — 4 passes

| Passe | Mode | Action | Résultat |
|---|---|---|---|
| 1 — Reset | `source-over` | `fillRect` noir total | Monde invisible |
| 2 — Découpe Ciel | `destination-out` | Polygone zone aérienne via `surfaceLine` | Zone au-dessus du sol transparente |
| 3 — Punch-holes | `destination-out` | Gradient radial (blanc → transparent) par source lumineuse | Halos de lumière |
| 4 — Coloration | `lighter` | Gradient radial (couleur source → noir transparent) par source | Teinte colorée sur les halos |

**Sources lumineuses :** fournies par `FurnitureManager` (liste des objets visibles).
**`surfaceLine` :** fournie par `world.mjs :: SurfaceLineManager` — pour chaque X du monde, Y de la première tuile solide.

**Optimisation :** 1 polygone vectoriel pour le ciel remplace ~1000 appels de dessin de tuiles.
**No-Draw Condition :** Si caméra entièrement dans le ciel → `clearRect` uniquement, LightRenderer inactif.

---

## 9. `persistence.mjs` (Layer 3)

### Class `SaveManager` (Singleton : `saveManager`)

Orchestrateur de sauvegarde. Connaît les object stores métier.

| Méthode | Signature | Description |
|---|---|---|
| `init` | `(): void` | Planifie la première sauvegarde auto (2 s via `taskScheduler`) |
| `queueStaticUpdate` | `(updates: Array\|Object): void` | Empile des updates (inventaire, player…). Dédoublonnage par ID. |
| `processSave` | `(): void` | Exécuté par `TaskScheduler`. Collecte dirty chunks + updates statiques → `database.batchUpdate`. |

**Flux :**
1. Interroge `chunkManager.consumeSaveDirty()`.
2. Récupère les records des managers (InventoryManager, PlayerManager…) via `pendingStaticUpdates`.
3. Appelle `database.batchUpdate()` en une transaction (cohérence crash).
4. Fire & Forget — les managers n'attendent pas la confirmation.

---

## 10. `assets.mjs` — Auto-Tiling

**Framing :** Bitmasking 4-connectivity calculé à la volée ou au chargement pour les transitions de texture.
**Diffusion :** Les tuiles ont un bord de 2 px partiellement transparent, peint de la couleur dominante des tuiles adjacentes (`NODES.color`).

---

## 11. Règles de Codage

* Vanilla JS ESNext, modules natifs `.mjs`, pas de bundler.
* Google JavaScript Style Guide — **pas de point-virgule**.
* Champs privés natifs (`#variable`).
* `Object.assign()` pour les styles CSS groupés.
* `for` ou `for…of` dans les hot paths. Jamais de `map`/`filter`/`forEach`.
* Singletons exportés en minuscule (`export const chunkManager = new ChunkManager()`).
* Les fonctions passées à `MicroTasker` doivent être des méthodes bindées — pas de lambdas anonymes.
