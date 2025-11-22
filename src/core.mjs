import { TIME_BUDGET, NODES_LOOKUP } from './constant.mjs'
import { loadAssets, resolveAssetData } from './assets.mjs'

export class GameCore {
  constructor() {
    this.isBooted = false
    this.isRunning = false

    this.budgetTotal = TIME_BUDGET.UPDATE + TIME_BUDGET.RENDER + TIME_BUDGET.MICROTASK
    // Ne rien faire de lourd ici
  }

  /* =========================================
     PHASE 1 : TECHNICAL BOOT (One-Time)
     ========================================= */

  /**
   * Initialisation technique. Charge les ressources et lie les données statiques.
   * À appeler une seule fois au chargement de la page.
   */
  async boot() {
    if (this.isBooted) return
    console.time('Engine Boot')

    // 1. Chargement des Assets (Bloquant)
    await loadAssets()

    // 2. Hydratation des bases de données statiques
    // On sépare les logiques pour la lisibilité
    this._hydrateNodes()
    this._hydrateItems()
    // this._hydrateBuffs() ...

    this.isBooted = true
    console.timeEnd('Engine Boot')
    console.log('✅ Moteur prêt.')
  }

  /**
   * Hydratation spécifique pour les Tuiles (NODES)
   * Transforme les strings 'image' en objets 'renderData' avec imgIndex
   */
  _hydrateNodes() {
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
  _hydrateItems() {
    // TODO: Implémenter quand ITEMS_LOOKUP existera
    // La logique sera identique : parsing des icônes de l'item
    console.log(`   🔹 Items hydratés : (TODO)`)
  }


/* =========================================
     PHASE 2 : GAME SESSION (Repeatable)
     ========================================= */

  /**
   * Lance une partie (Nouveau monde ou Chargement).
   */
  async startSession() {
    if (!this.isBooted) throw new Error("Core not booted. Call boot() first.")
    if (this.isRunning) return

    console.log('🚀 Démarrage de la session...')

    // 1. Récupération des informations en base de données
    // await database.loadSession(...)

    // 2. Initialisation des systèmes (Layer 2)
    // C'est ici qu'on initialise les managers
    // await WorldManager.init(...)

    // 2. Lancement de la boucle
    this.isRunning = true
    this.lastTime = performance.now()
    this.loop()
  }

  /* =========================================
     GAME LOOP
     ========================================= */

  loop(timestamp) {
    if (!this.isRunning) return
    requestAnimationFrame((t) => this.loop(t))

    // Calcul du Delta Time
    const dt = timestamp - this.lastTime
    this.lastTime = timestamp

    // 1. Update (Logique)
    // worldManager.update(dt)

    const durationUpdate = performance.now() - timestamp
    if (durationUpdate > TIME_BUDGET.UPDATE) {
        console.warn(`⚠️ Budget Update: ${durationUpdate.toFixed(2)}ms`)
        // if (Math.random() < 0.01) console.warn(`⚠️ Budget Update: ${durationUpdate.toFixed(2)}ms`)
    }

    // 2. Render (Graphisme)
    // canvas.clear()
    // backgroundManager.drawCanvas(canvas)
    // worldManager.drawCanvas(canvas)
    // plantManager.drawCanvas(canvas)
    // furnitureManager.drawCanvas(canvas)
    // monsterManager.drawCanvas(canvas)
    // playerManager.drawCanvas(canvas)

    const durationRender = performance.now() - timestamp - durationUpdate
    if (durationRender > TIME_BUDGET.RENDER) {
        console.warn(`⚠️ Budget Render: ${durationRender.toFixed(2)}ms`)
        // if (Math.random() < 0.01) console.warn(`⚠️ Budget Render: ${durationRender.toFixed(2)}ms`)

    }
    // Temps écoulé total pour cette frame
    const timeUsed = durationUpdate + durationRender
    const budgetMicrotask = this.budgetTotal - timeUsed

    // 3. MicroTasks (Optimisation)
    if (budgetMicrotask > 0) {
        // microTasker.process(budgetMicrotask)
    }
  }
}
