import {WORLD_WIDTH, WORLD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT} from './constant.mjs'
import {eventBus} from './utils.mjs'

if (WORLD_WIDTH !== 1024 || WORLD_HEIGHT !== 512 || CANVAS_WIDTH !== 1024 || CANVAS_HEIGHT !== 768) {
  console.error('render: Constantes de dimensions incorrectes')
}

// CONSTANTES LOCALES (Déduites du Design Doc)
const VIEWPORT_WIDTH = CANVAS_WIDTH
const VIEWPORT_HEIGHT = CANVAS_HEIGHT
const VIEWPORT_HALF_W = VIEWPORT_WIDTH >> 1
const VIEWPORT_HALF_H = VIEWPORT_HEIGHT >> 1

// Taille d'un chunk en pixels (16 * 16 = 256)
const CHUNK_PIXEL_SIZE = 256 // (>> 8)
// Nombre de chunks sur la largeur du monde (1024 / 16)
const WORLD_CHUNKS_X = 64 // (>> 8)

/**
 * Fonction utilitaire d'interpolation linéaire
 */
const lerp = (start, end, amt) => (1 - amt) * start + amt * end

/* ====================================================================================================
   CAMERA (VIEWPORT)
   ==================================================================================================== */

class Camera {
  constructor () {
    // Position du coin haut-gauche du viewport (en pixels Monde)
    this.x = 0
    this.y = 0

    // Index du chunk situé au coin haut-gauche de la caméra
    this.currentChunkIndex = -1

    this.zoom = 1 // AJOUT : Niveau de zoom (1.0 = 100%)

    // Listes d'index de chunks
    this.displayChunks = [] // Chunks visibles à l'écran (Target Render) (5 * 4 chunks)
    this.preloadChunks = [] // Chunks en bordure (Target Cache update) (7 * 6 - 5 * 4 chunks)
    this.unpurgeableChunks = [] // Chunks à garder en cache RAM (9 * 8 chunks)

    this.setZoom = this.setZoom.bind(this)
    eventBus.on('render/set-zoom', this.setZoom)
  }

  // Getters pour les dimensions logiques (Ce que la caméra "voit" en pixels monde)
  get logicalWidth () { return VIEWPORT_WIDTH / this.zoom }
  get logicalHeight () { return VIEWPORT_HEIGHT / this.zoom }
  get logicalHalfW () { return VIEWPORT_HALF_W / this.zoom }
  get logicalHalfH () { return VIEWPORT_HALF_H / this.zoom }

  /**
   * Force la position de la caméra instantanément
   */
  init (targetX, targetY) {
    // Utilisation des dimensions LOGIQUES
    const camX = targetX - this.logicalHalfW
    const camY = targetY - this.logicalHalfH

    // Clamp avec les dimensions LOGIQUES
    const maxX = (WORLD_WIDTH << 4) - this.logicalWidth
    const maxY = (WORLD_HEIGHT << 4) - this.logicalHeight

    this.x = Math.max(0, Math.min(camX, maxX)) | 0
    this.y = Math.max(0, Math.min(camY, maxY)) | 0

    this.#updateChunkLists()
  }

  /**
   * Modifie le zoom et recalcule la position pour rester dans les bornes
   * @param {number} level - Facteur de zoom (ex: 0.5, 1, 2)
   */
  setZoom (level) {
    // Sécurité pour éviter division par 0 ou zoom négatif
    this.zoom = Math.max(1.0, Math.min(level, 2.0))

    // On force une mise à jour immédiate pour replacer la caméra
    // si le dé-zoom nous a fait sortir des limites du monde.
    // On réutilise la position actuelle (this.x + le demi-écran logique actuel) comme cible.
    const centerX = this.x + this.logicalHalfW
    const centerY = this.y + this.logicalHalfH
    this.init(centerX, centerY)
  }

  /**
   * Convertit une coordonnée Monde en coordonnée Canvas (Écran)
   */
  worldToCanvas (wx, wy) {
    return {
      x: wx - this.x,
      y: wy - this.y
    }
  }

  /**
   * Convertit une coordonnée Écran en coordonnée Monde
   * (Utile pour les clics souris)
   */
  canvasToWorld (cx, cy) {
    return {
      x: (cx / this.zoom) + this.x,
      y: (cy / this.zoom) + this.y
    }
  }

  /**
   * Met à jour la position (Appelé par GameCore::Update)
   * @param {number} targetX - Position X cible (Joueur)
   * @param {number} targetY - Position Y cible (Joueur)
   * @param {number} speed - Facteur LERP (ex: 0.1)
   */
  update (targetX, targetY, speed = 0.1) {
    // 1. Calcul Cible Clampée
    const maxX = (WORLD_WIDTH << 4) - this.logicalWidth
    const maxY = (WORLD_HEIGHT << 4) - this.logicalHeight

    let destX = targetX - this.logicalHalfW
    let destY = targetY - this.logicalHalfH

    destX = Math.max(0, Math.min(destX, maxX))
    destY = Math.max(0, Math.min(destY, maxY))

    // 2. Lissage (Lerp)
    // On utilise Math.floor pour éviter le flou de rendu sub-pixel
    if (Math.abs(destX - this.x) > 0.5) {
      this.x = Math.floor(lerp(this.x, destX, speed))
    }
    if (Math.abs(destY - this.y) > 0.5) {
      this.y = Math.floor(lerp(this.y, destY, speed))
    }

    // 3. Détection de changement de Chunk
    // Coordonnée chunk du coin haut-gauche de la caméra
    const cx = this.x >> 8 // * 256
    const cy = this.y >> 8 // * 256

    // Index flat unique
    const chunkIndex = cx + (cy * WORLD_CHUNKS_X)

    if (this.currentChunkIndex !== chunkIndex) {
      this.currentChunkIndex = chunkIndex
      this.#updateChunkLists(cx, cy)
    }
  }

  /**
   * Recalcule les listes de chunks (Display/Preload)
   * Optimisé pour ne pas générer de Garbage Collection
   */
  #updateChunkLists (cx, cy) {
    // Vider les tableaux sans détruire les références
    this.displayChunks.length = 0
    this.preloadChunks.length = 0
    this.unpurgeableChunks.length = 0

    // Définition des rectangles (en coordonnées Chunk)
    // Viewport visible (approx 4x3 chunks) -> On prend large pour le scrolling
    const dispX0 = cx; const dispX1 = cx + 4
    const dispY0 = cy; const dispY1 = cy + 3

    // Preload (1 rangée autour)
    const preX0 = Math.max(0, cx - 1); const preX1 = Math.min(WORLD_CHUNKS_X - 1, cx + 5)
    const preY0 = Math.max(0, cy - 1); const preY1 = cy + 4 // Pas de check max Y ici pour simplifier, géré par le world

    // Unpurgeable (2 rangées autour) - zone de rétention mémoire
    const keepX0 = Math.max(0, cx - 2); const keepX1 = Math.min(WORLD_CHUNKS_X - 1, cx + 6)
    const keepY0 = Math.max(0, cy - 2); const keepY1 = cy + 5

    // Remplissage optimisé
    // 1. Display Chunks
    for (let y = dispY0; y <= dispY1; y++) {
      const rowOffset = y * WORLD_CHUNKS_X
      for (let x = dispX0; x <= dispX1; x++) {
        this.displayChunks.push(rowOffset + x)
      }
    }

    // 2. Preload & Unpurgeable
    // Pour simplifier l'algo et rester rapide, on re-parcourt la zone large
    for (let y = keepY0; y <= keepY1; y++) {
      const rowOffset = y * WORLD_CHUNKS_X
      for (let x = keepX0; x <= keepX1; x++) {
        const idx = rowOffset + x
        this.unpurgeableChunks.push(idx)

        // Si c'est dans la zone Preload mais PAS dans Display -> C'est un preload
        if (x >= preX0 && x <= preX1 && y >= preY0 && y <= preY1) {
          // Astuce: includes sur un petit tableau (size < 20) est très rapide
          if (!this.displayChunks.includes(idx)) {
            this.preloadChunks.push(idx)
          }
        }
      }
    }
    console.log('>>>>>> #updateChunkLists', this.displayChunks, this.preloadChunks, this.unpurgeableChunks)
  }

  /**
   * Vérifie si un objet est visible à l'écran (Culling)
   * @param {number} x - Pixel X (Monde)
   * @param {number} y - Pixel Y (Monde)
   * @param {number} w - Largeur
   * @param {number} h - Hauteur
   * @param {number} margin - Marge de sécurité
   */
  isRectVisible (x, y, w, h, margin = 64) {
    // Coordonnées relatives caméra (Monde)
    const relX = x - this.x
    const relY = y - this.y

    // Marge ajustée au zoom (Optionnel, mais plus sûr)
    const safeMargin = margin / this.zoom

    return !(
      relX + w < -safeMargin ||
      relX > this.logicalWidth + safeMargin ||
      relY + h < -safeMargin ||
      relY > this.logicalHeight + safeMargin
    )
  }

  // --- DEBUG TOOLS ---

  /**
   * Dessine la grille des chunks pour le debug
   * @param {CanvasRenderingContext2D} ctx
   */
  drawDebug (ctx) {
    ctx.save()
    ctx.strokeStyle = 'yellow'
    ctx.lineWidth = 2
    ctx.font = '12px monospace'
    ctx.fillStyle = 'white'

    // Dessine les cadres des chunks visibles
    for (const chunkIdx of this.displayChunks) {
      // Conversion inverse : Index -> Coordonnées Monde
      const cy = Math.floor(chunkIdx / WORLD_CHUNKS_X)
      const cx = chunkIdx % WORLD_CHUNKS_X

      const wx = cx * CHUNK_PIXEL_SIZE
      const wy = cy * CHUNK_PIXEL_SIZE

      const screenPos = this.worldToCanvas(wx, wy)

      ctx.strokeRect(screenPos.x, screenPos.y, CHUNK_PIXEL_SIZE, CHUNK_PIXEL_SIZE)
      ctx.fillText(`C:${chunkIdx}`, screenPos.x + 5, screenPos.y + 15)
    }
    ctx.restore()
  }
}

export const camera = new Camera()

/* ====================================================================================================
   AFFICHAGE DES TUILES DU MONDE
   ==================================================================================================== */

// Placeholder pour le WorldRenderer (à implémenter ensuite)
class WorldRenderer {
  init () {
    console.log('Renderer initialized')
  }

  render () {
    // Sera appelé par la loop
  }
}
export const worldRenderer = new WorldRenderer()
