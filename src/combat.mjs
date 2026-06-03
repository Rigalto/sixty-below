// combat.mjs — CombatOverlay

import {eventBus} from './utils.mjs'
import {OVERLAYS} from './constant.mjs'
import {createOverlayHeader} from './ui.mjs'

/* ====================================================================================================
   CSS - injection des styles utilisés par toutes les classes du fichier
   ==================================================================================================== */

const combatStyle = document.createElement('style')
combatStyle.textContent = /* css */`
#ui-combat-panel {
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
  z-index: ${OVERLAYS.combat.zIndex};
  display: none;
  flex-direction: column;
  font-family: Segoe UI, Roboto, sans-serif;
  color: var(--ov-text);
  user-select: none;
}
#ui-combat-panel.open { display: flex; }
#ui-combat-panel .combat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
`
document.head.appendChild(combatStyle)

class CombatOverlay {
  #container = null

  constructor () {
    this.#container = document.createElement('div')
    this.#container.id = 'ui-combat-panel'
    this.#container.appendChild(createOverlayHeader('⚔️ Combat', 'combat'))
    this.#buildDOM()
    document.body.appendChild(this.#container)
    this.#bindEvents()
  }

  #buildDOM () {
    const content = document.createElement('div')
    content.className = 'combat-content'

    const btnDefeat = document.createElement('button')
    btnDefeat.textContent = 'Defeat'
    btnDefeat.addEventListener('click', () => eventBus.emit('overlay/close', 'combat'))

    const btnVictory = document.createElement('button')
    btnVictory.textContent = 'Victory'
    btnVictory.addEventListener('click', () => eventBus.emit('overlay/close', 'combat'))

    content.appendChild(btnDefeat)
    content.appendChild(btnVictory)
    this.#container.appendChild(content)
  }

  #bindEvents () {
    this.onCombatOpen = this.onCombatOpen.bind(this)
    eventBus.on('combat/open', this.onCombatOpen)
    this.onCombatClose = this.onCombatClose.bind(this)
    eventBus.on('combat/close', this.onCombatClose)
  }

  onCombatOpen () { this.#container.style.display = 'flex' }
  onCombatClose () { this.#container.style.display = 'none' }
}
export const combatOverlay = new CombatOverlay()
