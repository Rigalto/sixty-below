// tests/test-eventbus.mjs
import {describe, assert, captureConsole, releaseConsole} from './kernel.mjs'
import {EventBus} from '../src/utils.mjs'

describe('EventBus — on()', () => {
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

describe('EventBus — off()', () => {
  const bus = new EventBus()
  const cb = () => {}

  bus.on('test', cb)
  bus.off('test', cb)
  assert('off() supprime le callback', !bus.listeners.get('test'))
  assert('off() vide → clé supprimée du Map', !bus.listeners.has('test'))

  bus.off('inexistant', cb)
  assert('off() sur event inexistant ne throw pas', true)

  bus.on('test', cb)
  bus.off('test', () => {})
  assert('off() avec mauvaise référence ne supprime rien', bus.listeners.get('test').size === 1)
})

describe('EventBus — emit()', () => {
  const bus = new EventBus()
  let received = null
  const cb = (data) => { received = data }

  bus.on('ping', cb)
  bus.emit('ping', {value: 42})
  assert('emit() transmet la data au callback', received?.value === 42)

  bus.emit('ghost')
  assert('emit() sur event sans listeners ne throw pas', true)

  let count = 0
  bus.on('multi', () => count++)
  bus.on('multi', () => count++)
  bus.emit('multi')
  assert('emit() appelle tous les listeners', count === 2)
})

describe('EventBus — isolation des erreurs', () => {
  const bus = new EventBus()
  let secondCalled = false

  bus.on('err', () => { throw new Error('boom') })
  bus.on('err', () => { secondCalled = true })

  captureConsole()
  bus.emit('err')
  const lines = releaseConsole()

  assert('Une erreur dans cb1 n\'empêche pas cb2', secondCalled)
  assert('L\'erreur est bien loggée dans console.error', lines.some(l => l.includes('boom')))
})

describe('EventBus — debugStats()', () => {
  const bus = new EventBus()
  bus.on('b-event', () => {})
  bus.on('a-event', () => {})

  captureConsole()
  const output = bus.debugStats() // console.log intercepté, rien affiché
  const lines = releaseConsole() // console.log restauré, lignes récupérées

  assert('Retourne une string', typeof output === 'string')
  assert('Contient les événements enregistrés', output.includes('a-event') && output.includes('b-event'))
  assert('Tri alphabétique', output.indexOf('a-event') < output.indexOf('b-event'))
  assert('A bien écrit dans console.log', lines.length > 0)
  assert('Log contient a-event', lines.some(l => l.includes('a-event')))
})

describe('EventBus — off() pendant emit()', () => {
  const bus = new EventBus()
  let cb2Called = false

  const cb1 = () => { bus.off('race', cb2) }
  const cb2 = () => { cb2Called = true }

  bus.on('race', cb1)
  bus.on('race', cb2)
  bus.emit('race')

  assert('cb2 appelé même si supprimé pendant l\'itération', cb2Called)
})
