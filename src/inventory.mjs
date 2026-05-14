import {OVERLAYS} from './constant.mjs'
import {eventBus} from './utils.mjs'
import {createOverlayHeader} from './ui.mjs'

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
