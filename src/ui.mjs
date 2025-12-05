/**
 * @file ui.mjs
 * @description Layer 2 - Gestion de l'Interface Utilisateur (DOM & Canvas Overlays).
 */

import {eventBus} from './utils.mjs'
import {WEATHER_TYPE, MOON_PHASE, MOON_PHASE_BLURRED, STATE, OVERLAYS, UI_LAYOUT} from './constant.mjs'

/* ====================================================================================================
   AFFICHAGE BOUTONS D'ACTION
   ==================================================================================================== */

class MenuBarWidget {
  constructor () {
    this.container = null
    this.dom = {
      btnInventory: null,
      btnCraft: null,
      btnHelp: null,
      btnNewWorld: null,
      btnSnapshot: null
    }
    this.#initDOM()
    this.#bindEvents()
  }

  #initDOM () {
    // 1. Conteneur Principal
    this.container = document.createElement('div')
    this.container.id = 'menu-bar-root'

    Object.assign(this.container.style, {
      position: 'relative',
      width: '100%',
      order: UI_LAYOUT.MENU_BAR,
      marginBottom: '10px',
      backgroundColor: 'rgba(20, 20, 25, 0.9)',
      border: '1px solid #444',
      borderRadius: '6px',
      padding: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
      display: 'flex', // Flexbox
      flexDirection: 'row', // MODIFIÉ : Une seule ligne horizontale
      gap: '5px' // Espace uniforme entre les 5 boutons
    })

    // Helper pour créer les boutons (DRY)
    const createBtn = (id, text, title, isMeta = false) => {
      const btn = document.createElement('button')
      btn.id = id
      btn.textContent = text
      btn.title = title
      Object.assign(btn.style, {
        flex: '1', // Chaque bouton prendra 20% de la largeur
        backgroundColor: isMeta ? '#442222' : '#333',
        color: '#ddd',
        border: '1px solid #555',
        borderRadius: '4px',
        padding: '6px 0', // Un peu plus de padding pour les cibles tactiles/souris
        cursor: 'pointer',
        fontSize: '18px', // MODIFIÉ : Taille augmentée pour la lisibilité des icônes
        lineHeight: '1.2',
        fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif' // Assure le rendu des émojis
      })

      btn.onmouseenter = () => { btn.style.backgroundColor = isMeta ? '#663333' : '#555' }
      btn.onmouseleave = () => { btn.style.backgroundColor = isMeta ? '#442222' : '#333' }
      return btn
    }

    // Création des boutons
    const btnInv = createBtn('btn-inv', '🎒', 'Open Inventory [I]')
    const btnCraft = createBtn('btn-craft', '⚒️', 'Open Crafting [C]')
    const btnHelp = createBtn('btn-help', '📜', 'Help [H]')

    const btnNew = createBtn('btn-new', '🌱', 'Generate New World', true)
    const btnSnap = createBtn('btn-snap', '🖼️', 'Debug: Copy Snapshot', true)

    // Assemblage dans le conteneur
    this.container.appendChild(btnInv)
    this.container.appendChild(btnCraft)
    this.container.appendChild(btnHelp)
    this.container.appendChild(btnNew)
    this.container.appendChild(btnSnap)

    // Injection DOM
    const overlayPanel = document.getElementById('right-sidebar')
    if (overlayPanel) {
      overlayPanel.appendChild(this.container)
    } else {
      console.warn('MenuBarWidget: #right-sidebar missing')
    }

    // Cache refs
    this.dom.btnInventory = btnInv
    this.dom.btnCraft = btnCraft
    this.dom.btnHelp = btnHelp
    this.dom.btnNewWorld = btnNew
    this.dom.btnSnapshot = btnSnap
  }

  #bindEvents () {
    this.dom.btnInventory.addEventListener('click', this.#onInventoryClick.bind(this))
    this.dom.btnCraft.addEventListener('click', this.#onCraftClick.bind(this))
    this.dom.btnHelp.addEventListener('click', this.#onHelpClick.bind(this))
    this.dom.btnNewWorld.addEventListener('click', this.#onNewWorldClick.bind(this))
    this.dom.btnSnapshot.addEventListener('click', this.#onSnapshotClick.bind(this))
  }

  // --- Handlers ---

  #onInventoryClick () {
    eventBus.emit('overlay/open-request', 'inventory')
  }

  #onCraftClick () {
    eventBus.emit('overlay/open-request', 'craft')
  }

  #onHelpClick () {
    eventBus.emit('overlay/open-request', 'help')
  }

  #onNewWorldClick () {
    eventBus.emit('overlay/open-request', 'creation')
  }

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
      const originalColor = this.dom.btnSnapshot.style.backgroundColor
      this.dom.btnSnapshot.style.backgroundColor = '#228822'
      setTimeout(() => {
        this.dom.btnSnapshot.style.backgroundColor = originalColor
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

    seedInput.addEventListener('input', function() {
      if (this.value < 1) this.value = 1
      if (this.value > 99999) this.value = (this.value / 10) | 0
    })

    seedContainer.appendChild(seedLabel)
    seedContainer.appendChild(seedInput)

    // 4. Boutons d'action
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
  }

  #bindEvents () {
    // Actions UI
    this.dom.btnGenerate.addEventListener('click', this.onGenerateClick.bind(this))

    // Écoute pour affichage/masquage
    eventBus.on('creation/open', () => {
      this.open()
    })

    eventBus.on('creation/close', () => {
      this.close()
    })

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
    const seed = parseInt(this.dom.seedInput.value.trim(), 10) || 1234
    console.log(`[CreationDialog]: Request generation with seed [${seed}]`)

    try {
      const {worldGenerator} = await import('./generate.mjs')
      await worldGenerator.generate(seed) // seed provient du payload de l'événement
    } catch (error) {
      console.error('[CreationDialogOverlay] Failed to load generator:', error)
    }
  }
}
export const creationDialogOverlay = new CreationDialogOverlay()

/* ====================================================================================================
   AFFICHAGE DATE/HEURE METEO LUNE POSITION
   ==================================================================================================== */

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

    // TODO: Future: player/move -> Coords
    // eventBus.on('player/move', (pos) => this.#updateCoords(pos))
  }

  /* =========================================
     UPDATES ATOMIQUES (Performance)
     ========================================= */

  #firstloopEnvironment (data) {
    this.#updateClockEnvironment(data)
    this.#updateEnvironment(data)
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
 * @returns {DOM Element} header } - Retourne le conteneur
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

  return header
}
