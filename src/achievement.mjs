// achievement.mjs — AchievementOverlay - AchievementManager

import {eventBus} from './utils.mjs'
import {database} from './database.mjs'
import {OVERLAYS} from './constant.mjs'
import {createOverlayHeader} from './ui.mjs'
import {ITEMS, MONSTERS} from '../../assets/data/data.mjs'
import {ACHIEVEMENT_CATEGORIES} from '../../assets/data/data-achievement.mjs'

/* ====================================================================================================
   ACHIEVEMENT MANAGER
   ====================================================================================================

   Autorité unique sur les compteurs de succès. Aucune logique DOM.
   Singleton : achievementManager.

   Responsabilités :
     - Chargement des compteurs depuis DB au startSession (init)
     - Incrémentation des compteurs via un point d'entrée unique (increment)
     - Persistance fire-and-forget via database.putAchievement
     - Calcul des points et de la table complète pour AchievementOverlay (buildAchievementTable)
     - Calcul à la volée du détail d'une catégorie (getCategoryDetail)

   Interactions :
     database          — putAchievement (fire-and-forget, découplé du save synchrone)
     eventBus          — écoute les événements d'action du jeu pour incrémenter les compteurs
     ACHIEVEMENT_CATEGORIES — constante de définition des catégories (data-achievement.mjs)

   Structure DB (objectStore 'achievements') :
     {code: string, count: number}
     keyPath : 'code' — pas d'autoincrement. Opération unique : put() (upsert).
     Points non persistés — recalculés depuis les compteurs au chargement.
     Réinitialisé à chaque nouveau monde (clearObjectStore dans generate.mjs).

   Données en mémoire :
     #counts — Map<code, count> — compteurs cumulés depuis la création du monde

   Événements écoutés :
     'craft/performed'  {recipe, runs} — incrémente de runs (pas du nombre d'items produits)
     (à venir) 'mine/node', 'forage/herb', 'monster/killed'...

   Calcul des points par item (thresholds [t1, t2, t3]) :
     count ≥ t3 → 8 pts  |  count ≥ t2 → 7 pts  |  count ≥ t1 → 5 pts  |  sinon → 0 pt

   Calcul du bonus de complétude (min des pts des membres d'une catégorie) :
     min ≥ 8 → 8 pts  |  min ≥ 7 → 7 pts  |  min ≥ 5 → 5 pts  |  sinon → 0 pt
   ==================================================================================================== */

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
      categories.push({id: cat.id, label: cat.label, pts: catPts, maxPts, completionPts: this.#computeCompletionPts(minPts)})
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

// ── Styles AchievementOverlay ────────────────────────────────────────────────
const achievementStyle = document.createElement('style')
achievementStyle.textContent = /* css */`
#ui-achievement-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 500px;
  background-color: var(--ov-bg-side);
  border: 1px solid var(--ov-border);
  box-shadow: 0 10px 30px rgba(0,0,0,0.8);
  border-radius: 4px;
  z-index: ${OVERLAYS.achievement.zIndex};
  display: none;
  flex-direction: column;
  font-family: Segoe UI, Roboto, sans-serif;
  color: #ffffff;
  user-select: none;
}
#ui-achievement-panel .ach-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
  gap: 12px;
  overflow: hidden;
  background-color: var(--ov-bg-main);
}
#ui-achievement-panel .ach-summary {
  font-size: 16px;
  font-weight: bold;
  color: var(--ov-text-orange);
  text-align: center;
  background-color: var(--ov-bg-deep);
  padding: 24px;
  border-radius: 4px;
}

#ui-achievement-panel .ach-list {
  flex: 1;
  padding: 0 16px 16px 16px;
  min-height: 0;      /* indispensable pour qu'un enfant flex puisse scroller */
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
#ui-achievement-panel .ach-category-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 4px;
  background-color: var(--ov-bg-side);
  border: 1px solid var(--ov-border-sub);
  cursor: pointer;
}
#ui-achievement-panel .ach-category-row:hover {
  background-color: var(--ov-bg-deep);
  border-color: var(--ov-border);
}
#ui-achievement-panel .ach-category-label { color: var(--ov-text); font-size: 14px; }
#ui-achievement-panel .ach-category-pts   { font-size: 13px; font-weight: bold; }

#ui-achievement-panel .ach-detail {
  padding: 8px 12px;
  background-color: var(--ov-bg-deep);
  border: 1px solid var(--ov-border-sub);
  border-radius: 4px;
  margin-left: 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

#ui-achievement-panel .ach-detail-row  {
  display: grid;
  grid-template-columns: 1fr 300px 20px;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
#ui-achievement-panel .ach-detail-name  { color: var(--ov-text); }
#ui-achievement-panel .ach-detail-count {
  text-align: center;
  color: var(--ov-text-muted);
  white-space: nowrap;
}
#ui-achievement-panel .ach-detail-pts   {text-align: right; font-weight: bold; }
`
document.head.appendChild(achievementStyle)

/* ====================================================================================================
   ACHIEVEMENT OVERLAY
   ====================================================================================================

   Panel d'affichage des succès. Raccourci : [U].
   Singleton : achievementOverlay.

   Responsabilités :
     - Affichage du score total et du maximum (résumé en tête, toujours visible)
     - Liste des catégories avec score coloré selon le niveau de complétude
     - Détail d'une catégorie au clic : items, compteurs, seuil suivant, points
     - Gestion de l'expand/collapse via un unique #detailEl déplacé dans le DOM

   Interactions :
     achievementManager — buildAchievementTable() à l'ouverture, getCategoryDetail() au clic
     ITEMS              — résolution des noms d'items dans le détail
     eventBus           — écoute : 'achievement/open', 'achievement/close'

   Structure DOM :
     #container         — panel principal (#ui-achievement-panel)
       ├── header        — createOverlayHeader (titre + bouton fermeture)
       └── .ach-content  — zone scrollable
             ├── #summaryEl   — .ach-summary  : score total / max (%)
             └── #listEl      — .ach-list     : liste des catégories

   Détail des catégories :
     #detailEl — div unique (.ach-detail) inséré après la ligne cliquée via insertAdjacentElement.
     Déplacé sans recréation pour éviter toute allocation.
     #openRow  — référence à la ligne actuellement ouverte (null si aucune).
     Clic sur la ligne ouverte : fermeture. Clic sur une autre : déplacement.
     Événements gérés par délégation sur #listEl (un seul listener).

   Couleurs des scores (bonus de complétude 0 / 5 / 7 / 8) :
     0 → gris (--ov-text-muted)    5 → jaune (--slot-bg-accessory)
     7 → orange (--ov-text-orange) 8 → vert (--slot-bg-armor)
   ==================================================================================================== */

class AchievementOverlay {
  #container = null // div principale du panel
  #summaryEl = null // ligne pts actuels / pts max
  #listEl = null // zone liste des catégories (placeholder)
  #detailEl = null // div de détail unique, déplacé dans le DOM
  #openRow = null // ligne de catégorie actuellement ouverte

  constructor () {
    this.#container = document.createElement('div')
    this.#container.id = 'ui-achievement-panel'
    this.#container.appendChild(createOverlayHeader('🏆 Achievements [U]', 'achievement'))
    this.#initDOM()
    document.body.appendChild(this.#container)
    this.#initEvents()
  }

  /**
   * Construit l'arborescence DOM du panel.
   */
  #initDOM () {
    const content = document.createElement('div')
    content.className = 'ach-content'

    this.#summaryEl = document.createElement('div')
    this.#summaryEl.className = 'ach-summary'
    content.appendChild(this.#summaryEl)

    this.#listEl = document.createElement('div')
    this.#listEl.className = 'ach-list'
    this.#listEl.textContent = 'Categories List'
    content.appendChild(this.#listEl)

    this.#container.appendChild(content)

    // création du div utilisé pour afficher le détail d'une catégorie de succès
    this.#detailEl = document.createElement('div')
    this.#detailEl.className = 'ach-detail'
    this.#detailEl.textContent = 'Detail'
  }

  /**
   * Abonne les handlers eventBus et DOM.
   * Bind et enregistre les handlers.
   */
  #initEvents () {
    // 1. Ouverture/fermeture de l'overlay
    this.onOpen = this.onOpen.bind(this)
    this.onClose = this.onClose.bind(this)
    eventBus.on('achievement/open', this.onOpen)
    eventBus.on('achievement/close', this.onClose)
    // 2. Clic sur une catégorie pour en voir le détail
    this.onListClick = this.onListClick.bind(this)
    this.#listEl.addEventListener('click', this.onListClick)
  }

  /**
   * Affiche l'overlay.
   * Lié dans #initEvents.
   */
  onOpen () {
    const {pts, maxPts, categories} = achievementManager.buildAchievementTable()
    // 1. Section résumé
    const pct = maxPts === 0 ? 0 : Math.round(pts / maxPts * 100)
    this.#summaryEl.textContent = `Achievement Points: ${pts} / ${maxPts} (${pct}%)`
    this.#container.style.display = 'flex'
    // 2. Section liste des catégories
    this.#listEl.innerHTML = ''
    for (const category of categories) {
      this.#listEl.appendChild(this.#buildCategoryRow(category))
    }
  }

  /**
   * Cache l'overlay.
   * Lié dans #initEvents.
   */
  onClose () { this.#container.style.display = 'none' }

  /**
   * Construit une ligne de catégorie pour la liste.
   * @param {{id: string, label: string, pts: number, maxPts: number}} category
   * @returns {HTMLElement}
   */
  #buildCategoryRow (category) {
    const row = document.createElement('div')
    row.className = 'ach-category-row'
    row.dataset.id = category.id

    const label = document.createElement('span')
    label.className = 'ach-category-label'
    label.textContent = category.label

    const pts = document.createElement('span')
    pts.className = 'ach-category-pts'
    pts.textContent = `${category.pts} / ${category.maxPts}`
    pts.style.color = this.#getPtsColor(category.pts, category.completionPts)

    row.appendChild(label)
    row.appendChild(pts)
    return row
  }

  /**
   * Retourne la couleur selon le bonus de complétude de la catégorie (0/5/7/8).
   * @param {number} pts
   * @param {number} completionPts
   * @returns {string}
   */
  #getPtsColor (pts, completionPts) {
    if (completionPts === 8) return 'var(--slot-bg-armor)' // vert
    if (completionPts === 7) return 'var(--ov-text-orange)' // orange
    if (completionPts === 5) return 'yellow' // yellow
    if (pts > 0) return 'var(--slot-bg-default)' // bleu
    return 'var(--ov-text-muted)' // gris
  }

  /**
   * Handler délégué sur #listEl — gère le clic sur toute ligne de catégorie.
   * Même ligne : ferme le détail. Autre ligne : déplace le détail sous la ligne cliquée.
   * Lié dans #initEvents.
   * @param {MouseEvent} e
   */
  onListClick (e) {
    const row = e.target.closest('.ach-category-row')
    if (row === null) return
    const isSame = this.#openRow === row
    this.#detailEl.remove()
    this.#openRow = null
    if (isSame) return
    row.insertAdjacentElement('afterend', this.#detailEl)
    this.#buildDetailContent(achievementManager.getCategoryDetail(row.dataset.id))
    this.#openRow = row
  }

  /**
   * Peuple #detailEl avec les items d'une catégorie.
   * @param {{items: Array<object>, completionPts: number}} detail
   */
  #buildDetailContent (detail) {
    this.#detailEl.innerHTML = ''
    for (const item of detail.items) {
      const row = document.createElement('div')
      row.className = 'ach-detail-row'

      const name = document.createElement('span')
      name.className = 'ach-detail-name'
      name.textContent = ITEMS[item.code]?.name ?? MONSTERS[item.code]?.name ?? item.code

      const count = document.createElement('span')
      count.className = 'ach-detail-count'
      count.textContent = item.nextThreshold === null
        ? `${item.count} / ✓`
        : `${item.count} / ${item.nextThreshold}`

      const pts = document.createElement('span')
      pts.className = 'ach-detail-pts'
      pts.textContent = String(item.pts)
      pts.style.color = this.#getPtsColor(item.pts, item.pts)

      row.appendChild(name)
      row.appendChild(count)
      row.appendChild(pts)
      this.#detailEl.appendChild(row)
    }
  }
}
export const achievementOverlay = new AchievementOverlay()
