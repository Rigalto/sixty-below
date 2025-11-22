/**
 * @file assets.mjs
 * @description Gestionnaire central des ressources (Images, Audio) et parsing des références.
 */

/* =========================================
   1. LISTES DES FICHIERS
   ========================================= */

export const IMAGE_FILES = [
  // TILES //
  // ////////
  // Tuiles de copper / iron / silver / gold / cobalt / platine
  'assets/sprites/ore_16_16.png',
  // Tuiles de contour / dirt / stone / clay / mud / sand / humus / silt / ash / web / slush
  'assets/sprites/substrat_16_16.png',
  // Tuiles de granite / marble / meteorite / obsidian / hellstone / sandstone / hive
  'assets/sprites/rock_16_16.png',
  // Tuiles de topaz / rubis / emerald / sapphir
  'assets/sprites/gem_16_16.png',
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
  // passive buffs
  'assets/sprites/passive_32_32.png',
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
  'assets/sounds/mining_hit.mp3',
  'assets/sounds/mining_break.mp3',
  'assets/sounds/water_splash.mp3'
  // ...
]

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
 * Ex: "ore_16_16" -> cellW=16, cellH=16
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
  const sndPromises = []
  // const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  // const sndPromises = SOUND_FILES.map(path => {
  //   return fetch(path)
  //     .then(response => response.arrayBuffer())
  //     .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
  //     .then(audioBuffer => {
  //       const filename = path.substring(path.lastIndexOf('/') + 1, path.lastIndexOf('.'))
  //       SOUND_CACHE[filename] = audioBuffer
  //     })
  //     .catch(e => console.error(`Sound error ${path}`, e))
  // })

  await Promise.all([...imgPromises, ...sndPromises])
  console.timeEnd('Assets Loading')
  return {imageCount: IMAGE_CACHE.length, soundCount: Object.keys(SOUND_CACHE).length}
}
