// src/help.mjs
import {OVERLAYS} from './constant.mjs'
import {eventBus} from './utils.mjs'
import {database} from './database.mjs'
import {createOverlayHeader} from './ui.mjs'
import {HELP, HELP_CATEGORIES} from '../assets/data/data-help.mjs'

// Fiche affichée par défaut (à lire/écrire en DB — placeholder pour l'instant)
const DEFAULT_TOPIC = 'Surface'

class HelpOverlay {
  #container
  #leftPane
  #filterInput
  #categorySelect
  #btnBack
  #btnForward
  #grid
  #rightPane
  #rightTitle
  #currentTopicStored = DEFAULT_TOPIC

  // Navigation
  #history = [] // Array<string> de titres
  #historyIndex = -1
  #currentTopic = null

  constructor () {
    this.#buildDOM()
    this.#injectStyles()
    this.#initEvents()
  }

  init (helpTopic) {
    this.#currentTopicStored = helpTopic ?? DEFAULT_TOPIC
  }

  // ─── Construction DOM ──────────────────────────────────────────

  #buildDOM () {
    this.#container = document.createElement('div')
    this.#container.id = 'ui-help-panel'
    this.#container.style.zIndex = OVERLAYS.help.zIndex // seul style dynamique

    this.#container.appendChild(createOverlayHeader('📜 Help [H]', 'help'))

    const body = document.createElement('div')
    body.className = 'help-body'
    body.appendChild(this.#buildLeftPane())
    body.appendChild(this.#buildRightPane())
    this.#container.appendChild(body)

    document.body.appendChild(this.#container)
  }

  #buildLeftPane () {
    this.#leftPane = document.createElement('div')
    this.#leftPane.className = 'help-left'

    const searchRow = document.createElement('div')
    searchRow.className = 'help-search-row'

    this.#filterInput = document.createElement('input')
    this.#filterInput.type = 'text'
    this.#filterInput.placeholder = 'Search…'
    this.#filterInput.className = 'help-search-input'

    const btnReset = this.#makeIconBtn('✕', 'Clear and return to categories')
    btnReset.id = 'help-btn-reset'

    searchRow.appendChild(this.#filterInput)
    searchRow.appendChild(btnReset)
    this.#leftPane.appendChild(searchRow)

    this.#categorySelect = document.createElement('select')
    this.#categorySelect.className = 'help-category-select'

    const optAll = document.createElement('option')
    optAll.value = ''
    optAll.textContent = '— All categories —'
    this.#categorySelect.appendChild(optAll)
    for (const cat of HELP_CATEGORIES) {
      const opt = document.createElement('option')
      opt.value = cat
      opt.textContent = cat
      this.#categorySelect.appendChild(opt)
    }
    this.#leftPane.appendChild(this.#categorySelect)

    const navRow = document.createElement('div')
    navRow.className = 'help-nav-row'
    this.#btnBack = this.#makeNavBtn('◀', 'Previous')
    this.#btnForward = this.#makeNavBtn('▶', 'Next')
    navRow.appendChild(this.#btnBack)
    navRow.appendChild(this.#btnForward)
    this.#leftPane.appendChild(navRow)

    this.#grid = document.createElement('div')
    this.#grid.className = 'help-grid'
    this.#leftPane.appendChild(this.#grid)

    return this.#leftPane
  }

  #buildRightPane () {
    const wrapper = document.createElement('div')
    wrapper.className = 'help-right'

    this.#rightTitle = document.createElement('div')
    this.#rightTitle.className = 'help-right-title'
    wrapper.appendChild(this.#rightTitle)

    this.#rightPane = document.createElement('div')
    this.#rightPane.className = 'help-right-content'
    this.#rightPane.innerHTML =
    '<p style="color:var(--ov-text-muted);font-style:italic">Select a topic from the list.</p>'
    wrapper.appendChild(this.#rightPane)

    return wrapper
  }

  // ─── Helpers DOM ───────────────────────────────────────────────

  #makeIconBtn (icon, title) {
    const btn = document.createElement('button')
    btn.textContent = icon
    btn.title = title
    btn.className = 'help-icon-btn'
    return btn
  }

  #makeNavBtn (icon, title) {
    const btn = this.#makeIconBtn(icon, title)
    btn.classList.add('help-nav-btn')
    btn.disabled = true
    return btn
  }

  // ─── Styles globaux (hover, scrollbar, focus) ─────────────────

  #injectStyles () {
    if (document.getElementById('help-styles')) return

    const style = document.createElement('style')
    style.id = 'help-styles'
    style.textContent = /* css */`

    #ui-help-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 1000px;
      height: 600px;
      background-color: var(--ov-bg-main);
      border: 1px solid var(--ov-border);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
      border-radius: 4px;
      display: none;
      flex-direction: column;
      font-family: Segoe UI, Roboto, sans-serif;
      color: var(--ov-text);
      user-select: none;
    }

    #ui-help-panel.open {
      display: flex;
    }

    /* ── Corps ── */

    #ui-help-panel .help-body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* ── Panneau gauche ── */

    #ui-help-panel .help-left {
      width: 260px;
      min-width: 260px;
      background-color: var(--ov-bg-side);
      border-right: 1px solid var(--ov-border);
      display: flex;
      flex-direction: column;
      padding: 8px;
      gap: 6px;
    }

    #ui-help-panel .help-search-row {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    #ui-help-panel .help-search-input {
      flex: 1;
      min-width: 0;
      padding: 4px 6px;
      background-color: var(--ov-bg-input);
      border: 1px solid var(--ov-border-sub);
      border-radius: 3px;
      color: var(--ov-text);
      font-size: 13px;
      outline: none;
    }

    #ui-help-panel .help-search-input:focus {
      border-color: var(--ov-accent);
    }

    #ui-help-panel .help-icon-btn {
      flex-shrink: 0;
      width: 26px;
      height: 26px;
      background-color: var(--ov-btn-bg);
      border: 1px solid var(--ov-border-sub);
      border-radius: 3px;
      color: #bdc3c7;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }

    #ui-help-panel .help-icon-btn:hover:not(:disabled) {
      background-color: #3a4a6b;
      color: var(--ov-text);
    }

    #ui-help-panel .help-icon-btn:disabled {
      opacity: 0.35;
      cursor: default;
    }

    #ui-help-panel .help-category-select {
      width: 100%;
      padding: 4px 6px;
      background-color: var(--ov-bg-input);
      border: 1px solid var(--ov-border-sub);
      border-radius: 3px;
      color: var(--ov-text);
      font-size: 13px;
      cursor: pointer;
      outline: none;
    }

    #ui-help-panel .help-category-select:focus {
      border-color: var(--ov-accent);
    }

    #ui-help-panel .help-nav-row {
      display: flex;
      gap: 4px;
    }

    #ui-help-panel .help-nav-btn {
      flex: 1;
    }

    #ui-help-panel .help-grid {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-wrap: wrap;
      align-content: flex-start;
      gap: 4px;
      padding-right: 2px;
    }

    #ui-help-panel .help-grid::-webkit-scrollbar { width: 6px; }
    #ui-help-panel .help-grid::-webkit-scrollbar-track { background: var(--ov-bg-input); border-radius: 3px; }
    #ui-help-panel .help-grid::-webkit-scrollbar-thumb { background: var(--ov-border-sub); border-radius: 3px; }
    #ui-help-panel .help-grid::-webkit-scrollbar-thumb:hover { background: var(--ov-accent); }

    #ui-help-panel .help-topic-btn {
      padding: 3px 8px;
      background-color: #3a3f44;
      border: 1px solid var(--ov-border-sub);
      border-radius: 3px;
      color: var(--ov-text-sec);
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 0.15s, color 0.15s;
    }

    #ui-help-panel .help-topic-btn:hover,
    #ui-help-panel .help-topic-btn.active {
      background-color: var(--ov-accent);
      color: var(--ov-text);
      border-color: var(--ov-accent);
    }

    /* ── Panneau droit ── */

    #ui-help-panel .help-right {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    #ui-help-panel .help-right-title {
      padding: 12px 20px 8px;
      font-size: 18px;
      font-weight: bold;
      color: var(--ov-text);
      border-bottom: 1px solid var(--ov-border);
      flex-shrink: 0;
    }

    #ui-help-panel .help-right-content {
      flex: 1;
      overflow-y: auto;
      padding: 14px 20px;
      font-size: 14px;
      line-height: 1.6;
      color: var(--ov-text-sec);
    }

    /* ── Contenu des fiches ── */

    #ui-help-panel .help-link { color: #90cdf4; text-decoration: underline; cursor: pointer; }
    #ui-help-panel .help-link:hover { color: #bee3f8; }

    #ui-help-panel .help-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin: 4px 0;
    }

    #ui-help-panel .help-table th {
      background-color: var(--ov-btn-bg);
      color: var(--ov-text);
      font-weight: bold;
      padding: 6px 10px;
      text-align: left;
      border-bottom: 2px solid var(--ov-accent);
    }

    #ui-help-panel .help-table td {
      padding: 5px 10px;
      border-bottom: 1px solid var(--ov-border);
      color: var(--ov-text-sec);
    }

    #ui-help-panel .help-table tr:nth-child(even) td { background-color: var(--ov-bg-deep); }
    #ui-help-panel .help-table tr:nth-child(odd) td  { background-color: #2f3340; }
    #ui-help-panel .help-table tr:hover td           { background-color: #3a4a6b; }
  `
    document.head.appendChild(style)
  }

  // ─── Événements ───────────────────────────────────────────────

  #initEvents () {
    // Open / Close via eventBus
    eventBus.on('help/open', () => this.#onOpen())
    eventBus.on('help/close', () => { this.#container.style.display = 'none' })

    // Filtre texte — input live
    this.#filterInput.addEventListener('input', () => this.#applyFilter())

    // Reset (✕) — vide le texte, repasse en mode catégorie
    const btnReset = document.getElementById('help-btn-reset')
    btnReset.addEventListener('click', () => {
      this.#filterInput.value = ''
      this.#applyFilter()
      this.#filterInput.focus()
    })

    // Filtre catégorie
    this.#categorySelect.addEventListener('change', () => this.#applyFilter())

    // Navigation historique
    this.#btnBack.addEventListener('click', () => this.#navigateHistory(-1))
    this.#btnForward.addEventListener('click', () => this.#navigateHistory(+1))

    // liens dans la fiche
    // les liens auront la forme : <a class="help-link" data-nav="Sandstone" href="#">Sandstone</a>
    this.#rightPane.addEventListener('click', e => {
      const target = e.target.closest('[data-nav]')
      if (!target) return
      const topic = target.dataset.nav
      this.#navigateTo(topic)
    })

    eventBus.on('help/topic', (topic) => {
      this.#navigateTo(topic)
    })
  }

  // ─── Logique filtre ───────────────────────────────────────────

  #applyFilter () {
    const text = this.#filterInput.value.trim().toLowerCase()
    const isTextMode = text.length > 0

    // Affichage/masquage du select catégorie
    this.#categorySelect.style.display = isTextMode ? 'none' : 'block'

    const cat = this.#categorySelect.value

    const predicate = entry =>
      entry.title.toLowerCase().includes(text) ||
      entry.category.some(c => c.toLowerCase().includes(text)) ||
      entry.content.toLowerCase().includes(text)

    this.#rebuildGrid(entry => {
      if (isTextMode) return predicate(entry)
      if (cat) return entry.category.includes(cat)
      return true
    })
  }

  // ─── Grille ───────────────────────────────────────────────────

  #rebuildGrid (predicate) {
    // Vider la grille
    while (this.#grid.firstChild) {
      this.#grid.removeChild(this.#grid.firstChild)
    }

    const filtered = []
    for (const entry of HELP) {
      if (predicate(entry)) filtered.push(entry)
    }
    filtered.sort((a, b) => a.title.localeCompare(b.title))

    for (const entry of filtered) {
      if (!predicate(entry)) continue

      const btn = document.createElement('button')
      btn.textContent = entry.title
      btn.className = 'help-topic-btn'
      if (entry.title === this.#currentTopic) btn.classList.add('active')

      btn.addEventListener('click', () => this.#navigateTo(entry.title))
      this.#grid.appendChild(btn)
    }
  }

  // ─── Navigation ───────────────────────────────────────────────

  /**
   * Navigation externe (depuis un lien [[...]] dans une fiche).
   * @param {string} title
   */
  navigateTo (title) {
    this.#navigateTo(title)
  }

  #navigateTo (title) {
    // Tronque le futur si on navigue depuis un point intermédiaire
    if (this.#historyIndex < this.#history.length - 1) {
      this.#history = this.#history.slice(0, this.#historyIndex + 1)
    }
    this.#history.push(title)
    this.#historyIndex = this.#history.length - 1
    this.#showTopic(title)
    this.#updateNavButtons()
  }

  #navigateHistory (delta) {
    const next = this.#historyIndex + delta
    if (next < 0 || next >= this.#history.length) return
    this.#historyIndex = next
    this.#showTopic(this.#history[this.#historyIndex])
    this.#updateNavButtons()
  }

  #showTopic (title) {
    this.#currentTopic = title
    this.#currentTopicStored = title
    database.setGameState('helptopic', title)
    const entry = HELP.find(e => e.title === title)

    // Mise à jour du contenu
    if (entry) {
      // entry.html sera disponible après hydratation complète ; on fallback sur entry.content
      this.#rightPane.innerHTML = entry.html ?? `<pre style="white-space:pre-wrap">${entry.content}</pre>`

      // E1 : positionner le select sur la première catégorie de la fiche
      const isTextMode = this.#filterInput.value.trim().length > 0
      if (!isTextMode && entry.category.length > 0) {
        this.#categorySelect.value = entry.category[0]
        this.#applyFilter() // re-filtre la grille avec la nouvelle catégorie
      }
    } else {
      this.#rightPane.innerHTML = `<p style="color:#e74c3c">Topic not found: <strong>${title}</strong></p>`
    }

    // Mise à jour de l'état actif dans la grille
    for (const btn of this.#grid.querySelectorAll('.help-topic-btn')) {
      btn.classList.toggle('active', btn.textContent === title)
    }

    // Mise à jour du titre de a fiche
    this.#rightTitle.textContent = entry ? entry.title : ''

    // Scroll haut
    this.#rightPane.scrollTop = 0
  }

  #updateNavButtons () {
    this.#btnBack.disabled = this.#historyIndex <= 0
    this.#btnForward.disabled = this.#historyIndex >= this.#history.length - 1
  }

  // ─── Ouverture ────────────────────────────────────────────────

  #onOpen () {
    // Réinitialisation de l'historique
    this.#history = []
    this.#historyIndex = -1

    // Reset filtre → mode catégorie
    this.#filterInput.value = ''
    this.#categorySelect.value = ''

    // Affichage
    this.#container.style.display = 'flex'

    // Navigation vers la fiche courante
    this.#navigateTo(this.#currentTopicStored)
  }
}

export const helpOverlay = new HelpOverlay()
