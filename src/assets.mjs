/**
 * @file assets.mjs
 * @description Gestionnaire central des ressources (Images, Audio) et parsing des références.
 */

/* =========================================
   1. LISTES DES FICHIERS
   ========================================= */

export const IMAGE_FILES = [
  '/assets/sprites/ore_16_16.png',
  '/assets/sprites/substrat_16_16.png',
  '/assets/sprites/liquid_16_16.png',
  '/assets/sprites/tools_32_32.png',
  // ... le reste de votre liste ...
]

export const SOUND_FILES = [
  '/assets/sounds/mining_hit.mp3',
  '/assets/sounds/mining_break.mp3',
  '/assets/sounds/water_splash.mp3',
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
   3. PARSING LOGIC (La nouveauté)
   ========================================= */

/**
 * Analyse le nom de l'atlas pour en déduire la grille.
 * Ex: "ore_16_16" -> cellW=16, cellH=16
 */
function parseAtlasName(filename) {
  const parts = filename.split('_')
  // Si le format est respecté: nom_w_h
  if (parts.length >= 3) {
    const h = parseInt(parts.pop(), 10)
    const w = parseInt(parts.pop(), 10)
    return { w, h }
  }
  // Fallback
  return { w: 16, h: 16 }
}

/**
 * Transforme une chaîne de définition ("substrat_16_16+3") en données de rendu exploitables.
 * @param {string} codeStr - La chaîne brute.
 * @returns {object|null} - { imgId, sx, sy, sw, sh }
 */
export const resolveAssetData = (codeStr) => {
  if (!codeStr) return null

  let atlasName, variant = 0, tx = 0, ty = 0
  
  // Cas 1: Variante simple "atlas+index"
  if (codeStr.includes('+')) {
    const parts = codeStr.split('+')
    atlasName = parts[0]
    variant = parseInt(parts[1], 10)
  } 
  // Cas 2: Coordonnées explicites "atlas-x-y"
  else if (codeStr.includes('-')) {
    const parts = codeStr.split('-')
    // Attention: votre format est "nom_w_h-x-y"
    // on doit reconstituer le nom de l'atlas qui peut contenir des underscores
    // Le plus simple est de prendre tout sauf les 2 derniers
    ty = parseInt(parts.pop(), 10)
    tx = parseInt(parts.pop(), 10)
    atlasName = parts.join('-')
  } else {
    return null
  }

  const imgIndex = ATLAS_INDEX[atlasName]
  if (imgIndex === undefined) {
    console.warn(`Asset resolve error: Atlas '${atlasName}' not found.`)
    return null
  }

  const imgObj = IMAGE_CACHE[imgIndex]
  const { cellW, cellH } = imgObj.meta

  // Calcul des coordonnées sources (sx, sy)
  let sx, sy

  if (codeStr.includes('+')) {
    // Calcul automatique basé sur la largeur de l'image
    const cols = Math.floor(imgObj.width / cellW)
    sx = (variant % cols) * cellW
    sy = Math.floor(variant / cols) * cellH
  } else {
    sx = tx * cellW // Si x était un index de colonne
    sy = ty * cellH // Si y était un index de ligne
    // Si tx/ty sont des pixels absolus, retirer la multiplication
  }

  return {
    imgId: imgIndex, // L'entier ultra-rapide pour le renderer
    sx, sy,
    sw: cellW,
    sh: cellH
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
      
      // Extraction Nom & Métadonnées
      const filename = path.substring(path.lastIndexOf('/') + 1, path.lastIndexOf('.'))
      const meta = parseAtlasName(filename)
      
      img.meta = { cellW: meta.w, cellH: meta.h }
      
      // Indexation
      IMAGE_CACHE[index] = img
      ATLAS_INDEX[filename] = index

      img.onload = () => resolve()
      img.onerror = () => {
        console.error(`Failed: ${path}`)
        resolve() // On ne bloque pas
      }
    })
  })

  // 4.2 Chargement Sons (Web Audio API)
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const sndPromises = SOUND_FILES.map(path => {
    return fetch(path)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
      .then(audioBuffer => {
        const filename = path.substring(path.lastIndexOf('/') + 1, path.lastIndexOf('.'))
        SOUND_CACHE[filename] = audioBuffer
      })
      .catch(e => console.error(`Sound error ${path}`, e))
  })

  await Promise.all([...imgPromises, ...sndPromises])
  console.timeEnd('Assets Loading')
  return { imageCount: IMAGE_CACHE.length, soundCount: Object.keys(SOUND_CACHE).length }
}
