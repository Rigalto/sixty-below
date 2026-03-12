/**
 * @file test-liquidfiller.mjs
 * @description Tests unitaires pour LiquidFiller
 *
 * Convention monde de test :
 *   - DEEPSEA sur x=0 et x=1023, toutes hauteurs (ghost cells gauche/droite)
 *   - STONE partout ailleurs (substrat neutre, non-VOID → non inondable)
 *   - Les zones à inonder sont creusées en VOID manuellement
 *   - worldBuffer.init() en début de chaque suite, worldBuffer.clear() en fin
 */

import {describe, assert} from './kernel.mjs'
import {seededRNG} from '../src/utils.mjs'
import {NODES} from '../assets/data/data.mjs'
import {SEA_MAX_WIDTH, SEA_MAX_JITTER} from '../assets/data/data-gen.mjs'
import {worldBuffer, liquidFiller} from '../src/generate.mjs'

const SEED = 'liquidfiller-test'

const SEA_LEVEL = 56   // même valeur que constant.mjs
const W = 1024
const H = 512

const DEEPSEA = NODES.DEEPSEA.code
const STONE   = NODES.STONE.code
const VOID    = NODES.VOID.code
const SEA     = NODES.SEA.code
const SAND    = NODES.SANDSTONE.code

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Remplit tout le buffer avec STONE, puis pose DEEPSEA sur x=0 et x=1023 */
const initWorld = () => {
  worldBuffer.init()
  const data = worldBuffer.world
  data.fill(STONE)
  for (let y = 0; y < H; y++) {
    worldBuffer.write(0,    y, DEEPSEA)
    worldBuffer.write(1023, y, DEEPSEA)
  }
}

/** Creuse un rectangle de VOID (bornes incluses) */
const digRect = (x1, y1, x2, y2) => {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      worldBuffer.write(x, y, VOID)
    }
  }
}

/** Lit une ligne horizontale de x1 à x2 (inclus) à hauteur y */
const readRow = (y, x1, x2) => {
  const row = []
  for (let x = x1; x <= x2; x++) row.push(worldBuffer.read(x, y))
  return row
}

/** Vérifie qu'une séquence contient au moins une tuile SEA suivie de SANDSTONE SANDSTONE puis VOID VOID */
const hasSeaWallVoid = (row) => {
  for (let i = 0; i < row.length - 3; i++) {
    if (row[i] === SEA && row[i + 1] === SAND && row[i + 2] === SAND &&
        row[i + 3] === VOID) return true
  }
  return false
}

// ─── Test 1 : rectangle large touchant le bord gauche ─────────────────────────

describe('LiquidFiller — fillSea - rectangle VOID depuis bord gauche : rempli en SEA', () => {
  seededRNG.init(SEED)
  initWorld()

  // Rectangle : x=1..20, y=SEA_LEVEL..SEA_LEVEL+10 (touche x=0 DEEPSEA)
  digRect(1, SEA_LEVEL, 20, SEA_LEVEL + 10)
  liquidFiller.fillSea()

  let allSea = true
  for (let y = SEA_LEVEL; y <= SEA_LEVEL + 10; y++) {
    for (let x = 1; x <= 20; x++) {
      if (worldBuffer.read(x, y) !== SEA) { allSea = false; break }
    }
    if (!allSea) break
  }
  assert('Rectangle gauche entièrement rempli en SEA', allSea)
  assert('STONE hors rectangle intact (x=21, y=SEA_LEVEL)', worldBuffer.read(21, SEA_LEVEL) === STONE)

  worldBuffer.clear()
})

// ─── Test 2 : rectangle large touchant le bord droit ──────────────────────────

describe('LiquidFiller — fillSea — rectangle VOID depuis bord droit : rempli en SEA', () => {
  seededRNG.init(SEED)
  initWorld()

  // Rectangle : x=1003..1022, y=SEA_LEVEL..SEA_LEVEL+10 (touche x=1023 DEEPSEA)
  digRect(1003, SEA_LEVEL, 1022, SEA_LEVEL + 10)
  liquidFiller.fillSea()

  let allSea = true
  for (let y = SEA_LEVEL; y <= SEA_LEVEL + 10; y++) {
    for (let x = 1003; x <= 1022; x++) {
      if (worldBuffer.read(x, y) !== SEA) { allSea = false; break }
    }
    if (!allSea) break
  }
  assert('Rectangle droit entièrement rempli en SEA', allSea)
  assert('STONE hors rectangle intact (x=1002, y=SEA_LEVEL)', worldBuffer.read(1002, SEA_LEVEL) === STONE)

  worldBuffer.clear()
})

// ─── Test 3 : tunnel horizontal court (ne dépasse pas SEA_MAX_WIDTH) ──────────

describe('LiquidFiller — fillSea — tunnel horizontal court depuis bord gauche : rempli en SEA', () => {
  seededRNG.init(SEED)
  initWorld()

  // Tunnel de 10 tuiles de large, 3 tuiles de haut à SEA_LEVEL
  digRect(1, SEA_LEVEL, 10, SEA_LEVEL + 2)
  liquidFiller.fillSea()

  let allSea = true
  for (let y = SEA_LEVEL; y <= SEA_LEVEL + 2; y++) {
    for (let x = 1; x <= 10; x++) {
      if (worldBuffer.read(x, y) !== SEA) { allSea = false; break }
    }
    if (!allSea) break
  }
  assert('Tunnel horizontal court entièrement rempli en SEA', allSea)

  worldBuffer.clear()
})

// ─── Test 4 : tunnel vertical court depuis SEA_LEVEL ─────────────────────────

describe('LiquidFiller — fillSea — tunnel vertical court : rempli en SEA', () => {
  seededRNG.init(SEED)
  initWorld()

  // Tunnel vertical : x=1..3, y=SEA_LEVEL..SEA_LEVEL+20
  digRect(1, SEA_LEVEL, 3, SEA_LEVEL + 20)
  liquidFiller.fillSea()

  let allSea = true
  for (let y = SEA_LEVEL; y <= SEA_LEVEL + 20; y++) {
    for (let x = 1; x <= 3; x++) {
      if (worldBuffer.read(x, y) !== SEA) { allSea = false; break }
    }
    if (!allSea) break
  }
  assert('Tunnel vertical court entièrement rempli en SEA', allSea)

  worldBuffer.clear()
})

// ─── Test 5 : tunnel horizontal long — mur SANDSTONE côté gauche ──────────────

describe('LiquidFiller — fillSea — tunnel horizontal long gauche : mur SANDSTONE posé', () => {
  seededRNG.init(SEED)
  initWorld()

  // Tunnel de SEA_MAX_WIDTH + SEA_MAX_JITTER + 10 tuiles → dépasse forcément la limite
  const tunnelLength = SEA_MAX_WIDTH + SEA_MAX_JITTER + 10
  digRect(1, SEA_LEVEL, tunnelLength, SEA_LEVEL + 2)
  liquidFiller.fillSea()

  // Lire toute la ligne à SEA_LEVEL de x=1 à x=tunnelLength
  const row = readRow(SEA_LEVEL, 1, tunnelLength)
  assert('Séquence SEA…SANDSTONE SANDSTONE VOID présente (côté gauche)', hasSeaWallVoid(row))

  worldBuffer.clear()
})

// ─── Test 6 : tunnel horizontal long — mur SANDSTONE côté droit ───────────────

describe('LiquidFiller — fillSea — tunnel horizontal long droit : mur SANDSTONE posé', () => {
  seededRNG.init(SEED)
  initWorld()

  const tunnelLength = SEA_MAX_WIDTH + SEA_MAX_JITTER + 10
  const x1 = 1023 - tunnelLength
  digRect(x1, SEA_LEVEL, 1022, SEA_LEVEL + 2)
  liquidFiller.fillSea()

  // Lire la ligne de droite à gauche
  const row = readRow(SEA_LEVEL, x1, 1022).reverse()
  assert('Séquence SEA…SANDSTONE SANDSTONE VOID présente (côté droit)', hasSeaWallVoid(row))

  worldBuffer.clear()
})

// ─── Test 7 : tunnel remontant au-dessus de SEA_LEVEL — l'eau ne dépasse pas ──

describe('LiquidFiller  — fillSea — tunnel remontant : SEA ne dépasse pas SEA_LEVEL', () => {
  seededRNG.init(SEED)
  initWorld()

  // Tunnel en L : horizontal à SEA_LEVEL puis remonte au-dessus
  digRect(1, SEA_LEVEL, 10, SEA_LEVEL + 3)       // segment horizontal
  digRect(8, SEA_LEVEL - 10, 10, SEA_LEVEL - 1)  // segment vertical remontant

  liquidFiller.fillSea()

  // La partie sous SEA_LEVEL est remplie
  let belowOk = true
  for (let x = 1; x <= 10; x++) {
    if (worldBuffer.read(x, SEA_LEVEL) !== SEA) { belowOk = false; break }
  }
  assert('Partie sous SEA_LEVEL remplie en SEA', belowOk)

  // La partie au-dessus de SEA_LEVEL reste VOID (non inondée)
  let aboveOk = true
  for (let y = SEA_LEVEL - 10; y <= SEA_LEVEL - 1; y++) {
    for (let x = 8; x <= 10; x++) {
      if (worldBuffer.read(x, y) === SEA) { aboveOk = false; break }
    }
    if (!aboveOk) break
  }
  assert('Partie au-dessus de SEA_LEVEL non inondée (reste VOID)', aboveOk)

  worldBuffer.clear()
})

// ─── Test 8 : zone non connectée au bord — reste VOID ────────────────────────

describe('LiquidFiller — fillSea — zone VOID non connectée au bord : reste VOID', () => {
  seededRNG.init(SEED)
  initWorld()

  // Poche de VOID au centre, non connectée à x=0 ou x=1023
  digRect(400, SEA_LEVEL, 420, SEA_LEVEL + 5)
  liquidFiller.fillSea()

  let allVoid = true
  for (let y = SEA_LEVEL; y <= SEA_LEVEL + 5; y++) {
    for (let x = 400; x <= 420; x++) {
      if (worldBuffer.read(x, y) !== VOID) { allVoid = false; break }
    }
    if (!allVoid) break
  }
  assert('Zone VOID non connectée reste VOID après fillSea', allVoid)

  worldBuffer.clear()
})

// ─── Test 9 : STONE non remplacé par SEA ──────────────────────────────────────

describe('LiquidFiller — fillSea — tuiles STONE non remplacées par SEA', () => {
  seededRNG.init(SEED)
  initWorld()

  // Tunnel étroit avec STONE intercalé
  digRect(1, SEA_LEVEL, 5, SEA_LEVEL)
  worldBuffer.write(3, SEA_LEVEL, STONE) // obstacle au milieu
  liquidFiller.fillSea()

  assert('STONE intercalé non remplacé', worldBuffer.read(3, SEA_LEVEL) === STONE)
  // x=4 et x=5 ne sont pas connectés — restent VOID
  assert('VOID au-delà de STONE non inondé', worldBuffer.read(4, SEA_LEVEL) === VOID)

  worldBuffer.clear()
})
