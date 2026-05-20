import {OVERLAYS} from './constant.mjs'
import {eventBus} from './utils.mjs'
import {createOverlayHeader} from './ui.mjs'

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
`
document.head.appendChild(craftStyle)

class CraftOverlay {
  #container
  #header
  #filterZone
  #detailZone
  #craftZone
  #gridZone

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
    this.#filterZone.textContent = 'Zone filtre'

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
  }
}
export const craftOverlay = new CraftOverlay()
