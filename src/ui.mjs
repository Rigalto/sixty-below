// ui.mjs — MenuBarWIdget - CreationDialogOverlay - EnvironementWidget - TileHoverWidget - ModalBlocker - SeedWidget

import {eventBus, seededRNG} from './utils.mjs'
import {gameCore} from './core.mjs'
import {buffManager} from './buff.mjs'
import {playerManager} from './player.mjs'
import {WEATHER_TYPE, MOON_PHASE, MOON_PHASE_BLURRED, STATE, OVERLAYS, UI_LAYOUT, PATH_INVENTORY, PATH_CRAFT, PATH_TROPHY, PATH_HELP, PATH_NEW_WORLD, PATH_SAVE, PATH_RESTORE, PATH_DEBUG, PATH_CANCEL, SVG_ICON, PLAYER} from './constant.mjs'

/* ====================================================================================================
   STYLES POUR TOUS LES WIDGETS
   ==================================================================================================== */

// ── Styles MenuBarWidget ─────────────────────────────────────────────────────
const widgetStyle = document.createElement('style')
widgetStyle.textContent = /* css */`
/* MenuBarWidget */

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

/* CreationDialogOverlay */

#creation-dialog {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  background-color: #222;
  border: 2px solid #555;
  border-radius: 8px;
  padding: 0;
  display: none;
  flex-direction: column;
  gap: 0;
  z-index: ${OVERLAYS.dialog.zIndex};
  box-shadow: 0 10px 25px rgba(0,0,0,0.8);
  color: #eee;
  font-family: Segoe UI, sans-serif;
}
#creation-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}
#creation-seed-container {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
#creation-seed-container label {
  font-size: 12px;
  color: #aaa;
}
#creation-seed-container input {
  padding: 8px;
  background-color: #111;
  border: 1px solid #444;
  color: #fff;
  border-radius: 4px;
  font-family: monospace;
  flex: 1;
}

#creation-progress {
  position: relative;
  height: 36px;
  background-color: #111;
  border: 1px solid #444;
  border-radius: 4px;
  display: none;
  overflow: hidden;
}
#creation-progress .bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 0%;
  background-color: #388e3c;
  transition: width 0.1s ease;
  border-radius: 4px;
}
#creation-progress .topic {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
  text-shadow: 0 0 4px #000, 0 0 4px #000;
  font-family: monospace;
  pointer-events: none;
}

#creation-content button {
  padding: 10px;
  background-color: #333;
  color: #888;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: not-allowed;
  text-align: left;
  font-size: 14px;
  font-weight: bold;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
}
#creation-content button span {
  margin-right: 8px;
}
#creation-content button.active {
  background-color: #388e3c;
  color: #fff;
  border-color: #2e7d32;
  cursor: pointer;
}
#creation-content button.active:hover {
  background-color: #4caf50;
}
#creation-content button .creation-btn-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-right: 8px;
}

#creation-seed-container .seed-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

#creation-seed-container .seed-clear-btn {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  background-color: var(--ov-btn-bg);
  border: 1px solid var(--ov-border-sub);
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
#creation-seed-container .seed-clear-btn:hover {
  background-color: #3a4a6b;
}
#creation-seed-container .seed-clear-icon {
  width: 24px;
  height: 24px;
  color: #bdc3c7;
}
#creation-seed-container .seed-clear-btn:hover .seed-clear-icon {
  color: var(--ov-text);
}

/* EnvironmentWidget */

 #env-overlay-root {
  position: relative;
  width: 100%;
  order: ${UI_LAYOUT.ENVIRONMENT};
  margin-bottom: 10px;
  background-color: rgba(20, 20, 25, 0.9);
  border: 1px solid #444;
  color: #ffffff;
  font-family: Segoe UI, Roboto, monospace;
  font-size: 14px;
  border-radius: 6px;
  padding: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  gap: 6px;
  user-select: none;
}
 #env-overlay-root .env-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 1px solid #555;
  padding-bottom: 4px;
  margin-bottom: 4px;
}
#env-overlay-root .day,
#env-overlay-root .time { font-size: 1.4em; font-weight: bold; letter-spacing: 1px; }
#env-overlay-root .weather-row { display: flex; justify-content: space-between; align-items: center; font-size: 24px; }
#env-overlay-root .weather-group { display: flex; gap: 5px; }
#env-overlay-root .weather-now,
#env-overlay-root .moon { cursor: help; }
#env-overlay-root .weather-next { display: none; }
#env-overlay-root .bottom-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: monospace;
  margin-top: 2px;
  font-size: 18px;
  font-weight: bold;
}
#env-overlay-root .speed { margin-left: auto; }

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

/* SeedWidget */

#seed-widget-root {
  order: ${UI_LAYOUT.WORLD_KEY};
  padding: 2px 6px;
  font-size: 18px;
  color: #000;
  font-family: monospace;
  user-select: none;
}

#seed-widget-root span {
  color: #000;
  user-select: text;
  cursor: text;
  text-shadow: 0 0 4px #ffffff;
}
`
document.head.appendChild(widgetStyle)

/* ====================================================================================================
   MENU BAR WIDGET
   ====================================================================================================

   Singleton : menuBarWidget.

   Barre d'actions du Control Panel — boutons d'ouverture des overlays et actions meta.
   Toujours présent.

   Responsabilités :
     - Ouvrir les overlays Inventaire, Craft, Succès, Aide, Création de monde
     - Copier un snapshot du canvas principal dans le presse-papier (debug)

   Interactions :
     eventBus  — émet : overlay/open-request ('inventory' | 'craft' | 'achievement' | 'help' | 'creation')
     Clipboard API — écriture presse-papier (HTTPS ou localhost requis)

   ==================================================================================================== */

class MenuBarWidget {
  #container = null // div englobant le widget
  #btnInventory = null // bouton ouverture inventaire
  #btnCraft = null // bouton ouverture craft
  #btnAchievement = null // bouton ouverture succès
  #btnHelp = null // bouton ouverture aide
  #btnNewWorld = null // bouton nouveau monde (meta)
  #btnSnapshot = null // bouton snapshot debug (meta)

  constructor () {
    this.#buildDOM()
    this.#bindEvents()
  }

  /**
   * Construit le DOM du conteneur et des boutons, et l'injecte dans #right-sidebar.
   */
  #buildDOM () {
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
   CREATION DIALOG OVERLAY
   ====================================================================================================

   Singleton : creationDialogOverlay.

   Dialog modal de gestion du monde — saisie de seed, génération, backup et restore (à venir).
   Injecté dans document.body (z-index élevé, hors flux sidebar).

   Responsabilités :
     - Saisir et valider la seed avant génération
     - import dynamique (chargement différé — le module n'est chargé qu'à la première génération)
     - Orchestrer la séquence : stopSession → generate → startSession
     - Afficher la progression de la génération via barre de progression

   Interactions :
     eventBus        — écoute : creation/open, creation/close
                     — émet   : overlay/close ('creation')
     window          — écoute : world-generation-progress → onProgress
     gameCore        — stopSession(), startSession()
     worldGenerator  — generate(seed)
     core.mjs        — init(seed) appelé depuis startSession()

   ==================================================================================================== */

class CreationDialogOverlay {
  #container = null
  #seedInput = null
  #btnGenerate = null
  #btnBackup = null
  #btnRestore = null
  #btnClose = null
  #progressContainer = null
  #progressBar = null
  #progressTopic = null
  #clearBtn = null

  constructor () {
    this.#buildDOM()
    this.#bindEvents()

    this.currentSeed = 1234
  }

  /**
   * Construit le DOM du dialog et l'injecte dans document.body.
   */
  #buildDOM () {
    // 1. Conteneur Modal (Centré)
    this.#container = document.createElement('div')
    this.#container.id = 'creation-dialog'

    // 2. Header
    this.#container.appendChild(createOverlayHeader('🌱 World Management', 'creation'))

    // 3. Wrapper de Contenu (pour préserver l'espacement interne)
    const content = document.createElement('div')
    content.id = 'creation-content'
    this.#container.appendChild(content)

    // 4. Zone Seed (Input Numérique)
    const seedContainer = document.createElement('div')
    seedContainer.id = 'creation-seed-container'

    const seedLabel = document.createElement('label')
    seedLabel.textContent = 'World Seed (1 - 99999):'

    const inputRow = document.createElement('div')
    inputRow.className = 'seed-input-row'

    const seedInput = document.createElement('input')
    seedInput.type = 'number'
    seedInput.min = '1'
    seedInput.max = '99999'
    seedInput.placeholder = 'Random'
    seedInput.addEventListener('input', function () {
      if (this.value !== '' && this.value > 99999) this.value = (this.value / 10) | 0
    })

    this.#clearBtn = document.createElement('button')
    this.#clearBtn.type = 'button'
    this.#clearBtn.className = 'seed-clear-btn'
    this.#clearBtn.innerHTML = SVG_ICON(PATH_CANCEL, 'class="seed-clear-icon"')

    inputRow.appendChild(seedInput)
    inputRow.appendChild(this.#clearBtn)

    seedContainer.appendChild(seedLabel)
    seedContainer.appendChild(inputRow)

    // 5. Bargraph de progression — masqué par défaut
    const progressContainer = document.createElement('div')
    progressContainer.id = 'creation-progress'

    const progressBar = document.createElement('div')
    progressBar.className = 'bar'

    const progressTopic = document.createElement('div')
    progressTopic.className = 'topic'

    progressContainer.appendChild(progressBar)
    progressContainer.appendChild(progressTopic)
    content.appendChild(progressContainer)

    const btnGenerate = this.#createBtn('GENERATE NEW WORLD', PATH_NEW_WORLD, true)
    const btnBackup = this.#createBtn('BACKUP WORLD (Coming Soon)', PATH_SAVE, false)
    const btnRestore = this.#createBtn('RESTORE WORLD (Coming Soon)', PATH_RESTORE, false)

    // Assemblage
    content.appendChild(seedContainer)
    content.appendChild(btnGenerate)
    content.appendChild(btnBackup)
    content.appendChild(btnRestore)

    // Injection dans le body (car z-index élevé, sort du flux sidebar)
    document.body.appendChild(this.#container)

    // Cache Refs
    this.#seedInput = seedInput
    this.#btnGenerate = btnGenerate
    this.#btnBackup = btnBackup
    this.#btnRestore = btnRestore
    this.#progressContainer = progressContainer
    this.#progressBar = progressBar
    this.#progressTopic = progressTopic
  }

  /**
   * Crée un bouton texte + icône pour le dialog de création.
   * @param {string}  text     — libellé du bouton
   * @param {string}  icon     — chemin SVG (constante PATH_*)
   * @param {boolean} isActive — true = style actif (vert, cliquable)
   * @returns {HTMLButtonElement}
   */
  #createBtn (text, path, isActive = false) {
    const btn = document.createElement('button')
    btn.innerHTML = `${SVG_ICON(path, 'class="creation-btn-icon"')}${text}`
    if (isActive) btn.classList.add('active')
    return btn
  }

  /**
   * Lie les handlers UI et les événements eventBus / window.
   */
  #bindEvents () {
    // Actions UI
    this.onGenerateClick = this.onGenerateClick.bind(this)
    this.#btnGenerate.addEventListener('click', this.onGenerateClick)

    this.#seedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.onGenerateClick()
    })

    // Écoute pour affichage/masquage
    this.open = this.open.bind(this)
    eventBus.on('creation/open', this.open)

    this.close = this.close.bind(this)
    eventBus.on('creation/close', this.close)

    this.onClearClick = this.onClearClick.bind(this)
    this.#clearBtn.addEventListener('click', this.onClearClick)

    // Affichage de la progression de la création du monde
    this.onProgress = this.onProgress.bind(this)
    window.addEventListener('world-generation-progress', this.onProgress)
  }

  /**
   * Mémorise la seed du monde courant pour la pré-remplir à l'ouverture.
   * Appelé par GameCore.startSession().
   * @param {number} seed
   */
  init (seed) { this.currentSeed = seed }

  /**
   * Affiche le dialog et pré-remplit le champ seed.
   * Appelé via eventBus 'creation/open'.
   */
  open () {
    this.#container.style.display = 'flex'
    this.#seedInput.value = this.currentSeed
    this.#seedInput.focus()
  }

  /**
   * Masque le dialog.
   * Appelé via eventBus 'creation/close'.
   */
  close () {
    this.#container.style.display = 'none'
  }

  /**
 * Vide le champ seed et redonne le focus à l'input.
 * Bindée dans #bindEvents.
 */
  onClearClick () {
    this.#seedInput.value = ''
    this.#seedInput.focus()
  }

  /**
   * Lance la génération d'un nouveau monde avec la seed saisie.
   * Arrête la session courante, génère, puis relance la session.
   * Bindée dans #bindEvents — appelée au clic et à la touche Entrée.
   */
  async onGenerateClick () {
    const seed = parseInt(this.#seedInput.value.trim(), 10) || seededRNG.randomGetMinMax(1, 99999)
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

  /**
   * Met à jour la barre de progression pendant la génération du monde.
   * Bindée dans #bindEvents — écoutée sur 'world-generation-progress'.
   * @param {CustomEvent} e - detail : { passed, total, topic }
   */
  onProgress (e) {
    const {passed, total, topic} = e.detail
    const pct = Math.round(passed / total * 100)
    this.#progressBar.style.width = `${pct}%`
    this.#progressTopic.textContent = `${topic} (${pct}%)`
  }

  /**
   * Masque le bouton Generate et affiche la barre de progression.
   */
  #showProgress () {
    this.#btnGenerate.style.display = 'none'
    this.#progressBar.style.width = '0%'
    this.#progressTopic.textContent = '0%'
    this.#progressContainer.style.display = 'block'
  }

  /**
   * Masque la barre de progression et réaffiche le bouton Generate.
   */
  #hideProgress () {
    this.#progressContainer.style.display = 'none'
    this.#btnGenerate.style.display = 'block'
  }
}
export const creationDialogOverlay = new CreationDialogOverlay()

/* ====================================================================================================
   ENVIRONMENT WIDGET
   ====================================================================================================

   Singleton : environmentWidget.

   Affiche dans le Control Panel : jour, heure (fuzzy), météo, lune et coordonnées joueur (optionnel).
   Toujours présent. Zéro DOM traversal en runtime — toutes les références précalculées à l'init.

   Responsabilités :
     - Heure avec précision variable selon le trinket Clock équipé (fuzzy time)
     - Météo courante et prévision du lendemain (affichée si trinket Bottled Frog)
     - Phase lunaire en 4 ou 8 phases selon le trinket Sextant
     - Coordonnées tuile du joueur (affichées si trinket GPS) — abonnement dynamique à player/move

   Interactions :
     eventBus  — écoute : time/first-loop, time/clock, time/daily, time/timeslot
               — écoute : buff/trinket-changed → dispatche vers #apply*
               — écoute : player/move (dynamique — uniquement si #coordsActive)

   ==================================================================================================== */

const TIMESLOT_NAMES = ['Midnight', 'Dawn', 'Morning', 'Noon', 'Afternoon', 'Dusk', 'Evening', 'Night']

class EnvironmentWidget {
  #container = null
  #day = null
  #time = null
  #weatherNow = null
  #weatherNext = null
  #moon = null
  #coords = null
  #speed = null

  #lastMinuteStr = ''
  #lastWeatherCode = -1
  #lastNextWeatherCode = -1
  #lastMoonPhase = -1
  #timePrecision = 0 // 0: heure, 1: 15min, 2: 5min
  #moonDetail = false // true => 8 phases au lieu de 4
  #coordsActive = false // true => coords visibles

  constructor () {
    this.#buildDOM()
    this.#bindEvents()
  }

  /**
   * Construit le DOM du widget et l'injecte dans #right-sidebar.
   */
  #buildDOM () {
    // 1. Création du conteneur principal
    this.#container = document.createElement('div')
    this.#container.id = 'env-overlay-root'

    // 2. Injection du HTML Statique
    const header = document.createElement('div')
    header.className = 'env-header'
    this.#day = document.createElement('span')
    this.#day.className = 'day'
    this.#time = document.createElement('span')
    this.#time.className = 'time'
    header.appendChild(this.#day)
    header.appendChild(this.#time)

    const weatherRow = document.createElement('div')
    weatherRow.className = 'weather-row'
    const weatherGroup = document.createElement('div')
    weatherGroup.className = 'weather-group'
    this.#weatherNow = document.createElement('div')
    this.#weatherNow.className = 'weather-now'
    this.#weatherNow.title = 'Weather'
    this.#weatherNext = document.createElement('div')
    this.#weatherNext.className = 'weather-next'
    this.#weatherNext.title = 'Forecast'
    weatherGroup.appendChild(this.#weatherNow)
    weatherGroup.appendChild(this.#weatherNext)
    this.#moon = document.createElement('div')
    this.#moon.className = 'moon'
    this.#moon.title = 'Moon Phase'
    // this.#moon.textContent = '[M]'
    weatherRow.appendChild(weatherGroup)
    weatherRow.appendChild(this.#moon)

    const bottomRow = document.createElement('div')
    bottomRow.className = 'bottom-row'
    this.#coords = document.createElement('span')
    this.#coords.className = 'coords'
    this.#speed = document.createElement('span')
    this.#speed.className = 'speed'
    bottomRow.appendChild(this.#coords)
    bottomRow.appendChild(this.#speed)
    this.#container.appendChild(bottomRow)

    this.#container.appendChild(header)
    this.#container.appendChild(weatherRow)
    this.#container.appendChild(bottomRow)

    const overlayPanel = document.getElementById('right-sidebar')
    if (overlayPanel) {
      overlayPanel.appendChild(this.#container)
    } else {
      console.error('EnvironmentWidget: #right-sidebar introuvable, fallback sur body')
      document.body.appendChild(this.#container)
    }
  }

  /**
   * Abonnement aux événements eventBus.
   */
  #bindEvents () {
    // Clock -> Time & Day (mesure : 50µs, microtask inutile)
    this.updateClockEnvironment = this.updateClockEnvironment.bind(this)
    eventBus.on('time/clock', this.updateClockEnvironment.bind(this)) // TODO: utiliser l'eventBus 'time/every-5-minutes'

    // Daily -> Day, Weather & Moon (mesure : 100µs, microtask inutile)
    this.updateEnvironment = this.updateEnvironment.bind(this)
    eventBus.on('time/daily', this.updateEnvironment.bind(this))

    // Init Global -> Tout mettre à jour (estimation : 150µs, microtask inutile car acceptable lors de l'init)
    this.firstloopEnvironment = this.firstloopEnvironment.bind(this)
    eventBus.on('time/first-loop', this.firstloopEnvironment.bind(this))

    // (estimation : 50µs, microtask inutile)
    this.updateTimeslot = this.updateTimeslot.bind(this)
    eventBus.on('time/timeslot', this.updateTimeslot)

    this.onTrinketChanged = this.onTrinketChanged.bind(this)
    eventBus.on('buff/trinket-changed', this.onTrinketChanged.bind(this))

    // player/move (attachement/détachement dynamique) -> Coords
    this.updateCoords = this.updateCoords.bind(this)
  }

  /* =========================================
     UPDATES ATOMIQUES (Performance)
     ========================================= */

  /**
   * Initialisation complète à la première frame — appelle les trois handlers de mise à jour.
   * @param {object} data - payload time/first-loop
   */
  firstloopEnvironment (data) {
    this.updateClockEnvironment(data)
    this.updateEnvironment(data)
    this.updateTimeslot(data)
  }

  /**
   * Met à jour l'heure affichée avec la précision courante (fuzzy time).
   * Optimisé : ne touche au DOM que si la valeur change.
   * Temps d'exécution mesuré à 0.05 ms
   * @param {{hour: number, minute: number}} payload
   */
  updateClockEnvironment ({hour, minute}) {
    // 2. Update Time (Fréquent) - Logique de "Fuzzy Time"
    const precision = this.#timePrecision // 0: Heure, 1: 15min, 2: 5min

    let m = minute
    if (precision === 0) m = 0
    if (precision === 1) m = Math.floor(minute / 15) * 15
    if (precision === 2) m = Math.floor(minute / 5) * 5 // TODO: ligne à supprimer en branchant l'eventBus 'time/every-5-minutes'

    const timeStr = `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`

    // Optim: On ne touche au DOM que si le texte change
    if (this.#lastMinuteStr !== timeStr) {
      this.#time.textContent = timeStr
      this.#lastMinuteStr = timeStr
    }
  }

  /**
   * Met à jour le titre de l'heure avec le nom du créneau horaire.
   * @param {{tslot: number}} payload
   */
  updateTimeslot ({tslot}) {
    this.#time.title = TIMESLOT_NAMES[tslot]
  }

  /**
   * Met à jour le jour, la météo courante, la météo suivante et la lune.
   * Optimisé : chaque section ne touche au DOM que si la valeur change.
   * @param {{day: number, weather: number, nextWeather: number, moonPhase: number}} payload
   */
  updateEnvironment ({day, weather, nextWeather, moonPhase}) {
    // 1. Day
    this.#day.textContent = `DAY ${day + 1}`

    // 2. Weather Now
    if (this.#lastWeatherCode !== weather) {
      const wInfo = WEATHER_TYPE[weather] || {name: 'Unknown', icon: '?'}

      // MODIFICATION : Usage direct de l'icône
      this.#weatherNow.textContent = wInfo.icon
      this.#weatherNow.title = wInfo.name

      this.#lastWeatherCode = weather
    }

    // 3. Weather Next (Affiché seulement si artefact présent - point géré directment dans le handler d'eventBus)
    if (this.#lastNextWeatherCode !== nextWeather) {
      const nwInfo = WEATHER_TYPE[nextWeather] || {name: '?', icon: '?'}
      // MODIFICATION : Petite flèche + Icône
      this.#weatherNext.textContent = `➞ ${nwInfo.icon}`
      this.#weatherNext.title = `Tomorrow: ${nwInfo.name}`

      this.#lastNextWeatherCode = nextWeather
    }

    // 4. Moon Phase (Délégué)
    // On appelle systématiquement car c'est un changement de jour donc de pase de lune
    this.#updateMoon(moonPhase)
  }

  /**
   * Met à jour l'affichage de la lune selon le niveau de détail courant.
   * Appelé par updateEnvironment et #applyMoonDetail.
   * @param {number} moonPhase
   */
  #updateMoon (moonPhase) {
    let phaseObj = MOON_PHASE[moonPhase]

    // Logique "Fuzzy Moon" (4 phases vs 8 phases)
    if (!this.#moonDetail) {
      const phaseIndex = MOON_PHASE_BLURRED[moonPhase]
      phaseObj = MOON_PHASE[phaseIndex]
    }

    this.#moon.textContent = phaseObj.icon
    this.#moon.title = phaseObj.name + (!this.#moonDetail ? ' (Approx)' : '')

    // Mise à jour du cache pour le prochain appel via buff
    this.#lastMoonPhase = moonPhase
  }

  /**
   * Dispatche les changements de buffs trinkets vers les toggles correspondants.
   * @param {Set<string>} changedKeys - buffIds modifiés émis par buffManager
   */
  onTrinketChanged (changedKeys) {
    if (changedKeys.has('displayTimePrecision')) this.#applyTimePrecision(buffManager.getBuff('displayTimePrecision'))
    if (changedKeys.has('displayMoonDetail')) this.#applyMoonDetail(buffManager.getBuff('displayMoonDetail'))
    if (changedKeys.has('displayNextWeather')) this.#applyNextWeather(buffManager.getBuff('displayNextWeather'))
    if (changedKeys.has('displayCoords')) this.#applyCoords(buffManager.getBuff('displayCoords'))
    if (changedKeys.has('displaySpeed')) this.#applySpeed(buffManager.getBuff('displaySpeed'))
  }

  /**
   * Affiche ou masque la météo du lendemain.
   * @param {number|boolean} active
   */
  #applyNextWeather (active) {
    this.#weatherNext.style.display = active ? 'block' : 'none'
  }

  /**
   * Active ou désactive l'affichage des 8 phases lunaires (vs 4 par défaut).
   * Redessine immédiatement si une phase est en cache.
   * @param {number|boolean} active
   */
  #applyMoonDetail (active) {
    this.#moonDetail = active
    // On utilise la valeur en cache pour redessiner avec la nouvelle précision
    if (this.#lastMoonPhase !== -1) { this.#updateMoon(this.#lastMoonPhase) }
  }

  /**
   * Définit la précision d'affichage de l'heure.
   * 0 = heure, 1 = 15min, 2 = 5min.
   * @param {number} lvl
   */
  #applyTimePrecision (lvl) { this.#timePrecision = lvl }

  /**
   * Active ou désactive l'affichage des coordonnées.
   * Gère l'abonnement dynamique à player/move pour économiser le CPU.
   * @param {number|boolean} isActive
   */
  #applyCoords (isActive) {
    if (this.#coordsActive === isActive) return // Pas de changement

    this.#coordsActive = isActive
    this.#coords.style.display = isActive ? 'block' : 'none'

    if (isActive) {
      // Abonnement uniquement si nécessaire [Design 8.3]
      eventBus.on('player/move', this.updateCoords)
      this.updateCoords(playerManager.getFeetTile())
    } else {
      // Désabonnement immédiat pour économiser le CPU
      eventBus.off('player/move', this.updateCoords)
    }
  }

  /**
   * Met à jour l'affichage des coordonnées tuile du joueur.
   * Bindée dans constructor — abonnée dynamiquement à player/move par #applyCoords.
   * @param {{x: number, y: number}} payload — coordonnées en tuiles
   */
  updateCoords ({x, y}) { // les coordonnées sont en tuiles (integer)
    this.#coords.textContent = `X: ${x} | Y: ${y}`
  }

  /**
   * Affiche ou masque le bonus de vitesse.
   * Met à jour la valeur affichée lors de l'activation.
   * @param {number|boolean} isActive
   */
  #applySpeed (isActive) {
    this.#speed.style.display = isActive ? 'inline' : 'none'
    if (isActive) this.#updateSpeed()
  }

  /**
   * Met à jour l'affichage du bonus de vitesse depuis le buff composé.
   * À appeler à chaque changement de movement-speed (tuiles, armure, accessoires).
   */
  #updateSpeed () {
    const buff = buffManager.getBuff('movement-speed')
    this.#speed.textContent = `Speed: ${buff}%`
    this.#speed.title = `Speed: ${PLAYER.speed * 5 / 8 * buff} tiles/s`
  }
}
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
    this.#buildDOM()
    this.#bindEvents()
  }

  /**
   * Construit le DOM du widget et l'injecte dans #right-sidebar.
   */
  #buildDOM () {
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

    --slot-bg-default:   #205080;
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
   SEED WIDGET
   ====================================================================================================

   Singleton : seedWidget.

   Affiche la seed du monde courant dans le Control Panel.
   Lecture seule — sélectionnable au double-clic pour copier.

   Interactions :
     core.mjs — init(seed) appelé depuis startSession()

   ==================================================================================================== */

class SeedWidget {
  #span = null // affiche la seed

  constructor () {
    const container = document.createElement('div')
    container.id = 'seed-widget-root'
    container.textContent = 'World Seed: '

    this.#span = document.createElement('span')
    this.#span.title = 'Double-click to select, Ctrl-C to copy'
    container.appendChild(this.#span)

    const rightSidebar = document.getElementById('right-sidebar')
    if (rightSidebar) {
      rightSidebar.appendChild(container)
    } else {
      console.error('SeedWidget: #right-sidebar introuvable')
    }
  }

  /**
   * Affiche la seed du monde dans le widget.
   * Appelé par GameCore.startSession().
   * @param {string} seed
   */
  init (seed) {
    this.#span.textContent = seed
  }
}
export const seedWidget = new SeedWidget()
