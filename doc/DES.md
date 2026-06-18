# Sixty-Below - Technical API Reference

> **Purpose:**
> This document is designed for an AI or developer to **correctly use existing classes and functions** without reinventing or misusing the architecture.

---

## 1. Core Constraints

### 1.1 Non-Negotiable Rules

- **Performance:** 60 FPS mandatory. **Total engine budget: 12 ms/frame** (4 ms reserved for browser DOM overhead).
- **Stack:** Vanilla JavaScript (ESNext). **No frameworks, no bundlers.**
- **Architecture:** Client-side only. Persistence via **IndexedDB** (use `persistence.mjs` and `database.mjs`).
- **Hosting:** Serverless (GitHub Pages).
- **Timers:** **`setTimeout`/`setInterval` are forbidden.** Use `TaskScheduler` or `MicroTasker`.
- **Memory:** **Zero allocations** in `update` and `render` loops. Use TypedArrays and bitwise operations.
- **Hot Paths:** Avoid `map`, `filter`, `forEach` in critical loops. Use `for` or `for...of`.
- **EventBus:** Listeners exceeding **0.1 ms** must delegate to `MicroTasker`.
- **Linter:** Google Standard JavaScript Style Guide — no semicolons at the end of statements.


---

## 2. Frame Budget &amp; Execution Model

### 2.1 Phase Budgets

Each frame is divided into **4 phases** with strict time limits:


| Phase       | Budget | Purpose                                                       | API/Component        |
| ----------- | ------ | ------------------------------------------------------------- | -------------------- |
| `UPDATE`    | 3 ms   | Physics, player/faune movement, `TimeManager` updates.        | Direct manager calls |
| `RENDER`    | 4 ms   | Draw visible tiles/entities. Uses `Camera` for culling.       | `render()` methods   |
| `MICROTASK` | 5 ms   | Environment behaviors, Player's actions.                      | `microTasker`        |
| `DOM`       | 4 ms   | Browser overhead (GC, Event Loop). **Not managed by engine.** | —                    |


**Total Engine Budget:** 12 ms.

### 2.2 Mandatory Usage Patterns

- **`UPDATE` Phase:** Direct calls to managers (e.g., `timeManager.update()`, `taskScheduler.update()`, `camera.update()`, `playerManager.update()`).
- **`RENDER` Phase:** Use `Camera` to determine visible elements. Canvas context is pre-offset.
- **`MICROTASK` Phase:** Use `microTasker.enqueue()` or `microTasker.enqueueOnce()`.
- **`DOM` Phase:** Not managed by the engine.

---

## 3. Architecture Layers &amp; Dependencies

### 3.1 Layered Structure

Modules are organized in **layers**. Dependencies **only go downward**.


| Layer | Modules                                       | Can Import From | Cannot Import From |
| ----- | --------------------------------------------- | --------------- | ------------------ |
| 0     | `constant.mjs`                                | —               | All other layers   |
| 1     | `utils.mjs`, `database.mjs`                   | Layer 0         | Layers 2+          |
| 2     | `core.mjs`                                    | Layers 0-1      | Layers 3+          |
| 3     | `assets.mjs`, `persistence.mjs`, `data/*.mjs` | Layers 0-2      | Layers 4+          |
| 4+    | `world.mjs`, `render.mjs`, etc.               | Layers 0-3      | Higher layers      |


**Rule:** A module in Layer N **must not** import from Layer N+1 or higher.

---

## 4. Key Modules &amp; Their APIs

### 4.1 `constant.mjs` (Layer 0)

- **Purpose:** Global constants, enums, bitmasks.
- **Exports:**
  - `FPS`, `FRAME_DURATION`, `TIME_BUDGET` (phase budgets).
  - `WORLD_WIDTH` (1024), `WORLD_HEIGHT` (512), `TILE_SIZE` (16).
  - `STATE` (enum: `EXPLORATION`, `INFORMATION`, `CREATION`, `COMBAT`).
  - `MICROTASK` (priority and capacity configurations).

---

### 4.2 `utils.mjs` (Layer 1)

#### `EventBus` (Singleton: `eventBus`)

- **Methods:**
  - `on(event: string, cb: function)`: Subscribe.
  - `off(event: string, cb: function)`: Unsubscribe.
  - `emit(event: string, data: any)`: Publish **synchronously**.
- **Rules:**
  - **No anonymous lambdas** in `on()` (cannot unsubscribe later).
  - **Bind callbacks** before registration: `this.myHandler = this.myHandler.bind(this)`.
  - Listeners &gt; 0.1 ms **must** delegate to `MicroTasker`.

**Example:**

```javascript
this.onOpen = this.onOpen.bind(this)
eventBus.on('inventory/open', this.onOpen)
// Later:
eventBus.off('inventory/open', this.onOpen)
```

#### `MicroTasker` (Singleton: `microTasker`)

- **Purpose:** Execute short deferred tasks within the `MICROTASK` phase budget (5 ms).
  - _Priority_: high priority increase the chance to be quickly executed
  - _Capacity_: microtask execution time, for Microtasker to fill as much as possible the 5ms budget.
  - Execution order is not warranty.
- **Methods:**
  - `enqueue(fn, priority, capacityUnits, ...args)`: Enqueue a repeatable task.
  - `enqueueOnce(fn, priority, capacityUnits, ...args)`: Enqueue a unique task.
  - `dequeue(fn)`: Dequeue a task.
  - `update(budgetMs: number)`: Called **only** by `GameCore`.
- **Rules:**
  - **No anonymous functions** (same as `EventBus`).
  - `capacityUnits`: 1 unit = 0.25 ms of budget.
  - Use `MICROTASK` constants from `constant.mjs` for priority and capacity.

**Example:**

```javascript
import { MICROTASK } from './constant.mjs'
const { priority, capacity } = MICROTASK.SYSTEM_ACTION_NAME
microTasker.enqueue(this.myMethod, priority, capacity, arg1, arg2)
```

#### `TaskScheduler` (Singleton: `taskScheduler`)

- **Purpose:** Manage long delayed tasks (≥1 frame).
- **Methods:**
  - `enqueue(id, delayMs, fn, priority, capacity, ...args)`: Schedule a task after `delayMs`.
  - `requeue(id, delayMs, fn, priority, capacity, ...args)`: Update the `delayMs` of an existing task after.
  - `enqueueOnce(id, delayMs, fn, priority, capacity, ...args)`: Schedule only if no active task with this `id`.
  - `enqueueAbsolute(id, time, fn, priority, capacity, ...args)`: Schedule at an absolute timestamp.
  - `extendTask(id, delay, fn, priority, capacityUnits, ...args)`: Add `delay` to the current scheduled time.
  - `enqueueAfter (idOrRegex, newId, delay, fn, priority, capacityUnits, ...args)`: Enqueue a new task with `delay` after last scheduled times.
  - `dequeue(idOrRegex)`: Remove tasks by ID or regex.
  - `update(currentTime: number)`: Called **only** by `GameCore`.
- **Rules:**
  - **No anonymous functions** (same as `MicroTasker`).
  - Method binded in `constructor`.
  - `id` must be a `string`.
  - Tasks are executed via `MicroTasker` when their time is reached.

**Example:**

```javascript
import { MICROTASK } from './constant.mjs'
const { priority, capacity } = MICROTASK.SYSTEM_ACTION_NAME
taskScheduler.enqueue('my_task_id', 2000, this.myMethod, priority, capacity, arg1, arg2)
```

#### `TimeManager` (Singleton: `timeManager`)

- **Purpose:** Manage **World Time** (day/night cycle, weather, moon).
- **Methods:**
  - `init(timestamp?: number, weather?: number, nextWeather?: number)`: Initialize.
  - `update()`: Update time and emit events.
  - `getTime()`: Get current world time.
- **Events:** Emits time-related events (e.g., `time/clock`, `time/daily`).



#### `BuffManager` (Singleton: `buffManager`)

- **Purpose:** Central authority for player buffs — numeric or boolean values that modify gameplay. Buffs are additive (never multiplied); default is `0` (falsy for booleans).
- **Buff naming:**
  - **Elementary buff** (camelCase, e.g. `armorHelmetMiningSpeed`, `rainy`, `lucky`): a raw stored value.
  - **Composed buff** (kebab-case, e.g. `mining-speed`, `movement-speed`): the sum of the elementary buffs that feed into it, computed on demand rather than stored.
- **Methods:**
  - `getBuff(name: string): number`: Returns the value of a single buff (elementary or composed). Returns `0` if the name is unknown.
  - `getBuffs(names: string[]): Object`: Returns `{name: value}` for several buffs in one call (use this instead of multiple `getBuff` calls in hot paths, e.g. loot rolling).
- **Rule:** Always read through `getBuff`/`getBuffs` — never assume a buff's storage mechanism (elementary vs composed) from the calling code.

---

### 4.3 `database.mjs`  (Layer 1) & `persistence.mjs` (Layer 3)
- **Purpose:** IndexedDB wrapper for persistence.

- **General Rules:**
  - **Only `GameCore`** is allowed to read from the database during session startup.
  - **No other class** may read from the database directly.

- **`gamestate` ObjectStore:**
  - Stores key/value pairs.
  - **Asynchronous Updates:**
    - Use `database.setGameState(key, value)` to update a single key asynchronously.
    - Use `database.batchSetGameState(updates)` to update multiple keys asynchronously.
  - **Synchronous Updates:**
    - Use `database.setGameState(key, value)` or `database.batchSetGameState(updates)` **only** inside the `save/tick` event handler.
    - **MicroTasker is forbidden** in this context.

- **Other ObjectStores:**
  - A **synchronous save** runs every 2 seconds via a queue of operations.
  - To add or modify a record: use `saveManager.queueStaticUpdate({storeName, record})`.
  - To delete a record (Soft Delete):
    - Set the record's `deleted` attribute to `true` and save it via `queueStaticUpdate`.
    - Immediately drop the record from your own in-memory structures — only the DB purge is deferred.
    - The actual DB removal happens during the next `startSession`, before `init()` is called.
  - **Forbidden:** Direct use of other database write functions.

---

### 4.4 `core.mjs` (Layer 2)

- **Purpose:** Game loop, input, and overlay management.
- **Exports:**
  - `GameCore`: main class
    - `startSession`: function to initialise all other classes.
        - only function where database is read.
        - could be called more than once (called when the application is launched **or** after the creation of a new world).
    - `loop`: Main loop (manage the three budgets).
  - `KeyboardManager`: Handles key input, manages the overlay stack.
  - `MouseManager`: Handles mouse input.

---

### 4.5 `world.mjs` (Layer 4)

- **Purpose:** World grid, physics, and entity management.
- **Methods:**
  - `getTile(x, y)`: Get tile ID at (x, y).
  - `setTile(x, y, tileId)`: Set tile at (x, y).
  - `getTileAt(index)`: Get tile ID at index ((y << 10) | x).
  - `setTileAt(index, tileId)`: Set tile at index ((y << 10) | x).
  - `getTilesInRect({x, y, w, h})`: Get tiles in a rectangular area.
  - `update()`: Update physics and entities. **Called automatically in `UPDATE` phase.**
  - `renderVisibleTiles()`: Render visible tiles. **Called automatically in `RENDER` phase.**
- **Rules:**
  - Prefer `getTileAt` to `getTile`.
  - Prefer `setTileAt` to `setTile`.

---

### 4.6 `Camera` (`render.mjs`)

- **Purpose:** Manages viewport and culling.

- **Usage:**
  - Listen to the `camera/preload-chunks-changed` eventBus.
  - A list of `preloadChunks` is provided as a parameter.
  - Build the list of items present in these chunks.
  - A `#byChunk = new Map()` can speed up this process.

- **Render:**
  - Draw only entities in `preloadChunks` to the canvas.
  - The canvas is pre-shifted, so use world coordinates directly.
  ```javascript
    const img = this.#boleteImage
    for (const record of this.#boleteDisplayed) {
      const pxX = (record.index & 0x3FF) << 4
      const pxY = (record.index >> 10) << 4
      ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
    }
  ```

---

### 4.7 `data/data.mjs` (Layer 3)

- **Purpose:** Business data (tiles, items, plants, recipes, etc.).
- **Exports:**
  - `NODES`: Object indexed by symbolic name (e.g., `NODES.CLAY`).
  - `NODES_LOOKUP`: Array indexed by numeric code (e.g., `NODES_LOOKUP[14]`).
  - `ITEMS`: Object indexed by item ID (e.g., `ITEMS.bkston`).
  - `RECIPES`: Object of crafting recipes.
- **Access Patterns:**
  ```javascript
  NODES.CLAY.code         // → 14 (numeric, for TypedArray usage)
  NODES_LOOKUP[14]        // → Full node object (hot path for render/physics)
  ITEMS.bkston            // → Full item object
  RECIPES                 // → Recipe object
  MONSTERS                // → Recipe object
  ```

---

## 5. Data Structures

### 5.1 World Grid

- **Structure:** 2D grid of `1024 x 512` tiles (fixed size).
- **Storage:** `Uint8Array` (1 byte per tile). **Do not access directly.** Use `world.getTileAt(index)` or `world.SetTileAt(index, NODE.CLAY.code)`.
- **Tile IDs:** Map to `NODES_LOOKUP` (defined in `data/data.mjs`).

---

## 6. Mandatory Patterns

### 6.1 Time-Based Operations

- **For eventBus handler > 0.1ms:** Use `MicroTasker`.
- **To run tasks under Micro-task Budget:** Use `MicroTasker`.
- **For tasks > 5ms, slipt in smaller parts:** Use `MicroTasker`.
- **For long delays :** Use `TaskScheduler`.
- **Never use:** `setTimeout`, `setInterval`, or `requestAnimationFrame` directly.

### 6.2 Rendering

- **Always use Listen to the `camera/preload-chunks-changed` eventBus (`Camera`)** to determine visible elements.
- **Canvas context offset:** The context is pre-translated by `Camera`. Render directly at world coordinates.

### 6.3 Data Access

- **World Grid:** Use `world.getTileAt(inex)`. **Do not** access `Uint8Array` directly.
- **Prefer index towards (x,y)**
```javascript
    index = (y << 10) | x        // encodage
    x = index & 0x3FF            // décodage X
    y = index >> 10              // décodage Y
    index + WORLD_WIDTH          // tuile du dessous
```
- **Items/Recipes/Monsters:** Use `ITEMS`, `RECIPES` and ``MONSTERS`` objects from `data/data.mjs`.

### 6.4 Private variables/functions

- Use native class private functions (prefixed by `#`)
- Champs privés natifs (#variable), initialisés à la déclaration avec commentaire inline, jamais dans le constructeur

---

## 7. Common Mistakes to Avoid

- **Direct `Uint8Array` Access:** Always use `world.getTile(x, y)`.
- **Manual Timers:** Never use `setTimeout` or `setInterval`. Use `TaskScheduler` or `MicroTasker`.
- **Cross-Layer Imports:** Never import from a higher layer (e.g., `world.mjs` cannot import `combat.mjs`).
- **Overdraw:** Always use `Camera` for culling in `RENDER` phase.
- **Blocking the Main Thread:** Any operation &gt;0.1 ms must use `MicroTasker`.
- **Anonymous Lambdas in `EventBus` or Micro-task:** Always bind callbacks before registration.

---

## 8. Key Rules Summary


| Category             | Rule                                                                              |
| -------------------- | --------------------------------------------------------------------------------- |
| **Performance**      | 60 FPS mandatory. 12 ms total engine budget.                                      |
| **Dependencies**     | Only downward (Layer N → Layer N-1).                                              |
| **Timers**           | **Forbidden:** `setTimeout`, `setInterval`. Use `TaskScheduler` or `MicroTasker`. |
| **World Access**     | Use `world.getTile(x, y)`, **not** direct `Uint8Array` access.                    |
| **Rendering**        | Use `Camera` for culling. Canvas context is pre-offset.                           |
| **Long Operations**  | &gt;0.1 ms → `MicroTasker`. &gt;1 frame → `TaskScheduler`.                        |
| **Data Persistence** | Use `persistence.mjs` and `database.mjs` for IndexedDB operations.                |
| **EventBus**         | No anonymous lambdas. Bind callbacks before registration.                         |


---

## 9. Glossary


| Term              | Definition                                                                   |
| ----------------- | ---------------------------------------------------------------------------- |
| **AABB**          | Axis-Aligned Bounding Box. Used for collision detection.                     |
| **Bitmask**       | Combines multiple flags in a single integer                                  |
| **Camera**        | Manages viewport and culling for rendering.                                  |
| **EventBus**      | Synchroneous communication between classes.                                  |
| **MicroTasker**   | Manages short deferred tasks (≤5 ms total per frame).                        |
| **TaskScheduler** | Manages long delayed tasks (≥1 frame).                                       |
| **World Time**    | Fictional in-game time (day/night cycle, weather). Managed by `TimeManager`. |
| **Playtime**      | Real-time milliseconds since game start. Used by `TaskScheduler`.            |
