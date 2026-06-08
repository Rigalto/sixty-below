// action.mjs — miningManager

import {eventBus, taskScheduler, blockedTiles} from './utils.mjs'
import {NODE_TYPE, NODES, ITEM_TYPE, ITEMS} from '../assets/data/data.mjs'
import {buffManager} from './buff.mjs'
import {chunkManager} from './world.mjs'
import {MICROTASK} from './constant.mjs'

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

    // for (const entry of this.#queue) {
    //   if (entry.tileIndex === tileIndex) return // déjà en file
    // }

    const wasEmpty = this.#queue.length === 0
    this.#queue.push({tileIndex, tileNode, tool, prefix, speed: 2000})

    if (wasEmpty) {
      // TODO: début animation outil
      const {priority, capacity} = MICROTASK.MINE_TILE
      taskScheduler.enqueue('mine-current', 2000, this.onMineTile, priority, capacity)
    }
  }

  /**
   * Callback TaskScheduler : exécute le minage de la tuile en tête de file,
   * puis planifie la suivante si la file n'est pas vide.
   */
  onMineTile () {
    const entry = this.#queue.shift()
    if (entry === undefined) return // file vidée par une interruption entre-temps

    // La tuile a pu changer pendant le minage (sable, météorite, monster...)
    if (chunkManager.getTileAt(entry.tileIndex) !== entry.tileNode.code) {
      if (this.#queue.length > 0) {
        // TODO: changement de vitesse animation
        const {priority, capacity} = MICROTASK.MINE_TILE
        taskScheduler.enqueue('mine-current', this.#queue[0].speed, this.onMineTile, priority, capacity)
      } else {
      // TODO: fin animation outil
      }
      return
    }

    const x = entry.tileIndex & 0x3FF
    const y = entry.tileIndex >> 10

    const tileNewCode = NODES.VOID.code
    // TODO: SKY si tuile en surface
    // TODO : propagation des SKY vers le bas
    chunkManager.setTile(x, y, tileNewCode)
    eventBus.emit('world/tile-changed', {tileIndex: entry.tileIndex, tileOldCode: entry.tileNode.code, tileNewCode})
    // TODO: loot : entry.tileNode.mining.items → inventoryManager.loot

    if (this.#queue.length > 0) {
      // TODO: changement de vitesse animation
      const {priority, capacity} = MICROTASK.MINE_TILE
      taskScheduler.enqueue('mine-current', this.#queue[0].speed, this.onMineTile, priority, capacity)
    } else {
      // TODO: fin animation outil
    }
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
