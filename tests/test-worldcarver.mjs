// tests/test-worldcarver.mjs
// Lancement : node tests/run.mjs WorldCarver
//
// Tests de WorldCarver.applyTiles() — vérifie le rectangle englobant retourné.
// Pattern : worldBuffer.init() en début de suite, worldBuffer.clear() en fin.

import {describe, assert} from './kernel.mjs'
import {worldCarver, worldBuffer} from '../src/generate.mjs'
import {NODES} from '../assets/data/data.mjs'
import {seededRNG} from '../src/utils.mjs'

// ─── applyTiles — rectangle englobant ────────────────────────────────────────

describe('WorldCarver — applyTiles() : tuile unique → rectangle 1×1', () => {
  worldBuffer.init()

  const tiles = [{x: 10, y: 20, index: (20 << 10) | 10, code: NODES.VOID.code}]
  const rect = worldCarver.applyTiles(tiles)

  assert('x1 === 10', rect.x1 === 10)
  assert('y1 === 20', rect.y1 === 20)
  assert('x2 === 10', rect.x2 === 10)
  assert('y2 === 20', rect.y2 === 20)

  worldBuffer.clear()
})

describe('WorldCarver — applyTiles() : plusieurs tuiles → rectangle englobant correct', () => {
  worldBuffer.init()

  const tiles = [
    {x: 5, y: 10, index: (10 << 10) | 5, code: NODES.VOID.code},
    {x: 15, y: 10, index: (10 << 10) | 15, code: NODES.VOID.code},
    {x: 10, y: 3, index: (3 << 10) | 10, code: NODES.VOID.code},
    {x: 10, y: 25, index: (25 << 10) | 10, code: NODES.VOID.code}
  ]
  const rect = worldCarver.applyTiles(tiles)

  assert('x1 === 5', rect.x1 === 5)
  assert('y1 === 3', rect.y1 === 3)
  assert('x2 === 15', rect.x2 === 15)
  assert('y2 === 25', rect.y2 === 25)

  worldBuffer.clear()
})

describe('WorldCarver — applyTiles() : tuiles protégées exclues du rectangle', () => {
  worldBuffer.init()

  // Placer une tuile SKY en (50, 50) — protégée, ne doit pas influencer le rect
  worldBuffer.write(50, 50, NODES.SKY.code)

  const tiles = [
    {x: 10, y: 10, index: (10 << 10) | 10, code: NODES.VOID.code},
    {x: 20, y: 20, index: (20 << 10) | 20, code: NODES.VOID.code},
    {x: 50, y: 50, index: (50 << 10) | 50, code: NODES.STONE.code} // bloquée par SKY
  ]
  const rect = worldCarver.applyTiles(tiles)

  assert('x1 === 10', rect.x1 === 10)
  assert('y1 === 10', rect.y1 === 10)
  assert('x2 === 20', rect.x2 === 20)
  assert('y2 === 20', rect.y2 === 20)

  worldBuffer.clear()
})

describe('WorldCarver — applyTiles() : tuiles hors bornes exclues du rectangle', () => {
  worldBuffer.init()

  const tiles = [
    {x: 10, y: 10, index: (10 << 10) | 10, code: NODES.VOID.code},
    {x: -1, y: 10, index: (10 << 10) | -1, code: NODES.VOID.code}, // hors borne gauche
    {x: 1024, y: 10, index: (10 << 10) | 1024, code: NODES.VOID.code}, // hors borne droite
    {x: 10, y: -1, index: (-1 << 10) | 10, code: NODES.VOID.code}, // hors borne haut
    {x: 10, y: 512, index: (512 << 10) | 10, code: NODES.VOID.code} // hors borne bas
  ]
  const rect = worldCarver.applyTiles(tiles)

  assert('x1 === 10', rect.x1 === 10)
  assert('y1 === 10', rect.y1 === 10)
  assert('x2 === 10', rect.x2 === 10)
  assert('y2 === 10', rect.y2 === 10)

  worldBuffer.clear()
})

// ─── pathTunnel ───────────────────────────────────────────────────────────────

describe('WorldCarver — pathTunnel() : premier point = (x0, y0)', () => {
  worldBuffer.init()

  const path = worldCarver.pathTunnel(100, 200, 8, 50, 90, 20)

  assert('path[0].x === 100', path[0].x === 100)
  assert('path[0].y === 200', path[0].y === 200)

  worldBuffer.clear()
})

describe('WorldCarver — pathTunnel() : retourne un tableau non vide', () => {
  worldBuffer.init()

  const path = worldCarver.pathTunnel(100, 200, 8, 50, 90, 20)

  assert('path.length >= 2', path.length >= 2)

  worldBuffer.clear()
})

describe('WorldCarver — pathTunnel() : chaque point contient x, y, radiusMin, radiusMax', () => {
  worldBuffer.init()

  const path = worldCarver.pathTunnel(100, 200, 8, 50, 90, 20)
  let ok = true
  for (let i = 0; i < path.length; i++) {
    const p = path[i]
    if (p.x === undefined || p.y === undefined ||
        p.radiusMin === undefined || p.radiusMax === undefined) {
      ok = false; break
    }
  }
  assert('Chaque point a x, y, radiusMin, radiusMax', ok)

  worldBuffer.clear()
})

describe('WorldCarver — pathTunnel() : radiusMin < radiusMax sur tous les points', () => {
  worldBuffer.init()

  const path = worldCarver.pathTunnel(100, 200, 8, 50, 90, 20)
  let ok = true
  for (let i = 0; i < path.length; i++) {
    if (path[i].radiusMin >= path[i].radiusMax) { ok = false; break }
  }
  assert('radiusMin < radiusMax sur tous les points', ok)

  worldBuffer.clear()
})

describe('WorldCarver — pathTunnel() : longueur effective >= maxLength', () => {
  worldBuffer.init()

  const maxLength = 100
  const path = worldCarver.pathTunnel(200, 200, 8, maxLength, 90, 20)

  // La longueur effective est ~25% supérieure à maxLength (facteur 0.8)
  // On vérifie simplement qu'on a assez de points pour couvrir la distance
  let length = 0
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x
    const dy = path[i].y - path[i - 1].y
    length += Math.hypot(dx, dy)
  }
  assert('longueur effective >= maxLength', length >= maxLength)

  worldBuffer.clear()
})

describe('WorldCarver — pathTunnel() : reproductible avec même graine', () => {
  worldBuffer.init()

  seededRNG.init(1234)
  seededRNG.randomPerlinInit()
  const path1 = worldCarver.pathTunnel(100, 200, 8, 50, 90, 20)

  seededRNG.init(1234)
  seededRNG.randomPerlinInit()
  const path2 = worldCarver.pathTunnel(100, 200, 8, 50, 90, 20)

  assert('même longueur', path1.length === path2.length)
  assert('path[1].x identique', path1[1].x === path2[1].x)
  assert('path[1].y identique', path1[1].y === path2[1].y)

  worldBuffer.clear()
})

// ─── isExcluded / addExclusion ────────────────────────────────────────────────

describe('WorldCarver — isExcluded() : liste vide → jamais exclu', () => {
  worldBuffer.init()
  worldCarver.initExclusions()

  assert('aucune exclusion → false', worldCarver.isExcluded(10, 10, 20, 20) === false)

  worldBuffer.clear()
})

describe('WorldCarver — isExcluded() : rectangle identique → exclu', () => {
  worldBuffer.init()
  worldCarver.initExclusions()
  worldCarver.addExclusion({x1: 10, y1: 10, x2: 20, y2: 20})

  assert('rectangle identique → true', worldCarver.isExcluded(10, 10, 20, 20) === true)

  worldBuffer.clear()
})

describe('WorldCarver — isExcluded() : rectangle totalement à gauche → non exclu', () => {
  worldBuffer.init()
  worldCarver.initExclusions()
  worldCarver.addExclusion({x1: 50, y1: 50, x2: 100, y2: 100})

  assert('à gauche → false', worldCarver.isExcluded(10, 50, 40, 100) === false)

  worldBuffer.clear()
})

describe('WorldCarver — isExcluded() : rectangle totalement à droite → non exclu', () => {
  worldBuffer.init()
  worldCarver.initExclusions()
  worldCarver.addExclusion({x1: 50, y1: 50, x2: 100, y2: 100})

  assert('à droite → false', worldCarver.isExcluded(110, 50, 150, 100) === false)

  worldBuffer.clear()
})

describe('WorldCarver — isExcluded() : rectangle totalement au-dessus → non exclu', () => {
  worldBuffer.init()
  worldCarver.initExclusions()
  worldCarver.addExclusion({x1: 50, y1: 50, x2: 100, y2: 100})

  assert('au-dessus → false', worldCarver.isExcluded(50, 10, 100, 40) === false)

  worldBuffer.clear()
})

describe('WorldCarver — isExcluded() : rectangle totalement en-dessous → non exclu', () => {
  worldBuffer.init()
  worldCarver.initExclusions()
  worldCarver.addExclusion({x1: 50, y1: 50, x2: 100, y2: 100})

  assert('en-dessous → false', worldCarver.isExcluded(50, 110, 100, 150) === false)

  worldBuffer.clear()
})

describe('WorldCarver — isExcluded() : chevauchement partiel → exclu', () => {
  worldBuffer.init()
  worldCarver.initExclusions()
  worldCarver.addExclusion({x1: 50, y1: 50, x2: 100, y2: 100})

  assert('chevauchement partiel droite → true', worldCarver.isExcluded(80, 50, 130, 100) === true)
  assert('chevauchement partiel bas → true', worldCarver.isExcluded(50, 80, 100, 130) === true)

  worldBuffer.clear()
})

describe('WorldCarver — isExcluded() : rectangle intérieur → exclu', () => {
  worldBuffer.init()
  worldCarver.initExclusions()
  worldCarver.addExclusion({x1: 50, y1: 50, x2: 100, y2: 100})

  assert('intérieur → true', worldCarver.isExcluded(60, 60, 90, 90) === true)

  worldBuffer.clear()
})

describe('WorldCarver — isExcluded() : rectangle extérieur englobant → exclu', () => {
  worldBuffer.init()
  worldCarver.initExclusions()
  worldCarver.addExclusion({x1: 50, y1: 50, x2: 100, y2: 100})

  assert('englobant → true', worldCarver.isExcluded(40, 40, 110, 110) === true)

  worldBuffer.clear()
})

describe('WorldCarver — isExcluded() : plusieurs exclusions → détecte la bonne', () => {
  worldBuffer.init()
  worldCarver.initExclusions()
  worldCarver.addExclusion({x1: 10, y1: 10, x2: 30, y2: 30})
  worldCarver.addExclusion({x1: 200, y1: 200, x2: 250, y2: 250})

  assert('intersecte la première → true', worldCarver.isExcluded(20, 20, 40, 40) === true)
  assert('intersecte la deuxième → true', worldCarver.isExcluded(220, 220, 260, 260) === true)
  assert('entre les deux → false', worldCarver.isExcluded(50, 50, 150, 150) === false)

  worldBuffer.clear()
})
