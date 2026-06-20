// action.mjs — MiningManager - PlacingManager - ForagingManager - ChoppingManager

import {eventBus, taskScheduler, microTasker, blockedTiles, rollLootWithBuffs} from './utils.mjs'
import {NODE_TYPE, NODES, ITEM_TYPE, ITEMS, PLANT_SYSTEM_LOOKUP, PLANT_KIND} from '../assets/data/data.mjs'
import {inventoryManager} from './inventory.mjs'
import {buffManager} from './buff.mjs'
import {database} from './database.mjs'
import {chunkManager} from './world.mjs'
import {playerManager} from './player.mjs'
import {WORLD_WIDTH, MICROTASK} from './constant.mjs'
import {floraManager} from './ecosystem.mjs'

/* ====================================================================================================
   HELPERS COMMUNS A TOUS LES MANAGERS
   ==================================================================================================== */

/**
 * Retire en place, de `queue`, toutes les entrées dont `entry[key] === value`. Compaction
 * stable (préserve l'ordre des entrées restantes) — nécessaire pour une file FIFO pouvant
 * mélanger des entrées ciblant des objets différents (ex : plusieurs arbres en attente).
 * @param {Array<object>} queue — tableau d'entrées, muté en place
 * @param {string} key — propriété à comparer sur chaque entrée
 * @param {*} value — valeur de référence à retirer
 */
const purgeQueueByKey = (queue, key, value) => {
  let w = 0
  for (let r = 0; r < queue.length; r++) {
    if (queue[r][key] !== value) queue[w++] = queue[r]
  }
  queue.length = w
}

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
    if (buffManager.getBuff('playerFreeze')) return
    if (!(tileNode.type & (NODE_TYPE.SOLID | NODE_TYPE.WEB))) return
    if ((tileNode.type & NODE_TYPE.WALL)) return // Hammer
    console.log('MiningManager.tryMine', {tileIndex, tileNode, tool, prefix})
    if (!this.#isInMiningRange(tileIndex, tool, prefix)) { eventBus.emit('sound/play', 'toofar'); return }
    if (tool.star < tileNode.star) { eventBus.emit('sound/play', 'wrong'); return }
    if (!blockedTiles.canMine(tileIndex)) { eventBus.emit('sound/play', 'wrong'); return } // includes ETERNAL

    const speed = this.#computeMineSpeed(tileNode, tool, prefix)

    const wasEmpty = this.#queue.length === 0
    this.#queue.push({tileIndex, tileNode, tool, prefix, speed})
    // TODO émettre un bruit spécifique à la pioche
    eventBus.emit('sound/play', 'mining')

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
  #scheduleNext () {
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
      this.#scheduleNext()
      return
    }

    const tileAboveCode = chunkManager.getTileAt(entry.tileIndex - WORLD_WIDTH)
    const keep = entry.tileNode.mining.keep

    const tileNewCode = keep
      ? keep.code
      : (tileAboveCode === SKY || tileAboveCode === NODES.FOG.code) ? SKY : VOID

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

    this.#scheduleNext()
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
  constructor () {
    // micro-tâches
    this.onPlaceTile = this.onPlaceTile.bind(this)
  }

  /**
   * Valide la demande de placement et l'exécute si les conditions sont réunies.
   * Seul point d'entrée pour le placement de blocs depuis core.mjs.
   * @param {number} tileIndex — (y << 10) | x
   * @param {object} tileNode  — NODES_LOOKUP[tileCode]
   * @param {object} item      — ITEMS[slot.item]
   */
  tryPlace (tileIndex, tileNode, item, slotIndex) {
    if (buffManager.getBuff('playerFreeze')) return
    if (!PLACING_NODES.has(tileNode.code)) return
    console.log('PlacingManager.tryPlace', {tileIndex, tileNode, item})
    if (!blockedTiles.canPlace(tileIndex)) { eventBus.emit('sound/play', 'toofar'); return }
    if (!this.#isInPlacingRange(tileIndex)) { eventBus.emit('sound/play', 'wrong'); return }
    const {priority, capacity} = MICROTASK.PLACE_TILE
    microTasker.enqueue(this.onPlaceTile, priority, capacity, tileIndex, item, slotIndex)
  }

  /**
   * Vérifie que la tuile est dans le rectangle d'interaction du joueur.
   * Utilise mining-range sans expansion outil (les blocs n'ont pas de stat range).
   * @param {number} tileIndex — (y << 10) | x
   * @returns {boolean}
   */
  #isInPlacingRange (tileIndex) {
    const {x: cx, y: cy, direction} = playerManager.getCenterTile()
    const rect = buffManager.getBuff('mining-range')
    const tileX = tileIndex & 0x3FF
    const tileY = tileIndex >> 10
    const worldRectX = direction === 0 ? cx - rect.x - rect.w + 1 : cx + rect.x
    return tileX >= worldRectX && tileX < worldRectX + rect.w &&
         tileY >= cy + rect.y && tileY < cy + rect.y + rect.h
  }

  /**
   * Callback MicroTasker : exécute la pose du bloc.
   * Re-vérifie la tuile cible — elle a pu changer entre tryPlace et l'exécution.
   * @param {number} tileIndex
   * @param {object} item
   */
  onPlaceTile (tileIndex, item, slotIndex) {
    const VOID = NODES.VOID.code
    const SKY = NODES.SKY.code

    const tileOldCode = chunkManager.getTileAt(tileIndex)
    if (!PLACING_NODES.has(tileOldCode)) return
    if (!blockedTiles.canPlace(tileIndex)) return
    console.log('PlacingManager.onPlaceTile', {tileIndex, item})

    // placement de la tuile
    const tileNewCode = item.placedNode.code
    chunkManager.setTileAt(tileIndex, tileNewCode)

    // consommer inventaire
    inventoryManager.decrementHotbarSlotCount(slotIndex)

    // on effectue les traitements induits
    eventBus.emit('world/tile-changed', {tileIndex, tileOldCode, tileNewCode})
    eventBus.emit('sound/play', 'placing')

    // propagation SKY→VOID vers le bas : les SKY sous le bloc posé perdent leur connexion au ciel
    if (tileOldCode === SKY) {
      let idx = tileIndex + WORLD_WIDTH
      while (chunkManager.getTileAt(idx) === SKY) {
        chunkManager.setTileAt(idx, VOID)
        eventBus.emit('world/tile-changed', {tileIndex: idx, tileOldCode: SKY, tileNewCode: VOID})
        idx += WORLD_WIDTH
      }
    }
  }
}
export const placingManager = new PlacingManager()

/* ====================================================================================================
   FORAGING DE PLANTES
   ==================================================================================================== */

const NATURAL_FORAGE_DAILY_LIMIT = 12

class ForagingManager {
  #queue = [] // {type:'natural', tileIndex, tileNode, tool, prefix} | {type:'plant', plant, tileIndex, tool, prefix}
  #foragedToday = new Set() // Set<tileIndex> — max NATURAL_FORAGE_DAILY_LIMIT par jour

  constructor () {
    // eventBus
    this.onTeleportBegin = this.onTeleportBegin.bind(this)
    this.onSlotActive = this.onSlotActive.bind(this)
    this.onDayStart = this.onDayStart.bind(this)
    eventBus.on('player/teleport-begin', this.onTeleportBegin)
    eventBus.on('hotbar/slot-active', this.onSlotActive)
    eventBus.on('time/daily', this.onDayStart)

    // Micro-Tasks
    this.onForage = this.onForage.bind(this)
  }

  /**
   * Restaure la liste des tuiles NATURAL déjà foragée pendant le jour courant
   * @param {Set} savedSet — index des tuiles foragées
   */
  init (savedSet) {
    this.#foragedToday = savedSet ?? new Set()
  }

  /**
   * Liaison EventBus : 'time/daily'.
   * Vide la liste des tuiles NATURAL déjà foragée
   */
  onDayStart () {
    this.#foragedToday.clear()
    database.setGameState('naturalforaged', this.#foragedToday)
  }

  /**
   * Valide la demande et déclenche la micro-tâche de foraging appropriée.
   * Deux branches : tuile NATURAL ou tuile SKY/VOID avec plante sous la souris.
   * @param {number} tileIndex — (y << 10) | x
   * @param {object} tileNode  — NODES_LOOKUP[tileCode]
   * @param {object} tool      — ITEMS[slot.item]
   * @param {string} prefix    — slot.prefix
   */
  tryForage (tileIndex, tileNode, tool, prefix) {
    if (buffManager.getBuff('playerFreeze')) return

    // 1. Tuile NATURAL (forage du sol)
    if (tileNode.type & NODE_TYPE.NATURAL) {
      if (!this.#isInForagingRange(tileIndex, tool, prefix)) { eventBus.emit('sound/play', 'toofar'); return }
      if (tool.star < tileNode.star) { eventBus.emit('sound/play', 'wrong'); return }
      if (this.#foragedToday.size >= NATURAL_FORAGE_DAILY_LIMIT) { eventBus.emit('sound/play', 'wrong'); return }
      if (this.#foragedToday.has(tileIndex)) { eventBus.emit('sound/play', 'wrong'); return }

      this.#foragedToday.add(tileIndex)
      database.setGameState('naturalforaged', this.#foragedToday)

      const speed = this.#computeForageSpeedNatural(tileNode, tool, prefix)
      const wasEmpty = this.#queue.length === 0
      this.#queue.push({type: 'natural', tileIndex, tileNode, tool, prefix, speed})
      eventBus.emit('sound/play', 'foraging')

      if (wasEmpty) {
        // TODO: début animation outil (sickle)
        this.#scheduleNext()
      }
      return
    }

    // 2. Tuile SKY/VOID — chercher une plante sous la souris.
    if (tileNode.code !== NODES.SKY.code && tileNode.code !== NODES.VOID.code) return
    const plant = floraManager.getPlantAt(tileIndex)
    if (plant === null) return
    const plantItem = ITEMS[plant.itemId]
    if (!plantItem.foraging) return

    for (const entry of this.#queue) {
      if (entry.type === 'plant' && entry.plant === plant) return
    }

    if (!this.#isInForagingRange(tileIndex, tool, prefix)) { eventBus.emit('sound/play', 'toofar'); return }
    if (tool.star < plantItem.star) { eventBus.emit('sound/play', 'wrong'); return }
    const speed = this.#computeForageSpeedPlant(plant, tool, prefix)

    const wasEmpty = this.#queue.length === 0
    this.#queue.push({type: 'plant', plant, tileIndex, tool, prefix, speed})
    eventBus.emit('sound/play', 'foraging')

    if (wasEmpty) {
      // TODO: début animation outil (sickle)
      this.#scheduleNext()
    }
  }

  /**
   * Calcule le délai de foraging en ms pour le foraging des tuiles
   * TODO: implémenter la formule complète (tool.foraging.speed + buff foraging-speed + prefix)
   * @returns {number} délai en ms
   */
  #computeForageSpeedNatural (tileNode, tool, prefix) {
    let coefficient = 100 + tool.foraging.speed + buffManager.getBuff('foraging-speed')
    coefficient += prefix === 'Quick' ? 20 : 0
    coefficient += prefix === 'Keen' ? 5 : 0
    coefficient -= prefix === 'Sturdy' ? 5 : 0
    return Math.round((coefficient / 100) * tileNode.foraging.speed)
  }

  /**
 * Calcule le délai de foraging d'une plante, en ms.
 * @param {object} plant — record de la plante (utilise plant.itemId)
 * @param {object} tool — ITEMS[slot.item], outil sickle
 * @param {string} prefix — préfixe de l'outil (Quick/Keen/Sturdy)
 * @returns {number} délai en ms
 */
  #computeForageSpeedPlant (plant, tool, prefix) {
    let coefficient = 100 + tool.foraging.speed + buffManager.getBuff('foraging-speed')
    coefficient += prefix === 'Quick' ? 20 : 0
    coefficient += prefix === 'Keen' ? 5 : 0
    coefficient -= prefix === 'Sturdy' ? 5 : 0
    return Math.round((coefficient / 100) * ITEMS[plant.itemId].foraging.speed)
  }

  /**
   * Vérifie que la tuile est dans le rectangle de foraging relatif au centre du joueur.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {boolean}
   */
  #isInForagingRange (tileIndex, tool, prefix) {
    const {x: cx, y: cy, direction} = playerManager.getCenterTile()
    const rect = buffManager.getBuff('foraging-range')
    const range = tool.range + (prefix === 'Extended' ? 2 : 0)
    const ex = rect.x - range
    const ey = rect.y - range
    const ew = rect.w + 2 * range
    const eh = rect.h + 2 * range
    const tileX = tileIndex & 0x3FF
    const tileY = tileIndex >> 10
    const worldRectX = direction === 0 ? cx - ex - ew + 1 : cx + ex
    const worldRectY = cy + ey
    return tileX >= worldRectX && tileX < worldRectX + ew &&
           tileY >= worldRectY && tileY < worldRectY + eh
  }

  /**
   * Planifie le prochain foraging depuis le front de file.
   */
  #scheduleNext () {
    if (this.#queue.length > 0) {
    // TODO: changement de vitesse animation (speed)
      const {priority, capacity} = MICROTASK.FORAGE_ACTION
      taskScheduler.enqueue('forage-current', this.#queue[0].speed, this.onForage, priority, capacity)
    } else {
    // TODO: fin animation outil (sickle)
    }
  }

  /**
   * Callback TaskScheduler : traite l'entrée en tête de file (natural ou plant).
   */
  onForage () {
    const entry = this.#queue.shift()
    if (entry === undefined) return

    if (entry.type === 'natural') {
      if (chunkManager.getTileAt(entry.tileIndex) !== entry.tileNode.code) {
        this.#scheduleNext()
        return
      }

      const buffValues = buffManager.getBuffs(entry.tileNode.foraging.buffList)
      for (const lootItem of entry.tileNode.foraging.items) {
        const count = rollLootWithBuffs(lootItem, buffValues)
        if (count > 0) {
          const itemCode = lootItem.item.code
          inventoryManager.loot(itemCode, count, '')
          eventBus.emit('player/loot-item', {itemCode})
        }
      }

      console.log('ForagingManager.onForage — natural', entry)
    } else {
      const plant = entry.plant
      const system = PLANT_SYSTEM_LOOKUP.get(plant.kind * 100 + plant.type)
      if (!system.isPresent(plant)) {
        this.#scheduleNext()
        return
      }
      const plantItem = ITEMS[plant.itemId]
      const buffValues = buffManager.getBuffs(plantItem.foraging.buffList)
      for (const lootItem of plantItem.foraging.items) {
        const count = rollLootWithBuffs(lootItem, buffValues)
        if (count > 0) {
          const itemCode = lootItem.item.code
          inventoryManager.loot(itemCode, count, '')
          eventBus.emit('player/loot-item', {itemCode})
        }
      }
      system.onForaged(plant)
      console.log('ForagingManager.onForage — plant', entry)
    }

    this.#scheduleNext()
  }

  /** Annule toute tâche de foraging en attente. */
  #interrupt () {
    if (this.#queue.length === 0) return
    this.#queue.length = 0
    taskScheduler.dequeue('forage-current')
    // TODO: annuler animation outil (sickle)
  }

  /** Liaison EventBus : 'player/teleport-begin'. */
  onTeleportBegin () { this.#interrupt() }

  /**
   * Liaison EventBus : 'hotbar/slot-active' — interrompt si le nouveau slot n'est plus une sickle.
   * @param {{slot: object}} payload
   */
  onSlotActive ({slot}) {
    if (slot.item && ITEMS[slot.item].type & ITEM_TYPE.TOOL && ITEMS[slot.item].stype === 'sickle') return
    this.#interrupt()
  }
}
export const foragingManager = new ForagingManager()

/* ====================================================================================================
   ABATTAGE D'ARBRES
   ==================================================================================================== */

class ChoppingManager {
  #queue = [] // [{plant, tool, prefix, speed}] — arbres en attente, dans l'ordre de demande

  constructor () {
    // EventBus
    this.onTeleportBegin = this.onTeleportBegin.bind(this)
    this.onSlotActive = this.onSlotActive.bind(this)
    eventBus.on('player/teleport-begin', this.onTeleportBegin)
    eventBus.on('hotbar/slot-active', this.onSlotActive)
    // Micro-tâche
    this.onChopTree = this.onChopTree.bind(this)
  }

  /**
   * Valide la demande et enfile l'arbre. Lance la tâche si la file était vide.
   * Point d'entrée unique depuis core.mjs (#processWorldClick).
   * @param {number} tileIndex — (y << 10) | x, tuile cliquée
   * @param {object} tileNode  — NODES_LOOKUP[tileCode] (non utilisé directement : la cible est une plante)
   * @param {object} tool      — ITEMS[slot.item], hache équipée
   * @param {string} prefix    — slot.prefix
   */
  tryChop (tileIndex, tileNode, tool, prefix) {
    if (buffManager.getBuff('playerFreeze')) return

    const plant = floraManager.getPlantAt(tileIndex)
    if (plant === null || plant.kind !== PLANT_KIND.TREE) return

    const plantItem = ITEMS[plant.itemId]
    if (!this.#isInChoppingRange(tileIndex, tool, prefix)) { eventBus.emit('sound/play', 'toofar'); return }
    if (tool.star < plantItem.star) { eventBus.emit('sound/play', 'wrong'); return }

    const speed = this.#computeChopSpeed(plantItem, tool, prefix)

    const wasEmpty = this.#queue.length === 0
    this.#queue.push({plant, tool, prefix, speed})
    eventBus.emit('sound/play', 'chopping')

    if (wasEmpty) {
      const {priority, capacity} = MICROTASK.CHOP_TREE
      taskScheduler.enqueue('chop-current', speed, this.onChopTree, priority, capacity)
    }
  }

  /**
   * Calcule le délai d'abattage en ms pour un arbre et un outil donnés.
   * @param {object} plantItem — ITEMS[plant.itemId], porte plantItem.chopping.speed
   * @param {object} tool      — hache équipée
   * @param {string} prefix    — préfixe de l'outil
   * @returns {number} délai en ms
   */
  #computeChopSpeed (plantItem, tool, prefix) {
    let coefficient = 100 + tool.chopping.speed + buffManager.getBuff('chopping-speed')
    coefficient += prefix === 'Quick' ? 20 : 0
    coefficient += prefix === 'Keen' ? 5 : 0
    coefficient -= prefix === 'Sturdy' ? 5 : 0
    return (plantItem.chopping.speed * coefficient / 100) | 0
  }

  /**
   * Vérifie que la tuile cliquée est dans le rectangle de chopping relatif au centre du joueur.
   * @param {number} tileIndex — (y << 10) | x
   * @param {object} tool      — hache équipée
   * @param {string} prefix    — préfixe de l'outil
   * @returns {boolean}
   */
  #isInChoppingRange (tileIndex, tool, prefix) {
    const {x: cx, y: cy, direction} = playerManager.getCenterTile()
    const rect = buffManager.getBuff('chopping-range')
    const range = tool.range + (prefix === 'Extended' ? 2 : 0)
    const ex = rect.x - range
    const ey = rect.y - range
    const ew = rect.w + 2 * range
    const eh = rect.h + 2 * range
    const tileX = tileIndex & 0x3FF
    const tileY = tileIndex >> 10
    const worldRectX = direction === 0 ? cx - ex - ew + 1 : cx + ex
    return tileX >= worldRectX && tileX < worldRectX + ew &&
           tileY >= cy + ey && tileY < cy + ey + eh
  }

  /**
   * Planifie l'abattage de la prochaine section en file, ou termine si la file est vide.
   */
  #scheduleNext () {
    if (this.#queue.length > 0) {
      const {priority, capacity} = MICROTASK.CHOP_TREE
      taskScheduler.enqueue('chop-current', this.#queue[0].speed, this.onChopTree, priority, capacity)
    }
    // TODO: fin animation outil (axe)
  }

  /**
   * Callback TaskScheduler : exécute l'abattage d'une section de l'arbre en tête de file,
   * distribue le loot, puis planifie la suivante si la file n'est pas vide.
   * Si l'arbre vient d'être détruit (size < 0), purge la file des entrées restantes pour
   * ce même arbre avant de planifier le prochain temps de coupe.
   */
  onChopTree () {
    const entry = this.#queue.shift()
    if (entry === undefined) return

    const {plant} = entry
    const system = PLANT_SYSTEM_LOOKUP.get(plant.kind * 100 + plant.type)
    if (system === undefined || !system.isPresent(plant)) {
      this.#scheduleNext()
      return
    }

    const plantItem = ITEMS[plant.itemId]
    const buffValues = buffManager.getBuffs(plantItem.chopping.buffList)

    // Loot standard (chaque coup)
    for (const lootItem of plantItem.chopping.items) {
      const count = rollLootWithBuffs(lootItem, buffValues)
      if (count > 0) {
        const itemCode = lootItem.item.code
        inventoryManager.loot(itemCode, count, '')
        eventBus.emit('player/loot-item', {itemCode})
      }
    }

    // Délègue la mutation de state au TreeSystem
    system.onChopped(plant)

    // Extra drop si c'est le dernier coup (size est déjà décrémenté dans onChopped)
    // plant est même supprimé de la mémoire...
    if (plant.size < 0 && plantItem.chopping.extraDrop) {
      for (const lootItem of plantItem.chopping.extraDrop.items) {
        const count = rollLootWithBuffs(lootItem, buffValues)
        if (count > 0) {
          const itemCode = lootItem.item.code
          inventoryManager.loot(itemCode, count, '')
          eventBus.emit('player/loot-item', {itemCode})
        }
      }
    }

    // Arbre détruit : purge les entrées restantes pour ce même arbre (clics en surplus
    // avant le coup final) — évite de dépiler inutilement des coups sur un arbre qui n'existe
    // plus.
    if (plant.size < 0) purgeQueueByKey(this.#queue, 'plant', plant)

    this.#scheduleNext()
  }

  /**
   * Vide la file et annule la tâche planifiée.
   */
  #interrupt () {
    if (this.#queue.length === 0) return
    this.#queue.length = 0
    taskScheduler.dequeue('chop-current')
    // TODO: annuler animation outil (axe)
  }

  /** Liaison EventBus : 'player/teleport-begin'. */
  onTeleportBegin () { this.#interrupt() }

  /**
   * Liaison EventBus : 'hotbar/slot-active' — interrompt si le nouveau slot n'est plus une axe.
   * @param {{slot: object}} payload
   */
  onSlotActive ({slot}) {
    if (slot.item && ITEMS[slot.item].type & ITEM_TYPE.TOOL && ITEMS[slot.item].stype === 'axe') return
    this.#interrupt()
  }
}
export const choppingManager = new ChoppingManager()
