// tests/test-clustergenerator.mjs
// Lancement : node tests/run.mjs ClusterGenerator
//
// Stratégie :
//   - Vérification de la structure du résultat (type, champs, cohérence)
//   - Invariants géométriques (ghost cells, unicité, 4-connexité)
//   - Reproductibilité (même graine → même résultat)
//   - Robustesse (size=1, size non atteignable)

import {describe, assert} from './kernel.mjs'
import {clusterGenerator, worldBuffer} from '../src/generate.mjs'
import {seededRNG} from '../src/utils.mjs'
import {NODES} from '../assets/data/data.mjs'

const SEED = 42
const ITERATIONS = 200

// ─── Structure du résultat ────────────────────────────────────────────────────

describe('ClusterGenerator — randomWalkCluster() : retourne un Array', () => {
  seededRNG.init(SEED)
  const result = clusterGenerator.randomWalkCluster(512, 256, 10, 5)
  assert('Résultat est un Array', Array.isArray(result))
})

describe('ClusterGenerator — randomWalkCluster() : chaque entrée a les champs x, y, index, code', () => {
  seededRNG.init(SEED)
  const result = clusterGenerator.randomWalkCluster(512, 256, 20, 7)
  let ok = true
  for (const entry of result) {
    if (
      typeof entry.x !== 'number' ||
      typeof entry.y !== 'number' ||
      typeof entry.index !== 'number' ||
      typeof entry.code !== 'number'
    ) { ok = false; break }
  }
  assert('Tous les champs sont des numbers', ok)
})

describe('ClusterGenerator — randomWalkCluster() : index = (y << 10) | x', () => {
  seededRNG.init(SEED)
  const result = clusterGenerator.randomWalkCluster(512, 256, 20, 3)
  let ok = true
  for (const entry of result) {
    if (entry.index !== ((entry.y << 10) | entry.x)) { ok = false; break }
  }
  assert('index cohérent avec x et y', ok)
})

describe('ClusterGenerator — randomWalkCluster() : code propagé à toutes les entrées', () => {
  seededRNG.init(SEED)
  const CODE = 42
  const result = clusterGenerator.randomWalkCluster(512, 256, 15, CODE)
  let ok = true
  for (const entry of result) {
    if (entry.code !== CODE) { ok = false; break }
  }
  assert('code identique sur toutes les tuiles', ok)
})

// ─── Taille du cluster ────────────────────────────────────────────────────────

describe('ClusterGenerator — randomWalkCluster() : taille exacte atteinte (centre monde)', () => {
  seededRNG.init(SEED)
  const size = 50
  const result = clusterGenerator.randomWalkCluster(512, 256, size, 1)
  assert(`Cluster de taille ${size}`, result.length === size)
})

describe('ClusterGenerator — randomWalkCluster() : size=1 retourne exactement la tuile de départ', () => {
  seededRNG.init(SEED)
  const result = clusterGenerator.randomWalkCluster(512, 256, 1, 9)
  assert('1 seule tuile', result.length === 1)
  assert('x = x0', result[0].x === 512)
  assert('y = y0', result[0].y === 256)
})

describe('ClusterGenerator — randomWalkCluster() : pas de doublons dans le résultat', () => {
  seededRNG.init(SEED)
  const result = clusterGenerator.randomWalkCluster(512, 256, 80, 2)
  const seen = new Set()
  let ok = true
  for (const entry of result) {
    if (seen.has(entry.index)) { ok = false; break }
    seen.add(entry.index)
  }
  assert('Aucun doublon d\'index', ok)
})

// ─── Invariants géométriques ──────────────────────────────────────────────────

describe('ClusterGenerator — randomWalkCluster() : ghost cells jamais incluses (x)', () => {
  seededRNG.init(SEED)
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    seededRNG.init(i)
    const result = clusterGenerator.randomWalkCluster(512, 256, 30, 1)
    for (const entry of result) {
      if (entry.x <= 1 || entry.x >= 1022) { ok = false; break }
    }
    if (!ok) break
  }
  assert('x toujours dans ]1, 1022[', ok)
})

describe('ClusterGenerator — randomWalkCluster() : ghost cells jamais incluses (y)', () => {
  seededRNG.init(SEED)
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    seededRNG.init(i)
    const result = clusterGenerator.randomWalkCluster(512, 256, 30, 1)
    for (const entry of result) {
      if (entry.y <= 1 || entry.y >= 510) { ok = false; break }
    }
    if (!ok) break
  }
  assert('y toujours dans ]1, 510[', ok)
})

describe('ClusterGenerator — randomWalkCluster() : cluster 4-connexe (chaque tuile voisine d\'une autre)', () => {
  seededRNG.init(SEED)
  const result = clusterGenerator.randomWalkCluster(512, 256, 60, 1)
  const keys = new Set()
  for (const entry of result) { keys.add(entry.index) }

  // La tuile de départ est trivellement connectée
  // Pour chaque autre tuile, au moins un de ses 4 voisins doit être dans le cluster
  let ok = true
  for (const entry of result) {
    if (entry.x === 512 && entry.y === 256) continue
    const n = ((entry.y - 1) << 10) | entry.x
    const s = ((entry.y + 1) << 10) | entry.x
    const w = (entry.y << 10) | (entry.x - 1)
    const e = (entry.y << 10) | (entry.x + 1)
    if (!keys.has(n) && !keys.has(s) && !keys.has(w) && !keys.has(e)) { ok = false; break }
  }
  assert('Chaque tuile a au moins un voisin dans le cluster', ok)
})

// ─── Reproductibilité ─────────────────────────────────────────────────────────

describe('ClusterGenerator — randomWalkCluster() : même graine → même résultat', () => {
  seededRNG.init(SEED)
  const r1 = clusterGenerator.randomWalkCluster(512, 256, 40, 5)

  seededRNG.init(SEED)
  const r2 = clusterGenerator.randomWalkCluster(512, 256, 40, 5)

  let ok = r1.length === r2.length
  if (ok) {
    for (let i = 0; i < r1.length; i++) {
      if (r1[i].index !== r2[i].index) { ok = false; break }
    }
  }
  assert('Résultats identiques avec la même graine', ok)
})

describe('ClusterGenerator — randomWalkCluster() : graines différentes → résultats différents', () => {
  seededRNG.init(SEED)
  const r1 = clusterGenerator.randomWalkCluster(512, 256, 40, 5)

  seededRNG.init(SEED + 1)
  const r2 = clusterGenerator.randomWalkCluster(512, 256, 40, 5)

  let differs = false
  for (let i = 0; i < r1.length; i++) {
    if (r1[i].index !== r2[i].index) { differs = true; break }
  }
  assert('Résultats différents avec des graines différentes', differs)
})

// ─── Sans effet de bord ───────────────────────────────────────────────────────

describe('ClusterGenerator — randomWalkCluster() : deux appels successifs sans init → résultats différents', () => {
  seededRNG.init(SEED)
  const r1 = clusterGenerator.randomWalkCluster(512, 256, 30, 1)
  const r2 = clusterGenerator.randomWalkCluster(512, 256, 30, 1)

  // Le RNG avance entre les deux appels → les clusters doivent différer
  let differs = false
  for (let i = 0; i < r1.length; i++) {
    if (r1[i].index !== r2[i].index) { differs = true; break }
  }
  assert('Deux appels consécutifs consomment le RNG', differs)
})

// ─── scatterClusters ──────────────────────────────────────────────────────────

describe('ClusterGenerator — scatterClusters() : retourne un Array', () => {
  seededRNG.init(SEED)
  const result = clusterGenerator.scatterClusters(100, 100, 200, 200, 0.01, 5)
  assert('Résultat est un Array', Array.isArray(result))
})

describe('ClusterGenerator — scatterClusters() : chaque entrée a les champs x, y, index, code', () => {
  seededRNG.init(SEED)
  const result = clusterGenerator.scatterClusters(100, 100, 200, 200, 0.01, 5)
  let ok = true
  for (const entry of result) {
    if (
      typeof entry.x !== 'number' ||
      typeof entry.y !== 'number' ||
      typeof entry.index !== 'number' ||
      typeof entry.code !== 'number'
    ) { ok = false; break }
  }
  assert('Tous les champs sont des numbers', ok)
})

describe('ClusterGenerator — scatterClusters() : count minimum = 5', () => {
  seededRNG.init(SEED)
  // Rectangle minuscule → surface * percent < 5 → count forcé à 5
  // sizeMin=1, sizeMax=1 → chaque cluster = 1 tuile → result.length = count exact
  const result = clusterGenerator.scatterClusters(100, 100, 101, 101, 0.0001, 5, 1, 1)
  assert('Au moins 5 tuiles produites', result.length >= 5)
})

describe('ClusterGenerator — scatterClusters() : code propagé à toutes les entrées', () => {
  seededRNG.init(SEED)
  const CODE = 21
  const result = clusterGenerator.scatterClusters(100, 100, 200, 200, 0.01, CODE)
  let ok = true
  for (const entry of result) {
    if (entry.code !== CODE) { ok = false; break }
  }
  assert('code identique sur toutes les tuiles', ok)
})

describe('ClusterGenerator — scatterClusters() : même graine → même résultat', () => {
  seededRNG.init(SEED)
  const r1 = clusterGenerator.scatterClusters(100, 100, 200, 200, 0.01, 5)

  seededRNG.init(SEED)
  const r2 = clusterGenerator.scatterClusters(100, 100, 200, 200, 0.01, 5)

  let ok = r1.length === r2.length
  if (ok) {
    for (let i = 0; i < r1.length; i++) {
      if (r1[i].index !== r2[i].index) { ok = false; break }
    }
  }
  assert('Résultats identiques avec la même graine', ok)
})

// ─── applyTiles ───────────────────────────────────────────────────────────────

describe('ClusterGenerator — applyTiles() : écrit les tuiles dans worldBuffer', () => {
  worldBuffer.init()
  // Remplissage avec STONE
  const data = worldBuffer.world
  data.fill(NODES.STONE.code)

  seededRNG.init(SEED)
  const tiles = clusterGenerator.scatterClusters(100, 100, 200, 200, 0.01, NODES.CLAY.code)
  clusterGenerator.applyTiles(tiles)

  let ok = false
  for (const tile of tiles) {
    if (worldBuffer.read(tile.x, tile.y) === NODES.CLAY.code) { ok = true; break }
  }
  assert('Au moins une tuile CLAY écrite dans le buffer', ok)
  worldBuffer.clear()
})

describe('ClusterGenerator — applyTiles() : ne remplace pas SKY', () => {
  worldBuffer.init()
  worldBuffer.world.fill(NODES.SKY.code)

  seededRNG.init(SEED)
  const tiles = clusterGenerator.scatterClusters(100, 100, 200, 200, 0.01, NODES.CLAY.code)
  clusterGenerator.applyTiles(tiles)

  let ok = true
  for (const tile of tiles) {
    if (tile.x < 0 || tile.x >= 1024 || tile.y < 0 || tile.y >= 512) continue
    if (worldBuffer.read(tile.x, tile.y) !== NODES.SKY.code) { ok = false; break }
  }
  assert('SKY jamais remplacé', ok)
  worldBuffer.clear()
})

describe('ClusterGenerator — applyTiles() : ne remplace pas SEA', () => {
  worldBuffer.init()
  worldBuffer.world.fill(NODES.SEA.code)

  seededRNG.init(SEED)
  const tiles = clusterGenerator.scatterClusters(100, 100, 200, 200, 0.01, NODES.CLAY.code)
  clusterGenerator.applyTiles(tiles)

  let ok = true
  for (const tile of tiles) {
    if (tile.x < 0 || tile.x >= 1024 || tile.y < 0 || tile.y >= 512) continue
    if (worldBuffer.read(tile.x, tile.y) !== NODES.SEA.code) { ok = false; break }
  }
  assert('SEA jamais remplacé', ok)
  worldBuffer.clear()
})

describe('ClusterGenerator — applyTiles() : ne remplace pas DEEPSEA', () => {
  worldBuffer.init()
  worldBuffer.world.fill(NODES.DEEPSEA.code)

  seededRNG.init(SEED)
  const tiles = clusterGenerator.scatterClusters(100, 100, 200, 200, 0.01, NODES.CLAY.code)
  clusterGenerator.applyTiles(tiles)

  let ok = true
  for (const tile of tiles) {
    if (tile.x < 0 || tile.x >= 1024 || tile.y < 0 || tile.y >= 512) continue
    if (worldBuffer.read(tile.x, tile.y) !== NODES.DEEPSEA.code) { ok = false; break }
  }
  assert('DEEPSEA jamais remplacé', ok)
  worldBuffer.clear()
})

describe('ClusterGenerator — applyTiles() : ne remplace pas BASALT (ETERNAL)', () => {
  worldBuffer.init()
  worldBuffer.world.fill(NODES.BASALT.code)

  seededRNG.init(SEED)
  const tiles = clusterGenerator.scatterClusters(100, 100, 200, 200, 0.01, NODES.CLAY.code)
  clusterGenerator.applyTiles(tiles)

  let ok = true
  for (const tile of tiles) {
    if (tile.x < 0 || tile.x >= 1024 || tile.y < 0 || tile.y >= 512) continue
    if (worldBuffer.read(tile.x, tile.y) !== NODES.BASALT.code) { ok = false; break }
  }
  assert('BASALT jamais remplacé', ok)
  worldBuffer.clear()
})

describe('ClusterGenerator — applyTiles() : ne remplace pas LAVA (ETERNAL)', () => {
  worldBuffer.init()
  worldBuffer.world.fill(NODES.LAVA.code)

  seededRNG.init(SEED)
  const tiles = clusterGenerator.scatterClusters(100, 100, 200, 200, 0.01, NODES.CLAY.code)
  clusterGenerator.applyTiles(tiles)

  let ok = true
  for (const tile of tiles) {
    if (tile.x < 0 || tile.x >= 1024 || tile.y < 0 || tile.y >= 512) continue
    if (worldBuffer.read(tile.x, tile.y) !== NODES.LAVA.code) { ok = false; break }
  }
  assert('LAVA jamais remplacé', ok)
  worldBuffer.clear()
})

describe('ClusterGenerator — applyTiles() : remplace VOID (creusement postérieur)', () => {
  worldBuffer.init()
  worldBuffer.world.fill(NODES.VOID.code)

  seededRNG.init(SEED)
  const tiles = clusterGenerator.scatterClusters(100, 100, 200, 200, 0.01, NODES.CLAY.code)
  clusterGenerator.applyTiles(tiles)

  let ok = false
  for (const tile of tiles) {
    if (tile.x < 0 || tile.x >= 1024 || tile.y < 0 || tile.y >= 512) continue
    if (worldBuffer.read(tile.x, tile.y) === NODES.CLAY.code) { ok = true; break }
  }
  assert('VOID remplacé par CLAY', ok)
  worldBuffer.clear()
})
