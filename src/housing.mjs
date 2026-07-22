// housing.mjs — FurnitureManager - HousingManager

import {eventBus, blockedTiles} from './utils.mjs'
import {uniqueIdGenerator} from './database.mjs'
import {CONTAINER_STYPES} from './constant.mjs'
import {saveManager} from './persistence.mjs'
import {camera} from './render.mjs'
import {playerManager} from './player.mjs'
import {isInInteractionRange} from './buff.mjs' // ← ajouter
import {IMAGE_CACHE} from './assets.mjs'
import {MAX_FURNITURE_W, MAX_FURNITURE_H, ITEMS, NODES_LOOKUP, NODE_TYPE} from '../assets/data/data.mjs'
import {chunkManager} from './world.mjs'

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
  #platformTiles = new Set() // Set<tileIndex> — tuile occupée par une platform (stype:'platform', toujours 1x1)

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
   * Inscrit un furniture dans les trois Sets d'occupation, et met à jour blockedTiles :
   * - occupiedTiles : rectangle complet wxh → blockedTiles.blockPlacement (pose interdite)
   * - floorTiles    : ligne directement sous le furniture → blockedTiles.blockMining (mining interdit)
   * - surfaceTops   : ligne haute du furniture si surface:true (sol pour empilement, hors blockedTiles)
   * @param {object} furniture
   */
  #addToOccupancy (furniture) {
    const tileX = furniture.index & 0x3FF
    const tileY = furniture.index >> 10
    const {w, h} = furniture

    for (let y = tileY; y < tileY + h; y++) {
      const rowBase = y << 10
      for (let x = tileX; x < tileX + w; x++) {
        const tileIndex = rowBase | x
        this.#occupiedTiles.add(tileIndex)
        blockedTiles.blockPlacement(tileIndex)
      }
    }

    if (!ITEMS[furniture.code].floating) {
      const floorBase = (tileY + h) << 10
      for (let x = tileX; x < tileX + w; x++) {
        const tileIndex = floorBase | x
        this.#floorTiles.add(tileIndex)
        blockedTiles.blockMining(tileIndex)
      }
    }

    if (ITEMS[furniture.code].surface) {
      const topBase = tileY << 10
      for (let x = tileX; x < tileX + w; x++) {
        this.#surfaceTops.add(topBase | x)
      }
    }

    if (furniture.stype === 'platform') this.#platformTiles.add(furniture.index)
  }

  /**
   * Retire un furniture des trois Sets d'occupation, et libère les tuiles dans blockedTiles
   * (symétrique de #addToOccupancy : occupiedTiles → unblockPlacement, floorTiles → unblockMining).
   * @param {object} furniture
   */
  #removeFromOccupancy (furniture) {
    const tileX = furniture.index & 0x3FF
    const tileY = furniture.index >> 10
    const {w, h} = furniture

    for (let y = tileY; y < tileY + h; y++) {
      const rowBase = y << 10
      for (let x = tileX; x < tileX + w; x++) {
        const tileIndex = rowBase | x
        this.#occupiedTiles.delete(tileIndex)
        blockedTiles.unblockPlacement(tileIndex)
      }
    }

    if (!ITEMS[furniture.code].floating) {
      const floorBase = (tileY + h) << 10
      for (let x = tileX; x < tileX + w; x++) {
        const tileIndex = floorBase | x
        this.#floorTiles.delete(tileIndex)
        blockedTiles.unblockMining(tileIndex)
      }
    }

    if (ITEMS[furniture.code].surface) {
      const topBase = tileY << 10
      for (let x = tileX; x < tileX + w; x++) {
        this.#surfaceTops.delete(topBase | x)
      }
    }
    if (furniture.stype === 'platform') this.#platformTiles.delete(furniture.index)
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
    this.#platformTiles.clear()

    for (const record of dbRecords) {
      this.#list.push(record)
      this.#byId.set(record.id, record)
      this.#addToChunks(record)
      this.#addToOccupancy(record)
      if (record.stype === 'teleporter') teleporterManager.initTeleporter(record)
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
   * Tuile occupée par une platform.
   * @param {number} index
   * @returns {boolean}
   */
  isPlatformTile (index) { return this.#platformTiles.has(index) }

  /**
   * Retourne les furnitures de #displayed dans le rectangle centré joueur défini par buffId.
   * Centre joueur et range récupérés depuis playerManager et buffManager (commentés — DEBUG).
   * Le range 24x20 tuiles couvrirait 9 this.#byChunk.get — moins efficace que le scan direct.
   * @param {string}   buffId  — identifiant du buff composite définissant le range
   * @param {Set<string>} stypes — sous-types acceptés
   * @returns {Array<object>}
   */
  getFurnituresInRange (stypes) {
    const centerTile = playerManager.getCenterTile()
    const result = []
    for (const furniture of this.#displayed) {
      if (!stypes.has(furniture.stype)) continue
      if (isInInteractionRange(furniture.index, centerTile)) result.push(furniture)
    }
    return result
  }

  /**
   * Retourne les containers (chest, closet, cabinet...) dans le range 'interaction-range' autour du joueur.
   * Le range 24x20 tuiles couvrirait 9 this.#byChunk.get — moins efficace que le scan direct.
   * @returns {Array<object>}
   */
  getNearbyContainers () {
    const centerTile = playerManager.getCenterTile()
    const result = []
    for (const furniture of this.#displayed) {
      if (!CONTAINER_STYPES.has(furniture.stype)) continue
      if (isInInteractionRange(furniture.index, centerTile)) result.push(furniture)
    }
    return result
  }

  /**
   * Retourne les crafting stations dans le range 'interaction-range' autour du joueur.
   * Le range 24x20 tuiles couvrirait 9 this.#byChunk.get — moins efficace que le scan direct.
   * @returns {Array<object>}
   */
  getNearbyCraftingStations () {
    const centerTile = playerManager.getCenterTile()
    const result = []
    for (const furniture of this.#displayed) {
      if (furniture.stype !== 'station') continue
      if (isInInteractionRange(furniture.index, centerTile)) result.push(furniture)
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
      case 'chest' :
      case 'closet' :
      case 'cabinet' :
        record.name = `C-${record.id}`
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

  /**
   * Change le code d'un furniture déjà posé (et son stype associé, dérivé du nouvel item).
   * Ne touche ni la position ni le footprint (w, h, index inchangés) — à l'appelant de garantir
   * que l'ancien et le nouveau code partagent la même empreinte.
   * @param {string} furnitureId
   * @param {string} newCode — itemId dans ITEMS
   */
  changeCode (furnitureId, newCode) {
    const record = this.#byId.get(furnitureId)
    if (record === undefined) return
    record.code = newCode
    record.stype = ITEMS[newCode].stype
    saveManager.queueStaticUpdate({storeName: 'furniture', record})
  }
}
export const furnitureManager = new FurnitureManager()

/* ====================================================================================================
   TELEPORTER MANAGER
   ====================================================================================================

   Autorité unique sur la position des téléporteurs posés dans le monde. Aucune logique DOM.
   Singleton : teleporterManager.

   Responsabilités :
     - Mémoriser l'index tuile de chaque téléporteur posé, par couleur (2 emplacements par couleur)
     - Entretenir cette liste au fil des placements/retraits de furniture en temps réel (eventBus)

   Reconstruction au démarrage :
     Aucune persistance propre. init() vide les 14 emplacements et doit être appelé AVANT
     furnitureManager.init(), qui appelle directement initTeleporter() pour chaque record
     stype === 'teleporter' restauré (même fichier — pas d'eventBus pour ce cas).

   Interactions :
     furnitureManager — appelant direct de initTeleporter() lors de la restauration
                       — lookup du record posé (code, index) sur 'furniture/placed' (pose joueur)
     eventBus          — écoute : 'furniture/placed', 'furniture/unplaced'

   ==================================================================================================== */

/** Emplacement de base (sur 2) dans #positions, par code d'item téléporteur. */
const TELEPORTER_COLOR_SLOT = {
  teleporterYellow: 0,
  teleporterOrange: 2,
  teleporterRed: 4,
  teleporterGreen: 6,
  teleporterBlue: 8,
  teleporterNavy: 10,
  teleporterPurple: 12
}

class TeleporterManager {
  #positions = new Uint32Array(14) // index tuile par emplacement — 0 = absent (cf. TELEPORTER_COLOR_SLOT)
  #byFurnitureId = new Map() // Map<furnitureId, slot> — entretenue au fil des placements/retraits

  constructor () {
    this.onFurniturePlaced = this.onFurniturePlaced.bind(this)
    this.onFurnitureUnplaced = this.onFurnitureUnplaced.bind(this)
    eventBus.on('furniture/placed', this.onFurniturePlaced)
    eventBus.on('furniture/unplaced', this.onFurnitureUnplaced)
  }

  /**
   * Vide les 14 emplacements. Doit être appelé avant furnitureManager.init().
   * Appelé depuis core.mjs au startSession.
   */
  init () {
    this.#positions.fill(0)
    this.#byFurnitureId.clear()
  }

  /**
   * Enregistre un téléporteur restauré au chargement dans le premier emplacement libre de sa
   * couleur. Appelé directement par FurnitureManager.init() pour chaque record
   * stype === 'teleporter' — les deux classes partagent le même fichier, pas besoin de
   * passer par l'eventBus 'furniture/placed' (réservé aux poses joueur en temps réel).
   * @param {object} furniture — record complet {id, code, index, stype, ...}
   */
  initTeleporter (furniture) {
    this.#register(furniture.id, furniture.code, furniture.index)
  }

  /**
   * Enregistre un téléporteur dans le premier emplacement libre de sa couleur. Sans effet si
   * les deux emplacements de cette couleur sont déjà occupés.
   * @param {string} furnitureId
   * @param {string} code   — itemId dans ITEMS (détermine la couleur)
   * @param {number} index  — tuile (y << 10) | x
   */
  #register (furnitureId, code, index) {
    const base = TELEPORTER_COLOR_SLOT[code]
    let slot = -1
    if (this.#positions[base] === 0) slot = base
    else if (this.#positions[base + 1] === 0) slot = base + 1
    if (slot === -1) return

    this.#positions[slot] = index
    this.#byFurnitureId.set(furnitureId, slot)
  }

  /**
   * Liaison EventBus : 'furniture/placed' — pose joueur en temps réel. Enregistre le
   * téléporteur posé dans le premier emplacement libre de sa couleur. Sans effet si le
   * meuble n'est pas un téléporteur.
   * Lié dans le constructeur — référence stable pour off().
   * @param {string} furnitureId
   */
  onFurniturePlaced (furnitureId) {
    const furniture = furnitureManager.getFurnitureById(furnitureId)
    if (furniture === undefined || furniture.stype !== 'teleporter') return
    this.#register(furniture.id, furniture.code, furniture.index)
  }

  /**
   * Liaison EventBus : 'furniture/unplaced' — libère l'emplacement du téléporteur retiré.
   * Sans effet si le meuble retiré n'était pas un téléporteur suivi.
   * Lié dans le constructeur — référence stable pour off().
   * @param {string} furnitureId
   */
  onFurnitureUnplaced (furnitureId) {
    const slot = this.#byFurnitureId.get(furnitureId)
    if (slot === undefined) return

    this.#positions[slot] = 0
    this.#byFurnitureId.delete(furnitureId)
  }

  /**
   * Indique si la couleur donnée a encore un emplacement libre.
   * @param {string} code — itemId dans ITEMS (teleporterYellow, teleporterRed...)
   * @returns {boolean} true si moins de 2 téléporteurs de cette couleur sont posés
   */
  canPlace (code) {
    const base = TELEPORTER_COLOR_SLOT[code]
    return this.#positions[base] === 0 || this.#positions[base + 1] === 0
  }

  /**
   * Active le téléporteur cliqué : retrouve son jumeau, vérifie que les 6 tuiles couvertes par
   * la hitbox joueur à l'arrivée (2 colonnes x 3 lignes, centrées sur les 2 colonnes du jumeau,
   * coin bas aligné sur son coin bas) ne contiennent aucune tuile solide, puis déclenche
   * 'player/teleport'. Émet 'toofar' hors de portée, 'wrong' si le jumeau est absent ou l'arrivée
   * bloquée.
   * @param {number} tileIndex — (y << 10) | x — tuile cliquée
   * @param {object} furniture — meuble téléporteur sous la souris (stype === 'teleporter')
   */
  tryTeleport (tileIndex, furniture) {
    if (!isInInteractionRange(tileIndex)) { eventBus.emit('sound/play', 'toofar'); return }

    const base = TELEPORTER_COLOR_SLOT[furniture.code]
    const twinIndex = this.#positions[base] === furniture.index ? this.#positions[base + 1] : this.#positions[base]
    if (twinIndex === 0) { eventBus.emit('sound/play', 'wrong'); return }

    const twin = furnitureManager.getFurnitureAt(twinIndex)
    if (twin === null) { eventBus.emit('sound/play', 'wrong'); return }

    const leftX = twin.index & 0x3FF
    const topY = twin.index >> 10

    // Hitbox joueur (26x46) centrée sur les 2 colonnes du jumeau (32px), coin bas aligné sur
    // son coin bas : occupe exactement les colonnes [leftX, leftX+1] et les lignes [topY-1, topY+1].
    const SOLID = NODE_TYPE.SOLID | NODE_TYPE.ETERNAL
    const codes = chunkManager.getRectCodes(leftX, topY - 1, twin.w, 3)
    for (const code of codes) {
      if (NODES_LOOKUP[code].type & SOLID) { eventBus.emit('sound/play', 'wrong'); return }
    }

    // x = leftX + 1 (colonne droite du jumeau) → onTeleport centre le joueur sur les 2 colonnes
    eventBus.emit('player/teleport', {x: leftX + 1, y: topY + twin.h})
  }

  /**
   * Affiche dans la console une ligne par couleur (7), avec la position 'x,y' ou 'empty'
   * pour chacun des 2 emplacements de la couleur.
   */
  debug () {
    console.log('--- TeleporterManager - Color: Position 1 / Position 2 ---')
    for (const code of Object.keys(TELEPORTER_COLOR_SLOT)) {
      const base = TELEPORTER_COLOR_SLOT[code]
      console.log(`${code.slice(10)}: ${this.#formatSlot(this.#positions[base])} / ${this.#formatSlot(this.#positions[base + 1])}`)
    }
  }

  /**
   * Formate un emplacement pour l'affichage debug.
   * @param {number} index — tuile (y << 10) | x, 0 = absent
   * @returns {string} 'x,y' si occupé, 'empty' sinon
   */
  #formatSlot (index) {
    if (index === 0) return 'empty'
    return `${index & 0x3FF},${index >> 10}`
  }
}
export const teleporterManager = new TeleporterManager()

/* ====================================================================================================
   HOUSING MANAGER
   ==================================================================================================== */

class HousingManager {
}
export const housingManager = new HousingManager()
