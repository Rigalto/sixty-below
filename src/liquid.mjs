// liquid.mjs — SandFallingSystem - LiquidBody - LiquidSystem

import {IS_DEV, WORLD_WIDTH, WORLD_HEIGHT, MICROTASK} from './constant.mjs'
import {eventBus, seededRNG, microTasker, taskScheduler} from './utils.mjs'
import {NODES} from '../assets/data/data.mjs'
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
    this.onTileChangedSand = this.onTileChangedSand.bind(this)
    eventBus.on('world/tile-changed', this.onTileChangedSand)
    this.onFirstLoopSand = this.onFirstLoopSand.bind(this)
    eventBus.on('time/first-loop', this.onFirstLoopSand)
    this.onSaveTick = this.onSaveTick.bind(this)
    eventBus.on('save/tick', this.onSaveTick)
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
   * déplacements en bloc : swap complet entre la source (hérite du code qui occupait la
   * destination) et la destination (devient SAND), tous les setTileAt() avant tout emit pour
   * garantir un monde cohérent aux listeners synchrones (dont onTileChangedSand lui-même, qui
   * repeuple #pending pour les tuiles concernées). Aucune vérification blockedTiles : un
   * meuble/plante sur la destination est détruit, son propre listener s'en charge.
   * @param {Array<{from: number, to: number}>} moves
   */
  applySandFallingMoves (moves) {
    const SAND = NODES.SAND.code
    const VOID = NODES.VOID.code
    const SKY = NODES.SKY.code
    const FOG = NODES.FOG.code
    const W = WORLD_WIDTH

    const changes = []

    for (const move of moves) {
      const destinationOldCode = chunkManager.getTileAt(move.to)
      let sourceNewCode = destinationOldCode
      if (sourceNewCode === VOID) {
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
    this.rim = new Set() // Set<tileIndex> — cellules SKY/VOID adjacentes au body
    this.unstableSlot = -1 // position dans la liste des instables, -1 si stable
  }
}

class LiquidSystem {
  #liquidBodyId = new Uint16Array(WORLD_WIDTH * WORLD_HEIGHT) // id du body de chaque tuile : 0 = aucun
  #bodies = [null] // Array<LiquidBody|null> indexé par id — l'index 0 n'est jamais utilisé
  #freeIds = [] // ids libérés, réutilisés en priorité
  #queue = new Int32Array(WORLD_WIDTH * WORLD_HEIGHT) // file BFS partagée (flood-fill)
  #dirty = false // true si la table des bodies a changé depuis la dernière écriture gamestate
  #changes = [] // Array<{tileIndex, tileOldCode, tileNewCode}> — mutations en attente d'émission 'world/tile-changed'

  constructor () {
    // eventBus
    this.onSaveTick = this.onSaveTick.bind(this)
    eventBus.on('save/tick', this.onSaveTick)
  }

  /**
   * Reconstruit tous les LiquidBodies depuis la table persistée : flood-fill depuis chaque
   * tuile de référence (liquidBodyId, nombre de tuiles, rectangle, topRow, rim), puis pose du
   * niveau des tuiles de topRow dans chunkManager. Requiert un chunkManager déjà initialisé.
   * @param {number[]} liquidBodies — persisté (gamestate.liquidbodies) : [ref0, volume0, ref1, volume1, …]
   */
  init (liquidBodies = []) {
    const t0 = performance.now()
    this.#liquidBodyId.fill(0)
    this.#bodies.length = 1
    this.#freeIds.length = 0
    this.#dirty = false

    let tiles = 0
    for (let i = 0; i < liquidBodies.length; i += 2) {
      const body = this.#createBody(liquidBodies[i], liquidBodies[i + 1])
      this.#floodFill(body)
      this.#applyTopRowLevel(body)
      tiles += body.tileCount
    }

    if (IS_DEV) console.log(`[LiquidSystem] ${this.#bodies.length - 1} liquid bodies, ${tiles} tuiles, ${(performance.now() - t0).toFixed(1)} ms`)
  }

  /**
   * Liaison EventBus : 'save/tick' — persiste la table des bodies en gamestate (clé
   * 'liquidbodies', tableau plat [ref, volume, …]) uniquement si elle a changé depuis la
   * dernière écriture.
   */
  onSaveTick () {
    if (!this.#dirty) return
    const table = []
    for (const body of this.#bodies) {
      if (body === null) continue
      table.push(body.refIndex, body.volume)
    }
    database.setGameState('liquidbodies', table)
    this.#dirty = false
  }

  /**
   * Ajoute du volume au body contenant la tuile, appliqué instantanément à la surface : tant
   * que la rangée haute déborde (rowVol > 16 × topCount), une nouvelle rangée est créée
   * au-dessus, sur les cellules SKY/VOID situées directement au-dessus des tuiles de topRow.
   * Si aucune cellule n'est disponible, le body est plein et l'excédent est refusé. Toutes les
   * mutations précèdent l'émission des 'world/tile-changed'.
   * @param {number} tileIndex — une tuile quelconque du body
   * @param {number} amount — volume à ajouter, en 1/16 de tuile (> 0)
   * @returns {number} volume réellement ajouté (0 si la tuile n'appartient à aucun body)
   */
  addVolume (tileIndex, amount) {
    const id = this.#liquidBodyId[tileIndex]
    if (id === 0) return 0
    const body = this.#bodies[id]
    this.#changes.length = 0

    body.volume += amount
    let accepted = amount
    while (body.volume - ((body.tileCount - body.topCount) << 4) > (body.topCount << 4)) {
      if (this.#addTopRow(body)) continue
      const overflow = body.volume - (body.tileCount << 4)
      body.volume -= overflow
      accepted -= overflow
      break
    }

    this.#applyTopRowLevel(body)
    if (accepted > 0) this.#dirty = true
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
 * @returns {boolean} false (rien n'est modifié) si la tuile n'appartient à aucun body ou si
 *   le volume du body est inférieur à amount
 */
  removeVolume (tileIndex, amount) {
    const id = this.#liquidBodyId[tileIndex]
    if (id === 0) return false
    const body = this.#bodies[id]
    if (body.volume < amount) return false
    this.#changes.length = 0

    body.volume -= amount
    while (body.volume - ((body.tileCount - body.topCount) << 4) <= 0) {
      this.#removeTopRow(body)
      if (body.tileCount === 0) break
    }

    if (body.tileCount === 0) this.#deleteBody(body)
    else this.#applyTopRowLevel(body)
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
   * rim (voisins SKY/VOID). Pas de bounds checking (ghost cells).
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
        if (ids[nIdx] === id) continue
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

    // rim : les nouvelles tuiles en sortent, leurs voisins ouverts y entrent
    for (let i = first; i < this.#changes.length; i++) {
      const tile = this.#changes[i].tileIndex
      rim.delete(tile)
      for (const offset of LIQUID_NEIGHBOR_OFFSETS) {
        const n = tile + offset
        if (LIQUID_OPEN_CODES.has(chunkManager.getTileAt(n))) rim.add(n)
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
 * Supprime un body vide : libère son identifiant et vide son rim.
 * @param {LiquidBody} body
 */
  #deleteBody (body) {
    body.rim.clear()
    this.#bodies[body.id] = null
    this.#freeIds.push(body.id)
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
  * Émet 'world/tile-changed' pour chaque mutation empilée dans #changes, puis vide la pile.
  */
  #emitChanges () {
    for (const change of this.#changes) eventBus.emit('world/tile-changed', change)
    this.#changes.length = 0
  }

  // ///// //
  // DEBUG //
  // ///// //

  /**
   * DEBUG — Sur la zone visible : un carré au centre de chaque tuile appartenant à un body,
   * coloré selon son id (contour noir sur les tuiles de topRow, carré blanc plus grand sur la
   * tuile de référence), et un petit carré rouge sur chaque cellule du rim.
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
        if (id !== 0) {
          const body = this.#bodies[id]
          const px = x << 4
          const py = y << 4
          if (idx === body.refIndex) {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(px + 3, py + 3, 10, 10)
          }
          ctx.fillStyle = LIQUID_DEBUG_COLORS[id & 7]
          ctx.fillRect(px + 5, py + 5, 6, 6)
          if (y === body.topRow) ctx.strokeRect(px + 4.5, py + 4.5, 7, 7)
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
