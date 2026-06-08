// action.mjs — miningManager

import {eventBus, taskScheduler, blockedTiles, rollLootWithBuffs} from './utils.mjs'
import {NODE_TYPE, NODES, ITEM_TYPE, ITEMS} from '../assets/data/data.mjs'
import {inventoryManager} from './inventory.mjs'
import {buffManager} from './buff.mjs'
import {chunkManager} from './world.mjs'
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
    if (!(tileNode.type & NODE_TYPE.SOLID)) return
    if (!blockedTiles.canMine(tileIndex)) return
    if (buffManager.getBuff('player-freeze')) return
    if (tileNode.type & NODE_TYPE.ETERNAL) return
    // TODO: test range (playerManager.getFeetTile() vs tileIndex, buff 'mining-range')

    const wasEmpty = this.#queue.length === 0
    this.#queue.push({tileIndex, tileNode, tool, prefix, speed: 2000})
    // TODO émettre un bruit spécifique à la pioche

    if (wasEmpty) {
      // TODO: début animation outil
      const {priority, capacity} = MICROTASK.MINE_TILE
      taskScheduler.enqueue('mine-current', 2000, this.onMineTile, priority, capacity)
    }
  }

  /**
 * Planifie le minage de la prochaine tuile en file, ou termine l'animation si la file est vide.
 */
  #scheduleNextTile () {
    if (this.#queue.length > 0) {
    // TODO: changement de vitesse animation
      const {priority, capacity} = MICROTASK.MINE_TILE
      taskScheduler.enqueue('mine-current', this.#queue[0].speed, this.onMineTile, priority, capacity)
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

    // TODO : propagation des SKY vers le bas
    chunkManager.setTileAt(entry.tileIndex, tileNewCode)
    eventBus.emit('world/tile-changed', {tileIndex: entry.tileIndex, tileOldCode: entry.tileNode.code, tileNewCode})
    // loot
    if (entry.tileNode.mining) { // TODO supprimer quand tous les node auront un 'mining'
      const buffValues = buffManager.getBuffs(entry.tileNode.mining.buffList)
      for (const lootItem of entry.tileNode.mining.items) {
        const count = rollLootWithBuffs(lootItem, buffValues)
        if (count > 0) {
          const itemCode = lootItem.item.code
          inventoryManager.loot(itemCode, count, '')
          eventBus.emit('player/loot-item', {itemCode})
        }
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
