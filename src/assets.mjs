// assets.mjs

import {eventBus} from './utils.mjs'

/* =========================================
   1. LISTES DES FICHIERS
   ========================================= */

export const IMAGE_FILES = [

  // TILES //
  // ///// //

  // Tuiles de terrain / substrat, topsoil, web
  'assets/sprites/substrat_16_16.png',
  // Tuiles de mineral / ore, deposit, rock
  'assets/sprites/mineral_16_16.png',
  // Tuiles de natural / grass
  'assets/sprites/natural_16_16.png',

  // ITEMS //
  // ///// //

  // Items minés / substrat, topsoil, web, ore, raw gem, rock
  'assets/sprites/mined_32_32.png',
  // Items raffinés / bar, cut gem, metal fitting, fabric
  'assets/sprites/refined_32_32.png',
  // trinkets
  'assets/sprites/trinket_32_32.png',
  // tools
  'assets/sprites/tool_32_32.png',
  // provisoire
  'assets/sprites/loom_32_32.png',

  // PLACED //
  // ////// //

  // supprimer ci-dessous
  // ////////////////////

  // TILES //
  // ////////

  // Tuiles de grass / jungle grass / mushroom grass / ash grass
  'assets/sprites/grass_16_16.png',
  // Tuiles de wood wall / background wall
  'assets/sprites/wall_16_16.png',
  // sea / water / honey / lava
  'assets/sprites/liquid_16_16.png',
  // ITEMS //
  // ////////
  // Items des blocs de minage
  // copper / iron / silver / gold / cobalt / platine / meteorite / slush
  // dirt / stone / clay / mud / sand / humus / silt / ash
  // granite / marble / obsidian / hellstone / sandstone / hive
  // topaz / rubis / emerald / sapphir
  'assets/sprites/blocks_16_16.png',
  // weapons / tools / walls / seeds / platforms / bags
  // misc
  'assets/sprites/tools_32_32.png',
  // accessory
  'assets/sprites/accessories_32_32.png',
  // furniture / crafting station
  'assets/sprites/furniture_32_32.png',
  // potions / consumables
  'assets/sprites/potions_32_32.png',
  // crafting seul
  'assets/sprites/crafting_32_32.png',
  // critters / bait
  'assets/sprites/critter_32_32.png',
  // food
  'assets/sprites/food_32_32.png',
  // PLACED //
  // /////////
  'assets/sprites/fuws_16_16.png',
  'assets/sprites/placed_16_32.png',
  'assets/sprites/fuws_16_48.png',
  'assets/sprites/fuws_32_16.png',
  'assets/sprites/fuws_32_32.png',
  'assets/sprites/fuws_32_48.png',
  'assets/sprites/fuws_32_80.png',
  'assets/sprites/fuws_48_16.png',
  'assets/sprites/fuws_48_32.png',
  'assets/sprites/fuws_48_48.png',
  'assets/sprites/fuws_64_32.png',
  'assets/sprites/npc_26_46.png',
  'assets/sprites/heads_26_22.png',
  'assets/sprites/bodies_26_18.png',
  'assets/sprites/feet_26_12.png',
  'assets/sprites/oak_80_48.png',
  'assets/sprites/mahogany_80_48.png',
  // IN HAND //
  // //////////
  'assets/sprites/s_42_42.png',
  'assets/sprites/w_42_42.png',
  'assets/sprites/w_62_62.png',
  // IHM //
  // //////
  'assets/sprites/buff_32_32.png', // buffs et town signs
  'assets/sprites/moon_50_50.png',
  'assets/sprites/env_32_32.png',
  'assets/sprites/coins_16_16.png', // aussi un item
  'assets/sprites/ihm_32_32.png'
]

export const SOUND_FILES = [
  // utilisables
  'assets/sounds/teleport.mp3',
  'assets/sounds/placeblock.mp3',
  'assets/sounds/foragenatural.wav',
  'assets/sounds/forageplant.mp3',
  'assets/sounds/placefurniture.mp3',
  'assets/sounds/unplace.mp3',
  'assets/sounds/fishing.mp3',
  'assets/sounds/dead.mp3',
  'assets/sounds/axe.wav',
  'assets/sounds/mine.wav',
  // provision
  'assets/sounds/dig.wav',
  'assets/sounds/tink1.wav',
  'assets/sounds/mining_hit.mp3',
  'assets/sounds/mining_break.mp3'
  // ...
]

// // Contexte Web Audio partagé — créé une seule fois, suspendu jusqu'à interaction utilisateur
// const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
// // GainNode global — contrôle du volume via 'sound/volume' (0-100)
// const masterGain = audioCtx.createGain()
// masterGain.connect(audioCtx.destination)

/* =========================================
   2. CACHES & INDEXES
   ========================================= */

// Stocke les objets Image(), enrichis avec .meta { cellW, cellH }
export const IMAGE_CACHE = []
// Map NomFichier (sans ext) -> Index dans IMAGE_CACHE
export const ATLAS_INDEX = {}

// Stocke les AudioBuffers (Web Audio API)
export const SOUND_CACHE = {}

/* =========================================
   3. PARSING LOGIC
   ========================================= */

/**
 * Analyse le nom de l'atlas pour en déduire la grille.
 * Ex: "mineral_16_16" -> cellW=16, cellH=16
 */
function parseAtlasName (filename) {
  const parts = filename.split('_')
  // Si le format est respecté: nom_w_h
  if (parts.length === 3) {
    const cellH = parseInt(parts.pop(), 10)
    const cellW = parseInt(parts.pop(), 10)
    return {cellW, cellH}
  }
  // Fallback
  return {cellW: 16, cellH: 16}
}

/**
 * Transforme une chaîne de définition ("substrat_16_16+3") en données de rendu exploitables.
 * @param {string} codeStr - La chaîne brute.
 * @returns {object|null} - { imgId, sx, sy, sw, sh }
 */
export const resolveAssetData = (codeStr) => {
  if (!codeStr) return null

  let atlasName
  let row = 0
  let col = 0
  let isAutoTile = false

  if (codeStr.includes('+')) {
    // Cas 1: Variante simple "atlas+index", index=y, x déterminé dynamiquement (framing)
    // MODE AUTOTILE (Ligne fixe, Colonne dynamique)
    // ex: "substrat_16_16+3" -> Ligne 3
    const parts = codeStr.split('+')
    atlasName = parts[0]
    row = parseInt(parts[1], 10)
    col = 0 // Sera modifié par le bitmasking (0-15)
    isAutoTile = true
  } else if (codeStr.includes('-')) {
    // Cas 2: Coordonnées explicites "atlas-x-y"
    // MODE STATIC (Coordonnées fixes)
    // ex: "liquid_16_16-1-0" -> Colonne 1, Ligne 0
    const parts = codeStr.split('-')
    row = parseInt(parts.pop(), 10) // y
    col = parseInt(parts.pop(), 10) // x
    atlasName = parts.join('-') // marche même si le nom contient un tiret
  } else {
    return null
  }

  const imgIndex = ATLAS_INDEX[atlasName]
  if (imgIndex === undefined) return null

  const {cellH, cellW} = parseAtlasName(atlasName)

  return {
    imgIndex, // L'entier ultra-rapide pour le renderer
    file: atlasName,
    sx: col * cellW, // Position X de base (0 pour autotile)
    sy: row * cellH, // Position Y (Ligne du matériau)
    sw: cellW,
    sh: cellH,
    isAutoTile // Flag utile pour le Renderer (savoir s'il doit calculer et appliquer le mask)
  }
}

/* =========================================
   4. LOADER ENGINE
   ========================================= */

export const loadAssets = async () => {
  console.time('Assets Loading')

  // 4.1 Chargement Images
  const imgPromises = IMAGE_FILES.map((path, index) => {
    return new Promise((resolve) => {
      const img = new Image()
      img.src = path

      // Indexation
      const filename = path.substring(path.lastIndexOf('/') + 1, path.lastIndexOf('.'))
      IMAGE_CACHE[index] = img
      ATLAS_INDEX[filename] = index

      img.onload = () => resolve()
      img.onerror = () => {
        console.error(`loadAssets - Image non chargée: ${path}`)
        resolve() // On ne bloque pas
      }
    })
  })

  // 4.2 Chargement Sons (Web Audio API)
  const sndPromises = soundManager.loadSounds()

  await Promise.all([...imgPromises, ...sndPromises])
  console.timeEnd('Assets Loading')
  console.log(`   🔹 Images chargées : ${IMAGE_CACHE.length}`)
  console.log(`   🔹 Sons chargés : ${Object.keys(SOUND_CACHE).length}`)

  return {imageCount: IMAGE_CACHE.length, soundCount: Object.keys(SOUND_CACHE).length}
}

class SoundManager {
  #audioCtx = new (window.AudioContext || window.webkitAudioContext)() // contexte Web Audio partagé
  #masterGain = this.#audioCtx.createGain() // gain global, contrôlé par sound/volume

  constructor () {
    this.#masterGain.connect(this.#audioCtx.destination)
    // eventBus
    this.onSoundPlay = this.onSoundPlay.bind(this)
    this.onSoundVolume = this.onSoundVolume.bind(this)
    eventBus.on('sound/play', this.onSoundPlay)
    eventBus.on('sound/volume', this.onSoundVolume)
    // event DOM
    this.onFirstInteraction = this.onFirstInteraction.bind(this)
    window.addEventListener('pointerdown', this.onFirstInteraction)
    window.addEventListener('keydown', this.onFirstInteraction)
  }

  /**
 * Lance le décodage de tous les fichiers de SOUND_FILES et peuple SOUND_CACHE.
 * @returns {Promise<void>[]} une promesse par fichier, à inclure dans Promise.all de loadAssets
 */
  loadSounds () {
    return SOUND_FILES.map(path => {
      return fetch(path)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => this.#audioCtx.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
          const filename = path.substring(path.lastIndexOf('/') + 1, path.lastIndexOf('.'))
          SOUND_CACHE[filename] = audioBuffer
        })
        .catch(e => console.error(`Sound error ${path}`, e))
    })
  }

  /**
   * Joue un son depuis SOUND_CACHE. Plusieurs instances peuvent jouer simultanément —
   * chaque appel crée un AudioBufferSourceNode éphémère, détruit après lecture.
   * Si le contexte est suspendu, reprend avant lecture.
   * @param {string} name — nom du fichier sans extension (clé SOUND_CACHE)
   */
  playSound (name) {
    const buffer = SOUND_CACHE[name]
    if (buffer === undefined) return

    if (this.#audioCtx.state === 'suspended') {
      this.#audioCtx.resume().then(() => this.#startSource(buffer))
      return
    }
    this.#startSource(buffer)
  }

  /**
   * Crée et démarre un AudioBufferSourceNode éphémère pour le buffer donné.
   * @param {AudioBuffer} buffer
   */
  #startSource (buffer) {
    const source = this.#audioCtx.createBufferSource()
    source.buffer = buffer
    source.connect(this.#masterGain)
    source.start(0)
  }

  /**
   * Liaison EventBus : 'sound/play' — joue un son par son nom. Synchrone.
   * @param {string} name — nom du fichier sans extension (clé SOUND_CACHE)
   */
  onSoundPlay (name) { this.playSound(name) }

  /**
   * Liaison EventBus : 'sound/volume' — règle le volume global (0-100).
   * @param {number} percent — 0 = muet, 100 = volume normal
   */
  onSoundVolume (percent) { this.#masterGain.gain.value = percent / 100 }

  /**
   * Reprise anticipée du contexte audio à la première interaction —
   * masque la latence d'initialisation matérielle avant le premier son de gameplay.
   */
  onFirstInteraction () {
    if (this.#audioCtx.state === 'suspended') this.#audioCtx.resume()
    window.removeEventListener('pointerdown', this.onFirstInteraction)
    window.removeEventListener('keydown', this.onFirstInteraction)
  }
}
export const soundManager = new SoundManager()
