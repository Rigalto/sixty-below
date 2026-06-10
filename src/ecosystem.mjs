// ecosystem.mjs — FloraManager - CobwebSystem - HiveSystem
// SunflowerSystem - SampleSystem

import {WORLD_WIDTH, MICROTASK} from './constant.mjs'
import {uniqueIdGenerator} from './database.mjs'

import {eventBus, seededRNG, blockedTiles, microTasker} from './utils.mjs'
import {NODES, ITEMS, PLANT_KIND, PLANT_TYPE} from '../../assets/data/data.mjs'
import {IMAGE_CACHE} from './assets.mjs'
import {saveManager} from './persistence.mjs'
import {chunkManager} from './world.mjs'
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

  #imgLeft = null // ITEMS.sunflower.placedLeft — tête à gauche (6h–10h), mis en cache dans init()
  #imgMid = null // ITEMS.sunflower.placed — tête au centre (10h–13h)
  #imgRight = null // ITEMS.sunflower.placedRight — tête à droite (13h–17h)
  #currentImage = null // pointeur vers l'image active

  constructor () {
    // eventBus
    this.onFirstLoop = this.onFirstLoop.bind(this)
    this.onHour6 = this.onHour6.bind(this)
    this.onHour10 = this.onHour10.bind(this)
    this.onHour13 = this.onHour13.bind(this)
    this.onHour17 = this.onHour17.bind(this)
    eventBus.on('time/first-loop', this.onFirstLoop)
    eventBus.on('time/every-hour-6', this.onHour6)
    eventBus.on('time/every-hour-10', this.onHour10)
    eventBus.on('time/every-hour-13', this.onHour13)
    eventBus.on('time/every-hour-17', this.onHour17)
    this.onTileChanged = this.onTileChanged.bind(this)
    eventBus.on('world/tile-changed', this.onTileChanged)
    // micro-tâches
    this.onSunflowerHour6 = this.onSunflowerHour6.bind(this)
    this.onSunflowerHour17 = this.onSunflowerHour17.bind(this)
    this.onSunflowerSpotCheck = this.onSunflowerSpotCheck.bind(this)

    // TODO : quand un oak est planté, invalider et supprimer les spots sunflower
    // dans le rayon [oakX - SUNFLOWER_OAK_MIN_DIST, oakX + SUNFLOWER_OAK_MIN_DIST].
    // Nécessite un event 'world/oak-planted' (ou équivalent) émis par TreeSystem.
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

    const item = ITEMS.sunflower // après hydratation
    this.#imgLeft = item.placedLeft
    this.#imgMid = item.placed
    this.#imgRight = item.placedRight
    this.#currentImage = this.#imgLeft
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
    if (this.#displayed.size !== 0) { console.log('SunflowerSystem.onPreloadChunksChanged', this.#displayed.size) }
  }

  /**
    * Dessine les tournesols visibles et présents sur le contexte transformé.
    * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
    */
  render (ctx) {
    const img = this.#currentImage
    for (const record of this.#displayed) {
      const pxX = (record.index & 0x3FF) << 4
      const pxY = (record.index >> 10) << 4
      ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
    }
  }

  /**
   * Retourne le record du tournesol couvrant la tuile donnée, ou null.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {object|null}
   */
  getPlantAt (tileIndex) {
    return this.byTile.get(tileIndex) ?? null
  }

  // ////////////////////////////////////// //
  // GESTION DU CYCLE DE VIE DES SUNFLOWERS //
  // ////////////////////////////////////// //

  /** Liaison EventBus : 'time/every-hour-6' — apparition, tête à gauche. */
  onHour6 () {
    const {priority, capacity} = MICROTASK.SUNFLOWER_HOUR6
    microTasker.enqueueOnce(this.onSunflowerHour6, priority, capacity)
  }

  /**
   * Microtâche : peuple byTile, #byChunk et #displayed pour les spots tirés à 18%.
   * Bloque les tuiles occupées dans blockedTiles.
   */
  onSunflowerHour6 () {
    this.#currentImage = this.#imgLeft
    for (const record of this.#list) {
      // TODO : prendre en compte les graines de sunflower plantées (18 => 80)
      const present = seededRNG.randomGetPercent(18)
      if (!present) continue
      if (!blockedTiles.canPlace(record.index) || !blockedTiles.canPlace(record.index + WORLD_WIDTH)) continue

      record.present = true
      addToByTile(this.byTile, record)
      addToByChunk(this.#byChunk, record)
      this.#bySoil.set(record.soilIndex, record)
      blockedTiles.blockPlacement(record.index)
      blockedTiles.blockPlacement(record.index + WORLD_WIDTH)
      saveManager.queueStaticUpdate({storeName: 'plant', record})
    }
    buildDisplayed(this.#displayed, this.#byChunk, camera.preloadChunks)
  }

  /** Liaison EventBus : 'time/every-hour-10' — pivot vers le centre. */
  onHour10 () { this.#currentImage = this.#imgMid }

  /** Liaison EventBus : 'time/every-hour-13' — pivot vers la droite. */
  onHour13 () { this.#currentImage = this.#imgRight }

  /** Liaison EventBus : 'time/every-hour-17' — disparition. */
  onHour17 () {
    const {priority, capacity} = MICROTASK.SUNFLOWER_HOUR17
    microTasker.enqueueOnce(this.onSunflowerHour17, priority, capacity)
  }

  /**
   * Microtâche : libère les tuiles bloquées, vide byTile, #byChunk et #displayed.
   */
  onSunflowerHour17 () {
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
  onFirstLoop ({hour}) {
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
    record.deleted = true
    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
 * Microtâche : vérifie si une tuile devenue GRASSFOREST peut accueillir un nouveau spot.
 * Conditions : tuiles voisines GRASSFOREST, pas d'oak dans [x-minDist, x+minDist], pas de spot existant.
 * @param {number} soilIndex
 */
  onSunflowerSpotCheck (soilIndex) {
    const GRASSFOREST = NODES.GRASSFOREST.code
    const x = soilIndex & 0x3FF

    if (chunkManager.getTileAt(soilIndex) !== GRASSFOREST) return
    // if (chunkManager.getTileAt(soilIndex - 1) !== GRASSFOREST) return
    // if (chunkManager.getTileAt(soilIndex + 1) !== GRASSFOREST) return
    if (this.#spotsBySoil.has(soilIndex)) return
    // TODO enlever le commentaire que TreeSystem sera écrit et possédera la fonction
    // Je ne suis pas sûr que les paramètres soient corrects
    // L'arbre occupe les positions x, x+1, x+2. Les tuiles interdites sont les tuiles
    // x-2, x-1, x+3 et x+4. Si la position du sunflower est xx, alors il ne doit pas y avoir
    // d'arbre en x+2, x+1, x-3 et x-4
    // if (!treeSystem.isOakFreeAt(x-2, x-1, x+3, x+4)) return
    // La signature isOakAt(...positions) dans TreeSystem fera un simple Set.has() sur chacune des 4 valeurs.

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
 * Liaison EventBus : 'world/tile-changed'.
 * — Détruit le tournesol présent si une tuile de son corps n'est plus SKY ou si son sol n'est plus GRASSFOREST.
 * — Supprime le spot si son sol n'est plus GRASSFOREST.
 * — Enqueue onSpotCheck si une tuile devient GRASSFOREST.
 * Relit les tuiles réelles avant d'agir.
 * @param {{tileIndex: number, tileOldCode: number, tileNewCode: number}} payload
 */
  onTileChanged ({tileIndex, tileOldCode, tileNewCode}) {
    const SKY = NODES.SKY.code
    const GRASSFOREST = NODES.GRASSFOREST.code

    // Cas 1 — tuile du corps
    const byBodyRecord = this.byTile.get(tileIndex)
    if (byBodyRecord !== undefined && tileNewCode !== SKY) {
      if (chunkManager.getTileAt(byBodyRecord.index) !== SKY ||
        chunkManager.getTileAt(byBodyRecord.index + WORLD_WIDTH) !== SKY) {
        this.#destroyPresent(byBodyRecord)
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
      microTasker.enqueueOnce(this.onSunflowerSpotCheck, priority, capacity, tileIndex)
    }
  }

  /**
 * Liaison EventBus : 'world/tile-changed'.
 * Détruit le tournesol si une tuile de son corps n'est plus SKY,
 * ou si sa tuile sol n'est plus GRASSFOREST.
 * Relit les tuiles réelles avant d'agir — aucune supposition sur l'état courant.
 * @param {{tileIndex: number, tileOldCode: number, tileNewCode: number}} payload
 */
  onTileChanged_ ({tileIndex, tileOldCode, tileNewCode}) {
    const SKY = NODES.SKY.code
    const GRASSFOREST = NODES.GRASSFOREST.code

    // Cas 1 — tuile du corps
    const byBodyRecord = this.byTile.get(tileIndex)
    if (byBodyRecord !== undefined && tileNewCode !== SKY) {
      if (chunkManager.getTileAt(byBodyRecord.index) !== SKY ||
        chunkManager.getTileAt(byBodyRecord.index + WORLD_WIDTH) !== SKY) {
        this.#destroyPresent(byBodyRecord)
      }
    }

    // Cas 2 — tuile sol
    if (tileOldCode === GRASSFOREST) {
      const bySoilRecord = this.#bySoil.get(tileIndex)
      if (bySoilRecord !== undefined &&
        chunkManager.getTileAt(bySoilRecord.soilIndex) !== GRASSFOREST) {
        this.#destroyPresent(bySoilRecord)
      }
    }
  }

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
  #systemMap = new Map([ // Map<kind*100+type, system> — peuplée au fur et à mesure
    //   [PLANT_KIND.NATURAL * 100 + PLANT_TYPE.NONE, naturalSystem],
    //   [PLANT_KIND.TREE * 100 + PLANT_TYPE.OAK, treeSystem],
    //   [PLANT_KIND.TREE * 100 + PLANT_TYPE.MAHOGANY, treeSystem],
    //   [PLANT_KIND.TREE * 100 + PLANT_TYPE.COCONUT, treeSystem],
    //   [PLANT_KIND.TREE * 100 + PLANT_TYPE.GIANT_MUSHROOM, treeSystem],
    //   [PLANT_KIND.MUSHROOM * 100 + PLANT_TYPE.BOLETE, mushroomSystem],
    //   [PLANT_KIND.MUSHROOM * 100 + PLANT_TYPE.PINKMYCENIA, mushroomSystem],
    //   [PLANT_KIND.MUSHROOM * 100 + PLANT_TYPE.FROSTCAP, capystem],
    //   [PLANT_KIND.MUSHROOM * 100 + PLANT_TYPE.DAWNCAP, capystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.PLANT_TYPE.OLEANDER, oleanderSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.BLINKROOT, blinkrootSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.PARSNIP, parsnipSystem],
    [PLANT_KIND.HERB * 100 + PLANT_TYPE.SUNFLOWER, sunflowerSystem]
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.FIREBLOSSOM, fireblossomSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.SKORN, skornSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.AMBERMIRAGE, ambermirageSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.BLOODMOON, bloodmoonSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.SHADOWFERN, fernSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.CRIMSONFROND, fernSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.GOLDENVEIL, fernSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.MISTFERN, fernSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.VELVETMOSS, mossSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.CORAL_R, coralSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.CORAL_P, coralSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.CORAL_Y, coralSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.CORAL_G, coralSystem],
    //   [PLANT_KIND.SPREAD * 100 + PLANT_TYPE.NONE, spreadSystem],
    //   [PLANT_KIND.SEED * 100 + PLANT_TYPE.NONE, seedSystem]
  ])

  // naturalSystem, treeSystem, mushroomSystem, capystem, oleanderSystem, blinkrootSystem, parsnipSystem, fireblossomSystem, skornSystem, ambermirageSystem, bloodmoonSystem, fernSystem, mossSystem, coralSystem, spreadSystem, seedSystem
  #allSystems = [sunflowerSystem] // system[] — dans l'ordre de rendu

  constructor () {
    this.onPreloadChunksChanged = this.onPreloadChunksChanged.bind(this)
    eventBus.on('camera/preload-chunks-changed', this.onPreloadChunksChanged)
  }

  /**
   * Réinitialise tous les systèmes enregistrés.
   */
  init () {
    for (const system of this.#allSystems) system.init()
  }

  /**
   * Dispatche un record vers le système compétent selon kind et type.
   * Les records deleted=false sont garantis par l'appelant.
   * @param {object} record — record de l'objectStore 'plant'
   */
  addPlant (record) {
    const system = this.#systemMap.get(record.kind * 100 + record.type)
    if (system === undefined) return
    system.initPlant(record)
  }

  /**
   * Propage le changement de chunks preload à tous les systèmes.
   * Liaison EventBus : 'camera/preload-chunks-changed'.
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) {
    for (const system of this.#allSystems) system.onPreloadChunksChanged(preloadChunks)
  }

  /**
   * Retourne la plante couvrant la tuile donnée, ou null.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {object|null}
   */
  getPlantAt (tileIndex) {
    for (const system of this.#allSystems) {
      const plant = system.byTile.get(tileIndex)
      if (plant !== undefined) return plant
    }
    return null
  }

  /**
   * Dessine toutes les plantes visibles, système par système dans l'ordre de #allSystems.
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  render (ctx) {
    for (const system of this.#allSystems) system.render(ctx)
  }
}

export const floraManager = new FloraManager()

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
   */
  init () {
    this.byTile.clear()
    this.#list.length = 0
    this.#byChunk.clear()
    this.#displayed.clear()
  }

  /**
   * Enregistre un record actif et peuple les quatre structures internes.
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
   * Retourne le record de la plante couvrant la tuile donnée, ou null.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {object|null}
   */
  getPlantAt (tileIndex) {
    return this.byTile.get(tileIndex) ?? null
  }
}

export const sampleSystem = new SampleSystem()
