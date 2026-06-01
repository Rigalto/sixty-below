// inventory.mjs — InventoryManager · InventorySlot · InventoryOverlay

import {OVERLAYS, BAG_CAPACITY, HOTBAR_CAPACITY, ARMOR_CAPACITY, ARMOR_SLOT_LABELS, ACCESSORY_CAPACITY, CONTAINER_STYPES, CONTAINER_CAPACITY, ARMOR_SLOTS, PATH_RENAME, PATH_LOCKED, PATH_UNLOCKED, PATH_CRAFT, SVG_ICON, PATH_HELP, PATH_DEBUG, PATH_SPLIT, PATH_TRASH_DOWN, PATH_TRASH_UP, PATH_USE, PATH_WARNING, PATH_ARROW_RIGHT} from './constant.mjs'
import {eventBus, capitalize} from './utils.mjs'
import {createOverlayHeader} from './ui.mjs'
import {ITEMS, ITEM_TYPE} from '../../assets/data/data.mjs'
import {saveManager} from './persistence.mjs'
import {furnitureManager} from './housing.mjs'

/* ====================================================================================================
   INVENTORY MANAGER
   ====================================================================================================

   Autorité unique sur l'inventaire joueur et les containers du monde. Aucune logique DOM.
   Singleton : inventoryManager.

   Responsabilités :
     - Slots joueur : bag (64), hotbar (8), armor (3), accessories (5)
     - Containers furniture proches : Map<furnitureId, slots[]>
     - Tous les transferts entre containers (swap, stack, loot, craft)
     - Poubelle avec annulation (une entrée, effacée à la fermeture)
     - Persistance différée via SaveManager (#dirtyKeys)

   Interactions :
     furnitureManager  — fournit les containers proches (getNearbyContainers)
     saveManager       — persistance des slots modifiés (queueStaticUpdate)
     eventBus          — aucun abonnement direct ; notifié via les Overlays

   Structure DB (objectStore 'inventory') :
     Chaque slot est un enregistrement permanent (y compris vides).
     Seule opération DB : update. Jamais d'insert ou delete en temps réel.
     {key, container, furnitureId, item, count, prefix, slot, locked, deleted}

   Capacités :
     bag: 64 · hotbar: 8 · armor: 3 · accessory: 5
     chest: 56 · closet: 64 · cabinet: 48

   Sauvegarde :
     Seuls les slots dans #dirtyKeys sont écrits. Déclenchée à la fermeture de l'overlay.
   ==================================================================================================== */

class InventoryManager {
  // Joueur
  #bag = [] // Array(64)  — slots fixes, index = numéro de slot
  #hotbar = [] // Array(8)   — slots fixes
  #armor = [] // Array(3)   — HEAD=0, CHEST=1, FEET=2
  #accessories = [] // Array(5)   — slots fixes

  // Coffres du monde (chargés à l'ouverture de l'overlay)
  #containers = new Map() // Map<furnitureId, Array(capacity)>

  // Poubelle
  #trash = null // {item, count, prefix} | null — annulable jusqu'à fermeture

  // Persistance
  #dirtyKeys = new Set() // Set<number> — clés DB des slots modifiés

  // items octroyant des buffs
  #staticBuffs = {
    armor: new Array(ARMOR_CAPACITY).fill(''), // toujours ARMOR_CAPACITY entrées
    accessories: new Array(ACCESSORY_CAPACITY).fill(''), // toujours ACCESSORY_CAPACITY entrées
    trinkets: [] // variable — reset via length = 0
  }

  /**
   * Réinitialise toutes les structures mémoire.
   * À appeler au startSession avant les appels à initSlot.
   */
  init () {
    // Tableaux vides
    this.#bag.length = 0
    this.#hotbar.length = 0
    this.#armor.length = 0
    this.#accessories.length = 0
    this.#containers.clear()
    this.#trash = null
    this.#dirtyKeys.clear()
  }

  /**
   * Route un enregistrement DB vers le tableau mémoire correspondant.
   * À appeler pour chaque slot au startSession, après init().
   * @param {object} dbSlot — enregistrement DB individuel (bag/hotbar/armor/accessory)
   */
  initSlot (dbSlot) {
    const {container, slot, furnitureId} = dbSlot
    if (container === 'bag') {
      this.#bag[slot] = dbSlot
    } else if (container === 'hotbar') {
      this.#hotbar[slot] = dbSlot
    } else if (container === 'armor') {
      this.#armor[slot] = dbSlot
    } else if (container === 'accessory') {
      this.#accessories[slot] = dbSlot
    } else if (CONTAINER_STYPES.has(container)) {
      if (!this.#containers.has(furnitureId)) {
        this.#containers.set(furnitureId, [])
      }
      this.#containers.get(furnitureId)[slot] = dbSlot
    } else {
      console.error('InventoryManager.init container inconnu', container)
    }
  }

  /**
   * Finalise l'initialisation : vérifie la cohérence des capacités et signale
   * l'inventaire prêt via 'inventory/static-buffs'.
   * À appeler après tous les appels à initSlot().
   */
  initDone () {
    if (this.#bag.length !== BAG_CAPACITY) console.error(new Error(`[InventoryManager] bag: ${this.#bag.length} slots, attendu ${BAG_CAPACITY}`))
    if (this.#hotbar.length !== HOTBAR_CAPACITY) console.error(new Error(`[InventoryManager] hotbar: ${this.#hotbar.length} slots, attendu ${HOTBAR_CAPACITY}`))
    if (this.#armor.length !== ARMOR_CAPACITY) console.error(new Error(`[InventoryManager] armor: ${this.#armor.length} slots, attendu ${ARMOR_CAPACITY}`))
    if (this.#accessories.length !== ACCESSORY_CAPACITY) console.error(new Error(`[InventoryManager] accessories: ${this.#accessories.length} slots, attendu ${ACCESSORY_CAPACITY}`))
    for (const [furnitureId, slots] of this.#containers) {
      const expected = CONTAINER_CAPACITY[slots[0].container]
      if (slots.length !== expected) console.error(new Error(`[InventoryManager] container ${furnitureId}: ${slots.length} slots, attendu ${expected}`))
    }
    // on prévient le buff manager pour qu'il initialise les buffs statiques
    eventBus.emit('inventory/static-buffs', this.getStaticBuffs())
  }

  // ─── Accesseurs (lecture seule pour l'Overlay) ───────────────
  // Retournent les références directes aux tableaux internes.
  // Ne pas muter depuis l'extérieur — passer par les méthodes dédiées.

  get bag () { return this.#bag }
  get hotbar () { return this.#hotbar }
  get armor () { return this.#armor }
  get accessories () { return this.#accessories }

  /**
   * Retourne le tableau de slots d'un container furniture, ou undefined s'il n'est pas chargé.
   * @param {string} furnitureId
   * @returns {Array|undefined}
   */
  getContainer (furnitureId) { return this.#containers.get(furnitureId) }

  /**
   * Retourne la référence mémoire d'un slot joueur.
   * @param {string} container — 'bag' | 'hotbar' | 'armor' | 'accessory'
   * @param {number} index
   * @returns {object}
   */
  getSlot (container, index) { return this.#resolveContainer(container)[index] }

  /**
   * Retourne la référence mémoire d'un slot container-furniture.
   * @param {string} furnitureId
   * @param {number} index
   * @returns {object}
   */
  getContainerSlot (furnitureId, index) { return this.#containers.get(furnitureId)[index] }

  /**
   * Scanne l'inventaire et retourne la liste des itemIds donnant des buffs passifs.
   * Armor + accessoires équipés + trinkets présents dans le bag.
   * @returns {Array<string>}
   */
  getStaticBuffs () {
    for (let i = 0; i < ARMOR_CAPACITY; i++) {
      this.#staticBuffs.armor[i] = this.#armor[i].item
    }
    for (let i = 0; i < ACCESSORY_CAPACITY; i++) {
      this.#staticBuffs.accessories[i] = this.#accessories[i].item
    }
    this.#staticBuffs.trinkets.length = 0
    for (const slot of this.#bag) {
      if (slot.item !== '' && (ITEMS[slot.item].type & ITEM_TYPE.TRINKET)) {
        this.#staticBuffs.trinkets.push(slot.item)
      }
    }
    return this.#staticBuffs
  }

  // ─── Fonctions privées utiitaires ──────────────────────────────────

  /**
   * Dépose un item dans le bag : stack sur item identique (même prefix) en priorité,
   * sinon premier slot libre. Sans effet si le bag est plein.
   * @param {string} item
   * @param {number} count
   * @param {string} prefix
   */
  #depositInBag (item, count, prefix) {
    // Passe 1 — stack
    for (const slot of this.#bag) {
      if (slot.locked || slot.item !== item || slot.prefix !== prefix) continue
      slot.count += count
      this.#dirtyKeys.add(slot)
      return
    }
    // Passe 2 — premier slot libre
    for (const slot of this.#bag) {
      if (slot.locked || slot.item !== '') continue
      slot.item = item
      slot.count = count
      slot.prefix = prefix
      this.#dirtyKeys.add(slot)
      return
    }
    // passe 3 - aucun slot libre - traitement à définir
  }

  /**
   * Retourne le tableau interne correspondant au container.
   * @param {string} container — 'bag' | 'hotbar' | 'armor' | 'accessory'
   * @returns {Array}
   */
  #resolveContainer (container) {
    if (container === 'bag') return this.#bag
    if (container === 'hotbar') return this.#hotbar
    if (container === 'armor') return this.#armor
    if (container === 'accessory') return this.#accessories
    console.error(new Error(`[InventoryManager] container inconnu : ${container}`))
    return null
  }

  /**
   * Swap ou stack deux slots.
   * Stack si item et prefix identiques, swap sinon.
   * Sans effet si l'un des slots est locked.
   * @param {object} slotA
   * @param {object} slotB
   */
  #swapOrStack (slotA, slotB) {
    if (slotA.locked || slotB.locked) return
    if (slotA.item === slotB.item && slotA.prefix === slotB.prefix && slotA.item !== '') {
      slotB.count += slotA.count
      slotA.item = ''
      slotA.count = 0
      slotA.prefix = ''
    } else {
      const item = slotA.item
      const count = slotA.count
      const prefix = slotA.prefix
      slotA.item = slotB.item
      slotA.count = slotB.count
      slotA.prefix = slotB.prefix
      slotB.item = item
      slotB.count = count
      slotB.prefix = prefix
    }
    this.#dirtyKeys.add(slotA)
    this.#dirtyKeys.add(slotB)
  }

  // ─── Transferts intra-container ──────────────────────────────

  /**
   * Déplace un item entre deux slots d'un même container (swap ou stack).
   * Sans effet si le container est inconnu ou les index identiques.
   * @param {string} container — 'bag' | 'hotbar' | 'accessory'
   * @param {number} sourceIndex
   * @param {number} targetIndex
   */
  moveWithinContainer (container, sourceIndex, targetIndex) {
    if (sourceIndex === targetIndex) return
    const slots = this.#resolveContainer(container)
    if (slots === null) return
    this.#swapOrStack(slots[sourceIndex], slots[targetIndex])
  }

  /**
   * Déplace un item entre deux slots d'un coffre (swap ou stack).
   * Sans effet si le coffre est inconnu ou les index identiques.
   * @param {string} furnitureId
   * @param {number} sourceIndex
   * @param {number} targetIndex
   */
  moveWithinChest (furnitureId, sourceIndex, targetIndex) {
    if (sourceIndex === targetIndex) return
    const slots = this.#containers.get(furnitureId)
    if (slots === undefined) return
    this.#swapOrStack(slots[sourceIndex], slots[targetIndex])
  }

  /**
   * Décrémente le count d'un slot du bag. Vide le slot si count atteint 0.
   * @param {number} slotIndex
   * @returns {object} — slot mis à jour
   */
  decrementBagSlotCount (slotIndex) {
    const slot = this.#bag[slotIndex]
    slot.count -= 1
    if (slot.count === 0) {
      slot.item = ''
      slot.prefix = ''
    }
    this.#dirtyKeys.add(slot)
    return slot
  }

  /**
   * Décrémente le count d'un slot de la hotbar. Vide le slot si count atteint 0.
   * @param {number} slotIndex
   * @returns {object} — slot mis à jour
   */
  decrementHotbarSlotCount (slotIndex) {
    const slot = this.#hotbar[slotIndex]
    slot.count -= 1
    if (slot.count === 0) {
      slot.item = ''
      slot.prefix = ''
    }
    this.#dirtyKeys.add(slot)
    return slot
  }

  // ─── Transferts Hotbar ───────────────────────────────────────

  /**
   * Déplace un item du bag vers la hotbar (swap ou stack).
   * @param {number} sourceIndex
   * @param {number} targetIndex
   */
  moveBagToHotbar (sourceIndex, targetIndex) {
    this.#swapOrStack(this.#bag[sourceIndex], this.#hotbar[targetIndex])
  }

  /**
   * Déplace un item de la hotbar vers le bag (swap ou stack).
   * @param {number} sourceIndex
   * @param {number} targetIndex
   */
  moveHotbarToBag (sourceIndex, targetIndex) {
    this.#swapOrStack(this.#hotbar[sourceIndex], this.#bag[targetIndex])
  }

  // ─── Transferts Accessory ────────────────────────────────────

  /**
   * Déplace un accessoire du bag vers un slot accessoire.
   * Si le slot destination est occupé, l'item délogé est déposé dans le bag.
   * Opération abandonnée si l'item source n'est pas ACCESSORY ou si le slot
   * destination est occupé et le bag est plein.
   * @param {number} sourceIndex
   * @param {number} targetIndex
   * @returns {{srcSlot, destSlot, depositSlot}|null}
   */
  moveBagToAccessory (sourceIndex, targetIndex) {
    const src = this.#bag[sourceIndex]
    const dest = this.#accessories[targetIndex]

    // Vérification item source
    if (!(ITEMS[src.item].type & ITEM_TYPE.ACCESSORY)) return null

    // Si destination occupée, vérifier qu'il y a de la place dans le bag
    let depositSlot = null
    if (dest.item !== '') {
      // Si le slot source va se vider, il devient le depositSlot en priorité
      if (src.count === 1) {
        depositSlot = src
      } else {
        depositSlot = this.#findDepositSlot(dest.item, dest.prefix)
        if (depositSlot === null) return null
      }
    }

    // Décrémentation source
    src.count -= 1
    const itemToPlace = src.item
    const prefixToPlace = src.prefix
    if (src.count === 0) {
      src.item = ''
      src.prefix = ''
    }
    this.#dirtyKeys.add(src)

    // Dépose dans destination
    if (dest.item !== '') {
      depositSlot.item = dest.item
      depositSlot.count += dest.item === depositSlot.item ? 1 : 1
      depositSlot.prefix = dest.prefix
      this.#dirtyKeys.add(depositSlot)
    }

    dest.item = itemToPlace
    dest.count = 1
    dest.prefix = prefixToPlace
    this.#dirtyKeys.add(dest)

    return {srcSlot: src, destSlot: dest, depositSlot}
  }

  /**
   * Trouve un slot de dépôt dans le bag (stack ou premier libre).
   * @param {string} item
   * @param {string} prefix
   * @returns {object|null}
   */
  #findDepositSlot (item, prefix) {
    for (const slot of this.#bag) {
      if (slot.locked || slot.item !== item || slot.prefix !== prefix) continue
      return slot
    }
    for (const slot of this.#bag) {
      if (slot.locked || slot.item !== '') continue
      return slot
    }
    return null
  }

  /**
   * Déplace un accessoire de la zone accessoire vers le bag.
   * @param {number} sourceIndex
   * @param {number} targetIndex
   * @returns {{srcSlot, destSlot, depositSlot}|null}
   */
  moveAccessoryToBag (sourceIndex, targetIndex) {
    const src = this.#accessories[sourceIndex]
    const dest = this.#bag[targetIndex]

    if (src.item === '') return null

    // Slot destination vide
    if (dest.item === '') {
      dest.item = src.item
      dest.count = 1
      dest.prefix = src.prefix
      src.item = ''
      src.count = 0
      src.prefix = ''
      this.#dirtyKeys.add(src)
      this.#dirtyKeys.add(dest)
      return {srcSlot: src, destSlot: dest, depositSlot: null}
    }

    // Slot destination même item → stack
    if (dest.item === src.item && dest.prefix === src.prefix) {
      dest.count += 1
      src.item = ''
      src.count = 0
      src.prefix = ''
      this.#dirtyKeys.add(src)
      this.#dirtyKeys.add(dest)
      return {srcSlot: src, destSlot: dest, depositSlot: null}
    }

    // Slot destination item différent, count === 1, accessoire → swap 1↔1
    if (ITEMS[dest.item].type & ITEM_TYPE.ACCESSORY && dest.count === 1) {
      const tmpItem = dest.item
      const tmpPrefix = dest.prefix
      dest.item = src.item
      dest.count = 1
      dest.prefix = src.prefix
      src.item = tmpItem
      src.count = 1
      src.prefix = tmpPrefix
      this.#dirtyKeys.add(src)
      this.#dirtyKeys.add(dest)
      return {srcSlot: src, destSlot: dest, depositSlot: null}
    }

    // Slot destination item différent, count > 1, accessoire
    if (ITEMS[dest.item].type & ITEM_TYPE.ACCESSORY && dest.count > 1) {
      const depositSlot = this.#findDepositSlot(src.item, src.prefix)
      if (depositSlot === null) return null
      depositSlot.item = src.item
      depositSlot.count = depositSlot.item === src.item ? depositSlot.count + 1 : 1
      depositSlot.prefix = src.prefix
      src.item = dest.item
      src.count = 1
      src.prefix = dest.prefix
      dest.count -= 1
      this.#dirtyKeys.add(src)
      this.#dirtyKeys.add(dest)
      this.#dirtyKeys.add(depositSlot)
      return {srcSlot: src, destSlot: dest, depositSlot}
    }

    // Slot destination item différent, pas un accessoire
    const depositSlot = this.#findDepositSlot(src.item, src.prefix)
    if (depositSlot === null) return null
    depositSlot.item = depositSlot.item === src.item ? depositSlot.item : src.item
    depositSlot.count = depositSlot.item === src.item ? depositSlot.count + 1 : 1
    depositSlot.prefix = src.prefix
    src.item = ''
    src.count = 0
    src.prefix = ''
    this.#dirtyKeys.add(src)
    this.#dirtyKeys.add(depositSlot)
    return {srcSlot: src, destSlot: dest, depositSlot}
  }

  // ─── Transferts Armor ────────────────────────────────────────

  /**
   * Déplace une pièce d'armure du bag vers un slot armure.
   * Vérifie que le stype de l'item correspond au slot cible.
   * Si le slot destination est occupé, l'item délogé est déposé dans le bag.
   * Opération abandonnée si stype incorrect ou bag plein.
   * @param {number} sourceIndex
   * @param {number} targetIndex
   * @returns {{srcSlot, destSlot, depositSlot}|null}
   */
  moveBagToArmor (sourceIndex, targetIndex) {
    const src = this.#bag[sourceIndex]
    const dest = this.#armor[targetIndex]

    // Vérification type d'armure
    if (ITEMS[src.item].armor !== ARMOR_SLOTS[targetIndex]) return null

    // Si destination occupée, vérifier qu'il y a de la place dans le bag
    let depositSlot = null
    if (dest.item !== '') {
      if (src.count === 1) {
        depositSlot = src
      } else {
        depositSlot = this.#findDepositSlot(dest.item, dest.prefix)
        if (depositSlot === null) return null
      }
    }

    // Décrémentation source
    src.count -= 1
    const itemToPlace = src.item
    const prefixToPlace = src.prefix
    if (src.count === 0) {
      src.item = ''
      src.prefix = ''
    }
    this.#dirtyKeys.add(src)

    // Dépose l'item délogé dans le depositSlot
    if (dest.item !== '') {
      depositSlot.item = dest.item
      depositSlot.count = depositSlot === src ? 1 : depositSlot.count + 1
      depositSlot.prefix = dest.prefix
      this.#dirtyKeys.add(depositSlot)
    }

    dest.item = itemToPlace
    dest.count = 1
    dest.prefix = prefixToPlace
    this.#dirtyKeys.add(dest)

    return {srcSlot: src, destSlot: dest, depositSlot}
  }

  /**
   * Déplace une pièce d'armure de la zone armure vers le bag.
   * @param {number} sourceIndex
   * @param {number} targetIndex
   * @returns {{srcSlot, destSlot, depositSlot}|null}
   */
  moveArmorToBag (sourceIndex, targetIndex) {
    const src = this.#armor[sourceIndex]
    const dest = this.#bag[targetIndex]

    if (src.item === '') return null

    // Slot destination vide
    if (dest.item === '') {
      dest.item = src.item
      dest.count = 1
      dest.prefix = src.prefix
      src.item = ''
      src.count = 0
      src.prefix = ''
      this.#dirtyKeys.add(src)
      this.#dirtyKeys.add(dest)
      return {srcSlot: src, destSlot: dest, depositSlot: null}
    }

    // Slot destination même item → stack
    if (dest.item === src.item && dest.prefix === src.prefix) {
      dest.count += 1
      src.item = ''
      src.count = 0
      src.prefix = ''
      this.#dirtyKeys.add(src)
      this.#dirtyKeys.add(dest)
      return {srcSlot: src, destSlot: dest, depositSlot: null}
    }

    // Slot destination item différent, count === 1, même armor → swap 1↔1
    if (ITEMS[dest.item].armor === ITEMS[src.item].armor && dest.count === 1) {
      const tmpItem = dest.item
      const tmpPrefix = dest.prefix
      dest.item = src.item
      dest.count = 1
      dest.prefix = src.prefix
      src.item = tmpItem
      src.count = 1
      src.prefix = tmpPrefix
      this.#dirtyKeys.add(src)
      this.#dirtyKeys.add(dest)
      return {srcSlot: src, destSlot: dest, depositSlot: null}
    }

    // Slot destination item différent, count > 1, même armor
    if (ITEMS[dest.item].armor === ITEMS[src.item].armor && dest.count > 1) {
      const depositSlot = this.#findDepositSlot(src.item, src.prefix)
      if (depositSlot === null) return null
      if (depositSlot.item === '') {
        depositSlot.item = src.item
        depositSlot.prefix = src.prefix
        depositSlot.count = 1
      } else {
        depositSlot.count += 1
      }
      src.item = dest.item
      src.count = 1
      src.prefix = dest.prefix
      dest.count -= 1
      this.#dirtyKeys.add(src)
      this.#dirtyKeys.add(dest)
      this.#dirtyKeys.add(depositSlot)
      return {srcSlot: src, destSlot: dest, depositSlot}
    }

    // Slot destination item différent, pas même armor
    const depositSlot = this.#findDepositSlot(src.item, src.prefix)
    if (depositSlot === null) return null
    if (depositSlot.item === '') {
      depositSlot.item = src.item
      depositSlot.prefix = src.prefix
      depositSlot.count = 1
    } else {
      depositSlot.count += 1
    }
    src.item = ''
    src.count = 0
    src.prefix = ''
    this.#dirtyKeys.add(src)
    this.#dirtyKeys.add(depositSlot)
    return {srcSlot: src, destSlot: dest, depositSlot}
  }

  // ─── Transferts Chest ────────────────────────────────────────

  /**
   * Déplace un item du bag vers un slot d'un coffre (swap ou stack).
   * Sans effet si le coffre est inconnu.
   * @param {string} furnitureId
   * @param {number} sourceIndex
   * @param {number} targetIndex
   */
  moveBagToChest (furnitureId, sourceIndex, targetIndex) {
    const slots = this.#containers.get(furnitureId)
    if (slots === undefined) return
    this.#swapOrStack(this.#bag[sourceIndex], slots[targetIndex])
  }

  /**
   * Déplace un item d'un coffre vers le bag (swap ou stack).
   * Sans effet si le coffre est inconnu.
   * @param {string} furnitureId
   * @param {number} sourceIndex
   * @param {number} targetIndex
   */
  moveChestToBag (furnitureId, sourceIndex, targetIndex) {
    const slots = this.#containers.get(furnitureId)
    if (slots === undefined) return
    this.#swapOrStack(slots[sourceIndex], this.#bag[targetIndex])
  }

  // ─── Transferts poubelle ─────────────────────────────────────

  /**
   * Déplace le contenu d'un slot bag vers la poubelle.
   * Écrase l'éventuel contenu précédent (une seule annulation possible).
   * @param {number} slotIndex
   * @returns {object} — slot vidé
   */
  trashFromBag (slotIndex) {
    const src = this.#bag[slotIndex]
    this.#trash = {item: src.item, count: src.count, prefix: src.prefix}
    src.item = ''
    src.count = 0
    src.prefix = ''
    this.#dirtyKeys.add(src.key)
    return src
  }

  /**
   * Restaure le contenu de la poubelle dans le bag (stack ou premier slot libre).
   * Sans effet si la poubelle est vide.
   */
  restoreTrash () {
    if (this.#trash === null) return
    this.#depositInBag(this.#trash.item, this.#trash.count, this.#trash.prefix)
    this.#trash = null
  }

  // ─── Verrouillage ────────────────────────────────────────────

  /**
   * Inverse l'état locked d'un slot et le marque dirty.
   * @param {object} slot — référence directe au slot en mémoire
   * @returns {boolean} — nouvel état locked
   */
  toggleLock (slot) {
    slot.locked = !slot.locked
    this.#dirtyKeys.add(slot)
    return slot.locked
  }

  // ─── Séparation pile ─────────────────────────────────────────

  /**
   * Sépare une pile en deux. La portion extraite est déposée dans le bag
   * (p)remier slot libre).
   * Sans effet si le bag est plein.
   * @param {object} srcSlot — slot source (référence mémoire)
   * @param {number} count — quantité à extraire
   * @returns {object|null} — slot destination modifié, ou null si bag plein
   */
  splitSlot (srcSlot, count) {
    // Premier slot libre
    for (const slot of this.#bag) {
      if (slot.locked || slot.item !== '') continue
      slot.item = srcSlot.item
      slot.count = count
      slot.prefix = srcSlot.prefix
      srcSlot.count -= count
      this.#dirtyKeys.add(slot)
      this.#dirtyKeys.add(srcSlot)
      return slot
    }
    return null
  }

  // ─── Transferts rapides ──────────────────────────────────────

  /**
   * Déplace le contenu d'un slot bag vers le coffre actif.
   * Stack sur item identique en priorité, sinon premier slot libre.
   * @param {number} sourceIndex
   * @param {string} furnitureId
   * @returns {object|null} — slot destination modifié, ou null si coffre plein
   */
  moveBagToChestAuto (sourceIndex, furnitureId) {
    const src = this.#bag[sourceIndex]
    const slots = this.#containers.get(furnitureId)
    if (slots === undefined) return null
    // Passe 1 — stack
    for (const slot of slots) {
      if (slot.locked || slot.item !== src.item || slot.prefix !== src.prefix) continue
      slot.count += src.count
      src.item = ''
      src.count = 0
      src.prefix = ''
      this.#dirtyKeys.add(slot)
      this.#dirtyKeys.add(src)
      return slot
    }
    // Passe 2 — premier slot libre
    for (const slot of slots) {
      if (slot.locked || slot.item !== '') continue
      slot.item = src.item
      slot.count = src.count
      slot.prefix = src.prefix
      src.item = ''
      src.count = 0
      src.prefix = ''
      this.#dirtyKeys.add(slot)
      this.#dirtyKeys.add(src)
      return slot
    }
    return null
  }

  /**
   * Déplace le contenu d'un slot du coffre actif vers le bag.
   * Stack sur item identique en priorité, sinon premier slot libre.
   * @param {string} furnitureId
   * @param {number} sourceIndex
   * @returns {object|null} — slot destination modifié, ou null si bag plein
   */
  moveChestToBagAuto (furnitureId, sourceIndex) {
    const slots = this.#containers.get(furnitureId)
    if (slots === undefined) return null
    const src = slots[sourceIndex]
    // Passe 1 — stack
    for (const slot of this.#bag) {
      if (slot.locked || slot.item !== src.item || slot.prefix !== src.prefix) continue
      slot.count += src.count
      src.item = ''
      src.count = 0
      src.prefix = ''
      this.#dirtyKeys.add(slot)
      this.#dirtyKeys.add(src)
      return slot
    }
    // Passe 2 — premier slot libre
    for (const slot of this.#bag) {
      if (slot.locked || slot.item !== '') continue
      slot.item = src.item
      slot.count = src.count
      slot.prefix = src.prefix
      src.item = ''
      src.count = 0
      src.prefix = ''
      this.#dirtyKeys.add(slot)
      this.#dirtyKeys.add(src)
      return slot
    }
    return null
  }

  // ─── Loot vers inventaire ────────────────────────────────────

  /**
   * Place un item looté dans l'inventaire (bag ou hotbar).
   * Priorité : stack bag → stack hotbar → premier libre bag → premier libre hotbar.
   * @param {string} item
   * @param {number} count
   * @param {string} prefix
   */
  loot (item, count, prefix) {
    // Stack bag
    for (const slot of this.#bag) {
      if (slot.locked || slot.item !== item || slot.prefix !== prefix) continue
      slot.count += count
      this.#dirtyKeys.add(slot)
      return
    }
    // Stack hotbar
    for (const slot of this.#hotbar) {
      if (slot.locked || slot.item !== item || slot.prefix !== prefix) continue
      slot.count += count
      this.#dirtyKeys.add(slot)
      return
    }
    // Premier libre bag
    for (const slot of this.#bag) {
      if (slot.locked || slot.item !== '') continue
      slot.item = item
      slot.count = count
      slot.prefix = prefix
      this.#dirtyKeys.add(slot)
      return
    }
    // Premier libre hotbar
    for (const slot of this.#hotbar) {
      if (slot.locked || slot.item !== '') continue
      slot.item = item
      slot.count = count
      slot.prefix = prefix
      this.#dirtyKeys.add(slot)
      return
    }
    console.error(new Error(`[InventoryManager] loot impossible, inventaire plein : ${item}`))
  }

  // ─── Sauvegarde ──────────────────────────────────────────────

  /**
   * Sauvegarde les slots modifiés via le SaveManager.
   * À appeler à la fermeture de l'overlay.
   */
  save () {
    if (this.#dirtyKeys.size === 0) return
    const updates = []
    for (const slot of this.#dirtyKeys) {
      updates.push({storeName: 'inventory', record: slot})
    }
    saveManager.queueStaticUpdate(updates)
    this.#dirtyKeys.clear()
  }

  // ─── Gestion du craft ────────────────────────────────────────

  /**
   * Accumule les items MATERIAL du bag et de la hotbar dans l'objet passé.
   * @param {object} obj — accumulateur {itemCode: count}
   */
  fillMaterialsFromPlayer (obj) {
    for (const slot of this.#bag) {
      if (slot.item === '') continue
      if (!(ITEMS[slot.item].type & ITEM_TYPE.MATERIAL)) continue
      obj[slot.item] = (obj[slot.item] ?? 0) + slot.count
    }
    for (const slot of this.#hotbar) {
      if (slot.item === '') continue
      if (!(ITEMS[slot.item].type & ITEM_TYPE.MATERIAL)) continue
      obj[slot.item] = (obj[slot.item] ?? 0) + slot.count
    }
  }

  /**
   * Accumule les items MATERIAL d'un container dans l'objet passé.
   * @param {object} obj        — accumulateur {itemCode: count}
   * @param {string} furnitureId
   */
  fillMaterialsFromContainer (obj, furnitureId) {
    const slots = this.#containers.get(furnitureId)
    if (!slots) return
    for (const slot of slots) {
      if (slot.item === '') continue
      if (!(ITEMS[slot.item].type & ITEM_TYPE.MATERIAL)) continue
      obj[slot.item] = (obj[slot.item] ?? 0) + slot.count
    }
  }

  /**
   * Vérifie si le bag peut accueillir une liste d'items (résultat de craft).
   * Simule sans modifier l'inventaire.
   * @param {Array<{code: string, count: number}>} items
   * @returns {boolean}
   */
  canReceiveFromCraft (items) {
    let freeSlots = 0
    for (const slot of this.#bag) {
      if (!slot.locked && slot.item === '') freeSlots++
    }

    for (const {code} of items) {
      let canStack = false

      for (const slot of this.#bag) {
        if (!slot.locked && slot.item === code && slot.prefix === '') { canStack = true; break }
      }

      if (!canStack) {
        for (const slot of this.#hotbar) {
          if (!slot.locked && slot.item === code && slot.prefix === '') { canStack = true; break }
        }
      }

      if (canStack) continue

      if (freeSlots > 0) { freeSlots--; continue }

      return false
    }

    return true
  }

  /**
   * Ajoute les items résultats d'un craft dans l'inventaire.
   * Même paramètre que canReceiveFromCraft — appeler uniquement après validation.
   * @param {Array<{code: string, count: number}>} items
   */
  craftReceive (items) {
    for (const {code, count} of items) {
      this.loot(code, count, '')
    }
  }

  /**
   * Retire count items du bag puis de la hotbar.
   * @param {string} itemCode
   * @param {number} count
   * @returns {number} — restant non retiré (0 si tout consommé)
   */
  removeFromPlayer (itemCode, count) {
    let remaining = count

    for (const slot of this.#bag) {
      if (remaining === 0) break
      if (slot.item !== itemCode) continue
      const removed = Math.min(slot.count, remaining)
      slot.count -= removed
      remaining -= removed
      if (slot.count === 0) { slot.item = ''; slot.prefix = '' }
      this.#dirtyKeys.add(slot)
    }

    for (const slot of this.#hotbar) {
      if (remaining === 0) break
      if (slot.item !== itemCode) continue
      const removed = Math.min(slot.count, remaining)
      slot.count -= removed
      remaining -= removed
      if (slot.count === 0) { slot.item = ''; slot.prefix = '' }
      this.#dirtyKeys.add(slot)
    }

    return remaining
  }

  /**
   * Retire count items d'un container furniture.
   * @param {string} furnitureId
   * @param {string} itemCode
   * @param {number} count
   * @returns {number} — restant non retiré
   */
  removeFromContainer (furnitureId, itemCode, count) {
    const slots = this.#containers.get(furnitureId)
    if (!slots) return count

    let remaining = count

    for (const slot of slots) {
      if (remaining === 0) break
      if (slot.item !== itemCode) continue
      const removed = Math.min(slot.count, remaining)
      slot.count -= removed
      remaining -= removed
      if (slot.count === 0) { slot.item = ''; slot.prefix = '' }
      this.#dirtyKeys.add(slot)
    }

    return remaining
  }
}
export const inventoryManager = new InventoryManager()

/* ====================================================================================================
   CSS
   ==================================================================================================== */

// injection des classes HTML utilisées par l'inventory Overlay
const inventorySlotStyle = document.createElement('style')
inventorySlotStyle.textContent = /* css */`
inventory-slot {
  position: relative;
  display: inline-block;
  width: 64px;
  height: 64px;
  border-radius: 6px;
  background-color: var(--slot-bg-default);
  color: white;
  border: 3px solid #888;
  box-sizing: border-box;
  cursor: pointer;
  transition: border-color 0.15s;
}

inventory-slot.hotbar {
  background-color: var(--slot-bg-hotbar);
  color: black;
}

inventory-slot.armor { background-color: var(--slot-bg-armor); }
inventory-slot.armor.slot-armor-set { background-color: var(--slot-bg-armor-set); }
inventory-slot.accessory { background-color: var(--slot-bg-accessory); }
inventory-slot.inactive {
  background-color: var(--slot-bg-inactive);
  cursor: default;
}

inventory-slot:hover {
  border-color: #f1a15bff;  /* gris clair — neutre sur tous les fonds */
}

inventory-slot.inactive:hover {
  border-color: #888;
}

inventory-slot.selected,
inventory-slot.selected:hover {
  border-color: #f80;  /* orange prime sur le hover */
}

inventory-slot .key {
  position: absolute;
  top: 3px;
  left: 4px;
  font-size: 12px;
  line-height: 1;
  pointer-events: none;
}

inventory-slot .lock {
  position: absolute;
  top: 2px;
  right: 3px;
  font-size: 11px;
  pointer-events: none;
}

inventory-slot .image {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  image-rendering: pixelated;
  pointer-events: none;
}

inventory-slot .count {
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: black;
  line-height: 1;
  pointer-events: none;
}

inventory-slot .hidden {
  display: none;
}

/* ── Overlay ───────────────────────────────────────── */

#ui-inventory-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
    width: 1274px;
    height: 682px;
  background-color: var(--ov-bg-main);
  border: 1px solid var(--ov-border);
  box-shadow: 0 10px 30px rgba(0,0,0,0.8);
  border-radius: 4px;
  z-index: ${OVERLAYS.inventory.zIndex};
  display: none;
  flex-direction: column;
  font-family: Segoe UI, Roboto, sans-serif;
  color: #ffffff;
  user-select: none;
}

#ui-inventory-panel .inv-content {
  display: grid;
  grid-template-columns: 74px 196px 346px 60px 550px;
  grid-template-rows: 74px 468px 74px;
  gap: 8px;
  padding: 8px;
}

#ui-inventory-panel .inv-hotbar    { grid-column: 1; grid-row: 1 / 4; }
#ui-inventory-panel .inv-bag       { grid-column: 2 / 4; grid-row: 1 / 3; }
#ui-inventory-panel .inv-armor     { grid-column: 2; grid-row: 3; }
#ui-inventory-panel .inv-accessory { grid-column: 3; grid-row: 3; }
#ui-inventory-panel .inv-chest-header { grid-column: 5; grid-row: 1; }
#ui-inventory-panel .inv-chest     { grid-column: 5; grid-row: 2 / 4; }

#ui-inventory-panel .inv-actions {
  grid-column: 4;
  grid-row: 1 / 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 4px;
  margin: 12px;
}

#ui-inventory-panel .inv-panel {
  background-color: var(--ov-bg-side);
  border-radius: 4px;
  padding: 4px;
}

#ui-inventory-panel .inv-hotbar-grid {
  display: grid;
  grid-template-columns: 64px;
  grid-template-rows: repeat(8, 64px);
  gap: 4px;
}

#ui-inventory-panel .inv-armor-grid {
  display: grid;
  grid-template-columns: repeat(3, 64px);
  grid-template-rows: 64px;
  gap: 4px;
}

#ui-inventory-panel .inv-accessory-grid {
  display: grid;
  grid-template-columns: repeat(5, 64px);
  grid-template-rows: 64px;
  gap: 4px;
}

#ui-inventory-panel .inv-action-btn svg {
  width: 100%;
  height: 100%;
}

#ui-inventory-panel .inv-action-btn {
  background-color: transparent;
  border: 1px solid #444;
  border-radius: 4px;
  color: #bdc3c7;
  cursor: pointer;
  padding: 6px;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}

#ui-inventory-panel .inv-action-btn:hover {
  border-color: #bdc3c7;
  color: #ffffff;
}

#ui-inventory-panel .inv-action-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

#ui-inventory-panel .inv-action-btn:disabled:hover {
  border-color: #444;
  color: #bdc3c7;
}

#ui-inventory-panel .inv-action-btn .lock-closed { display: block; }
#ui-inventory-panel .inv-action-btn .lock-open { display: none; }
#ui-inventory-panel .inv-action-btn.unlocking .lock-closed { display: none; }
#ui-inventory-panel .inv-action-btn.unlocking .lock-open { display: block; }

#ui-inventory-panel .inv-bag-grid,
#ui-inventory-panel .inv-chest-grid  {
  display: grid;
  grid-template-columns: repeat(8, 64px);
  grid-template-rows: repeat(8, 64px);
  gap: 4px;
}

#ui-inventory-panel .inv-chest-grid {
  display: grid;
  grid-template-columns: repeat(8, 64px);
  grid-template-rows: repeat(8, 64px);
  gap: 4px;
}

#ui-inventory-panel .inv-chest-header-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 8px;
  background-color: var(--ov-bg-side);
}

#ui-inventory-panel .inv-chest-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

#ui-inventory-panel .inv-chest-icon {
  width: 32px;
  height: 32px;
  background-color: var(--slot-bg-default);
  border-radius: 4px;
  border: 3px solid #666;
  align-self: flex-start;
  image-rendering: pixelated;
}

#ui-inventory-panel .inv-chest-rename-input,
#ui-inventory-panel .inv-chest-select {
  flex: 1;
  background-color: var(--ov-bg-input);
  color: var(--ov-text);
  border: 1px solid var(--ov-border-sub);
  border-radius: 3px;
  font-size: 13px;
  padding: 2px 4px;
}

#ui-inventory-panel .inv-chest-rename-input:focus,
#ui-inventory-panel .inv-chest-select:focus {
  border-color: var(--ov-accent);
}

#ui-inventory-panel .inv-chest-rename {
  background-color: transparent;
  color: #bdc3c7;
  border: none;
  cursor: pointer;
  font-size: 16px;
}

#ui-inventory-panel .inv-chest-rename:disabled {
  opacity: 0.4;
  cursor: default;
}

#ui-inventory-panel .inv-chest-rename:hover:not(:disabled) {
  color: var(--ov-text);
}

#ui-inventory-panel .inv-chest-rename-form {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

#ui-inventory-panel .inv-chest-rename-label {
  font-size: 14px;
  color: var(--ov-text);
  white-space: nowrap;
}

#ui-inventory-panel .inv-chest-rename-confirm,
#ui-inventory-panel .inv-chest-rename-cancel {
  width: 26px;
  height: 26px;
  background-color: var(--ov-btn-bg);
  border: 1px solid var(--ov-border-sub);
  border-radius: 3px;
  cursor: pointer;
  font-size: 18px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
}

#ui-inventory-panel .inv-chest-rename-confirm:hover {
  background-color: #1a3d1a;
  border-color: #3a7a3a;
}

#ui-inventory-panel .inv-chest-rename-cancel:hover {
  background-color: #3d1a1a;
  border-color: #7a3a3a;
}

#ui-inventory-panel .inv-chest-rename-confirm {
  color: #2ecc71;
}

#ui-inventory-panel .inv-chest-rename-cancel {
  color: #e74c3c;
}

#ui-inventory-panel .inv-chest-rename-form.hidden {
  display: none;
}

#ui-inventory-panel .inv-chest-header {
  position: relative;
}

#ui-inventory-panel .inv-save-warning {
  position: absolute;
  top: 52px;  /* hauteur du inv-chest-header-content fermé + gap */
  left: 8px;
  font-size: 20px;
  color: var(--ov-text-orange);
  cursor: default;
  z-index: 0;
}

#ui-inventory-panel .inv-chest-header-content {
  position: relative;
  z-index: 1;  /* ← recouvre le texte quand agrandi */
}

#ui-inventory-panel .inv-action-btn.transfer-left .transfer-icon {
  transform: scaleX(-1);
}

.inv-drag-ghost {
  position: fixed;
  pointer-events: none;
  image-rendering: pixelated;
  transform: translate(-50%, -50%);
  z-index: 9999;
  opacity: 0.8;
}
`
document.head.appendChild(inventorySlotStyle)

/* ====================================================================================================
   INVENTORY SLOT (Custom Element)
   ====================================================================================================

   Web Component <inventory-slot> — représente visuellement un slot d'inventaire.
   Réactif aux attributs : item, count, locked, usable.

   Attributs :
     item     — itemId dans ITEMS ; '' = slot vide
     count    — quantité (number as string)
     locked   — attribut booléen (présent/absent)
     usable   — plafond pour l'affichage 'count/usable' (optionnel)

   Interactions :
     Lit ITEMS pour récupérer l'image sprite à afficher.
     Aucune écriture — lecture seule de l'état métier.
     Le DOM interne est construit dans connectedCallback (pas dans le constructeur)
     pour garantir que l'élément est dans le DOM avant toute manipulation.
   ==================================================================================================== */

class InventorySlot extends HTMLElement {
  /**
   * Attributs observés par le Web Component.
   * Toute modification déclenche attributeChangedCallback.
   */
  static get observedAttributes () {
    return ['item', 'count', 'locked', 'usable']
  }

  /**
   * Lifecycle Web Component — appelé à l'insertion dans le DOM.
   * Construit le HTML interne, récupère les références et rejoue les attributs déjà posés.
   */
  connectedCallback () {
    const key = this.getAttribute('key')
    const location = this.getAttribute('location')

    this.innerHTML = /* html */`
      ${key !== null ? `<div class="key">${key}</div>` : ''}
      ${SVG_ICON(PATH_LOCKED, 'class="lock hidden" width="14" height="14"')}
      <div class="image hidden"></div>
      <div class="count"></div>
    `

    this._elLock = this.querySelector('.lock')
    this._elImage = this.querySelector('.image')
    this._elCount = this.querySelector('.count')

    this._count = 0
    this._usable = null
    this._location = location !== null ? `Slot : ${location}\n` : ''

    // Rejouer les attributs posés avant la connexion
    const item = this.getAttribute('item')
    if (item) this.#itemChanged(item)

    const count = this.getAttribute('count')
    if (count !== null) this.#countChanged(count)

    if (this.hasAttribute('locked')) this.#lockedChanged('')

    const usable = this.getAttribute('usable')
    if (usable !== null) this.#usableChanged(usable)
  }

  /**
   * Lifecycle Web Component — appelé à chaque changement d'attribut observé.
   * Délègue au handler correspondant. Sans effet si la valeur n'a pas changé.
   * @param {string}      name
   * @param {string|null} oldValue
   * @param {string|null} newValue
   */
  attributeChangedCallback (name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name === 'item') this.#itemChanged(newValue)
    else if (name === 'count') this.#countChanged(newValue)
    else if (name === 'locked') this.#lockedChanged(newValue)
    else if (name === 'usable') this.#usableChanged(newValue)
  }

  /**
   * Met à jour l'image du slot depuis ITEMS. Masque l'image si l'item est vide.
   * @param {string|null} value — itemId ou '' ou null
   */
  #itemChanged (value) {
    if (!this._elImage) return
    if (value === null || value === '') {
      this._elImage.classList.add('hidden')
      return
    }
    const item = ITEMS[value]
    const {file, sx, sy, sw, sh} = item.image
    this._elImage.classList.remove('hidden')
    this._elImage.style.backgroundImage = `url('/assets/sprites/${file}.png')`
    this._elImage.style.backgroundPosition = `-${sx}px -${sy}px`
    this._elImage.style.width = `${sw}px`
    this._elImage.style.height = `${sh}px`
  }

  /**
   * Met à jour le compteur interne et rafraîchit l'affichage.
   * @param {string|null} value — valeur de l'attribut count
   */
  #countChanged (value) {
    if (!this._elCount) return
    this._count = value !== null ? parseInt(value, 10) : 0
    this.#formatCount()
  }

  /**
   * Met à jour le plafond 'usable' et rafraîchit l'affichage (format count/usable).
   * @param {string|null} value — valeur de l'attribut usable, null si absent
   */
  #usableChanged (value) {
    if (!this._elCount) return
    this._usable = value !== null ? parseInt(value, 10) : null
    this.#formatCount()
  }

  /**
   * Rafraîchit le texte du compteur.
   * Affiche count seul si usable est null, 'count/usable' sinon.
   * Masque le texte si count <= 1 et usable est null.
   */
  #formatCount () {
    if (this._usable === null) {
      this._elCount.textContent = this._count > 1 ? String(this._count) : ''
    } else {
      this._elCount.textContent = `${this._count}/${this._usable}`
    }
  }

  /**
   * Affiche ou masque l'icône de verrou selon la présence de l'attribut.
   * @param {string|null} value — '' si attribut présent, null si absent
   */
  #lockedChanged (value) {
    if (!this._elLock) return
    // value === null si absent, '' si présent
    this._elLock.classList.toggle('hidden', value === null)
  }
}
customElements.define('inventory-slot', InventorySlot)

/* ====================================================================================================
   INVENTORY OVERLAY
   ====================================================================================================

   Panel d'inventaire joueur (bag, hotbar, armor, accessories) + panel coffre (containers proches).
   Singleton : inventoryOverlay.

   Responsabilités :
     - Affichage et mise à jour des slots depuis inventoryManager
     - Drag & drop entre tous les containers (bag ↔ hotbar ↔ chest ↔ armor ↔ accessory)
     - Actions sur slot sélectionné : use, lock, split, transfer, trash, restore
     - Sélection, affichage et renommage des containers proches via furnitureManager

   Interactions :
     inventoryManager  — source de vérité pour tous les slots ; toutes les mutations passent par lui
     furnitureManager  — liste des containers proches (getNearbyContainers, getFurnitureById, rename)
     eventBus          — écoute : inventory/open, inventory/close, inventory/keydown, craft/performed
                       — émet  : inventory/static-buffs, hotbar/changed, overlay/open-request,
                                 craft/item, help/topic, item/used, debug/command

   Ouverture/fermeture :
     À l'ouverture : peuplement complet depuis inventoryManager + dropdown containers.
     À la fermeture : sauvegarde via inventoryManager.save() + émission des buffs statiques.
   ==================================================================================================== */

class InventoryOverlay {
  #container = null
  #content = null
  #btnUse = null // icône d'utilisation du slot sélectionné
  #btnLock = null // icône de verrouillage/déverouillage du slot sélectionné
  #btnSplit = null // icône de séparatin d'une pile
  #btnTransfer = null // icône de transfert bag <-> Chest
  #btnTrash = null // icôns de placement du slot sélectionné dans la poubelle
  #btnRestore = null // icône de récupération du contenu de la poubelle
  #chestSelect = null // <select> du panel container
  #btnRename = null // bouton renommage
  #chestIcon = null // icône du container sélectionné
  #renameForm = null // formulaire de renommage
  #renameInput = null // champ texte
  #btnConfirm = null // bouton confirmation rename
  #btnCancel = null // bouton annulation rename

  #dragSource = null // départ du drag & drop
  #ghost = null // div fantôme qui suit la souris pendant le drag & drop
  #dragStartX // position initiale de la sourisn - umber — toujours écrit avec #dragSource
  #dragStartY // position initiale de la sourisn - umber — toujours écrit avec #dragSource

  #hotbarSlots = [] // Array(8) — refs DOM des inventory-slot
  #bagSlots = [] // Array(64) — refs DOM des inventory-slot
  #armorSlots = [] // Array(3) — refs DOM des inventory-slot
  #accessorySlots = [] // Array(5) — refs DOM des inventory-slot
  #containerSlots = [] // Array(64) — refs DOM des inventory-slot

  #selectedSlot = null // référence au DOM element inventory-slot sélectionné
  #selectedFurnitureId = null // furnitureId du container actif, null si aucun

  constructor () {
  // 1. Conteneur Principal — dimensions calculées
    this.#container = document.createElement('div')
    this.#container.id = 'ui-inventory-panel'

    // 2. Header
    this.#container.appendChild(createOverlayHeader('🎒 Inventory [I]', 'inventory'))

    // 3. Contents
    this.#buildContent()

    // 4. Assemblage final
    this.#container.appendChild(this.#content)
    document.body.appendChild(this.#container)

    // 5. Événements
    this.#bindEvents()
    this.#initDragAndDrop()
  }

  /**
   * Construit et assemble le contenu principal du panel (grilles, actions, coffre).
   * Stocke les références DOM dans les champs privés correspondants.
   */
  #buildContent () {
  // Zone de contenu — grille principale
    this.#content = document.createElement('div')
    this.#content.className = 'inv-content'

    const colHotbar = document.createElement('div')
    colHotbar.className = 'inv-hotbar'
    const hotbarContent = this.buildHotbar()
    colHotbar.appendChild(hotbarContent)

    const bagWrap = document.createElement('div')
    bagWrap.className = 'inv-bag'
    const bagContent = this.buildBag()
    bagWrap.appendChild(bagContent)

    const armorWrap = document.createElement('div')
    armorWrap.className = 'inv-armor'
    const armorContent = this.buildArmor()
    armorWrap.appendChild(armorContent)

    const accessoryWrap = document.createElement('div')
    accessoryWrap.className = 'inv-accessory'
    const accessoryContent = this.buildAccessory()
    accessoryWrap.appendChild(accessoryContent)

    const colActions = document.createElement('div')
    colActions.className = 'inv-actions'
    const actionsContent = this.buildActions()
    colActions.appendChild(actionsContent)

    const chestHeader = document.createElement('div')
    chestHeader.className = 'inv-chest-header'
    const chestHeaderContent = this.buildChestHeader()
    chestHeader.appendChild(chestHeaderContent)

    const saveWarning = document.createElement('div')
    saveWarning.className = 'inv-save-warning'
    saveWarning.innerHTML = SVG_ICON(PATH_WARNING, 'class="warning-icon" width="20" height="20" style="margin-right: 6px;"') + 'Changes are only saved when the panel is closed.'

    saveWarning.title = 'No auto-save during editing.'
    chestHeader.appendChild(saveWarning)

    const chestWrap = document.createElement('div')
    chestWrap.className = 'inv-chest'
    const chestContent = this.buildChest()
    chestWrap.appendChild(chestContent)

    this.#content.appendChild(colHotbar)
    this.#content.appendChild(bagWrap)
    this.#content.appendChild(armorWrap)
    this.#content.appendChild(accessoryWrap)
    this.#content.appendChild(colActions)
    this.#content.appendChild(chestHeader)
    this.#content.appendChild(chestWrap)
  }

  /**
   * Construit la grille hotbar (8 slots) et peuple #hotbarSlots.
   * @returns {HTMLElement}
   */
  buildHotbar () {
    const grid = document.createElement('div')
    grid.className = 'inv-hotbar-grid inv-panel'

    for (let i = 0; i < HOTBAR_CAPACITY; i++) {
      const slot = document.createElement('inventory-slot')
      slot.setAttribute('key', String(i + 1))
      slot.setAttribute('location', `hotbar|${i}`)
      slot.classList.add('hotbar')
      grid.appendChild(slot)
      this.#hotbarSlots[i] = slot
    }

    return grid
  }

  /**
   * Construit la grille bag (64 slots) et peuple #bagSlots.
   * @returns {HTMLElement}
   */
  buildBag () {
    const grid = document.createElement('div')
    grid.className = 'inv-bag-grid inv-panel'

    for (let i = 0; i < BAG_CAPACITY; i++) {
      const slot = document.createElement('inventory-slot')
      slot.setAttribute('location', `bag|${i}`)
      grid.appendChild(slot)
      this.#bagSlots[i] = slot
    }

    return grid
  }

  /**
   * Construit la grille armor (3 slots) et peuple #armorSlots.
   * @returns {HTMLElement}
   */
  buildArmor () {
    const grid = document.createElement('div')
    grid.className = 'inv-armor-grid inv-panel'

    for (let i = 0; i < ARMOR_CAPACITY; i++) {
      const slot = document.createElement('inventory-slot')
      slot.setAttribute('location', `armor|${i}`)
      slot.classList.add('armor')
      grid.appendChild(slot)
      this.#armorSlots[i] = slot
    }

    return grid
  }

  /**
   * Construit la grille accessory (5 slots) et peuple #accessorySlots.
   * @returns {HTMLElement}
   */
  buildAccessory () {
    const grid = document.createElement('div')
    grid.className = 'inv-accessory-grid inv-panel'

    for (let i = 0; i < ACCESSORY_CAPACITY; i++) {
      const slot = document.createElement('inventory-slot')
      slot.setAttribute('location', `accessory|${i}`)
      slot.classList.add('accessory')
      grid.appendChild(slot)
      this.#accessorySlots[i] = slot
    }

    return grid
  }

  /**
   * Construit la colonne d'actions (use, lock, split, transfer, trash, restore, craft, help, debug).
   * Stocke les références boutons dans les champs privés.
   * @returns {HTMLElement}
   */
  buildActions () {
    const col = document.createElement('div')
    col.className = 'inv-actions inv-panel'

    const btnUse = document.createElement('button')
    btnUse.className = 'inv-action-btn'
    btnUse.title = 'Use item [Space]'
    btnUse.disabled = true
    btnUse.innerHTML = SVG_ICON(PATH_USE, 'class="use-icon"')
    btnUse.addEventListener('click', () => this.#onUseClick())
    col.appendChild(btnUse)
    this.#btnUse = btnUse

    const btnLock = document.createElement('button')
    btnLock.className = 'inv-action-btn'
    btnLock.title = 'Lock / Unlock slot [L]'
    btnLock.innerHTML = SVG_ICON(PATH_LOCKED, 'class="lock-closed"') + SVG_ICON(PATH_UNLOCKED, 'class="lock-open"')
    btnLock.disabled = true
    btnLock.addEventListener('click', () => this.#onLockClick())
    this.#btnLock = btnLock
    col.appendChild(btnLock)

    const btnSplit = document.createElement('button')
    btnSplit.className = 'inv-action-btn'
    btnSplit.title = 'Split stack'
    btnSplit.disabled = true
    btnSplit.innerHTML = SVG_ICON(PATH_SPLIT, 'class="split-icon"')
    btnSplit.addEventListener('click', () => this.#onSplitClick())
    col.appendChild(btnSplit)
    this.#btnSplit = btnSplit

    const btnTransfer = document.createElement('button')
    btnTransfer.className = 'inv-action-btn'
    btnTransfer.disabled = true
    btnTransfer.innerHTML = SVG_ICON(PATH_ARROW_RIGHT, 'class="transfer-icon"')
    btnTransfer.addEventListener('click', () => this.#onTransferClick())
    col.appendChild(btnTransfer)
    this.#btnTransfer = btnTransfer

    const btnTrash = document.createElement('button')
    btnTrash.className = 'inv-action-btn'
    btnTrash.title = 'Trash item [Delete]'
    btnTrash.disabled = true
    btnTrash.innerHTML = SVG_ICON(PATH_TRASH_DOWN, 'class="trash-icon"')
    btnTrash.addEventListener('click', () => this.#onTrashClick())
    col.appendChild(btnTrash)
    this.#btnTrash = btnTrash

    const btnRestore = document.createElement('button')
    btnRestore.className = 'inv-action-btn'
    btnRestore.title = 'Restore trashed item'
    btnRestore.disabled = true
    btnRestore.innerHTML = SVG_ICON(PATH_TRASH_UP, 'class="restore-icon"')
    btnRestore.addEventListener('click', () => this.#onRestoreClick())
    col.appendChild(btnRestore)
    this.#btnRestore = btnRestore

    const btnCraft = document.createElement('button')
    btnCraft.className = 'inv-action-btn'
    btnCraft.title = 'Open Crafting [K]'
    btnCraft.innerHTML = SVG_ICON(PATH_CRAFT, 'class="craft-icon"')
    btnCraft.addEventListener('click', () => {
      const item = this.#selectedSlot?.getAttribute('item') ?? ''
      eventBus.emit('overlay/open-request', 'craft')
      if (item !== '' && (ITEMS[item].type & (ITEM_TYPE.CRAFTABLE | ITEM_TYPE.MATERIAL))) {
        eventBus.emit('craft/item', item)
      }
    })
    col.appendChild(btnCraft)

    const btnHelp = document.createElement('button')
    btnHelp.className = 'inv-action-btn'
    btnHelp.title = 'Open Help [H]'
    btnHelp.innerHTML = SVG_ICON(PATH_HELP, 'class="help-icon"')
    btnHelp.addEventListener('click', () => {
      const item = this.#selectedSlot?.getAttribute('item') ?? ''
      const topic = item !== '' ? ITEMS[item].help : 'Inventory'

      eventBus.emit('overlay/open-request', 'help')
      eventBus.emit('help/topic', topic)
    })
    col.appendChild(btnHelp)

    const btnDebug = document.createElement('button')
    btnDebug.className = 'inv-action-btn'
    btnDebug.title = 'Debug'
    btnDebug.innerHTML = SVG_ICON(PATH_DEBUG, 'class="debug-icon"')
    btnDebug.addEventListener('click', () => {
      eventBus.emit('debug/command')
    })
    col.appendChild(btnDebug)

    return col
  }

  /**
   * Construit l'en-tête du panel coffre : icône, dropdown, bouton rename, formulaire de renommage.
   * Stocke les références DOM dans #chestIcon, #chestSelect, #btnRename, #renameForm, #renameInput, #btnConfirm, #btnCancel.
   * @returns {HTMLElement}
   */
  buildChestHeader () {
    const header = document.createElement('div')
    header.className = 'inv-chest-header-content inv-panel'

    // Ligne 1 : icône + select + bouton rename
    const row = document.createElement('div')
    row.className = 'inv-chest-row'

    // Icône du furniture sélectionné
    const icon = document.createElement('div')
    icon.className = 'inv-chest-icon'

    const select = document.createElement('select')
    select.className = 'inv-chest-select'

    const btnRename = document.createElement('button')
    btnRename.className = 'inv-chest-rename'
    // btnRename.textContent = '✏️'
    btnRename.title = 'Rename chest'
    btnRename.disabled = true

    btnRename.innerHTML = SVG_ICON(PATH_RENAME, 'width="32" height="32"')

    row.appendChild(icon)
    row.appendChild(select)
    row.appendChild(btnRename)

    this.#chestIcon = icon
    this.#chestSelect = select
    this.#btnRename = btnRename

    // Ligne 2 : formulaire de renommage (caché par défaut)
    const renameForm = document.createElement('div')
    renameForm.className = 'inv-chest-rename-form hidden'

    const label = document.createElement('label')
    label.textContent = 'New name:'
    label.className = 'inv-chest-rename-label'

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'inv-chest-rename-input'
    input.placeholder = 'Enter new name...'

    const btnConfirm = document.createElement('button')
    btnConfirm.className = 'inv-chest-rename-confirm'
    btnConfirm.textContent = '✓'
    btnConfirm.title = 'Confirm'

    const btnCancel = document.createElement('button')
    btnCancel.className = 'inv-chest-rename-cancel'
    btnCancel.textContent = '✕'
    btnCancel.title = 'Cancel'

    this.#renameForm = renameForm
    this.#renameInput = input
    this.#btnConfirm = btnConfirm
    this.#btnCancel = btnCancel

    renameForm.appendChild(label)
    renameForm.appendChild(input)
    renameForm.appendChild(btnConfirm)
    renameForm.appendChild(btnCancel)

    header.appendChild(row)
    header.appendChild(renameForm)

    return header
  }

  /**
   * Construit la grille du coffre (64 slots, tous inactifs par défaut) et peuple #containerSlots.
   * @returns {HTMLElement}
   */
  buildChest () {
    const grid = document.createElement('div')
    grid.className = 'inv-chest-grid inv-panel'

    for (let i = 0; i < 64; i++) {
      const slot = document.createElement('inventory-slot')
      slot.setAttribute('location', `chest|${i}`)
      slot.classList.add('inactive')
      grid.appendChild(slot)
      this.#containerSlots[i] = slot
    }

    return grid
  }

  /**
   * Abonne les handlers eventBus et DOM.
   * Bind et enregistre les handlers nommés (chestSelect, rename).
   */
  #bindEvents () {
    // Abonnement au Bus
    eventBus.on('inventory/open', () => {
      this.#onOpen()
    })

    eventBus.on('inventory/close', () => {
      this.#onClose()
    })

    // clic sur un slot
    this.#content.addEventListener('click', (e) => {
      const slot = e.target.closest('inventory-slot')
      if (slot === null) return
      if (slot.classList.contains('inactive')) return
      this.#onSlotClick(slot)
    })

    // raccourcis clavier
    eventBus.on('inventory/keydown', (key) => {
      if (key === 'l' || key === 'L') {
        if (!this.#btnLock.disabled) this.#onLockClick()
      } else if (key === ' ') {
        if (!this.#btnUse.disabled) this.#onUseClick()
      } else if (key === 'Delete') {
        if (!this.#btnTrash.disabled) this.#onTrashClick()
      } else if (key === 'Tab') {
        if (!this.#btnTransfer.disabled) this.#onTransferClick()
      }
    })

    // le Craft Panel a exécuté une recette, il faut tout ré-afficher
    eventBus.on('craft/performed', () => {
      if (this.#container.style.display === 'none') return
      this.refreshBag()
      this.#refreshContainer()
    })

    // gestion de la sélection d'un coffre
    this.onChestSelectChange = this.onChestSelectChange.bind(this)
    this.#chestSelect.addEventListener('change', this.onChestSelectChange)

    // gestion du renommage d'un coffre
    this.onRenameClick = this.onRenameClick.bind(this)
    this.onRenameConfirm = this.onRenameConfirm.bind(this)
    this.onRenameCancel = this.onRenameCancel.bind(this)
    this.#btnRename.addEventListener('click', this.onRenameClick)
    this.#btnConfirm.addEventListener('click', this.onRenameConfirm)
    this.#btnCancel.addEventListener('click', this.onRenameCancel)
  }

  // /////////// //
  // DRAG & DROP //
  // /////////// //

  /**
   * Initialise le drag & drop sur #content.
   * Mousedown démarre le drag, mouseup l'applique via le switch de déplacement.
   */
  #initDragAndDrop () {
    this.#content.addEventListener('mousedown', (e) => {
      const slot = e.target.closest('inventory-slot')
      if (slot === null) return
      if (slot.classList.contains('inactive')) return
      if (slot.getAttribute('item') === '') return
      if (slot.hasAttribute('locked')) return
      this.#dragSource = slot
      this.#dragStartX = e.clientX
      this.#dragStartY = e.clientY
    })

    this.#content.addEventListener('mouseup', (e) => {
      if (this.#dragSource === null) return
      const slot = e.target.closest('inventory-slot')
      this.#removeGhost()
      if (slot === null || slot === this.#dragSource || slot.hasAttribute('locked')) {
        this.#dragSource = null
        return
      }

      const [fromContainer, fromIndex] = this.#dragSource.getAttribute('location').split('|')
      const [toContainer, toIndex] = slot.getAttribute('location').split('|')
      const from = parseInt(fromIndex, 10)
      const to = parseInt(toIndex, 10)
      const key = `${fromContainer}→${toContainer}`

      switch (key) {
        case 'hotbar→hotbar':
          inventoryManager.moveWithinContainer('hotbar', from, to)
          this.#updateSlotDOM(this.#dragSource, inventoryManager.getSlot('hotbar', from))
          this.#updateSlotDOM(slot, inventoryManager.getSlot('hotbar', to))
          break
        case 'bag→bag':
          inventoryManager.moveWithinContainer('bag', from, to)
          this.#updateSlotDOM(this.#dragSource, inventoryManager.getSlot('bag', from))
          this.#updateSlotDOM(slot, inventoryManager.getSlot('bag', to))
          break
        case 'chest→chest':
          inventoryManager.moveWithinChest(this.#selectedFurnitureId, from, to)
          this.#updateSlotDOM(this.#dragSource, inventoryManager.getContainerSlot(this.#selectedFurnitureId, from))
          this.#updateSlotDOM(slot, inventoryManager.getContainerSlot(this.#selectedFurnitureId, to))
          break
        case 'accessory→accessory':
          inventoryManager.moveWithinContainer('accessory', from, to)
          this.#updateSlotDOM(this.#dragSource, inventoryManager.getSlot('accessory', from))
          this.#updateSlotDOM(slot, inventoryManager.getSlot('accessory', to))
          break
        case 'hotbar→bag':
          inventoryManager.moveHotbarToBag(from, to)
          this.#updateSlotDOM(this.#dragSource, inventoryManager.getSlot('hotbar', from))
          this.#updateSlotDOM(slot, inventoryManager.getSlot('bag', to))
          break
        case 'bag→hotbar':
          inventoryManager.moveBagToHotbar(from, to)
          this.#updateSlotDOM(this.#dragSource, inventoryManager.getSlot('bag', from))
          this.#updateSlotDOM(slot, inventoryManager.getSlot('hotbar', to))
          break
        case 'bag→chest':
          inventoryManager.moveBagToChest(this.#selectedFurnitureId, from, to)
          this.#updateSlotDOM(this.#dragSource, inventoryManager.getSlot('bag', from))
          this.#updateSlotDOM(slot, inventoryManager.getContainerSlot(this.#selectedFurnitureId, to))
          break
        case 'chest→bag':
          inventoryManager.moveChestToBag(this.#selectedFurnitureId, from, to)
          this.#updateSlotDOM(this.#dragSource, inventoryManager.getContainerSlot(this.#selectedFurnitureId, from))
          this.#updateSlotDOM(slot, inventoryManager.getSlot('bag', to))
          break
        case 'bag→accessory': {
          const result = inventoryManager.moveBagToAccessory(from, to)
          if (result === null) break
          this.#updateSlotDOM(this.#dragSource, result.srcSlot)
          this.#updateSlotDOM(slot, result.destSlot)
          if (result.depositSlot !== null) {
            this.#updateSlotDOM(this.#bagSlots[result.depositSlot.slot], result.depositSlot)
          }
          break
        }
        case 'accessory→bag': {
          const result = inventoryManager.moveAccessoryToBag(from, to)
          if (result === null) break
          this.#updateSlotDOM(this.#dragSource, result.srcSlot)
          this.#updateSlotDOM(slot, result.destSlot)
          if (result.depositSlot !== null) {
            this.#updateSlotDOM(this.#bagSlots[result.depositSlot.slot], result.depositSlot)
          }
          break
        }
        case 'bag→armor': {
          const result = inventoryManager.moveBagToArmor(from, to)
          if (result === null) break
          this.#updateSlotDOM(this.#dragSource, result.srcSlot)
          this.#updateSlotDOM(slot, result.destSlot)
          if (result.depositSlot !== null) {
            this.#updateSlotDOM(this.#bagSlots[result.depositSlot.slot], result.depositSlot)
          }
          this.#updateArmorSet()
          break
        }
        case 'armor→bag': {
          const result = inventoryManager.moveArmorToBag(from, to)
          if (result === null) break
          this.#updateSlotDOM(this.#dragSource, result.srcSlot)
          this.#updateSlotDOM(slot, result.destSlot)
          if (result.depositSlot !== null) {
            this.#updateSlotDOM(this.#bagSlots[result.depositSlot.slot], result.depositSlot)
          }
          this.#updateArmorSet()
          break
        }
      }

      this.#dragSource = null
    })
  }

  /**
   * Met à jour la classe 'slot-armor-set' sur les slots armure si les trois pièces forment un set complet.
   */
  #updateArmorSet () {
    const slots = inventoryManager.armor
    let setName = null
    // Vérifier que les trois slots sont remplis et ont le même set
    if (slots[0].item !== '' && slots[1].item !== '' && slots[2].item !== '') {
      const set0 = ITEMS[slots[0].item].set
      const set1 = ITEMS[slots[1].item].set
      const set2 = ITEMS[slots[2].item].set
      if (set0 !== undefined && set0 === set1 && set1 === set2) {
        setName = set0
      }
    }
    for (let i = 0; i < ARMOR_CAPACITY; i++) {
      this.#armorSlots[i].classList.toggle('slot-armor-set', setName !== null)
    }
  }

  /**
   * Attache les handlers window (mousemove, mouseup) à l'ouverture du panel.
   */
  #attachWindowHandlers () {
    window.addEventListener('mousemove', this.#onWindowMouseMove)
    window.addEventListener('mouseup', this.#onWindowMouseUp)
  }

  /**
   * Détache les handlers window à la fermeture du panel.
   */
  #detachWindowHandlers () {
    window.removeEventListener('mousemove', this.#onWindowMouseMove)
    window.removeEventListener('mouseup', this.#onWindowMouseUp)
  }

  /**
   * Handler mousemove window — crée ou déplace le ghost si un drag est en cours.
   * Déclenche la création après un seuil de 10px pour éviter les drags accidentels.
   */
  #onWindowMouseMove = (e) => {
    if (this.#dragSource === null) return
    if (this.#ghost === null) {
      const dx = e.clientX - this.#dragStartX
      const dy = e.clientY - this.#dragStartY
      if (dx * dx + dy * dy > 100) {
        this.#createGhost(this.#dragSource, e.clientX, e.clientY)
      }
      return
    }
    this.#moveGhost(e.clientX, e.clientY)
  }

  /**
   * Handler mouseup window — annule le drag et supprime le ghost.
   */
  #onWindowMouseUp = () => {
    this.#removeGhost()
    this.#dragSource = null
  }

  /**
   * Crée l'élément ghost (copie visuelle du slot) et l'ancre à la position souris.
   * @param {HTMLElement} slot
   * @param {number}      x
   * @param {number}      y
   */
  #createGhost (slot, x, y) {
    const ghost = document.createElement('div')
    ghost.className = 'inv-drag-ghost'
    const image = slot.querySelector('.image')
    if (image !== null) {
      ghost.style.backgroundImage = image.style.backgroundImage
      ghost.style.backgroundPosition = image.style.backgroundPosition
      ghost.style.backgroundSize = image.style.backgroundSize
      ghost.style.width = image.style.width
      ghost.style.height = image.style.height
    }
    document.body.appendChild(ghost)
    this.#ghost = ghost
    this.#moveGhost(x, y)
  }

  /**
   * Déplace le ghost à la position souris.
   * Sans effet si aucun ghost actif.
   * @param {number} x
   * @param {number} y
   */
  #moveGhost (x, y) {
    if (this.#ghost === null) return
    this.#ghost.style.left = `${x}px`
    this.#ghost.style.top = `${y}px`
  }

  /**
   * Supprime le ghost du DOM.
   * Sans effet si aucun ghost actif.
   */
  #removeGhost () {
    if (this.#ghost === null) return
    this.#ghost.remove()
    this.#ghost = null
  }

  // ////////////////////////////// //
  // OUVERTURE / FERMETURE DU PANEL //
  // ////////////////////////////// //

  /**
   * Ouvre le panel, attache les handlers window, peuple tous les slots depuis inventoryManager.
   * Réinitialise la sélection et le formulaire de renommage.
   */
  #onOpen () {
    this.#attachWindowHandlers()

    this.#selectedFurnitureId = null
    this.#container.style.display = 'flex'
    // récupération des slots de la hotbar et du bag
    this.refreshBag()
    // récupération des slots de Armor
    const armor = inventoryManager.armor
    for (let i = 0; i < armor.length; i++) {
      this.#updateSlotDOM(this.#armorSlots[i], armor[i])
    }
    this.#updateArmorSet()
    // récupération des slots de Accessory
    const accessory = inventoryManager.accessories
    for (let i = 0; i < accessory.length; i++) {
      this.#updateSlotDOM(this.#accessorySlots[i], accessory[i])
    }
    // initialisation des slots de Container
    const emptySlot = {item: '', count: 0, locked: false, container: 'container'}
    for (let i = 0; i < 64; i++) {
      this.#updateSlotDOM(this.#containerSlots[i], emptySlot)
    }
    // peuplement du dropdown des coffres dans le range
    this.#populateContainerSelect()
    this.#renameForm.classList.add('hidden')
  }

  /**
   * Rafraîchit les slots DOM du bag et de la hotbar depuis inventoryManager.
   * À appeler après toute modification externe (debug, loot).
   */
  refreshBag () {
    const hotbar = inventoryManager.hotbar
    for (let i = 0; i < HOTBAR_CAPACITY; i++) {
      this.#updateSlotDOM(this.#hotbarSlots[i], hotbar[i])
    }
    const bag = inventoryManager.bag
    for (let i = 0; i < BAG_CAPACITY; i++) {
      this.#updateSlotDOM(this.#bagSlots[i], bag[i])
    }
  }

  /**
   * Rafraîchit les slots DOM du container actuellement sélectionné.
   * Sans effet si aucun container n'est sélectionné ou s'il n'est pas chargé.
   */
  #refreshContainer () {
    if (!this.#selectedFurnitureId) return
    const slots = inventoryManager.getContainer(this.#selectedFurnitureId)
    if (!slots) return
    for (let i = 0; i < slots.length; i++) {
      this.#updateSlotDOM(this.#containerSlots[i], slots[i])
    }
  }

  /**
   * Met à jour les attributs d'un inventory-slot DOM depuis un slot mémoire.
   * @param {HTMLElement} el — élément inventory-slot
   * @param {object} slot — slot mémoire
   */
  #updateSlotDOM (el, slot) {
    el.setAttribute('item', slot.item)
    el.setAttribute('count', slot.count)
    el.toggleAttribute('locked', slot.locked)
    el.setAttribute('title', this.#buildSlotTitle(slot))
  }

  /**
   * Construit le titre tooltip d'un slot.
   * @param {object} slot — slot mémoire
   * @returns {string}
   */
  #buildSlotTitle (slot) {
    const armorSlot = slot.container === 'armor' ? ` ${ARMOR_SLOT_LABELS[slot.slot]}` : ''
    const container = this.#containerToString(slot.container)
    if (slot.item === '') return `Slot: ${container}${armorSlot}`
    const item = ITEMS[slot.item]
    const prefix = slot.prefix !== '' ? `${slot.prefix} ` : ''
    const count = slot.count > 1 ? `${slot.count} ` : ''

    return `Slot: ${container}${armorSlot}\n${count}${prefix}${item.hoverTitle}`
  }

  /**
   * Retourne le nom lisible du container pour le tooltip.
   * @param {string} container
   * @returns {string}
   */
  #containerToString (container) {
    if (CONTAINER_STYPES.has(container)) {
      if (this.#selectedFurnitureId === null) return 'Container'
      const furniture = furnitureManager.getFurnitureById(this.#selectedFurnitureId)
      if (furniture === undefined) return 'Container'
      return `${capitalize(container)} — ${furniture.name}`
    }
    return capitalize(container)
  }

  /**
   * Ferme le panel, détache les handlers window, sauvegarde et émet les événements de mise à jour.
   */
  #onClose () {
    this.#detachWindowHandlers()

    this.#container.style.display = 'none'
    // Désélection du slot actif
    if (this.#selectedSlot !== null) {
      this.#selectedSlot.classList.remove('selected')
      this.#selectedSlot = null
      this.#btnLock.disabled = true
    }
    inventoryManager.save()
    eventBus.emit('inventory/static-buffs', inventoryManager.getStaticBuffs())
    eventBus.emit('hotbar/changed', inventoryManager.hotbar)
  }

  // ///////////////////////////////// //
  // SELECTION / DESELECTION D'UN SLOT //
  // ///////////////////////////////// //

  /**
   * Gère le clic sur un slot : sélectionne ou désélectionne, met à jour les boutons d'action.
   * @param {HTMLElement} slot
   */
  #onSlotClick (slot) {
    if (this.#selectedSlot === slot) {
    // Désélection
      slot.classList.remove('selected')
      this.#selectedSlot = null
      this.#updateActionButtons()
      return
    }
    // Désélection du précédent
    if (this.#selectedSlot !== null) {
      this.#selectedSlot.classList.remove('selected')
    }
    // Sélection du nouveau
    slot.classList.add('selected')
    this.#selectedSlot = slot
    this.#updateActionButtons()
  }

  /**
   * Met à jour l'état actif/inactif de tous les boutons d'action selon le slot sélectionné.
   */
  #updateActionButtons () {
    const slot = this.#selectedSlot
    const item = slot?.getAttribute('item') ?? ''
    const [container] = slot?.getAttribute('location').split('|') ?? ['']
    const itemDef = item !== '' ? ITEMS[item] : null
    const isLocked = slot?.hasAttribute('locked') ?? false

    // Lock
    this.#updateLockBtn(slot)

    // Trash
    this.#btnTrash.disabled = isLocked || container !== 'bag' || item === '' || !!(itemDef?.type & ITEM_TYPE.UNDISPOSABLE)

    // Use
    const isUsable = !isLocked && container === 'bag' && item !== '' && !!(itemDef?.type & ITEM_TYPE.USABLE)
    this.#btnUse.disabled = !isUsable
    this.#btnUse.title = isUsable
      ? `${itemDef.useTitle || 'Use item'} [Space]`
      : 'Use item [Space]'

    // Split
    const SPLITTABLE = new Set(['bag', 'hotbar', 'chest'])
    const isSplittable = !isLocked && SPLITTABLE.has(container) && item !== '' && slot?.getAttribute('count') > 1
    this.#btnSplit.disabled = !isSplittable

    // Transfert
    const isInChest = container === 'chest'
    const isInBag = container === 'bag'
    const hasChest = this.#selectedFurnitureId !== null
    const isTransferable = !isLocked && item !== '' && hasChest && (isInBag || isInChest)

    this.#btnTransfer.disabled = !isTransferable
    this.#btnTransfer.title = isInChest ? 'Move to bag [Tab]' : 'Move to chest [Tab]'
    this.#btnTransfer.classList.toggle('transfer-left', isInChest)
  }

  // /////////////////////////////////////// //
  // VERROUILLAGE / DEVERROUILLAGE D'UN SLOT //
  // /////////////////////////////////////// //

  /**
   * Met à jour l'état et le titre du bouton lock selon le slot sélectionné.
   * @param {HTMLElement|null} slot
   */
  #updateLockBtn (slot) {
    if (slot === null) {
      this.#btnLock.disabled = true
      this.#btnLock.classList.remove('unlocking')
      this.#btnLock.title = 'Lock / Unlock slot [L]'
      return
    }
    const isLocked = slot.hasAttribute('locked')
    this.#btnLock.disabled = false
    this.#btnLock.classList.toggle('unlocking', isLocked)
    this.#btnLock.title = isLocked ? 'Unlock slot [L]' : 'Lock slot [L]'
  }

  /**
   * Bascule le verrou du slot sélectionné et met à jour l'UI.
   */
  #onLockClick () {
    const [container, index] = this.#selectedSlot.getAttribute('location').split('|')
    const slot = CONTAINER_STYPES.has(container)
      ? inventoryManager.getContainerSlot(this.#selectedFurnitureId, parseInt(index, 10))
      : inventoryManager.getSlot(container, parseInt(index, 10))
    const locked = inventoryManager.toggleLock(slot)
    this.#selectedSlot.toggleAttribute('locked', locked)
    this.#updateActionButtons()
  }

  // ////////////////////// //
  // GESTION DE LA POUBELLE //
  // ////////////////////// //

  /**
   * Envoie le slot sélectionné à la poubelle et met à jour l'UI.
   * Restreint au bag uniquement.
   */
  #onTrashClick () {
    const [container, index] = this.#selectedSlot.getAttribute('location').split('|')
    if (container !== 'bag') return // précaution - ne devrait jamais arriver
    const slot = inventoryManager.trashFromBag(parseInt(index, 10))
    this.#updateSlotDOM(this.#selectedSlot, slot)
    this.#selectedSlot.classList.remove('selected')
    this.#selectedSlot = null
    this.#btnRestore.disabled = false
    this.#updateActionButtons()
  }

  /**
   * Restaure le dernier slot mis à la poubelle dans le bag.
   */
  #onRestoreClick () {
    inventoryManager.restoreTrash()
    this.refreshBag()
    this.#btnRestore.disabled = true
    this.#updateActionButtons()
  }

  // ///////////////////// //
  // UTILISATION D'UN ITEM //
  // ///////////////////// //

  /**
   * Décrémente le count du slot sélectionné (bag uniquement) et émet 'item/used'.
   */
  #onUseClick () {
    const [container, index] = this.#selectedSlot.getAttribute('location').split('|')
    if (container !== 'bag') return // précaution - ne devrait jamais arriver
    const slot = inventoryManager.decrementBagSlotCount(parseInt(index, 10))
    this.#updateSlotDOM(this.#selectedSlot, slot)
    eventBus.emit('item/used', slot.item !== '' ? this.#selectedSlot.getAttribute('item') : slot.item)
    if (slot.item === '') {
      this.#selectedSlot.classList.remove('selected')
      this.#selectedSlot = null
    }
    this.#updateActionButtons()
  }

  // ///////////////////// //
  // SEPARATION D'UN ITEM //
  // ///////////////////// //

  /**
   * Ouvre un prompt pour séparer une pile en deux. Dépose la nouvelle pile dans le premier slot libre du bag.
   */
  #onSplitClick () {
    const count = parseInt(this.#selectedSlot.getAttribute('count'), 10)
    const itemName = ITEMS[this.#selectedSlot.getAttribute('item')].name
    const value = window.prompt(`Split stack — ${itemName}\nEnter amount to extract (1 to ${count - 1}):`)

    if (value === null) return
    const extracted = parseInt(value, 10)
    if (isNaN(extracted) || extracted < 1 || extracted > count - 1) {
      window.alert(`Invalid amount. Expected a value between 1 and ${count - 1}.`)
      return
    }
    const [container, index] = this.#selectedSlot.getAttribute('location').split('|')
    const srcSlot = CONTAINER_STYPES.has(container)
      ? inventoryManager.getContainerSlot(this.#selectedFurnitureId, parseInt(index, 10))
      : inventoryManager.getSlot(container, parseInt(index, 10))
    const destSlot = inventoryManager.splitSlot(srcSlot, extracted)
    if (destSlot === null) {
      window.alert('Bag is full — cannot split stack.')
      return
    }
    this.#updateSlotDOM(this.#selectedSlot, srcSlot)
    this.refreshBag()
    this.#updateActionButtons()
  }

  // ////////////////////// //
  // TRANSFER BAG <-> CHEST //
  // ////////////////////// //

  /**
   * Transfère le slot sélectionné bag → coffre ou coffre → bag via stack ou premier slot libre.
   */
  #onTransferClick () {
    const [container, index] = this.#selectedSlot.getAttribute('location').split('|')
    const i = parseInt(index, 10)
    if (container === 'bag') {
      const dest = inventoryManager.moveBagToChestAuto(i, this.#selectedFurnitureId)
      if (dest === null) return
      this.#updateSlotDOM(this.#selectedSlot, inventoryManager.getSlot('bag', i))
      this.#updateSlotDOM(this.#containerSlots[dest.slot], dest)
    } else {
      const dest = inventoryManager.moveChestToBagAuto(this.#selectedFurnitureId, i)
      if (dest === null) return
      this.#updateSlotDOM(this.#selectedSlot, inventoryManager.getContainerSlot(this.#selectedFurnitureId, i))
      this.#updateSlotDOM(this.#bagSlots[dest.slot], dest)
    }
    this.#updateActionButtons()
  }

  // ////////////////// //
  // GESTION DES CHESTS //
  // ////////////////// //

  /**
   * Peuple le dropdown avec les containers proches du joueur.
   * Sélectionne le premier par défaut. Vide et désactive si aucun container dans le range.
   */
  #populateContainerSelect () {
    const containers = furnitureManager.getNearbyContainers()
    this.#chestSelect.length = 0

    if (containers.length === 0) {
      this.#selectedFurnitureId = null
      this.#btnRename.disabled = true
      return
    }

    for (const furniture of containers) {
      const option = document.createElement('option')
      option.value = furniture.id
      option.textContent = furniture.name
      this.#chestSelect.appendChild(option)
    }

    this.#btnRename.disabled = false
    this.#updateContainerSelection(containers[0])
  }

  /**
   * Met à jour l'icône et l'état de sélection pour le furniture container donné.
   * @param {object} furniture
   */
  #updateContainerSelection (furniture) {
    this.#selectedFurnitureId = furniture.id
    // Modification de l'icône de coffre
    const img = ITEMS[furniture.code].image
    Object.assign(this.#chestIcon.style, {
      backgroundImage: `url(assets/sprites/${img.file}.png)`,
      backgroundPosition: `-${img.sx}px -${img.sy}px`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'auto'
    })
    this.#chestIcon.title = ITEMS[furniture.code].name
    // modification des slots du coffre
    const capacity = CONTAINER_CAPACITY[furniture.stype]
    for (let i = 0; i < this.#containerSlots.length; i++) {
      this.#containerSlots[i].classList.toggle('inactive', i >= capacity)
      if (i < capacity) {
        this.#updateSlotDOM(this.#containerSlots[i], inventoryManager.getContainerSlot(furniture.id, i))
      }
    }
  }

  /**
   * Réagit au changement de sélection dans le dropdown containers.
   * Lié dans #bindEvents.
   */
  onChestSelectChange () {
    const furniture = furnitureManager.getFurnitureById(this.#chestSelect.value)
    if (furniture === undefined) return
    this.#updateContainerSelection(furniture)
  }

  // //////////////////// //
  // RENOMMAGE DES CHESTS //
  // //////////////////// //

  /**
   * Ouvre le formulaire de renommage du container sélectionné.
   * Pré-remplit le champ avec le nom courant.
   */
  onRenameClick () {
    this.#renameInput.value = this.#chestSelect.selectedOptions[0].textContent
    this.#renameForm.classList.remove('hidden')
  }

  /**
   * Valide le renommage : met à jour FurnitureManager, le dropdown et ferme le formulaire.
   * Sans effet si le champ est vide.
   */
  onRenameConfirm () {
    const name = this.#renameInput.value.trim()
    if (name === '') return
    furnitureManager.rename(this.#selectedFurnitureId, name)
    this.#chestSelect.selectedOptions[0].textContent = name
    this.#renameForm.classList.add('hidden')
  }

  /**
   * Annule le renommage et restaure la ligne principale.
   */
  onRenameCancel () {
    this.#renameForm.classList.add('hidden')
  }
}
export const inventoryOverlay = new InventoryOverlay()
