import {OVERLAYS, PATH_HELP, SVG_ICON, PATH_WARNING} from './constant.mjs'
import {eventBus} from './utils.mjs'
import {createOverlayHeader} from './ui.mjs'
import {database} from './database.mjs'
import {ITEM_TYPE, ITEMS, RECIPES, CRAFT_RESULT_TYPES, CRAFT_STATIONS, CRAFT_INGREDIENTS} from '../assets/data/data.mjs'
import {inventoryManager} from './inventory.mjs'

// ── CSS ──────────────────────────────────────────────────────────────────────

const craftStyle = document.createElement('style')
craftStyle.id = 'craft-styles'
craftStyle.textContent = /* css */`

#ui-craft-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 1000px;
  height: 600px;
  background-color: var(--ov-bg-main);
  border: 1px solid var(--ov-border);
  box-shadow: 0 10px 30px rgba(0,0,0,0.8);
  border-radius: 4px;
  z-index: ${OVERLAYS.craft.zIndex};
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
  flex: 1;
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
  width: 302px;
  min-width: 302px;
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

#ui-craft-panel .cr-grid-zone {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 4px;
}

#ui-craft-panel .cr-grid-zone::-webkit-scrollbar       { width: 6px; }
#ui-craft-panel .cr-grid-zone::-webkit-scrollbar-track { background: var(--ov-bg-input); border-radius: 3px; }
#ui-craft-panel .cr-grid-zone::-webkit-scrollbar-thumb { background: var(--ov-border-sub); border-radius: 3px; }
#ui-craft-panel .cr-grid-zone::-webkit-scrollbar-thumb:hover { background: var(--ov-accent); }

#ui-craft-panel .cr-action-btn {
  background-color: transparent;
  border: 1px solid #444;
  border-radius: 4px;
  color: var(--ov-text-sec);
  cursor: pointer;
  padding: 4px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

#ui-craft-panel .cr-action-btn svg {
  width: 100%;
  height: 100%;
}

#ui-craft-panel .cr-action-btn:hover {
  border-color: var(--ov-text-sec);
  color: var(--ov-text);
}

#ui-craft-panel inventory-slot.cr-detail-slot {
  width: 36px;
  height: 36px;
  min-width: 36px;
  flex-shrink: 0;
}

#ui-craft-panel .cr-empty {
  color: var(--ov-text-muted);
  font-style: italic;
  font-size: 12px;
  padding: 4px;
}

#ui-craft-panel .cr-section {
  margin-bottom: 12px;
}

#ui-craft-panel .cr-section-label {
  font-size: 11px;
  color: var(--ov-text-muted);
  text-transform: uppercase;
  letter-spacing: .06em;
  margin-bottom: 5px;
}

#ui-craft-panel .cr-detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 3px;
}

#ui-craft-panel .cr-station-row {
  border: 1px solid var(--ov-border-sub);
}

#ui-craft-panel .cr-ing-row {
  margin-bottom: 3px;
}

#ui-craft-panel .cr-detail-name {
  flex: 1;
  font-size: 13px;
  color: var(--ov-text);
}

#ui-craft-panel .cr-detail-qty {
  font-size: 13px;
  font-weight: 700;
  color: var(--ov-text-muted);
  flex-shrink: 0;
}

/* Curseur par défaut sur tous les slots de détail */
#ui-craft-panel inventory-slot.cr-detail-slot {
  cursor: default;
}

/* Non-cliquable : neutralise le hover global de inventory-slot */
#ui-craft-panel inventory-slot.cr-detail-slot:not(.cr-clickable):hover {
  border-color: #888;
}

/* Cliquable : le hover de inventory-slot s'applique naturellement */
#ui-craft-panel inventory-slot.cr-detail-slot.cr-clickable {
  cursor: pointer;
}

#ui-craft-panel inventory-slot.cr-slot-ok {
  background-color: var(--slot-bg-armor);
}

#ui-craft-panel inventory-slot.cr-slot-ko {
  background-color: var(--slot-bg-default);
}

#ui-craft-panel .cr-craft-label {
  font-size: 12px;
  color: var(--ov-text-muted);
  flex-shrink: 0;
}

#ui-craft-panel .cr-craft-count {
  width: 50px;
  padding: 3px 6px;
  background-color: var(--ov-bg-input);
  border: 1px solid var(--ov-border-sub);
  border-radius: 3px;
  color: var(--ov-text);
  font-size: 13px;
  text-align: center;
  outline: none;
  flex-shrink: 0;
}

#ui-craft-panel .cr-craft-count:focus {
  border-color: var(--ov-accent);
}

#ui-craft-panel .cr-craft-count:disabled {
  opacity: 0.4;
}

#ui-craft-panel .cr-craft-btn {
  padding: 6px 14px;
  background-color: var(--ov-btn-bg);   /* ← neutre par défaut */
  border: 1px solid var(--ov-border-sub);
  border-radius: 3px;
  color: var(--ov-text);
  font-size: 13px;
  font-weight: 700;
  cursor: default;
  white-space: nowrap;
  flex-shrink: 0;
}

#ui-craft-panel .cr-craft-btn:not(:disabled) {
  background-color: #2a5a2a;           /* ← vert quand actif */
  border-color: #3a7a3a;
  cursor: pointer;
}

#ui-craft-panel .cr-craft-btn:not(:disabled):hover {
  background-color: #3a7a3a;
}

#ui-craft-panel .cr-craft-btn:disabled {
  opacity: 0.5;
}

#ui-craft-panel .cr-section-sublabel {
  font-size: 11px;
  color: var(--ov-text-muted);
  font-style: italic;
  margin: 4px 0 3px 8px;
}

#ui-craft-panel .cr-craft-hint {
  font-size: 11px;
  color: var(--ov-text-muted);
  flex-shrink: 0;
  margin-left: 4px;
  margin-right: 14px;
}

#ui-craft-panel .cr-save-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 4px;
  font-size: 12px;
  color: #e67e22;
}

#ui-craft-panel .cr-warning-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: #e67e22;
}
`
document.head.appendChild(craftStyle)

const FILTER_KEY_MAP = {
  type: 'craftfiltertype',
  station: 'craftfilterstation',
  ingredient: 'craftfiltermaterial'
}

class CraftOverlay {
  #container
  #header
  // les quatre grandes zones
  #filterZone
  #gridZone
  #detailZone
  #craftZone
  // zone #filterZone
  #filterInput
  #filterMode // select 1 — type | station | ingredient
  #filterValue // select 2 — dépend de filterMode
  #savedFilterValues = {type: '', station: '', ingredient: ''}
  #btnReset
  // zone #gridZone
  #craftSlots = [] // inventory-slot elements de la grille
  #selectedSlot = null
  #selectedRecipe = null
  // zone craftZone
  #btnHelp
  #craftCount
  #btnCraft
  // disponibilité des ingrédients
  #availableMap
  #ingredientQtyEls = [] // [{el, code, ingCount}]
  #craftCountHint
  #isCraftable = false
  #craftMax = 0
  // disponibilité des Crafting Stations
  #nearbyStations = new Set()

  constructor () {
    // 1. Création du Conteneur Principal
    this.#container = document.createElement('div')
    this.#container.id = 'ui-craft-panel'

    // 2. Création du Header via la Factory
    const header = createOverlayHeader('⚒️ Crafting [K]', 'craft')
    this.#header = header

    // 3. Zone de contenu (Vide pour l'instant, juste pour remplir)
    const content = this.#initDOM()

    // 4. Assemblage
    this.#container.appendChild(this.#header)
    this.#container.appendChild(content)
    document.body.appendChild(this.#container)

    // 5. Gestion des événements
    this.#initEvents()
  }

  init (mode, filterType, filterStation, filterMaterial) {
    this.#savedFilterValues.type = filterType ?? ''
    this.#savedFilterValues.station = filterStation ?? ''
    this.#savedFilterValues.ingredient = filterMaterial ?? ''
    this.#filterMode.value = mode ?? 'type'
    this.#populateFilterValue()
    this.#filterValue.value = this.#savedFilterValues[this.#filterMode.value]
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

    leftPane.appendChild(this.#filterZone)
    leftPane.appendChild(this.#gridZone)

    const rightPane = document.createElement('div')
    rightPane.className = 'cr-right'

    this.#detailZone = document.createElement('div')
    this.#detailZone.className = 'cr-detail-zone'
    this.#clearDetail()

    this.#craftZone = document.createElement('div')
    this.#craftZone.className = 'cr-craft-zone'
    this.#buildCraftZone()

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
      entries = CRAFT_RESULT_TYPES.map(label => ({value: label, label}))
    } else if (mode === 'station') {
      allLabel = '— All Crafting Stations —'
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

  #buildCraftZone () {
    this.#btnHelp = document.createElement('button')
    this.#btnHelp.className = 'cr-action-btn'
    this.#btnHelp.title = 'Open Help [H]'
    this.#btnHelp.innerHTML = SVG_ICON(PATH_HELP, 'class="cr-help-icon"')
    this.#craftZone.appendChild(this.#btnHelp)

    const spacer = document.createElement('div')
    spacer.style.flex = '1'
    this.#craftZone.appendChild(spacer)

    const label = document.createElement('label')
    label.className = 'cr-craft-label'
    label.textContent = 'Runs :'
    this.#craftZone.appendChild(label)

    this.#craftCount = document.createElement('input')
    this.#craftCount.type = 'number'
    this.#craftCount.className = 'cr-craft-count'
    this.#craftCount.value = '1'
    this.#craftCount.min = '1'
    this.#craftCount.disabled = true
    this.#craftZone.appendChild(this.#craftCount)

    this.#craftCountHint = document.createElement('span')
    this.#craftCountHint.className = 'cr-craft-hint'
    this.#craftZone.appendChild(this.#craftCountHint)

    this.#btnCraft = document.createElement('button')
    this.#btnCraft.className = 'cr-craft-btn'
    this.#btnCraft.textContent = 'Craft'
    this.#btnCraft.disabled = true
    this.#craftZone.appendChild(this.#btnCraft)
  }

  #initEvents () {
    // Abonnement au Bus
    eventBus.on('craft/open', () => {
      this.#container.style.display = 'flex'
      this.#filterInput.value = '' // non mémorisé — reset à chaque ouverture
      this.#filterMode.style.display = ''
      this.#filterValue.style.display = ''
      this.#loadNearbyStations()
      this.#buildAvailableMap()
      this.#applyFilter()
    })

    eventBus.on('craft/close', () => {
      this.#container.style.display = 'none'
    })

    eventBus.on('craft/item', itemId => {
      const item = ITEMS[itemId]
      if (!item) return
      this.#onDetailSlotClick(item.name)
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
      this.#filterValue.value = this.#savedFilterValues[this.#filterMode.value]
      this.#applyFilter()
      database.setGameState('craftfiltermode', this.#filterMode.value)
      this.#filterMode.blur()
    })

    this.#filterValue.addEventListener('change', () => {
      const mode = this.#filterMode.value
      this.#savedFilterValues[mode] = this.#filterValue.value
      this.#applyFilter()
      database.setGameState(FILTER_KEY_MAP[mode], this.#filterValue.value)
      this.#filterValue.blur()
    })
    // ── Lancement du craft ─────────────────────────────────────────

    this.#btnHelp.addEventListener('click', () => {
      eventBus.emit('overlay/open-request', 'help')
      if (this.#selectedRecipe !== null) {
        eventBus.emit('help/topic', this.#selectedRecipe.result.item.help)
      }
    })

    this.#craftCount.addEventListener('input', () => {
      if (!this.#selectedRecipe) return
      const max = parseInt(this.#craftCount.max, 10) || 1
      let runs = parseInt(this.#craftCount.value, 10) || 1
      if (runs < 1) runs = 1
      if (runs > max) runs = max
      this.#craftCount.value = String(runs)
      this.#btnCraft.textContent = `Craft × ${runs * this.#selectedRecipe.result.count}`
      this.#updateIngredientQtys()
      this.#updateCraftButton()
    })

    this.#btnCraft.addEventListener('click', () => {
      if (!this.#selectedRecipe || this.#btnCraft.disabled) return

      const runs = parseInt(this.#craftCount.value, 10) || 1

      // ── Consommer les ingrédients ─────────────────────────────
      for (const ing of this.#selectedRecipe.ingredients) {
        const remaining = inventoryManager.removeFromPlayer(ing.item.code, ing.count * runs)

        if (remaining > 0) {
          // TODO furnitureManager — containers proches
          // for (const id of furnitureManager.getNearbyContainerIds()) {
          //   if (remaining === 0) break
          //   remaining = inventoryManager.removeFromContainer(id, ing.item.code, remaining)
          // }
          if (remaining > 0) {
            console.error(`[CraftOverlay] ingrédient non consommé : ${remaining} × ${ing.item.code}`)
          }
        }
      }

      // ── Ajouter les résultats ─────────────────────────────────
      inventoryManager.craftReceive(this.#buildCraftItems(runs))

      // ── Sauvegarder et notifier ───────────────────────────────
      inventoryManager.save()
      eventBus.emit('craft/performed', {recipe: this.#selectedRecipe, runs})
      eventBus.emit('inventory/static-buffs', inventoryManager.getStaticBuffs())
      eventBus.emit('hotbar/changed', inventoryManager.hotbar)

      // ── Rafraîchir l'UI ───────────────────────────────────────
      this.#buildAvailableMap()
      this.#updateCraftInput()
      this.#updateCraftButton()
      this.#updateIngredientQtys()
    })
  }

  #applyFilter () {
    const text = this.#filterInput.value.trim().toLowerCase()
    let recipes

    if (text.length > 0) {
      recipes = RECIPES.filter(r => r.result.item.name.toLowerCase().includes(text))
    } else {
      const mode = this.#filterMode.value
      const val = this.#filterValue.value

      if (!val) {
        recipes = RECIPES
      } else if (mode === 'type') {
        recipes = RECIPES.filter(r => r.result.item.craftFilterLabels.has(val))
      } else if (mode === 'station') {
        recipes = RECIPES.filter(r => r.station.code === val)
      } else {
        recipes = RECIPES.filter(r => r.ingredients.some(ing => ing.item.code === val))
      }
    }

    this.#rebuildGrid(recipes)
  }

  #rebuildGrid (recipes) {
    while (this.#gridZone.firstChild) {
      this.#gridZone.removeChild(this.#gridZone.firstChild)
    }
    this.#craftSlots = []
    this.#selectedSlot = null
    this.#selectedRecipe = null
    this.#clearDetail()
    this.#craftCount.disabled = true
    this.#craftCount.value = '1'
    this.#btnCraft.disabled = true
    this.#btnCraft.textContent = 'Craft'

    for (const recipe of recipes) {
      const slot = document.createElement('inventory-slot')
      slot.setAttribute('item', recipe.result.item.code)
      slot.setAttribute('count', recipe.result.count)
      slot.title = recipe.result.item.hoverTitle
      slot._recipe = recipe
      if (this.#isRecipeFeasible(recipe)) slot.classList.add('cr-slot-ok')

      slot.addEventListener('click', () => this.#onSlotClick(slot, recipe))
      this.#craftSlots.push(slot)
      this.#gridZone.appendChild(slot)
    }
  }

  #onSlotClick (slot, recipe) {
    if (this.#selectedSlot === slot) { // ← second clic : désélection
      slot.classList.remove('selected')
      this.#selectedSlot = null
      this.#selectedRecipe = null
      this.#clearDetail()
      this.#craftCount.disabled = true
      this.#craftCount.value = '1'
      this.#btnCraft.disabled = true
      this.#btnCraft.textContent = 'Craft'
      return
    }
    if (this.#selectedSlot !== null) this.#selectedSlot.classList.remove('selected')
    this.#selectedSlot = slot
    this.#selectedRecipe = recipe
    slot.classList.add('selected')
    this.#showDetail(recipe)

    this.#craftCount.value = '1'
    this.#updateCraftInput()
    this.#updateCraftButton()
    const runs = parseInt(this.#craftCount.value, 10) || 1
    this.#btnCraft.textContent = `Craft × ${runs * recipe.result.count}`
  }

  #clearDetail () {
    this.#ingredientQtyEls = []
    this.#isCraftable = false
    this.#detailZone.innerHTML = ''
    const msg = document.createElement('p')
    msg.className = 'cr-empty'
    msg.textContent = 'Select a recipe to see details.'
    this.#detailZone.appendChild(msg)

    const warning = document.createElement('div')
    warning.className = 'cr-save-warning'
    warning.title = 'No auto-save during editing.'
    warning.innerHTML = SVG_ICON(PATH_WARNING, 'class="cr-warning-icon"') +
                        'Changes are only saved when the panel is closed.'
    this.#detailZone.appendChild(warning)
  }

  #showDetail (recipe) {
    this.#detailZone.innerHTML = ''

    const stationNearby = this.#nearbyStations.has(recipe.station.code)

    let ingredientsOk = true
    for (const ing of recipe.ingredients) {
      if ((this.#availableMap[ing.item.code] ?? 0) < ing.count) {
        ingredientsOk = false
        break
      }
    }

    const isCraftable = stationNearby && ingredientsOk
    this.#isCraftable = isCraftable

    this.#detailZone.innerHTML = ''
    this.#detailZone.appendChild(this.#buildResultSection(recipe, isCraftable))
    this.#detailZone.appendChild(this.#buildStationSection(recipe, stationNearby))
    this.#detailZone.appendChild(this.#buildIngredientsSection(recipe))
  }

  #buildResultSection (recipe, isCraftable) {
    const section = document.createElement('div')
    section.className = 'cr-section'

    const label = document.createElement('div')
    label.className = 'cr-section-label'
    label.textContent = 'Result'
    section.appendChild(label)

    const row = document.createElement('div')
    row.className = 'cr-detail-row'

    const slot = document.createElement('inventory-slot')
    slot.classList.add('cr-detail-slot')
    slot.setAttribute('item', recipe.result.item.code)
    slot.title = recipe.result.item.hoverTitle
    slot.classList.add(isCraftable ? 'cr-slot-ok' : 'cr-slot-ko')

    const name = document.createElement('div')
    name.className = 'cr-detail-name'
    name.textContent = recipe.result.item.name

    row.appendChild(slot)
    row.appendChild(name)

    if (recipe.result.count > 1) {
      const qty = document.createElement('div')
      qty.className = 'cr-detail-qty'
      qty.textContent = `× ${recipe.result.count}`
      row.appendChild(qty)
    }

    section.appendChild(row)

    if (recipe.returned?.length > 0) {
      const retLabel = document.createElement('div')
      retLabel.className = 'cr-section-sublabel'
      retLabel.textContent = 'Also returns'
      section.appendChild(retLabel)

      for (const ret of recipe.returned) {
        const retRow = document.createElement('div')
        retRow.className = 'cr-detail-row'

        const retSlot = document.createElement('inventory-slot')
        retSlot.classList.add('cr-detail-slot')
        retSlot.setAttribute('item', ret.item.code)
        retSlot.title = ret.item.hoverTitle
        retSlot.classList.add(isCraftable ? 'cr-slot-ok' : 'cr-slot-ko')

        const retName = document.createElement('div')
        retName.className = 'cr-detail-name'
        retName.textContent = ret.item.name

        retRow.appendChild(retSlot)
        retRow.appendChild(retName)

        if (ret.count > 1) {
          const retQty = document.createElement('div')
          retQty.className = 'cr-detail-qty'
          retQty.textContent = `× ${ret.count}`
          retRow.appendChild(retQty)
        }
        section.appendChild(retRow)
      }
    }
    return section
  }

  #buildStationSection (recipe, stationNearby) {
    const section = document.createElement('div')
    section.className = 'cr-section'

    const label = document.createElement('div')
    label.className = 'cr-section-label'
    label.textContent = 'Crafting Station'
    section.appendChild(label)

    const row = document.createElement('div')
    row.className = 'cr-detail-row cr-station-row'

    const slot = document.createElement('inventory-slot')
    slot.classList.add('cr-detail-slot')
    if (recipe.station.type & ITEM_TYPE.CRAFTABLE) {
      slot.classList.add('cr-clickable')
      slot.addEventListener('click', () => this.#onDetailSlotClick(recipe.station.name))
    }
    slot.classList.add(stationNearby ? 'cr-slot-ok' : 'cr-slot-ko')

    slot.setAttribute('item', recipe.station.code)
    slot.title = recipe.station.hoverTitle

    const name = document.createElement('div')
    name.className = 'cr-detail-name'
    name.style.flex = '1'
    name.textContent = recipe.station.name

    row.appendChild(slot)
    row.appendChild(name)
    section.appendChild(row)
    return section
  }

  #buildIngredientsSection (recipe) {
    const section = document.createElement('div')
    section.className = 'cr-section'

    const label = document.createElement('div')
    label.className = 'cr-section-label'
    label.textContent = 'Ingredients'
    section.appendChild(label)

    for (const ing of recipe.ingredients) {
      const row = document.createElement('div')
      row.className = 'cr-detail-row cr-ing-row'

      const slot = document.createElement('inventory-slot')
      slot.classList.add('cr-detail-slot')
      if (ing.item.type & ITEM_TYPE.CRAFTABLE) {
        slot.classList.add('cr-clickable')
        slot.addEventListener('click', () => this.#onDetailSlotClick(ing.item.name))
      }
      slot.setAttribute('item', ing.item.code)
      slot.title = ing.item.hoverTitle
      const available = this.#availableMap[ing.item.code] ?? 0
      slot.classList.add(available >= ing.count ? 'cr-slot-ok' : 'cr-slot-ko')

      const name = document.createElement('div')
      name.className = 'cr-detail-name'
      name.textContent = ing.item.name

      const qty = document.createElement('div')
      qty.className = 'cr-detail-qty'
      const runs = parseInt(this.#craftCount.value, 10) || 1
      qty.textContent = `${available} / ${runs * ing.count}`
      this.#ingredientQtyEls.push({el: qty, code: ing.item.code, ingCount: ing.count})

      row.appendChild(slot)
      row.appendChild(name)
      row.appendChild(qty)
      section.appendChild(row)
    }

    return section
  }

  #onDetailSlotClick (name) {
    this.#filterInput.value = name
    this.#filterMode.style.display = 'none'
    this.#filterValue.style.display = 'none'
    this.#applyFilter()
  }

  #buildAvailableMap () {
    this.#availableMap = {}
    inventoryManager.fillMaterialsFromPlayer(this.#availableMap)
    // TODO furnitureManager — containers proches
    // const nearbyIds = furnitureManager.getNearbyContainerIds('craft-range')
    // for (const id of nearbyIds) {
    //   inventoryManager.fillMaterialsFromContainer(this.#availableMap, id)
    // }
  }

  #updateIngredientQtys () {
    const runs = parseInt(this.#craftCount.value, 10) || 1
    for (const {el, code, ingCount} of this.#ingredientQtyEls) {
      el.textContent = `${(this.#availableMap[code] ?? 0)} / ${runs * ingCount}`
    }
  }

  #updateCraftInput () {
    if (!this.#selectedRecipe) return

    let max = Infinity
    for (const ing of this.#selectedRecipe.ingredients) {
      const possible = Math.floor((this.#availableMap[ing.item.code] ?? 0) / ing.count)
      if (possible < max) max = possible
    }
    if (max === Infinity) max = 0

    this.#craftMax = max
    if (max === 0) {
      this.#craftCount.disabled = true
      this.#craftCount.value = '1'
      this.#craftCountHint.textContent = ''
    } else {
      this.#craftCount.disabled = false
      this.#craftCount.max = max
      this.#craftCount.value = String(Math.min(parseInt(this.#craftCount.value, 10) || 1, max))
      this.#craftCountHint.textContent = `(1 – ${max})`
    }

    this.#updateIngredientQtys()
  }

  #loadNearbyStations () {
    this.#nearbyStations = new Set()
    // TODO furnitureManager
    // const ids = furnitureManager.getNearbyCraftingStations()
    // for (const code of ids) this.#nearbyStations.add(code)

    // Simulation pour tests :
    for (const code of ['byHand', 'furnace', 'workbench']) this.#nearbyStations.add(code)
  }

  #updateCraftButton () {
    if (!this.#selectedRecipe || !this.#isCraftable || this.#craftMax === 0) {
      this.#btnCraft.disabled = true
      return
    }

    const runs = parseInt(this.#craftCount.value, 10) || 1
    const items = this.#buildCraftItems(runs)
    this.#btnCraft.disabled = !inventoryManager.canReceiveFromCraft(items)
  }

  #buildCraftItems (runs) {
    const items = [{code: this.#selectedRecipe.result.item.code, count: runs * this.#selectedRecipe.result.count}]
    if (this.#selectedRecipe.returned) {
      for (const ret of this.#selectedRecipe.returned) {
        items.push({code: ret.item.code, count: runs * ret.count})
      }
    }
    return items
  }

  #isRecipeFeasible (recipe) {
    for (const ing of recipe.ingredients) {
      if ((this.#availableMap[ing.item.code] ?? 0) < ing.count) return false
    }
    return true
  }
}
export const craftOverlay = new CraftOverlay()
