// achievement.mjs — AchievementOverlay - AchievementManager

import {eventBus} from './utils.mjs'
import {database} from './database.mjs'
import {ACHIEVEMENT_CATEGORIES} from '../../assets/data/data-achievement.mjs'

console.log('ACHIEVEMENT_CATEGORIES', ACHIEVEMENT_CATEGORIES)

class AchievementManager {
  #counts = new Map() // Map<code, count> — chargé depuis DB au startSession

  constructor () {
    this.onCraftPerformed = this.onCraftPerformed.bind(this)
    eventBus.on('craft/performed', this.onCraftPerformed)
  }

  /**
   * Initialise le manager depuis les enregistrements DB.
   * Appelé depuis core.mjs au startSession.
   * @param {Array<{code: string, count: number}>} dbRecords
   */
  init (dbRecords) {
    this.#counts.clear()
    for (const record of dbRecords) {
      this.#counts.set(record.code, record.count)
    }
  }

  // //////////////////////////// //
  // Incrémentation des compteurs //
  // //////////////////////////// //

  /**
   * Incrémente le compteur d'un code et persiste immédiatement.
   * @param {string} code — nodeCode, itemCode ou monsterCode
   * @param {number} count
   */
  increment (code, count) {
    const newCount = (this.#counts.get(code) ?? 0) + count
    this.#counts.set(code, newCount)
    database.putAchievement({code, count: newCount})
  }

  /**
   * Handler 'craft/performed' — incrémente du nombre de runs.
   * Lié dans le constructeur.
   * @param {{recipe: object, runs: number}} param
   */
  onCraftPerformed ({recipe, runs}) {
    this.increment(recipe.result.item.code, runs)
  }
}
export const achievementManager = new AchievementManager()

class AchievementOverlay {
}
export const achievementOverlay = new AchievementOverlay()
