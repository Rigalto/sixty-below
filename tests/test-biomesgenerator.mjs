// tests/test-biomesgen.mjs
// Lancement : node tests/run.mjs BiomesGen
//
// Tests de robustesse sur BiomesGenerator.generate() — 10 000 itérations par suite.
// biomesGenerator.generate() retourne uniquement la description des biomes de surface
// (pas de tuiles, pas de WorldBuffer). Ces tests vérifient les invariants structurels
// sur l'ensemble des graines possibles.
//
// Rappel des contraintes :
//   - Largeur totale du monde : 1024 tuiles (64 chunks * 16)
//   - Largeur minimum par zone : 3 chunks = 48 tuiles
//   - Biomes requis : FOREST, DESERT, JUNGLE (au moins une zone chacun)
//   - Pas deux zones identiques consécutives
//   - Centre du monde (chunks 30 et 31, tuiles 480–511) : toujours FOREST

import {describe, assert} from './kernel.mjs'
import {biomesGenerator} from '../src/generate.mjs'
import {BIOME_TYPE} from '../assets/data/data.mjs'
import {seededRNG} from '../src/utils.mjs'

const ITERATIONS = 10000
const REQUIRED_BIOMES = [BIOME_TYPE.DESERT, BIOME_TYPE.JUNGLE, BIOME_TYPE.FOREST]
const MIN_WIDTH_TILES = 3 * 16 // 3 chunks * 16 tuiles
const EXPECTED_TOTAL = 1024 // tuiles

// Helper : construit un tileMap[1024] depuis biomesDescription
function buildTileMap (biomesDescription) {
  const tileMap = new Int32Array(EXPECTED_TOTAL)
  let cursor = 0
  for (const zone of biomesDescription) {
    for (let t = 0; t < zone.width; t++) {
      tileMap[cursor + t] = zone.biome
    }
    cursor += zone.width
  }
  return tileMap
}

// ─── Invariants structurels ───────────────────────────────────────────────────

describe('BiomesGenerator — largeur totale = 1024 tuiles sur ' + ITERATIONS + ' graines', () => {
  let errors = 0
  for (let i = 0; i < ITERATIONS; i++) {
    seededRNG.init(i)
    const {biomesDescription} = biomesGenerator.generate()
    let total = 0
    for (const zone of biomesDescription) { total += zone.width }
    if (total !== EXPECTED_TOTAL) { errors++; break }
  }
  assert('Aucune erreur de largeur totale', errors === 0)
})

describe('BiomesGenerator — chaque zone ≥ ' + MIN_WIDTH_TILES + ' tuiles sur ' + ITERATIONS + ' graines', () => {
  let errors = 0
  for (let i = 0; i < ITERATIONS; i++) {
    seededRNG.init(i)
    const {biomesDescription} = biomesGenerator.generate()
    for (const zone of biomesDescription) {
      if (zone.width < MIN_WIDTH_TILES) { errors++; break }
    }
  }
  assert('Aucune zone trop étroite', errors === 0)
})

describe('BiomesGenerator — FOREST, DESERT et JUNGLE présents sur ' + ITERATIONS + ' graines', () => {
  let errors = 0
  for (let i = 0; i < ITERATIONS; i++) {
    seededRNG.init(i)
    const {biomesDescription} = biomesGenerator.generate()
    const present = new Set()
    for (const zone of biomesDescription) { present.add(zone.biome) }
    for (const required of REQUIRED_BIOMES) {
      if (!present.has(required)) { errors++; break }
    }
  }
  assert('Aucune graine sans diversité de biomes', errors === 0)
})

describe('BiomesGenerator — pas deux zones identiques consécutives sur ' + ITERATIONS + ' graines', () => {
  let errors = 0
  for (let i = 0; i < ITERATIONS; i++) {
    seededRNG.init(i)
    const {biomesDescription} = biomesGenerator.generate()
    let lastBiome = -1
    for (const zone of biomesDescription) {
      if (zone.biome === lastBiome) { errors++; break }
      lastBiome = zone.biome
    }
  }
  assert('Aucune zone consécutive identique', errors === 0)
})

describe('BiomesGenerator — centre du monde (tuiles 480–511) toujours FOREST sur ' + ITERATIONS + ' graines', () => {
  let errors = 0
  for (let i = 0; i < ITERATIONS; i++) {
    seededRNG.init(i)
    const {biomesDescription} = biomesGenerator.generate()
    const tileMap = buildTileMap(biomesDescription)
    // Chunk 30 : tuiles 480–495, Chunk 31 : tuiles 496–511
    let ok = true
    for (let t = 480; t < 512; t++) {
      if (tileMap[t] !== BIOME_TYPE.FOREST) { ok = false; break }
    }
    if (!ok) { errors++; break }
  }
  assert('Centre toujours FOREST', errors === 0)
})

// ─── Structure de retour ──────────────────────────────────────────────────────

describe('BiomesGenerator — generate() retourne biomesDescription, leftSeaWidth, rightSeaWidth', () => {
  seededRNG.init('structure-test')
  const result = biomesGenerator.generate()
  assert('biomesDescription est un Array', Array.isArray(result.biomesDescription))
  assert('leftSeaWidth est un number', typeof result.leftSeaWidth === 'number')
  assert('rightSeaWidth est un number', typeof result.rightSeaWidth === 'number')
})

describe('BiomesGenerator — chaque zone contient biome, width et offset', () => {
  seededRNG.init('zone-structure')
  const {biomesDescription} = biomesGenerator.generate()
  let ok = true
  for (const zone of biomesDescription) {
    if (zone.biome === undefined || zone.width === undefined || zone.offset === undefined) {
      ok = false; break
    }
  }
  assert('Chaque zone a biome, width et offset', ok)
})

describe('BiomesGenerator — offsets croissants et cohérents avec les widths', () => {
  seededRNG.init('offset-test')
  const {biomesDescription} = biomesGenerator.generate()
  let expectedOffset = 0
  let ok = true
  for (const zone of biomesDescription) {
    if (zone.offset !== expectedOffset) { ok = false; break }
    expectedOffset += zone.width
  }
  assert('Offsets croissants et cohérents', ok)
})

describe('BiomesGenerator — leftSeaWidth + rightSeaWidth = 7 chunks', () => {
  let errors = 0
  for (let i = 0; i < ITERATIONS; i++) {
    seededRNG.init(i)
    const {leftSeaWidth, rightSeaWidth} = biomesGenerator.generate()
    if (leftSeaWidth + rightSeaWidth !== 7) { errors++; break }
    if (leftSeaWidth !== 3 && leftSeaWidth !== 4) { errors++; break }
  }
  assert('leftSeaWidth + rightSeaWidth toujours 7', errors === 0)
  assert('leftSeaWidth toujours 3 ou 4', errors === 0)
})
