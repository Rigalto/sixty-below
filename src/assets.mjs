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
  // Items foraged / shaked /
  'assets/sprites/foraged_32_32.png',
  // critters / baits
  'assets/sprites/bait_32_32.png',
  // Items raffinés / bar, cut gem, metal fitting, fabric, coconut
  'assets/sprites/refined_32_32.png',
  // trinkets
  'assets/sprites/trinket_32_32.png',
  // tools
  'assets/sprites/tool_32_32.png',
  // provisoire
  'assets/sprites/loom_32_32.png',

  // PLACED //
  // ////// //

  'assets/sprites/placed_16_16.png',
  'assets/sprites/placed_16_32.png',
  'assets/sprites/placed_16_48.png',

  // supprimer ci-dessous
  // ////////////////////

  // TILES //
  // ////////

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
  // food
  'assets/sprites/food_32_32.png',
  // PLACED //
  // /////////
  'assets/sprites/fuws_16_16.png',
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
  'assets/sprites/coconut_80_48.png',
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
  // utilisaés
  'assets/sounds/chopping.wav',
  'assets/sounds/dead.mp3',
  'assets/sounds/fishing.mp3',
  'assets/sounds/foraging.wav',
  'assets/sounds/mining.ogg',
  'assets/sounds/placing.mp3',
  'assets/sounds/teleport.mp3',
  'assets/sounds/toofar.wav',
  'assets/sounds/unplacing.mp3',
  'assets/sounds/wrong.wav',
  // provision
  'assets/sounds/placefurniture.mp3',
  'assets/sounds/mine.wav',
  'assets/sounds/forageplant.mp3',
  'assets/sounds/dig.wav',
  'assets/sounds/tink1.wav',
  'assets/sounds/mining_hit.mp3',
  'assets/sounds/mining_break.mp3'
  // ...
]

// Volume relatif par son, en % (0-100, même échelle que sound/volume).
// Absent de la table => 100 (pas d'atténuation). Combiné multiplicativement
// avec le volume global via la chaîne source → gain (par son) → #masterGain.
export const SOUND_VOLUMES = {
  chopping: 100,
  dead: 35,
  fishing: 65,
  // foraging: 100,
  mining: 65,
  placing: 75,
  teleport: 40,
  toofar: 10,
  // unplacing: 100,
  wrong: 10
}

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
 * Analyse le nom de l'atlas pour en déduire la taille de cellule (grille).
 * Ex : "mineral_16_16" → cellW=16, cellH=16. Fallback {cellW:16, cellH:16} si le format n'est pas respecté.
 * @param {string} filename — nom de fichier sans extension, attendu sous la forme 'nom_w_h'
 * @returns {object} - { cellW, cellH }
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
 * Transforme une chaîne de définition en données de rendu exploitables par le Renderer.
 * Deux syntaxes reconnues :
 *   - "atlas+row"   (ex: "substrat_16_16+3") — mode autotile, colonne dynamique (bitmasking, hors fonction)
 *   - "atlas-x-y"   (ex: "liquid_16_16-1-0") — mode static, coordonnées explicites
 * Retourne null si codeStr est vide/absent, si le format n'est ni '+' ni '-', ou si l'atlas
 * n'est pas dans ATLAS_INDEX (image non chargée).
 * @param {string} codeStr — la chaîne brute ("atlas+row" ou "atlas-x-y")
 * @returns {object|null} - { imgIndex, file, sx, sy, sw, sh, isAutoTile }
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

/**
 * Charge toutes les images (IMAGE_FILES) et tous les sons (soundManager.loadSounds) en parallèle.
 * Tolérant aux échecs individuels : une image en erreur logue et résout quand même (ne bloque pas
 * les autres). Indexe chaque image par son nom de fichier sans extension (IMAGE_CACHE, ATLAS_INDEX).
 * Note : imageCount compte les chemins traités (succès ou échec confondus, IMAGE_CACHE.length),
 * tandis que soundCount ne compte que les sons effectivement décodés (SOUND_CACHE) — asymétrie
 * à garder en tête si ces compteurs servent à détecter des échecs de chargement.
 * @returns {Promise<object>} - { imageCount, soundCount }
 */
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

/* ====================================================================================================
   SOUND MANAGER
   ====================================================================================================

   Autorité unique sur la lecture des sons et leur volume. Aucune logique DOM.
   Seule classe du projet à écouter directement window (déblocage du contexte audio, cf. Interactions).
   Singleton : soundManager.

   Responsabilités :
     - Chargement de tous les fichiers de SOUND_FILES en AudioBuffer (loadSounds),
       tolérant aux échecs individuels (catch → log, ne bloque pas les autres fichiers)
     - Lecture d'un son par son nom (playSound) ; no-op silencieux si absent de SOUND_CACHE
     - Volume individuel par son (SOUND_VOLUMES) combiné multiplicativement au volume global
     - Volume global de l'application (onSoundVolume, 0-100, 0 = muet)
     - Reprise anticipée de #audioCtx (politique autoplay des navigateurs) à la première
       interaction utilisateur (onFirstInteraction), pour masquer la latence avant le
       premier son de gameplay

   Interactions :
     eventBus    — écoute : sound/play, sound/volume
     window      — écoute : pointerdown, keydown, une seule fois ; déblocage de #audioCtx,
                   les deux listeners sont retirés après la première interaction
     loadAssets  — appelle loadSounds() au chargement initial, en parallèle des images

   Sons (constantes module, assets.mjs) :
     SOUND_FILES    — chemins sources, deux groupes : utilisés / provision (futurs sons)
     SOUND_CACHE    — nom→AudioBuffer (clé = nom de fichier sans extension), peuplé par loadSounds()
     SOUND_VOLUMES  — volume relatif par son, 0-100, défaut 100 si absent de la table

   Graphe audio (par lecture, #startSource) :
     AudioBufferSourceNode (éphémère) → GainNode (éphémère, SOUND_VOLUMES[name]) → #masterGain → destination.
     Chaque appel crée sa propre paire source/gain, non référencée après start() —
     lectures simultanées indépendantes, pas de limite de polyphonie.
   ==================================================================================================== */

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
      this.#audioCtx.resume().then(() => this.#startSource(buffer, name))
      return
    }
    this.#startSource(buffer, name)
  }

  /**
   * Crée et démarre un AudioBufferSourceNode éphémère pour le buffer donné,
   * via un GainNode éphémère réglé selon SOUND_VOLUMES[name] (défaut 100),
   * lui-même connecté à #masterGain (volume global).
   * @param {AudioBuffer} buffer
   * @param {string} name — nom du son (clé SOUND_CACHE / SOUND_VOLUMES)
   */
  #startSource (buffer, name) {
    const source = this.#audioCtx.createBufferSource()
    source.buffer = buffer

    const gain = this.#audioCtx.createGain()
    gain.gain.value = (SOUND_VOLUMES[name] ?? 100) / 100

    source.connect(gain)
    gain.connect(this.#masterGain)
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
