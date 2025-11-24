import {SKY_COLORS} from './constant.mjs'

class EventBus {
  constructor () {
    this.listeners = new Map() // Map<eventType, Set[callbacks]>
  }

  on (event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event).add(callback)
  }

  off (event, callback) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback)
      if (callbacks.size === 0) { this.listeners.delete(event) }
    }
  }

  emit (event, data) {
    const callbacks = this.listeners.get(event)
    if (!callbacks) return // Si aucun listener pour cet événement, on ne fait rien.

    // On exécute chaque callback immédiatement et séquentiellement.
    for (const cb of callbacks) {
      try {
        // Appel direct et synchrone du handler.
        // Si le handler doit faire une tâche longue, c'est sa responsabilité de l'ajouter au MicroTasker.
        cb(data)
      } catch (e) {
        console.error(`EventBus:emit - Erreur dans un handler de l'événement '${event}' pour la fonction '${cb.name}':`, e)
      }
    }
  }

  // Affiche les statistiques des événements et des écouteurs
  debugStats () {
    let output = '--- EventBus - Listeners List ---\n'
    const sortedEvents = Array.from(this.listeners.keys()).sort()

    for (const event of sortedEvents) {
      const callbacks = this.listeners.get(event)
      if (!callbacks || callbacks.size === 0) { continue }

      output += `${event}:\n`
      output += `  Count: ${callbacks.size}\n`
      output += '  Listeners:\n'

      for (const cb of callbacks) {
        // Nettoyer le nom de la fonction pour gérer le préfixe "bound " (fréquent sur les events)
        let fnName = cb.name || '(anonymous)'
        if (fnName.startsWith('bound ')) {
          fnName = fnName.substring(6)
        }
        output += `    - ${fnName}\n`
      }
      output += '---------------------------------\n'
    }
    console.log(output)
    return output
  }
}
export const eventBus = new EventBus()

const MAX_QUEUE_LENGTH = 100 // Limite arbitraire
// Le budget est en unités de 1/4ms, soit 5ms * 4 = 20 unités.

class MicroTasker {
  constructor () {
    this.taskQueue = [] // Table des fonctions enregistrées, triées par priorité puis par capacité
    this.taskStats = {}
    this.resetStats = this.resetStats.bind(this)
    this.MICROTASK_FN_NAME_TO_KEY = null
  }

  initDebug (MICROTASK_FN_NAME_TO_KEY) { this.MICROTASK_FN_NAME_TO_KEY = MICROTASK_FN_NAME_TO_KEY }

  // renvoie l'index pour la priorité et la capacité passées en paramètre
  #calculateIndex (priority, capacityUnits) {
    return (priority << 5) | capacityUnits
  }

  // Enregistre une fonction avec ses paramètres dans la file.
  enqueue (fn, priority, capacityUnits, ...args) {
    // A limiter entre 1 et 20, 20 par défaut
    this.#addToTaskQueue({fn, priority, capacityUnits, args})
  }

  // Ajoute une fonction à la liste des micro-tâches à exécuter uniquement si elle n'y est pas déjà présente.
  // Cette fonction est optimisée au maximum pour son temps d'exécution.
  enqueueOnce (fn, priority, capacityUnits, ...args) {
    for (const t of this.taskQueue) {
      if (t.fn === fn) { return }
    }
    // La fonction n'est pas dans la file, on l'ajoute.
    this.#addToTaskQueue({fn, priority, capacityUnits, args})
  }

  // insertion au bon endroit - tri : tâche la plus prioritaire en fin de tableau
  #addToTaskQueue (task) {
    task.capacityUnits = Math.max(1, Math.min(task.capacityUnits, 20)) || 20
    task.index = this.#calculateIndex(task.priority, task.capacityUnits)
    this.taskQueue.push(task)
    this.taskQueue.sort((a, b) => a.index - b.index)
    if (this.taskQueue.length > 20) {
      console.log('microTasker.#addToTaskQueue', this.debug())
    }
  }

  dequeue (fn) {
    this.taskQueue = this.taskQueue.filter(task => task.fn !== fn)
  }

  // Vide la table des fonctions enregistrées.
  clear () {
    this.taskQueue.length = 0
  }

  // renvoie la taille de la file
  get queueSize () { return this.taskQueue.length }

  // Exécute des fonctions selon leur priorité et leur capacité
  update (budget) {
    if (this.taskQueue.length === 0) { return }
    this.budget = (budget * 4) | 0 // Réinitialise le budget pour chaque frame
    if (this.taskQueue.length > MAX_QUEUE_LENGTH) {
      console.error(`MicroTasker.update File de tâches trop longue (${this.taskQueue.length} tâches).`)
    }

    const startTime = performance.now()
    const deadline = startTime + this.budget / 4 // L'heure à ne pas dépasser

    // exécute la tâche la plus prioritaire (rapide avec pop())
    const highestPriorityTask = this.taskQueue.pop()
    this.#executeTask(highestPriorityTask)

    // s'il reste du budget et des micro-tâches, on tente d'en exécuter
    // while (this.taskQueue.length > 0 && this.budget > 0) {

    while (this.taskQueue.length > 0 && performance.now() < deadline) {
      const remainingTimeMs = deadline - performance.now()
      const remainingBudgetUnits = Math.floor(remainingTimeMs * 4)

      const taskToExecute = this.#findTaskInBudget(remainingBudgetUnits)

      if (taskToExecute === null) { break }
      // Exécute la tâche
      this.#executeTask(taskToExecute)
    }
  }

  // renvoie la tâche la plus prioritaire rentrant dans le budget passé en paramètre
  #findTaskInBudget (currentBudget) {
    // Parcourt le tableau depuis la fin
    for (let i = this.taskQueue.length - 1; i >= 0; i--) {
      const task = this.taskQueue[i]
      // Vérifie si la capacité de la tâche rentre dans le budget restant
      if (task.capacityUnits <= currentBudget) {
        // Tâche trouvée !
        // Supprime la tâche du tableau en utilisant son index 'i'
        // splice retourne un tableau contenant l'élément supprimé, on prend le premier [0]
        // Retourne la tâche trouvée et supprimée
        return this.taskQueue.splice(i, 1)[0]
      }
    }
    return null
  }

  #executeTask (task) {
    const {fn, args} = task
    const startTime = performance.now()
    try {
      fn(...args) // Exécution de la fonction
    } catch (error) {
      console.error(`MicroTasker.#executeTask Erreur lors de l'exécution de la fonction '${fn.name}':`, error)
    }
    const executionTime = performance.now() - startTime
    // DEBUG ET OPTIMISATION
    // /////////////////////
    const taskName = fn.name
    // console.log(`Executing task: ${taskName} (Prio: ${priority}, Cap: ${capacityUnits} ¼mms) - ${executionTime} ms`) // Debug
    // Log si dépasse le budget max *par tâche* (à définir, ex: 5ms)
    if (executionTime > 5) { // Si une seule tâche dépasse 5ms
      console.warn(`MicroTasker.#executeTask - La fonction '${taskName}' a dépassé 5ms (${executionTime.toFixed(2)}ms).`)
    }
    // Initialise les stats pour cette tâche si elles n'existent pas
    if (!this.taskStats[taskName]) { this.taskStats[taskName] = {count: 0, totalDuration: 0, maxDuration: 0, histogramBins: new Array(11).fill(0)} }
    const stats = this.taskStats[taskName]
    // log pour optimiser la capacité
    stats.count++
    stats.totalDuration += executionTime
    if (executionTime > stats.maxDuration) { stats.maxDuration = executionTime }
    const binIndex = Math.min(stats.histogramBins.length - 1, Math.floor(executionTime / 0.5))
    stats.histogramBins[binIndex] += 1
  }

  debug () {
    const ret = []
    // Itère depuis la fin pour montrer la plus haute priorité en premier
    for (let i = this.taskQueue.length - 1; i >= 0; i--) {
      const task = this.taskQueue[i]
      ret.push(`${task.fn.name} (Prio: ${task.priority}, Cap: ${task.capacityUnits} ¼ms)`)
    }
    return '\n' + ret.join('\n') // Utilise newline pour une meilleure lisibilité si long
  }

  // Méthode pour réinitialiser les statistiques
  resetStats () {
    console.log('MicroTasker.resetStats')
    this.taskStats = {}
  }

  // Fonction pour afficher les statistiques collectées (adaptée pour les bins dynamiques)
  debugStats () {
    this.histogramBinSize = 0.5
    this.histogramNumBins = 10

    let output = '--- MicroTasker Execution Stats ---\n'
    const sortedNames = Object.keys(this.taskStats).sort()

    for (const taskName of sortedNames) {
      const stats = this.taskStats[taskName]
      if (!stats || stats.count === 0) continue // Skip if no stats or no executions

      // 1. Nettoyer le nom de la tâche pour gérer le préfixe "bound "
      const cleanTaskName = taskName.startsWith('bound ') ? taskName.substring(6) : taskName
      // 2. Trouver la capacité correspondante
      const currentCapacity = this.MICROTASK_FN_NAME_TO_KEY[cleanTaskName]
      // 3. Calculer la durée moyenne d'exécution
      const avgDuration = stats.totalDuration / stats.count
      output += `${taskName} (Cap: ${currentCapacity}):\n`
      output += `  Count: ${stats.count}\n`
      output += `  Avg Duration: ${avgDuration.toFixed(3)} ms\n`
      output += `  Max Duration: ${stats.maxDuration.toFixed(3)} ms\n`

      // --- Affichage de l'Histogramme ---
      output += `  Histogram (Bin Size: ${this.histogramBinSize}ms):\n`
      const maxBinCount = Math.max(...stats.histogramBins) // Pour scaling
      const scaleFactor = maxBinCount > 50 ? 50 / maxBinCount : 1 // Example scaling

      for (let i = 0; i < this.histogramNumBins; i++) {
        const lowerBound = i * this.histogramBinSize
        const upperBound = (i + 1) * this.histogramBinSize
        const label = `${lowerBound.toFixed(1)}-${upperBound.toFixed(1)}ms`.padEnd(10)
        const count = stats.histogramBins[i]
        const bar = '*'.repeat(Math.round(count * scaleFactor))
        output += `    ${label}: ${count.toString().padStart(5)} ${bar}\n`
      }
      // Affiche le dernier bin "> limite"
      const lastBinLowerBound = this.histogramNumBins * this.histogramBinSize
      const lastLabel = `>${lastBinLowerBound.toFixed(1)}ms`.padEnd(10)
      const lastCount = stats.histogramBins[this.histogramNumBins]
      const lastBar = '*'.repeat(Math.round(lastCount * scaleFactor))
      output += `    ${lastLabel}: ${lastCount.toString().padStart(5)} ${lastBar}\n`
      // --- Fin Histogramme ---

      output += '---------------------------------\n'
    }
    console.log(output)
    return output
  }

  // Fonction pour afficher les statistiques collectées
  debugStats_ () {
    let output = '--- MicroTask Execution Stats ---\n'
    const sortedNames = Object.keys(this.taskStats).sort() // Trie par nom pour la cohérence

    for (const taskName of sortedNames) {
      const stats = this.taskStats[taskName]
      const avgDuration = stats.count > 0 ? (stats.totalDuration / stats.count) : 0
      output += `${taskName}:\n`
      output += `  Avg Duration: ${avgDuration.toFixed(3)} ms (Count: ${stats.count})\n`
      output += `  Max Duration: ${stats.maxDuration.toFixed(3)} ms\n`
      output += '---------------------------------\n'
    }
    console.log(output)
    return output // Retourne aussi la chaîne pour un usage éventuel
  }
}

// Export du singleton
export const microTasker = new MicroTasker()

class TaskScheduler {
  constructor () {
    this.tasks = [] // Tableau trié des tâches
    this.lastFrameTime = 0
  }

  // initialisation de l'heure absolue
  initTime (time) { this.lastFrameTime = time }

  // Ajoute une tâche à exécuter après un délai
  enqueue (id, delay, fn, priority, capacityUnits, ...args) {
    const task = {id, time: delay + this.lastFrameTime, fn, args, priority, capacityUnits, isRemoved: false}
    return this.#addTask(task)
  }

  // Modifie le délai d'une tâche existante, en la créant systématiquement
  // si on modifie uniquement le 'time' de la tâche existante, elle ne serait pas triée
  requeue (id, delay, fn, priority, capacityUnits, ...args) {
    this.dequeue(id) // Marque les anciennes comme 'isRemoved = true'
    const task = {id, time: delay + this.lastFrameTime, fn, priority, capacityUnits, args, isRemoved: false}
    return this.#addTask(task)
  }

  // Cherche une tâche unique par son ID (obligatoirement une string), la marque comme supprimée et la retourne.
  // Renvoie la tâche si UNE SEULE a été trouvée et supprimée.
  // Renvoie null si ZÉRO ou PLUS D'UNE tâche active a été trouvée (aucune suppression n'est alors effectuée).
  #findAndRemoveTask (id) {
    let foundTask = null
    let count = 0

    // 1. On parcourt la liste pour trouver toutes les correspondances actives
    for (const task of this.tasks) {
      if (!task.isRemoved && task.id === id) {
        count++
        foundTask = task // On mémorise la tâche trouvée
      }
    }

    // 2. On applique la logique de sécurité
    // Si on a trouvé 0 ou plus d'une tâche, on n'a pas de base de temps fiable.
    // On abandonne et on ne supprime rien pour éviter les effets de bord inattendus.
    if (count !== 1) return null

    // 3. Si une seule tâche a été trouvée, on la marque comme supprimée et on la retourne.
    foundTask.isRemoved = true
    return foundTask
  }

  // Prolonge une tâche existante ou la crée si elle n'existe pas.
  // Le délai est ajouté à l'heure d'expiration de la tâche existante.
  extendTask (id, delay, fn, priority, capacityUnits, ...args) {
    // 1. On essaie de trouver et supprimer la tâche existante en une seule opération.
    const existingTask = this.#findAndRemoveTask(id)
    // 2. On détermine le temps de base.
    const baseTime = existingTask ? existingTask.time : this.lastFrameTime
    // 3. On crée la nouvelle tâche avec l'heure d'expiration prolongée.
    const task = {id, time: baseTime + delay, fn, priority, capacityUnits, args, isRemoved: false}
    // 4. On ajoute la tâche à la file triée et on retourne son heure d'expiration.
    return this.#addTask(task)
  }

  // Ajoute une tâche à exécuter à un temps absolu.
  enqueueAbsolute (id, time, fn, priority, capacityUnits, ...args) {
    const task = {id, time, fn, args, priority, capacityUnits, isRemoved: false}
    return this.#addTask(task)
  }

  // ajoute la tâche uniquement si elle n'est pas déjà présente
  // ne fait rien si elle est présnete
  enqueueOnce (id, delay, fn, priority, capacityUnits, ...args) {
    const old = this.tasks.find(task => !task.isRemoved && task.id === id)
    if (old !== undefined) { return old.time }
    const task = {id, time: delay + this.lastFrameTime, fn, priority, capacityUnits, args, isRemoved: false}
    return this.#addTask(task)
  }

  // Ajoute une tâche après la dernière tâche correspondant à un identifiant ou une regex.
  enqueueAfter (idOrRegex, newId, delay, fn, priority, capacityUnits, ...args) {
    const lastMatchingTask = this.tasks.find(task => {
      if (task.isRemoved) { return false }
      if (typeof idOrRegex === 'string') {
        return task.id === idOrRegex
      } else if (idOrRegex instanceof RegExp) {
        return idOrRegex.test(task.id)
      }
      return false
    })
    const baseTime = lastMatchingTask ? lastMatchingTask.time : this.lastFrameTime
    const task = {id: newId, time: delay + baseTime, fn, priority, capacityUnits, args, isRemoved: false}
    return this.#addTask(task)
  }

  // Ajoute une tâche à exécuter
  #addTask (task) {
    // if (typeof task.fn !== 'function') { debugger }
    // Insérer la tâche dans le tableau trié via recherche dichotomique
    let left = 0
    let right = this.tasks.length
    while (left < right) {
      // const mid = Math.floor((left + right) / 2)
      const mid = (left + right) >>> 1 // Bitwise shift est plus safe/rapide
      if (this.tasks[mid].time < task.time) {
        right = mid
      } else {
        left = mid + 1
      }
    }
    this.tasks.splice(left, 0, task) // Insertion rapide
    return task.time
  }

  // Supprime toutes les tâches correspondant à un identifiant ou une regex.
  dequeue (idOrRegex) {
    if (typeof idOrRegex === 'string') {
      for (const task of this.tasks) {
        if (task.id === idOrRegex) {
          task.isRemoved = true // Marquer la tâche comme supprimée
        }
      }
    } else if (idOrRegex instanceof RegExp) {
      for (const task of this.tasks) {
        if (idOrRegex.test(task.id)) {
          task.isRemoved = true // Marquer la tâche comme supprimée
        }
      }
    }
  }

  // Vérifie s'il existe une tâche correspondant à un identifiant ou une regex existe.
  has (idOrRegex) {
    if (typeof idOrRegex === 'string') {
      return this.tasks.some(task => !task.isRemoved && task.id === idOrRegex)
    } else if (idOrRegex instanceof RegExp) {
      return this.tasks.some(task => !task.isRemoved && idOrRegex.test(task.id))
    }
  }

  // renvoie la première action (celle qui sera lancée en premier
  // Renvoie 'undefined' si aucune action ne correspond
  findFirstTarget (idOrRegex) {
    // Parcourt le tableau depuis la fin (plus ancien temps, première exécution) vers le début
    for (let i = this.tasks.length - 1; i >= 0; i--) {
      const task = this.tasks[i]
      // Ignore les tâches marquées comme supprimées
      if (task.isRemoved) { continue }

      // Vérifie la correspondance de l'ID
      let match = false
      if (typeof idOrRegex === 'string') {
        match = (task.id === idOrRegex)
      } else if (idOrRegex instanceof RegExp) {
        // Vérifie si task.id est une chaîne avant d'utiliser test()
        match = idOrRegex.test(task.id)
      }
      // correspondance trouvée
      if (match) { return task }
    }
    // Aucune tâche correspondante (et non supprimée) trouvée
    return undefined
  }

  // Recherche une action avec un target et des paramètres spécifiques.
  // Renvoie la tâche si elle est trouvée, 'undefined' sinon
  findAction (idOrRegex, params) {
    return this.tasks.find(task => {
      if (task.isRemoved) { return false }
      // Vérifie la correspondance de l'ID
      let match = false
      if (typeof idOrRegex === 'string') {
        match = (task.id === idOrRegex)
      } else if (idOrRegex instanceof RegExp) {
        // Vérifie si task.id est une chaîne avant d'utiliser test()
        match = idOrRegex.test(task.id)
      }
      // correspondance trouvée
      if (!match) { return false } // identifiant ne correspond pas

      if (params) {
        for (let i = 0; i < params.length; i++) {
          // Correction ici : task.args
          if (params[i] !== undefined && task.args[i] !== params[i]) return false // Paramètre défini et différent
        }
      }

      return true // Tous les paramètres correspondent
    })
  }

  //* Retourne le nombre de tâches dans la table.
  get queueSize () { return this.tasks.length }

  // Vide la table des tâches
  clear () { this.tasks.length = 0 }

  // Boucle principale appelée à chaque frame.
  update (currentTime) {
    this.lastFrameTime = currentTime

    // Vérifier et exécuter les tâches dont le délai est écoulé
    while (this.tasks.length > 0 && this.tasks[this.tasks.length - 1].time <= currentTime) {
      const task = this.tasks.pop() // La tâche la plus ancienne est en dernier
      if (!task.isRemoved) { microTasker.enqueue(task.fn, task.priority, task.capacityUnits, ...task.args) }
    }
  }

  // renvoie une chaîne de caractères listant les actions en attente
  debug () {
    return this.tasks.filter(a => !a.isRemoved).map(a => a.id).join(', ')
  }

  // Fonction pour afficher les statistiques collectées
  debugStats () {
    let output = '--- TaskScheduler - Task List ---\n'
    const currentTime = this.lastFrameTime
    for (const task of this.tasks) {
      if (task.isRemoved) { continue }
      output += `${task.id}:\n`
      output += `  Due time: ${task.time.toFixed(1)} ms (Duration: ${(task.time - currentTime).toFixed(1)})\n`
      output += `  Function: ${task.fn.name}\n`
      output += `  Priority: ${task.priority}\n`
      output += `  Capacity: ${task.capacityUnits} ¼ms\n`
      output += '---------------------------------\n'
    }
    console.log(output)
    return output // Retourne aussi la chaîne pour un usage éventuel
  }
}
export const taskScheduler = new TaskScheduler()

// Constantes de conversion
const REAL_MS_PER_GAME_MINUTE = 1000 // 1000ms réelles = 1 minute dans le jeu
const GAME_MINUTES_PER_DAY = 1440 // 24h * 60min

class TimeManager {
  // Déclaration des champs privés
  #minute5Cache
  #isFirstLoop

  constructor () {
    // Source de vérité : Temps réel écoulé en jeu (ms)
    this.timestamp = 480000

    // Propriétés Publiques (Cache mis à jour par update)
    this.day = -1
    this.timeSlot = -1
    this.hour = -1
    this.#minute5Cache = -1
    this.minute = -1

    // Environnement
    this.weather = 0
    this.nextWeather = 0
    this.true = SKY_COLORS[35] // Jour par défaut
    this.isDay = false
    this.moonPhase = 0

    // État interne
    this.#isFirstLoop = true
  }

  /**
   * Initialisation des données (Phase 1).
   * N'émet AUCUN événement.
   * @param {number} savedTimestamp - Temps écoulé en ms (défaut jour 1 à 8h00 = 480 000 ms)
   */
  init (savedTimestamp = 480000, savedWeather = 0, savedNextWeather = 0) {
    this.timestamp = savedTimestamp
    this.weather = savedWeather
    this.nextWeather = savedNextWeather
    this.currentSkyColor = SKY_COLORS[35] // Jour par défaut
    this.isDay = false

    // Reset du cache pour forcer la détection de changement
    this.day = -1
    this.timeSlot = -1
    this.hour = -1
    this.#minute5Cache = -1
    this.minute = -1

    // On arme le flag pour la première frame
    this.#isFirstLoop = true
  }

  /**
   * Avance le temps (Phase 2 - Loop).
   * @param {number} dt - Delta time réel en ms
   * @returns {number} - Le timestamp jeu actuel (ms)
   */
  update (dt) {
    // Incrément direct du temps réel
    this.timestamp += dt

    if (this.#isFirstLoop) {
      this.#recalculateAndEmit(true)
      this.#isFirstLoop = false
    } else {
      this.#recalculateAndEmit(false)
    }

    return this.timestamp
  }

  #recalculateAndEmit (isFirstLoop = false) {
    // CONVERSION : Playtime (ms) -> Calendrier Monde
    const totalGameMinutes = Math.floor(this.timestamp / REAL_MS_PER_GAME_MINUTE)

    const day = Math.floor(totalGameMinutes / GAME_MINUTES_PER_DAY)
    const dayTimeMinutes = totalGameMinutes % GAME_MINUTES_PER_DAY // 0 - 1439
    const hour = Math.floor(dayTimeMinutes / 60)
    const minute = dayTimeMinutes % 60

    // 1. CHECK MINUTE (Base du calendrier)
    if (isFirstLoop || minute !== this.minute) {
      // Mise à jour des propriétés publiques
      this.minute = minute

      // Payload Clock
      const clockData = {day, hour, minute}
      eventBus.emit('time/clock', clockData)

      // 2. CHECK 5 MINUTES
      const min5 = Math.floor(totalGameMinutes / 5)
      if (isFirstLoop || min5 !== this.#minute5Cache) {
        this.#minute5Cache = min5

        this.#updateSkyColor(dayTimeMinutes, isFirstLoop)
        eventBus.emit('time/every-5-minutes', clockData)

        // 3. CHECK HEURE
        if (isFirstLoop || hour !== this.hour) {
          this.hour = hour
          this.isDay = (hour >= 6 && hour < 21)
          clockData.isDay = this.isDay
          eventBus.emit('time/every-hour', clockData)

          // 4. CHECK TIME SLOT (3H)
          const tslot = Math.floor(hour / 3)
          if (isFirstLoop || tslot !== this.timeSlot) {
            this.timeSlot = tslot
            eventBus.emit('time/timeslot', {tslot, isDay: this.isDay})
          }

          // 5. CHECK JOUR (Minuit)
          if (isFirstLoop || day !== this.day) {
            this.day = day
            this.moonPhase = day & 7

            // Gestion rotation météo (sauf au tout premier lancement pour respecter la save)
            if (!isFirstLoop) {
              this.weather = this.nextWeather
              this.nextWeather = 0 // TODO: RNG
            }

            eventBus.emit('time/daily', {
              day,
              weather: this.weather,
              nextWeather: this.nextWeather,
              moonPhase: this.moonPhase
            })
          }
        }
      }
    }

    // Cas spécial First Loop : on envoie un snapshot complet pour init UI
    if (isFirstLoop) {
      eventBus.emit('time/first-loop', {
        day: this.day,
        hour: this.hour,
        minute: this.minute,
        tslot: this.timeSlot,
        weather: this.weather,
        nextWeather: this.nextWeather,
        skyColor: this.currentSkyColor,
        moonPhase: this.moonPhase,
        isDay: this.isDay
      })
    }
  }

  #updateSkyColor (dayMinutes, forceEmit) {
    let colorIndex = 35 // Jour

    if (dayMinutes < 180 || dayMinutes > 1260) {
      colorIndex = 0 // Nuit
    } else if (dayMinutes < 360) {
      colorIndex = Math.trunc((dayMinutes - 180) / 5)
    } else if (dayMinutes > 1080) {
      colorIndex = 36 - Math.trunc((dayMinutes - 1080) / 5)
    }

    const newColor = SKY_COLORS[colorIndex]

    if (forceEmit || this.currentSkyColor !== newColor) {
      this.currentSkyColor = newColor

      // Mise à jour Data Layer 0 (Optimisation Rendu) On va faire différemment
      // if (NODES.SKY) NODES.SKY.color = newColor

      eventBus.emit('time/sky-color-changed', newColor)
    }
  }
}

export const timeManager = new TimeManager()
