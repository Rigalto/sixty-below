import {eventBus} from './utils.mjs'
import {OVERLAYS} from './constant.mjs'
import {createOverlayHeader} from './ui.mjs'


class CombatOverlay {
  #container

  constructor () {
    this.#container = document.createElement('div')
    this.#container.id = 'ui-combat-panel'
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
      zIndex: OVERLAYS.combat.zIndex,
      display: 'none',
      flexDirection: 'column',
      fontFamily: 'Segoe UI, Roboto, sans-serif',
      color: '#ffffff',
      userSelect: 'none'
    })

    this.#container.appendChild(createOverlayHeader('⚔️ Combat', 'combat'))

    const content = document.createElement('div')
    Object.assign(content.style, {
      flex: '1',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px'
    })

    const btnDefeat = document.createElement('button')
    btnDefeat.textContent = 'Defeat'
    btnDefeat.addEventListener('click', () => eventBus.emit('overlay/close', 'combat'))

    const btnVictory = document.createElement('button')
    btnVictory.textContent = 'Victory'
    btnVictory.addEventListener('click', () => eventBus.emit('overlay/close', 'combat'))

    content.appendChild(btnDefeat)
    content.appendChild(btnVictory)
    this.#container.appendChild(content)
    document.body.appendChild(this.#container)

    eventBus.on('combat/open', () => { this.#container.style.display = 'flex' })
    eventBus.on('combat/close', () => { this.#container.style.display = 'none' })
  }
}

export const combatOverlay = new CombatOverlay()
