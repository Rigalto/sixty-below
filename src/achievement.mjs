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

  // //////////////////////////// //
  // Helpers                      //
  // //////////////////////////// //

  /**
   * Calcule les points d'un item selon son count et les seuils de sa catégorie.
   * @param {number} count
   * @param {number[]} thresholds
   * @returns {0|5|7|8}
   */
  #computePts (count, thresholds) {
    if (count >= thresholds[2]) return 8
    if (count >= thresholds[1]) return 7
    if (count >= thresholds[0]) return 5
    return 0
  }

  /**
   * Calcule le bonus de complétude d'une catégorie depuis le minimum des pts de ses items.
   * @param {number} minPts
   * @returns {0|5|7|8}
   */
  #computeCompletionPts (minPts) {
    if (minPts >= 8) return 8
    if (minPts >= 7) return 7
    if (minPts >= 5) return 5
    return 0
  }

  // //////////////////////////// //
  // Données pour l'overlay       //
  // //////////////////////////// //

  /**
   * Construit la table de succès complète pour l'overlay.
   * Appelé à l'ouverture de AchievementOverlay.
   * @returns {{pts: number, maxPts: number, categories: Array<object>}}
   */
  buildAchievementTable () {
    let totalPts = 0
    let totalMax = 0
    const categories = []

    for (const cat of ACHIEVEMENT_CATEGORIES) {
      let catItemPts = 0
      let minPts = 8

      for (const code of cat.items) {
        const pts = this.#computePts(this.#counts.get(code) ?? 0, cat.thresholds)
        catItemPts += pts
        if (pts < minPts) minPts = pts
      }

      const catPts = catItemPts + this.#computeCompletionPts(minPts)
      const maxPts = cat.items.length * 8 + 8
      totalPts += catPts
      totalMax += maxPts
      categories.push({id: cat.id, label: cat.label, pts: catPts, maxPts})
    }

    return {pts: totalPts, maxPts: totalMax, categories}
  }

  /**
   * Calcule le détail d'une catégorie à la volée.
   * Appelé au clic sur une catégorie dans AchievementOverlay.
   * @param {string} categoryId
   * @returns {{items: Array<object>, completionPts: number}|null}
   */
  getCategoryDetail (categoryId) {
    let cat = null
    for (const c of ACHIEVEMENT_CATEGORIES) {
      if (c.id === categoryId) { cat = c; break }
    }
    if (cat === null) return null

    const items = []
    let minPts = 8

    for (const code of cat.items) {
      const count = this.#counts.get(code) ?? 0
      const pts = this.#computePts(count, cat.thresholds)
      const nextThreshold = pts === 8
        ? null
        : pts === 7
          ? cat.thresholds[2]
          : pts === 5
            ? cat.thresholds[1]
            : cat.thresholds[0]
      if (pts < minPts) minPts = pts
      items.push({code, count, pts, nextThreshold})
    }

    return {items, completionPts: this.#computeCompletionPts(minPts)}
  }
}
export const achievementManager = new AchievementManager()

class AchievementOverlay {
}
export const achievementOverlay = new AchievementOverlay()
