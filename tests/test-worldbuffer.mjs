// tests/test-worldbuffer.mjs
// Lancement : node tests/run.mjs WorldBuffer
//
// WorldBuffer est le buffer temporaire utilisé UNIQUEMENT pendant la génération
// d'un nouveau monde. Il n'est jamais actif pendant une session de jeu normale.
//
// Dimensions : 1024 × 512 tuiles — index = (y << 10) | x
// Chunks     : 64 × 32 = 2048 chunks de 16 × 16 tuiles

import {describe, assert} from './kernel.mjs'
import {worldBuffer} from '../src/generate.mjs'

// ─── init ─────────────────────────────────────────────────────────────────────

describe('WorldBuffer — init() : crée un buffer de la bonne taille', () => {
  worldBuffer.init()
  assert('world est un Uint8Array', worldBuffer.world instanceof Uint8Array)
  assert('taille = 1024 * 512 = 524288', worldBuffer.world.length === 524288)
  worldBuffer.clear()
})

describe('WorldBuffer — init() : toutes les tuiles initialisées à 0', () => {
  worldBuffer.init()
  let allZero = true
  for (let i = 0; i < worldBuffer.world.length; i++) {
    if (worldBuffer.world[i] !== 0) { allZero = false; break }
  }
  assert('Toutes les tuiles valent 0', allZero)
  worldBuffer.clear()
})

describe('WorldBuffer — init() : réinitialise un buffer existant', () => {
  worldBuffer.init()
  worldBuffer.write(10, 10, 42)
  worldBuffer.init() // réinitialisation
  assert('La tuile (10,10) est remise à 0 après init()', worldBuffer.read(10, 10) === 0)
  worldBuffer.clear()
})

// ─── clear ────────────────────────────────────────────────────────────────────

describe('WorldBuffer — clear() : libère le buffer (world devient null)', () => {
  worldBuffer.init()
  worldBuffer.clear()
  assert('world vaut null après clear()', worldBuffer.world === null)
})

// ─── write / read ─────────────────────────────────────────────────────────────

describe('WorldBuffer — write() / read() : lecture après écriture', () => {
  worldBuffer.init()
  worldBuffer.write(0, 0, 1)
  worldBuffer.write(100, 50, 127)
  worldBuffer.write(1023, 511, 255)
  assert('(0, 0) = 1', worldBuffer.read(0, 0) === 1)
  assert('(100, 50) = 127', worldBuffer.read(100, 50) === 127)
  assert('(1023, 511) = 255', worldBuffer.read(1023, 511) === 255)
  worldBuffer.clear()
})

describe('WorldBuffer — write() / read() : coin haut-gauche (0, 0)', () => {
  worldBuffer.init()
  worldBuffer.write(0, 0, 99)
  assert('(0, 0) = 99', worldBuffer.read(0, 0) === 99)
  worldBuffer.clear()
})

describe('WorldBuffer — write() / read() : coin bas-droite (1023, 511)', () => {
  worldBuffer.init()
  worldBuffer.write(1023, 511, 88)
  assert('(1023, 511) = 88', worldBuffer.read(1023, 511) === 88)
  worldBuffer.clear()
})

describe('WorldBuffer — write() : écrase la valeur précédente', () => {
  worldBuffer.init()
  worldBuffer.write(50, 50, 10)
  worldBuffer.write(50, 50, 20)
  assert('(50, 50) = 20 après double écriture', worldBuffer.read(50, 50) === 20)
  worldBuffer.clear()
})

describe('WorldBuffer — write() : n\'affecte pas les tuiles voisines', () => {
  worldBuffer.init()
  worldBuffer.write(50, 50, 42)
  assert('(49, 50) non affectée', worldBuffer.read(49, 50) === 0)
  assert('(51, 50) non affectée', worldBuffer.read(51, 50) === 0)
  assert('(50, 49) non affectée', worldBuffer.read(50, 49) === 0)
  assert('(50, 51) non affectée', worldBuffer.read(50, 51) === 0)
  worldBuffer.clear()
})

// ─── writeAt / readAt ─────────────────────────────────────────────────────────

describe('WorldBuffer — writeAt() / readAt() : cohérence avec write/read', () => {
  worldBuffer.init()
  const x = 200
  const y = 100
  const index = (y << 10) | x
  worldBuffer.writeAt(index, 77)
  assert('readAt(index) = 77', worldBuffer.readAt(index) === 77)
  assert('read(x, y) = 77', worldBuffer.read(x, y) === 77)
  worldBuffer.clear()
})

describe('WorldBuffer — writeAt() / readAt() : index 0 (origine)', () => {
  worldBuffer.init()
  worldBuffer.writeAt(0, 55)
  assert('readAt(0) = 55', worldBuffer.readAt(0) === 55)
  assert('read(0, 0) = 55', worldBuffer.read(0, 0) === 55)
  worldBuffer.clear()
})

describe('WorldBuffer — writeAt() / readAt() : dernier index (524287)', () => {
  worldBuffer.init()
  worldBuffer.writeAt(524287, 33)
  assert('readAt(524287) = 33', worldBuffer.readAt(524287) === 33)
  assert('read(1023, 511) = 33', worldBuffer.read(1023, 511) === 33)
  worldBuffer.clear()
})

describe('WorldBuffer — writeAt() : n\'affecte pas les index voisins', () => {
  worldBuffer.init()
  const index = (100 << 10) | 100
  worldBuffer.writeAt(index, 42)
  assert('index - 1 non affecté', worldBuffer.readAt(index - 1) === 0)
  assert('index + 1 non affecté', worldBuffer.readAt(index + 1) === 0)
  worldBuffer.clear()
})

// ─── getter world ─────────────────────────────────────────────────────────────

describe('WorldBuffer — world : accès direct cohérent avec read/write', () => {
  worldBuffer.init()
  worldBuffer.write(300, 200, 111)
  const index = (200 << 10) | 300
  assert('world[index] = 111', worldBuffer.world[index] === 111)
  worldBuffer.clear()
})

describe('WorldBuffer — world : modification directe visible par read()', () => {
  worldBuffer.init()
  const index = (10 << 10) | 10
  worldBuffer.world[index] = 222
  assert('read(10, 10) = 222 après écriture directe', worldBuffer.read(10, 10) === 222)
  worldBuffer.clear()
})

// ─── processWorldToChunks ─────────────────────────────────────────────────────

describe('WorldBuffer — processWorldToChunks() : retourne 2048 chunks', () => {
  worldBuffer.init()
  const chunks = worldBuffer.processWorldToChunks()
  assert('2048 chunks retournés', chunks.length === 2048)
  worldBuffer.clear()
})

describe('WorldBuffer — processWorldToChunks() : chaque chunk a une clé et 256 octets', () => {
  worldBuffer.init()
  const chunks = worldBuffer.processWorldToChunks()
  let ok = true
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].key !== i || !(chunks[i].chunk instanceof Uint8Array) || chunks[i].chunk.length !== 256) {
      ok = false; break
    }
  }
  assert('key séquentielle, chunk Uint8Array de 256 octets', ok)
  worldBuffer.clear()
})

describe('WorldBuffer — processWorldToChunks() : chunk 0 correspond au coin (0,0)', () => {
  worldBuffer.init()
  worldBuffer.write(0, 0, 10) // tuile (0,0) → chunk 0, offset 0
  worldBuffer.write(15, 0, 20) // tuile (15,0) → chunk 0, offset 15
  worldBuffer.write(0, 15, 30) // tuile (0,15) → chunk 0, offset 15*16=240
  const chunks = worldBuffer.processWorldToChunks()
  assert('chunk[0][0] = 10', chunks[0].chunk[0] === 10)
  assert('chunk[0][15] = 20', chunks[0].chunk[15] === 20)
  assert('chunk[0][240] = 30', chunks[0].chunk[240] === 30)
  worldBuffer.clear()
})

describe('WorldBuffer — processWorldToChunks() : chunk 1 correspond aux tuiles (16-31, 0)', () => {
  worldBuffer.init()
  worldBuffer.write(16, 0, 50) // tuile (16,0) → chunk 1, offset 0
  worldBuffer.write(31, 0, 60) // tuile (31,0) → chunk 1, offset 15
  const chunks = worldBuffer.processWorldToChunks()
  assert('chunk[1][0] = 50', chunks[1].chunk[0] === 50)
  assert('chunk[1][15] = 60', chunks[1].chunk[15] === 60)
  worldBuffer.clear()
})

describe('WorldBuffer — processWorldToChunks() : buffer vierge → tous les chunks à 0', () => {
  worldBuffer.init()
  const chunks = worldBuffer.processWorldToChunks()
  let allZero = true
  for (const c of chunks) {
    for (let i = 0; i < c.chunk.length; i++) {
      if (c.chunk[i] !== 0) { allZero = false; break }
    }
    if (!allZero) { break }
  }
  assert('Tous les chunks à 0 sur buffer vierge', allZero)
  worldBuffer.clear()
})

describe('WorldBuffer — processWorldToChunks() : dernier chunk (2047) correspond au coin (1008-1023, 496-511)', () => {
  worldBuffer.init()
  worldBuffer.write(1008, 496, 77) // tuile (1008,496) → chunk 2047, offset 0
  worldBuffer.write(1023, 511, 88) // tuile (1023,511) → chunk 2047, offset 255
  const chunks = worldBuffer.processWorldToChunks()
  assert('chunk[2047][0] = 77', chunks[2047].chunk[0] === 77)
  assert('chunk[2047][255] = 88', chunks[2047].chunk[255] === 88)
  worldBuffer.clear()
})

// ─── snapshot ─────────────────────────────────────────────────────────────────

describe('WorldBuffer — snapshot() : retourne un Uint8Array', () => {
  worldBuffer.init()
  const snap = worldBuffer.snapshot()
  assert('snapshot est un Uint8Array', snap instanceof Uint8Array)
  assert('snapshot a la même taille que le buffer', snap.length === 524288)
  worldBuffer.clear()
})

describe('WorldBuffer — snapshot() : les valeurs sont identiques au moment du snapshot', () => {
  worldBuffer.init()
  worldBuffer.write(10, 10, 42)
  worldBuffer.write(500, 200, 99)
  const snap = worldBuffer.snapshot()
  assert('snap(10,10) = 42', snap[(10 << 10) | 10] === 42)
  assert('snap(500,200) = 99', snap[(200 << 10) | 500] === 99)
  worldBuffer.clear()
})

describe('WorldBuffer — snapshot() : modification du snapshot n\'affecte pas le buffer', () => {
  worldBuffer.init()
  worldBuffer.write(50, 50, 77)
  const snap = worldBuffer.snapshot()
  snap[(50 << 10) | 50] = 255
  assert('Le buffer original est inchangé', worldBuffer.read(50, 50) === 77)
  worldBuffer.clear()
})

describe('WorldBuffer — snapshot() : modification du buffer n\'affecte pas le snapshot', () => {
  worldBuffer.init()
  worldBuffer.write(50, 50, 77)
  const snap = worldBuffer.snapshot()
  worldBuffer.write(50, 50, 255)
  assert('Le snapshot est inchangé', snap[(50 << 10) | 50] === 77)
  worldBuffer.clear()
})
