// inventory.mjs — GameCore - KeyboardManager - MouseManager

import {TIME_BUDGET, MICROTASK_FN_NAME_TO_KEY, STATE, OVERLAYS, MICROTASK} from './constant.mjs'
import {NODES, NODES_LOOKUP, SKY_BORDER_NODE, MAX_FURNITURE_W, MAX_FURNITURE_H, ITEM_TYPE, ITEMS, RECIPES, MONSTERS, TREE_IMAGES} from '../assets/data/data.mjs'
import {HELP_TITLES, hydrateHelp} from '../assets/data/data-help.mjs'
import {loadAssets, resolveAssetData} from './assets.mjs'
import {timeManager, taskScheduler, microTasker, eventBus, seededRNG, parseLootCount, parseLootBuffs, buildLootHelpRow, blockedTiles} from './utils.mjs'
import {database} from './database.mjs'
import {chunkManager} from './world.mjs'
import {saveManager} from './persistence.mjs'
import {camera, worldRenderer} from './render.mjs'
import {buffManager} from './buff.mjs'
import {creationDialogOverlay, seedWidget, tileHoverWidget} from './ui.mjs'
import {helpOverlay} from './help.mjs'
import {inventoryManager} from './inventory.mjs'
import {furnitureManager} from './housing.mjs'
import {craftOverlay} from './craft.mjs'
import {achievementManager} from './achievement.mjs'
import {playerManager, hotbarOverlay} from './player.mjs'
import {floraManager, sunflowerSystem} from './ecosystem.mjs'
import {ACHIEVEMENT_CATEGORIES} from '../assets/data/data-achievement.mjs'
import {miningManager, placingManager, foragingManager} from './action.mjs'
import './ui-debug.mjs'
import './combat.mjs'

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
    this.timeScale = 1 // ×1 normal — T pour cycler ×1 / ×10 / ×60 (debug)
    this.showBlockedTiles = false // true pour afficher les tuiles bloquées
    this.showGrids = false // true pour afficher les tuiles bloquées
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
    this.#hydrateTreeImages()
    this.#hydrateHelp()
    this.#hydrateAchievements()
    // this._hydrateBuffs() ...

    // 3. Liens avec le DOM
    mouseManager.init()

    this.isBooted = true
    console.timeEnd('Engine Boot')
    console.log('✅ Moteur prêt.')
  }

  // Hydratation d'une action de loot (mining, harvesting, hamming...)
  #hydrateLootAction (action, actionName, nodeName) {
    const allNames = new Set()

    if (action.items !== undefined) {
      for (const lootItem of action.items) {
        const itemId = lootItem.item
        lootItem.item = ITEMS[itemId]
        if (!lootItem.item) {
          console.error(`[hydrate] ${nodeName}.${actionName} : item inconnu '${itemId}'`)
        }
        lootItem.count = parseLootCount(lootItem.count)
        const {buffs, buffList} = parseLootBuffs(lootItem.buffs)
        lootItem.buffs = buffs
        for (const name of buffList) allNames.add(name)
        lootItem.helpRow = buildLootHelpRow(lootItem)
      }
      action.buffList = [...allNames, `${actionName}-yield`]
    }
  }

  /**
   * Hydratation spécifique pour les Tuiles (NODES)
   * Transforme les strings 'image' en objets 'image' avec imgIndex
   */
  #hydrateNodes () {
    let count = 0

    for (const node of NODES_LOOKUP) {
      if (!node) continue

      // Image statique
      if (node.image) {
        node.image = resolveAssetData(node.image)
        count++
      }
      if (node.waveImage) node.waveImage = resolveAssetData(node.waveImage)
      // champ Help
      if (node.help !== null && !HELP_TITLES.has(node.help)) {
        console.error(`[core] NODES.${node.name} : help topic inconnu '${node.help}'`)
      }
      // champs de loot
      if (node.mining) {
        this.#hydrateLootAction(node.mining, 'mining', node.name)
        if (node.mining.keep) {
          const resolved = NODES[node.mining.keep]
          if (!resolved) console.error(`[hydrateNodes] NODES.${node.name}.mining.keep : node inconnu '${node.mining.keep}'`)
          else node.mining.keep = resolved
        }
      }
      if (node.foraging) this.#hydrateLootAction(node.foraging, 'foraging', node.name)
      if (node.hamming) this.#hydrateLootAction(node.hamming, 'hamming', node.name)
    }
    SKY_BORDER_NODE.image = resolveAssetData(SKY_BORDER_NODE.image)

    console.log(`   🔹 Nodes hydratés : ${count}`, NODES)
  }

  /**
   * Hydratation spécifique pour les Items
   */
  #hydrateItems () {
    let count = 0
    let errors = 0

    for (const key in ITEMS) {
      const item = ITEMS[key]
      if (item.image) item.image = resolveAssetData(item.image)
      if (item.placed) item.placed = resolveAssetData(item.placed)
      if (item.placedRight) item.placedRight = resolveAssetData(item.placedRight)
      if (item.placedLeft) item.placedLeft = resolveAssetData(item.placedLeft)

      if (item.foraging) this.#hydrateLootAction(item.foraging, 'foraging', item.name)

      if (!HELP_TITLES.has(item.help)) {
        console.error(`[core] ITEMS.${key} : help topic inconnu '${item.help}'`)
        errors++
      }

      const placedImage = item.placed ?? item.placedLeft
      if (placedImage) {
        if (placedImage.sw / 16 > MAX_FURNITURE_W || placedImage.sh / 16 > MAX_FURNITURE_H) {
          console.error(`[hydrateItems] ITEMS.${key} : dimensions ${placedImage.sw / 16}x${placedImage.sh / 16} dépassent MAX_FURNITURE_W/H (${MAX_FURNITURE_W}x${MAX_FURNITURE_H}) — mettre à jour les constantes`)
        }
      }
      count++
    }

    console.log(`   🔹 Items hydratés : ${count}, ${errors} erreur(s)`, ITEMS)
  }

  /**
   * Hydratation spécifique pour les images des arbres
   */
  #hydrateTreeImages () {
    let count = 0
    for (const treeType in TREE_IMAGES) {
      const rows = TREE_IMAGES[treeType]
      for (const images of rows) {
        for (let col = 0; col < images.length; col++) {
          images[col] = resolveAssetData(images[col])
          count++
        }
      }
    }
    console.log(`   🔹 Tree images hydratées : ${count}`)
  }

  /**
 * Hydratation de l'aide en ligne.
 * - Vérifie les références [[itemCode]] et {{node:x}}, {{item:x}}, {{recipe:x}}
 * - Remplace les références valides par leur contenu HTML
 * - Injecte ⚠️ pour les références inconnues
 * - Stocke le HTML final dans entry.html
 */
  #hydrateHelp () {
    const {count, errors} = hydrateHelp(NODES, ITEMS, RECIPES)
    console.log(`   🔹 Help hydratée : ${count} fiches, ${errors} erreur(s)`)
  }

  /**
 * Vérifie que tous les codes référencés dans ACHIEVEMENT_CATEGORIES
 * existent dans ITEMS, NODES ou MONSTERS.
 * Appelé au boot, après #hydrateItems().
 */
  #hydrateAchievements () {
    for (const category of ACHIEVEMENT_CATEGORIES) {
      for (const code of category.items) {
        if (ITEMS[code] === undefined &&
          MONSTERS[code] === undefined) {
          console.error(`[hydrateAchievements] '${category.id}' : code inconnu '${code}'`)
        }
      }
    }
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

    // Init RNG en mode aléatoire (Math.random()) pour la session de jeu
    seededRNG.init()

    // OBLIGATOIRE EN PREMIER POUR QUE LES MANAGERS PUISSENT TRAVAILLER
    microTasker.init()
    microTasker.initDebug(MICROTASK_FN_NAME_TO_KEY)

    // 1. Nettoyage des enregistrements invalides (system=0)
    // Les entités détruites pendant le jeu sont marquées system=0 plutôt que
    // supprimées (modification plus rapide qu'une suppression en temps réel).
    // La purge physique se fait ici, hors temps réel, au lancement de session.
    // Exception : les suppressions trop fréquentes sont faites en temps réel
    // (à minimiser dans le design).
    // await database.deleteInvalidPlants() // TODO
    // await database.deleteInvalidFurnitures() // TODO

    // 2. Chargement massif de l'état (1 seule requête DB)
    // Retourne un objet : {timestamp: 480000, weather: 1, playerPosition: '100|82|1', ...}
    const state = await database.getAllGameState()
    // ── Détection première session ─────────────────────────────────────────────
    if (!state.randomkey) {
      eventBus.emit('creation/open')
      return
    }

    // 3. Dispatch aux systèmes (Injection de dépendance des données)
    // Valeur par défaut (480000) gérée si state.timestamp est undefined (nouveau jeu)
    timeManager.init(state.timestamp, state.weather, state.nextWeather)

    // 4. Initialisation des systèmes (Layer 1)
    this.previousTileIndex = undefined

    taskScheduler.init(state.timestamp)
    timeManager.init(state.timestamp, state.weather, state.nextWeather)

    // Tuiles ETERNAL spéciales (gamestate)
    blockedTiles.init(state.eternals)

    // Injection des tuiles
    const mockSavedChunks = await database.readAllFromObjectStore('world_chunks')
    chunkManager.init(mockSavedChunks)

    // position et direction du joueur
    const position = playerManager.init(state.player)
    camera.init(position)

    // Puis initialisaton du rendering du monde
    worldRenderer.init()
    // Lancement de la sauvegarde périodique (toutes les deux secondes)
    saveManager.init()

    seedWidget.init(state.randomkey)
    buffManager.init()
    // hiveSystem.init(state.hives) // TODO
    // cobwebSystem.init(state.cobwebcaves) // TODO
    // lakeeSystem.init(state.lakes) // TODO
    // geodeSystem.init(state.geodecaves) // TODO

    // 5. Initialisation des systèmes (Layer 2)
    creationDialogOverlay.init(state.randomkey)

    hotbarOverlay.init()
    helpOverlay.init(state.helptopic)
    craftOverlay.init(state.craftfiltermode, state.craftfiltertype, state.craftfilterstation, state.craftfiltermaterial)
    // C'est ici qu'on initialise les managers
    // await FaunaManager.init(...)

    // 5.1 Objectstore Inventory
    const inventoryRecords = await database.readAllFromObjectStore('inventory')
    const itemsToDelete = []
    inventoryManager.init()

    for (const record of inventoryRecords) {
      if (record.deleted) {
        itemsToDelete.push(record.key)
        continue
      }
      inventoryManager.initSlot(record)
    }
    if (itemsToDelete.length > 0) {
      await database.deleteMultipleRecords('inventory', itemsToDelete)
    }
    inventoryManager.initDone() // vérification de l'intégrité des slots (appel optionnel)

    // 5.2 Objectstore Furniture
    const furnitureRecords = await database.readAllFromObjectStore('furniture')
    const furnituresToDelete = []
    const activeFurnitures = []
    for (const record of furnitureRecords) {
      if (record.deleted) {
        furnituresToDelete.push(record.key)
      } else {
        activeFurnitures.push(record)
      }
    }
    if (furnituresToDelete.length > 0) {
      await database.deleteMultipleRecords('furniture', furnituresToDelete)
    }
    furnitureManager.init(activeFurnitures)
    furnitureManager.onPreloadChunksChanged(camera.preloadChunks)

    // 5.3 Objectstore Achievements
    const achievementRecords = await database.readAllFromObjectStore('achievements')
    achievementManager.init(achievementRecords)

    // 5.4 Objectstore Plant
    const plantRecords = await database.readAllFromObjectStore('plant')
    const plantsToDelete = []
    floraManager.init()
    for (const record of plantRecords) {
      if (record.deleted) { plantsToDelete.push(record.key); continue }
      floraManager.addPlant(record)
    }
    if (plantsToDelete.length > 0) {
      await database.deleteMultipleRecords('plant', plantsToDelete)
    }
    floraManager.onPreloadChunksChanged(camera.preloadChunks)

    // 5.5 TODO Monsters

    // 6. Lancement de la boucle
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

    // --- ACCELERATION DU TEMPS (Sleeping) ---
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
    const gameTimestamp = timeManager.update(dt * this.timeScale) // timestamp depuis création du monde

    // 2.B. TaskScheduler (Vérifie si des tâches longues sont dues)
    taskScheduler.update(gameTimestamp)

    // 2.C Mouvements et caméra — déléguée à PlayerManager
    // Version DEBUG
    if (keyboardManager.directionsArrow !== 0) {
      camera.update(playerManager.updateDebug(dt, keyboardManager.directionsArrow))
    } else {
      camera.update(playerManager.update(dt, keyboardManager.directionsGame))
    }
    // Fin version DEBUG
    // Version Normale
    // camera.update(playerManager.update(dt, keyboardManager.directionsArrow | keyboardManager.directionsGame))
    // fin version Normale

    // 2.D Tuile sous la souris — disponible pour tous les systèmes de la frame
    const tileIndex = camera.canvasToTile(mouseManager.mouse.x, mouseManager.mouse.y)
    const tileCode = tileIndex !== null ? chunkManager.getTileAt(tileIndex) : null
    const tileNode = tileCode !== null ? NODES_LOOKUP[tileCode] : null

    // 2.E Affiche des informations concernant la tuile sous la souris
    if (tileIndex !== null && tileIndex !== this.previousTileIndex) {
      this.previousTileIndex = tileIndex
      eventBus.emit('world/tile-hover', tileNode)
      const {priority, capacity} = MICROTASK.UI_TILE_HOVER
      microTasker.enqueueOnce(tileHoverWidget.onTileHoverDetail, priority, capacity, tileNode, tileIndex)
    }

    // 2.F Gestion du clic gauche la souris
    const leftClick = mouseManager.consumeLeftClick() // "Read-and-Reset"
    if (leftClick) this.#processWorldClick(tileIndex, tileNode)

    // 2.G Gestion du clic droit la souris
    const rightClick = mouseManager.consumeRightClick() // "Read-and-Reset"
    if (rightClick) {
      //
    }

    // DEBUG
    this.mockupDiv.innerHTML = `Mouse: ${mouseManager.mouse.x}, ${mouseManager.mouse.y}, ${tileIndex}, ${tileCode}`
    if (leftClick) { console.log('leftClick', mouseManager.mouse) }
    if (rightClick) { console.log('rightClick', mouseManager.mouse) }

    // 2.H. Suite
    // flore.update(dt)

    // 2.I. Suite
    // faune.update(dt)

    // 3.1 génère la liste des chunks dont il faut générer les images
    // Les images seront générées par une micro-tâche
    worldRenderer.update()

    const durationUpdate = performance.now() - executionStart
    if (durationUpdate > TIME_BUDGET.UPDATE) {
      console.warn(`⚠️ Budget Update: ${durationUpdate.toFixed(2)}ms`)
      // if (Math.random() < 0.01) console.warn(`⚠️ Budget Update: ${durationUpdate.toFixed(2)}ms`)
    }

    // ///////////// //
    // BUDGET RENDER //
    // ///////////// //

    // 3. Render (Pass-through Context)
    // worldRenderer.render() appelle ctx.save() + ctx.scale/translate et retourne le ctx transformé.
    // Chaque manager suivant dessine en coordonnées Monde sur ce même ctx (pas besoin de recalculer la caméra).
    // ctx.restore() DOIT rester après le dernier manager de la chaîne — il annule le save() de worldRenderer.
    // lightRenderer opère sur son propre canvas séparé : il se place après restore(), hors de la chaîne.
    const ctx = worldRenderer.render()
    floraManager.render(ctx)
    furnitureManager.render(ctx)
    // monsterManager.render(ctx)
    playerManager.render(ctx)
    if (this.showBlockedTiles) {
      blockedTiles.render(ctx) // DEBUG
      sunflowerSystem.debugRenderSpots(ctx)
    }
    if (this.showGrids) {
      const buffs = buffManager.getBuffs(['showGrid', 'showInteractionRange', 'showToolRange'])
      if (buffs.showGrid) this.#showGrid(ctx)
      if (buffs.showInteractionRange) this.#showInteractionRange(ctx)
      if (buffs.showToolRange) this.#showToolRange(ctx)
    }
    ctx.restore() // clôt le save() de worldRenderer.render() — NE PAS déplacer ni supprimer
    // lightRenderer.render()

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

  /**
   * Aiguillage des actions déclenchées par un clic monde.
   * Appelée depuis la loop uniquement si un clic monde a été consommé.
   * @param {number} tileIndex — (y << 10) | x
   * @param {number} tileCode  — code brut de la tuile
   * @param {object} tileNode  — NODES_LOOKUP[tileCode]
   */
  #processWorldClick (tileIndex, tileNode) {
    const slot = hotbarOverlay.activeSlot
    if (!slot.item) return

    const item = ITEMS[slot.item]

    if (item.type & ITEM_TYPE.TOOL) {
      if (item.stype === 'pickaxe') miningManager.tryMine(tileIndex, tileNode, item, slot.prefix)
      // else if (item.stype === 'hammer') hammingManager.tryUse(tileIndex, tileNode, item, slot.prefix)
      // else if (item.stype === 'axe') choppingManager.tryChop(tileIndex, tileNode, item, slot.prefix)
      else if (item.stype === 'sickle') foragingManager.tryForage(tileIndex, tileNode, item, slot.prefix)
      // else if (item.stype === 'bugnet') catchingingManager.tryCatch(tileIndex, tileNode, item, slot.prefix)
      // else if (item.stype === 'fishingrod') fishingManager.tryFish(tileIndex, tileNode, item, slot.prefix)
      // else if (item.stype === 'container') fillingManager.tryFill(tileIndex, tileNode, item, slot.prefix)
    } else if (item.type & ITEM_TYPE.PLACABLE) {
      if (item.type & ITEM_TYPE.BLOCK) placingManager.tryPlace(tileIndex, tileNode, item, slot.slot)
      // else if (item.type & ITEM_TYPE.SEED) sowingManager.tryPlant(tileIndex, tileNode, item, slot.prefix)
      // else if (item.type & ITEM_TYPE.FURNITURE) furnishingManager.tryPlace(tileIndex, tileNode, item, slot.prefix)
    }
  }

  /**
 * Affiche le rectangle d'action du tool actif, étendu par item.range et le buff 'range'.
 * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
 */
  #showToolRange (ctx) {
    const TOOL_RANGE_BUFF = new Map([
      ['pickaxe', 'mining-range']
      // ['hammer', 'hammer-range'],
      // ['axe',    'axe-range'],
    ])
    const slot = hotbarOverlay.activeSlot
    if (!slot.item) return
    const item = ITEMS[slot.item]
    if (!(item.type & ITEM_TYPE.TOOL)) return

    const buffName = TOOL_RANGE_BUFF.get(item.stype)
    if (buffName === undefined) return

    const rect = buffManager.getBuff(buffName)
    const range = item.range + (slot.prefix === 'Extended' ? 2 : 0)
    const {x: cx, y: cy, direction} = playerManager.getCenterTile()

    const ex = rect.x - range
    const ey = rect.y - range
    const ew = rect.w + 2 * range
    const eh = rect.h + 2 * range

    const worldX = direction === 0 ? cx - ex - ew + 1 : cx + ex
    const worldY = cy + ey

    ctx.save()
    ctx.strokeStyle = 'rgba(251, 157, 49, 0.9)'
    ctx.lineWidth = 3
    ctx.strokeRect(worldX << 4, worldY << 4, ew << 4, eh << 4)
    ctx.restore()
  }

  /**
 * Affiche le rectangle de l'interaction range centré sur le joueur.
 * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
 */
  #showInteractionRange (ctx) {
    const {x: cx, y: cy} = playerManager.getCenterTile()
    const rect = buffManager.getBuff('interaction-range')
    const pxX = (cx + rect.x) << 4
    const pxY = (cy + rect.y) << 4
    const pxW = rect.w << 4
    const pxH = rect.h << 4
    ctx.save()
    ctx.strokeStyle = 'rgba(248, 8, 8, 0.9)'
    ctx.lineWidth = 3
    ctx.strokeRect(pxX, pxY, pxW, pxH)
    ctx.restore()
  }

  /**
 * Affiche la grille des tuiles du monde
 * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
 */
  #showGrid (ctx) {
    if (camera.preloadChunks.size === 0) return

    // Bornes de la zone visible en coordonnées chunk
    let minCX = 63; let maxCX = 0; let minCY = 31; let maxCY = 0
    for (const key of camera.preloadChunks) {
      const cx = key & 0x3F
      const cy = key >> 6
      if (cx < minCX) minCX = cx
      if (cx > maxCX) maxCX = cx
      if (cy < minCY) minCY = cy
      if (cy > maxCY) maxCY = cy
    }

    const pxX0 = minCX << 8
    const pxY0 = minCY << 8
    const pxX1 = (maxCX + 1) << 8
    const pxY1 = (maxCY + 1) << 8

    ctx.save()

    // Grille fine — une ligne par tuile (16px)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = pxX0; x <= pxX1; x += 16) { ctx.moveTo(x, pxY0); ctx.lineTo(x, pxY1) }
    for (let y = pxY0; y <= pxY1; y += 16) { ctx.moveTo(pxX0, y); ctx.lineTo(pxX1, y) }
    ctx.stroke()

    // Grille chunks — une ligne par chunk (256px)
    ctx.strokeStyle = 'rgba(255, 220, 50, 0.8)'
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let cx = minCX; cx <= maxCX + 1; cx++) { const x = cx << 8; ctx.moveTo(x, pxY0); ctx.lineTo(x, pxY1) }
    for (let cy = minCY; cy <= maxCY + 1; cy++) { const y = cy << 8; ctx.moveTo(pxX0, y); ctx.lineTo(pxX1, y) }
    ctx.stroke()

    // Index des chunks
    ctx.fillStyle = 'rgba(255, 220, 50, 0.9)'
    ctx.font = '20px monospace'
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        ctx.fillText((cy << 6) | cx, (cx << 8) + 4, (cy << 8) + 20)
      }
    }

    ctx.restore()
  }

  /* =========================================
     DEBUG
     ========================================= */

  #runDebugAction () {
    console.log('GameCore.#runDebugAction')
    eventBus.debugStats()
    microTasker.debugStats()
    taskScheduler.debugStats()
    eventBus.emit('debug/buff-manager')
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

const MOVEMENT_MAP_ARROW = {
  ArrowUp: 1,
  ArrowDown: 2,
  ArrowLeft: 4,
  ArrowRight: 8
}

const MOVEMENT_MAP_GAME = {
  KeyW: 1, // Z (Azerty) / W (Qwerty)
  KeyS: 2,
  KeyA: 4, // Q (Azerty) / A (Qwerty)
  KeyD: 8
}

const OVERLAY_MAP = {
  m: 'map',
  M: 'map',
  i: 'inventory',
  I: 'inventory',
  k: 'craft',
  K: 'craft',
  h: 'help',
  H: 'help',
  u: 'achievement',
  U: 'achievement'
}

class KeyboardManager {
  #overlayStack

  constructor () {
    this.#overlayStack = []
    this.state = STATE.EXPLORATION // il faut pouvoir passer en STATE;CREATION si la base de donnée est vide
    this.debugTrigger = false // affiche dans la console les logs du MicroTasker, du TaskScheduler et de l'EventBus
    this.directionsArrow = 0
    this.directionsGame = 0

    this.onKeyDown = this.onKeyDown.bind(this)
    this.onKeyUp = this.onKeyUp.bind(this)
    // Passive: true n'est pas nécessaire ici car preventDefault n'est pas appelé systématiquement
    // mais on reste sur du standard.
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    // écoute les demandes de fermeture  et d'ouverture des overlays
    this.onCloseRequest = this.onCloseRequest.bind(this)
    this.onOverlayOpenRequest = this.onOverlayOpenRequest.bind(this)
    eventBus.on('overlay/close', this.onCloseRequest)
    eventBus.on('overlay/open-request', this.onOverlayOpenRequest)
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

    // Guard : ignorer toutes les touches si le focus est sur un champ de saisie
    const tag = e.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

    // Debug dans la console (Touche ² (AZERTY) ou ` (QWERTY))
    if (e.code === 'Backquote') { this.debugTrigger = true }
    if (e.code === 'KeyT') {
      gameCore.timeScale = gameCore.timeScale === 1 ? 10 : gameCore.timeScale === 10 ? 20 : 1
      console.log(`⏱ x${gameCore.timeScale}`)
    }
    if (e.code === 'NumpadAdd') gameCore.showBlockedTiles = true
    if (e.code === 'KeyR') gameCore.showGrids = true

    // 1 Overlay
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

    // 2. Forwarding vers l'overlay au sommet de la pile
    const topId = this.#overlayStack[this.#overlayStack.length - 1]
    if (topId) {
      eventBus.emit(`${topId}/keydown`, e.key)
    }

    // 3. Mouvements (Polling)
    const arrowBit = MOVEMENT_MAP_ARROW[e.code]
    if (arrowBit) { this.directionsArrow |= arrowBit; return }
    const gameBit = MOVEMENT_MAP_GAME[e.code]
    if (gameBit) { this.directionsGame |= gameBit; return }

    // 4. Hotbar (Selection Slot)
    const slotIndex = HOTBAR_MAP[e.code]
    if (slotIndex !== undefined) {
      eventBus.emit('hotbar/select-slot', slotIndex)
    }
  }

  /**
   * KEY UP
   * Indispensable pour arrêter le mouvement quand on relâche la touche
   */
  onKeyUp (e) {
    const arrowBit = MOVEMENT_MAP_ARROW[e.code]
    if (arrowBit) { this.directionsArrow &= ~arrowBit; return }
    const gameBit = MOVEMENT_MAP_GAME[e.code]
    if (gameBit) { this.directionsGame &= ~gameBit }
    if (e.code === 'NumpadAdd') gameCore.showBlockedTiles = false
    if (e.code === 'KeyR') gameCore.showGrids = false
  }

  onCloseRequest (overlyId) {
    const stackTop = this.#overlayStack[this.#overlayStack.length - 1]
    if (stackTop !== overlyId) return
    this.#closeOverlay()
  }

  onOverlayOpenRequest (overlyId) {
    if (overlyId) this.#openOverlay(overlyId)
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
