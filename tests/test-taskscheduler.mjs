// tests/test-taskscheduler.mjs
// Lancement : node tests/run.mjs TaskScheduler
//
// Chaque describe() instancie sa propre TaskScheduler — zéro état partagé.
// Le TaskScheduler délègue au MicroTasker lors de update() — on vérifie
// le contenu de la file plutôt que l'exécution directe pour rester isolé.

import {describe, assert, captureConsole, releaseConsole} from './kernel.mjs'
import {TaskScheduler} from '../src/utils.mjs'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function taskA () {}
function taskB () {}
function taskC () {}

// ─── init ─────────────────────────────────────────────────────────────────────

describe('TaskScheduler — init() : vide la file', () => {
  const ts = new TaskScheduler()
  ts.enqueue('a', 1000, taskA, 1, 4)
  ts.init(0)

  assert('La file est vide après init()', ts.queueSize === 0)
})

// ⚠️  Vérifie Bug#1 : lastFrameTime doit mémoriser le paramètre passé à init()
describe('TaskScheduler — init() : mémorise le temps passé en paramètre [post-Bug#1]', () => {
  const ts = new TaskScheduler()
  ts.init(5000)

  assert('lastFrameTime vaut la valeur passée en paramètre', ts.lastFrameTime === 5000)
})

// ─── queueSize / clear ────────────────────────────────────────────────────────

describe('TaskScheduler — queueSize', () => {
  const ts = new TaskScheduler()
  ts.init(0)

  assert('queueSize vaut 0 à l\'initialisation', ts.queueSize === 0)
  ts.enqueue('a', 1000, taskA, 1, 4)
  assert('queueSize vaut 1 après un enqueue', ts.queueSize === 1)
  ts.enqueue('b', 2000, taskB, 1, 4)
  assert('queueSize vaut 2 après deux enqueues', ts.queueSize === 2)
})

describe('TaskScheduler — clear() : vide la file', () => {
  const ts = new TaskScheduler()
  ts.init(0)
  ts.enqueue('a', 1000, taskA, 1, 4)
  ts.enqueue('b', 2000, taskB, 1, 4)
  ts.clear()

  assert('La file est vide après clear()', ts.queueSize === 0)
})

// ─── enqueue ──────────────────────────────────────────────────────────────────

describe('TaskScheduler — enqueue() : retourne le time absolu de la tâche', () => {
  const ts = new TaskScheduler()
  ts.init(1000)

  const returnedTime = ts.enqueue('a', 500, taskA, 1, 4)
  assert('Retourne lastFrameTime + delay', returnedTime === 1500)
})

describe('TaskScheduler — enqueue() : accepte des arguments variadiques', () => {
  const ts = new TaskScheduler()
  ts.init(0)
  ts.enqueue('a', 0, taskA, 1, 4, 'hello', 42)

  const task = ts.tasks.find(t => t.id === 'a')
  assert('Les args sont stockés dans la tâche', task.args[0] === 'hello' && task.args[1] === 42)
})

// ─── tri ──────────────────────────────────────────────────────────────────────

//     la tâche la plus imminente (time le plus petit) doit être
//     en FIN de tableau pour permettre un pop() sans décalage mémoire.
describe('TaskScheduler — enqueue() : tri correct (time croissant → fin de tableau)', () => {
  const ts = new TaskScheduler()
  ts.init(0)

  ts.enqueue('c', 3000, taskC, 1, 4) // time 3000
  ts.enqueue('a', 1000, taskA, 1, 4) // time 1000 — le plus imminent
  ts.enqueue('b', 2000, taskB, 1, 4) // time 2000

  const last = ts.tasks[ts.tasks.length - 1]
  const first = ts.tasks[0]
  const middle = ts.tasks[1]

  assert('La tâche la plus imminente (time 1000) est en fin de tableau', last.id === 'a')
  assert('La tâche la plus lointaine (time 3000) est en début de tableau', first.id === 'c')
  assert('La tâche intermédiaire (time 2000) est au milieu', middle.id === 'b')

  ts.enqueue('b', 4000, taskB, 1, 4) // time 4000 => 4000, 3000, 2000, 1000
})

describe('TaskScheduler — enqueue() : insertion correcte en début de tableau)', () => {
  const ts = new TaskScheduler()
  ts.init(0)

  ts.enqueue('c', 3000, taskC, 1, 4) // time 3000
  ts.enqueue('a', 1000, taskA, 1, 4) // time 1000 — le plus imminent
  ts.enqueue('b', 2000, taskB, 1, 4) // time 2000

  ts.enqueue('d', 4000, taskB, 1, 4) // time 4000 => 4000, 3000, 2000, 1000

  const last = ts.tasks[ts.tasks.length - 1]
  const first = ts.tasks[0]
  const second = ts.tasks[1]
  const third = ts.tasks[2]

  assert('La tâche la plus imminente (time 1000) est en fin de tableau', last.id === 'a')
  assert('La tâche la plus lointaine (time 4000) est en début de tableau', first.id === 'd')
  assert('La tâche intermédiaire (time 3000) est en deuxième', second.id === 'c')
  assert('La tâche intermédiaire (time 2000) est en troisième', third.id === 'b')
})

describe('TaskScheduler — enqueue() : insertion correcte en fin de tableau)', () => {
  const ts = new TaskScheduler()
  ts.init(0)

  ts.enqueue('c', 3000, taskC, 1, 4) // time 3000
  ts.enqueue('a', 1000, taskA, 1, 4) // time 1000 — le plus imminent
  ts.enqueue('b', 2000, taskB, 1, 4) // time 2000

  ts.enqueue('d', 500, taskB, 1, 4) // time 500 => 3000, 2000, 1000, 500

  const last = ts.tasks[ts.tasks.length - 1]
  const first = ts.tasks[0]
  const second = ts.tasks[1]
  const third = ts.tasks[2]

  assert('La tâche la plus imminente (time 500) est en fin de tableau', last.id === 'd')
  assert('La tâche la plus lointaine (time 3000) est en début de tableau', first.id === 'c')
  assert('La tâche intermédiaire (time 2000) est en deuxième', second.id === 'b')
  assert('La tâche intermédiaire (time 1000) est en troisième', third.id === 'a')
})

describe('TaskScheduler — enqueue() : insertion correcte en milieu de tableau)', () => {
  const ts = new TaskScheduler()
  ts.init(0)

  ts.enqueue('c', 3000, taskC, 1, 4) // time 3000
  ts.enqueue('a', 1000, taskA, 1, 4) // time 1000 — le plus imminent
  ts.enqueue('b', 2000, taskB, 1, 4) // time 2000

  ts.enqueue('d', 1500, taskB, 1, 4) // time 500 => 3000, 2000, 1500, 1000

  const last = ts.tasks[ts.tasks.length - 1]
  const first = ts.tasks[0]
  const second = ts.tasks[1]
  const third = ts.tasks[2]

  assert('La tâche la plus imminente (time 1000) est en fin de tableau', last.id === 'a')
  assert('La tâche la plus lointaine (time 3000) est en début de tableau', first.id === 'c')
  assert('La tâche intermédiaire (time 2000) est en deuxième', second.id === 'b')
  assert('La tâche intermédiaire (time 1500) est en troisième', third.id === 'd')
})

describe('TaskScheduler — enqueue() : deux tâches au même time', () => {
  const ts = new TaskScheduler()
  ts.init(0)

  ts.enqueue('a', 1000, taskA, 1, 4)
  ts.enqueue('b', 1000, taskB, 1, 4)

  assert('Les deux tâches sont dans la file', ts.queueSize === 2)
  // Les deux ont le même time — pas de garantie d'ordre entre elles
  const times = ts.tasks.map(t => t.time)
  assert('Les deux tâches ont bien time = 1000', times.every(t => t === 1000))
})

// ─── dequeue ──────────────────────────────────────────────────────────────────

describe('TaskScheduler — dequeue() : suppression par string id', () => {
  const ts = new TaskScheduler()
  ts.init(0)
  ts.enqueue('a', 1000, taskA, 1, 4)
  ts.enqueue('b', 2000, taskB, 1, 4)

  ts.dequeue('a')

  const taskA_ = ts.tasks.find(t => t.id === 'a')
  const taskB_ = ts.tasks.find(t => t.id === 'b')
  assert('La tâche \'a\' est marquée isRemoved', taskA_.isRemoved === true)
  assert('La tâche \'b\' n\'est pas affectée', taskB_.isRemoved === false)
})

describe('TaskScheduler — dequeue() : suppression par RegExp', () => {
  const ts = new TaskScheduler()
  ts.init(0)
  ts.enqueue('chunk_1', 1000, taskA, 1, 4)
  ts.enqueue('chunk_2', 2000, taskB, 1, 4)
  ts.enqueue('save', 3000, taskC, 1, 4)

  ts.dequeue(/^chunk_/)

  const chunk1 = ts.tasks.find(t => t.id === 'chunk_1')
  const chunk2 = ts.tasks.find(t => t.id === 'chunk_2')
  const save = ts.tasks.find(t => t.id === 'save')
  assert('chunk_1 est marquée isRemoved', chunk1.isRemoved === true)
  assert('chunk_2 est marquée isRemoved', chunk2.isRemoved === true)
  assert('save n\'est pas affectée', save.isRemoved === false)
})

describe('TaskScheduler — dequeue() : aucune erreur si id absent', () => {
  const ts = new TaskScheduler()
  ts.init(0)
  ts.enqueue('a', 1000, taskA, 1, 4)

  let threw = false
  try { ts.dequeue('inexistant') } catch { threw = true }

  assert('Pas d\'exception si l\'id est absent', !threw)
  assert('La file reste inchangée', ts.queueSize === 1)
})

// ─── requeue ──────────────────────────────────────────────────────────────────

describe('TaskScheduler — requeue() : replanifie depuis lastFrameTime', () => {
  const ts = new TaskScheduler()
  ts.init(0)
  ts.enqueue('a', 1000, taskA, 1, 4)

  ts.requeue('a', 5000, taskA, 1, 4)

  const active = ts.tasks.filter(t => !t.isRemoved && t.id === 'a')
  assert('Une seule tâche active après requeue', active.length === 1)
  assert('Le nouveau time est lastFrameTime + delay', active[0].time === 5000)
})

// ─── enqueueOnce ──────────────────────────────────────────────────────────────

describe('TaskScheduler — enqueueOnce() : n\'enfile pas si l\'id existe déjà', () => {
  const ts = new TaskScheduler()
  ts.init(0)

  ts.enqueueOnce('a', 1000, taskA, 1, 4)
  ts.enqueueOnce('a', 2000, taskA, 1, 4) // doublon → ignoré

  const active = ts.tasks.filter(t => !t.isRemoved && t.id === 'a')
  assert('Une seule tâche active pour l\'id \'a\'', active.length === 1)
  assert('C\'est le premier time qui est conservé', active[0].time === 1000)
})

describe('TaskScheduler — enqueueOnce() : enfile si l\'id est absent', () => {
  const ts = new TaskScheduler()
  ts.init(0)

  ts.enqueueOnce('a', 1000, taskA, 1, 4)
  ts.enqueueOnce('b', 2000, taskB, 1, 4) // id différent → ajouté

  assert('Deux tâches dans la file', ts.queueSize === 2)
})

describe('TaskScheduler — enqueueOnce() : enfile si l\'id précédent a été dequeue', () => {
  const ts = new TaskScheduler()
  ts.init(0)

  ts.enqueueOnce('a', 1000, taskA, 1, 4)
  ts.dequeue('a') // marquée isRemoved
  ts.enqueueOnce('a', 2000, taskA, 1, 4) // plus de tâche active → doit être ajoutée

  const active = ts.tasks.filter(t => !t.isRemoved && t.id === 'a')
  assert('Une nouvelle tâche active est créée après dequeue', active.length === 1)
  assert('Le nouveau time est bien 2000', active[0].time === 2000)
})

// ─── enqueueAbsolute ──────────────────────────────────────────────────────────

describe('TaskScheduler — enqueueAbsolute() : utilise un time absolu', () => {
  const ts = new TaskScheduler()
  ts.init(1000)

  ts.enqueueAbsolute('a', 9999, taskA, 1, 4)

  const task = ts.tasks.find(t => t.id === 'a')
  assert('Le time de la tâche est le time absolu passé en paramètre', task.time === 9999)
})

// ─── extendTask ───────────────────────────────────────────────────────────────

describe('TaskScheduler — extendTask() : prolonge depuis le time de la tâche existante', () => {
  const ts = new TaskScheduler()
  ts.init(0)

  ts.enqueue('a', 1000, taskA, 1, 4) // time = 1000
  ts.extendTask('a', 500, taskA, 1, 4) // doit donner time = 1000 + 500 = 1500

  const active = ts.tasks.filter(t => !t.isRemoved && t.id === 'a')
  assert('Une seule tâche active après extendTask', active.length === 1)
  assert('Le time est bien baseTime + delay', active[0].time === 1500)
})

describe('TaskScheduler — extendTask() : crée la tâche si elle est absente', () => {
  const ts = new TaskScheduler()
  ts.init(1000)

  ts.extendTask('a', 500, taskA, 1, 4) // pas de tâche existante → base = lastFrameTime

  const active = ts.tasks.filter(t => !t.isRemoved && t.id === 'a')
  assert('La tâche est créée', active.length === 1)
  assert('Le time est lastFrameTime + delay', active[0].time === 1500)
})

// ─── enqueueAfter ─────────────────────────────────────────────────────────────

describe('TaskScheduler — enqueueAfter() : se base sur le time de la tâche référencée', () => {
  const ts = new TaskScheduler()
  ts.init(0)

  ts.enqueue('a', 1000, taskA, 1, 4) // time = 1000
  ts.enqueueAfter('a', 'b', 500, taskB, 1, 4) // time = 1000 + 500 = 1500

  const taskB_ = ts.tasks.find(t => t.id === 'b')
  assert('Le time de b est bien baseTime(a) + delay', taskB_.time === 1500)
})

describe('TaskScheduler — enqueueAfter() : se base sur lastFrameTime si id absent', () => {
  const ts = new TaskScheduler()
  ts.init(1000)

  ts.enqueueAfter('inexistant', 'b', 500, taskB, 1, 4)

  const taskB_ = ts.tasks.find(t => t.id === 'b')
  assert('Le time de b est lastFrameTime + delay', taskB_.time === 1500)
})

describe('TaskScheduler — enqueueAfter() : accepte une RegExp comme référence', () => {
  const ts = new TaskScheduler()
  ts.init(0)

  ts.enqueue('chunk_1', 1000, taskA, 1, 4)
  ts.enqueueAfter(/^chunk_/, 'b', 500, taskB, 1, 4)

  const taskB_ = ts.tasks.find(t => t.id === 'b')
  assert('Le time de b est basé sur la tâche correspondant à la regex', taskB_.time === 1500)
})

// ─── update ───────────────────────────────────────────────────────────────────

describe('TaskScheduler — update() : met à jour lastFrameTime', () => {
  const ts = new TaskScheduler()
  ts.init(0)

  ts.update(1234)
  assert('lastFrameTime est mis à jour', ts.lastFrameTime === 1234)
})

describe('TaskScheduler — update() : ne traite pas les tâches dont le time n\'est pas écoulé', () => {
  const ts = new TaskScheduler()
  ts.init(0)
  ts.enqueue('a', 2000, taskA, 1, 4)

  ts.update(1000) // time < 2000 → la tâche reste dans la file

  const remaining = ts.tasks.filter(t => !t.isRemoved)
  assert('La tâche reste dans la file', remaining.length === 1)
})

describe('TaskScheduler — update() : retire les tâches dont le time est écoulé', () => {
  const ts = new TaskScheduler()
  ts.init(0)
  ts.enqueue('a', 1000, taskA, 1, 4)
  ts.enqueue('b', 3000, taskB, 1, 4)

  ts.update(2000) // time >= 1000 → 'a' est retirée, 'b' reste

  assert('La file contient encore 1 tâche', ts.queueSize === 1)
  assert('La tâche restante est \'b\'', ts.tasks[0].id === 'b')
})

describe('TaskScheduler — update() : ignore les tâches marquées isRemoved', () => {
  const ts = new TaskScheduler()
  ts.init(0)
  ts.enqueue('a', 1000, taskA, 1, 4)
  ts.dequeue('a') // marquée isRemoved avant échéance

  ts.update(2000) // time écoulé mais isRemoved → ne doit pas être enfilée dans MicroTasker

  assert('La file est vide après update', ts.queueSize === 0)
})

// ─── debugStats ───────────────────────────────────────────────────────────────

describe('TaskScheduler — debugStats() : retourne une chaîne sans erreur', () => {
  const ts = new TaskScheduler()
  ts.init(0)
  ts.enqueue('a', 1000, taskA, 1, 4)

  captureConsole()
  const result = ts.debugStats()
  releaseConsole()

  assert('debugStats() retourne une string', typeof result === 'string')
  assert('debugStats() contient l\'id de la tâche', result.includes('a'))
})
