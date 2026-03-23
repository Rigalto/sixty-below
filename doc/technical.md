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
| `WORLD_WIDTH_SHIFT`| number  | 11        | `2^11 = 1024` — shift pour index ligne   |
| `CHUNK_SHIFT`      | number  | 4         | `2^4 = 16` — shift pour coordonnées chunk|
| `CHUNK_MASK`       | number  | `0b1111`  | Masque position locale dans un chunk     |
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
| `NODES_LOOKUP` | Array  | Lookup par code numérique (hot path). `NODES_LOOKUP[14]` → node.  |
| `ITEMS`        | object | Index par id string. `ITEMS.bkston` → objet item complet.         |
| `PLANTS`       | object | Index par id string.                                               |
| `RECIPES`      | object | Index par id string.                                               |

Note : les 'furnitures' sont des items possédant le type 'ITEM_TYPE.FURNITURE'.

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
3. Résolution `NODES.mining[].item` : string → objet item
4. Résolution `ITEMS.placesNode` : string → objet node
5. Résolution `PLANTS.growsOn[]` : string → objet node
6. Résolution `PLANTS.drops[].item` : string → objet item
7. Résolution `RECIPES.ingredients[].item` et `result.item` : string → objet item
8. **Validation d'intégrité** — `throw` bloquant si KO :
   - Codes `NODES` uniques
   - Aucune référence croisée non résolue (string résiduelle = erreur)

### Hydratation des images

**Absente de `data.mjs`** — dépend de `loadAssets()`.
Effectuée par `core.mjs :: #hydrateNodes()` et `#hydrateItems()` après `loadAssets()`.
Itère sur `NODES_LOOKUP` et `ITEMS`, modifie les objets en place
(ajout de `renderData`, suppression de `image` pour libérer la mémoire).

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

#### Core / State (`InputManager`)
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `state/changed` | `{ state, oldState }` | Émis lorsque l'`InputManager` change l'état global du jeu (Exploration <-> Information/Combat). |

#### UI / Interface (Common)
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `overlay/close` | `string` (Overlay ID) | Demande générique de fermeture émise par le bouton 'X' d'un overlay. Traitée par `InputManager`. |
| `overlay/open-request`| `string` (Overlay ID) | Demande générique d'ouverture d'un overlay. Traitée par `InputManager`. |

#### Inventory (`InventoryManager`, `InventoryOverlay`)
*En prévision*
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `inventory/open`| - | Affichage du panel d'inventaire. |
| `inventory/close`| - | Disparition du panel d'inventaire. |
| `inventory/static-buffs`| `Array<string>` (List of buffs) | Émis à la fermeture de l'inventaire. |

#### Craft (`CraftOverlay`)
*En prévision*
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `craft/open`| - | Affichage du panel d'artisanat. |
| `craft/close`| - | Disparition du panel d'artisanat. |

#### Help (`HelpOverlay`)
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `help/open`| - | Affichage du panel d'aide. |
| `help/close`| - | Disparition du panel d'aide. |

#### Combat (`CombatOverlay`)
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `combat/open`| - | Affichage du panel de combat. |
| `combat/close`| - | Disparition du panel de combat. |

#### Buffs Widget (`BuffManager`)
*En prévision*
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `buff/display-next-weather` | `boolean` | Active/Désactive la prévision météo. |
| `buff/display-coords` | `boolean` | Active/Désactive l'affichage des coordonnées. |
| `buff/display-time-precision` | `integer` | précision 0 => 1heure, 1 => 15 minutes, 2 => 5 minutes |
| `buff/display-moon-detail` | `boolean` | affiche 4 (false) ou 8 (true) phases lunaires |

#### Debug (`WorldMapDebug`, `RealtimeDebugWidget`)
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `map/open`| - | Affichage de la carte au 1/16e. |
| `map/close`| - | Disparition de la carte au 1/16e. |
| `debug/frame-sample`| `{updateTime, renderTime, microTime}` | Temps exécution dans la loop pour les 3 budgets. |

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

---

## 5. `database.mjs` (Layer 1)

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
| `clearObjectStore`     | `(storeName): Promise`                 | Vide un store                                                 |
| `clearAllObjectStores` | `(): Promise`                          | Reset complet (nouveau monde)                                 |
| `openTransaction`      | `(storeName, mode): IDBTransaction`    | Transaction manuelle                                          |
| `batchUpdate`          | `(operations): Promise`                | Lot d'opérations mixtes en une transaction                    |
| `backupDatabase`       | `(): Promise`                          | Export JSON (debug)                                           |
| `restoreDatabase`      | `(file): Promise`                      | Import JSON (debug)                                           |

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
3. `#hydrateNodes()` — itère `NODES_LOOKUP`, remplace `image` par `renderData`
4. `#hydrateItems()` — itère `ITEMS`, remplace `image` par `renderData`
5. `mouseManager.init()`

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

## 7. `assets.mjs` (Layer 3)

| Export           | Signature                                           | Description                                       |
|------------------|-----------------------------------------------------|---------------------------------------------------|
| `loadAssets`     | `(): Promise<void>`                                 | Charge toutes les images/sons                     |
| `resolveAssetData` | `(codeStr): {imgId, sx, sy, sw, sh, isAutoTile}` | Résout une string image en UV pré-calculées       |
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
| `initZoneRects(biomesDescription, skySurface, surfaceUnder, underCaverns)` | Initialise `this.zoneRects`. Pré-calcule les rectangles biome × layer (Y moyens aplatis). À appeler une fois dans `generate()` avant tout placement. |
| `zoneRects` | `Array<{biome, x0, x1, ySkySurface, ySurface, yUnder, yCavernsMid, yCaverns, yHell}>` | Résultat de `initZoneRects`. Consommé par toutes les fonctions de placement. |
| `addSubstratClusters` | `(biomesDescription, skySurface, surfaceUnder, underCaverns): void` | Parcourt les zones biome × layer (surface / under / caverns_top / caverns_bottom) et applique les clusters définis dans `CLUSTER_SCATTER_MAP`. Caverns découpée en deux moitiés. Appelle `scatterClusters` + `applyTiles`. |
| `addOreClusters` | `(biomesDescription, surfaceUnder, underCaverns): void` | Parcourt les zones biome × layer (under / caverns_top / caverns_bottom) et applique les clusters ore/gem/rock définis dans `ORE_GEM_SCATTER_MAP`. Pas de clusters en surface. |
| `projectAndFill` | `({cx, cy, code}: {cx: number, cy: number, code: number}): void` | Projette jusqu'à 100 lignes depuis le centre d'une géode. Pose `GEODE_TARGET_CLUSTER_COUNT` clusters (taille 4–8) de `code` sur la première tuile SUBSTRAT rencontrée. Ignore SKY et ETERNAL. Constantes dans `data-gen.mjs`. |

**Algorithme de randomWalkCluster :** frange maintenue en doublon `Set + Array` — déduplication O(1), tirage O(1) par swap-and-pop.

---

### Class `WorldCarver` (Singleton : `worldCarver`)

Génère des tunnels et des cavernes (tuiles VOID).

| Méthode | Signature | Description |
|---|---|---|
| `initExclusions` | `(): void` | Réinitialise la liste interne des zones d'exclusion (#exclusions). À appeler depuis generate() avant le premier mini-biome. |
| `addExclusion` | `(rect: {x1, y1, x2, y2}): void` | Ajoute un rectangle à la liste interne d'exclusion (#exclusions). À appeler explicitement après applyTiles() pour les mini-biomes uniquement. |
| `isExcluded` | `(x1, y1, x2, y2: number): boolean` | Vérifie si un rectangle intersecte l'une des zones d'exclusion internes (#exclusions). Retourne true dès la première intersection trouvée. |
| `digNoisyCircle` | `(tiles, cx, cy, radiusMin, radiusMax, code, frequency?, offsetX?: void` | Creuse un trou circulaire bruité (Perlin noise) - Peut générer des tuiles et des trous isolés - Pousse les tuiles directement dans `tiles` (pas de retour). |
| `digNoisyEllipse` | `(tiles, cx, cy, radiusXMin, radiusXMax, radiusYMin, radiusYMax, code, frequency?, offsetX?): void` | Creuse un trou elliptique bruité (Perlin noise). Distance normalisée par les demi-axes — même algorithme que `digNoisyCircle`. Pousse les tuiles dans `tiles`. |
| `applyTiles` | `(tiles: Array<{x, y, index, code}>): {x1, y1, x2, y2}` | Écrit les tuiles dans `worldBuffer` via `writeAt`. Ignore les tuiles hors bornes et protège `FOG`, `DEEPSEA`, `BASALT`, `LAVA`, `SKY`, `SEA` contre l'écrasement. Retourne le rectangle englobant des tuiles écrites. |
| `pathTunnel` | `(x0, y0, radiusMax, maxLength, angle, deltaAngle): Array<{x, y, radiusMin, radiusMax}>` | Calcule le chemin d'un tunnel par accumulation angulaire. `angle` et `deltaAngle` en degrés. Longueur effective ~25% supérieure à `maxLength` (facteur 0.8). Utilitaire pur — ne creuse pas. |
| `carveAlongPath` | `(path: Array<{x, y, radiusMin, radiusMax}>, offsetX?): void` | Creuse un tunnel le long d'un chemin `pathTunnel`. Accumule tous les cercles en un seul tableau avant `applyTiles`. |
| `digSmallCaverns` | `(surfaceUnder: Int16Array): void` | Disperse `SMALL_CAVERNS_COUNT` cavernes rayon 3–12 (tiré par caverne) dans les zones underground et cavernes. Rayon effectif : `[radius-1, radius+1]`. Constante dans `data-gen.mjs`. |
| `digZigzagTunnel` | `(skySurface: Int16Array): void` | Creuse `ZIGZAG_TUNNEL_COUNT` tunnels en zigzag depuis la surface. Chaque tunnel alterne des segments à ~135° et ~225° (±45° autour du bas). Rayon max 8. Longueur totale 200–250 tuiles, segments de 1/5 à 1/4 de la longueur totale. Accumule toutes les tuiles avant `applyTiles`. Constante dans `data-gen.mjs`. |
| `digUndergroundTunnels` | `(surfaceUnder: Int16Array, underCaverns: Int16Array): void` | Creuse `UNDERGROUND_TUNNEL_COUNT` tunnels horizontaux avec un ou deux coudes en zone underground. Rayon 9, longueur 30–50, angle initial 0–360°, déviation 25°. Constante dans `data-gen.mjs`. |
| `digCavernsTunnels` | `(underCaverns: Int16Array): void` | Creuse `CAVERN_TUNNEL_COUNT` tunnels dans la zone cavernes. Borne basse : `WORLD_HEIGHT - 32`. Rayon 9, longueur 40–60, angle initial 0–360°, déviation 50°. Constante dans `data-gen.mjs`. |
| `digSmallTunnels` | `(surfaceUnder: Int16Array): void` | Creuse `SMALL_TUNNELS_COUNT` petites galeries sinueuses (rayon 2-4, longueur 60–100, deltaAngle 40°) dans les zones underground et cavernes. Constante dans `data-gen.mjs`. |
| `digHives` | `(biomeCounts: {forest, desert, jungle}, biomesDescription: Array<{biome, width, offset}>, surfaceUnder: Int16Array, underCaverns: Int16Array): void` | Creuse `hiveCount` ruches en zone JUNGLE (underground → caverns_top). Paroi HIVE (rayon+4) + intérieur VOID (rayon), galerie d'accès diagonale 45° ou -45°. Remplissage par HONEY différé. Constantes `HIVE_RADIUS_MIN/MAX` dans `data-gen.mjs`. Utilise `#isExcluded` et `#exclusions`. |
| `digCobwebCaves` | `(underCaverns: Int16Array): Array<{cx, cy, radiusX, radiusY}>` | Creuse 4–8 cavernes elliptiques dans tous les biomes, cavern_top (75%) ou cavern_bottom (25%). COBWEB différé. Rectangle englobant enregistré dans #exclusions. Constantes dans `data-gen.mjs`. |
| `digGeodeCaves` | `(underCaverns: Int16Array, code: number): Array<{cx, cy, radiusX, radiusY, code}>` | Creuse 3–4 géodes elliptiques (rayon 8–12) en zone cavern_bottom, tous biomes. Retourne la description pour projectAndFill(). Constantes dans `data-gen.mjs`. |
| `cleanupAfterCarving` | `(): void` | Passe de nettoyage globale post-creusement. 7 règles in-place : propagation SKY, suppression tuiles isolées VOID/non-VOID (4-connexe et paires horizontales/verticales). Parcours séquentiel index croissant — cascade naturelle. |

Le paramètre `offsetX` permet de décorrèler le bruit Perlin des autres usages.

---

### Autres classes de génération

| Singleton            | Classe              | Rôle                                                                                      |
|----------------------|---------------------|-------------------------------------------------------------------------------------------|
| `worldGenerator`     | `WorldGenerator`    | Orchestre toutes les passes de génération dans l'ordre et sauvegarde en base de données.                                   |
| `biomesGenerator`    | `BiomesGenerator`   | Disposition horizontale des biomes et largeurs des mers latérales.                        |
| `biomeNaturalizer`   | `BiomeNaturalizer`  | Remplit le buffer avec les substrats par biome/couche. Prépare les zones côtières (VOID). |
| `liquidFiller`       | `LiquidFiller`      | Flood-fill BFS des zones liquides et automate pour le SAND. |

---

## 11. `render.mjs` (Layer 4)

### Class `Camera` (Singleton : `camera`)

Responsable uniquement des mathématiques de projection et du culling.

| Méthode/Propriété     | Description                                              |
|-----------------------|----------------------------------------------------------|
| `worldToCanvas(wx, wy)` | Conversion pixel monde → pixel canvas                 |
| `canvasToWorld(cx, cy)` | Conversion pixel canvas → pixel monde                 |
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
