import {seededRNG} from './utils.mjs'
import {database} from './database.mjs'
import {NODES, NODES_LOOKUP, NODE_TYPE, WEATHER_TYPE, BIOME_TYPE, WORLD_WIDTH, WORLD_HEIGHT, SEA_LEVEL, TOPSOIL_Y_SKY_SURFACE, TOPSOIL_Y_SURFACE_UNDER, TOPSOIL_Y_UNDER_CAVERNS, TOPSOIL_Y_CAVERNS_MID, BIOME_TILE_MAP, SEA_MAX_JITTER, SEA_MAX_WIDTH, SEA_MAX_HEIGHT, CLUSTER_SCATTER_MAP, ORE_GEM_SCATTER_MAP, PERLIN_OFFSET_NATURALIZER, PERLIN_OFFSET_TUNNEL, PERLIN_OFFSET_SURFACE_TUNNEL, PERLIN_OFFSET_SMALL_TUNNEL, PERLIN_OFFSET_CAVERN, PERLIN_OFFSET_HIVE, PERLIN_OFFSET_COBWEB, SMALL_CAVERNS_COUNT, MEDIUM_CAVERNS_COUNT, UNDERGROUND_TUNNEL_COUNT, CAVERNS_TUNNEL_COUNT, SMALL_TUNNELS_COUNT, HIVE_RADIUS_MIN, HIVE_RADIUS_MAX, COBWEB_CAVE_COUNT_MIN, COBWEB_CAVE_COUNT_MAX, COBWEB_RADIUS_X_MIN, COBWEB_RADIUS_X_MAX, COBWEB_RADIUS_Y_MIN, COBWEB_RADIUS_Y_MAX, GEODE_CAVE_COUNT_MIN, GEODE_CAVE_COUNT_MAX, GEODE_RADIUS_MIN, GEODE_RADIUS_MAX, GEODE_TARGET_CLUSTER_COUNT, GEODE_CLUSTER_SIZE_MIN, GEODE_CLUSTER_SIZE_MAX, TOPSOIL_SCATTER_MAP} from '../assets/data/data-gen.mjs'

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

  /**
   * Comptabilise toutes les tuiles du buffer par node, groupées par type.
   * Usage diagnostic uniquement — appelée en fin de génération avant clear().
   * Affiche les résultats dans la console via console.log.
   */
  logStats () {
    const counts = new Map()
    const data = this.#data

    for (let i = 0; i < data.length; i++) {
      const code = data[i]
      counts.set(code, (counts.get(code) ?? 0) + 1)
    }

    const groups = {
      ETERNAL: [],
      GAZ: [],
      LIQUID: [],
      SUBSTRAT: [],
      TOPSOIL: [],
      NATURAL: [],
      ORE: [],
      GEM: [],
      ROCK: [],
      OTHER: []
    }

    for (const [code, count] of counts) {
      const node = NODES_LOOKUP[code]
      if (!node) continue
      const t = node.type ?? 0
      let group
      if (t & NODE_TYPE.ETERNAL) group = groups.ETERNAL
      else if (t & NODE_TYPE.ORE) group = groups.ORE
      else if (t & NODE_TYPE.GEM) group = groups.GEM
      else if (t & NODE_TYPE.ROCK) group = groups.ROCK
      else if (t & NODE_TYPE.SUBSTRAT) group = groups.SUBSTRAT
      else if (t & NODE_TYPE.TOPSOIL) group = groups.TOPSOIL
      else if (t & NODE_TYPE.NATURAL) group = groups.NATURAL
      else if (t & NODE_TYPE.LIQUID) group = groups.LIQUID
      else if (t & NODE_TYPE.GAZ) group = groups.GAZ
      else group = groups.OTHER
      group.push({name: node.name, count, pct: (count / data.length * 100).toFixed(2)})
    }

    for (const group of Object.values(groups)) {
      group.sort((a, b) => b.count - a.count)
    }

    const lines = []
    for (const [label, group] of Object.entries(groups)) {
      if (group.length === 0) continue
      lines.push(`── ${label}`)
      for (const {name, count, pct} of group) {
        lines.push(`   ${name.padEnd(20)} ${String(count).padStart(8)}  (${pct}%)`)
      }
    }
    console.log('[WorldBuffer::logStats]\n' + lines.join('\n'))
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

    // affichage de la progression de la création dans le dialogue modal
    const STEPS = 12
    let step = 0
    const progress = (topic) => {
      step++
      window.dispatchEvent(new CustomEvent('world-generation-progress', {
        detail: {passed: step, total: STEPS, topic}
      }))
      return new Promise(resolve => setTimeout(resolve, 0))
    }

    // 0. Initialisation du buffer de génération
    worldBuffer.init()

    // 1. On passe le générateur de nombre aléatoire en mode déterminé par la clé
    seededRNG.init(seed)

    // 2. Génération des biomes (rectangles)
    const {biomesDescription, leftSeaWidth, rightSeaWidth, biomeCounts} = biomesGenerator.generate()
    console.log('[WorldGenerator::biomesDescription] - Biomes', biomesDescription, leftSeaWidth, rightSeaWidth, (performance.now() - t0).toFixed(3), 'ms')
    await progress('Biome generation')

    // 3. Rafinement des biomes (Perlin + diffusion)
    const {skySurface, surfaceUnder, underCaverns} = biomeNaturalizer.naturalize(biomesDescription, leftSeaWidth, rightSeaWidth)
    console.log('[WorldGenerator::biomeNaturalizer] - Biomes', (performance.now() - t0).toFixed(3), 'ms')
    await progress('Biome naturalization')

    // 4. Clusters de substrat
    const zoneRects = clusterGenerator.initZoneRects(biomesDescription, skySurface, surfaceUnder, underCaverns)
    worldCarver.initZoneRects(zoneRects)

    clusterGenerator.addSubstratClusters()
    console.log('[WorldGenerator::clusterGenerator] - Substrat clusters', (performance.now() - t0).toFixed(3), 'ms')
    await progress('Substrate placement')

    // 5. Clusters ore/gem/obsidian (TODO : obsidian)
    clusterGenerator.addOreClusters()
    clusterGenerator.addOreIntrusions()
    clusterGenerator.addGemIntrusions()
    clusterGenerator.addTopsoilClusters()
    console.log('[WorldGenerator::clusterGenerator] - Ore/Gem clusters', (performance.now() - t0).toFixed(3), 'ms')
    await progress('Ore & gem placement')

    // 6. Creusement (plus de creusement ensuite, ou alors très localisé) - TODO

    // 6.1 Creusement des tunnels et cavernes
    worldCarver.initExclusions()
    // worldCarver.digSurfaceTunnel(skySurface)
    // const zigzagCount = seededRNG.randomGetMinMax(2, 3)
    // for (let i = 0; i < zigzagCount; i++) { worldCarver.digZigzagTunnel() }
    // await progress('Surface tunnels')
    // worldCarver.digSmallCaverns(surfaceUnder)
    // await progress('Caverns')
    // worldCarver.digUndergroundTunnels(surfaceUnder, underCaverns)
    // worldCarver.digCavernsTunnels(underCaverns)
    // await progress('Deep tunnels')
    // worldCarver.digSmallTunnels(surfaceUnder)
    // await progress('Small tunnels')

    // A supprimer
    // worldCarver.debugTraceTunnel()

    // 6.2 Creusement des mini-biomes avec peuplement - TODO

    // 6.3 Creusement des mini-biomes avec peuplement différé - TODO

    // 6.3.1 HIVE caves
    const hives = worldCarver.digHives(biomeCounts)
    await progress('Hives')

    // 6.3.2 Cobweb caves
    const cobwebCaves = worldCarver.digCobwebCaves()
    await progress('Cobweb caves')

    // 6.3.3 Marble caves et  Granite caves
    const graniteCaves = worldCarver.digGeodeCaves(NODES.GRANITE.code)
    const marbleCaves = worldCarver.digGeodeCaves(NODES.MARBLE.code)
    const geodeCaves = graniteCaves.concat(marbleCaves)
    await progress('Geode caves')

    // 6.3.X Mushroom caves
    // const mushroomCaves = worldCarver.digMushroomCaves()

    // 6.3.X Anthill
    // const anthills = worldCarver.digAnthills()

    // 6.3.X Termite Mound
    // const termites = worldCarver.digTermiteMounds()

    // 6.3.X Antilion Pit
    // const antilions = worldCarver.digAntilionPits()

    // 6.3.X Fern Caves
    // Under, forest
    // const ferns = worldCarver.digFernCaves()

    // 6.3.X Pyramid
    // le cy est tiré entre rect.yUnder et rect.yCavernsMid
    // const pyramids = worldCarver.digPyramids()

    // 6.3.X Sap Pokets
    // Caverns_bottom, jungle - ressemble à Hive - Utiliser SAPROCK pour la paroi (demi-cercle bas uniquement)
    // const sappockets = worldCarver.digSapPockets()

    // 6.3.X Ancient House / Temple Ruin / Ruined Cabin
    // Caverns_top, jungle - EMERALDWALL -
    // const ancienthouse = worldCarver.digAncientHouse()
    // Caverns_bottom, desert - GOLDWALL -
    // const templeruin = worldCarver.digTempleRuin()
    // Under, forest - STONEWALL -
    // const ruinedcabin = worldCarver.digRuinedCabin()

    // 6.3.X Fossil Vein
    // caverns_top - desert - SHELL
    // const fossilvein = worldCarver.digFossilVein()

    // 6.3.X Moss Cave
    // underground - jungle - MUD + HUMUS
    // const mosscave = worldCarver.digMossCave()

    // 6.3.X Underground Lake
    // caverns_top - Forest - WATER + HUMUS
    // const undergroundlake = worldCarver.digUndergroundLake()

    // 7. Traitement des surfaces végétales + désert - TODO

    // 7.1. Erosion naturelle (on rend la surface plus lisse)

    // 7.2. Ajout des topsoils / natural (forêt et jungle)

    // 7.3. Ajout du sable (désert) - écoulement et consolidation des tunnels/cavernes

    // N-7 Remplissage de la mer (gauche et droite)
    liquidFiller.fillSea()
    worldCarver.cleanupAfterCarving() // 85774
    await progress('Carving Cleanup')

    console.log('[WorldGenerator::liquidFiller] - Sea', (performance.now() - t0).toFixed(3), 'ms')

    // N-6 Ajout de la plage (Shore) et du fond de la mer - TODO

    // N-5 Ajout des plantes et des coraux - TODO

    // N-4 Peuplement des biomes qui sont à peuplement différé - TODO

    for (const cave of geodeCaves) { clusterGenerator.projectAndFill(cave) }

    // N-3. Ajout des coffres et objets spéciaux - TODO

    // N-2. Nettoyage final (tuiles isolées) - TODO

    // N-1 Affichage de statistiques)
    worldBuffer.logStats()

    // N. Stochage du monde en base de données
    if (!debug) {
      await this.save(seed, {hives, cobwebCaves, geodeCaves})
      worldBuffer.clear()
    }

    // N + 1. On repasse le générateur de nombres aléatoires en mode aléatoire
    seededRNG.init()

    console.log('[WorldGenerator] - Terminé en', (performance.now() - t0).toFixed(3), 'ms')
    if (debug) { return worldBuffer } // appelant responsable du clear()
  }

  async save (seed, {hives, cobwebCaves, geodeCaves}) {
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
      {key: 'health', value: 100},
      {key: 'hives', value: JSON.stringify(hives)},
      {key: 'cobwebcaves', value: JSON.stringify(cobwebCaves)},
      {key: 'geodecaves', value: JSON.stringify(geodeCaves)}

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

/* ====================================================================================================
   DECOUPE LE MONDE EN BIOMES
   ==================================================================================================== */

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

    // 9. Retour des informations à l'appelant
    return {
      biomesDescription,
      leftSeaWidth: leftSeaWidthChunks,
      rightSeaWidth: rightSeaWidthChunks,
      biomeCounts: this.countBiomes(biomesDescription)
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

  /**
 * Comptabilise le nombre de zones par type de biome.
 *
 * @param {Array<{biome, width}>} biomesDescription
 * @returns {{forest: number, desert: number, jungle: number}}
 */
  countBiomes (biomesDescription) {
    const counts = {forest: 0, desert: 0, jungle: 0}
    for (let i = 0; i < biomesDescription.length; i++) {
      const {biome} = biomesDescription[i]
      if (biome === BIOME_TYPE.FOREST) counts.forest++
      else if (biome === BIOME_TYPE.DESERT) counts.desert++
      else if (biome === BIOME_TYPE.JUNGLE) counts.jungle++
    }
    return counts
  }
}
export const biomesGenerator = new BiomesGenerator()

/* ====================================================================================================
   REND LA SEPARATION DES BIOMES PLUS NATURELLE
   ==================================================================================================== */

export class BiomeNaturalizer {
  naturalize (biomesDescription, leftSeaWidth, rightSeaWidth) {
    const {skySurface, surfaceUnder, underCaverns, hell} = this.precomputeHorizontalBoundaries()
    const verticalBoundaries = this.precomputeVerticalBoundaries(biomesDescription)
    // console.log('[WorldGenerator] - verticalBoundaries', verticalBoundaries)

    for (let x = 0; x < WORLD_WIDTH; x++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        let code = 0
        // 2.1 protection du périmètre (NODE_TYPE.STRONG)
        if ((x === 0) || (x === (WORLD_WIDTH - 1))) {
          code = NODES.DEEPSEA.code
          if (y < SEA_LEVEL) code = NODES.FOG.code
          if (y > surfaceUnder[x]) code = NODES.BASALT.code
        }
        if (y === 0) code = NODES.FOG.code
        if (y === (WORLD_HEIGHT - 1)) code = NODES.LAVA.code

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

    return {skySurface, surfaceUnder, underCaverns}
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

    const skySurfaceY = TOPSOIL_Y_SKY_SURFACE
    const surfaceUnderY = TOPSOIL_Y_SURFACE_UNDER
    const underCavernsY = TOPSOIL_Y_UNDER_CAVERNS + 16 * (seededRNG.randomGetMinMax(0, 2) - 1)
    const HellY = WORLD_HEIGHT

    for (let x = 0; x < 1024; x++) {
      // les valeurs de Y sont choisies éloignées pour ne pas corréler les lignes
      let noise = seededRNG.randomPerlinScaled(x + PERLIN_OFFSET_NATURALIZER, 2.8, 30, 15) + seededRNG.randomPerlinScaled(x + PERLIN_OFFSET_NATURALIZER, 2.8, 10, 5)
      skySurface[x] = skySurfaceY + noise // 3 chunks * 16
      noise = seededRNG.randomPerlinScaled(x + PERLIN_OFFSET_NATURALIZER, 13.7, 50, 20) + seededRNG.randomPerlinScaled(x + PERLIN_OFFSET_NATURALIZER, 13.7, 10, 5)
      surfaceUnder[x] = surfaceUnderY + noise // 6 chunks total (3 sky + 6 surface)
      noise = seededRNG.randomPerlinScaled(x + PERLIN_OFFSET_NATURALIZER, 24.6, 45, 30) + seededRNG.randomPerlinScaled(x + PERLIN_OFFSET_NATURALIZER, 24.6, 10, 5)
      underCaverns[x] = underCavernsY + noise // + ~20 chunks
      hell[x] = HellY - 5 * seededRNG.randomPerlin((x + PERLIN_OFFSET_NATURALIZER) / 60, 35.2)
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
        const noise = seededRNG.randomPerlinScaled(y + PERLIN_OFFSET_NATURALIZER, 100.2 + boundaryCenter, 30, 15) + seededRNG.randomPerlinScaled(y + PERLIN_OFFSET_NATURALIZER, 100.2 + boundaryCenter, 10, 5)
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
    if (newCode === NODES.SKY.code) return // jamais propager SKY

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
      const leftNoise = seededRNG.randomPerlinScaled(y + PERLIN_OFFSET_NATURALIZER, 42.5, 18, 8)
      const rightNoise = seededRNG.randomPerlinScaled(y + PERLIN_OFFSET_NATURALIZER, 252.8, 18, 8)

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
    const SURFACE_CODES = new Set([NODES.CLAY.code, NODES.SANDSTONE.code, NODES.MUD.code, NODES.SKY.code
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

/* ====================================================================================================
   AJOUT DES LIQUIDES DANS LE MONDE
   ==================================================================================================== */

class LiquidFiller {
  fillSea () {
    const jitterLeft = seededRNG.randomGetMax(SEA_MAX_JITTER)
    const jitterRight = seededRNG.randomGetMax(SEA_MAX_JITTER)
    const jitterHeight = seededRNG.randomGetMax(SEA_MAX_JITTER)
    const maxY = SEA_LEVEL + SEA_MAX_HEIGHT + jitterHeight

    this.#fillOneSea(SEA_LEVEL << 10, true, SEA_MAX_WIDTH + jitterLeft, maxY)
    this.#fillOneSea((SEA_LEVEL << 10) | 1023, false, SEA_MAX_WIDTH + jitterRight, maxY)
  }

  #fillOneSea (src, isLeft, maxWidth, maxY) {
    const maxIndexTop = SEA_LEVEL * 1024 - 1
    const xLimit = isLeft ? maxWidth : 1023 - maxWidth

    const VOID_CODE = NODES.VOID.code
    const SEA_CODE = NODES.SEA.code
    const SANDSTONE_CODE = NODES.SANDSTONE.code

    const visited = new Set()
    const queue = []
    let head = 0

    const enqueue = (idx) => {
      if (visited.has(idx)) return
      visited.add(idx)
      queue.push(idx)
    }

    visited.add(src)
    queue.push(src)

    while (head < queue.length) {
      const idx = queue[head++]
      const neighbors = [idx - 1, idx + 1, idx - 1024, idx + 1024]

      for (let i = 0; i < 4; i++) {
        const nIdx = neighbors[i]
        if (visited.has(nIdx)) continue

        // Limite haute
        if (nIdx <= maxIndexTop) continue

        const nx = nIdx & 0x3FF
        const ny = nIdx >> 10

        // Ghost cells
        if (nx === 0 || nx === 1023 || ny === 0 || ny === 511) continue

        // Limite basse
        if (ny > maxY) continue

        const tileCode = worldBuffer.readAt(nIdx)
        if (tileCode !== VOID_CODE) continue

        // Limite X — rebouchage éventuel
        const atLimit = isLeft ? nx >= xLimit : nx <= xLimit
        if (atLimit) {
          const dir = nIdx - idx
          const ahead1 = nIdx + dir
          const ahead2 = ahead1 + dir
          if (worldBuffer.readAt(ahead1) === VOID_CODE && worldBuffer.readAt(ahead2) === VOID_CODE) {
            worldBuffer.writeAt(nIdx, SANDSTONE_CODE)
            worldBuffer.writeAt(ahead1, SANDSTONE_CODE)
            visited.add(nIdx)
            continue
          }
        }

        worldBuffer.writeAt(nIdx, SEA_CODE)
        enqueue(nIdx)
      }
    }
  }
}

export const liquidFiller = new LiquidFiller()

/* ====================================================================================================
   AJOUT DES CLUSTERS DE MATERIAUX DANS LE MONDE
   ==================================================================================================== */

class ClusterGenerator {
  /**
   * Génère un cluster organique par diffusion aléatoire (drunk-walk agrégé 4-connexe).
   *
   * @param {number} x0    - X de la tuile de départ
   * @param {number} y0    - Y de la tuile de départ
   * @param {number} size  - Nombre de tuiles cibles
   * @param {number} code  - Code de node (ex: NODES.DIRT.code)
   * @returns {Array<{x: number, y: number, index: number, code: number}>}
   */
  randomWalkCluster (x0, y0, size, code) {
    const GEODE_ALLOWED = NODE_TYPE.SUBSTRAT | NODE_TYPE.ORE | NODE_TYPE.GEM
    const geode = code === NODES.MARBLE.code || code === NODES.GRANITE.code
    const chosen = new Set()
    const fringeSet = new Set()
    const fringeArr = []

    const seed = (y0 << 10) | x0
    chosen.add(seed)
    this.#pushNeighbors(x0, y0, chosen, fringeSet, fringeArr)

    while (chosen.size < size && fringeArr.length > 0) {
      const idx = seededRNG.randomGetMax(fringeArr.length - 1)
      const key = fringeArr[idx]

      fringeArr[idx] = fringeArr[fringeArr.length - 1]
      fringeArr.pop()
      fringeSet.delete(key)

      if (geode) {
        const node = NODES_LOOKUP[worldBuffer.readAt(key)]
        if (!node || !(node.type & GEODE_ALLOWED)) continue
      }

      chosen.add(key)
      this.#pushNeighbors(key & 0x3FF, key >> 10, chosen, fringeSet, fringeArr)
    }

    const result = []
    for (const key of chosen) {
      result.push({x: key & 0x3FF, y: key >> 10, index: key, code})
    }
    return result
  }

  #pushNeighbors (x, y, chosen, fringeSet, fringeArr) {
    if (y > 1) {
      const k = ((y - 1) << 10) | x
      if (!chosen.has(k) && !fringeSet.has(k)) { fringeSet.add(k); fringeArr.push(k) }
    }
    if (y < 510) {
      const k = ((y + 1) << 10) | x
      if (!chosen.has(k) && !fringeSet.has(k)) { fringeSet.add(k); fringeArr.push(k) }
    }
    if (x > 1) {
      const k = (y << 10) | (x - 1)
      if (!chosen.has(k) && !fringeSet.has(k)) { fringeSet.add(k); fringeArr.push(k) }
    }
    if (x < 1022) {
      const k = (y << 10) | (x + 1)
      if (!chosen.has(k) && !fringeSet.has(k)) { fringeSet.add(k); fringeArr.push(k) }
    }
  }

  /**
 * Cluster 4-connexe par diffusion aléatoire, contraint aux tuiles SUBSTRAT, ORE et GEM.
 * Contourne les autres types (VOID, LIQUID, SKY, ETERNAL, etc.).
 * Utilisé par projectAndFill pour les parois de géodes.
 *
 * @param {number} x0   - X de départ
 * @param {number} y0   - Y de départ
 * @param {number} size - Nombre de tuiles cible
 * @param {number} code - Code du matériau (GRANITE ou MARBLE)
 * @returns {Array<{x, y, index, code}>}
 */
  randomWalkGeodeCluster (x0, y0, size, code) {
    const ALLOWED = NODE_TYPE.SUBSTRAT | NODE_TYPE.ORE | NODE_TYPE.GEM
    const visited = new Set()
    const frontier = []
    const result = []

    const startIndex = (y0 << 10) | x0
    const startNode = NODES_LOOKUP[worldBuffer.readAt(startIndex)]
    if (!startNode || !(startNode.type & ALLOWED)) return result

    visited.add(startIndex)
    frontier.push({x: x0, y: y0, index: startIndex})

    while (result.length < size && frontier.length > 0) {
      const pick = seededRNG.randomGetMinMax(0, frontier.length - 1)
      const {x, y, index} = frontier[pick]
      frontier[pick] = frontier[frontier.length - 1]
      frontier.pop()

      result.push({x, y, index, code})

      const neighbors = [
        {x, y: y - 1, index: ((y - 1) << 10) | x},
        {x, y: y + 1, index: ((y + 1) << 10) | x},
        {x: x - 1, y, index: (y << 10) | (x - 1)},
        {x: x + 1, y, index: (y << 10) | (x + 1)}
      ]

      for (let i = 0; i < neighbors.length; i++) {
        const n = neighbors[i]
        if (n.x <= 1 || n.x >= WORLD_WIDTH - 2) continue
        if (n.y <= 1 || n.y >= WORLD_HEIGHT - 2) continue
        if (visited.has(n.index)) continue
        const node = NODES_LOOKUP[worldBuffer.readAt(n.index)]
        if (!node || !(node.type & ALLOWED)) continue
        visited.add(n.index)
        frontier.push(n)
      }
    }

    return result
  }

  /**
   * Distribue des clusters aléatoires dans un rectangle du monde.
   * Le nombre de clusters est proportionnel à la surface du rectangle.
   *
   * @param {number} x0       - X gauche du rectangle (inclus)
   * @param {number} y0       - Y haut du rectangle (inclus)
   * @param {number} x1       - X droit du rectangle (inclus)
   * @param {number} y1       - Y bas du rectangle (inclus)
   * @param {number} percent  - Densité : fraction de la surface couverte en clusters
   * @param {number} code     - Code de node à appliquer
   * @param {number} sizeMin  - Taille minimale d'un cluster (défaut : 5)
   * @param {number} sizeMax  - Taille maximale d'un cluster (défaut : 8)
   * @returns {Array<{x: number, y: number, index: number, code: number}>}
   */
  scatterClusters (x0, y0, x1, y1, percent, code, sizeMin = 5, sizeMax = 8) {
    const surface = (x1 - x0) * (y1 - y0)
    const count = Math.max(1, Math.round(surface * percent))
    const result = []

    for (let i = 0; i < count; i++) {
      const x = seededRNG.randomGetMinMax(x0, x1)
      const y = seededRNG.randomGetMinMax(y0, y1)
      const size = seededRNG.randomGetMinMax(sizeMin, sizeMax)
      const cluster = this.randomWalkCluster(x, y, size, code)
      for (const tile of cluster) { result.push(tile) }
    }

    return result
  }

  /**
   * Applique une liste de tuiles calculées par scatterClusters/randomWalkCluster
   * dans le worldBuffer, en respectant les protections suivantes :
   *   - Bounds checking strict (ghost cells comprises)
   *   - Tuiles ETERNAL (FOG, DEEPSEA, BASALT, LAVA) jamais écrasées
   *   - VOID protégé à la place de SEA (pas encore de mer à ce stade — creusement postérieur)
   *   - SKY jamais écrasé
   *
   * @param {Array<{x: number, y: number, index: number, code: number}>} tiles
   */
  applyTiles (tiles) {
    const PROTECTED = new Set([
      NODES.FOG.code,
      NODES.DEEPSEA.code,
      NODES.BASALT.code,
      NODES.LAVA.code,
      NODES.SKY.code,
      NODES.VOID.code
    ])

    for (const tile of tiles) {
      if (tile.x < 0 || tile.x >= WORLD_WIDTH) continue
      if (tile.y < 0 || tile.y >= WORLD_HEIGHT) continue
      if (PROTECTED.has(worldBuffer.readAt(tile.index))) continue
      worldBuffer.write(tile.x, tile.y, tile.code)
    }
  }

  /**
 * Pré-calcule les rectangles biome × layer pour toutes les fonctions de placement.
 * Chaque zone biome est aplatie en frontières Y moyennes, ce qui permet
 * à toutes les fonctions downstream de travailler avec de simples rectangles.
 *
 * @param {Array<{biome, width, offset}>} biomesDescription
 * @param {Int16Array}                    skySurface
 * @param {Int16Array}                    surfaceUnder
 * @param {Int16Array}                    underCaverns
 * @returns {Array<{
 *   biome:        number,
 *   x0:           number,
 *   x1:           number,
 *   ySkySurface:  number,
 *   ySurface:     number,
 *   yUnder:       number,
 *   yCavernsMid:  number,
 *   yCaverns:     number,
 *   yHell:        number
 * }>}
 */
  initZoneRects (biomesDescription, skySurface, surfaceUnder, underCaverns) {
    const yCaverns = WORLD_HEIGHT - 1
    const yHell = WORLD_HEIGHT - 80
    const rects = []

    for (let i = 0; i < biomesDescription.length; i++) {
      const zone = biomesDescription[i]
      const x0 = zone.offset
      const x1 = zone.offset + zone.width - 1
      const width = x1 - x0 + 1

      let sumSky = 0
      let sumSurface = 0
      let sumUnder = 0
      for (let x = x0; x <= x1; x++) {
        sumSky += skySurface[x]
        sumSurface += surfaceUnder[x]
        sumUnder += underCaverns[x]
      }

      const ySkySurface = Math.round(sumSky / width)
      const ySurface = Math.round(sumSurface / width)
      const yUnder = Math.round(sumUnder / width)
      const yCavernsMid = (yUnder + yCaverns) >> 1

      rects.push({biome: zone.biome, x0, x1, ySkySurface, ySurface, yUnder, yCavernsMid, yCaverns, yHell})
    }
    this.zoneRects = rects
    return rects
  }

  /**
 * Retourne les tailles d'un cluster depuis ORE_GEM_SCATTER_MAP.
 * @param {number} biome  - Biome de référence (ex: BIOME_TYPE.FOREST)
 * @param {string} layer  - Layer de référence (ex: 'caverns_top')
 * @param {number} code   - Code du node cherché
 * @returns {{sizeMin: number, sizeMax: number}}
 */
  #getClusterSizes (biome, layer, code) {
    const entries = ORE_GEM_SCATTER_MAP[biome]?.[layer]
    if (entries) {
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].code === code) return {sizeMin: entries[i].sizeMin, sizeMax: entries[i].sizeMax}
      }
    }
    return {sizeMin: 6, sizeMax: 12}
  }

  /**
 * Place un unique cluster à une position aléatoire dans le rectangle donné.
 * @param {number} x0
 * @param {number} x1
 * @param {number} y0
 * @param {number} y1
 * @param {number} code
 * @param {number} sizeMin
 * @param {number} sizeMax
 */
  #placeOneCluster (x0, x1, y0, y1, code, sizeMin, sizeMax) {
    const x = seededRNG.randomGetMinMax(x0, x1)
    const y = seededRNG.randomGetMinMax(y0, y1)
    const size = seededRNG.randomGetMinMax(sizeMin, sizeMax)
    this.applyTiles(this.randomWalkCluster(x, y, size, code))
    console.log(`[GemIntrusion] ${code} — x:${x} y:${y} size:${size}`)
  }

  /**
 * Retourne les zones dont le biome est différent de nativeBiome.
 * @param {number} nativeBiome
 * @returns {Array}
 */
  #getForeignZones (nativeBiome) {
    const result = []
    for (let i = 0; i < this.zoneRects.length; i++) {
      if (this.zoneRects[i].biome !== nativeBiome) result.push(this.zoneRects[i])
    }
    return result
  }

  /**
   * Parcourt tous les rectangles biome × layer et applique les clusters
   * de substrat définis dans CLUSTER_SCATTER_MAP.
   * La layer caverns est découpée en deux moitiés verticales (top/bottom).
   * Les frontières sont utilisées brutes — les débordements inter-zones
   * renforcent le caractère naturel du résultat.
   *
   * @param {Array<{biome, width, offset}>}         biomesDescription   - Zones horizontales
   * @param {Int16Array}                             skySurface          - Frontière sky/surface
   * @param {Int16Array}                             surfaceUnder        - Frontière surface/under
   * @param {Int16Array}                             underCaverns        - Frontière under/caverns
   */
  addSubstratClusters () {
    for (const rect of this.zoneRects) {
      const map = CLUSTER_SCATTER_MAP[rect.biome]
      if (!map) continue
      this.#scatterLayer(rect.x0, rect.ySkySurface, rect.x1, rect.ySurface, map.surface)
      this.#scatterLayer(rect.x0, rect.ySurface, rect.x1, rect.yUnder, map.under)
      this.#scatterLayer(rect.x0, rect.yUnder, rect.x1, rect.yCavernsMid, map.caverns_top)
      this.#scatterLayer(rect.x0, rect.yCavernsMid, rect.x1, rect.yCaverns, map.caverns_bottom)
    }
  }

  /**
   * @param {number}   x0
   * @param {number}   y0
   * @param {number}   x1
   * @param {number}   y1
   * @param {Array<{code, percent}>} entries
   */
  #scatterLayer (x0, y0, x1, y1, entries) {
    for (const entry of entries) {
      const tiles = this.scatterClusters(x0, y0, x1, y1, entry.percent, entry.code, entry.sizeMin, entry.sizeMax)

      this.applyTiles(tiles)
    }
  }

  /**
   * Parcourt tous les rectangles biome × layer (under / caverns_top / caverns_bottom)
   * et applique les clusters ore/gem définis dans ORE_GEM_SCATTER_MAP.
   * Les ores écrasent le substrat — VOID/FOG/DEEPSEA/BASALT/LAVA seuls protégés.
   * Pas de clusters en surface (ores absents de cette layer).
   *
   * @param {Array<{biome, width, offset}>} biomesDescription
   * @param {Int16Array}                    surfaceUnder   - Frontière surface/under
   * @param {Int16Array}                    underCaverns   - Frontière under/caverns
   */
  addOreClusters () {
    for (const rect of this.zoneRects) {
      const map = ORE_GEM_SCATTER_MAP[rect.biome]
      if (!map) continue
      this.#scatterLayer(rect.x0, rect.ySkySurface, rect.x1, rect.ySurface, map.surface, rect.biome, 'surface')
      this.#scatterLayer(rect.x0, rect.ySurface, rect.x1, rect.yUnder, map.under, rect.biome, 'under')
      this.#scatterLayer(rect.x0, rect.yUnder, rect.x1, rect.yCavernsMid, map.caverns_top, rect.biome, 'caverns_top')
      this.#scatterLayer(rect.x0, rect.yCavernsMid, rect.x1, rect.yCaverns, map.caverns_bottom, rect.biome, 'caverns_bottom')
      this.#scatterLayer(rect.x0, rect.yHell, rect.x1, rect.yCaverns, map.hell, rect.biome, 'hell')
    }
  }

  /**
 * Place des clusters de minerais métalliques dans des layers supérieures à leur
 * habitat normal (remontées géologiques).
 * Le biome hôte est ignoré — position X libre sur toute la largeur du monde.
 *
 * Règles :
 *   - SILVER    : 3-5 clusters en surface
 *   - GOLD      : 0-3 clusters en surface, 4-8 clusters en under
 *   - COBALT    : 3-7 clusters en under
 *   - PLATINUM  : 0-3 clusters en under, 3-7 clusters en caverns_top
 *
 * Prérequis : this.zoneRects initialisé par initZoneRects()
 */
  addOreIntrusions () {
  // Place count clusters d'un ore dans une layer donnée, X libre sur tout le monde.
  // y0/y1 sont calculés en moyennant les frontières sur toute la largeur.
    const placeInLayer = (count, code, sizeMin, sizeMax, y0fn, y1fn) => {
      for (let i = 0; i < count; i++) {
        const x = seededRNG.randomGetMinMax(1, WORLD_WIDTH - 2)
        // Trouver le rect correspondant à ce x pour obtenir les frontières Y
        let rect = this.zoneRects[this.zoneRects.length - 1]
        for (let j = 0; j < this.zoneRects.length; j++) {
          if (x <= this.zoneRects[j].x1) { rect = this.zoneRects[j]; break }
        }
        const y = seededRNG.randomGetMinMax(y0fn(rect), y1fn(rect))
        const size = seededRNG.randomGetMinMax(sizeMin, sizeMax)
        this.applyTiles(this.randomWalkCluster(x, y, size, code))
      }
    }

    // ── SILVER — surface ──────────────────────────────────────────────────────
    {
      const {sizeMin, sizeMax} = this.#getClusterSizes(BIOME_TYPE.FOREST, 'under', NODES.SILVER.code)
      const count = seededRNG.randomGetMinMax(3, 5)
      placeInLayer(count, NODES.SILVER.code, sizeMin, sizeMax,
        r => r.ySkySurface, r => r.ySurface)
    }

    // ── GOLD — surface ────────────────────────────────────────────────────────
    {
      const {sizeMin, sizeMax} = this.#getClusterSizes(BIOME_TYPE.FOREST, 'caverns_top', NODES.GOLD.code)
      const count = seededRNG.randomGetMinMax(0, 3)
      placeInLayer(count, NODES.GOLD.code, sizeMin, sizeMax,
        r => r.ySkySurface, r => r.ySurface)
    }

    // ── GOLD — under ──────────────────────────────────────────────────────────
    {
      const {sizeMin, sizeMax} = this.#getClusterSizes(BIOME_TYPE.FOREST, 'caverns_top', NODES.GOLD.code)
      const count = seededRNG.randomGetMinMax(4, 8)
      placeInLayer(count, NODES.GOLD.code, sizeMin, sizeMax,
        r => r.ySurface, r => r.yUnder)
    }

    // ── COBALT — under ────────────────────────────────────────────────────────
    {
      const {sizeMin, sizeMax} = this.#getClusterSizes(BIOME_TYPE.FOREST, 'caverns_top', NODES.COBALT.code)
      const count = seededRNG.randomGetMinMax(3, 7)
      placeInLayer(count, NODES.COBALT.code, sizeMin, sizeMax,
        r => r.ySurface, r => r.yUnder)
    }

    // ── PLATINUM — under ──────────────────────────────────────────────────────
    {
      const {sizeMin, sizeMax} = this.#getClusterSizes(BIOME_TYPE.FOREST, 'caverns_bottom', NODES.PLATINUM.code)
      const count = seededRNG.randomGetMinMax(0, 3)
      placeInLayer(count, NODES.PLATINUM.code, sizeMin, sizeMax,
        r => r.ySurface, r => r.yUnder)
    }

    // ── PLATINUM — caverns_top ────────────────────────────────────────────────
    {
      const {sizeMin, sizeMax} = this.#getClusterSizes(BIOME_TYPE.FOREST, 'caverns_bottom', NODES.PLATINUM.code)
      const count = seededRNG.randomGetMinMax(3, 7)
      placeInLayer(count, NODES.PLATINUM.code, sizeMin, sizeMax,
        r => r.yUnder, r => r.yCavernsMid)
    }
  }

  /**
 * Place des clusters de gemmes hors de leur biome/layer natif (intrusions géologiques).
 *
 * Règles :
 *   - SAPPHIRE   : 1 cluster systématique en caverns_top, biome aléatoire parmi les 3
 *   - TOPAZ      : 1 chance/3 → caverns_top, biome étranger aléatoire
 *   - RUBY       : 1 chance/3 → caverns_top ou caverns_bottom, biome étranger aléatoire
 *   - EMERALD    : 1 chance/3 → caverns_top ou caverns_bottom, biome étranger aléatoire
 *   - Bonus under: 1 monde/4 → under, 1 gemme et 1 biome aléatoires parmi tous
 *   - OBSIDIAN    : 1 chance/3 → caverns_top ou caverns_bottom mais pas hell, biome aléatoire parmi les 3
 *
 * Prérequis : this.zoneRects initialisé par initZoneRects()
 */
  addGemIntrusions () {
    // ── SAPPHIRE — caverns_top, biome aléatoire ───────────────────────────────
    {
      const zone = seededRNG.randomGetArrayValue(this.zoneRects)
      const {sizeMin, sizeMax} = this.#getClusterSizes(BIOME_TYPE.FOREST, NODES.SAPPHIRE.code)
      this.#placeOneCluster(zone.x0, zone.x1, zone.yUnder, zone.yCavernsMid, NODES.SAPPHIRE.code, sizeMin, sizeMax)
    }

    // ── TOPAZ — caverns_top, biome étranger, 1 chance sur 3 ──────────────────
    if (seededRNG.randomGet() < 0.40) {
      const zone = seededRNG.randomGetArrayValue(this.#getForeignZones(BIOME_TYPE.FOREST))
      const {sizeMin, sizeMax} = this.#getClusterSizes(BIOME_TYPE.FOREST, NODES.TOPAZ.code)
      this.#placeOneCluster(zone.x0, zone.x1, zone.yUnder, zone.yCavernsMid, NODES.TOPAZ.code, sizeMin, sizeMax)
    }

    // ── RUBY — caverns_top ou caverns_bottom, biome étranger, 1 chance sur 3 ─
    if (seededRNG.randomGet() < 0.40) {
      const zone = seededRNG.randomGetArrayValue(this.#getForeignZones(BIOME_TYPE.DESERT))
      const {sizeMin, sizeMax} = this.#getClusterSizes(BIOME_TYPE.DESERT, NODES.RUBY.code)
      const inTop = seededRNG.randomGetBool()
      const y0 = inTop ? zone.yUnder : zone.yCavernsMid
      const y1 = inTop ? zone.yCavernsMid : zone.yCaverns
      this.#placeOneCluster(zone.x0, zone.x1, y0, y1, NODES.RUBY.code, sizeMin, sizeMax)
    }

    // ── EMERALD — caverns_top ou caverns_bottom, biome étranger, 1 chance sur 3
    if (seededRNG.randomGet() < 0.40) {
      const zone = seededRNG.randomGetArrayValue(this.#getForeignZones(BIOME_TYPE.JUNGLE))
      const {sizeMin, sizeMax} = this.#getClusterSizes(BIOME_TYPE.JUNGLE, NODES.EMERALD.code)
      const inTop = seededRNG.randomGetBool()
      const y0 = inTop ? zone.yUnder : zone.yCavernsMid
      const y1 = inTop ? zone.yCavernsMid : zone.yCaverns
      this.#placeOneCluster(zone.x0, zone.x1, y0, y1, NODES.EMERALD.code, sizeMin, sizeMax)
    }

    // ── Bonus under — 1 monde sur 4, 1 gemme au hasard, 1 biome au hasard ────
    if (seededRNG.randomGet() < 0.60) {
      const gemCodes = [NODES.TOPAZ.code, NODES.RUBY.code, NODES.EMERALD.code, NODES.SAPPHIRE.code]
      const code = seededRNG.randomGetArrayValue(gemCodes)
      const zone = seededRNG.randomGetArrayValue(this.zoneRects)
      const {sizeMin, sizeMax} = this.#getClusterSizes(BIOME_TYPE.FOREST, code)
      this.#placeOneCluster(zone.x0, zone.x1, zone.ySurface, zone.yUnder, code, sizeMin, sizeMax)
    }

    // ── OBSIDIAN — caverns (hors hell), biome aléatoire, 1 chance sur 3 ──────────
    if (seededRNG.randomGet() < 0.30) {
      const zone = seededRNG.randomGetArrayValue(this.zoneRects)
      const entries = ORE_GEM_SCATTER_MAP[zone.biome]?.hell
      const entry = entries?.find(e => e.code === NODES.OBSIDIAN.code)
      const sizeMin = entry?.sizeMin ?? 16
      const sizeMax = entry?.sizeMax ?? 36
      this.#placeOneCluster(zone.x0, zone.x1, zone.yUnder, zone.yHell, NODES.OBSIDIAN.code, sizeMin, sizeMax)
    }
  }

  /**
 * Projette des lignes depuis le centre d'une géode et fait pousser des clusters
 * de granite/marbre sur les parois rencontrées.
 * S'arrête quand targetTileCount tuiles sont posées ou après MAX_PROJECTIONS tentatives.
 *
 * @param {number} cx         - Centre X de la géode
 * @param {number} cy         - Centre Y de la géode
 * @param {number} code       - Code du matériau (GRANITE ou MARBLE)
 */
  projectAndFill ({cx, cy, code}) {
    const targetClusterCount = GEODE_TARGET_CLUSTER_COUNT
    const MAX_PROJECTIONS = 100
    const FRONTIER = new Set([
      NODES.SKY.code,
      NODES.FOG.code,
      NODES.DEEPSEA.code,
      NODES.BASALT.code,
      NODES.LAVA.code
    ])

    let placed = 0
    let projections = 0

    while (placed < targetClusterCount && projections < MAX_PROJECTIONS) {
      projections++

      const angle = seededRNG.randomGetMinMax(0, 359) * Math.PI / 180
      const dx = Math.cos(angle)
      const dy = Math.sin(angle)

      let x = cx
      let y = cy
      let found = false

      while (true) {
        x += dx
        y += dy
        const xi = Math.round(x)
        const yi = Math.round(y)

        if (xi < 0 || xi >= WORLD_WIDTH || yi < 0 || yi >= WORLD_HEIGHT) break

        const tileCode = worldBuffer.read(xi, yi)

        if (FRONTIER.has(tileCode)) break

        const node = NODES_LOOKUP[tileCode]
        if (node && (node.type & NODE_TYPE.SUBSTRAT)) {
          found = true
          x = xi
          y = yi
          break
        }
      }

      if (!found) continue
      const size = seededRNG.randomGetMinMax(GEODE_CLUSTER_SIZE_MIN, GEODE_CLUSTER_SIZE_MAX)
      const cluster = this.randomWalkCluster(Math.round(x), Math.round(y), size, code)
      this.applyTiles(cluster)
      placed += 1
    }
  }

  /**
 * Interpolation linéaire des tailles de clusters TOPSOIL en fonction de Y.
 * Plus on est profond, plus les clusters sont petits.
 * Référence globale : TOPSOIL_Y_SKY_SURFACE (top) → TOPSOIL_Y_CAVERNS_MID (bottom)
 * sizeMin : [8 → 3], sizeMax : [14 → 6]
 *
 * @param {number} y   - Position Y du seed du cluster
 * @param {number} y0  - Y haut de la zone (= y0 du rectangle)
 * @param {number} y1  - Y bas de la zone (= y1 du rectangle)
 * @returns {{sizeMin: number, sizeMax: number}}
 */
  #getLinearSizes (y, y0, y1) {
    const yTop = TOPSOIL_Y_SKY_SURFACE
    const yBot = TOPSOIL_Y_CAVERNS_MID
    const t = Math.max(0, Math.min(1, (y - yTop) / (yBot - yTop)))
    const sizeMin = Math.round(8 - 5 * t) // [8 → 3]
    const sizeMax = Math.round(14 - 8 * t) // [14 → 6]
    return {sizeMin, sizeMax}
  }

  /**
 * Variante de scatterClusters pour les tuiles TOPSOIL.
 * Les tailles sizeMin/sizeMax sont calculées dynamiquement via #getLinearSizes
 * après tirage du Y — pas de tailles fixes en paramètre.
 * count = max(0, round(surface × percent)) — pas de minimum forcé.
 *
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} percent
 * @param {number} code
 * @returns {Array<{x, y, index, code}>}
 */
  scatterTopsoilClusters (x0, y0, x1, y1, percent, code) {
    const surface = (x1 - x0) * (y1 - y0)
    const count = Math.max(0, Math.round(surface * percent))
    const result = []

    for (let i = 0; i < count; i++) {
      const x = seededRNG.randomGetMinMax(x0, x1)
      const y = seededRNG.randomGetMinMax(y0, y1)
      const {sizeMin, sizeMax} = this.#getLinearSizes(y, y0, y1)
      const size = seededRNG.randomGetMinMax(sizeMin, sizeMax)
      const cluster = this.randomWalkCluster(x, y, size, code)
      for (const tile of cluster) { result.push(tile) }
    }

    return result
  }

  /**
 * Place les clusters de tuiles TOPSOIL par biome × layer.
 * Appelée avant le creusement — les tunnels et cavernes creuseront ensuite dans ces tuiles.
 * Une passe post-creusement distincte (algorithme différent) recouvrira les parois
 * de cavernes et tunnels après leur formation.
 *
 * Prérequis : initZoneRects()
 */
  addTopsoilClusters () {
    for (const rect of this.zoneRects) {
      const map = TOPSOIL_SCATTER_MAP[rect.biome]
      if (!map) continue

      // ── Phase 1 : étrangers en surface dans tous les biomes ──────────────────
      for (const rect of this.zoneRects) {
        const map = TOPSOIL_SCATTER_MAP[rect.biome]
        if (!map) continue
        for (const entry of map.surface) {
          if (entry.native) continue // on saute les natifs
          this.applyTiles(this.scatterTopsoilClusters(
            rect.x0, rect.ySkySurface, rect.x1, rect.ySurface, entry.percent, entry.code))
        }
      }

      // ── Phase 2 : natifs en surface dans tous les biomes ─────────────────────
      for (const rect of this.zoneRects) {
        const map = TOPSOIL_SCATTER_MAP[rect.biome]
        if (!map) continue
        for (const entry of map.surface) {
          if (!entry.native) continue // on saute les étrangers
          this.applyTiles(this.scatterTopsoilClusters(
            rect.x0, rect.ySkySurface, rect.x1, rect.ySurface, entry.percent, entry.code))
        }
      }

      // ── Phase 3 : tous les biomes de la layer underground ─────────────────────
      for (const entry of map.under) {
        this.applyTiles(this.scatterTopsoilClusters(
          rect.x0, rect.ySurface, rect.x1, rect.yUnder, entry.percent, entry.code))
      }

      // ── Phase 4 : tous les biomes de la partie haute de la layer caberns ─────────────────────
      for (const entry of map.caverns_top) {
        this.applyTiles(this.scatterTopsoilClusters(
          rect.x0, rect.yUnder, rect.x1, rect.yCavernsMid, entry.percent, entry.code))
      }
    }
  }
}

export const clusterGenerator = new ClusterGenerator()

/* ====================================================================================================
   CREUSEMENT DE TUNNELS ET DE CAVERNES DANS LE MONDE
   ==================================================================================================== */

class WorldCarver {
  #exclusions
  #zoneRects

  /**
 * Initialise les rectangles de zones biome × layer pour WorldCarver.
 * Reçoit le résultat de clusterGenerator.initZoneRects() via generate().
 *
 * @param {Array<{biome, x0, x1, ySkySurface, ySurface, yUnder, yCavernsMid, yCaverns, yHell}>} zoneRects
 */
  initZoneRects (zoneRects) {
    this.#zoneRects = zoneRects
  }

  /**
 * Réinitialise la liste des zones d'exclusion des mini-biomes.
 * À appeler depuis generate() avant le premier mini-biome.
 */
  initExclusions () {
    this.#exclusions = []
  }

  /**
 * Ajoute un rectangle à la liste des zones d'exclusion.
 * À appeler après applyTiles() pour les mini-biomes uniquement.
 *
 * @param {{x1, y1, x2, y2}} rect
 */
  addExclusion (rect) {
    this.#exclusions.push(rect)
  }

  /**
 * Vérifie si un rectangle intersecte l'une des zones d'exclusion.
 *
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {boolean}
 */
  isExcluded (x1, y1, x2, y2) {
    for (let i = 0; i < this.#exclusions.length; i++) {
      const e = this.#exclusions[i]
      if (x1 <= e.x2 && x2 >= e.x1 && y1 <= e.y2 && y2 >= e.y1) return true
    }
    return false
  }

  /**
 * Génère un cercle bruité dont les bords sont irréguliers (aspect naturel).
 * Les tuiles isolées (≤ 1 voisin 4-connexe dans le résultat) sont éliminées
 * pour garantir un contour compact sans pixel orphelin.
 *
 * @param {Array} tiles      - Tableau accumulant les tuiles
 * @param {number} cx        - Centre X (tuiles)
 * @param {number} cy        - Centre Y (tuiles)
 * @param {number} radiusMin - Rayon minimum (bords les plus rentrés)
 * @param {number} radiusMax - Rayon maximum (bords les plus sortis)
 * @param {number} code      - Code de node à attribuer à chaque tuile
 * @param {number} frequency - Fréquence spatiale du bruit (défaut : 0.3)
 * @returns {Array<{x: number, y: number, index: number, code: number}>}
 */
  digNoisyCircle (tiles, cx, cy, radiusMin, radiusMax, code, frequency = 0.3, offsetX = 0) {
    const radius = (radiusMin + radiusMax) >> 1
    const spread = radiusMax - radiusMin
    const period = 1 / frequency

    const xMin = Math.max(2, cx - radiusMax)
    const xMax = Math.min(WORLD_WIDTH - 3, cx + radiusMax)
    const yMin = Math.max(2, cy - radiusMax)
    const yMax = Math.min(WORLD_HEIGHT - 3, cy + radiusMax)

    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        const dx = x - cx
        const dy = y - cy
        const dist2 = dx * dx + dy * dy
        if (dist2 > radiusMax * radiusMax) continue

        const dist = Math.sqrt(dist2)
        const noise = seededRNG.randomPerlin((x + offsetX) / period, y / period)
        const threshold = radius + (noise * 2 - 1) * spread

        if (dist <= threshold) {
          tiles.push({x, y, index: (y << 10) | x, code})
        }
      }
    }
  }

  /**
 * Creuse un trou elliptique bruité (Perlin noise), allongé horizontalement.
 * Même algorithme que digNoisyCircle — la distance est normalisée par les demi-axes.
 * Pousse les tuiles directement dans `tiles` (pas de retour).
 *
 * @param {Array<{x, y, index, code}>} tiles     - Tableau cible
 * @param {number}                     cx         - X du centre (tuiles)
 * @param {number}                     cy         - Y du centre (tuiles)
 * @param {number}                     radiusXMin - Demi-axe horizontal minimum
 * @param {number}                     radiusXMax - Demi-axe horizontal maximum
 * @param {number}                     radiusYMin - Demi-axe vertical minimum
 * @param {number}                     radiusYMax - Demi-axe vertical maximum
 * @param {number}                     code       - Code de node à appliquer
 * @param {number}                     frequency  - Fréquence du bruit Perlin (défaut 0.3)
 */
  digNoisyEllipse (tiles, cx, cy, radiusXMin, radiusXMax, radiusYMin, radiusYMax, code, frequency = 0.3, offsetX = 0) {
    const radiusX = (radiusXMin + radiusXMax) >> 1
    const radiusY = (radiusYMin + radiusYMax) >> 1
    const spreadX = radiusXMax - radiusXMin
    const spreadY = radiusYMax - radiusYMin
    const period = 1 / frequency

    const xMin = Math.max(2, cx - radiusXMax)
    const xMax = Math.min(WORLD_WIDTH - 3, cx + radiusXMax)
    const yMin = Math.max(2, cy - radiusYMax)
    const yMax = Math.min(WORLD_HEIGHT - 3, cy + radiusYMax)

    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        const dx = x - cx
        const dy = y - cy
        const ndx = dx / radiusX
        const ndy = dy / radiusY
        const dist = Math.sqrt(ndx * ndx + ndy * ndy)

        const noise = seededRNG.randomPerlin((x + offsetX) / period, y / period)
        const spread = (spreadX + spreadY) * 0.5
        const threshold = 1 + (noise * 2 - 1) * (spread / ((radiusX + radiusY) * 0.5))

        if (dist <= threshold) {
          tiles.push({x, y, index: (y << 10) | x, code})
        }
      }
    }
  }

  /**
 * Applique une liste de tuiles dans worldBuffer.
 * Protège les tuiles ETERNAL (FOG, DEEPSEA, BASALT, LAVA), SKY et VOID.
 * Retourne le rectangle englobant des tuiles effectivement écrites.
 *
 * @param {Array<{x, y, index, code}>} tiles
 * @returns {{x1: number, y1: number, x2: number, y2: number}}
 */
  applyTiles (tiles) {
    const PROTECTED = new Set([
      NODES.FOG.code,
      NODES.DEEPSEA.code,
      NODES.BASALT.code,
      NODES.LAVA.code,
      NODES.SKY.code
    ])
    let x1 = WORLD_WIDTH
    let y1 = WORLD_HEIGHT
    let x2 = 0
    let y2 = 0

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i]
      if (tile.x < 0 || tile.x >= WORLD_WIDTH) continue
      if (tile.y < 0 || tile.y >= WORLD_HEIGHT) continue
      if (PROTECTED.has(worldBuffer.readAt(tile.index))) continue
      worldBuffer.writeAt(tile.index, tile.code)
      if (tile.x < x1) x1 = tile.x
      if (tile.x > x2) x2 = tile.x
      if (tile.y < y1) y1 = tile.y
      if (tile.y > y2) y2 = tile.y
    }
    return {x1, y1, x2, y2}
  }

  /**
 * Calcule le chemin d'un tunnel comme suite de points avec rayon local.
 * Ne creuse pas — l'appelant passe chaque point à digNoisyCircle.
 *
 * @param {number} x0         - X de départ (tuiles)
 * @param {number} y0         - Y de départ (tuiles)
 * @param {number} radiusMax  - Rayon maximum du tunnel
 * @param {number} maxLength  - Longueur cible (sous-comptée à 0.8 — tunnel ~25% plus long)
 * @param {number} angle      - Orientation initiale (degrés)
 * @param {number} deltaAngle - Déviation maximale par pas (degrés)
 * @returns {Array<{x, y, radiusMin, radiusMax}>}
 */
  pathTunnel (x0, y0, radiusMax, maxLength, angle, deltaAngle) {
    let alpha = angle * Math.PI / 180
    const dAlpha = deltaAngle * Math.PI / 180
    let x = x0
    let y = y0
    let radius = seededRNG.randomGetMinMax(radiusMax >> 1, radiusMax)
    const path = [{x, y, radiusMin: Math.floor(0.7 * radius), radiusMax: Math.ceil(1.4 * radius)}]
    let length = 0

    while (length < maxLength) {
      alpha += seededRNG.randomReal(-dAlpha, dAlpha)
      const dx = Math.ceil(radius * Math.sin(alpha))
      const dy = Math.ceil(radius * Math.cos(alpha))
      length += 0.8 * Math.hypot(dx, dy)
      x = x + dx
      y = y - dy
      radius = seededRNG.randomGetMinMax(radiusMax >> 1, radiusMax)
      path.push({x, y, radiusMin: Math.floor(0.7 * radius), radiusMax: Math.ceil(1.4 * radius)})
    }

    return path
  }

  /**
 * Creuse un tunnel le long d'un chemin calculé par pathTunnel.
 * Accumule tous les cercles en un seul tableau avant d'appeler applyTiles.
 *
 * @param {Array<{x, y, radiusMin, radiusMax}>} path - Chemin retourné par pathTunnel
 */
  carveAlongPath (path, offsetX = 0) {
    const code = NODES.VOID.code

    const tiles = []
    for (let j = 0; j < path.length; j++) {
      const p = path[j]
      this.digNoisyCircle(tiles, p.x, p.y, p.radiusMin, p.radiusMax, code, 0.3, offsetX)
    }
    this.applyTiles(tiles)
  }

  /**
 * Disperse SMALL_CAVERNS_COUNT petites cavernes (rayon 3–6) et
 * MEDIUM_CAVERNS_COUNT moyennes cavernes (rayon 6–12) dans les zones
 * underground et cavernes uniquement. Les plages se chevauchent sur r=6
 * pour lisser la transition entre les deux tailles.
 * Deux passes applyTiles séparées.
 *
 * @param {Int16Array} surfaceUnder - Altitudes basse surface par colonne X
 */
  digSmallCaverns (surfaceUnder) {
    const code = NODES.VOID.code

    const smallTiles = []
    for (let i = 0; i < SMALL_CAVERNS_COUNT; i++) {
      const x = seededRNG.randomGetMinMax(2, WORLD_WIDTH - 3)
      const y = seededRNG.randomGetMinMax(surfaceUnder[x], WORLD_HEIGHT - 3)
      this.digNoisyCircle(smallTiles, x, y, 3, 6, code, PERLIN_OFFSET_CAVERN)
    }
    this.applyTiles(smallTiles)

    const mediumTiles = []
    for (let i = 0; i < MEDIUM_CAVERNS_COUNT; i++) {
      const x = seededRNG.randomGetMinMax(2, WORLD_WIDTH - 3)
      const y = seededRNG.randomGetMinMax(surfaceUnder[x], WORLD_HEIGHT - 3)
      this.digNoisyCircle(mediumTiles, x, y, 6, 12, code, PERLIN_OFFSET_CAVERN)
    }
    this.applyTiles(mediumTiles)
  }

  /**
 * Creuse un tunnel depuis la surface vers la profondeur.
 * Chaque tunnel part d'un X aléatoire, ancré à skySurface[x0] ± 5.
 * Direction obligatoirement descendante (retirage si nécessaire).
 * Appelée N fois depuis generate() — ne boucle pas en interne.
 *
 * @param {Int16Array} skySurface - Altitudes de la surface par colonne X
 */
  digSurfaceTunnel (skySurface) {
    const count = seededRNG.randomGetMinMax(30, 45)
    for (let i = 0; i < count; i++) {
      const radius = seededRNG.randomGetMinMax(4, 7)
      const x0 = seededRNG.randomGetMinMax(0, WORLD_WIDTH - 1)
      const y0 = skySurface[x0] + seededRNG.randomGetMinMax(-5, 5)
      const direction = seededRNG.randomGetBool() ? 1 : -1
      const angle = direction * seededRNG.randomGetMinMax(110, 125)
      const length = seededRNG.randomGetMinMax(25, 40)
      // chemin obligatoirement en pente
      let path
      do {
        path = this.pathTunnel(x0, y0, radius, length, angle, 15)
      } while (path[path.length - 1].y <= y0)
      this.carveAlongPath(path, PERLIN_OFFSET_SURFACE_TUNNEL)
    }
  }

  /**
 * Creuse un tunnel en zigzag depuis la surface vers la profondeur.
 * Chaque segment alterne entre ~135° et ~225° (±45° autour du bas).
 * Le point de départ de chaque segment est la fin du précédent.
 *
 * @param {Int16Array} skySurface - Altitudes de la surface par colonne X
 */
  digZigzagTunnel (skySurface) {
    const cx = seededRNG.randomGetMinMax(150, WORLD_WIDTH - 151)
    let x = cx
    let y = 32

    let length = 0
    const lengthMax = seededRNG.randomGetMinMax(240, 320)

    while (length < lengthMax) {
      const segmentLength = seededRNG.randomGetMinMax(lengthMax / 5 | 0, lengthMax / 4 | 0)
      const angle = seededRNG.randomGetBool()
        ? seededRNG.randomGetMinMax(130, 160)
        : seededRNG.randomGetMinMax(200, 230)
      const radius = seededRNG.randomGetMinMax(8, 10)
      const path = this.pathTunnel(x, y, radius, segmentLength, angle, 10)
      this.carveAlongPath(path, PERLIN_OFFSET_SURFACE_TUNNEL)

      length += segmentLength
      x = path[path.length - 1].x
      y = path[path.length - 1].y
    }
  }

  /**
 * Creuse UNDERGROUND_TUNNEL_COUNT tunnels horizontaux avec un ou deux coudes
 * en zone underground. X et Y tirés aléatoirement entre surfaceUnder et underCaverns.
 * Direction initiale aléatoire (0–360°), déviation max 25°.
 *
 * @param {Int16Array} surfaceUnder  - Altitudes basse surface par colonne X
 * @param {Int16Array} underCaverns  - Altitudes haute caverne par colonne X
 */
  digUndergroundTunnels (surfaceUnder, underCaverns) {
    for (let i = 0; i < UNDERGROUND_TUNNEL_COUNT; i++) {
      const radius = seededRNG.randomGetMinMax(8, 10)
      const cx = seededRNG.randomGetMinMax(radius, WORLD_WIDTH - radius - 1)
      const cy = seededRNG.randomGetMinMax(surfaceUnder[cx] - radius, underCaverns[cx] - radius)

      const length = seededRNG.randomGetMinMax(30, 50)
      const angle = seededRNG.randomGetMinMax(0, 360)
      const path = this.pathTunnel(cx, cy, radius, length, angle, 25)
      this.carveAlongPath(path, PERLIN_OFFSET_TUNNEL)
    }
  }

  /**
 * Creuse CAVERN_TUNNEL_COUNT tunnels dans la zone cavernes.
 * X et Y tirés aléatoirement entre underCaverns et le plafond de l'enfer.
 * Direction initiale aléatoire (0–360°), déviation max 50°.
 *
 * @param {Int16Array} underCaverns - Altitudes haute caverne par colonne X
 */
  digCavernsTunnels (underCaverns) {
    const hellTop = WORLD_HEIGHT - 32
    for (let i = 0; i < CAVERNS_TUNNEL_COUNT; i++) {
      const radius = seededRNG.randomGetMinMax(7, 10)
      const cx = seededRNG.randomGetMinMax(radius, WORLD_WIDTH - radius - 1)
      const cy = seededRNG.randomGetMinMax(underCaverns[cx] + radius, hellTop - radius)

      const length = seededRNG.randomGetMinMax(40, 60)
      const angle = seededRNG.randomGetMinMax(0, 360)
      const path = this.pathTunnel(cx, cy, radius, length, angle, 35)
      this.carveAlongPath(path, PERLIN_OFFSET_TUNNEL)
    }
  }

  /**
 * Creuse SMALL_TUNNELS_COUNT aleries sinueuses dans les zones
 * underground et cavernes.
 *
 * @param {Int16Array} surfaceUnder - Altitudes basse surface par colonne X
 */
  digSmallTunnels (surfaceUnder) {
    const hellTop = WORLD_HEIGHT - 32
    for (let i = 0; i < SMALL_TUNNELS_COUNT; i++) {
      const cx = seededRNG.randomGetMinMax(2, WORLD_WIDTH - 3)
      const cy = seededRNG.randomGetMinMax(surfaceUnder[cx], hellTop)
      const length = seededRNG.randomGetMinMax(60, 100)
      const angle = seededRNG.randomGetMinMax(0, 360)
      const radius = seededRNG.randomGetMinMax(2, 4)
      const path = this.pathTunnel(cx, cy, radius, length, angle, 40)
      this.carveAlongPath(path, PERLIN_OFFSET_SMALL_TUNNEL)
    }
  }

  /**
 * Creuse une ruche à une position aléatoire dans le rectangle de zone donné.
 * Utilise this.zoneRects pour les frontières Y.
 * Gère les tentatives et les exclusions en interne.
 *
 * @param {{biome, x0, x1, ySurface, yUnder, yCavernsMid}} rect
 * @returns {{cx, cy, radius}|null} — null si MAX_ATTEMPTS épuisé
 */
  #digOneHive (rect) {
    const MAX_ATTEMPTS = 100
    const radius = seededRNG.randomGetMinMax(HIVE_RADIUS_MIN, HIVE_RADIUS_MAX)
    const angle = seededRNG.randomGetBool() ? 45 : -45
    const length = seededRNG.randomGetMinMax(30, 50)
    const ex = length + 4
    const ey = length + 4

    let cx, cy, valid
    let attempts = 0
    do {
      cx = seededRNG.randomGetMinMax(rect.x0 + radius, rect.x1 - radius)
      cy = seededRNG.randomGetMinMax(rect.ySurface + radius, rect.yCavernsMid - radius)

      const bx1 = angle === 45 ? cx - (radius + 4) : cx - ex
      const by1 = cy - ey
      const bx2 = angle === 45 ? cx + ex : cx + (radius + 4)
      const by2 = cy + (radius + 4)

      valid = !this.isExcluded(bx1, by1, bx2, by2)
      attempts++
    } while (!valid && attempts < MAX_ATTEMPTS)

    if (!valid) return null

    const tiles = []
    this.digNoisyCircle(tiles, cx, cy, radius, radius + 4, NODES.HIVE.code, 0.3, PERLIN_OFFSET_HIVE)
    this.digNoisyCircle(tiles, cx, cy, radius - 3, radius, NODES.VOID.code, 0.3, PERLIN_OFFSET_HIVE)
    const rect2 = this.applyTiles(tiles)

    const path = this.pathTunnel(cx, cy, 4, length, angle, 10)
    this.carveAlongPath(path)

    this.addExclusion(rect2)
    return {cx, cy, radius}
  }

  /**
 * Creuse hiveCount ruches en zone JUNGLE (underground → caverns_top).
 * 1 monde sur 2 : une ruche intrusion est placée dans un biome étranger (FOREST ou DESERT),
 * dans la même layer que les ruches normales.
 * Le remplissage HONEY est différé.
 *
 * @param {{forest, desert, jungle}} biomeCounts
 * @returns {Array<{cx, cy, radius}>}
 */
  digHives (biomeCounts) {
    const hiveCount = Math.max(3, 2 * biomeCounts.jungle)
    const hives = []

    // ── Ruches normales — zones JUNGLE ───────────────────────────────────────
    const jungleRects = []
    for (let i = 0; i < this.#zoneRects.length; i++) {
      if (this.#zoneRects[i].biome === BIOME_TYPE.JUNGLE) jungleRects.push(this.#zoneRects[i])
    }

    if (jungleRects.length > 0) {
      for (let i = 0; i < hiveCount; i++) {
        const rect = seededRNG.randomGetArrayValue(jungleRects)
        const hive = this.#digOneHive(rect)
        if (hive) hives.push(hive)
      }
    }

    // ── Ruche intrusion — 1 monde sur 2, biome étranger ──────────────────────
    if (seededRNG.randomGet() < 0.5) {
      const foreignRects = []
      for (let i = 0; i < this.#zoneRects.length; i++) {
        if (this.#zoneRects[i].biome !== BIOME_TYPE.JUNGLE) foreignRects.push(this.#zoneRects[i])
      }
      if (foreignRects.length > 0) {
        const rect = seededRNG.randomGetArrayValue(foreignRects)
        const hive = this.#digOneHive(rect)
        if (hive) hives.push(hive)
      }
    }

    return hives
  }

  /**
 * Creuse une caverne à toiles d'araignée à une position aléatoire.
 * y0/y1 définissent la plage verticale de placement — permet l'intrusion under.
 *
 * @param {number} y0 - Y minimum pour cy
 * @param {number} y1 - Y maximum pour cy
 * @returns {{cx, cy, radiusX, radiusY}|null} — null si MAX_ATTEMPTS épuisé
 */
  #digOneCobwebCave (y0, y1) {
    const MAX_ATTEMPTS = 100
    const radiusX = seededRNG.randomGetMinMax(COBWEB_RADIUS_X_MIN, COBWEB_RADIUS_X_MAX)
    const radiusY = seededRNG.randomGetMinMax(COBWEB_RADIUS_Y_MIN, COBWEB_RADIUS_Y_MAX)

    let cx, cy, valid
    let attempts = 0
    do {
      cx = seededRNG.randomGetMinMax(radiusX, WORLD_WIDTH - radiusX - 1)
      cy = seededRNG.randomGetMinMax(y0 + radiusY, y1 - radiusY)
      valid = !this.isExcluded(cx - radiusX, cy - radiusY, cx + radiusX, cy + radiusY)
      attempts++
    } while (!valid && attempts < MAX_ATTEMPTS)
    if (!valid) return null

    const tiles = []
    this.digNoisyEllipse(tiles, cx, cy, radiusX - 2, radiusX + 2, radiusY - 2, radiusY + 2, NODES.VOID.code, 0.3, PERLIN_OFFSET_COBWEB)
    const rect = this.applyTiles(tiles)
    this.addExclusion(rect)

    return {cx, cy, radiusX, radiusY}
  }

  /**
 * Creuse COBWEB_CAVE_COUNT_MIN–MAX cavernes elliptiques dans tous les biomes,
 * caverns_top (80%) ou caverns_bottom (20%).
 * Intrusion : 1 caverne systématique dans la layer under, biome aléatoire.
 *
 * @returns {Array<{cx, cy, radiusX, radiusY}>}
 */
  digCobwebCaves () {
    const count = seededRNG.randomGetMinMax(COBWEB_CAVE_COUNT_MIN, COBWEB_CAVE_COUNT_MAX)
    const caves = []

    // ── Cavernes normales — caverns_top ou caverns_bottom ─────────────────────
    for (let i = 0; i < count; i++) {
      const isCavernTop = seededRNG.randomGetMinMax(0, 4) > 0

      // Trouver le rect pour un cx libre sur tout le monde
      const cx = seededRNG.randomGetMinMax(COBWEB_RADIUS_X_MAX, WORLD_WIDTH - COBWEB_RADIUS_X_MAX - 1)
      let rect = this.#zoneRects[this.#zoneRects.length - 1]
      for (let j = 0; j < this.#zoneRects.length; j++) {
        if (cx <= this.#zoneRects[j].x1) { rect = this.#zoneRects[j]; break }
      }

      const y0 = isCavernTop ? rect.yUnder : rect.yCavernsMid
      const y1 = isCavernTop ? rect.yCavernsMid : rect.yCaverns

      const cave = this.#digOneCobwebCave(y0, y1)
      if (cave) caves.push(cave)
    }

    // ── Intrusion — 1 caverne dans la layer under, biome aléatoire ───────────
    {
      const rect = seededRNG.randomGetArrayValue(this.#zoneRects)
      const cave = this.#digOneCobwebCave(rect.ySurface, rect.yUnder)
      if (cave) caves.push(cave)
    }

    return caves
  }

  /**
 * Creuse une géode elliptique à une position aléatoire dans la plage [y0, y1].
 *
 * @param {number} y0   - Y minimum pour cy
 * @param {number} y1   - Y maximum pour cy
 * @param {number} code - Code du matériau (GRANITE ou MARBLE)
 * @returns {{cx, cy, radiusX, radiusY, code}|null} — null si MAX_ATTEMPTS épuisé
 */
  #digOneGeodeCave (y0, y1, code) {
    const MAX_ATTEMPTS = 100
    const radiusX = seededRNG.randomGetMinMax(GEODE_RADIUS_MIN, GEODE_RADIUS_MAX)
    const radiusY = seededRNG.randomGetMinMax(GEODE_RADIUS_MIN, GEODE_RADIUS_MAX)

    let cx, cy, valid
    let attempts = 0
    do {
      cx = seededRNG.randomGetMinMax(radiusX, WORLD_WIDTH - radiusX - 1)
      cy = seededRNG.randomGetMinMax(y0 + radiusY, y1 - radiusY)
      valid = !this.isExcluded(cx - radiusX, cy - radiusY, cx + radiusX, cy + radiusY)
      attempts++
    } while (!valid && attempts < MAX_ATTEMPTS)
    if (!valid) return null

    const tiles = []
    this.digNoisyEllipse(tiles, cx, cy, radiusX - 2, radiusX + 2, radiusY - 2, radiusY + 2, NODES.VOID.code, 0.3, PERLIN_OFFSET_CAVERN)
    const rect = this.applyTiles(tiles)
    this.addExclusion(rect)

    return {cx, cy, radiusX, radiusY, code}
  }

  /**
 * Creuse GEODE_CAVE_COUNT géodes elliptiques en zone caverns_bottom, tous biomes.
 * Intrusion : 1 monde sur 3, une géode supplémentaire en caverns_top,
 * code GRANITE ou MARBLE tiré au hasard.
 * Retourne la description complète pour projectAndFill().
 *
 * @param {number} code - Code du matériau (GRANITE ou MARBLE)
 * @returns {Array<{cx, cy, radiusX, radiusY, code}>}
 */
  digGeodeCaves (code) {
    const count = seededRNG.randomGetMinMax(GEODE_CAVE_COUNT_MIN, GEODE_CAVE_COUNT_MAX)
    const caves = []

    // ── Géodes normales — caverns_bottom ─────────────────────────────────────
    for (let i = 0; i < count; i++) {
      const cx = seededRNG.randomGetMinMax(GEODE_RADIUS_MAX, WORLD_WIDTH - GEODE_RADIUS_MAX - 1)
      let rect = this.#zoneRects[this.#zoneRects.length - 1]
      for (let j = 0; j < this.#zoneRects.length; j++) {
        if (cx <= this.#zoneRects[j].x1) { rect = this.#zoneRects[j]; break }
      }
      const cave = this.#digOneGeodeCave(rect.yCavernsMid, rect.yCaverns, code)
      if (cave) caves.push(cave)
    }

    // ── Intrusion — 1 monde sur 2, caverns_top ───────────────
    if (seededRNG.randomGet() < 0.5) {
      const rect = seededRNG.randomGetArrayValue(this.#zoneRects)
      const cave = this.#digOneGeodeCave(rect.yUnder, rect.yCavernsMid, code)
      if (cave) caves.push(cave)
    }

    return caves
  }

  /**
 * Passe de nettoyage globale après tous les creusements.
 * Parcours séquentiel index croissant (haut→bas, gauche→droite).
 * Les modifications sont in-place — la cascade est naturelle.
 * Protège les tuiles ETERNAL contre tout écrasement.
 */
  cleanupAfterCarving () {
    const world = worldBuffer.world
    const VOID = NODES.VOID.code
    const SKY = NODES.SKY.code
    const W = WORLD_WIDTH
    const H = WORLD_HEIGHT

    const PROTECTED = new Set([
      NODES.FOG.code,
      NODES.DEEPSEA.code,
      NODES.BASALT.code,
      NODES.LAVA.code
    ])

    const propagateSky = (idx) => {
      world[idx] = SKY
      let below = idx + W
      while (below < W * (H - 1) && world[below] === VOID) {
        world[below] = SKY
        below += W
      }
    }

    // Passe 1 — propagation SKY vers le bas colonne par colonne
    for (let x = 1; x < W - 1; x++) {
      for (let y = 1; y < H - 1; y++) {
        const idx = (y << 10) | x
        const code = world[idx]
        if (code === SKY) continue
        if (code === VOID) { world[idx] = SKY; continue }
        break
      }
    }

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = (y << 10) | x
        const code = world[idx]
        const isVoid = code === VOID
        const isSKY = code === SKY

        const top = world[idx - W]
        const bot = world[idx + W]
        const left = world[idx - 1]
        const right = world[idx + 1]

        if (isVoid) {
        // Règle 2 — VOID avec 4 voisins non VOID → devient l'un d'eux
          if (top !== VOID && bot !== VOID && left !== VOID && right !== VOID) {
            const candidates = []
            if (top !== SKY) candidates.push(top)
            if (bot !== SKY) candidates.push(bot)
            if (left !== SKY) candidates.push(left)
            if (right !== SKY) candidates.push(right)
            world[idx] = seededRNG.randomGetArrayValue(candidates)
            continue
          }

          // Règle 4 — paire horizontale VOID (x,y)+(x+1,y), 6 voisins non VOID → devient l'un des 6
          if (x < W - 2 && right === VOID) {
            const top2 = world[idx - W + 1]
            const bot2 = world[idx + W + 1]
            const right2 = world[idx + 2]
            if (top !== VOID && top2 !== VOID && bot !== VOID && bot2 !== VOID && left !== VOID && right2 !== VOID) {
              const candidates = []
              if (top !== SKY) candidates.push(top)
              if (top2 !== SKY) candidates.push(top2)
              if (bot !== SKY) candidates.push(bot)
              if (bot2 !== SKY) candidates.push(bot2)
              if (left !== SKY) candidates.push(left)
              if (right2 !== SKY) candidates.push(right2)
              world[idx] = seededRNG.randomGetArrayValue(candidates)
              continue
            }
          }

          // Règle 6 — paire verticale VOID (x,y)+(x,y+1), 6 voisins non VOID → devient l'un des 6
          if (y < H - 2 && bot === VOID) {
            const left2 = world[idx + W - 1]
            const right2 = world[idx + W + 1]
            const top2 = world[idx + W + W]
            if (top !== VOID && left !== VOID && left2 !== VOID && right !== VOID && right2 !== VOID && top2 !== VOID) {
              const candidates = []
              if (top !== SKY) candidates.push(top)
              if (left !== SKY) candidates.push(left)
              if (left2 !== SKY) candidates.push(left2)
              if (right !== SKY) candidates.push(right)
              if (right2 !== SKY) candidates.push(right2)
              if (top2 !== SKY) candidates.push(top2)
              world[idx] = seededRNG.randomGetArrayValue(candidates)
              continue
            }
          }
        } else {
          if (PROTECTED.has(code)) continue
          if (isSKY) continue

          // Règle 3 — non VOID avec 4 voisins VOID → devient VOID
          if (top === VOID && bot === VOID && (left === VOID || left === SKY) && (right === VOID || right === SKY)) {
            world[idx] = VOID
            continue
          }

          // Règle 5 — paire horizontale non VOID (x,y)+(x+1,y), 6 voisins VOID → devient VOID
          if (x < W - 2 && right !== VOID) {
            const top2 = world[idx - W + 1]
            const bot2 = world[idx + W + 1]
            const right2 = world[idx + 2]
            if (top === VOID && top2 === VOID && bot === VOID && bot2 === VOID && left === VOID && right2 === VOID) {
              world[idx] = VOID
              continue
            }
          }

          // Règle 7 — paire verticale non VOID (x,y)+(x,y+1), 6 voisins VOID → devient VOID
          if (y < H - 2 && bot !== VOID) {
            const left2 = world[idx + W - 1]
            const right2 = world[idx + W + 1]
            const bot2 = world[idx + W + W]
            if (top === VOID && left === VOID && left2 === VOID && right === VOID && right2 === VOID && bot2 === VOID) {
              world[idx] = VOID
              continue
            }
          }

          // Règle 8 — pic isolé dans le ciel → SKY + propagation vers le bas
          if (top === SKY && left === SKY && right === SKY && bot === VOID) {
            propagateSky(idx)
            world[idx] = SKY
            continue
          }

          // Règle 9 — pic double vertical dans le ciel → SKY + propagation vers le bas
          if (y < H - 2 && top === SKY && left === SKY && right === SKY) {
            const bot2code = world[idx + W + W]
            const left2 = world[idx + W - 1]
            const right2 = world[idx + W + 1]
            if (bot !== VOID && bot !== SKY && left2 === SKY && right2 === SKY && (bot2code === VOID || bot2code === SKY)) {
              world[idx] = SKY
              propagateSky(idx + W)
              continue
            }
          }

          // Règle 10 — pic double horizontal dans le ciel → SKY + propagation vers le bas
          if (x < W - 2 && top === SKY && (bot === VOID || bot === SKY)) {
            const top2 = world[idx - W + 1]
            const bot2 = world[idx + W + 1]
            const right2 = world[idx + 2]
            if (right !== VOID && right !== SKY && top2 === SKY && (bot2 === VOID || bot2 === SKY) && right2 === SKY) {
              propagateSky(idx)
              propagateSky(idx + 1)
              continue
            }
          }
        }
      }
    }
  }

  /**
 * DEBUG — Trace un tunnel unique depuis le centre du monde.
 * À supprimer après validation.
 */
  debugTraceTunnel () {
    const code = NODES.VOID.code
    const tiles = []
    for (let cx = 100; cx < WORLD_WIDTH - 100; cx += 60) {
      for (let cy = 100; cy < WORLD_HEIGHT - 100; cy += 40) {
        this.digNoisyEllipse(tiles, cx, cy, 18, 22, 6, 10, code)
      }
    }
    this.applyTiles(tiles)
  }
}

export const worldCarver = new WorldCarver()
