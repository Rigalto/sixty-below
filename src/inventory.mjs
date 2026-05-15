// InventoryManager — inventory.mjs

import {OVERLAYS, BAG_CAPACITY, HOTBAR_CAPACITY, ARMOR_CAPACITY, ACCESSORY_CAPACITY, CONTAINER_STYPES, CONTAINER_CAPACITY, ARMOR_SLOTS} from './constant.mjs'
import {eventBus} from './utils.mjs'
import {createOverlayHeader} from './ui.mjs'
import {ITEMS} from '../../assets/data/data.mjs'
import {saveManager} from './persistence.mjs'

/**
 * @file inventory.mjs
 * @description Gestion de l'inventaire du joueur et des containers du monde.
 *
 * ── Structure DB (objectStore 'inventory') ──────────────────────────────────
 *
 * Chaque slot est un enregistrement permanent en base (tous les slots
 * présents, y compris vides). Un seul type d'opération DB : toujours un update.
 *
 * {
 *   key:         number,   // clé DB autoincrement — lien entre slot et enregistrement
 *   container:   string,   // 'bag' | 'hotbar' | 'armor' | 'accessory' | 'chest' | 'closet' | 'cabinet'
 *   furnitureId: string,   // identifiant du furniture (uniquement chest/closet/cabinet), '' sinon
 *   item:        string,   // itemId — '' si vide
 *   count:       number,   // 0 si vide
 *   prefix:      string,   // modificateur — '' si aucun
 *   slot:        number,   // position dans le container (index linéaire, 0..63)
 *   locked:      boolean,  // slot verrouillé — aucun mouvement possible
 *   deleted:     boolean,  // true = furniture retiré du monde — destruction au startSession
 * }
 *
 * Capacités des containers
 *   bag      : 64 slots (8×8)
 *   hotbar   : 8 slots
 *   armor    : 3 slots (HEAD=0, CHEST=1, FEET=2)
 *   accessory: 5 slots
 *   chest/closet/cabinet : (56/64/48), défini dans ITEMS
 *
 * Pose d'un furniture container → insert de N slots vides (deleted=false)
 *   Attention, les 'key' ne sont disponibles qu'après la sauvegarde qui est asynchrone
 * Retrait d'un furniture container (vide obligatoire) → update deleted=true sur tous ses slots
 * Purge des deleted=true → au startSession (comme plants, buffs)
 *
 * ── Données en mémoire ──────────────────────────────────────────────────────
 *
 * InventoryManager maintient en mémoire :
 *   #bag[]         — 64 slots du joueur
 *   #hotbar[]      — 8 slots hotbar
 *   #armor[]       — 3 slots armure (HEAD, CHEST, FEET)
 *   #accessories[] — 5 slots accessoires
 *   #containers    — Map<furnitureId, slots[]> — containers du monde chargés
 *   #trash         — dernier slot jeté à la poubelle (annulation possible)
 *   #dirtyKeys     — Set<key> — clés DB des slots modifiés depuis l'ouverture
 *
 * ── Stackabilité ────────────────────────────────────────────────────────────
 *
 * Deux slots sont stackables si et seulement si :
 *   item === item && prefix === prefix
 *   les deux slots ne doivent pas être locked
 *
 * ── Sauvegarde (à la fermeture) ─────────────────────────────────────────────
 *
 * Seuls les slots dont la key est dans #dirtyKeys sont sauvegardés.
 * Nécessite une conversion slot en mémoire => slots en database
 * #dirtyKeys est vidé à l'ouverture du panel.
 *
 * À la fermeture, trois eventBus sont émis :
 *   'inventory/closed'        — signal général de fermeture
 *   'inventory/static-buffs'  — payload: {trinkets: itemId[], accessories: itemId[], armor: [{itemId, prefix}]
 *   'hotbar/changed'          — payload: slots[] hotbar mise à jour
 *
 * ── Actions disponibles ─────────────────────────────────────────────────────
 *
 * Manipulation items :
 *   - Déplacer un slot vers un autre slot (bag ↔ bag, bag ↔ coffre, coffre ↔ coffre, bag ↔ hotbar, bag ↔ armor, bag ↔ accesories, accesories ↔ accesories, hotbar ↔ hotbar)
 *   - Stack / destack items identiques (même item, même prefix)
 *   - Verrouiller / déverrouiller un slot
 *   - Jeter un item à la poubelle (1 action annulable jusqu'à fermeture)
 *   - Utiliser un item (bit USABLE dans item.type, switch sur item.stype)
 *
 * Gear :
 *   - Équiper / déséquiper armure (3 slots HEAD/CHEST/FEET)
 *   - Détection set complet via champ 'set' dans ITEMS
 *   - Équiper / déséquiper accessoires (5 slots)
 *
 * Containers :
 *   - Sélectionner un container via dropdown (si plusieurs dans le range)
 *   - Renommer un container
 *   - Transfert bag → container / container → bag
 *
 * Debug :
 *   - Icône cheat → window.prompt (commandes de test)
 *
 * ── Autres API ─────────────────────────────────────────────────────
 *
 * - Renvoyer 'true' si tous les slots d'un coffre sont vides
 * - Ajout d'un item dans le bag/hotbar (suite à un loot), stack si item identique, ajout dans le premier slot libre sinon (décision à prendre : que faire quand l'inventaire n'a plus de slots libre ?)
 *
 */

class InventoryManager {
  // Joueur
  #bag // Array(64)  — slots fixes, index = numéro de slot
  #hotbar // Array(8)   — slots fixes
  #armor // Array(3)   — HEAD=0, CHEST=1, FEET=2
  #accessories // Array(5)   — slots fixes

  // Coffres du monde (chargés à l'ouverture de l'overlay)
  #containers // Map<furnitureId, Array(capacity)>

  // Poubelle
  #trash // {item, count, prefix} | null — annulable jusqu'à fermeture

  // Persistance
  #dirtyKeys // Set<number> — clés DB des slots modifiés

  constructor () {
    this.#bag = []
    this.#hotbar = []
    this.#armor = []
    this.#accessories = []
    this.#containers = new Map()
    this.#trash = null
    this.#dirtyKeys = new Set() // Set<slot> — références directes aux slots modifiés
  }

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
   * Initialise les tableaux fixes depuis les enregistrements DB chargés au
   * démarrage de session. À appeler une seule fois après le chargement DB.
   *
   * @param {Array<object>} dbSlots — tous les slots du joueur (bag/hotbar/armor/accessory)
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

  // Vérification d'intégrité
  initCheck () {
    if (this.#bag.length !== BAG_CAPACITY) console.error(new Error(`[InventoryManager] bag: ${this.#bag.length} slots, attendu ${BAG_CAPACITY}`))
    if (this.#hotbar.length !== HOTBAR_CAPACITY) console.error(new Error(`[InventoryManager] hotbar: ${this.#hotbar.length} slots, attendu ${HOTBAR_CAPACITY}`))
    if (this.#armor.length !== ARMOR_CAPACITY) console.error(new Error(`[InventoryManager] armor: ${this.#armor.length} slots, attendu ${ARMOR_CAPACITY}`))
    if (this.#accessories.length !== ACCESSORY_CAPACITY) console.error(new Error(`[InventoryManager] accessories: ${this.#accessories.length} slots, attendu ${ACCESSORY_CAPACITY}`))
    for (const [furnitureId, slots] of this.#containers) {
      const expected = CONTAINER_CAPACITY[slots[0].container]
      if (slots.length !== expected) console.error(new Error(`[InventoryManager] container ${furnitureId}: ${slots.length} slots, attendu ${expected}`))
    }
  }

  // ─── Accesseurs (lecture seule pour l'Overlay) ───────────────

  get bag () { return this.#bag }
  get hotbar () { return this.#hotbar }
  get armor () { return this.#armor }
  get accessories () { return this.#accessories }

  /**
   * @param {string} furnitureId
   * @returns {Array|undefined}
   */
  getContainer (furnitureId) {
    return this.#containers.get(furnitureId)
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
   * Déplace un item du bag vers un slot accessoire (swap ou stack).
   * @param {number} sourceIndex
   * @param {number} targetIndex
   */
  moveBagToAccessory (sourceIndex, targetIndex) {
    this.#swapOrStack(this.#bag[sourceIndex], this.#accessories[targetIndex])
  }

  /**
   * Déplace un item d'un slot accessoire vers le bag (swap ou stack).
   * @param {number} sourceIndex
   * @param {number} targetIndex
   */
  moveAccessoryToBag (sourceIndex, targetIndex) {
    this.#swapOrStack(this.#accessories[sourceIndex], this.#bag[targetIndex])
  }

  // ─── Transferts Armor ────────────────────────────────────────

  /**
   * Déplace un item du bag vers un slot armure.
   * Sans effet si l'item source n'est pas compatible avec le slot armure cible.
   * @param {number} sourceIndex
   * @param {number} targetIndex — 0=HEAD, 1=BODY, 2=FOOT
   */
  moveBagToArmor (sourceIndex, targetIndex) {
    const src = this.#bag[sourceIndex]
    if (src.item === '') return
    if (ITEMS[src.item].armor !== ARMOR_SLOTS[targetIndex]) return
    this.#swapOrStack(src, this.#armor[targetIndex])
  }

  /**
   * Déplace un item d'un slot armure vers le bag.
   * @param {number} sourceIndex — 0=HEAD, 1=BODY, 2=FOOT
   * @param {number} targetIndex
   */
  moveArmorToBag (sourceIndex, targetIndex) {
    this.#swapOrStack(this.#armor[sourceIndex], this.#bag[targetIndex])
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
   */
  trashFromBag (slotIndex) {
    const src = this.#bag[slotIndex]
    this.#trash = {item: src.item, count: src.count, prefix: src.prefix}
    src.item = ''
    src.count = 0
    src.prefix = ''
    this.#dirtyKeys.add(src.key)
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
}
export const inventoryManager = new InventoryManager()

// ── CSS ──────────────────────────────────────────────────────────────────────

// injection des classes HTML utilisées par l'inventory Overlay
const inventorySlotStyle = document.createElement('style')
inventorySlotStyle.textContent = /* css */`
inventory-slot {
  position: relative;
  display: inline-block;
  width: 64px;
  height: 64px;
  border-radius: 6px;
  background-color: #4A90E2;
  color: white;
  border: 3px solid #888;
  box-sizing: border-box;
  cursor: pointer;
  transition: border-color 0.15s;
}

inventory-slot.hotbar {
  background-color: #FFB347;
  color: black;
}

inventory-slot.armor { background-color: #77DD77; }
inventory-slot.armor inventory-slot.set { background-color: #69f785; }
inventory-slot.accessory { background-color: #B39DDB; }
inventory-slot.inactive {
  background-color: #bbb;
    pointer-events: none;
}

inventory-slot:hover {
  border-color: #f1a15bff;  /* gris clair — neutre sur tous les fonds */
}

inventory-slot.selected,
inventory-slot.selected:hover {
  border-color: #e67e22;  /* orange prime sur le hover */
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
  color: #ffffff;
  text-shadow: 1px 1px 2px #000;
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
  background-color: #3c3e45;
  border: 1px solid #3f4149;
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
#ui-inventory-panel .inv-actions   { grid-column: 4; grid-row: 1 / 4; background-color: orange; }
#ui-inventory-panel .inv-chest-header { grid-column: 5; grid-row: 1; background-color: cyan; }
#ui-inventory-panel .inv-chest     { grid-column: 5; grid-row: 2 / 4; }

#ui-inventory-panel .inv-panel {
  background-color: #24252c;
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
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background-color: #808088;
}

#ui-inventory-panel .inv-chest-select {
  flex: 1;
  background-color: #3e3e4e;
  color: #d8d8d8;
  border: 1px solid #666;
  border-radius: 3px;
  font-size: 13px;
  padding: 2px 4px;
}

#ui-inventory-panel .inv-chest-rename {
  background-color: transparent;
  border: none;
  cursor: pointer;
  font-size: 16px;
}

#ui-inventory-panel .inv-chest-rename:disabled {
  cursor: default;
}
`
document.head.appendChild(inventorySlotStyle)

// ── Classe ───────────────────────────────────────────────────────────────────

class InventorySlot extends HTMLElement {
  static get observedAttributes () {
    return ['item', 'count', 'locked', 'usable']
  }

  connectedCallback () {
    const key = this.getAttribute('key')
    const location = this.getAttribute('location')

    this.innerHTML = /* html */`
      ${key !== null ? `<div class="key">${key}</div>` : ''}
      <svg class="lock hidden" viewBox="0 0 24 24" width="14" height="14">
  <path fill="currentColor" d="M4 13a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-10a3 3 0 0 1-3-3zM6 19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1zM10 16a2 2 0 0 1 4 0 2 2 0 0 1-4 0zM7 11v-4a5 5 0 0 1 10 0v4h-2v-4a3 3 0 0 0-6 0v4z"/>
</svg>
      <div class="image hidden"></div>
      <div class="count"></div>
    `

    this._elLock = this.querySelector('.lock')
    this._elImage = this.querySelector('.image')
    this._elCount = this.querySelector('.count')

    this._count = 0
    this._usable = null
    this._location = location !== null ? `Slot : ${location}\n` : ''
    this.setAttribute('title', this._location)
  }

  attributeChangedCallback (name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name === 'item') this._itemChanged(newValue)
    else if (name === 'count') this._countChanged(newValue)
    else if (name === 'locked') this._lockedChanged(newValue)
    else if (name === 'usable') this._usableChanged(newValue)
  }

  _itemChanged (value) {
    if (value === null || value === '') {
      this.setAttribute('title', this._location)
      this._elImage.classList.add('hidden')
      return
    }
    const item = ITEMS[value]
    const {file, sx, sy, sw, sh} = item.image
    this._elImage.classList.remove('hidden')
    this._elImage.style.backgroundImage = `url('/assets/${file}.png')`
    this._elImage.style.backgroundPosition = `-${sx}px -${sy}px`
    this._elImage.style.width = `${sw}px`
    this._elImage.style.height = `${sh}px`
    this.setAttribute('title', `${this._location}${item.name}`)
  }

  _countChanged (value) {
    this._count = value !== null ? parseInt(value, 10) : 0
    this._formatCount()
  }

  _usableChanged (value) {
    this._usable = value !== null ? parseInt(value, 10) : null
    this._formatCount()
  }

  _formatCount () {
    if (this._usable === null) {
      this._elCount.textContent = this._count > 1 ? String(this._count) : ''
    } else {
      this._elCount.textContent = `${this._count}/${this._usable}`
    }
  }

  _lockedChanged (value) {
    // value === null si absent, '' si présent
    this._elLock.classList.toggle('hidden', value === null)
  }
}

customElements.define('inventory-slot', InventorySlot)

class InventoryOverlay {
  #container
  #content

  // Remplace le constructor entier de InventoryOverlay

  constructor () {
  // 1. Conteneur Principal — dimensions calculées
    this.#container = document.createElement('div')
    this.#container.id = 'ui-inventory-panel'

    // 2. Header
    this.#container.appendChild(createOverlayHeader('🎒 Inventory [I]', 'inventory'))

    // 3. Contents
    this.buildContent()

    // // 3. Zone de contenu — 4 colonnes horizontales
    // this.#content = document.createElement('div')
    // this.#content.className = 'inv-content'

    // // 3.1 Hotbar — colonne gauche, 8 slots verticaux
    // const colHotbar = document.createElement('div')
    // colHotbar.className = 'inv-hotbar inv-panel'
    // for (let i = 0; i < HOTBAR_CAPACITY; i++) {
    //   const slot = document.createElement('inventory-slot')
    //   slot.setAttribute('key', String(i + 1))
    //   slot.setAttribute('location', `hotbar/${i}`)
    //   slot.classList.add('hotbar')
    //   colHotbar.appendChild(slot)
    // }

    // // 3.2 Zone centrale — bag (haut) + armor/accessoires (bas)
    // const colCenter = document.createElement('div')
    // colCenter.className = 'inv-center'

    // // Bag 8×8
    // const gridBag = document.createElement('div')
    // gridBag.className = 'inv-grid inv-panel'

    // for (let i = 0; i < BAG_CAPACITY; i++) {
    //   const slot = document.createElement('inventory-slot')
    //   slot.setAttribute('location', `bag/${i}`)
    //   gridBag.appendChild(slot)
    // }

    // // Armor + Accessoires côte à côte
    // const rowGear = document.createElement('div')
    // rowGear.className = 'inv-gear'

    // // Armor — 3 slots horizontaux
    // const gridArmor = document.createElement('div')
    // gridArmor.className = 'inv-armor inv-panel'

    // const ARMOR_LABELS = ['HEAD', 'BODY', 'FEET']
    // for (let i = 0; i < ARMOR_CAPACITY; i++) {
    //   const slot = document.createElement('inventory-slot')
    //   slot.setAttribute('location', `armor/${ARMOR_LABELS[i]}`)
    //   slot.classList.add('armor')
    //   gridArmor.appendChild(slot)
    // }

    // // Accessoires — 5 slots horizontaux
    // const gridAccessory = document.createElement('div')
    // gridAccessory.className = 'inv-accessory inv-panel'

    // for (let i = 0; i < ACCESSORY_CAPACITY; i++) {
    //   const slot = document.createElement('inventory-slot')
    //   slot.setAttribute('location', `accessory/${i}`)
    //   slot.classList.add('accessory')
    //   gridAccessory.appendChild(slot)
    // }

    // rowGear.appendChild(gridArmor)
    // rowGear.appendChild(gridAccessory)
    // colCenter.appendChild(gridBag)
    // colCenter.appendChild(rowGear)

    // // 3.3 Colonne actions — icônes verticales (placeholder)
    // const colActions = document.createElement('div')
    // colActions.className = 'inv-actions inv-panel'

    // // 3.4 Zone coffre — header dropdown (haut) + grille 8×8 (bas)
    // const colChest = document.createElement('div')
    // colChest.className = 'inv-chest'

    // // Header coffre
    // const chestHeader = document.createElement('div')
    // chestHeader.className = 'inv-chest-header'

    // const chestSelect = document.createElement('select')

    // const chestRename = document.createElement('button')
    // chestRename.textContent = '✏️'
    // chestRename.title = 'Renommer le coffre'

    // chestHeader.appendChild(chestSelect)
    // chestHeader.appendChild(chestRename)

    // // Grille coffre 8×8
    // const gridChest = document.createElement('div')
    // gridChest.className = 'inv-grid inv-panel'

    // for (let i = 0; i < 64; i++) {
    //   const slot = document.createElement('inventory-slot')
    //   slot.setAttribute('location', `chest/${i}`)
    //   slot.classList.add('inactive')
    //   gridChest.appendChild(slot)
    // }

    // colChest.appendChild(chestHeader)
    // colChest.appendChild(gridChest)

    // // Assemblage final
    // this.#content.appendChild(colHotbar)
    // this.#content.appendChild(colCenter)
    // this.#content.appendChild(colActions)
    // this.#content.appendChild(colChest)
    this.#container.appendChild(this.#content)
    document.body.appendChild(this.#container)

    // 4. Événements
    this.#initEvents()
  }

  buildContent () {
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

    const chestHeader = document.createElement('div')
    chestHeader.className = 'inv-chest-header'
    const chestHeaderContent = this.buildChestHeader()
    chestHeader.appendChild(chestHeaderContent)

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

  buildHotbar () {
    const grid = document.createElement('div')
    grid.className = 'inv-hotbar-grid inv-panel'

    for (let i = 0; i < HOTBAR_CAPACITY; i++) {
      const slot = document.createElement('inventory-slot')
      slot.setAttribute('key', String(i + 1))
      slot.setAttribute('location', `hotbar/${i}`)
      slot.classList.add('hotbar')
      grid.appendChild(slot)
    }

    return grid
  }

  buildBag () {
    const grid = document.createElement('div')
    grid.className = 'inv-bag-grid inv-panel'

    for (let i = 0; i < BAG_CAPACITY; i++) {
      const slot = document.createElement('inventory-slot')
      slot.setAttribute('location', `bag/${i}`)
      grid.appendChild(slot)
    }

    return grid
  }

  buildArmor () {
    const grid = document.createElement('div')
    grid.className = 'inv-armor-grid inv-panel'

    const ARMOR_LABELS = ['HEAD', 'BODY', 'FEET']
    for (let i = 0; i < ARMOR_CAPACITY; i++) {
      const slot = document.createElement('inventory-slot')
      slot.setAttribute('location', `armor/${ARMOR_LABELS[i]}`)
      slot.classList.add('armor')
      grid.appendChild(slot)
    }

    return grid
  }

  buildAccessory () {
    const grid = document.createElement('div')
    grid.className = 'inv-accessory-grid inv-panel'

    for (let i = 0; i < ACCESSORY_CAPACITY; i++) {
      const slot = document.createElement('inventory-slot')
      slot.setAttribute('location', `accessory/${i}`)
      slot.classList.add('accessory')
      grid.appendChild(slot)
    }

    return grid
  }

  buildChestHeader () {
    const header = document.createElement('div')
    header.className = 'inv-chest-header-content inv-panel'

    const select = document.createElement('select')
    select.className = 'inv-chest-select'

    const btnRename = document.createElement('button')
    btnRename.className = 'inv-chest-rename'
    btnRename.textContent = '✏️'
    btnRename.title = 'Renommer le coffre'
    btnRename.disabled = true

    header.appendChild(select)
    header.appendChild(btnRename)

    return header
  }

  buildChest () {
    const grid = document.createElement('div')
    grid.className = 'inv-chest-grid inv-panel'

    for (let i = 0; i < 64; i++) {
      const slot = document.createElement('inventory-slot')
      slot.setAttribute('location', `chest/${i}`)
      slot.classList.add('inactive')
      grid.appendChild(slot)
    }

    return grid
  }

  #initEvents () {
    // Abonnement au Bus
    eventBus.on('inventory/open', () => {
      this.#container.style.display = 'flex'
    })

    eventBus.on('inventory/close', () => {
      this.#container.style.display = 'none'
    })
  }
}
export const inventoryOverlay = new InventoryOverlay()
