/**
 * @file debug-ui.mjs
 * @description UI Technique (Canvas Overlay pour Perf Monitoring).
 */

import {MICROTASK} from './constant.mjs'
import {eventBus, microTasker, taskScheduler} from './utils.mjs'

const DEBUG_WIDTH = 200
const DEBUG_HEIGHT = 110

class RealtimeDebugOverlay {
  constructor () {
    this.canvas = null
    this.ctx = null

    // État interne (Compteurs)
    this.stats = {
      calc: 0,
      render: 0,
      micro: 0,
      calcMax: 0,
      renderMax: 0,
      microMax: 0,
      microCountMax: 0,
      taskCountMax: 0
    }

    this.frameCount = 64 // Moyenne sur 64 frames (~1 sec)

    this.renderDebugOverlay = this.renderDebugOverlay.bind(this)

    this.#initCanvas()
    this.#bindEvents()
  }

  #initCanvas () {
    this.canvas = document.createElement('canvas')
    this.canvas.width = DEBUG_WIDTH
    this.canvas.height = DEBUG_HEIGHT

    // Style (Position bas-droite)
    Object.assign(this.canvas.style, {
      position: 'absolute',
      bottom: '10px',
      right: '10px',
      pointerEvents: 'none',
      zIndex: '2000', // Au-dessus de tout
      backgroundColor: 'rgba(0, 0, 0, 0.8)', // Fond semi-transparent
      borderRadius: '4px'
    })

    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d', {alpha: true}) // Alpha pour la transparence

    // Configuration texte statique
    this.ctx.font = '12px monospace'
    this.ctx.textBaseline = 'top'
    this.ctx.fillStyle = '#FFB000'
  }

  #bindEvents () {
    // Écoute de l'événement émis par la boucle principale
    eventBus.on('debug/frame-sample', this.#addSample.bind(this))
  }

  #addSample ({updateTime, renderTime, microTime}) {
    // Conversion en µs (1ms = 1000µs)
    const calcP = Math.round(updateTime * 1000)
    const renderP = Math.round(renderTime * 1000)
    const microP = Math.round(microTime * 1000)

    // Cumul pour moyenne
    this.stats.calc += calcP
    this.stats.render += renderP
    this.stats.micro += microP

    // Maxima
    if (calcP > this.stats.calcMax) this.stats.calcMax = calcP
    if (renderP > this.stats.renderMax) this.stats.renderMax = renderP
    if (microP > this.stats.microMax) this.stats.microMax = microP

    // Queue sizes
    const mCount = microTasker.queueSize
    if (mCount > this.stats.microCountMax) this.stats.microCountMax = mCount

    const tCount = taskScheduler.queueSize
    if (tCount > this.stats.taskCountMax) this.stats.taskCountMax = tCount

    // DÉCLENCHEMENT AFFICHAGE DANS MICRO-TÂCHE toutes les 64 frames
    if (--this.frameCount === 0) {
      // 1. Snapshot des données (pour que l'affichage soit cohérent même s'il est différé)
      const snapshot = {
        avgCalc: this.stats.calc >> 6, // division par 64
        avgRender: this.stats.render >> 6,
        avgMicro: this.stats.micro >> 6,
        calcMax: this.stats.calcMax,
        renderMax: this.stats.renderMax,
        microMax: this.stats.microMax,
        microCountMax: this.stats.microCountMax,
        taskCountMax: this.stats.taskCountMax
      }

      // 2. Reset immédiat des compteurs pour la frame suivante
      this.#reset()

      // 3. Envoi au MicroTasker
      // Priorité : 10 (Basse, le jeu passe avant le debug)
      // Capacité : 4 unités (1ms estimée pour le canvas fillText)
      const {priority, capacity} = MICROTASK.RENDER_DEBUG_OVERLAY
      microTasker.enqueue(this.renderDebugOverlay, priority, capacity, snapshot)
    }
  }

  renderDebugOverlay (data) {
    // Nettoyage
    this.ctx.clearRect(0, 0, DEBUG_WIDTH, DEBUG_HEIGHT)

    // Dessin des lignes (Optimisation: template literals pré-calculés)
    this.#drawRow(0, 'Updt', data.avgCalc, data.calcMax)
    this.#drawRow(1, 'Rndr', data.avgRender, data.renderMax)
    this.#drawRow(2, 'Micr', data.avgMicro, data.microMax)

    // Lignes Files d'attente
    const y4 = 10 + (3 * 20)
    this.ctx.fillText(`µTsk: ${microTasker.queueSize}`, 10, y4)
    this.ctx.fillText(`Max: ${data.microCountMax}`, 110, y4)

    const y5 = 10 + (4 * 20)
    this.ctx.fillText(`Tsk : ${taskScheduler.queueSize}`, 10, y5)
    this.ctx.fillText(`Max: ${data.taskCountMax}`, 110, y5)
  }

  #drawRow (index, label, avg, max) {
    const y = 10 + (index * 20)
    this.ctx.fillText(`${label}: ${avg}µs`, 10, y)

    // Changement couleur si pic élevé (> 16ms = 16000µs pour le total, ici seuil arbitraire par étape)
    if (max > 5000) this.ctx.fillStyle = 'red'
    this.ctx.fillText(`Max: ${max}µs`, 110, y)
    if (max > 5000) this.ctx.fillStyle = '#FFB000' // Reset couleur
  }

  #reset () {
    this.stats.calc = 0
    this.stats.render = 0
    this.stats.micro = 0
    this.stats.calcMax = 0
    this.stats.renderMax = 0
    this.stats.microMax = 0
    this.stats.microCountMax = 0
    this.stats.taskCountMax = 0
    this.frameCount = 64
  }
}

export const realtimeDebugOverlay = new RealtimeDebugOverlay()
