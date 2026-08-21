// liquid.mjs — SandFallingSystem

import {WORLD_WIDTH, MICROTASK} from './constant.mjs'
import {eventBus, seededRNG, microTasker, taskScheduler} from './utils.mjs'
import {NODES} from '../assets/data/data.mjs'
import {chunkManager} from './world.mjs'
import {database} from './database.mjs'

/* ====================================================================================================
   SAND FALLING SYSTEM
   ====================================================================================================

   Singleton : sandFallingSystem.

   Simule la chute du SAND instable (vide en dessous, ou vide en diagonale bas-gauche/bas-droite).
   Aucun record 'plant' — uniquement un Set d'index de tuiles candidates, persisté en gamestate.
   Alimentation réactive over-inclusive sur 'world/tile-changed' (faux positifs tolérés, filtrés
   au traitement périodique). Traitement en deux micro-tâches distinctes : détermination pure
   (aucune écriture monde) puis application en bloc (tous les setTileAt avant tout emit), pour
   respecter la cohérence attendue par les listeners synchrones.

   Aucune vérification blockedTiles : le sable écrase tout meuble/plante sur son passage — la
   suppression du record concerné est déléguée au listener 'world/tile-changed' propre à chaque
   système existant, pas à SandFallingSystem.

   ==================================================================================================== */

const SAND_FALLING_TICK_MS = NODES.SAND.viscosity // fréquence du traitement périodique tant que #pending n'est pas vide
const SAND_FALLING_WARN_THRESHOLD = 100 // simple avertissement si #pending dépasse cette taille

const SAND_FALLING_EMPTY_CODES = new Set([NODES.SKY.code, NODES.VOID.code, NODES.WATER.code, NODES.SEA.code, NODES.SAP.code, NODES.HONEY.code])
const SAND_FALLING_TRIGGER_CODES = new Set([...SAND_FALLING_EMPTY_CODES, NODES.SAND.code])

class SandFallingSystem {
  #pending = new Set() // Set<tileIndex> — tuiles SAND candidates à tester (faux positifs tolérés)
  #dirty = false // true si #pending a changé depuis la dernière écriture gamestate

  constructor () {
    this.onTileChangedSand = this.onTileChangedSand.bind(this)
    eventBus.on('world/tile-changed', this.onTileChangedSand)
    this.onFirstLoopSand = this.onFirstLoopSand.bind(this)
    eventBus.on('time/first-loop', this.onFirstLoopSand)
    this.onSaveTick = this.onSaveTick.bind(this)
    eventBus.on('save/tick', this.onSaveTick)
    this.sandFallingTick = this.sandFallingTick.bind(this)
    this.applySandFallingMoves = this.applySandFallingMoves.bind(this)
  }

  /**
   * Réinitialise #pending depuis gamestate. Appelé en début de session.
   * @param {number[]} pendingTiles — persisté (gamestate.sandfallingtiles), [] si absent
   */
  init (pendingTiles = []) {
    this.#pending.clear()
    for (const tileIndex of pendingTiles) this.#pending.add(tileIndex)
    this.#dirty = false
  }

  /**
   * Liaison EventBus : 'time/first-loop' — réarme la boucle périodique si des candidats
   * ont survécu au rechargement.
   */
  onFirstLoopSand () {
    if (this.#pending.size === 0) return
    const {priority, capacity} = MICROTASK.SAND_FALLING_TICK
    taskScheduler.enqueueOnce('sand-falling-tick', SAND_FALLING_TICK_MS, this.sandFallingTick, priority, capacity)
  }

  /**
   * Liaison EventBus : 'save/tick' — persiste #pending en gamestate (clé 'sandfallingtiles')
   * uniquement s'il a changé depuis la dernière écriture.
   */
  onSaveTick () {
    if (!this.#dirty) return
    database.setGameState('sandfallingtiles', [...this.#pending])
    this.#dirty = false
  }

  /**
   * Liaison EventBus : 'world/tile-changed'. Alimentation over-inclusive et volontairement
   * peu coûteuse : ajoute la tuile elle-même si elle devient SAND, ou les 5 tuiles pouvant
   * l'avoir comme voisin bas/bas-gauche/bas-droite (dessus, gauche, droite, dessus-gauche,
   * dessus-droite) si elle devient vide. Les faux positifs sont filtrés au traitement
   * périodique. Réarme la boucle (enqueueOnce, no-op si déjà active).
   * @param {{tileIndex: number, tileNewCode: number}} payload
   */
  onTileChangedSand ({tileIndex, tileNewCode}) {
    if (!SAND_FALLING_TRIGGER_CODES.has(tileNewCode)) return

    const W = WORLD_WIDTH
    this.#pending.add(tileIndex)
    if (tileNewCode !== NODES.SAND.code) {
      this.#pending.add(tileIndex - W)
      this.#pending.add(tileIndex - W - 1)
      this.#pending.add(tileIndex - W + 1)
      this.#pending.add(tileIndex - 1)
      this.#pending.add(tileIndex + 1)
    }
    this.#dirty = true

    const {priority, capacity} = MICROTASK.SAND_FALLING_TICK
    taskScheduler.enqueueOnce('sand-falling-tick', SAND_FALLING_TICK_MS, this.sandFallingTick, priority, capacity)
  }

  /**
   * Callback TaskScheduler (exécuté via MicroTasker) : détermination pure, sans écriture
   * monde. Reconstruit entièrement #pending — chaque tuile SAND encore valide est testée
   * (verticale puis diagonale aléatoire si les deux sont possibles) ; les tuiles stables ou
   * qui ne sont plus SAND sont abandonnées. Un Set 'claimed' évite que deux sources visent
   * la même destination dans ce passage ; le perdant est conservé dans le nouveau Set pour
   * retenter au prochain tick. Délègue l'écriture monde à applySandFallingMoves en
   * micro-tâche séparée. Réarme la boucle si le nouveau Set n'est pas vide.
   */
  sandFallingTick () {
    if (this.#pending.size > SAND_FALLING_WARN_THRESHOLD) {
      console.warn(`SandFallingSystem.sandFallingTick: #pending contient ${this.#pending.size} tuiles`)
    }

    const SAND = NODES.SAND.code
    const newPending = new Set()
    const claimed = new Set()
    const moves = []

    for (const tileIndex of this.#pending) {
      if (chunkManager.getTileAt(tileIndex) !== SAND) continue

      const destination = this.#resolveFallTarget(tileIndex, claimed)
      if (destination === -1) continue // stable
      if (destination === -2) { newPending.add(tileIndex); continue } // destination prise ce tick

      claimed.add(destination)
      moves.push({from: tileIndex, to: destination})
    }

    this.#pending = newPending
    this.#dirty = true

    if (moves.length > 0) {
      const {priority, capacity} = MICROTASK.SAND_FALLING_APPLY
      microTasker.enqueue(this.applySandFallingMoves, priority, capacity, moves)
    }

    if (this.#pending.size > 0) {
      const {priority, capacity} = MICROTASK.SAND_FALLING_TICK
      taskScheduler.enqueueOnce('sand-falling-tick', SAND_FALLING_TICK_MS, this.sandFallingTick, priority, capacity)
    }
  }

  /**
   * Détermine la destination de chute d'une tuile SAND à partir de l'état courant du monde
   * (jamais du Set 'claimed', qui ne sert qu'à départager deux sources concurrentes) : d'abord
   * verticale, puis diagonale (choix aléatoire si les deux côtés sont possibles).
   * @param {number} tileIndex
   * @param {Set<number>} claimed — destinations déjà réservées dans ce passage
   * @returns {number} index de destination, -1 si stable, -2 si bloquée par une autre tuile ce tick
   */
  #resolveFallTarget (tileIndex, claimed) {
    const W = WORLD_WIDTH
    const below = tileIndex + W

    if (SAND_FALLING_EMPTY_CODES.has(chunkManager.getTileAt(below))) {
      return claimed.has(below) ? -2 : below
    }

    const x = tileIndex & 0x3FF
    const canLeft = x > 0 && SAND_FALLING_EMPTY_CODES.has(chunkManager.getTileAt(tileIndex - 1)) && SAND_FALLING_EMPTY_CODES.has(chunkManager.getTileAt(below - 1))
    const canRight = x < W - 1 && SAND_FALLING_EMPTY_CODES.has(chunkManager.getTileAt(tileIndex + 1)) && SAND_FALLING_EMPTY_CODES.has(chunkManager.getTileAt(below + 1))
    if (!canLeft && !canRight) return -1

    const destination = (canLeft && (!canRight || seededRNG.randomGetBool())) ? below - 1 : below + 1
    return claimed.has(destination) ? -2 : destination
  }

  /**
   * Exécuté en micro-tâche séparée (MICROTASK.SAND_FALLING_APPLY). Applique tous les
   * déplacements en bloc : swap complet entre la source (hérite du code qui occupait la
   * destination) et la destination (devient SAND), tous les setTileAt() avant tout emit pour
   * garantir un monde cohérent aux listeners synchrones (dont onTileChangedSand lui-même, qui
   * repeuple #pending pour les tuiles concernées). Aucune vérification blockedTiles : un
   * meuble/plante sur la destination est détruit, son propre listener s'en charge.
   * @param {Array<{from: number, to: number}>} moves
   */
  applySandFallingMoves (moves) {
    const SAND = NODES.SAND.code
    const VOID = NODES.VOID.code
    const SKY = NODES.SKY.code
    const FOG = NODES.FOG.code
    const W = WORLD_WIDTH

    const changes = []

    for (const move of moves) {
      const destinationOldCode = chunkManager.getTileAt(move.to)
      let sourceNewCode = destinationOldCode
      if (sourceNewCode === VOID) {
        const aboveCode = chunkManager.getTileAt(move.from - W)
        sourceNewCode = (aboveCode === SKY || aboveCode === FOG) ? SKY : VOID
      }

      chunkManager.setTileAt(move.from, sourceNewCode)
      chunkManager.setTileAt(move.to, SAND)

      changes.push({tileIndex: move.from, tileOldCode: SAND, tileNewCode: sourceNewCode})
      changes.push({tileIndex: move.to, tileOldCode: destinationOldCode, tileNewCode: SAND})
    }

    for (const change of changes) eventBus.emit('world/tile-changed', change)
  }
}
export const sandFallingSystem = new SandFallingSystem()
