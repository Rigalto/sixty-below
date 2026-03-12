// tests/test-biomenaturalizer.mjs
// Lancement : node tests/run.mjs BiomeNaturalizer
//
// Tests de BiomeNaturalizer — les méthodes opèrent sur worldBuffer (singleton).
// Pattern : worldBuffer.init() en début de suite, worldBuffer.clear() en fin.
// seededRNG est initialisé avec une graine fixe pour la reproductibilité.

import {describe, assert} from './kernel.mjs'
import {BiomeNaturalizer, biomesGenerator, worldBuffer} from '../src/generate.mjs'
import {seededRNG} from '../src/utils.mjs'
import {NODES, NODES_LOOKUP, BIOME_TYPE} from '../assets/data/data.mjs'

const SEED = 1234

// Helper : construit des verticalBoundaries minimales pour un seul biome
function makeSingleBiomeVerticalBoundaries (biome) {
  // Un seul segment couvrant tout le monde → aucune frontière intermédiaire
  return [{biome, boundary: new Int16Array(512).fill(1024)}]
}

// Helper : construit des verticalBoundaries pour deux biomes côte à côte
function makeTwoBiomeVerticalBoundaries (leftBiome, rightBiome) {
  const boundary = new Int16Array(512).fill(512)
  return [
    {biome: leftBiome, boundary},
    {biome: rightBiome, boundary: new Int16Array(512).fill(1024)}
  ]
}

// ─── getSubstratCode ──────────────────────────────────────────────────────────

describe('BiomeNaturalizer — getSubstratCode() : sky retourne SKY quel que soit le biome', () => {
  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  const n = new BiomeNaturalizer()

  const skySurface = new Int16Array(1024).fill(60)
  const surfaceUnder = new Int16Array(1024).fill(120)
  const underCaverns = new Int16Array(1024).fill(300)
  const vb = makeSingleBiomeVerticalBoundaries(BIOME_TYPE.FOREST)

  const code = n.getSubstratCode(100, 10, skySurface, surfaceUnder, underCaverns, vb)
  assert('y < skySurface → SKY', code === NODES.SKY.code)
})

describe('BiomeNaturalizer — getSubstratCode() : surface FOREST → CLAY', () => {
  seededRNG.init(SEED)
  const n = new BiomeNaturalizer()

  const skySurface = new Int16Array(1024).fill(50)
  const surfaceUnder = new Int16Array(1024).fill(150)
  const underCaverns = new Int16Array(1024).fill(300)
  const vb = makeSingleBiomeVerticalBoundaries(BIOME_TYPE.FOREST)

  const code = n.getSubstratCode(100, 100, skySurface, surfaceUnder, underCaverns, vb)
  assert('surface FOREST → CLAY', code === NODES.CLAY.code)
})

describe('BiomeNaturalizer — getSubstratCode() : surface DESERT → SANDSTONE', () => {
  seededRNG.init(SEED)
  const n = new BiomeNaturalizer()

  const skySurface = new Int16Array(1024).fill(50)
  const surfaceUnder = new Int16Array(1024).fill(150)
  const underCaverns = new Int16Array(1024).fill(300)
  const vb = makeSingleBiomeVerticalBoundaries(BIOME_TYPE.DESERT)

  const code = n.getSubstratCode(100, 100, skySurface, surfaceUnder, underCaverns, vb)
  assert('surface DESERT → SANDSTONE', code === NODES.SANDSTONE.code)
})

describe('BiomeNaturalizer — getSubstratCode() : surface JUNGLE → MUD', () => {
  seededRNG.init(SEED)
  const n = new BiomeNaturalizer()

  const skySurface = new Int16Array(1024).fill(50)
  const surfaceUnder = new Int16Array(1024).fill(150)
  const underCaverns = new Int16Array(1024).fill(300)
  const vb = makeSingleBiomeVerticalBoundaries(BIOME_TYPE.JUNGLE)

  const code = n.getSubstratCode(100, 100, skySurface, surfaceUnder, underCaverns, vb)
  assert('surface JUNGLE → MUD', code === NODES.MUD.code)
})

describe('BiomeNaturalizer — getSubstratCode() : under FOREST → STONE', () => {
  seededRNG.init(SEED)
  const n = new BiomeNaturalizer()

  const skySurface = new Int16Array(1024).fill(50)
  const surfaceUnder = new Int16Array(1024).fill(100)
  const underCaverns = new Int16Array(1024).fill(300)
  const vb = makeSingleBiomeVerticalBoundaries(BIOME_TYPE.FOREST)

  const code = n.getSubstratCode(100, 200, skySurface, surfaceUnder, underCaverns, vb)
  assert('under FOREST → STONE', code === NODES.STONE.code)
})

describe('BiomeNaturalizer — getSubstratCode() : under DESERT → ASH', () => {
  seededRNG.init(SEED)
  const n = new BiomeNaturalizer()

  const skySurface = new Int16Array(1024).fill(50)
  const surfaceUnder = new Int16Array(1024).fill(100)
  const underCaverns = new Int16Array(1024).fill(300)
  const vb = makeSingleBiomeVerticalBoundaries(BIOME_TYPE.DESERT)

  const code = n.getSubstratCode(100, 200, skySurface, surfaceUnder, underCaverns, vb)
  assert('under DESERT → ASH', code === NODES.ASH.code)
})

describe('BiomeNaturalizer — getSubstratCode() : under JUNGLE → LIMESTONE', () => {
  seededRNG.init(SEED)
  const n = new BiomeNaturalizer()

  const skySurface = new Int16Array(1024).fill(50)
  const surfaceUnder = new Int16Array(1024).fill(100)
  const underCaverns = new Int16Array(1024).fill(300)
  const vb = makeSingleBiomeVerticalBoundaries(BIOME_TYPE.JUNGLE)

  const code = n.getSubstratCode(100, 200, skySurface, surfaceUnder, underCaverns, vb)
  assert('under JUNGLE → LIMESTONE', code === NODES.LIMESTONE.code)
})

describe('BiomeNaturalizer — getSubstratCode() : caverns FOREST → HARDSTONE', () => {
  seededRNG.init(SEED)
  const n = new BiomeNaturalizer()

  const skySurface = new Int16Array(1024).fill(50)
  const surfaceUnder = new Int16Array(1024).fill(100)
  const underCaverns = new Int16Array(1024).fill(200)
  const vb = makeSingleBiomeVerticalBoundaries(BIOME_TYPE.FOREST)

  const code = n.getSubstratCode(100, 400, skySurface, surfaceUnder, underCaverns, vb)
  assert('caverns FOREST → HARDSTONE', code === NODES.HARDSTONE.code)
})

describe('BiomeNaturalizer — getSubstratCode() : caverns DESERT → HELLSTONE', () => {
  seededRNG.init(SEED)
  const n = new BiomeNaturalizer()

  const skySurface = new Int16Array(1024).fill(50)
  const surfaceUnder = new Int16Array(1024).fill(100)
  const underCaverns = new Int16Array(1024).fill(200)
  const vb = makeSingleBiomeVerticalBoundaries(BIOME_TYPE.DESERT)

  const code = n.getSubstratCode(100, 400, skySurface, surfaceUnder, underCaverns, vb)
  assert('caverns DESERT → HELLSTONE', code === NODES.HELLSTONE.code)
})

describe('BiomeNaturalizer — getSubstratCode() : caverns JUNGLE → SLATE', () => {
  seededRNG.init(SEED)
  const n = new BiomeNaturalizer()

  const skySurface = new Int16Array(1024).fill(50)
  const surfaceUnder = new Int16Array(1024).fill(100)
  const underCaverns = new Int16Array(1024).fill(200)
  const vb = makeSingleBiomeVerticalBoundaries(BIOME_TYPE.JUNGLE)

  const code = n.getSubstratCode(100, 400, skySurface, surfaceUnder, underCaverns, vb)
  assert('caverns JUNGLE → SLATE', code === NODES.SLATE.code)
})

describe('BiomeNaturalizer — getSubstratCode() : frontière biome — x à gauche → biome gauche', () => {
  seededRNG.init(SEED)
  const n = new BiomeNaturalizer()

  const skySurface = new Int16Array(1024).fill(50)
  const surfaceUnder = new Int16Array(1024).fill(150)
  const underCaverns = new Int16Array(1024).fill(300)
  // Frontière à x=512 : gauche=FOREST, droite=DESERT
  const vb = makeTwoBiomeVerticalBoundaries(BIOME_TYPE.FOREST, BIOME_TYPE.DESERT)

  const codeLeft = n.getSubstratCode(100, 100, skySurface, surfaceUnder, underCaverns, vb)
  const codeRight = n.getSubstratCode(900, 100, skySurface, surfaceUnder, underCaverns, vb)
  assert('x=100 (gauche) → CLAY (FOREST surface)', codeLeft === NODES.CLAY.code)
  assert('x=900 (droite) → SANDSTONE (DESERT surface)', codeRight === NODES.SANDSTONE.code)
})

// ─── precomputeHorizontalBoundaries ──────────────────────────────────────────

describe('BiomeNaturalizer — precomputeHorizontalBoundaries() : retourne 4 Int16Array de taille 1024', () => {
  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  const n = new BiomeNaturalizer()

  const {skySurface, surfaceUnder, underCaverns, hell} = n.precomputeHorizontalBoundaries()
  assert('skySurface est Int16Array', skySurface instanceof Int16Array)
  assert('surfaceUnder est Int16Array', surfaceUnder instanceof Int16Array)
  assert('underCaverns est Int16Array', underCaverns instanceof Int16Array)
  assert('hell est Int16Array', hell instanceof Int16Array)
  assert('skySurface.length === 1024', skySurface.length === 1024)
  assert('surfaceUnder.length === 1024', surfaceUnder.length === 1024)
  assert('underCaverns.length === 1024', underCaverns.length === 1024)
  assert('hell.length === 1024', hell.length === 1024)
})

describe('BiomeNaturalizer — precomputeHorizontalBoundaries() : ordre vertical respecté sur toutes les colonnes', () => {
  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  const n = new BiomeNaturalizer()

  const {skySurface, surfaceUnder, underCaverns} = n.precomputeHorizontalBoundaries()
  let ok = true
  for (let x = 0; x < 1024; x++) {
    if (!(skySurface[x] < surfaceUnder[x] && surfaceUnder[x] < underCaverns[x])) {
      ok = false
      break
    }
  }
  assert('skySurface < surfaceUnder < underCaverns sur toutes les colonnes', ok)
})

describe('BiomeNaturalizer — precomputeHorizontalBoundaries() : reproductible avec même graine', () => {
  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  const n = new BiomeNaturalizer()
  const r1 = n.precomputeHorizontalBoundaries()

  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  const r2 = n.precomputeHorizontalBoundaries()

  assert('skySurface[0] identique', r1.skySurface[0] === r2.skySurface[0])
  assert('surfaceUnder[512] identique', r1.surfaceUnder[512] === r2.surfaceUnder[512])
  assert('underCaverns[1023] identique', r1.underCaverns[1023] === r2.underCaverns[1023])
})

// ─── precomputeVerticalBoundaries ─────────────────────────────────────────────

describe('BiomeNaturalizer — precomputeVerticalBoundaries() : retourne autant d\'entrées que de biomes', () => {
  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  const n = new BiomeNaturalizer()

  const biomesDescription = [
    {biome: BIOME_TYPE.FOREST, width: 512, offset: 0},
    {biome: BIOME_TYPE.DESERT, width: 512, offset: 512}
  ]
  const vb = n.precomputeVerticalBoundaries(biomesDescription)
  assert('2 entrées pour 2 biomes', vb.length === 2)
})

describe('BiomeNaturalizer — precomputeVerticalBoundaries() : chaque boundary est Int16Array de taille 512', () => {
  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  const n = new BiomeNaturalizer()

  const biomesDescription = [
    {biome: BIOME_TYPE.FOREST, width: 400, offset: 0},
    {biome: BIOME_TYPE.JUNGLE, width: 300, offset: 400},
    {biome: BIOME_TYPE.DESERT, width: 324, offset: 700}
  ]
  const vb = n.precomputeVerticalBoundaries(biomesDescription)
  let ok = true
  for (const entry of vb) {
    if (!(entry.boundary instanceof Int16Array) || entry.boundary.length !== 512) {
      ok = false
      break
    }
  }
  assert('Toutes les boundaries sont Int16Array de 512', ok)
})

describe('BiomeNaturalizer — precomputeVerticalBoundaries() : biome conservé dans chaque entrée', () => {
  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  const n = new BiomeNaturalizer()

  const biomesDescription = [
    {biome: BIOME_TYPE.FOREST, width: 512, offset: 0},
    {biome: BIOME_TYPE.DESERT, width: 512, offset: 512}
  ]
  const vb = n.precomputeVerticalBoundaries(biomesDescription)
  assert('vb[0].biome === FOREST', vb[0].biome === BIOME_TYPE.FOREST)
  assert('vb[1].biome === DESERT', vb[1].biome === BIOME_TYPE.DESERT)
})

// ─── precomputeCliffs ─────────────────────────────────────────────────────────

describe('BiomeNaturalizer — precomputeCliffs() : retourne deux Int16Array', () => {
  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  const n = new BiomeNaturalizer()

  const {leftCliff, rightCliff} = n.precomputeCliffs(3, 4)
  assert('leftCliff est Int16Array', leftCliff instanceof Int16Array)
  assert('rightCliff est Int16Array', rightCliff instanceof Int16Array)
})

describe('BiomeNaturalizer — precomputeCliffs() : leftCliff < rightCliff sur toute la profondeur', () => {
  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  const n = new BiomeNaturalizer()

  const {leftCliff, rightCliff} = n.precomputeCliffs(3, 4)
  let ok = true
  for (let y = 0; y < leftCliff.length; y++) {
    if (leftCliff[y] >= rightCliff[y]) { ok = false; break }
  }
  assert('leftCliff < rightCliff sur toute la profondeur', ok)
})

describe('BiomeNaturalizer — precomputeCliffs() : reproductible avec même graine', () => {
  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  const n = new BiomeNaturalizer()
  const r1 = n.precomputeCliffs(3, 4)

  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  const r2 = n.precomputeCliffs(3, 4)

  assert('leftCliff[0] identique', r1.leftCliff[0] === r2.leftCliff[0])
  assert('rightCliff[0] identique', r1.rightCliff[0] === r2.rightCliff[0])
})

// ─── safeSetTile ──────────────────────────────────────────────────────────────

describe('BiomeNaturalizer — safeSetTile() : écrase une tuile SUBSTRAT', () => {
  worldBuffer.init()
  const n = new BiomeNaturalizer()

  worldBuffer.write(10, 10, NODES.STONE.code) // SUBSTRAT
  n.safeSetTile(10, 10, NODES.CLAY.code)
  assert('STONE remplacé par CLAY', worldBuffer.read(10, 10) === NODES.CLAY.code)
  worldBuffer.clear()
})

describe('BiomeNaturalizer — safeSetTile() : écrase une tuile TOPSOIL', () => {
  worldBuffer.init()
  const n = new BiomeNaturalizer()

  worldBuffer.write(10, 10, NODES.DIRT.code) // TOPSOIL
  n.safeSetTile(10, 10, NODES.SAND.code)
  assert('DIRT remplacé par SAND', worldBuffer.read(10, 10) === NODES.SAND.code)
  worldBuffer.clear()
})

describe('BiomeNaturalizer — safeSetTile() : écrase une tuile NATURAL', () => {
  worldBuffer.init()
  const n = new BiomeNaturalizer()

  worldBuffer.write(10, 10, NODES.GRASS.code) // NATURAL
  n.safeSetTile(10, 10, NODES.CLAY.code)
  assert('GRASS remplacé par CLAY', worldBuffer.read(10, 10) === NODES.CLAY.code)
  worldBuffer.clear()
})

describe('BiomeNaturalizer — safeSetTile() : ne remplace pas une tuile GAZ (SKY)', () => {
  worldBuffer.init()
  const n = new BiomeNaturalizer()

  worldBuffer.write(10, 10, NODES.SKY.code)
  n.safeSetTile(10, 10, NODES.CLAY.code)
  assert('SKY non remplacé', worldBuffer.read(10, 10) === NODES.SKY.code)
  worldBuffer.clear()
})

describe('BiomeNaturalizer — safeSetTile() : ne remplace pas une tuile LIQUID (SEA)', () => {
  worldBuffer.init()
  const n = new BiomeNaturalizer()

  worldBuffer.write(10, 10, NODES.SEA.code)
  n.safeSetTile(10, 10, NODES.CLAY.code)
  assert('SEA non remplacé', worldBuffer.read(10, 10) === NODES.SEA.code)
  worldBuffer.clear()
})

describe('BiomeNaturalizer — safeSetTile() : ne remplace pas une tuile ETERNAL (LAVA)', () => {
  worldBuffer.init()
  const n = new BiomeNaturalizer()

  worldBuffer.write(10, 10, NODES.LAVA.code)
  n.safeSetTile(10, 10, NODES.CLAY.code)
  assert('LAVA non remplacé', worldBuffer.read(10, 10) === NODES.LAVA.code)
  worldBuffer.clear()
})

describe('BiomeNaturalizer — safeSetTile() : ne remplace pas une tuile non initialisée (0)', () => {
  worldBuffer.init()
  const n = new BiomeNaturalizer()

  // tuile à 0 par défaut après init
  n.safeSetTile(10, 10, NODES.CLAY.code)
  assert('Tuile 0 non remplacée', worldBuffer.read(10, 10) === 0)
  worldBuffer.clear()
})

describe('BiomeNaturalizer — safeSetTile() : ne propage pas VOID', () => {
  worldBuffer.init()
  const n = new BiomeNaturalizer()

  worldBuffer.write(10, 10, NODES.STONE.code) // SUBSTRAT — normalement migrable
  n.safeSetTile(10, 10, NODES.VOID.code)
  assert('STONE non remplacé par VOID', worldBuffer.read(10, 10) === NODES.STONE.code)
  worldBuffer.clear()
})

describe('BiomeNaturalizer — safeSetTile() : ne propage pas SKY', () => {
  worldBuffer.init()
  const n = new BiomeNaturalizer()

  worldBuffer.write(10, 10, NODES.STONE.code)
  n.safeSetTile(10, 10, NODES.SKY.code)
  assert('STONE non remplacé par SKY', worldBuffer.read(10, 10) === NODES.STONE.code)
  worldBuffer.clear()
})

// ─── applySeaPostProcessing ───────────────────────────────────────────────────

describe('BiomeNaturalizer — applySeaPostProcessing() : tuiles terrain à gauche de leftCliff remplacées par SEA sous SEA_LEVEL', () => {
  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  worldBuffer.init()
  const n = new BiomeNaturalizer()

  // Placer une tuile SUBSTRAT à une position garantie sous SEA_LEVEL et à gauche de la falaise
  const testY = 80 // > SEA_LEVEL (56)
  const testX = 5
  worldBuffer.write(testX, testY, NODES.CLAY.code)

  const leftCliff = new Int16Array(280).fill(50) // falaise à x=50 → testX=5 est à gauche
  const rightCliff = new Int16Array(280).fill(900)
  n.applySeaPostProcessing(leftCliff, rightCliff)

  assert('Tuile terrain sous SEA_LEVEL et à gauche de leftCliff → VOID', worldBuffer.read(testX, testY) === NODES.VOID.code)

  worldBuffer.clear()
})

describe('BiomeNaturalizer — applySeaPostProcessing() : tuiles terrain à gauche de leftCliff remplacées par SKY au-dessus de SEA_LEVEL', () => {
  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  worldBuffer.init()
  const n = new BiomeNaturalizer()

  const testY = 30 // < SEA_LEVEL (56)
  const testX = 5
  worldBuffer.write(testX, testY, NODES.CLAY.code)

  const leftCliff = new Int16Array(280).fill(50)
  const rightCliff = new Int16Array(280).fill(900)
  n.applySeaPostProcessing(leftCliff, rightCliff)

  assert('Tuile terrain au-dessus de SEA_LEVEL et à gauche de leftCliff → SKY', worldBuffer.read(testX, testY) === NODES.SKY.code)
  worldBuffer.clear()
})

describe('BiomeNaturalizer — applySeaPostProcessing() : tuiles ETERNAL non remplacées', () => {
  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  worldBuffer.init()
  const n = new BiomeNaturalizer()

  const testY = 80
  const testX = 5
  worldBuffer.write(testX, testY, NODES.BASALT.code) // ETERNAL

  const leftCliff = new Int16Array(280).fill(50)
  const rightCliff = new Int16Array(280).fill(900)
  n.applySeaPostProcessing(leftCliff, rightCliff)

  assert('BASALT (ETERNAL) non remplacé par la mer', worldBuffer.read(testX, testY) === NODES.BASALT.code)
  worldBuffer.clear()
})

// ─── applyWorldMigration ──────────────────────────────────────────────────────

describe('BiomeNaturalizer — applyWorldMigration() : ne plante pas sur un buffer valide', () => {
  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  worldBuffer.init()
  const n = new BiomeNaturalizer()

  // Remplir le buffer avec une tuile SUBSTRAT valide
  for (let i = 0; i < worldBuffer.world.length; i++) {
    worldBuffer.world[i] = NODES.STONE.code
  }

  const surfaceUnder = new Int16Array(1024).fill(100)
  const underCaverns = new Int16Array(1024).fill(250)
  const vb = makeSingleBiomeVerticalBoundaries(BIOME_TYPE.FOREST)

  let ok = true
  try {
    n.applyWorldMigration(surfaceUnder, underCaverns, vb)
  } catch (_) {
    ok = false
  }
  assert('applyWorldMigration() ne lève pas d\'exception', ok)
  worldBuffer.clear()
})

describe('BiomeNaturalizer — applyWorldMigration() : les tuiles ETERNAL ne sont jamais migrées', () => {
  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  worldBuffer.init()
  const n = new BiomeNaturalizer()

  // Remplir avec STONE, puis placer LAVA (ETERNAL) en position connue
  for (let i = 0; i < worldBuffer.world.length; i++) {
    worldBuffer.world[i] = NODES.STONE.code
  }
  worldBuffer.write(512, 250, NODES.LAVA.code)

  const surfaceUnder = new Int16Array(1024).fill(100)
  const underCaverns = new Int16Array(1024).fill(200)
  const vb = makeSingleBiomeVerticalBoundaries(BIOME_TYPE.FOREST)

  n.applyWorldMigration(surfaceUnder, underCaverns, vb)

  assert('LAVA (ETERNAL) non migré', worldBuffer.read(512, 250) === NODES.LAVA.code)
  worldBuffer.clear()
})

// ─── naturalize — présence de tous les substrats ──────────────────────────────

describe('BiomeNaturalizer — naturalize() : tous les substrats présents dans le monde généré', () => {
  seededRNG.init(SEED)
  seededRNG.randomPerlinInit()
  worldBuffer.init()
  const n = new BiomeNaturalizer()

  const {biomesDescription, leftSeaWidth, rightSeaWidth} = biomesGenerator.generate()
  n.naturalize(biomesDescription, leftSeaWidth, rightSeaWidth)

  const EXPECTED_SET = new Set([
    NODES.SKY.code, NODES.VOID.code,
    NODES.CLAY.code, NODES.SANDSTONE.code, NODES.MUD.code,
    NODES.STONE.code, NODES.ASH.code, NODES.LIMESTONE.code,
    NODES.HARDSTONE.code, NODES.HELLSTONE.code, NODES.SLATE.code
  ])

  const found = new Set()
  const data = worldBuffer.world
  for (let i = 0; i < data.length; i++) {
    const code = data[i]
    if (EXPECTED_SET.has(code)) {
      found.add(code)
      if (found.size === EXPECTED_SET.size) break // court-circuit correct
    }
  }

  for (const code of EXPECTED_SET) {
    assert(`code ${code} (${NODES_LOOKUP[code]?.name ?? '?'}) présent dans le monde`, found.has(code))
  }

  worldBuffer.clear()
})
