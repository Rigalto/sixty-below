// tests/test-seededrng.mjs
// Lancement : node tests/run.mjs SeededRNG
//
// Stratégie :
//   - Vérification d'interface (type de retour, bornes) sans valeurs exactes
//   - Tests de reproductibilité (même graine → même séquence)
//   - Tests de robustesse par répétition (10 000 itérations pour fonctions scalaires,
//     1 000 pour Perlin)
//   - intFract et cosineInterpolation testés en fin de fichier

import {describe, assert} from './kernel.mjs'
import {SeededRNG, intFract, cosineInterpolation} from '../src/utils.mjs'

const ITERATIONS = 10000
const PERLIN_ITERATIONS = 1000

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Crée une instance fraîche avec une graine fixe
function rng (seed = 'test') {
  const r = new SeededRNG()
  r.init(seed)
  return r
}

// Crée une instance en mode Math.random (sans graine)
function rngRandom () {
  const r = new SeededRNG()
  r.init()
  return r
}

// ─── init ─────────────────────────────────────────────────────────────────────

describe('SeededRNG — init() : mode déterministe avec graine string', () => {
  const r1 = rng('abc')
  const r2 = rng('abc')
  const v1 = r1.randomGet()
  const v2 = r2.randomGet()
  assert('Même graine string → même première valeur', v1 === v2)
})

describe('SeededRNG — init() : mode déterministe avec graine number', () => {
  const r1 = rng(42)
  const r2 = rng(42)
  assert('Même graine number → même séquence', r1.randomGet() === r2.randomGet())
})

describe('SeededRNG — init() : graines différentes → séquences différentes', () => {
  const r1 = rng('abc')
  const r2 = rng('xyz')
  // On tire 10 valeurs — la probabilité que toutes soient identiques est négligeable
  let allSame = true
  for (let i = 0; i < 10; i++) {
    if (r1.randomGet() !== r2.randomGet()) { allSame = false; break }
  }
  assert('Graines différentes → séquences différentes', !allSame)
})

describe('SeededRNG — init() : réinitialisation avec même graine rejoue la séquence', () => {
  const r = rng('replay')
  const seq1 = []
  for (let i = 0; i < 5; i++) { seq1.push(r.randomGet()) }

  r.init('replay')
  const seq2 = []
  for (let i = 0; i < 5; i++) { seq2.push(r.randomGet()) }

  let identical = true
  for (let i = 0; i < 5; i++) { if (seq1[i] !== seq2[i]) { identical = false; break } }
  assert('Réinit avec même graine → séquence identique', identical)
})

describe('SeededRNG — init() : mode aléatoire (sans graine) ne plante pas', () => {
  const r = rngRandom()
  let ok = true
  try {
    for (let i = 0; i < 100; i++) { r.randomGet() }
  } catch (_) { ok = false }
  assert('Mode Math.random() fonctionne sans erreur', ok)
})

// ─── randomGet ────────────────────────────────────────────────────────────────

describe('SeededRNG — randomGet() : retourne un float dans [0, 1[', () => {
  const r = rng()
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomGet()
    if (v < 0 || v >= 1) { ok = false; break }
  }
  assert(`[0, 1[ vérifié sur ${ITERATIONS} itérations`, ok)
})

// ─── randomGetBool ────────────────────────────────────────────────────────────

describe('SeededRNG — randomGetBool() : retourne uniquement true ou false', () => {
  const r = rng()
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomGetBool()
    if (v !== true && v !== false) { ok = false; break }
  }
  assert(`boolean strict vérifié sur ${ITERATIONS} itérations`, ok)
})

describe('SeededRNG — randomGetBool() : produit les deux valeurs', () => {
  const r = rng()
  let hasTrue = false
  let hasFalse = false
  for (let i = 0; i < ITERATIONS; i++) {
    if (r.randomGetBool()) { hasTrue = true } else { hasFalse = true }
    if (hasTrue && hasFalse) { break }
  }
  assert('true produit au moins une fois', hasTrue)
  assert('false produit au moins une fois', hasFalse)
})

// ─── randomGetMax ─────────────────────────────────────────────────────────────

describe('SeededRNG — randomGetMax() : retourne un entier dans [0, max]', () => {
  const r = rng()
  const max = 10
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomGetMax(max)
    if (!Number.isInteger(v) || v < 0 || v > max) { ok = false; break }
  }
  assert(`[0, ${max}] entier vérifié sur ${ITERATIONS} itérations`, ok)
})

describe('SeededRNG — randomGetMax() : produit 0 et max', () => {
  const r = rng()
  const max = 5
  let hasMin = false
  let hasMax = false
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomGetMax(max)
    if (v === 0) { hasMin = true }
    if (v === max) { hasMax = true }
    if (hasMin && hasMax) { break }
  }
  assert('0 produit au moins une fois', hasMin)
  assert('max produit au moins une fois', hasMax)
})

// ─── randomGetMinMax ──────────────────────────────────────────────────────────

describe('SeededRNG — randomGetMinMax() : retourne un entier dans [min, max]', () => {
  const r = rng()
  const min = -5
  const max = 5
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomGetMinMax(min, max)
    if (!Number.isInteger(v) || v < min || v > max) { ok = false; break }
  }
  assert(`[${min}, ${max}] entier vérifié sur ${ITERATIONS} itérations`, ok)
})

describe('SeededRNG — randomGetMinMax() : produit min et max', () => {
  const r = rng()
  const min = 3
  const max = 7
  let hasMin = false
  let hasMax = false
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomGetMinMax(min, max)
    if (v === min) { hasMin = true }
    if (v === max) { hasMax = true }
    if (hasMin && hasMax) { break }
  }
  assert('min produit au moins une fois', hasMin)
  assert('max produit au moins une fois', hasMax)
})

// ─── randomGetRealMax ─────────────────────────────────────────────────────────

describe('SeededRNG — randomGetRealMax() : retourne un float dans [0, max[', () => {
  const r = rng()
  const max = 5
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomGetRealMax(max)
    if (v < 0 || v >= max) { ok = false; break }
  }
  assert(`[0, ${max}[ float vérifié sur ${ITERATIONS} itérations`, ok)
})

// ─── randomGetRealMinMax ──────────────────────────────────────────────────────

describe('SeededRNG — randomGetRealMinMax() : retourne un float dans [min, max[', () => {
  const r = rng()
  const min = 2
  const max = 8
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomGetRealMinMax(min, max)
    if (v < min || v >= max) { ok = false; break }
  }
  assert(`[${min}, ${max}[ float vérifié sur ${ITERATIONS} itérations`, ok)
})

// ─── randomGetArrayValue ──────────────────────────────────────────────────────

describe('SeededRNG — randomGetArrayValue() : retourne une valeur du tableau', () => {
  const r = rng()
  const arr = ['a', 'b', 'c', 'd']
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomGetArrayValue(arr)
    if (!arr.includes(v)) { ok = false; break }
  }
  assert(`Valeur toujours dans le tableau sur ${ITERATIONS} itérations`, ok)
})

describe('SeededRNG — randomGetArrayValue() : retourne null si tableau vide', () => {
  const r = rng()
  assert('null sur tableau vide', r.randomGetArrayValue([]) === null)
})

describe('SeededRNG — randomGetArrayValue() : produit toutes les valeurs', () => {
  const r = rng()
  const arr = [10, 20, 30, 40, 50]
  const seen = new Set()
  for (let i = 0; i < ITERATIONS; i++) {
    seen.add(r.randomGetArrayValue(arr))
    if (seen.size === arr.length) { break }
  }
  assert('Toutes les valeurs produites au moins une fois', seen.size === arr.length)
})

// ─── randomGetArrayIndex ──────────────────────────────────────────────────────

describe('SeededRNG — randomGetArrayIndex() : retourne un index valide', () => {
  const r = rng()
  const arr = [10, 20, 30]
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomGetArrayIndex(arr)
    if (!Number.isInteger(v) || v < 0 || v >= arr.length) { ok = false; break }
  }
  assert(`Index valide sur ${ITERATIONS} itérations`, ok)
})

describe('SeededRNG — randomGetArrayIndex() : retourne null si tableau vide', () => {
  const r = rng()
  assert('null sur tableau vide', r.randomGetArrayIndex([]) === null)
})

// ─── randomGetArrayWeighted ───────────────────────────────────────────────────

describe('SeededRNG — randomGetArrayWeighted() : retourne un index valide', () => {
  const r = rng()
  const arr = [{weight: 10}, {weight: 20}, {weight: 30}]
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomGetArrayWeighted(arr)
    if (!Number.isInteger(v) || v < 0 || v >= arr.length) { ok = false; break }
  }
  assert(`Index valide sur ${ITERATIONS} itérations`, ok)
})

describe('SeededRNG — randomGetArrayWeighted() : retourne -1 si tableau vide', () => {
  const r = rng()
  assert('-1 sur tableau vide', r.randomGetArrayWeighted([]) === -1)
})

describe('SeededRNG — randomGetArrayWeighted() : retourne -1 si tous poids à 0', () => {
  const r = rng()
  assert('-1 si tous poids à 0', r.randomGetArrayWeighted([{weight: 0}, {weight: 0}]) === -1)
})

describe('SeededRNG — randomGetArrayWeighted() : respecte les poids (élément dominant)', () => {
  const r = rng()
  // Poids très déséquilibré : index 1 a 99% de chances
  const arr = [{weight: 1}, {weight: 9900}, {weight: 1}]
  let count1 = 0
  for (let i = 0; i < ITERATIONS; i++) {
    if (r.randomGetArrayWeighted(arr) === 1) { count1++ }
  }
  // On attend au moins 98% pour index 1
  assert('Index dominant produit > 98% du temps', count1 / ITERATIONS > 0.98)
})

describe('SeededRNG — randomGetArrayWeighted() : produit tous les index possibles', () => {
  const r = rng()
  const arr = [{weight: 1}, {weight: 1}, {weight: 1}, {weight: 1}]
  const seen = new Set()
  for (let i = 0; i < ITERATIONS; i++) {
    seen.add(r.randomGetArrayWeighted(arr))
    if (seen.size === arr.length) { break }
  }
  assert('Tous les index produits au moins une fois', seen.size === arr.length)
})

// ─── randomInteger ────────────────────────────────────────────────────────────

describe('SeededRNG — randomInteger(max) : entier dans [0, max]', () => {
  const r = rng()
  const max = 7
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomInteger(max)
    if (!Number.isInteger(v) || v < 0 || v > max) { ok = false; break }
  }
  assert(`[0, ${max}] entier vérifié sur ${ITERATIONS} itérations`, ok)
})

describe('SeededRNG — randomInteger(min, max) : entier dans [min, max]', () => {
  const r = rng()
  const min = 3
  const max = 9
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomInteger(min, max)
    if (!Number.isInteger(v) || v < min || v > max) { ok = false; break }
  }
  assert(`[${min}, ${max}] entier vérifié sur ${ITERATIONS} itérations`, ok)
})

describe('SeededRNG — randomInteger(array) : retourne une valeur du tableau', () => {
  const r = rng()
  const arr = [10, 20, 30]
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    if (!arr.includes(r.randomInteger(arr))) { ok = false; break }
  }
  assert(`Valeur dans le tableau sur ${ITERATIONS} itérations`, ok)
})

describe('SeededRNG — randomInteger(range) : entier dans [range.min, range.max]', () => {
  const r = rng()
  const range = {min: 5, max: 10}
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomInteger(range)
    if (!Number.isInteger(v) || v < range.min || v > range.max) { ok = false; break }
  }
  assert(`[${range.min}, ${range.max}] entier vérifié sur ${ITERATIONS} itérations`, ok)
})

describe('SeededRNG — randomInteger() sans argument : retourne 0 ou 1', () => {
  const r = rng()
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomInteger()
    if (v !== 0 && v !== 1) { ok = false; break }
  }
  assert(`0 ou 1 sur ${ITERATIONS} itérations`, ok)
})

// ─── randomReal ───────────────────────────────────────────────────────────────

describe('SeededRNG — randomReal() sans argument : float dans [0, 1[', () => {
  const r = rng()
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomReal()
    if (v < 0 || v >= 1) { ok = false; break }
  }
  assert(`[0, 1[ vérifié sur ${ITERATIONS} itérations`, ok)
})

describe('SeededRNG — randomReal(max) : float dans [0, max[', () => {
  const r = rng()
  const max = 5
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomReal(max)
    if (v < 0 || v >= max) { ok = false; break }
  }
  assert(`[0, ${max}[ vérifié sur ${ITERATIONS} itérations`, ok)
})

describe('SeededRNG — randomReal(min, max) : float dans [min, max[', () => {
  const r = rng()
  const min = 2
  const max = 8
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomReal(min, max)
    if (v < min || v >= max) { ok = false; break }
  }
  assert(`[${min}, ${max}[ vérifié sur ${ITERATIONS} itérations`, ok)
})

// ─── randomGaussian ───────────────────────────────────────────────────────────

describe('SeededRNG — randomGaussian() : retourne un nombre (pas NaN)', () => {
  const r = rng()
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    if (isNaN(r.randomGaussian())) { ok = false; break }
  }
  assert(`Jamais NaN sur ${ITERATIONS} itérations`, ok)
})

describe('SeededRNG — randomGaussian(mean, sd) : moyenne approximative cohérente', () => {
  const r = rng()
  const mean = 100
  const sd = 10
  let sum = 0
  for (let i = 0; i < ITERATIONS; i++) { sum += r.randomGaussian(mean, sd) }
  const avg = sum / ITERATIONS
  // On attend la moyenne à ±1 (très conservateur pour 10 000 tirages)
  assert(`Moyenne dans [${mean - 1}, ${mean + 1}]`, avg >= mean - 1 && avg <= mean + 1)
})

// ─── randomLinear ─────────────────────────────────────────────────────────────

describe('SeededRNG — randomLinear() : retourne un float dans [0, 1[', () => {
  const r = rng()
  let ok = true
  for (let i = 0; i < ITERATIONS; i++) {
    const v = r.randomLinear()
    if (v < 0 || v >= 1) { ok = false; break }
  }
  assert(`[0, 1[ vérifié sur ${ITERATIONS} itérations`, ok)
})

// ─── Perlin ───────────────────────────────────────────────────────────────────

describe('SeededRNG — randomPerlin() : retourne un float dans [0, 1]', () => {
  const r = rng()
  r.randomPerlinInit()
  let ok = true
  for (let i = 0; i < PERLIN_ITERATIONS; i++) {
    const v = r.randomPerlin(i * 0.1)
    if (v < 0 || v > 1) { ok = false; break }
  }
  assert(`[0, 1] vérifié sur ${PERLIN_ITERATIONS} itérations`, ok)
})

describe('SeededRNG — randomPerlin() : reproductible avec même graine', () => {
  const r1 = rng('perlin-test')
  r1.randomPerlinInit()
  const r2 = rng('perlin-test')
  r2.randomPerlinInit()

  let identical = true
  for (let i = 0; i < 20; i++) {
    if (r1.randomPerlin(i * 0.5) !== r2.randomPerlin(i * 0.5)) { identical = false; break }
  }
  assert('Même graine → même bruit de Perlin', identical)
})

describe('SeededRNG — randomPerlin() : valeurs non constantes (bruit réel)', () => {
  const r = rng()
  r.randomPerlinInit()
  const first = r.randomPerlin(0)
  let hasVariation = false
  for (let i = 1; i < 50; i++) {
    if (r.randomPerlin(i * 0.3) !== first) { hasVariation = true; break }
  }
  assert('Les valeurs varient (pas une constante)', hasVariation)
})

describe('SeededRNG — randomPerlinScaled() : retourne un nombre dans [-amplitude, amplitude]', () => {
  const r = rng()
  r.randomPerlinInit()
  const amplitude = 50
  let ok = true
  for (let i = 0; i < PERLIN_ITERATIONS; i++) {
    const v = r.randomPerlinScaled(i * 0.1, 1, 100, amplitude)
    if (v < -amplitude || v > amplitude) { ok = false; break }
  }
  assert(`[-${amplitude}, ${amplitude}] vérifié sur ${PERLIN_ITERATIONS} itérations`, ok)
})

describe('SeededRNG — randomPerlinOctave() : modifie le comportement du bruit', () => {
  const r1 = rng('oct')
  r1.randomPerlinInit()

  const r2 = rng('oct')
  r2.randomPerlinInit()
  r2.randomPerlinOctave([{scale: 4, amplitude: 1}])

  // Les deux configs produisent des séquences différentes
  let differs = false
  for (let i = 0; i < 20; i++) {
    if (r1.randomPerlin(i * 0.5) !== r2.randomPerlin(i * 0.5)) { differs = true; break }
  }
  assert('Octaves différentes → bruit différent', differs)
})

// ─── intFract ─────────────────────────────────────────────────────────────────

describe('intFract() : partie entière et fractionnaire correctes', () => {
  const {int, fract} = intFract(3.75)
  assert('int = 3', int === 3)
  assert('fract ≈ 0.75', Math.abs(fract - 0.75) < 1e-10)
  assert('int + fract = r', Math.abs(int + fract - 3.75) < 1e-10)
})

describe('intFract() : valeur négative', () => {
  const {int, fract} = intFract(-2.3)
  assert('int = floor(-2.3) = -3', int === -3)
  assert('fract >= 0', fract >= 0)
  assert('int + fract = r', Math.abs(int + fract - (-2.3)) < 1e-10)
})

describe('intFract() : valeur entière exacte', () => {
  const {int, fract} = intFract(5)
  assert('int = 5', int === 5)
  assert('fract = 0', fract === 0)
})

describe('intFract() : valeur zéro', () => {
  const {int, fract} = intFract(0)
  assert('int = 0', int === 0)
  assert('fract = 0', fract === 0)
})

// ─── cosineInterpolation ──────────────────────────────────────────────────────

describe('cosineInterpolation() : x=0 retourne a', () => {
  assert('x=0 → a', cosineInterpolation(0, 10, 20) === 10)
})

describe('cosineInterpolation() : x=1 retourne b', () => {
  assert('x=1 → b', cosineInterpolation(1, 10, 20) === 20)
})

describe('cosineInterpolation() : x=0.5 retourne le milieu exact', () => {
  const v = cosineInterpolation(0.5, 0, 100)
  assert('x=0.5 → 50', Math.abs(v - 50) < 1e-10)
})

describe('cosineInterpolation() : résultat toujours dans [min(a,b), max(a,b)]', () => {
  let ok = true
  for (let i = 0; i <= 100; i++) {
    const x = i / 100
    const v = cosineInterpolation(x, 10, 80)
    if (v < 10 || v > 80) { ok = false; break }
  }
  assert('Résultat dans [a, b] pour x dans [0, 1]', ok)
})

describe('cosineInterpolation() : monotone (croissant de a vers b quand a < b)', () => {
  let prev = cosineInterpolation(0, 0, 100)
  let ok = true
  for (let i = 1; i <= 100; i++) {
    const curr = cosineInterpolation(i / 100, 0, 100)
    if (curr < prev) { ok = false; break }
    prev = curr
  }
  assert('Monotone croissant de a vers b', ok)
})
