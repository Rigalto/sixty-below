import {seededRNG} from './utils.mjs'
import {database} from './database.mjs'
import {NODES, NODES_LOOKUP, NODE_TYPE, WEATHER_TYPE, BIOME_TYPE, WORLD_WIDTH, WORLD_HEIGHT, SEA_LEVEL, BIOME_TILE_MAP} from '../assets/data/data-gen.mjs'

/* ====================================================================================================
   WORLD BUFFER (CREATION DU MONDE)
   ==================================================================================================== */

class WorldBuffer {
  #data

  constructor () {
    this.#data = null
  }

  init () {
    this.#data = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT)
  }

  get world () { return this.#data }

  snapshot () { return this.#data.slice() }

  clear () { this.#data = null }

  read (x, y) {
    // DEBUG — décommenter pour investiguer les accès invalides :
    // if (!this.#data || x < 0 || x >= 1024 || y < 0 || y >= 512) { debugger }
    return this.#data[(y << 10) | x]
  }

  readAt (index) { return this.#data[index] }

  write (x, y, value) {
    // DEBUG — décommenter pour investiguer les accès invalides :
    // if (!this.#data || x < 0 || x >= 1024 || y < 0 || y >= 512) { debugger }
    this.#data[(y << 10) | x] = value
  }

  writeAt (index, value) { this.#data[index] = value }

  processWorldToChunks () {
    const chunksX = WORLD_WIDTH >> 4
    const chunksY = WORLD_HEIGHT >> 4
    const totalChunks = chunksX * chunksY
    const result = []

    for (let i = 0; i < totalChunks; i++) {
      const cx = i & 0x3F
      const cy = i >> 6
      const buffer = new Uint8Array(256)
      const startWorldX = cx << 4
      const startWorldY = cy << 4
      let rowOffset = (startWorldY << 10) | startWorldX

      for (let y = 0; y < 16; y++) {
        buffer.set(this.#data.subarray(rowOffset, rowOffset + 16), y << 4)
        rowOffset += WORLD_WIDTH
      }
      result.push({key: i, chunk: buffer})
    }
    return result
  }
}

export const worldBuffer = new WorldBuffer()

/* ====================================================================================================
   CREATION DU MONDE
   ==================================================================================================== */

const SEA_MAX_DEPTH = 280 // tuiles

class WorldGenerator {
  async generate (seed, debug = false) {
    const t0 = performance.now()
    console.log('[WorldGenerator] - Début avec la graine', seed)

    // 0. Initialisation du buffer de génération
    worldBuffer.init()

    // 1. On passe le générateur de nombre aléatoire en mode déterminé par la clé
    seededRNG.init(seed)

    // 2. Génération des biomes (rectangles)
    const {biomesDescription, leftSeaWidth, rightSeaWidth} = biomesGenerator.generate()
    console.log('[WorldGenerator::biomesDescription] - Biomes', biomesDescription, leftSeaWidth, rightSeaWidth, (performance.now() - t0).toFixed(3), 'ms')

    // 3. Rafinement des biomes (Perlin + diffusion)
    biomeNaturalizer.naturalize(biomesDescription, leftSeaWidth, rightSeaWidth)
    console.log('[WorldGenerator::biomeNaturalizer] - Biomes', (performance.now() - t0).toFixed(3), 'ms')

    // N. Stochage du monde en base de données
    if (!debug) {
      await this.save(seed)
      worldBuffer.clear()
    }

    // N + 1. On repasse le générateur de nombres aléatoires en mode aléatoire
    seededRNG.init()

    console.log('[WorldGenerator] - Terminé en', (performance.now() - t0).toFixed(3), 'ms')
    if (debug) { return worldBuffer } // appelant responsable du clear()
  }

  async save (seed) {
    const start = window.performance.now()
    // 1. Sauvegarde des tuiles
    await database.clearObjectStore('world_chunks')

    const chunks = worldBuffer.processWorldToChunks() // NEW
    await database.addMultipleRecords('world_chunks', chunks)
    // for (let yc = 0; yc < GEOMETRY.WORLD_CHUNK_Y; yc++) {
    //   const records = []
    //   for (let xc = 0; xc < GEOMETRY.WORLD_CHUNK_X; xc++) {
    //     const key = yc * GEOMETRY.WORLD_CHUNK_X + xc
    //     const chunk = this.chunks[key]
    //     records.push({key, chunk: chunk.chunk})
    //   await database.addMultipleRecords('world_chunks', records)
    //   }
    // }
    // sauvegardes des spots de graines
    // await database.clearObjectStore('seeds')
    // await database.addMultipleRecords('seeds', this.seedSpots)
    // sauvegardes des arbres
    // await database.clearObjectStore('trees')
    // await database.addMultipleRecords('trees', this.treeSpots)

    const weather = seededRNG.randomGetArrayWeighted(WEATHER_TYPE)
    const nextweather = seededRNG.randomGetArrayWeighted(WEATHER_TYPE)

    await database.clearObjectStore('gamestate')
    await database.batchSetGameState([
      {key: 'player', value: '8192|1280|1'},
      {key: 'spawn', value: '8192|1280'},
      {key: 'randomkey', value: seed},
      {key: 'uniqueidseed', value: 'a'},
      {key: 'timestamp', value: 480 * 1000}, // Day 1 - 8:00
      {key: 'weather', value: weather},
      {key: 'nextweather', value: nextweather},

      {key: 'redhearts', value: 5},
      {key: 'goldhearts', value: 0},
      {key: 'daybloomseeds', value: ''},
      {key: 'moonglowseeds', value: ''},
      {key: 'health', value: 100}
      // {key: 'honeysurface', value: this.honeysurface.join('|')}
    ])

    // sauvegarde des meubles
    // await database.clearObjectStore('furniture')
    // await database.addMultipleRecords('furniture', this.furnitures)
    // this.fillChests()

    // vide l'inventaire, le 'bag' est automatiquement initialisé par RpgInventory
    // les coffres sont initialisés par 'fillChests'
    // await database.clearObjectStore('inventory')
    // await database.addMultipleRecords('inventory', this.inventory)

    console.log('Temps sauvegarde en base de données', window.performance.now() - start)
  }
}
export const worldGenerator = new WorldGenerator()

export class BiomeNaturalizer {
  naturalize (biomesDescription, leftSeaWidth, rightSeaWidth) {
    const {skySurface, surfaceUnder, underCaverns, hell} = this.precomputeHorizontalBoundaries()
    const verticalBoundaries = this.precomputeVerticalBoundaries(biomesDescription)
    console.log('[WorldGenerator] - verticalBoundaries', verticalBoundaries)

    for (let x = 0; x < WORLD_WIDTH; x++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        let code = 0
        // 2.1 protection du périmètre (NODE_TYPE.STRONG)
        if ((x === 0) || (x === 1023)) {
          code = NODES.DEEPSEA.code
          if (y < SEA_LEVEL) code = NODES.FOG.code
          if (y > surfaceUnder[x]) code = NODES.BASALT.code
        }
        if (y === 0) code = NODES.FOG.code
        if (y === 511) code = NODES.LAVA.code

        if (code === 0) {
          code = this.getSubstratCode(x, y, skySurface, surfaceUnder, underCaverns, verticalBoundaries)
          if (y >= hell[x]) code = NODES.LAVA.code
        }
        worldBuffer.write(x, y, code) // NEW
      }
    }

    // ajout de la mer
    const {leftCliff, rightCliff} = this.precomputeCliffs(leftSeaWidth, rightSeaWidth)
    this.applySeaPostProcessing(leftCliff, rightCliff)

    // ajout d'une migration des tuiles aux fromtières
    this.applyWorldMigration(surfaceUnder, underCaverns, verticalBoundaries)
  }

  /**
 * Calcule les lignes de démarcation horizontales avec du bruit
 * @param {number} width Largeur du monde en tuiles
 * @returns {Object} { skySurface, surfaceUnder, underCaverns }
 */

  precomputeHorizontalBoundaries () {
    const skySurface = new Int16Array(1024)
    const surfaceUnder = new Int16Array(1024)
    const underCaverns = new Int16Array(1024)
    const hell = new Int16Array(1024)

    const skySurfaceY = 48
    const surfaceUnderY = 96
    const underCavernsY = 16 * (6 + seededRNG.randomGetMinMax(8, 10))
    const HellY = 512

    for (let x = 0; x < 1024; x++) {
      // les valeurs de Y sont choisies éloignées pour ne pas corréler les lignes
      let noise = seededRNG.randomPerlinScaled(x, 2.8, 30, 15) + seededRNG.randomPerlinScaled(x, 2.8, 10, 5)
      skySurface[x] = skySurfaceY + noise // 3 chunks * 16
      noise = seededRNG.randomPerlinScaled(x, 13.7, 50, 20) + seededRNG.randomPerlinScaled(x, 13.7, 10, 5)
      surfaceUnder[x] = surfaceUnderY + noise // 6 chunks total (3 sky + 6 surface)
      noise = seededRNG.randomPerlinScaled(x, 24.6, 45, 30) + seededRNG.randomPerlinScaled(x, 24.6, 10, 5)
      underCaverns[x] = underCavernsY + noise // + ~20 chunks
      hell[x] = HellY - 5 * seededRNG.randomPerlin(x / 60, 35.2)
    }

    return {skySurface, surfaceUnder, underCaverns, hell}
  }

  precomputeVerticalBoundaries (biomesDescription) {
    const verticalBoundaries = []

    let boundaryCenter = 0
    for (let i = 0; i < biomesDescription.length; i++) {
      const {biome, width} = biomesDescription[i]
      boundaryCenter += width
      const boundary = new Int16Array(512)
      for (let y = 0; y < 512; y++) {
        const noise = seededRNG.randomPerlinScaled(y, 100.2 + boundaryCenter, 30, 15) + seededRNG.randomPerlinScaled(y, 100.2 + boundaryCenter, 10, 5)
        boundary[y] = boundaryCenter + noise
      }
      verticalBoundaries.push({biome, boundary})
    }
    return verticalBoundaries
  }

  getSubstratCode (x, y, skySurface, surfaceUnder, underCaverns, verticalBoundaries) {
  // 1. Détermination du biome
    let biome = verticalBoundaries[verticalBoundaries.length - 1].biome
    for (let i = 0; i < verticalBoundaries.length - 1; i++) {
      if (x < verticalBoundaries[i].boundary[y]) {
        biome = verticalBoundaries[i].biome
        break
      }
    }
    // 2. Détermination de la couche
    let layer = 'caverns'
    if (y < skySurface[x]) layer = 'sky'
    else if (y < surfaceUnder[x]) layer = 'surface'
    else if (y < underCaverns[x]) layer = 'under'

    // 3. Résolution via table d'indirection
    return BIOME_TILE_MAP[biome][layer]
  }

  applyWorldMigration (surfaceUnder, underCaverns, verticalBoundaries) {
    // 1. On récupère les données courantes en tant que source des diffusions
    const source = worldBuffer.snapshot()

    // 2. Diffusions horizontales
    this.applyHorizontalMigration(source, surfaceUnder)
    this.applyHorizontalMigration(source, underCaverns)

    // 3. Diffusions verticales
    for (let i = 0; i < verticalBoundaries.length - 1; i++) {
      this.applyVerticalMigration(source, verticalBoundaries[i].boundary)
    }
  }

  /**
 * Applique la diffusion (migration) pour les frontières verticales
 * @param {Object} vBoundary L'objet {biome, boundary} calculé précédemment
 */
  applyVerticalMigration (source, vBoundary) {
    const maxDistance = 20
    const width = 1024

    for (let y = 0; y < 512; y++) {
      const borderX = vBoundary[y]

      // On récupère les types de tuiles à gauche et à droite de la frontière
      // pour savoir quoi "projeter"
      // const codeLeft = worldData[(y << 10) | (borderX - 1)]
      // const codeRight = worldData[(y << 10) | borderX]
      const index = (y << 10) | borderX
      const codeLeft = source[index - 1]
      const codeRight = source[index]

      // Migration vers la gauche (le code de droite s'infiltre à gauche)
      for (let x = borderX - 1; x >= borderX - maxDistance; x--) {
        if (x < 0) break
        const dist = borderX - x
        const prob = 0.4 * Math.exp(-dist * 0.15)
        if (seededRNG.randomReal() < prob) {
          this.safeSetTile(x, y, codeRight)
        }
      }

      // Migration vers la droite (le code de gauche s'infiltre à droite)
      for (let x = borderX; x < borderX + maxDistance; x++) {
        if (x >= width) break
        const dist = x - borderX
        const prob = 0.4 * Math.exp(-dist * 0.15)
        if (seededRNG.randomReal() < prob) {
          this.safeSetTile(x, y, codeLeft)
        }
      }
    }
  }

  /**
 * Applique la diffusion (migration) pour les frontières horizontales (Layers)
 * @param {Uint8Array} source Le snapshot gelé du monde
 * @param {Int16Array} horizontalBorder Le tableau des altitudes de la frontière
 */
  applyHorizontalMigration (source, horizontalBorder) {
    const maxDistance = 20
    const width = 1024
    const height = 512

    for (let x = 0; x < width; x++) {
      const borderY = horizontalBorder[x]

      // On récupère les codes au-dessus et en-dessous de la frontière dans la source
      // On s'assure que borderY n'est pas aux limites 0 ou height
      if (borderY <= 0 || borderY >= height) continue

      const index = (borderY << 10) | x
      const codeAbove = source[index - 1024] // Tuile (x, y-1)
      const codeBelow = source[index] // Tuile (x, y)

      // Migration vers le haut (le code du bas s'infiltre en haut)
      for (let y = borderY - 1; y >= borderY - maxDistance; y--) {
        if (y < 0) break
        const dist = borderY - y
        const prob = 0.4 * Math.exp(-dist * 0.15)

        if (seededRNG.randomReal() < prob) {
          this.safeSetTile(x, y, codeBelow)
        }
      }

      // Migration vers le bas (le code du haut s'infiltre en bas)
      for (let y = borderY; y < borderY + maxDistance; y++) {
        if (y >= height) break
        const dist = y - borderY
        const prob = 0.4 * Math.exp(-dist * 0.15)

        if (seededRNG.randomReal() < prob) {
          this.safeSetTile(x, y, codeAbove)
        }
      }
    }
  }

  /**
   * Vérifie que la tuile peut être écrasée par la migration
   */
  safeSetTile (x, y, newCode) {
    if (newCode === NODES.VOID.code) return // jamais propager VOID (SEA temporaire)
    const currentType = NODES_LOOKUP[worldBuffer.read(x, y)]?.type ?? 0
    if (currentType & (NODE_TYPE.SUBSTRAT | NODE_TYPE.TOPSOIL | NODE_TYPE.NATURAL)) {
      worldBuffer.write(x, y, newCode)
    }
  }

  /**
 * Prépare les courbes des falaises latérales
 * @param {number} leftSeaWidth Largeur théorique mer gauche (en chunks)
 * @param {number} rightSeaWidth Largeur théorique mer droite (en chunks)
 * @return {Object} { leftCliff, rightCliff } (Int16Array)
 */
  precomputeCliffs (leftSeaWidth, rightSeaWidth) {
    const leftCliff = new Int16Array(SEA_MAX_DEPTH)
    const rightCliff = new Int16Array(SEA_MAX_DEPTH)
    const slopeStep = 0.36397 // 1 / tan(70°)

    // Coordonnées cibles à Y = 70 (conversion chunks -> tuiles)
    const xLeftTarget = leftSeaWidth << 4
    const xRightTarget = 1024 - (rightSeaWidth << 4)

    for (let y = 0; y < SEA_MAX_DEPTH; y++) {
      // Bruit haute fréquence pour l'aspect rocheux
      const leftNoise = seededRNG.randomPerlinScaled(y, 42.5, 18, 8)
      const rightNoise = seededRNG.randomPerlinScaled(y, 252.8, 18, 8)

      // Décalage par rapport au pivot Y=70
      const deltaY = y - 70

      // Falaise gauche : la mer est à gauche, la terre à droite.
      leftCliff[y] = xLeftTarget - (deltaY * slopeStep) + leftNoise

      // Falaise droite : la mer est à droite, la terre à gauche.
      rightCliff[y] = xRightTarget + (deltaY * slopeStep) - rightNoise
    }
    return {leftCliff, rightCliff}
  }

  /**
 * Inonde les zones côtières en remplaçant les tuiles de surface
 * @param {Int16Array} leftCliff, rightCliff
 */
  applySeaPostProcessing (leftCliff, rightCliff) {
    const SKY_CODE = NODES.SKY.code
    const SEA_CODE = NODES.VOID.code
    const SURFACE_CODES = new Set([NODES.CLAY.code, NODES.SANDSTONE.code, NODES.MUD.code
    ])

    for (let y = 1; y < SEA_MAX_DEPTH; y++) { // Environ le milieu de la zone under
      const newCode = (y < SEA_LEVEL) ? SKY_CODE : SEA_CODE
      // 1. Mer Gauche
      // On vérifie si la falaise n'est pas sortie de l'écran à gauche (1)
      if (leftCliff[y] >= 1) {
        const endX = leftCliff[y]
        for (let x = 1; x < endX; x++) {
          const currentTile = worldBuffer.read(x, y)

          // On ne remplace que si c'est une tuile de biome "Surface"
          // (En supposant que tes codes de surface sont identifiables)
          if (SURFACE_CODES.has(currentTile)) {
            worldBuffer.write(x, y, newCode)
          }
        }
      }

      // 2. Mer Droite
      // On vérifie si la falaise n'est pas sortie de l'écran à droite (1023)
      if (rightCliff[y] <= 1023) {
        const startX = rightCliff[y]
        // On part du bord droit (1022 car 1023 est le périmètre DEEPSEA)
        for (let x = 1022; x > startX; x--) {
          const currentTile = worldBuffer.read(x, y)
          if (SURFACE_CODES.has(currentTile)) {
            worldBuffer.write(x, y, newCode)
          }
        }
      }
    }
  }
}
export const biomeNaturalizer = new BiomeNaturalizer()

class BiomesGenerator {
  generate () {
    // 1. Détermination des Mers (Largeurs fixes)
    const leftIsSmall = seededRNG.randomGetBool()
    const leftSeaWidthChunks = leftIsSmall ? 3 : 4
    const rightSeaWidthChunks = leftIsSmall ? 4 : 3

    // 2. Forêt Centrale (6 à 8 chunks)
    const forestWidth = seededRNG.randomGetMinMax(6, 8)

    // 3. Calcul de l'espace restant pour les biomes latéraux
    // On divise le reste du monde (64 - forêt) en deux
    const remainingTotal = 64 - forestWidth
    let leftChunkCount, rightChunkCount
    if (seededRNG.randomGetBool()) {
      leftChunkCount = Math.floor(remainingTotal / 2)
      rightChunkCount = remainingTotal - leftChunkCount
    } else {
      rightChunkCount = Math.floor(remainingTotal / 2)
      leftChunkCount = remainingTotal - rightChunkCount
    }

    // 4. Génération des segments organiques (Desert / Jungle / Forest)
    const leftSegments = this.#generateSideData(leftChunkCount).reverse()
    const rightSegments = this.#generateSideData(rightChunkCount)

    // 5. Assemblage initial (en chunks)
    const all = [
      ...leftSegments,
      {width: forestWidth, type: BIOME_TYPE.FOREST},
      ...rightSegments
    ]

    // 6. Sécurités
    this.#ensureBiomeDiversity(all)
    this.#ensureMinimumWidth(all)

    // 7. Conversion finale en tuiles (biomesDescription)
    let currentOffset = 0
    const biomesDescription = all.map(s => {
      const widthInTiles = s.width * 16
      const segment = {
        biome: s.type,
        width: widthInTiles,
        offset: currentOffset
      }
      currentOffset += widthInTiles
      return segment
    })
    if (currentOffset !== 1024) {
      throw new Error(`[BiomesGenerator] Invalid world width: ${currentOffset} tiles instead of 1024`)
    }

    // 8. Retour des informations à l'appelant
    return {
      biomesDescription,
      leftSeaWidth: leftSeaWidthChunks,
      rightSeaWidth: rightSeaWidthChunks
    }
  }

  #ensureBiomeDiversity (all) {
    const requiredBiomes = [BIOME_TYPE.DESERT, BIOME_TYPE.JUNGLE, BIOME_TYPE.FOREST]

    // 1. Chaque biome doit avoir au moins une zone
    const counts = []
    for (const b of requiredBiomes) { counts[b] = 0 }
    for (const s of all) { counts[s.type]++ }

    for (const type of requiredBiomes) {
      if (counts[type] === 0) {
        // 1.1. Trouver le type ayant le maximum d'occurrences
        const maxType = requiredBiomes.reduce((maxIdx, currType) => {
          return (counts[currType] > counts[maxIdx]) ? currType : maxIdx
        }, requiredBiomes[0])
        // 1. 2. On remplace la première occurrence du biome dominant
        const target = all.find(s => s.type === maxType)
        if (target) {
          target.type = type
          counts[maxType]--
          counts[type]++
        }
      }
    }
  }

  #ensureMinimumWidth (all) {
    // Taille Minimum (Le don de chunk)
    const MIN_W = 3
    for (const s of all) {
      if (s.width < MIN_W) {
        const diff = MIN_W - s.width
        // Sélection du segment le plus large du monde comme donneur
        const donor = all.reduce((prev, curr) => (curr.width > prev.width) ? curr : prev)

        if (donor && donor.width >= (MIN_W + diff)) {
          donor.width -= diff
          s.width += diff
        }
      }
    }
  }

  /**
   * Crée les définitions de zones pour un côté.
   * @returns {Array<{width: number, type: number}>}
   */
  #generateSideData (totalChunks) {
    const zoneCount = seededRNG.randomGetMinMax(3, 4)
    const segments = []

    // Pool alternant : on commence sans FOREST pour forcer le changement à côté du centre
    const available = [BIOME_TYPE.DESERT, BIOME_TYPE.JUNGLE]
    let lastType = BIOME_TYPE.FOREST
    let remaining = totalChunks

    for (let i = 0; i < zoneCount; i++) {
      // const width = (i === zoneCount - 1) ? remaining : Math.floor(totalChunks / zoneCount)
      const width = (i === zoneCount - 1) ? remaining : Math.floor(remaining / (zoneCount - i))

      // Tirage et alternance
      const rollIdx = seededRNG.randomGetMinMax(0, available.length - 1)
      const currentType = available.splice(rollIdx, 1)[0]

      segments.push({width, type: currentType})

      // On remet le type précédent dans le pool pour la prochaine itération
      available.push(lastType)
      lastType = currentType
      remaining -= width
    }
    // application d'un écart pour tailles moins uniformes
    const offsets = this.#generateZeroSumSequence(zoneCount)
    for (let i = 0; i < zoneCount; i++) {
      segments[i].width += offsets[i]
    }
    return segments
  }

  /**
 * Génère une suite de décalages dont la somme est strictement égale à zéro.
 * @param {number} count - Nombre d'éléments (3 ou 4).
 * @returns {number[]}
 */
  #generateZeroSumSequence (count) {
    const offsets = new Array(count)
    let sum = 0

    // On boucle jusqu'à obtenir un dernier chiffre qui reste dans une fourchette acceptable
    // (Sinon le dernier segment pourrait subir une modification trop violente)
    let valid = false
    while (!valid) {
      sum = 0
      for (let i = 0; i < count - 1; i++) {
        const val = seededRNG.randomGetMinMax(-2, 2)
        offsets[i] = val
        sum += val
      }

      const lastVal = -sum
      // On accepte une tolérance un peu plus large pour le dernier (-3 à 3)
      // pour éviter de boucler trop longtemps, tout en restant raisonnable.
      if (lastVal >= -2 && lastVal <= 2) {
        offsets[count - 1] = lastVal
        valid = true
      }
    }

    return offsets
  }
}
export const biomesGenerator = new BiomesGenerator()
