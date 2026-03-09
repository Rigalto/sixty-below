// tests/test-microtasker.mjs
// Lancement : node tests/run.mjs MicroTasker
//
// Chaque describe() instancie sa propre MicroTasker — zéro état partagé.

import {describe, assert, captureConsole, releaseConsole} from './kernel.mjs'
import {MicroTasker} from '../src/utils.mjs'

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Les fonctions anonymes sont interdites dans MicroTasker — toutes sont nommées.

function taskA () {}
function taskB () {}
function taskC () {}
function taskSlow () {
  // Simule ~6ms de travail pour déclencher le warning budget par tâche
  const end = performance.now() + 6
  while (performance.now() < end) { /* busy wait */ }
}
function taskFail () { throw new Error('Erreur volontaire') }

// ─── init / clear ─────────────────────────────────────────────────────────────

describe('MicroTasker — init()', () => {
  const mt = new MicroTasker()
  mt.enqueue(taskA, 1, 4)
  mt.enqueue(taskB, 2, 4)
  mt.init()

  assert('La file est vide après init()', mt.queueSize === 0)
  assert('taskStats est vide après init()', Object.keys(mt.taskStats).length === 0)
})

describe('MicroTasker — clear()', () => {
  const mt = new MicroTasker()
  mt.enqueue(taskA, 1, 4)
  mt.enqueue(taskB, 2, 4)
  mt.clear()

  assert('La file est vide après clear()', mt.queueSize === 0)
})

// ─── queueSize ────────────────────────────────────────────────────────────────

describe('MicroTasker — queueSize', () => {
  const mt = new MicroTasker()

  assert('queueSize vaut 0 à la construction', mt.queueSize === 0)
  mt.enqueue(taskA, 1, 4)
  assert('queueSize vaut 1 après un enqueue', mt.queueSize === 1)
  mt.enqueue(taskB, 2, 4)
  assert('queueSize vaut 2 après deux enqueues', mt.queueSize === 2)
})

// ─── enqueue ──────────────────────────────────────────────────────────────────

describe('MicroTasker — enqueue() : ajout et tri', () => {
  const mt = new MicroTasker()

  // Priorité haute = index élevé = en fin de tableau (pop() en premier)
  mt.enqueue(taskA, 1, 4) // index bas
  mt.enqueue(taskB, 3, 4) // index haut
  mt.enqueue(taskC, 2, 4) // index intermédiaire

  assert('3 tâches dans la file', mt.queueSize === 3)

  const last = mt.taskQueue[mt.taskQueue.length - 1]
  assert('La tâche la plus prioritaire (prio 3) est en fin de tableau', last.fn === taskB)
  const first = mt.taskQueue[0]
  assert('La tâche la moins prioritaire (prio 1) est en début de tableau', first.fn === taskA)
  const middle = mt.taskQueue[1]
  assert('La tâche la moins prioritaire (prio 1) est en début de tableau', middle.fn === taskC)
})

// Test interne — vérifie l'implémentation de l'index composite.
// Ne pas exposer comme contrat public : l'ordre à priorité égale est un détail d'implémentation.
describe('MicroTasker — enqueue() : tri avec priorités égales (départage par capacityUnits)', () => {
  const mt = new MicroTasker()

  // Même priorité → départage par capacityUnits croissant
  // capacityUnits faible = index bas = en début de tableau (exécuté en dernier)
  // capacityUnits élevé = index haut = en fin de tableau (exécuté en premier)
  mt.enqueue(taskA, 2, 8) // index = (2 << 5) | 8  = 72
  mt.enqueue(taskB, 2, 1) // index = (2 << 5) | 1  = 65
  mt.enqueue(taskC, 2, 16) // index = (2 << 5) | 16 = 80

  assert('3 tâches dans la file', mt.queueSize === 3)

  assert('capacityUnits 1  → en début de tableau (index le plus bas)', mt.taskQueue[0].fn === taskB)
  assert('capacityUnits 8  → en milieu de tableau', mt.taskQueue[1].fn === taskA)
  assert('capacityUnits 16 → en fin de tableau (index le plus haut)', mt.taskQueue[2].fn === taskC)
})

describe('MicroTasker — enqueue() : capacityUnits clampée entre 1 et 20', () => {
  const mt = new MicroTasker()

  mt.enqueue(taskA, 1, 0) // doit être ramenée à 1 (min)
  mt.enqueue(taskB, 1, 999) // doit être ramenée à 20 (max)

  // Recherche par référence de fonction, indépendante de l'ordre du tri
  const tA = mt.taskQueue.find(t => t.fn === taskA)
  const tB = mt.taskQueue.find(t => t.fn === taskB)

  assert('capacityUnits 0 → clampée à 1', tA.capacityUnits === 1)
  assert('capacityUnits 999 → clampée à 20', tB.capacityUnits === 20)
})

// ⚠️  Ce test valide le comportement CIBLE après correction Bug#3 :
//     task.capacityUnits = Math.max(1, Math.min(task.capacityUnits || 20, 20))
//     Avant correction : null → 1  (Math.max(1, Math.min(null, 20)) = 1)
//     Après correction : null → 20 (null || 20 = 20, puis clamp → 20)
describe('MicroTasker — enqueue() : capacityUnits null → valeur par défaut 20', () => {
  const mt = new MicroTasker()
  mt.enqueue(taskA, 1, null)
  const tA = mt.taskQueue.find(t => t.fn === taskA)
  assert('capacityUnits null → ramenée à 20 (valeur par défaut)', tA.capacityUnits === 20)
})

describe('MicroTasker — enqueue() : accepte des arguments variadiques', () => {
  const mt = new MicroTasker()
  let received = null
  function taskWithArgs (a, b) { received = [a, b] }

  mt.enqueue(taskWithArgs, 1, 4, 'hello', 42)
  mt.update(5)

  assert('Les args sont transmis à la fonction', received !== null && received[0] === 'hello' && received[1] === 42)
})

describe('MicroTasker — enqueue() : permet plusieurs occurrences de la même fonction', () => {
  const mt = new MicroTasker()
  mt.enqueue(taskA, 1, 4)
  mt.enqueue(taskA, 2, 4) // doublon autorisé pour enqueue

  assert('enqueue accepte deux fois la même fonction', mt.queueSize === 2)
})

// ─── enqueueOnce ──────────────────────────────────────────────────────────────

describe('MicroTasker — enqueueOnce() : déduplication par référence', () => {
  const mt = new MicroTasker()

  mt.enqueueOnce(taskA, 1, 4)
  mt.enqueueOnce(taskA, 2, 8) // même référence → ignoré
  mt.enqueueOnce(taskB, 1, 4) // référence différente → ajoutée

  assert('La file contient 2 tâches (taskA dédupliquée)', mt.queueSize === 2)
})

describe('MicroTasker — enqueueOnce() : deux fonctions distinctes au même nom', () => {
  const mt = new MicroTasker()

  // Deux fonctions avec le même nom mais des références distinctes
  const make = () => function taskSameName () {}
  const fn1 = make()
  const fn2 = make()

  mt.enqueueOnce(fn1, 1, 4)
  mt.enqueueOnce(fn2, 1, 4) // référence différente → doit être ajoutée

  assert('Deux références distinctes ne se dédupliquent pas', mt.queueSize === 2)
})

// ─── dequeue ──────────────────────────────────────────────────────────────────

describe('MicroTasker — dequeue() : supprime toutes les occurrences', () => {
  const mt = new MicroTasker()
  mt.enqueue(taskA, 1, 4)
  mt.enqueue(taskA, 2, 4) // doublon voulu
  mt.enqueue(taskB, 1, 4)

  mt.dequeue(taskA)

  assert('taskA est totalement absente de la file', mt.taskQueue.every(t => t.fn !== taskA))
  assert('taskB reste dans la file', mt.taskQueue.some(t => t.fn === taskB))
  assert('queueSize est 1 après suppression de taskA (×2)', mt.queueSize === 1)
})

describe('MicroTasker — dequeue() : aucune erreur si la fonction est absente', () => {
  const mt = new MicroTasker()
  mt.enqueue(taskA, 1, 4)

  let threw = false
  try { mt.dequeue(taskB) } catch { threw = true }

  assert('Pas d\'exception si la fonction est absente', !threw)
  assert('La file reste inchangée', mt.queueSize === 1)
})

// ─── update ───────────────────────────────────────────────────────────────────

describe('MicroTasker — update() : ordre d\'exécution selon la priorité', () => {
  const mt = new MicroTasker()
  const order = []

  function recordA () { order.push('A') }
  function recordB () { order.push('B') } // priorité plus haute

  mt.enqueue(recordA, 1, 4)
  mt.enqueue(recordB, 5, 4)

  mt.update(5) // budget large → les deux s'exécutent

  assert('recordB (prio 5) est exécutée avant recordA', order[0] === 'B')
})

// La 1ère tâche (haute prio) s'exécute TOUJOURS, même si le budget est nul.
// Comportement volontaire : garantit que les tâches prioritaires passent.
describe('MicroTasker — update() : la tâche prioritaire s\'exécute toujours (budget ignoré)', () => {
  const mt = new MicroTasker()
  let executed = false
  function guaranteedTask () { executed = true }

  mt.enqueue(guaranteedTask, 5, 20)
  mt.update(0) // budget nul → s'exécute quand même

  assert('La tâche haute prio s\'exécute même avec budget nul', executed)
})

describe('MicroTasker — update() : respecte le budget résiduel pour les tâches suivantes', () => {
  const mt = new MicroTasker()
  let executed = false

  function quickTask () {}
  function heavyTask () { executed = true }

  mt.enqueue(quickTask, 5, 1) // haute prio, 0.25ms déclarée → exécutée en 1ère
  mt.enqueue(heavyTask, 1, 20) // basse prio, 5ms déclarées → bloquée par budget résiduel

  mt.update(0.5) // après quickTask, il reste < 20 unités → heavyTask ne passe pas

  assert('heavyTask n\'est pas exécutée faute de budget résiduel', !executed)
})

describe('MicroTasker — update() : file vide ne lève pas d\'erreur', () => {
  const mt = new MicroTasker()
  let threw = false
  try { mt.update(5) } catch { threw = true }
  assert('Pas d\'exception sur file vide', !threw)
})

describe('MicroTasker — update() : une erreur dans une tâche n\'arrête pas les suivantes', () => {
  const mt = new MicroTasker()
  let afterFail = false
  function afterFailTask () { afterFail = true }

  mt.enqueue(taskFail, 5, 4) // priorité haute, va planter
  mt.enqueue(afterFailTask, 1, 4) // priorité basse, doit quand même s'exécuter

  captureConsole()
  mt.update(5)
  const lines = releaseConsole()

  assert('afterFailTask s\'exécute malgré l\'erreur de taskFail', afterFail)
  assert('L\'erreur est loggée dans la console', lines.some(l => l.includes('Erreur')))
})

// ─── Stats ────────────────────────────────────────────────────────────────────

describe('MicroTasker — taskStats : alimentés après exécution', () => {
  const mt = new MicroTasker()
  function statTask () {}

  mt.enqueue(statTask, 1, 4)
  mt.update(5)

  const stats = mt.taskStats.statTask
  assert('Les stats existent pour statTask', stats !== undefined)
  assert('count vaut 1 après une exécution', stats.count === 1)
  assert('totalDuration est un nombre positif', stats.totalDuration >= 0)
  assert('maxDuration est un nombre positif', stats.maxDuration >= 0)
})

describe('MicroTasker — resetStats() : vide les stats', () => {
  const mt = new MicroTasker()
  function statTask () {}

  mt.enqueue(statTask, 1, 4)
  mt.update(5)

  captureConsole()
  mt.resetStats()
  releaseConsole()

  assert('taskStats est vide après resetStats()', Object.keys(mt.taskStats).length === 0)
})

// ─── Warning budget par tâche dépassé ─────────────────────────────────────────

describe('MicroTasker — warning si une tâche dépasse 5ms', () => {
  const mt = new MicroTasker()
  mt.enqueue(taskSlow, 1, 20)

  captureConsole()
  mt.update(10) // budget large pour ne pas bloquer l'exécution
  const lines = releaseConsole()

  assert('Un warn est émis quand une tâche dépasse 5ms', lines.some(l => l.includes('dépassé 5ms')))
})

// ─── debug() ──────────────────────────────────────────────────────────────────

describe('MicroTasker — debug() : retourne une chaîne avec les noms des tâches', () => {
  const mt = new MicroTasker()
  mt.enqueue(taskA, 1, 4)
  mt.enqueue(taskB, 2, 8)

  const result = mt.debug()
  assert('debug() retourne une string', typeof result === 'string')
  assert('debug() contient le nom de taskA', result.includes('taskA'))
  assert('debug() contient le nom de taskB', result.includes('taskB'))
})

// ─── debugStats() ─────────────────────────────────────────────────────────────

describe('MicroTasker — debugStats() : retourne une chaîne sans muter taskStats', () => {
  const mt = new MicroTasker()
  function measuredTask () {}
  mt.enqueue(measuredTask, 1, 4)
  mt.update(5)

  const countBefore = mt.taskStats.measuredTask.count

  captureConsole()
  const result = mt.debugStats()
  releaseConsole()

  assert('debugStats() retourne une string', typeof result === 'string')
  assert('debugStats() ne modifie pas le count', mt.taskStats.measuredTask.count === countBefore)
})

// ─── initDebug() ──────────────────────────────────────────────────────────────

describe('MicroTasker — initDebug() : stocke le mapping', () => {
  const mt = new MicroTasker()
  const mapping = {taskA: 4, taskB: 8}
  mt.initDebug(mapping)

  assert('Le mapping est accessible via MICROTASK_FN_NAME_TO_KEY', mt.MICROTASK_FN_NAME_TO_KEY === mapping)
})

// ─── Warning file trop longue ─────────────────────────────────────────────────

describe('MicroTasker — log si la file dépasse 20 tâches', () => {
  const mt = new MicroTasker()

  // 21 fonctions nommées distinctes via Object.defineProperty
  const fns = Array.from({length: 21}, (_, i) => {
    const fn = function () {}
    Object.defineProperty(fn, 'name', {value: `task_${i}`})
    return fn
  })

  captureConsole()
  for (const fn of fns) { mt.enqueue(fn, 1, 4) }
  const lines = releaseConsole()

  assert('Un log est émis quand la file dépasse 20 entrées', lines.length > 0)
})
