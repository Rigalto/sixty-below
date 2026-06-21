// ecosystem.mjs — FloraManager - CobwebSystem - HiveSystem
// SunflowerSystem - OleanderSystem - ParsnipSystem - CobwebSystem - SampleSystem

import {WORLD_WIDTH, WORLD_HEIGHT, MICROTASK, TOPSOIL_Y_SKY_SURFACE, TOPSOIL_Y_SURFACE_UNDER, TOPSOIL_Y_UNDER_CAVERNS} from './constant.mjs'
import {uniqueIdGenerator} from './database.mjs'

import {eventBus, seededRNG, blockedTiles, microTasker, taskScheduler} from './utils.mjs'
import {NODES, ITEMS, PLANT_KIND, PLANT_TYPE, PLANT_SYSTEM_LOOKUP, ALL_PLANT_SYSTEMS, COBWEB_GROWTH_DELAY_MS, SUNFLOWER_RATE, PARSNIP_RATE, TREE_IMAGES} from '../assets/data/data.mjs'
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
 * Ajoute un arbre dans byTile pour les tuiles de sa zone d'interaction effective (dépendante
 * de size). Hauteur = (size + 2) * 3 tuiles, ancrée sur soilIndex et remontant vers le haut.
 * Largeur = record.w (3 tuiles) — l'image de rendu fait 5 tuiles de large, mais les 2 tuiles
 * latérales ne font pas partie de la zone d'interaction (chopping, shaking, survol souris).
 * @param {Map} byTile  @param {object} record — record TREE (oak)
 */
const addToByTileTree = (byTile, record) => {
  const px = record.soilIndex & 0x3FF
  const soilY = record.soilIndex >> 10
  const h = (record.size + 2) * 3
  const py = soilY - h
  for (let dy = 0; dy < h; dy++) {
    const rowBase = (py + dy) << 10
    for (let dx = 0; dx < record.w; dx++) byTile.set(rowBase | (px + dx), record)
  }
}

/**
 * Retire un arbre de byTile pour les tuiles de sa zone d'interaction effective (dépendante
 * de size). Symétrique d'addToByTileTree — même formule de hauteur.
 * @param {Map} byTile  @param {object} record — record TREE (oak)
 */
const removeFromByTileTree = (byTile, record) => {
  const px = record.soilIndex & 0x3FF
  const soilY = record.soilIndex >> 10
  const h = (record.size + 2) * 3
  const py = soilY - h
  for (let dy = 0; dy < h; dy++) {
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
    // micro-tâches
    this.bloomSunflower = this.bloomSunflower.bind(this)
    this.unbloomSunflower = this.unbloomSunflower.bind(this)
    this.onSunflowerSpotCheck = this.onSunflowerSpotCheck.bind(this)
    this.onSunflowerLateralSpotCheck = this.onSunflowerLateralSpotCheck.bind(this)
    this.onSunflowerLateralSpotRemove = this.onSunflowerLateralSpotRemove.bind(this)

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
    this.#spotsBySoil.clear()
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

      record.present = true
      addToByTile(this.byTile, record)
      addToByChunk(this.#byChunk, record)
      this.#bySoil.set(record.soilIndex, record)
      blockedTiles.blockPlacement(record.index)
      blockedTiles.blockPlacement(record.index + WORLD_WIDTH)
      saveManager.queueStaticUpdate({storeName: 'plant', record})
      grown++
    }
    buildDisplayed(this.#displayed, this.#byChunk, camera.preloadChunks)
  }

  /**
   * Microtâche : peuple byTile, #byChunk et #displayed pour les spots tirés à 18%.
   * Bloque les tuiles occupées dans blockedTiles.
   */
  bloomSunflower_ () {
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
    console.log('>>>>>>>>>>>>>> onSunflowerSpotCheck', soilIndex, this.#spotsBySoil.has(soilIndex), this.#spotsBySoil.size)
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
   * @param {number} tileIndex — tuile centrale du sol libéré
   * @param {string} treeId — identifiant de l'arbre
   */
  onTreeDestroyedSunflower (tileIndex, treeId) {
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
   * @param {number} tileIndex — tuile centrale du sol occupé (payload identique à tree-destroyed)
   */
  onTreePlantedSunflower (tileIndex, treeId) {
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
      microTasker.enqueue(this.onSunflowerSpotCheck, priority, capacity, tileIndex)
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
   * @param {number} tileIndex — tuile centrale du sol libéré
   * @param {string} treeId — identifiant de l'arbre
   */
  onTreeDestroyedParsnip (tileIndex, treeId) {
    if (treeId !== 'oak') return
    this.onParsnipSpotCheck(tileIndex - 1)
    this.onParsnipSpotCheck(tileIndex)
    this.onParsnipSpotCheck(tileIndex + 1)
  }

  /**
   * Liaison EventBus : 'ecosystem/tree-planted' — un arbre vient d'être planté, occupant
   * 3 tuiles de sol. Supprime les spots parsnip existants à ces 3 positions (s'il y en a),
   * via #removeSpot (détruit la plante présente au préalable si besoin).
   * @param {number} tileIndex — tuile centrale du sol occupé
   * @param {string} treeId — identifiant de l'arbre
   */
  onTreePlantedParsnip (tileIndex, treeId) {
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

// OakSystem — gère Oak (TREE) et Bolete (MUSHROOM), couplés : un Oak crée ses 2 spots de
// Bolete (gauche/droite), détruits avec lui. Pour l'instant : uniquement l'initialisation
// et l'affichage des bolete. Le reste est TODO (cf. liste en fin de classe).

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
  oakByTile = new Map() // Map<tileIndex, record> — public, lookup par tuile
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
    // Micro-task
    this.unbloomBolete = this.unbloomBolete.bind(this)
    this.bloomBolete = this.bloomBolete.bind(this)
  }

  /**
   * Réinitialise toutes les structures (oak et bolete) et met en cache le sprite bolete.
   */
  init () {
    this.oakByTile.clear()
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
   * Hydrate un record depuis la DB. Aiguille par kind — seul le cas MUSHROOM (bolete)
   * est traité pour l'instant.
   * TODO : cas PLANT_KIND.TREE (oak) — taille, images par stade, growthTimestamp, shakedTimestamp.
   * @param {object} record
   */
  initPlant (record) {
    if (record.kind === PLANT_KIND.TREE) {
      this.#oakList.push(record)
      this.#oakBySoil.set(record.soilIndex, record)
      this.#oakBySoil.set(record.soilIndex + 1, record)
      this.#oakBySoil.set(record.soilIndex + 2, record)
      this.#oakXSet.add((record.soilIndex & 0x3ff))
      this.#oakXSet.add((record.soilIndex & 0x3ff) + 1)
      this.#oakXSet.add((record.soilIndex & 0x3ff) + 2)
      addToByTileTree(this.oakByTile, record)
      addToByChunk(this.#oakByChunk, record)

      const px = record.index & 0x3FF
      const py = record.index >> 10
      blockedTiles.blockPlacementRect(px, py, record.w, record.h)

      const soilX = record.soilIndex & 0x3FF
      const soilY = record.soilIndex >> 10
      blockedTiles.blockMiningRect(soilX, soilY, record.w, 1)
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
      const pxY = (record.index >> 10) << 4
      ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
    }

    for (const record of this.#oakDisplayed) {
      const rows = OAK_SIZE_ROWS[record.size]
      const soilYPx = (record.soilIndex >> 10) << 4
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

    // Cas 3 — Oak - TODO

    // TODO : branche oak
  }

  // //////// //
  // CHOPPING //
  // //////// //

  /**
   * Traite le chopping réussi d'un oak (hors loot, géré par ChoppingManager).
   * Décrémente size. Si size atteint -1, détruit l'arbre entièrement (et ses bolete).
   * Sinon, met à jour byTile, blockedTiles, et persiste.
   * @param {object} record — record TREE (oak ou mahogany)
   */
  onChopped (record) {
    removeFromByTileTree(this.oakByTile, record)
    record.size--
    addToByTileTree(this.oakByTile, record)

    if (record.size < 0) {
      this.#destroyOak(record) // fait le queueStaticUpdate
      return
    }

    saveManager.queueStaticUpdate({storeName: 'plant', record})
  }

  /**
   * Détruit un oak complètement : retire toutes les structures, supprime ses spots bolete,
   * libère blockedTiles (placement + mining sol).
   * @param {object} record — record TREE
   */
  #destroyOak (record) {
    // Retrait byTile et byChunk
    removeFromByTileTree(this.oakByTile, record)
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

    // Persistance : marque deleted
    record.deleted = true
    saveManager.queueStaticUpdate({storeName: 'plant', record})

    // Notifie les autres systèmes : nouveaux spots potentiels au sol libérés
    eventBus.emit('ecosystem/tree-destroyed', record.soilIndex + 1, 'oak')
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
