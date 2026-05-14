import {eventBus} from './utils.mjs'
// import {timeManager, taskScheduler, microTasker, eventBus} from './utils.mjs'

/**
 * @file buff.mjs
 * @description Gestion centralisée des buffs du joueur.
 * Layer : 4. Dépendances autorisées : constant.mjs, utils.mjs, eventBus.
 *
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
  #fns = new Map() // fonctions pur buffs composés : mining-speed, movement-speed...
  #currentWeather
  #currentTimeslot

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
    return this.#values.get(name) ?? this.#fns.get(name)?.() ?? 0
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
      result[name] = this.#values.get(name) ?? this.#fns.get(name)?.() ?? 0
    }
    return result
  }
}

export const buffManager = new BuffManager()

/* ====================================================================================================
   AFFICHAGE DES BUFFS ACTIFS
   ==================================================================================================== */

class BuffWidget {
}
export const buffWidget = new BuffWidget()
