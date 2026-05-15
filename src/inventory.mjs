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

class InventoryOverlay {
  #container
  #header
  #content

  constructor () {
    // 1. Création du Conteneur Principal
    this.#container = document.createElement('div')
    this.#container.id = 'ui-inventory-panel'

    Object.assign(this.#container.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '600px',
      height: '400px',
      backgroundColor: '#2f3136',
      border: '1px solid #202225',
      boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
      borderRadius: '4px',
      zIndex: OVERLAYS.inventory.zIndex,
      display: 'none', // Caché par défaut
      flexDirection: 'column',
      fontFamily: 'Segoe UI, Roboto, sans-serif',
      color: '#ffffff',
      userSelect: 'none' // On évite de sélectionner le texte en cliquant partout
    })

    // 2. Création du Header via la Factory
    const header = createOverlayHeader('🎒 Inventory [I]', 'inventory')
    this.#header = header

    // 3. Zone de contenu (Vide pour l'instant, juste pour remplir)
    this.#content = document.createElement('div')
    Object.assign(this.#content.style, {
      flex: '1',
      position: 'relative'
    })

    // Assemblage
    this.#container.appendChild(this.#header)
    this.#container.appendChild(this.#content)
    document.body.appendChild(this.#container)

    // 4. Gestion des événements
    this.#initEvents()
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
