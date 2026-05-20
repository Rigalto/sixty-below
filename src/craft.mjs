import {OVERLAYS} from './constant.mjs'
import {eventBus} from './utils.mjs'
import {createOverlayHeader} from './ui.mjs'
import {CRAFT_RESULT_TYPES, CRAFT_STATIONS, CRAFT_INGREDIENTS} from '../assets/data/data.mjs'

// ── CSS ──────────────────────────────────────────────────────────────────────

const craftStyle = document.createElement('style')
craftStyle.id = 'craft-styles'
craftStyle.textContent = /* css */`

#ui-craft-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 800px;
  height: 500px;
  background-color: var(--ov-bg-main);
  border: 1px solid var(--ov-border);
  box-shadow: 0 10px 30px rgba(0,0,0,0.8);
  border-radius: 4px;
  zIndex: ${OVERLAYS.craft.zIndex};
  display: none;
  flex-direction: column;
  font-family: Segoe UI, Roboto, sans-serif;
  color: #ffffff;
  user-select: none;
}

#ui-craft-panel .cr-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

#ui-craft-panel .cr-left {
  width: 270px;
  min-width: 270px;
  background-color:  var(--ov-bg-side);
  border-right: 1px solid var(--ov-border);
  display: flex;
  flex-direction: column;
}

#ui-craft-panel .cr-filter-zone {
  padding: 8px;
  background-color: var(--ov-bg-deep);
  border-bottom: 1px solid var(--ov-border);
  flex-shrink: 0;
  color: var(--ov-text-muted);
  font-size: 12px;
}

#ui-craft-panel .cr-grid-zone {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  color: var(--ov-text-muted);
  font-size: 12px;
}

#ui-craft-panel .cr-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#ui-craft-panel .cr-detail-zone {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  color: var(--ov-text-muted);
  font-size: 12px;
}

#ui-craft-panel .cr-craft-zone { border-top: 1px solid var(--ov-border); background-color: var(--ov-bg-deep); color: var(--ov-text-muted); }

#ui-craft-panel .cr-craft-zone {
  height: 52px;
  flex-shrink: 0;
  border-top: 1px solid var(--ov-border);
  background-color: var(--ov-bg-deep);
  padding: 0 12px;
  display: flex;
  align-items: center;
  color: var(--ov-text-muted);
  font-size: 12px;
}

#ui-craft-panel .cr-filter-zone {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

#ui-craft-panel .cr-search-row {
  display: flex;
  gap: 4px;
  align-items: center;
}

#ui-craft-panel .cr-filter-input {
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

#ui-craft-panel .cr-filter-input:focus {
  border-color: var(--ov-accent);
}

#ui-craft-panel .cr-icon-btn {
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

#ui-craft-panel .cr-icon-btn:hover {
  background-color: #3a4a6b;
  color: var(--ov-text);
}

#ui-craft-panel .cr-filter-select {
  width: 100%;
  padding: 4px 6px;
  background-color: var(--ov-bg-input);
  border: 1px solid var(--ov-border-sub);
  border-radius: 3px;
  color: var(--ov-text);
  font-size: 12px;
  outline: none;
  cursor: pointer;
}

#ui-craft-panel .cr-filter-select:focus {
  border-color: var(--ov-accent);
}
`
document.head.appendChild(craftStyle)

class CraftOverlay {
  #container
  #header
  // les quatre grandes zones
  #filterZone
  #detailZone
  #craftZone
  #gridZone
  // zone #filterZone
  #filterInput
  #filterMode // select 1 — type | station | ingredient
  #filterValue // select 2 — dépend de filterMode
  #btnReset

  constructor () {
    // 1. Création du Conteneur Principal
    this.#container = document.createElement('div')
    this.#container.id = 'ui-craft-panel'

    Object.assign(this.#container.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '800px',
      height: '500px',
      backgroundColor: '#2f3136',
      border: '1px solid #202225',
      boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
      borderRadius: '4px',
      zIndex: OVERLAYS.craft.zIndex,
      display: 'none', // Caché par défaut
      flexDirection: 'column',
      fontFamily: 'Segoe UI, Roboto, sans-serif',
      color: '#ffffff',
      userSelect: 'none' // On évite de sélectionner le texte en cliquant partout
    })

    // 2. Création du Header via la Factory
    const header = createOverlayHeader('⚒️ Crafting [K]', 'craft')
    this.#header = header

    // 3. Zone de contenu (Vide pour l'instant, juste pour remplir)
    const content = this.#initDOM()

    // Assemblage
    this.#container.appendChild(this.#header)
    this.#container.appendChild(content)
    document.body.appendChild(this.#container)

    // 4. Gestion des événements
    this.#initEvents()
  }

  #initDOM () {
    const body = document.createElement('div')
    body.className = 'cr-body'

    const leftPane = document.createElement('div')
    leftPane.className = 'cr-left'

    this.#filterZone = document.createElement('div')
    this.#filterZone.className = 'cr-filter-zone'
    this.#buildFilterZone()

    this.#gridZone = document.createElement('div')
    this.#gridZone.className = 'cr-grid-zone'
    this.#gridZone.textContent = 'Zone grille (recettes)'

    leftPane.appendChild(this.#filterZone)
    leftPane.appendChild(this.#gridZone)

    const rightPane = document.createElement('div')
    rightPane.className = 'cr-right'

    this.#detailZone = document.createElement('div')
    this.#detailZone.className = 'cr-detail-zone'
    this.#detailZone.textContent = 'Zone détail recette'

    this.#craftZone = document.createElement('div')
    this.#craftZone.className = 'cr-craft-zone'
    this.#craftZone.textContent = 'Zone exécution craft'

    rightPane.appendChild(this.#detailZone)
    rightPane.appendChild(this.#craftZone)

    body.appendChild(leftPane)
    body.appendChild(rightPane)
    return body
  }

  #buildFilterZone () {
    // ── Ligne 1 : input texte + icônes ──────────────────────────
    const searchRow = document.createElement('div')
    searchRow.className = 'cr-search-row'

    this.#filterInput = document.createElement('input')
    this.#filterInput.type = 'text'
    this.#filterInput.placeholder = 'Search…'
    this.#filterInput.className = 'cr-filter-input'

    this.#btnReset = this.#makeIconBtn('✕', 'Clear')

    searchRow.appendChild(this.#filterInput)
    searchRow.appendChild(this.#makeIconBtn('🔍', 'Search'))
    searchRow.appendChild(this.#btnReset)
    this.#filterZone.appendChild(searchRow)

    // ── Select 1 — mode de filtrage ──────────────────────────────
    this.#filterMode = document.createElement('select')
    this.#filterMode.className = 'cr-filter-select'

    for (const [value, label] of [
      ['type', 'Filter by result type'],
      ['station', 'Filter by crafting station'],
      ['ingredient', 'Filter by ingredient']
    ]) {
      const opt = document.createElement('option')
      opt.value = value
      opt.textContent = label
      this.#filterMode.appendChild(opt)
    }
    this.#filterZone.appendChild(this.#filterMode)

    // ── Select 2 — valeur (dépend du mode) ──────────────────────
    this.#filterValue = document.createElement('select')
    this.#filterValue.className = 'cr-filter-select'
    this.#filterZone.appendChild(this.#filterValue)

    this.#populateFilterValue()
  }

  #makeIconBtn (icon, title) {
    const btn = document.createElement('button')
    btn.textContent = icon
    btn.title = title
    btn.className = 'cr-icon-btn'
    return btn
  }

  #populateFilterValue () {
    this.#filterValue.innerHTML = ''

    const mode = this.#filterMode.value
    let allLabel, entries

    if (mode === 'type') {
      allLabel = '— All types —'
      entries = CRAFT_RESULT_TYPES.map(({label, mask}) => ({value: String(mask), label}))
    } else if (mode === 'station') {
      allLabel = '— All stations —'
      entries = CRAFT_STATIONS.map(item => ({value: item.code, label: item.name}))
    } else {
      allLabel = '— All ingredients —'
      entries = CRAFT_INGREDIENTS.map(item => ({value: item.code, label: item.name}))
    }

    const optAll = document.createElement('option')
    optAll.value = ''
    optAll.textContent = allLabel
    this.#filterValue.appendChild(optAll)

    for (const {value, label} of entries) {
      const opt = document.createElement('option')
      opt.value = value
      opt.textContent = label
      this.#filterValue.appendChild(opt)
    }
  }

  #initEvents () {
    // Abonnement au Bus
    eventBus.on('craft/open', () => {
      this.#container.style.display = 'flex'
    })

    eventBus.on('craft/close', () => {
      this.#container.style.display = 'none'
    })

    eventBus.on('craft/item', () => {
      // TODO
    })

    // ── Filtre texte ─────────────────────────────────────────────
    this.#filterInput.addEventListener('input', () => {
      const hasText = this.#filterInput.value.length > 0
      this.#filterMode.style.display = hasText ? 'none' : ''
      this.#filterValue.style.display = hasText ? 'none' : ''
      this.#applyFilter()
    })

    this.#btnReset.addEventListener('click', () => {
      this.#filterInput.value = ''
      this.#filterMode.style.display = ''
      this.#filterValue.style.display = ''
      this.#applyFilter()
      this.#filterInput.focus()
    })

    // ── Menus déroulants ─────────────────────────────────────────
    this.#filterMode.addEventListener('change', () => {
      this.#populateFilterValue()
      this.#applyFilter()
    })

    this.#filterValue.addEventListener('change', () => this.#applyFilter())
  }

  #applyFilter () {
    // TODO — étape grille
  }
}
export const craftOverlay = new CraftOverlay()
