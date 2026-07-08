// world.mjs — ChunkManager

import {WORLD_WIDTH, WORLD_HEIGHT} from './constant.mjs'

if ((WORLD_WIDTH !== 1024) || (WORLD_HEIGHT !== 512)) console.error('Constantes WORLD_WIDTH ou WORLD_HEIGHT incorrectes')

// const CHUNKS_X = WORLD_WIDTH >> 4 = 64
// const CHUNKS_Y = WORLD_HEIGHT >> 4 = 32
// const TOTAL_CHUNKS = CHUNKS_X * CHUNKS_Y = 2048
const TOTAL_CHUNKS = 2048

/**
 * Gère le stockage des tuiles du monde dans un tableau unique optimisé.
 * SINGLETON.
 */
class ChunkManager {
  #data // @type {Uint8Array} Stockage plat (1 octet par tuile)
  #dirtyRenderChunks // @type {Set<number>} IDs des chunks modifiés visuellement (pour Renderer)
  #dirtySaveChunks // @type {Set<number>} IDs des chunks modifiés (pour Persistence)
  #dbKeys // @type {Array<number>} Index Logique des chunks (0-2047) -> Clé DB (Primary Key)
  #scratchTiles = new Uint8Array(64) // buffer scratch — réutilisé par getTilesInRect()

  constructor () {
    this.#data = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT)
    this.#dirtyRenderChunks = new Set()
    this.#dirtySaveChunks = new Set()
    this.#dbKeys = new Array(TOTAL_CHUNKS).fill(null)
  }

  /**
   * @param {Array<{key: any, index: number, chunk: Uint8Array}>} savedChunks
   */
  init (savedChunks) {
    if (!savedChunks || savedChunks.length !== TOTAL_CHUNKS) {
      throw new Error('ChunkManager: Fatal - Wrong number of chunks provided for initialization.')
    }

    const t0 = performance.now()

    // 1. Reset
    this.#dirtyRenderChunks.clear()
    this.#dirtySaveChunks.clear()
    this.#dbKeys.fill(null)

    // 2. Hydratation + Mapping des Clés
    this.#hydrateFromSave(savedChunks)

    console.log('[ChunkManager] Chargement des tuiles:', performance.now() - t0, 'ms')
  }

  /**
   * Récupère l'ID d'une tuile (HOT PATH).
   * Pas de bounds checking grâce aux Ghost Cells.
   * @param {number} x - Coordonnée X globale
   * @param {number} y - Coordonnée Y globale
   * @returns {number} ID de la tuile (0-255)
   */
  /**
   * Copie les chunks sauvegardés dans le buffer principal.
   */
  #hydrateFromSave (savedChunks) {
    for (const record of savedChunks) {
      const chunkIndex = record.key

      // 1. Mémorisation de la clé DB
      this.#dbKeys[chunkIndex] = record.key

      // 2. Copie des données binaires
      const sourceChunk = record.chunk

      // Décodage position (64 chunks de large = 2^6)
      const cy = chunkIndex >> 6
      const cx = chunkIndex & 0x3F

      const wx = cx << 4
      const wy = cy << 4

      // Point de départ dans le buffer monde
      let rowOffset = (wy << 10) | wx

      for (let y = 0; y < 16; y++) {
        const sourceStart = y << 4

        // Copie de la ligne (16 octets)
        this.#data.set(
          sourceChunk.subarray(sourceStart, sourceStart + 16),
          rowOffset
        )

        // Saut à la ligne suivante dans le MONDE (+1024)
        rowOffset += WORLD_WIDTH
      }
    }
  }

  getTileAt (index) { return this.#data[index] }

  getTile (x, y) { return this.#data[(y << 10) | x] }

  /**
   * Teste si toutes les tuiles d'un rectangle valent le même code.
   * @param {number} x @param {number} y @param {number} w @param {number} h - en tuiles
   * @param {number} code
   * @returns {boolean} true si toutes les tuiles du rectangle valent code
   */
  isRectCode (x, y, w, h, code) {
    let rowBase = (y << 10) | x
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        if (this.#data[rowBase + col] !== code) return false
      }
      rowBase += WORLD_WIDTH
    }
    return true
  }

  /**
   * Retourne l'ensemble des codes de tuiles distincts présents dans un rectangle.
   * @param {number} x @param {number} y @param {number} w @param {number} h - en tuiles
   * @returns {Set<number>}
   */
  getRectCodes (x, y, w, h) {
    const codes = new Set()
    let rowBase = (y << 10) | x
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        codes.add(this.#data[rowBase + col])
      }
      rowBase += WORLD_WIDTH
    }
    return codes
  }

  /**
   * Retourne les codes des tuiles chevauchant le rectangle pixel donné, même partiellement.
   * Vue sur un buffer interne — invalide à l'appel suivant.
   * @param {{x: number, y: number, w: number, h: number}} rect - pixels monde, entiers
   * @returns {Uint8Array}
   */
  getTilesInRect ({x, y, w, h}) {
    const tx0 = x >> 4
    const ty0 = y >> 4
    const tx1 = (x + w - 1) >> 4
    const ty1 = (y + h - 1) >> 4
    let n = 0
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        this.#scratchTiles[n++] = this.#data[(ty << 10) | tx]
      }
    }
    return this.#scratchTiles.subarray(0, n)
  }

  /**
 * Modifie la tuile aux coordonnées en paramètre. Marque les chunks render et save comme dirty.
 * @param {number} x
 * @param {number} y
 * @param {number} code
 */
  setTile (x, y, code) {
    // if (x === 0 || x === 1023 || y === 0 || y === 511) return

    const index = (y << 10) | x
    if (this.#data[index] === code) return
    this.#data[index] = code
    const cx = x >> 4
    const cy = y >> 4
    // Chunk Key alignée sur 64 de large
    const chunkKey = (cy << 6) | cx
    this.#dirtyRenderChunks.add(chunkKey)
    this.#dirtySaveChunks.add(chunkKey)
    // Invalider les chunks voisins si la tuile est sur un bord de chunk —
    // leur auto-tiling dépend de cette tuile comme voisine
    const localX = x & 0xF
    const localY = y & 0xF
    if (localX === 0 && cx > 0) this.#dirtyRenderChunks.add(chunkKey - 1)
    if (localX === 15 && cx < 63) this.#dirtyRenderChunks.add(chunkKey + 1)
    if (localY === 0 && cy > 0) this.#dirtyRenderChunks.add(chunkKey - 64)
    if (localY === 15 && cy < 31) this.#dirtyRenderChunks.add(chunkKey + 64)
  }

  /**
 * Modifie la tuile à l'index encodé. Marque les chunks render et save comme dirty.
 * @param {number} index — (y << 10) | x
 * @param {number} code
 */
  setTileAt (index, code) {
    if (this.#data[index] === code) return
    this.#data[index] = code
    const tileX = index & 0x3FF
    const tileY = index >> 10
    const cx = tileX >> 4
    const cy = tileY >> 4
    // Chunk Key alignée sur 64 de large
    const chunkKey = (cy << 6) | cx
    this.#dirtyRenderChunks.add(chunkKey)
    this.#dirtySaveChunks.add(chunkKey)
    // Invalider les chunks voisins si la tuile est sur un bord de chunk —
    // leur auto-tiling dépend de cette tuile comme voisine
    const localX = tileX & 0xF
    const localY = tileY & 0xF
    if (localX === 0 && cx > 0) this.#dirtyRenderChunks.add(chunkKey - 1)
    if (localX === 15 && cx < 63) this.#dirtyRenderChunks.add(chunkKey + 1)
    if (localY === 0 && cy > 0) this.#dirtyRenderChunks.add(chunkKey - 64)
    if (localY === 15 && cy < 31) this.#dirtyRenderChunks.add(chunkKey + 64)
  }

  /**
   * Renvoie les tuiles du chunk dont on donne l'index.
   */
  getChunkData (chunkIndex) {
    // Décodage aligné sur l'hydratation (>> 6)
    const cx = chunkIndex & 0x3F
    const cy = chunkIndex >> 6

    const buffer = new Uint8Array(256)

    const startWorldX = cx << 4
    const startWorldY = cy << 4
    let rowOffset = (startWorldY << 10) | startWorldX

    for (let y = 0; y < 16; y++) {
      const worldRow = this.#data.subarray(rowOffset, rowOffset + 16)
      buffer.set(worldRow, y << 4)
      rowOffset += WORLD_WIDTH // 1024
    }
    return buffer
  }

  /**
   * Prépare l'objet complet pour la sauvegarde (DTO).
   */
  getChunkSaveData (chunkIndex) {
    // Décodage aligné sur l'hydratation (>> 6)
    const cx = chunkIndex & 0x3F
    const cy = chunkIndex >> 6

    const buffer = new Uint8Array(256)

    const startWorldX = cx << 4
    const startWorldY = cy << 4
    let rowOffset = (startWorldY << 10) | startWorldX

    for (let y = 0; y < 16; y++) {
      const worldRow = this.#data.subarray(rowOffset, rowOffset + 16)
      buffer.set(worldRow, y << 4)
      rowOffset += WORLD_WIDTH // 1024
    }

    return {key: this.#dbKeys[chunkIndex], index: chunkIndex, chunk: buffer}
  }

  /**
 * Convertit l'intégralité de la grille de données en un tableau de chunks
 * @returns {Array<{key: number, chunk: Uint8Array}>}
 * Appelé uniquement à la fin de la génération d'un nouveau monde
 */
  processWorldToChunks () {
    const chunksX = WORLD_WIDTH >> 4 // WORLD_WIDTH / 16
    const chunksY = WORLD_HEIGHT >> 4 // WORLD_HEIGHT / 16
    const totalChunks = chunksX * chunksY
    const result = []

    for (let i = 0; i < totalChunks; i++) {
      result.push({
        key: i,
        chunk: this.getChunkData(i)
      })
    }
    return result
  }

  /**
   * Récupère la liste des chunks à redessiner et vide la liste.
   * Appelé par le Renderer.
   * @returns {Set<number>} Set d'IDs de chunks
   */
  consumeRenderDirtyChunks () {
    if (this.#dirtyRenderChunks.size === 0) return null
    // On clone pour renvoyer et on clear l'original
    // Note: Pour optimiser le GC, on pourrait utiliser un double-buffer de Set
    // mais new Set(iterable) est acceptable ici vu la fréquence (par frame ou moins)
    const dirty = new Set(this.#dirtyRenderChunks)
    this.#dirtyRenderChunks.clear()
    return dirty
  }

  /**
   * Récupère la liste des chunks à sauvegarder et vide la liste.
   * Appelé par le SaveManager (Persistence).
   * @returns {Set<number>} Set d'IDs de chunks
   */
  consumeSaveDirty () {
    if (this.#dirtySaveChunks.size === 0) return null
    const dirty = new Set(this.#dirtySaveChunks)
    this.#dirtySaveChunks.clear()
    return dirty
  }

  /**
   * Accès direct au TypedArray pour la sauvegarde de masse ou l'initialisation.
   * @returns {Uint8Array}
   */
  getRawData () { return this.#data }

  /**
   * Renvoie un clone du TypedArray pour la génération du monde.
   * @returns {Uint8Array}
   */
  getSnapshot () { return this.#data.slice() }
}

export const chunkManager = new ChunkManager()
