/**
 * @file ui.mjs
 * @description Layer 2 - Gestion de l'Interface Utilisateur (DOM & Canvas Overlays).
 */

import {eventBus} from './utils.mjs'
import {WEATHER_TYPE, MOON_PHASE, MOON_PHASE_BLURRED} from './constant.mjs'

class EnvironmentOverlay {
  #boundUpdateCoords = null // Référence pour on/off dynamique

  constructor () {
    this.container = null
    // Cache des références DOM pour éviter les querySelector en boucle (Perf ++)
    this.dom = {
      day: null,
      time: null,
      weatherNow: null,
      weatherNext: null,
      moon: null,
      coords: null
    }

    // État interne pour éviter les redraws inutiles si la valeur ne change pas visuellement
    this.lastState = {
      minuteStr: '',
      weatherCode: -1,
      nextWeatherCode: -1,
      moonPhase: -1
    }

    // tableau mis à jour sur eventBus (TODO)
    this.buffs = {
      // BUFFS - Gameplay
      timePrecision: 0, // précision de l'heure => 0: Heure, 1: 15min, 2: 5min
      moonDetail: false, // true => active l'affichage des 8 phases au lieu de 4
      coords: false // true => active l'affichage des coordonnées
    }

    // Pré-binding pour performance et désabonnement propre
    this.#boundUpdateCoords = this.#updateCoords.bind(this)

    this.#initDOM()
    this.#bindEvents()
  }

  #initDOM () {
    // 1. Création du conteneur principal
    this.container = document.createElement('div')
    this.container.id = 'env-overlay-root'

    // CSS "In-JS"
    this.container.style.cssText = `
    position: absolute; top: 10px; right: 10px; width: 160px;
    background-color: rgba(20, 20, 25, 0.9); border: 1px solid #444;
    color: #ffffff; font-family: Segoe UI, Roboto, monospace; font-size: 14px;
    border-radius: 6px; pointer-events: none; padding: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.5); z-index: 1000;
    display: flex; flex-direction: column; gap: 6px;
  `

    // 2. Injection du HTML Statique
    this.container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid #555; padding-bottom:4px; margin-bottom:4px; pointer-events:none;">
        <span id="env-day" style="font-size:1.4em; font-weight:bold; letter-spacing:1px;">DAY ?</span>
        <span id="env-time" style="font-size:1.4em; font-weight:bold; letter-spacing:1px;">--:--</span>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; font-size: 24px;">
        <div style="display:flex; gap:5px;">
          <div id="env-weather-now" title="Weather" style="cursor:help; pointer-events:auto;">[?]</div>
          <div id="env-weather-next" title="Forecast" style="display:none; pointer-events:auto;">[->?]</div>
        </div>
        <div id="env-moon" title="Moon Phase" style="cursor:help; pointer-events:auto;">[M]</div>
      </div>

      <div id="env-coords" style="font-size:0.8em; color:#888; font-family:monospace; margin-top:2px;">
        POS: -- | --
      </div>
    `

    document.body.appendChild(this.container)

    // 3. Mise en cache des références (Hydratation DOM)
    this.dom.day = document.getElementById('env-day')
    this.dom.time = document.getElementById('env-time')
    this.dom.weatherNow = document.getElementById('env-weather-now')
    this.dom.weatherNext = document.getElementById('env-weather-next')
    this.dom.moon = document.getElementById('env-moon')
    this.dom.coords = document.getElementById('env-coords')
  }

  #bindEvents () {
    // Mise à jour atomique par type d'événement

    // Clock -> Time & Day
    // TODO: utiliser l'eventBus 'time/every-5-minutes'
    eventBus.on('time/clock', this.#updateClock.bind(this))

    // Daily -> Day, Weather & Moon
    eventBus.on('time/daily', this.#updateEnvironment.bind(this))

    // Init Global -> Tout mettre à jour
    eventBus.on('time/first-loop', (data) => {
      this.#updateClock(data)
      this.#updateEnvironment(data)
      this.#updateSkyBorder(data.skyColor)
    })

    // Sky Color -> Juste la bordure (Debug visuel)
    eventBus.on('time/sky-color-changed', this.#updateSkyBorder.bind(this))

    // Events de Buffs
    eventBus.on('buff/display-time-precision', (lvl) => {
      this.buffs.timePrecision = lvl
    })
    eventBus.on('buff/display-moon-detail', (active) => {
      this.buffs.moonDetail = active
      // On utilise la valeur en cache pour redessiner avec la nouvelle précision
      if (this.lastState.moonPhase !== -1) {
        this.#updateMoon(this.lastState.moonPhase)
      }
    })

    eventBus.on('buff/display-next-weather', (active) => {
      this.dom.weatherNext.style.display = active ? 'block' : 'none'
    })

    eventBus.on('buff/display-coords', this.#toggleCoords.bind(this))

    // TODO: Future: player/move -> Coords
    // eventBus.on('player/move', (pos) => this.#updateCoords(pos))
  }

  /* =========================================
     UPDATES ATOMIQUES (Performance)
     ========================================= */

  #updateClock ({hour, minute}) {
    // 2. Update Time (Fréquent)
    // Logique de "Fuzzy Time" (Simulée ici, à connecter aux Buffs plus tard)
    // TODO: Vérifier buff 'clock_precision'
    const precision = this.buffs.timePrecision // 0: Heure, 1: 15min, 2: 5min

    let m = minute
    if (precision === 0) m = 0
    if (precision === 1) m = Math.floor(minute / 15) * 15
    if (precision === 2) m = Math.floor(minute / 5) * 5 // TODO: ligne à supprimer en branchant l'eventBus 'time/every-5-minutes'

    const timeStr = `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`

    // Optim: On ne touche au DOM que si le texte change
    if (this.lastState.minuteStr !== timeStr) {
      this.dom.time.textContent = timeStr
      this.lastState.minuteStr = timeStr
    }
  }

  #updateEnvironment ({day, weather, nextWeather, moonPhase}) {
    // 1. Day
    this.dom.day.textContent = `DAY ${day + 1}`

    // 2. Weather Now
    if (this.lastState.weatherCode !== weather) {
      const wInfo = WEATHER_TYPE[weather] || {name: 'Unknown', icon: '?'}

      // MODIFICATION : Usage direct de l'icône
      this.dom.weatherNow.textContent = wInfo.icon
      this.dom.weatherNow.title = wInfo.name

      this.lastState.weatherCode = weather
    }

    // 3. Weather Next (Affiché seulement si artefact présent - point géré directment dans le handler d'eventBus)
    if (this.lastState.nextWeatherCode !== nextWeather) {
      const nwInfo = WEATHER_TYPE[nextWeather] || {name: '?', icon: '?'}
      // MODIFICATION : Petite flèche + Icône
      this.dom.weatherNext.textContent = `➞ ${nwInfo.icon}`
      this.dom.weatherNext.title = `Tomorrow: ${nwInfo.name}`

      this.lastState.nextWeatherCode = nextWeather
    }

    // 4. Moon Phase (Délégué)
    // On appelle systématiquement car c'est un changement de jour donc de pase de lune
    this.#updateMoon(moonPhase)
  }

  #updateMoon (moonPhase) {
    let phaseObj = MOON_PHASE[moonPhase]

    // Logique "Fuzzy Moon" (4 phases vs 8 phases)
    if (!this.buffs.moonDetail) {
      const phaseIndex = MOON_PHASE_BLURRED[moonPhase]
      phaseObj = MOON_PHASE[phaseIndex]
    }

    this.dom.moon.textContent = phaseObj.icon
    this.dom.moon.title = phaseObj.name + (!this.buffs.moonDetail ? ' (Approx)' : '')

    // Mise à jour du cache pour le prochain appel via buff
    this.lastState.moonPhase = moonPhase
  }

  // TODO: A supprimer - Debug uniquement
  #updateSkyBorder (color) {
    this.container.style.borderLeft = `5px solid ${color}`
  }

  #toggleCoords (isActive) {
    if (this.buffs.coords === isActive) return // Pas de changement

    this.buffs.coords = isActive
    this.dom.coords.style.display = isActive ? 'block' : 'none'

    if (isActive) {
      // Abonnement uniquement si nécessaire [Design 8.3]
      eventBus.on('player/move', this.#boundUpdateCoords)
    } else {
      // Désabonnement immédiat pour économiser le CPU
      eventBus.off('player/move', this.#boundUpdateCoords)
    }
  }

  #updateCoords ({x, y}) { // les coordonnées sont en tuiles (integer)
    this.dom.coords.textContent = `X: ${x} | Y: ${y}`
  }
}
// Instanciation immédiate (Singleton autonome)
export const environmentOverlay = new EnvironmentOverlay()
