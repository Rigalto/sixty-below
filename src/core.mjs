import {TIME_BUDGET, NODES_LOOKUP, MICROTASK_FN_NAME_TO_KEY, STATE, OVERLAYS} from './constant.mjs'
import {loadAssets, resolveAssetData} from './assets.mjs'
import {timeManager, taskScheduler, microTasker, eventBus, seededRNG} from './utils.mjs'
import {database} from './database.mjs'
import {chunkManager} from './world.mjs'
import {saveManager} from './persistence.mjs'
import {camera, worldRenderer} from './render.mjs'
import {buffManager} from './buff.mjs'
import {creationDialogOverlay} from './ui.mjs'
import './ui-debug.mjs'
import './inventory.mjs'
import './craft.mjs'
import './help.mjs'

const mockup = () => {
  const debugDiv = document.createElement('div')
  debugDiv.id = 'debug-mouse-coords' // ID pour le cibler plus tard

  // Styles pour positionnement et visibilité
  debugDiv.style.position = 'fixed'
  debugDiv.style.top = '250px'
  debugDiv.style.right = '10px' // Collé à droite avec une petite marge
  debugDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)' // Fond semi-transparent
  debugDiv.style.color = '#00ff00' // Vert console classique
  debugDiv.style.padding = '5px 10px'
  debugDiv.style.fontFamily = 'monospace' // Chasse fixe pour éviter que le texte ne tremble
  debugDiv.style.fontSize = '14px'
  debugDiv.style.zIndex = OVERLAYS.system.zIndex
  debugDiv.style.pointerEvents = 'none' // IMPORTANT : Les clics traversent cette div !

  // Initialisation
  debugDiv.textContent = 'Mouse: 0, 0'

  // Ajout au DOM
  document.body.appendChild(debugDiv)
  return debugDiv
}

class GameCore {
  constructor () {
    this.isBooted = false
    this.isRunning = false

    this.budgetTotal = TIME_BUDGET.UPDATE + TIME_BUDGET.RENDER + TIME_BUDGET.MICROTASK
    this.lastTime = 0
    // Ne rien faire de lourd ici

    // Flag pour le déclenchement debug (touche ²)
    this.debugTrigger = false
    this.debugMap = false
    // DEBUG
    this.mockupDiv = mockup()
  }

  /* =========================================
     PHASE 1 : TECHNICAL BOOT (One-Time)
     ========================================= */

  /**
   * Initialisation technique. Charge les ressources et lie les données statiques.
   * À appeler une seule fois au chargement de la page.
   */
  async boot () {
    if (this.isBooted) return
    console.time('Engine Boot')

    // 1. Chargement des Assets (Bloquant)
    await loadAssets()

    // 2. Ouverture de la base de données IndexedDB
    await database.init()

    // 2. Hydratation des données statiques
    this.#hydrateNodes()
    this.#hydrateItems()
    // this._hydrateBuffs() ...

    // 3. Liens avec le DOM
    mouseManager.init()

    this.isBooted = true
    console.timeEnd('Engine Boot')
    console.log('✅ Moteur prêt.')
  }

  /**
   * Hydratation spécifique pour les Tuiles (NODES)
   * Transforme les strings 'image' en objets 'renderData' avec imgIndex
   */
  #hydrateNodes () {
    let count = 0
    for (const node of NODES_LOOKUP) {
      if (!node) continue

      // Image statique
      if (node.image) {
        node.renderData = resolveAssetData(node.image)
        node.image = null // Clean memory
        if (node.renderData) count++
      }
    }
    console.log(`   🔹 Nodes hydratés : ${count}`)
  }

  /**
   * Hydratation spécifique pour les Items
   */
  #hydrateItems () {
    // TODO: Implémenter quand ITEMS_LOOKUP existera
    // La logique sera identique : parsing des icônes de l'item
    console.log('   🔹 Items hydratés : (TODO)')
  }

  /* =========================================
     PHASE 2 : GAME SESSION (Repeatable)
     ========================================= */

  /**
   * Lance une partie (Nouveau monde ou Chargement).
   */
  async startSession () {
    if (!this.isBooted) throw new Error('Core not booted. Call boot() first.')
    if (this.isRunning) return

    console.log('🚀 Démarrage de la session...')

    // 1. Chargement massif de l'état (1 seule requête DB)
    // Retourne un objet : {timestamp: 480000, weather: 1, playerPosition: '100|82|1', ...}
    const state = await database.getAllGameState()
    // DEBUG
    // const state = {
    //   timestamp: 480 * 1000,
    //   weather: 2,
    //   nextWeather: 3,
    //   player: '8192|1280|1',
    //   worldkey: 4321
    // }

    // 2. Dispatch aux systèmes (Injection de dépendance des données)
    // Valeur par défaut (480000) gérée si state.timestamp est undefined (nouveau jeu)
    timeManager.init(state.timestamp, state.weather, state.nextWeather)

    // 2. Initialisation des systèmes (Layer 1)
    this.previousTileCoords = undefined

    // Init RNG en mode aléatoire (Math.random()) pour la session de jeu
    seededRNG.init()

    // OBLIGATOIRE EN PREMIER POUR QUE LES MANAGERS PUISSENT TRAVAILLER
    microTasker.init()
    microTasker.initDebug(MICROTASK_FN_NAME_TO_KEY)
    taskScheduler.init(state.timestamp)
    timeManager.init(state.timestamp, state.weather, state.nextWeather)

    // Injection des tuiles
    const mockSavedChunks = await database.readAllFromObjectStore('world_chunks')
    chunkManager.init(mockSavedChunks)

    const [playerX, playerY, playerDirection] = state.player.split('|')
    this.playerX = parseInt(playerX, 10)
    this.playerY = parseInt(playerY, 10)
    this.playerDirection = playerDirection
    camera.init(this.playerX, this.playerY)
    // Puis initialisaton du rendering du monde
    worldRenderer.init()
    // Lancement de la sauvegarde périodique (toutes les deux secondes)
    saveManager.init()

    buffManager.init()
    // Les quatre lignes ci-dessous simulent le traitement du buffManager
    eventBus.emit('buff/display-next-weather', true)
    eventBus.emit('buff/display-moon-detail', true)
    eventBus.emit('buff/display-time-precision', 3) // DEBUG => toutes les secondes
    eventBus.emit('buff/display-coords', true)

    // 3. Initialisation des systèmes (Layer 2)
    creationDialogOverlay.init(state.worldkey)
    // C'est ici qu'on initialise les managers
    // await FloraManager.init(...)
    // await FaunaManager.init(...)
    // await PlayerManager.init(...)

    // 4. Lancement de la boucle
    this.isRunning = true
    this.lastTime = performance.now()
    this.loop(this.lastTime)
  }

  stopSession () { this.isRunning = false }

  /* =========================================
     GAME LOOP
     ========================================= */

  loop (timestamp) {
    // timestamp = performance.now()

    if (!this.isRunning) return
    requestAnimationFrame((t) => this.loop(t))

    // ///////////////// //
    // EXPLORATION FIGEE //
    // ///////////////// //

    if (keyboardManager.state !== STATE.EXPLORATION) return

    // ///////////// //
    // BUDGET UPDATE //
    // ///////////// //

    // 1. DELTA TIME

    const executionStart = performance.now() // Capture du temps réel de début d'exécution du JS pour mesure des temps d'exécution
    let dt = timestamp - this.lastTime
    this.lastTime = timestamp

    // --- ACCELERATION DU TEMPS (Sleepng) ---
    if (buffManager.getBuff('sleeping')) { dt = dt * 2 }

    // --- PROTECTION TEMPORELLE ---
    if (dt > 1000) {
      // Cas A : Retour de veille / Changement d'onglet / Debugger (> 1 seconde)
      // On considère que le jeu était en PAUSE. On n'avance d'une frame.
      console.log(`[GameCore] Gros saut temporel détecté (${dt.toFixed(0)}ms). Simulation ignorée.`)
      dt = 16.66
    } else if (dt > 65) {
      // Cas B : Lag Machine (ex: Garbage Collector qui prend 40ms)
      // On clampe pour éviter que la physique n'explose (Tunneling).
      // 65ms correspond à ~15 FPS. En dessous, le jeu passera en "Slow Motion".
      dt = 65
    }

    // Exécution Debug synchronisée (consommation du flag)
    if (keyboardManager.consumeDebugTrigger()) { this.#runDebugAction() }

    // 2. UPDATE (SYSTEMS)
    // 2.A. TimeManager (Source de vérité temporelle)
    const gameTimestamp = timeManager.update(dt) // timestamp depuis création du monde

    // 2.B. TaskScheduler (Vérifie si des tâches longues sont dues)
    taskScheduler.update(gameTimestamp)

    // 2.C Mouvements du joueur (touches flèches et ZQSD)
    if (keyboardManager.directions !== 0) {
      // console.log('player.move(', keyboardManager.directions, ')')
      // player.move(keyboardManager.directions)
    }
    // MOCK-UP va-et-vient du player
    const speed = 0.3 // Pixels par ms

    // Application du mouvement
    this.playerX += speed * this.playerDirection * dt

    // Gestion des bornes et rebond
    if (this.playerX >= 9700) {
      this.playerX = 9700
      this.playerDirection = -1 // Demi-tour gauche
    } else if (this.playerX <= 6700) {
      this.playerX = 6700
      this.playerDirection = 1 // Demi-tour droite
    }

    // Mise à jour Caméra
    camera.update(this.playerX, this.playerY)

    // 2.D Affiche des informations concernant la tuile sous la souris
    // const hoverPosition = mouseManager.mouse
    // const tileCoords = camera.cavasToTiles(hoverPosition)
    // if (this.previousTileCoords !== tileCoords) {
    //   this.previousTileCoords = tileCoords
    //   eventBus.emit('mouse/hover', tileCoords)
    // }

    // 2.E Gestion du clic gauche la souris
    const leftClick = mouseManager.consumeLeftClick() // "Read-and-Reset"
    if (leftClick) {
      //
    }

    // 2.F Gestion du clic droit la souris
    const rightClick = mouseManager.consumeRightClick() // "Read-and-Reset"
    if (rightClick) {
      //
    }

    // DEBUG
    this.mockupDiv.textContent = `Mouse: ${mouseManager.mouse.x}, ${mouseManager.mouse.y}`
    if (leftClick) { console.log('leftClick', mouseManager.mouse) }
    if (rightClick) { console.log('rightClick', mouseManager.mouse) }

    // 2.G. Suite
    // player.update(dt)
    // flore.update(dt)
    // faune.update(dt)

    const durationUpdate = performance.now() - executionStart
    if (durationUpdate > TIME_BUDGET.UPDATE) {
      console.warn(`⚠️ Budget Update: ${durationUpdate.toFixed(2)}ms`)
      // if (Math.random() < 0.01) console.warn(`⚠️ Budget Update: ${durationUpdate.toFixed(2)}ms`)
    }

    // ///////////// //
    // BUDGET RENDER //
    // ///////////// //

    // 3. Render (Pass-through Context)
    const ctx = worldRenderer.render()
    // plantManager.render(ctx)
    // furnitureManager.render(ctx)
    // monsterManager.render(ctx)
    // playerManager.render(ctx)
    ctx.restore() // 'worldRenderer.render' a fait un ctx.save()
    // lightRenderer.render()

    // 3.1 génère la liste des chunks dont il faut générer les images
    // Les images seront générées par une micro-tâche
    worldRenderer.update()

    const durationRender = performance.now() - executionStart - durationUpdate
    if (durationRender > TIME_BUDGET.RENDER) {
      console.warn(`⚠️ Budget Render: ${durationRender.toFixed(2)}ms`)
      // if (Math.random() < 0.01) console.warn(`⚠️ Budget Render: ${durationRender.toFixed(2)}ms`)
    }

    // //////////////// //
    // BUDGET MICROTASK //
    // //////////////// //

    // Temps écoulé total pour cette frame
    const timeUsed = durationUpdate + durationRender
    const budgetMicrotask = this.budgetTotal - timeUsed

    // 4. MicroTasks // 4. MICROTASKS (Consommation du reste)
    if (budgetMicrotask > 0) {
      microTasker.update(budgetMicrotask)
    }

    // //////////// //
    // DEBUG SAMPLE //
    // //////////// //

    // On mesure le temps passé dans microTasker
    const durationMicro = performance.now() - executionStart - timeUsed
    eventBus.emit('debug/frame-sample', {updateTime: durationUpdate, renderTime: durationRender, microTime: durationMicro})
  }

  /* =========================================
     DEBUG
     ========================================= */

  #runDebugAction () {
    console.log('GameCore.#runDebugAction')
    eventBus.debugStats()
    microTasker.debugStats()
    taskScheduler.debugStats()
  }
}
export const gameCore = new GameCore()

/* ====================================================================================================
   KEYBOARD INPUTS
   ==================================================================================================== */

const HOTBAR_MAP = {
  Digit1: 0,
  Numpad1: 0,
  Digit2: 1,
  Numpad2: 1,
  Digit3: 2,
  Numpad3: 2,
  Digit4: 3,
  Numpad4: 3,
  Digit5: 4,
  Numpad5: 4,
  Digit6: 5,
  Numpad6: 5,
  Digit7: 6,
  Numpad7: 6,
  Digit8: 7,
  Numpad8: 7,
  Digit9: 8,
  Numpad9: 8,
  Digit0: 9,
  Numpad0: 9
}

const MOVEMENT_MAP = {
  ArrowUp: 1,
  KeyW: 1, // Z (Azerty) / W (Qwerty)
  ArrowDown: 2,
  KeyS: 2, // S
  ArrowLeft: 4,
  KeyA: 4, // Q (Azerty) / A (Qwerty)
  ArrowRight: 8,
  KeyD: 8 // D
}

const OVERLAY_MAP = {
  m: 'map',
  M: 'map',
  i: 'inventory',
  I: 'inventory',
  k: 'craft',
  K: 'craft',
  h: 'help',
  H: 'help'
}

class KeyboardManager {
  #overlayStack

  constructor () {
    this.#overlayStack = []
    this.state = STATE.EXPLORATION // il faut pouvoir passer en STATE;CREATION si la base de donnée est vide
    this.debugTrigger = false // affiche dans la console les logs du MicroTasker, du TaskScheduler et de l'EventBus
    this.directions = 0

    this.onKeyDown = this.onKeyDown.bind(this)
    this.onKeyUp = this.onKeyUp.bind(this)
    // Passive: true n'est pas nécessaire ici car preventDefault n'est pas appelé systématiquement
    // mais on reste sur du standard.
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    // écoute les demandes de fermeture  et d'ouverture des overlays
    eventBus.on('overlay/close', this.onCloseRequest.bind(this))
    eventBus.on('overlay/open-request', this.onOverlayOpenRequest.bind(this))
    eventBus.on('overlay/creation-dialog-request', this.onCreationDialogRequest.bind(this))
  }

  // "read-once" (lecture unique)
  consumeDebugTrigger () {
    const v = this.debugTrigger
    this.debugTrigger = false
    return v
  }

  #updateState () {
    let newState = STATE.EXPLORATION

    // Détermination du nouvel état théorique
    if (this.#overlayStack.length > 0) {
      const topId = this.#overlayStack[this.#overlayStack.length - 1]
      newState = OVERLAYS[topId].state
    }

    // Application et émission UNIQUEMENT si changement réel
    if (this.state !== newState) {
      const oldState = this.state
      this.state = newState
      eventBus.emit('state/changed', {state: this.state, oldState})
    }
  }

  /**
   * Tente d'ouvrir ou fermer un overlay
   * @param {string} id - L'identifiant défini dans OVERLAYS
   */
  #openOverlay (id) {
    const def = OVERLAYS[id]
    if (!def) {
      console.error('KeyboardManager: Unknown overlay', id)
      return
    }

    const stackTop = this.#overlayStack[this.#overlayStack.length - 1]

    // 1. Cas : L'overlay est DÉJÀ ouvert
    if (this.#overlayStack.includes(id)) {
      // Si c'est celui tout en haut, on le ferme (Comportement standard Toggle)
      if (stackTop === id) { this.#closeOverlay() }
      return
    }

    // 2. Cas : L'overlay est FERMÉ, on veut l'ouvrir
    // On vérifie la priorité par rapport au sommet actuel
    if (stackTop) {
      const currentZIndex = OVERLAYS[stackTop].zIndex
      // INTERDICTION : On n'ouvre pas l'inventaire (30) si on est en Combat (100)
      if (def.zIndex < currentZIndex) return
    }

    // Accepté : On empile
    this.#overlayStack.push(id)
    this.#updateState()
    // On notifie l'overlay pour qu'il s'affiche
    eventBus.emit(`${id}/open`)
    this.debugLog()
  }

  #closeOverlay () {
    if (this.#overlayStack.length === 0) return // Rien à fermer

    const id = this.#overlayStack.pop() // Retire le dernier
    this.#updateState()
    eventBus.emit(`${id}/close`)
    this.debugLog()
  }

  debugLog () {
    const mockupDiv = document.getElementById('debug-mouse-coords')
    mockupDiv.textContent = this.#overlayStack.join('\n')
  }

  /**
   * Gestionnaire d'événement clavier (Discrete)
   * @param {KeyboardEvent} e
   */
  onKeyDown (e) {
    // Rejet immédiat des répétitions automatiques (appui long) pour les actions "One-Shot"
    if (e.repeat) return

    // 1. Mouvements (Polling)
    const moveBit = MOVEMENT_MAP[e.code]
    if (moveBit) {
      this.directions |= moveBit
      return
    }

    // 2. Hotbar (Selection Slot)
    const slotIndex = HOTBAR_MAP[e.code]
    if (slotIndex !== undefined) {
      eventBus.emit('hotbar/select-slot', slotIndex)
      return
    }

    // 1.5 Debug dans la console (Touche ² (AZERTY) ou ` (QWERTY))
    if (e.code === 'Backquote') { this.debugTrigger = true }

    // 1.5 Overlay
    const overlay = OVERLAY_MAP[e.key]
    if (overlay !== undefined) {
      this.#openOverlay(overlay)
      return
    }

    // Touche Escape : ouvre l'inventaire ou ferme l'overlay visible
    if (e.code === 'Escape') {
      if (this.#overlayStack.length === 0) {
        this.#openOverlay('inventory')
      } else {
        this.#closeOverlay()
      }
    }
  }

  /**
   * KEY UP
   * Indispensable pour arrêter le mouvement quand on relâche la touche
   */
  onKeyUp (e) {
    const moveBit = MOVEMENT_MAP[e.code]
    if (moveBit) {
      // Bitwise AND avec l'inverse (NOT) du masque pour éteindre le bit
      this.directions &= ~moveBit
    }
  }

  onCloseRequest (overlyId) {
    const stackTop = this.#overlayStack[this.#overlayStack.length - 1]
    if (stackTop !== overlyId) return
    this.#closeOverlay()
  }

  onOverlayOpenRequest (overlyId) {
    if (overlyId) this.#openOverlay(overlyId)
  }

  onCreationDialogRequest () {
    // Ne doit jamais arriver car le bouton déclenchant l'affichage de
    // ce dialoque se trouve sous le voile sombre
    if (this.#overlayStack.length !== 0) { return }

    // 1. Suppression des overlays existant
    for (const id of this.#overlayStack) {
      eventBus.emit(`${id}/close`)
    }
    this.#overlayStack.length = 0
  }
}
export const keyboardManager = new KeyboardManager()

/* ====================================================================================================
   MOUSE INPUTS
   ==================================================================================================== */

class MouseManager {
  #canvas

  constructor () {
    // Lu par la Game Loop pour traiter le 'hover' de la souris
    // et transférer les clics aux autres managers (Mining, Attack, Builder)
    this.mouse = {x: null, y: null}
    this.left = false
    this.right = false

    // Liaison des méthodes pour conserver le contexte 'this'
    this.onMouseMove = this.onMouseMove.bind(this)
    this.onMouseOut = this.onMouseOut.bind(this)
    this.onClick = this.onClick.bind(this)
    this.onContextMenu = this.onContextMenu.bind(this)
  }

  /**
   * Initialisation DOM
   * @param {string} canvasId
   */
  init () {
    this.#canvas = document.getElementById('world-renderer')
    if (!this.#canvas) {
      console.error('MouseManager: Canvas world-renderer not found')
      return
    }

    // Mapping :
    // - MouseMove : Coordonnées locales au canvas
    // - MouseOut : Reset Coordonnées
    // - Click : Gestion Clic Gauche
    // - ContextMenu : Gestion Clic Droit
    this.#canvas.addEventListener('mousemove', this.onMouseMove)
    this.#canvas.addEventListener('mouseout', this.onMouseOut)
    this.#canvas.addEventListener('click', this.onClick)
    this.#canvas.addEventListener('contextmenu', this.onContextMenu)
  }

  // "Read-and-Reset" Pattern pour les clics (indispensable car l'événement est instantané)
  consumeLeftClick () {
    if (!this.left) return false
    this.left = false
    return true
  }

  consumeRightClick () {
    if (!this.right) return false
    this.right = false
    return true
  }

  /**
   * Mise à jour position (Locales au Canvas)
   */
  onMouseMove (e) {
    this.mouse.x = e.offsetX
    this.mouse.y = e.offsetY
  }

  /**
   * Sortie de zone
   */
  onMouseOut (e) {
    this.mouse.x = null
    this.mouse.y = null
    this.left = false
    this.right = false
  }

  /**
   * Gestion Clic Gauche
   */
  onClick (e) {
    this.left = true
    // Note: click ne se déclenche qu'au relâchement.
    // Pour du minage continu, il faudra cliquer plusieurs fois.
  }

  /**
   * Gestion Clic Droit
   */
  onContextMenu (e) {
    e.preventDefault() // Bloque le menu natif
    this.right = true
  }

  // Voici la procédure pour désactiver les Gestes de bascule (Rocker Gestures) dans Vivaldi :
  //   * Ouvrez les Réglages (Settings) de Vivaldi (Raccourci : Ctrl+F12).
  //   * Allez dans la section Souris (Mouse) dans le menu de gauche.
  //   * Cherchez la sous-section Gestes (Gestures).
  //   * Décochez la case Autoriser les gestes de bascule (Allow Rocker Gestures).
}

export const mouseManager = new MouseManager()
