// player.mjs — PlayerManager - LifeManager - HotbarOverlay

import {WORLD_WIDTH, WORLD_HEIGHT, PLAYER, MICROTASK, TELEPORT_FADE_MS, TELEPORT_WAIT_MS, HOTBAR_CAPACITY} from './constant.mjs'
import {eventBus, taskScheduler} from './utils.mjs'
import {buffManager} from './buff.mjs'
import {inventoryManager} from './inventory.mjs'
import {camera} from './render.mjs'

import {ITEMS} from '../../assets/data/data.mjs'

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
   COLLISION — HELPERS INTERNES
   ──────────────────────────────────────────────────────────────────────────────────────────
   Lecture via chunkManager.getTileAt(index) + NODES_LOOKUP[code].solid.
   Zéro allocation dans les helpers : boucles sur entiers, pas de tableau temporaire.

     #isSolid(tx, ty)       → boolean — true si la tuile (tx, ty) est solide
     #checkBottom(nx, ny)   → boolean — tuile solide sous les pieds à la position candidate
     #checkTop(nx, ny)      → boolean — collision plafond
     #checkLeft(nx, ny)     → boolean — collision mur gauche
     #checkRight(nx, ny)    → boolean — collision mur droit
     #resolveHorizontal(dx) → number  — applique Δx, gère step-up + blocage, retourne Δx réel
     #resolveVertical(dy)   → number  — applique Δy, gère sol + plafond, retourne Δy réel
   ==================================================================================================== */

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
   * Déplace le joueur selon le bitmask directions. Sans collision (phase affichage).
   * directions : UP=1, DOWN=2, LEFT=4, RIGHT=8 (cf. MOVEMENT_MAP dans core.mjs)
   * Provisoire
   * @param {number} dt         - delta temps en ms
   * @param {number} directions - bitmask clavier
   */
  updateDebug (dt, directions) {
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

    eventBus.emit('hotbar/slot-active', {
      index,
      slot: inventoryManager.hotbar[index],
      prevIndex
    })
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
}
export const hotbarOverlay = new HotbarOverlay()
