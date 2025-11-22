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

// 1. Récupération de la configuration depuis les constantes
const {priority, capacity} = MICROTASK.SYSTEM_ACTION_NAME

// 2. Enregistrement de la tâche
// capacity correspond à 'capacityUnits' (1 unit = 0.25ms)
microTasker.enqueue(this.myMethod, priority, capacity, arg1, arg2)
```

### Class `TaskScheduler` (Singleton: `taskScheduler`)
* `initTime(time: number): void`
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

## core.mjs (layer 3)

### Class GameCore (Singleton: gameCore)

* `boot(): Promise<void> (Technical init)`
* `startSession(): Promise<void> (Game start)`
* `loop(timestamp): void`
