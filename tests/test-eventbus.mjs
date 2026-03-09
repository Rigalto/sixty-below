// test-eventbus.mjs
// Exécution : node C:\Users\dcabu\Documents\sixty-below\tests\test-eventbus.mjs

import {EventBus} from '../src/utils.mjs'

/* ====================================================================================================
   MICRO-FRAMEWORK DE TEST (Vanilla, zéro dépendance)
   ==================================================================================================== */

let passed = 0
let failed = 0

function assert (label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.error(`  ❌ ${label}`)
    failed++
  }
}

function describe (label, fn) {
  console.log(`\n📦 ${label}`)
  fn()
}

/* ====================================================================================================
   SUITES DE TESTS
   ==================================================================================================== */

describe('on() — Abonnement', () => {
  const bus = new EventBus()
  const cb = () => {}

  bus.on('test', cb)
  assert('Le listener est enregistré', bus.listeners.get('test').has(cb))

  bus.on('test', cb)
  assert('Double on() sur même cb → pas de doublon (Set)', bus.listeners.get('test').size === 1)

  const cb2 = () => {}
  bus.on('test', cb2)
  assert('Deux callbacks différentes → size = 2', bus.listeners.get('test').size === 2)
})

describe('off() — Désabonnement', () => {
  const bus = new EventBus()
  const cb = () => {}

  bus.on('test', cb)
  bus.off('test', cb)
  assert('off() supprime le callback', !bus.listeners.get('test'))

  // No-op
  bus.off('inexistant', cb)
  assert('off() sur event inexistant ne throw pas', true)

  bus.on('test', cb)
  bus.off('test', () => {}) // mauvaise référence
  assert('off() avec mauvaise référence ne supprime rien', bus.listeners.get('test').size === 1)
})

describe('emit() — Publication', () => {
  const bus = new EventBus()
  let received = null

  const cb = (data) => { received = data }
  bus.on('ping', cb)
  bus.emit('ping', {value: 42})
  assert('emit() appelle le callback avec la data', received?.value === 42)

  // Pas de listeners
  bus.emit('ghost')
  assert('emit() sur event sans listeners ne throw pas', true)

  // Plusieurs listeners
  let count = 0
  bus.on('multi', () => count++)
  bus.on('multi', () => count++)
  bus.emit('multi')
  assert('emit() appelle tous les listeners', count === 2)

  // Isolation des erreurs
  const busErr = new EventBus()
  let secondCalled = false
  busErr.on('err', () => { throw new Error('boom') })
  busErr.on('err', () => { secondCalled = true })
  busErr.emit('err')
  assert('emit() — une erreur dans cb1 n\'empêche pas cb2', secondCalled)
})

describe('Nettoyage automatique du Map', () => {
  const bus = new EventBus()
  const cb = () => {}

  bus.on('clean', cb)
  bus.off('clean', cb)
  assert('Clé supprimée du Map quand Set vide', !bus.listeners.has('clean'))
})

describe('debugStats()', () => {
  const bus = new EventBus()
  bus.on('b-event', () => {})
  bus.on('a-event', () => {})

  const output = bus.debugStats()
  assert('debugStats() retourne une string', typeof output === 'string')
  assert('debugStats() contient les événements enregistrés', output.includes('a-event') && output.includes('b-event'))
  assert('debugStats() trie les événements alphabétiquement', output.indexOf('a-event') < output.indexOf('b-event'))
})

describe('off() pendant emit()', () => {
  const bus = new EventBus()
  let cb2Called = false

  const cb1 = () => { bus.off('race', cb2) }
  const cb2 = () => { cb2Called = true }

  bus.on('race', cb1)
  bus.on('race', cb2)
  bus.emit('race')

  // Ce test ÉCHOUE avec l'implémentation actuelle → documente le bug
  assert(
    'cb2 supprimé par cb1 pendant emit (Set mutation) → cb2 appelé',
    cb2Called === true
  )
})

/* ====================================================================================================
   RAPPORT
   ==================================================================================================== */

console.log(`\n${'─'.repeat(40)}`)
console.log(`Résultat : ${passed} ✅  ${failed} ❌  (${passed + failed} tests)`)
if (failed > 0) process.exit(1)
