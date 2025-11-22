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
