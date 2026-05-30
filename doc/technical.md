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
**Règle :** aucun module métier (Layer 3+) ne doit importer depuis le kernel en sens inverse.

### 1.1 Couches du Kernel

```
Layer 0 — constant.mjs    Zéro dépendance. Zéro métier. Config technique pure.
Layer 1 — utils.mjs       Dépend de Layer 0 uniquement.
           database.mjs   Dépend de Layer 0 uniquement.
Layer 2 — core.mjs        Dépend de Layer 0 + Layer 1.
```

---

## 2. `constant.mjs` (Layer 0)

Aucune dépendance externe autorisée. Aucune donnée métier.

### Exports

| Constante          | Type    | Valeur    | Description                              |
|--------------------|---------|-----------|------------------------------------------|
| `FPS`              | number  | 60        | Fréquence cible                          |
| `FRAME_DURATION`   | number  | ~16,66 ms | Durée d'une frame                        |
| `TIME_BUDGET`      | object  | —         | Budgets par phase (voir ci-dessous)      |
| `STATE`            | enum    | 0–3       | États de la state machine                |
| `OVERLAYS`         | object  | —         | Définition des calques (state + zIndex)  |
| `UI_LAYOUT`        | object  | —         | Z-index des widgets HUD                  |
| `UI_LAYERS`        | object  | —         | IDs et z-index des canvas                |
| `PALETTE`          | object  | —         | Couleurs de fallback                     |
| `WORLD_WIDTH`      | number  | 1024      | Largeur monde en tuiles                  |
| `WORLD_HEIGHT`     | number  | 512       | Hauteur monde en tuiles                  |
| `CANVAS_WIDTH`     | number  | 1024      | Largeur canvas en px                     |
| `CANVAS_HEIGHT`    | number  | 768       | Hauteur canvas en px                     |
| `SEA_LEVEL`        | number  | 56        | Niveau de la mer en tuiles               |
| `MICROTASK`        | object  | —         | Config priorité/capacité des microtâches |
| `DB_CONFIG`        | object  | —         | Config IndexedDB (NAME, VERSION, DEBUG)  |

### Budgets Temps [`TIME_BUDGET`]

| Phase       | Budget | Contenu                                                       |
|-------------|--------|---------------------------------------------------------------|
| `UPDATE`    | 3 ms   | Physique, déplacement joueur/faune, TimeManager               |
| `RENDER`    | 4 ms   | Dessin tuiles visibles + entités (`#game-layer`)              |
| `MICROTASK` | 5 ms   | Pathfinding, génération, updates UI secondaires               |
| `DOM`       | 4 ms   | Browser overhead (GC, Event Loop)                             |

*Total moteur : 12 ms. Les 4 ms DOM sont gérées par le navigateur.*

---

## 3. `assets/data/data.mjs`

Données métier uniques. **Jamais importé par le kernel (Layer 0–2).**
Importé par `assets.mjs` (Layer 3) et les modules métier (Layer 4+).

Un seul fichier centralise toutes les tables pour éviter les dépendances circulaires
(nodes ↔ items ↔ plants ↔ recipes ↔ mobs).

### Garanties du module

* Le corps du module s'exécute **une seule fois** (cache ESModule natif).
* Chaque objet de chaque table est **unique en mémoire** — pas de duplication.
* Les post-traitements **modifient les tables en place** (pas de copie intermédiaire).
* Un `throw` bloquant au boot si la validation d'intégrité échoue.

### Exports — Enums métier

| Export       | Type    | Description             |
|--------------|---------|-------------------------|
| `BIOME_TYPE` | enum | Types de biomes (SEA, FOREST, DESERT, JUNGLE) |
| `NODE_TYPE`  | bitmask | Types de tuiles         |
| `ITEM_TYPE`  | bitmask | Types d'items           |
| `PLANT_TYPE` | bitmask | Types de plantes        |

### Exports — Tables

| Export         | Type   | Description                                                        |
|----------------|--------|--------------------------------------------------------------------|
| `NODES`        | object | Index par nom symbolique. `NODES.CLAY` → objet node complet.       |
| `NODES_LOOKUP` | Array  | Lookup par code numérique (hot path). `NODES_LOOKUP[14]` → node.   |
| `ITEMS`        | object | Index par id string. `ITEMS.bkston` → objet item complet.          |
| `PLANTS`       | object | Index par id string.                                               |
| `RECIPES`      | object | Pas d'index.                                                       |

Note : les 'furnitures' sont des items possédant le type 'ITEM_TYPE.FURNITURE'.
Note : les 'Crafting Stations' sont des 'furnitures' possédant le stype 'station'.

### Conventions d'accès

```javascript
// NODES
NODES.CLAY              // → objet node complet
NODES.CLAY.code         // → 14  (numérique, usage TypedArray)
NODES_LOOKUP[14]        // → objet node complet  (hot path render/physics)

// ITEMS — la clé string est injectée comme propriété .code au boot
ITEMS.bkston            // → objet item complet
ITEMS.bkston.code       // → 'bkston'

// Références croisées (résolues au boot — strings remplacées par objets)
NODES.CLAY.mining[0].item       // → ITEMS.bkclay   (objet direct)
ITEMS.bkston.placesNode         // → NODES.STONE    (objet direct)
PLANTS.oak.growsOn[0]           // → NODES.DIRT     (objet direct)
PLANTS.oak.drops[0].item        // → ITEMS.oaklog   (objet direct)
RECIPES.wooden_plank.result.item // → ITEMS.plank   (objet direct)
```

### Post-traitements (top-level, ordre d'exécution)

1. Injection de `code` dans chaque item (`ITEMS.worm.code === 'worm'`)
2. Construction de `NODES_LOOKUP` par code numérique
3. Résolution `NODES.mining[].item` : string → objet item - TODO
7. Résolution `RECIPES.ingredients[].item` et `result.item` : string → objet item
8. Génération de `hoverTitle string` — titre de survol : name, tier en étoiles, tooltip, type. Utilisé par <inventory-slot>, la grille de craft et la hotbar. Le prefix de slot est préposé par l'appelant si nécessaire.
9. **Validation d'intégrité** — `throw` bloquant si KO :
   - Codes `NODES` uniques
   - Aucune référence croisée non résolue (string résiduelle = erreur)

### Hydratation des images

**Absente de `data.mjs`** — dépend de `loadAssets()`.
Effectuée par `core.mjs :: #hydrateNodes()`, `#hydrateItems()` et `hydrateTreeImages()` après `loadAssets()`.
Itère sur `NODES_LOOKUP`, `ITEMS` et `TREE_IMAGES`, remplace les strings `image`, `placed`, etc.
par des objets `{imageIndex, x, y, w, h}` directement utilisables pour le rendu.

#### `hydrateHelp` — pipeline de résolution
| Fonction | Syntaxe traitée |
| :--- | :--- | :--- |
| `resolveNodeLinks(entry, NODES)` | `[[node:code]]`, `[[node:code\|texte]]` |
| `resolveItemLinks(entry, ITEMS)` | `[[item:code]]`, `[[item:code\|texte]]` |
| `resolveMonsterLinks(entry, MONSTERS)` | `[[monster:code]]`, `[[monster:code\|texte]]` |
| `resolveDynamic(entry, NODES, ITEMS, MONSTERS)` | `{{node:...}}`, `{{item:...}}`, `{{monster:...}}` |
| `resolveRecipes(entry, RECIPES)` | `{{recipe:...}}` |
| `renderMarkdown(entry)` | `**xx**`, `__xx__`, `_xx_`, listes, liens, tables, paragraphes |

---

## 4. `utils.mjs` (Layer 1)

### Class `EventBus` (Singleton : `eventBus`)

| Méthode | Signature | Description |
|---|---|---|
| `on` | `(event: string, cb: function): void` | Abonnement |
| `off` | `(event: string, cb: function): void` | Désabonnement. No-op si cb inconnue. |
| `emit` | `(event: string, data: any): void` | Publication synchrone. Erreurs isolées par callback. |
| `debugStats` | `(): string` | Liste tous les listeners actifs. Console + retour string. |

**Règles critiques :**
- Appel direct et synchrone des callbacks (pas de queue).
- Si le listener dépasse 0,1 ms → déléguer au `MicroTasker`.
- **Interdit : lambdas anonymes** dans `on()` — impossible à `off()` par la suite.
- Toujours binder le callback avant enregistrement : `this.myHandler = this.myHandler.bind(this)`.

**Pattern d'usage standard :**
```javascript
// ✅ Correct — callback nommée et bindée
this.onOpen = this.onOpen.bind(this)
eventBus.on('inventory/open', this.onOpen)
// Plus tard :
eventBus.off('inventory/open', this.onOpen)

// ❌ Incorrect — impossible à désabonner
eventBus.on('inventory/open', () => { this.show() })
```

**Catalogue des événements (exhaustif) :**

Cette section définit les événements officiels. Tout nouvel événement doit être enregistré ici avant implémentation.

#### Time & Environment (`TimeManager`)
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `time/clock` | `{ day, hour, minute }` | Émis chaque minute-jeu. |
| `time/every-5-minutes` | `{ day, hour, minute }` | Émis toutes les 5 minutes-jeu. |
| `time/every-hour` | `{ day, hour, minute, isDay }` | Émis à chaque changement d'heure. |
| `time/timeslot` | `{ tslot, isDay }` | Émis toutes les 3h (changement de slot). |
| `time/daily` | `{ day, weather, nextWeather, moonPhase }` | Émis à minuit (changement de jour). |
| `time/first-loop` | `{ day, hour, minute, tslot, weather, nextWeather, skyColor, moonPhase, isDay }` | Émis une seule fois au démarrage du rendu. |
| `time/sky-color-changed`| `string` (Hex Color) | Émis uniquement si la couleur change. |


#### Core / Loop (`GameCOre`)
*En prévision - incomplet*
| Dir. | Event Name | Payload Structure | Description |
| :---: | :--- | :--- | :--- |
| S | `world/tile-hover`| `object` NODE | Le node est survolé par la souris, pas envoyé si la souris ne change pas de node. |
| S | `debug/frame-sample`| `{updateTime, renderTime, microTime}` | Temps exécution dans la loop pour les 3 budgets. |
| S | `debug/buff-manager` | _(none)_ | Affiche sur la console le contenu de `#values` et `#fns`. |

#### Core / State (`KeyboardManager`)

| Dir. | Event Name | Payload Structure | Description |
| :---: | :--- | :--- | :--- |
| S | `state/changed` | `{ state, oldState }` | Émis lorsque le `KeyboardManager` change l'état global du jeu (Exploration <-> Information/Combat). |
| S | `inventory/keydown` | `string` (e.key) | Forwarding clavier vers l'overlay inventaire quand il est au sommet de la pile. |
| S | `craft/keydown` | `string` (e.key) | Forwarding clavier vers l'overlay craft quand il est au sommet de la pile. |
| S | `help/keydown` | `string` (e.key) | Forwarding clavier vers l'overlay aide quand il est au sommet de la pile. |
| S | `combat/keydown` | `string` (e.key) | Forwarding clavier vers l'overlay combat quand il est au sommet de la pile. |
| S | `map/keydown` | `string` (e.key) | Forwarding clavier vers l'overlay carte quand il est au sommet de la pile. |

#### UI / Interface (Common)
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `overlay/close` | `string` (Overlay ID) | Demande générique de fermeture émise par le bouton 'X' d'un overlay. Traitée par `KeyboardManager`. |
| `overlay/open-request`| `string` (Overlay ID) | Demande générique d'ouverture d'un overlay. Traitée par `KeyboardManager`. |

#### Control Panel / Barre d'actions (`MenuBarWidget`)

| Dir. | Event Name | Payload Structure | Description |
| :---: | :--- | :--- | :--- |
| E | `overlay/open-request`| `string` (Overlay ID) | Demande d'ouverture d'un overlay. Traitée par `KeyboardManager`. |

#### Control Panel / Tuile survolée (`TileHoverWidget`)

| Dir. | Event Name | Payload Structure | Description |
| :---: | :--- | :--- | :--- |
| E | `world/tile-hover`| `object` NODE | Le node est survolé par la souris. |

#### Voile transparent (`ModalBlocker`)

| Dir. | Event Name | Payload Structure | Description |
| :---: | :--- | :--- | :--- |
| E | `state/changed` | `{ state, oldState }` | Émis lorsque le `KeyboardManager` change l'état global du jeu (Exploration <-> Information/Combat). |

#### Player (`PlayerManager`)
*En prévision*
| Event Name | Payload Structure | Description |
| :---: | :--- | :--- | :--- |
| `player/teleport` | `{x: number, y: number}` | Téléporte le joueur aux coordonnées tuiles données. |

#### Rendering (`Camera`, `SkyRenderer`)

| Dir. | Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| E | `render/set-zoom` | `zoomLevel: number` | Modifie le niveau de zoom (1.0-2.0). |
| E | `time/sky-color-changed`| `string` (Hex Color) | Émis uniquement si la couleur change. |
| S | `camera/preload-chunks-changed` | `Set<number>` | Émis à chaque changement de `preloadChunks`. |

### Contrat des systèmes occupants

Tout système qui occupe des tuiles dans le monde expose les méthodes suivantes :

| Méthode | Signature | Description |
| :--- | :--- | :--- |
| `isTileOccupied` | `(index: number) → boolean` | Tuile couverte par une entité du système. |
| `isFloorTile` | `(index: number) → boolean` | Tuile directement sous une entité — interdit au mining, sol pour les plantes... |
| `isSurfaceTop` | `(index: number) → boolean` | Tuile sur laquelle on peut poser un objet (dessus d'un 'furniture' de type `surface`). |

#### Furniture (`FurnitureManager`)

| Dir. | Event | Payload | Description |
| :---: | :--- | :--- | :--- |
| E | `camera/preload-chunks-changed` | `Set<number>` | Émis à chaque changement de `preloadChunks`. |

#### Inventory (`InventoryManager`, `InventoryOverlay`)

| Dir. | Event | Payload | Description |
| :---: | :--- | :--- | :--- |
| E | `inventory/open` | — | Affiche l'overlay, peuple les slots. |
| E | `inventory/close` | — | Cache l'overlay, sauvegarde, émet les buffs. |
| E | `inventory/keydown` | `string` (e.key) | Raccourcis clavier (L, Space, Delete). |
| E | `craft/performed` | `{recipe, runs}` | Rafraîchit bag, hotbar et container si ouvert. |
| S | `inventory/static-buffs` | `Array<string>` | Armor + accessoires + trinkets bag. |
| S | `hotbar/changed` | `Array` | Contenu hotbar mis à jour. Les huit slots sont en payload. |
| S | `item/used` | `string` (itemId) | Clic sur Use. |
| S | `craft/item` | `string` (itemId) | Navigation vers une recette. |
| S | `help/topic` | `string` (topic) | Navigation vers une fiche d'aide. |
| S | `debug/command` | — | Prompt de debug. |
| S | `overlay/open-request` | `string` (overlayId) | Demande d'ouverture d'un overlay. |

#### Hotbar (`HotbarManager`)
*En prévision*
| Dir. | Event Name | Payload Structure | Description |
| :---: | :--- | :--- | :--- |
| E | `hotbar/changed` | `Array` | Contenu hotbar mis à jour. Les huit slots sont en payload. |

#### Craft (`CraftOverlay`)

| Dir. | Event | Payload | Description |
| :---: | :--- | :--- | :--- |
| E | `craft/open` | — | Affiche l'overlay, charge les stations proches, construit la map de disponibilité, applique les filtres. |
| E | `craft/close` | — | Cache l'overlay. |
| E | `craft/keydown` | `string` (e.key) | Forwarding clavier vers l'overlay quand il est au sommet de la pile. |
| E | `craft/item` | `string` (itemId) | Place le nom de l'item dans le filtre textuel et déclenche le filtrage. |
| S | `craft/performed` | `{recipe: object, runs: number}` | Émis après chaque craft réussi. |
| S | `inventory/static-buffs` | `Array<string>` | Armor + accessoires + trinkets du bag après craft. |
| S | `hotbar/changed` | `Array` | Contenu de la hotbar après craft. |
| S | `overlay/open-request` | `string` (overlayId) | Demande d'ouverture de l'overlay d'aide. |
| S | `help/topic` | `string` (topic) | Navigation vers la fiche d'aide de l'item résultat sélectionné. |

#### Help (`HelpOverlay`)

| Dir. | Event Name | Payload Structure | Description |
| :---: | :--- | :--- | :--- |
| E | `help/open`| - | Affichage du panel d'aide. |
| E | `help/close`| - | Disparition du panel d'aide. |
| E | `help/keydown` | `string` (e.key) | Forwarding clavier vers l'overlay aide quand il est au sommet de la pile. |
| E | `help/topic` | `string` (topic title) | Navigue vers une fiche d'aide spécifique. Émis par n'importe quel composant. |

#### Achievements (`AchievementManager`)

| Dir. | Event Name | Payload Structure | Description |
| :---: | :--- | :--- | :--- |
| E | `craft/performed` | `{recipe, runs}` | Incrémentation des compteurs. |

#### Achievements (`AchievementOverlay`)

| Dir. | Event | Payload | Description |
| :---: | :--- | :--- | :--- |
| E | `achievement/open` | — | Affiche l'overlay. |
| E | `achievement/close` | — | Cache l'overlay. |

#### Combat (`CombatOverlay`)
*En prévision*
| Dir. | Event Name | Payload Structure | Description |
| :---: | :--- | :--- | :--- |
| E | `combat/open`| - | Affichage du panel de combat. |
| E | `combat/close`| - | Disparition du panel de combat. |
| E | `combat/keydown` | `string` (e.key) | Forwarding clavier vers l'overlay combat quand il est au sommet de la pile. |

#### Buffs Widget (`BuffManager`)

| Dir. | Event Name | Payload Structure | Description |
| :---: | :--- | :--- | :--- |
| E | `time/first-loop` | `{ day, hour, minute, tslot, weather, nextWeather, skyColor, moonPhase, isDay }` | Émis une seule fois au démarrage du rendu. |
| E | `time/timeslot` | `{ tslot, isDay }` | Émis toutes les 3h (changement de slot). |
| E | `time/daily` | `{ day, weather, nextWeather, moonPhase }` | Émis à minuit (changement de jour). |
| E | `debug/buff-manager` | _(none)_ | Affiche sur la console le contenu de `#values` et `#fns`. |
| S | `buff/display-next-weather` | `boolean` | Active/Désactive la prévision météo. |
| S | `buff/display-coords` | `boolean` | Active/Désactive l'affichage des coordonnées. |
| S | `buff/display-time-precision` | `integer` | précision 0 => 1heure, 1 => 15 minutes, 2 => 5 minutes |
| S | `buff/display-moon-detail` | `boolean` | affiche 4 (false) ou 8 (true) phases lunaires |

#### Debug (`WorldMapDebug`, `RealtimeDebugWidget`, `BuffManager`)

| Dir. | Event Name | Payload Structure | Description |
| :---: | :--- | :--- | :--- |
| E | `map/open`| - | Affichage de la carte au 1/16e. |
| E | `map/close`| - | Disparition de la carte au 1/16e. |
| E | `map/keydown` | `string` (e.key) | Forwarding clavier vers l'overlay carte quand il est au sommet de la pile. |
| E | `debug/frame-sample`| `{updateTime, renderTime, microTime}` | Temps exécution dans la loop pour les 3 budgets. |
| E | `debug/buff-manager` | _(none)_ | Affiche sur la console le contenu de `#values` et `#fns`. |
| E | `debug/command` | — | Déclenche le prompt de debug. Émis par le bouton debug de l'`InventoryOverlay`. |
| S | `player/teleport` | `{x: number, y: number}` | Commande `tp`. Téléporte le joueur aux coordonnées tuiles données. |
| S | any | - | Commande `emit`. L'identifiant de l'eventBus est en paramètre de la commande. |


---

### Class `MicroTasker` (Singleton : `microTasker`)

**Contrat d'exécution :**
Le `MicroTasker` exécute des tâches fractionnées dans le temps résiduel de la frame.
Il maximise le nombre de tâches exécutées dans le temps résiduel
de la frame, sans jamais dépasser le budget total de 16 ms.
La priorité et la capacité sont des **hints de sélection** — ils influencent
le choix des tâches candidates mais n'offrent aucune garantie d'ordre ni
de délai d'exécution maximum.

**API :**

| Méthode/Getter  | Signature                                    | Description                        |
|-----------------|----------------------------------------------|------------------------------------|
| `init`          | `(): void`                                   | Vide la file et les stats          |
| `initDebug`     | `(mapping: object): void`                    | —                                  |
| `enqueue`       | `(fn, priority, capacityUnits, ...args): void` | Enfile une tâche répétable       |
| `enqueueOnce`   | `(fn, priority, capacityUnits, ...args): void` | Enfile une tâche unique          |
| `clear`         | `(): void`                                   | Vide la file                       |
| `update`        | `(budgetMs: number): void`                   | Appelé **uniquement** par `GameCore` |
| `queueSize`     | `number` (getter)                            | Taille de la file                  |
| `resetStats`    | `(): void`                                   | Retire toutes les occurrences de `fn` de la file |
| `debugStats`    | `(): string`                                 | Retourne la file formatée (debug console) |

**Comportements garantis :**
- La tâche en tête de file (priorité la plus haute) est **toujours exécutée**,
  même si le budget résiduel est nul.
- pour les tâches suivantes, le scheduler sélectionne
  la tâche la plus prioritaire **qui rentre dans le budget résiduel** — une tâche
  de priorité plus basse mais de capacité plus faible peut donc passer avant
  une tâche de priorité plus haute dont la capacité dépasse le budget restant.
- `enqueueOnce` déduplique par **référence de fonction** (===).
- `capacityUnits` invalide (null, undefined) est ramené à 20 (budget max).
- `initDebug(mapping)` est optionnel. Si absent, `debugStats()` affiche `'?'`
  pour la capacité de chaque tâche.

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
Les tâches sont triées par timestamp d'exécution (décroissant), ce qui permet un `pop()`
sans décalage mémoire. La suppression est lazy (flag `isRemoved`).

| Méthode/Getter    | Signature                                                              | Description                                          |
|-------------------|------------------------------------------------------------------------|------------------------------------------------------|
| `init`            | `(time: number): void`                                                 | Vide la file, initialise `lastFrameTime`             |
| `clear`           | `(): void`                                                             | Vide la file                                         |
| `queueSize`       | `number` (getter)                                                      | Taille de la file (tâches actives + supprimées)      |
| `enqueue`         | `(id, delayMs, fn, priority, capacity, ...args): number`               | Planifie une tâche dans `delayMs` ms                 |
| `enqueueOnce`     | `(id, delayMs, fn, priority, capacity, ...args): number`               | Planifie uniquement si aucune tâche active avec cet `id` |
| `enqueueAbsolute` | `(id, time, fn, priority, capacity, ...args): number`                  | Planifie à un timestamp absolu                       |
| `enqueueAfter`    | `(idOrRegex, newId, delayMs, fn, priority, capacity, ...args): number` | Planifie `delayMs` ms après la tâche référencée      |
| `requeue`         | `(id, delayMs, fn, priority, capacity, ...args): number`               | Replanifie depuis `lastFrameTime` (annule l'ancienne)|
| `extendTask`      | `(id, delayMs, fn, priority, capacity, ...args): number`               | Prolonge depuis le time existant, ou crée si absente |
| `dequeue`         | `(idOrRegex: string\|RegExp): void`                                    | Marque toutes les correspondances `isRemoved = true` |
| `update`          | `(currentTime: number): void`                                          | Appelé **uniquement** par `GameCore`                 |
| `debugStats`      | `(): string`                                                           | Liste les tâches actives avec leur échéance          |

Toutes les méthodes retournant `number` renvoient le **timestamp absolu** de la tâche créée.

**Contraintes :**
- L'`id` est obligatoirement une `string`.
- `dequeue` et `enqueueAfter` acceptent une `string` ou une `RegExp` pour cibler plusieurs tâches.
- Les fonctions anonymes sont interdites (même règle que `MicroTasker`).

**Contrat d'exécution :**
À chaque frame, `update()` transfère au `MicroTasker` toutes les tâches dont
l'échéance est atteinte. C'est le `MicroTasker` qui les exécute dans son budget résiduel —
aucune garantie d'exécution dans la frame exacte de l'échéance.

**Pattern d'usage obligatoire :**
```javascript
import { MICROTASK } from './constant.mjs'
import { taskScheduler } from './utils.mjs'

const { priority, capacity } = MICROTASK.SYSTEM_ACTION_NAME
this.myMethod = this.myMethod.bind(this)

// Délai relatif à lastFrameTime
taskScheduler.enqueue('my_task_id', 2000, this.myMethod, priority, capacity)

// Prolongation depuis l'échéance existante (ex : boucle de sauvegarde)
taskScheduler.extendTask('my_task_id', 2000, this.myMethod, priority, capacity)
```

---

### Class `TimeManager` (Singleton : `timeManager`)

Gère le temps monde (cycle jour/nuit, météo, lune). Convertit le temps réel de jeu (ms)
en calendrier fictif et émet des événements granulaires à chaque changement.

Deux phases obligatoires : `init()` (sans émission) puis `update()` à chaque frame.

| Méthode/Propriété  | Signature                                              | Description                              |
|--------------------|--------------------------------------------------------|------------------------------------------|
| `init`             | `(timestamp?: number, weather?: number, nextWeather?: number): void` | Initialise depuis le gamestate. N'émet aucun événement. |
| `update`           | `(dt: number): void`                                   | Avance le temps. Appelé **uniquement** par `GameCore`. |
| `timestamp`        | `number`                                               | Temps réel écoulé en ms (source de vérité) |
| `day`              | `number`                                               | Jour courant (0-based)                   |
| `hour`             | `number`                                               | Heure courante (0–23)                    |
| `minute`           | `number`                                               | Minute courante (0–59)                   |
| `timeSlot`         | `number`                                               | Tranche de 3h courante (0–7)             |
| `isDay`            | `boolean`                                              | `true` entre 06:00 et 20:59 inclus       |
| `weather`          | `number`                                               | Météo courante                           |
| `nextWeather`      | `number`                                               | Météo du prochain jour                   |
| `moonPhase`        | `number`                                               | Phase lunaire (0–7) = `day & 7`          |
| `currentSkyColor`  | `string`                                               | Couleur hex du ciel courant              |

**Valeurs par défaut de `init()` :** `timestamp=480000` (Jour 0, 08:00), `weather=0`, `nextWeather=0`.

**Conversions (REAL_MS_PER_GAME_MINUTE = 1000) :**

| Durée jeu  | ms réelles  |
|------------|-------------|
| 1 minute   | 1 000       |
| 1 heure    | 60 000      |
| 3 heures   | 180 000     |
| 1 jour     | 1 440 000   |

**Événements émis par `update()` :**

| Événement               | Payload                                                                 | Condition d'émission                        |
|-------------------------|-------------------------------------------------------------------------|---------------------------------------------|
| `time/clock`            | `{ day, hour, minute }`                                                 | À chaque changement de minute               |
| `time/every-5-minutes`  | `{ day, hour, minute }`                                                 | À chaque tranche de 5 minutes               |
| `time/every-hour`       | `{ day, hour, minute, isDay }`                                          | À chaque changement d'heure                 |
| `time/timeslot`         | `{ tslot, isDay }`                                                      | À chaque tranche de 3h                      |
| `time/daily`            | `{ day, weather, nextWeather, moonPhase }`                              | À chaque changement de jour (minuit)        |
| `time/sky-color-changed`| `string` (hex)                                                          | Uniquement si la couleur change             |
| `time/first-loop`       | `{ day, hour, minute, tslot, weather, nextWeather, skyColor, moonPhase, isDay }` | Une seule fois, à la première frame |

**Contrat d'émission :**
Les événements sont **imbriqués** : `time/daily` n'est émis que si `time/every-hour` l'est aussi,
qui lui-même n'est émis que si `time/every-5-minutes` l'est, etc. Dans le fonctionnement
normal (frame par frame), tous les seuils intermédiaires sont franchis naturellement.
`time/first-loop` est toujours émis lors de la première frame, indépendamment des autres.

**Rotation météo :**
À chaque changement de jour, `weather` prend la valeur de `nextWeather`,
et `nextWeather` est tiré aléatoirement selon les poids définis dans `WEATHER_TYPE`.
Cette rotation n'a **pas lieu** lors du first-loop (pour respecter la sauvegarde).

---

### Class `SeededRNG` (Singleton : `seededRNG`)

Générateur pseudo-aléatoire Mulberry32. Deux modes : **déterministe** (graine fixe,
reproductible) et **aléatoire** (`Math.random()`). Le mode aléatoire est le mode par
défaut à la construction et après `init()` sans argument.

| Méthode | Signature | Retour | Description |
|---|---|---|---|
| `init` | `(seed?: string\|number): void` | — | Sans argument → mode aléatoire. Avec argument → mode déterministe. Réinitialiser avec la même graine rejoue la séquence à l'identique. |
| `randomGet` | `(): number` | `[0, 1[` | Float brut |
| `randomGetBool` | `(): boolean` | `true\|false` | Booléen aléatoire |
| `randomGetMax` | `(max: number): number` | `[0, max]` | Entier |
| `randomGetMinMax` | `(min: number, max: number): number` | `[min, max]` | Entier |
| `randomGetRealMax` | `(max: number): number` | `[0, max[` | Float |
| `randomGetRealMinMax` | `(min: number, max: number): number` | `[min, max[` | Float |
| `randomGetArrayValue` | `(arr: Array): any\|null` | valeur ou `null` | Valeur aléatoire. `null` si tableau vide. |
| `randomGetArrayIndex` | `(arr: Array): number\|null` | index ou `null` | Index aléatoire. `null` si tableau vide. |
| `randomGetArrayWeighted` | `(arr: Array<{weight: number}>): number` | index ou `-1` | Index pondéré par `weight`. `-1` si tableau vide ou tous poids à `0`. |
| `randomInteger` | `(a?, b?): number` | entier | Polyvalent : sans arg → `0\|1`, `(max)` → `[0,max]`, `(min,max)` → `[min,max]`, `(array)` → valeur, `(range)` → `[range.min, range.max]` |
| `randomReal` | `(a?, b?): number` | float | Polyvalent : sans arg → `[0,1[`, `(max)` → `[0,max[`, `(min,max)` → `[min,max[`, `(array)` → valeur |
| `randomGaussian` | `(mean?: number, sd?: number): number` | float | Distribution normale. Défauts : `mean=0, sd=1` |
| `randomLinear` | `(): number` | `[0, 1[` | Distribution linéaire (biais vers 1) |
| `randomPerlinInit` | `(): void` | — | Réinitialise le cache des gradients. Obligatoire avant un nouveau tirage Perlin. |
| `randomPerlinOctave` | `(octaves: Array<{scale, amplitude}>): void` | — | Configure les octaves. Défaut : 4 octaves. |
| `randomPerlin` | `(x: number, y?: number): number` | `[0, 1]` | Bruit de Perlin 1D ou 2D. |
| `randomPerlinScaled` | `(x: number, y: number, period: number, amplitude: number): number` | `[-amplitude, amplitude]` | Perlin mis à l'échelle. |

**Pattern d'usage (génération procédurale) :**
```javascript
// Mode déterministe — génération de monde reproductible
seededRNG.init(worldSeed)
seededRNG.randomPerlinInit()
const height = seededRNG.randomPerlinScaled(x, 0, 100, 50)

// Retour en mode aléatoire après la génération
seededRNG.init()
```

**Règle critique :** `seededRNG` est un singleton à état global. Tout appel hors
génération de monde doit se faire en mode aléatoire (`init()` sans argument).
Ne jamais appeler `seededRNG` en mode déterministe depuis la game loop.

---

### Fonctions utilitaires exportées (`utils.mjs`)

| Fonction | Signature | Retour | Description |
|---|---|---|---|
| `intFract` | `(r: number): {int, fract}` | `{int: number, fract: number}` | Partie entière (`Math.floor`) et fractionnaire. `fract` toujours `>= 0`. |
| `cosineInterpolation` | `(x: number, a: number, b: number): number` | `[a, b]` | Interpolation cosinus. `x=0` → `a`, `x=1` → `b`, monotone sur `[0, 1]`. |
| `shuffleArray(arr): Array` | Mélange un tableau en place (algorithme Fisher-Yates). Utilise `seededRNG` pour la reproductibilité. Retourne le même tableau mélangé. |
| `capitalize` | `(str: string) → string` | Met le premier caractère en majuscule. Ex: `'hotbar'` → `'Hotbar'`. |
| `parseLootCount` | `(countStr: string|number) → CountEntry` | Parse la partie count d'un item de loot. `CountEntry = {countMin, countMax, bonus, flags}`. `flags` 2 bits : bit0=hasRange, bit1=hasBonus. Accepte string ou number. |
| `parseLootEntry` | `(str: string) → LootEntry` | Parse `'itemId:weight:count'` en `{itemId, weight, countMin, countMax, bonus, flags}`. `flags` 3 bits : bit0=hasRange, bit1=hasBonus, bit2=weightIs100. Délègue à `parseLootCount`. À appeler une seule fois au chargement. |
| `parseLootBuffs` | `(arr?: string[]) → {buffs: {required: string[], forbidden: string[], modifiers: {name,value}[]}, buffList: string[]}` | Pré-parse les strings buffs en structure runtime. `buffList` = union dédupliquée des noms. Retourne structures vides si `arr` absent. |
| `rollLoot` | `(entry: LootEntry) → number` | Tirage pour les coffres. Zéro branche — dispatche via `ROLL_FN[flags]` (8 fonctions). Retourne 0 si weight non atteint. |
| `rollLootWithBuffs` | `(lootItem, buffValues, yieldBuff?) → number` | Tirage pour les actions (mining, harvesting...). Évalue conditions, cumule modificateurs + yieldBuff, tire un float, applique `intFract`. Zéro allocation, zéro parsing. |

---

## 5. `database.mjs` (Layer 1)

### 5.1. API

Wrapper IndexedDB bas niveau. **Aucune connaissance du domaine métier.**
Proxy universel : toutes les opérations d'une session transitent par cette classe.

### Class `DataBase` (Singleton : `database`)

| Méthode                | Signature                              | Description                                                   |
|------------------------|----------------------------------------|---------------------------------------------------------------|
| `init`                 | `(): Promise<void>`                    | Ouverture DB + demande de persistance. Appelé par `GameCore.boot()`. |
| `setGameState`         | `(key, value, tx?): Promise`           | Écrit un K/V dans `gamestate`                                 |
| `getGameStateValue`    | `(key): Promise<any>`                  | Lit une valeur (déconseillé en runtime)                       |
| `getAllGameState`       | `(): Promise<object>`                  | Lit tout le gamestate → `{key: value, …}`                    |
| `batchSetGameState`    | `(updates: Array<{key,value}>): Promise` | Écriture multiple en une transaction                        |
| `addOrUpdateRecord`    | `(storeName, record, tx?): Promise`    | Upsert générique                                              |
| `getRecordByKey`       | `(storeName, key): Promise`            | Lecture par clé primaire                                      |
| `readAllFromObjectStore` | `(storeName): Promise<Array>`        | Lecture complète d'un store                                   |
| `addMultipleRecords`   | `(storeName, items): Promise`          | Insertion en masse                                            |
| `clearObjectStore`     | `(storeName): Promise`                 | Vide un store |
| `clearAllObjectStores` | `(): Promise`                          | Reset complet (nouveau monde) |
| `openTransaction`      | `(storeName, mode): IDBTransaction`    | Transaction manuelle |
| `batchUpdate`          | `(operations): Promise`                | Lot d'opérations mixtes en une transaction |
| `backupDatabase`       | `(): Promise`                          | Export JSON (debug) |
| `restoreDatabase`      | `(file): Promise`                      | Import JSON (debug) |
| `putAchievement` | `(record: {code: string, count: number}) → Promise<object>` | `put()` inconditionnel sur le store `achievements`. `code` est le keyPath — obligatoire. |

---

### 5.2. Structure de la base de données IndexedDB

Configuration dans `constant.mjs` → `DB_CONFIG` : `NAME`, `VERSION`, `DEBUG`, `STORES`.

| ObjectStore | keyPath | autoIncrement | Contenu |
|---|---|---|---|
| `gamestate` | `key` | non | État global du jeu (seed, position joueur...) |
| `world_chunks` | `key` | oui | Chunks du monde (tuiles) |
| `inventory` | `key` | oui | Hotbar, Bag, Armors, Accessories, Chests |
| `buff` | `key` | oui | Buffs/Debuffs |
| `plant` | `key` | oui | Trees, Herbs, Mushrooms, Flowers, Corals |
| `monster` | `key` | oui | Enemies, Critters, Bosses |
| `furniture` | `key` | oui | Furniture (Housing), Crafting Station |
| `liquid` | `key` | oui | Liquid bodies générés : `{index, nodeCode}` — `index` = index monde d'une tuile du body, `nodeCode` = code du liquide (HONEY, WATER, SAP...) |
| `achievements` | `code` | non | Compteurs de succès : `{code, count}` |

**Règles :**
- `updateObjectStore()` synchronise automatiquement les stores à chaque montée de version — ajouter un store = l'ajouter à `DB_CONFIG.STORES` et incrémenter `VERSION`.
- `clearAllObjectStores()` vide tous les stores lors de la création d'un nouveau monde.
- Les stores avec `autoIncrement` laissent IndexedDB attribuer la clé — ne pas fournir `key` à l'insertion.
- `gamestate` est un store spécial à accès contrôlé — ne jamais y accéder directement. Utiliser exclusivement les méthodes dédiées : `setGameState()`, `getGameStateValue()`, `getAllGameState()`, `batchSetGameState()`.

---

### 5.2.1 ObjectStore 'plant'

Cet ObjectStore contient toutes les informations relatives à la croissance des plantes.
Les enregistrements sont de natures très différentes, nature déterminée par l'attribut '???' :
* `kind` NATURAL : liste des tuiles NATURAL
  * `index` : position des tuiles de `type` NATURAL
  * `type` : `PLANT_TYPE.NONE`
  * `naturalCode` : type de la tuile : NODES.GRASSFOREST.code, NODES.GRASSJUNGLE.code, NODES.GRASSMUSHROOM.code, NODES.GRASSFERN.code, NODES.GRASSMOSS.code
* `kind` TREE : liste des arbres présents dans le monde
  * `id` : identifiant unique de l'abre
  * `index` : position de l'abre (coint haut gauche du rectangle englobant)
  * `type` : type de l'arbre : PLANT_TYPE.OAK, PLANT_TYPE.MAHOGANY, PLANT_TYPE.GIANTMUSHROOM, PLANT_TYPE.COCONUT
  * `w` et `h` : taille maximale de l'arbre
  * `x`: coordonnée pour le clipping de l'image
  * `yTop`: coordonnée pour le clipping de l'image (affichée si `x,yTop` est dans le rectangle visible)
  * `yBottom`: coordonnée pour le clipping de l'image (ou si `x,yBottom` est dans le rectangle visible)
  * `soilIndex` : position de la tuile solide sous la gauche de l'arbre (`index + h * 1024`)
  * `size` : croissance actuelle (0 à 4)
  * `images` : tableau de 7 images (selon `size`, les images suivantes sont empilées : `0 => [1, 0]`, `1 => [1, 2, 0]`, `2 => [1, 2, 3, 0]`, `3 => [1, 2, 3, 4, 0]`, `4 => [1, 2, 3, 4, 5, 6]`). Chaque image est définie par les attributs `x` et `y` (position dans le monde où l'image doit être affichée) ainsi que `tree`, `row` et `col` (détermine l'image dans TREE_IMAGES).
  * `grass` : type de tuile sur lequel l'arbre pousse (NODES.GRASSFOREST.code, NODES.GRASSJUNGLE.code, NODES.GRASSMUSHROOM.code, NODES.SAND.code)
  * `growthTimestamp` : heure (timestamp) de prochaine croissance (`null` si `size` === 0)
  * `shakedTimestamp` : heure (timestamp) à partir de laquelle l'arbre peut être secoué de nouveau
* `kind` MUSHROOM : liste des spots de champignons présents dans le monde
  * `id` : identifiant unique du spot de champignon
  * `index` : position du spot de champignon (coin haut gauche de l'image)
  * `type` : `PLANT_TYPE.NONE`
  * `itemId` : item correspondant au champignon qui pousse sur le spot : `ITEMS.bolete.code` et `ITEMS.pinkMycenia.code`
  * `w` et `h` : taille du champignon
  * `x` et `y` : coordonnées pour le clipping de l'image (affichée si `x,y` est dans le rectangle visible)
  * `soilIndex` : position de la tuile solide sous la gauche du champignon (`index + h * 1024`)
  * `present` : booléen indiquant si un champignon est présent (`true`) ou non sur le spot de champignon
  * _Visibilité pilotée globalement par l'heure in-game — les champignons d'un même type apparaissent et disparaissent simultanément._
* `kind` HERB : liste des herbes présentes dans le monde (Blinkroot, Coral, Parsnip, Sunflower, Fireblossom, Oleander, Skorn, Ambermirage)
  * `id` : identifiant unique de l'herbe
  * `index` : position de l'herbe (coin haut gauche de l'image)
  * `type` : type d'herbe (PLANT_TYPE.XXX)
  * `ìtemId` : identifiant de l'item correspondant à l'herbe
  * `w` et `h` : taille de l'herbe
  * `x` et `y` : coordonnées pour le clipping de l'image (affichée si `x,y` est dans le rectangle visible)
  * `soilIndex` : position de la tuile solide sous la gauche de l'herbe (`index + h * 1024`)
  * `bloom` : l'herbe est mature et peut être récoltée (`true`)
  * `bloomTimestamp` : heure (timestamp) de prochaine récolte possible
* `kind` SPREAD : liste des tuiles auto-propagées dans le monde
  * `id` : identifiant unique de la graine
  * `type` : `PLANT_TYPE.NONE`
  * `index` : position de la graine (tuile où elle se trouve)
  * `topsoilCode` : type de tuile ensemencée (`NODES.CLAY.code`, `NODES.MUD.code`, `NODES.HUMUS.code`)
  * `naturalCode` : type de tuile ensemencée (`NODES.GRASSFOREST.code`, `NODES.GRASSJUNGLE.code`, `NODES.GRASSMUSHROOM.code`)
  * `spreadTimestamp` : timestamp auquel la transformation sera effectuée

Tous les enregistrements possèdent en plus un champ `deleted` permettant de décaler la suppression des enregistrements dans la phase d'initialisation de la sessin de jeu suivante.

---

## 6. `core.mjs` (Layer 2)

### Class `GameCore` (Singleton : `gameCore`)

Point d'entrée unique du moteur.

| Méthode              | Signature          | Description                                          |
|----------------------|--------------------|------------------------------------------------------|
| `boot`               | `(): Promise<void>` | Phase technique one-time : assets, DB, hydratation, DOM |
| `startSession`       | `(): Promise<void>` | Lance une partie (nouveau monde ou chargement)       |
| `consumeDebugTrigger`| `(): boolean`       | Lecture unique du flag debug (touche `²`)            |

**Cycle de `boot()` :**
1. `loadAssets()` (bloquant) — charge images et sons, importe `data.mjs` en parallèle
2. `database.init()`
3. `#hydrateNodes()` — itère `NODES_LOOKUP`, remplace `image`, `waveImage`... (*)
4. `#hydrateItems()` — itère `ITEMS`, remplace `image`, `placed`... (*)
4. `#hydrateTreeImages()` — itère `TREE_IMAGES`, remplace toutes string
4. `##hydrateHelp()` — transforme le markdown des fiches d'aide en HTML
5. `mouseManager.init()`

_(*) Vérification que la fiche d'aide existe_

**Cycle de `startSession()` :**
1. `database.getAllGameState()` → chargement en une requête
2. Injection dans chaque Manager : `timeManager.init(…)`, `playerManager.init(…)`…
3. Chargement des chunks
4. Démarrage de la game loop

---

### Class `KeyboardManager` (dans `core.mjs`)

`KeyboardManager` est l'**autorité de l'état du jeu** via une pile d'overlays (`#overlayStack`).

**Signals d'input :**
* `directions` : bitmask lu en polling à chaque frame (mouvement).
* `EventBus` : actions one-shot (overlay, slot, action…).

**Routing hiérarchique :** Combat > Creation > Aide > Craft > Inventory > Exploration.

**Ouverture/Fermeture d'overlay :**
* Un overlay ne peut s'ouvrir que si son `zIndex` est ≥ celui du sommet de la pile.
* Toggle : si l'overlay est déjà au sommet → fermeture.

---

### Class `MouseManager` (dans `core.mjs`)

`MouseManager` entretient trois informations, qui sont lues dans la boucle principale du jeu :
* `mouse ({x, y})` : position de la souris, en pixels, à l'intérieur du canvas, origine coin haut-gauche du canvas. `x` et `y` sont `null` quand la souris est en dehors du canvas.
* `left (Boolean)` : `true` quand le bouton gauche de la souris est enfoncé (souris dans le canvas).
* `right (Boolean)` : `true` quand le bouton droit de la souris est enfoncé (souris dans le canvas).

---

## 7. `assets.mjs` (Layer 3)

| Export           | Signature                                           | Description                                       |
|------------------|-----------------------------------------------------|---------------------------------------------------|
| `loadAssets`     | `(): Promise<void>`                                 | Charge toutes les images/sons                     |
| `resolveAssetData` | `(codeStr): {imgId, file, sx, sy, sw, sh, isAutoTile}` | Résout une string image en UV pré-calculées       |
| `IMAGE_FILES`    | `Array<string>`                                     | Liste des fichiers image                          |

**Zero-Cost Runtime :** les coordonnées de texture sont calculées **une seule fois** au boot via
`resolveAssetData`. Le renderer accède à des entiers, jamais à des strings ni des calculs de grille
pendant la frame.

**Relation avec `data.mjs` :** `assets.mjs` n'exporte pas les tables de données.
Les tables (`NODES`, `ITEMS`…) sont importées directement depuis `assets/data/data.mjs`
par les modules qui en ont besoin.

---

## 8. Tests Unitaires (`/tests`)

### Règles

- Un fichier de test par classe : `tests/test-[classname].mjs`
- Chaque fichier **exporte uniquement ses suites** via `describe()` — il ne s'exécute pas seul.
- Chaque fichier importe la **classe réelle** depuis `src/` (jamais une copie locale).
- Chaque `describe()` instancie sa **propre instance** de la classe testée — zéro état partagé entre suites.
- Pour enregistrer une nouvelle classe : ajouter une entrée dans le tableau `REGISTRY` de `run.mjs`.

### API du kernel (`tests/kernel.mjs`)

| Export | Signature | Description |
|---|---|---|
| `describe` | `(label: string, fn: function): void` | Déclare une suite de tests |
| `assert` | `(label: string, condition: boolean): void` | Assertion booléenne. Doit être appelé dans un `describe()`. |
| `captureConsole` | `(): void` | Redirige `console.log` et `console.error` vers un buffer interne. |
| `releaseConsole` | `(): string[]` | Restaure la console et retourne les lignes capturées. |
| `_results` | `Array` | Résultats accumulés — lu par `run.mjs`, ne pas utiliser dans les tests. |

### Pattern d'usage standard
```javascript
// tests/test-maclasse.mjs
import { describe, assert, captureConsole, releaseConsole } from './kernel.mjs'
import { MaClasse } from '../src/utils.mjs'

// ─── Suite standard ───────────────────────────────────────────────────────────
describe('MaClasse — méthode()', () => {
  const obj = new MaClasse()          // instance isolée par suite
  // ...
  assert('description du test', condition)
})

// ─── Suite avec capture console ───────────────────────────────────────────────
describe('MaClasse — logs', () => {
  const obj = new MaClasse()

  captureConsole()
  obj.methodQuiLog()
  const lines = releaseConsole()      // toujours dans la même suite, après l'appel

  assert('Le log contient X', lines.some(l => l.includes('X')))
})
```

---

## 9. `world.mjs` (Layer 4)

### Class `ChunkManager` (Singleton : `chunkManager`)

Maître unique de la donnée monde. Le renderer et la persistence **ne font que lire/consommer**.

| Méthode                   | Signature                        | Description                                                        |
|---------------------------|----------------------------------|--------------------------------------------------------------------|
| `init`                    | `(savedChunks: Array): void`     | Hydrate le buffer depuis la DB. Lève une erreur si count ≠ 2048.  |
| `getTile`                 | `(x, y): number`                 | Hot path. Pas de bounds checking (Ghost Cells).                    |
| `setTile`                 | `(x, y, code): void`             | Écriture avec dirty flags (render + save).                         |
| `setGenTile`              | `(x, y, code): void`             | Écriture rapide sans dirty flags — **génération uniquement**.      |
| `getChunkData`            | `(chunkIndex): Uint8Array`       | Retourne une copie des 256 octets du chunk.                        |
| `getChunkSaveData`        | `(chunkIndex): {key, index, chunk}` | DTO pour la persistence.                                        |
| `consumeRenderDirtyChunks`| `(): Set<number> \| null`        | Clone + vide la liste render dirty. Appelé par le Renderer.        |
| `consumeSaveDirty`        | `(): Set<number> \| null`        | Clone + vide la liste save dirty. Appelé par SaveManager.          |
| `processWorldToChunks`    | `(): Array<{key, chunk}>`        | Conversion complète monde → chunks. Fin de génération uniquement.  |
| `getRawData`              | `(): Uint8Array`                 | Accès direct au buffer (init/génération).                          |

**Adressage :**
```javascript
const index = (y << 10) | x          // Index mondial → tuile
const chunkKey = (cy << 6) | cx      // Index chunk (64 chunks de large)
const cx = chunkIndex & 0x3F         // Décodage X chunk
const cy = chunkIndex >> 6           // Décodage Y chunk
```

---

## 10. `generate.mjs` (Layer 4)

### Class `WorldBuffer` (Singleton : `worldBuffer`)

Buffer temporaire actif **uniquement pendant la génération d'un nouveau monde**.
N'existe jamais en mémoire pendant une session de jeu normale.

Le buffer est un `Uint8Array` plat 1024 × 512. La valeur `0` est interdite pour
un node valide — elle signifie "tuile non initialisée" et facilite la détection
d'erreurs de génération dans les tests.

| Méthode/Getter        | Signature                              | Description                                                     |
|-----------------------|----------------------------------------|-----------------------------------------------------------------|
| `init`                | `(): void`                             | Crée le buffer à zéro. Réinitialise s'il existait déjà.         |
| `clear`               | `(): void`                             | Libère le buffer (`world = null`). Appelé par `WorldGenerator` après écriture en DB, ou par les tests après assertions. |
| `world`               | `Uint8Array` (getter)                  | Accès direct au buffer brut — usage réservé aux algorithmes de génération en boucle serrée. |
| `snapshot`            | `(): Uint8Array`                        | Retourne une copie indépendante du buffer. Utilisée par les algorithmes de diffusion (lecture source / écriture destination). |
| `read`                | `(x, y): number`                       | Lecture par coordonnées.                                        |
| `readAt`              | `(index): number`                      | Lecture par index précalculé.                                   |
| `write`               | `(x, y, value): void`                  | Écriture par coordonnées.                                       |
| `writeAt`             | `(index, value): void`                 | Écriture par index précalculé.                                  |
| `processWorldToChunks`| `(): Array<{key: number, chunk: Uint8Array}>` | Convertit le buffer en 2048 chunks de 256 octets pour écriture en DB. |

**Adressage :**
```javascript
const index = (y << 10) | x   // Coordonnées → index (identique à ChunkManager)
```

**Cycle de vie :**
```javascript
// Production
worldBuffer.init()
biomesGenerator.generate()   // utilise write() / writeAt()
// ... autres algorithmes ...
await database.addMultipleRecords('world_chunks', worldBuffer.processWorldToChunks())
worldBuffer.clear()

// Debug / Tests (pas d'écriture DB)
worldBuffer.init()
biomesGenerator.generate()
assert('...', worldBuffer.read(x, y) === expectedValue)
worldBuffer.clear()           // appelant responsable
```

**Pas de bounds checking** — cohérent avec les Ghost Cells de `ChunkManager`.
Un accès hors-borne est un bug d'algorithme détecté par les tests.

---

### Class `ClusterGenerator` (Singleton : `clusterGenerator`)

Calcule des clusters de tuiles de formes organiques (substrat, topsoil, ore, gem, rock…).
Sans effet de bord — n'écrit pas dans `worldBuffer`. Les clusters sont accumulés
puis appliqués en une passe dédiée.

| Méthode | Signature | Description |
|---|---|---|
| `randomWalkCluster` | `(x0, y0, size, code): Array<{x, y, index, code}>` | Cluster 4-connexe par diffusion aléatoire (drunk-walk agrégé). Retourne la liste des tuiles sans modifier le monde. `index = (y << 10) | x`, prêt pour `worldBuffer.writeAt`. Ghost cells exclues (marge de 2 tuiles). |
| `scatterClusters` | `(x0, y0, x1, y1, percent, code, sizeMin?, sizeMax?): Array<{x, y, index, code}>` | Distribue `max(5, round(surface × percent))` clusters `randomWalkCluster` à des positions aléatoires dans le rectangle. `sizeMin` défaut 5, `sizeMax` défaut 8. Sans effet de bord. |
| `applyTiles` | `(tiles: Array<{x, y, index, code}>): void` | Écrit les tuiles dans `worldBuffer` via `writeAt`. Ignore les tuiles hors bornes et protège `FOG`, `DEEPSEA`, `BASALT`, `LAVA`, `SKY`, `VOID` contre l'écrasement. — à appeler avant le creusement. |
| `initZoneRects(biomesDescription, skySurface, surfaceUnder, underCaverns): Array<{biome, x0, x1, ySkySurface, ySurface, yUnder, yCavernsMid, yCaverns, yHell}>` | Initialise `this.zoneRects`. Pré-calcule les rectangles biome × layer (Y moyens aplatis). À appeler une fois dans `generate()` avant tout placement. Renvoie le tableau calculé |
| `getRectAt(x)` | `(x: number): zoneRect` | Retourne le rectangle de zone correspondant à la colonne X en parcourant `this.zoneRects`. Utilisable après apel à `initZoneRects`. |
| `#getClusterSizes(biome, layer, code)` | Lit `sizeMin/sizeMax` depuis `ORE_GEM_SCATTER_MAP[biome][layer]` pour le code donné. Fallback `{6, 12}`. |
| `#placeOneCluster(x0, x1, y0, y1, code, sizeMin, sizeMax)` | Place un unique cluster à position aléatoire dans le rectangle. |
| `#getForeignZones(nativeBiome)` | Retourne les `zoneRects` dont le biome diffère de `nativeBiome`. |
| `addSubstratClusters` | `(): void` | Parcourt `this.zoneRects` et applique les clusters définis dans `CLUSTER_SCATTER_MAP`. Appelle `scatterClusters` + `applyTiles`. Prérequis : `initZoneRects()`. |
| `addOreClusters` | `(biomesDescription, surfaceUnder, underCaverns): void` | Parcourt les zones biome × layer (under / caverns_top / caverns_bottom) et applique les clusters ore/gem/rock définis dans `ORE_GEM_SCATTER_MAP`. Pas de clusters en surface. |
| `addOreIntrusions()` | Place des clusters de minerais dans des layers supérieures à leur habitat normal. SILVER en surface ; GOLD en surface et under ; COBALT en under ; PLATINUM en under et caverns_top. Position X libre sur toute la largeur du monde. Prérequis : `initZoneRects()`. |
| `addGemIntrusions()` | Place des clusters de gemmes et d'obsidian hors de leur biome/layer natif. SAPPHIRE systématique en caverns_top ; TOPAZ/RUBY/EMERALD en biome étranger ; OBSIDIAN dans caverns (hors hell) ; bonus under. Prérequis : `initZoneRects()`. |
| `projectAndFill` | `({cx, cy, code}: {cx: number, cy: number, code: number}): void` | Projette jusqu'à 100 lignes depuis le centre d'une géode. Pose `GEODE_TARGET_CLUSTER_COUNT` clusters (taille 4–8) de `code` sur la première tuile SUBSTRAT rencontrée. Ignore SKY et ETERNAL. Constantes dans `data-gen.mjs`. |
| `#getLinearSizes(y, y0, y1)` | Interpolation linéaire des tailles TOPSOIL en fonction de Y. sizeMin [8→3], sizeMax [14→6]. Référence globale : TOPSOIL_Y_SKY_SURFACE → TOPSOIL_Y_CAVERNS_MID. |
| `scatterTopsoilClusters(x0, y0, x1, y1, percent, code)` | Variante de scatterClusters pour TOPSOIL. Tailles calculées dynamiquement via #getLinearSizes après tirage du Y. count = max(0, round(surface × percent)). |
| `addTopsoilClusters()` | Place les clusters TOPSOIL par biome × layer (surface / under / caverns_top) avant le creusement. Prérequis : initZoneRects(). |

**Algorithme de randomWalkCluster :** frange maintenue en doublon `Set + Array` — déduplication O(1), tirage O(1) par swap-and-pop.

---

### Class `WorldCarver` (Singleton : `worldCarver`)

Génère des tunnels, des cavernes et des mini-biomes. Maintient la liste des zones d'exclusion (`#exclusions`) et des rectangles de zones biome × layer (`#zoneRects`).

---

#### Utilitaires

| Méthode | Description |
|---|---|
| `initZoneRects(zoneRects)` | Initialise `#zoneRects` depuis le résultat de `clusterGenerator.initZoneRects()`. À appeler depuis `generate()` après `clusterGenerator.initZoneRects()`. |
| `initExclusions(): void` | Réinitialise la liste interne des zones d'exclusion (`#exclusions`). À appeler depuis `generate()` avant le premier mini-biome. |
| `addExclusion(rect: {x1, y1, x2, y2}): void` | Ajoute un rectangle à la liste interne d'exclusion. À appeler explicitement après `applyTiles()` pour les mini-biomes uniquement. |
| `isExcluded(x1, y1, x2, y2): boolean` | Vérifie si un rectangle intersecte l'une des zones d'exclusion internes. Retourne `true` dès la première intersection trouvée. |
| `addSeaExclusions(): {leftSeaRect, rightSeaRect}` | Enregistre les rectangles d'exclusion des deux zones de mer aux dimensions maximales (`SEA_MAX_WIDTH + SEA_MAX_JITTER + 2`, `SEA_LEVEL + SEA_MAX_HEIGHT + SEA_MAX_JITTER + 2`). Retourne `{leftSeaRect, rightSeaRect}` pour usage ultérieur. À appeler juste après `tileGuard.init()`. |
| `digNoisyCircle(tiles, cx, cy, radiusMin, radiusMax, code, frequency?, offsetX?): void` | Creuse un trou circulaire bruité (Perlin noise). Pousse les tuiles dans `tiles`. |
| `digNoisyEllipse(tiles, cx, cy, radiusXMin, radiusXMax, radiusYMin, radiusYMax, code, frequency?, offsetX?): void` | Creuse un trou elliptique bruité (Perlin noise). Distance normalisée par les demi-axes. Pousse les tuiles dans `tiles`. |
| `digNoisyRect(tiles, cx, cy, radiusXMin, radiusXMax, radiusYMin, radiusYMax, code, frequency?, offsetX?): void` | Creuse un rectangle bruité (Perlin noise) sur les 4 bords. Distance de Chebyshev normalisée. Pousse les tuiles dans `tiles`. |
| `applyTiles(tiles, excluded?): {x1, y1, x2, y2}` | Écrit les tuiles dans `worldBuffer`. Protège les tuiles `excluded` (défaut : `DEFAULT_EXCLUDED`). Consulte `tileGuard` avant chaque écriture. Retourne le rectangle englobant des tuiles réellement écrites. Passer `ETERNAL_EXCLUDED` pour n'exclure que les ETERNAL. |
| `fillRect(x0, y0, x1, y1, code): void` | Remplace toutes les tuiles d'un rectangle par `code`. Sans protection — zones hors ghost cells et ETERNAL uniquement. |
| `boundingRect(a, b): {x1, y1, x2, y2}` | Retourne le rectangle englobant de deux rectangles. |
| `pathTunnel(x0, y0, radiusMax, maxLength, angle, deltaAngle): Array<{x, y, radiusMin, radiusMax}>` | Calcule le chemin d'un tunnel par accumulation angulaire. `angle` et `deltaAngle` en degrés. Longueur effective ~25% supérieure à `maxLength` (facteur 0.8). Utilitaire pur — ne creuse pas. |
| `carveAlongPath(path, offsetX?, excluded?): void` | Creuse un tunnel le long d'un chemin `pathTunnel`. Accumule tous les cercles en un seul tableau avant `applyTiles`. `excluded` propagé à `applyTiles`. Défaut : `DEFAULT_EXCLUDED`. |

---

#### Tunnels et cavernes généraux

| Méthode | Description |
|---|---|
| `digSmallCaverns(surfaceUnder): void` | Disperse `SMALL_CAVERNS_COUNT` petites cavernes (rayon 3–6) et `MEDIUM_CAVERNS_COUNT` moyennes (rayon 6–12) dans les zones underground et cavernes. Deux passes `applyTiles` séparées. |
| `digSurfaceTunnel(skySurface, lakes): void` | Creuse 20–30 galeries obliques depuis la surface. Évite les lacs (marge `3 × LAKE_RADIUS_X_MAX`). Direction obligatoirement descendante. |
| `digZigzagTunnels(lakes): void` | Creuse 2–3 tunnels zigzag depuis la surface. Espacement minimal `ZIGZAG_MIN_DISTANCE`. Évite les lacs sur le premier tronçon. Au maximum une migration entre tunnels. |
| `digUndergroundTunnels(surfaceUnder, underCaverns): void` | Creuse `UNDERGROUND_TUNNEL_COUNT` tunnels horizontaux avec un ou deux coudes en zone underground. Rayon 8–10, longueur 30–50, déviation 25°. |
| `digCavernsTunnels(underCaverns): void` | Creuse `CAVERN_TUNNEL_COUNT` tunnels dans la zone cavernes. Borne basse : `WORLD_HEIGHT - 32`. Rayon 7–10, longueur 40–60, déviation 50°. |
| `digSmallTunnels(surfaceUnder): void` | Creuse `SMALL_TUNNELS_COUNT` petites galeries sinueuses (rayon 2–4, longueur 60–100, deltaAngle 40°) dans les zones underground et cavernes. |
| `cleanupAfterCarving(): void` | Passe de nettoyage globale post-creusement en 4 passes : (1) propagation SKY colonne par colonne, (2) suppression des tuiles isolées VOID/solide dans SKY/VOID/liquide (13 règles), (3) suppression des colonnes étroites SKY/VOID en surface. |

---

#### Mini-biomes — Liquides

| Méthode | Description |
|---|---|
| `digSurfaceLakes(skySurface)` | Creuse un lac de surface par zone de biome. Double ellipse : corps principal + fosse bruitée. Bords/fond protégés par nodes CREATION. Protection TileGuard sur les deux ellipses. Retourne `Array<{cx, cy, biome, layer, liquidBody}>`. |
| `digUndergroundLakes(surfaceUnder, underCaverns)` | Creuse `UNDERGROUND_LAKE_UNDER_COUNT` lacs en under et `UNDERGROUND_LAKE_CAVERNS_COUNT` en caverns_top. Protection TileGuard demi-ellipse inférieure. Remplissage WATER. Retourne `Array<{cx, cy, biome, layer, liquidBody}>`. |
| `digBlindLakes(underCaverns)` | Creuse `BLIND_LAKE_COUNT` lacs en caverns_bottom. Rayons `BLIND_LAKE_RADIUS_MIN/MAX`. Protection TileGuard complète. Remplissage WATER. Retourne `Array<{cx, cy, biome, layer, liquidBody}>`. |
| `digSapLakes(surfaceUnder, underCaverns)` | Creuse des lacs de sève en under et caverns_top, biome JUNGLE uniquement. Protection TileGuard demi-ellipse inférieure. Remplissage SAP. Retourne `Array<{cx, cy, biome, layer, liquidBody}>`. |
| `digSapPockets(underCaverns)` | Creuse `SAP_POCKET_COUNT` poches de sève en caverns_bottom, biome JUNGLE. Protection TileGuard complète. Remplissage SAP. Retourne `Array<{cx, cy, biome, layer, liquidBody}>`. |
| `digWaterPuddles(surfaceUnder)` | Creuse `WATER_PUDDLE_COUNT` flaques d'eau (hauteur 2–3 tuiles) dans les zones under et cavernes. Utilise `#flowToBottom` + `#tryFillPuddle`. Retourne `Array<{index, nodeCode}>`. |
| `digSapPuddles(surfaceUnder)` | Creuse `SAP_PUDDLE_COUNT` flaques de sève en biome JUNGLE. Même algorithme que `digWaterPuddles`. Retourne `Array<{index, nodeCode}>`. |

---

#### Mini-biomes — Cavernes naturelles

| Méthode | Description |
|---|---|
| `digHives(biomeCounts)` | Creuse des ruches en JUNGLE (caverns_top). 1 monde/2 : intrusion biome étranger. Remplissage HONEY via `fillHive`. Protection TileGuard cercle bruité. Retourne `Array<{cx, cy, radius, liquidBody}>`. `#digOneHive(rect)` : creuse une ruche individuelle. |
| `digCobwebCaves()` | Creuse `COBWEB_CAVE_COUNT_MIN–MAX` cavernes elliptiques tous biomes, caverns_top (80%) ou caverns_bottom (20%) + 1 intrusion under. Peuplement WEB via `webFiller.fillCobwebCave`. `#digOneCobwebCave(y0, y1)` : creuse une caverne individuelle. |
| `digGeodeCaves(code)` | Creuse des géodes en caverns_bottom + 1 intrusion/3 en caverns_top. Retourne la description pour `projectAndFill()`. `#digOneGeodeCave(y0, y1, code)` : creuse une géode individuelle. |
| `digFernCaves()` | Creuse une Fern Cave par zone FOREST en under. Demi-ellipse + rectangle bruité. Tapissage fond via `#fillFernMushroomCaveFloor` (GRASSFERN + HUMUS). Protection TileGuard bas. Retourne `{caves: Array<{cx, cy, radiusX, radiusY}>, plants: Array<{index, system, type}>}`. `#fillFernMushroomCaveFloor(cx, cy, radiusX, surfaceCode, substrateCode, grassType, plants)` : tapisse le fond (Markov 75/25, profondeur 2–3). `plants` [OUT] accumulateur d'enregistrements plant. |
| `digMossCaves()` | Creuse une Moss Cave par zone JUNGLE en under. Demi-ellipse + rectangle bruité. Tapissage parois/sol via `#fillMossCaveWalls` (GRASSMOSS + MUD). Protection TileGuard bas. Retourne `{caves: Array<{cx, cy, radiusX, radiusY}>, plants: Array<{index, system, type}>}`. `#fillMossCaveWalls(cx, cy, radiusX, radiusY, plants)` : GRASSMOSS sur sol et parois latérales, MUD sous le sol. `plants` [OUT] accumulateur d'enregistrements plant. |
| `digMushroomCaves()` | Creuse une Mushroom Cave rectangulaire bruitée par zone FOREST en caverns_top. Tapissage fond via `#fillFernMushroomCaveFloor` (GRASSMUSHROOM + HUMUS). Protection TileGuard moitié inférieure + marge 2. Retourne `{caves: Array<{cx, cy, radiusX, radiusY}>, plants: Array<{index, system, type}>}`. |

---

#### Mini-biomes — Géologie

| Méthode | Description |
|---|---|
| `digFossilVeins()` | Place `FOSSIL_VEIN_COUNT` veines SHELL horizontales (rayon 2, longueur 16–20, déviation 12°). Biomes : DESERT + premier et dernier rect. Layer : caverns_top (90%), une migration max en under ou caverns_bottom (10%, 50/50). Protection TileGuard par point de chemin (rayon + 2). |
| `digSandPockets()` | Creuse 1–2 Sand Pockets elliptiques par zone DESERT (radiusX 4–8, radiusY 3–7). Layer : under (60%) ou caverns_top (40%). Intérieur SAND protégé par `tileGuard.addTiles()`. Périphérie inférieure (`y >= cy`) → SANDSTONE via `pocketSet`. |
| `buildBeach(seaTiles, isLeft, surfaceLine): {beachRect: {x, y, w, h}}` | Crée une plage de sable en bordure de mer. Trouve la tuile SEA la plus proche de la terre sur la première ligne de mer, pose un rectangle bruité (`digNoisyRect`, `PERLIN_OFFSET_BEACH`) de 56×20 tuiles centré à `shoreX ± 12`. Filtre les tuiles SEA/VOID/SKY/WATER. Conserve DIRT/SANDSTONE, convertit SILT/HUMUS en SANDSTONE, pose SAND ailleurs (SANDSTONE sur les bords touchant un liquide/gaz, sauf si SKY au-dessus). Disperse 15–20 tuiles SHELL aléatoires. Retourne `beachRect` (dimensions nominales, `cy = SEA_LEVEL`, `radiusY = 10`) pour le spawn de SHELL et le futur cocotier. |
| `buildSeaFloorAndWalls(seaTiles): void` | Traite le fond et les bords d'une mer. Passe 1 : sous chaque tuile SEA dont le voisin inférieur est non-SEA, pose SAND en y+1, SAND/SANDSTONE aléatoire (50/50) en y+2, SANDSTONE en y+3 si y+2 est SAND. Convertit en SANDSTONE les SAND situés au-dessus d'une tuile SEA (bord supérieur). Passe 2 : convertit en SANDSTONE les SAND latéraux (gauche/droite) dont la tuile en dessous de la tuile SEA adjacente est SEA. Deux appels `applyTiles` avec `ETERNAL_EXCLUDED`. |

---

#### Mini-biomes — Artefacts

| Méthode | Description |
|---|---|
| `digHearts(surfaceUnder, underCaverns)` | Place 15 spots Life Heart (2×2 VOID) en underground. Vérifie 16 tuiles solides. Fallback caverns_top. Ajoute le furniture 'Life Crystall'. Enregistre dans `#exclusions` + `tileGuard`. Retourne `Array<{cx, cy}>` (coin haut-gauche). |
| `digTriskels(underCaverns)` | Place 3 Triskels (2×2) : 2 en caverns_top, 1 en caverns_bottom. Fallback caverns_bottom si quota non atteint.. Ajoute les furnitures 'Tryskel'. Enregistre dans `#exclusions` + `tileGuard`. Retourne `Array<{cx, cy}>`. |
| `digPyramid()` | Creuse une Pyramide en KHEPRITE par zone DESERT en layer under. Structure définie par `PYRAMID_WALL_INDEXES` et `PYRAMID_VOID_INDEXES`. Orientation aléatoire (50/50). Protection TileGuard sur les tuiles KHEPRITE. Retourne `{room1: number, room2: number}` — index coin haut-gauche de chaque salle. Prérequis : `initZoneRects()`, `initExclusions()`. |
| `digRuinedCabin()` | Creuse une Ruined Cabin par monde en biome FOREST, layer under. Structure WOODWALL (murs) + STONEWALL (fond) avec 20% de dégradation aléatoire. Porte de 3 tuiles (gauche ou droite, 50/50). Mobilier : un meuble aléatoire (chairWood/tableWood/toiletWood) + chestAncient posés sur le sol. Retourne `{chestId: string, index: number}` — identifiant et position du coffre pour le système d'événements. Prérequis : `initZoneRects()`, `initExclusions()`. |
| `digLostTemple()` | Creuse un Lost Temple en OLYMPITE + OLYMPITEWALL (colonnes) par monde en biome JUNGLE, layer caverns_top. Caverne bruitée à fond plat (19×12) via `digNoisyRect` + `#flattenCaveBottom(cx, templateW, flatY)`. Structure 15×10 définie par `TEMPLE_RUIN_WALL_INDEXES` et `TEMPLE_RUIN_COLUMNS_INDEXES`. Intérieur tapissé d'EMERALDWALL. `brokenDecomposer` posé sur le sol. Protection TileGuard sur les tuiles OLYMPITE, colonnes et intérieur. Retourne `{room: number}|null` — index coin haut-gauche de la salle intérieure. Prérequis : `initZoneRects()`, `initExclusions()`. |
| `digAncientHouse()` | Creuse une Ancient House par monde en biome DESERT, layer caverns_bottom. Caverne bruitée à fond plat (28×18) via `digNoisyRect` + `#flattenCaveBottom`. Structure 18×11 en WOODWALL (murs + toit + étage) + GOLDWALL (fond intérieur). Porte INVISIBLE (3 tuiles, gauche ou droite, 50/50). Étage 6 tuiles (gauche ou droite). Dégradation : une tuile de mur + une tuile de toit retirées. Meubles : toit (`shuffleArray` + `surfaceFurnitures`), sol (idem), tableware sur 80% des surfaces. `brokenTransmutator` posé sur l'étage. Protection TileGuard sur la structure. Retourne `{x0, y0}|null`. Prérequis : `initZoneRects()`, `initExclusions()`. |
| `digAbandonedMine()` | Creuse une Abandoned Mine par monde, tous biomes, layer caverns_bottom. Tunnel horizontal bruité (~40 tuiles, rayon 3, deltaAngle 8°). COBALT sur 75% des tuiles de plafond, SAPPHIRE sur 15% des tuiles de sol. Étais SANDSTONEWALL verticaux espacés de 7-10 tuiles. Protection TileGuard rayon 5 sur chaque point du path. Robuste aux deux sens de tracé (90° ou -90°). Retourne `{path}|null`. Prérequis : `initZoneRects()`, `initExclusions()`. |
| `digGraveyards(): number[]` | Creuse 1 ou 2 Graveyards (50/50) en caverns_bottom, tous biomes. Chaque graveyard : rectangle 14×14 STONE/DIRT/VOID avec 2 ou 3 rangées de tunnels (50/50), alignement gauche/droite (50/50), tunnels de 9 ou 12 tuiles (tiré par tunnel). Sol de chaque rangée dimensionné sur max(tw_courant, tw_dessous)+2. Plafond dimensionné sur tw[0]+2. Tombes (furniture, tableau TOMBS) placées par slot de 3 tuiles dans chaque tunnel. Protection `tileGuard.addNoisyRect` adaptée à la hauteur (2 ou 3 rangées). Retourne un tableau des index coin haut-gauche de chaque graveyard placé. `#digOneGraveyard()` : creuse un graveyard individuel, retourne l'index coin haut-gauche ou -1 si échec après MAX_ATTEMPTS. |

---

#### Mini-biomes de surface généré par la faune

| Méthode | Description |
|---|---|
| `digAntlionPits(surfaceLine): number[]` | Creuse des Antlion Pits en surface des zones DESERT. Zones désertiques extraites, mélangées (`shuffleArray`), puis sélectionnées avec probabilité décroissante : 100% (1ère), 80% (2ème), 60% (3ème)… Retourne un tableau des index de spawn des antlions placés. |
| `digAnthills(surfaceLine): number[]` | Creuse des Ant Hills coniques en surface des zones FOREST. Zones mélangées (`shuffleArray`), sélectionnées avec probabilité décroissante de 20% par zone (100% pour la première). Chaque fourmilière : cône ANTDIRT (9×7 tuiles) avec salle de spawn 3×2 VOID centrée, cx/cy positionné sur le point le plus bas des 3 colonnes centrales. Protection `tileGuard.addRect` sur le rectangle d'exclusion (marge 2). Met à jour `surfaceLine` et propage SKY au-dessus des nouvelles tuiles de surface. Retourne un tableau des index coin haut-gauche des salles de spawn (reine fourmi). `#digOneAnthill(rect, surfaceLine)` : creuse une fourmilière individuelle, retourne l'index coin haut-gauche de la salle 3×2 ou -1 si échec après MAX_ATTEMPTS. |
| `reserveTermiteMounds(surfaceLine): number[]` | Réserve les emplacements des Termite Mounds en surface des zones JUNGLE avant le creusement des tunnels. Zones mélangées (`shuffleArray`), probabilité décroissante de 20% par zone. Pose exclusions et `tileGuard.addNoisyRect` (`PERLIN_OFFSET_TERMITE`). Retourne un tableau d'index `(cy << 10) | cx` (coin haut-gauche de la chambre VOID, utilisable pour le spawn de la reine). `#reserveOneTermiteMound(rect, surfaceLine)` : réserve un emplacement individuel, retourne l'index ou -1 si échec. |
| `buildTermiteMounds(reservations, surfaceLine): void` | Dessine les Termite Mounds après le creusement des tunnels. Pour chaque réservation : rectangle ANTDIRT 4×10 avec chambre VOID 2×2, ajustement de `surfaceLine` et propagation SKY au-dessus des nouvelles tuiles de surface. `#buildOneTermiteMound(idx, surfaceLine)` : dessine une termitière individuelle. |

---

#### Mise à jour de la surface

| Méthode | Description |
|---|---|
| `buildSurfaceLine(): Int16Array` | Calcule la ligne de surface — Y de la première tuile solide (non `LIQUID_OR_GAZ`) par colonne. Retourne `surfaceLine`. |
| `buildErodedSurfaceLine(): Int16Array` | Calcule la ligne de surface (première tuile solide (non `LIQUID_OR_GAZ`) par colonne) et applique une érosion légère (trous et bosses de 1 tuile). Retourne `surfaceLine`. |
| `paintSurfaceNatural(surfaceLine, biomesDescription): void` | Pose les tuiles NATURAL (GRASS / GRASSJUNGLE / SAND) sur les deux tuiles supérieures de chaque colonne, selon le biome courant. Colonne en mer → SAND. Ne fait rien dans les colonnes WATER. Parcours O(n) via avance monotone sur `biomesDescription`. Retourne la liste des enregistrements NATURAL (GRASSFOREST et GRASSJUNGLE uniquement) pour l'objectstore `plant`. Délègue à `applyTiles` avec `ETERNAL_EXCLUDED`. |
---

Le paramètre `offsetX` de `digNoisyCircle`, `digNoisyEllipse` et `digNoisyRect` permet de décorrèler le bruit Perlin des autres usages.

---

### Autres classes de génération

| Singleton            | Classe              | Rôle                                                                                      |
|----------------------|---------------------|-------------------------------------------------------------------------------------------|
| `worldGenerator`     | `WorldGenerator`    | Orchestre toutes les passes de génération dans l'ordre et sauvegarde en base de données.                                   |
| `biomesGenerator`    | `BiomesGenerator`   | Disposition horizontale des biomes et largeurs des mers latérales.                        |
| `biomeNaturalizer`   | `BiomeNaturalizer`  | Remplit le buffer avec les substrats par biome/couche. Prépare les zones côtières (VOID). |
| `tileGuard` | `TileGuard` | Protège des tuiles individuelles contre tout creusement. `init()`, `has(index)`, `add (index)`, `addTiles (tiles)`, `addRect()`, `addNoisyCircle()`, `addNoisyEllipse()`, `addNoisyEllipseBottom()`, `addNoisyRect()`. Consulté par `WorldCarver.applyTiles` avant chaque écriture. |
| `liquidFiller`       | `LiquidFiller`      | Flood-fill BFS des zones liquides et automate pour le SAND. |
| `webFiller` | `WebFiller` | Peuplement WEB : `fillCobwebCave(cx, cy)` pour les caves, `scatterWebs(surfaceUnder)` pour le peuplement global différé. |
| `furnitureGenerator ` | `FurnitureGenerator ` | Gestion des furnitures. `init()`, `getFurnitureSize(code)`, `addFurnitureAt(index, code)`, `get furnitures()`, `firstAvailableSlot(container, capacity, furnitureId)`, `addInHotbar(item, count, prefix, slot)`, `addInChest(chest, item, count, prefix)`, `get inventory()`, `placeSeaChests(seaRect)`, `placeCavernChests(zoneRects)`, `placeUndergroundChests(zoneRects)`, `placeSurfaceChests(zoneRects)`, `placeSurfaceLineChests(surfaceLine, guardedX, biomesDescription)`, `fillChest (chest)` |
| `plantGenerator`       | `PlantGenerator`      | Ajout de la flore dans le monde. `init()`, `get plants()`, `placeSeaCoconut(beachRect, surfaceLine, isLeft, guarded)`, `placeOasisCoconut(lake, surfaceLine, guarded)`, `placeCorals(seaRect, guarded)`, `placeTrees(surfaceLine, guarded)`, `placeGiantMushrooms(mushroomPlants)`, `spreadNatural(naturalPlants, naturalCode, topsoilCode, gazCode)`, `placeAmbermirages(surfaceLine, guarded, initialWeather)`, `.placeParsnipsSunflowers(surfaceLine, guarded, oakPositions)`, `placeBloodmoons(surfaceLine, guarded)`, `placeFerns(fernsPlants):count`, `placeMoss(mossPlants)`, `placeCaveMushrooms(mushroomPlants, initialWeather, giantOccupied)`, `placeMandrakes(zoneRects, chestIndexes)`, `placeCactus(zoneRects, chestRects)`, `placeBamboo(zoneRects, chestIndexes)`, `placeOleanders(zoneRects, chestIndexes)`, `placeSatansCubes(zoneRects, chestIndexes)`, `placeSneakthorns(zoneRects, chestIndexes)`, `placeCursedcrowns(zoneRects, chestIndexes)`, `placeAbysshorns(zoneRects, chestIndexes)`, `placeInferncaps(zoneRects, chestIndexes)` |

---

## 11. `render.mjs` (Layer 4)

### Class `Camera` (Singleton : `camera`)

Responsable uniquement des mathématiques de projection et du culling.

| Méthode/Propriété     | Description                                              |
|-----------------------|----------------------------------------------------------|
| `update({x, y}, speed?): void` | Mise à jour pour centrer sur la position en paramètre |
| `worldToCanvas(wx, wy)` | Conversion pixel monde → pixel canvas                 |
| `canvasToWorld(cx, cy)` | Conversion pixel canvas → pixel monde                 |
| `canvasToTile(cx, cy): number` | Convertit pixel canvas → index tuile monde. Retourne `null` si cx est `null`. |
| `displayChunks`       | `Array` — chunks visibles (cible du render)              |
| `preloadChunks`       | `Set` — chunks en bordure (cible du cache)               |
| `unpurgeableChunks`   | `Set` — chunks à garder en RAM pendant la purge          |
| `setZoom`             | Écoute `render/set-zoom` (EventBus). Zoom 100%–200%.     |
| `logicalWidth` / `logicalHeight` | Dimensions logiques = `VIEWPORT / zoom`     |

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

| Méthode          | Signature               | Description                            |
|------------------|-------------------------|----------------------------------------|
| `updateSkyColor` | `(color: string): void` | Remplit le canvas avec la couleur hex/rgb |

---

### Class `LightRenderer` (Singleton : `lightRenderer`)

#### Algorithme "Surface & Punch" — 4 passes

| Passe              | Mode               | Action                                          | Résultat                         |
|--------------------|--------------------|-------------------------------------------------|----------------------------------|
| 1 — Reset          | `source-over`      | `fillRect` noir total                           | Monde invisible                  |
| 2 — Découpe Ciel   | `destination-out`  | Polygone zone aérienne via `surfaceLine`        | Zone au-dessus du sol transparente |
| 3 — Punch-holes    | `destination-out`  | Gradient radial (blanc → transparent) par source | Halos de lumière               |
| 4 — Coloration     | `lighter`          | Gradient radial (couleur source → transparent)  | Teinte colorée sur les halos     |

**Sources lumineuses :** fournies par `FurnitureManager` (liste des objets visibles).
**`surfaceLine` :** fournie par `world.mjs :: SurfaceLineManager` — pour chaque X du monde,
Y de la première tuile solide.

**Optimisation :** 1 polygone vectoriel pour le ciel remplace ~1000 appels de dessin de tuiles.
**No-Draw Condition :** Si caméra entièrement dans le ciel → `clearRect` uniquement, LightRenderer inactif.

---

## 12. `persistence.mjs` (Layer 3)

### Class `SaveManager` (Singleton : `saveManager`)

Orchestrateur de sauvegarde. Connaît les object stores métier.

| Méthode             | Signature                        | Description                                                         |
|---------------------|----------------------------------|---------------------------------------------------------------------|
| `init`              | `(): void`                       | Planifie la première sauvegarde auto (2 s via `taskScheduler`)      |
| `queueStaticUpdate` | `(updates: Array\|Object): void` | Empile des updates (inventaire, player…). Dédoublonnage par ID.     |
| `processSave`       | `(): void`                       | Exécuté par `TaskScheduler`. Collecte dirty chunks + updates statiques → `database.batchUpdate`. |

**Flux :**
1. Interroge `chunkManager.consumeSaveDirty()`.
2. Récupère les records des managers (InventoryManager, PlayerManager…) via `pendingStaticUpdates`.
3. Appelle `database.batchUpdate()` en une transaction (cohérence crash).
4. Fire & Forget — les managers n'attendent pas la confirmation.

---

## 13. `assets.mjs` — Auto-Tiling

**Framing :** Bitmasking 4-connectivity calculé à la volée ou au chargement pour les transitions de texture.
**Diffusion :** Les tuiles ont un bord de 2 px partiellement transparent, peint de la couleur dominante
des tuiles adjacentes (`NODES.color`).

---

## 14. Règles de Codage

* Vanilla JS ESNext, modules natifs `.mjs`, pas de bundler.
* Google JavaScript Style Guide — **pas de point-virgule**.
* Champs privés natifs (`#variable`).
* `Object.assign()` pour les styles CSS groupés.
* `for` ou `for…of` dans les hot paths. Jamais de `map`/`filter`/`forEach`.
* Singletons exportés en minuscule (`export const chunkManager = new ChunkManager()`).
* Les fonctions passées à `MicroTasker` doivent être des méthodes bindées — pas de lambdas anonymes.

## 15. Buffs

### Class `BuffManager` (`src/buff.mjs`) — Singleton : `buffManager`

Gestion centralisée des buffs du joueur. Deux phases obligatoires : `init()` puis abonnements `eventBus`.

#### Champs

| Champ | Type | Description |
| :--- | :--- | :--- |
| `#values` | `Map<string, number\|boolean>` | Valeurs brutes des buffs élémentaires. Mise à jour via `eventBus`. |
| `#fns` | `Map<string, () => number>` | Fonctions de calcul des buffs composés. |
| `timestamps` | `Map<string, number>` | Timestamps d'expiration des buffs timed (ms jeu). Lu par `BuffWidget`. |

#### Notation

| Notation | Type | Exemple |
| :--- | :--- | :--- |
| camelCase | élémentaire | `armorHelmetMiningSpeed`, `rainy`, `lucky` |
| kebab-case | composé | `mining-speed`, `movement-speed` |

#### Méthodes

| Méthode | Signature | Description |
| :--- | :--- | :--- |
| `init` | `() → void` | Initialise les buffs environnementaux à `false`/`0`. S'abonne aux eventBus. |
| `getBuff` | `(name: string) → number` | `#values.get(name) ?? #fns.get(name)?.() ?? 0` |
| `getBuffs` | `(names: string[]) → Object` | Retourne `{name: value}` pour chaque nom. |
| `onDaily` | `({moonPhase, weather}) → void` | Handler `time/daily` + `time/first-loop`. Met à jour lune et météo. |
| `onTimeslot` | `({tslot, isDay}) → void` | Handler `time/timeslot` + `time/first-loop`. Met à jour le cycle circadien. |
| `onDebug` | `() → void` | Handler `debug/buff-manager`. Affiche `#values` et `#fns` sur la console. |

#### Buffs environnementaux initialisés

| Groupe | Clés | Source |
| :--- | :--- | :--- |
| Lune | `fullMoon` `waningGibbous` `thirdQuarter` `waningCrescent` `newMoon` `waxingCrescent` `firstQuarter` `waxingGibbous` | `time/daily` |
| Météo | `sunny` `cloudy` `rainy` `windy` `stormy` | `time/daily` |
| Cycle | `midnight` `dawn` `morning` `noon` `afternoon` `dusk` `evening` `night` `isDay` `isNight` | `time/timeslot` |

#### Buffs timed (à implémenter lors du premier buff timed)

Structure objectStore `buff` : `{key, id, buff, value, expiration, deleted}`.
Au démarrage, `core.mjs` supprime en base les enregistrements 'deleted===true), et passe les enregistrements non supprimés à `init()` → `taskScheduler.enqueueAbsolute`.
À l'expiration : valeur remise à `0`, enregistrement marqué `deleted=true` en DB, suppression retardée au prochain lancement.

### Class `BuffWidget` (`src/buff.mjs`) — Singleton : `buffWidget`

Affiche les buffs actifs dans le Control Panel (`UI_LAYOUT.BUFF = 40`).
Indépendant de la boucle principale — `setInterval` 1 seconde.
Toutes les refs DOM précalculées à l'init. Zéro parcours DOM en runtime.

#### `DISPLAY_BUFFS`

Tableau de définitions `{id, title, x, y}` — coordonnées dans `assets/sprites/buff_32_32.png` (tuiles 32×32px).
`id === 'armors'` : toujours visible, title dynamique mis à jour à la fermeture de l'inventaire.

#### Comportement `#update` (chaque seconde)

1.buffManager.getBuffs(#buffIds)  — un seul appel pour tous les buffs statiques
2. Pour chaque buff :
  * id === 'armors'                → toujours display:flex, skip
  * buffManager.timestamps.get(id) → buff timed : affiche remaining (ceil((exp-now)/1000)), caché si ≤ 0
  * sinon                          → buff statique : display selon valeur truthy/falsy

#### Champs privés

| Champ | Description |
| :--- | :--- |
| `#container` | Élément racine injecté dans `#right-sidebar` |
| `#refs` | `Map<id, {el, timeEl}>` — refs DOM précalculées |
| `#buffIds` | `string[]` — ids filtrés (sans `armors`), précalculés dans le constructeur |


## 15. Inventaire

### Class `InventoryManager` (Singleton : `inventoryManager`, `inventory.mjs`)

Autorité unique sur l'état mémoire de l'inventaire. Aucune logique DOM.

#### Initialisation (appelée depuis `core.mjs` au `startSession`)

| Méthode | Signature | Description |
| :--- | :--- | :--- |
| `init` | `() → void` | Vide les structures. À appeler avant `initSlot`. |
| `initSlot` | `(dbSlot: object) → void` | Intègre un enregistrement DB dans la structure mémoire correspondante. |
| `initCheck` | `() → void` | Vérifie l'intégrité des tableaux (taille attendue). Appel optionnel. |

#### Accesseurs (lecture seule)

| Propriété | Type | Description |
| :--- | :--- | :--- |
| `bag` | `Array(64)` | Slots bag, index = numéro de slot. |
| `hotbar` | `Array(8)` | Slots hotbar, index = numéro de slot. |
| `armor` | `Array(3)` | Slots armure — HEAD=0, BODY=1, FOOT=2. |
| `accessories` | `Array(5)` | Slots accessoires, index = numéro de slot. |

#### Lecture de slots

| Méthode | Signature | Description |
| :--- | :--- | :--- |
| `getSlot` | `(container: string, index: number) → object` | Retourne la référence mémoire d'un slot joueur. |
| `getContainerSlot` | `(furnitureId: string, index: number) → object` | Retourne la référence mémoire d'un slot container-furniture. |
| `getContainer` | `(furnitureId: string) → Array\|undefined` | Retourne le tableau de slots d'un container chargé. |
| `getStaticBuffs` | `() → Array<string>` | Retourne les itemIds donnant des buffs passifs : armor + accessoires équipés + trinkets du bag. |

#### Modifications

| Méthode | Signature | Description |
| :--- | :--- | :--- |
| `toggleLock` | `(slot: object) → boolean` | Inverse l'état locked. Retourne le nouvel état. |
| `trashFromBag` | `(slotIndex: number) → object` | Déplace le contenu d'un slot bag vers la poubelle. Retourne le slot vidé. |
| `restoreTrash` | `() → void` | Restaure la poubelle dans le bag (stack ou premier libre). |
| `loot` | `(item: string, count: number, prefix: string) → void` | Place un item looté (stack bag → stack hotbar → libre bag → libre hotbar). |
| `decrementBagSlotCount` | `(slotIndex: number) → object` | Décrémente le count d'un slot bag. Vide si count=0. Retourne le slot. |
| `decrementHotbarSlotCount` | `(slotIndex: number) → object` | Décrémente le count d'un slot hotbar. Vide si count=0. Retourne le slot. |
| `splitSlot` | `(srcSlot: object, count: number) → object\|null` | Sépare une pile — premier slot libre bag uniquement. Retourne le slot destination ou null si bag plein. |
| `canReceiveFromCraft` | `(items: Array<{code, count}>) → boolean` | Simule sans modifier l'inventaire : vérifie si les items peuvent être stockés (stacking bag/hotbar ou slot libre bag). |
| `craftReceive` | `(items: Array<{code, count}>) → void` | Ajoute les items résultats dans l'inventaire via `loot`. À appeler uniquement après `canReceiveFromCraft`. |
| `removeFromPlayer`    | `(itemCode: string, count: number) → number`              | Retire count items du bag puis de la hotbar. Retourne le restant non consommé. |
| `removeFromContainer` | `(furnitureId: string, itemCode: string, count: number) → number` | Retire count items d'un container furniture. Retourne le restant. |

#### Déplacements intra-container

| Méthode | Signature | Description |
| :--- | :--- | :--- |
| `moveWithinContainer` | `(container: string, sourceIndex: number, targetIndex: number) → void` | Swap ou stack dans hotbar, bag ou accessory. |
| `moveWithinChest` | `(furnitureId: string, sourceIndex: number, targetIndex: number) → void` | Swap ou stack dans un coffre. |

#### Déplacements inter-containers

| Méthode | Signature | Description |
| :--- | :--- | :--- |
| `moveBagToHotbar` | `(sourceIndex, targetIndex) → void` | Swap ou stack. |
| `moveHotbarToBag` | `(sourceIndex, targetIndex) → void` | Swap ou stack. |
| `moveBagToChest` | `(furnitureId, sourceIndex, targetIndex) → void` | Swap ou stack. |
| `moveChestToBag` | `(furnitureId, sourceIndex, targetIndex) → void` | Swap ou stack. |
| `moveBagToChestAuto` | `(sourceIndex, furnitureId) → object\|null` | Stack ou premier libre dans le coffre. Retourne slot destination ou null. |
| `moveChestToBagAuto` | `(furnitureId, sourceIndex) → object\|null` | Stack ou premier libre dans le bag. Retourne slot destination ou null. |
| `moveBagToArmor` | `(sourceIndex, targetIndex) → {srcSlot, destSlot, depositSlot}\|null` | Vérifie stype. Dépose l'item délogé dans le bag. Null si impossible. |
| `moveArmorToBag` | `(sourceIndex, targetIndex) → {srcSlot, destSlot, depositSlot}\|null` | Null si bag plein. |
| `moveBagToAccessory` | `(sourceIndex, targetIndex) → {srcSlot, destSlot, depositSlot}\|null` | Vérifie ITEM_TYPE.ACCESSORY. Dépose l'item délogé dans le bag. Null si impossible. |
| `moveAccessoryToBag` | `(sourceIndex, targetIndex) → {srcSlot, destSlot, depositSlot}\|null` | Null si bag plein. |

#### Persistance

| Méthode | Signature | Description |
| :--- | :--- | :--- |
| `save` | `() → void` | Passe les slots dirty au `SaveManager`. À appeler à la fermeture de l'overlay. |

#### Gestion du craft

| Méthode | Signature | Description |
| :--- | :--- | :--- |
| `fillMaterialsFromPlayer` | `(obj: object) → void` | Accumule les items MATERIAL du bag et de la hotbar dans l'accumulateur `{itemCode: count}`. |
| `fillMaterialsFromContainer` | `(obj: object, furnitureId: string) → void` | Accumule les items MATERIAL d'un container furniture dans l'accumulateur. No-op si furnitureId inconnu. |


**Structure slot mémoire :** `{key, container, furnitureId, item, count, prefix, slot, locked, deleted}`
**`#dirtyKeys` :** `Set<slot>` — références directes aux slots modifiés depuis la dernière sauvegarde.

---

### Custom Element `<inventory-slot>` (`inventory.mjs`)

Attributs observés : `item` (itemId string), `count` (integer), `locked` (booléen — présence = verrouillé), `usable` (integer).
Attributs de construction (non observés) : `key` (label raccourci), `location` (format `container|index`).
Classes CSS : `selected` (slot actif), `inactive` (slot grisé, non interactif), `slot-armor-set` (armure set complet).

---

### Class `InventoryOverlay` (Singleton : `inventoryOverlay`, `inventory.mjs`)

Interface DOM de l'inventaire. Aucune logique métier — délègue à `inventoryManager`.

#### Points d'entrée (EventBus)

| Event | Action |
| :--- | :--- |
| `inventory/open` | Affiche l'overlay, peuple tous les slots depuis `inventoryManager`, attache les handlers `window`. |
| `inventory/close` | Cache l'overlay, émet `inventory/static-buffs` et `hotbar/changed`, appelle `inventoryManager.save()`, détache les handlers `window`. |
| `inventory/keydown` | Raccourcis : `L` = lock, `Space` = use, `Delete` = trash. |

#### Points de sortie (EventBus émis)

| Event | Payload | Description |
| :--- | :--- | :--- |
| `inventory/static-buffs` | `Array<string>` | Items donnant des buffs passifs (armor + accessoires équipés + trinkets bag). |
| `hotbar/changed` | `Array` | Contenu hotbar après fermeture. |
| `item/used` | `string` (itemId) | Émis lors d'un clic sur l'icône Use. |
| `craft/item` | `string` (itemId) | Navigue vers la recette d'un item craftable/material. |
| `help/topic` | `string` (topic) | Navigue vers la fiche d'aide correspondante. |
| `debug/command` | — | Déclenche le prompt de debug. |
| `overlay/open-request` | `string` (overlayId) | Demande d'ouverture d'un autre overlay. |

#### Méthode publique (debug uniquement)

| Méthode | Signature | Description |
| :--- | :--- | :--- |
| `refreshBag` | `() → void` | Rafraîchit les slots DOM du bag et de la hotbar. À appeler après toute modification externe (debug). |

### Class `CraftOverlay` (Singleton : `craftOverlay`, `craft.mjs`)

Interface DOM du panel de craft. Aucune logique métier — délègue à `inventoryManager` pour la disponibilité des ingrédients et l'exécution des crafts.

Permet de parcourir et filtrer les recettes (par texte, type d'item résultat, station ou ingrédient), de visualiser le détail d'une recette (ingrédients, station, résultat, items retournés) avec les indicateurs de disponibilité, et d'exécuter le craft si toutes les conditions sont réunies (ingrédients disponibles, station à portée, place dans le bag).

L'état des filtres est persisté en base de données entre les sessions.

---

### Class `FurnitureManager` (Singleton : `furnitureManager`, `housing.mjs`)

#### Structure DB (objectStore `furniture`)

| Champ | Type | Description |
| :--- | :--- | :--- |
| `key` | `number` | Clé autoincrement — assignée par IndexedDB à la première sauvegarde |
| `id` | `string` | Identifiant unique (uniqueIdGenerator) — stable sur toute la durée de vie du meuble |
| `index` | `number` | Position du coin haut-gauche encodée `(y << 10) \| x`, en tuiles |
| `w` | `number` | Largeur en tuiles |
| `h` | `number` | Hauteur en tuiles |
| `code` | `string` | itemId dans ITEMS |
| `stype` | `string` | Sous-type fonctionnel : `station`, `chest`, `door`, `chair`, `toilet`, `fireplace`... |
| `deleted` | `boolean` | Marqueur de suppression — `true` = purgé au prochain startSession, jamais supprimé en temps réel |

Champs optionnels selon `stype` :

| Champ | Type | Stypes concernés | Description |
| :--- | :--- | :--- | :--- |
| `left` | `boolean` | `door`, `chair`, `toilet`... | `true` = orienté à gauche. Absent pour les meubles symétriques |
| `closed` | `boolean` | `door` | `true` = porte fermé, si `false` = porte ouverte à droite ou à gauche selon `left` |
| `lit` | `boolean` | `fireplace`, `campfire`... | `true` = allumé. Absent pour les meubles non activables |
| `name` | `string` | `chest`, `cabinet`, `closet`... | Nom personnalisé du container. Absent si non renommé |

#### Placements

| Méthode | Signature | Structure interne |
| :--- | :--- | :--- |
| `place` | `(code: string, clickIndex: number) → object` | Crée et enregistre un furniture. `clickIndex` = coin bas-gauche (convention joueur). Retourne le record créé. |
| `unplace` | `(furnitureId: string) → object\|undefined` | Retire un furniture du monde. `deleted=true` en DB, retrait immédiat des structures mémoire. Retourne le record (l'appelant gère la réinsertion inventaire). `undefined` si introuvable. |

#### Accès

| Méthode | Signature | Structure interne |
| :--- | :--- | :--- |
| `getFurnitureById` | `(furnitureId: string) → object` | Retourne le furniture placé à partir de son identifiant. |
| `getFurnitureAt` | `(tileIndex: number) → object\|null` | Early-exit via `#occupiedTiles`, puis scan de 1 à 4 chunks via `#byChunk` (1 chunk dans ~76% des cas). |

#### Contrat des systèmes occupants — implémentation FurnitureManager

| Méthode | Signature | Structure interne |
| :--- | :--- | :--- |
| `isTileOccupied` | `(index: number) → boolean` | `#occupiedTiles: Set<number>` — rectangle w×h complet |
| `isFloorTile` | `(index: number) → boolean` | `#floorTiles: Set<number>` — ligne tileY+h |
| `isSurfaceTop` | `(index: number) → boolean` | `#surfaceTops: Set<number>` — ligne tileY si `ITEMS[code].surface` |

#### Actions

| Méthode | Signature | Structure interne |
| :--- | :--- | :--- |
| `rename` | `(furnitureId: string, name: string) → void` | Met à jour `name` sur le record et persiste via saveManager. |

## 16. Système de succès

### `assets/data/data-achievements.mjs`

Constante de définition des catégories. Importée par AchievementManager uniquement.

```js
export const ACHIEVEMENT_CATEGORIES = [
  {
    id:         string,   // identifiant machine
    label:      string,   // libellé affiché dans l'overlay
    thresholds: number[], // [seuil1, seuil2, seuil3] — communs à tous les membres
    items:      string[]  // codes (nodeCode | itemCode | monsterCode)
  },
  ...
]
```

Points toujours [5, 2, 1] — codés en dur dans AchievementManager.

### DB — objectStore `achievements`

| Champ | Type | Description |
| :--- | :--- | :--- |
| `code` | `string` | Clé primaire (keyPath) — nodeCode, itemCode ou monsterCode |
| `count` | `number` | Compteur cumulé depuis la création du monde |

Pas d'autoincrement. Opération unique : `put()`. Points non persistés — recalculés au chargement.
Persistance découplée du save synchrone.

### Unicité des codes — `data.mjs` section 8.3

Vérification au boot que les champs `.code` sont uniques à travers NODES (numérique),
ITEMS (string) et MONSTERS (string). Garantit qu'un code identifie sans ambiguïté
la table source sans test à l'exécution.

### Class `AchievementManager` (Singleton : `achievementManager`, `achievements.mjs`)

*À documenter à l'implémentation.*

### Class `AchievementOverlay` (Singleton : `achievementOverlay`, `achievements.mjs`)

Raccourci : `U`.
*À documenter à l'implémentation.*

## 17. Player

### Class `PlayerManager` (Singleton : `playerManager`, `player.mjs`)

Position interne : coin haut-gauche de la hitbox en pixels monde.

| Méthode      | Signature                        | Description                                                  |
|--------------|----------------------------------|--------------------------------------------------------------|
| `init`       | `(playerRecord: string): {x, y}` | Parse `'x|y|direction'`, positionne le joueur, retourne le centre hitbox. |
| `update`     | `(dt, directions): {x, y}`       | Déplace selon bitmask, retourne le centre hitbox. Sans collision (provisoire). |
| `getCenterTile` | `(): {x, y}` | Retourne la tuile du centre de la hitbox en coordonnées tuile. |
| `getPosition`| `(): [number, number]`           | Centre de la hitbox.             |
| `render`     | `(ctx): void`                    | Dessine la hitbox (placeholder red). ctx déjà transformé.   |

Hitbox : `PLAYER.w × PLAYER.h` (cf. `constant.mjs`).
