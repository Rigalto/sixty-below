// housing.mjs
// import {saveManager} from './persistence.mjs'

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
  /** @type {Array<object>} */
  #list
  /** @type {Map<string, object>} */
  #byId
  /** @type {Map<number, Set<object>>} */
  #byChunk

  constructor () {
    this.#list = []
    this.#byId = new Map()
    this.#byChunk = new Map()
  }

  // ─── Helpers chunk ───────────────────────────────────────────────────────────

  /**
   * Enregistre un furniture dans tous les chunks qu'il occupe.
   * @param {object} furniture
   */
  #addToChunks (furniture) {
    const tileX = furniture.index & 0x3FF
    const tileY = furniture.index >> 10
    const cxMin = tileX >> 4
    const cyMin = tileY >> 4
    const cxMax = (tileX + furniture.w - 1) >> 4
    const cyMax = (tileY + furniture.h - 1) >> 4

    for (let cy = cyMin; cy <= cyMax; cy++) {
      const rowKey = cy << 6
      for (let cx = cxMin; cx <= cxMax; cx++) {
        const key = rowKey | cx
        let set = this.#byChunk.get(key)
        if (set === undefined) {
          set = new Set()
          this.#byChunk.set(key, set)
        }
        set.add(furniture)
      }
    }
  }

  /**
   * Retire un furniture de tous les chunks qu'il occupe.
   * Supprime l'entrée Map si le Set résultant est vide.
   * @param {object} furniture
   */
  #removeFromChunks (furniture) {
    const tileX = furniture.index & 0x3FF
    const tileY = furniture.index >> 10
    const cxMin = tileX >> 4
    const cyMin = tileY >> 4
    const cxMax = (tileX + furniture.w - 1) >> 4
    const cyMax = (tileY + furniture.h - 1) >> 4

    for (let cy = cyMin; cy <= cyMax; cy++) {
      const rowKey = cy << 6
      for (let cx = cxMin; cx <= cxMax; cx++) {
        const key = rowKey | cx
        const set = this.#byChunk.get(key)
        if (set === undefined) continue
        set.delete(furniture)
        if (set.size === 0) this.#byChunk.delete(key)
      }
    }
  }

  getFurnitureById (furnitureId) {
    return this.#byId.get(furnitureId)
  }

  // ─── Initialisation ──────────────────────────────────────────────────────────

  /**
   * Initialise le manager à partir des enregistrements DB.
   * Les enregistrements deleted=true ont été purgés en amont — ne pas les transmettre.
   * Appelé depuis core.mjs au startSession (nouveau monde ou chargement).
   * @param {Array<object>} dbRecords
   */
  init (dbRecords) {
    this.#list = []
    this.#byId.clear()
    this.#byChunk.clear()

    for (const record of dbRecords) {
      this.#list.push(record)
      this.#byId.set(record.id, record)
      this.#addToChunks(record)
    }
    console.log('FurnitureManager.init', {list: this.#list, byId: this.#byId, byChunk: this.#byChunk})
  }
}
export const furnitureManager = new FurnitureManager()

class HousingManager {
}
export const housingManager = new HousingManager()
