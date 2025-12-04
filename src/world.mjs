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
      const chunkIndex = record.index

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

  getTile (x, y) {
    return this.#data[(y << 10) | x]
  }

  setTile (x, y, code) {
    // if (x === 0 || x === 1023 || y === 0 || y === 511) return

    const index = (y << 10) | x
    if (this.#data[index] === code) return

    this.#data[index] = code

    const cx = x >> 4
    const cy = y >> 4

    // Chunk Key alignée sur 64 de large (>> 6)
    const chunkKey = (cy << 6) | cx

    this.#dirtyRenderChunks.add(chunkKey)
    this.#dirtySaveChunks.add(chunkKey)
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
  getRawData () {
    return this.#data
  }
}

export const chunkManager = new ChunkManager()
