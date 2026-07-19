// ecosystem.mjs — FloraManager - OakSystem - MahoganySystem - CoconutSystem - ThornspineSystem
// SunflowerSystem - OleanderSystem - ParsnipSystem - AmbermirageSystem - CobwebSystem - HiveSystem
// SpreadForestSystem - SpreadJungleSystem - CoralSystem
// SampleSystem

import {WORLD_WIDTH, WORLD_HEIGHT, MICROTASK, TOPSOIL_Y_SKY_SURFACE, TOPSOIL_Y_SURFACE_UNDER, TOPSOIL_Y_UNDER_CAVERNS, SEA_LEVEL} from './constant.mjs'
import {database, uniqueIdGenerator} from './database.mjs'
import {eventBus, seededRNG, blockedTiles, microTasker, taskScheduler} from './utils.mjs'
import {NODES, ITEMS, PLANT_KIND, PLANT_TYPE, PLANT_SYSTEM_LOOKUP, ALL_PLANT_SYSTEMS, COBWEB_GROWTH_DELAY_MS, SUNFLOWER_RATE, PARSNIP_RATE, AMBERMIRAGE_PCENT, COCONUT_CYCLE_DELAY, TREE_IMAGES, THORNSPINE_JUNCTIONS, THORNSPINE_SIZES, THORNSPINE_UNBLOOM_PCENT, THORNSPINE_BLOOM_PCENT, CORAL_TYPES} from '../assets/data/data.mjs'
import {IMAGE_CACHE} from './assets.mjs'
import {saveManager} from './persistence.mjs'
import {chunkManager} from './world.mjs'
import {buffManager} from './buff.mjs'
import {camera} from './render.mjs'

/* ====================================================================================================
   HELPERS COMMUNS A TOUS LES SYSTEMS
   ==================================================================================================== */

// ── Helpers partagés par tous les systèmes de plantes ────────────────────────

/**
 * Ajoute un record dans byTile pour toutes les tuiles du rectangle (index, w, h).
 * @param {Map} byTile  @param {object} record
 */
const addToByTile = (byTile, record) => {
  const px = record.index & 0x3FF
  const py = record.index >> 10
  for (let dy = 0; dy < record.h; dy++) {
    const rowBase = (py + dy) << 10
    for (let dx = 0; dx < record.w; dx++) byTile.set(rowBase | (px + dx), record)
  }
}

/**
 * Retire un record de byTile pour toutes les tuiles du rectangle (index, w, h).
 * @param {Map} byTile  @param {object} record
 */
const removeFromByTile = (byTile, record) => {
  const px = record.index & 0x3FF
  const py = record.index >> 10
  for (let dy = 0; dy < record.h; dy++) {
    const rowBase = (py + dy) << 10
    for (let dx = 0; dx < record.w; dx++) byTile.delete(rowBase | (px + dx))
  }
}

/**
 * Ajoute un arbre dans byFullRect (rectangle complet 3×18, fixe) et dans byTile
 * (zone d'interaction effective, (size+2)*3 lignes). Deux boucles séquentielles
 * sans branchement : la première couvre les lignes hors zone active (byFullRect seul),
 * la seconde les lignes actives (byFullRect + byTile).
 * rowBase est incrémenté par WORLD_WIDTH à chaque ligne — pas de recalcul d'index.
 * @param {Map} byTile      — lookup interaction (tileIndex → record)
 * @param {Map} byFullRect  — lookup obstruction complète (tileIndex → record)
 * @param {object} record   — record TREE (oak, mahogany)
 */
const addToByTileTree = (byTile, byFullRect, record) => {
  const px = record.soilIndex & 0x3FF
  const soilY = record.soilIndex >> 10
  const hFull = record.h // 18, fixe
  const hActive = (record.size + 2) * 3 // zone d'interaction
  const hInert = hFull - hActive // lignes hors zone active
  const w = record.w
  let rowBase = (soilY - hFull) << 10

  // Boucle 1 — lignes hors zone active : byFullRect uniquement
  for (let dy = 0; dy < hInert; dy++, rowBase += WORLD_WIDTH) {
    for (let dx = 0; dx < w; dx++) byFullRect.set(rowBase | (px + dx), record)
  }

  // Boucle 2 — lignes de la zone active : byFullRect + byTile
  for (let dy = 0; dy < hActive; dy++, rowBase += WORLD_WIDTH) {
    for (let dx = 0; dx < w; dx++) {
      const tileIndex = rowBase | (px + dx)
      byFullRect.set(tileIndex, record)
      byTile.set(tileIndex, record)
    }
  }
}

/**
 * Retire un arbre de byFullRect et de byTile. Structure miroir d'addToByTileTree —
 * mêmes deux boucles séquentielles, set/delete inversés.
 * @param {Map} byTile      — lookup interaction (tileIndex → record)
 * @param {Map} byFullRect  — lookup obstruction complète (tileIndex → record)
 * @param {object} record   — record TREE (oak)
 */
const removeFromByTileTree = (byTile, byFullRect, record) => {
  const px = record.soilIndex & 0x3FF
  const soilY = record.soilIndex >> 10
  const hFull = record.h
  const hActive = (record.size + 2) * 3
  const hInert = hFull - hActive
  const w = record.w
  let rowBase = (soilY - hFull) << 10

  // Boucle 1 — lignes hors zone active : byFullRect uniquement
  for (let dy = 0; dy < hInert; dy++, rowBase += WORLD_WIDTH) {
    for (let dx = 0; dx < w; dx++) byFullRect.delete(rowBase | (px + dx))
  }

  // Boucle 2 — lignes de la zone active : byFullRect + byTile
  for (let dy = 0; dy < hActive; dy++, rowBase += WORLD_WIDTH) {
    for (let dx = 0; dx < w; dx++) {
      const tileIndex = rowBase | (px + dx)
      byFullRect.delete(tileIndex)
      byTile.delete(tileIndex)
    }
  }
}

/**
 * Ajoute un record dans byChunk (bucket du chunk du coin haut-gauche de index).
 * @param {Map} byChunk  @param {object} record
 */
const addToByChunk = (byChunk, record) => {
  const chunkKey = ((record.index >> 14) << 6) | ((record.index & 0x3FF) >> 4)
  let set = byChunk.get(chunkKey)
  if (set === undefined) { set = new Set(); byChunk.set(chunkKey, set) }
  set.add(record)
}

/**
 * Retire un record de byChunk.
 * @param {Map} byChunk  @param {object} record
 */
const removeFromByChunk = (byChunk, record) => {
  const set = byChunk.get(((record.index >> 14) << 6) | ((record.index & 0x3FF) >> 4))
  if (set !== undefined) set.delete(record)
}

/**
 * Reconstruit displayed depuis byChunk et les chunks preload courants de la caméra.
 * @param {Set} displayed  @param {Map} byChunk  @param {Set<number>} preloadChunks
 */
const buildDisplayed = (displayed, byChunk, preloadChunks) => {
  displayed.clear()
  for (const chunkKey of preloadChunks) {
    const set = byChunk.get(chunkKey)
    if (set === undefined) continue
    for (const record of set) displayed.add(record)
  }
}

/**
 * Ajoute un record dans displayed si son chunk est dans les chunks preload courants.
 * @param {Set} displayed
 * @param {object} record
 */
const addToDisplayed = (displayed, record) => {
  const chunkKey = ((record.index >> 14) << 6) | ((record.index & 0x3FF) >> 4)
  if (camera.preloadChunks.has(chunkKey)) displayed.add(record)
}

/**
 * Retrouve l'index de la tuile de surface d'une colonne depuis un index de départ
 * quelconque dans cette colonne. Si la tuile de départ n'est pas SKY, remonte jusqu'au
 * premier SKY — la surface est juste en dessous. Si elle est SKY, descend jusqu'à la
 * première tuile non-SKY — c'est la surface. Coût variable selon le relief (généralement
 * quelques tuiles, borné par WORLD_HEIGHT dans le pire cas) — réservé aux micro-tâches.
 * @param {number} index — tuile de départ, (y << 10) | x
 * @returns {number} index de la tuile de surface
 */
const findSurfaceIndex = (index) => {
  const SKY = NODES.SKY.code
  if (chunkManager.getTileAt(index) !== SKY) {
    let idx = index - WORLD_WIDTH
    while (chunkManager.getTileAt(idx) !== SKY) idx -= WORLD_WIDTH
    return idx + WORLD_WIDTH
  }
  let idx = index + WORLD_WIDTH
  while (chunkManager.getTileAt(idx) === SKY) idx += WORLD_WIDTH
  return idx
}

/* ====================================================================================================
   THORNSPINE SYSTEM
   ==================================================================================================== */

const THORNSPINE_REGROW_DELAY_MS = 1257 // délai de rappel de la tâche de recherche de place (constante locale)

class ThornspineSystem {
  byTile = new Map() // Map<tileIndex, record> — public, lookup interaction (rectangle complet w×h)
  #list = [] // record[] — tous les thornspines
  #byChunk = new Map() // Map<chunkKey, Set> — lookup spatial pour onPreloadChunksChanged
  #displayed = new Set() // Set<record> — cible du render (chunks preload uniquement)
  #flowerImage = null // image ITEMS.thornspineFlower.placed
  #regrowQueue = [] // record[] — thornspines absents (present=false) en attente d'une place

  /**
   * Abonnement EventBus unique du système ('time/every-hour'), lié une seule fois à la
   * construction (pas dans init(), pour éviter les abonnements dupliqués entre sessions).
   */
  constructor () {
    // eventBus
    this.onHourThornspine = this.onHourThornspine.bind(this)
    eventBus.on('time/every-hour', this.onHourThornspine)
    // Micro-tâche
    this.thornspineRegrow = this.thornspineRegrow.bind(this)
  }

  /**
   * Réinitialise toutes les structures.
   */
  init () {
    this.byTile.clear()
    this.#list.length = 0
    this.#byChunk.clear()
    this.#displayed.clear()
    this.#flowerImage = ITEMS.thornspineFlower.placed // après hydratation
  }

  /**
   * Enregistre un thornspine. Population fixe (this.#quota) posée une fois pour toutes à la
   * génération — aucun record n'est jamais créé ni supprimé en DB après coup. 'present' fait
   * seul foi de l'existence :
   *   - present=false : le record ne correspond à rien actuellement → stocké dans #list (pool
   *     des absents), aucune structure spatiale ni blocage de tuile.
   *   - present=true  : enregistrement spatial complet (byTile, #byChunk, blockedTiles).
   * @param {object} record — record TREE/THORNSPINE
   */
  initPlant (record) {
    this.#list.push(record)

    if (!record.present) {
      this.#trackAbsent(record)
      return
    }
    addToByTile(this.byTile, record)
    addToByChunk(this.#byChunk, record)

    const px = record.index & 0x3FF
    const py = record.index >> 10
    blockedTiles.blockPlacementRect(px, py, record.w, record.h)

    const soilX = record.soilIndex & 0x3FF
    const soilY = record.soilIndex >> 10
    blockedTiles.blockMiningRect(soilX, soilY, record.w, 1)
  }

  /**
   * Reconstruit #displayed depuis les chunks preload de la caméra.
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) {
    buildDisplayed(this.#displayed, this.#byChunk, preloadChunks)
  }

  /**
   * Dessine les thornspines visibles. Chaque record trace la totalité de
   * son tableau 'images' (segments empilés bas → haut, 3 tuiles/segment).
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  render (ctx) {
    const flower = this.#flowerImage

    for (const record of this.#displayed) {
      const soilYPx = ((record.soilIndex >> 10) << 4) + 2
      for (let i = 0; i < record.images.length; i++) {
        const image = record.images[i]
        const img = TREE_IMAGES[image.tree][image.key][image.col]
        const pxX = image.x << 4
        const pxY = soilYPx - 48 * (i + 1)
        ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
      }

      if (!record.bloom) continue

      const pxX = ((record.index & 0x3FF) << 4) + 17
      const pxY = ((record.index >> 10) << 4) + 46
      ctx.drawImage(IMAGE_CACHE[flower.imgIndex], flower.sx, flower.sy, flower.sw, flower.sh, pxX, pxY, flower.sw, flower.sh)
    }
  }

  /**
   * Retire un thornspine du monde sans le supprimer en DB : passe present à false, libère
   * toutes les structures spatiales et les tuiles bloquées, persiste.
   * @param {object} record — record TREE (thornspine)
   */
  #destroy (record) {
    record.present = false

    removeFromByTile(this.byTile, record)
    removeFromByChunk(this.#byChunk, record)
    this.#displayed.delete(record)

    const px = record.index & 0x3FF
    const py = record.index >> 10
    blockedTiles.unblockPlacementRect(px, py, record.w, record.h)

    const soilX = record.soilIndex & 0x3FF
    const soilY = record.soilIndex >> 10
    blockedTiles.unblockMiningRect(soilX, soilY, record.w, 1)

    this.#trackAbsent(record)
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
   * Callback ChoppingManager (action.mjs) : un seul coup de hache détruit le thornspine.
   * @param {object} record — record TREE (thornspine)
   */
  onChopped (record) {
    this.#destroy(record)
  }

  /**
   * Le thornspine ne se secoue pas.
   * @returns {boolean}
   */
  canShake () { return false }

  /**
   * Indique si le thornspine peut être fauché à la Sickle : uniquement lorsqu'il porte des
   * fleurs.
   * @param {object} record
   * @returns {boolean}
   */
  canForage (record) { return record.bloom === true }

  /**
   * Fait disparaître les fleurs d'un thornspine (bloom repasse à false) et persiste. Le
   * thornspine lui-même reste en place — seul l'état floraison change.
   * @param {object} record
   */
  onForaged (record) {
    record.bloom = false
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
   * Retourne le thornspine couvrant la tuile donnée, ou null.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {object|null}
   */
  getPlantAt (tileIndex) {
    return this.byTile.get(tileIndex) ?? null
  }

  /**
   * Indique si le thornspine existe actuellement dans le monde.
   * @param {object} record
   * @returns {boolean}
   */
  isPresent (record) { return record.present }

  // ///////////////////// //
  // POUSSE DES THORNSPINE //
  // ///////////////////// //

  /**
   * Ajoute un thornspine à la file de repousse. Démarre la tâche périodique de recherche de
   * place si la file était vide (évite les doublons de tâche planifiée en parallèle).
   * @param {object} record — record TREE (thornspine), present=false
   */
  #trackAbsent (record) {
    this.#regrowQueue.push(record)
    if (this.#regrowQueue.length !== 1) return

    const {priority, capacity} = MICROTASK.THORNSPINE_REGROW
    taskScheduler.enqueue('thornspine-regrow', THORNSPINE_REGROW_DELAY_MS, this.thornspineRegrow, priority, capacity)
  }

  /**
   * Tire une colonne aléatoire et teste si ses 3 tuiles de surface sont SAND à la même
   * hauteur, avec 3 tuiles de SKY juste au-dessus, et si les 6 tuiles sont libres de tout
   * blocage (blockedTiles).
   * @returns {number|null} soilIndex (tuile de sol gauche) si valide, sinon null
   */
  #findThornspineSoil () {
    const SAND = NODES.SAND.code
    const SKY = NODES.SKY.code
    const w = 3

    const x = seededRNG.randomGetMinMax(1, WORLD_WIDTH - w - 1)
    const soilIndex = findSurfaceIndex((TOPSOIL_Y_SKY_SURFACE << 10) | x)
    const soilY = soilIndex >> 10

    if (!chunkManager.isRectCode(x, soilY, w, 1, SAND)) return null
    if (!chunkManager.isRectCode(x, soilY - 1, w, 1, SKY)) return null
    if (!blockedTiles.canMineRect(x, soilY, w, 1)) return null
    if (!blockedTiles.canPlaceRect(x, soilY - 1, w, 1)) return null

    return soilIndex
  }

  /**
   * Tire une hauteur (via THORNSPINE_SIZES) et vérifie que la zone
   * aérienne correspondante (3 tuiles de large, h de haut, au-dessus de soilIndex) est
   * intégralement SKY et libre de tout blocage.
   * @param {number} soilIndex — tuile de sol gauche
   * @returns {number} hauteur en tuiles si valide, 0 sinon
   */
  #findThornspineHeight (soilIndex) {
    const w = 3
    const x = soilIndex & 0x3FF
    const soilY = soilIndex >> 10
    const size = seededRNG.randomGetArrayValue(THORNSPINE_SIZES)
    const h = size * 3
    const topY = soilY - h

    if (!chunkManager.isRectCode(x, topY, w, h, NODES.SKY.code)) return 0
    if (!blockedTiles.canPlaceRect(x, topY, w, h)) return 0

    return h
  }

  /**
   * Construit la chaîne d'images d'un thornspine (base + tronçons + head) : chaque
   * frontière entre segments tire une jonction indépendante parmi
   * THORNSPINE_JUNCTIONS, chaînée à la précédente ; la base a toujours '0T0' au sol.
   * @param {number} soilX — coordonnée X de la tuile support gauche
   * @param {number} size — nombre total de segments
   * @returns {Array<{tree, key, col, x}>}
   */
  #buildThornspineImages (soilX, size) {
    const imageTable = TREE_IMAGES.thornspine
    const images = []
    let bottom = '0T0'

    for (let i = 0; i < size - 1; i++) {
      const top = seededRNG.randomGetArrayValue(THORNSPINE_JUNCTIONS)
      const key = `${bottom}-${top}`
      const col = seededRNG.randomGetArrayIndex(imageTable[key])
      images.push({tree: 'thornspine', key, col, x: soilX - 1})
      bottom = top
    }

    const headKey = `head-${bottom}`
    const headCol = seededRNG.randomGetArrayIndex(imageTable[headKey])
    images.push({tree: 'thornspine', key: headKey, col: headCol, x: soilX - 1})

    return images
  }

  /**
   * Cherche une place valide pour le dernier thornspine de la file de repousse (sol, puis
   * hauteur). Si trouvé, le fait réapparaître (present, bloom, images, x/yTop/yBottom,
   * structures spatiales, blocage des tuiles, persistence) et le retire de la file.
   * Replanifie tant que la file n'est pas vide.
   */
  thornspineRegrow () {
    const soilIndex = this.#findThornspineSoil()

    if (soilIndex !== null) {
      const h = this.#findThornspineHeight(soilIndex)

      if (h !== 0) {
        const soilX = soilIndex & 0x3FF
        const soilY = soilIndex >> 10
        const size = h / 3
        const record = this.#regrowQueue[this.#regrowQueue.length - 1]

        record.index = soilIndex - h * WORLD_WIDTH
        record.soilIndex = soilIndex
        record.h = h
        record.size = size
        record.images = this.#buildThornspineImages(soilX, size)
        record.present = true
        record.bloom = false
        record.x = soilX
        record.yTop = soilY - h
        record.yBottom = soilY - 1

        addToByTile(this.byTile, record)
        addToByChunk(this.#byChunk, record)
        addToDisplayed(this.#displayed, record)

        const py = record.index >> 10
        blockedTiles.blockPlacementRect(soilX, py, record.w, h)
        blockedTiles.blockMiningRect(soilX, soilY, record.w, 1)

        saveManager.queueStaticUpdate({storeName: 'plant', record})

        this.#regrowQueue.length--
      }
    }

    if (this.#regrowQueue.length !== 0) {
      const {priority, capacity} = MICROTASK.THORNSPINE_REGROW
      taskScheduler.enqueue('thornspine-regrow', THORNSPINE_REGROW_DELAY_MS, this.thornspineRegrow, priority, capacity)
    }
  }

  // ////// //
  // FLEURS //
  // ////// //

  /**
   * Liaison EventBus : 'time/every-hour' — parcourt un quart de #list (offset = hour % 4, step 4), ignore les absents
   * (present=false), et fait basculer 'bloom' de façon asymétrique :
   *   - NF → F avec probabilité THORNSPINE_BLOOM_PCENT
   *   - F → NF avec probabilité THORNSPINE_UNBLOOM_PCENT
   * Persiste tous les records modifiés en un seul appel batché.
   * @param {{hour: number}} payload
   */
  onHourThornspine ({hour}) {
    const offset = hour % 4
    const updates = []

    for (let i = offset; i < this.#list.length; i += 4) {
      const record = this.#list[i]
      if (!record.present) continue

      if (record.bloom) {
        if (!seededRNG.randomGetPercent(THORNSPINE_UNBLOOM_PCENT)) continue
        record.bloom = false
      } else {
        if (!seededRNG.randomGetPercent(THORNSPINE_BLOOM_PCENT)) continue
        record.bloom = true
      }

      updates.push({storeName: 'plant', record})
    }

    if (updates.length !== 0) saveManager.queueStaticUpdate(updates)
  }
}
export const thornspineSystem = new ThornspineSystem()

/* ====================================================================================================
   CORAL SYSTEM

   Singleton : coralSystem.

   Gère les coraux du fond marin. Population fixe (cf. generate.mjs : placeCorals garantit
   toujours `count` records, comblés par des records dormants bloom=false si nécessaire) —
   aucune création/suppression de record en session, uniquement bloom true/false.

   Structure record : kind HERB · type CORAL_R/P/Y/G · w 2 · h 2 · pas de bloomTimestamp
   (la repousse est pilotée par #regrowQueue + gamestate.coralsearchtimestamp, pas par un
   timer individuel sur le record).
   ==================================================================================================== */

// Repousse des coraux — deux vitesses de relance de coralSearch selon le résultat de la
// tentative précédente
export const CORAL_SEARCH_DELAY_FOUND_MS = 1440 * 1000 // ~1 jour in-game — position trouvée
export const CORAL_SEARCH_DELAY_EMPTY_MS = 60 * 1000 // ~1 heure in-game — rien trouvé

// Approximation temporaire des mers, en attendant la gestion des liquides (non conçue à ce
// jour) qui fournira le rectangle englobant réel — cf. WorldCarver.addSeaExclusions() en
// génération, qui fait le calcul exact avec jitter.
// TODO : remplacer par le vrai rectangle une fois ce système conçu.
const CORAL_SEA_MAX_WIDTH = 90
const CORAL_SEA_MAX_HEIGHT = 150
const CORAL_SEA_RECTS = [
  {x1: 1, y1: SEA_LEVEL + 1, x2: CORAL_SEA_MAX_WIDTH, y2: SEA_LEVEL + CORAL_SEA_MAX_HEIGHT},
  {x1: WORLD_WIDTH - 1 - CORAL_SEA_MAX_WIDTH, y1: SEA_LEVEL + 1, x2: WORLD_WIDTH - 2, y2: SEA_LEVEL + CORAL_SEA_MAX_HEIGHT}
]

class CoralSystem {
  byTile = new Map() // Map<tileIndex, record> — public : membership O(1) + lookup record
  #list = [] // record[] — tous les coraux (bloom true ou false)
  #byChunk = new Map() // Map<chunkKey, Set> — lookup spatial pour onPreloadChunksChanged
  #displayed = new Set() // Set<record> — coraux dans les chunks preload (cible render)
  #regrowQueue = [] // record[] — coraux bloom=false en attente d'une position
  #searchtimestamp = null // timestamp de prochaine croissance de corail

  constructor () {
    // Micro-tâches
    this.coralSearch = this.coralSearch.bind(this)
  }

  /**
   * Réinitialise toutes les structures. Appelé en début de session, avant toute hydratation.
   */
  init () {
    this.byTile.clear()
    this.#list.length = 0
    this.#byChunk.clear()
    this.#displayed.clear()
    this.#regrowQueue.length = 0
  }

  /**
   * Initialise le temps de prochaine tentative de pousse d'un corail.
   * Appelé en début de session, avant toute hydratation.
   * @param {integer} timestamp
   */
  initTimestamp (timestamp) {
    this.#searchtimestamp = timestamp
  }

  /**
   * Hydrate un record depuis la DB. bloom=false → mis en attente de repousse (#regrowQueue),
   * sans déclenchement de recherche ici (cf. initSearch, appelé une fois toute l'hydratation
   * terminée). bloom=true → enregistré dans les structures spatiales et ses tuiles réservées
   * (placement sur le rectangle du corail, minage sur la tuile de sable sous lui).
   * @param {object} record — record HERB/CORAL_X (deleted=false garanti par l'appelant)
   */
  initPlant (record) {
    this.#list.push(record)
    if (!record.bloom) {
      this.#regrowQueue.push(record)
      if (this.#regrowQueue.length === 1) {
        const {priority, capacity} = MICROTASK.CORAL_SEARCH
        taskScheduler.enqueueAbsolute('coral-search', this.#searchtimestamp, this.coralSearch, priority, capacity)
      }
      return
    }

    addToByTile(this.byTile, record)
    addToByChunk(this.#byChunk, record)
    blockedTiles.blockPlacementRect(record.x, record.y, record.w, record.h)
    blockedTiles.blockMiningRect(record.x, record.y + record.h, record.w, 1)
  }

  debug () {
    console.log(`[CoralSystem] ${this.#list.length} coraux récupérés, ${this.#regrowQueue.length} en attente de repousse`)
  }

  /**
   * Une tentative de recherche de position (une colonne, une mer tirée au hasard). Si trouvée,
   * pose immédiatement le corail recyclé (bloom=true) et le retire de #regrowQueue. Relance
   * toujours la tâche si la file n'est pas vide — délai long si une position vient d'être
   * trouvée (pas d'urgence pour le suivant), court sinon (retenter vite). Persiste l'échéance
   * dans gamestate à chaque relance, pour rester correcte après un rechargement (cf. initTimestamp).
   */
  coralSearch () {
    const record = this.#regrowQueue[this.#regrowQueue.length - 1]
    const floorIndex = this.#findCoralFloor()
    const soilX = floorIndex !== -1 ? this.#findCoralSide(floorIndex) : -1
    const found = soilX !== -1

    if (found) {
      const y = floorIndex >> 10
      const soilIndex = (y << 10) | soilX
      const {type, itemId} = seededRNG.randomGetArrayValue(CORAL_TYPES)

      record.type = type
      record.itemId = itemId
      record.soilIndex = soilIndex
      record.index = soilIndex - record.h * WORLD_WIDTH
      record.x = soilX
      record.y = y - record.h
      record.bloom = true

      addToByTile(this.byTile, record)
      addToByChunk(this.#byChunk, record)
      blockedTiles.blockPlacementRect(record.x, record.y, record.w, record.h)
      blockedTiles.blockMiningRect(record.x, record.y + record.h, record.w, 1)
      saveManager.queueStaticUpdate({storeName: 'plant', record})
      buildDisplayed(this.#displayed, this.#byChunk, camera.preloadChunks)

      this.#regrowQueue.length--
    }

    if (this.#regrowQueue.length !== 0) {
      const base = found ? CORAL_SEARCH_DELAY_FOUND_MS : CORAL_SEARCH_DELAY_EMPTY_MS
      const delay = (base * seededRNG.randomGetRealMinMax(0.8, 1.2)) | 0
      const {priority, capacity} = MICROTASK.CORAL_SEARCH
      const timestamp = taskScheduler.enqueue('coral-search', delay, this.coralSearch, priority, capacity)
      database.setGameState('coralsearchtimestamp', timestamp)
    }
  }

  /**
   * Tire une mer et une colonne au hasard, descend jusqu'à la première tuile non-SEA.
   * @returns {number} index packé (y<<10)|x du sol si SAND trouvée dans les bornes du rect, -1 sinon
   */
  #findCoralFloor () {
    const SEA = NODES.SEA.code
    const SAND = NODES.SAND.code
    const rect = seededRNG.randomGetArrayValue(CORAL_SEA_RECTS)

    const cx = seededRNG.randomGetMinMax(rect.x1 + 1, rect.x2 - 2)
    let y = seededRNG.randomGetMinMax(rect.y1 + 1, rect.y2 - 2)

    if (chunkManager.getTile(cx, y) !== SEA) return -1
    while (y < rect.y2 && chunkManager.getTile(cx, y) === SEA) y++
    if (chunkManager.getTile(cx, y) !== SAND) return -1

    return (y << 10) | cx
  }

  /**
   * Teste les deux côtés du sol trouvé (SAND adjacent + pocket 2×2 SEA au-dessus + tuiles libres).
   * @param {number} floorIndex — retour de #findCoralFloor
   * @returns {number} soilX retenu, -1 si aucun côté valide
   */
  #findCoralSide (floorIndex) {
    const SEA = NODES.SEA.code
    const SAND = NODES.SAND.code
    const cx = floorIndex & 0x3FF
    const y = floorIndex >> 10

    const canRight = chunkManager.getTile(cx + 1, y) === SAND &&
      chunkManager.isRectCode(cx, y - 2, 2, 2, SEA) &&
      blockedTiles.canPlaceRect(cx, y - 2, 2, 2) && blockedTiles.canMineRect(cx, y, 2, 1)

    const canLeft = chunkManager.getTile(cx - 1, y) === SAND &&
      chunkManager.isRectCode(cx - 1, y - 2, 2, 2, SEA) &&
      blockedTiles.canPlaceRect(cx - 1, y - 2, 2, 2) && blockedTiles.canMineRect(cx - 1, y, 2, 1)

    if (!canLeft && !canRight) return -1
    return (canLeft && (!canRight || seededRNG.randomGetBool())) ? cx - 1 : cx
  }

  /**
   * Reconstruit #displayed depuis les chunks preload de la caméra.
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) {
    buildDisplayed(this.#displayed, this.#byChunk, preloadChunks)
  }

  /**
   * Dessine les coraux visibles. Une seule image par record (ITEMS[itemId].placed, sprite
   * 32×32 couvrant exactement le rectangle 2×2) — pas de variante gauche/droite, pas de calque
   * supplémentaire : #displayed ne contient que des records bloom=true.
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  render (ctx) {
    for (const record of this.#displayed) {
      const img = ITEMS[record.itemId].placed
      const pxX = record.x << 4
      const pxY = record.y << 4
      ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
    }
  }

  /**
   * Traite le foraging réussi : retire le corail des structures actives, libère ses tuiles,
   * bascule bloom=false et le met en attente de repousse, programme une nouvelle
   * recherche taskScheduler.
   * @param {object} record
   */
  onForaged (record) {
    removeFromByTile(this.byTile, record)
    removeFromByChunk(this.#byChunk, record)
    this.#displayed.delete(record)
    blockedTiles.unblockPlacementRect(record.x, record.y, record.w, record.h)
    blockedTiles.unblockMiningRect(record.x, record.y + record.h, record.w, 1)

    record.bloom = false
    saveManager.queueStaticUpdate({storeName: 'plant', record})
    this.#regrowQueue.push(record)
    if (this.#regrowQueue.length !== 1) return

    const {priority, capacity} = MICROTASK.CORAL_SEARCH
    const timestamp = taskScheduler.enqueue('coral-search', CORAL_SEARCH_DELAY_EMPTY_MS, this.coralSearch, priority, capacity)
    database.setGameState('coralsearchtimestamp', timestamp)
  }

  /**
   * Retourne le record du corail couvrant la tuile donnée, ou null.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {object|null}
   */
  getPlantAt (tileIndex) {
    return this.byTile.get(tileIndex) ?? null
  }

  /**
   * Indique si le record est actuellement présent (forageable).
   * @param {object} record
   * @returns {boolean}
   */
  isPresent (record) { return record.bloom }
}
export const coralSystem = new CoralSystem()

/* ====================================================================================================
   SUNFLOWER SYSTEM
   ====================================================================================================

   Singleton : sunflowerSystem.

   Gère les spots de tournesol sur les tuiles GRASSFOREST de surface.
   Chaque spot est toujours présent en DB — seul record.present indique si la fleur est visible.
   Apparition à l'aube, disparition au crépuscule (cycle géré par les événements de temps).

   Structure record :
     kind HERB · type SUNFLOWER · w 1 · h 2 · soilIndex GRASSFOREST
     present  — true si la fleur est affichée
     (pas de bloom / bloomTimestamp — la visibilité est pilotée par l'heure)

   ==================================================================================================== */

class SunflowerSystem {
  byTile = new Map() // Map<tileIndex, record> — public : membership O(1) + lookup record
  #list = [] // record[] — tous les spots (présents ou non)
  #byChunk = new Map() // Map<chunkKey, Set> — lookup spatial pour onPreloadChunksChanged
  #bySoil = new Map() // Map<soilIndex, record> — plantes présentes : détection minage de la tuile sol
  #spotsBySoil = new Map() // Map<soilIndex, record> — tous les spots (présents ou non) : suppression O(1)
  #displayed = new Set() // Set<record> — spots dans les chunks preload (cible render)

  #imgSeed = null // ITEMS.sunflowerSeed.placed — mis en cache dans init()
  #imgLeft = null // ITEMS.sunflower.placedLeft — tête à gauche (6h–10h), mis en cache dans init()
  #imgMid = null // ITEMS.sunflower.placed — tête au centre (10h–13h)
  #imgRight = null // ITEMS.sunflower.placedRight — tête à droite (13h–17h)
  #currentImage = null // pointeur vers l'image active

  #sewedTiles = [] // number[] — tileIndex des graines de sunflower plantées par le joueur

  constructor () {
    // eventBus
    this.onFirstLoopSunflower = this.onFirstLoopSunflower.bind(this)
    this.onHour6Sunflower = this.onHour6Sunflower.bind(this)
    this.onHour10Sunflower = this.onHour10Sunflower.bind(this)
    this.onHour13Sunflower = this.onHour13Sunflower.bind(this)
    this.onHour17Sunflower = this.onHour17Sunflower.bind(this)
    eventBus.on('time/first-loop', this.onFirstLoopSunflower)
    eventBus.on('time/every-hour-6', this.onHour6Sunflower)
    eventBus.on('time/every-hour-10', this.onHour10Sunflower)
    eventBus.on('time/every-hour-13', this.onHour13Sunflower)
    eventBus.on('time/every-hour-17', this.onHour17Sunflower)
    this.onTileChangedSunflower = this.onTileChangedSunflower.bind(this)
    eventBus.on('world/tile-changed', this.onTileChangedSunflower)
    this.onTreeDestroyedSunflower = this.onTreeDestroyedSunflower.bind(this)
    eventBus.on('ecosystem/tree-destroyed', this.onTreeDestroyedSunflower)
    this.onTreePlantedSunflower = this.onTreePlantedSunflower.bind(this)
    eventBus.on('ecosystem/tree-planted', this.onTreePlantedSunflower)
    this.onSewedSunflower = this.onSewedSunflower.bind(this)
    eventBus.on('sewed/sunflower', this.onSewedSunflower)
    // micro-tâches
    this.bloomSunflower = this.bloomSunflower.bind(this)
    this.unbloomSunflower = this.unbloomSunflower.bind(this)
    this.onSunflowerSpotCheck = this.onSunflowerSpotCheck.bind(this)
    this.onSunflowerLateralSpotCheck = this.onSunflowerLateralSpotCheck.bind(this)
    this.onSunflowerLateralSpotRemove = this.onSunflowerLateralSpotRemove.bind(this)
  }

  /**
   * Réinitialise toutes les structures.
   */
  init () {
    this.byTile.clear()
    this.#list.length = 0
    this.#byChunk.clear()
    this.#bySoil.clear()
    this.#spotsBySoil.clear()
    this.#displayed.clear()

    const item = ITEMS.sunflower // après hydratation
    this.#imgLeft = item.placedLeft
    this.#imgMid = item.placed
    this.#imgRight = item.placedRight
    this.#currentImage = this.#imgLeft

    this.#imgSeed = ITEMS.sunflowerSeed.placed // après hydratation
    this.#sewedTiles.length = 0
  }

  /**
   * Enregistre un spot et peuple les quatre structures internes.
   * @param {object} record — record HERB/SUNFLOWER actif (deleted=false garanti)
   */
  initPlant (record) {
    this.#list.push(record)
    this.#spotsBySoil.set(record.soilIndex, record)
    if (!record.present) return
    addToByTile(this.byTile, record)
    addToByChunk(this.#byChunk, record)
    this.#bySoil.set(record.soilIndex, record)
    blockedTiles.blockPlacement(record.index)
    blockedTiles.blockPlacement(record.index + WORLD_WIDTH)
  }

  /**
   * Reconstruit #displayed depuis les chunks preload de la caméra.
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) {
    buildDisplayed(this.#displayed, this.#byChunk, preloadChunks)
  }

  /**
    * Dessine les tournesols visibles et présents sur le contexte transformé.
    * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
    */
  render (ctx) {
    const img = this.#currentImage
    for (const record of this.#displayed) {
      const pxX = (record.index & 0x3FF) << 4
      const pxY = ((record.index >> 10) << 4) + 2
      ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
    }
    const seedImg = this.#imgSeed
    for (const tileIndex of this.#sewedTiles) {
      const pxX = (tileIndex & 0x3FF) << 4
      const pxY = (tileIndex >> 10) << 4
      ctx.drawImage(IMAGE_CACHE[seedImg.imgIndex], seedImg.sx, seedImg.sy, seedImg.sw, seedImg.sh, pxX, pxY, seedImg.sw, seedImg.sh)
    }
  }

  /**
 * Traite le foraging réussi : marque la fleur absente et persiste.
 * Le loot est géré en commun par ForagingManager — cette méthode ne gère que l'état de la plante.
 * @param {object} record
 */
  onForaged (record) {
    this.#destroyPresent(record)
  }

  /**
   * Retourne le record du tournesol couvrant la tuile donnée, ou null.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {object|null}
   */
  getPlantAt (tileIndex) {
    return this.byTile.get(tileIndex) ?? null
  }

  /**
 * Indique si le record est actuellement présent (forageable).
 * @param {object} record
 * @returns {boolean}
 */
  isPresent (record) { return record.present }

  // ////////////////////////////////////// //
  // GESTION DU CYCLE DE VIE DES SUNFLOWERS //
  // ////////////////////////////////////// //

  /** Liaison EventBus : 'time/every-hour-6' — apparition, tête à gauche. */
  onHour6Sunflower () {
    const {priority, capacity} = MICROTASK.BLOOM_SUNFLOWER
    microTasker.enqueue(this.bloomSunflower, priority, capacity)
  }

  /**
   * Microtâche : sélectionne un nombre cible de spots à faire fleurir (nbre_slots * SUNFLOWER_RATE
   * + aléa [-2, 2]), tire avec remise parmi #list jusqu'à atteindre ce nombre. Un spot déjà
   * planté dans cette passe ou bloqué (blockedTiles.canPlace échoue) est skippé et retiré du
   * budget de tentatives — borne MAX_ATTEMPTS, pas une valeur d'équilibrage.
   */
  bloomSunflower () {
    this.#currentImage = this.#imgLeft

    const list = this.#list
    const targetCount = Math.min(
      list.length,
      Math.max(0, ((list.length * SUNFLOWER_RATE) | 0) + seededRNG.randomGetMinMax(-2, 2))
    )

    const MAX_ATTEMPTS = 200 // borne de sécurité — pas une valeur d'équilibrage
    let grown = 0
    let attempts = 0
    while (grown < targetCount && attempts < MAX_ATTEMPTS) {
      attempts++
      const record = seededRNG.randomGetArrayValue(list)
      if (record.present) continue
      // TODO : prendre en compte les graines de sunflower plantées (influence sur le tirage)
      if (!blockedTiles.canPlace(record.index) || !blockedTiles.canPlace(record.index + WORLD_WIDTH)) continue

      this.#growSpot(record)
      grown++
    }
    this.growSewedSunflowers()
    buildDisplayed(this.#displayed, this.#byChunk, camera.preloadChunks)
  }

  /**
   * Fait pousser un spot sunflower : marque present, peuple les structures, bloque les
   * 2 tuiles du corps (record.index, record.index + W) et persiste. Aucune vérification —
   * l'appelant garantit que le spot est éligible (non present, tuiles libres).
   * @param {object} record
   */
  #growSpot (record) {
    record.present = true
    addToByTile(this.byTile, record)
    addToByChunk(this.#byChunk, record)
    this.#bySoil.set(record.soilIndex, record)
    blockedTiles.blockPlacement(record.index)
    blockedTiles.blockPlacement(record.index + WORLD_WIDTH)
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /** Liaison EventBus : 'time/every-hour-10' — pivot vers le centre. */
  onHour10Sunflower () { this.#currentImage = this.#imgMid }

  /** Liaison EventBus : 'time/every-hour-13' — pivot vers la droite. */
  onHour13Sunflower () { this.#currentImage = this.#imgRight }

  /** Liaison EventBus : 'time/every-hour-17' — disparition. */
  onHour17Sunflower () {
    const {priority, capacity} = MICROTASK.UNBLOOM_SUNFLOWER
    microTasker.enqueue(this.unbloomSunflower, priority, capacity)
  }

  /**
   * Microtâche : libère les tuiles bloquées, vide byTile, #byChunk et #displayed.
   */
  unbloomSunflower () {
    this.byTile.clear()
    this.#byChunk.clear()
    this.#displayed.clear()
    this.#bySoil.clear()

    for (const record of this.#list) {
      if (!record.present) continue
      record.present = false
      blockedTiles.unblockPlacement(record.index)
      blockedTiles.unblockPlacement(record.index + WORLD_WIDTH)
      saveManager.queueStaticUpdate({storeName: 'plant', record})
    }
  }

  /**
   * Synchronise l'image active et le flag present de tous les spots à l'heure courante.
   * Liaison EventBus : 'time/first-loop' — émis une seule fois au démarrage du rendu.
   * @param {{hour: number}} payload
   */
  onFirstLoopSunflower ({hour}) {
    if (hour < 10) this.#currentImage = this.#imgLeft
    else if (hour >= 13) this.#currentImage = this.#imgRight
    else this.#currentImage = this.#imgMid
  }

  /**
 * Détruit un tournesol présent sans loot : retire toutes les structures et persiste.
 * Guard : no-op si record.present est déjà false.
 * @param {object} record
 */
  #destroyPresent (record) {
    if (!record.present) return
    record.present = false
    removeFromByTile(this.byTile, record)
    removeFromByChunk(this.#byChunk, record)
    this.#bySoil.delete(record.soilIndex)
    this.#displayed.delete(record)
    blockedTiles.unblockPlacement(record.index)
    blockedTiles.unblockPlacement(record.index + WORLD_WIDTH)
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
 * Retire un spot de toutes les structures mémoire et le marque deleted en DB.
 * Détruit la fleur présente au préalable si nécessaire.
 * @param {object} record
 */
  #removeSpot (record) {
    this.#destroyPresent(record)
    const list = this.#list
    const idx = list.indexOf(record)
    if (idx !== -1) {
      list[idx] = list[list.length - 1]
      list.length--
    }
    this.#spotsBySoil.delete(record.soilIndex)

    // Retrait de la graine plantée sur ce spot, si elle existe
    const seedIdx = this.#sewedTiles.indexOf(record.soilIndex)
    if (seedIdx !== -1) {
      this.#sewedTiles[seedIdx] = this.#sewedTiles[this.#sewedTiles.length - 1]
      this.#sewedTiles.length--
      database.setGameState('sewedsunflower', this.#sewedTiles)
    }

    record.deleted = true
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
 * Microtâche : vérifie si une tuile devenue GRASSFOREST peut accueillir un nouveau spot.
 * Conditions : pas d'oak dans [x-minDist, x+minDist], pas de spot existant.
 * @param {number} soilIndex
 */
  onSunflowerSpotCheck (soilIndex) {
    const GRASSFOREST = NODES.GRASSFOREST.code
    const x = soilIndex & 0x3FF

    if (chunkManager.getTileAt(soilIndex) !== GRASSFOREST) return
    if (this.#spotsBySoil.has(soilIndex)) return
    if (oakSystem.isOakAtColumn((soilIndex & 0x3ff) - 2) || oakSystem.isOakAtColumn((soilIndex & 0x3ff) + 2)) return

    const y = soilIndex >> 10
    const index = soilIndex - 2 * WORLD_WIDTH
    const record = {
      id: uniqueIdGenerator.getUniqueId(),
      kind: PLANT_KIND.HERB,
      type: PLANT_TYPE.SUNFLOWER,
      index,
      soilIndex,
      itemId: 'sunflower',
      present: false,
      w: 1,
      h: 2,
      x,
      y: y - 2,
      deleted: false
    }
    this.#list.push(record)
    this.#spotsBySoil.set(soilIndex, record)
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
   * Liaison EventBus : 'ecosystem/tree-destroyed' — un arbre vient d'être abattu entièrement.
   * Les 3 tuiles sous l'arbre sont vérifiées directement (même y que tileIndex, pas de scan).
   * Les 2 colonnes de chaque flanc (zone auparavant exclue par la distance min. à l'oak)
   * peuvent avoir un relief différent : leur surface est recherchée en micro-tâche
   * (coût variable → hors budget handler).
   * @param {{tileIndex: number, treeId: string}} - tuile centrale du sol libéré / Identifiant de l'arbre
   */
  onTreeDestroyedSunflower ({tileIndex, treeId}) {
    if (treeId !== 'oak') return
    this.onSunflowerSpotCheck(tileIndex - 1)
    this.onSunflowerSpotCheck(tileIndex)
    this.onSunflowerSpotCheck(tileIndex + 1)

    const {priority, capacity} = MICROTASK.SUNFLOWER_LATERAL_SPOT_CHECK
    microTasker.enqueue(this.onSunflowerLateralSpotCheck, priority, capacity, tileIndex - 3, tileIndex - 2, tileIndex + 2, tileIndex + 3)
  }

  /**
   * Micro-tâche : vérifie les 4 emplacements latéraux d'un arbre abattu (2 par flanc).
   * Pour chaque tuile, teste d'abord la présence d'un oak vivant 2 tuiles plus loin du
   * flanc testé (structure 1-2-T-T-T-3-4) — si absent, recherche la surface de la colonne
   * (findSurfaceIndex, coût variable) et délègue à onSunflowerSpotCheck.
   * @param {number} i1 — tuile "1" (2 tuiles à gauche de l'arbre)
   * @param {number} i2 — tuile "2" (1 tuile à gauche de l'arbre)
   * @param {number} i3 — tuile "3" (1 tuile à droite de l'arbre)
   * @param {number} i4 — tuile "4" (2 tuiles à droite de l'arbre)
   */
  onSunflowerLateralSpotCheck (i1, i2, i3, i4) { // pas d'allocation de tableau
    if (!oakSystem.isOakAtColumn((i1 & 0x3ff) - 2)) this.onSunflowerSpotCheck(findSurfaceIndex(i1))
    if (!oakSystem.isOakAtColumn((i2 & 0x3ff) - 2)) this.onSunflowerSpotCheck(findSurfaceIndex(i2))
    if (!oakSystem.isOakAtColumn((i3 & 0x3ff) + 2)) this.onSunflowerSpotCheck(findSurfaceIndex(i3))
    if (!oakSystem.isOakAtColumn((i4 & 0x3ff) + 2)) this.onSunflowerSpotCheck(findSurfaceIndex(i4))
  }

  /**
   * Liaison EventBus : 'ecosystem/tree-planted' — un arbre vient d'être planté, occupant
   * 3 tuiles de sol à la même hauteur que tileIndex. Supprime directement les spots sunflower
   * existants sur ces 3 positions (s'il y en a). Les 4 tuiles latérales (relief potentiellement
   * différent) sont traitées en micro-tâche, symétriquement à onTreeDestroyedSunflower.
   * @param {{tileIndex: number, treeId: string}} - tuile centrale du sol libéré / Identifiant de l'arbre
   */
  onTreePlantedSunflower ({tileIndex, treeId}) {
    if (treeId !== 'oak') return
    let record = this.#spotsBySoil.get(tileIndex - 1)
    if (record !== undefined) this.#removeSpot(record)

    record = this.#spotsBySoil.get(tileIndex)
    if (record !== undefined) this.#removeSpot(record)

    record = this.#spotsBySoil.get(tileIndex + 1)
    if (record !== undefined) this.#removeSpot(record)

    const {priority, capacity} = MICROTASK.SUNFLOWER_LATERAL_SPOT_REMOVE
    microTasker.enqueue(this.onSunflowerLateralSpotRemove, priority, capacity, tileIndex - 3, tileIndex - 2, tileIndex + 2, tileIndex + 3)
  }

  /**
   * Micro-tâche : supprime les spots sunflower latéraux existants (2 par flanc) suite à une
   * plantation d'arbre. Pour chaque tuile, recherche sa surface réelle (findSurfaceIndex,
   * coût variable) puis supprime le spot s'il existe à ce soilIndex.
   * @param {number} i1 — tuile "1" (2 tuiles à gauche de l'arbre)
   * @param {number} i2 — tuile "2" (1 tuile à gauche de l'arbre)
   * @param {number} i3 — tuile "3" (1 tuile à droite de l'arbre)
   * @param {number} i4 — tuile "4" (2 tuiles à droite de l'arbre)
   */
  onSunflowerLateralSpotRemove (i1, i2, i3, i4) { // pas d'allocation de tableau
    let record = this.#spotsBySoil.get(findSurfaceIndex(i1))
    if (record !== undefined) this.#removeSpot(record)

    record = this.#spotsBySoil.get(findSurfaceIndex(i2))
    if (record !== undefined) this.#removeSpot(record)

    record = this.#spotsBySoil.get(findSurfaceIndex(i3))
    if (record !== undefined) this.#removeSpot(record)

    record = this.#spotsBySoil.get(findSurfaceIndex(i4))
    if (record !== undefined) this.#removeSpot(record)
  }

  /**
 * Liaison EventBus : 'world/tile-changed'.
 * — Détruit le tournesol présent si une tuile de son corps n'est plus SKY ou si son sol n'est plus GRASSFOREST.
 * — Supprime le spot si son sol n'est plus GRASSFOREST.
 * — Enqueue onSpotCheck si une tuile devient GRASSFOREST.
 * Relit les tuiles réelles avant d'agir.
 * @param {{tileIndex: number, tileOldCode: number, tileNewCode: number}} payload
 */
  onTileChangedSunflower ({tileIndex, tileOldCode, tileNewCode}) {
    const SKY = NODES.SKY.code
    const GRASSFOREST = NODES.GRASSFOREST.code

    // Cas 1 — tuile du corps
    if (tileNewCode !== SKY) {
      const byBodyRecord = this.byTile.get(tileIndex)
      if (byBodyRecord !== undefined) {
        const x = byBodyRecord.index & 0x3FF
        const y = byBodyRecord.index >> 10
        if (!chunkManager.isRectCode(x, y, 1, 2, SKY)) this.#destroyPresent(byBodyRecord)
      }
    }

    // Cas 2 — tuile sol : fleur présente + spot
    if (tileOldCode === GRASSFOREST) {
      const record = this.#spotsBySoil.get(tileIndex)
      if (record !== undefined &&
        chunkManager.getTileAt(record.soilIndex) !== GRASSFOREST) {
        this.#removeSpot(record)
      }
    }

    // Cas 3 — nouvelle tuile GRASSFOREST : candidat spot
    if (tileNewCode === GRASSFOREST) {
      const {priority, capacity} = MICROTASK.SUNFLOWER_SPOT_CHECK
      microTasker.enqueue(this.onSunflowerSpotCheck, priority, capacity, tileIndex)
    }
  }

  // /////// //
  // GRAINES //
  // /////// //

  /**
   * Restaure la liste des tuiles de graines de sunflower plantées par le joueur, lue depuis
   * gamestate au démarrage de session. Remplace le contenu courant de #sewedTiles.
   * @param {number[]} sewedTiles — tableau persisté (gamestate.sewedsunflower), [] si absent
   */
  initSeed (sewedTiles) {
    this.#sewedTiles.length = 0
    for (const tileIndex of sewedTiles) this.#sewedTiles.push(tileIndex)
  }

  /**
   * Fait pousser à 100% les sunflowers issus des graines plantées par le joueur (#sewedTiles).
   * Pour chaque tuile : ignore si plus de spot, déjà
   * present, ou l'une des 2 tuiles du corps (index, index+W) bloquée ou non-SKY. Sinon fait
   * pousser le spot. Vide #sewedTiles en une seule fois (toutes les graines sont consommées,
   * qu'elles aient germé ou non).
   */
  growSewedSunflowers () {
    if (this.#sewedTiles.length === 0) return
    const SKY = NODES.SKY.code
    const W = WORLD_WIDTH

    for (const tileIndex of this.#sewedTiles) {
      const record = this.#spotsBySoil.get(tileIndex)
      if (record === undefined) continue
      if (record.present) continue

      const tile1 = record.index
      const tile2 = record.index + W
      if (chunkManager.getTileAt(tile1) !== SKY) continue
      if (chunkManager.getTileAt(tile2) !== SKY) continue
      if (!blockedTiles.canPlace(tile1)) continue
      if (!blockedTiles.canPlace(tile2)) continue

      this.#growSpot(record)
    }

    this.#sewedTiles.length = 0
    database.setGameState('sewedsunflower', this.#sewedTiles)
  }

  /**
   * Liaison EventBus : 'sewed/sunflower' — le joueur a planté une graine de sunflower sur
   * une tuile GRASSFOREST valide (vérifications déjà faites par SewingManager). Mémorise la
   * tuile et persiste immédiatement la liste complète dans gamestate.
   * @param {number} tileIndex — (y << 10) | x, tuile plantée
   */
  onSewedSunflower (tileIndex) {
    if (!this.#spotsBySoil.has(tileIndex)) {
      console.error(`SunflowerSystem.onSewedSunflower: aucun spot à tileIndex ${tileIndex}`)
      return
    }
    this.#sewedTiles.push(tileIndex)
    database.setGameState('sewedsunflower', this.#sewedTiles)
  }

  /**
   * Indique si une SunflowerSeed peut être plantée sur ce soilIndex.
   * Conditions : pas d'oak à moins de 2 colonnes, pas de graine déjà semée sur ce slot.
   * @param {number} soilIndex — (y << 10) | x
   * @returns {boolean}
   */
  canSow (soilIndex, seed) {
    if (seed !== 'sunflowerSeed') return null
    const soilX = soilIndex & 0x3FF
    if (oakSystem.isOakAtColumn(soilX - 2) || oakSystem.isOakAtColumn(soilX + 2)) return false
    return !this.#sewedTiles.includes(soilIndex)
  }

  // ///// //
  // DEBUG //
  // ///// //

  /**
 * DEBUG — Affiche un cercle bleu au centre de chaque spot enregistré dans #list.
 * Vérifie la cohérence avec #spotsBySoil (même cardinal attendu).
 * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
 */
  debugRenderSpots (ctx) {
    ctx.save()
    ctx.fillStyle = 'rgba(0, 100, 255, 0.7)'
    for (const record of this.#list) {
      const cx = ((record.index & 0x3FF) << 4) + 8
      const cy = ((record.index >> 10) << 4) + 40
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, 6.2832)
      ctx.fill()
    }
    if (this.#list.length !== this.#spotsBySoil.size) {
      console.warn(`SunflowerSystem: #list(${this.#list.length}) !== #spotsBySoil(${this.#spotsBySoil.size})`)
    }
    ctx.restore()
  }
}
export const sunflowerSystem = new SunflowerSystem()

/* ====================================================================================================
   OLEANDER SYSTEM
   ====================================================================================================

   Singleton : oleanderSystem.

   Population constante : #list reçoit en une fois (init) le tableau complet des oleanders,
   taille fixe jamais réallouée (pas de GC). Un record present=false signale un slot à faire
   repousser ailleurs — mis en #regrowQueue, vidée par microtâche (contenu à définir).

   ==================================================================================================== */

class OleanderSystem {
  byTile = new Map() // Map<tileIndex, record> — public : membership O(1) + lookup record
  #list = [] // record[] — population fixe, référence affectée dans init(records)
  #byChunk = new Map() // Map<chunkKey, Set> — lookup spatial pour onPreloadChunksChanged
  #bySoil = new Map() // Map<soilIndex, record> — oleanders présents : détection retrait du sol
  #displayed = new Set() // Set<record> — cible du render (chunks preload uniquement)
  #regrowQueue = [] // record[] — records present=false en attente d'un nouvel emplacement
  #image = null // image à afficher (mise en cache)

  constructor () {
    // eventBus
    this.onFirstLoopOleander = this.onFirstLoopOleander.bind(this)
    eventBus.on('time/first-loop', this.onFirstLoopOleander)
    this.onTileChangedOleander = this.onTileChangedOleander.bind(this)
    eventBus.on('world/tile-changed', this.onTileChangedOleander)
    // micro-tâches
    this.oleanderRegrow = this.oleanderRegrow.bind(this)
  }

  /**
   * Réinitialise toutes les structures.
   */
  init () {
    this.byTile.clear()
    this.#list.length = 0
    this.#byChunk.clear()
    this.#bySoil.clear()
    this.#displayed.clear()
    this.#regrowQueue.length = 0

    this.#image = ITEMS.oleander.placed // après hydratation
  }

  /**
   * Enregistre un oleander et peuple les structures internes.
   * Si present=false, met le record en file de repousse et déclenche la microtâche
   * de vidage
   * @param {object} record — record HERB/OLEANDER (deleted=false garanti par l'appelant)
   */
  initPlant (record) {
    this.#list.push(record)

    if (record.present) {
      addToByTile(this.byTile, record)
      addToByChunk(this.#byChunk, record)
      this.#bySoil.set(record.soilIndex, record)

      // this.#bySoil.set(record.soilIndex, record)
      blockedTiles.blockPlacement(record.index)
      blockedTiles.blockPlacement(record.index + WORLD_WIDTH)
      blockedTiles.blockPlacement(record.index + 2 * WORLD_WIDTH)
      return
    }
    this.#regrowQueue.push(record)
  }

  /**
   * Liaison EventBus : 'time/first-loop' — émis une seule fois au démarrage du rendu,
   * une fois le boot terminé (tous les éléments du monde placés).
   * Déclenche la microtâche de repousse si #regrowQueue contient des records
   * present=false chargés depuis la persistence.
   */
  onFirstLoopOleander () {
    if (this.#regrowQueue.length === 0) return
    const {priority, capacity} = MICROTASK.OLEANDER_REGROW
    microTasker.enqueue(this.oleanderRegrow, priority, capacity)
  }

  /**
   * Reconstruit #displayed depuis les chunks preload de la caméra.
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) {
    buildDisplayed(this.#displayed, this.#byChunk, preloadChunks)
  }

  /**
   * Dessine les oleanders visibles et présents sur le contexte transformé.
   * TODO : rendu spécifique (ITEMS.oleander.placed) — à définir.
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  render (ctx) {
    const img = this.#image
    for (const record of this.#displayed) {
      const pxX = (record.index & 0x3FF) << 4
      const pxY = (record.index >> 10) << 4
      ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
    }
  }

  /**
   * Détruit un oleander présent sans loot : retire byTile/#byChunk/#bySoil/#displayed,
   * débloque les 3 tuiles occupées, persiste, puis programme la repousse
   * (#regrowQueue + microtâche). Guard : no-op si record.present est déjà false.
   * @param {object} record
   */
  #destroyPresent (record) {
    if (!record.present) return

    record.present = false
    removeFromByTile(this.byTile, record)
    removeFromByChunk(this.#byChunk, record)
    this.#bySoil.delete(record.soilIndex)
    this.#displayed.delete(record)

    blockedTiles.unblockPlacement(record.index)
    blockedTiles.unblockPlacement(record.index + WORLD_WIDTH)
    blockedTiles.unblockPlacement(record.index + 2 * WORLD_WIDTH)

    saveManager.queueStaticUpdate({storeName: 'plant', record})

    this.#regrowQueue.push(record)
    if (this.#regrowQueue.length === 1) {
      const {priority, capacity} = MICROTASK.OLEANDER_REGROW
      microTasker.enqueue(this.oleanderRegrow, priority, capacity)
    }
  }

  /**
   * Traite le foraging réussi de cet oleander (hors loot, géré par ForagingManager).
   * Marque le record absent, retire byTile/#byChunk/#displayed, débloque les tuiles
   * occupées, persiste, puis programme la repousse (#regrowQueue + microtâche).
   * Guard : no-op si record.present est déjà false.
   * @param {object} record
   */
  onForaged (record) {
    this.#destroyPresent(record)
  }

  /**
   * Retourne le record d'oleander couvrant la tuile donnée, ou null.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {object|null}
   */
  getPlantAt (tileIndex) {
    return this.byTile.get(tileIndex) ?? null
  }

  /**
   * Indique si le record est actuellement présent (forageable).
   * @param {object} record
   * @returns {boolean}
   */
  isPresent (record) { return record.present }

  /**
   * Microtâche : cherche un nouvel emplacement pour le dernier record de #regrowQueue,
   * avec le même algorithme que placeOleanders (génération) : départ VOID, descente
   * jusqu'au premier non-VOID, sol STONE, pocket VOID 1x3 au-dessus.
   * blockedTiles — les 3 tuiles du pocket doivent être canPlace().
   * Si trouvé : finalise le record (present=true, byTile/#byChunk, blockPlacement,
   * persistence) et le retire de #regrowQueue (dernier élément, length--).
   * Si rien trouvé, ou s'il reste des records, reprogramme pour la frame suivante.
   */
  oleanderRegrow () {
    if (this.#regrowQueue.length === 0) return
    console.log('oleanderRegrow')

    const VOID = NODES.VOID.code
    const STONE = NODES.STONE.code
    const W = WORLD_WIDTH
    const MAX_ATTEMPTS = 100

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const cx = seededRNG.randomGetMinMax(1, W - 2)
      const cy = seededRNG.randomGetMinMax(TOPSOIL_Y_SURFACE_UNDER, TOPSOIL_Y_UNDER_CAVERNS)

      let soilIndex = (cy << 10) | cx
      if (chunkManager.getTileAt(soilIndex) !== VOID) continue

      const maxIndex = (TOPSOIL_Y_UNDER_CAVERNS << 10) | cx
      while (soilIndex < maxIndex && chunkManager.getTileAt(soilIndex) === VOID) soilIndex += W

      if (chunkManager.getTileAt(soilIndex) !== STONE) continue

      const t1 = soilIndex - W
      const topY = (t1 >> 10) - 2
      if (!chunkManager.isRectCode(cx, topY, 1, 3, VOID)) continue
      if (!blockedTiles.canPlaceRect(cx, topY, 1, 3)) continue

      const record = this.#regrowQueue[this.#regrowQueue.length - 1]

      record.soilIndex = soilIndex
      record.index = (topY << 10) | cx
      record.x = cx
      record.y = topY
      record.present = true

      addToByTile(this.byTile, record)
      addToByChunk(this.#byChunk, record)
      addToDisplayed(this.#displayed, record)
      blockedTiles.blockPlacementRect(cx, topY, 1, 3)
      saveManager.queueStaticUpdate({storeName: 'plant', record})

      this.#regrowQueue.length--
      break
    }

    if (this.#regrowQueue.length !== 0) {
      const {priority, capacity} = MICROTASK.OLEANDER_REGROW
      microTasker.enqueue(this.oleanderRegrow, priority, capacity)
    }
  }

  /**
   * Liaison EventBus : 'world/tile-changed'.
   * Détruit l'oleander présent si une des 3 tuiles de son corps n'est plus VOID,
   * ou si sa tuile sol n'est plus STONE. Relit les tuiles réelles avant d'agir.
   * Pas de gestion de spot — population fixe, repousse via #regrowQueue.
   * @param {{tileIndex: number, tileOldCode: number, tileNewCode: number}} payload
   */
  onTileChangedOleander ({tileIndex, tileOldCode, tileNewCode}) {
    const VOID = NODES.VOID.code
    const STONE = NODES.STONE.code

    // Cas 1 — tuile du corps : une des 3 VOID devient autre chose
    const byBodyRecord = this.byTile.get(tileIndex)
    if (byBodyRecord !== undefined && tileNewCode !== VOID) {
      const x = byBodyRecord.index & 0x3FF
      const y = byBodyRecord.index >> 10
      if (!chunkManager.isRectCode(x, y, 1, 3, VOID)) this.#destroyPresent(byBodyRecord)
    }

    // Cas 2 — tuile sol : STONE retiré
    if (tileOldCode === STONE) {
      const record = this.#bySoil.get(tileIndex)
      if (record !== undefined && chunkManager.getTileAt(record.soilIndex) !== STONE) {
        this.#destroyPresent(record)
      }
    }
  }
}
export const oleanderSystem = new OleanderSystem()

/* ====================================================================================================
   PARSNIP SYSTEM
   ==================================================================================================== */

class ParsnipSystem {
  byTile = new Map() // Map<tileIndex, record> — public : membership O(1) + lookup record
  #list = [] // record[] — tous les spots (présents ou non)
  #byChunk = new Map() // Map<chunkKey, Set> — lookup spatial pour onPreloadChunksChanged
  #bySoil = new Map() // Map<soilIndex, record> — plantes présentes : détection minage de la tuile sol
  #spotsBySoil = new Map() // Map<soilIndex, record> — tous les spots (présents ou non) : suppression O(1)
  #displayed = new Set() // Set<record> — spots dans les chunks preload (cible render)
  #image = null // ITEMS.parsnip.placed, mis en cache dans init()

  constructor () {
    // EventBus
    this.onTileChangedParsnip = this.onTileChangedParsnip.bind(this)
    eventBus.on('world/tile-changed', this.onTileChangedParsnip)
    this.onHour3Parsnip = this.onHour3Parsnip.bind(this)
    eventBus.on('time/every-hour-3', this.onHour3Parsnip)
    this.onTreeDestroyedParsnip = this.onTreeDestroyedParsnip.bind(this)
    eventBus.on('ecosystem/tree-destroyed', this.onTreeDestroyedParsnip)
    this.onTreePlantedParsnip = this.onTreePlantedParsnip.bind(this)
    eventBus.on('ecosystem/tree-planted', this.onTreePlantedParsnip)
    // Micro-task
    this.onParsnipSpotCheck = this.onParsnipSpotCheck.bind(this)
    this.bloomParsnip = this.bloomParsnip.bind(this)
  }

  /**
   * Réinitialise toutes les structures.
   */
  init () {
    this.byTile.clear()
    this.#list.length = 0
    this.#byChunk.clear()
    this.#bySoil.clear()
    this.#spotsBySoil.clear()
    this.#displayed.clear()

    this.#image = ITEMS.parsnip.placed // après hydratation
  }

  /**
   * Enregistre un spot et peuple les structures internes.
   * @param {object} record — record HERB/PARSNIP (deleted=false garanti par l'appelant)
   */
  initPlant (record) {
    this.#list.push(record)
    this.#spotsBySoil.set(record.soilIndex, record)
    if (!record.present) return
    addToByTile(this.byTile, record)
    addToByChunk(this.#byChunk, record)
    this.#bySoil.set(record.soilIndex, record)
    blockedTiles.blockPlacement(record.index)
  }

  /**
   * Reconstruit #displayed depuis les chunks preload de la caméra.
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) {
    buildDisplayed(this.#displayed, this.#byChunk, preloadChunks)
  }

  /**
   * Dessine les parsnips visibles et présents sur le contexte transformé.
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  render (ctx) {
    const img = this.#image
    for (const record of this.#displayed) {
      const pxX = (record.index & 0x3FF) << 4
      const pxY = ((record.index >> 10) << 4) + 2
      ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
    }
  }

  /**
   * Traite le foraging réussi : marque le parsnip absent et persiste.
   * Le loot est géré en commun par ForagingManager — cette méthode ne gère que l'état de la plante.
   * @param {object} record
   */
  onForaged (record) {
    this.#destroyPresent(record)
  }

  /**
   * Retourne le record du parsnip couvrant la tuile donnée, ou null.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {object|null}
   */
  getPlantAt (tileIndex) {
    return this.byTile.get(tileIndex) ?? null
  }

  /**
   * Indique si le record est actuellement présent (forageable).
   * @param {object} record
   * @returns {boolean}
   */
  isPresent (record) { return record.present }

  /** Liaison EventBus : 'time/every-hour-3' — reset nocturne et calcul de la nouvelle population. */
  onHour3Parsnip () {
    const {priority, capacity} = MICROTASK.BLOOM_PARSNIP
    microTasker.enqueue(this.bloomParsnip, priority, capacity)
  }

  /**
   * Microtâche : remet present=false sur tous les spots encore présents, puis fait pousser
   * un nombre de parsnips calculé depuis PARSNIP_RATE + aléa[-2,2] + bonus buff 'cloudy' (+2).
   * Tirage sans remise parmi #list, rejet si soilIndex ou index est bloqué.
   */
  bloomParsnip () {
    for (const record of this.#list) {
      if (!record.present) continue
      this.#destroyPresent(record)
    }

    let count = ((this.#list.length * PARSNIP_RATE) | 0) + seededRNG.randomGetMinMax(-2, 2)
    if (buffManager.getBuff('cloudy')) count += 2
    if (count < 0) count = 0

    const MAX_ATTEMPTS = 200 // borne de sécurité — pas une valeur d'équilibrage
    let grown = 0
    let attempts = 0
    while (grown < count && attempts < MAX_ATTEMPTS) {
      attempts++
      const record = seededRNG.randomGetArrayValue(this.#list)
      if (record.present) continue
      if (!blockedTiles.canMine(record.soilIndex)) continue
      if (!blockedTiles.canPlace(record.index)) continue

      record.present = true
      addToByTile(this.byTile, record)
      addToByChunk(this.#byChunk, record)
      this.#bySoil.set(record.soilIndex, record)
      blockedTiles.blockPlacement(record.index)
      saveManager.queueStaticUpdate({storeName: 'plant', record})
      grown++
    }
    buildDisplayed(this.#displayed, this.#byChunk, camera.preloadChunks)
  }

  /**
   * Détruit un parsnip présent sans loot : retire toutes les structures et persiste.
   * Guard : no-op si record.present est déjà false.
   * @param {object} record
   */
  #destroyPresent (record) {
    if (!record.present) return
    record.present = false
    removeFromByTile(this.byTile, record)
    removeFromByChunk(this.#byChunk, record)
    this.#bySoil.delete(record.soilIndex)
    this.#displayed.delete(record)
    blockedTiles.unblockPlacement(record.index)
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
   * Retire un spot de toutes les structures mémoire et le marque deleted en DB.
   * Détruit le parsnip présent au préalable si nécessaire.
   * @param {object} record
   */
  #removeSpot (record) {
    this.#destroyPresent(record)
    const list = this.#list
    const idx = list.indexOf(record)
    if (idx !== -1) {
      list[idx] = list[list.length - 1]
      list.length--
    }
    this.#spotsBySoil.delete(record.soilIndex)
    record.deleted = true
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
   * Liaison EventBus : 'world/tile-changed'.
   * — Détruit le parsnip présent si une tuile de son corps n'est plus SKY ou si son sol n'est plus GRASSFOREST.
   * — Supprime le spot si son sol n'est plus GRASSFOREST.
   * — Enqueue onParsnipSpotCheck si une tuile devient GRASSFOREST.
   * Relit les tuiles réelles avant d'agir.
   * @param {{tileIndex: number, tileOldCode: number, tileNewCode: number}} payload
   */

  onTileChangedParsnip ({tileIndex, tileOldCode, tileNewCode}) {
    const SKY = NODES.SKY.code
    const GRASSFOREST = NODES.GRASSFOREST.code

    // Cas 1 — tuile du corps : SKY perdu
    const byBodyRecord = this.byTile.get(tileIndex)
    if (byBodyRecord !== undefined && tileNewCode !== SKY) {
      if (chunkManager.getTileAt(byBodyRecord.index) !== SKY) {
        this.#destroyPresent(byBodyRecord)
      }
    }

    // Cas 2 — tuile sol : GRASSFOREST perdu (plante + spot)
    if (tileOldCode === GRASSFOREST) {
      const record = this.#spotsBySoil.get(tileIndex)
      if (record !== undefined && chunkManager.getTileAt(record.soilIndex) !== GRASSFOREST) {
        this.#removeSpot(record)
      }
    }

    // Cas 3 — nouvelle tuile GRASSFOREST : candidat spot
    if (tileNewCode === GRASSFOREST) {
      const {priority, capacity} = MICROTASK.PARSNIP_SPOT_CHECK
      microTasker.enqueue(this.onParsnipSpotCheck, priority, capacity, tileIndex)
    }
  }

  /**
   * Liaison EventBus : 'ecosystem/tree-destroyed' — un arbre vient d'être abattu entièrement,
   * libérant 3 tuiles de sol. Délègue à onParsnipSpotCheck pour chacune (GRASSFOREST +
   * absence de spot déjà vérifiés là-bas). Les tuiles avant/après l'arbre ne sont pas concernées
   * — déjà des spots potentiels indépendamment de la présence de l'arbre.
   * @param {{tileIndex: number, treeId: string}} - tuile centrale du sol libéré / Identifiant de l'arbre
   */
  onTreeDestroyedParsnip ({tileIndex, treeId}) {
    if (treeId !== 'oak') return
    this.onParsnipSpotCheck(tileIndex - 1)
    this.onParsnipSpotCheck(tileIndex)
    this.onParsnipSpotCheck(tileIndex + 1)
  }

  /**
   * Liaison EventBus : 'ecosystem/tree-planted' — un arbre vient d'être planté, occupant
   * 3 tuiles de sol. Supprime les spots parsnip existants à ces 3 positions (s'il y en a),
   * via #removeSpot (détruit la plante présente au préalable si besoin).
   * @param {{tileIndex: number, treeId: string}} - tuile centrale du sol libéré / Identifiant de l'arbre
   */
  onTreePlantedParsnip ({tileIndex, treeId}) {
    if (treeId !== 'oak') return
    const left = this.#spotsBySoil.get(tileIndex - 1)
    if (left !== undefined) this.#removeSpot(left)

    const center = this.#spotsBySoil.get(tileIndex)
    if (center !== undefined) this.#removeSpot(center)

    const right = this.#spotsBySoil.get(tileIndex + 1)
    if (right !== undefined) this.#removeSpot(right)
  }

  /**
   * Microtâche : vérifie si une tuile devenue GRASSFOREST peut accueillir un nouveau spot.
   * TODO — conditions réelles non définies. Pour l'instant, reprend juste le minimum actif
   * de SunflowerSystem (sol GRASSFOREST + pas de spot existant) : pas de contrainte de
   * voisinage GRASSFOREST gauche/droite, pas d'exclusion oak/chest, pas de tolérance bolete.
   * À porter une fois TreeSystem écrit (cf. DESIGN.md 8.7).
   * @param {number} soilIndex
   */
  onParsnipSpotCheck (soilIndex) {
    const GRASSFOREST = NODES.GRASSFOREST.code
    const x = soilIndex & 0x3FF

    if (chunkManager.getTileAt(soilIndex) !== GRASSFOREST) return
    if (this.#spotsBySoil.has(soilIndex)) return

    const y = soilIndex >> 10
    const index = soilIndex - WORLD_WIDTH
    const record = {
      id: uniqueIdGenerator.getUniqueId(),
      kind: PLANT_KIND.HERB,
      type: PLANT_TYPE.PARSNIP,
      index,
      soilIndex,
      itemId: 'parsnip',
      present: false,
      w: 1,
      h: 1,
      x,
      y: y - 1,
      deleted: false
    }
    this.#list.push(record)
    this.#spotsBySoil.set(soilIndex, record)
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
 * DEBUG — Affiche un cercle jaune au centre de la tuile sous chaque spot enregistré dans #list.
 * Vérifie la cohérence avec #spotsBySoil (même cardinal attendu).
 * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
 */
  debugRenderSpots (ctx) {
    ctx.save()
    ctx.fillStyle = 'rgba(255, 255, 0, 0.7)'
    for (const record of this.#list) {
      const cx = ((record.index & 0x3FF) << 4) + 8
      const cy = ((record.index >> 10) << 4) + 40
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, 6.2832)
      ctx.fill()
    }
    if (this.#list.length !== this.#spotsBySoil.size) {
      console.warn(`SunflowerSystem: #list(${this.#list.length}) !== #spotsBySoil(${this.#spotsBySoil.size})`)
    }
    ctx.restore()
  }
}
export const parsnipSystem = new ParsnipSystem()

/* ====================================================================================================
   AMBERMIRAGE SYSTEM
   ==================================================================================================== */

class AmbermirageSystem {
  byTile = new Map() // Map<tileIndex, record> — public : membership O(1) + lookup record
  #list = [] // record[] — tous les spots (présents ou non)
  #byChunk = new Map() // Map<chunkKey, Set> — lookup spatial pour onPreloadChunksChanged
  #bySoil = new Map() // Map<soilIndex, record> — plantes présentes : détection minage de la tuile sol
  #spotsBySoil = new Map() // Map<soilIndex, record> — tous les spots (présents ou non) : suppression O(1)
  #byX = new Array(WORLD_WIDTH).fill(null) // record|null par colonne — lookup direct voisin x-1/x+1
  #sewedTiles = new Set() // Set<soilIndex> — tuiles semées (100% de pousse)
  #displayed = new Set() // Set<record> — spots dans les chunks preload (cible render)
  #image = null // ITEMS.ambermirage.placed, mis en cache dans init()
  #imgSeed = null // ITEMS.ambermirageSeed.placed, mis en cache dans init()

  constructor () {
    // EventBus
    this.onHour10Ambermirage = this.onHour10Ambermirage.bind(this)
    eventBus.on('time/every-hour-10', this.onHour10Ambermirage)
    this.onHour14Ambermirage = this.onHour14Ambermirage.bind(this)
    eventBus.on('time/every-hour-14', this.onHour14Ambermirage)
    this.onSewedAmbermirage = this.onSewedAmbermirage.bind(this)
    eventBus.on('sewed/ambermirage', this.onSewedAmbermirage)
    this.onTileChangedAmbermirage = this.onTileChangedAmbermirage.bind(this)
    eventBus.on('world/tile-changed', this.onTileChangedAmbermirage)
    // Micro-tâches
    this.bloomAmbermirage = this.bloomAmbermirage.bind(this)
    this.unbloomAmbermirage = this.unbloomAmbermirage.bind(this)
    this.onAmbermirageTileCheck = this.onAmbermirageTileCheck.bind(this)
  }

  /**
 * Réinitialise toutes les structures. Appelé en début de session.
 */
  init () {
    this.byTile.clear()
    this.#list.length = 0
    this.#byChunk.clear()
    this.#bySoil.clear()
    this.#spotsBySoil.clear()
    this.#byX.fill(null)
    this.#sewedTiles.clear()
    this.#displayed.clear()

    this.#image = ITEMS.ambermirage.placed // après hydratation
    this.#imgSeed = ITEMS.ambermirageSeed.placed // après hydratation
  }

  /**
 * Enregistre un spot et peuple les structures internes.
 * @param {object} record — record HERB/AMBERMIRAGE actif (deleted=false garanti par l'appelant)
 */
  initPlant (record) {
    this.#list.push(record)
    this.#spotsBySoil.set(record.soilIndex, record)
    this.#byX[record.x] = record
    if (!record.present) return
    addToByTile(this.byTile, record)
    addToByChunk(this.#byChunk, record)
    this.#bySoil.set(record.soilIndex, record)
    blockedTiles.blockPlacement(record.index)
  }

  /**
 * Reconstruit #displayed depuis les chunks preload de la caméra.
 * @param {Set<number>} preloadChunks
 */
  onPreloadChunksChanged (preloadChunks) {
    buildDisplayed(this.#displayed, this.#byChunk, preloadChunks)
  }

  /**
 * Dessine les ambermirages visibles et présents sur le contexte transformé.
 * Dessine également, hors chunks preload (liste courte), la graine sur chaque tuile semée.
 * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
 */
  render (ctx) {
    const img = this.#image
    for (const record of this.#displayed) {
      const pxX = (record.index & 0x3FF) << 4
      const pxY = ((record.index >> 10) << 4) + 2
      ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
    }

    const seedImg = this.#imgSeed
    for (const soilIndex of this.#sewedTiles) {
      const pxX = (soilIndex & 0x3FF) << 4
      const pxY = (soilIndex >> 10) << 4
      ctx.drawImage(IMAGE_CACHE[seedImg.imgIndex], seedImg.sx, seedImg.sy, seedImg.sw, seedImg.sh, pxX, pxY, seedImg.sw, seedImg.sh)
    }
  }

  /**
 * Traite le foraging réussi : marque l'ambermirage absent et persiste.
 * Le loot est géré en commun par ForagingManager — cette méthode ne gère que l'état de la plante.
 * @param {object} record
 */
  onForaged (record) {
    this.#destroyPresent(record)
  }

  /**
 * Retourne le record de l'ambermirage couvrant la tuile donnée, ou null.
 * @param {number} tileIndex — (y << 10) | x
 * @returns {object|null}
 */
  getPlantAt (tileIndex) {
    return this.byTile.get(tileIndex) ?? null
  }

  /**
 * Indique si le record est actuellement présent (forageable).
 * @param {object} record
 * @returns {boolean}
 */
  isPresent (record) { return record.present }

  /**
   * Restaure la liste des tuiles de graines d'ambermirage plantées par le joueur, lue depuis
   * gamestate au démarrage de session. Remplace le contenu courant de #sewedTiles.
   * @param {number[]} sewedTiles — tableau persisté (gamestate.sewedambermirage), [] si absent
   */
  initSeed (sewedTiles) {
    this.#sewedTiles.clear()
    for (const soilIndex of sewedTiles) this.#sewedTiles.add(soilIndex)
  }

  /**
   * Liaison EventBus : 'sewed/ambermirage' — le joueur a planté une graine d'ambermirage sur
   * une tuile SAND valide (vérifications déjà faites par SowingManager). Mémorise la tuile et
   * persiste immédiatement la liste complète dans gamestate.
   * @param {number} soilIndex — (y << 10) | x, tuile plantée
   */
  onSewedAmbermirage (soilIndex) {
    if (!this.#spotsBySoil.has(soilIndex)) {
      console.error(`AmbermirageSystem.onSewedAmbermirage: aucun spot à soilIndex ${soilIndex}`)
      return
    }
    this.#sewedTiles.add(soilIndex)
    database.setGameState('sewedambermirage', [...this.#sewedTiles])
  }

  /**
   * Indique si une AmbermirageSeed peut être plantée sur ce soilIndex.
   * Seule condition : pas de graine déjà semée sur ce spot.
   * @param {number} soilIndex — (y << 10) | x
   * @param {string} seed
   * @returns {boolean|null} null si `seed` n'est pas 'ambermirageSeed'
   */
  canSow (soilIndex, seed) {
    if (seed !== 'ambermirageSeed') return null
    return !this.#sewedTiles.has(soilIndex)
  }

  /** Liaison EventBus : 'time/every-hour-10' — début du créneau de floraison quotidien. */
  onHour10Ambermirage () {
    const {priority, capacity} = MICROTASK.BLOOM_AMBERMIRAGE
    microTasker.enqueue(this.bloomAmbermirage, priority, capacity)
  }

  /** Liaison EventBus : 'time/every-hour-14' — fin du créneau, flétrissement complet. */
  onHour14Ambermirage () {
    const {priority, capacity} = MICROTASK.UNBLOOM_AMBERMIRAGE
    microTasker.enqueue(this.unbloomAmbermirage, priority, capacity)
  }

  /**
   * Microtâche : tente de faire pousser un ambermirage sur chaque spot encore absent.
   * Skip total (aucune pousse, aucun tirage) si le temps du jour est rainy ou stormy.
   * Un spot doit toujours être éligible pour germer, semé ou non — tuile-plante (record.index)
   * libre (blockedTiles) et encore SKY (donc pas envahie par un liquide entretemps), colonnes
   * voisines (record.x-1, record.x1) toujours enregistrées comme SAND dans #byX. Semé
   * (#sewedTiles) : 100% si éligible. Sinon : AMBERMIRAGE_PCENT% si éligible.
   * #sewedTiles est vidée en fin de passe (toutes les graines sont consommées, germées ou non).
   */
  bloomAmbermirage () {
    if (buffManager.getBuff('rainy') || buffManager.getBuff('stormy')) return

    for (const record of this.#list) {
      if (record.present) continue

      if (!blockedTiles.canPlace(record.index)) continue
      if (this.#byX[record.x - 1] === null) continue
      if (this.#byX[record.x + 1] === null) continue

      const sown = this.#sewedTiles.has(record.soilIndex)
      if (!sown && !seededRNG.randomGetPercent(AMBERMIRAGE_PCENT)) continue

      record.present = true
      addToByTile(this.byTile, record)
      addToByChunk(this.#byChunk, record)
      this.#bySoil.set(record.soilIndex, record)
      blockedTiles.blockPlacement(record.index)
      saveManager.queueStaticUpdate({storeName: 'plant', record})
    }

    this.#sewedTiles.clear() // toutes les graines sont consommées, qu'elles aient germé ou non
    database.setGameState('sewedambermirage', [])
    buildDisplayed(this.#displayed, this.#byChunk, camera.preloadChunks)
  }

  /**
   * Microtâche : flétrit tous les ambermirages actuellement présents, sans condition ni loot.
   * Itère #bySoil (uniquement les présents), pas #list entier.
   */
  unbloomAmbermirage () {
    for (const record of this.#bySoil.values()) this.#destroyPresent(record)
    buildDisplayed(this.#displayed, this.#byChunk, camera.preloadChunks)
  }

  /**
 * Détruit un ambermirage présent sans loot : retire toutes les structures et persiste.
 * Guard : no-op si record.present est déjà false.
 * @param {object} record
 */
  #destroyPresent (record) {
    if (!record.present) return
    record.present = false
    removeFromByTile(this.byTile, record)
    removeFromByChunk(this.#byChunk, record)
    this.#bySoil.delete(record.soilIndex)
    this.#displayed.delete(record)
    blockedTiles.unblockPlacement(record.index)
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
   * Liaison EventBus : 'world/tile-changed' — programme onAmbermirageTileCheck en microtâche+   * pour cette tuile. Aucune logique métier ici (mesuré jusqu'à 300µs en direct, hors budget+   * frame si traité en synchrone).
   * @param {{tileIndex: number, tileOldCode: number, tileNewCode: number}} payload
   */
  onTileChangedAmbermirage ({tileIndex}) {
    const {priority, capacity} = MICROTASK.AMBERMIRAGE_TILE_CHECK
    microTasker.enqueue(this.onAmbermirageTileCheck, priority, capacity, tileIndex)
  }

  /**
   * Microtâche : entretien réactif d'un spot d'ambermirage pour une tuile modifiée. Relit
   * l'état courant de la tuile via chunkManager (pas le tileNewCode de l'event d'origine,
   * potentiellement obsolète si la tuile a rechangé entre l'event et l'exécution différée).
   * Décompose 4 cas : (A) tuile modifiée = tuile-plante (record.index) d'un spot existant de
   * la colonne — remonte le spot si le sable a progressé d'un cran, détruit sinon ; (B) tuile
   * modifiée = tuile-sol (record.soilIndex) — descend le spot si le sol a été creusé et qu'une
   * nouvelle surface SAND apparaît en dessous, détruit sinon ; (C-1) aucun
   * spot dans la colonne — création possible ; (C-2) un spot existe dans la colonne mais la
   * tuile modifiée n'est ni son index ni son soilIndex — sans effet (bloomAmbermirage ne lit
   * jamais qu'index/soilIndex, jamais une autre tuile de la colonne).
   * @param {number} tileIndex
   */
  onAmbermirageTileCheck (tileIndex) {
    const tileNewCode = chunkManager.getTileAt(tileIndex)
    const x = tileIndex & 0x3FF
    const record = this.#byX[x]

    if (record === null) {
      this.#tryCreateSpot(x, tileIndex, tileNewCode)
      return
    }

    if (tileIndex === record.index) {
      this.#onPlantTileChanged(record, tileIndex, tileNewCode)
      return
    }

    if (tileIndex === record.soilIndex) {
      this.#onSoilTileChanged(record, tileNewCode)
    }
  }

  /**
   * Gère un changement sur la tuile-plante (record.index) d'un spot existant. Détruit d'abord
   * la fleur si présente (avec l'ancien record.index, avant toute modification du record — sinon
   * blockedTiles.unblockPlacement libérerait la mauvaise tuile). Si la nouvelle tuile est SAND
   * et que la tuile encore au-dessus est SKY, le sable a progressé d'un cran : on remonte le
   * spot d'une case plutôt que détruire puis recréer. Sinon, le spot est détruit.
   * @param {object} record
   * @param {number} tileIndex — égal à record.index (avant mise à jour)
   * @param {number} tileNewCode
   */
  #onPlantTileChanged (record, tileIndex, tileNewCode) {
    const SAND = NODES.SAND.code
    const SKY = NODES.SKY.code
    const W = WORLD_WIDTH

    if (record.present) this.#destroyPresent(record)

    if (tileNewCode === SAND && chunkManager.getTileAt(tileIndex - W) === SKY) {
      this.#spotsBySoil.delete(record.soilIndex)
      record.soilIndex = tileIndex
      record.index = tileIndex - W
      record.y -= 1
      this.#spotsBySoil.set(record.soilIndex, record)
      saveManager.queueStaticUpdate({storeName: 'plant', record})
      return
    }

    this.#destroySpot(record)
  }

  /**
   * Gère un changement sur la tuile-sol (record.soilIndex) d'un spot existant. Détruit d'abord
   * la fleur si présente. Si la nouvelle tuile est SKY et que la tuile juste en dessous est
   * SAND, le sol a été creusé et une nouvelle surface SAND est apparue en dessous : on descend
   * le spot d'une case plutôt que détruire puis recréer. Sinon, le spot est détruit.
   * @param {object} record
   * @param {number} tileNewCode
   */
  #onSoilTileChanged (record, tileNewCode) {
    const SAND = NODES.SAND.code
    const SKY = NODES.SKY.code
    const W = WORLD_WIDTH

    if (record.present) this.#destroyPresent(record)

    if (tileNewCode === SKY && chunkManager.getTileAt(record.soilIndex + W) === SAND) {
      this.#spotsBySoil.delete(record.soilIndex)
      record.index = record.soilIndex
      record.soilIndex = record.soilIndex + W
      record.y += 1
      this.#spotsBySoil.set(record.soilIndex, record)
      saveManager.queueStaticUpdate({storeName: 'plant', record})
      return
    }

    this.#destroySpot(record)
  }

  /**
   * Supprime définitivement un spot (pas seulement la fleur, cf. #destroyPresent ci-dessus) :
   * détruit la fleur si encore présente, retire toutes les références (#spotsBySoil, #byX),
   * marque le record deleted et persiste, retire le record de #list (swap  length--, O(n) via
   * indexOf — cf. remarque sur une possible suppression de #list).
   * @param {object} record
   */
  #destroySpot (record) {
    if (record.present) this.#destroyPresent(record)
    this.#spotsBySoil.delete(record.soilIndex)
    this.#byX[record.x] = null
    record.deleted = true
    saveManager.queueStaticUpdate({storeName: 'plant', record})

    const idx = this.#list.indexOf(record)
    this.#list[idx] = this.#list[this.#list.length - 1]
    this.#list.length--
  }

  /**
   * Tente de créer un nouveau spot après un changement de tuile dans une colonne qui n'en avait
   * pas. Deux cas symétriques, mutuellement exclusifs (tileNewCode ne peut valoir qu'une chose) :
   *   - la tuile modifiée devient SAND et la tuile au-dessus (déjà en place) est SKY
   *     → spot à tileIndex (ex: dépôt de sable exposé directement).
   *   - la tuile modifiée devient SKY et la tuile en dessous (déjà en place) est SAND
   *     → spot à tileIndex + W (ex: creusement/suppression qui expose un SAND déjà présent).
   * Démarre toujours present:false — la pousse effective se joue à bloomAmbermirage (10h00).
   * @param {number} x
   * @param {number} tileIndex
   * @param {number} tileNewCode
   */
  #tryCreateSpot (x, tileIndex, tileNewCode) {
    const SAND = NODES.SAND.code
    const SKY = NODES.SKY.code
    const W = WORLD_WIDTH

    let soilIndex
    if (tileNewCode === SAND && chunkManager.getTileAt(tileIndex - W) === SKY) {
      soilIndex = tileIndex
    } else if (tileNewCode === SKY && chunkManager.getTileAt(tileIndex + W) === SAND) {
      soilIndex = tileIndex + W
    } else {
      return
    }

    const y = soilIndex >> 10
    const record = {
      id: uniqueIdGenerator.getUniqueId(),
      kind: PLANT_KIND.HERB,
      type: PLANT_TYPE.AMBERMIRAGE,
      index: soilIndex - W,
      soilIndex,
      itemId: 'ambermirage',
      w: 1,
      h: 1,
      x,
      y: y - 1,
      present: false,
      deleted: false
    }

    this.#list.push(record)
    this.#spotsBySoil.set(record.soilIndex, record)
    this.#byX[x] = record
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  // ///// //
  // DEBUG //
  // ///// //

  /**
* DEBUG — Affiche un cercle orange au centre de la tuile sous chaque spot enregistré dans #list
* (tous les spots SAND, present ou non). Vérifie la cohérence avec #spotsBySoil (même cardinal
* attendu).
* @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
*/
  debugRenderSpots (ctx) {
    ctx.save()
    ctx.fillStyle = 'rgba(43, 0, 255, 0.7)'
    for (const record of this.#list) {
      const cx = ((record.index & 0x3FF) << 4) + 8
      const cy = ((record.index >> 10) << 4) + 40 - 16
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, 6.2832)
      ctx.fill()
    }
    if (this.#list.length !== this.#spotsBySoil.size) {
      console.warn(`AmbermirageSystem: #list(${this.#list.length}) !== #spotsBySoil(${this.#spotsBySoil.size})`)
    }
    ctx.restore()
  }
}
export const ambermirageSystem = new AmbermirageSystem()

/* ====================================================================================================
   OAK SYSTEM
   ==================================================================================================== */

// Lignes d'images empilées par size (0 à 4)
const OAK_SIZE_ROWS = [
  [1, 0],
  [1, 2, 0],
  [1, 2, 3, 0],
  [1, 2, 3, 4, 0],
  [1, 2, 3, 4, 5, 6]
]

class OakSystem {
  // --- Oak (TREE) ---
  oakByTile = new Map() // Map<tileIndex, record> — public, zone d'interaction (size-dépendante)
  #oakByFullRect = new Map() // Map<tileIndex, record> — rectangle complet 3×18, surveillance obstruction

  #oakList = [] // record[] — tous les oaks
  #oakByChunk = new Map() // Map<chunkKey, Set> — lookup spatial pour onPreloadChunksChanged
  #oakBySoil = new Map() // Map<soilIndex, record> — 3 entrées par oak (soilIndex, +1, +2) : détection minage/changement du sol
  #oakXSet = new Set() // Set<number> — x (leftmost) des oaks vivants : exclusion de distance min. (sunflower)
  #oakDisplayed = new Set() // Set<record> — oaks dans les chunks preload (cible render)

  // --- Bolete (MUSHROOM) ---
  boleteByTile = new Map() // Map<tileIndex, record> — public, lookup par tuile
  #boleteList = [] // record[] — tous les spots (présents ou non)
  #boleteByChunk = new Map() // Map<chunkKey, Set> — lookup spatial pour onPreloadChunksChanged
  #boleteBySoil = new Map() // Map<soilIndex, record> — spots présents : détection minage de la tuile sol
  #boleteSpotsBySoil = new Map() // Map<soilIndex, record> — tous les spots : lookup pour suppression (destruction d'un oak)
  #boleteDisplayed = new Set() // Set<record> — spots dans les chunks preload (cible render)
  #boleteImage = null // ITEMS.bolete.placed, mis en cache dans init()

  constructor () {
    // EventBus
    this.onHour16Bolete = this.onHour16Bolete.bind(this)
    eventBus.on('time/every-hour-16', this.onHour16Bolete)
    this.onHour5Bolete = this.onHour5Bolete.bind(this)
    eventBus.on('time/every-hour-5', this.onHour5Bolete)
    this.onTileChangedOak = this.onTileChangedOak.bind(this)
    eventBus.on('world/tile-changed', this.onTileChangedOak)
    this.onSewedAcorn = this.onSewedAcorn.bind(this)
    eventBus.on('sewed/acorn', this.onSewedAcorn)
    this.onShaked = this.onShaked.bind(this)
    eventBus.on('shaked/oak', this.onShaked)
    // Micro-task
    this.unbloomBolete = this.unbloomBolete.bind(this)
    this.bloomBolete = this.bloomBolete.bind(this)
    this.growOak = this.growOak.bind(this)
    this.oakEndShake = this.oakEndShake.bind(this)
  }

  /**
   * Réinitialise toutes les structures (oak et bolete) et met en cache le sprite bolete.
   */
  init () {
    this.oakByTile.clear()
    this.#oakByFullRect.clear()
    this.#oakList.length = 0
    this.#oakByChunk.clear()
    this.#oakBySoil.clear()
    this.#oakXSet.clear()
    this.#oakDisplayed.clear()

    this.boleteByTile.clear()
    this.#boleteList.length = 0
    this.#boleteByChunk.clear()
    this.#boleteBySoil.clear()
    this.#boleteSpotsBySoil.clear()
    this.#boleteDisplayed.clear()

    this.#boleteImage = ITEMS.bolete.placed // après hydratation
  }

  /**
   * Hydrate un record depuis la DB. Aiguille par kind.
   * @param {object} record
   */
  initPlant (record) {
    if (record.kind === PLANT_KIND.TREE) {
      const soilIndex = record.soilIndex
      this.#oakList.push(record)
      this.#oakBySoil.set(soilIndex, record)
      this.#oakBySoil.set(soilIndex + 1, record)
      this.#oakBySoil.set(soilIndex + 2, record)
      this.#oakXSet.add((soilIndex & 0x3ff))
      this.#oakXSet.add((soilIndex & 0x3ff) + 1)
      this.#oakXSet.add((soilIndex & 0x3ff) + 2)
      addToByTileTree(this.oakByTile, this.#oakByFullRect, record)
      addToByChunk(this.#oakByChunk, record)

      const px = record.index & 0x3FF
      const py = record.index >> 10
      blockedTiles.blockPlacementRect(px, py, record.w, record.h)

      const soilX = soilIndex & 0x3FF
      const soilY = soilIndex >> 10
      blockedTiles.blockMiningRect(soilX, soilY, record.w, 1)

      if (record.growthTimestamp !== null) {
        const {priority, capacity} = MICROTASK.OAK_GROW
        taskScheduler.enqueueAbsolute(`oak_grow_${record.id}`, record.growthTimestamp, this.growOak, priority, capacity, soilIndex)
      }
      if (record.shakedTimestamp !== null) {
        const {priority, capacity} = MICROTASK.OAK_END_SHAKE
        taskScheduler.enqueueAbsolute(`oak_shake_${record.id}`, record.shakedTimestamp, this.oakEndShake, priority, capacity, soilIndex)
      }
      return
    }

    // record.kind === PLANT_KIND.MUSHROOM (bolete)
    this.#boleteList.push(record)
    this.#boleteSpotsBySoil.set(record.soilIndex, record)
    if (!record.present) return
    addToByTile(this.boleteByTile, record)
    addToByChunk(this.#boleteByChunk, record)
    this.#boleteBySoil.set(record.soilIndex, record)
    blockedTiles.blockPlacement(record.index)
    blockedTiles.blockPlacement(record.index + WORLD_WIDTH)
  }

  /**
   * Reconstruit #boleteDisplayed depuis les chunks preload de la caméra.
   * TODO : idem pour #oakDisplayed une fois #oakByChunk peuplé.
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) {
    buildDisplayed(this.#oakDisplayed, this.#oakByChunk, preloadChunks)
    buildDisplayed(this.#boleteDisplayed, this.#boleteByChunk, preloadChunks)
  }

  /**
   * Dessine les bolete visibles et présents.
   * TODO : rendu des oaks (this.#oakDisplayed), sprite par stade de croissance (size, images).
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  render (ctx) {
    const img = this.#boleteImage
    for (const record of this.#boleteDisplayed) {
      const pxX = (record.index & 0x3FF) << 4
      const pxY = ((record.index >> 10) << 4) + 2
      ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
    }

    for (const record of this.#oakDisplayed) {
      const rows = OAK_SIZE_ROWS[record.size]
      const soilYPx = ((record.soilIndex >> 10) << 4) + 2
      for (let i = 0; i < rows.length; i++) {
        const image = record.images[rows[i]]
        const img = TREE_IMAGES[image.tree][image.row][image.col]
        const pxX = image.x << 4
        const pxY = soilYPx - 48 * (i + 1)
        ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
      }
    }
  }

  /**
   * Détruit un bolete présent sans loot : retire toutes les structures et persiste.
   * Guard : no-op si record.present est déjà false.
   * @param {object} record
   */
  #destroyBoletePresent (record) {
    if (!record.present) return
    record.present = false
    removeFromByTile(this.boleteByTile, record)
    removeFromByChunk(this.#boleteByChunk, record)
    this.#boleteBySoil.delete(record.soilIndex)
    this.#boleteDisplayed.delete(record)
    blockedTiles.unblockPlacement(record.index)
    blockedTiles.unblockPlacement(record.index + WORLD_WIDTH)
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
   * Traite le foraging réussi d'un bolete (hors loot, géré par ForagingManager).
   * No-op pour un oak — un oak se mine/coupe, il ne se forage pas.
   * @param {object} record
   */
  onForaged (record) {
    if (record.kind === PLANT_KIND.TREE) return
    this.#destroyBoletePresent(record)
  }

  /**
   * Retourne le record (oak ou bolete) couvrant la tuile donnée, ou null.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {object|null}
   */
  getPlantAt (tileIndex) {
    return this.oakByTile.get(tileIndex) ?? this.boleteByTile.get(tileIndex) ?? null
  }

  /**
   * Indique si le record est actuellement présent (forageable).
   * Un oak n'a pas de notion de present/absent : son existence en tant que record vaut
   * présence. Un bolete, en revanche, oscille selon le cycle jour/nuit — seul record.present
   * fait foi.
   * @param {object} record
   * @returns {boolean}
   */
  isPresent (record) { return record.kind === PLANT_KIND.TREE ? !record.deleted : record.present }

  /**
   * Indique si un oak vivant occupe cette tuile de sol. O(1), zéro allocation —
   * @param {number} x
   * @returns {boolean}
   */
  isOakAtColumn (x) { return this.#oakXSet.has(x) }

  /** Liaison EventBus : 'time/every-hour-16' — tous les bolete présents repassent à false. */
  onHour16Bolete () {
    const {priority, capacity} = MICROTASK.UNBLOOM_BOLETE
    microTasker.enqueue(this.unbloomBolete, priority, capacity)
  }

  /** Microtâche : tous les bolete présents repassent à present=false. */
  unbloomBolete () {
    for (const record of this.#boleteList) {
      if (!record.present) continue
      this.#destroyBoletePresent(record)
    }
  }

  /** Liaison EventBus : 'time/every-hour-6' — tirage de floraison matinale des bolete. */
  onHour5Bolete () {
    const {priority, capacity} = MICROTASK.BLOOM_BOLETE
    microTasker.enqueue(this.bloomBolete, priority, capacity)
  }

  /**
   * Microtâche : parmi les spots dont le soilIndex est une GRASSFOREST, 50% passent à present=true.
   */
  bloomBolete () {
    const GRASSFOREST = NODES.GRASSFOREST.code
    for (const record of this.#boleteList) {
      if (chunkManager.getTileAt(record.soilIndex) !== GRASSFOREST) continue
      if (!seededRNG.randomGetBool()) continue
      if (!blockedTiles.canPlace(record.index) || !blockedTiles.canPlace(record.index + WORLD_WIDTH)) continue

      record.present = true
      addToByTile(this.boleteByTile, record)
      addToByChunk(this.#boleteByChunk, record)
      this.#boleteBySoil.set(record.soilIndex, record)
      blockedTiles.blockPlacement(record.index)
      blockedTiles.blockPlacement(record.index + WORLD_WIDTH)
      saveManager.queueStaticUpdate({storeName: 'plant', record})
    }
    buildDisplayed(this.#boleteDisplayed, this.#boleteByChunk, camera.preloadChunks)
  }

  /**
   * Réagit à un changement de tuile (EventBus : 'world/tile-changed').
   * Branche oak : TODO — tuile support, secousse, etc. pas encore définis.
   * Branche bolete : un bolete présent disparaît (present=false, spot conservé) si l'une de
   * ses 2 tuiles de corps (.index, .index + WORLD_WIDTH) devient non-SKY, ou si sa tuile de
   * support (.soilIndex) cesse d'être GRASSFOREST.
   * @param {{tileIndex: number, tileOldCode: number, tileNewCode: number}} payload
   */
  onTileChangedOak ({tileIndex, tileOldCode, tileNewCode}) {
    const SKY = NODES.SKY.code
    const GRASSFOREST = NODES.GRASSFOREST.code

    // Cas 1 — Bolete - une des 2 tuiles de corps du bolete devient non-SKY
    const byBodyRecord = this.boleteByTile.get(tileIndex)
    if (byBodyRecord !== undefined && tileNewCode !== SKY) {
      this.#destroyBoletePresent(byBodyRecord)
      return
    }

    // Cas 2 — Bolete - tuile de support : GRASSFOREST perdu
    const bySoilRecord = this.#boleteBySoil.get(tileIndex)
    if (bySoilRecord !== undefined && tileNewCode !== GRASSFOREST) {
      this.#destroyBoletePresent(bySoilRecord)
    }

    // Cas 3 — Oak - tuile du rectangle complet 3×18 change d'état SKY
    const byFullRecord = this.#oakByFullRect.get(tileIndex)
    if (byFullRecord === undefined) return

    // Cas 3.1. Obstruction : une tuile SKY devient autre chose
    if (tileNewCode !== SKY) {
      byFullRecord.blocked++
      if (byFullRecord.blocked === 1) {
        // Transition libre → bloqué : annule la croissance en cours
        taskScheduler.dequeue(`oak_grow_${byFullRecord.id}`)
        byFullRecord.growthTimestamp = null
      }
      saveManager.queueStaticUpdate({storeName: 'plant', record: byFullRecord})
      return
    }

    // Cas 3.2. Libération : une tuile redevient SKY
    if (byFullRecord.blocked === 0) return // guard : compteur déjà à zéro (cohérence)
    byFullRecord.blocked--
    if (byFullRecord.blocked === 0) {
      // Transition bloqué → libre : relance la croissance si l'arbre n'est pas adulte
      if (byFullRecord.size < 4) {
        const growthDelay = (ITEMS.oak.growth * seededRNG.randomGetRealMinMax(0.8, 1.2)) | 0
        const {priority, capacity} = MICROTASK.OAK_GROW
        byFullRecord.growthTimestamp = taskScheduler.enqueue(
          `oak_grow_${byFullRecord.id}`, growthDelay, this.growOak, priority, capacity, byFullRecord.soilIndex
        )
      }
    }
    saveManager.queueStaticUpdate({storeName: 'plant', record: byFullRecord})
  }

  // //////// //
  // CHOPPING //
  // //////// //

  /**
   * Traite le chopping réussi d'un oak (hors loot, géré par ChoppingManager).
   * Décrémente size. Si size atteint -1, détruit l'arbre entièrement (et ses bolete).
   * Sinon, met à jour byTile, blockedTiles, et persiste.
   * @param {object} record — record TREE (oak)
   */
  onChopped (record) {
    removeFromByTileTree(this.oakByTile, this.#oakByFullRect, record)
    record.size--
    addToByTileTree(this.oakByTile, this.#oakByFullRect, record)

    if (record.size < 0) {
      this.#destroyOak(record) // fait le queueStaticUpdate
      return
    }

    const growthDelay = (ITEMS.oak.growth * seededRNG.randomGetRealMinMax(0.8, 1.2)) | 0
    const {priority, capacity} = MICROTASK.OAK_GROW
    const taskId = `oak_grow_${record.id}`
    record.growthTimestamp = taskScheduler.requeue(taskId, growthDelay, this.growOak, priority, capacity, record.soilIndex)

    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
   * Détruit un oak complètement : retire toutes les structures, supprime ses spots bolete,
   * libère blockedTiles (placement + mining sol).
   * @param {object} record — record TREE
   */
  #destroyOak (record) {
    // Retrait byTile et byChunk
    removeFromByTileTree(this.oakByTile, this.#oakByFullRect, record)
    removeFromByChunk(this.#oakByChunk, record)
    this.#oakDisplayed.delete(record)

    // blockedTiles — rectangle de corps
    const px = record.soilIndex & 0x3FF
    const py = record.index >> 10
    blockedTiles.unblockPlacementRect(px, py, record.w, record.h)

    // blockedTiles — sol (3 tuiles)
    const soilX = record.soilIndex & 0x3FF
    const soilY = record.soilIndex >> 10
    blockedTiles.unblockMiningRect(soilX, soilY, record.w, 1)

    // Supprime les spots bolete associés
    const bLeft = this.#boleteSpotsBySoil.get(record.soilIndex - 1)
    const bRight = this.#boleteSpotsBySoil.get(record.soilIndex + record.w)
    if (bLeft !== undefined) this.#destroyBoleteSpot(bLeft)
    if (bRight !== undefined) this.#destroyBoleteSpot(bRight)

    // Retrait de la liste principale (swap-last)
    const idx = this.#oakList.indexOf(record)
    if (idx !== -1) {
      this.#oakList[idx] = this.#oakList[this.#oakList.length - 1]
      this.#oakList.length--
    }

    // #oakBySoil — 3 entrées
    this.#oakBySoil.delete(record.soilIndex)
    this.#oakBySoil.delete(record.soilIndex + 1)
    this.#oakBySoil.delete(record.soilIndex + 2)
    // #oakXSet — 3 entrées
    this.#oakXSet.delete(record.soilIndex & 0x3ff)
    this.#oakXSet.delete((record.soilIndex & 0x3ff) + 1)
    this.#oakXSet.delete((record.soilIndex & 0x3ff) + 2)

    // Purge des tâches scheduler
    taskScheduler.dequeue(`oak_grow_${record.id}`)
    taskScheduler.dequeue(`oak_shake_${record.id}`)

    // Persistance : marque deleted
    record.deleted = true
    saveManager.queueStaticUpdate({storeName: 'plant', record})

    // Notifie les autres systèmes : nouveaux spots potentiels au sol libérés
    eventBus.emit('ecosystem/tree-destroyed', {tileIndex: record.soilIndex + 1, treeId: 'oak'})
  }

  /**
   * Détruit un spot bolete (présent ou non) : retire toutes les structures et persiste.
   * @param {object} record — record MUSHROOM (bolete spot)
   */
  #destroyBoleteSpot (record) {
    if (record.present) this.#destroyBoletePresent(record)

    // Retrait de #boleteList (swap-last)
    const idx = this.#boleteList.indexOf(record)
    if (idx !== -1) {
      this.#boleteList[idx] = this.#boleteList[this.#boleteList.length - 1]
      this.#boleteList.length--
    }
    this.#boleteSpotsBySoil.delete(record.soilIndex)

    record.deleted = true
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  // ////////// //
  // PLANTATION //
  // ////////// //

  /**
   * Indique si un Acorn peut être planté sur ce soilIndex.
   * @param {number} soilIndex — (y << 10) | x
   * @returns {boolean}
   */
  canSow (soilIndex, seed) {
    if (seed !== 'acorn') return null
    return true
  }

  /**
   * Construit le tableau d'images d'un oak en tirant aléatoirement parmi les variantes disponibles.
   * Miroir de PlantGenerator.#buildTreeImages.
   * @param {number} soilX — coordonnée X de la tuile support gauche
   * @returns {Array<{tree, row, col, x}>}
   */
  #buildTreeImages (soilX) {
    const imageTable = TREE_IMAGES.oak
    const images = []
    for (let i = 0; i < imageTable.length; i++) {
      const col = seededRNG.randomGetArrayIndex(imageTable[i])
      images.push({tree: 'oak', row: i, col, x: soilX - 1})
    }
    return images
  }

  /**
   * Liaison EventBus : 'sewed/acorn' — le joueur a planté un acorn sur une tuile GRASSFOREST
   * valide (vérifications déjà faites par SowingManager). Crée l'oak (size=0) et ses deux
   * spots bolete (present=false), enregistre dans toutes les structures, persiste et notifie.
   * @param {number} tileIndex — (y << 10) | x, tuile cliquée (tuile centrale du sol, soilIndex+1)
   */
  onSewedAcorn (tileIndex) {
    const TREE_H = 18
    const TREE_W = 3
    const soilIndex = tileIndex - 1
    const soilX = soilIndex & 0x3FF
    const soilY = soilIndex >> 10

    const id = uniqueIdGenerator.getUniqueId()
    const growthDelay = (ITEMS.oak.growth * seededRNG.randomGetRealMinMax(0.8, 1.2)) | 0
    const {priority, capacity} = MICROTASK.OAK_GROW
    const growthTimestamp = taskScheduler.enqueue(`oak_grow_${id}`, growthDelay, this.growOak, priority, capacity, soilIndex)

    const oakRecord = {
      id,
      itemId: 'oak',
      kind: PLANT_KIND.TREE,
      type: PLANT_TYPE.OAK,
      index: soilIndex - TREE_H * WORLD_WIDTH,
      soilIndex,
      w: TREE_W,
      h: TREE_H,
      size: 0,
      images: this.#buildTreeImages(soilX),
      grass: NODES.GRASSFOREST.code,
      x: soilX,
      yTop: soilY - TREE_H,
      yBottom: soilY - 1,
      growthTimestamp,
      shakedTimestamp: null,
      blocked: 0,
      deleted: false
    }
    this.initPlant(oakRecord)
    saveManager.queueStaticUpdate({storeName: 'plant', record: oakRecord})

    // Pour que l'arbre soit rendu immédiatement.
    addToDisplayed(this.#oakDisplayed, oakRecord)

    const MUSH_H = 2
    const MUSH_W = 1
    for (const bSoilX of [soilX - 1, soilX + 3]) {
      const bSoilIndex = (soilY << 10) | bSoilX
      const boleteRecord = {
        id: uniqueIdGenerator.getUniqueId(),
        kind: PLANT_KIND.MUSHROOM,
        type: PLANT_TYPE.BOLETE,
        itemId: 'bolete',
        index: bSoilIndex - MUSH_H * WORLD_WIDTH,
        soilIndex: bSoilIndex,
        w: MUSH_W,
        h: MUSH_H,
        present: false,
        deleted: false
      }
      this.initPlant(boleteRecord)
      saveManager.queueStaticUpdate({storeName: 'plant', record: boleteRecord})
    }

    eventBus.emit('ecosystem/tree-planted', {tileIndex: soilIndex + 1, treeId: 'oak'})
  }

  // ////////// //
  // CROISSANCE //
  // ////////// //

  growOak (soilIndex) {
    const record = this.#oakBySoil.get(soilIndex)

    if (record === undefined) return
    if (record.size >= 4) { record.growthTimestamp = null; return }
    if (record.blocked > 0) return // arbre bloqué : croissance suspendue, tâche abandonnée

    removeFromByTileTree(this.oakByTile, this.#oakByFullRect, record)
    record.size++
    addToByTileTree(this.oakByTile, this.#oakByFullRect, record)

    if (record.size < 4) {
      const growthDelay = (ITEMS.oak.growth * seededRNG.randomGetRealMinMax(0.8, 1.2)) | 0
      const {priority, capacity} = MICROTASK.OAK_GROW
      record.growthTimestamp = taskScheduler.enqueue(`oak_grow_${record.id}`, growthDelay, this.growOak, priority, capacity, soilIndex)
    } else {
      record.growthTimestamp = null
    }

    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  // /////// //
  // SHAKING //
  // /////// //

  /**
   * L'action de secouage est de nouveau autorisée sur cet arbte.
   * @param {number} soilIndex — (y << 10) | x, tuile de gauche du sol, sur lequel se trouve l'arbre)
   */
  oakEndShake (soilIndex) {
    const record = this.#oakBySoil.get(soilIndex)
    if (record === undefined) return

    record.shakedTimestamp = null
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  onShaked (soilIndex) {
    const record = this.#oakBySoil.get(soilIndex)
    if (record === undefined) return

    if (record.shakedTimestamp !== null) {
      this.onChopped(record)
      return
    }

    const {priority, capacity} = MICROTASK.OAK_END_SHAKE
    const shakedTimestamp = taskScheduler.enqueue(`oak_shake_${record.id}`, 24 * 60 * 1000, this.oakEndShake, priority, capacity, soilIndex)
    record.shakedTimestamp = shakedTimestamp
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  // ///// //
  // DEBUG //
  // ///// //

  /**
 * DEBUG — Affiche un cercle jaune au centre de la tuile sous chaque spot enregistré dans #list.
 * Vérifie la cohérence avec #spotsBySoil (même cardinal attendu).
 * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
 */
  debugRenderSpots (ctx) {
    ctx.save()
    ctx.fillStyle = 'rgba(255, 0, 0, 0.7)'
    for (const record of this.#boleteList) {
      const cx = ((record.index & 0x3FF) << 4) + 8
      const cy = ((record.index >> 10) << 4) + 40
      ctx.beginPath()
      ctx.arc(cx, cy, 3, 0, 6.2832)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(255, 0, 255, 0.7)'

    for (const record of this.#oakList) {
      const cx = ((record.soilIndex & 0x3FF) << 4) + 8
      const cy = ((record.soilIndex >> 10) << 4) + 8
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, 6.2832)
      ctx.fill()
    }
    if (this.#boleteList.length !== this.#boleteSpotsBySoil.size) {
      console.warn(`SunflowerSystem: #list(${this.#boleteList.length}) !== #spotsBySoil(${this.#boleteSpotsBySoil.size})`)
    }
    ctx.restore()
  }
}
export const oakSystem = new OakSystem()

/* ====================================================================================================
   MAHOGANY SYSTEM
   ==================================================================================================== */

// Lignes d'images empilées par size (0 à 4) — identique à OAK_SIZE_ROWS, dupliqué pour garder
// chaque système autonome (pas de dépendance croisée OakSystem/MahoganySystem)
const MAHOGANY_SIZE_ROWS = [
  [1, 0],
  [1, 2, 0],
  [1, 2, 3, 0],
  [1, 2, 3, 4, 0],
  [1, 2, 3, 4, 5, 6]
]

class MahoganySystem {
  // --- Mahogany (TREE) ---
  mahoganyByTile = new Map() // Map<tileIndex, record> — public, zone d'interaction (size-dépendante)
  #mahoganyByFullRect = new Map() // Map<tileIndex, record> — rectangle complet 3×18, surveillance obstruction
  #mahoganyList = [] // record[] — tous les mahoganies
  #mahoganyByChunk = new Map() // Map<chunkKey, Set> — lookup spatial pour onPreloadChunksChanged
  #mahoganyBySoil = new Map() // Map<soilIndex, record> — 3 entrées par mahogany (soilIndex, +1, +2) : détection minage/changement du sol
  #mahoganyXSet = new Set() // Set<number> — x (leftmost) des mahoganies vivants : lookup pour isMahoganyAtColumn (miroir structurel de #oakXSet ; aucun système Jungle ne l'utilise pour l'instant)
  #mahoganyDisplayed = new Set() // Set<record> — mahoganies dans les chunks preload (cible render)

  // --- Pink Mycenia (MUSHROOM) ---
  pinkMyceniaByTile = new Map() // Map<tileIndex, record> — public, lookup par tuile
  #pinkMyceniaList = [] // record[] — tous les spots (présents ou non)
  #pinkMyceniaByChunk = new Map() // Map<chunkKey, Set> — lookup spatial pour onPreloadChunksChanged
  #pinkMyceniaBySoil = new Map() // Map<soilIndex, record> — spots présents : détection minage de la tuile sol
  #pinkMyceniaSpotsBySoil = new Map() // Map<soilIndex, record> — tous les spots : lookup pour suppression (destruction d'un mahogany)
  #pinkMyceniaDisplayed = new Set() // Set<record> — spots dans les chunks preload (cible render)
  #pinkMyceniaImage = null // ITEMS.pinkMycenia.placed, mis en cache dans init()

  constructor () {
    // EventBus
    this.onHour16PinkMycenia = this.onHour16PinkMycenia.bind(this)
    eventBus.on('time/every-hour-16', this.onHour16PinkMycenia)
    this.onHour5PinkMycenia = this.onHour5PinkMycenia.bind(this)
    eventBus.on('time/every-hour-5', this.onHour5PinkMycenia)
    this.onTileChangedMahogany = this.onTileChangedMahogany.bind(this)
    eventBus.on('world/tile-changed', this.onTileChangedMahogany)
    this.onSewedSamara = this.onSewedSamara.bind(this)
    eventBus.on('sewed/samara', this.onSewedSamara)
    this.onShaked = this.onShaked.bind(this)
    eventBus.on('shaked/mahogany', this.onShaked)
    // Micro-task
    this.unbloomPinkMycenia = this.unbloomPinkMycenia.bind(this)
    this.bloomPinkMycenia = this.bloomPinkMycenia.bind(this)
    this.growMahogany = this.growMahogany.bind(this)
    this.mahoganyEndShake = this.mahoganyEndShake.bind(this)
  }

  /**
   * Réinitialise toutes les structures (mahogany et pink mycenia) et met en cache le sprite pink mycenia.
   */
  init () {
    this.mahoganyByTile.clear()
    this.#mahoganyByFullRect.clear()
    this.#mahoganyList.length = 0
    this.#mahoganyByChunk.clear()
    this.#mahoganyBySoil.clear()
    this.#mahoganyXSet.clear()
    this.#mahoganyDisplayed.clear()

    this.pinkMyceniaByTile.clear()
    this.#pinkMyceniaList.length = 0
    this.#pinkMyceniaByChunk.clear()
    this.#pinkMyceniaBySoil.clear()
    this.#pinkMyceniaSpotsBySoil.clear()
    this.#pinkMyceniaDisplayed.clear()

    this.#pinkMyceniaImage = ITEMS.pinkMycenia.placed // après hydratation
  }

  /**
   * Hydrate un record depuis la DB. Aiguille par kind.
   * @param {object} record
   */
  initPlant (record) {
    if (record.kind === PLANT_KIND.TREE) {
      const soilIndex = record.soilIndex
      this.#mahoganyList.push(record)
      this.#mahoganyBySoil.set(soilIndex, record)
      this.#mahoganyBySoil.set(soilIndex + 1, record)
      this.#mahoganyBySoil.set(soilIndex + 2, record)
      this.#mahoganyXSet.add((soilIndex & 0x3ff))
      this.#mahoganyXSet.add((soilIndex & 0x3ff) + 1)
      this.#mahoganyXSet.add((soilIndex & 0x3ff) + 2)
      addToByTileTree(this.mahoganyByTile, this.#mahoganyByFullRect, record)
      addToByChunk(this.#mahoganyByChunk, record)

      const px = record.index & 0x3FF
      const py = record.index >> 10
      blockedTiles.blockPlacementRect(px, py, record.w, record.h)

      const soilX = soilIndex & 0x3FF
      const soilY = soilIndex >> 10
      blockedTiles.blockMiningRect(soilX, soilY, record.w, 1)

      if (record.growthTimestamp !== null) {
        const {priority, capacity} = MICROTASK.MAHOGANY_GROW
        taskScheduler.enqueueAbsolute(`mahogany_grow_${record.id}`, record.growthTimestamp, this.growMahogany, priority, capacity, soilIndex)
      }
      if (record.shakedTimestamp !== null) {
        const {priority, capacity} = MICROTASK.MAHOGANY_END_SHAKE
        taskScheduler.enqueueAbsolute(`mahogany_shake_${record.id}`, record.shakedTimestamp, this.mahoganyEndShake, priority, capacity, soilIndex)
      }

      return
    }

    // record.kind === PLANT_KIND.MUSHROOM (pink mycenia)
    this.#pinkMyceniaList.push(record)
    this.#pinkMyceniaSpotsBySoil.set(record.soilIndex, record)
    if (!record.present) return
    addToByTile(this.pinkMyceniaByTile, record)
    addToByChunk(this.#pinkMyceniaByChunk, record)
    this.#pinkMyceniaBySoil.set(record.soilIndex, record)
    blockedTiles.blockPlacement(record.index)
    blockedTiles.blockPlacement(record.index + WORLD_WIDTH)
  }

  /**
   * Reconstruit #mahoganyDisplayed et #pinkMyceniaDisplayed depuis les chunks preload de la caméra.
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) {
    buildDisplayed(this.#mahoganyDisplayed, this.#mahoganyByChunk, preloadChunks)
    buildDisplayed(this.#pinkMyceniaDisplayed, this.#pinkMyceniaByChunk, preloadChunks)
  }

  /**
   * Dessine les pink mycenia puis les mahoganies visibles et présents (même ordre de calque
   * que OakSystem : champignons sous les arbres).
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  render (ctx) {
    const img = this.#pinkMyceniaImage
    for (const record of this.#pinkMyceniaDisplayed) {
      const pxX = (record.index & 0x3FF) << 4
      const pxY = ((record.index >> 10) << 4) + 2
      ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
    }

    for (const record of this.#mahoganyDisplayed) {
      const rows = MAHOGANY_SIZE_ROWS[record.size]
      const soilYPx = ((record.soilIndex >> 10) << 4) + 2
      for (let i = 0; i < rows.length; i++) {
        const image = record.images[rows[i]]
        const img = TREE_IMAGES[image.tree][image.row][image.col]
        const pxX = image.x << 4
        const pxY = soilYPx - 48 * (i + 1)
        ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
      }
    }
  }

  /**
   * Détruit un pink mycenia présent sans loot : retire toutes les structures et persiste.
   * Guard : no-op si record.present est déjà false.
   * @param {object} record
   */
  #destroyPinkMyceniaPresent (record) {
    if (!record.present) return
    record.present = false
    removeFromByTile(this.pinkMyceniaByTile, record)
    removeFromByChunk(this.#pinkMyceniaByChunk, record)
    this.#pinkMyceniaBySoil.delete(record.soilIndex)
    this.#pinkMyceniaDisplayed.delete(record)
    blockedTiles.unblockPlacement(record.index)
    blockedTiles.unblockPlacement(record.index + WORLD_WIDTH)
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
   * Traite le foraging réussi d'un pink mycenia (hors loot, géré par ForagingManager).
   * No-op pour un mahogany — un mahogany se mine/coupe, il ne se forage pas.
   * @param {object} record
   */
  onForaged (record) {
    if (record.kind === PLANT_KIND.TREE) return
    this.#destroyPinkMyceniaPresent(record)
  }

  /**
   * Retourne le record (mahogany ou pink mycenia) couvrant la tuile donnée, ou null.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {object|null}
   */
  getPlantAt (tileIndex) {
    return this.mahoganyByTile.get(tileIndex) ?? this.pinkMyceniaByTile.get(tileIndex) ?? null
  }

  /**
   * Indique si le record est actuellement présent (forageable).
   * Un mahogany n'a pas de notion de present/absent : son existence en tant que record vaut
   * présence. Un pink mycenia, en revanche, oscille selon le cycle jour/nuit — seul
   * record.present fait foi.
   * @param {object} record
   * @returns {boolean}
   */
  isPresent (record) { return record.kind === PLANT_KIND.TREE ? !record.deleted : record.present }

  /**
   * Indique si un mahogany vivant occupe cette tuile de sol. O(1), zéro allocation.
   * @param {number} x
   * @returns {boolean}
   */
  isMahoganyAtColumn (x) { return this.#mahoganyXSet.has(x) }

  /** Liaison EventBus : 'time/every-hour-16' — tous les pink mycenia présents repassent à false. */
  onHour16PinkMycenia () {
    const {priority, capacity} = MICROTASK.UNBLOOM_PINKMYCENIA
    microTasker.enqueue(this.unbloomPinkMycenia, priority, capacity)
  }

  /** Microtâche : tous les pink mycenia présents repassent à present=false. */
  unbloomPinkMycenia () {
    for (const record of this.#pinkMyceniaList) {
      if (!record.present) continue
      this.#destroyPinkMyceniaPresent(record)
    }
  }

  /** Liaison EventBus : 'time/every-hour-5' — tirage de floraison matinale des pink mycenia. */
  onHour5PinkMycenia () {
    const {priority, capacity} = MICROTASK.BLOOM_PINKMYCENIA
    microTasker.enqueue(this.bloomPinkMycenia, priority, capacity)
  }

  /**
   * Microtâche : parmi les spots dont le soilIndex est une GRASSJUNGLE, 50% passent à present=true.
   */
  bloomPinkMycenia () {
    const GRASSJUNGLE = NODES.GRASSJUNGLE.code
    for (const record of this.#pinkMyceniaList) {
      if (chunkManager.getTileAt(record.soilIndex) !== GRASSJUNGLE) continue
      if (!seededRNG.randomGetBool()) continue
      if (!blockedTiles.canPlace(record.index) || !blockedTiles.canPlace(record.index + WORLD_WIDTH)) continue

      record.present = true
      addToByTile(this.pinkMyceniaByTile, record)
      addToByChunk(this.#pinkMyceniaByChunk, record)
      this.#pinkMyceniaBySoil.set(record.soilIndex, record)
      blockedTiles.blockPlacement(record.index)
      blockedTiles.blockPlacement(record.index + WORLD_WIDTH)
      saveManager.queueStaticUpdate({storeName: 'plant', record})
    }
    buildDisplayed(this.#pinkMyceniaDisplayed, this.#pinkMyceniaByChunk, camera.preloadChunks)
  }

  /**
   * Réagit à un changement de tuile (EventBus : 'world/tile-changed').
   * Branche mahogany : TODO — tuile support, secousse, etc. pas encore définis (miroir OakSystem).
   * Branche pink mycenia : un pink mycenia présent disparaît (present=false, spot conservé) si
   * l'une de ses 2 tuiles de corps (.index, .index + WORLD_WIDTH) devient non-SKY, ou si sa
   * tuile de support (.soilIndex) cesse d'être GRASSJUNGLE.
   * @param {{tileIndex: number, tileOldCode: number, tileNewCode: number}} payload
   */
  onTileChangedMahogany ({tileIndex, tileOldCode, tileNewCode}) {
    const SKY = NODES.SKY.code
    const GRASSJUNGLE = NODES.GRASSJUNGLE.code

    // Cas 1 — Pink Mycenia - une des 2 tuiles de corps du pink mycenia devient non-SKY
    const byBodyRecord = this.pinkMyceniaByTile.get(tileIndex)
    if (byBodyRecord !== undefined && tileNewCode !== SKY) {
      this.#destroyPinkMyceniaPresent(byBodyRecord)
      return
    }

    // Cas 2 — Pink Mycenia - tuile de support : GRASSJUNGLE perdu
    const bySoilRecord = this.#pinkMyceniaBySoil.get(tileIndex)
    if (bySoilRecord !== undefined && tileNewCode !== GRASSJUNGLE) {
      this.#destroyPinkMyceniaPresent(bySoilRecord)
    }

    // Cas 3 — Mahogany - tuile du rectangle complet 3×18 change d'état SKY
    const byFullRecord = this.#mahoganyByFullRect.get(tileIndex)
    if (byFullRecord === undefined) return

    // Cas 3.1. Obstruction : une tuile SKY devient autre chose
    if (tileNewCode !== SKY) {
      byFullRecord.blocked++
      if (byFullRecord.blocked === 1) {
        // Transition libre → bloqué : annule la croissance en cours
        taskScheduler.dequeue(`mahogany_grow_${byFullRecord.id}`)
        byFullRecord.growthTimestamp = null
      }
      saveManager.queueStaticUpdate({storeName: 'plant', record: byFullRecord})
      return
    }

    // Cas 3.2. Libération : une tuile redevient SKY
    if (byFullRecord.blocked === 0) return // guard : compteur déjà à zéro (cohérence)
    byFullRecord.blocked--
    if (byFullRecord.blocked === 0) {
      // Transition bloqué → libre : relance la croissance si l'arbre n'est pas adulte
      if (byFullRecord.size < 4) {
        const growthDelay = (ITEMS.mahogany.growth * seededRNG.randomGetRealMinMax(0.8, 1.2)) | 0
        const {priority, capacity} = MICROTASK.MAHOGANY_GROW
        byFullRecord.growthTimestamp = taskScheduler.enqueue(
          `mahogany_grow_${byFullRecord.id}`, growthDelay, this.growMahogany, priority, capacity, byFullRecord.soilIndex
        )
      }
    }
    saveManager.queueStaticUpdate({storeName: 'plant', record: byFullRecord})
  }

  // //////// //
  // CHOPPING //
  // //////// //

  /**
   * Traite le chopping réussi d'un mahogany (hors loot, géré par ChoppingManager).
   * Décrémente size. Si size atteint -1, détruit l'arbre entièrement (et ses pink mycenia).
   * Sinon, met à jour byTile, blockedTiles, et persiste.
   * @param {object} record — record TREE (mahogany)
   */
  onChopped (record) {
    removeFromByTileTree(this.mahoganyByTile, this.#mahoganyByFullRect, record)
    record.size--
    addToByTileTree(this.mahoganyByTile, this.#mahoganyByFullRect, record)

    if (record.size < 0) {
      this.#destroyMahogany(record) // fait le queueStaticUpdate
      return
    }

    const growthDelay = (ITEMS.mahogany.growth * seededRNG.randomGetRealMinMax(0.8, 1.2)) | 0
    const {priority, capacity} = MICROTASK.MAHOGANY_GROW
    const taskId = `mahogany_grow_${record.id}`
    record.growthTimestamp = taskScheduler.requeue(taskId, growthDelay, this.growMahogany, priority, capacity, record.soilIndex)

    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
   * Détruit un mahogany complètement : retire toutes les structures, supprime ses spots pink
   * mycenia, libère blockedTiles (placement + mining sol).
   * @param {object} record — record TREE
   */
  #destroyMahogany (record) {
    // Retrait byTile et byChunk
    removeFromByTileTree(this.mahoganyByTile, this.#mahoganyByFullRect, record)
    removeFromByChunk(this.#mahoganyByChunk, record)
    this.#mahoganyDisplayed.delete(record)

    // blockedTiles — rectangle de corps
    const px = record.soilIndex & 0x3FF
    const py = record.index >> 10
    blockedTiles.unblockPlacementRect(px, py, record.w, record.h)

    // blockedTiles — sol (3 tuiles)
    const soilX = record.soilIndex & 0x3FF
    const soilY = record.soilIndex >> 10
    blockedTiles.unblockMiningRect(soilX, soilY, record.w, 1)

    // Supprime les spots pink mycenia associés
    const pLeft = this.#pinkMyceniaSpotsBySoil.get(record.soilIndex - 1)
    const pRight = this.#pinkMyceniaSpotsBySoil.get(record.soilIndex + record.w)
    if (pLeft !== undefined) this.#destroyPinkMyceniaSpot(pLeft)
    if (pRight !== undefined) this.#destroyPinkMyceniaSpot(pRight)

    // Retrait de la liste principale (swap-last)
    const idx = this.#mahoganyList.indexOf(record)
    if (idx !== -1) {
      this.#mahoganyList[idx] = this.#mahoganyList[this.#mahoganyList.length - 1]
      this.#mahoganyList.length--
    }

    // #mahoganyBySoil — 3 entrées
    this.#mahoganyBySoil.delete(record.soilIndex)
    this.#mahoganyBySoil.delete(record.soilIndex + 1)
    this.#mahoganyBySoil.delete(record.soilIndex + 2)
    // #mahoganyXSet — 3 entrées
    this.#mahoganyXSet.delete(record.soilIndex & 0x3ff)
    this.#mahoganyXSet.delete((record.soilIndex & 0x3ff) + 1)
    this.#mahoganyXSet.delete((record.soilIndex & 0x3ff) + 2)

    // Purge des tâches scheduler
    taskScheduler.dequeue(`mahogany_grow_${record.id}`)
    taskScheduler.dequeue(`mahogany_shake_${record.id}`)

    // Persistance : marque deleted
    record.deleted = true
    saveManager.queueStaticUpdate({storeName: 'plant', record})

    // Notifie les autres systèmes : nouveaux spots potentiels au sol libérés
    eventBus.emit('ecosystem/tree-destroyed', {tileIndex: record.soilIndex + 1, treeId: 'mahogany'})
  }

  /**
   * Détruit un spot pink mycenia (présent ou non) : retire toutes les structures et persiste.
   * @param {object} record — record MUSHROOM (pink mycenia spot)
   */
  #destroyPinkMyceniaSpot (record) {
    if (record.present) this.#destroyPinkMyceniaPresent(record)

    // Retrait de #pinkMyceniaList (swap-last)
    const idx = this.#pinkMyceniaList.indexOf(record)
    if (idx !== -1) {
      this.#pinkMyceniaList[idx] = this.#pinkMyceniaList[this.#pinkMyceniaList.length - 1]
      this.#pinkMyceniaList.length--
    }
    this.#pinkMyceniaSpotsBySoil.delete(record.soilIndex)

    record.deleted = true
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  // ////////// //
  // PLANTATION //
  // ////////// //

  /**
   * Indique si un Samara peut être planté sur ce soilIndex.
   * @param {number} soilIndex — (y << 10) | x
   * @returns {boolean}
   */
  canSow (soilIndex, seed) {
    if (seed !== 'samara') return null
    return true
  }

  /**
   * Construit le tableau d'images d'un mahogany en tirant aléatoirement parmi les variantes
   * disponibles. Miroir de PlantGenerator.#buildTreeImages.
   * @param {number} soilX — coordonnée X de la tuile support gauche
   * @returns {Array<{tree, row, col, x}>}
   */
  #buildTreeImages (soilX) {
    const imageTable = TREE_IMAGES.mahogany
    const images = []
    for (let i = 0; i < imageTable.length; i++) {
      const col = seededRNG.randomGetArrayIndex(imageTable[i])
      images.push({tree: 'mahogany', row: i, col, x: soilX - 1})
    }
    return images
  }

  /**
   * Liaison EventBus : 'sewed/samara' — le joueur a planté un samara sur une tuile GRASSJUNGLE
   * valide (vérifications déjà faites par SowingManager). Crée le mahogany (size=0) et ses deux
   * spots pink mycenia (present=false), enregistre dans toutes les structures, persiste et notifie.
   * @param {number} tileIndex — (y << 10) | x, tuile cliquée (tuile centrale du sol, soilIndex+1)
   */
  onSewedSamara (tileIndex) {
    const TREE_H = 18
    const TREE_W = 3
    const soilIndex = tileIndex - 1
    const soilX = soilIndex & 0x3FF
    const soilY = soilIndex >> 10

    const id = uniqueIdGenerator.getUniqueId()
    const growthDelay = (ITEMS.mahogany.growth * seededRNG.randomGetRealMinMax(0.8, 1.2)) | 0
    const {priority, capacity} = MICROTASK.MAHOGANY_GROW
    const growthTimestamp = taskScheduler.enqueue(`mahogany_grow_${id}`, growthDelay, this.growMahogany, priority, capacity, soilIndex)

    const mahoganyRecord = {
      id,
      itemId: 'mahogany',
      kind: PLANT_KIND.TREE,
      type: PLANT_TYPE.MAHOGANY,
      index: soilIndex - TREE_H * WORLD_WIDTH,
      soilIndex,
      w: TREE_W,
      h: TREE_H,
      size: 0,
      images: this.#buildTreeImages(soilX),
      grass: NODES.GRASSJUNGLE.code,
      x: soilX,
      yTop: soilY - TREE_H,
      yBottom: soilY - 1,
      growthTimestamp,
      shakedTimestamp: null,
      blocked: 0,
      deleted: false
    }
    this.initPlant(mahoganyRecord)
    saveManager.queueStaticUpdate({storeName: 'plant', record: mahoganyRecord})

    // Pour que l'arbre soit rendu immédiatement.
    addToDisplayed(this.#mahoganyDisplayed, mahoganyRecord)

    const MUSH_H = 2
    const MUSH_W = 1
    for (const pSoilX of [soilX - 1, soilX + 3]) {
      const pSoilIndex = (soilY << 10) | pSoilX
      const pinkMyceniaRecord = {
        id: uniqueIdGenerator.getUniqueId(),
        kind: PLANT_KIND.MUSHROOM,
        type: PLANT_TYPE.PINKMYCENIA,
        itemId: 'pinkMycenia',
        index: pSoilIndex - MUSH_H * WORLD_WIDTH,
        soilIndex: pSoilIndex,
        w: MUSH_W,
        h: MUSH_H,
        present: false,
        deleted: false
      }
      this.initPlant(pinkMyceniaRecord)
      saveManager.queueStaticUpdate({storeName: 'plant', record: pinkMyceniaRecord})
    }

    eventBus.emit('ecosystem/tree-planted', {tileIndex: soilIndex + 1, treeId: 'mahogany'})
  }

  // ////////// //
  // CROISSANCE //
  // ////////// //

  /**
   * Callback TaskScheduler : fait croître le mahogany d'un tronçon (size++), sauf si obstrué.
   * Replanifie la prochaine pousse tant que size < 4, sinon fixe growthTimestamp à null.
   * @param {number} soilIndex — (y << 10) | x, tuile de gauche du sol
   */
  growMahogany (soilIndex) {
    const record = this.#mahoganyBySoil.get(soilIndex)

    if (record === undefined) return
    if (record.size >= 4) { record.growthTimestamp = null; return }
    if (record.blocked > 0) return // arbre bloqué : croissance suspendue, tâche abandonnée

    removeFromByTileTree(this.mahoganyByTile, this.#mahoganyByFullRect, record)
    record.size++
    addToByTileTree(this.mahoganyByTile, this.#mahoganyByFullRect, record)

    if (record.size < 4) {
      const growthDelay = (ITEMS.mahogany.growth * seededRNG.randomGetRealMinMax(0.8, 1.2)) | 0
      const {priority, capacity} = MICROTASK.MAHOGANY_GROW
      record.growthTimestamp = taskScheduler.enqueue(`mahogany_grow_${record.id}`, growthDelay, this.growMahogany, priority, capacity, soilIndex)
    } else {
      record.growthTimestamp = null
    }

    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  // /////// //
  // SHAKING //
  // /////// //

  /**
   * L'action de secouage est de nouveau autorisée sur cet arbre.
   * @param {number} soilIndex — (y << 10) | x, tuile de gauche du sol, sur lequel se trouve l'arbre
   */
  mahoganyEndShake (soilIndex) {
    const record = this.#mahoganyBySoil.get(soilIndex)
    if (record === undefined) return

    record.shakedTimestamp = null
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
   * Liaison EventBus : 'shaked/mahogany' — le joueur a secoué le mahogany. Si déjà secoué
   * récemment (shakedTimestamp actif), la secousse est traitée comme un chopping (pénalité).
   * Sinon, démarre le cooldown de 24h.
   * @param {number} soilIndex — (y << 10) | x, tuile de gauche du sol
   */
  onShaked (soilIndex) {
    const record = this.#mahoganyBySoil.get(soilIndex)
    if (record === undefined) return

    if (record.shakedTimestamp !== null) {
      this.onChopped(record)
      return
    }

    const {priority, capacity} = MICROTASK.MAHOGANY_END_SHAKE
    const shakedTimestamp = taskScheduler.enqueue(`mahogany_shake_${record.id}`, 24 * 60 * 1000, this.mahoganyEndShake, priority, capacity, soilIndex)
    record.shakedTimestamp = shakedTimestamp
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  // ///// //
  // DEBUG //
  // ///// //

  /**
   * DEBUG — Affiche un cercle rose au centre de chaque spot pink mycenia, et un cercle
   * brun-mahogany au centre du sol de chaque mahogany. Vérifie la cohérence #pinkMyceniaList
   * vs #pinkMyceniaSpotsBySoil (même cardinal attendu).
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  debugRenderSpots (ctx) {
    ctx.save()
    ctx.fillStyle = 'rgba(255, 105, 180, 0.8)'
    for (const record of this.#pinkMyceniaList) {
      const cx = ((record.index & 0x3FF) << 4) + 8
      const cy = ((record.index >> 10) << 4) + 40
      ctx.beginPath()
      ctx.arc(cx, cy, 3, 0, 6.2832)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(180, 90, 40, 0.8)'

    for (const record of this.#mahoganyList) {
      const cx = ((record.soilIndex & 0x3FF) << 4) + 8
      const cy = ((record.soilIndex >> 10) << 4) + 8
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, 6.2832)
      ctx.fill()
    }
    if (this.#pinkMyceniaList.length !== this.#pinkMyceniaSpotsBySoil.size) {
      console.warn(`MahoganySystem: #list(${this.#pinkMyceniaList.length}) !== #spotsBySoil(${this.#pinkMyceniaSpotsBySoil.size})`)
    }
    ctx.restore()
  }
}
export const mahoganySystem = new MahoganySystem()

/* ====================================================================================================
   COCONUT SYSTEM
   ==================================================================================================== */

const COCONUT_FALL_MAX_DIST = 16
const COCONUT_FALL_SPEED = 3 // pixels par frame sur l'axe Y (10 tuiles/seconde à 60fps)

class CoconutSystem {
  byTile = new Map() // Map<tileIndex, record> — public, rectangle complet 3×15 (interaction = blocage)
  #byFullRect = new Map() // Map<tileIndex, record> — rectangle complet 3×15 (obstruction)
  #list = [] // record[] — tous les cocotiers
  #bySoil = new Map() // Map<soilIndex, record> — lookup O(1) pour les callbacks TaskScheduler
  #byChunk = new Map() // Map<chunkKey, Set> — lookup spatial pour onPreloadChunksChanged
  #displayed = new Set() // Set<record> — cible du render (chunks preload uniquement)
  #nutImg = null // image hydratée de la noix au sol
  #falling = {} // {[record.id]: {pxX, pxY, pxYFinal, frames}} — noix en cours de chute

  constructor () {
    // eventBus
    this.onShaked = this.onShaked.bind(this)
    eventBus.on('shaked/coconut', this.onShaked)
    // micro-tâches
    this.onCoconutCycle = this.onCoconutCycle.bind(this)
    this.onCoconutGroundDecay = this.onCoconutGroundDecay.bind(this)
  }

  /**
   * Réinitialise toutes les structures. Appelé en début de session.
   */
  init () {
    this.byTile.clear()
    this.#byFullRect.clear()
    this.#list.length = 0
    this.#byChunk.clear()
    this.#displayed.clear()
    this.#falling = {}
    this.#nutImg = ITEMS.coconut.placed
  }

  /**
   * Hydrate un record coconut depuis la DB et peuple les structures internes.
   * Bloque le placement sur 3 tuiles de large (w réel du cocotier) × 15 de haut,
   * et le minage sur les 3 tuiles de sol.
   * @param {object} record — record TREE/COCONUT (deleted=false garanti par l'appelant)
   */
  initPlant (record) {
    this.#list.push(record)
    addToByTileTree(this.byTile, this.#byFullRect, record)
    this.#bySoil.set(record.soilIndex, record)
    addToByChunk(this.#byChunk, record)

    const px = (record.index & 0x3FF) + 1
    const py = record.index >> 10
    blockedTiles.blockPlacementRect(px, py, record.w, record.h)

    const soilX = record.soilIndex & 0x3FF
    const soilY = record.soilIndex >> 10
    blockedTiles.blockMiningRect(soilX, soilY, record.w, 1)

    const {priority, capacity} = MICROTASK.COCONUT_CYCLE
    taskScheduler.enqueueAbsolute(`coconut_cycle_${record.id}`, record.treeTimestamp, this.onCoconutCycle, priority, capacity, record.soilIndex)

    if (record.groundTimestamp !== null) {
      const {priority: gPriority, capacity: gCapacity} = MICROTASK.COCONUT_GROUND_DECAY
      taskScheduler.enqueueAbsolute(`coconut_ground_${record.id}`, record.groundTimestamp, this.onCoconutGroundDecay, gPriority, gCapacity, record.soilIndex)
    }
  }

  /**
   * Reconstruit #displayed depuis les chunks preload de la caméra.
   * Uniquement pour les arbres : les noix de coco seront toutes affichées.
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) {
    buildDisplayed(this.#displayed, this.#byChunk, preloadChunks)
  }

  /**
   * Dessine les cocotiers visibles sur le contexte transformé.
   * Les 5 images (étages 0–3 + head) sont empilées du sol vers le sommet,
   * lookupées par key dans TREE_IMAGES.coconut (objet).
   * Si hasNutInTree, la noix de coco est dessinée centrée
   * sur le tronçon le plus haut, par-dessus le cocotier.
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  render (ctx) {
    const coconutImages = TREE_IMAGES.coconut
    for (const record of this.#displayed) {
      const soilYPx = ((record.soilIndex >> 10) << 4) + 2
      for (let i = 0; i < record.images.length; i++) {
        const image = record.images[i]
        const img = coconutImages[image.key][image.col]
        const pxX = image.x << 4
        const pxY = soilYPx - 48 * (i + 1)
        ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
      }
      if (record.hasNutInTree) {
        const nutImg = this.#nutImg
        const topPxX = (record.index & 0x3FF) << 4
        const topPxY = (record.index >> 10) << 4
        const nutPxX = topPxX + 32
        const nutPxY = topPxY + 16
        ctx.drawImage(IMAGE_CACHE[nutImg.imgIndex], nutImg.sx, nutImg.sy, nutImg.sw, nutImg.sh, nutPxX, nutPxY, 16, 16)
      }
    }
    this.#renderGroundNuts(ctx)
  }

  /**
   * Dessine les noix de coco posées au sol (record.groundTimestamp !== null), peu importe
   * leur position par rapport aux chunks preload — leur nombre est trop faible pour
   * justifier une structure spatiale dédiée.
   * La chute est animée via this.#falling.
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  #renderGroundNuts (ctx) {
    for (const record of this.#list) {
      if (record.groundTimestamp === null) continue

      const falling = this.#falling[record.id]
      if (falling !== undefined) {
        ctx.drawImage(IMAGE_CACHE[this.#nutImg.imgIndex], this.#nutImg.sx, this.#nutImg.sy, this.#nutImg.sw, this.#nutImg.sh, falling.pxX, falling.pxY, 16, 16)
        falling.pxY += COCONUT_FALL_SPEED
        falling.frames--
        if (falling.frames <= 0) delete this.#falling[record.id]
        continue
      }

      const pxX = (record.groundIndex & 0x3FF) << 4
      const pxY = (record.groundIndex >> 10) << 4
      ctx.drawImage(IMAGE_CACHE[this.#nutImg.imgIndex], this.#nutImg.sx, this.#nutImg.sy, this.#nutImg.sw, this.#nutImg.sh, pxX, pxY, 16, 16)
    }
  }

  /**
   * Retourne le record du cocotier couvrant la tuile donnée, ou null.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {object|null}
   */
  getPlantAt (tileIndex) {
    for (const record of this.#list) {
      if (record.groundTimestamp !== null && record.groundIndex === tileIndex) {
        return {itemId: 'coconut', isGroundNut: true, parentId: record.soilIndex, kind: record.kind, type: record.type}
      }
    }
    return this.byTile.get(tileIndex) ?? null
  }

  /**
   * Un cocotier est toujours présent.
   * @param {object} record
   * @returns {boolean}
   */
  isPresent (record) { return true }

  /**
   * Bascule périodique de l'arbre — exécute treeNextAction puis programme le cycle suivant.
   * 'fall' : si hasNutInTree, fait tomber la noix au sol (écrase l'ancienne noix au sol
   *          si présente) et bascule hasNutInTree à false. Si pas de noix (récoltée par
   *          shake entre temps), aucune chute — la noix au sol n'est pas affectée.
   * 'grow' : fait pousser une noix dans l'arbre (hasNutInTree = true).
   * Dans tous les cas, treeNextAction est inversé et un nouveau cycle est programmé.
   * @param {number} soilIndex — (y << 10) | x, clé du record dans #bySoil
   */
  onCoconutCycle (soilIndex) {
    const record = this.#bySoil.get(soilIndex)
    if (record === undefined) return

    if (record.treeNextAction === 'fall') {
      if (record.hasNutInTree) {
        const nutIndex = this.#findCoconutGroundIndex(record.soilIndex)
        if (nutIndex !== null) {
          record.groundIndex = nutIndex

          const pxYStart = (record.index >> 10) << 4
          const pxYFinal = (nutIndex >> 10) << 4
          const frames = ((pxYFinal - pxYStart) / COCONUT_FALL_SPEED) | 0
          this.#falling[record.id] = {pxX: (nutIndex & 0x3FF) << 4, pxY: pxYStart, pxYFinal, frames}

          const groundDelay = (COCONUT_CYCLE_DELAY * seededRNG.randomGetRealMinMax(0.8, 1.2)) | 0
          const {priority, capacity} = MICROTASK.COCONUT_GROUND_DECAY
          record.groundTimestamp = taskScheduler.enqueue(`coconut_ground_${record.id}`, groundDelay, this.onCoconutGroundDecay, priority, capacity, soilIndex)
        }
        record.hasNutInTree = false
      }
      record.treeNextAction = 'grow'
    } else {
      record.hasNutInTree = true
      record.treeNextAction = 'fall'
    }

    const cycleDelay = (COCONUT_CYCLE_DELAY * seededRNG.randomGetRealMinMax(0.8, 1.2)) | 0
    const {priority, capacity} = MICROTASK.COCONUT_CYCLE
    record.treeTimestamp = taskScheduler.enqueue(`coconut_cycle_${record.id}`, cycleDelay, this.onCoconutCycle, priority, capacity, soilIndex)

    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  // ////////////////////// //
  // NOIX DE COCO PAR TERRE //
  // ////////////////////// //

  /**
   * Cherche la position au sol où la noix de coco doit tomber, en s'écartant du centre
   * du tronc (3 tuiles de large) jusqu'à trouver une tuile de surface (findSurfaceIndex)
   * non bloquée pour le placement. Alterne gauche/droite (premier côté tiré 50/50 une
   * seule fois) en augmentant la distance d'1 tuile à chaque échec des deux côtés.
   * Abandonne au-delà de COCONUT_FALL_MAX_DIST tuiles.
   * @param {number} soilIndex — (y << 10) | x, coin gauche du sol du cocotier (w=3)
   * @returns {number|null} index de la tuile (SKY, au-dessus du sol) où poser la noix, ou null
   */
  #findCoconutGroundIndex (soilIndex) {
    const centerX = (soilIndex & 0x3FF) + 1
    const soilY = soilIndex >> 10
    let side = seededRNG.randomGetBool() ? 1 : -1

    for (let distance = 2; distance <= COCONUT_FALL_MAX_DIST; distance++) {
      for (let i = 0; i < 2; i++) {
        const x = centerX + side * distance
        const surfaceIndex = findSurfaceIndex((soilY << 10) | x) - WORLD_WIDTH
        if (blockedTiles.canPlace(surfaceIndex)) return surfaceIndex
        side = -side
      }
    }
    return null
  }

  /**
   * Disparition naturelle de la noix au sol — la noix n'a pas été ramassée par le joueur
   * dans le délai imparti. Réinitialise simplement groundTimestamp.
   * @param {number} soilIndex — (y << 10) | x, clé du record dans #bySoil
   */
  onCoconutGroundDecay (soilIndex) {
    const record = this.#bySoil.get(soilIndex)
    if (record === undefined) return

    record.groundTimestamp = null
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  // //////// //
  // FORAGING //
  // //////// //

  /**
   * Retourne true si la plante pointée par plant est forageable.
   * Seule la noix au sol (isGroundNut) est forageable sur un cocotier.
   * @param {object} plant — pseudo-record retourné par getPlantAt
   * @returns {boolean}
   */
  canForage (plant) { return plant.isGroundNut === true }

  /**
   * Foraging réussi d'une noix de coco au sol (isGroundNut garanti par canForage).
   * Supprime la noix au sol et annule toute animation de chute en cours.
   * Le loot est géré en amont par ForagingManager.
   * @param {object} plant — pseudo-record retourné par getPlantAt (contient parentId)
   */
  onForaged (plant) {
    const record = this.#bySoil.get(plant.parentId)
    if (record === undefined) return

    record.groundTimestamp = null
    delete this.#falling[record.id]
    taskScheduler.dequeue(`coconut_ground_${record.id}`)

    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  // //////// //
  // SHAKING //
  // //////// //

  /**
   * Retourne true si le cocotier peut être secoué (noix présente dans l'arbre).
   * @param {object} plant — pseudo-record retourné par getPlantAt
   * @returns {boolean}
   */
  canShake (plant) { return plant.isGroundNut !== true && plant.hasNutInTree === true }

  /**
   * Liaison EventBus : 'shaked/coconut' — le joueur a secoué le cocotier.
   * Si hasNutInTree, loot et retire la noix de l'arbre sans modifier le cycle
   * (treeTimestamp et treeNextAction restent inchangés).
   * @param {number} soilIndex — (y << 10) | x
   */
  onShaked (soilIndex) {
    const record = this.#bySoil.get(soilIndex)
    if (record === undefined) return
    if (!record.hasNutInTree) return

    record.hasNutInTree = false
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  // //////// //
  // Chopping //
  // //////// //
  /**
   * Le cocotier ne peut pas être coupé.
   * @returns {boolean}
   */
  canChop () { return false }
}

export const coconutSystem = new CoconutSystem()

/* ====================================================================================================
   FLORA MANAGER
   ====================================================================================================

   Singleton : floraManager.

   Orchestrateur unique de tous les systèmes de plantes. Aucune logique de rendu propre.

   Responsabilités :
     - Dispatcher les records actifs vers le système compétent (addPlant)
     - Propager les changements de chunks preload à tous les systèmes (onPreloadChunksChanged)
     - Déléguer render et requêtes spatiales à chaque système

   Interactions :
     eventBus          — écoute : 'camera/preload-chunks-changed' → onPreloadChunksChanged
     core.mjs          — appelant de init() et addPlant() au startSession
     systèmes internes — init, initPlant, onPreloadChunksChanged, render, getPlantAt

   Structures internes :
     #systemMap  — Map<kind*100+type, system> — dispatch O(1) vers le système compétent
     #allSystems — system[] — liste ordonnée pour render (arbres avant herbes avant champignons)

   ==================================================================================================== */

class FloraManager {
  constructor () {
    this.onPreloadChunksChanged = this.onPreloadChunksChanged.bind(this)
    eventBus.on('camera/preload-chunks-changed', this.onPreloadChunksChanged)
  }

  /**
   * Réinitialise tous les systèmes enregistrés.
   */
  init () {
    for (const system of ALL_PLANT_SYSTEMS) system.init()
  }

  /**
   * Dispatche un record vers le système compétent selon kind et type.
   * Les records deleted=false sont garantis par l'appelant.
   * @param {object} record — record de l'objectStore 'plant'
   */
  addPlant (record) {
    // const system = this.#systemMap.get(record.kind * 100 + record.type)
    const system = PLANT_SYSTEM_LOOKUP.get(record.kind * 100 + record.type)
    if (system === undefined) return
    system.initPlant(record)
  }

  /**
   * Propage le changement de chunks preload à tous les systèmes.
   * Liaison EventBus : 'camera/preload-chunks-changed'.
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) {
    for (const system of ALL_PLANT_SYSTEMS) system.onPreloadChunksChanged(preloadChunks)
  }

  /**
   * Retourne la plante couvrant la tuile donnée, ou null.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {object|null}
   */
  getPlantAt (tileIndex) {
    for (const system of ALL_PLANT_SYSTEMS) {
      const plant = system.getPlantAt(tileIndex)
      if (plant !== null) return plant
    }
    return null
  }

  /**
   * Dessine toutes les plantes visibles, système par système dans l'ordre de #allSystems.
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  render (ctx) {
    for (const system of ALL_PLANT_SYSTEMS) system.render(ctx)
  }

  /**
   * Délègue au système compétent la validation de semis d'une graine sur soilIndex.
   * Retourne false si aucun système ne reconnaît l'itemCode.
   * @param {number} soilIndex — (y << 10) | x
   * @param {string} itemCode  — code de la graine (ex: 'sunflowerSeed')
   * @returns {boolean}
   */
  canSow (soilIndex, seedId) {
    for (const system of ALL_PLANT_SYSTEMS) {
      if (system.canSow === undefined) continue // la plante ne se sème pas
      const result = system.canSow(soilIndex, seedId)
      if (result === null) continue // le système n'est pas concerné par la graine
      return result
    }
    return false // aucune plante ne correspond à la graine
  }

  /**
   * Délègue au système compétent la validation de foraging d'une plante.
   * Retourne false si le système ne permet pas le foraging sur ce record.
   * @param {object} plant — record ou pseudo-record retourné par getPlantAt
   * @returns {boolean}
   */
  canForage (plant) {
    const system = PLANT_SYSTEM_LOOKUP.get(plant.kind * 100 + plant.type)
    if (system === undefined || system.canForage === undefined) return true
    return system.canForage(plant)
  }

  /**
   * Délègue au système compétent la validation de shaking d'une plante.
   * Retourne false si le système ne permet pas le shaking sur ce record.
   * @param {object} plant — record ou pseudo-record retourné par getPlantAt
   * @returns {boolean}
   */
  canShake (plant) {
    const system = PLANT_SYSTEM_LOOKUP.get(plant.kind * 100 + plant.type)
    if (system === undefined || system.canShake === undefined) return true
    return system.canShake(plant)
  }

  /**
   * Délègue au système compétent la validation de chopping d'une plante.
   * Retourne true par défaut si le système n'implémente pas canChop.
   * @param {object} plant — record retourné par getPlantAt
   * @returns {boolean}
   */
  canChop (plant) {
    const system = PLANT_SYSTEM_LOOKUP.get(plant.kind * 100 + plant.type)
    if (system === undefined || system.canChop === undefined) return true
    return system.canChop(plant)
  }
}

export const floraManager = new FloraManager()

/* ====================================================================================================
   COBWEB SYSTEM
   ==================================================================================================== */

class CobwebSystem {
  constructor () {
    // EventBus
    this.onFirstLoopCobweb = this.onFirstLoopCobweb.bind(this)
    eventBus.on('time/first-loop', this.onFirstLoopCobweb)
    // Micro-task
    this.cobwebGrowth = this.cobwebGrowth.bind(this)
  }

  /**
   * Réinitialise le système. Aucun état interne à ce jour.
   */
  init () {}

  /**
   * Liaison EventBus : 'time/first-loop' — démarre la boucle de repousse des toiles.
   */
  onFirstLoopCobweb () { this.#scheduleNext() }

  /**
   * Planifie la prochaine tentative de pose. Délai de base COBWEB_GROWTH_DELAY_MS,
   * modulé par un facteur aléatoire ×[0.8, 1.2[ pour éviter un rythme mécanique.
   */
  #scheduleNext () {
    const delay = (COBWEB_GROWTH_DELAY_MS * seededRNG.randomGetRealMinMax(0.8, 1.2)) | 0
    const {priority, capacity} = MICROTASK.COBWEB_GROWTH
    taskScheduler.enqueue('cobweb-growth', delay, this.cobwebGrowth, priority, capacity)
  }

  /**
   * Callback TaskScheduler : tente une pose de toile, puis replanifie la tentative suivante.
   */
  cobwebGrowth () {
    this.#tryGrow()
    this.#scheduleNext()
  }

  /**
   * Tire une tuile aléatoire dans le monde (hors marge de bord). Abandon si elle n'est pas VOID.
   * Sinon remonte au plafond et construit une toile de 4 à 9 tuiles.
   */
  #tryGrow () {
    const VOID = NODES.VOID.code
    const MARGIN = 4 // cohérent avec les Ghost Cells — évite tout artefact de wrap en bord de monde

    const x = seededRNG.randomGetMinMax(MARGIN, WORLD_WIDTH - MARGIN - 1)
    const y = seededRNG.randomGetMinMax(TOPSOIL_Y_SKY_SURFACE, WORLD_HEIGHT - MARGIN - 1)
    if (chunkManager.getTile(x, y) !== VOID) return

    this.#buildWeb(x, y, seededRNG.randomGetMinMax(4, 9))
  }

  /**
   * Remonte au plafond depuis (cx, cy) et construit une toile organique de `count` tuiles max.
   * Abandon si le plafond est HIVE, ou si la tuile de départ est réservée (blockedTiles).
   * Port temps réel de WebFiller#buildWeb (generate.mjs).
   * @param {number} cx
   * @param {number} cy
   * @param {number} count
   */
  #buildWeb (cx, cy, count) {
    const VOID = NODES.VOID.code
    const HIVE = NODES.HIVE.code
    const W = WORLD_WIDTH

    let idx = (cy << 10) | cx

    while (chunkManager.getTileAt(idx - W) === VOID) {
      idx -= W
      cy--
    }
    if (chunkManager.getTileAt(idx - W) === HIVE) return
    if (!blockedTiles.canPlace(idx)) return

    this.#placeWeb(idx)
    count--

    const webX = [cx]
    const webY = [cy]
    let tentative = 10

    while (count > 0 && tentative > 0) {
      const i = seededRNG.randomGetMax(webX.length - 1)
      const result = this.#stepWeb(webX[i], webY[i])
      if (result !== null) {
        webX.push(result.x)
        webY.push(result.y)
        count--
        tentative = Math.max(10, 4 * webX.length)
      } else {
        tentative--
      }
    }
  }

  /**
   * Tente d'étendre la toile depuis (x, y). Priorité : haut → gauche/droite (aléatoire) → bas.
   * Port temps réel de WebFiller#stepWeb (generate.mjs).
   * @param {number} x
   * @param {number} y
   * @returns {{x, y}|null}
   */
  #stepWeb (x, y) {
    const W = WORLD_WIDTH
    const idx = (y << 10) | x

    if (this.#canGrowAt(idx - W)) {
      this.#placeWeb(idx - W)
      return {x, y: y - 1}
    }

    const leftOk = this.#canGrowAt(idx - 1)
    const rightOk = this.#canGrowAt(idx + 1)

    if (leftOk && rightOk) {
      if (seededRNG.randomGetBool()) {
        this.#placeWeb(idx + 1)
        return {x: x + 1, y}
      }
      this.#placeWeb(idx - 1)
      return {x: x - 1, y}
    }
    if (rightOk) {
      this.#placeWeb(idx + 1)
      return {x: x + 1, y}
    }
    if (leftOk) {
      this.#placeWeb(idx - 1)
      return {x: x - 1, y}
    }
    if (this.#canGrowAt(idx + W)) {
      this.#placeWeb(idx + W)
      return {x, y: y + 1}
    }
    return null
  }

  /**
   * Indique si une toile peut s'étendre sur cette tuile : VOID et non réservée (blockedTiles).
   * @param {number} index
   * @returns {boolean}
   */
  #canGrowAt (index) {
    return chunkManager.getTileAt(index) === NODES.VOID.code && blockedTiles.canPlace(index)
  }

  /**
   * Écrit WEB sur une tuile VOID et émet l'événement de changement de tuile.
   * @param {number} index
   */
  #placeWeb (index) {
    chunkManager.setTileAt(index, NODES.WEB.code)
    eventBus.emit('world/tile-changed', {tileIndex: index, tileOldCode: NODES.VOID.code, tileNewCode: NODES.WEB.code})
  }
}
export const cobwebSystem = new CobwebSystem()

/* ====================================================================================================
   SPREAD FOREST SYSTEM
   ====================================================================================================

   Singleton : spreadForestSystem.

   Suit toutes les tuiles DIRT exposées au SKY (candidates ou non à la transformation en
   GRASSFOREST). Un record existe pour chaque tuile éligible ; spreadTimestamp est null tant
   qu'aucun voisin GRASSFOREST ne l'a armée. Purement réactif : aucun scan périodique, tout
   passe par 'world/tile-changed'.

   Règles (cf. conception validée) :
     1. Cycle de vie du record — dépend uniquement de l'éligibilité (DIRT + SKY au-dessus),
        indépendamment du voisinage.
     2. Armement / désarmement — dépend uniquement du voisinage GRASSFOREST d'un record existant.
     3. Reversion GRASSFOREST → DIRT quand le SKY au-dessus disparaît (émet 'world/tile-changed',
        traité ensuite comme un minage classique par la règle 2).

   ==================================================================================================== */

class SpreadForestSystem {
  #list = [] // record[] — toutes les tuiles DIRT+SKY suivies (armées ou non)
  #byIndex = new Map() // Map<tileIndex, record> — lookup O(1) pour les règles 1/2/3

  constructor () {
    // eventBus
    this.onTileChangedSpread = this.onTileChangedSpread.bind(this)
    eventBus.on('world/tile-changed', this.onTileChangedSpread)
    // micro-tâches
    this.onSpreadForestTileCheck = this.onSpreadForestTileCheck.bind(this)
    this.onSpreadForestGrow = this.onSpreadForestGrow.bind(this)
  }

  /**
   * Réinitialise toutes les structures. Appelé en début de session.
   */
  init () {
    this.#list.length = 0
    this.#byIndex.clear()
  }

  /**
   * Hydrate un record SPREAD/NONE depuis la DB. Réarme le timer si spreadTimestamp était déjà
   * fixé avant la sauvegarde (le record a survécu à un rechargement).
   * @param {object} record — record de l'objectStore 'plant' (deleted=false garanti par l'appelant)
   */
  initPlant (record) {
    this.#list.push(record)
    this.#byIndex.set(record.index, record)

    if (record.spreadTimestamp !== null) {
      const {priority, capacity} = MICROTASK.SPREAD_FOREST_GROW
      taskScheduler.enqueueAbsolute(`spread_forest_grow_${record.id}`, record.spreadTimestamp, this.onSpreadForestGrow, priority, capacity, record.index)
    }
  }

  /**
   * FloraManager n'affiche rien pour ce système (les tuiles DIRT/GRASSFOREST sont dessinées
   * par WorldRenderer, pas par une surcouche plante) — aucune structure de culling nécessaire.
   * IMPLÉMENTATION OBLIGATOIRE (contrat FloraManager)
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) { }

  /**
   * Aucun rendu propre — les tuiles suivies sont déjà des tuiles de decor normales.
   * IMPLÉMENTATION OBLIGATOIRE (contrat FloraManager)
   * @param {CanvasRenderingContext2D} ctx
   */
  render (ctx) { }

  /**
   * Ces records ne représentent pas une plante interactive (pas de foraging/shake/chop) :
   * jamais retourné comme "plante sur cette tuile".
   * IMPLÉMENTATION OBLIGATOIRE (contrat FloraManager)
   * @param {number} tileIndex
   * @returns {null}
   */
  getPlantAt (tileIndex) { return null }

  /**
   * IMPLÉMENTATION OBLIGATOIRE (contrat FloraManager) — non utilisé, getPlantAt renvoie
   * toujours null pour ce système donc isPresent n'est jamais appelé en pratique.
   * @param {object} record
   * @returns {boolean}
   */
  isPresent (record) { return record.spreadTimestamp !== null }

  /**
   * Calcule les 6 voisins (gauche, droite, haut-gauche, bas-gauche, haut-droite, bas-droite)
   * d'une tuile. Allocation d'un tableau littéral — appelé uniquement sur changement de tuile
   * réel (rare), jamais en render/frame loop : hors contrainte zéro-GC.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {number[]}
   */
  #neighborsOf (tileIndex) {
    const W = WORLD_WIDTH
    return [
      tileIndex - 1, tileIndex + 1,
      tileIndex - W - 1, tileIndex + W - 1,
      tileIndex - W + 1, tileIndex + W + 1
    ]
  }

  /**
   * Indique si au moins un des 6 voisins de la tuile est actuellement GRASSFOREST.
   * @param {number} tileIndex
   * @returns {boolean}
   */
  #hasForestGrassNeighbor (tileIndex) {
    const GRASSFOREST = NODES.GRASSFOREST.code
    for (const nIdx of this.#neighborsOf(tileIndex)) {
      if (chunkManager.getTileAt(nIdx) === GRASSFOREST) return true
    }
    return false
  }

  /**
   * Règle 1 (création) — crée un record dormant (spreadTimestamp null) pour une tuile DIRT
   * nouvellement exposée au SKY, si aucun record n'existe déjà. Tente immédiatement l'armement
   * (un voisin GRASSFOREST peut déjà être présent).
   * @param {number} tileIndex
   */
  #tryCreateRecord (tileIndex) {
    if (this.#byIndex.has(tileIndex)) return

    const record = {
      id: uniqueIdGenerator.getUniqueId(),
      kind: PLANT_KIND.SPREAD,
      type: PLANT_TYPE.FOREST,
      index: tileIndex,
      topsoilCode: NODES.DIRT.code,
      naturalCode: NODES.GRASSFOREST.code,
      spreadTimestamp: null,
      deleted: false
    }
    this.#list.push(record)
    this.#byIndex.set(tileIndex, record)
    saveManager.queueStaticUpdate({storeName: 'plant', record})

    this.#tryArm(tileIndex)
  }

  /**
   * Règle 1 (suppression) — retire le record de cette tuile (n'est plus DIRT, ou n'est plus
   * exposée au SKY). Désarme le timer si nécessaire. No-op si aucun record.
   * @param {number} tileIndex
   */
  #removeRecord (tileIndex) {
    const record = this.#byIndex.get(tileIndex)
    if (record === undefined) return

    if (record.spreadTimestamp !== null) taskScheduler.dequeue(`spread_forest_grow_${record.id}`)

    record.deleted = true
    saveManager.queueStaticUpdate({storeName: 'plant', record})

    this.#byIndex.delete(tileIndex)
    const idx = this.#list.indexOf(record)
    this.#list[idx] = this.#list[this.#list.length - 1]
    this.#list.length--
  }

  /**
   * Règle 2 (armement) — arme un record suivi si non déjà armé et si au moins un voisin
   * GRASSFOREST est présent. No-op si la tuile n'est pas suivie.
   * @param {number} tileIndex
   */
  #tryArm (tileIndex) {
    const record = this.#byIndex.get(tileIndex)
    if (record === undefined) return
    if (record.spreadTimestamp !== null) return
    if (!this.#hasForestGrassNeighbor(tileIndex)) return

    const HOUR_MS = 60_000 // 1h in-game = 60s temps réel (cohérent avec DAY_MS = 1_440_000)
    const delay = (seededRNG.randomGetRealMinMax(24, 48) * HOUR_MS) | 0

    const {priority, capacity} = MICROTASK.SPREAD_FOREST_GROW
    record.spreadTimestamp = taskScheduler.enqueue(`spread_forest_grow_${record.id}`, delay, this.onSpreadForestGrow, priority, capacity, tileIndex)
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
   * Règle 2 (désarmement) — désarme un record armé s'il ne reste plus aucun voisin
   * GRASSFOREST. No-op si la tuile n'est pas suivie ou déjà dormante.
   * @param {number} tileIndex
   */
  #tryDisarm (tileIndex) {
    const record = this.#byIndex.get(tileIndex)
    if (record === undefined) return
    if (record.spreadTimestamp === null) return
    if (this.#hasForestGrassNeighbor(tileIndex)) return

    taskScheduler.dequeue(`spread_forest_grow_${record.id}`)
    record.spreadTimestamp = null
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
   * Règle 3 — reverte une tuile GRASSFOREST en DIRT (le SKY au-dessus vient de disparaître).
   * Émet 'world/tile-changed', traité en retour par les règles 1/2 comme un minage classique.
   * @param {number} tileIndex
   */
  #revertToDirt (tileIndex) {
    const DIRT = NODES.DIRT.code
    const GRASSFOREST = NODES.GRASSFOREST.code
    chunkManager.setTileAt(tileIndex, DIRT)
    eventBus.emit('world/tile-changed', {tileIndex, tileOldCode: GRASSFOREST, tileNewCode: DIRT})
  }

  /** Liaison EventBus : 'world/tile-changed' — programme onSpreadForestTileCheck en microtâche. */
  onTileChangedSpread ({tileIndex, tileOldCode, tileNewCode}) {
    const {priority, capacity} = MICROTASK.SPREAD_FOREST_TILE_CHECK
    microTasker.enqueue(this.onSpreadForestTileCheck, priority, capacity, tileIndex, tileOldCode, tileNewCode)
  }

  /**
   * Microtâche : applique les règles 1, 2 et 3 pour une tuile modifiée.
   * @param {number} tileIndex
   * @param {number} tileOldCode
   * @param {number} tileNewCode
   */
  onSpreadForestTileCheck (tileIndex, tileOldCode, tileNewCode) {
    const DIRT = NODES.DIRT.code
    const GRASSFOREST = NODES.GRASSFOREST.code
    const SKY = NODES.SKY.code
    const W = WORLD_WIDTH

    // Règle 1a — la tuile cesse d'être DIRT (minage, remplacement)
    if (tileOldCode === DIRT && tileNewCode !== DIRT) this.#removeRecord(tileIndex)

    // Règle 1b — la tuile devient DIRT, SKY déjà présent au-dessus
    if (tileNewCode === DIRT && chunkManager.getTileAt(tileIndex - W) === SKY) this.#tryCreateRecord(tileIndex)

    // Règle 1c / Règle 3 — le SKY au-dessus disparaît : la tuile du dessous perd son éligibilité,
    // ou reverte si elle est GRASSFOREST
    if (tileOldCode === SKY && tileNewCode !== SKY) {
      const belowIndex = tileIndex + W
      if (chunkManager.getTileAt(belowIndex) === GRASSFOREST) {
        this.#revertToDirt(belowIndex)
      } else {
        this.#removeRecord(belowIndex)
      }
    }

    // Règle 1d — le SKY apparaît : la tuile du dessous devient potentiellement éligible
    if (tileNewCode === SKY && chunkManager.getTileAt(tileIndex + W) === DIRT) this.#tryCreateRecord(tileIndex + W)

    // Règle 2a — une nouvelle GRASSFOREST arme ses voisins DIRT déjà suivis
    if (tileNewCode === GRASSFOREST) {
      for (const nIdx of this.#neighborsOf(tileIndex)) this.#tryArm(nIdx)
    }

    // Règle 2b — une GRASSFOREST disparaît : désarme les voisins qui n'ont plus de voisin GRASSFOREST
    if (tileOldCode === GRASSFOREST && tileNewCode !== GRASSFOREST) {
      for (const nIdx of this.#neighborsOf(tileIndex)) this.#tryDisarm(nIdx)
    }
  }

  /**
   * Callback TaskScheduler : échéance de propagation naturelle. Revalide l'éligibilité avant
   * de transformer (la tuile a pu changer entre la programmation et l'exécution) — si invalide,
   * désarme sans transformer. Émet 'world/tile-changed', qui déclenche en retour la règle 1a
   * (retrait du record de cette tuile, devenue GRASSFOREST) et la règle 2a (armement en chaîne
   * des voisins DIRT).
   * @param {number} tileIndex
   */
  onSpreadForestGrow (tileIndex) {
    const record = this.#byIndex.get(tileIndex)
    if (record === undefined) return // supprimé entre-temps

    const DIRT = NODES.DIRT.code
    const SKY = NODES.SKY.code
    const GRASSFOREST = NODES.GRASSFOREST.code
    const W = WORLD_WIDTH

    if (chunkManager.getTileAt(tileIndex) !== DIRT ||
        chunkManager.getTileAt(tileIndex - W) !== SKY ||
        !this.#hasForestGrassNeighbor(tileIndex)) {
      record.spreadTimestamp = null
      saveManager.queueStaticUpdate({storeName: 'plant', record})
      return
    }

    chunkManager.setTileAt(tileIndex, GRASSFOREST)
    eventBus.emit('world/tile-changed', {tileIndex, tileOldCode: DIRT, tileNewCode: GRASSFOREST})
  }

  // ///// //
  // DEBUG //
  // ///// //

  /**
   * DEBUG — Affiche un cercle vert sur chaque tuile suivie et armée (spreadTimestamp actif),
   * un cercle gris sur chaque tuile suivie mais dormante. Vérifie la cohérence #list vs #byIndex.
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  debugRenderSpots (ctx) {
    ctx.save()
    for (const record of this.#list) {
      const cx = ((record.index & 0x3FF) << 4) + 8
      const cy = ((record.index >> 10) << 4) + 8 + 16
      ctx.fillStyle = record.spreadTimestamp !== null ? 'rgba(0, 220, 0, 0.8)' : 'rgba(232, 47, 232, 0.6)'
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, 6.2832)
      ctx.fill()
    }
    if (this.#list.length !== this.#byIndex.size) {
      console.warn(`SpreadForestSystem: #list(${this.#list.length}) !== #byIndex(${this.#byIndex.size})`)
    }
    ctx.restore()
  }
}
export const spreadForestSystem = new SpreadForestSystem()

/* ====================================================================================================
   SPREAD JUNGLE SYSTEM
   ====================================================================================================

   Singleton : spreadJungleSystem.

   Suit toutes les tuiles SILT exposées au SKY (candidates ou non à la transformation en
   GRASSJUNGLE). Un record existe pour chaque tuile éligible ; spreadTimestamp est null tant
   qu'aucun voisin GRASSJUNGLE ne l'a armée. Purement réactif : aucun scan périodique, tout
   passe par 'world/tile-changed'.

   Règles (identiques à SpreadForestSystem, transposées SILT/GRASSJUNGLE) :
     1. Cycle de vie du record — dépend uniquement de l'éligibilité (SILT + SKY au-dessus),
        indépendamment du voisinage.
     2. Armement / désarmement — dépend uniquement du voisinage GRASSJUNGLE d'un record existant.
     3. Reversion GRASSJUNGLE → SILT quand le SKY au-dessus disparaît (émet 'world/tile-changed',
        traité ensuite comme un minage classique par la règle 2).

   ==================================================================================================== */

class SpreadJungleSystem {
  #list = [] // record[] — toutes les tuiles SILT+SKY suivies (armées ou non)
  #byIndex = new Map() // Map<tileIndex, record> — lookup O(1) pour les règles 1/2/3

  constructor () {
    // eventBus
    this.onTileChangedSpreadJungle = this.onTileChangedSpreadJungle.bind(this)
    eventBus.on('world/tile-changed', this.onTileChangedSpreadJungle)
    // micro-tâches
    this.onSpreadJungleTileCheck = this.onSpreadJungleTileCheck.bind(this)
    this.onSpreadJungleGrow = this.onSpreadJungleGrow.bind(this)
  }

  /**
   * Réinitialise toutes les structures. Appelé en début de session.
   */
  init () {
    this.#list.length = 0
    this.#byIndex.clear()
  }

  /**
   * Hydrate un record SPREAD/JUNGLE depuis la DB. Réarme le timer si spreadTimestamp était déjà
   * fixé avant la sauvegarde (le record a survécu à un rechargement).
   * @param {object} record — record de l'objectStore 'plant' (deleted=false garanti par l'appelant)
   */
  initPlant (record) {
    this.#list.push(record)
    this.#byIndex.set(record.index, record)

    if (record.spreadTimestamp !== null) {
      const {priority, capacity} = MICROTASK.SPREAD_JUNGLE_GROW
      taskScheduler.enqueueAbsolute(`spread_jungle_grow_${record.id}`, record.spreadTimestamp, this.onSpreadJungleGrow, priority, capacity, record.index)
    }
  }

  /**
   * FloraManager n'affiche rien pour ce système (les tuiles SILT/GRASSJUNGLE sont dessinées
   * par WorldRenderer, pas par une surcouche plante) — aucune structure de culling nécessaire.
   * IMPLÉMENTATION OBLIGATOIRE (contrat FloraManager)
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) { }

  /**
   * Aucun rendu propre — les tuiles suivies sont déjà des tuiles de decor normales.
   * IMPLÉMENTATION OBLIGATOIRE (contrat FloraManager)
   * @param {CanvasRenderingContext2D} ctx
   */
  render (ctx) { }

  /**
   * Ces records ne représentent pas une plante interactive (pas de foraging/shake/chop) :
   * jamais retourné comme "plante sur cette tuile".
   * IMPLÉMENTATION OBLIGATOIRE (contrat FloraManager)
   * @param {number} tileIndex
   * @returns {null}
   */
  getPlantAt (tileIndex) { return null }

  /**
   * IMPLÉMENTATION OBLIGATOIRE (contrat FloraManager) — non utilisé, getPlantAt renvoie
   * toujours null pour ce système donc isPresent n'est jamais appelé en pratique.
   * @param {object} record
   * @returns {boolean}
   */
  isPresent (record) { return record.spreadTimestamp !== null }

  /**
   * Calcule les 6 voisins (gauche, droite, haut-gauche, bas-gauche, haut-droite, bas-droite)
   * d'une tuile. Allocation d'un tableau littéral — appelé uniquement sur changement de tuile
   * réel (rare), jamais en render/frame loop : hors contrainte zéro-GC.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {number[]}
   */
  #neighborsOf (tileIndex) {
    const W = WORLD_WIDTH
    return [
      tileIndex - 1, tileIndex + 1,
      tileIndex - W - 1, tileIndex + W - 1,
      tileIndex - W + 1, tileIndex + W + 1
    ]
  }

  /**
   * Indique si au moins un des 6 voisins de la tuile est actuellement GRASSJUNGLE.
   * @param {number} tileIndex
   * @returns {boolean}
   */
  #hasJungleGrassNeighbor (tileIndex) {
    const GRASSJUNGLE = NODES.GRASSJUNGLE.code
    for (const nIdx of this.#neighborsOf(tileIndex)) {
      if (chunkManager.getTileAt(nIdx) === GRASSJUNGLE) return true
    }
    return false
  }

  /**
   * Règle 1 (création) — crée un record dormant (spreadTimestamp null) pour une tuile SILT
   * nouvellement exposée au SKY, si aucun record n'existe déjà. Tente immédiatement l'armement
   * (un voisin GRASSJUNGLE peut déjà être présent).
   * @param {number} tileIndex
   */
  #tryCreateRecord (tileIndex) {
    if (this.#byIndex.has(tileIndex)) return

    const record = {
      id: uniqueIdGenerator.getUniqueId(),
      kind: PLANT_KIND.SPREAD,
      type: PLANT_TYPE.JUNGLE,
      index: tileIndex,
      topsoilCode: NODES.SILT.code,
      naturalCode: NODES.GRASSJUNGLE.code,
      spreadTimestamp: null,
      deleted: false
    }
    this.#list.push(record)
    this.#byIndex.set(tileIndex, record)
    saveManager.queueStaticUpdate({storeName: 'plant', record})

    this.#tryArm(tileIndex)
  }

  /**
   * Règle 1 (suppression) — retire le record de cette tuile (n'est plus SILT, ou n'est plus
   * exposée au SKY). Désarme le timer si nécessaire. No-op si aucun record.
   * @param {number} tileIndex
   */
  #removeRecord (tileIndex) {
    const record = this.#byIndex.get(tileIndex)
    if (record === undefined) return

    if (record.spreadTimestamp !== null) taskScheduler.dequeue(`spread_jungle_grow_${record.id}`)

    record.deleted = true
    saveManager.queueStaticUpdate({storeName: 'plant', record})

    this.#byIndex.delete(tileIndex)
    const idx = this.#list.indexOf(record)
    this.#list[idx] = this.#list[this.#list.length - 1]
    this.#list.length--
  }

  /**
   * Règle 2 (armement) — arme un record suivi si non déjà armé et si au moins un voisin
   * GRASSJUNGLE est présent. No-op si la tuile n'est pas suivie.
   * @param {number} tileIndex
   */
  #tryArm (tileIndex) {
    const record = this.#byIndex.get(tileIndex)
    if (record === undefined) return
    if (record.spreadTimestamp !== null) return
    if (!this.#hasJungleGrassNeighbor(tileIndex)) return

    const HOUR_MS = 60_000 // 1h in-game = 60s temps réel (cohérent avec DAY_MS = 1_440_000)
    const delay = (seededRNG.randomGetRealMinMax(24, 48) * HOUR_MS) | 0

    const {priority, capacity} = MICROTASK.SPREAD_JUNGLE_GROW
    record.spreadTimestamp = taskScheduler.enqueue(`spread_jungle_grow_${record.id}`, delay, this.onSpreadJungleGrow, priority, capacity, tileIndex)
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
   * Règle 2 (désarmement) — désarme un record armé s'il ne reste plus aucun voisin
   * GRASSJUNGLE. No-op si la tuile n'est pas suivie ou déjà dormante.
   * @param {number} tileIndex
   */
  #tryDisarm (tileIndex) {
    const record = this.#byIndex.get(tileIndex)
    if (record === undefined) return
    if (record.spreadTimestamp === null) return
    if (this.#hasJungleGrassNeighbor(tileIndex)) return

    taskScheduler.dequeue(`spread_jungle_grow_${record.id}`)
    record.spreadTimestamp = null
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
   * Règle 3 — reverte une tuile GRASSJUNGLE en SILT (le SKY au-dessus vient de disparaître).
   * Émet 'world/tile-changed', traité en retour par les règles 1/2 comme un minage classique.
   * @param {number} tileIndex
   */
  #revertToSilt (tileIndex) {
    const SILT = NODES.SILT.code
    const GRASSJUNGLE = NODES.GRASSJUNGLE.code
    chunkManager.setTileAt(tileIndex, SILT)
    eventBus.emit('world/tile-changed', {tileIndex, tileOldCode: GRASSJUNGLE, tileNewCode: SILT})
  }

  /** Liaison EventBus : 'world/tile-changed' — programme onSpreadJungleTileCheck en microtâche. */
  onTileChangedSpreadJungle ({tileIndex, tileOldCode, tileNewCode}) {
    const {priority, capacity} = MICROTASK.SPREAD_JUNGLE_TILE_CHECK
    microTasker.enqueue(this.onSpreadJungleTileCheck, priority, capacity, tileIndex, tileOldCode, tileNewCode)
  }

  /**
   * Microtâche : applique les règles 1, 2 et 3 pour une tuile modifiée.
   * @param {number} tileIndex
   * @param {number} tileOldCode
   * @param {number} tileNewCode
   */
  onSpreadJungleTileCheck (tileIndex, tileOldCode, tileNewCode) {
    const SILT = NODES.SILT.code
    const GRASSJUNGLE = NODES.GRASSJUNGLE.code
    const SKY = NODES.SKY.code
    const W = WORLD_WIDTH

    // Règle 1a — la tuile cesse d'être SILT (minage, remplacement)
    if (tileOldCode === SILT && tileNewCode !== SILT) this.#removeRecord(tileIndex)

    // Règle 1b — la tuile devient SILT, SKY déjà présent au-dessus
    if (tileNewCode === SILT && chunkManager.getTileAt(tileIndex - W) === SKY) this.#tryCreateRecord(tileIndex)

    // Règle 1c / Règle 3 — le SKY au-dessus disparaît : la tuile du dessous perd son éligibilité,
    // ou reverte si elle est GRASSJUNGLE
    if (tileOldCode === SKY && tileNewCode !== SKY) {
      const belowIndex = tileIndex + W
      if (chunkManager.getTileAt(belowIndex) === GRASSJUNGLE) {
        this.#revertToSilt(belowIndex)
      } else {
        this.#removeRecord(belowIndex)
      }
    }

    // Règle 1d — le SKY apparaît : la tuile du dessous devient potentiellement éligible
    if (tileNewCode === SKY && chunkManager.getTileAt(tileIndex + W) === SILT) this.#tryCreateRecord(tileIndex + W)

    // Règle 2a — une nouvelle GRASSJUNGLE arme ses voisins SILT déjà suivis
    if (tileNewCode === GRASSJUNGLE) {
      for (const nIdx of this.#neighborsOf(tileIndex)) this.#tryArm(nIdx)
    }

    // Règle 2b — une GRASSJUNGLE disparaît : désarme les voisins qui n'ont plus de voisin GRASSJUNGLE
    if (tileOldCode === GRASSJUNGLE && tileNewCode !== GRASSJUNGLE) {
      for (const nIdx of this.#neighborsOf(tileIndex)) this.#tryDisarm(nIdx)
    }
  }

  /**
   * Callback TaskScheduler : échéance de propagation naturelle. Revalide l'éligibilité avant
   * de transformer (la tuile a pu changer entre la programmation et l'exécution) — si invalide,
   * désarme sans transformer. Émet 'world/tile-changed', qui déclenche en retour la règle 1a
   * (retrait du record de cette tuile, devenue GRASSJUNGLE) et la règle 2a (armement en chaîne
   * des voisins SILT).
   * @param {number} tileIndex
   */
  onSpreadJungleGrow (tileIndex) {
    const record = this.#byIndex.get(tileIndex)
    if (record === undefined) return // supprimé entre-temps

    const SILT = NODES.SILT.code
    const SKY = NODES.SKY.code
    const GRASSJUNGLE = NODES.GRASSJUNGLE.code
    const W = WORLD_WIDTH

    if (chunkManager.getTileAt(tileIndex) !== SILT ||
        chunkManager.getTileAt(tileIndex - W) !== SKY ||
        !this.#hasJungleGrassNeighbor(tileIndex)) {
      record.spreadTimestamp = null
      saveManager.queueStaticUpdate({storeName: 'plant', record})
      return
    }

    chunkManager.setTileAt(tileIndex, GRASSJUNGLE)
    eventBus.emit('world/tile-changed', {tileIndex, tileOldCode: SILT, tileNewCode: GRASSJUNGLE})
  }

  // ///// //
  // DEBUG //
  // ///// //

  /**
   * DEBUG — Affiche un cercle vert sur chaque tuile suivie et armée (spreadTimestamp actif),
   * un cercle gris sur chaque tuile suivie mais dormante. Vérifie la cohérence #list vs #byIndex.
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  debugRenderSpots (ctx) {
    ctx.save()
    for (const record of this.#list) {
      const cx = ((record.index & 0x3FF) << 4) + 8
      const cy = ((record.index >> 10) << 4) + 8 + 16
      ctx.fillStyle = record.spreadTimestamp !== null ? 'rgba(248, 16, 16, 0.8)' : 'rgba(235, 14, 235, 0.6)'
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, 6.2832)
      ctx.fill()
    }
    if (this.#list.length !== this.#byIndex.size) {
      console.warn(`SpreadJungleSystem: #list(${this.#list.length}) !== #byIndex(${this.#byIndex.size})`)
    }
    ctx.restore()
  }
}
export const spreadJungleSystem = new SpreadJungleSystem()

/* ====================================================================================================
   SAMPLE SYSTEM
   ====================================================================================================

   Singleton : sampleSystem.

   Patron de référence pour tous les systèmes de plantes de FloraManager.
   Copier, renommer (ex: MandrakeSystem) et spécialiser render().

   Responsabilités :
     - Indexer les records dans quatre structures complémentaires (init + addRecord)
     - Exposer byTile (public) pour les requêtes spatiales de FloraManager
     - Limiter le render aux chunks preload via #displayed

   Interactions :
     floraManager — init, addRecord, updateDisplay, render, getPlantAt

   ==================================================================================================== */

class SampleSystem {
  byTile = new Map() // Map<tileIndex, record> — public : membership O(1) + lookup record
  #list = [] // record[] — tous les records (lifecycle, itération)
  #byChunk = new Map() // Map<chunkKey, Set> — lookup spatial pour updateDisplay
  #displayed = new Set() // Set<record> — cible du render (chunks preload uniquement)

  /**
   * Réinitialise toutes les structures. Appelé en début de session.
   * IMPLÉMENTATION OBLIGATOIRE
   */
  init () {
    this.byTile.clear()
    this.#list.length = 0
    this.#byChunk.clear()
    this.#displayed.clear()
  }

  /**
   * Enregistre un record actif et peuple les quatre structures internes.
   * IMPLÉMENTATION OBLIGATOIRE
   * @param {object} record — record de l'objectStore 'plant' (deleted=false garanti par l'appelant)
   */
  initPlant (record) {
    this.#list.push(record)

    // byTile — toutes les tuiles du rectangle englobant (index, w, h)
    const px = record.index & 0x3FF
    const py = record.index >> 10
    for (let dy = 0; dy < record.h; dy++) {
      const rowBase = (py + dy) << 10
      for (let dx = 0; dx < record.w; dx++) {
        this.byTile.set(rowBase | (px + dx), record)
      }
    }

    // #byChunk — chunk du coin haut-gauche uniquement
    // Le ring preload de la caméra garantit la couverture des plantes chevauchant deux chunks.
    const chunkKey = ((record.index >> 14) << 6) | ((record.index & 0x3FF) >> 4)
    let set = this.#byChunk.get(chunkKey)
    if (set === undefined) {
      set = new Set()
      this.#byChunk.set(chunkKey, set)
    }
    set.add(record)
  }

  /**
   * Reconstruit #displayed depuis les chunks preload de la caméra.
   * Appelé directement par FloraManager (synchrone) — basculer en microtâche si dépassement 100µs.
   * IMPLÉMENTATION OBLIGATOIRE
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) {
    this.#displayed.clear()
    for (const chunkKey of preloadChunks) {
      const set = this.#byChunk.get(chunkKey)
      if (set === undefined) continue
      for (const record of set) this.#displayed.add(record)
    }
  }

  /**
   * Dessine les plantes visibles sur le contexte transformé par la caméra.
   * IMPLÉMENTATION OBLIGATOIRE
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  render (ctx) {
    // for (const record of this.#displayed) {
    // TODO: rendu spécifique
    // const pxX = (record.index & 0x3FF) << 4
    // const pxY = (record.index >> 10) << 4
    // ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
    // }
  }

  /**
 * Traite le foraging réussi de cette plante.
 * IMPLÉMENTATION OBLIGATOIRE — chaque système définit son propre comportement post-foraging
 * (disparition, état non-forageable temporaire, relance de croissance, etc.).
 * Le loot est géré en commun par ForagingManager — cette méthode ne gère que l'état de la plante.
 * @param {object} record
 */
  onForaged (record) { }

  /**
   * Retourne le record de la plante couvrant la tuile donnée, ou null.
   * IMPLÉMENTATION OBLIGATOIRE
   * @param {number} tileIndex — (y << 10) | x
   * @returns {object|null}
   */
  getPlantAt (tileIndex) {
    return this.byTile.get(tileIndex) ?? null
  }

  /**
 * Indique si le record est actuellement présent (forageable).
 * IMPLÉMENTATION OBLIGATOIRE — chaque système doit définir sa propre notion de présence.
 * @param {object} record
 * @returns {boolean}
 */
  isPresent (record) { return true }
}

export const sampleSystem = new SampleSystem()
