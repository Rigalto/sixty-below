import {OVERLAYS} from './constant.mjs'
import {eventBus} from './utils.mjs'
import {createOverlayHeader} from './ui.mjs'

class HelpOverlay {
  #container
  #header
  #content

  constructor () {
    // 1. Création du Conteneur Principal
    this.#container = document.createElement('div')
    this.#container.id = 'ui-help-panel'

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
      zIndex: OVERLAYS.help.zIndex,
      display: 'none', // Caché par défaut
      flexDirection: 'column',
      fontFamily: 'Segoe UI, Roboto, sans-serif',
      color: '#ffffff',
      userSelect: 'none' // On évite de sélectionner le texte en cliquant partout
    })

    // 2. Création du Header via la Factory
    const {header, closeBtn} = createOverlayHeader('📜 Aide [H]' ,'help')
    this.#header = header
    this.closeBtn = closeBtn

    // 3. Zone de contenu (Vide pour l'instant, juste pour remplir)
    this.#content = document.createElement('div')
    Object.assign(this.#content.style, {
      flex: '1',
      position: 'relative'
    })

    // Assemblage
    this.#container.appendChild(this.#header)
    this.#container.appendChild(this.#content)
    document.body.appendChild(this.#container)

    // 4. Gestion des événements
    this.#initEvents()
  }

  #initEvents () {
    // Abonnement au Bus
    eventBus.on('help/open', () => {
      this.#container.style.display = 'flex'
    })

    eventBus.on('help/close', () => {
      this.#container.style.display = 'none'
    })
  }
}
export const helpOverlay = new HelpOverlay()
