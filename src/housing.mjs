// housing.mjs
import {eventBus, uniqueIdGenerator} from './utils.mjs'
import {saveManager} from './persistence.mjs'
import {camera} from './render.mjs'
import {ITEMS} from '../../assets/data/data.mjs'

/* ====================================================================================================
   FURNITURE MANAGER
   ====================================================================================================

   Structure DB (objectStore 'furniture') :
   {
     key:          number,   // autoincrement DB
     id:           string,   // identifiant unique (uniqueIdGenerator)
     index:        number,   // position coin haut-gauche (y << 10) | x
     code:         string,   // itemId
     stype:        string,   // sous-type (station, chest, door, chair...)
     w:            number,   // largeur en tuiles
     h:            number,   // hauteur en tuiles
     deleted:      boolean,  // true = purge au prochain startSession
   }

   Structures mémoire :
     #list    — Array<object>          — copie conforme DB (objets mutés en place)
     #byId    — Map<string, object>    — id → furniture, lookup O(1)
     #byChunk — Map<number, Set>       — chunkKey → Set<furniture>, lookup spatial

   Calcul de chunkKey depuis un index tuile :
     chunkX   = (index & 0x3FF) >> 4
     chunkY   = index >> 14              // (index >> 10) >> 4
     chunkKey = (chunkY << 6) | chunkX  // chunkY × 64 + chunkX

   Un furniture couvrant w×h tuiles peut chevaucher jusqu'à 2×2 chunks.
   Il est enregistré dans chaque chunk qu'il occupe.

   Mise à jour des meubles affichés :
     Pilotée par un événement issus de la classe 'Camera' (à définir).

   Suppression d'un furniture :
     deleted=true en DB + retrait immédiat de #list, #byId, #byChunk, #displayed.
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
   * - occupiedTiles : rectangle complet w×h
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
   * Tuile couverte par un furniture (rectangle w×h).
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
}
export const furnitureManager = new FurnitureManager()

class HousingManager {
}
export const housingManager = new HousingManager()
