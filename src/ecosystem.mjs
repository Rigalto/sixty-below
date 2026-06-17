// ecosystem.mjs — FloraManager - CobwebSystem - HiveSystem
// SunflowerSystem - OleanderSystem - ParsnipSystem - CobwebSystem - SampleSystem

import {WORLD_WIDTH, WORLD_HEIGHT, MICROTASK, TOPSOIL_Y_SKY_SURFACE, TOPSOIL_Y_SURFACE_UNDER, TOPSOIL_Y_UNDER_CAVERNS} from './constant.mjs'
import {uniqueIdGenerator} from './database.mjs'

import {eventBus, seededRNG, blockedTiles, microTasker, taskScheduler} from './utils.mjs'
import {NODES, ITEMS, PLANT_KIND, PLANT_TYPE, PLANT_SYSTEM_LOOKUP, ALL_PLANT_SYSTEMS, COBWEB_GROWTH_DELAY_MS, PARSNIP_RATE} from '../assets/data/data.mjs'
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
 * Conditions : pas d'oak dans [x-minDist, x+minDist], pas de spot existant.
 * @param {number} soilIndex
 */
  onSunflowerSpotCheck (soilIndex) {
    const GRASSFOREST = NODES.GRASSFOREST.code
    const x = soilIndex & 0x3FF

    if (chunkManager.getTileAt(soilIndex) !== GRASSFOREST) return
    if (this.#spotsBySoil.has(soilIndex)) return
    // TODO enlever le commentaire que TreeSystem sera écrit et possédera la fonction
    // L'arbre occupe les positions x, x+1, x+2. Les tuiles interdites sont les tuiles
    // x-2, x-1, x+3 et x+4. Si la position du sunflower est xx, alors il ne doit pas y avoir
    // d'arbre en x+2, x+1, x-3 et x-4
    // if (!treeSystem.isOakAt(x-2, x-1, x+3, x+4)) return
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

// ...

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
    this.onFirstLoop = this.onFirstLoop.bind(this)
    eventBus.on('time/first-loop', this.onFirstLoop)
    this.onTileChanged = this.onTileChanged.bind(this)
    eventBus.on('world/tile-changed', this.onTileChanged)
    // micro-tâches
    this.onOleanderRegrow = this.onOleanderRegrow.bind(this)
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
   * de vidage (enqueueOnce — sans effet si déjà en file).
   * @param {object} record — record HERB/OLEANDER (deleted=false garanti par l'appelant)
   */
  initPlant (record) {
    this.#list.push(record)
    // this.#spotsBySoil.set(record.soilIndex, record)

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
    console.log('>>>>>>>>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<<<<<<<<<<<')
    this.#regrowQueue.push(record)
  }

  /**
   * Liaison EventBus : 'time/first-loop' — émis une seule fois au démarrage du rendu,
   * une fois le boot terminé (tous les éléments du monde placés).
   * Déclenche la microtâche de repousse si #regrowQueue contient des records
   * present=false chargés depuis la persistence.
   */
  onFirstLoop () {
    if (this.#regrowQueue.length === 0) return
    const {priority, capacity} = MICROTASK.OLEANDER_REGROW
    microTasker.enqueue(this.onOleanderRegrow, priority, capacity)
  }

  /**
   * Reconstruit #displayed depuis les chunks preload de la caméra.
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) {
    buildDisplayed(this.#displayed, this.#byChunk, preloadChunks)
    if (this.#displayed.size !== 0) { console.log('OleanderSystem.onPreloadChunksChanged', this.#displayed.size) }
    console.log('OleanderSystem.onPreloadChunksChanged', this.#list)
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
      microTasker.enqueue(this.onOleanderRegrow, priority, capacity)
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
  onOleanderRegrow () {
    if (this.#regrowQueue.length === 0) return
    console.log('onOleanderRegrow')

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
      const t2 = t1 - W
      const t3 = t2 - W

      if (chunkManager.getTileAt(t1) !== VOID) continue
      if (chunkManager.getTileAt(t2) !== VOID) continue
      if (chunkManager.getTileAt(t3) !== VOID) continue

      if (!blockedTiles.canPlace(t1)) continue
      if (!blockedTiles.canPlace(t2)) continue
      if (!blockedTiles.canPlace(t3)) continue

      const record = this.#regrowQueue[this.#regrowQueue.length - 1]

      record.soilIndex = soilIndex
      record.index = t3
      record.x = cx
      record.y = t3 >> 10
      record.present = true

      addToByTile(this.byTile, record)
      addToByChunk(this.#byChunk, record)
      blockedTiles.blockPlacement(t1)
      blockedTiles.blockPlacement(t2)
      blockedTiles.blockPlacement(t3)
      saveManager.queueStaticUpdate({storeName: 'plant', record})

      this.#regrowQueue.length--
      break
    }

    if (this.#regrowQueue.length !== 0) {
      const {priority, capacity} = MICROTASK.OLEANDER_REGROW
      microTasker.enqueue(this.onOleanderRegrow, priority, capacity)
    }
  }

  /**
   * Liaison EventBus : 'world/tile-changed'.
   * Détruit l'oleander présent si une des 3 tuiles de son corps n'est plus VOID,
   * ou si sa tuile sol n'est plus STONE. Relit les tuiles réelles avant d'agir.
   * Pas de gestion de spot — population fixe, repousse via #regrowQueue.
   * @param {{tileIndex: number, tileOldCode: number, tileNewCode: number}} payload
   */
  onTileChanged ({tileIndex, tileOldCode, tileNewCode}) {
    const VOID = NODES.VOID.code
    const STONE = NODES.STONE.code

    // Cas 1 — tuile du corps : une des 3 VOID devient autre chose
    const byBodyRecord = this.byTile.get(tileIndex)
    if (byBodyRecord !== undefined && tileNewCode !== VOID) {
      if (chunkManager.getTileAt(byBodyRecord.index) !== VOID ||
        chunkManager.getTileAt(byBodyRecord.index + WORLD_WIDTH) !== VOID ||
        chunkManager.getTileAt(byBodyRecord.index + 2 * WORLD_WIDTH) !== VOID) {
        this.#destroyPresent(byBodyRecord)
      }
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

// ParsnipSystem — calqué sur SunflowerSystem (spot toujours en DB, present = visible/forageable).
// TODO ouverts (cf. commentaires inline) : conditions d'ajout d'un spot (onParsnipSpotCheck),
// mécanisme de repousse après forage (rien ne remet present à true pour l'instant),
// w/h placeholder à vérifier contre generate.mjs.
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
    this.onTileChanged = this.onTileChanged.bind(this)
    eventBus.on('world/tile-changed', this.onTileChanged)
    this.onHour3 = this.onHour3.bind(this)
    eventBus.on('time/every-hour-3', this.onHour3)
    // Micro-task
    this.onParsnipSpotCheck = this.onParsnipSpotCheck.bind(this)
    this.onParsnipHour3 = this.onParsnipHour3.bind(this)
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
      const pxY = (record.index >> 10) << 4
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
  onHour3 () {
    const {priority, capacity} = MICROTASK.PARSNIP_HOUR3
    microTasker.enqueueOnce(this.onParsnipHour3, priority, capacity)
  }

  /**
   * Microtâche : remet present=false sur tous les spots encore présents, puis fait pousser
   * un nombre de parsnips calculé depuis PARSNIP_RATE + aléa[-2,2] + bonus buff 'cloudy' (+2).
   * Tirage sans remise parmi #list, rejet si soilIndex ou index est bloqué.
   */
  onParsnipHour3 () {
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
   * Indique si toutes les tuiles du corps du record valent encore code.
   * @param {object} record
   * @param {number} code — NODES.xxx.code attendu pour chaque tuile du corps
   * @returns {boolean}
   */
  #bodyIs (record, code) { // TODO - Je ne comprends pas à quoi peut servir cette fonction
    const px = record.index & 0x3FF
    const py = record.index >> 10
    for (let dy = 0; dy < record.h; dy++) {
      const rowBase = (py + dy) << 10
      for (let dx = 0; dx < record.w; dx++) {
        if (chunkManager.getTileAt(rowBase | (px + dx)) !== code) return false
      }
    }
    return true
  }

  /**
   * Liaison EventBus : 'world/tile-changed'.
   * — Détruit le parsnip présent si une tuile de son corps n'est plus SKY ou si son sol n'est plus GRASSFOREST.
   * — Supprime le spot si son sol n'est plus GRASSFOREST.
   * — Enqueue onParsnipSpotCheck si une tuile devient GRASSFOREST.
   * Relit les tuiles réelles avant d'agir.
   * @param {{tileIndex: number, tileOldCode: number, tileNewCode: number}} payload
   */
  onTileChanged ({tileIndex, tileOldCode, tileNewCode}) {
    return
    const SKY = NODES.SKY.code
    const GRASSFOREST = NODES.GRASSFOREST.code

    // Cas 1 — tuile du corps
    const byBodyRecord = this.byTile.get(tileIndex)
    if (byBodyRecord !== undefined && tileNewCode !== SKY) {
      if (!this.#bodyIs(byBodyRecord, SKY)) this.#destroyPresent(byBodyRecord)
    }

    // Cas 2 — tuile sol : parsnip présent + spot
    if (tileOldCode === GRASSFOREST) {
      const record = this.#spotsBySoil.get(tileIndex)
      if (record !== undefined && chunkManager.getTileAt(record.soilIndex) !== GRASSFOREST) {
        this.#removeSpot(record)
      }
    }

    // Cas 3 — nouvelle tuile GRASSFOREST : candidat spot
    if (tileNewCode === GRASSFOREST) {
      const {priority, capacity} = MICROTASK.PARSNIP_SPOT_CHECK
      microTasker.enqueueOnce(this.onParsnipSpotCheck, priority, capacity, tileIndex)
    }
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
}
export const parsnipSystem = new ParsnipSystem()

// OakSystem — gère Oak (TREE) et Bolete (MUSHROOM), couplés : un Oak crée ses 2 spots de
// Bolete (gauche/droite), détruits avec lui. Pour l'instant : uniquement l'initialisation
// et l'affichage des bolete. Le reste est TODO (cf. liste en fin de classe).
class OakSystem {
  // --- Oak (TREE) ---
  oakByTile = new Map() // Map<tileIndex, record> — public, lookup par tuile (tronc)
  #oakList = [] // record[] — tous les oaks
  #oakByChunk = new Map() // Map<chunkKey, Set> — lookup spatial pour onPreloadChunksChanged
  #oakBySoil = new Map() // Map<soilIndex, record> — détection minage/changement de la tuile sol
  #oakDisplayed = new Set() // Set<record> — oaks dans les chunks preload (cible render)

  // --- Bolete (MUSHROOM) ---
  boleteByTile = new Map() // Map<tileIndex, record> — public, lookup par tuile
  #boleteList = [] // record[] — tous les spots (présents ou non)
  #boleteByChunk = new Map() // Map<chunkKey, Set> — lookup spatial pour onPreloadChunksChanged
  #boleteBySoil = new Map() // Map<soilIndex, record> — spots présents : détection minage de la tuile sol
  #boleteSpotsBySoil = new Map() // Map<soilIndex, record> — tous les spots : lookup pour suppression (destruction d'un oak)
  #boleteDisplayed = new Set() // Set<record> — spots dans les chunks preload (cible render)
  #boleteImage = null // ITEMS.bolete.placed, mis en cache dans init()

  // constructor () {
  //   // TODO : this.onTileChanged = this.onTileChanged.bind(this)
  //   //        eventBus.on('world/tile-changed', this.onTileChanged)
  //   //        — devra gérer le sol des oaks ET celui des bolete présents
  // }

  /**
   * Réinitialise toutes les structures (oak et bolete) et met en cache le sprite bolete.
   */
  init () {
    this.oakByTile.clear()
    this.#oakList.length = 0
    this.#oakByChunk.clear()
    this.#oakBySoil.clear()
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
   * Hydrate un record depuis la DB. Aiguille par kind — seul le cas MUSHROOM (bolete)
   * est traité pour l'instant.
   * TODO : cas PLANT_KIND.TREE (oak) — taille, images par stade, growthTimestamp, shakedTimestamp.
   * @param {object} record
   */
  initPlant (record) {
    if (record.kind === PLANT_KIND.TREE) return // TODO

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
    // TODO : buildDisplayed(this.#oakDisplayed, this.#oakByChunk, preloadChunks)
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
      const pxY = (record.index >> 10) << 4
      ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
    }
  }

  // TODO — à écrire :
  //   getPlantAt(tileIndex), isPresent(record)
  //   onForaged(record) — bolete uniquement (oak se mine/coupe, pas de foraging)
  //   onTileChanged({tileIndex, tileOldCode, tileNewCode}) — sol oak ET sol bolete présent
  //   floraison nocturne des bolete (apparition 21h, disparition 9h — cf. fiche d'aide)
  //   création/destruction d'un oak : doit créer/détruire ses 2 bolete (soilIndex ± décalage)
  //   croissance des oaks (size, growthTimestamp), secousse (shakedTimestamp)
}
export const oakSystem = new OakSystem()

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
    for (const system of ALL_PLANT_SYSTEMS) system.render(ctx)
  }
}

export const floraManager = new FloraManager()

/* ====================================================================================================
   COBWEB SYSTEM
   ==================================================================================================== */

class CobwebSystem {
  constructor () {
    // EventBus
    this.onFirstLoop = this.onFirstLoop.bind(this)
    eventBus.on('time/first-loop', this.onFirstLoop)
    // Micro-task
    this.onCobwebGrowthTick = this.onCobwebGrowthTick.bind(this)
  }

  /**
   * Réinitialise le système. Aucun état interne à ce jour.
   */
  init () {}

  /**
   * Liaison EventBus : 'time/first-loop' — démarre la boucle de repousse des toiles.
   */
  onFirstLoop () {
    this.#scheduleNext()
  }

  /**
   * Planifie la prochaine tentative de pose. Délai de base COBWEB_GROWTH_DELAY_MS,
   * modulé par un facteur aléatoire ×[0.8, 1.2[ pour éviter un rythme mécanique.
   */
  #scheduleNext () {
    const delay = (COBWEB_GROWTH_DELAY_MS * seededRNG.randomGetRealMinMax(0.8, 1.2)) | 0
    const {priority, capacity} = MICROTASK.COBWEB_GROWTH
    taskScheduler.enqueue('cobweb-growth', delay, this.onCobwebGrowthTick, priority, capacity)
  }

  /**
   * Callback TaskScheduler : tente une pose de toile, puis replanifie la tentative suivante.
   */
  onCobwebGrowthTick () {
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
    console.log('CobwebSystem.#placeWeb', {x: index & 0x3ff, y: index >> 10})
  }
}
export const cobwebSystem = new CobwebSystem()

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
