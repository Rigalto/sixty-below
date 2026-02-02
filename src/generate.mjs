import {seededRNG} from './utils.mjs'
import {database} from './database.mjs'
import {WORLD_WIDTH, WORLD_HEIGHT, BIOME_TYPE, NODES, WEATHER_TYPE} from './constant.mjs'
import {chunkManager} from './world.mjs'

/* ====================================================================================================
   CREATION DU MONDE
   ==================================================================================================== */

class WorldGenerator {
  async generate (seed) {
    const t0 = performance.now()
    console.log('[WorldGenerator] - Début avec la graine', seed)
    // 1. On passe le générateur de nombre aléatoire en mode déterminé par la clé
    seededRNG.init(seed)

    // 2. Génération des biomes
    const biomes = biomesdGenerator.generate()
    console.log('[WorldGenerator] - Biomes', biomes, (performance.now() - t0).toFixed(3), 'ms')

    // 2. Génération des zones
    const {skySurface, surfaceUnder, underCaverns} = this.precomputeHorizontalBoundaries()

    for (let x = 0; x < WORLD_WIDTH; x++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        let code = 0
        // 2.1 protection du périmètre (NODE_TYPE.STRONG)
        if ((x === 0) || (x === 1023)) {
          code = NODES.DEEPSEA.code
          if (y < 56) code = NODES.FOG.code
          if (y > 80) code = NODES.BASALT.code
        }
        if (y === 0) code = NODES.FOG.code
        if (y === 511) code = NODES.LAVA.code

        if (code === 0) {
          code = NODES.SKY.code
          if (y === skySurface[x]) code = NODES.HONEY.code
          if (y === surfaceUnder[x]) code = NODES.HONEY.code
          if (y === underCaverns[x]) code = NODES.HONEY.code
        }
        chunkManager.setGenTile(x, y, code)
      }
    }

    // N. Stochage du monde en base de données
    await this.save(seed)

    // N + 1. On repasse le générateur de nombres aléatoires en mode aléatoire
    seededRNG.init()

    console.log('[WorldGenerator] - Terminé en', (performance.now() - t0).toFixed(3), 'ms')
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

    const skySurfaceY = 48
    const surfaceUnderY = 96
    const underCavernsY = 16 * (6 + seededRNG.randomGetMinMax(8, 10))

    for (let x = 0; x < 1024; x++) {
      // les valeurs de Y sont choisies éloignées pour ne pas corréler les lignes
      let noise = seededRNG.randomPerlinScaled(x, 2.8, 30, 15) + seededRNG.randomPerlinScaled(x, 2.8, 10, 5)
      skySurface[x] = skySurfaceY + noise // 3 chunks * 16
      noise = seededRNG.randomPerlinScaled(x, 13.7, 50, 20)
      surfaceUnder[x] = surfaceUnderY + noise // 6 chunks total (3 sky + 6 surface)
      noise = seededRNG.randomPerlinScaled(x, 24.6, 45, 30)
      underCaverns[x] = underCavernsY + noise // + ~20 chunks
    }

    return {skySurface, surfaceUnder, underCaverns}
  }

  async save (seed) {
    const start = window.performance.now()
    // 1. Sauvegarde des tuiles
    await database.clearObjectStore('world_chunks')

    const chunks = chunkManager.processWorldToChunks()
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

class BiomesdGenerator {
  generate () {
    const biomes = new Array(64).fill(BIOME_TYPE.SEA)

    // 1. Mers à auche et à droite
    const leftIsSmall = seededRNG.randomGetBool()
    const leftSeaWidth = leftIsSmall ? 2 : 3
    const rightSeaWidth = leftIsSmall ? 3 : 2

    // Test FOREST (debug)
    for (let i = leftSeaWidth; i < 64 - rightSeaWidth; i++) biomes[i] = 0

    // 2. Forêt centrale
    // 2.1. Taille entre 6 et 10 chunks
    const forestWidth = seededRNG.randomGetMinMax(6, 10)
    // 2.2. Calcul du centre théorique
    const halfForest = Math.floor(31.5 - forestWidth / 2)
    // 2.3. Application du décalage (50% de chance de décaler de 1 vers la droite si forestWidth est pair)
    const offset = (forestWidth % 2 === 0 && seededRNG.randomGetBool() === 1) ? 1 : 0
    const forestStart = halfForest + offset
    const forestEnd = forestStart + forestWidth
    // 2.4. Mémorisation
    for (let i = forestStart; i < forestEnd; i++) {
      biomes[i] = BIOME_TYPE.FOREST
    }
    // console.log('[BiomesdGenerator.generateBiomes]', forestStart, forestEnd, forestWidth)

    // 3. Génération des segments latéraux
    const leftChunkCount = forestStart - leftSeaWidth
    const rightChunkCount = (64 - rightSeaWidth) - forestEnd

    const leftData = this.#generateSideData(leftChunkCount)
    const rightData = this.#generateSideData(rightChunkCount).reverse()

    // 4. Application et Post-traitement
    this.#applySegments(biomes, leftData, leftSeaWidth)
    this.#applySegments(biomes, rightData, forestEnd)

    this.#ensureBiomeDiversity(biomes, leftSeaWidth, 64 - rightSeaWidth)

    return biomes
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
      const width = (i === zoneCount - 1) ? remaining : Math.floor(totalChunks / zoneCount)

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
   * Copie les segments calculés dans le tableau principal.
   */
  #applySegments (targetArray, segments, startOffset) {
    let cursor = startOffset
    for (const seg of segments) {
      for (let i = 0; i < seg.width; i++) {
        targetArray[cursor++] = seg.type
      }
    }
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

  /**
   * Post-traitement : vérifie la présence de tous les biomes obligatoires.
   */
  #ensureBiomeDiversity (biomes, start, end) {
    const required = [BIOME_TYPE.DESERT, BIOME_TYPE.JUNGLE, BIOME_TYPE.FOREST]
    const counts = new Map()

    // Comptage
    for (let i = start; i < end; i++) {
      counts.set(biomes[i], (counts.get(biomes[i]) || 0) + 1)
    }

    for (const type of required) {
      if (!counts.has(type) || counts.get(type) === 0) {
        // Trouver le biome le plus représenté pour le remplacer
        let maxType = -1
        let maxVal = -1
        counts.forEach((val, key) => {
          if (val > maxVal) { maxVal = val; maxType = key }
        })

        // Remplacement de la première occurrence trouvée du biome majoritaire
        for (let i = start; i < end; i++) {
          if (biomes[i] === maxType) {
            biomes[i] = type
            break
          }
        }
      }
    }
  }
}
export const biomesdGenerator = new BiomesdGenerator()
