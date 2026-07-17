// action.mjs — MiningManager - PlacingManager - ForagingManager - ChoppingManager
// SowingManager - HammingManager - FurnishingManager - FillingManager - PouringManager

import {eventBus, taskScheduler, microTasker, blockedTiles, rollLootWithBuffs, seededRNG} from './utils.mjs'
import {NODE_TYPE, NODES_LOOKUP, NODES, ITEM_TYPE, ITEMS, PLANT_SYSTEM_LOOKUP, PLANT_KIND} from '../assets/data/data.mjs'
import {inventoryManager} from './inventory.mjs'
import {buffManager, isInInteractionRange} from './buff.mjs'
import {database} from './database.mjs'
import {chunkManager} from './world.mjs'
import {playerManager} from './player.mjs'
import {WORLD_WIDTH, MICROTASK} from './constant.mjs'
import {floraManager} from './ecosystem.mjs'
import {furnitureManager, teleporterManager} from './housing.mjs'
import {IMAGE_CACHE} from './assets.mjs'

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

/**
 * Teste si toutes les tuiles d'un rectangle de tuiles correspondent à nodeId.
 * Retourne true dès qu'une tuile diffère — sortie anticipée.
 * @param {number} index  — (y << 10) | x — coin haut-gauche du rectangle
 * @param {number} w      — largeur en tuiles
 * @param {number} h      — hauteur en tuiles
 * @param {number} nodeId — code de tuile attendu sur toutes les cases
 * @returns {boolean} true si au moins une tuile ≠ nodeId, false si toutes correspondent
 */
const tileRectHasOther = (index, w, h, nodeId) => {
  let rowBase = index
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (chunkManager.getTileAt(rowBase + dx) !== nodeId) return true
    }
    rowBase += WORLD_WIDTH
  }
  return false
}

/**
 * Résout un objet loot-action hydraté : tire chaque entrée avec buffs et crédite l'inventaire.
 * Émet 'player/loot-item' pour chaque item obtenu (son, achievements, UI…).
 * Le préfixe d'item (tools/armor/weapons) n'est pas encore tiré — toujours ''.
 * TODO: générer le préfixe aléatoire quand les items de type TOOL/ARMOR/WEAPON seront lootables.
 * @param {object} lootAction — objet hydraté portant {buffList, items[]}
 *                              (ex : tileNode.mining, plantItem.chopping, plantItem.shaking…)
 */
const resolveLoot = (lootAction) => {
  const buffValues = buffManager.getBuffs(lootAction.buffList)
  for (const lootItem of lootAction.items) {
    const count = rollLootWithBuffs(lootItem, buffValues)
    if (count > 0) {
      const itemCode = lootItem.item.code
      inventoryManager.loot(itemCode, count, '')
      eventBus.emit('player/loot-item', {itemCode})
    }
  }
}

/**
 * Calcule le délai d'action en ms pour un outil et un préfixe donnés.
 * @param {number} baseSpeed   — vitesse de base de l'action (tileNode/plantItem.XXX.speed)
 * @param {number} toolSpeed   — bonus de vitesse de l'outil (tool.XXX.speed)
 * @param {string} buffSpeed   — identigfiant du bonus de vitesse du buff actif ('XXX-speed')
 * @param {string} prefix      — préfixe de l'outil (slot.prefix)
 * @returns {number} délai en ms
 */
const computeActionSpeed = (baseSpeed, toolSpeed, buffSpeed, prefix) => {
  let coefficient = 100 + toolSpeed + buffManager.getBuff(buffSpeed)
  coefficient += prefix === 'Quick' ? 20 : 0
  coefficient += prefix === 'Keen' ? 5 : 0
  coefficient -= prefix === 'Sturdy' ? 5 : 0
  return (baseSpeed * coefficient / 100) | 0
}

/**
 * Teste si une tuile est dans le rectangle d'action directionnel d'un outil.
 * Le rectangle est centré sur le joueur, étendu par tool.range et le préfixe 'Extended',
 * et décalé selon la direction du joueur (face gauche ou droite).
 * @param {number} tileIndex — (y << 10) | x
 * @param {object} tool      — outil équipé, portant tool.range
 * @param {string} prefix    — préfixe de l'outil (Quick / Keen / Sturdy / Extended)
 * @param {string} buffName  — identifiant du buff de range ('mining-range', 'chopping-range'…)
 * @returns {boolean}
 */
const isInToolRange = (tileIndex, tool, prefix, buffName) => {
  const {x: cx, y: cy, direction} = playerManager.getCenterTile()
  const rect = buffManager.getBuff(buffName)
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
   * Initialisation après début de session de jeu ou création d'un nouveau monde
   */
  init () { this.#queue.length = 0 }

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

    for (const entry of this.#queue) {
      if (entry.tileIndex === tileIndex) return
    }

    if (!isInToolRange(tileIndex, tool, prefix, 'mining-range')) { eventBus.emit('sound/play', 'toofar'); return }
    if (tool.star < tileNode.star) { eventBus.emit('sound/play', 'wrong'); return }
    if (!blockedTiles.canMine(tileIndex)) { eventBus.emit('sound/play', 'wrong'); return } // includes ETERNAL

    const speed = computeActionSpeed(tileNode.mining.speed, tool.mining.speed, 'mining-speed', prefix)

    const wasEmpty = this.#queue.length === 0
    this.#queue.push({tileIndex, tileNode, tool, prefix, speed})
    // émettre un bruit spécifique à la pioche
    eventBus.emit('sound/play', 'mining')

    if (wasEmpty) {
      // début animation outil
      eventBus.emit('tool/swing-start', {speed})
      const {priority, capacity} = MICROTASK.MINE_TILE
      taskScheduler.enqueue('mine-current', speed, this.onMineTile, priority, capacity)
    }
  }

  /**
 * Planifie le minage de la prochaine tuile en file, ou termine l'animation si la file est vide.
 */
  #scheduleNext () {
    if (this.#queue.length > 0) {
      const speed = this.#queue[0].speed
      // changement de vitesse animation (speed)
      eventBus.emit('tool/swing-start', {speed})
      const {priority, capacity} = MICROTASK.MINE_TILE
      taskScheduler.enqueue('mine-current', speed, this.onMineTile, priority, capacity)
    } else {
      // fin animation outil
      eventBus.emit('tool/swing-end')
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
    let propagationEnd = entry.tileIndex // évite la création dynamique d'un ARRAY
    if (tileNewCode === SKY) {
      let idx = entry.tileIndex + WORLD_WIDTH
      while (chunkManager.getTileAt(idx) === VOID) {
        chunkManager.setTileAt(idx, SKY)
        eventBus.emit('world/tile-changed', {tileIndex: idx, tileOldCode: VOID, tileNewCode: SKY})
        idx += WORLD_WIDTH
      }
      propagationEnd = idx - WORLD_WIDTH
    }
    chunkManager.setTileAt(entry.tileIndex, tileNewCode)

    // on effectue les traitements induits mainteannt que le monde est désormais entièrement cohérent
    let idx = entry.tileIndex + WORLD_WIDTH
    while (idx <= propagationEnd) {
      eventBus.emit('world/tile-changed', {tileIndex: idx, tileOldCode: VOID, tileNewCode: SKY})
      idx += WORLD_WIDTH
    }
    eventBus.emit('world/tile-changed', {tileIndex: entry.tileIndex, tileOldCode: entry.tileNode.code, tileNewCode})

    // loot
    resolveLoot(entry.tileNode.mining)

    this.#scheduleNext()
  }

  /**
   * Vide la file et annule la tâche planifiée.
   */
  #interrupt () {
    if (this.#queue.length === 0) return
    this.#queue.length = 0
    taskScheduler.dequeue('mine-current')
    // annuler animation outil
    eventBus.emit('tool/swing-end')
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
    if (!isInInteractionRange(tileIndex)) { eventBus.emit('sound/play', 'toofar'); return }
    if (!blockedTiles.canPlace(tileIndex)) { eventBus.emit('sound/play', 'wrong'); return }
    const {priority, capacity} = MICROTASK.PLACE_TILE
    microTasker.enqueue(this.onPlaceTile, priority, capacity, tileIndex, item, slotIndex)
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

    // propagation SKY→VOID vers le bas : les SKY sous le bloc posé perdent leur connexion au ciel
    let propagationEnd = tileIndex // évite la création dynamique d'un tableau
    if (tileOldCode === SKY) {
      let idx = tileIndex + WORLD_WIDTH
      while (chunkManager.getTileAt(idx) === SKY) {
        chunkManager.setTileAt(idx, VOID)
        idx += WORLD_WIDTH
      }
      propagationEnd = idx - WORLD_WIDTH
    }

    // on effectue les traitements induits mainteannt que le monde est désormais entièrement cohérent
    eventBus.emit('world/tile-changed', {tileIndex, tileOldCode, tileNewCode})
    let idx = tileIndex + WORLD_WIDTH
    while (idx <= propagationEnd) {
      eventBus.emit('world/tile-changed', {tileIndex: idx, tileOldCode: SKY, tileNewCode: VOID})
      idx += WORLD_WIDTH
    }
    eventBus.emit('sound/play', 'placing')
  }
}
export const placingManager = new PlacingManager()

/* ====================================================================================================
   POSE DE MEUBLES (FURNISHING)
   ==================================================================================================== */

class FurnishingManager {
  constructor () {
    // Micro-tâche
    this.onPlaceFurniture = this.onPlaceFurniture.bind(this)
  }

  /**
   * Valide la demande de pose et déclenche la micro-tâche si le meuble est de type normal
   * (ni floating, ni onTop — ces deux branches ne sont pas encore traitées).
   * @param {number} tileIndex — (y << 10) | x — tuile cliquée, coin bas-gauche du meuble
   * @param {object} tileNode  — NODES_LOOKUP[tileCode] (non utilisé — le footprint est relu tuile par tuile en micro-tâche)
   * @param {object} item      — ITEMS[slot.item]
   * @param {number} slotIndex — slot.slot (index hotbar)
   */
  tryPlace (tileIndex, tileNode, item, slotIndex) {
    if (buffManager.getBuff('playerFreeze')) return

    const {priority, capacity} = MICROTASK.FURNISHING_PLACE
    microTasker.enqueue(this.onPlaceFurniture, priority, capacity, tileIndex, item, slotIndex)
  }

  /**
   * Exécuté en micro-tâche. Valide puis pose un meuble normal : footprint w×h en GAZ ou BWALL
   * (mélange autorisé), sol SOLID ou ETERNAL juste en dessous, aucune tuile bloquée, à portée
   * d'interaction.
   * @param {number} tileIndex — (y << 10) | x — coin bas-gauche cliqué
   * @param {object} item      — ITEMS[slot.item]
   * @param {number} slotIndex — slot.slot (index hotbar)
   */
  onPlaceFurniture (tileIndex, item, slotIndex) {
    const placedImage = item.placed ?? item.placedLeft
    const w = placedImage.sw >> 4
    const h = placedImage.sh >> 4
    const px = tileIndex & 0x3FF
    const topY = (tileIndex >> 10) - h + 1

    const FOOTPRINT_MASK = NODE_TYPE.GAZ | NODE_TYPE.BWALL
    const footprintCodes = chunkManager.getRectCodes(px, topY, w, h)
    for (const code of footprintCodes) {
      if ((NODES_LOOKUP[code].type & FOOTPRINT_MASK) === 0) return
    }

    if (!item.floating) {
      const FLOOR_MASK = NODE_TYPE.SOLID | NODE_TYPE.ETERNAL
      const floorBase = ((topY + h) << 10) | px
      for (let dx = 0; dx < w; dx++) {
        const node = NODES_LOOKUP[chunkManager.getTileAt(floorBase + dx)]
        if ((node.type & FLOOR_MASK) === 0) return
      }
    }

    if (!isInInteractionRange(tileIndex)) { eventBus.emit('sound/play', 'toofar'); return }
    if (item.stype === 'teleporter' && !teleporterManager.canPlace(item.code)) { eventBus.emit('sound/play', 'wrong'); return }
    if (!blockedTiles.canPlaceRect(px, topY, w, h)) { eventBus.emit('sound/play', 'wrong'); return }

    const furniture = furnitureManager.place(item.code, tileIndex)
    inventoryManager.decrementHotbarSlotCount(slotIndex)
    eventBus.emit('sound/play', 'placing')
    eventBus.emit('furniture/placed', furniture.id)
  }
}
export const furnishingManager = new FurnishingManager()

/* ====================================================================================================
   REMPLISSAGE DE CONTENANTS (FILLING)
   ==================================================================================================== */

/** Résultat obtenu par liquide source */
const LIQUID_RESULT_SUFFIX = {
  [NODES.SEA.code]: 'Water',
  [NODES.WATER.code]: 'Water',
  [NODES.HONEY.code]: 'Honey',
  [NODES.SAP.code]: 'Sap'
}

class FillingManager {
  constructor () {
    // Micro-tâche
    this.onFillContainer = this.onFillContainer.bind(this)
  }

  /**
   * Valide la demande de remplissage et déclenche la micro-tâche.
   * Point d'entrée unique depuis core.mjs (#processWorldClick), appelé uniquement
   * si l'item tenu est FILLABLE et la tuile cliquée est LIQUID.
   * @param {number} tileIndex — (y << 10) | x
   * @param {object} tileNode  — NODES_LOOKUP[tileCode]
   * @param {object} item      — ITEMS[slot.item] (bottle ou bucket)
   * @param {number} slotIndex — slot.slot (index hotbar)
   */
  tryFill (tileIndex, tileNode, item, slotIndex) {
    if (buffManager.getBuff('playerFreeze')) return
    if (!isInInteractionRange(tileIndex)) { eventBus.emit('sound/play', 'toofar'); return }
    const {priority, capacity} = MICROTASK.FILL_CONTAINER
    microTasker.enqueue(this.onFillContainer, priority, capacity, tileIndex, tileNode, item, slotIndex)
  }

  /**
 * Callback MicroTasker : exécute le remplissage.
   * Re-vérifie la tuile cible — elle a pu changer entre tryFill et l'exécution.
   * Consomme l'item en main, crédite le contenant rempli. Pour un bucket, transforme la tuile
   * en SKY (si la tuile au-dessus est SKY, avec propagation sur les VOID consécutifs en dessous)
   * ou VOID. Toutes les tuiles concernées sont modifiées avant l'émission des eventBus
   * 'world/tile-changed', pour que les listeners synchrones lisent un monde déjà cohérent.
   * @param {number} tileIndex
   * @param {object} tileNode
   * @param {object} item
   * @param {number} slotIndex
   */
  onFillContainer (tileIndex, tileNode, item, slotIndex) {
    const tileOldCode = chunkManager.getTileAt(tileIndex)
    if (tileOldCode !== tileNode.code) return // tuile changée entre-temps

    const suffix = LIQUID_RESULT_SUFFIX[tileOldCode]
    if (suffix === undefined) return // liquide non convertible (ex. Deep Sea)

    const resultId = `${item.code}${suffix}`

    // consommation / crédit
    inventoryManager.decrementHotbarSlotCount(slotIndex)
    inventoryManager.loot(resultId, 1, '')

    // transformation de la tuile
    if (item.code === 'bucket') {
      const SKY = NODES.SKY.code
      const VOID = NODES.VOID.code
      const aboveCode = chunkManager.getTileAt(tileIndex - WORLD_WIDTH)
      const tileNewCode = aboveCode === SKY ? SKY : VOID

      // mutation de toutes les tuiles concernées
      chunkManager.setTileAt(tileIndex, tileNewCode)

      let propagationEnd = tileIndex
      if (tileNewCode === SKY) {
        let idx = tileIndex + WORLD_WIDTH
        while (chunkManager.getTileAt(idx) === VOID) {
          chunkManager.setTileAt(idx, SKY)
          idx += WORLD_WIDTH
        }
        propagationEnd = idx - WORLD_WIDTH
      }

      // émission — le monde est désormais entièrement cohérent
      eventBus.emit('world/tile-changed', {tileIndex, tileOldCode, tileNewCode})
      let idx = tileIndex + WORLD_WIDTH
      while (idx <= propagationEnd) {
        eventBus.emit('world/tile-changed', {tileIndex: idx, tileOldCode: VOID, tileNewCode: SKY})
        idx += WORLD_WIDTH
      }
    }

    eventBus.emit('sound/play', 'placing')
  }
}
export const fillingManager = new FillingManager()

/* ====================================================================================================
   VIDAGE DE CONTENANTS (POURING)
   ==================================================================================================== */

/** Codes de tuiles acceptant le versement d'un seau plein. */
const POURING_NODES = new Set([NODES.SKY.code, NODES.VOID.code])

class PouringManager {
  constructor () {
    // Micro-tâche
    this.onPourContainer = this.onPourContainer.bind(this)
  }

  /**
   * Valide la demande de versement et déclenche la micro-tâche.
   * Point d'entrée unique depuis core.mjs (#processWorldClick), appelé uniquement
   * si l'item tenu est POURABLE.
   * @param {number} tileIndex — (y << 10) | x
   * @param {object} tileNode  — NODES_LOOKUP[tileCode]
   * @param {object} item      — ITEMS[slot.item] (bucketWater, bucketHoney ou bucketSap)
   * @param {number} slotIndex — slot.slot (index hotbar)
   */
  tryPour (tileIndex, tileNode, item, slotIndex) {
    if (buffManager.getBuff('playerFreeze')) return
    if (!POURING_NODES.has(tileNode.code)) return
    if (!isInInteractionRange(tileIndex)) { eventBus.emit('sound/play', 'toofar'); return }
    if (!blockedTiles.canPlace(tileIndex)) { eventBus.emit('sound/play', 'wrong'); return }
    const {priority, capacity} = MICROTASK.POUR_CONTAINER
    microTasker.enqueue(this.onPourContainer, priority, capacity, tileIndex, tileNode, item, slotIndex)
  }

  /**
   * Callback MicroTasker : exécute le versement.
   * Re-vérifie la tuile cible et le blocage — ils ont pu changer entre tryPour et l'exécution.
   * Consomme le seau plein, crédite un seau vide, pose la tuile de liquide correspondante,
   * émet 'world/tile-changed'. Si la tuile remplacée était SKY, propage VOID sur les tuiles
   * SKY situées en dessous (même logique que PlacingManager.onPlaceTile).
   * @param {number} tileIndex
   * @param {object} tileNode
   * @param {object} item
   * @param {number} slotIndex
   */
  onPourContainer (tileIndex, tileNode, item, slotIndex) {
    const tileOldCode = chunkManager.getTileAt(tileIndex)
    if (tileOldCode !== tileNode.code) return // tuile changée entre-temps
    if (!blockedTiles.canPlace(tileIndex)) return // bloquée entre-temps

    const tileNewCode = item.pouring.liquid
    if (tileNewCode === undefined) return // item non versable (sécurité)

    // consommation / crédit
    inventoryManager.decrementHotbarSlotCount(slotIndex)
    inventoryManager.loot(item.pouring.container, 1, '')

    // transformation de la tuile
    chunkManager.setTileAt(tileIndex, tileNewCode)
    eventBus.emit('world/tile-changed', {tileIndex, tileOldCode, tileNewCode})
    eventBus.emit('sound/play', 'placing')

    // propagation SKY→VOID vers le bas : les SKY sous le liquide posé perdent leur connexion au ciel
    let propagationEnd = tileIndex // évite la création dynamique d'un Array
    if (tileOldCode === NODES.SKY.code) {
      let idx = tileIndex + WORLD_WIDTH
      while (chunkManager.getTileAt(idx) === NODES.SKY.code) {
        chunkManager.setTileAt(idx, NODES.VOID.code)
        idx += WORLD_WIDTH
      }
      propagationEnd = idx - WORLD_WIDTH
    }

    // on effectue les traitements induits mainteannt que le monde est désormais entièrement cohérent
    eventBus.emit('world/tile-changed', {tileIndex, tileOldCode, tileNewCode})
    let idx = tileIndex + WORLD_WIDTH
    while (idx <= propagationEnd) {
      eventBus.emit('world/tile-changed', {tileIndex: idx, tileOldCode: NODES.SKY.code, tileNewCode: NODES.VOID.code})
      idx += WORLD_WIDTH
    }
    eventBus.emit('sound/play', 'placing')
  }
}
export const pouringManager = new PouringManager()

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
    this.#queue.length = 0
  }

  /**
   * Restaure la liste des tuiles NATURAL déjà foragée pendant le jour courant
   * @param {Set} savedSet — index des tuiles foragées
   */
  init (savedSet) {
    this.#foragedToday = savedSet ?? new Set()
    this.#queue.length = 0
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
      if (!isInToolRange(tileIndex, tool, prefix, 'foraging-range')) { eventBus.emit('sound/play', 'toofar'); return }
      if (tool.star < tileNode.star) { eventBus.emit('sound/play', 'wrong'); return }
      if (this.#foragedToday.size >= NATURAL_FORAGE_DAILY_LIMIT) { eventBus.emit('sound/play', 'wrong'); return }
      if (this.#foragedToday.has(tileIndex)) { eventBus.emit('sound/play', 'wrong'); return }

      this.#foragedToday.add(tileIndex)
      database.setGameState('naturalforaged', this.#foragedToday)

      const speed = computeActionSpeed(tileNode.foraging.speed, tool.foraging.speed, 'foraging-speed', prefix)

      const wasEmpty = this.#queue.length === 0
      this.#queue.push({type: 'natural', tileIndex, tileNode, tool, prefix, speed})
      eventBus.emit('sound/play', 'foraging')

      if (wasEmpty) this.#scheduleNext()

      return
    }

    // 2. Tuile SKY/VOID — chercher une plante sous la souris.
    if (tileNode.code !== NODES.SKY.code && tileNode.code !== NODES.VOID.code) return
    const plant = floraManager.getPlantAt(tileIndex)
    if (plant === null) return
    if (!floraManager.canForage(plant)) return

    const plantItem = ITEMS[plant.itemId]
    if (!plantItem.foraging) return

    for (const entry of this.#queue) {
      if (entry.type === 'plant' && entry.plant === plant) return
    }

    if (!isInToolRange(tileIndex, tool, prefix, 'foraging-range')) { eventBus.emit('sound/play', 'toofar'); return }
    if (tool.star < plantItem.star) { eventBus.emit('sound/play', 'wrong'); return }
    const speed = computeActionSpeed(plantItem.foraging.speed, tool.foraging.speed, 'foraging-speed', prefix)

    const wasEmpty = this.#queue.length === 0
    this.#queue.push({type: 'plant', plant, tileIndex, tool, prefix, speed})
    eventBus.emit('sound/play', 'foraging')

    if (wasEmpty) this.#scheduleNext()
  }

  /**
   * Planifie le prochain foraging depuis le front de file.
   */
  #scheduleNext () {
    if (this.#queue.length > 0) {
      const speed = this.#queue[0].speed
      // changement de vitesse animation (speed)
      eventBus.emit('tool/swing-start', {speed})
      const {priority, capacity} = MICROTASK.FORAGE_ACTION
      taskScheduler.enqueue('forage-current', speed, this.onForage, priority, capacity)
    } else {
      // fin animation outil (sickle)
      eventBus.emit('tool/swing-end')
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

      resolveLoot(entry.tileNode.foraging)

      console.log('ForagingManager.onForage — natural', entry)
    } else {
      const plant = entry.plant
      const system = PLANT_SYSTEM_LOOKUP.get(plant.kind * 100 + plant.type)
      if (!system.isPresent(plant)) {
        this.#scheduleNext()
        return
      }
      const plantItem = ITEMS[plant.itemId]
      resolveLoot(plantItem.foraging)

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
    // annuler animation outil (sickle)
    eventBus.emit('tool/swing-end')
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

  init () { this.#queue.length = 0 }

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
    if (!floraManager.canChop(plant)) return

    const plantItem = ITEMS[plant.itemId]
    if (!isInToolRange(tileIndex, tool, prefix, 'chopping-range')) { eventBus.emit('sound/play', 'toofar'); return }
    if (plant.blocked > 0) { eventBus.emit('sound/play', 'wrong'); return }

    if (tool.star < plantItem.star) { eventBus.emit('sound/play', 'wrong'); return }

    const speed = computeActionSpeed(plantItem.chopping.speed, tool.chopping.speed, 'chopping-speed', prefix)

    const wasEmpty = this.#queue.length === 0
    this.#queue.push({plant, tool, prefix, speed})
    eventBus.emit('sound/play', 'chopping')

    if (wasEmpty) {
      eventBus.emit('tool/swing-start', {speed})
      const {priority, capacity} = MICROTASK.CHOP_TREE
      taskScheduler.enqueue('chop-current', speed, this.onChopTree, priority, capacity)
    }
  }

  /**
   * Planifie l'abattage de la prochaine section en file, ou termine si la file est vide.
   */
  #scheduleNext () {
    if (this.#queue.length > 0) {
      const speed = this.#queue[0].speed
      eventBus.emit('tool/swing-start', {speed})
      const {priority, capacity} = MICROTASK.CHOP_TREE
      taskScheduler.enqueue('chop-current', speed, this.onChopTree, priority, capacity)
    } else {
      // fin animation outil (axe)
      eventBus.emit('tool/swing-end')
    }
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
    // loot standard : chaque coup
    resolveLoot(plantItem.chopping)

    // Délègue la mutation de state au TreeSystem
    system.onChopped(plant)

    // Extra drop si c'est le dernier coup (size est déjà décrémenté dans onChopped)
    if (plant.size < 0 && plantItem.chopping.extraDrop) {
      resolveLoot(plantItem.chopping.extraDrop)
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
    // annuler animation outil (axe)
    eventBus.emit('tool/swing-end')
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

/* ====================================================================================================
   PLACEMENT DE GRAINES (SOWING)
   ==================================================================================================== */

class SowingManager {
  #sownSeedGrass = new Map() // Map<tileIndex, {index, oldCode, newCode, germinateTimestamp}> — dédoublonnage + source de persistance
  #dirty = false // true si #sownSeeds a changé depuis la dernière écriture gamestate
  #imageForest = null // ITEMS.seedForest.placed, mis en cache après hydratation
  #imageJungle = null // ITEMS.seedJungle.placed, mis en cache après hydratation

  constructor () {
    // eventBus
    this.onSaveTick = this.onSaveTick.bind(this)
    eventBus.on('save/tick', this.onSaveTick)
    // Micro-tâches
    this.doSow = this.doSow.bind(this)
    this.onSeedGrassGerminate = this.onSeedGrassGerminate.bind(this)
  }

  /**
   * Hydrate les graines en attente de germination. Réarme chaque timer.
   * @param {Array<{index, oldCode, newCode, germinateTimestamp}>} sownSeedGrass — persisté (gamestate.sownseeds), [] si absent
   */
  init (sownSeedGrass = []) {
    this.#sownSeedGrass.clear()
    this.#dirty = false
    this.#imageForest = ITEMS.seedForest.placed // après hydratation
    this.#imageJungle = ITEMS.seedJungle.placed // après hydratation

    for (const seed of sownSeedGrass) {
      this.#sownSeedGrass.set(seed.index, seed)
      const {priority, capacity} = MICROTASK.SEED_GRASS_GERMINATE
      taskScheduler.enqueueAbsolute(`seed_grass_${seed.index}`, seed.germinateTimestamp, this.onSeedGrassGerminate, priority, capacity, seed.index)
    }
  }

  /**
   * Liaison EventBus : 'save/tick' — écrit l'état courant des graines en attente dans
   * gamestate (clé 'sownseeds'). Émis toutes les 2s par SaveManager.processSave, synchronisé
   * avec le save des chunks.
   */
  onSaveTick () {
    if (!this.#dirty) return
    // consersion Map => Array
    database.setGameState('sownseedgrass', [...this.#sownSeedGrass.values()])
    this.#dirty = false
  }

  /**
   * Tente de planter la graine tenue en main sur la tuile cliquée.
   * Vérifie playerFreeze puis délègue à doSow via micro-tâche.
   * @param {number} tileIndex — (y << 10) | x — tuile cliquée
   * @param {object} tileNode  — NODES_LOOKUP[tileCode]
   * @param {object} item      — ITEMS[slot.item]
   * @param {number} slotIndex — slot.slot (index hotbar)
   */
  trySow (tileIndex, tileNode, item, slotIndex) {
    if (buffManager.getBuff('playerFreeze')) return
    const {priority, capacity} = MICROTASK.SOW_SEED
    microTasker.enqueue(this.doSow, priority, capacity, tileIndex, tileNode, item, slotIndex)
  }

  /**
   * Exécuté en micro-tâche.
   * Tente de planter la graine tenue en main sur la tuile cliquée.
   * Délègue la logique métier par stype de graine.
   * @param {number} tileIndex — (y << 10) | x — tuile cliquée
   * @param {object} tileNode  — NODES_LOOKUP[tileCode]
   * @param {object} item      — ITEMS[slot.item]
   * @param {number} slotIndex — slot.slot (index hotbar, pour decrementHotbarSlotCount)
   */
  doSow (tileIndex, tileNode, item, slotIndex) {
    if (item.code === 'sunflowerSeed') this.#trySowSunflowerSeed(tileIndex, tileNode, slotIndex)
    else if (item.code === 'acorn') this.#trySowAcorn(tileIndex, tileNode, slotIndex)
    else if (item.code === 'samara') this.#trySowSamara(tileIndex, tileNode, slotIndex)
    else if (item.code === 'ambermirageSeed') this.#trySowAmbermirageSeed(tileIndex, tileNode, slotIndex)
    else if (item.code === 'seedForest') this.#trySowSeed(tileIndex, tileNode, slotIndex, NODES.DIRT.code, NODES.GRASSFOREST.code)
    else if (item.code === 'seedJungle') this.#trySowSeed(tileIndex, tileNode, slotIndex, NODES.SILT.code, NODES.GRASSJUNGLE.code)
  }

  /**
   * Valide et exécute le placement d'une ForestGrassSeed ou JungleGrassSeed. Aiguillage
   * commun aux deux graines — seuls topsoilCode/naturalCode changent.
   * Conditions : tuile topsoilCode, tuile au-dessus SKY, non bloquée, pas déjà ensemencée.
   * Silence si mauvaise tuile, 'wrong' si bloqué/déjà semée, 'placing' si succès.
   * @param {number} tileIndex — tuile cliquée (le sol attendu)
   * @param {object} tileNode
   * @param {number} slotIndex
   * @param {number} topsoilCode — NODES.DIRT.code ou NODES.SILT.code
   * @param {number} naturalCode — NODES.GRASSFOREST.code ou NODES.GRASSJUNGLE.code
   */
  #trySowSeed (tileIndex, tileNode, slotIndex, topsoilCode, naturalCode) {
    const SKY = NODES.SKY.code
    const W = WORLD_WIDTH

    // Silence — mauvaise tuile de sol
    if (tileNode.code !== topsoilCode) return

    // Silence — tuile au-dessus pas SKY
    if (chunkManager.getTileAt(tileIndex - W) !== SKY) return

    // 'toofar' — tuile hors de la zone d'interaction
    if (!isInInteractionRange(tileIndex)) { eventBus.emit('sound/play', 'toofar'); return }

    // 'wrong' — tuile bloquée ou déjà ensemencée
    if (!blockedTiles.canPlace(tileIndex) || this.#sownSeedGrass.has(tileIndex)) {
      eventBus.emit('sound/play', 'wrong')
      return
    }

    // Succès — planifie la germination
    const DAY_MS = 1_440_000
    const delay = (seededRNG.randomGetRealMinMax(0.8, 1.2) * DAY_MS) | 0
    const {priority, capacity} = MICROTASK.SEED_GRASS_GERMINATE
    const germinateTimestamp = taskScheduler.enqueue(`seed_grass_${tileIndex}`, delay, this.onSeedGrassGerminate, priority, capacity, tileIndex)

    const seed = {index: tileIndex, oldCode: topsoilCode, newCode: naturalCode, germinateTimestamp}
    this.#sownSeedGrass.set(tileIndex, seed)
    this.#dirty = true

    inventoryManager.decrementHotbarSlotCount(slotIndex)
    eventBus.emit('sound/play', 'placing')
  }

  /**
   * Callback TaskScheduler : échéance de germination. Revalide l'éligibilité avant de
   * transformer (la tuile a pu changer depuis le semis) — germination inconditionnelle
   * (aucun voisinage requis). Retire la graine dans tous les cas (germée ou non).
   * @param {number} tileIndex
   */
  onSeedGrassGerminate (tileIndex) {
    const seed = this.#sownSeedGrass.get(tileIndex)
    if (seed === undefined) return // supprimé entre-temps (ne devrait pas arriver)

    const {oldCode, newCode} = seed
    const SKY = NODES.SKY.code
    const W = WORLD_WIDTH

    if (chunkManager.getTileAt(tileIndex) === oldCode &&
        chunkManager.getTileAt(tileIndex - W) === SKY &&
        blockedTiles.canPlace(tileIndex)) {
      chunkManager.setTileAt(tileIndex, newCode)
      eventBus.emit('world/tile-changed', {tileIndex, tileOldCode: oldCode, tileNewCode: newCode})
    }

    this.#sownSeedGrass.delete(tileIndex)
    this.#dirty = true
  }

  /**
   * Valide et exécute le placement d'une SunflowerSeed.
   * Conditions : tuile GRASSFOREST, tuiles index-W et index-2W sont SKY et non bloquées.
   * Silence si mauvaise tuile, 'wrong' si bloqué, 'placing' si succès.
   * @param {number} tileIndex — tuile cliquée (le sol attendu)
   * @param {object} tileNode
   * @param {number} slotIndex
   */
  #trySowSunflowerSeed (tileIndex, tileNode, slotIndex) {
    const GRASSFOREST = NODES.GRASSFOREST.code
    const SKY = NODES.SKY.code
    const W = WORLD_WIDTH

    // Silence — mauvaise tuile de sol
    if (tileNode.code !== GRASSFOREST) return

    const body1 = tileIndex - W // tuile juste au-dessus
    const body2 = body1 - W // tuile deux cases au-dessus

    // Silence — tuiles du corps pas SKY
    if (chunkManager.getTileAt(body1) !== SKY) return
    if (chunkManager.getTileAt(body2) !== SKY) return

    // 'toofar' — tuile hors de la zone d'interaction
    if (!isInInteractionRange(tileIndex)) { eventBus.emit('sound/play', 'toofar'); return }

    // 'wrong' — tuiles bloquées (furniture, plante déjà présente)
    if (!blockedTiles.canPlace(body1) || !blockedTiles.canPlace(body2)) {
      eventBus.emit('sound/play', 'wrong')
      return
    }

    // 'wrong' — règles métier de la graine
    if (!floraManager.canSow(tileIndex, 'sunflowerSeed')) { eventBus.emit('sound/play', 'wrong'); return }

    // Succès
    eventBus.emit('sewed/sunflower', tileIndex)
    inventoryManager.decrementHotbarSlotCount(slotIndex)
    eventBus.emit('sound/play', 'placing')
  }

  /**
   * Valide et exécute le placement d'un acorn (Oak seed).
   * Conditions : tuile centrale de 3 GRASSFOREST consécutives, rectangle 3×18 au-dessus du
   * sol entièrement SKY. Silence si mauvaise tuile, 'wrong' si bloqué, 'placing' si succès.
   * @param {number} tileIndex — tuile cliquée (le sol attendu)
   * @param {object} tileNode
   * @param {number} slotIndex
   */
  #trySowAcorn (tileIndex, tileNode, slotIndex) {
    const GRASSFOREST = NODES.GRASSFOREST.code

    // vérification du sol
    if (tileNode.code !== GRASSFOREST) return
    if (chunkManager.getTileAt(tileIndex - 1) !== GRASSFOREST) return
    if (chunkManager.getTileAt(tileIndex + 1) !== GRASSFOREST) return

    // Vérification que le rectangle 3×18 au-dessus du sol est entièrement SKY
    const soilIndex = tileIndex - 1
    const SKY = NODES.SKY.code
    if (tileRectHasOther(soilIndex - 18 * WORLD_WIDTH, 3, 18, SKY)) return

    // 'toofar' — tuile hors de la zone d'interaction
    if (!isInInteractionRange(tileIndex)) { eventBus.emit('sound/play', 'toofar'); return }

    // 'wrong' — tuiles bloquées (furniture, plante déjà présente)
    const soilX = soilIndex & 0x3FF
    const soilY = soilIndex >> 10
    if (!blockedTiles.canPlaceRect(soilX, soilY - 18, 3, 18)) { eventBus.emit('sound/play', 'wrong'); return }

    // 'wrong' — règles métier de la graine
    if (!floraManager.canSow(tileIndex, 'acorn')) { eventBus.emit('sound/play', 'wrong'); return }

    // Succès
    eventBus.emit('sewed/acorn', tileIndex)
    inventoryManager.decrementHotbarSlotCount(slotIndex)
    eventBus.emit('sound/play', 'placing')
  }

  /**
   * Valide et exécute le placement d'un samara (Mahogany seed).
   * Conditions : tuile centrale de 3 GRASSJUNGLE consécutives, rectangle 3×18 au-dessus du
   * sol entièrement SKY. Silence si mauvaise tuile, 'wrong' si bloqué, 'placing' si succès.
   * @param {number} tileIndex — tuile cliquée (le sol attendu)
   * @param {object} tileNode
   * @param {number} slotIndex
   */
  #trySowSamara (tileIndex, tileNode, slotIndex) {
    const GRASSJUNGLE = NODES.GRASSJUNGLE.code

    // vérification du sol
    if (tileNode.code !== GRASSJUNGLE) return
    if (chunkManager.getTileAt(tileIndex - 1) !== GRASSJUNGLE) return
    if (chunkManager.getTileAt(tileIndex + 1) !== GRASSJUNGLE) return

    // Vérification que le rectangle 3×18 au-dessus du sol est entièrement SKY
    const soilIndex = tileIndex - 1
    const SKY = NODES.SKY.code
    if (tileRectHasOther(soilIndex - 18 * WORLD_WIDTH, 3, 18, SKY)) return

    // 'toofar' — tuile hors de la zone d'interaction
    if (!isInInteractionRange(tileIndex)) { eventBus.emit('sound/play', 'toofar'); return }

    // 'wrong' — tuiles bloquées (furniture, plante déjà présente)
    const soilX = soilIndex & 0x3FF
    const soilY = soilIndex >> 10
    if (!blockedTiles.canPlaceRect(soilX, soilY - 18, 3, 18)) { eventBus.emit('sound/play', 'wrong'); return }

    // 'wrong' — règles métier de la graine
    if (!floraManager.canSow(tileIndex, 'samara')) { eventBus.emit('sound/play', 'wrong'); return }

    // Succès
    eventBus.emit('sewed/samara', tileIndex)
    inventoryManager.decrementHotbarSlotCount(slotIndex)
    eventBus.emit('sound/play', 'placing')
  }

  /**
   * Valide et exécute le placement d'une AmbermirageSeed.
   * Conditions : tuile SAND, tuile index-W (la tuile-plante) SKY. Silence si mauvaise tuile,
   * 'wrong' si bloqué, 'placing' si succès.
   * @param {number} tileIndex — tuile cliquée (le sol SAND attendu)
   * @param {object} tileNode
   * @param {number} slotIndex
   */
  #trySowAmbermirageSeed (tileIndex, tileNode, slotIndex) {
    const SAND = NODES.SAND.code
    const SKY = NODES.SKY.code
    const W = WORLD_WIDTH

    // Silence — mauvaise tuile de sol
    if (tileNode.code !== SAND) return

    const body1 = tileIndex - W // tuile juste au-dessus

    // Silence — tuile du corps pas SKY
    if (chunkManager.getTileAt(body1) !== SKY) return

    // 'toofar' — tuile hors de la zone d'interaction
    if (!isInInteractionRange(tileIndex)) { eventBus.emit('sound/play', 'toofar'); return }

    // 'wrong' — tuile bloquée (furniture, plante déjà présente)
    if (!blockedTiles.canPlace(body1)) {
      eventBus.emit('sound/play', 'wrong')
      return
    }

    // 'wrong' — règles métier de la graine
    if (!floraManager.canSow(tileIndex, 'ambermirageSeed')) { eventBus.emit('sound/play', 'wrong'); return }

    // Succès
    eventBus.emit('sewed/ambermirage', tileIndex)
    inventoryManager.decrementHotbarSlotCount(slotIndex)
    eventBus.emit('sound/play', 'placing')
  }

  /**
   * Dessine les graines en attente de germination, en surimpression de leur tuile. Liste
   * courte — dessinées sans culling par chunk, comme AmbermirageSystem.#sewedTiles.
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  render (ctx) {
    const GRASSFOREST = NODES.GRASSFOREST.code
    for (const seed of this.#sownSeedGrass.values()) {
      const img = seed.newCode === GRASSFOREST ? this.#imageForest : this.#imageJungle
      const pxX = (seed.index & 0x3FF) << 4
      const pxY = (seed.index >> 10) << 4
      ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
    }
  }
}
export const sowingManager = new SowingManager()

/* ====================================================================================================
   HAMMING
   ==================================================================================================== */

class HammingManager {
  #queue = [] // [{type, plant, tool, prefix, speed}] — objet en attente, dans l'ordre de demande
  constructor () {
    // EventBus
    this.onTeleportBegin = this.onTeleportBegin.bind(this)
    this.onSlotActive = this.onSlotActive.bind(this)
    eventBus.on('player/teleport-begin', this.onTeleportBegin)
    eventBus.on('hotbar/slot-active', this.onSlotActive)
    // Micro-tasks
    this.onHamming = this.onHamming.bind(this)
  }

  init () { this.#queue.length = 0 }

  /**
   * Planifie la prochaine utilisation du hammer en file, ou termine si la file est vide.
   */
  #scheduleNext () {
    if (this.#queue.length > 0) {
      const speed = this.#queue[0].speed
      eventBus.emit('tool/swing-start', {speed})
      const {priority, capacity} = MICROTASK.HAMMER_USE
      taskScheduler.enqueue('hamming-current', speed, this.onHamming, priority, capacity)
    } else {
      // fin animation outil (axe)
      eventBus.emit('tool/swing-end')
    }
  }

  /**
   * Point d'entrée unique depuis core.mjs (#processWorldClick).
   * Détermine la cible du martelage (wall, meuble, arbre) et délègue.
   * @param {number} tileIndex — (y << 10) | x
   * @param {object} tileNode  — NODES_LOOKUP[tileCode]
   * @param {object} tool      — ITEMS[slot.item], marteau équipé
   * @param {string} prefix    — slot.prefix
   */
  tryUse (tileIndex, tileNode, tool, prefix) {
    if (buffManager.getBuff('playerFreeze')) return

    if (tileNode !== null && tileNode.type & (NODE_TYPE.WALL | NODE_TYPE.BWALL)) {
      // TODO : unplacing de mur
      return
    }

    const furniture = furnitureManager.getFurnitureAt(tileIndex)
    if (furniture !== null) {
      this.tryUnplacing(tileIndex, furniture, tool, prefix)
      return
    }

    const plant = floraManager.getPlantAt(tileIndex)
    if (plant !== null && plant.kind === PLANT_KIND.TREE) {
      this.tryShaking(tileIndex, plant, tool, prefix)
    }
  }

  /**
   * Callback TaskScheduler : exécute l'action du hammer en tête de file,
   * distribue le loot, puis planifie la suivante si la file n'est pas vide.
   * Si l'arbre vient d'être détruit (size < 0), purge la file des entrées restantes pour
   * ce même arbre avant de planifier le prochain temps de coupe.
   */
  onHamming () {
    const entry = this.#queue.shift()
    if (entry === undefined) return

    if (entry.type === 'tree') {
      // Secouage de l'arbre
      const {tree} = entry
      const plantItem = ITEMS[tree.itemId]
      if (plantItem.shaking === undefined) { this.#scheduleNext(); return }

      // Loot standard shaking
      if (tree.shakedTimestamp === null) resolveLoot(plantItem.shaking)

      // Délègue la mutation de state au TreeSystem
      eventBus.emit(`shaked/${plantItem.code}`, tree.soilIndex)
    } else if (entry.type === 'furniture') {
      const {furniture} = entry
      if (furnitureManager.getFurnitureById(furniture.id) !== undefined) {
        furnitureManager.unplace(furniture.id)
        inventoryManager.loot(furniture.code, 1, '')
        eventBus.emit('furniture/unplaced', furniture.id)
      }
    } else if (entry.type === 'wall') {
      // TODO - unplacing de mur
    }

    this.#scheduleNext()
  }

  /**
   * Vérifie que l'on peut secouer l'arbre et place l'action dans la queue
   * @param {number} tileIndex — (y << 10) | x
   * @param {object} tree      — l'arbre à secouer
   * @param {object} tool      — ITEMS[slot.item], marteau équipé
   * @param {string} prefix    — slot.prefix
   */
  tryShaking (tileIndex, tree, tool, prefix) {
    if (!floraManager.canShake(tree)) return
    const plantItem = ITEMS[tree.itemId]
    if (!isInToolRange(tileIndex, tool, prefix, 'chopping-range')) { eventBus.emit('sound/play', 'toofar'); return }
    if (tree.blocked > 0) { eventBus.emit('sound/play', 'wrong'); return }

    if (tool.star < plantItem.star) { eventBus.emit('sound/play', 'wrong'); return }

    const speed = computeActionSpeed(plantItem.shaking.speed, tool.shaking.speed, 'chopping-speed', prefix)

    const wasEmpty = this.#queue.length === 0
    this.#queue.push({type: 'tree', tree, tool, prefix, speed})
    eventBus.emit('sound/play', 'chopping')

    if (wasEmpty) {
      eventBus.emit('tool/swing-start', {speed})
      const {priority, capacity} = MICROTASK.HAMMER_USE
      taskScheduler.enqueue('hamming-current', speed, this.onHamming, priority, capacity)
    }
  }

  /**
   * Vérifie que l'on peut retirer le meuble et place l'action dans la queue.
   * Silence si le meuble est IMMOVABLE (decomposer, transmutator...).
   * @param {number} tileIndex — (y << 10) | x
   * @param {object} furniture — le meuble à retirer
   * @param {object} tool      — ITEMS[slot.item], marteau équipé
   * @param {string} prefix    — slot.prefix
   */
  tryUnplacing (tileIndex, furniture, tool, prefix) {
    const furnitureItem = ITEMS[furniture.code]
    if (furnitureItem.type & ITEM_TYPE.IMMOVABLE) return

    if (!isInInteractionRange(tileIndex)) { eventBus.emit('sound/play', 'toofar'); return }
    if (tool.star < furnitureItem.star) { eventBus.emit('sound/play', 'wrong'); return }

    if (furniture.stype === 'chest' && !inventoryManager.isContainerEmpty(furniture.id)) {
      eventBus.emit('sound/play', 'wrong')
      return
    }

    const speed = computeActionSpeed(furnitureItem.unplacing.speed, tool.shaking.speed, 'chopping-speed', prefix)

    const wasEmpty = this.#queue.length === 0
    this.#queue.push({type: 'furniture', furniture, tool, prefix, speed})
    eventBus.emit('sound/play', 'placing')

    if (wasEmpty) {
      eventBus.emit('tool/swing-start', {speed})
      const {priority, capacity} = MICROTASK.HAMMER_USE
      taskScheduler.enqueue('hamming-current', speed, this.onHamming, priority, capacity)
    }
  }

  /**
   * Vide la file et annule la tâche planifiée.
   */
  #interrupt () {
    if (this.#queue.length === 0) return
    this.#queue.length = 0
    taskScheduler.dequeue('hamming-current')
    // annuler animation outil (axe)
    eventBus.emit('tool/swing-end')
  }

  /** Liaison EventBus : 'player/teleport-begin'. */
  onTeleportBegin () { this.#interrupt() }

  /**
   * Liaison EventBus : 'hotbar/slot-active' — interrompt si le nouveau slot n'est plus une axe.
   * @param {{slot: object}} payload
   */
  onSlotActive ({slot}) {
    if (slot.item && ITEMS[slot.item].type & ITEM_TYPE.TOOL && ITEMS[slot.item].stype === 'hammer') return
    this.#interrupt()
  }
}
export const hammingManager = new HammingManager()
