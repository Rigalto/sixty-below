/**
 * @file ui.mjs
 * @description Layer 2 - Gestion de l'Interface Utilisateur (DOM & Canvas Overlays).
 */

import {eventBus} from './utils.mjs'
import {WEATHER_TYPE, MOON_PHASE} from './constant.mjs'

class EnvironmentOverlay {
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
      moonPhase: -1
    }

    this.#initDOM()
    this.#bindEvents()
  }

  #initDOM () {
    // 1. Création du conteneur principal
    this.container = document.createElement('div')
    this.container.id = 'env-overlay-root'

    // CSS "In-JS" pour le prototype (à déplacer dans un CSS externe plus tard)
    const style = this.container.style
    style.position = 'absolute'
    style.top = '10px'
    style.right = '10px'
    style.width = '160px'
    style.backgroundColor = 'rgba(20, 20, 25, 0.9)'
    style.border = '1px solid #444'
    style.color = '#ffffff' // Haut contraste
    style.fontFamily = 'Segoe UI, Roboto, monospace'
    style.fontSize = '14px'
    style.borderRadius = '6px'
    style.pointerEvents = 'none'
    style.padding = '8px'
    style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)'
    style.zIndex = '1000'
    style.display = 'flex'
    style.flexDirection = 'column'
    style.gap = '6px'

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
    eventBus.on('time/clock', (data) => this.#updateClock(data))

    // Daily -> Weather & Moon
    eventBus.on('time/daily', (data) => this.#updateEnvironment(data))

    // Init Global -> Tout mettre à jour
    eventBus.on('time/first-loop', (data) => {
      this.#updateClock(data)
      this.#updateEnvironment(data)
      this.#updateSkyBorder(data.skyColor)
    })

    // Sky Color -> Juste la bordure (Debug visuel)
    eventBus.on('time/sky-color-changed', (color) => this.#updateSkyBorder(color))

    // Future: player/move -> Coords
    // eventBus.on('player/move', (pos) => this.#updateCoords(pos))
  }

  /* =========================================
     UPDATES ATOMIQUES (Performance)
     ========================================= */

  #updateClock ({day, hour, minute}) {
    // 1. Update Day (Rare)
    const displayDay = `DAY ${day + 1}`
    if (this.dom.day.textContent !== displayDay) {
      this.dom.day.textContent = displayDay
    }

    // 2. Update Time (Fréquent)
    // Logique de "Fuzzy Time" (Simulée ici, à connecter aux Buffs plus tard)
    // TODO: Vérifier buff 'clock_precision'
    const precision = 0 // 0: Exact, 1: 5min, 2: 15min, 3: Heure seulement

    let m = minute
    if (precision === 1) m = Math.floor(minute / 5) * 5
    if (precision === 2) m = Math.floor(minute / 15) * 15
    if (precision === 3) m = 0

    const timeStr = `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`

    // Optim: On ne touche au DOM que si le texte change
    if (this.lastState.minuteStr !== timeStr) {
      this.dom.time.textContent = timeStr
      this.lastState.minuteStr = timeStr
    }
  }

  #updateEnvironment ({weather, nextWeather, moonPhase}) {
    // 1. Weather Now
    if (this.lastState.weatherCode !== weather) {
      const wInfo = WEATHER_TYPE[weather] || {name: 'Unknown', icon: '?'}

      // MODIFICATION : Usage direct de l'icône
      this.dom.weatherNow.textContent = wInfo.icon
      this.dom.weatherNow.title = wInfo.name

      this.lastState.weatherCode = weather
    }

    // 2. Weather Next (Affiché seulement si artefact présent)
    // TODO: Vérifier buff 'weather_forecast'
    const hasForecastBuff = true // Test
    if (hasForecastBuff) {
      const nwInfo = WEATHER_TYPE[nextWeather] || {name: '?', icon: '?'}
      this.dom.weatherNext.style.display = 'block'

      // MODIFICATION : Petite flèche + Icône
      this.dom.weatherNext.textContent = `➞ ${nwInfo.icon}`
      this.dom.weatherNext.title = `Tomorrow: ${nwInfo.name}`
    } else {
      this.dom.weatherNext.style.display = 'none'
    }

    // 3. Moon Phase
    if (this.lastState.moonPhase !== moonPhase) {
      // Logique "Fuzzy Moon" (4 phases vs 8 phases)
      // TODO: brancher buff 'moon-accuracy'
      const hasMoonBuff = false

      let phaseObj = MOON_PHASE[moonPhase]

      if (!hasMoonBuff) {
        // On tronque à 4 phases (0, 2, 4, 6)
        // 0,1 -> 0 (Full)
        // 2,3 -> 2 (Third Q)
        // 4,5 -> 4 (New)
        // 6,7 -> 6 (First Q)
        const phaseIndex = Math.floor(moonPhase / 2) * 2
        phaseObj = MOON_PHASE[phaseIndex]
      }

      this.dom.moon.textContent = phaseObj.icon
      this.dom.moon.title = phaseObj.name + (!hasMoonBuff ? ' (Approx)' : '')

      this.lastState.moonPhase = moonPhase
    }
  }

  #updateSkyBorder (color) {
    // Visual Feedback Debug uniquement
    this.container.style.borderLeft = `5px solid ${color}`
  }

  #updateCoords ({x, y}) {
    // TODO: Vérifier buff 'gps'
    const hasGPS = true
    if (hasGPS) {
      this.dom.coords.style.display = 'block'
      this.dom.coords.textContent = `X: ${x.toFixed(0)} | Y: ${y.toFixed(0)}`
    } else {
      this.dom.coords.style.display = 'none'
    }
  }
}
// Instanciation immédiate (Singleton autonome)
export const environmentOverlay = new EnvironmentOverlay()
