import {TIME_BUDGET, NODES_LOOKUP, MICROTASK_FN_NAME_TO_KEY} from './constant.mjs'
import {loadAssets, resolveAssetData} from './assets.mjs'
import {timeManager, taskScheduler, microTasker, eventBus, seededRNG} from './utils.mjs'
import {database} from './database.mjs'
import {chunkManager} from './world.mjs'
import './ui.mjs'
import './ui-debug.mjs'

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
    database.init()

    // 2. Hydratation des données statiques
    this.#hydrateNodes()
    this.#hydrateItems()
    // this._hydrateBuffs() ...

    // Écouteur Debug (Touche ²)
    window.addEventListener('keydown', (e) => {
      // "²" sur clavier AZERTY. !e.repeat empêche l'auto-fire si maintenu.
      if (e.key === '²' && !e.repeat) {
        this.debugTrigger = true
      }
      if (e.key === 'm' && !e.repeat) {
        this.debugMap = true
      }
    })

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
    // const state = await database.getAllGameState()
    // DEBUG
    const state = {
      timestamp: 480 * 1000,
      weather: 2,
      nextWeather: 3
    }

    // 2. Dispatch aux systèmes (Injection de dépendance des données)
    // Valeur par défaut (480000) gérée si state.timestamp est undefined (nouveau jeu)
    timeManager.init(state.timestamp, state.weather, state.nextWeather)

    // 2. Initialisation des systèmes (Layer 1)

    // Init RNG en mode aléatoire (Math.random()) pour la session de jeu
    seededRNG.init()

    // OBLIGATOIRE EN PREMIER POUR QUE LES MANAGERS PUISSENT TRAVAILLER
    microTasker.init()
    microTasker.initDebug(MICROTASK_FN_NAME_TO_KEY)
    taskScheduler.init(state.timestamp)
    timeManager.init(state.timestamp, state.weather, state.nextWeather)

    // chargement du monde - SIMULATION DE DONNÉES (MOCK)
    const mockSavedChunks = []
    const TEST_VALUES = [11, 16, 20] // Patterns alternés
    const TOTAL_CHUNKS = 2048 // 64 * 32
    const CHUNK_SIZE_BYTES = 256 // 16 * 16

    for (let i = 0; i < TOTAL_CHUNKS; i++) {
      // 1. Création du buffer de 256 octets
      const chunkData = new Uint8Array(CHUNK_SIZE_BYTES)

      // 2. Remplissage avec la valeur (Alternance 11 -> 16 -> 20)
      chunkData.fill(TEST_VALUES[i % 3])

      // 3. Construction de l'objet Record DB
      mockSavedChunks.push({
        key: `mock_chunk_${i}`, // Clé fictive
        index: i, // Index logique indispensable
        chunk: chunkData // Uint8Array
      })
    }
    // Injection
    chunkManager.init(mockSavedChunks)

    // buffManager.init()
    // Les quatre lignes ci-dessous simulent le traitement du buffManager
    eventBus.emit('buff/display-next-weather', true)
    eventBus.emit('buff/display-moon-detail', true)
    eventBus.emit('buff/display-time-precision', 3) // DEBUG => toutes les secondes
    eventBus.emit('buff/display-coords', true)

    // 3. Initialisation des systèmes (Layer 2)
    // C'est ici qu'on initialise les managers
    // await WorldManager.init(...)

    // 4. Lancement de la boucle
    this.isRunning = true
    this.lastTime = performance.now()
    this.loop(this.lastTime)
  }

  /* =========================================
     GAME LOOP
     ========================================= */

  loop (timestamp) {
    // timestamp = performance.now()

    if (!this.isRunning) return
    requestAnimationFrame((t) => this.loop(t))

    // ///////////// //
    // BUDGET UPDATE //
    // ///////////// //

    // 1. DELTA TIME

    const executionStart = performance.now() // Capture du temps réel de début d'exécution du JS pour mesure des temps d'exécution
    let dt = timestamp - this.lastTime
    this.lastTime = timestamp

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

    // AExécution Debug synchronisée (consommation du flag)
    if (this.debugTrigger) {
      this.debugTrigger = false // Reset immédiat
      this.#runDebugAction()
    }

    // 2. UPDATE (SYSTEMS)
    // 2.A. TimeManager (Source de vérité temporelle)
    const gameTimestamp = timeManager.update(dt) // timestamp depuis création du monde

    // 2.B. TaskScheduler (Vérifie si des tâches longues sont dues)
    taskScheduler.update(gameTimestamp)

    // 2.C. Suite
    // worldManager.update(dt)

    const durationUpdate = performance.now() - executionStart
    if (durationUpdate > TIME_BUDGET.UPDATE) {
      console.warn(`⚠️ Budget Update: ${durationUpdate.toFixed(2)}ms`)
      // if (Math.random() < 0.01) console.warn(`⚠️ Budget Update: ${durationUpdate.toFixed(2)}ms`)
    }

    // ///////////// //
    // BUDGET RENDER //
    // ///////////// //

    // 3. Render (Graphisme)
    // canvas.clear()
    // backgroundManager.drawCanvas(canvas)
    // worldManager.drawCanvas(canvas)
    // plantManager.drawCanvas(canvas)
    // furnitureManager.drawCanvas(canvas)
    // monsterManager.drawCanvas(canvas)
    // playerManager.drawCanvas(canvas)

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
