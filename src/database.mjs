/**
 * @file database.mjs
 * @description Layer 1 - Wrapper IndexedDB pour la persistance locale.
 */

import {DB_CONFIG} from './constant.mjs'

class DataBase {
  constructor () {
    this.db = null
    this.opened = false
  }

  /* =========================================
     INITIALISATION
     ========================================= */

  // Appel explicite depuis GameCore.boot()
  async init () {
    if (!this.opened) {
      await this.requestPersistence()
      await this.openDataBase()
    }
  }

  async requestPersistence () {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist()
      if (DB_CONFIG.DEBUG) { console.log(`[DB] Persistance accordée: ${isPersisted}`) }
    }
  }

  async openDataBase () {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION)

      request.onerror = (event) => {
        console.error('[DB] Erreur ouverture:', event)
        reject(event)
      }

      request.onsuccess = (event) => {
        this.db = event.target.result
        this.opened = true
        if (DB_CONFIG.DEBUG) console.log('[DB] Base ouverte')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        // code exécuté pour la création de la base de données et à chaque montée en version
        this.db = request.result // this.db = event.target.result
        // ajout d'un handler générique pour toutes les erreurs générées par des requêtes
        this.db.onerror = (e) => console.error(`[DB] Erreur interne: ${e.target.errorCode}`)

        this.updateObjectStore()

        event.target.transaction.oncomplete = () => {
          if (DB_CONFIG.DEBUG) console.log('[DB] Mise à jour structure terminée')
        }
      }
    })
  }

  // mise à jour des object stores pour qu'ils soient exactement ceux listés dans DB_OBJECT_STORES
  updateObjectStore () {
    const existingStoreNames = Array.from(this.db.objectStoreNames)
    // Supprimer les object stores qui ne sont pas dans la liste
    existingStoreNames.forEach(storeName => {
      if (!DB_CONFIG.STORES.includes(storeName)) {
        this.db.deleteObjectStore(storeName)
        if (DB_CONFIG.DEBUG) console.warn(`[DB] Store supprimé: ${storeName}`)
      }
    })

    // Créer les object stores manquants
    DB_CONFIG.STORES.forEach(storeName => {
      if (!existingStoreNames.includes(storeName)) {
        if (storeName === 'gamestate') {
          this.db.createObjectStore(storeName, {keyPath: 'key'})
        } else {
          this.db.createObjectStore(storeName, {keyPath: 'key', autoIncrement: true})
        }
      }
    })
  }

  /* =========================================
     VIDAGE DES TABLES (nouveau monde)
     ========================================= */

  async clearAllObjectStores () {
    if (!this.db) return

    const storeNames = Array.from(this.db.objectStoreNames)
    if (storeNames.length === 0) return

    const transaction = this.db.transaction(storeNames, 'readwrite')

    const clearPromises = storeNames.map(storeName => {
      return new Promise((resolve, reject) => {
        const objectStore = transaction.objectStore(storeName)
        const request = objectStore.clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(new Error(`Failed to clear ${storeName}`))
      })
    })

    try {
      await Promise.all(clearPromises)
      if (DB_CONFIG.DEBUG) { console.log('[DB] All object stores cleared successfully') }
    } catch (error) {
      console.error('[DB] Error clearing object stores:', error)
      throw error
    }
  }

  async clearObjectStore (storeName) {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite')
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.clear()

      request.onsuccess = () => {
        if (DB_CONFIG.DEBUG) { console.log(`[DB] Object store ${storeName} cleared`) }
        resolve()
      }
      request.onerror = () => reject(new Error(`Failed to clear ${storeName}`))
    })
  }

  /* =========================================
     TEST / INFORMATION
     ========================================= */

  hasObjetStore (storeName) { return DB_CONFIG.STORES.includes(storeName) }

  // compter les enregistrements dans un object store
  async countRecords (storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = this.db.transaction(storeName, 'readonly')
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.count()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error(`Failed to count records in ${storeName}`))
    })
  }

  // obtenir un enregistrement par sa clé
  async getRecordByKey (storeName, key) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = this.db.transaction(storeName, 'readonly')
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.get(key)

      request.onsuccess = () => resolve(request.result)
      request.onerror = (event) => reject(new Error(`Failed to get record from ${storeName}: ${event.target.error}`))
    })
  }

  /* =========================================
     CRUD (spécifique)
     ========================================= */

  async readAllFromObjectStore (storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = this.db.transaction(storeName, 'readonly')
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error(`Failed to read from ${storeName}`))
    })
  }

  // ouvre une transaction sur un ou plusieurs Object Stores
  openTransaction (storeNames, mode = 'readwrite') {
    if (!this.db) {
      throw new Error('Database not initialized')
    }
    if (!Array.isArray(storeNames)) { storeNames = [storeNames] }
    return this.db.transaction(storeNames, mode)
  }

  async addOrUpdateRecord (storeName, record, existingTransaction = null) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = existingTransaction || this.db.transaction(storeName, 'readwrite')
      const objectStore = transaction.objectStore(storeName)

      // Si 'key' existe -> put (update), sinon -> add (insert)
      const request = record.key === undefined ? objectStore.add(record) : objectStore.put(record)

      request.onsuccess = (event) => {
        // Si c'était un ajout (add), on récupère l'ID généré par autoIncrement
        if (record.key === undefined) { record.key = event.target.result }
        resolve(record)
      }

      request.onerror = (event) => reject(new Error(`Failed add/update in ${storeName}: ${event.target.error}`))

      // Si nous avons créé la transaction nous-mêmes, nous devons gérer ses erreurs globales
      if (!existingTransaction) {
        // transaction.oncomplete = () => { if (DB_CONFIG.DEBUG) { console.log(`[DB] Transaction for ${storeName} completed`) } }
        transaction.onerror = () => reject(new Error(`Transaction failed for ${storeName}`))
      }
    })
  }

  async addOrUpdateOrDeleteRecords (storeName, records, existingTransaction = null) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = existingTransaction || this.db.transaction(storeName, 'readwrite')
      const objectStore = transaction.objectStore(storeName)

      let completed = 0
      const total = records.length

      if (total === 0) {
        resolve([])
        return
      }

      records.forEach(record => {
        let request
        try {
          if (record.delete !== undefined) {
            request = objectStore.delete(record.delete)
          } else {
            request = record.key === undefined ? objectStore.add(record) : objectStore.put(record)
          }
        } catch (e) {
          reject(new Error(`Request creation failed in ${storeName}: ${e.message}`))
          return
        }

        request.onsuccess = (event) => {
          // Mise à jour de la clé en mémoire si c'était une insertion
          if (record.delete === undefined && record.key === undefined) { record.key = event.target.result }

          completed++
          if (completed === total) { resolve(records) }
        }

        request.onerror = (event) => reject(new Error(`Failed batch op in ${storeName}: ${event.target.error}`))
      })

      // Gestion globale de l'erreur transaction si nous l'avons créée
      if (!existingTransaction) {
        // transaction.oncomplete = () => { if (DB_CONFIG.DEBUG) { console.log(`[DB] Transaction for ${storeName} completed`) } }
        transaction.onerror = () => reject(new Error(`Transaction failed for ${storeName}`))
      }
    })
  }

  async addMultipleRecords (storeName, records) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = this.db.transaction(storeName, 'readwrite')
      const objectStore = transaction.objectStore(storeName)

      records.forEach(record => {
        // Si la clé existe -> put, sinon -> add
        const request = record.key === undefined ? objectStore.add(record) : objectStore.put(record)

        // On a besoin du onsuccess juste pour récupérer la clé générée (AutoIncrement)
        // Mais on ne gère pas la résolution de la promesse ici
        request.onsuccess = (event) => {
          if (record.key === undefined) {
            record.key = event.target.result
          }
        }
      })

      // On attend que TOUT soit fini et commité
      transaction.oncomplete = () => resolve(records)
      transaction.onerror = () => reject(new Error(`Transaction failed for ${storeName}`))
    })
  }

  // effectue plusieurs modifications dans une seule transaction
  async batchUpdate (updates) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      // 1. Identification des stores uniques concernés
      const storeNames = [...new Set(updates.map(update => update.storeName))]

      // 2. Ouverture de la transaction partagée
      const transaction = this.openTransaction(storeNames, 'readwrite')

      const updatePromises = []

      // 3. Dispatch des opérations
      for (const update of updates) {
        if (update.records !== undefined) {
          // Opération de masse (utilise la fonction optimisée précédente)
          updatePromises.push(this.addOrUpdateOrDeleteRecords(update.storeName, update.records, transaction))
        } else if (update.delete !== undefined) {
          // Suppression unitaire
          updatePromises.push(this.deleteRecord(update.storeName, update.delete, transaction))
        } else {
          // Ajout/Modif unitaire
          updatePromises.push(this.addOrUpdateRecord(update.storeName, update.record, transaction))
        }
      }

      // 4. Résolution globale
      Promise.all(updatePromises)
        .then(results => {
          // On attend que la transaction soit réellement committée sur le disque
          transaction.oncomplete = () => resolve(results)
        })
        .catch(error => {
          transaction.abort() // Rollback total en cas d'erreur sur une seule opération
          reject(error)
        })

      transaction.onerror = () => reject(new Error('Batch update failed'))
    })
  }

  async deleteRecord (storeName, key, existingTransaction = null) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = existingTransaction || this.db.transaction(storeName, 'readwrite')
      const objectStore = transaction.objectStore(storeName)

      const request = objectStore.delete(key)

      request.onsuccess = () => resolve()
      request.onerror = (event) => reject(new Error(`Failed to delete record from ${storeName}: ${event.target.error}`))

      // Si nous avons créé une nouvelle transaction spécifique, nous gérons son erreur
      if (!existingTransaction) {
        transaction.onerror = () => reject(new Error(`Transaction for deleting from ${storeName} failed`))
      }
    })
  }

  async deleteMultipleRecords (storeName, keys) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = this.db.transaction(storeName, 'readwrite')
      const objectStore = transaction.objectStore(storeName)

      // Envoi des commandes en rafale
      // Si une seule échoue, la transaction entière échouera (Atomicité)
      keys.forEach(key => {
        objectStore.delete(key)
      })

      transaction.oncomplete = () => {
        if (DB_CONFIG.DEBUG) { console.log(`[DB] Deleted ${keys.length} records from ${storeName}`) }
        resolve()
      }

      transaction.onerror = (event) => reject(new Error(`Batch delete failed in ${storeName}: ${event.target.error}`))
    })
  }

  /* =========================================
     BACKUP / RESTAURATION
     ========================================= */

  async backupDatabase () {
    if (!this.db) return

    const data = {}
    // On itère sur les stores existants
    const storeNames = Array.from(this.db.objectStoreNames)

    try {
      for (const storeName of storeNames) {
        // On réutilise notre méthode sécurisée
        data[storeName] = await this.readAllFromObjectStore(storeName)
      }

      const jsonString = JSON.stringify(data)
      const blob = new Blob([jsonString], {type: 'application/json'})

      // Déclenchement téléchargement navigateur
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'rpgdatabase_backup.json'
      a.click()

      // Nettoyage mémoire de l'URL blob
      URL.revokeObjectURL(a.href)

      if (DB_CONFIG.DEBUG) console.log('[DB] Backup generated successfully')
    } catch (e) {
      console.error('[DB] Backup failed:', e)
    }
  }

  async restoreDatabase (file) {
    if (!this.db) return

    try {
      const jsonString = await file.text()
      const data = JSON.parse(jsonString)

      for (const [storeName, items] of Object.entries(data)) {
        // Sécurité : on ne restaure que vers des stores qui existent
        if (this.db.objectStoreNames.contains(storeName)) {
          await this.clearObjectStore(storeName)
          await this.addMultipleRecords(storeName, items)
        } else if (DB_CONFIG.DEBUG) {
          console.warn(`[DB] Restore: Skipped unknown store '${storeName}'`)
        }
      }

      if (DB_CONFIG.DEBUG) console.log('[DB] Restore completed successfully')
    } catch (e) {
      console.error('[DB] Restore failed:', e)
      throw e
    }
  }

  /* =========================================
     GAMESTATE (key/value)
     ========================================= */

  // met à jour un enregistrement dans la table des key/value
  async setGameState (key, value, existingTransaction = null) {
    return this.addOrUpdateRecord('gamestate', {key, value}, existingTransaction)
  }

  // lit une seule valeur
  async getGameStateValue (key) {
    return this.getRecordByKey('gamestate', key).then(r => r ? r.value : undefined)
  }

  // lit toutes les couples key/value et les retourne dans un objet
  async getAllGameState () {
    // On utilise readAllFromObjectStore (méthode existante de la classe)
    const allRecords = await this.readAllFromObjectStore('gamestate')

    if (!allRecords) return {}

    // Transformation du tableau d'objets [{key, value}, ...] en un seul objet {key: value, ...}
    return allRecords.reduce((acc, record) => {
      acc[record.key] = record.value
      return acc
    }, {})
  }

  // met à jour dans une seule transaction plusieurs couples key/value
  async batchSetGameState (updates) {
    return new Promise((resolve, reject) => {
      // 1. Ouverture d'une transaction unique pour la cohérence
      const transaction = this.openTransaction('gamestate', 'readwrite')

      // 2. Création des promesses d'update
      const updatePromises = updates.map(({key, value}) => {
        // On passe la transaction existante pour éviter d'en créer une nouvelle par appel
        return this.addOrUpdateRecord('gamestate', {key, value}, transaction)
      })

      // 3. Gestion de la résolution
      Promise.all(updatePromises)
        .then(results => {
          transaction.oncomplete = () => {
            if (DB_CONFIG.DEBUG) { console.log('[DB] Batch game state update completed', updates.length) }
            resolve(results)
          }
        })
        .catch(error => {
          transaction.abort() // Annulation de TOUTES les modifications en cas d'erreur
          reject(error)
        })

      transaction.onerror = () => reject(new Error('Batch game state update failed'))
    })
  }
}
export const database = new DataBase()

/* ====================================================================================================
   GENERATEUR IDENTIFIANTS UNIQUES
   ==================================================================================================== */

/**
 * Générateur d'identifiants uniques (Logique).
 * Pattern: Graine (Persistée) + Suffixe (Volatile).
 * Optimisation: Sauvegarde en DB uniquement lors du changement de graine (tous les 26 IDs).
 */
class UniqueIdGenerator {
  #currentSeed
  #currentSuffix

  /**
   * Initialise le générateur au début de la session.
   * @param {string} lastSavedSeed - La dernière graine connue en base de données.
   */
  init (lastSavedSeed) {
    // Au démarrage, on ne sait pas où on s'est arrêté dans le suffixe (a-z).
    // On incrémente donc forcément la graine pour éviter les collisions.
    this.#generateNextSeed(lastSavedSeed || 'a')
  }

  /**
   * Retourne un nouvel ID unique.
   * @returns {string} ID unique (ex: "aba", "abb")
   */
  getUniqueId () {
    // Rotation du suffixe
    if (this.#currentSuffix === 'z') {
      this.#generateNextSeed(this.#currentSeed)
    } else {
      const charCode = this.#currentSuffix.charCodeAt(0)
      this.#currentSuffix = String.fromCharCode(charCode + 1)
    }
    return this.#currentSeed + this.#currentSuffix
  }

  /**
   * Calcule la graine suivante (Base 26 : a -> z -> aa -> ab...).
   * @param {string} seed
   * @returns {string} Nouvelle graine
   */
  #generateNextSeed (seed) {
    const chars = seed.split('')
    let i = chars.length - 1

    while (i >= 0) {
      if (chars[i] === 'z') {
        chars[i] = 'a'
        i--
      } else {
        chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1)
        break
      }
    }

    if (i < 0) { chars.unshift('a') } // Ajoute un 'a' au début si nécessaire

    this.#currentSeed = chars.join('')
    this.#currentSuffix = 'a'
    database.setGameState('unique_id_seed', this.#currentSeed)
  }
}

export const uniqueIdGenerator = new UniqueIdGenerator()
