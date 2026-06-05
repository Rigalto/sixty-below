// player.mjs — PlayerManager - LifeManager - HotbarOverlay

import {WORLD_WIDTH, WORLD_HEIGHT, PLAYER, MICROTASK, TELEPORT_FADE_MS, TELEPORT_WAIT_MS} from './constant.mjs'
import {eventBus, taskScheduler} from './utils.mjs'
import {buffManager} from './buff.mjs'
import {camera} from './render.mjs'

const WORLD_PX_W = WORLD_WIDTH << 4 // 16384 px
const WORLD_PX_H = WORLD_HEIGHT << 4 // 8192 px

class PlayerManager {
  #x = 0 // px monde — coin haut-gauche de la hitbox
  #y = 0 // px monde — coin haut-gauche de la hitbox
  #direction = 1 // direction dans laquelle regarde le player (0 à gauche et 1 à droite)

  #lastTileX = -1 // tuile X au dernier emit player/move
  #lastTileY = -1 // tuile Y au dernier emit player/move

  #teleportDiv = null // div#teleport-overlay — mis en cache à la première téléportation
  #teleportTarget = null // {x, y} en pixels — cible de la téléportation

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

    this.onTeleport = this.onTeleport.bind(this)
    this.onTeleportPhase1 = this.onTeleportPhase1.bind(this)
    this.onTeleportPhase2 = this.onTeleportPhase2.bind(this)
    this.onTeleportPhase3 = this.onTeleportPhase3.bind(this)
    eventBus.on('player/teleport', this.onTeleport)

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
    // affichage de la position du joueur dans le Control Panel (EnvironmentWidget)
    const feet = this.getFeetTile()
    if (feet.x !== this.#lastTileX || feet.y !== this.#lastTileY) {
      this.#lastTileX = feet.x
      this.#lastTileY = feet.y
      eventBus.emit('player/move', feet)
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
   * Retourne la tuile sous les pieds du joueur (bas-centre de la hitbox).
   * @returns {{x: number, y: number}}
   */
  getFeetTile () {
    return {
      x: (this.#x + (PLAYER.w >> 1)) >> 4,
      y: (this.#y + PLAYER.h) >> 4
    }
  }

  /**
   * Retourne le centre de la hitbox en pixels monde.
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

  // ///////////// //
  // TELEPORTATION //
  // ///////////// //

  /**
   * Mémorise la cible et planifie la phase 1.
   * Bindée dans init() — écoute 'player/teleport'.
   * @param {{x: number, y: number}} payload — coordonnées en tuiles
   */
  onTeleport ({x, y}) {
    this.#teleportTarget = {
      x: (x << 4) - (PLAYER.w >> 1),
      y: (y << 4) - PLAYER.h
    }
    const {priority, capacity} = MICROTASK.TELEPORT_PHASE1
    taskScheduler.enqueue('teleport-1', 0, this.onTeleportPhase1, priority, capacity)
    console.log('<><><><><> Phase 0')
  }

  /**
   * Phase 1 : fondu au noir + gel du joueur.
   * Planifie la phase 2 après TELEPORT_FADE_MS.
   */
  onTeleportPhase1 () {
    if (!this.#teleportDiv) this.#teleportDiv = document.getElementById('teleport-overlay')
    this.#teleportDiv.classList.add('fading')
    buffManager.setBuff('playerFreeze', true)
    const {priority, capacity} = MICROTASK.TELEPORT_PHASE2
    taskScheduler.enqueue('teleport-2', TELEPORT_FADE_MS, this.onTeleportPhase2, priority, capacity)
    console.log('<><><><><> Phase 1')
  }

  /**
   * Phase 2 : déplacement du joueur. Les chunks recalculent pendant TELEPORT_WAIT_MS.
   * Planifie la phase 3 après TELEPORT_WAIT_MS.
   */
  onTeleportPhase2 () {
    this.#x = this.#teleportTarget.x
    this.#y = this.#teleportTarget.y
    camera.init({x: this.#x + (PLAYER.w >> 1), y: this.#y + (PLAYER.h >> 1)})
    const {priority, capacity} = MICROTASK.TELEPORT_PHASE3
    taskScheduler.enqueue('teleport-3', TELEPORT_WAIT_MS, this.onTeleportPhase3, priority, capacity)
    console.log('<><><><><> Phase 2')
  }

  /**
   * Phase 3 : fondu depuis le noir + dégel du joueur.
   */
  onTeleportPhase3 () {
    this.#teleportDiv.classList.remove('fading')
    buffManager.setBuff('playerFreeze', false)
    console.log('<><><><><> Phase 3')
  }
}
export const playerManager = new PlayerManager()

class LifeManager {
}
export const lifeManager = new LifeManager()

/* ====================================================================================================
   HOTBAR OVERLAY
   ====================================================================================================

   Affichage permanent des 8 slots de la hotbar joueur dans le div #hotbar (sidebar gauche).
   Singleton : hotbarOverlay.

   Responsabilités :
     - Rendu des 8 slots <inventory-slot> depuis inventoryManager.hotbar
     - Maintien de l'index du slot actif (#activeIndex) et de son rendu visuel distinctif
     - Sélection du slot actif par clic ou par raccourci clavier ('1'–'8' via hotbar/select-slot)
     - Émission de hotbar/slot-active à chaque changement de slot actif

   Interactions :
     inventoryManager  — source de vérité pour le contenu des slots (hotbar)
     eventBus          — écoute : hotbar/changed, hotbar/slot-update, hotbar/select-slot
                       — émet  : hotbar/slot-active

   Initialisation :
     init() appelé par GameCore.startSession(). Sélectionne le slot 0
     Sur réception de hotbar/changed : peuple les slots DOM, émet hotbar/slot-active.

   Évolutions possibles (non cprévues, non codées) :
     - Sélection par roulette souris
     - Persistance de #activeIndex en base de données

   ==================================================================================================== */
