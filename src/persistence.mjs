import {MICROTASK} from './constant.mjs'
import {database} from './database.mjs'
import {taskScheduler} from './utils.mjs'
import {chunkManager} from './world.mjs'

class SaveManager {
  constructor () {
    // Map<string|number, Object>
    // Stocke les mises à jour en attente pour dédoublonner avant écriture
    this.pendingStaticUpdates = new Map()
    // Verrou pour éviter les sauvegardes concurrentes
    this.isSaving = false

    const {priority, capacity} = MICROTASK.PROCESS_SAVE
    this.priority = priority
    this.capacity = capacity
    this.processSave = this.processSave.bind(this)
  }

  /**
   * Lance la boucle de sauvegarde automatique
   */
  init () {
    // Planifie la première sauvegarde dans 2 secondes
    taskScheduler.enqueue('auto_save', 2000, this.processSave, this.priority, this.capacity)
  }

  /**
   * Empile les mises à jour d'objets (Inventaire, Player, etc.)
   * @param {Array|Object} updates - {storeName, record, delete?}
   */
  queueStaticUpdate (updates) {
    const updatesArray = Array.isArray(updates) ? updates : [updates]
    for (const update of updatesArray) {
      const {record, delete: deleteValue} = update

      if (record) {
        // --- Opération d'ajout ou de modification ---
        // 1. Récupération de l'identifiant (Logique ou Physique)
        const recordId = record.id || record.key

        if (recordId === undefined) {
          console.error("queueStaticUpdate: Record must have an 'id' or 'key' attribute.", update)
          continue
        }

        // 2. Ajout de la nouvelle opération qui écrase une version précédente éventuelle
        this.pendingStaticUpdates.set(recordId, update)
      } else if (deleteValue) {
        // --- Opération de suppression ---
        // 1. Récupération de l'identifiant
        const {id: deleteId, key: deleteKey} = deleteValue

        if (deleteId === undefined) {
          console.error("queueStaticUpdate: Delete value must have an 'id' attribute.", update)
          continue
        }

        // 2. Rechercher et supprimer l'opération D'AJOUT PRÉCÉDENTE pour le même ID
        // (Si on a créé l'objet puis supprimé dans les 2s, on n'écrit rien en base)
        this.pendingStaticUpdates.delete(deleteId)

        // 3. Ajout de la nouvelle suppression
        if (deleteKey === undefined) continue

        // On conserve l'objet update tel quel car il contient { storeName, delete: {key...} }
        // On utilise deleteId comme clé de la Map pour l'unicité
        this.pendingStaticUpdates.set(deleteId, update)
      } else {
        console.error('queueStaticUpdate: Invalid update format. Missing record or delete', update)
      }
    }
  }

  /**
   * Exécuté par le TaskScheduler dans une micro-tâche
   */
  processSave () {
    // 1. Re-planification immédiate (Boucle infinie)
    taskScheduler.enqueue('auto_save', 2000, this.processSave.bind(this), this.priority, this.capacity)

    const batchPayload = []

    // --- A. Récupération des Chunks (Layer 2 -> Layer 2) ---
    // chunkManager doit exposer une méthode getDirtyChunksData() retournant
    // un tableau d'objets {storeName: 'world_chunks', record: {key, index, chunk}}
    const dirtyChunks = chunkManager.fetchSaveDirty()
    if (dirtyChunks !== null) {
      for (const chunkIndex of dirtyChunks) {
        const record = chunkManager.getChunkSaveData(chunkIndex)
        batchPayload.push({storeName: 'world_chunks', record})
      }
    }

    // --- B. Récupération des Static Updates (Records) ---
    if (this.pendingStaticUpdates.size > 0) {
      batchPayload.push(...this.pendingStaticUpdates.values())
      this.pendingStaticUpdates.clear()
    }

    // --- C. Sortie rapide si rien à faire ---
    if (batchPayload.length === 0) return

    // --- D. Écriture Atomique (Transaction) ---
    // batchUpdate gère l'ouverture de la transaction sur tous les stores concernés
    database.batchUpdate(batchPayload)
  }
}
export const saveManager = new SaveManager()
