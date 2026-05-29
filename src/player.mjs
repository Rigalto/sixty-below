// player.mjs — PlayerManager - LifeManager

import {WORLD_WIDTH, WORLD_HEIGHT, PLAYER} from './constant.mjs'

const WORLD_PX_W = WORLD_WIDTH << 4 // 16384 px
const WORLD_PX_H = WORLD_HEIGHT << 4 // 8192 px

class PlayerManager {
  #x = 0 // px monde — coin haut-gauche de la hitbox
  #y = 0 // px monde — coin haut-gauche de la hitbox
  #direction = 1 // direction dans laquelle regarde le player (0 à gauche et 1 à droite)

  /**
 * Initialise la position depuis le record gamestate.
 * Format attendu : 'x|y|direction'
 * Retourne le centre de la hitbox en pixels monde.
 * @param {string} playerRecord - state.player issu de database.getAllGameState()
 * @returns {{x: number, y: number}}
 */
  init (playerRecord) {
    const [x, y, direction] = playerRecord.split('|')
    this.#x = parseInt(x, 10)
    this.#y = parseInt(y, 10)
    this.#direction = parseInt(direction, 10)
    return {x: this.#x + (PLAYER.w >> 1), y: this.#y + (PLAYER.h >> 1)}
  }

  /**
   * Déplace le joueur selon le bitmask directions. Sans collision (phase affichage).
   * directions : UP=1, DOWN=2, LEFT=4, RIGHT=8 (cf. MOVEMENT_MAP dans core.mjs)
   * Provisoire : speed appliquée en Y jusqu'à l'implémentation gravité/saut.
   * @param {number} dt         - delta temps en ms
   * @param {number} directions - bitmask clavier
   */
  update (dt, directions) {
    if (directions !== 0) {
      const dist = PLAYER.speed * dt
      if (directions & 4) { this.#x -= dist }
      if (directions & 8) { this.#x += dist }
      if (directions & 1) { this.#y -= dist }
      if (directions & 2) { this.#y += dist }
      // Clamp dans les bornes du monde - provisoire
      if (this.#x < 0) { this.#x = 0 }
      if (this.#x > WORLD_PX_W - PLAYER.w) { this.#x = WORLD_PX_W - PLAYER.w }
      if (this.#y < 0) { this.#y = 0 }
      if (this.#y > WORLD_PX_H - PLAYER.h) { this.#y = WORLD_PX_H - PLAYER.h }
    }
    return {x: this.#x + (PLAYER.w >> 1), y: this.#y + (PLAYER.h >> 1)}
  }

  /**
   * Retourne la tuile occupée par le centre de la hitbox en coordonnées tuile.
   * @returns {{x: number, y: number}}
   */
  getCenterTile () {
    return {
      x: (this.#x + (PLAYER.w >> 1)) >> 4,
      y: (this.#y + (PLAYER.h >> 1)) >> 4
    }
  }

  /**
   * Retourne le centre de la hitbox en pixels monde.
   * Utilisé par camera.update() pour centrer la vue sur le joueur.
   * @returns {[number, number]}
   */
  //   getPosition () {
  //     return [this.#x + (PLAYER.w >> 1), this.#y + (PLAYER.h >> 1)]
  //   }

  /**
   * Dessine la hitbox du joueur (placeholder — remplacé par les sprites).
   * Requiert que ctx soit déjà transformé (caméra appliquée).
   * @param {CanvasRenderingContext2D} ctx
   */
  render (ctx) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'
    ctx.fillRect(this.#x, this.#y, PLAYER.w, PLAYER.h)
  }
}
export const playerManager = new PlayerManager()

class LifeManager {
}
export const lifeManager = new LifeManager()
