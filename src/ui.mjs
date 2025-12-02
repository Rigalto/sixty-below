/**
 * @file ui.mjs
 * @description Layer 2 - Gestion de l'Interface Utilisateur (DOM & Canvas Overlays).
 */

import {eventBus} from './utils.mjs'
import {WEATHER_TYPE, MOON_PHASE, MOON_PHASE_BLURRED, STATE, OVERLAYS} from './constant.mjs'

/* ====================================================================================================
   AFFICHAGE DATE/HEURE METEO LUNE POSITION
   ==================================================================================================== */

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
    Object.assign(this.container.style, {
      position: 'relative', // MODIFIÉ : Plus d'absolute, suit le flux normal
      // top et right SUPPRIMÉS
      width: '100%', // MODIFIÉ : Prend toute la largeur de la colonne
      marginBottom: '10px', // AJOUT : Espace avec l'overlay suivant
      backgroundColor: 'rgba(20, 20, 25, 0.9)',
      border: '1px solid #444',
      color: '#ffffff',
      fontFamily: 'Segoe UI, Roboto, monospace',
      fontSize: '14px',
      borderRadius: '6px',
      padding: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
     display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    })

    // 2. Injection du HTML Statique
    this.container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid #555; padding-bottom:4px; margin-bottom:4px;">
        <span id="env-day" style="font-size:1.4em; font-weight:bold; letter-spacing:1px;">DAY ?</span>
        <span id="env-time" style="font-size:1.4em; font-weight:bold; letter-spacing:1px;">--:--</span>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; font-size: 24px;">
        <div style="display:flex; gap:5px;">
          <div id="env-weather-now" title="Weather" style="cursor:help;">[?]</div>
          <div id="env-weather-next" title="Forecast" style="display:none;">[->?]</div>
        </div>
        <div id="env-moon" title="Moon Phase" style="cursor:help;">[M]</div>
      </div>

      <div id="env-coords" style="font-size:0.8em; color:#888; font-family:monospace; margin-top:2px;">
        POS: -- | --
      </div>
    `

    const overlayPanel = document.getElementById('overlay-panel')
    if (overlayPanel) {
      overlayPanel.appendChild(this.container)
    } else {
      console.error('EnvironmentOverlay: #overlay-panel introuvable, fallback sur body')
      document.body.appendChild(this.container)
    }

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

    // Clock -> Time & Day (mesure : 50µs, microtask inutile)
    eventBus.on('time/clock', this.#updateClockEnvironment.bind(this)) // TODO: utiliser l'eventBus 'time/every-5-minutes'

    // Daily -> Day, Weather & Moon (mesure : 100µs, microtask inutile)
    eventBus.on('time/daily', this.#updateEnvironment.bind(this))

    // Init Global -> Tout mettre à jour (estimation : 150µs, microtask inutile car acceptable lors de l'init)
    eventBus.on('time/first-loop', this.#firstloopEnvironment.bind(this))

    // Sky Color -> Juste la bordure (Debug visuel) - TODO: à supprimer
    eventBus.on('time/sky-color-changed', this.#updateSkyBorder.bind(this))

    // Buff de précision d'affichage du temps (estimation : 10µs, microtask inutile)
    eventBus.on('buff/display-time-precision', this.#toggleTimePrecision.bind(this))
    // (estimation : 50µs, microtask inutile)
    eventBus.on('buff/display-moon-detail', this.#toggleMoonDetail.bind(this))
    // (estimation : 10µs, microtask inutile)
    eventBus.on('buff/display-next-weather', this.#toggleNextWeather.bind(this))
    // (estimation : 50µs, microtask inutile)
    eventBus.on('buff/display-coords', this.#toggleCoords.bind(this))

    // TODO: Future: player/move -> Coords
    // eventBus.on('player/move', (pos) => this.#updateCoords(pos))
  }

  /* =========================================
     UPDATES ATOMIQUES (Performance)
     ========================================= */

  #firstloopEnvironment (data) {
    this.#updateClockEnvironment(data)
    this.#updateEnvironment(data)
    this.#updateSkyBorder(data.skyColor) // TODO: à supprimer
  }

  // temps d'exécution mesuré à 0.05 ms
  #updateClockEnvironment ({hour, minute}) {
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

  #toggleNextWeather (active) {
    this.dom.weatherNext.style.display = active ? 'block' : 'none'
  }

  #toggleMoonDetail (active) {
    this.buffs.moonDetail = active
    // On utilise la valeur en cache pour redessiner avec la nouvelle précision
    if (this.lastState.moonPhase !== -1) { this.#updateMoon(this.lastState.moonPhase) }
  }

  #toggleTimePrecision (lvl) { this.buffs.timePrecision = lvl }

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

/* ====================================================================================================
   AFFICHAGE VOILE SOMBRE
   ==================================================================================================== */

class ModalBlocker {
  #element

  constructor () {
    this.#element = document.createElement('div')
    this.#element.id = 'ui-modal-backdrop'

    // Styles critiques (CSS-in-JS pour éviter une feuille de style externe)
    Object.assign(this.#element.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.6)', // Noir à 60% d'opacité
      zIndex: OVERLAYS.backdrop.zIndex,
      display: 'none'
    })
    document.body.appendChild(this.#element)

    // Abonnement au changement d'état
    eventBus.on('state/changed', this.onStateChanged.bind(this))
  }

  /**
   * Réaction au changement d'état du jeu
   * @param {object} payload - { state, oldState }
   */
  onStateChanged ({state}) {
    // Si on est en EXPLORATION, le voile disparaît.
    // Pour tout autre état (INFORMATION, COMBAT, CREATION), il apparaît.
    this.#element.style.display = (state === STATE.EXPLORATION) ? 'none' : 'block'
  }
}

export const modalBlocker = new ModalBlocker()

/* ====================================================================================================
   FACTORIES (DON'T REPEAT YOURSELF)
   ==================================================================================================== */
/**

 * Crée un header standardisé pour les overlays.
 * @param {string} titleText - Le titre (avec icône)
 * @returns {object} { header, closeBtn } - Retourne le conteneur et le bouton pour attacher les events.
 */
export function createOverlayHeader (titleText, overlayId) {
  // 1. Injection unique du style global pour le :hover (Idempotent)
  if (!document.getElementById('ui-global-styles')) {
    const style = document.createElement('style')
    style.id = 'ui-global-styles'
    style.textContent = '.ui-close-btn:hover { color: #ffffff !important; }'
    document.head.appendChild(style)
  }

  // 2. Conteneur Header
  const header = document.createElement('div')
  Object.assign(header.style, {
    height: '40px',
    background: 'linear-gradient(90deg, #2c3e50 0%, #4a69bd 50%, #2c3e50 100%)',
    borderBottom: '2px solid #1e272e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center', // Titre centré
    position: 'relative', // Référence pour le bouton absolu
    padding: '0 10px',
    fontSize: '16px',
    fontWeight: 'bold',
    textShadow: '1px 1px 2px black',
    borderTopLeftRadius: '4px',
    borderTopRightRadius: '4px',
    color: '#ffffff',
    userSelect: 'none'
  })

  // 3. Titre
  const title = document.createElement('span')
  title.textContent = titleText
  header.appendChild(title)

  // 4. Bouton Fermer
  const closeBtn = document.createElement('span')
  closeBtn.textContent = '✕'
  closeBtn.className = 'ui-close-btn' // Hook CSS
  Object.assign(closeBtn.style, {
    cursor: 'pointer',
    fontSize: '14px',
    color: '#bdc3c7',
    position: 'absolute',
    right: '10px',
    transition: 'color 0.2s'
  })
  closeBtn.addEventListener('click', (e) => {
    // On empêche la propagation (sécurité)
    e.stopPropagation()
    // On demande la fermeture à l'InputManager
    eventBus.emit('overlay/close', overlayId)
  })
  header.appendChild(closeBtn)

  return {header, closeBtn}
}
