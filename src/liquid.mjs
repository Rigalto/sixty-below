// liquid.mjs — SandFallingSystem - LiquidBody - LiquidSystem

import {IS_DEV, WORLD_WIDTH, WORLD_HEIGHT, MICROTASK, SEA_LEVEL} from './constant.mjs'
import {eventBus, seededRNG, microTasker, taskScheduler} from './utils.mjs'
import {NODES, NODES_LOOKUP, NODE_TYPE} from '../assets/data/data.mjs'
import {chunkManager} from './world.mjs'
import {database} from './database.mjs'
import {camera} from './render.mjs'

/* ====================================================================================================
   SAND FALLING SYSTEM
   ====================================================================================================

   Singleton : sandFallingSystem.

   Simule la chute du SAND instable (vide en dessous, ou vide en diagonale bas-gauche/bas-droite).
   Aucun record 'plant' — uniquement un Set d'index de tuiles candidates, persisté en gamestate.
   Alimentation réactive over-inclusive sur 'world/tile-changed' (faux positifs tolérés, filtrés
   au traitement périodique). Traitement en deux micro-tâches distinctes : détermination pure
   (aucune écriture monde) puis application en bloc (tous les setTileAt avant tout emit), pour
   respecter la cohérence attendue par les listeners synchrones.

   Aucune vérification blockedTiles : le sable écrase tout meuble/plante sur son passage — la
   suppression du record concerné est déléguée au listener 'world/tile-changed' propre à chaque
   système existant, pas à SandFallingSystem.

   ==================================================================================================== */

const SAND_FALLING_TICK_MS = NODES.SAND.viscosity // fréquence du traitement périodique tant que #pending n'est pas vide
const SAND_FALLING_WARN_THRESHOLD = 100 // simple avertissement si #pending dépasse cette taille

const SAND_FALLING_EMPTY_CODES = new Set([NODES.SKY.code, NODES.VOID.code, NODES.WATER.code, NODES.SEA.code, NODES.SAP.code, NODES.HONEY.code])
const SAND_FALLING_TRIGGER_CODES = new Set([...SAND_FALLING_EMPTY_CODES, NODES.SAND.code])

class SandFallingSystem {
  #pending = new Set() // Set<tileIndex> — tuiles SAND candidates à tester (faux positifs tolérés)
  #dirty = false // true si #pending a changé depuis la dernière écriture gamestate

  constructor () {
    // eventBus
    this.onTileChangedSand = this.onTileChangedSand.bind(this)
    eventBus.on('world/tile-changed', this.onTileChangedSand)
    this.onFirstLoopSand = this.onFirstLoopSand.bind(this)
    eventBus.on('time/first-loop', this.onFirstLoopSand)
    this.onSaveTick = this.onSaveTick.bind(this)
    eventBus.on('save/tick', this.onSaveTick)
    // Micro-task
    this.sandFallingTick = this.sandFallingTick.bind(this)
    this.applySandFallingMoves = this.applySandFallingMoves.bind(this)
  }

  /**
   * Réinitialise #pending depuis gamestate. Appelé en début de session.
   * @param {number[]} pendingTiles — persisté (gamestate.sandfallingtiles), [] si absent
   */
  init (pendingTiles = []) {
    this.#pending.clear()
    for (const tileIndex of pendingTiles) this.#pending.add(tileIndex)
    this.#dirty = false
  }

  /**
   * Liaison EventBus : 'time/first-loop' — réarme la boucle périodique si des candidats
   * ont survécu au rechargement.
   */
  onFirstLoopSand () {
    if (this.#pending.size === 0) return
    const {priority, capacity} = MICROTASK.SAND_FALLING_TICK
    taskScheduler.enqueueOnce('sand-falling-tick', SAND_FALLING_TICK_MS, this.sandFallingTick, priority, capacity)
  }

  /**
   * Liaison EventBus : 'save/tick' — persiste #pending en gamestate (clé 'sandfallingtiles')
   * uniquement s'il a changé depuis la dernière écriture.
   */
  onSaveTick () {
    if (!this.#dirty) return
    database.setGameState('sandfallingtiles', [...this.#pending])
    this.#dirty = false
  }

  /**
   * Liaison EventBus : 'world/tile-changed'. Alimentation over-inclusive et volontairement
   * peu coûteuse : ajoute la tuile elle-même si elle devient SAND, ou les 5 tuiles pouvant
   * l'avoir comme voisin bas/bas-gauche/bas-droite (dessus, gauche, droite, dessus-gauche,
   * dessus-droite) si elle devient vide. Les faux positifs sont filtrés au traitement
   * périodique. Réarme la boucle (enqueueOnce, no-op si déjà active).
   * @param {{tileIndex: number, tileNewCode: number}} payload
   */
  onTileChangedSand ({tileIndex, tileNewCode}) {
    if (!SAND_FALLING_TRIGGER_CODES.has(tileNewCode)) return

    const W = WORLD_WIDTH
    this.#pending.add(tileIndex)
    if (tileNewCode !== NODES.SAND.code) {
      this.#pending.add(tileIndex - W)
      this.#pending.add(tileIndex - W - 1)
      this.#pending.add(tileIndex - W + 1)
      this.#pending.add(tileIndex - 1)
      this.#pending.add(tileIndex + 1)
    }
    this.#dirty = true

    const {priority, capacity} = MICROTASK.SAND_FALLING_TICK
    taskScheduler.enqueueOnce('sand-falling-tick', SAND_FALLING_TICK_MS, this.sandFallingTick, priority, capacity)
  }

  /**
   * Callback TaskScheduler (exécuté via MicroTasker) : détermination pure, sans écriture
   * monde. Reconstruit entièrement #pending — chaque tuile SAND encore valide est testée
   * (verticale puis diagonale aléatoire si les deux sont possibles) ; les tuiles stables ou
   * qui ne sont plus SAND sont abandonnées. Un Set 'claimed' évite que deux sources visent
   * la même destination dans ce passage ; le perdant est conservé dans le nouveau Set pour
   * retenter au prochain tick. Délègue l'écriture monde à applySandFallingMoves en
   * micro-tâche séparée. Réarme la boucle si le nouveau Set n'est pas vide.
   */
  sandFallingTick () {
    if (this.#pending.size > SAND_FALLING_WARN_THRESHOLD) {
      console.warn(`SandFallingSystem.sandFallingTick: #pending contient ${this.#pending.size} tuiles`)
    }

    const SAND = NODES.SAND.code
    const newPending = new Set()
    const claimed = new Set()
    const moves = []

    for (const tileIndex of this.#pending) {
      if (chunkManager.getTileAt(tileIndex) !== SAND) continue

      const destination = this.#resolveFallTarget(tileIndex, claimed)
      if (destination === -1) continue // stable
      if (destination === -2) { newPending.add(tileIndex); continue } // destination prise ce tick

      claimed.add(destination)
      moves.push({from: tileIndex, to: destination})
    }

    this.#pending = newPending
    this.#dirty = true

    if (moves.length > 0) {
      const {priority, capacity} = MICROTASK.SAND_FALLING_APPLY
      microTasker.enqueue(this.applySandFallingMoves, priority, capacity, moves)
    }

    if (this.#pending.size > 0) {
      const {priority, capacity} = MICROTASK.SAND_FALLING_TICK
      taskScheduler.enqueueOnce('sand-falling-tick', SAND_FALLING_TICK_MS, this.sandFallingTick, priority, capacity)
    }
  }

  /**
   * Détermine la destination de chute d'une tuile SAND à partir de l'état courant du monde
   * (jamais du Set 'claimed', qui ne sert qu'à départager deux sources concurrentes) : d'abord
   * verticale, puis diagonale (choix aléatoire si les deux côtés sont possibles).
   * @param {number} tileIndex
   * @param {Set<number>} claimed — destinations déjà réservées dans ce passage
   * @returns {number} index de destination, -1 si stable, -2 si bloquée par une autre tuile ce tick
   */
  #resolveFallTarget (tileIndex, claimed) {
    const W = WORLD_WIDTH
    const below = tileIndex + W

    if (SAND_FALLING_EMPTY_CODES.has(chunkManager.getTileAt(below))) {
      return claimed.has(below) ? -2 : below
    }

    const x = tileIndex & 0x3FF
    const canLeft = x > 0 && SAND_FALLING_EMPTY_CODES.has(chunkManager.getTileAt(tileIndex - 1)) && SAND_FALLING_EMPTY_CODES.has(chunkManager.getTileAt(below - 1))
    const canRight = x < W - 1 && SAND_FALLING_EMPTY_CODES.has(chunkManager.getTileAt(tileIndex + 1)) && SAND_FALLING_EMPTY_CODES.has(chunkManager.getTileAt(below + 1))
    if (!canLeft && !canRight) return -1

    const destination = (canLeft && (!canRight || seededRNG.randomGetBool())) ? below - 1 : below + 1
    return claimed.has(destination) ? -2 : destination
  }

  /**
   * Exécuté en micro-tâche séparée (MICROTASK.SAND_FALLING_APPLY). Applique tous les
   * déplacements en bloc : la destination devient SAND ; la source devient SKY si la
   * destination était SKY, SEA si la destination était SEA et la source sous SEA_LEVEL, sinon
   * SKY (tuile au-dessus SKY ou FOG) ou VOID. Le liquide déplacé par le sable n'est donc pas
   * recopié à la place de la source : sa conservation relève du LiquidSystem. Tous les
   * setTileAt() précèdent tout emit pour garantir un monde cohérent aux listeners synchrones
   * (dont onTileChangedSand lui-même, qui repeuple #pending pour les tuiles concernées). Aucune
   * vérification blockedTiles : un meuble/plante sur la destination est détruit, son propre
   * listener s'en charge.
   * @param {Array<{from: number, to: number}>} moves
   */
  applySandFallingMoves (moves) {
    const SAND = NODES.SAND.code
    const VOID = NODES.VOID.code
    const SKY = NODES.SKY.code
    const FOG = NODES.FOG.code
    const SEA = NODES.SEA.code
    const W = WORLD_WIDTH

    const changes = []

    for (const move of moves) {
      const destinationOldCode = chunkManager.getTileAt(move.to)
      let sourceNewCode = SKY
      if (destinationOldCode === SEA && (move.from >> 10) >= SEA_LEVEL) {
        sourceNewCode = SEA // sous le niveau de la mer, la cellule libérée reste dans la mer
      } else if (destinationOldCode !== SKY) {
        const aboveCode = chunkManager.getTileAt(move.from - W)
        sourceNewCode = (aboveCode === SKY || aboveCode === FOG) ? SKY : VOID
      }

      chunkManager.setTileAt(move.from, sourceNewCode)
      chunkManager.setTileAt(move.to, SAND)

      changes.push({tileIndex: move.from, tileOldCode: SAND, tileNewCode: sourceNewCode})
      changes.push({tileIndex: move.to, tileOldCode: destinationOldCode, tileNewCode: SAND})
    }

    for (const change of changes) eventBus.emit('world/tile-changed', change)
  }
}
export const sandFallingSystem = new SandFallingSystem()

/* ====================================================================================================
   LIQUID SYSTEM
   ==================================================================================================== */

const LIQUID_OPEN_CODES = new Set([NODES.SKY.code, NODES.VOID.code]) // cellules ouvertes pouvant former le rim
const LIQUID_NEIGHBOR_OFFSETS = [-1, 1, -WORLD_WIDTH, WORLD_WIDTH] // voisins 4-connexes (gauche, droite, haut, bas)
const LIQUID_ABOVE_OFFSETS = [-WORLD_WIDTH, -WORLD_WIDTH - 1, -WORLD_WIDTH + 1] // cellules d'où un sable a pu tomber (dessus, diagonales hautes)
const LIQUID_DROP_ID = 0xFFFF // valeur de liquidBodyId sur une tuile occupée par une goutte
const LIQUID_DROP_CAPACITY = 1024 // nombre maximum de gouttes simultanées
const LIQUID_TICK_IDS = {[NODES.WATER.code]: 'liquid-tick-water', [NODES.HONEY.code]: 'liquid-tick-honey', [NODES.SAP.code]: 'liquid-tick-sap', [NODES.SEA.code]: 'liquid-tick-sea'} // id TaskScheduler de la tâche de chaque nature
const LIQUID_SEA_VOLUME = 0x40000000 // volume sentinelle d'un body SEA (infini : rangée haute toujours pleine, jamais vidée)
const LIQUID_SEA_BORDER_X0 = 1 // colonne de SEA au contact du DEEPSEA gauche (x = 0)
const LIQUID_SEA_BORDER_X1 = WORLD_WIDTH - 2 // colonne de SEA au contact du DEEPSEA droit (x = WORLD_WIDTH - 1)
const LIQUID_ACTION_SPREAD = 1 // étalement — rangs d'action à hauteur égale (le plus grand l'emporte)
const LIQUID_ACTION_OVERFLOW = 2 // débordement
const LIQUID_ACTION_FILL = 3 // remplissage
const LIQUID_ACTION_LEAK = 4 // fuite
const LIQUID_DEBUG_COLORS = ['#ff00ff', '#00ffff', '#ffff00', '#ff8000', '#00ff00', '#8000ff', '#ff0080', '#0080ff'] // couleur des carrés de debug, indexée par (id & 7)

/**
 * Composante 4-connexe de tuiles liquides de même nature (WATER, HONEY ou SAP).
 * Ordre des champs fixe (monomorphisme V8).
 */
class LiquidBody {
  /**
   * Crée un body vide portant son identifiant et sa nature.
   * @param {number} id — identifiant (1..65534), valeur de liquidBodyId sur ses tuiles
   * @param {number} nature — NODES.XXX.code
   * @param {number} refIndex — index de la tuile de référence (la plus basse)
   * @param {number} volume — volume en 1/16 de tuile
   */
  constructor (id, nature, refIndex, volume) {
    this.id = id
    this.nature = nature
    this.refIndex = refIndex
    this.volume = volume
    this.tileCount = 0 // nombre de tuiles du body
    this.topRow = 0 // y de la rangée la plus haute
    this.topCount = 0 // nombre de tuiles sur topRow
    this.xMin = 0 // rectangle englobant (tuiles)
    this.yMin = 0
    this.xMax = 0
    this.yMax = 0
    this.rim = new Set() // Set<tileIndex> — cellules SKY/VOID (ou occupées par une goutte) adjacentes au body
    this.unstableSlot = -1 // position dans la liste des instables, -1 si stable
    this.isSea = false // true pour un body SEA (volume infini, non persisté)
  }
}

class LiquidSystem {
  #liquidBodyId = new Uint16Array(WORLD_WIDTH * WORLD_HEIGHT) // id du body de chaque tuile : 0 = aucun
  #bodies = [null] // Array<LiquidBody|null> indexé par id — l'index 0 n'est jamais utilisé
  #freeIds = [] // ids libérés, réutilisés en priorité
  #queue = new Int32Array(WORLD_WIDTH * WORLD_HEIGHT) // file BFS partagée (flood-fill)
  #splitMark = new Int32Array(WORLD_WIDTH * WORLD_HEIGHT) // séparation : étiquette + 1 de la graine ayant atteint la tuile, 0 = non visitée
  #dirty = false // true si la table des bodies a changé depuis la dernière écriture gamestate
  #changes = [] // Array<{tileIndex, tileOldCode, tileNewCode}> — mutations en attente d'émission 'world/tile-changed'

  #dropIndex = new Int32Array(LIQUID_DROP_CAPACITY) // index de la tuile occupée par chaque goutte
  #dropVolume = new Uint8Array(LIQUID_DROP_CAPACITY) // volume de chaque goutte (1..16)
  #dropNature = new Uint8Array(LIQUID_DROP_CAPACITY) // nature de chaque goutte (NODES.XXX.code)
  #dropCount = 0 // nombre de gouttes actives (slots 0..#dropCount-1)
  #dropsDirty = false // true si les gouttes ont changé depuis la dernière écriture gamestate

  #unstable = [] // Array<LiquidBody> — bodies instables, body.unstableSlot = position dans ce tableau
  #applying = false // true pendant l'émission des 'world/tile-changed' du LiquidSystem (ignorés par son propre listener)

  constructor () {
    // eventBus
    this.onSaveTick = this.onSaveTick.bind(this)
    eventBus.on('save/tick', this.onSaveTick)
    this.onFirstLoopLiquid = this.onFirstLoopLiquid.bind(this)
    eventBus.on('time/first-loop', this.onFirstLoopLiquid)
    this.onTileChangedLiquid = this.onTileChangedLiquid.bind(this)
    eventBus.on('world/tile-changed', this.onTileChangedLiquid)
    // Micro-task
    this.liquidTick = this.liquidTick.bind(this)
  }

  /**
   * Restaure les gouttes (liquidBodyId = LIQUID_DROP_ID, niveau), puis reconstruit tous les
   * LiquidBodies depuis la table persistée : flood-fill depuis chaque tuile de référence
   * (liquidBodyId, nombre de tuiles, rectangle, topRow, rim, tuiles des gouttes exclues), puis
   * pose du niveau des tuiles de topRow dans chunkManager. Reconstruit enfin les bodies SEA
   * (composantes de SEA touchant les colonnes x = 1 et x = WORLD_WIDTH − 2, au contact du
   * DEEPSEA), de volume infini. Tous les bodies sont placés dans la liste des
   * instables (la première passe écarte les stables). Requiert un chunkManager déjà initialisé.
   * @param {number[]} liquidBodies — persisté (gamestate.liquidbodies) : [ref0, volume0, ref1, volume1, …]
   * @param {number[]} liquidDrops — persisté (gamestate.liquiddrops) : [index0, volume0, index1, volume1, …]
   */
  init (liquidBodies = [], liquidDrops = []) {
    const t0 = performance.now()
    this.#liquidBodyId.fill(0)
    this.#bodies.length = 1
    this.#freeIds.length = 0
    this.#dirty = false
    this.#dropCount = 0
    this.#dropsDirty = false
    this.#unstable.length = 0

    for (let i = 0; i < liquidDrops.length; i += 2) {
      const tileIndex = liquidDrops[i]
      const volume = liquidDrops[i + 1]
      const slot = this.#dropCount
      this.#dropIndex[slot] = tileIndex
      this.#dropVolume[slot] = volume
      this.#dropNature[slot] = chunkManager.getTileAt(tileIndex)
      this.#dropCount++
      this.#liquidBodyId[tileIndex] = LIQUID_DROP_ID
      chunkManager.setLiquidLevelAt(tileIndex, volume === 16 ? 0 : volume)
    }

    let tiles = 0
    for (let i = 0; i < liquidBodies.length; i += 2) {
      const body = this.#createBody(liquidBodies[i], liquidBodies[i + 1])
      this.#floodFill(body)
      this.#applyTopRowLevel(body)
      body.unstableSlot = this.#unstable.length
      this.#unstable.push(body)
      tiles += body.tileCount
    }

    // mers : composantes de SEA au contact des colonnes de DEEPSEA (non persistées)
    const SEA = NODES.SEA.code
    const borders = [LIQUID_SEA_BORDER_X0, LIQUID_SEA_BORDER_X1]
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (const x of borders) {
        const idx = (y << 10) | x
        if (this.#liquidBodyId[idx] !== 0 || chunkManager.getTileAt(idx) !== SEA) continue
        const sea = this.#createBody(idx, LIQUID_SEA_VOLUME)
        sea.isSea = true
        this.#floodFill(sea)
        sea.unstableSlot = this.#unstable.length
        this.#unstable.push(sea)
      }
    }

    if (IS_DEV) console.log(`[LiquidSystem] ${this.#bodies.length - 1} liquid bodies, ${tiles} tuiles, ${this.#dropCount} gouttes, ${(performance.now() - t0).toFixed(1)} ms`)
  }

  /**
   * Liaison EventBus : 'save/tick' — persiste la table des bodies hors SEA en gamestate (clé
   * 'liquidbodies', tableau plat [ref, volume, …]) uniquement si elle a changé depuis la
   * dernière écriture.
   */
  onSaveTick () {
    if (this.#dirty) {
      const table = []
      for (const body of this.#bodies) {
        if (body === null || body.isSea) continue
        table.push(body.refIndex, body.volume)
      }
      database.setGameState('liquidbodies', table)
      this.#dirty = false
    }
    if (this.#dropsDirty) {
      const drops = []
      for (let i = 0; i < this.#dropCount; i++) drops.push(this.#dropIndex[i], this.#dropVolume[i])
      database.setGameState('liquiddrops', drops)
      this.#dropsDirty = false
    }
  }

  /**
 * Liaison EventBus : 'time/first-loop' — réarme la tâche de chaque nature ayant des gouttes
 * ou des bodies instables au chargement.
 */
  onFirstLoopLiquid () {
    for (let i = 0; i < this.#dropCount; i++) this.#scheduleTick(this.#dropNature[i])
    for (const body of this.#unstable) this.#scheduleTick(body.nature)
  }

  /**
   * Liaison EventBus : 'world/tile-changed' (hors mutations du LiquidSystem lui-même). Une tuile
   * de goutte ou de body remplacée par autre chose que son liquide est d'abord retirée du système
   * (voir #onDropReplaced et #onBodyTileReplaced) ; une tuile SEA apparue de l'extérieur (sable
   * tombant dans la mer) rejoint le body SEA voisin. Ensuite, si la
   * tuile devient SKY/VOID, elle entre dans le rim des bodies voisins, qui deviennent instables ;
   * sinon elle sort de leur rim. Si la cellule au-dessus est ouverte, les bodies qui la bordent
   * deviennent instables (elle a gagné ou perdu un support).
   * @param {{tileIndex: number, tileNewCode: number}} payload
   */
  onTileChangedLiquid ({tileIndex, tileNewCode}) {
    if (this.#applying) return
    const ids = this.#liquidBodyId
    const open = LIQUID_OPEN_CODES.has(tileNewCode)

    // une tuile de goutte ou de body remplacée de l'extérieur (bloc posé, sable)
    const ownId = ids[tileIndex]
    if (ownId === LIQUID_DROP_ID) {
      this.#onDropReplaced(tileIndex)
    } else if (ownId !== 0 && tileNewCode !== this.#bodies[ownId].nature) {
      this.#onBodyTileReplaced(this.#bodies[ownId], tileIndex)
    } else if (ownId === 0 && tileNewCode === NODES.SEA.code) {
      this.#adoptSeaTile(tileIndex)
    }

    for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
      const id = ids[tileIndex + offset]
      if (id === 0 || id === LIQUID_DROP_ID) continue
      const body = this.#bodies[id]
      if (open) {
        body.rim.add(tileIndex)
        this.#markUnstable(body)
      } else {
        body.rim.delete(tileIndex)
      }
    }

    const above = tileIndex - WORLD_WIDTH
    if (!LIQUID_OPEN_CODES.has(chunkManager.getTileAt(above))) return
    for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
      const id = ids[above + offset]
      if (id === 0 || id === LIQUID_DROP_ID) continue
      this.#markUnstable(this.#bodies[id])
    }
  }

  /**
 * Crée une goutte sur une cellule ouverte (SKY/VOID) : la tuile prend le code de la nature,
 * son niveau celui du volume. Arme la tâche de la nature. Émet 'world/tile-changed'.
 * L'appelant garantit que la cellule est ouverte.
 * @param {number} tileIndex
 * @param {number} nature — NODES.WATER.code, NODES.HONEY.code ou NODES.SAP.code
 * @param {number} volume — 1..16
 * @returns {boolean} false (rien n'est modifié) si le pool de gouttes est plein
 */
  createDrop (tileIndex, nature, volume) {
    this.#changes.length = 0
    if (!this.#spawnDrop(tileIndex, nature, volume)) return false
    this.#scheduleTick(nature)
    this.#emitChanges()
    return true
  }

  /**
   * Callback TaskScheduler (exécuté via MicroTasker), cadencé par la viscosité de la nature :
   * fait avancer d'un pas chaque goutte de cette nature, puis applique au plus une action
   * d'écoulement à chaque body instable de cette nature ; un body sans action possible sort de
   * la liste des instables. Parcours décroissants, pour que les suppressions par swap ne sautent
   * aucun élément. Toutes les mutations précèdent l'émission des 'world/tile-changed'. Réarme la
   * tâche s'il reste des gouttes ou des bodies instables de la nature.
   * @param {number} nature — NODES.XXX.code
   */
  liquidTick (nature) {
    this.#changes.length = 0
    for (let i = this.#dropCount - 1; i >= 0; i--) {
      if (this.#dropNature[i] === nature) this.#stepDrop(i)
    }
    for (let i = this.#unstable.length - 1; i >= 0; i--) {
      if (i >= this.#unstable.length) continue
      const body = this.#unstable[i]
      if (body.nature === nature && !this.#stepBody(body)) this.#markStable(body)
    }
    this.#emitChanges()
    if (this.#hasWork(nature)) this.#scheduleTick(nature)
  }

  /**
   * Ajoute du volume au body contenant la tuile, appliqué instantanément à la surface : tant
   * que la rangée haute déborde (rowVol > 16 × topCount), une nouvelle rangée est créée
   * au-dessus, sur les cellules SKY/VOID situées directement au-dessus des tuiles de topRow.
   * Si aucune cellule n'est disponible, le body est plein et l'excédent est refusé. Toutes les
   * mutations précèdent l'émission des 'world/tile-changed'.
   * @param {number} tileIndex — une tuile quelconque du body
   * @param {number} amount — volume à ajouter, en 1/16 de tuile (> 0)
   * @returns {number} volume réellement ajouté (0 si la tuile n'appartient à aucun body ou est
   *   une goutte ; amount, sans effet, pour un body SEA)
   */
  addVolume (tileIndex, amount) {
    const id = this.#liquidBodyId[tileIndex]
    if (id === 0 || id === LIQUID_DROP_ID) return 0
    if (this.#bodies[id].isSea) return amount // volume infini : absorbé sans effet
    this.#changes.length = 0
    const accepted = this.#addVolumeToBody(this.#bodies[id], amount)
    this.#emitChanges()
    return accepted
  }

  /**
   * Retire du volume au body contenant la tuile, appliqué instantanément à la surface : tant
   * que la rangée haute est vide (rowVol ≤ 0), ses tuiles redeviennent SKY (tuile au-dessus SKY)
   * ou VOID et la rangée inférieure devient topRow. Un body dont toutes les tuiles ont disparu
   * est supprimé. Toutes les mutations précèdent l'émission des 'world/tile-changed'.
   * @param {number} tileIndex — une tuile quelconque du body
   * @param {number} amount — volume à retirer, en 1/16 de tuile (> 0)
   * @returns {boolean} false (rien n'est modifié) si la tuile n'appartient à aucun body (ou est
   *   une goutte) ou si le volume du body est inférieur à amount ; true sans effet pour un body SEA
   */
  removeVolume (tileIndex, amount) {
    const id = this.#liquidBodyId[tileIndex]
    if (id === 0 || id === LIQUID_DROP_ID) return false
    const body = this.#bodies[id]
    if (body.isSea) return true // volume infini : inépuisable
    if (body.volume < amount) return false
    this.#changes.length = 0

    body.volume -= amount
    if (this.#settleTop(body)) this.#markUnstable(body)
    this.#dirty = true
    this.#emitChanges()
    return true
  }

  /**
   * Alloue un identifiant (réutilise un id libéré si possible) et enregistre un nouveau body
   * dont la nature est le code de sa tuile de référence.
   * @param {number} refIndex
   * @param {number} volume
   * @returns {LiquidBody}
   */
  #createBody (refIndex, volume) {
    const id = this.#freeIds.length > 0 ? this.#freeIds.pop() : this.#bodies.length
    const body = new LiquidBody(id, chunkManager.getTileAt(refIndex), refIndex, volume)
    this.#bodies[id] = body
    return body
  }

  /**
   * Flood-fill 4-connexe depuis la tuile de référence sur les tuiles de même nature : marque
   * liquidBodyId, calcule tileCount, le rectangle englobant, topRow/topCount, et collecte le
   * rim (voisins SKY/VOID ou occupés par une goutte). Les tuiles de gouttes (LIQUID_DROP_ID) ne
   * font pas partie du body. Pas de bounds checking (ghost cells).
   * @param {LiquidBody} body
   */
  #floodFill (body) {
    const ids = this.#liquidBodyId
    const queue = this.#queue
    const {id, nature, refIndex, rim} = body

    ids[refIndex] = id
    queue[0] = refIndex
    let head = 0
    let tail = 1
    let xMin = refIndex & 0x3FF
    let xMax = xMin
    let yMin = refIndex >> 10
    let yMax = yMin
    let topCount = 0

    while (head < tail) {
      const idx = queue[head]
      head++

      const x = idx & 0x3FF
      const y = idx >> 10
      if (x < xMin) xMin = x
      if (x > xMax) xMax = x
      if (y > yMax) yMax = y
      if (y < yMin) {
        yMin = y
        topCount = 1
      } else if (y === yMin) {
        topCount++
      }

      for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
        const nIdx = idx + offset
        if (ids[nIdx] === LIQUID_DROP_ID) { // goutte : cellule momentanément occupée, membre du rim
          rim.add(nIdx)
          continue
        }
        if (ids[nIdx] !== 0) continue // déjà dans le body
        const code = chunkManager.getTileAt(nIdx)
        if (code === nature) {
          ids[nIdx] = id
          queue[tail] = nIdx
          tail++
        } else if (LIQUID_OPEN_CODES.has(code)) {
          rim.add(nIdx)
        }
      }
    }

    body.tileCount = tail
    body.topRow = yMin
    body.topCount = topCount
    body.xMin = xMin
    body.yMin = yMin
    body.xMax = xMax
    body.yMax = yMax
  }

  /**
   * Répartit le volume de la rangée haute entre ses tuiles et pose leur niveau dans
   * chunkManager : rowVol = volume − 16 × (tileCount − topCount), niveau = floor(rowVol /
   * topCount) borné à [1..16], 16 étant noté 0 (pleine). Le reste de la division n'est pas
   * affiché ; une rangée dont rowVol < topCount est affichée à 1/16.
   * @param {LiquidBody} body
   */
  #applyTopRowLevel (body) {
    const {id, volume, tileCount, topRow, topCount, xMin, xMax} = body
    const rowVol = volume - ((tileCount - topCount) << 4)
    let level = (rowVol / topCount) | 0
    if (level === 0) level = 1
    else if (level >= 16) level = 0

    let idx = (topRow << 10) | xMin
    const end = (topRow << 10) | xMax
    while (idx <= end) {
      if (this.#liquidBodyId[idx] === id) chunkManager.setLiquidLevelAt(idx, level)
      idx++
    }
  }

  /**
   * Ajoute du volume à un body (sans émission) : tant que la rangée haute déborde, crée une
   * rangée au-dessus ; si aucune cellule n'est disponible, l'excédent est refusé. Pose le niveau
   * de topRow et rend le body instable ; fusionne avec les bodies de même nature touchés par
   * les nouvelles rangées. Empile les mutations dans #changes.
   * @param {LiquidBody} body
   * @param {number} amount — volume à ajouter, en 1/16 de tuile (> 0)
   * @returns {number} volume réellement ajouté
   */
  #addVolumeToBody (body, amount) {
    const first = this.#changes.length
    body.volume += amount
    let accepted = amount
    while (!body.isSea && body.volume - ((body.tileCount - body.topCount) << 4) > (body.topCount << 4)) {
      if (this.#addTopRow(body)) continue
      const overflow = body.volume - (body.tileCount << 4)
      body.volume -= overflow
      accepted -= overflow
      break
    }

    this.#applyTopRowLevel(body)
    if (accepted > 0) this.#dirty = true
    this.#markUnstable(body)
    this.#mergeTouching(body, first)
    return accepted
  }

  /**
   * Fait avancer une goutte d'un pas, dans l'ordre : chute verticale sur une cellule ouverte ;
   * fusion avec un body de même nature 4-adjacent (la cellule est libérée puis le volume ajouté
   * au body ; une goutte WATER au contact de la SEA y disparaît) ; attente si la cellule du
   * dessous, un côté ou une diagonale basse est occupé par une autre goutte ;
   * chute diagonale (côté et diagonale basse ouverts, tirage aléatoire si
   * les deux côtés sont possibles) ; sinon atterrissage : la goutte devient un body d'une tuile,
   * instable. La chute passe avant la fusion : une goutte issue d'une fuite ou d'un débordement
   * (toujours au-dessus du vide) quitte le body au lieu d'y retourner. Les autres liquides et la
   * SEA sont des obstacles.
   * @param {number} slot — slot de la goutte dans le pool
   * @returns {boolean} true si la goutte existe encore après ce pas
   */
  #stepDrop (slot) {
    const W = WORLD_WIDTH
    const ids = this.#liquidBodyId
    const idx = this.#dropIndex[slot]
    const volume = this.#dropVolume[slot]
    const nature = this.#dropNature[slot]

    // 1. chute verticale
    const below = idx + W
    if (LIQUID_OPEN_CODES.has(chunkManager.getTileAt(below))) {
      this.#moveDrop(slot, below)
      return true
    }

    // 2. contact avec un body de même nature : fusion (une goutte WATER est absorbée par la SEA)
    for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
      const id = ids[idx + offset]
      if (id === 0 || id === LIQUID_DROP_ID) continue
      const other = this.#bodies[id]
      if (other.isSea && nature === NODES.WATER.code) {
        this.#clearCell(idx)
        this.#removeDropSlot(slot)
        return false
      }
      if (other.nature !== nature) continue
      this.#clearCell(idx)
      this.#removeDropSlot(slot)
      this.#addVolumeToBody(other, volume)
      return false
    }

    // 3. attente derrière une autre goutte
    if (ids[below] === LIQUID_DROP_ID || ids[below - 1] === LIQUID_DROP_ID || ids[below + 1] === LIQUID_DROP_ID ||
        ids[idx - 1] === LIQUID_DROP_ID || ids[idx + 1] === LIQUID_DROP_ID) return true

    // 4. chute diagonale
    const canLeft = LIQUID_OPEN_CODES.has(chunkManager.getTileAt(idx - 1)) && LIQUID_OPEN_CODES.has(chunkManager.getTileAt(below - 1))
    const canRight = LIQUID_OPEN_CODES.has(chunkManager.getTileAt(idx + 1)) && LIQUID_OPEN_CODES.has(chunkManager.getTileAt(below + 1))
    if (canLeft || canRight) {
      this.#moveDrop(slot, (canLeft && (!canRight || seededRNG.randomGetBool())) ? below - 1 : below + 1)
      return true
    }

    // 5. atterrissage : body d'une tuile
    this.#removeDropSlot(slot)
    ids[idx] = 0
    const body = this.#createBody(idx, volume)
    this.#floodFill(body)
    this.#applyTopRowLevel(body)
    this.#markUnstable(body)
    this.#dirty = true
    return false
  }

  /**
   * Action d'écoulement d'un body SEA (volume infini) : la cellule ouverte la plus basse de son
   * rim, au niveau de SEA_LEVEL ou plus bas, rejoint la mer (soutenue ou non : la mer inonde
   * sans limite, une cellule par pas) ; fusion éventuelle avec les bodies touchés. Les cellules
   * au-dessus de SEA_LEVEL sont ignorées.
   * @param {LiquidBody} body — body SEA
   * @returns {boolean} false si aucune cellule à inonder et aucune goutte n'occupe le rim (stable)
   */
  #stepSea (body) {
    let best = -1
    let bestY = -1
    let waiting = false
    for (const cell of body.rim) {
      if (!LIQUID_OPEN_CODES.has(chunkManager.getTileAt(cell))) {
        if (this.#liquidBodyId[cell] === LIQUID_DROP_ID) waiting = true
        continue
      }
      const y = cell >> 10
      if (y < SEA_LEVEL || y <= bestY) continue
      bestY = y
      best = cell
    }
    if (best === -1) return waiting
    const first = this.#changes.length
    this.#addTileToBody(body, best)
    this.#mergeTouching(body, first)
    return true
  }

  /**
   * Absorbe un body WATER dans un body SEA : ses tuiles situées au niveau de SEA_LEVEL ou plus
   * bas deviennent SEA (conversion sans 'world/tile-changed', exception documentée), celles
   * situées au-dessus s'écoulent dans la mer (SKY si la tuile au-dessus est SKY, VOID sinon,
   * avec 'world/tile-changed'). Le volume du body WATER est perdu dans le volume infini de la
   * mer ; son rim rejoint celui de la mer, qui devient instable.
   * @param {LiquidBody} sea
   * @param {LiquidBody} water
   * @returns {LiquidBody} le body SEA
   */
  #mergeWithSea (sea, water) {
    const SEA = NODES.SEA.code
    const SKY = NODES.SKY.code
    const VOID = NODES.VOID.code
    const ids = this.#liquidBodyId
    const queue = this.#queue

    this.#clearTopRowLevel(water)

    // parcours des tuiles du body WATER (réétiquetées SEA au passage)
    ids[water.refIndex] = sea.id
    queue[0] = water.refIndex
    let head = 0
    let tail = 1
    while (head < tail) {
      const idx = queue[head]
      head++
      for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
        const n = idx + offset
        if (ids[n] !== water.id) continue
        ids[n] = sea.id
        queue[tail] = n
        tail++
      }
    }

    // conversion sous le niveau de la mer, écoulement au-dessus (de haut en bas pour SKY/VOID)
    const drained = []
    for (let i = 0; i < tail; i++) {
      const idx = queue[i]
      const y = idx >> 10
      if (y < SEA_LEVEL) {
        drained.push(idx)
        continue
      }
      chunkManager.setTileAt(idx, SEA)
      sea.tileCount++
      if (y === sea.topRow) sea.topCount++
      const x = idx & 0x3FF
      if (x < sea.xMin) sea.xMin = x
      if (x > sea.xMax) sea.xMax = x
      if (y > sea.yMax) sea.yMax = y
    }
    const sorted = Int32Array.from(drained).sort()
    for (const idx of sorted) {
      ids[idx] = 0
      const tileNewCode = chunkManager.getTileAt(idx - WORLD_WIDTH) === SKY ? SKY : VOID
      chunkManager.setTileAt(idx, tileNewCode)
      this.#changes.push({tileIndex: idx, tileOldCode: water.nature, tileNewCode})
    }

    // rim : celui du body WATER rejoint la mer ; nettoyage des jonctions et des cellules libérées
    for (const cell of water.rim) {
      if (ids[cell] !== sea.id) sea.rim.add(cell)
    }
    for (const idx of sorted) {
      if (this.#touchesBody(idx, sea.id)) sea.rim.add(idx)
      for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
        const n = idx + offset
        if (sea.rim.has(n) && !this.#touchesBody(n, sea.id)) sea.rim.delete(n)
      }
    }
    for (const cell of sea.rim) {
      if (ids[cell] === sea.id) sea.rim.delete(cell)
    }

    this.#deleteBody(water)
    this.#markUnstable(sea)
    this.#dirty = true
    return sea
  }

  /**
   * Intègre au body SEA voisin une tuile devenue SEA de l'extérieur (sans nouvelle mutation :
   * la tuile porte déjà le code SEA) : liquidBodyId, tileCount, topCount, rim ; puis absorbe les
   * bodies WATER et fusionne les autres bodies SEA qu'elle touche. Émet les mutations éventuelles.
   * @param {number} tileIndex
   */
  #adoptSeaTile (tileIndex) {
    const ids = this.#liquidBodyId
    for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
      const id = ids[tileIndex + offset]
      if (id === 0 || id === LIQUID_DROP_ID || !this.#bodies[id].isSea) continue
      let sea = this.#bodies[id]
      ids[tileIndex] = sea.id
      sea.tileCount++
      if ((tileIndex >> 10) === sea.topRow) sea.topCount++
      sea.rim.delete(tileIndex)
      for (const o of LIQUID_NEIGHBOR_OFFSETS) {
        const n = tileIndex + o
        if (LIQUID_OPEN_CODES.has(chunkManager.getTileAt(n)) || ids[n] === LIQUID_DROP_ID) sea.rim.add(n)
      }

      // jonction avec un body WATER (absorbé) ou une autre mer (fusionnée)
      this.#changes.length = 0
      for (const o of LIQUID_NEIGHBOR_OFFSETS) {
        const other = ids[tileIndex + o]
        if (other === 0 || other === LIQUID_DROP_ID || other === sea.id) continue
        const body = this.#bodies[other]
        if (body.isSea) sea = this.#mergeBodies(sea, body)
        else if (body.nature === NODES.WATER.code) sea = this.#mergeWithSea(sea, body)
      }

      this.#markUnstable(sea)
      this.#emitChanges()
      return
    }
  }

  /**
   * Applique au body l'action d'écoulement prioritaire, choisie parmi les cellules ouvertes de
   * son rim situées au niveau de topRow ou plus bas (soutenue = cellule du dessous non ouverte) :
   * - plus bas que topRow, soutenue : remplissage (la cellule rejoint le body, volume inchangé) ;
   * - plus bas que topRow, non soutenue : fuite (goutte de min(16, volume)) ;
   * - sur topRow, non soutenue : débordement (goutte de min(16, rowVol)) ;
   * - sur topRow, soutenue : étalement, si rowVol ≥ topCount + 1 (chaque tuile garde ≥ 1/16).
   * La cellule la plus basse l'emporte ; à hauteur égale : fuite > remplissage > débordement >
   * étalement. Un body de volume ≤ 16 qui fuit part entièrement en une goutte (règle du film).
   * Une tuile ajoutée par remplissage ou étalement qui touche un body de même nature provoque
   * leur fusion.
   * La surface est ensuite recalculée (rangées vidées supprimées, body vide supprimé). Une
   * cellule du rim occupée par une goutte est ignorée, mais maintient le body instable.
   * @param {LiquidBody} body
   * @returns {boolean} false si aucune action n'est possible et aucune goutte n'occupe le rim (body stable)
   */
  #stepBody (body) {
    if (body.isSea) return this.#stepSea(body)
    const W = WORLD_WIDTH
    const {topRow, topCount, rim} = body
    const rowVol = body.volume - ((body.tileCount - topCount) << 4)
    const canSpread = rowVol >= topCount + 1

    let best = -1
    let bestScore = -1
    let waiting = false // une cellule du rim est momentanément occupée par une goutte
    for (const cell of rim) {
      if (!LIQUID_OPEN_CODES.has(chunkManager.getTileAt(cell))) {
        if (this.#liquidBodyId[cell] === LIQUID_DROP_ID) waiting = true
        continue
      }
      const y = cell >> 10
      if (y < topRow) continue
      const supported = !LIQUID_OPEN_CODES.has(chunkManager.getTileAt(cell + W))
      let rank
      if (y > topRow) rank = supported ? LIQUID_ACTION_FILL : LIQUID_ACTION_LEAK
      else if (!supported) rank = LIQUID_ACTION_OVERFLOW
      else if (canSpread) rank = LIQUID_ACTION_SPREAD
      else continue
      const score = (y << 3) | rank
      if (score > bestScore) {
        bestScore = score
        best = cell
      }
    }
    if (best === -1) return waiting // body maintenu instable tant qu'une goutte occupe son rim

    switch (bestScore & 7) {
      case LIQUID_ACTION_LEAK: {
        const amount = body.volume < 16 ? body.volume : 16
        if (!this.#spawnDrop(best, body.nature, amount)) return true // pool plein : nouvel essai au prochain pas
        this.#scheduleTick(body.nature)
        body.volume -= amount
        this.#settleTop(body)
        break
      }
      case LIQUID_ACTION_FILL: {
        const first = this.#changes.length
        this.#addTileToBody(body, best)
        this.#settleTop(this.#mergeTouching(body, first))
        break
      }
      case LIQUID_ACTION_OVERFLOW: {
        const amount = rowVol < 16 ? rowVol : 16
        if (!this.#spawnDrop(best, body.nature, amount)) return true
        this.#scheduleTick(body.nature)
        body.volume -= amount
        this.#settleTop(body)
        break
      }
      default: { // LIQUID_ACTION_SPREAD
        const first = this.#changes.length
        this.#addTileToBody(body, best)
        this.#applyTopRowLevel(body)
        this.#mergeTouching(body, first)
      }
    }
    this.#dirty = true
    return true
  }

  /**
   * Ajoute une cellule ouverte au body : code de la nature, liquidBodyId, rim (la cellule en
   * sort, ses voisins ouverts ou occupés par une goutte y entrent), tileCount, rectangle,
   * topCount si elle est sur topRow, tuile de référence si elle est plus basse (ou aussi basse
   * et plus à gauche). Volume inchangé ; empile la mutation dans #changes.
   * @param {LiquidBody} body
   * @param {number} tileIndex — cellule SKY/VOID adjacente au body
   */
  #addTileToBody (body, tileIndex) {
    const tileOldCode = chunkManager.getTileAt(tileIndex)
    chunkManager.setTileAt(tileIndex, body.nature)
    this.#liquidBodyId[tileIndex] = body.id
    this.#changes.push({tileIndex, tileOldCode, tileNewCode: body.nature})

    body.rim.delete(tileIndex)
    for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
      const n = tileIndex + offset
      if (LIQUID_OPEN_CODES.has(chunkManager.getTileAt(n)) || this.#liquidBodyId[n] === LIQUID_DROP_ID) body.rim.add(n)
    }

    body.tileCount++
    const x = tileIndex & 0x3FF
    const y = tileIndex >> 10
    if (x < body.xMin) body.xMin = x
    if (x > body.xMax) body.xMax = x
    if (y > body.yMax) body.yMax = y
    if (y === body.topRow) body.topCount++
    const refY = body.refIndex >> 10
    if (y > refY || (y === refY && x < (body.refIndex & 0x3FF))) body.refIndex = tileIndex
  }

  /**
   * Retire du body une tuile remplacée de l'extérieur (bloc posé, sable), à volume constant :
   * la tuile sort du body (niveau remis à 0, rim, référence, topRow) ; si une cellule ouverte
   * juste au-dessus (ou en diagonale haute) est sous la surface et touche le body, elle est
   * aussitôt intégrée au body (cellule quittée par un sable qui traverse le liquide : ni trou
   * ni variation de niveau) ; sinon la surface monte (nouvelles rangées, excédent détruit si le
   * body ne peut pas monter). Un body réduit à zéro tuile devient une goutte sur une cellule
   * ouverte au-dessus, ou disparaît. Puis séparation éventuelle et émission des mutations. Pour
   * un body SEA, seule la séparation éventuelle est traitée (volume infini).
   * @param {LiquidBody} body
   * @param {number} tileIndex — tuile du body dont le code vient de changer
   */
  #onBodyTileReplaced (body, tileIndex) {
    const ids = this.#liquidBodyId
    this.#changes.length = 0

    ids[tileIndex] = 0
    chunkManager.setLiquidLevelAt(tileIndex, 0)
    body.tileCount--
    if ((tileIndex >> 10) === body.topRow) body.topCount--
    for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
      const n = tileIndex + offset
      if (body.rim.has(n) && !this.#touchesBody(n, body.id)) body.rim.delete(n)
    }

    // SEA : volume infini, la surface ne bouge pas ; séparation éventuelle seulement
    if (body.isSea) {
      if (ids[body.refIndex] !== body.id) this.#findReference(body)
      this.#splitDetached(body, [tileIndex])
      this.#markUnstable(body)
      this.#emitChanges()
      return
    }

    // body vidé : son volume repart en goutte au-dessus (ou disparaît)
    if (body.tileCount === 0) {
      const volume = body.volume < 16 ? body.volume : 16
      this.#deleteBody(body)
      for (const offset of LIQUID_ABOVE_OFFSETS) {
        const c = tileIndex + offset
        if (!LIQUID_OPEN_CODES.has(chunkManager.getTileAt(c))) continue
        if (this.#spawnDrop(c, body.nature, volume)) this.#scheduleTick(body.nature)
        break
      }
      this.#dirty = true
      this.#emitChanges()
      return
    }

    // cellule quittée par le sable, sous la surface : intégrée aussitôt
    const first = this.#changes.length
    for (const offset of LIQUID_ABOVE_OFFSETS) {
      const c = tileIndex + offset
      if ((c >> 10) <= body.topRow || !LIQUID_OPEN_CODES.has(chunkManager.getTileAt(c)) || !this.#touchesBody(c, body.id)) continue
      this.#addTileToBody(body, c)
      break
    }

    if (ids[body.refIndex] !== body.id) this.#findReference(body)
    if (body.topCount === 0) this.#lowerTopRow(body)
    body = this.#raiseSurface(body, first)
    this.#splitDetached(body, [tileIndex])
    this.#applyTopRowLevel(body)
    this.#markUnstable(body)
    this.#dirty = true
    this.#emitChanges()
  }

  /**
   * Monte la surface d'un body dont la rangée haute déborde (rowVol > 16 × topCount) en créant
   * des rangées au-dessus ; si aucune cellule n'est disponible, l'excédent de volume est détruit.
   * Fusionne avec les bodies de même nature touchés par les tuiles ajoutées depuis la mutation
   * d'indice first de #changes. Sans effet sur la surface d'un body SEA. Empile les mutations dans #changes.
   * @param {LiquidBody} body
   * @param {number} first — indice, dans #changes, de la première mutation à examiner pour la fusion
   * @returns {LiquidBody} le body survivant
   */
  #raiseSurface (body, first) {
    while (!body.isSea && body.volume - ((body.tileCount - body.topCount) << 4) > (body.topCount << 4)) {
      if (this.#addTopRow(body)) continue
      body.volume = body.tileCount << 4
      break
    }
    return this.#mergeTouching(body, first)
  }

  /**
   * Gère une goutte dont la tuile a été remplacée de l'extérieur (sable) : la goutte est
   * déplacée sur une cellule ouverte au-dessus (ou en diagonale haute), sinon détruite.
   * Émet les mutations.
   * @param {number} tileIndex — tuile occupée par la goutte
   */
  #onDropReplaced (tileIndex) {
    this.#liquidBodyId[tileIndex] = 0
    chunkManager.setLiquidLevelAt(tileIndex, 0)
    let slot = 0
    while (slot < this.#dropCount && this.#dropIndex[slot] !== tileIndex) slot++
    if (slot === this.#dropCount) return

    this.#changes.length = 0
    for (const offset of LIQUID_ABOVE_OFFSETS) {
      const c = tileIndex + offset
      if (!LIQUID_OPEN_CODES.has(chunkManager.getTileAt(c))) continue
      this.#setDropTile(c, this.#dropNature[slot], this.#dropVolume[slot])
      this.#dropIndex[slot] = c
      this.#dropsDirty = true
      this.#emitChanges()
      return
    }
    this.#removeDropSlot(slot)
  }

  /**
   * Recalcule la surface après une baisse de volume ou un ajout de tuile : supprime les rangées
   * hautes vides (rowVol ≤ 0), supprime le body s'il n'a plus de tuile, sinon pose le niveau de
   * topRow.
   * @param {LiquidBody} body
   * @returns {boolean} false si le body a été supprimé
   */
  #settleTop (body) {
    const first = this.#changes.length
    while (body.volume - ((body.tileCount - body.topCount) << 4) <= 0) {
      this.#removeTopRow(body)
      if (body.tileCount === 0) {
        this.#deleteBody(body)
        return false
      }
    }
    if (this.#changes.length > first) {
      const removed = []
      for (let i = first; i < this.#changes.length; i++) removed.push(this.#changes[i].tileIndex)
      this.#splitDetached(body, removed)
    }
    this.#applyTopRowLevel(body)
    return true
  }

  /**
   * Détecte et réalise la séparation d'un body après le retrait de tuiles (celles de la liste
   * qui n'appartiennent plus au body). Les voisins de ces
   * tuiles restés dans le body servent de graines à un BFS entrelacé (une file par graine, un
   * nœud par file et par tour ; deux files qui se rencontrent fusionnent leur groupe). Dès qu'un
   * groupe a épuisé toutes ses files alors que d'autres groupes subsistent, sa composante est
   * fermée : elle devient un nouveau body. Le parcours s'arrête quand il ne reste qu'un groupe ;
   * son coût est celui des composantes détachées, plus le chemin jusqu'aux rencontres.
   * Le déficit de la rangée haute (16 × topCount − rowVol) est réparti entre les parties au
   * prorata de leurs tuiles sur topRow (arrondi supérieur pour les parties détachées, le body
   * d'origine conserve le reste) ; chaque partie reçoit 16 × N moins son déficit.
   * @param {LiquidBody} body — body d'origine, encore vivant
   * @param {number[]} removed — index des tuiles retirées (les autres sont ignorées)
   */
  #splitDetached (body, removed) {
    const ids = this.#liquidBodyId
    const mark = this.#splitMark
    const {id} = body

    // graines : voisins, restés dans le body, des tuiles retirées
    const queues = []
    for (const tile of removed) {
      if (ids[tile] === id) continue
      for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
        const n = tile + offset
        if (ids[n] !== id || mark[n] !== 0) continue
        mark[n] = queues.length + 1
        queues.push([n])
      }
    }
    const count = queues.length
    if (count < 2) {
      if (count === 1) mark[queues[0][0]] = 0
      return
    }

    // BFS entrelacé avec union-find sur les étiquettes
    const parent = new Int32Array(count)
    const active = new Int32Array(count) // par racine : nombre de files non épuisées du groupe
    const heads = new Int32Array(count)
    for (let a = 0; a < count; a++) {
      parent[a] = a
      active[a] = 1
    }
    const closed = new Uint8Array(count) // par racine : composante déjà détachée
    const parts = [] // bodies détachés, surface recalculée après nettoyage des marques
    let groups = count
    let running = count

    while (groups > 1 && running > 0) {
      for (let a = 0; a < count && groups > 1; a++) {
        const queue = queues[a]
        if (heads[a] >= queue.length) continue
        const idx = queue[heads[a]]
        heads[a]++
        for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
          const n = idx + offset
          if (ids[n] !== id) continue
          const m = mark[n]
          if (m === 0) {
            mark[n] = a + 1
            queue.push(n)
            continue
          }
          const ra = this.#findRoot(parent, a)
          const rb = this.#findRoot(parent, m - 1)
          if (ra === rb) continue
          parent[rb] = ra
          active[ra] += active[rb]
          groups--
        }
        if (heads[a] < queue.length) continue

        // file épuisée : le groupe est-il fermé ?
        running--
        const root = this.#findRoot(parent, a)
        active[root]--
        if (active[root] > 0 || closed[root] === 1 || groups === 1) continue
        closed[root] = 1
        groups--
        parts.push(this.#detachComponent(body, queues, parent, root))
      }
    }

    // nettoyage des marques, puis surface des parties (une partie peut à son tour se séparer)
    for (const queue of queues) {
      for (const n of queue) mark[n] = 0
    }
    if (body.topCount === 0) this.#lowerTopRow(body)
    for (const part of parts) this.#settleTop(part)
  }

  /**
   * Racine union-find d'une étiquette (avec compression de chemin par saut).
   * @param {Int32Array} parent
   * @param {number} a
   * @returns {number}
   */
  #findRoot (parent, a) {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]]
      a = parent[a]
    }
    return a
  }

  /**
   * Transforme en nouveau body la composante fermée formée des files du groupe root (tuiles
   * encore étiquetées au body d'origine) : réétiquetage, nombre de tuiles, rectangle, topRow,
   * tuile de référence, rim, volume (16 × N moins sa part du déficit de la rangée haute du body
   * d'origine). Met à jour le body d'origine (volume, tileCount, topCount, rim, tuile de
   * référence). Une partie détachée d'un body SEA reste SEA si elle touche une colonne au contact
   * du DEEPSEA ; sinon ses tuiles sont converties en WATER (sans 'world/tile-changed') et elle
   * reçoit 16 × N. La nouvelle partie devient instable ; sa surface reste à recalculer.
   * @param {LiquidBody} body — body d'origine
   * @param {Array<number[]>} queues — files du BFS entrelacé (tuiles visitées par graine)
   * @param {Int32Array} parent — union-find des étiquettes
   * @param {number} root — racine union-find du groupe fermé
   * @returns {LiquidBody} la nouvelle partie
   */
  #detachComponent (body, queues, parent, root) {
    const ids = this.#liquidBodyId
    const {topRow} = body
    const deficit = body.isSea ? 0 : (body.topCount << 4) - (body.volume - ((body.tileCount - body.topCount) << 4))

    let tileCount = 0
    let onTopRow = 0
    let xMin = WORLD_WIDTH
    let xMax = 0
    let yMin = WORLD_HEIGHT
    let yMax = 0
    let ref = -1
    let border = false // la composante touche une colonne au contact du DEEPSEA

    for (let a = 0; a < queues.length; a++) {
      if (this.#findRoot(parent, a) !== root) continue
      for (const n of queues[a]) {
        if (ids[n] !== body.id) continue
        tileCount++
        const x = n & 0x3FF
        const y = n >> 10
        if (x === LIQUID_SEA_BORDER_X0 || x === LIQUID_SEA_BORDER_X1) border = true
        if (x < xMin) xMin = x
        if (x > xMax) xMax = x
        if (y < yMin) yMin = y
        if (y === topRow) onTopRow++
        if (y > yMax || (y === yMax && x < (ref & 0x3FF))) {
          yMax = y
          ref = n
        }
      }
    }

    // part du déficit (arrondi supérieur, bornée par le déficit restant du body d'origine)
    let share = onTopRow === 0 ? 0 : Math.ceil(deficit * onTopRow / body.topCount)
    if (share > deficit) share = deficit

    // SEA : une partie au contact du DEEPSEA reste SEA ; sinon elle devient WATER (sans événement)
    const isSea = body.isSea && border
    if (body.isSea && !isSea) {
      for (let a = 0; a < queues.length; a++) {
        if (this.#findRoot(parent, a) !== root) continue
        for (const n of queues[a]) {
          if (ids[n] === body.id) chunkManager.setTileAt(n, NODES.WATER.code)
        }
      }
    }
    const volume = isSea ? LIQUID_SEA_VOLUME : (tileCount << 4) - share

    const part = this.#createBody(ref, volume)
    part.isSea = isSea
    for (let a = 0; a < queues.length; a++) {
      if (this.#findRoot(parent, a) !== root) continue
      for (const n of queues[a]) {
        if (ids[n] !== body.id) continue
        ids[n] = part.id
      }
    }
    part.tileCount = tileCount
    part.xMin = xMin
    part.xMax = xMax
    part.yMin = yMin
    part.yMax = yMax
    part.topRow = yMin
    let topCount = 0
    let idx = (yMin << 10) | xMin
    const end = (yMin << 10) | xMax
    while (idx <= end) {
      if (ids[idx] === part.id) {
        chunkManager.setLiquidLevelAt(idx, 0)
        topCount++
      }
      idx++
    }
    part.topCount = topCount

    // rim de la partie ; le body d'origine perd les cellules qu'il ne touche plus
    for (let a = 0; a < queues.length; a++) {
      if (this.#findRoot(parent, a) !== root) continue
      for (const n of queues[a]) {
        if (ids[n] !== part.id) continue
        for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
          const c = n + offset
          if (!LIQUID_OPEN_CODES.has(chunkManager.getTileAt(c)) && ids[c] !== LIQUID_DROP_ID) continue
          part.rim.add(c)
          if (body.rim.has(c) && !this.#touchesBody(c, body.id)) body.rim.delete(c)
        }
      }
    }

    if (!body.isSea) body.volume -= volume
    body.tileCount -= tileCount
    body.topCount -= onTopRow
    if (ids[body.refIndex] !== body.id) this.#findReference(body)

    this.#markUnstable(part)
    this.#dirty = true
    if (IS_DEV) console.log(`[LiquidSystem] séparation : body ${body.id} → ${part.id} (${tileCount} tuiles, volume ${volume})`)
    return part
  }

  /**
   * Recherche la tuile de référence d'un body (la plus basse, puis la plus à gauche) en
   * remontant les rangées de son rectangle depuis yMax ; met à jour refIndex et yMax.
   * @param {LiquidBody} body
   */
  #findReference (body) {
    const ids = this.#liquidBodyId
    for (let y = body.yMax; y >= body.yMin; y--) {
      let idx = (y << 10) | body.xMin
      const end = (y << 10) | body.xMax
      while (idx <= end) {
        if (ids[idx] === body.id) {
          body.refIndex = idx
          body.yMax = y
          return
        }
        idx++
      }
    }
  }

  /**
   * Abaisse topRow jusqu'à la première rangée contenant des tuiles du body (après le départ de
   * toutes les tuiles de sa rangée haute dans une partie détachée) ; met à jour topCount et yMin.
   * @param {LiquidBody} body
   */
  #lowerTopRow (body) {
    const ids = this.#liquidBodyId
    for (let y = body.topRow + 1; y <= body.yMax; y++) {
      let count = 0
      let idx = (y << 10) | body.xMin
      const end = (y << 10) | body.xMax
      while (idx <= end) {
        if (ids[idx] === body.id) count++
        idx++
      }
      if (count === 0) continue
      body.topRow = y
      body.yMin = y
      body.topCount = count
      return
    }
  }

  /**
   * Ajoute un body à la liste des instables (sans effet s'il y est déjà) et arme la tâche de
   * sa nature.
   * @param {LiquidBody} body
   */
  #markUnstable (body) {
    if (body.unstableSlot !== -1) return
    body.unstableSlot = this.#unstable.length
    this.#unstable.push(body)
    this.#scheduleTick(body.nature)
  }

  /**
   * Retire un body de la liste des instables (swap avec le dernier élément), sans effet s'il
   * n'y est pas.
   * @param {LiquidBody} body
   */
  #markStable (body) {
    const slot = body.unstableSlot
    if (slot === -1) return
    const last = this.#unstable.pop()
    if (last !== body) {
      this.#unstable[slot] = last
      last.unstableSlot = slot
    }
    body.unstableSlot = -1
  }

  /**
   * Indique s'il reste des gouttes ou des bodies instables d'une nature.
   * @param {number} nature
   * @returns {boolean}
   */
  #hasWork (nature) {
    for (let i = 0; i < this.#dropCount; i++) {
      if (this.#dropNature[i] === nature) return true
    }
    for (const body of this.#unstable) {
      if (body.nature === nature) return true
    }
    return false
  }

  /**
   * Ajoute une goutte au pool et occupe sa cellule (sans armer la tâche ni émettre) ; empile la
   * mutation dans #changes. La cellule doit être ouverte.
   * @param {number} tileIndex
   * @param {number} nature
   * @param {number} volume — 1..16
   * @returns {boolean} false (rien n'est modifié) si le pool de gouttes est plein
   */
  #spawnDrop (tileIndex, nature, volume) {
    if (this.#dropCount === LIQUID_DROP_CAPACITY) {
      console.warn(`[LiquidSystem] pool de gouttes plein (${LIQUID_DROP_CAPACITY})`)
      return false
    }
    const slot = this.#dropCount
    this.#dropIndex[slot] = tileIndex
    this.#dropVolume[slot] = volume
    this.#dropNature[slot] = nature
    this.#dropCount++
    this.#dropsDirty = true
    this.#setDropTile(tileIndex, nature, volume)
    return true
  }

  /**
   * Déplace une goutte vers une cellule ouverte : libère sa cellule actuelle puis occupe la
   * destination ; empile les mutations dans #changes.
   * @param {number} slot
   * @param {number} destination — index d'une cellule SKY/VOID
   */
  #moveDrop (slot, destination) {
    this.#clearCell(this.#dropIndex[slot])
    this.#setDropTile(destination, this.#dropNature[slot], this.#dropVolume[slot])
    this.#dropIndex[slot] = destination
    this.#dropsDirty = true
  }

  /**
   * Occupe une cellule par une goutte : code de la nature, liquidBodyId = LIQUID_DROP_ID,
   * niveau = volume ; empile la mutation dans #changes.
   * @param {number} tileIndex
   * @param {number} nature
   * @param {number} volume — 1..16
   */
  #setDropTile (tileIndex, nature, volume) {
    const tileOldCode = chunkManager.getTileAt(tileIndex)
    this.#liquidBodyId[tileIndex] = LIQUID_DROP_ID
    chunkManager.setLiquidLevelAt(tileIndex, volume === 16 ? 0 : volume)
    chunkManager.setTileAt(tileIndex, nature)
    this.#changes.push({tileIndex, tileOldCode, tileNewCode: nature})
  }

  /**
   * Libère une cellule liquide : SKY si la tuile au-dessus est SKY, VOID sinon ; liquidBodyId
   * et niveau remis à 0 ; empile la mutation dans #changes.
   * @param {number} tileIndex
   */
  #clearCell (tileIndex) {
    const tileOldCode = chunkManager.getTileAt(tileIndex)
    const tileNewCode = chunkManager.getTileAt(tileIndex - WORLD_WIDTH) === NODES.SKY.code ? NODES.SKY.code : NODES.VOID.code
    this.#liquidBodyId[tileIndex] = 0
    chunkManager.setLiquidLevelAt(tileIndex, 0)
    chunkManager.setTileAt(tileIndex, tileNewCode)
    this.#changes.push({tileIndex, tileOldCode, tileNewCode})
  }

  /**
   * Supprime une goutte du pool (swap avec le dernier slot). Ne modifie pas le monde.
   * @param {number} slot
   */
  #removeDropSlot (slot) {
    const last = this.#dropCount - 1
    this.#dropIndex[slot] = this.#dropIndex[last]
    this.#dropVolume[slot] = this.#dropVolume[last]
    this.#dropNature[slot] = this.#dropNature[last]
    this.#dropCount = last
    this.#dropsDirty = true
  }

  /**
   * Arme (si elle ne l'est pas déjà) la tâche périodique d'une nature, au délai de sa viscosité.
   * @param {number} nature — NODES.XXX.code
   */
  #scheduleTick (nature) {
    const {priority, capacity} = MICROTASK.LIQUID_TICK
    taskScheduler.enqueueOnce(LIQUID_TICK_IDS[nature], NODES_LOOKUP[nature].viscosity, this.liquidTick, priority, capacity, nature)
  }

  /**
 * Crée une rangée au-dessus de topRow : chaque cellule SKY/VOID située directement au-dessus
 * d'une tuile de topRow devient une tuile du body. Les tuiles de l'ancienne topRow repassent
 * au niveau plein. Met à jour tileCount, topRow, topCount, yMin et le rim ; empile les
 * mutations dans #changes.
 * @param {LiquidBody} body
 * @returns {boolean} false (rien n'est modifié) si aucune cellule n'est disponible
 */
  #addTopRow (body) {
    const ids = this.#liquidBodyId
    const {id, nature, topRow, xMin, xMax, rim} = body
    const first = this.#changes.length

    let idx = (topRow << 10) | xMin
    const end = (topRow << 10) | xMax
    while (idx <= end) {
      if (ids[idx] === id) {
        const above = idx - WORLD_WIDTH
        const aboveCode = chunkManager.getTileAt(above)
        if (LIQUID_OPEN_CODES.has(aboveCode)) {
          chunkManager.setTileAt(above, nature)
          ids[above] = id
          this.#changes.push({tileIndex: above, tileOldCode: aboveCode, tileNewCode: nature})
        }
      }
      idx++
    }

    const added = this.#changes.length - first
    if (added === 0) return false

    // ancienne rangée haute : désormais pleine
    idx = (topRow << 10) | xMin
    while (idx <= end) {
      if (ids[idx] === id) chunkManager.setLiquidLevelAt(idx, 0)
      idx++
    }

    // rim : les nouvelles tuiles en sortent, leurs voisins ouverts ou occupés par une goutte y entrent
    for (let i = first; i < this.#changes.length; i++) {
      const tile = this.#changes[i].tileIndex
      rim.delete(tile)
      for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
        const n = tile + offset
        if (LIQUID_OPEN_CODES.has(chunkManager.getTileAt(n)) || ids[n] === LIQUID_DROP_ID) rim.add(n)
      }
    }

    body.tileCount += added
    body.topRow = topRow - 1
    body.topCount = added
    body.yMin = topRow - 1
    return true
  }

  /**
 * Supprime la rangée topRow : ses tuiles redeviennent SKY (si la tuile au-dessus est SKY) ou
 * VOID, leur niveau est remis à 0. Met à jour tileCount, puis topRow, topCount et yMin sur la
 * rangée inférieure (si le body n'est pas vide), et le rim ; empile les mutations dans
 * #changes. Le rectangle n'est pas réduit en x (il reste englobant).
 * @param {LiquidBody} body
 */
  #removeTopRow (body) {
    const SKY = NODES.SKY.code
    const VOID = NODES.VOID.code
    const ids = this.#liquidBodyId
    const {id, nature, topRow, topCount, xMin, xMax, rim} = body
    const first = this.#changes.length

    let idx = (topRow << 10) | xMin
    let end = (topRow << 10) | xMax
    while (idx <= end) {
      if (ids[idx] === id) {
        const tileNewCode = chunkManager.getTileAt(idx - WORLD_WIDTH) === SKY ? SKY : VOID
        ids[idx] = 0
        chunkManager.setLiquidLevelAt(idx, 0)
        chunkManager.setTileAt(idx, tileNewCode)
        this.#changes.push({tileIndex: idx, tileOldCode: nature, tileNewCode})
      }
      idx++
    }
    body.tileCount -= topCount

    // rim : les tuiles libérées y entrent si elles touchent encore le body ; leurs voisins
    // du rim qui ne le touchent plus en sortent
    for (let i = first; i < this.#changes.length; i++) {
      const tile = this.#changes[i].tileIndex
      if (this.#touchesBody(tile, id)) rim.add(tile)
      for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
        const n = tile + offset
        if (rim.has(n) && !this.#touchesBody(n, id)) rim.delete(n)
      }
    }

    if (body.tileCount === 0) return

    const y = topRow + 1
    let count = 0
    idx = (y << 10) | xMin
    end = (y << 10) | xMax
    while (idx <= end) {
      if (ids[idx] === id) count++
      idx++
    }
    body.topRow = y
    body.topCount = count
    body.yMin = y
  }

  /**
   * Supprime un body vide : le retire de la liste des instables, libère son identifiant et vide
   * son rim. * @param {LiquidBody} body
   */
  #deleteBody (body) {
    this.#markStable(body)
    body.rim.clear()
    this.#bodies[body.id] = null
    this.#freeIds.push(body.id)
  }

  /**
   * Parcourt les tuiles ajoutées au body depuis la mutation d'indice first de #changes et
   * fusionne le body avec chaque body de même nature qui touche l'une d'elles (un body WATER au
   * contact d'un body SEA est absorbé par la mer, voir #mergeWithSea). Une tuile
   * entre-temps retirée (surface recalculée par une fusion) est ignorée.
   * @param {LiquidBody} body
   * @param {number} first — indice, dans #changes, de la première mutation à examiner
   * @returns {LiquidBody} le body survivant (body, ou le body plus grand qui l'a absorbé)
   */
  #mergeTouching (body, first) {
    const ids = this.#liquidBodyId
    const end = this.#changes.length
    for (let i = first; i < end; i++) {
      const tile = this.#changes[i].tileIndex
      if (ids[tile] !== body.id) continue // tuile retirée, ou mutation d'une autre nature
      for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
        const id = ids[tile + offset]
        if (id === 0 || id === LIQUID_DROP_ID || id === body.id) continue
        const other = this.#bodies[id]
        if (other.nature === body.nature) body = this.#mergeBodies(body, other)
        else if (other.isSea && body.nature === NODES.WATER.code) body = this.#mergeWithSea(other, body)
        else if (body.isSea && other.nature === NODES.WATER.code) body = this.#mergeWithSea(body, other)
      }
    }
    return body
  }

  /**
   * Fusionne deux bodies de même nature : le plus petit (en tuiles) est réétiqueté dans le plus
   * grand (BFS sur ses tuiles, coût proportionnel à sa taille), puis supprimé. Volumes et
   * nombres de tuiles s'additionnent, rectangles et rims s'unissent, la tuile de référence est
   * la plus basse des deux ; topRow devient la plus haute des deux rangées hautes. Les tuiles des
   * anciennes rangées hautes repassent au niveau plein, puis la surface est recalculée sur le
   * volume total (niveau égalisé instantanément). Le body survivant devient instable.
   * @param {LiquidBody} a
   * @param {LiquidBody} b
   * @returns {LiquidBody} le body survivant
   */
  #mergeBodies (a, b) {
    const big = a.tileCount >= b.tileCount ? a : b
    const small = big === a ? b : a
    const ids = this.#liquidBodyId
    const queue = this.#queue

    this.#clearTopRowLevel(big)
    this.#clearTopRowLevel(small)

    // réétiquetage des tuiles du petit body
    ids[small.refIndex] = big.id
    queue[0] = small.refIndex
    let head = 0
    let tail = 1
    while (head < tail) {
      const idx = queue[head]
      head++
      for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
        const n = idx + offset
        if (ids[n] !== small.id) continue
        ids[n] = big.id
        queue[tail] = n
        tail++
      }
    }

    big.volume += small.volume
    big.tileCount += small.tileCount
    if (small.xMin < big.xMin) big.xMin = small.xMin
    if (small.xMax > big.xMax) big.xMax = small.xMax
    if (small.yMax > big.yMax) big.yMax = small.yMax
    if (small.topRow < big.topRow) {
      big.topRow = small.topRow
      big.yMin = small.topRow
    }
    const bigRefY = big.refIndex >> 10
    const smallRefY = small.refIndex >> 10
    if (smallRefY > bigRefY || (smallRefY === bigRefY && (small.refIndex & 0x3FF) < (big.refIndex & 0x3FF))) big.refIndex = small.refIndex
    for (const cell of small.rim) {
      if (ids[cell] !== big.id) big.rim.add(cell)
    }
    for (const cell of big.rim) {
      if (ids[cell] === big.id) big.rim.delete(cell) // tuile de jonction
    }

    // topCount sur la nouvelle rangée haute
    let count = 0
    let idx = (big.topRow << 10) | big.xMin
    const end = (big.topRow << 10) | big.xMax
    while (idx <= end) {
      if (ids[idx] === big.id) count++
      idx++
    }
    big.topCount = count

    this.#deleteBody(small)
    this.#settleTop(big)
    this.#markUnstable(big)
    this.#dirty = true
    return big
  }

  /**
   * Remet au niveau plein les tuiles de la rangée haute d'un body.
   * @param {LiquidBody} body
   */
  #clearTopRowLevel (body) {
    const ids = this.#liquidBodyId
    let idx = (body.topRow << 10) | body.xMin
    const end = (body.topRow << 10) | body.xMax
    while (idx <= end) {
      if (ids[idx] === body.id) chunkManager.setLiquidLevelAt(idx, 0)
      idx++
    }
  }

  /**
 * Indique si une cellule a au moins un voisin 4-connexe appartenant au body.
 * @param {number} tileIndex
 * @param {number} id — identifiant du body
 * @returns {boolean}
 */
  #touchesBody (tileIndex, id) {
    const ids = this.#liquidBodyId
    for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
      if (ids[tileIndex + offset] === id) return true
    }
    return false
  }

  /**
   * Parcourt les mutations empilées dans #changes et, pour chaque tuile WATER, HONEY, SAP ou SEA
   * nouvellement posée (et toujours présente), traite ses contacts 4-adjacents : au contact de
   * la LAVA, la tuile se solidifie (WATER/SEA → OBSIDIAN, HONEY → HELLSTONE, SAP → SLATE) ; au
   * contact d'une autre nature de liquide, c'est toujours la tuile HONEY ou SAP impliquée qui
   * devient une gemme, à sa position (HONEY/SAP : les deux cristallisent). Les cristallisations
   * empilent leurs propres mutations, qui ne posent aucun liquide.
   */
  #resolveContacts () {
    const WATER = NODES.WATER.code
    const HONEY = NODES.HONEY.code
    const SAP = NODES.SAP.code
    const SEA = NODES.SEA.code
    const LAVA = NODES.LAVA.code

    for (let i = 0; i < this.#changes.length; i++) {
      const {tileIndex, tileNewCode} = this.#changes[i]
      if (tileNewCode !== WATER && tileNewCode !== HONEY && tileNewCode !== SAP && tileNewCode !== SEA) continue
      if (chunkManager.getTileAt(tileIndex) !== tileNewCode) continue // tuile entre-temps retirée ou cristallisée
      for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
        const c = tileIndex + offset
        const other = chunkManager.getTileAt(c)

        if (other === tileNewCode) continue
        if (other === LAVA) {
          this.#crystallize(tileIndex, this.#crystalFor(tileNewCode, LAVA))
          break
        }
        if (!(NODES_LOOKUP[other].type & NODE_TYPE.LIQUID)) continue

        const gemOther = this.#crystalFor(other, tileNewCode)
        if (gemOther !== 0) this.#crystallize(c, gemOther)
        const gemSelf = this.#crystalFor(tileNewCode, other)
        if (gemSelf === 0) continue
        this.#crystallize(tileIndex, gemSelf)
        break
      }
    }
  }

  /**
   * Tuile solide produite par une tuile de liquide au contact d'une autre nature de liquide ou
   * de la LAVA.
   * @param {number} self — code du liquide qui cristallise éventuellement
   * @param {number} other — code du liquide au contact, ou NODES.LAVA.code
   * @returns {number} code de la tuile produite, 0 si self ne cristallise pas (WATER, SEA ou
   *   DEEPSEA hors contact LAVA)
   */
  #crystalFor (self, other) {
    const LAVA = NODES.LAVA.code
    switch (self) {
      case NODES.WATER.code:
      case NODES.SEA.code:
        return other === LAVA ? NODES.OBSIDIAN.code : 0
      case NODES.HONEY.code:
        if (other === LAVA) return NODES.HELLSTONE.code
        return other === NODES.SAP.code ? NODES.RUBY.code : NODES.TOPAZ.code
      case NODES.SAP.code:
        if (other === LAVA) return NODES.SLATE.code
        return other === NODES.HONEY.code ? NODES.SAPPHIRE.code : NODES.EMERALD.code
      default:
        return 0
    }
  }

  /**
   * Cristallise une tuile de goutte ou de body en tuile solide (une tuile hors système, ex.
   * DEEPSEA, est ignorée).
   * @param {number} tileIndex
   * @param {number} gem — NODES.XXX.code de la gemme
   */
  #crystallize (tileIndex, gem) {
    const id = this.#liquidBodyId[tileIndex]
    if (id === LIQUID_DROP_ID) this.#crystallizeDrop(tileIndex, gem)
    else if (id !== 0) this.#crystallizeBodyTile(this.#bodies[id], tileIndex, gem)
  }

  /**
   * Remplace une goutte par une gemme : la goutte quitte le pool, son volume est perdu ; empile
   * la mutation dans #changes.
   * @param {number} tileIndex
   * @param {number} gem
   */
  #crystallizeDrop (tileIndex, gem) {
    let slot = 0
    while (slot < this.#dropCount && this.#dropIndex[slot] !== tileIndex) slot++
    if (slot === this.#dropCount) return
    const tileOldCode = this.#dropNature[slot]
    this.#removeDropSlot(slot)
    this.#liquidBodyId[tileIndex] = 0
    chunkManager.setLiquidLevelAt(tileIndex, 0)
    chunkManager.setTileAt(tileIndex, gem)
    this.#changes.push({tileIndex, tileOldCode, tileNewCode: gem})
  }

  /**
   * Remplace une tuile de body par une tuile solide : la tuile sort du body avec son contenu
   * (16, ou le niveau de la rangée haute si elle y est, au moins 1), retiré du volume ; rim,
   * référence et topRow mis à jour ; surface recalculée, séparation éventuelle ; un body vidé
   * est supprimé. Pour un body SEA (volume infini), seuls le rim, la référence et la séparation
   * éventuelle sont traités. Empile les mutations dans #changes.
   * @param {LiquidBody} body
   * @param {number} tileIndex
   * @param {number} gem
   */
  #crystallizeBodyTile (body, tileIndex, gem) {
    const ids = this.#liquidBodyId
    const onTopRow = (tileIndex >> 10) === body.topRow
    let amount = 16
    if (onTopRow && !body.isSea) {
      amount = ((body.volume - ((body.tileCount - body.topCount) << 4)) / body.topCount) | 0
      if (amount === 0) amount = 1
    }

    ids[tileIndex] = 0
    chunkManager.setLiquidLevelAt(tileIndex, 0)
    chunkManager.setTileAt(tileIndex, gem)
    this.#changes.push({tileIndex, tileOldCode: body.nature, tileNewCode: gem})
    body.tileCount--
    if (onTopRow) body.topCount--
    if (!body.isSea) body.volume -= amount
    for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
      const n = tileIndex + offset
      if (body.rim.has(n) && !this.#touchesBody(n, body.id)) body.rim.delete(n)
    }
    this.#dirty = true

    // SEA : volume infini, la surface ne bouge pas ; séparation éventuelle seulement
    if (body.isSea) {
      if (ids[body.refIndex] !== body.id) this.#findReference(body)
      this.#splitDetached(body, [tileIndex])
      this.#markUnstable(body)
      return
    }

    if (body.tileCount === 0) {
      this.#deleteBody(body)
      return
    }
    if (ids[body.refIndex] !== body.id) this.#findReference(body)
    if (body.topCount === 0) this.#lowerTopRow(body)
    if (!this.#settleTop(body)) return
    this.#splitDetached(body, [tileIndex])
    this.#applyTopRowLevel(body)
    this.#markUnstable(body)
  }

  /**
   * Résout les contacts entre natures différentes (cristallisation), puis émet
   * 'world/tile-changed' pour chaque mutation empilée dans #changes (flag #applying levé
   * pendant l'émission, pour que onTileChangedLiquid les ignore), puis vide la pile.
   */
  #emitChanges () {
    this.#resolveContacts()
    this.#applying = true
    for (const change of this.#changes) eventBus.emit('world/tile-changed', change)
    this.#applying = false
    this.#changes.length = 0
  }

  // ///// //
  // DEBUG //
  // ///// //

  /**
   * DEBUG — Sur la zone visible : un carré au centre de chaque tuile appartenant à un body,
   * coloré selon son id (contour sur les tuiles de topRow : noir si le body est stable, rouge
   * s'il est instable ; carré blanc plus grand sur la tuile de référence), un carré blanc à
   * contour noir sur chaque goutte, et un petit carré rouge sur chaque cellule du rim.
   * @param {CanvasRenderingContext2D} ctx — contexte déjà transformé (caméra appliquée)
   */
  debugRender (ctx) {
    const ids = this.#liquidBodyId
    const x0 = camera.x >> 4
    const y0 = camera.y >> 4
    const x1 = Math.min(WORLD_WIDTH - 1, (camera.x + camera.logicalWidth) >> 4)
    const y1 = Math.min(WORLD_HEIGHT - 1, (camera.y + camera.logicalHeight) >> 4)

    ctx.save()
    ctx.lineWidth = 1
    ctx.strokeStyle = '#000000'

    // tuiles des bodies
    for (let y = y0; y <= y1; y++) {
      let idx = (y << 10) | x0
      for (let x = x0; x <= x1; x++) {
        const id = ids[idx]
        if (id === LIQUID_DROP_ID) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect((x << 4) + 5, (y << 4) + 5, 6, 6)
          ctx.strokeRect((x << 4) + 4.5, (y << 4) + 4.5, 7, 7)
        } else if (id !== 0) {
          const body = this.#bodies[id]
          const px = x << 4
          const py = y << 4
          if (idx === body.refIndex) {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(px + 3, py + 3, 10, 10)
          }
          ctx.fillStyle = LIQUID_DEBUG_COLORS[id & 7]
          ctx.fillRect(px + 5, py + 5, 6, 6)
          if (y === body.topRow) {
            ctx.strokeStyle = body.unstableSlot === -1 ? '#000000' : '#ff0000'
            ctx.strokeRect(px + 4.5, py + 4.5, 7, 7)
            ctx.strokeStyle = '#000000'
          }
        }
        idx++
      }
    }

    // rim des bodies dont le rectangle (élargi d'une tuile) intersecte la zone visible
    ctx.fillStyle = '#ff0000'
    for (const body of this.#bodies) {
      if (body === null) continue
      if (body.xMax + 1 < x0 || body.xMin - 1 > x1 || body.yMax + 1 < y0 || body.yMin - 1 > y1) continue
      for (const idx of body.rim) {
        ctx.fillRect(((idx & 0x3FF) << 4) + 6, ((idx >> 10) << 4) + 6, 4, 4)
      }
    }

    ctx.restore()
  }
}
export const liquidSystem = new LiquidSystem()
