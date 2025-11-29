# TECHNICAL REFERENCE

Ce document liste les interfaces publiques (API) des modules implémentés. À fournir à l'IA pour qu'elle utilise correctement les fonctions existantes.

## constant.mjs (layer 0)

* FPS, TILE_SIZE, CHUNK_SIZE, WORLD_WIDTH, WORLD_HEIGHT
* NODES: Object { CLAY: {code...}, ... }
* NODES_LOOKUP: Array[NodeObject]
* TILE_TYPE, TILE_FLAG

### Usage Patterns (Standard)

**1. Récupérer l'ID numérique** (Pour écriture)
*Utilisé pour définir une tuile dans la grille (TypedArray).*
```javascript
import { NODES } from './constant.mjs'
const tileCode = NODES.CLAY.code
// usage: chunk.data[index] = tileCode
```

**2. Récupérer l'objet complet par son Nom** (Pour UI / Logique) Utilisé quand on manipule le type de manière abstraite (ex: Inventaire).

```javascript
import { NODES } from './constant.mjs'
const tileDesc = NODES.CLAY
```

**3. Récupérer l'objet complet par son ID** (Pour Rendu / Physique) Utilisé dans les boucles critiques (Hot path) à partir d'une valeur lue dans la grille.

```javascript
import { NODES_LOOKUP } from './constant.mjs'
const tileDesc = NODES_LOOKUP[tileCode]
// usage: if (tileDesc.flags & TILE_FLAG.SOLID) .
```

## assets.mjs (layer 1)

* loadAssets(): Promise<void>
* resolveAssetData(codeStr): {imgId, sx, sy, sw, sh, isAutoTile}
* IMAGE_FILES: Array[String]

## utils.mjs (layer 1)

### Class EventBus (Singleton: eventBus)

* `on(event: string, callback: function): void`
* `off(event: string, callback: function): void`
* `emit(event: string, data: any): void`

### Class `MicroTasker` (Singleton: `microTasker`)

* `init(): void` - Vide la file d'attente et les stats.
* `initDebug(mapping: object): void`
* `enqueue(fn: function, priority: int, capacityUnits: int, ...args: any): void`
* `enqueueOnce(fn: function, priority: int, capacityUnits: int, ...args: any): void`
* `clear(): void`
* `queueSize`: number (getter)
* `resetStats(): void`
* `debugStats(): string`
* `update(budgetMs: number): void` (appel uniquememnt par `gameCore`)

#### Usage Pattern (Standard)

```javascript
import {MICROTASK} from './constant.mjs'
import {microTasker} from './utils.mjs'

// 1. Récupération de la configuration depuis les constantes : **Obligatoire**
const {priority, capacity} = MICROTASK.SYSTEM_ACTION_NAME

// 2. Enregistrement de la tâche
// capacity correspond à 'capacityUnits' (1 unit = 0.25ms)
// fonctions anonymes interdites, this.myMethod doit avoir été bindée à this
microTasker.enqueue(this.myMethod, priority, capacity, arg1, arg2)
```

### Class `TaskScheduler` (Singleton: `taskScheduler`)
* `init(time: number): void` - Vide la file et initialise le temps de référence.
* `enqueue(id: string, delay: number, fn: function, priority: int, cap: int, ...args): number`
* `requeue(id: string, delay: number, fn: function, priority: int, cap: int, ...args): number`
* `extendTask(id: string, delay: number, fn: function, priority: int, cap: int, ...args): number`
* `enqueueAbsolute(id: string, time: number, fn: function, priority: int, cap: int, ...args): number`
* `enqueueOnce(id: string, delay: number, fn: function, priority: int, cap: int, ...args): number`
* `enqueueAfter(idOrRegex: string|RegExp, newId: string, delay: number, fn: function, priority: int, cap: int, ...args): number`
* `dequeue(idOrRegex: string|RegExp): void`
* `has(idOrRegex: string|RegExp): boolean`
* `findFirstTarget(idOrRegex: string|RegExp): Task|undefined`
* `findAction(idOrRegex: string|RegExp, params?: Array): Task|undefined`
* `clear(): void`
* `queueSize: number` (getter)
* `update(currentTime: number): void` (appel uniquememnt par `gameCore`)

### Usage Patterns (Standard)

**1. Tâche différée simple** (Ex: Fin de cooldown)

```javascript
import { MICROTASK } from './constant.mjs'
import { taskScheduler } from './utils.mjs'

const { priority, capacity } = MICROTASK.SPELL_COOLDOWN
// "fireball_cd" est l'ID unique. 500ms est le délai.
taskScheduler.enqueue('fireball_cd', 500, this.resetCooldown, priority, capacity, 'fireball')
```

**2. Debounce / Extension** (Ex: Régénération de vie après dernier dégât) Si le joueur reprend des dégâts, on repousse le début de la régénération.

```javascript
// Si une tâche "regen_start" existe, son délai est repoussé de 3000ms à partir de maintenant.
// Sinon, elle est créée.
const { priority, capacity } = MICROTASK.START_REGEN
taskScheduler.extendTask('regen_start', 3000, this.startRegen, priority, capacity)
```

**3. Chaînage d'actions** (Ex: Animation de mort puis Drop de loot) Lance le drop 200ms APRÈS la fin de la tâche 'monster_death_anim'.

```javascript
taskScheduler.enqueueAfter(
    'monster_death_anim', // ID cible (ou Regex)
    'monster_loot_drop',  // Nouvel ID
    200,                  // Délai après la cible
    this.dropLoot,
    priority, capacity,
    lootData
)
```

### Class `SeededRNG` (Singleton: `seededRNG`)

* `init(seed?: string|number): void`
* `randomGet(): number`
* `randomGetBool(): boolean`
* `randomInteger(a?: any, b?: number): number|any` (Polyvalent: Range, Array, MinMax)
* `randomReal(a?: any, b?: number): number`
* `randomGetMax(max: number): number`
* `randomGetMinMax(min: number, max: number): number`
* `randomGetArrayValue(arr: Array): any`
* `randomGetArrayIndex(arr: Array): int`
* `randomGetArrayWeighted(arr: Array<{weight}>): int` (Retourne l'index)
* `randomGaussian(mean?: number, sd?: number): number`
* `randomLinear(): number`

## database.mjs (layer 1)

### Class `Database` (Singleton: `database`)

* `init(): Promise<void>`
* `clearAllObjectStores(): Promise<void>`
* `clearObjectStore(storeName: string): Promise<void>`
* `hasObjetStore(storeName: string): boolean`
* `countRecords(storeName: string): integer`
* `getRecordByKey(store, key): Promise<any>`
* `readAllFromObjectStore(storeName: string): Promise<Array>`
* `openTransaction(storeNames: string | string[], mode?: string): IDBTransaction`
* `addOrUpdateRecord (storeName, record, existingTransaction?): Promise<void>`
* `addOrUpdateOrDeleteRecords(storeName: string, records: Array, transaction?: IDBTransaction): Promise<Array>`
* `addMultipleRecords(storeName: string, records: Array): Promise<Array>`
* `batchUpdate(updates: Array<{storeName, record?, delete?, records?}>): Promise<Array>`
* `deleteRecord(storeName: string, key: any, transaction?: IDBTransaction): Promise<void>`
* `deleteMultipleRecords(storeName: string, keys: Array): Promise<void>`
* `getAllGameState(): Promise<any>` - Retourne un objet fusionné (Map clé/valeur)
* `setGameState(key: string, value, transaction?): Promise`
* `batchSetGameState(updates: Array): Promise<any>`- Format updates: `{key, value}`
* `getGameStateValue(key: string): Promise<any>`
* `backupDatabase(): Promise<void>` - Télécharge un JSON complet.
* `restoreDatabase(file: File): Promise<void>` - Écrase et remplace la DB depuis un fichier.

### Class `UniqueIdGenerator` (Singleton: `uniqueIdGenerator`)

Génère des IDs logiques alphabétiques uniques (ex: `aab`, `aac`).
* `init(lastSavedSeed?: string): void` : À appeler au démarrage avec la valeur stockée en DB (sans paramètre avant la création d'un nouveau monde).
* `getUniqueId(): string` : Retourne un ID unique

## core.mjs (layer 3)

### Class GameCore (Singleton: gameCore)

* `boot(): Promise<void> (Technical init)`
* `startSession(): Promise<void> (Game start)`
* `loop(timestamp): void`



## EventBus Contracts (API)

Cette section définit les événements officiels. Tout nouvel événement doit être enregistré ici avant implémentation.

### Time & Environment (`TimeManager`)
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `time/clock` | `{ day, hour, minute }` | Émis chaque minute-jeu. |
| `time/every-5-minutes` | `{ day, hour, minute }` | Émis toutes les 5 minutes-jeu. |
| `time/every-hour` | `{ day, hour, minute, isDay }` | Émis à chaque changement d'heure. |
| `time/timeslot` | `{ tslot, isDay }` | Émis toutes les 3h (changement de slot). |
| `time/daily` | `{ day, weather, nextWeather, moonPhase }` | Émis à minuit (changement de jour). |
| `time/first-loop` | `{ day, hour, minute, tslot, weather, nextWeather, skyColor, moonPhase, isDay }` | Émis une seule fois au démarrage du rendu. |
| `time/sky-color-changed`| `string` (Hex Color) | Émis uniquement si la couleur change. |

### Core / State (`InputManager`)
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `state/changed` | `{ state, oldState }` | Émis lorsque l'`InputManager` change l'état global du jeu (Exploration <-> Information/Combat). |

### UI / Interface (Common)
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `overlay/close` | `string` (Overlay ID) | Demande générique de fermeture émise par le bouton 'X' d'un overlay. Traitée par `InputManager`. |

### Inventory (`InventoryManager`, `InventoryOverlay`)
*En prévision*
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `inventory/open`| - | Demande d'ouverture du panel d'inventaire. |
| `inventory/close`| - | Demande de fermeture du panel d'inventaire. |
| `inventory/static-buffs`| `Array<string>` (List of buffs) | Émis à la fermeture de l'inventaire. |

### Craft (`CraftOverlay`)
*En prévision*
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `craft/open`| - | Demande d'ouverture du panel d'artisanat. |
| `craft/close`| - | Demande de fermeture du panel d'inventaire. |

### Help (`HelpOverlay`)
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `help/open`| - | Demande d'ouverture du panel d'artisanat. |
| `help/close`| - | Demande de fermeture du panel d'inventaire. |

### Combat (`CombatOverlay`)
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `combat/open`| - | Demande d'ouverture du panel d'artisanat. |
| `combat/close`| - | Demande de fermeture du panel d'inventaire. |

### Buffs (`BuffManager`)
*En prévision*
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `buff/display-next-weather` | `boolean` | Active/Désactive la prévision météo. |
| `buff/display-coords` | `boolean` | Active/Désactive l'affichage des coordonnées. |
| `buff/display-time-precision` | `integer` | précision 0 => 1heure, 1 => 15 minutes, 2 => 5 minutes |
| `buff/display-moon-detail` | `boolean` | affiche 4 (false) ou 8 (true) phases lunaires |

### Debug (`WorldMapDebug`, `RealtimeDebugOverlay`)
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `map/open`| - | Demande d'ouverture de la carte au 1/16e. |
| `map/close`| - | Demande de fermeture de la carte au 1/16e. |
| `debug/frame-sample`| `{updateTime, renderTime, microTime}` | Temps exécution dans la loop pour les 3 budgets. |
