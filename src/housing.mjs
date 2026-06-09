// housing.mjs — FurnitureManager - HousingManager

import {eventBus} from './utils.mjs'
import {uniqueIdGenerator} from './database.mjs'
import {CONTAINER_STYPES} from './constant.mjs'
import {saveManager} from './persistence.mjs'
import {camera} from './render.mjs'
import {playerManager} from './player.mjs'
import {IMAGE_CACHE} from './assets.mjs'
import {MAX_FURNITURE_W, MAX_FURNITURE_H, ITEMS} from '../../assets/data/data.mjs'

/* ====================================================================================================
   FURNITURE MANAGER
   ====================================================================================================

   Autorité unique sur les meubles posés dans le monde. Aucune logique DOM.
   Singleton : furnitureManager.

   Responsabilités :
     - Liste des furnitures placés dans le monde (#list, copie conforme DB)
     - Validation et placement d'un meuble (place), retrait (remove), renommage (rename)
     - Lookup O(1) par id (#byId) et par chunk (#byChunk)
     - Mise à jour incrémentale des meubles affichés (#displayed) via Camera
     - Protection des tuiles : occupation, sol, surface empilable (#occupiedTiles, #floorTiles, #surfaceTops)
     - Recherche spatiale : meubles affichés, containers et stations à portée, meuble sous le curseur

   Interactions :
     camera            — écoute 'camera/preload-chunks-changed' pour maintenir #displayed
     saveManager       — persistance via queueStaticUpdate (place, remove, rename)
     inventoryManager  — appelant de place() et remove() ; gère inventory en amont/aval
     eventBus          — abonnement unique : 'camera/preload-chunks-changed'

   Structure DB (objectStore 'furniture') :
     {key, id, index, code, stype, w, h, deleted}
     Champs optionnels selon stype : left (boolean), lit (boolean), name (string)
     Suppression : deleted=true en DB, retrait immédiat des structures mémoire.
     Purge des deleted=true : au startSession, avant transmission à init().

   Structures mémoire :
     #list          — furniture[]              — copie conforme DB (objets mutés en place)
     #byId          — Map<furnitureId, furniture> — lookup O(1)
     #byChunk       — Map<chunkKey, Set<furniture>> — lookup spatial (chunk haut-gauche uniquement)
     #displayed     — Set<furniture>           — furnitures dans les chunks preload Camera
     #occupiedTiles — Set<tileIndex>           — tuiles couvertes par un furniture (rectangle wxh)
     #floorTiles    — Set<tileIndex>           — tuiles directement sous un furniture
     #surfaceTops   — Set<tileIndex>           — ligne haute des furnitures surface:true

   Contrat des systèmes occupants :
     isTileOccupied(index)  — tuile couverte par un furniture
     isFloorTile(index)     — tuile directement sous un furniture (interdit au mining)
     isSurfaceTop(index)    — tuile haute d'un furniture surface:true (sol pour empilement)

   Calcul de chunkKey depuis un index tuile :
     chunkX   = (index & 0x3FF) >> 4
     chunkY   = index >> 14
     chunkKey = (chunkY << 6) | chunkX
   ==================================================================================================== */

class FurnitureManager {
  #list = [] // furniture[] — copie conforme DB (objets mutés en place)
  #byId = new Map() // Map<furnitureId, furniture> — lookup O(1)
  #byChunk = new Map() // Map<chunkKey, Set<furniture>> — lookup spatial
  #displayed = new Set() // Set<furniture> — furnitures dans les chunks affichés
  #occupiedTiles = new Set() // Set<tileIndex> — tuiles couvertes par un furniture
  #floorTiles = new Set() // Set<tileIndex> — tuiles directement sous un furniture
  #surfaceTops = new Set() // Set<tileIndex> — tuiles hautes des furnitures surface:true

  constructor () {
    this.onPreloadChunksChanged = this.onPreloadChunksChanged.bind(this)
    eventBus.on('camera/preload-chunks-changed', this.onPreloadChunksChanged)
  }

  // ─── Helpers chunk ───────────────────────────────────────────────────────────

  /**
   * Inscrit un furniture dans #byChunk sur son chunk haut-gauche uniquement.
   * La zone preload Camera (1 ring autour du display) garantit la couverture des
   * furnitures chevauchant deux chunks.
   * @param {object} furniture
   */
  #addToChunks (furniture) {
    const key = ((furniture.index >> 14) << 6) | ((furniture.index & 0x3FF) >> 4)
    let set = this.#byChunk.get(key)
    if (set === undefined) {
      set = new Set()
      this.#byChunk.set(key, set)
    }
    set.add(furniture)
  }

  /**
   * Retire un furniture de #byChunk. Supprime l'entrée Map si le Set devient vide.
   * @param {object} furniture
   */
  #removeFromChunks (furniture) {
    const key = ((furniture.index >> 14) << 6) | ((furniture.index & 0x3FF) >> 4)
    const set = this.#byChunk.get(key)
    if (set === undefined) return
    set.delete(furniture)
    if (set.size === 0) this.#byChunk.delete(key)
  }

  // ─── Helpers Occupancy ───────────────────────────────────────────────────────

  /**
   * Inscrit un furniture dans les trois Sets d'occupation.
   * - occupiedTiles : rectangle complet wxh
   * - floorTiles    : ligne directement sous le furniture (interdite au mining)
   * - surfaceTops   : ligne haute du furniture si surface:true (sol pour empilement)
   * @param {object} furniture
   */
  #addToOccupancy (furniture) {
    const tileX = furniture.index & 0x3FF
    const tileY = furniture.index >> 10
    const {w, h} = furniture

    for (let y = tileY; y < tileY + h; y++) {
      const rowBase = y << 10
      for (let x = tileX; x < tileX + w; x++) {
        this.#occupiedTiles.add(rowBase | x)
      }
    }

    const floorBase = (tileY + h) << 10
    for (let x = tileX; x < tileX + w; x++) {
      this.#floorTiles.add(floorBase | x)
    }

    if (ITEMS[furniture.code].surface) {
      const topBase = tileY << 10
      for (let x = tileX; x < tileX + w; x++) {
        this.#surfaceTops.add(topBase | x)
      }
    }
  }

  /**
   * Retire un furniture des trois Sets d'occupation.
   * @param {object} furniture
   */
  #removeFromOccupancy (furniture) {
    const tileX = furniture.index & 0x3FF
    const tileY = furniture.index >> 10
    const {w, h} = furniture

    for (let y = tileY; y < tileY + h; y++) {
      const rowBase = y << 10
      for (let x = tileX; x < tileX + w; x++) {
        this.#occupiedTiles.delete(rowBase | x)
      }
    }

    const floorBase = (tileY + h) << 10
    for (let x = tileX; x < tileX + w; x++) {
      this.#floorTiles.delete(floorBase | x)
    }

    if (ITEMS[furniture.code].surface) {
      const topBase = tileY << 10
      for (let x = tileX; x < tileX + w; x++) {
        this.#surfaceTops.delete(topBase | x)
      }
    }
  }

  // ─── Initialisation ──────────────────────────────────────────────────────────

  /**
   * Initialise le manager à partir des enregistrements DB.
   * Les enregistrements deleted=true ont été purgés en amont — ne pas les transmettre.
   * Appelé depuis core.mjs au startSession (nouveau monde ou chargement).
   * @param {Array<object>} dbRecords
   */
  init (dbRecords) {
    this.#list.length = 0
    this.#byId.clear()
    this.#byChunk.clear()
    this.#occupiedTiles.clear()
    this.#floorTiles.clear()
    this.#surfaceTops.clear()

    for (const record of dbRecords) {
      this.#list.push(record)
      this.#byId.set(record.id, record)
      this.#addToChunks(record)
      this.#addToOccupancy(record)
    }
    console.log('FurnitureManager.init', {list: this.#list, byId: this.#byId, byChunk: this.#byChunk})
  }

  // ─── Envoi d'informations ────────────────────────────────────────────────────

  /**
   * Retourne le furniture correspondant à l'identifiant donné, ou undefined s'il n'existe pas.
   * @param {string} furnitureId
   * @returns {object|undefined}
   */
  getFurnitureById (furnitureId) { return this.#byId.get(furnitureId) }

  /**
   * Tuile couverte par un furniture (rectangle wxh).
   * @param {number} index
   * @returns {boolean}
   */
  isTileOccupied (index) { return this.#occupiedTiles.has(index) }

  /**
   * Tuile directement sous un furniture — interdit au mining.
   * @param {number} index
   * @returns {boolean}
   */
  isFloorTile (index) { return this.#floorTiles.has(index) }

  /**
   * Tuile de la ligne haute d'un furniture surface:true — valide pour empilement (furniture onTop:true).
   * @param {number} index
   * @returns {boolean}
   */
  isSurfaceTop (index) { return this.#surfaceTops.has(index) }

  /**
   * Retourne les furnitures de #displayed dans le rectangle centré joueur défini par buffId.
   * Centre joueur et range récupérés depuis playerManager et buffManager (commentés — DEBUG).
   * Le range 24x20 tuiles couvrirait 9 this.#byChunk.get — moins efficace que le scan direct.
   * @param {string}   buffId  — identifiant du buff composite définissant le range
   * @param {Set<string>} stypes — sous-types acceptés
   * @returns {Array<object>}
   */
  getFurnituresInRange (buffId, stypes) {
    // const {x: cx, y: cy} = playerManager.getCenterTile()  // TODO PlayerManager
    // const {w: rw, h: rh} = buffManager.getBuff(buffId)
    const cx = 206; const cy = 405 // DEBUG
    const rw = 10; const rh = 8 // DEBUG

    const x0 = cx - rw; const x1 = cx + rw
    const y0 = cy - rh; const y1 = cy + rh

    const result = []
    for (const furniture of this.#displayed) {
      if (!stypes.has(furniture.stype)) continue
      const fx = furniture.index & 0x3FF
      const fy = furniture.index >> 10
      if (fx >= x0 && fx <= x1 && fy >= y0 && fy <= y1) { result.push(furniture) }
    }
    return result
  }

  /**
   * Retourne les containers (chest, closet, cabinet...) dans le range 'range-chest' autour du joueur.
   * Le range 24x20 tuiles couvrirait 9 this.#byChunk.get — moins efficace que le scan direct.
   * @returns {Array<object>}
   */
  getNearbyContainers () {
    const {x: cx, y: cy} = playerManager.getCenterTile() // TODO PlayerManager
    // const {w: rw, h: rh} = buffManager.getBuff('interaction-range')

    const rw = 10; const rh = 8 // DEBUG

    const x0 = cx - rw; const x1 = cx + rw
    const y0 = cy - rh; const y1 = cy + rh

    const result = []
    for (const furniture of this.#displayed) {
      if (!CONTAINER_STYPES.has(furniture.stype)) continue
      const fx = furniture.index & 0x3FF
      const fy = furniture.index >> 10
      if (fx >= x0 && fx <= x1 && fy >= y0 && fy <= y1) result.push(furniture)
    }
    return result
  }

  /**
   * Retourne les crafting stations dans le range 'range-station' autour du joueur.
   * Le range 24x20 tuiles couvrirait 9 this.#byChunk.get — moins efficace que le scan direct.
   * @returns {Array<object>}
   */
  getNearbyCraftingStations () {
    // const {x: cx, y: cy} = playerManager.getCenterTile()  // TODO PlayerManager
    // const {w: rw, h: rh} = buffManager.getBuff('interaction-range')
    const cx = 512; const cy = 200 // DEBUG
    const rw = 10; const rh = 8 // DEBUG

    const x0 = cx - rw; const x1 = cx + rw
    const y0 = cy - rh; const y1 = cy + rh

    const result = []
    for (const furniture of this.#displayed) {
      if (furniture.stype !== 'station') continue
      const fx = furniture.index & 0x3FF
      const fy = furniture.index >> 10
      if (fx >= x0 && fx <= x1 && fy >= y0 && fy <= y1) result.push(furniture)
    }
    return result
  }

  /**
   * Retourne le furniture situé sur la tuile cliquée, ou null si aucun.
   * Early-exit via #occupiedTiles (O(1)), puis recherche dans 1 à 4 chunks via #byChunk.
   * Le chunk courant seul est testé quand px >= MAX_FURNITURE_W-1 et py >= MAX_FURNITURE_H-1
   * (~76% des cas pour des meubles de 3x3 max).
   * @param {number} tileIndex — (y << 10) | x
   * @returns {object|null}
   */
  getFurnitureAt (tileIndex) {
    if (!this.#occupiedTiles.has(tileIndex)) return null

    const tx = tileIndex & 0x3FF
    const ty = tileIndex >> 10
    const cx = tx >> 4
    const cy = ty >> 4
    const cxMin = (tx & 0xF) < MAX_FURNITURE_W ? cx - 1 : cx
    const cyMin = (ty & 0xF) < MAX_FURNITURE_H ? cy - 1 : cy

    for (let cky = cyMin; cky <= cy; cky++) {
      const rowKey = cky << 6
      for (let ckx = cxMin; ckx <= cx; ckx++) {
        const set = this.#byChunk.get(rowKey | ckx)
        if (set === undefined) continue
        for (const furniture of set) {
          const fx = furniture.index & 0x3FF
          const fy = furniture.index >> 10
          if (tx >= fx && tx < fx + furniture.w && ty >= fy && ty < fy + furniture.h) return furniture
        }
      }
    }
    return null
  }
  // ─── Visualisation ───────────────────────────────────────────────────────────

  /**
   * Reconstruit #displayed à partir des chunks preload de la Camera.
   * Appelé via eventBus 'camera/preload-chunks-changed'.
   * Lié dans le constructeur — référence stable pour off().
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) {
    this.#displayed.clear()
    for (const chunkKey of preloadChunks) {
      const set = this.#byChunk.get(chunkKey)
      if (set === undefined) continue
      for (const furniture of set) {
        this.#displayed.add(furniture)
      }
    }
    console.log('FurnitureManager.onPreloadChunksChanged', {displayed: this.#displayed})
  }

  /**
   * Dessine les meubles visibles sur le contexte transformé par la caméra.
   * @param {CanvasRenderingContext2D} ctx - contexte déjà transformé (caméra appliquée)
   */
  render (ctx) {
    for (const furniture of this.#displayed) {
      const item = ITEMS[furniture.code]
      const img = furniture.left ? item.placedLeft ?? item.placed : item.placed ?? item.placedLeft
      if (!img) continue
      const pxX = (furniture.index & 0x3FF) << 4
      const pxY = (furniture.index >> 10) << 4
      ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
    }
  }

  // ─── Placement ───────────────────────────────────────────────────────────────

  /**
   * Pose un meuble dans le monde à partir d'un clic joueur (coin bas-gauche).
   * L'appelant est responsable de la validation des conditions et du retrait inventaire.
   * Enregistrement persisté via saveManager dans la même passe que le retrait inventaire.
   * @param {string} code        — itemId dans ITEMS
   * @param {number} clickIndex  — coin bas-gauche cliqué (y << 10) | x
   * @returns {object} record créé
   */
  place (code, clickIndex) {
    const item = ITEMS[code]
    const placedImage = item.placed ?? item.placedLeft
    const w = placedImage.sw / 16
    const h = placedImage.sh / 16

    const record = {
      id: uniqueIdGenerator.getUniqueId(),
      index: clickIndex - ((h - 1) << 10),
      code,
      stype: item.stype,
      w,
      h,
      deleted: false
    }

    // État initial selon stype — liste à compléter au fur et à mesure
    switch (item.stype) {
      case 'door':
        // redesign potentiel
        record.left = true
        record.closed = true
        break
      case 'chair':
      case 'toilet':
      case 'bed':
        record.left = true
        break
      case 'fireplace':
      case 'campfire':
        record.lit = false
        break
    }

    this.#list.push(record)
    this.#byId.set(record.id, record)
    this.#addToChunks(record)
    this.#addToOccupancy(record)

    const chunkKey = ((record.index >> 14) << 6) | ((record.index & 0x3FF) >> 4)
    if (camera.preloadChunks.has(chunkKey)) this.#displayed.add(record)

    saveManager.queueStaticUpdate({storeName: 'furniture', record})

    return record
  }

  /**
   * Retire un meuble du monde et le marque deleted=true en DB.
   * Retrait immédiat de toutes les structures mémoire.
   * L'appelant est responsable de la réinsertion en inventaire.
   * @param {string} furnitureId
   * @returns {object|undefined} — record retiré, undefined si introuvable
   */
  unplace (furnitureId) {
    const record = this.#byId.get(furnitureId)
    if (record === undefined) return undefined

    record.deleted = true

    const listIndex = this.#list.indexOf(record)
    if (listIndex !== -1) {
      // suppression optimisée
      this.#list[listIndex] = this.#list[this.#list.length - 1]
      this.#list.length--
    }

    this.#byId.delete(furnitureId)
    this.#removeFromChunks(record)
    this.#removeFromOccupancy(record)
    this.#displayed.delete(record)

    saveManager.queueStaticUpdate({storeName: 'furniture', record})

    return record
  }

  // ─── Placement ───────────────────────────────────────────────────────────────

  /**
   * Renomme un furniture container et persiste la modification.
   * @param {string} furnitureId
   * @param {string} name
   */
  rename (furnitureId, name) {
    const record = this.#byId.get(furnitureId)
    if (record === undefined) return
    record.name = name
    saveManager.queueStaticUpdate({storeName: 'furniture', record})
  }
}
export const furnitureManager = new FurnitureManager()

class HousingManager {
}
export const housingManager = new HousingManager()
