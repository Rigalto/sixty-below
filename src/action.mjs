// action.mjs — miningManager

import {eventBus, taskScheduler, blockedTiles, rollLootWithBuffs} from './utils.mjs'
import {NODE_TYPE, NODES, ITEM_TYPE, ITEMS} from '../assets/data/data.mjs'
import {inventoryManager} from './inventory.mjs'
import {buffManager} from './buff.mjs'
import {chunkManager} from './world.mjs'
import {playerManager} from './player.mjs'
import {WORLD_WIDTH, MICROTASK} from './constant.mjs'

/* ====================================================================================================
   HELPERS COMMUNS A TOUS LES MANAGERS
   ==================================================================================================== */

/* ====================================================================================================
   GESTION DU MINAGE DE TUILES
   ==================================================================================================== */

class MiningManager {
  #queue = [] // [{tileIndex, tileNode, tool, prefix}] — tuiles en attente, dans l'ordre de demande

  constructor () {
    // eventBus
    this.onTeleportBegin = this.onTeleportBegin.bind(this)
    this.onSlotActive = this.onSlotActive.bind(this)
    eventBus.on('player/teleport-begin', this.onTeleportBegin)
    eventBus.on('hotbar/slot-active', this.onSlotActive)
    // Micro-tasks
    this.onMineTile = this.onMineTile.bind(this)
  }

  /**
   * Valide la demande et enfile la tuile. Lance la tâche si la file était vide.
   * @param {number} tileIndex — (y << 10) | x
   * @param {object} tileNode  — NODES_LOOKUP[tileCode]
   * @param {object} tool      — ITEMS[slot.item]
   * @param {string} prefix    — slot.prefix
   */
  tryMine (tileIndex, tileNode, tool, prefix) {
    console.log('MiningManager.tryMine', {tileIndex, tileNode, tool, prefix})
    if (tool.star < tileNode.star) return
    if (!(tileNode.type & (NODE_TYPE.SOLID | NODE_TYPE.WEB))) return
    if ((tileNode.type & NODE_TYPE.WALL)) return // Hammer
    if (!blockedTiles.canMine(tileIndex)) return // includes ETERNAL
    if (!this.#isInMiningRange(tileIndex, tool, prefix)) return
    if (buffManager.getBuff('player-freeze')) return

    const speed = this.#computeMineSpeed(tileNode, tool, prefix)

    const wasEmpty = this.#queue.length === 0
    this.#queue.push({tileIndex, tileNode, tool, prefix, speed})
    // TODO émettre un bruit spécifique à la pioche

    if (wasEmpty) {
      // TODO: début animation outil
      const {priority, capacity} = MICROTASK.MINE_TILE
      taskScheduler.enqueue('mine-current', speed, this.onMineTile, priority, capacity)
    }
  }

  /**
   * Calcule le délai de minage en ms pour une tuile et un outil donnés.
   * @param {object} tileNode — NODES_LOOKUP[tileCode]
   * @param {object} tool     — ITEMS[slot.item]
   * @returns {number} délai en ms
   */
  #computeMineSpeed (tileNode, tool, prefix) {
    let coefficient = 100 + tool.mining.speed + buffManager.getBuff('mining-speed')
    coefficient += prefix === 'Quick' ? 20 : 0
    coefficient += prefix === 'Keen' ? 5 : 0
    coefficient -= prefix === 'Sturdy' ? 5 : 0
    return Math.round((coefficient / 100) * tileNode.mining.speed)
  }

  /**
 * Vérifie que la tuile est dans le rectangle de minage relatif au centre du joueur.
 * @param {number} tileIndex — (y << 10) | x
 * @returns {boolean}
 */
  #isInMiningRange (tileIndex, tool, prefix) {
    const {x: cx, y: cy, direction} = playerManager.getCenterTile()
    const rect = buffManager.getBuff('mining-range')
    const range = tool.range + (prefix === 'Extended' ? 2 : 0)
    const ex = rect.x - range
    const ey = rect.y - range
    const ew = rect.w + 2 * range
    const eh = rect.h + 2 * range
    const tileX = tileIndex & 0x3FF
    const tileY = tileIndex >> 10
    const worldRectY = cy + ey
    const worldRectX = direction === 0 ? cx - ex - ew + 1 : cx + ex
    return tileX >= worldRectX && tileX < worldRectX + ew &&
         tileY >= worldRectY && tileY < worldRectY + eh
  }

  /**
 * Planifie le minage de la prochaine tuile en file, ou termine l'animation si la file est vide.
 */
  #scheduleNextTile () {
    if (this.#queue.length > 0) {
      const speed = this.#queue[0].speed
      // TODO: changement de vitesse animation (speed)
      const {priority, capacity} = MICROTASK.MINE_TILE
      taskScheduler.enqueue('mine-current', speed, this.onMineTile, priority, capacity)
    } else {
    // TODO: fin animation outil
    }
  }

  /**
   * Callback TaskScheduler : exécute le minage de la tuile en tête de file,
   * puis planifie la suivante si la file n'est pas vide.
   */
  onMineTile () {
    const VOID = NODES.VOID.code
    const SKY = NODES.SKY.code
    const entry = this.#queue.shift()
    if (entry === undefined) return // file vidée par une interruption entre-temps

    // La tuile a pu changer pendant le minage (sable, météorite, monster...)
    if (chunkManager.getTileAt(entry.tileIndex) !== entry.tileNode.code) {
      this.#scheduleNextTile()
      return
    }

    const tileAboveCode = chunkManager.getTileAt(entry.tileIndex - WORLD_WIDTH)
    const tileNewCode = (tileAboveCode === SKY || tileAboveCode === NODES.FOG.code) ? SKY : VOID
    // descente en remplaçant les VOID par des SKY
    if (tileNewCode === SKY) {
      let idx = entry.tileIndex + WORLD_WIDTH
      while (chunkManager.getTileAt(idx) === VOID) {
        chunkManager.setTileAt(idx, SKY)
        eventBus.emit('world/tile-changed', {tileIndex: idx, tileOldCode: VOID, tileNewCode: SKY})
        idx += WORLD_WIDTH
      }
    }

    // Propagation des SKY vers le bas.
    chunkManager.setTileAt(entry.tileIndex, tileNewCode)
    eventBus.emit('world/tile-changed', {tileIndex: entry.tileIndex, tileOldCode: entry.tileNode.code, tileNewCode})
    // loot
    const buffValues = buffManager.getBuffs(entry.tileNode.mining.buffList)
    for (const lootItem of entry.tileNode.mining.items) {
      const count = rollLootWithBuffs(lootItem, buffValues)
      if (count > 0) {
        const itemCode = lootItem.item.code
        inventoryManager.loot(itemCode, count, '')
        eventBus.emit('player/loot-item', {itemCode})
      }
    }

    this.#scheduleNextTile()
  }

  /**
   * Vide la file et annule la tâche planifiée.
   */
  #interrupt () {
    if (this.#queue.length === 0) return
    this.#queue.length = 0
    taskScheduler.dequeue('mine-current')
    // TODO: annuler animation outil
  }

  /** Liaison EventBus : 'player/teleport-begin'. */
  onTeleportBegin () { this.#interrupt() }

  /**
  * Liaison EventBus : 'hotbar/slot-active' — interrompt si le nouveau slot n'est plus une pickaxe.
  * @param {{slot: object}} payload
  */
  onSlotActive ({slot}) {
    if (slot.item && ITEMS[slot.item].type & ITEM_TYPE.TOOL && ITEMS[slot.item].stype === 'pickaxe') return
    this.#interrupt()
  }
}
export const miningManager = new MiningManager()

/* ====================================================================================================
   PLACEMENT DE BLOCS
   ==================================================================================================== */

/** Codes de tuiles acceptant le placement d'un bloc. */
const PLACING_NODES = new Set([
  NODES.SKY.code, NODES.VOID.code,
  NODES.SEA.code, NODES.WATER.code, NODES.HONEY.code, NODES.SAP.code
])

class PlacingManager {
  /**
   * Valide la demande de placement et l'exécute si les conditions sont réunies.
   * Seul point d'entrée pour le placement de blocs depuis core.mjs.
   * @param {number} tileIndex — (y << 10) | x
   * @param {object} tileNode  — NODES_LOOKUP[tileCode]
   * @param {object} item      — ITEMS[slot.item]
   */
  tryPlace (tileIndex, tileNode, item) {
    if (!PLACING_NODES.has(tileNode.code)) return
    console.log('PlacingManager.tryPlace', {tileIndex, tileNode, item})
    // validations à venir : range, player-freeze, blockedTiles...
  }
}
export const placingManager = new PlacingManager()
