// buff.mjs — BuffManager - BuffWidget

import {ITEMS, TRINKET_BUFF_TABLE} from '../assets/data/data.mjs'
import {eventBus, timeManager} from './utils.mjs'
import {UI_LAYOUT} from './constant.mjs'
import {playerManager} from './player.mjs'
// import {timeManager, taskScheduler, microTasker} from './utils.mjs'

/**
 * ── Principes ───────────────────────────────────────────────────────────────
 *
 * Un buff est une valeur (numérique ou booléenne) qui modifie le comportement
 * du jeu. Les buffs s'additionnent (jamais multipliés).
 * Valeur par défaut : 0 (falsy pour les booléens, neutre pour les numériques).
 *
 * ── Notation ────────────────────────────────────────────────────────────────
 *
 * Buff élémentaire  : camelCase   — ex. armorHelmetMiningSpeed, rainy, lucky
 * Buff composé      : kebab-case  — ex. mining-speed, movement-speed
 *
 * Un buff composé est la somme de tous les élémentaires qui le constituent.
 * Sa fonction de calcul est écrite en dur dans BuffManager pour la vitesse.
 *
 * ── Sources de buffs ────────────────────────────────────────────────────────
 *
 * Buffs statiques — actifs tant que la source est présente :
 *   - Lune (changement de jour)
 *   - Météo (changement de jour)
 *   - Cycle circadien (toutes les 3h in-game)
 *   - Trinkets (présence dans l'inventaire)
 *   - Accessories (slots dédiés)
 *   - Armure (3 slots gear)
 *   - Outil en main (slot actif hotbar)
 *   - Événements (invasion, météorite...)
 *
 * Buffs dynamiques (timer) — actifs pendant une durée déterminée :
 *   - Nourriture
 *   - Potions (sur-consommation → allongement du cooldown)
 *
 * Buffs environnementaux — recalculés à chaque changement de tuile :
 *   - Tuiles sous le joueur (Cobweb, Moss...)
 *   - Furniture dans le range du joueur
 *
 * ── Architecture ────────────────────────────────────────────────────────────
 *
 * #values : Map<string, number>         — valeurs brutes des buffs élémentaires
 *                                         mise à jour via eventBus
 * #fns    : Map<string, () => number>   — fonctions de calcul des buffs composés
 *                                         (et élémentaires calculés)
 *
 * getBuff(name) :
 *   return #values.get(name) ?? #fns.get(name)?.() ?? 0
 *
 * getBuffs(names) :
 *   itère sur le tableau, retourne un objet {name: value}
 *   utilisé par ex. par rollLootWithBuffs via buffManager.getBuffs(action.buffList)
 */

/* ====================================================================================================
   GESTION DES BUFFS
   ==================================================================================================== */

const MOON_BUFF_KEYS = ['fullMoon', 'waningGibbous', 'thirdQuarter', 'waningCrescent', 'newMoon', 'waxingCrescent', 'firstQuarter', 'waxingGibbous']
const WEATHER_BUFF_KEYS = ['sunny', 'cloudy', 'rainy', 'windy', 'stormy']
const TIMESLOT_BUFF_KEYS = ['midnight', 'dawn', 'morning', 'noon', 'afternoon', 'dusk', 'evening', 'night']

class BuffManager {
  #values = new Map() // valeurs brutes : rainy, lucky, armorHelmetMiningSpeed...

  #fns = new Map([ // fonctions pur buffs composés : mining-speed, movement-speed...
    // 'movement-speed' : vitesse horizontale du joueur, 0 = joueur immobile, 100% = PLAYER.SPEED
    // ne tient pas compte tuiles environnantes (sous le joueur et sous ses pieds)
    ['movement-speed', () => {
      if (this.#values.get('playerFreeze')) return 0
      return 100
    }],
    ['fall-damage', () => {
      return 100
    }],
    ['interaction-range', () => {
      const x = -10
      const y = -8
      const w = 20
      const h = 16
      return {x, y, w, h}
    }],
    ['mining-range', () => {
      const x = -2
      const y = -4
      const w = 6
      const h = 8
      return {x, y, w, h}
    }],
    ['mining-speed', () => {
      return 0
    }],
    ['foraging-range', () => {
      const x = -2
      const y = -4
      const w = 5
      const h = 7
      return {x, y, w, h}
    }],
    ['foraging-speed', () => {
      return 0
    }],
    ['chopping-speed', () => {
      return 0
    }],
    ['chopping-range', () => {
      const x = -2
      const y = -5
      const w = 7
      const h = 9
      return {x, y, w, h}
    }]
  ])

  timestamps = new Map() // buffId → expiration (timed uniquement)

  #trinketA = {} // buffer A — buffs trinkets courants ou prochains
  #trinketB = {} // buffer B — alterné avec A à chaque mise à jour
  #currentTrinket = null // pointe vers le buffer courant (valeurs en vigueur)
  #nextTrinket = null // pointe vers le buffer en cours de calcul

  #currentWeather
  #currentTimeslot

  initTrinket () {
    this.#resetBuffer(this.#trinketA, TRINKET_BUFF_TABLE)
    this.#resetBuffer(this.#trinketB, TRINKET_BUFF_TABLE)
    this.#currentTrinket = this.#trinketA
    this.#nextTrinket = this.#trinketB
    // Force la mise à jour des subscribers — valeurs toutes à 0 après reset
    eventBus.emit('buff/trinket-changed', new Set(Object.keys(TRINKET_BUFF_TABLE)))
  }

  init () {
    // Initialisation des buffs de lune à false
    for (const key of MOON_BUFF_KEYS) this.#values.set(key, false)

    // Initialisation des buffs de météo à false
    for (const key of WEATHER_BUFF_KEYS) this.#values.set(key, false)
    this.#currentWeather = 0 // index du weather courant pour le passer à false

    // Initialisation des buffs de Timeslot à false
    for (const key of TIMESLOT_BUFF_KEYS) this.#values.set(key, false)
    this.#values.set('isDay', false)
    this.#values.set('isNight', false)
    this.#currentTimeslot = 0

    // initialisation des handlers d'eventBus
    this.onDaily = this.onDaily.bind(this)
    eventBus.on('time/daily', this.onDaily)
    eventBus.on('time/first-loop', this.onDaily) // même handler — payload compatible

    this.onTimeslot = this.onTimeslot.bind(this)
    eventBus.on('time/timeslot', this.onTimeslot)
    eventBus.on('time/first-loop', this.onTimeslot) // payload contient tslot et isDay

    this.onDebug = this.onDebug.bind(this)
    eventBus.on('debug/buff-manager', this.onDebug)

    this.initTrinket()
    this.onStaticBuffs = this.onStaticBuffs.bind(this)
    eventBus.on('inventory/static-buffs', this.onStaticBuffs)

    // debug
    // this.#values.set('buff1', 50)
    // this.#values.set('buff2', 0)
    this.#values.set('dyn1', 100)
    this.timestamps.set('dyn1', timeManager.timestamp + 124000)
  }

  onDaily ({weather, moonPhase}) {
    // Met à 'false' la phase précédente et à 'true' la phase courante
    this.#values.set(MOON_BUFF_KEYS[(moonPhase - 1) & 7], false)
    this.#values.set(MOON_BUFF_KEYS[moonPhase], true)

    // weather mis à jour dans #values
    this.#values.set(WEATHER_BUFF_KEYS[this.#currentWeather], false)
    this.#values.set(WEATHER_BUFF_KEYS[weather], true)
    this.#currentWeather = weather
  }

  onTimeslot ({tslot, isDay}) {
  // Période
    this.#values.set(TIMESLOT_BUFF_KEYS[this.#currentTimeslot], false)
    this.#values.set(TIMESLOT_BUFF_KEYS[tslot], true)
    this.#currentTimeslot = tslot

    // Jour / Nuit
    this.#values.set('isDay', isDay)
    this.#values.set('isNight', !isDay)
  }

  onDebug () {
    let output = '--- BuffManager - Values ---\n'
    for (const [key, value] of this.#values) {
      output += `  ${key}: ${value}\n`
    }
    output += '--- BuffManager - Trinkets ---\n'
    for (const [key, value] of Object.entries(this.#currentTrinket)) {
      output += `  ${key}: ${value}\n`
    }
    output += '--- BuffManager - Functions ---\n'
    for (const [key] of this.#fns) {
      output += `  ${key}: ${this.#fns.get(key)()}\n`
    }
    console.log(output)
  }

  /**
   * Retourne la valeur d'un buff.
   * Cherche d'abord dans #values (O(1)), puis dans #fns (calcul à la demande).
   * Retourne 0 si le buff est inconnu (neutre pour numériques, falsy pour booléens).
   * @param {string} name
   * @returns {number}
   */
  getBuff (name) {
    return this.#values.get(name) ?? this.#fns.get(name)?.() ?? this.#currentTrinket[name] ?? 0
  }

  /**
   * Retourne les valeurs de plusieurs buffs en une seule opération.
   * Utilisé notamment par rollLootWithBuffs.
   * @param {string[]} names
   * @returns {Object.<string, number>}
   */
  getBuffs (names) {
    const result = {}
    for (const name of names) {
      result[name] = this.#values.get(name) ?? this.#fns.get(name)?.() ?? this.#currentTrinket[name] ?? 0
    }
    return result
  }

  /**
 * Positionne directement un buff élémentaire dans #values.
 * Réservé aux buffs dont la source est externe à BuffManager (ex: playerFreeze).
 * @param {string} name
 * @param {number|boolean} value
 */
  setBuff (name, value) {
    this.#values.set(name, value)
  }

  /**
   * Handler 'inventory/static-buffs' — dispatche vers chaque sous-handler.
   * Bindé dans constructor.
   * @param {{armor: string[], accessories: string[], trinkets: string[]}} payload
   */
  onStaticBuffs ({armor, accessories, trinkets}) {
    // this.#onArmorBuffs(armor)               // TODO
    // this.#onAccessoriesBuffs(accessories)   // TODO
    this.onTrinketsBuffs(trinkets)
  }

  /**
   * Recalcule les buffs trinkets, détecte les changements et émet buff/trinket-changed.
   * Bindé dans init() — écoute 'inventory/static-buffs'.
   * @param {{trinkets: string[]}} payload
   */
  onTrinketsBuffs (trinkets) {
    this.#resetBuffer(this.#nextTrinket, TRINKET_BUFF_TABLE)
    this.#applyItems(trinkets, TRINKET_BUFF_TABLE, this.#nextTrinket)
    const changed = this.#computeChanged(TRINKET_BUFF_TABLE, this.#currentTrinket, this.#nextTrinket)
    ;[this.#currentTrinket, this.#nextTrinket] = [this.#nextTrinket, this.#currentTrinket]
    if (changed.size > 0) eventBus.emit('buff/trinket-changed', changed)
  }

  /**
   * Remet à 0 toutes les entrées d'un buffer.
   * @param {object} buffer - {buffId: value}
   * @param {object} table  - {buffId: op}
   */
  #resetBuffer (buffer, table) {
    for (const key in table) { buffer[key] = 0 }
  }

  /**
   * Applique les buffs des items dans buffer selon leur op (sum / max / or / direct).
   * @param {string[]} itemIds
   * @param {object}   table  - {buffId: op}
   * @param {object}   buffer - {buffId: value}
   */
  #applyItems (itemIds, table, buffer) {
    for (const itemId of itemIds) {
      const item = ITEMS[itemId]
      if (!item?.buff) continue
      for (const {buff, value} of item.buff) {
        const op = table[buff]
        if (op === 'sum') { buffer[buff] += value } else if (op === 'max') { if (value > buffer[buff]) buffer[buff] = value } else if (op === 'or') { if (value) buffer[buff] = value } else { buffer[buff] = value }
      }
    }
  }

  /**
   * Retourne les buffIds dont la valeur diffère entre current et next.
   * @param {object} table
   * @param {object} current
   * @param {object} next
   * @returns {Set<string>}
   */
  #computeChanged (table, current, next) {
    const changed = new Set()
    for (const key in table) {
      if (current[key] !== next[key]) changed.add(key)
    }
    return changed
  }
}

export const buffManager = new BuffManager()

/* ====================================================================================================
   FONCTIONS HELPERS
   ==================================================================================================== */

/**
 * Teste si une tuile est dans l'interaction range centré sur le joueur.
 * Rectangle symétrique (sans direction) — coffres, stations, furnitures, pose de murs/furniture,
 * sowing, gardening.
 * @param {number} tileIndex    — (y << 10) | x
 * @param {object} [centerTile] — résultat de playerManager.getCenterTile() ; récupéré
 *                                automatiquement si absent (évite un appel redondant chez
 *                                les appelants qui l'ont déjà calculé)
 * @returns {boolean}
 */
export const isInInteractionRange = (tileIndex, centerTile) => {
  const {x, y, w, h} = buffManager.getBuff('interaction-range')
  const {x: cx, y: cy} = centerTile ?? playerManager.getCenterTile()
  const tileX = tileIndex & 0x3FF
  const tileY = tileIndex >> 10
  return tileX >= cx + x && tileX < cx + x + w &&
         tileY >= cy + y && tileY < cy + y + h
}

/* ====================================================================================================
   AFFICHAGE DES BUFFS ACTIFS
   ==================================================================================================== */

// Définition des buffs affichables
// { id, title, x, y, timed }
// x, y : coordonnées dans buff_32_32.png (multiples de 32)
const DISPLAY_BUFFS = [
  {id: 'armors', title: 'Armors', x: -128, y: 0},
  {id: 'buff1', title: 'Buff 1', x: 0, y: 0},
  {id: 'buff2', title: 'Buff 2', x: -32, y: 0},
  {id: 'dyn1', title: 'Dynamic Buff 1', x: -64, y: 0},
  {id: 'dyn2', title: 'Dynamic Buff 2', x: -96, y: 0}
]

class BuffWidget {
  #container
  #buffIds

  // Refs DOM précalculées : Map<id, {el, timeEl}>
  #refs = new Map()

  constructor () {
    this.#buildDOM()
    this.#startInterval()
    // Précalculé une fois de la liste des buffs
    this.#buffIds = DISPLAY_BUFFS.filter(def => def.id !== 'armors').map(def => def.id)
  }

  #buildDOM () {
    this.#container = document.createElement('div')
    this.#container.id = 'buff-widget'
    Object.assign(this.#container.style, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px',
      padding: '6px',
      backgroundColor: 'rgba(60, 65, 75, 0.9)',
      border: '1px solid #444',
      borderRadius: '6px',
      width: '100%',
      boxSizing: 'border-box',
      order: UI_LAYOUT.BUFF, // ← position dans le Control Panel
      marginBottom: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
    })

    for (const def of DISPLAY_BUFFS) {
      const el = document.createElement('div')
      el.title = def.title
      Object.assign(el.style, {
        display: def.id === 'armors' ? 'flex' : 'none',
        flexDirection: 'column',
        alignItems: 'center',
        width: '32px',
        cursor: 'default'
      })

      // Icône via ::before simulé avec un div dédié
      const icon = document.createElement('div')
      Object.assign(icon.style, {
        width: '32px',
        height: '32px',
        backgroundImage: 'url(assets/sprites/buff_32_32.png)',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: `${def.x}px ${def.y}px`,
        imageRendering: 'pixelated',
        flexShrink: '0'
      })
      el.appendChild(icon)

      // Temps restant
      const timeEl = document.createElement('div')
      Object.assign(timeEl.style, {
        fontSize: '10px',
        // color: '#cccccc',
        textAlign: 'center',
        lineHeight: '1',
        minHeight: '12px',
        userSelect: 'none',
        color: '#ffffff',
        textShadow: '1px 1px 2px #000000'
      })
      el.appendChild(timeEl)

      this.#container.appendChild(el)
      this.#refs.set(def.id, {el, timeEl, timed: def.timed})
    }

    // Injection dans le Control Panel
    const rightSidebar = document.getElementById('right-sidebar')
    if (rightSidebar) {
      rightSidebar.appendChild(this.#container)
    } else {
      console.error('BuffWidget: #right-sidebar introuvable')
    }
  }

  // setInterval 1s — toujours actif, même overlay ouvert ou génération nouveau monde en cours.
  // Si affichage erroné pendant génération : remettre les buffs à false avant génération
  // (objectStore buff écrasé de toute façon). Ne pas arrêter/relancer le setInterval.
  #startInterval () {
    setInterval(() => this.#update(), 1000)
  }

  #update () {
    const now = timeManager.timestamp
    const values = buffManager.getBuffs(this.#buffIds)

    for (const def of DISPLAY_BUFFS) {
      if (def.id === 'armors') continue
      const {el, timeEl} = this.#refs.get(def.id)
      const value = values[def.id]
      const expiration = buffManager.timestamps.get(def.id)

      if (expiration) {
        // buff timed
        const remaining = Math.ceil((expiration - now) / 1000)
        if (remaining > 0) {
          el.style.display = 'flex'
          timeEl.textContent = remaining
        } else {
          el.style.display = 'none'
          timeEl.textContent = ''
        }
      } else {
        // buff statique : value = truthy/falsy
        el.style.display = value ? 'flex' : 'none'
      }
    }
  }
}

export const buffWidget = new BuffWidget()
