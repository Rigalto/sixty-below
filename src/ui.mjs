// ui.mjs — MenuBarWIdget - CreationDialogOverlay - EnvironementWidget - TileHoverWidget - ModalBlocker - SeedWidget

import {eventBus, seededRNG} from './utils.mjs'
import {gameCore} from './core.mjs'
import {WEATHER_TYPE, MOON_PHASE, MOON_PHASE_BLURRED, STATE, OVERLAYS, UI_LAYOUT, PATH_INVENTORY, PATH_CRAFT, PATH_TROPHY, PATH_HELP, PATH_NEW_WORLD, PATH_DEBUG, SVG_ICON} from './constant.mjs'

// ── Styles MenuBarWidget ─────────────────────────────────────────────────────
const menuBarStyle = document.createElement('style')
menuBarStyle.textContent = /* css */`
  #menu-bar-root {
    position: relative;
    width: 100%;
    margin-bottom: 10px;
    background-color: rgba(20, 20, 25, 0.9);
    border: 1px solid #444;
    border-radius: 6px;
    padding: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: row;
    gap: 5px;
    order: ${UI_LAYOUT.MENU_BAR};
  }
#menu-bar-root .menu-bar-btn {
  flex: 1;
  background-color: transparent;
  border: 1px solid #444;
  border-radius: 4px;
  color: #bdc3c7;
  cursor: pointer;
  padding: 6px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
#menu-bar-root .menu-bar-btn svg            { width: 100%; height: 100%; }
#menu-bar-root .menu-bar-btn:hover          { border-color: #bdc3c7; color: #ffffff; }
#menu-bar-root .menu-bar-btn-meta           { background-color: #442222; border-color: #663333; }
#menu-bar-root .menu-bar-btn-meta:hover     { border-color: #cc4444; }

/* TileHoverWidget */

#tile-hover-root {
  position: relative;
  width: 100%;
  order: ${UI_LAYOUT.TILE_HOVER};
  margin-bottom: 10px;
  background-color: rgba(20, 20, 25, 0.9);
  border: 1px solid #444;
  border-radius: 6px;
  padding: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.5);
  font-family: Segoe UI, Roboto, monospace;
  font-size: 18px;
  font-weight: bold;
  color: #ffffff;
  user-select: none;
}

/* ModalBlocker */

#ui-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.6);
  z-index: ${OVERLAYS.backdrop.zIndex};
  display: none;
}
`
document.head.appendChild(menuBarStyle)

/* ====================================================================================================
   AFFICHAGE BOUTONS D'ACTION
   ==================================================================================================== */

// MenuBarWidget → nom joueur 'Control Panel'
class MenuBarWidget {
  #container = null // div englobant le widget
  #btnInventory = null // bouton ouverture inventaire
  #btnCraft = null // bouton ouverture craft
  #btnAchievement = null // bouton ouverture succès
  #btnHelp = null // bouton ouverture aide
  #btnNewWorld = null // bouton nouveau monde (meta)
  #btnSnapshot = null // bouton snapshot debug (meta)

  constructor () {
    this.#initDOM()
    this.#bindEvents()
  }

  /**
   * Construit le DOM du conteneur et des boutons, et l'injecte dans #right-sidebar.
   */
  #initDOM () {
    // 1. Conteneur Principal
    this.#container = document.createElement('div')
    this.#container.id = 'menu-bar-root'

    // Création des boutons
    const btnInv = this.#createBtn('btn-inv', PATH_INVENTORY, 'Open Inventory [I]')
    const btnCraft = this.#createBtn('btn-craft', PATH_CRAFT, 'Open Crafting [C]')
    const btnAchievement = this.#createBtn('btn-achievement', PATH_TROPHY, 'Achievements [U]')
    const btnHelp = this.#createBtn('btn-help', PATH_HELP, 'Help [H]')
    const btnNew = this.#createBtn('btn-new', PATH_NEW_WORLD, 'Generate New World', true)
    const btnSnap = this.#createBtn('btn-snap', PATH_DEBUG, 'Debug: Copy Snapshot', true)

    // Assemblage dans le conteneur
    this.#container.appendChild(btnInv)
    this.#container.appendChild(btnCraft)
    this.#container.appendChild(btnAchievement)
    this.#container.appendChild(btnHelp)
    this.#container.appendChild(btnNew)
    this.#container.appendChild(btnSnap)

    // Injection DOM
    const overlayPanel = document.getElementById('right-sidebar')
    if (overlayPanel) {
      overlayPanel.appendChild(this.#container)
    } else {
      console.warn('MenuBarWidget: #right-sidebar missing')
    }

    // Cache refs
    this.#btnInventory = btnInv
    this.#btnCraft = btnCraft
    this.#btnAchievement = btnAchievement
    this.#btnHelp = btnHelp
    this.#btnNewWorld = btnNew
    this.#btnSnapshot = btnSnap
  }

  /**
   * Crée un bouton icône SVG pour la barre de menu.
   * @param {string}  id     — identifiant DOM
   * @param {string}  path   — chemin SVG (constante PATH_*)
   * @param {string}  title  — tooltip
   * @param {boolean} isMeta — true = style destructif (rouge)
   * @returns {HTMLButtonElement}
   */
  #createBtn (id, path, title, isMeta = false) {
    const btn = document.createElement('button')
    btn.id = id
    btn.innerHTML = SVG_ICON(path, 'class="menu-btn-icon"')
    btn.title = title
    btn.className = isMeta ? 'menu-bar-btn menu-bar-btn-meta' : 'menu-bar-btn'
    return btn
  }

  /**
   * Lie les handlers de clic sur les boutons.
   */
  #bindEvents () {
    this.#btnInventory.addEventListener('click', this.#onInventoryClick.bind(this))
    this.#btnCraft.addEventListener('click', this.#onCraftClick.bind(this))
    this.#btnAchievement.addEventListener('click', this.#onAchievementClick.bind(this))
    this.#btnHelp.addEventListener('click', this.#onHelpClick.bind(this))
    this.#btnNewWorld.addEventListener('click', this.#onNewWorldClick.bind(this))
    this.#btnSnapshot.addEventListener('click', this.#onSnapshotClick.bind(this))
  }

  /**
   * Émet une demande d'ouverture d'overlay.
   * Un handler par overlay.
   */
  #onInventoryClick () { eventBus.emit('overlay/open-request', 'inventory') }

  #onCraftClick () { eventBus.emit('overlay/open-request', 'craft') }

  #onAchievementClick () { eventBus.emit('overlay/open-request', 'achievement') }

  #onHelpClick () { eventBus.emit('overlay/open-request', 'help') }

  #onNewWorldClick () { eventBus.emit('overlay/open-request', 'creation') }

  /**
   * Copie un snapshot du canvas principal dans le presse-papier.
   * Flash visuel sur le bouton en cas de succès.
   * Nécessite HTTPS ou localhost.
   */
  async #onSnapshotClick () {
    // Méthode Debug : Copie le canvas principal dans le presse-papier
    try {
      const canvas = document.getElementById('world-renderer')
      if (!canvas) throw new Error('Game Canvas not found')

      // Conversion Blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve))

      // Clipboard API (Nécessite contexte sécurisé ou localhost)
      if (!navigator.clipboard) {
        throw new Error('Clipboard API unavailable')
      }

      await navigator.clipboard.write([
        new ClipboardItem({'image/png': blob})
      ])

      console.log('Debug: Snapshot copied to clipboard!')

      // Feedback visuel rapide (Flash bouton)
      const originalColor = this.#btnSnapshot.style.backgroundColor
      this.#btnSnapshot.style.backgroundColor = '#228822'
      setTimeout(() => {
        this.#btnSnapshot.style.backgroundColor = originalColor
      }, 200)
    } catch (e) {
      console.error('Debug Snapshot Failed:', e)
      alert('Snapshot failed (See console). Note: Requires HTTPS or Localhost.')
    }
  }
}

export const menuBarWidget = new MenuBarWidget()

/* ====================================================================================================
   DIALOGUE DE LANCEMENT DE LA CREATION D'UN NOUVEAU MONDE
   ==================================================================================================== */

class CreationDialogOverlay {
  constructor () {
    this.container = null
    this.dom = {
      seedInput: null,
      btnGenerate: null,
      btnBackup: null,
      btnRestore: null,
      btnClose: null
    }

    this.open = this.open.bind(this)
    this.close = this.close.bind(this)
    this.onGenerateClick = this.onGenerateClick.bind(this)
    this.#initDOM()
    this.#bindEvents()

    this.currentSeed = 1234
  }

  #initDOM () {
    // 1. Conteneur Modal (Centré)
    this.container = document.createElement('div')
    this.container.id = 'creation-dialog'

    Object.assign(this.container.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '400px',
      backgroundColor: '#222',
      border: '2px solid #555',
      borderRadius: '8px',
      padding: '0',
      display: 'none',
      flexDirection: 'column',
      gap: '0',
      zIndex: OVERLAYS.dialog.zIndex,
      boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
      color: '#eee',
      fontFamily: 'Segoe UI, sans-serif'
    })

    // 2. Header
    this.container.appendChild(createOverlayHeader('🌱 World Management', 'creation'))

    // 3. Wrapper de Contenu (pour préserver l'espacement interne)
    const content = document.createElement('div')
    Object.assign(content.style, {
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px'
    })
    this.container.appendChild(content)

    // 4. Zone Seed (Input Numérique)
    const seedContainer = document.createElement('div')
    Object.assign(seedContainer.style, {display: 'flex', flexDirection: 'column', gap: '5px'})

    const seedLabel = document.createElement('label')
    seedLabel.textContent = 'World Seed (1 - 99999):'
    seedLabel.style.fontSize = '12px'
    seedLabel.style.color = '#aaa'

    const seedInput = document.createElement('input')
    seedInput.type = 'number'
    seedInput.min = '1'
    seedInput.max = '99999'
    seedInput.placeholder = 'Random'
    Object.assign(seedInput.style, {
      padding: '8px',
      backgroundColor: '#111',
      border: '1px solid #444',
      color: '#fff',
      borderRadius: '4px',
      fontFamily: 'monospace'
    })

    seedInput.addEventListener('input', function () {
      if (this.value !== '' && this.value > 99999) this.value = (this.value / 10) | 0

      // if (this.value < 1) this.value = 1
      // if (this.value > 99999) this.value = (this.value / 10) | 0
    })

    seedContainer.appendChild(seedLabel)
    seedContainer.appendChild(seedInput)

    // 5. Bargraph de progression — masqué par défaut
    const progressContainer = document.createElement('div')
    Object.assign(progressContainer.style, {
      position: 'relative',
      height: '36px',
      backgroundColor: '#111',
      border: '1px solid #444',
      borderRadius: '4px',
      display: 'none',
      overflow: 'hidden'
    })

    const progressBar = document.createElement('div')
    Object.assign(progressBar.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      height: '100%',
      width: '0%',
      backgroundColor: '#388e3c',
      transition: 'width 0.1s ease',
      borderRadius: '4px'
    })

    const progressTopic = document.createElement('div')
    Object.assign(progressTopic.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      color: '#fff',
      textShadow: '0 0 4px #000, 0 0 4px #000',
      fontFamily: 'monospace',
      pointerEvents: 'none'
    })

    progressContainer.appendChild(progressBar)
    progressContainer.appendChild(progressTopic)
    content.appendChild(progressContainer)

    // 6. Boutons d'action
    const createBtn = (text, icon, isActive) => {
      const btn = document.createElement('button')
      // Layout icône + texte
      btn.innerHTML = `<span style="margin-right:8px;">${icon}</span>${text}`

      Object.assign(btn.style, {
        padding: '10px',
        backgroundColor: isActive ? '#388e3c' : '#333',
        color: isActive ? '#fff' : '#888',
        border: '1px solid ' + (isActive ? '#2e7d32' : '#444'),
        borderRadius: '4px',
        cursor: isActive ? 'pointer' : 'not-allowed',
        textAlign: 'left',
        fontSize: '14px',
        fontWeight: 'bold',
        transition: 'background-color 0.2s'
      })

      if (isActive) {
        btn.onmouseenter = () => { btn.style.backgroundColor = '#4caf50' }
        btn.onmouseleave = () => { btn.style.backgroundColor = '#388e3c' }
      }

      return btn
    }

    const btnGenerate = createBtn('GENERATE NEW WORLD', '🌱', true)
    const btnBackup = createBtn('BACKUP WORLD (Coming Soon)', '💾', false)
    const btnRestore = createBtn('RESTORE WORLD (Coming Soon)', '📥', false)

    // Assemblage
    content.appendChild(seedContainer)
    content.appendChild(btnGenerate)
    content.appendChild(btnBackup)
    content.appendChild(btnRestore)

    // Injection dans le body (car z-index élevé, sort du flux sidebar)
    document.body.appendChild(this.container)

    // Cache Refs
    this.dom.seedInput = seedInput
    this.dom.btnGenerate = btnGenerate
    this.dom.btnBackup = btnBackup
    this.dom.btnRestore = btnRestore
    this.dom.progressContainer = progressContainer
    this.dom.progressBar = progressBar
    this.dom.progressTopic = progressTopic
  }

  #bindEvents () {
    // Actions UI
    this.dom.btnGenerate.addEventListener('click', this.onGenerateClick)

    this.dom.seedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.onGenerateClick()
    })

    // Écoute pour affichage/masquage
    eventBus.on('creation/open', () => {
      this.open()
    })

    eventBus.on('creation/close', () => {
      this.close()
    })

    // Affichage de la progression de la création du monde
    this.onProgress = this.onProgress.bind(this)
    window.addEventListener('world-generation-progress', this.onProgress)

    // Les boutons grisés ne font rien (pas d'event listener)
  }

  init (seed) { this.currentSeed = seed }

  // --- Logic ---
  open () {
    this.container.style.display = 'flex'
    this.dom.seedInput.value = this.currentSeed
    this.dom.seedInput.focus()
  }

  close () {
    this.container.style.display = 'none'
  }

  async onGenerateClick () {
    const seed = parseInt(this.dom.seedInput.value.trim(), 10) || seededRNG.randomGetMinMax(1, 99999)
    console.log(`[CreationDialog]: Request generation with seed [${seed}]`)
    this.state = STATE.CREATION
    this.#showProgress()

    try {
      gameCore.stopSession()
      const {worldGenerator} = await import('./generate.mjs')
      await worldGenerator.generate(seed)
      // this.state = STATE.CREATION
      gameCore.startSession()
      eventBus.emit('overlay/close', 'creation')
    } catch (error) {
      console.error('[CreationDialogOverlay] Failed to load generator:', error)
    } finally {
      this.#hideProgress()
    }
  }

  onProgress (e) {
    const {passed, total, topic} = e.detail
    const pct = Math.round(passed / total * 100)
    this.dom.progressBar.style.width = `${pct}%`
    this.dom.progressTopic.textContent = `${topic} (${pct}%)`
  }

  #showProgress () {
    this.dom.btnGenerate.style.display = 'none'
    this.dom.progressBar.style.width = '0%'
    this.dom.progressTopic.textContent = '0%'
    this.dom.progressContainer.style.display = 'block'
  }

  #hideProgress () {
    this.dom.progressContainer.style.display = 'none'
    this.dom.btnGenerate.style.display = 'block'
  }
}
export const creationDialogOverlay = new CreationDialogOverlay()

/* ====================================================================================================
   AFFICHAGE DATE/HEURE METEO LUNE POSITION
   ==================================================================================================== */

const TIMESLOT_NAMES = ['Midnight', 'Dawn', 'Morning', 'Noon', 'Afternoon', 'Dusk', 'Evening', 'Night']

class EnvironmentWidget {
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
      order: UI_LAYOUT.ENVIRONMENT,
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
      gap: '6px',
      userSelect: 'none'
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

    const overlayPanel = document.getElementById('right-sidebar')
    if (overlayPanel) {
      overlayPanel.appendChild(this.container)
    } else {
      console.error('EnvironmentWidget: #right-sidebar introuvable, fallback sur body')
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

    // Buff de précision d'affichage du temps (estimation : 10µs, microtask inutile)
    eventBus.on('buff/display-time-precision', this.#toggleTimePrecision.bind(this))
    // (estimation : 50µs, microtask inutile)
    eventBus.on('buff/display-moon-detail', this.#toggleMoonDetail.bind(this))
    // (estimation : 10µs, microtask inutile)
    eventBus.on('buff/display-next-weather', this.#toggleNextWeather.bind(this))
    // (estimation : 50µs, microtask inutile)
    eventBus.on('buff/display-coords', this.#toggleCoords.bind(this))
    // (estimation : 50µs, microtask inutile)
    eventBus.on('time/timeslot', this.#updateTimeslot.bind(this))

    // TODO: Future: player/move -> Coords
    // eventBus.on('player/move', (pos) => this.#updateCoords(pos))
  }

  /* =========================================
     UPDATES ATOMIQUES (Performance)
     ========================================= */

  #firstloopEnvironment (data) {
    this.#updateClockEnvironment(data)
    this.#updateEnvironment(data)
    this.#updateTimeslot(data)
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

  #updateTimeslot ({tslot}) {
    this.dom.time.title = TIMESLOT_NAMES[tslot]
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
export const environmentWidget = new EnvironmentWidget()

/* ====================================================================================================
   TILE HOVER WIDGET
   ====================================================================================================

   Singleton : tileHoverWidget.

   Widget du Control Panel affichant la tuile sous la souris et les entités qu'elle contient.
   Toujours présent, deux spans inline mis à jour indépendamment.

   Responsabilités :
     - Afficher le nom de la tuile survolée (#spanTile) — mise à jour synchrone via eventBus
     - Afficher les entités présentes (#spanDetail) — mise à jour asynchrone via microtask

   Interactions :
     eventBus    — écoute : world/tile-hover (node|null) → met à jour #spanTile
     microTasker — onTileHoverDetail(node) enfilée via enqueueOnce() par la loop
                   → interroge plantManager / furnitureManager (TODO) → met à jour #spanDetail

   ==================================================================================================== */

class TileHoverWidget {
  #spanTile = null // span nom de la tuile
  #spanDetail = null // span plante / furniture sous la souris

  constructor () {
    this.#initDOM()
    this.#bindEvents()
  }

  /**
   * Construit le DOM du widget et l'injecte dans #right-sidebar.
   */
  #initDOM () {
    const container = document.createElement('div')
    container.id = 'tile-hover-root'
    this.#spanTile = document.createElement('span')
    this.#spanTile.id = 'tile-hover-tile'
    this.#spanTile.textContent = '—'

    this.#spanDetail = document.createElement('span')
    this.#spanDetail.id = 'tile-hover-detail'
    this.#spanDetail.textContent = '—'

    container.appendChild(this.#spanTile)
    container.appendChild(this.#spanDetail)

    const sidebar = document.getElementById('right-sidebar')
    if (sidebar) {
      sidebar.appendChild(container)
    } else {
      console.error('TileHoverWidget: #right-sidebar introuvable')
    }
  }

  /**
   * Abonnement aux événements.
   */
  #bindEvents () {
    this.onTileHoverDetail = this.onTileHoverDetail.bind(this)
    eventBus.on('world/tile-hover', this.#onTileHover.bind(this))
  }

  /**
   * Mise à jour synchrone du nom de tuile. Appelé depuis la loop via eventBus.
   * @param {object|null} node
   */
  #onTileHover (node) {
    this.#spanTile.textContent = node ? node.name : '—'
  }

  /**
   * Microtask : interroge plantManager / furnitureManager et met à jour le span détail.
   * Bindée dans #bindEvents — enfilée via microTasker.enqueueOnce() dans la loop.
   * @param {object|null} node
   */
  onTileHoverDetail (node) {
    let text = ''
    this.count = this.count === undefined ? 1 : this.count + 1
    // TODO: interroger plantManager et furnitureManager quand implémentés
    text += ` / ${this.count}`

    this.#spanDetail.textContent = text
  }
}
export const tileHoverWidget = new TileHoverWidget()

/* ====================================================================================================
   MODAL BLOCKER
   ====================================================================================================

   Singleton : modalBlocker.

   Voile semi-transparent affiché par-dessus le monde dès que le jeu quitte l'état EXPLORATION.
   Aucune interaction utilisateur — pointer-events traversants.

   Interactions :
     eventBus  — écoute : state/changed ({state}) → affiche ou masque le voile

   ==================================================================================================== */

class ModalBlocker {
  #element

  constructor () {
    this.#element = document.createElement('div')
    this.#element.id = 'ui-modal-backdrop'
    document.body.appendChild(this.#element)

    // Abonnement au changement d'état
    this.onStateChanged = this.onStateChanged.bind(this)
    eventBus.on('state/changed', this.onStateChanged)
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
 * @returns {DOM Element} header } - Retourne le conteneur
 */
export function createOverlayHeader (titleText, overlayId) {
  // 1. Injection unique du style global pour le :hover (Idempotent)
  if (!document.getElementById('ui-global-styles')) {
    const style = document.createElement('style')
    style.id = 'ui-global-styles'

    style.textContent = `
  :root {
    --ov-bg-main:     #2f3136;
    --ov-bg-side:     #23272a;
    --ov-bg-deep:     #1e2128;
    --ov-bg-input:    #1e2128;
    --ov-border:      #202225;
    --ov-border-sub:  #4a5568;
    --ov-accent:      #4a69bd;
    --ov-text:        #ffffff;
    --ov-text-sec:    #dcddde;
    --ov-text-muted:  #cbcccd;
    --ov-btn-bg:      #2c3e50;
    --ov-text-orange: #e67e22;

    --slot-bg-default:   #4A90E2;
    --slot-bg-hotbar:    #e1f381;
    --slot-bg-armor:     #40e040;
    --slot-bg-armor-set: #80f840;
    --slot-bg-accessory: #B39DDB;
    --slot-bg-inactive:  #bbbbbb;
  }
  .ui-close-btn:hover { color: #ffffff !important; }
  `
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

  return header
}

/* ====================================================================================================
   AFFICHAGE DE LA CLEF DU MONDE
   ==================================================================================================== */

class SeedWidget {
  #span

  constructor () {
    const container = document.createElement('div')
    Object.assign(container.style, {
      order: UI_LAYOUT.WORLD_KEY,
      padding: '2px 6px',
      fontSize: '18px',
      color: '#000',
      fontFamily: 'monospace',
      userSelect: 'none'
    })

    container.textContent = 'World Seed: '

    this.#span = document.createElement('span')
    Object.assign(this.#span.style, {
      color: '#000',
      userSelect: 'text',
      cursor: 'text',
      textShadow: '0 0 4px #ffffff'
    })
    this.#span.title = 'Double-click to select, Ctrl-C to copy'
    container.appendChild(this.#span)

    const rightSidebar = document.getElementById('right-sidebar')
    if (rightSidebar) {
      rightSidebar.appendChild(container)
    } else {
      console.error('SeedWidget: #right-sidebar introuvable')
    }
  }

  init (seed) {
    this.#span.textContent = seed
  }
}

export const seedWidget = new SeedWidget()
