// player.mjs — PlayerManager - LootPopupManager - LifeManager - HotbarOverlay

import {WORLD_WIDTH, WORLD_HEIGHT, PLAYER, MICROTASK, TELEPORT_FADE_MS, TELEPORT_WAIT_MS, HOTBAR_CAPACITY} from './constant.mjs'
import {NODE_TYPE, NODES_LOOKUP, ITEMS} from '../assets/data/data.mjs'
import {eventBus, taskScheduler} from './utils.mjs'
import {buffManager} from './buff.mjs'
import {inventoryManager} from './inventory.mjs'
import {furnitureManager} from './housing.mjs'
import {camera} from './render.mjs'
import {chunkManager} from './world.mjs'
import {database} from './database.mjs'
import {IMAGE_CACHE} from './assets.mjs'

const WORLD_PX_W = WORLD_WIDTH << 4 // 16384 px
const WORLD_PX_H = WORLD_HEIGHT << 4 // 8192 px

/* ====================================================================================================
   CSS
   ==================================================================================================== */

const playerStyle = document.createElement('style')
playerStyle.textContent = /* css */`
#hotbar-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0 0 8px 0;
  width: 100%;
}

#hotbar-overlay inventory-slot.hb-slot {
  background-color: var(--slot-bg-hotbar);
}

#hotbar-overlay inventory-slot.hb-slot.active {
  border-color: #fff;
  border-width: 3px;
  box-shadow: 0 0 0 2px #f80, inset 0 0 0 1px #f80;
  outline: none;
}
`
document.head.appendChild(playerStyle)

/* ====================================================================================================
   PLAYER MOVEMENT — CONCEPTION

   DEUX MODES DE DÉPLACEMENT
   ─────────────────────────────────────────────────────────────────────────────
   A) Touches Flèches (debug) — bitmask `directionsArrow` (UP=1, DOWN=2, LEFT=4, RIGHT=8)
      Déplacement brut, sans collision, sans gravité.
      Appelé via playerManager.updateDebug(dt, directionsArrow).
      Suppression future : remplacer les deux appels dans core.mjs par un seul
        playerManager.update(dt, directionsArrow | directionsGame)

   B) Touches ZQSD — bitmask `directionsGame` (UP=1, DOWN=2, LEFT=4, RIGHT=8)
      Déplacement physique complet.
      Appelé via playerManager.update(dt, directionsGame).

   KeyboardManager expose deux propriétés distinctes :
     directionsArrow (bits 0-3) — Flèches
     directionsGame  (bits 0-3) — ZQSD

   ──────────────────────────────────────────────────────────────────────────────────────────
   DÉPLACEMENT HORIZONTAL (ZQSD gauche/droite)
   ──────────────────────────────────────────────────────────────────────────────────────────
   1. Le joueur se déplace en X à vitesse constante (PLAYER.speed × buff movement-speed).
   2. Détection de collision côté gauche/droit :
      - On sonde les tuiles qui chevauchent le bord gauche (ou droit) de la hitbox
        sur toute sa hauteur (plusieurs tuiles possibles selon PLAYER.h).
      - Si TOUTES les tuiles au bord sont libres → déplacement normal.
      - Si la tuile touchée est solide et la tuile AU-DESSUS est libre :
          → Step-up automatique (grimper d'une marche). Le joueur est repositionné en Y
            pour poser ses pieds sur le dessus de la tuile obstacle. Limité à 1 tuile (16px).
      - Si la tuile touchée ET la tuile au-dessus sont toutes deux solides :
          → Blocage : la hitbox est snappée contre le bord de la tuile.

   ──────────────────────────────────────────────────────────────────────────────────────────
   GRAVITÉ & ÉTATS
   ──────────────────────────────────────────────────────────────────────────────────────────
   États exclusifs (enum MOVE_STATE) : GROUNDED | JUMPING | FALLING

   Gravité (états FALLING ou fin de JUMPING) :
     #vy        += PLAYER.GRAVITY × dt
     #vy         = min(#vy, PLAYER.FALLING_SPEED_MAX × buff fall-speed)
     #y         += #vy × dt

   Atterrissage :
     Collision détectée sous les pieds → snap to top of tile, #vy = 0, état → GROUNDED.
     Si #vy au moment de l'impact dépasse le seuil de dégâts :
       fallHeight = #y_impact - #fallStartY
       Si fallHeight > PLAYER.FALL_DAMAGE_THRESHOLD :
         fallDmg = (fallHeight - PLAYER.FALL_DAMAGE_THRESHOLD) × PLAYER.FALL_DAMAGE_MULTIPLIER
         Émis via eventBus 'player/fall-damage' { dmg: fallDmg }

   ──────────────────────────────────────────────────────────────────────────────────────────
   SAUT (ZQSD haut — KeyW)
   ──────────────────────────────────────────────────────────────────────────────────────────
   Conditions d'activation : état = GROUNDED + bit UP pressé sur le front (pas en held).
   Le front-edge est détecté dans update() en comparant directions courant vs frame précédente.

   Déroulement :
     État → JUMPING ; #jumpStartY = #y
     Chaque frame : #y -= PLAYER.JUMP_SPEED × dt   (montée à vitesse constante)
     Fin de saut si :
       (a) #y ≤ #jumpStartY - PLAYER.JUMP_MAX_Y × buff jump-height → état → FALLING, #vy = 0
       (b) Collision plafond → snap under tile, état → FALLING immédiat, #vy = 0
     Pendant le saut, collisions latérales identiques au déplacement horizontal.

   ──────────────────────────────────────────────────────────────────────────────────────────
   CONSTANTES (constant.mjs — objet PLAYER)
   ──────────────────────────────────────────────────────────────────────────────────────────
     GRAVITY              : 0.0024  px/ms²  — accélération gravitationnelle
     FALLING_SPEED_MAX    : 0.6     px/ms   — vitesse de chute terminale (buffable)
     FALL_DAMAGE_THRESHOLD: 160     px      — hauteur minimale pour les dégâts de chute
     FALL_DAMAGE_MULTIPLIER: 0.1            — coefficient hauteur → dégâts
     JUMP_SPEED           : 0.28    px/ms   — vitesse ascensionnelle constante
     JUMP_MAX_Y           : 100     px      — hauteur de saut maximale (buffable)

   ──────────────────────────────────────────────────────────────────────────────────────────
   BUFFS
   ──────────────────────────────────────────────────────────────────────────────────────────

    PLAYER.speed : `movement-speed`
    PLAYER.JUMP_MAX_Y : `jump-height`
    PLAYER.GRAVITY : `gravity`
    PLAYER.FALLING_SPEED_MAX : `fall-speedMax`
    PLAYER.FALL_DAMAGE : `fall-dammage`

    Valeur 100 par défaut

   ==================================================================================================== */

class PlayerManager {
  #x = 0 // px monde — coin haut-gauche de la hitbox
  #y = 0 // px monde — coin haut-gauche de la hitbox
  #direction = 1 // direction dans laquelle regarde le player (0 à gauche et 1 à droite)

  #lastTileX = -1 // tuile X au dernier emit player/move
  #lastTileY = -1 // tuile Y au dernier emit player/move

  #vy = 0 // px/ms — vitesse verticale courante (gravité/chute)
  #moveState = 0 // 0=GROUNDED 1=JUMPING 2=FALLING
  #jumpStartY = 0 // px — #y au déclenchement du saut
  #fallStartY = 0 // px — #y au déclenchement de la chute (fin saut ou décrochage)
  #carryX = 0 // résidu fractionnaire du déplacement horizontal, dans (-1, 1) ; remis à 0 si immobile ou bloqué
  #carryY = 0 // retient la partie décimale de la position en y pour ne travailler que sur des integer

  #teleportDiv = null // div#teleport-overlay — mis en cache à la première téléportation
  #teleportTarget = null // {x, y} en pixels — cible de la téléportation

  // ci-dessous les variables utilisées pour éviter la création au vol
  // d'objets, afin de ne pas déclencher le GC
  #scanTilesResult = {hasSolid: false, viscosity: 0, hasWeb: false} // résultat de #scanTiles() — déstructurer immédiatement si appels multiples
  #getHitboxResult = {x: 0, y: 0, w: PLAYER.w, h: PLAYER.h} // résultat de #getHitbox()
  #getFeetTileResult = {x: 0, y: 0} // résultat de getFeetTile()
  #getCenterTileResult = {x: 0, y: 0, direction: 1} // résultat de getCenterTile()
  #updateResult = {x: 0, y: 0} // résultat de update()
  #armor = [null, null, null] // itemId des 3 slots d'armure (tête, torse, jambes) — synchronisé via 'inventory/static-buffs'

  constructor () {
    // eventBus
    this.onSaveTick = this.onSaveTick.bind(this)
    eventBus.on('save/tick', this.onSaveTick)
    this.onInventoryStaticBuffs = this.onInventoryStaticBuffs.bind(this)
    eventBus.on('inventory/static-buffs', this.onInventoryStaticBuffs)
  }

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
 * Liaison EventBus : 'save/tick' — écrit la position courante dans gamestate (clé 'player').
 * Émis toutes les 2s par SaveManager.processSave, synchronisé avec le save des chunks.
 */
  onSaveTick () {
    // const record = `${Math.round(this.#x)}|${Math.round(this.#y)}|${this.#direction}`
    const record = `${this.#x}|${this.#y}|${this.#direction}`
    database.setGameState('player', record)
  }

  /**
   * Déplace le joueur avec collision et gravité (mode physique — touches ZQSD).
   * Gère les états GROUNDED / JUMPING / FALLING, le step-up, les dégâts de chute.
   * Émet 'player/move' si la tuile sous les pieds change.
   * Émet 'player/fall-damage' si la chute dépasse PLAYER.FALL_DAMAGE_THRESHOLD.
   * directions : UP=1, DOWN=2, LEFT=4, RIGHT=8
   * @param {number} dt         - delta temps en ms
   * @param {number} directions - bitmask directionsGame
   * @returns {{x: number, y: number}} centre de la hitbox en pixels monde
   */
  update (dt, directions) {
    this.#horizontalMovement(directions, dt)
    this.#handleJump(dt, directions)
    this.#applyGravity(dt, directions) // application de la gravité, directions pour le drop-through platform (bas)

    // affichage de la position du joueur dans le Control Panel (EnvironmentWidget)
    this.#notifyCurrentPosition()

    this.#updateResult.x = this.#x + (PLAYER.w >> 1)
    this.#updateResult.y = this.#y + (PLAYER.h >> 1)
    return this.#updateResult
  }

  /**
   * Déplace le joueur horizontalement avec détection de collision.
   * Tente dans l'ordre : déplacement complet, step-up d'une tuile, glissement d'un pixel.
   * @param {-1|1} direction - sens du déplacement (-1 gauche, 1 droite)
   * @param {number} dt      - delta temps en ms
   */
  #horizontalMovement (directions, dt) {
    if (directions === 0) { this.#carryX = 0; return }
    // détermination de la direction horizontale
    let direction = 0
    if (directions & 4) { direction -= 1 }
    if (directions & 8) { direction += 1 }
    // Si le joueur appuie à la fois à droite et à gauche, le mouvement est nul
    if (directions === 0) { this.#carryX = 0; return }

    const speed = PLAYER.speed
    const dist = speed * dt * direction
    this.#direction = direction < 0 ? 0 : 1

    const total = dist + this.#carryX
    const intDist = total | 0
    this.#carryX = total - intDist

    const hitbox = this.getHitbox() // objet partagé
    const x0 = hitbox.x
    const y0 = hitbox.y
    hitbox.x = x0 + intDist // hitbox sur position future
    const {hasSolid: solidFull} = this.#scanTiles(chunkManager.getTilesInRect(hitbox))
    if (solidFull) {
      // collision détectée : tentative Set Up
      hitbox.y = y0 - 16
      const {hasSolid: solidStep} = this.#scanTiles(chunkManager.getTilesInRect(hitbox))
      if (!solidStep) {
        // stepup possible
        this.#x += intDist
        this.#y -= 16
      } else {
        // pas de step up possible : on tennte un décalage de un pixel
        hitbox.x = x0 + direction
        hitbox.y = y0
        const {hasSolid: solidSlide} = this.#scanTiles(chunkManager.getTilesInRect(hitbox))
        if (!solidSlide) {
        // on peut déplacer de un pixel, sinon on reste immobile
          this.#x += direction
        }
        this.#carryX = 0 // collision : reliquat jeté
      }
    } else {
      // pas de collision
      this.#x += intDist
    }
  }

  /**
 * Gère le déclenchement et la progression du saut.
 * @param {number} dt
 * @param {number} directions - bitmask
 */
  #handleJump (dt, directions) {
  // Déclenchement : joueur au sol + touche haut
    if (this.#moveState === 0 && (directions & 1)) {
      this.#moveState = 1 // Jumping
      this.#jumpStartY = this.#y - PLAYER.JUMP_MAX_Y // * buffManager.getBuff('jump-height') / 100
      return
    }

    if (this.#moveState !== 1) return // Jumping

    const newY = this.#y - PLAYER.JUMP_SPEED * dt // vitesse constante

    // Fin du saut : limite atteinte
    if (newY <= this.#jumpStartY) {
      this.#moveState = 0 // Grounded
      return
    }

    // Fin du saut : collision
    const hitbox = this.getHitbox()
    hitbox.y = newY
    if (this.#scanTiles(chunkManager.getTilesInRect(hitbox)).hasSolid) {
      this.#moveState = 0
      return
    }

    this.#y = newY
  }

  /**
   * Applique la gravité et gère l'atterrissage / la chute (états GROUNDED / FALLING).
   * Une platform sous les pieds compte comme sol, sauf si la touche bas (bit 2) est enfoncée
   * — dans ce cas le joueur la traverse (les tuiles solides restent bloquantes).
   * @param {number} dt
   * @param {number} directions - bitmask directionsGame (bit 2 = DOWN)
   */
  #applyGravity (dt, directions) {
    if (this.#moveState === 1) return // JUMPING

    const dropThrough = (directions & 2) !== 0
    const hitbox = this.getHitbox() // objet partagé
    const y0 = hitbox.y
    const h0 = hitbox.h

    // test de la présence de sol sous les pieds
    hitbox.y = y0 + h0
    hitbox.h = 1
    const {hasSolid: solidBelow} = this.#scanTiles(chunkManager.getTilesInRect(hitbox))
    const platformBelow = this.#hasPlatform(hitbox)
    hitbox.h = h0 // restauration car objet partagé

    if (dropThrough && !solidBelow && platformBelow) {
      // traversée immédiate d'une tuile de platform
      this.#y += 16
      this.#fallStartY = this.#y
      this.#vy = 0
      this.#carryY = 0
      this.#moveState = 2 // FALLING
      return
    }

    if (solidBelow || platformBelow) {
      if (this.#moveState === 2) { // FALLING
        // la descente est arrêtée, on calcule les dommages
        const deltaY = this.#y - this.#fallStartY
        if (deltaY > PLAYER.FALL_DAMAGE_THRESHOLD) {
          const damage = ((deltaY - PLAYER.FALL_DAMAGE_THRESHOLD) * PLAYER.FALL_DAMAGE_MULTIPLIER) | 0
          if (damage > 0) {
            eventBus.emit('life/add', -damage)
            console.log('DAMAGE DE CHUTE', damage)
          }
        }
      }
      this.#moveState = 0 // GROUNDED
      return
    }
    // le joueur a du vide sous ses pieds
    if (this.#moveState === 0) { // GROUNDED
      // Il était précédemment sur le sol, c'est donc le début d'une chute
      this.#fallStartY = this.#y
      this.#vy = 0
      this.#carryY = 0
      this.#moveState = 2 // FALLING
    }

    if (this.#moveState === 2) { // FALLING
      const gravity = PLAYER.GRAVITY / 5
      const speedBuff = 1

      const vy = Math.min(this.#vy + gravity * dt, PLAYER.FALLING_SPEED_MAX)
      let newY = this.#y + vy * dt * speedBuff + this.#carryY
      this.#carryY = newY % 1 // extraction de la partie décimale
      newY = Math.floor(newY)

      hitbox.y = newY
      const {hasSolid: solidFull} = this.#scanTiles(chunkManager.getTilesInRect(hitbox))

      hitbox.y = newY + h0 - 1
      hitbox.h = 1
      const platformFull = !dropThrough && this.#hasPlatform(hitbox)
      hitbox.h = h0

      // Si on percute le sol, on se contente de descendre d'un pixel.
      if (solidFull || platformFull) {
        this.#y += 1
      } else {
        this.#vy = vy
        this.#y = newY
      }
    }
  }

  /**
   * Déplace le joueur selon le bitmask directions. Sans collision (phase affichage).
   * directions : UP=1, DOWN=2, LEFT=4, RIGHT=8 (cf. MOVEMENT_MAP dans core.mjs)
   * Provisoire
   * @param {number} dt         - delta temps en ms
   * @param {number} directions - bitmask clavier
   */
  updateDebug (dt, directions) {
    if (directions !== 0) {
      const dist = PLAYER.speed * dt
      if (directions & 4) { this.#x -= dist; this.#direction = 0 }
      if (directions & 8) { this.#x += dist; this.#direction = 1 }
      if (directions & 1) { this.#y -= dist }
      if (directions & 2) { this.#y += dist }
      // Clamp dans les bornes du monde - oblilgatoire puisque pas de détection de collision
      if (this.#x < 0) { this.#x = 0 }
      if (this.#x > WORLD_PX_W - PLAYER.w) { this.#x = WORLD_PX_W - PLAYER.w }
      if (this.#y < 0) { this.#y = 0 }
      if (this.#y > WORLD_PX_H - PLAYER.h) { this.#y = WORLD_PX_H - PLAYER.h }

      // affichage de la position du joueur dans le Control Panel (EnvironmentWidget)
      this.#notifyCurrentPosition()
    }

    return {x: this.#x + (PLAYER.w >> 1), y: this.#y + (PLAYER.h >> 1)}
  }

  /**
   * Retourne la tuile occupée par le centre de la hitbox en coordonnées tuile.
   * @returns {{x: number, y: number, position: number}}
   */
  getCenterTile () {
    this.#getCenterTileResult.x = (this.#x + (PLAYER.w >> 1)) >> 4
    this.#getCenterTileResult.y = (this.#y + (PLAYER.h >> 1)) >> 4
    this.#getCenterTileResult.direction = this.#direction
    return this.#getCenterTileResult
  }

  /**
   * Retourne la tuile sous les pieds du joueur (bas-centre de la hitbox).
   * @returns {{x: number, y: number}}
   */
  getFeetTile () {
    this.#getFeetTileResult.x = (this.#x + (PLAYER.w >> 1)) >> 4
    this.#getFeetTileResult.y = (this.#y + PLAYER.h) >> 4
    return this.#getFeetTileResult
  }

  /**
   * Retourne la hitbox du joueur (en pixels, coordonnées monde).
   * Vue sur un objet interne — invalide à l'appel suivant.
   * @returns {{x: number, y: number, w: number, h: number}}
   */
  getHitbox () {
    this.#getHitboxResult.x = this.#x
    this.#getHitboxResult.y = this.#y
    return this.#getHitboxResult
  }

  /**
   * Indique si une platform occupe l'une des tuiles couvertes par le rectangle pixel donné.
   * @param {{x:number, y:number, w:number, h:number}} hitbox
   * @returns {boolean}
   */
  #hasPlatform (hitbox) {
    const tileY = hitbox.y >> 4
    const tileXMin = hitbox.x >> 4
    const tileXMax = (hitbox.x + hitbox.w - 1) >> 4
    const rowBase = tileY << 10
    for (let tx = tileXMin; tx <= tileXMax; tx++) {
      if (furnitureManager.isPlatformTile(rowBase | tx)) return true
    }
    return false
  }

  /**
   * Retourne le centre de la hitbox en pixels monde.
   * @returns {[number, number]}
   */
  //   getPosition () {
  //     return [this.#x + (PLAYER.w >> 1), this.#y + (PLAYER.h >> 1)]
  //   }

  // ///////// //
  // AFFICHAGE //
  // ///////// //

  /**
   * Dessine le joueur : pieds, corps, tête, empilés avec un léger recouvrement
   * (offsets 34 / 16 / 0 px depuis le haut de la hitbox).
   * Requiert que ctx soit déjà transformé (caméra appliquée).
   * @param {CanvasRenderingContext2D} ctx
   */
  render (ctx) {
    // hitbox
    // ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'
    // ctx.fillRect(this.#x, this.#y, PLAYER.w, PLAYER.h)

    const [head, body, foot] = this.#armor
    const mirror = this.#direction === 0
    const px = mirror ? -this.#x - PLAYER.w : this.#x
    if (mirror) { ctx.save(); ctx.scale(-1, 1) }

    ctx.drawImage(IMAGE_CACHE[foot.imgIndex], foot.sx, foot.sy, foot.sw, foot.sh, px, this.#y + 34, foot.sw, foot.sh)
    ctx.drawImage(IMAGE_CACHE[body.imgIndex], body.sx, body.sy, body.sw, body.sh, px, this.#y + 16, body.sw, body.sh)
    ctx.drawImage(IMAGE_CACHE[head.imgIndex], head.sx, head.sy, head.sw, head.sh, px, this.#y, head.sw, head.sh)

    if (mirror) ctx.restore()
  }

  /**
   * Liaison EventBus : 'inventory/static-buffs' — mémorise les 3 itemId d'armure équipés,
   * résout l'image à afficher pour chaque partie (tête, corps, pieds), en repli sur les
   * images par défaut (playerHead/playerBody/playerFoot) pour tout slot vide.
   * @param {{armor: string[3], accessories: string[5], trinkets: string[]}} payload
   */
  onInventoryStaticBuffs ({armor}) {
    this.#armor[0] = ITEMS[armor[0] !== '' ? armor[0] : 'playerHead'].armorImage
    this.#armor[1] = ITEMS[armor[1] !== '' ? armor[1] : 'playerBody'].armorImage
    this.#armor[2] = ITEMS[armor[2] !== '' ? armor[2] : 'playerFoot'].armorImage
    console.log('PlayerManager.onInventoryStaticBuffs >>>>>>>>>>>>>>>>>>>>>>>>>>>', this.#armor)
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
    eventBus.emit('player/teleport-begin')
    eventBus.emit('sound/play', 'teleport')
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
    eventBus.emit('player/teleport-end')
    console.log('<><><><><> Phase 3')
  }

  // /////////////////// //
  // HELPERS DEPLACEMENT //
  // /////////////////// //

  /**
   * Analyse un tableau de codes tuile et produit l'état environnemental pour la physique.
   * Résultat épémère — déstructurer immédiatement en cas d'appels multiples.
   * @param {Uint8Array} tiles - résultat de chunkManager.getTilesInRect()
   * @returns {{hasSolid: boolean, viscosity: number, hasWeb: boolean}}
   */
  #scanTiles (tiles) {
    const SOLID = NODE_TYPE.SOLID | NODE_TYPE.ETERNAL
    const r = this.#scanTilesResult
    r.hasSolid = false
    r.viscosity = 0
    r.hasWeb = false
    for (const code of tiles) {
      const node = NODES_LOOKUP[code]
      if (!node) continue
      const {type} = node
      if (type & SOLID) r.hasSolid = true
      if (type & NODE_TYPE.WEB) r.hasWeb = true
      if (type & NODE_TYPE.LIQUID && node.viscosity > r.viscosity) r.viscosity = node.viscosity
    }
    return r
  }

  /**
   * Émet 'player/move' si la tuile sous les pieds a changé depuis le dernier appel.
   * Sans paramètre ni valeur de retour — effet de bord sur #lastTileX / #lastTileY.
   */
  #notifyCurrentPosition () {
    const feet = this.getFeetTile()
    if (feet.x !== this.#lastTileX || feet.y !== this.#lastTileY) {
      this.#lastTileX = feet.x
      this.#lastTileY = feet.y
      eventBus.emit('player/move', feet)
    }
  }
}
export const playerManager = new PlayerManager()

const LOOT_POPUP_FRAMES = 120 // durée d'affichage d'une icône lootée, en frames (~2s à 60 FPS)
const LOOT_ICON_SIZE = 32
const LOOT_ICON_GAP = 4

/* ====================================================================================================
   POPUP DE LOOT (icônes au-dessus de la tête du joueur)
   ==================================================================================================== */

class LootPopupManager {
  #queue = [] // {image, framesLeft}[] — ordre FIFO, le plus ancien en tête

  constructor () {
    this.onLootItem = this.onLootItem.bind(this)
    eventBus.on('player/loot-item', this.onLootItem)
  }

  /**
+  * Liaison EventBus : 'player/loot-item' — résout l'image de l'item et l'ajoute en fin de file.
   * @param {{itemCode: string}} payload
   */
  onLootItem ({itemCode}) {
    this.#queue.push({image: ITEMS[itemCode].image, framesLeft: LOOT_POPUP_FRAMES})
  }

  /**
   * Dessine les icônes de la file en ligne horizontale centrée au-dessus de la tête du
   * joueur (les plus anciennes à gauche), puis décrémente leur temps d'affichage restant et
   * retire celles arrivées à zéro. Requiert que ctx soit déjà transformé (caméra appliquée).
   * @param {CanvasRenderingContext2D} ctx
   */
  render (ctx) {
    if (this.#queue.length === 0) return

    const hitbox = playerManager.getHitbox()
    const totalWidth = this.#queue.length * LOOT_ICON_SIZE + (this.#queue.length - 1) * LOOT_ICON_GAP
    let px = hitbox.x + (hitbox.w >> 1) - (totalWidth >> 1)
    const py = hitbox.y - LOOT_ICON_SIZE - 8

    let expired = 0
    for (let i = 0; i < this.#queue.length; i++) {
      const entry = this.#queue[i]
      const img = entry.image
      ctx.globalAlpha = entry.framesLeft / LOOT_POPUP_FRAMES
      ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, px, py, LOOT_ICON_SIZE, LOOT_ICON_SIZE)
      px += LOOT_ICON_SIZE + LOOT_ICON_GAP

      entry.framesLeft--
      if (entry.framesLeft <= 0) expired++
    }
    ctx.globalAlpha = 1

    // while (expired < this.#queue.length && this.#queue[expired].framesLeft <= 0) expired++

    if (expired > 0) {
      // on copie les éléments dans le tableau sans impact pour le GC
      const remaining = this.#queue.length - expired
      for (let i = 0; i < remaining; i++) {
        this.#queue[i] = this.#queue[i + expired]
      }
      this.#queue.length = remaining
    }
  }
}
export const lootPopupManager = new LootPopupManager()

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
class HotbarOverlay {
  #container = null // div#hotbar-overlay — racine injectée dans #hotbar
  #slots = new Array(HOTBAR_CAPACITY) // Array(8) — refs <inventory-slot>
  #activeIndex = -1 // index du slot actif (-1 = non initialisé)

  constructor () {
    this.#buildDOM()
    this.#bindEvents()
  }

  // ─── Construction DOM ────────────────────────────────────────

  /**
   * Construit le conteneur et les 8 slots <inventory-slot>, les injecte dans #hotbar.
   */
  #buildDOM () {
    this.#container = document.createElement('div')
    this.#container.id = 'hotbar-overlay'

    for (let i = 0; i < HOTBAR_CAPACITY; i++) {
      const slot = document.createElement('inventory-slot')
      slot.setAttribute('key', String(i + 1))
      slot.setAttribute('location', `hotbar|${i}`)
      slot.classList.add('hotbar', 'hb-slot')
      slot.dataset.index = i
      this.#container.appendChild(slot)
      this.#slots[i] = slot
    }

    document.getElementById('hotbar').appendChild(this.#container)
  }

  // ─── EventBus ────────────────────────────────────────────────

  /**
   * Abonne les handlers EventBus.
   */
  #bindEvents () {
    this.onHotbarChanged = this.onHotbarChanged.bind(this)
    this.onSlotUpdate = this.onSlotUpdate.bind(this)
    this.onSelectSlot = this.onSelectSlot.bind(this)
    eventBus.on('hotbar/changed', this.onHotbarChanged)
    eventBus.on('hotbar/slot-update', this.onSlotUpdate)
    eventBus.on('hotbar/select-slot', this.onSelectSlot)

    this.#container.addEventListener('click', this.#onClick.bind(this))
  }

  // ─── Handlers EventBus ───────────────────────────────────────

  /**
   * Rafraîchit tous les slots DOM depuis le tableau hotbar complet.
   * @param {Array} hotbar — contenu complet de la hotbar (8 slots)
   */
  onHotbarChanged (hotbar) {
    for (let i = 0; i < HOTBAR_CAPACITY; i++) {
      this.#updateSlotDOM(this.#slots[i], hotbar[i])
    }
  }

  /**
   * Met à jour un slot DOM individuel suite à une modification ponctuelle.
   * Ré-émet hotbar/slot-active si le slot modifié est le slot actif.
   * @param {{index: number, slot: object}} payload
   */
  onSlotUpdate ({index, slot}) {
    this.#updateSlotDOM(this.#slots[index], slot)
    if (index === this.#activeIndex) {
      eventBus.emit('hotbar/slot-active', {index, slot, prevIndex: index})
    }
  }

  /**
   * Sélectionne un slot via raccourci clavier (émis par KeyboardManager).
   * @param {number} index — 0-based
   */
  onSelectSlot (index) {
    this.#applyActiveSlot(index)
  }

  // ─── Handler DOM ─────────────────────────────────────────────

  /**
   * Gère le clic sur un slot. Sans effet si le slot cliqué est déjà actif.
   * @param {MouseEvent} e
   */
  #onClick (e) {
    const el = e.target.closest('inventory-slot')
    if (el === null) return
    const index = parseInt(el.dataset.index, 10)
    if (index === this.#activeIndex) return
    this.#applyActiveSlot(index)
  }

  // ─── Logique métier ──────────────────────────────────────────

  /**
   * Applique la sélection d'un slot : met à jour le rendu et émet hotbar/slot-active.
   * Sans effet si index identique au slot actif courant.
   * @param {number} index — 0-based
   */
  #applyActiveSlot (index) {
    if (index === this.#activeIndex) return
    const prevIndex = this.#activeIndex

    if (prevIndex !== -1) {
      this.#slots[prevIndex].classList.remove('active')
    }
    this.#slots[index].classList.add('active')
    this.#activeIndex = index

    const slot = inventoryManager.hotbar[index]
    if (slot === undefined) return

    eventBus.emit('hotbar/slot-active', {index, slot, prevIndex})
  }

  /**
   * Met à jour les attributs d'un <inventory-slot> DOM depuis un slot mémoire.
   * @param {HTMLElement} el
   * @param {object} slot
   */
  #updateSlotDOM (el, slot) {
    el.setAttribute('item', slot.item)
    el.setAttribute('count', slot.count)
    el.toggleAttribute('locked', slot.locked)
    el.setAttribute('title', this.#buildSlotTitle(slot))
  }

  /**
   * Construit le titre tooltip d'un slot hotbar.
   * @param {object} slot — slot mémoire
   * @returns {string}
   */
  #buildSlotTitle (slot) {
    if (slot.item === '') return 'Slot: Hotbar'
    const prefix = slot.prefix !== '' ? `${slot.prefix} ` : ''
    const count = slot.count > 1 ? `${slot.count} ` : ''
    return `Slot: Hotbar\n${count}${prefix}${ITEMS[slot.item].hoverTitle}`
  }

  // ─── API publique ─────────────────────────────────────────────

  /**
   * Initialise l'overlay au démarrage d'une session de jeu.
   * Sélectionne le slot 0.
   */
  init () {
    this.#activeIndex = -1
    this.#applyActiveSlot(0)
  }

  /** @returns {object} slot actif de la hotbar (item peut être '') */
  get activeSlot () { return inventoryManager.hotbar[this.#activeIndex] }
}
export const hotbarOverlay = new HotbarOverlay()
