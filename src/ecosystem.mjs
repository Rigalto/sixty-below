// ecosystem.mjs — FloraManager - CobwebSystem - HiveSystem
// SampleSystem

import {eventBus} from './utils.mjs'

/* ====================================================================================================
   HELPERS COMMUNS A TOUS LES SYSTEMS
   ==================================================================================================== */

/* ====================================================================================================
   FLORA MANAGER
   ====================================================================================================

   Singleton : floraManager.

   Orchestrateur unique de tous les systèmes de plantes. Aucune logique de rendu propre.

   Responsabilités :
     - Dispatcher les records actifs vers le système compétent (addPlant)
     - Propager les changements de chunks preload à tous les systèmes (onPreloadChunksChanged)
     - Déléguer render et requêtes spatiales à chaque système

   Interactions :
     eventBus          — écoute : 'camera/preload-chunks-changed' → onPreloadChunksChanged
     core.mjs          — appelant de init() et addPlant() au startSession
     systèmes internes — init, initPlant, onPreloadChunksChanged, render, getPlantAt

   Structures internes :
     #systemMap  — Map<kind*100+type, system> — dispatch O(1) vers le système compétent
     #allSystems — system[] — liste ordonnée pour render (arbres avant herbes avant champignons)

   ==================================================================================================== */

class FloraManager {
  #systemMap = new Map([ // Map<kind*100+type, system> — peuplée au fur et à mesure
    //   [PLANT_KIND.NATURAL * 100 + PLANT_TYPE.NONE, naturalSystem],
    //   [PLANT_KIND.TREE * 100 + PLANT_TYPE.OAK, treeSystem],
    //   [PLANT_KIND.TREE * 100 + PLANT_TYPE.MAHOGANY, treeSystem],
    //   [PLANT_KIND.TREE * 100 + PLANT_TYPE.COCONUT, treeSystem],
    //   [PLANT_KIND.TREE * 100 + PLANT_TYPE.GIANT_MUSHROOM, treeSystem],
    //   [PLANT_KIND.MUSHROOM * 100 + PLANT_TYPE.BOLETE, mushroomSystem],
    //   [PLANT_KIND.MUSHROOM * 100 + PLANT_TYPE.PINKMYCENIA, mushroomSystem],
    //   [PLANT_KIND.MUSHROOM * 100 + PLANT_TYPE.FROSTCAP, capystem],
    //   [PLANT_KIND.MUSHROOM * 100 + PLANT_TYPE.DAWNCAP, capystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.PLANT_TYPE.OLEANDER, oleanderSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.BLINKROOT, blinkrootSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.PARSNIP, parsnipSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.SUNFLOWER, sunflowerSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.FIREBLOSSOM, fireblossomSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.SKORN, skornSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.AMBERMIRAGE, ambermirageSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.BLOODMOON, bloodmoonSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.SHADOWFERN, fernSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.CRIMSONFROND, fernSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.GOLDENVEIL, fernSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.MISTFERN, fernSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.VELVETMOSS, mossSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.CORAL_R, coralSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.CORAL_P, coralSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.CORAL_Y, coralSystem],
    //   [PLANT_KIND.HERB * 100 + PLANT_TYPE.CORAL_G, coralSystem],
    //   [PLANT_KIND.SPREAD * 100 + PLANT_TYPE.NONE, spreadSystem],
    //   [PLANT_KIND.SEED * 100 + PLANT_TYPE.NONE, seedSystem]
  ])

  // naturalSystem, treeSystem, mushroomSystem, capystem, oleanderSystem, blinkrootSystem, parsnipSystem, sunflowerSystem, fireblossomSystem, skornSystem, ambermirageSystem, bloodmoonSystem, fernSystem, mossSystem, coralSystem, spreadSystem, seedSystem
  #allSystems = [] // system[] — dans l'ordre de rendu

  constructor () {
    this.onPreloadChunksChanged = this.onPreloadChunksChanged.bind(this)
    eventBus.on('camera/preload-chunks-changed', this.onPreloadChunksChanged)
  }

  /**
   * Réinitialise tous les systèmes enregistrés.
   */
  init () {
    for (const system of this.#allSystems) system.init()
  }

  /**
   * Dispatche un record vers le système compétent selon kind et type.
   * Les records deleted=false sont garantis par l'appelant.
   * @param {object} record — record de l'objectStore 'plant'
   */
  addPlant (record) {
    const system = this.#systemMap.get(record.kind * 100 + record.type)
    if (system === undefined) return
    system.initPlant(record)
  }

  /**
   * Propage le changement de chunks preload à tous les systèmes.
   * Liaison EventBus : 'camera/preload-chunks-changed'.
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) {
    for (const system of this.#allSystems) system.onPreloadChunksChanged(preloadChunks)
  }

  /**
   * Retourne la plante couvrant la tuile donnée, ou null.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {object|null}
   */
  getPlantAt (tileIndex) {
    for (const system of this.#allSystems) {
      const plant = system.byTile.get(tileIndex)
      if (plant !== undefined) return plant
    }
    return null
  }

  /**
   * Dessine toutes les plantes visibles, système par système dans l'ordre de #allSystems.
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  render (ctx) {
    for (const system of this.#allSystems) system.render(ctx)
  }
}

export const floraManager = new FloraManager()

/* ====================================================================================================
   SAMPLE SYSTEM
   ====================================================================================================

   Singleton : sampleSystem.

   Patron de référence pour tous les systèmes de plantes de FloraManager.
   Copier, renommer (ex: MandrakeSystem) et spécialiser render().

   Responsabilités :
     - Indexer les records dans quatre structures complémentaires (init + addRecord)
     - Exposer byTile (public) pour les requêtes spatiales de FloraManager
     - Limiter le render aux chunks preload via #displayed

   Interactions :
     floraManager — init, addRecord, updateDisplay, render, getPlantAt

   ==================================================================================================== */

class SampleSystem {
  byTile = new Map() // Map<tileIndex, record> — public : membership O(1) + lookup record
  #list = [] // record[] — tous les records (lifecycle, itération)
  #byChunk = new Map() // Map<chunkKey, Set> — lookup spatial pour updateDisplay
  #displayed = new Set() // Set<record> — cible du render (chunks preload uniquement)

  /**
   * Réinitialise toutes les structures. Appelé en début de session.
   */
  init () {
    this.byTile.clear()
    this.#list.length = 0
    this.#byChunk.clear()
    this.#displayed.clear()
  }

  /**
   * Enregistre un record actif et peuple les quatre structures internes.
   * @param {object} record — record de l'objectStore 'plant' (deleted=false garanti par l'appelant)
   */
  initPlant (record) {
    this.#list.push(record)

    // byTile — toutes les tuiles du rectangle englobant (index, w, h)
    const px = record.index & 0x3FF
    const py = record.index >> 10
    for (let dy = 0; dy < record.h; dy++) {
      const rowBase = (py + dy) << 10
      for (let dx = 0; dx < record.w; dx++) {
        this.byTile.set(rowBase | (px + dx), record)
      }
    }

    // #byChunk — chunk du coin haut-gauche uniquement
    // Le ring preload de la caméra garantit la couverture des plantes chevauchant deux chunks.
    const chunkKey = ((record.index >> 14) << 6) | ((record.index & 0x3FF) >> 4)
    let set = this.#byChunk.get(chunkKey)
    if (set === undefined) {
      set = new Set()
      this.#byChunk.set(chunkKey, set)
    }
    set.add(record)
  }

  /**
   * Reconstruit #displayed depuis les chunks preload de la caméra.
   * Appelé directement par FloraManager (synchrone) — basculer en microtâche si dépassement 100µs.
   * @param {Set<number>} preloadChunks
   */
  onPreloadChunksChanged (preloadChunks) {
    this.#displayed.clear()
    for (const chunkKey of preloadChunks) {
      const set = this.#byChunk.get(chunkKey)
      if (set === undefined) continue
      for (const record of set) this.#displayed.add(record)
    }
  }

  /**
   * Dessine les plantes visibles sur le contexte transformé par la caméra.
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  render (ctx) {
    // for (const record of this.#displayed) {
    // TODO: rendu spécifique
    // const pxX = (record.index & 0x3FF) << 4
    // const pxY = (record.index >> 10) << 4
    // ctx.drawImage(IMAGE_CACHE[img.imgIndex], img.sx, img.sy, img.sw, img.sh, pxX, pxY, img.sw, img.sh)
    // }
  }

  /**
   * Retourne le record de la plante couvrant la tuile donnée, ou null.
   * @param {number} tileIndex — (y << 10) | x
   * @returns {object|null}
   */
  getPlantAt (tileIndex) {
    return this.byTile.get(tileIndex) ?? null
  }
}

export const sampleSystem = new SampleSystem()
