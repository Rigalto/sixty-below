// achievement.mjs — AchievementOverlay - AchievementManager

class AchievementManager {
  #counts = new Map() // Map<code, count> — chargé depuis DB au startSession

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
}
export const achievementManager = new AchievementManager()

class AchievementOverlay {
}
export const achievementOverlay = new AchievementOverlay()
