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
    // 1. Conteneur principal
    this.#container = document.createElement('div')
    this.#container.id = 'ui-help-panel'
    Object.assign(this.#container.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '1000px',
      height: '600px',
      backgroundColor: '#2f3136',
      border: '1px solid #202225',
      boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
      borderRadius: '4px',
      zIndex: OVERLAYS.help.zIndex,
      display: 'none',
      flexDirection: 'column',
      fontFamily: 'Segoe UI, Roboto, sans-serif',
      color: '#ffffff',
      userSelect: 'none'
    })

    // 2. Header
    this.#container.appendChild(createOverlayHeader('📜 Help [H]', 'help'))

    // 3. Corps (left + right)
    const body = document.createElement('div')
    Object.assign(body.style, {
      display: 'flex',
      flex: '1',
      overflow: 'hidden'
    })

    body.appendChild(this.#buildLeftPane())
    body.appendChild(this.#buildRightPane())
    this.#container.appendChild(body)

    document.body.appendChild(this.#container)
  }

  #buildLeftPane () {
    this.#leftPane = document.createElement('div')
    Object.assign(this.#leftPane.style, {
      width: '260px',
      minWidth: '260px',
      backgroundColor: '#23272a',
      borderRight: '1px solid #202225',
      display: 'flex',
      flexDirection: 'column',
      padding: '8px',
      gap: '6px'
    })

    // ── Ligne 1 : input texte + bouton recherche + bouton reset ──
    const searchRow = document.createElement('div')
    Object.assign(searchRow.style, {
      display: 'flex',
      gap: '4px',
      alignItems: 'center'
    })

    this.#filterInput = document.createElement('input')
    this.#filterInput.type = 'text'
    this.#filterInput.placeholder = 'Search…'
    this.#filterInput.className = 'help-search-input'
    Object.assign(this.#filterInput.style, {
      flex: '1',
      minWidth: '0',
      padding: '4px 6px',
      backgroundColor: '#1e272e',
      border: '1px solid #4a5568',
      borderRadius: '3px',
      color: '#ffffff',
      fontSize: '13px',
      outline: 'none'
    })

    const btnSearch = this.#makeIconBtn('🔍', 'Search')
    const btnReset = this.#makeIconBtn('✕', 'Clear and return to categories')
    btnReset.id = 'help-btn-reset'

    searchRow.appendChild(this.#filterInput)
    searchRow.appendChild(btnSearch)
    searchRow.appendChild(btnReset)
    this.#leftPane.appendChild(searchRow)

    // ── Ligne 2 : menu catégorie (masqué si texte saisi) ──
    this.#categorySelect = document.createElement('select')
    this.#categorySelect.className = 'help-category-select'
    Object.assign(this.#categorySelect.style, {
      width: '100%',
      padding: '4px 6px',
      backgroundColor: '#2c3e50',
      border: '1px solid #4a5568',
      borderRadius: '3px',
      color: '#ffffff',
      fontSize: '13px',
      cursor: 'pointer'
    })

    // Option "Toutes"
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

    // ── Ligne 3 : navigation historique ──
    const navRow = document.createElement('div')
    Object.assign(navRow.style, {
      display: 'flex',
      gap: '4px'
    })

    this.#btnBack = this.#makeNavBtn('◀', 'Previous')
    this.#btnForward = this.#makeNavBtn('▶', 'Next')
    navRow.appendChild(this.#btnBack)
    navRow.appendChild(this.#btnForward)
    this.#leftPane.appendChild(navRow)

    // ── Grille des fiches (scrollable) ──
    this.#grid = document.createElement('div')
    this.#grid.className = 'help-grid'
    Object.assign(this.#grid.style, {
      flex: '1',
      overflowY: 'auto',
      overflowX: 'hidden',
      display: 'flex',
      flexWrap: 'wrap',
      alignContent: 'flex-start',
      gap: '4px',
      paddingRight: '2px' // évite que l'ascenseur chevauche les boutons
    })
    this.#leftPane.appendChild(this.#grid)

    return this.#leftPane
  }

  #buildRightPane () {
    const wrapper = document.createElement('div')
    Object.assign(wrapper.style, {
      flex: '1',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    })

    // Titre — fixe, hors ascenseur
    this.#rightTitle = document.createElement('div')
    Object.assign(this.#rightTitle.style, {
      padding: '12px 20px 8px',
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#ffffff',
      borderBottom: '1px solid #202225',
      flexShrink: '0'
    })
    wrapper.appendChild(this.#rightTitle)

    // Contenu — scrollable
    this.#rightPane = document.createElement('div')
    Object.assign(this.#rightPane.style, {
      flex: '1',
      overflowY: 'auto',
      padding: '14px 20px',
      fontSize: '14px',
      lineHeight: '1.6',
      color: '#dcddde'
    })
    this.#rightPane.innerHTML = '<p style="color:#72767d;font-style:italic">Select a topic from the list.</p>'
    wrapper.appendChild(this.#rightPane)

    return wrapper
  }

  // ─── Helpers DOM ───────────────────────────────────────────────

  #makeIconBtn (icon, title) {
    const btn = document.createElement('button')
    btn.textContent = icon
    btn.title = title
    btn.className = 'help-icon-btn'
    Object.assign(btn.style, {
      flexShrink: '0',
      width: '26px',
      height: '26px',
      backgroundColor: '#2c3e50',
      border: '1px solid #4a5568',
      borderRadius: '3px',
      color: '#bdc3c7',
      cursor: 'pointer',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0'
    })
    return btn
  }

  #makeNavBtn (icon, title) {
    const btn = this.#makeIconBtn(icon, title)
    Object.assign(btn.style, {
      flex: '1' // les deux boutons partagent la largeur
    })
    btn.disabled = true
    return btn
  }

  // ─── Styles globaux (hover, scrollbar, focus) ─────────────────

  #injectStyles () {
    if (document.getElementById('help-styles')) return
    const style = document.createElement('style')
    style.id = 'help-styles'
    style.textContent = `
      .help-search-input:focus {
        border-color: #4a69bd !important;
      }
      .help-icon-btn:hover:not(:disabled) {
        background-color: #3a4a6b !important;
        color: #ffffff !important;
      }
      .help-icon-btn:disabled {
        opacity: 0.35;
        cursor: default !important;
      }
      .help-category-select:focus {
        outline: none;
        border-color: #4a69bd !important;
      }
      .help-topic-btn {
        padding: 3px 8px;
        background-color: #3a3f44;
        border: 1px solid #4a5568;
        border-radius: 3px;
        color: #dcddde;
        font-size: 12px;
        cursor: pointer;
        white-space: nowrap;
        transition: background-color 0.15s, color 0.15s;
      }
      .help-topic-btn:hover,
      .help-topic-btn.active {
        background-color: #4a69bd !important;
        color: #ffffff !important;
        border-color: #4a69bd !important;
      }
      .help-grid::-webkit-scrollbar { width: 6px; }
      .help-grid::-webkit-scrollbar-track { background: #1e272e; border-radius: 3px; }
      .help-grid::-webkit-scrollbar-thumb { background: #4a5568; border-radius: 3px; }
      .help-grid::-webkit-scrollbar-thumb:hover { background: #4a69bd; }
      .help-link { color: #90cdf4; text-decoration: underline; cursor: pointer; }
      .help-link:hover { color: #bee3f8; }
      .help-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        margin: 4px 0;
      }
      .help-table th {
        background-color: #2c3e50;
        color: #ffffff;
        font-weight: bold;
        padding: 6px 10px;
        text-align: left;
        border-bottom: 2px solid #4a69bd;
      }
      .help-table td {
        padding: 5px 10px;
        border-bottom: 1px solid #202225;
        color: #dcddde;
      }
      .help-table tr:nth-child(even) td {
        background-color: #1e2128;
      }
      .help-table tr:nth-child(odd) td {
        background-color: #2f3340;
      }
      .help-table tr:hover td {
        background-color: #3a4a6b;
      }
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
