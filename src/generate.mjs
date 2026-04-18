import {seededRNG} from './utils.mjs'
import {database} from './database.mjs'
import {NODES, NODES_LOOKUP, NODE_TYPE, WEATHER_TYPE, BIOME_TYPE, WORLD_WIDTH, WORLD_HEIGHT, SEA_LEVEL, TOPSOIL_Y_SKY_SURFACE, TOPSOIL_Y_SURFACE_UNDER, TOPSOIL_Y_UNDER_CAVERNS, TOPSOIL_Y_CAVERNS_MID, BIOME_TILE_MAP, SEA_MAX_JITTER, SEA_MAX_WIDTH, SEA_MAX_HEIGHT, CLUSTER_SCATTER_MAP, ORE_GEM_SCATTER_MAP, PERLIN_OFFSET_NATURALIZER, PERLIN_OFFSET_TUNNEL, PERLIN_OFFSET_SURFACE_TUNNEL, PERLIN_OFFSET_SMALL_TUNNEL, PERLIN_OFFSET_CAVERN, PERLIN_OFFSET_HIVE, PERLIN_OFFSET_HEART, PERLIN_OFFSET_COBWEB, PERLIN_OFFSET_FERNS, PERLIN_OFFSET_LAKES, PERLIN_OFFSET_SHELL, SMALL_CAVERNS_COUNT, MEDIUM_CAVERNS_COUNT, UNDERGROUND_TUNNEL_COUNT, CAVERNS_TUNNEL_COUNT, SMALL_TUNNELS_COUNT, HIVE_RADIUS_MIN, HIVE_RADIUS_MAX, COBWEB_CAVE_COUNT_MIN, COBWEB_CAVE_COUNT_MAX, COBWEB_RADIUS_X_MIN, COBWEB_RADIUS_X_MAX, COBWEB_RADIUS_Y_MIN, COBWEB_RADIUS_Y_MAX, COBWEB_CAVE_MAIN_MIN, COBWEB_CAVE_MAIN_MAX, COBWEB_CAVE_SIDE_MIN, COBWEB_CAVE_SIDE_MAX, COBWEB_SCATTER_COUNT, COBWEB_SCATTER_SIZE_MIN, COBWEB_SCATTER_SIZE_MAX, GEODE_CAVE_COUNT_MIN, GEODE_CAVE_COUNT_MAX, GEODE_RADIUS_MIN, GEODE_RADIUS_MAX, GEODE_TARGET_CLUSTER_COUNT, GEODE_CLUSTER_SIZE_MIN, GEODE_CLUSTER_SIZE_MAX, TOPSOIL_SCATTER_MAP, LAKE_RADIUS_X_MIN, LAKE_RADIUS_X_MAX, LAKE_RADIUS_Y_MIN, LAKE_RADIUS_Y_MAX, LAKE_PIT_RADIUS_X_MIN, LAKE_PIT_RADIUS_X_MAX, LAKE_PIT_RADIUS_Y_MIN, LAKE_PIT_RADIUS_Y_MAX, LAKE_CREATION_MAP, UNDERGROUND_LAKE_UNDER_COUNT, UNDERGROUND_LAKE_CAVERNS_COUNT, UNDERGROUND_LAKE_RADIUS_MIN, UNDERGROUND_LAKE_RADIUS_MAX, BLIND_LAKE_COUNT, BLIND_LAKE_RADIUS_MIN, BLIND_LAKE_RADIUS_MAX, SAP_LAKE_UNDER_COUNT, SAP_LAKE_CAVERNS_COUNT, SAP_LAKE_RADIUS_MIN, SAP_LAKE_RADIUS_MAX, SAP_POCKET_COUNT, SAP_POCKET_RADIUS_MIN, SAP_POCKET_RADIUS_MAX, WATER_PUDDLE_COUNT, SAP_PUDDLE_COUNT, PUDDLE_HEIGHT_MIN, PUDDLE_HEIGHT_MAX, FOSSIL_VEIN_COUNT, FERN_CAVE_RADIUS_X_MIN, FERN_CAVE_RADIUS_X_MAX, FERN_CAVE_RADIUS_Y_MIN, FERN_CAVE_RADIUS_Y_MAX, MOSS_CAVE_RADIUS_X_MIN, MOSS_CAVE_RADIUS_X_MAX, MOSS_CAVE_RADIUS_Y_MIN, MOSS_CAVE_RADIUS_Y_MAX, CREATION_REMAP} from '../assets/data/data-gen.mjs'

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

    window.DEBUG_POINTS = [] // DEGUG - à supprimer

    // affichage de la progression de la création dans le dialogue modal
    const STEPS = 19
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
    worldCarver.initExclusions()
    tileGuard.init()

    // 6.1 Creusement des mini-biomes - TODO

    // 6.1.1 Lakes / Oasis

    // ⚠️ digSurfaceLakes DOIT rester en premier — il n'utilise pas #exclusions pour se placer,
    // mais alimente la table pour tous les mini-biomes suivants.
    const surfaceLakes = worldCarver.digSurfaceLakes(skySurface)
    const lakeLiquidBodies = surfaceLakes.map(h => h.liquidBody)
    surfaceLakes.forEach(l => delete l.liquidBody)
    const underLakes = worldCarver.digUndergroundLakes(surfaceUnder, underCaverns)
    const underLakeLiquidBodies = underLakes.map(h => h.liquidBody)
    underLakes.forEach(l => delete l.liquidBody)
    const blindLakes = worldCarver.digBlindLakes(underCaverns)
    const blindLakeLiquidBodies = blindLakes.map(h => h.liquidBody)
    blindLakes.forEach(l => delete l.liquidBody)
    await progress('Lakes & oasis')

    // 6.1.2 Fossil Veins (caverns_top - desert - SHELL)
    worldCarver.digFossilVeins()

    // 6.1.3 Sap Pockets
    const sapLakes = worldCarver.digSapLakes(surfaceUnder, underCaverns)
    const sapLakeLiquidBodies = sapLakes.map(h => h.liquidBody)
    sapLakes.forEach(l => delete l.liquidBody)
    const sapPockets = worldCarver.digSapPockets(underCaverns)
    const sapPocketLiquidBodies = sapPockets.map(h => h.liquidBody)
    sapPockets.forEach(l => delete l.liquidBody)
    await progress('Sap Pockets')

    // 6.1.5 HIVE caves
    const hives = worldCarver.digHives(biomeCounts)
    const honeyLiquidBodies = hives.map(h => h.liquidBody)
    await progress('Hives')

    // 6.1.6 Cobweb caves
    const cobwebCaves = worldCarver.digCobwebCaves()
    await progress('Cobweb caves')

    // 6.1.7 Marble caves et  Granite caves
    const graniteCaves = worldCarver.digGeodeCaves(NODES.GRANITE.code)
    const marbleCaves = worldCarver.digGeodeCaves(NODES.MARBLE.code)
    const geodeCaves = graniteCaves.concat(marbleCaves)
    await progress('Geode caves')

    // 6.1.8 Fern Caves (Underground, Forest 6 HUMUS + GRASSFERN)
    const ferns = worldCarver.digFernCaves()
    await progress('Fern caves')

    // 6.1.9 Moss Cave (Underground - jungle - MUD + GRASSMOSS
    const moss = worldCarver.digMossCaves()
    await progress('Moss caves')

    // 6.1.X Mushroom caves
    // const mushroomCaves = worldCarver.digMushroomCaves()

    // 6.1.X Sand Pockets
    // worldCarver.digSandPocket()

    // 6.1.X Anthill
    // const anthills = worldCarver.digAnthills()

    // 6.1.X Termite Mound
    // const termites = worldCarver.digTermiteMounds()

    // 6.1.X Antilion Pit
    // const antilions = worldCarver.digAntilionPits()

    // 6.1.X Pyramid
    // le cy est tiré entre rect.yUnder et rect.yCavernsMid
    // const pyramids = worldCarver.digPyramids()

    // 6.1.X Ancient House / Temple Ruin / Ruined Cabin
    // Caverns_top, jungle - EMERALDWALL -
    // const ancienthouse = worldCarver.digAncientHouse()
    // Caverns_bottom, desert - GOLDWALL -
    // const templeruin = worldCarver.digTempleRuin()
    // Under, forest - STONEWALL -
    // const ruinedcabin = worldCarver.digRuinedCabin()

    // 6.1.X Underground Lake
    // caverns_top - Forest - WATER + HUMUS
    // const undergroundlake = worldCarver.digUndergroundLake()

    // 6.1.X Life Heart (15)
    const hearts = worldCarver.digHearts(surfaceUnder, underCaverns)
    const triskels = worldCarver.digTriskels(underCaverns)
    await progress('Life Hearts')
    console.log('>>>>>>>>>>> hearts et triskels', hearts, triskels)

    // 6.2 Creusement des tunnels et cavernes
    // worldCarver.digZigzagTunnels(surfaceLakes)
    // worldCarver.digSurfaceTunnel(skySurface, surfaceLakes)
    // await progress('Surface tunnels')
    // worldCarver.digSmallCaverns(surfaceUnder)
    // await progress('Caverns')
    // worldCarver.digUndergroundTunnels(surfaceUnder, underCaverns)
    // worldCarver.digCavernsTunnels(underCaverns)
    // await progress('Deep tunnels')
    // worldCarver.digSmallTunnels(surfaceUnder)
    // await progress('Small tunnels')

    // 6-3 Remplissage de la mer (gauche et droite)
    liquidFiller.fillSea()
    await progress('Sea Flooding')

    // // 6.4. Nettoyage des tuiles isolées
    worldCarver.cleanupAfterCarving()
    const surfaceLine = worldCarver.buildErodedSurfaceLine()

    // // 6.5. Ajout des flaques sousterraines
    const waterPuddleLiquidBodies = worldCarver.digWaterPuddles(surfaceUnder)
    const sapPuddleLiquidBodies = worldCarver.digSapPuddles(surfaceUnder)
    await progress('Puddles')

    // A supprimer
    // worldCarver.debugTraceTunnel()

    // 7. Traitement des surfaces végétales + désert - TODO

    // 7.2. Ajout des topsoils / natural (forêt et jungle)

    // 7.3. Ajout du sable (désert) - écoulement et consolidation des tunnels/cavernes

    // DEBUG — à supprimer après mise au point
    // window.DEBUG_SURFACE_LINE = surfaceLine

    await progress('Carving Cleanup')

    console.log('[WorldGenerator::liquidFiller] - Sea', (performance.now() - t0).toFixed(3), 'ms', surfaceLine)

    // N-6 Ajout de la plage (Shore) et du fond de la mer - TODO

    // N-5 Ajout des plantes et des coraux - TODO

    // N-4 Peuplement des biomes qui sont à peuplement différé - TODO

    for (const cave of geodeCaves) { clusterGenerator.projectAndFill(cave) }
    // webFiller.scatterWebs(surfaceUnder)

    // N-3. Ajout des coffres et objets spéciaux - TODO
    // XXXXX.addSurfaceChests(xxx)
    // XXXXX.addUndergroundChests(xxx)
    // XXXXX.addCavernsChests(xxx)
    // XXXXX.addHearts(hearts) // 15 underground
    // XXXXX.addTriskels(triskels) // 2 caverns_top et 1 caverns_bottom
    // XXXXX.addAncientStations(xxx)

    // N-2. Nettoyage final (tuiles isolées) - TODO

    // N-1 Affichage de statistiques)
    worldBuffer.logStats()

    // N. Stochage du monde en base de données
    if (!debug) {
      const liquidBodies = [...honeyLiquidBodies, ...lakeLiquidBodies, ...underLakeLiquidBodies, ...blindLakeLiquidBodies, ...sapLakeLiquidBodies, ...sapPocketLiquidBodies, ...waterPuddleLiquidBodies, ...sapPuddleLiquidBodies]
      const lakes = [...surfaceLakes, ...underLakes, ...blindLakes, ...sapLakes, ...sapPockets]
      await this.save(seed, {hives, cobwebCaves, geodeCaves, lakes, liquidBodies, ferns, moss})
      worldBuffer.clear()
    }

    // tileGuard.debug() // DEBUG

    // N + 1. On repasse le générateur de nombres aléatoires en mode aléatoire
    seededRNG.init()

    console.log('[WorldGenerator] - Terminé en', (performance.now() - t0).toFixed(3), 'ms')
    if (debug) { return worldBuffer } // appelant responsable du clear()
  }

  async save (seed, {hives, cobwebCaves, geodeCaves, lakes, liquidBodies, ferns, moss}) {
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
      {key: 'lakes', value: JSON.stringify(lakes)},
      {key: 'geodecaves', value: JSON.stringify(geodeCaves)},
      {key: 'ferns', value: JSON.stringify(ferns)},
      {key: 'moss', value: JSON.stringify(moss)}

      // {key: 'honeysurface', value: this.honeysurface.join('|')}
    ])
    // sauvegarde des liquid bodies
    await database.clearObjectStore('liquid')
    await database.addMultipleRecords('liquid', liquidBodies)

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
    const LIQUID_BORDER = new Set([NODES.WATER.code, NODES.SAP.code, NODES.HONEY.code])
    const VOID = NODES.VOID.code
    const SEA = NODES.SEA.code
    const SANDSTONE = NODES.SANDSTONE.code

    const maxIndexTop = SEA_LEVEL * 1024 - 1
    const xLimit = isLeft ? maxWidth : 1023 - maxWidth

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

        // Limite basse — rebouchage
        if (ny >= maxY) {
          const ahead1 = nIdx + 1024
          const ahead2 = ahead1 + 1024
          if (worldBuffer.readAt(ahead1) === VOID && worldBuffer.readAt(ahead2) === VOID) {
            worldBuffer.writeAt(nIdx, SANDSTONE)
            worldBuffer.writeAt(ahead1, SANDSTONE)
            visited.add(nIdx)
          }
          continue
        }

        const tileCode = worldBuffer.readAt(nIdx)
        if (tileCode !== VOID) continue

        // Limite X — rebouchage éventuel
        const atLimit = isLeft ? nx >= xLimit : nx <= xLimit
        if (atLimit) {
          const dir = nIdx - idx
          const ahead1 = nIdx + dir
          const ahead2 = ahead1 + dir
          if (worldBuffer.readAt(ahead1) === VOID && worldBuffer.readAt(ahead2) === VOID) {
            worldBuffer.writeAt(nIdx, SANDSTONE)
            worldBuffer.writeAt(ahead1, SANDSTONE)
            visited.add(nIdx)
            continue
          }
        }

        // Vérifier si nIdx a un voisin liquide
        let hasLiquidNeighbor = false
        const nNeighbors = [nIdx - 1, nIdx + 1, nIdx - 1024, nIdx + 1024]
        for (let j = 0; j < 4; j++) {
          if (LIQUID_BORDER.has(worldBuffer.readAt(nNeighbors[j]))) { hasLiquidNeighbor = true; break }
        }
        if (hasLiquidNeighbor) {
          worldBuffer.writeAt(nIdx, SANDSTONE)
          visited.add(nIdx)
          continue
        }

        worldBuffer.writeAt(nIdx, SEA)
        enqueue(nIdx)
      }
    }
  }

  /**
 * Remplit d'eau douce (WATER) une ellipse creusée en SKY, à partir d'un point de départ,
 * sans dépasser la ligne horizontale cy (borne stricte y >= cy).
 * Algorithme BFS FIFO avec head cursor — même pattern que #fillOneSea.
 * @param {number} cx
 * @param {number} cy          - Borne supérieure stricte du fill (y >= cy)
 * @param {number} radiusX     - Demi-largeur de l'ellipse — borne latérale
 * @param {number} shoreCode   - Code substrat natif pour consolider les berges
 * @returns {{index: number, nodeCode: number}} — index monde du premier WATER posé
 */
  fillLake (cx, cy, radiusX, shoreCode, nodeCode = NODES.WATER.code) {
    const SKY = NODES.SKY.code
    const VOID = NODES.VOID.code
    const xMin = cx - radiusX
    const xMax = cx + radiusX

    const src = (cy << 10) | cx
    if (worldBuffer.readAt(src) !== SKY && worldBuffer.readAt(src) !== VOID) return

    const visited = new Set()
    const queue = []
    let head = 0

    visited.add(src)
    queue.push(src)

    while (head < queue.length) {
      const idx = queue[head++]
      const nx = idx & 0x3FF

      // Hors bornes latérales → substrat (berge)
      if (nx < xMin || nx > xMax) {
        worldBuffer.writeAt(idx, shoreCode)
        continue
      }

      worldBuffer.writeAt(idx, nodeCode)

      const neighbors = [idx - 1, idx + 1, idx - 1024, idx + 1024]
      for (let i = 0; i < 4; i++) {
        const nIdx = neighbors[i]
        if (visited.has(nIdx)) continue

        const nnx = nIdx & 0x3FF
        const nny = nIdx >> 10

        if (nnx <= 1 || nnx >= 1022 || nny <= 1 || nny >= 510) continue
        if (nny < cy) continue
        const currentCode = worldBuffer.readAt(nIdx)
        if ((currentCode !== SKY) && (currentCode !== VOID)) continue

        visited.add(nIdx)
        queue.push(nIdx)
      }
    }
    return {index: src, nodeCode}
  }

  /**
 * Remplit en HONEY la moitié inférieure de la cavité VOID d'une ruche.
 * BFS depuis (cx, cy+1) — propage uniquement sur les tuiles VOID avec y >= cy.
 * Algorithme FIFO avec head cursor — même pattern que #fillOneSea.
 *
 * @param {number} cx - Centre horizontal de la ruche
 * @param {number} cy - Centre vertical de la ruche (borne supérieure stricte du fill)
 * @returns {{index: number, nodeCode: number}} — index monde du premier HONEY posé
 */
  fillHive (cx, cy) {
    const VOID_CODE = NODES.VOID.code
    const HONEY_CODE = NODES.HONEY.code

    const src = (cy << 10) | cx
    if (worldBuffer.readAt(src) !== VOID_CODE) return

    const visited = new Set()
    const queue = []
    let head = 0

    visited.add(src)
    queue.push(src)

    while (head < queue.length) {
      const idx = queue[head++]
      worldBuffer.writeAt(idx, HONEY_CODE)

      const neighbors = [idx - 1, idx + 1, idx - 1024, idx + 1024]
      for (let i = 0; i < 4; i++) {
        const nIdx = neighbors[i]
        if (visited.has(nIdx)) continue

        const nx = nIdx & 0x3FF
        const ny = nIdx >> 10

        if (nx <= 1 || nx >= 1022 || ny <= 1 || ny >= 510) continue
        if (ny < cy) continue
        if (worldBuffer.readAt(nIdx) !== VOID_CODE) continue

        visited.add(nIdx)
        queue.push(nIdx)
      }
    }
    return {index: src, nodeCode: HONEY_CODE}
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
 * Retourne le rectangle de zone correspondant à une colonne X.
 * @param {number} x
 * @returns {{biome, x0, x1, ySkySurface, ySurface, yUnder, yCavernsMid, yCaverns, yHell}}
 */
  getRectAt (x) {
    for (let i = 0; i < this.zoneRects.length; i++) {
      if (x <= this.zoneRects[i].x1) return this.zoneRects[i]
    }
    return this.zoneRects[this.zoneRects.length - 1]
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
   PROTECTION DES TUILES CONTRE LE CREUSEMENT
   ==================================================================================================== */

class TileGuard {
  #tiles

  constructor () {
    this.#tiles = new Set()
  }

  /**
   * Vide la liste des tuiles protégées.
   * À appeler depuis generate() avant les mini-biomes.
   */
  init () {
    this.#tiles.clear()
  }

  /**
   * Teste si une tuile est protégée.
   * @param {number} index
   * @returns {boolean}
   */
  has (index) {
    return this.#tiles.has(index)
  }

  /**
   * Protège une tuiles.
   * @param {number} index

   */
  add (index) {
    this.#tiles.add(index)
  }

  /**
   * Protège toutes les tuiles d'un rectangle.
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   */
  addRect (x1, y1, x2, y2) {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        this.#tiles.add((y << 10) | x)
      }
    }
  }

  /**
   * Protège les tuiles d'un cercle bruité (Perlin noise).
   * @param {number} cx
   * @param {number} cy
   * @param {number} radiusMin
   * @param {number} radiusMax
   * @param {number} frequency
   * @param {number} offsetX
   */
  addNoisyCircle (cx, cy, radiusMin, radiusMax, frequency = 0.3, offsetX = 0) {
    const radius = (radiusMin + radiusMax) >> 1
    const spread = radiusMax - radiusMin
    const period = 1 / frequency

    for (let dy = -radiusMax; dy <= radiusMax; dy++) {
      for (let dx = -radiusMax; dx <= radiusMax; dx++) {
        const d2 = dx * dx + dy * dy
        if (d2 > radiusMax * radiusMax) continue
        const dist = Math.sqrt(d2)
        const noise = seededRNG.randomPerlin((cx + dx + offsetX) / period, (cy + dy) / period)
        const threshold = radius + (noise * 2 - 1) * spread
        if (dist > threshold) continue
        const x = cx + dx
        const y = cy + dy
        if (x < 1 || x >= WORLD_WIDTH - 1 || y < 1 || y >= WORLD_HEIGHT - 1) continue
        this.#tiles.add((y << 10) | x)
      }
    }
  }

  /**
   * Protège les tuiles d'une ellipse bruitée (Perlin noise).
   * @param {number} cx
   * @param {number} cy
   * @param {number} radiusXMin
   * @param {number} radiusXMax
   * @param {number} radiusYMin
   * @param {number} radiusYMax
   * @param {number} frequency
   * @param {number} offsetX
   */
  addNoisyEllipse (cx, cy, radiusXMin, radiusXMax, radiusYMin, radiusYMax, frequency = 0.3, offsetX = 0) {
    const radiusX = (radiusXMin + radiusXMax) >> 1
    const radiusY = (radiusYMin + radiusYMax) >> 1
    const spreadX = radiusXMax - radiusXMin
    const spreadY = radiusYMax - radiusYMin
    const period = 1 / frequency

    for (let dy = -radiusYMax; dy <= radiusYMax; dy++) {
      for (let dx = -radiusXMax; dx <= radiusXMax; dx++) {
        const ndx = dx / radiusX
        const ndy = dy / radiusY
        const dist = Math.sqrt(ndx * ndx + ndy * ndy)

        const noise = seededRNG.randomPerlin((cx + dx + offsetX) / period, (cy + dy) / period)
        const spread = (spreadX + spreadY) * 0.5
        const threshold = 1 + (noise * 2 - 1) * (spread / ((radiusX + radiusY) * 0.5))

        if (dist > threshold) continue
        const x = cx + dx
        const y = cy + dy
        if (x < 1 || x >= WORLD_WIDTH - 1 || y < 1 || y >= WORLD_HEIGHT - 1) continue
        this.#tiles.add((y << 10) | x)
      }
    }
  }

  /**
 * Protège la moitié inférieure d'une ellipse bruitée (y >= cy).
 * Même algorithme que addNoisyEllipse — restreint aux tuiles sous le centre.
 *
 * @param {number} cx
 * @param {number} cy
 * @param {number} radiusXMin
 * @param {number} radiusXMax
 * @param {number} radiusYMin
 * @param {number} radiusYMax
 * @param {number} frequency
 * @param {number} offsetX
 */
  addNoisyEllipseBottom (cx, cy, radiusXMin, radiusXMax, radiusYMin, radiusYMax, frequency = 0.3, offsetX = 0) {
    const radiusX = (radiusXMin + radiusXMax) >> 1
    const radiusY = (radiusYMin + radiusYMax) >> 1
    const spreadX = radiusXMax - radiusXMin
    const spreadY = radiusYMax - radiusYMin
    const period = 1 / frequency

    for (let dy = 0; dy <= radiusYMax; dy++) {
      for (let dx = -radiusXMax; dx <= radiusXMax; dx++) {
        const ndx = dx / radiusX
        const ndy = dy / radiusY
        const dist = Math.sqrt(ndx * ndx + ndy * ndy)

        const noise = seededRNG.randomPerlin((cx + dx + offsetX) / period, (cy + dy) / period)
        const spread = (spreadX + spreadY) * 0.5
        const threshold = 1 + (noise * 2 - 1) * (spread / ((radiusX + radiusY) * 0.5))

        if (dist > threshold) continue
        const x = cx + dx
        const y = cy + dy
        if (x < 1 || x >= WORLD_WIDTH - 1 || y < 1 || y >= WORLD_HEIGHT - 1) continue
        this.#tiles.add((y << 10) | x)
      }
    }
  }

  /**
 * Protège les tuiles d'un rectangle bruité (Perlin noise) sur les 4 bords.
 * Même algorithme que addNoisyEllipse — distance de Chebyshev normalisée.
 *
 * @param {number} cx
 * @param {number} cy
 * @param {number} radiusXMin
 * @param {number} radiusXMax
 * @param {number} radiusYMin
 * @param {number} radiusYMax
 * @param {number} frequency
 * @param {number} offsetX
 */
  addNoisyRect (cx, cy, radiusXMin, radiusXMax, radiusYMin, radiusYMax, frequency = 0.3, offsetX = 0) {
    const radiusX = (radiusXMin + radiusXMax) >> 1
    const radiusY = (radiusYMin + radiusYMax) >> 1
    const spreadX = radiusXMax - radiusXMin
    const spreadY = radiusYMax - radiusYMin
    const period = 1 / frequency

    for (let dy = -radiusYMax; dy <= radiusYMax; dy++) {
      for (let dx = -radiusXMax; dx <= radiusXMax; dx++) {
        const dist = Math.max(Math.abs(dx) / radiusX, Math.abs(dy) / radiusY)

        const noise = seededRNG.randomPerlin((cx + dx + offsetX) / period, (cy + dy) / period)
        const spread = (spreadX + spreadY) * 0.5
        const threshold = 1 + (noise * 2 - 1) * (spread / ((radiusX + radiusY) * 0.5))

        if (dist > threshold) continue
        const x = cx + dx
        const y = cy + dy
        if (x < 1 || x >= WORLD_WIDTH - 1 || y < 1 || y >= WORLD_HEIGHT - 1) continue
        this.#tiles.add((y << 10) | x)
      }
    }
  }

  /**
 * DEBUG — affiche les tuiles protégées en orange dans WorldMapDebug.
 * Commenter/décommenter l'appel dans generate() pour activer/désactiver.
 */
  debug () {
    for (const index of this.#tiles) {
      window.DEBUG_POINTS.push({x: index & 0x3FF, y: index >> 10, color: 'lime'})
    }
  }
}

export const tileGuard = new TileGuard()

/* ====================================================================================================
   CREUSEMENT DE TUNNELS ET DE CAVERNES DANS LE MONDE
   ==================================================================================================== */

const DEFAULT_EXCLUDED = new Set([
  NODES.FOG.code, NODES.DEEPSEA.code, NODES.BASALT.code, NODES.LAVA.code,
  NODES.SKY.code, NODES.WATER.code, NODES.SEA.code, NODES.HONEY.code,
  NODES.SAP.code, NODES.HIVE.code, NODES.WEB.code, NODES.SAPROCK.code, NODES.HARDROCK.code,
  NODES.HEART.code
])

const ETERNAL_EXCLUDED = new Set([
  NODES.FOG.code, NODES.DEEPSEA.code, NODES.BASALT.code, NODES.LAVA.code
])

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
 * Creuse un rectangle bruité (Perlin noise) sur les 4 bords.
 * Même algorithme que digNoisyEllipse — distance de Chebyshev normalisée.
 *
 * @param {Array} tiles
 * @param {number} cx
 * @param {number} cy
 * @param {number} radiusXMin
 * @param {number} radiusXMax
 * @param {number} radiusYMin
 * @param {number} radiusYMax
 * @param {number} code
 * @param {number} frequency
 * @param {number} offsetX
 */
  digNoisyRect (tiles, cx, cy, radiusXMin, radiusXMax, radiusYMin, radiusYMax, code, frequency = 0.3, offsetX = 0) {
    const radiusX = (radiusXMin + radiusXMax) >> 1
    const radiusY = (radiusYMin + radiusYMax) >> 1
    const spreadX = radiusXMax - radiusXMin
    const spreadY = radiusYMax - radiusYMin
    const period = 1 / frequency

    for (let dy = -radiusYMax; dy <= radiusYMax; dy++) {
      for (let dx = -radiusXMax; dx <= radiusXMax; dx++) {
        const dist = Math.max(Math.abs(dx) / radiusX, Math.abs(dy) / radiusY)

        const noise = seededRNG.randomPerlin((cx + dx + offsetX) / period, (cy + dy) / period)
        const spread = (spreadX + spreadY) * 0.5
        const threshold = 1 + (noise * 2 - 1) * (spread / ((radiusX + radiusY) * 0.5))

        if (dist > threshold) continue
        const x = cx + dx
        const y = cy + dy
        if (x < 1 || x >= WORLD_WIDTH - 1 || y < 1 || y >= WORLD_HEIGHT - 1) continue
        tiles.push({x, y, index: (y << 10) | x, code})
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
  applyTiles (tiles, excluded = DEFAULT_EXCLUDED) {
    let x1 = WORLD_WIDTH
    let y1 = WORLD_HEIGHT
    let x2 = 0
    let y2 = 0

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i]
      if (tile.x < 0 || tile.x >= WORLD_WIDTH) continue
      if (tile.y < 0 || tile.y >= WORLD_HEIGHT) continue
      if (excluded.has(worldBuffer.readAt(tile.index))) continue
      if (tileGuard.has(tile.index)) continue
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
      const dx = Math.round(radius * Math.sin(alpha))
      const dy = Math.round(radius * Math.cos(alpha))

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
  carveAlongPath (path, offsetX = 0, excluded = DEFAULT_EXCLUDED) {
    const code = NODES.VOID.code

    const tiles = []
    for (let j = 0; j < path.length; j++) {
      const p = path[j]
      this.digNoisyCircle(tiles, p.x, p.y, p.radiusMin, p.radiusMax, code, 0.3, offsetX)
    }
    this.applyTiles(tiles, excluded)
  }

  /**
 * Remplace toutes les tuiles d'un rectangle par un code donné.
 * Aucun test de protection — à utiliser uniquement dans des zones
 * garanties hors ghost cells et hors ETERNAL.
 *
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} code
 */
  fillRect (x0, y0, x1, y1, code) {
    for (let y = y0; y <= y1; y++) {
      let idx = (y << 10) | x0
      for (let x = x0; x <= x1; x++) {
        worldBuffer.writeAt(idx++, code)
      }
    }
  }

  /**
 * Retourne le rectangle englobant de deux rectangles {x1, y1, x2, y2}.
 * @param {{x1, y1, x2, y2}} a
 * @param {{x1, y1, x2, y2}} b
 * @returns {{x1, y1, x2, y2}}
 */
  boundingRect (a, b) {
    return {
      x1: Math.min(a.x1, b.x1),
      y1: Math.min(a.y1, b.y1),
      x2: Math.max(a.x2, b.x2),
      y2: Math.max(a.y2, b.y2)
    }
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
  digSurfaceTunnel (skySurface, lakes) {
    const MAX_ATTEMPTS = 100
    const count = seededRNG.randomGetMinMax(20, 30)
    for (let i = 0; i < count; i++) {
      const radius = seededRNG.randomGetMinMax(4, 7)

      let x0
      let attempts = 0
      do {
        x0 = seededRNG.randomGetMinMax(150, WORLD_WIDTH - 151)
        attempts++
      } while (attempts < MAX_ATTEMPTS && lakes.some(l => Math.abs(x0 - l.cx) < (3 * LAKE_RADIUS_X_MAX)))
      if (attempts >= MAX_ATTEMPTS) continue

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
 */
  digZigzagTunnels (lakes) {
    const ZIGZAG_EXCLUSION_W = 25
    const ZIGZAG_EXCLUSION_H = 20
    const ZIGZAG_EXCLUSION_W2 = 15
    const ZIGZAG_EXCLUSION_H2 = 10
    const ZIGZAG_MIN_DISTANCE = 200
    const MAX_ATTEMPTS = 100

    const count = seededRNG.randomGetMinMax(2, 3)
    const startXs = [] // X des tunnels déjà creusés

    const isTooClose = (x) => {
      for (let i = 0; i < startXs.length; i++) {
        if (Math.abs(x - startXs[i]) < ZIGZAG_MIN_DISTANCE) return true
      }
      return false
    }

    const isNearLake = (x, y, attempts) => {
      const hw = attempts < 50 ? ZIGZAG_EXCLUSION_W : ZIGZAG_EXCLUSION_W2
      const hh = attempts < 50 ? ZIGZAG_EXCLUSION_H : ZIGZAG_EXCLUSION_H2
      for (let i = 0; i < lakes.length; i++) {
        const l = lakes[i]
        if (x + hw >= l.cx - LAKE_RADIUS_X_MAX &&
       x - hw <= l.cx + LAKE_RADIUS_X_MAX &&
       y + 2 * hh >= l.cy - LAKE_RADIUS_Y_MAX &&
       y <= l.cy + LAKE_RADIUS_Y_MAX) return true
      }
      return false
    }

    let attempts = 0
    let dug = 0
    while (dug < count && attempts < MAX_ATTEMPTS) {
      attempts++
      let x = seededRNG.randomGetMinMax(150, WORLD_WIDTH - 151)
      if (isTooClose(x)) continue

      let y = 32
      let length = 0
      const lengthMax = seededRNG.randomGetMinMax(240, 320)
      let aborted = false

      while (length < lengthMax) {
        const segmentLength = seededRNG.randomGetMinMax(lengthMax / 5 | 0, lengthMax / 4 | 0)
        const angle = seededRNG.randomGetBool()
          ? seededRNG.randomGetMinMax(130, 160)
          : seededRNG.randomGetMinMax(200, 230)
        const radius = seededRNG.randomGetMinMax(8, 10)
        const path = this.pathTunnel(x, y, radius, segmentLength, angle, 10)

        // Test uniquement sur le premier tronçon
        if (length === 0) {
          for (let i = 0; i < path.length; i++) {
            if (isNearLake(path[i].x, path[i].y, attempts)) { aborted = true; break }
          }
          if (aborted) break
        }

        this.carveAlongPath(path, PERLIN_OFFSET_SURFACE_TUNNEL)

        length += segmentLength
        x = path[path.length - 1].x
        y = path[path.length - 1].y
      }

      if (!aborted) {
        startXs.push(x)
        dug++
      }
    }

    // let y = 32
    // let x = seededRNG.randomGetMinMax(150, WORLD_WIDTH - 151)

    // let length = 0
    // const lengthMax = seededRNG.randomGetMinMax(240, 320)

    // while (length < lengthMax) {
    //   const segmentLength = seededRNG.randomGetMinMax(lengthMax / 5 | 0, lengthMax / 4 | 0)
    //   const angle = seededRNG.randomGetBool()
    //     ? seededRNG.randomGetMinMax(130, 160)
    //     : seededRNG.randomGetMinMax(200, 230)
    //   const radius = seededRNG.randomGetMinMax(8, 10)
    //   const path = this.pathTunnel(x, y, radius, segmentLength, angle, 10)
    //   this.carveAlongPath(path, PERLIN_OFFSET_SURFACE_TUNNEL)

    //   length += segmentLength
    //   x = path[path.length - 1].x
    //   y = path[path.length - 1].y
    // }
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
 * @returns {{cx, cy, radius}|null, liquidBody: {index, nodeCode}} — null si MAX_ATTEMPTS épuisé
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
    const rect2 = this.applyTiles(tiles, ETERNAL_EXCLUDED)

    const path = this.pathTunnel(cx, cy, 4, length, angle, 10)
    this.carveAlongPath(path, PERLIN_OFFSET_HIVE, ETERNAL_EXCLUDED)

    const liquidBody = liquidFiller.fillHive(cx, cy + 2)

    this.addExclusion(rect2)
    tileGuard.addNoisyCircle(cx, cy, radius + 2, radius + 6, 0.3, PERLIN_OFFSET_HIVE)

    return {cx, cy, radius, liquidBody}
  }

  /**
 * Creuse hiveCount ruches en zone JUNGLE (underground → caverns_top).
 * 1 monde sur 2 : une ruche intrusion est placée dans un biome étranger (FOREST ou DESERT),
 * dans la même layer que les ruches normales.
 * Le remplissage HONEY est différé.
 *
 * @param {{forest, desert, jungle}} biomeCounts
 * @returns {Array<{cx, cy, radius, liquidBody: {index, nodeCode}}>}
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
 * Creuse un lac de surface par zone de biome.
 * Forme : ellipse horizontale (corps principal) + ellipse verticale bruitée (fosse centrale).
 * Les bords et le fond sont protégés par des nodes CREATION spécifiques au biome,
 * remplacés après creusement par le substrat natif.
 * Le remplissage WATER est différé.
 *
 * Prérequis : initZoneRects()
 * @returns {Array<{cx, cy, biome, layer, liquidBody: {index, nodeCode}}>}
 */

  digSurfaceLakes (skySurface) {
    const lakes = []
    let prevCx = -1

    for (let i = 1; i < this.#zoneRects.length - 1; i++) {
      const rect = this.#zoneRects[i]

      // Passe 0 - localisation et taille du Lake/Oasis
      const radiusX = seededRNG.randomGetMinMax(LAKE_RADIUS_X_MIN, LAKE_RADIUS_X_MAX)
      const radiusY = seededRNG.randomGetMinMax(LAKE_RADIUS_Y_MIN, LAKE_RADIUS_Y_MAX)

      const minCx = prevCx + 2 * LAKE_RADIUS_X_MAX + 4 // marge de 4 tuiles pour les berges
      const x0 = Math.max(rect.x0 + radiusX, minCx)
      const x1 = rect.x1 - radiusX

      if (x0 > x1) continue // zone trop étroite pour placer un lac — on passe

      const cx = seededRNG.randomGetMinMax(x0, x1)
      prevCx = cx
      // cy = minimum de skySurface sur la largeur du lac
      let cy = 0
      for (let x = cx - radiusX; x <= cx + radiusX; x++) {
        if (skySurface[x] > cy) cy = skySurface[x]
      }
      cy -= 1

      // Passe 1 - ellipse horizontale principale
      const tiles = []
      this.digNoisyEllipse(tiles, cx, cy, radiusX - 1, radiusX, radiusY - 1, radiusY, NODES.SKY.code, 0.2, PERLIN_OFFSET_LAKES)
      const rect2 = this.applyTiles(tiles, ETERNAL_EXCLUDED)

      // Passe 2 - Pit — ellipse verticale bruitée, centre décalé vers le bas
      const pitOffsetX = seededRNG.randomGetMinMax(-3, 3)
      const pitCx = cx + pitOffsetX
      const pitCy = cy + radiusY // bord inférieur de l'ellipse principale
      const pitRadiusX = seededRNG.randomGetMinMax(LAKE_PIT_RADIUS_X_MIN, LAKE_PIT_RADIUS_X_MAX)
      const pitRadiusY = seededRNG.randomGetMinMax(LAKE_PIT_RADIUS_Y_MIN, LAKE_PIT_RADIUS_Y_MAX)

      const pitTiles = []
      this.digNoisyEllipse(pitTiles, pitCx, pitCy, pitRadiusX - 1, pitRadiusX, pitRadiusY - 1, pitRadiusY, NODES.SKY.code, 0.4, PERLIN_OFFSET_CAVERN)
      const rect3 = this.applyTiles(pitTiles, ETERNAL_EXCLUDED)

      // Passe 3 : remplir le base de l'ellipse par du WATER
      const lakeCreation = LAKE_CREATION_MAP[rect.biome]
      const liquidBody = liquidFiller.fillLake(cx, cy, radiusX, lakeCreation.side)

      // Passe 4 : Nettoyage des tuiles volantes au-dessus du lac
      const cleanX0 = Math.round(cx - radiusX * 0.6)
      const cleanX1 = Math.round(cx + radiusX * 0.6)
      this.fillRect(cleanX0, 32, cleanX1, cy - 1, NODES.SKY.code)

      // ── Passe 5 - Consolidation des berges ──────────────────────────────────────────────
      const WATER_CODE = NODES.WATER.code
      const sideCode = lakeCreation.side
      const boundY2 = Math.max(rect2.y2, rect3.y2)
      const boundX1 = Math.min(rect2.x1, rect3.x1)
      const boundX2 = Math.max(rect2.x2, rect3.x2)

      for (let y = cy; y <= boundY2; y++) {
        for (let x = boundX1 - 1; x <= boundX2; x++) {
          const curr = worldBuffer.read(x, y)
          const next = worldBuffer.read(x + 1, y)

          // Transition SUBSTRAT → WATER
          if (curr !== WATER_CODE && next === WATER_CODE) {
            worldBuffer.write(x, y, sideCode)
            worldBuffer.write(x - 1, y, sideCode)
          }

          // Transition WATER → SUBSTRAT
          if (curr === WATER_CODE && next !== WATER_CODE) {
            worldBuffer.write(x + 1, y, sideCode)
            worldBuffer.write(x + 2, y, sideCode)
          }
        }
      }

      // ── PASSE 6 - Consolidation du fond ─────────────────────────────────────────────────
      const bedCode = lakeCreation.bed
      const SIDE_CODE = lakeCreation.side

      for (let x = boundX1 - 1; x <= boundX2 + 1; x++) {
        for (let y = cy; y <= boundY2 + 2; y++) {
          const curr = worldBuffer.read(x, y)
          const next = worldBuffer.read(x, y + 1)

          // Transition WATER → pas d'eau (fond inférieur)
          if (curr === WATER_CODE && next !== WATER_CODE) {
            if (worldBuffer.read(x, y + 1) !== SIDE_CODE) worldBuffer.write(x, y + 1, bedCode)
            if (worldBuffer.read(x, y + 2) !== SIDE_CODE) worldBuffer.write(x, y + 2, bedCode)
          }

          // Transition pas d'eau → WATER (fond supérieur du pit)
          if (curr !== WATER_CODE && next === WATER_CODE) {
            if (worldBuffer.read(x, y) !== SIDE_CODE) worldBuffer.write(x, y, bedCode)
            if (worldBuffer.read(x, y - 1) !== SIDE_CODE) worldBuffer.write(x, y - 1, bedCode)
          }
        }
      }

      // ── Passe 75 : exclusion ───────────────────────────────────────────────
      this.addExclusion(this.boundingRect(rect2, rect3))
      tileGuard.addNoisyEllipse(cx, cy, radiusX + 3, radiusX + 5, radiusY + 3, radiusY + 5, 0.8, PERLIN_OFFSET_LAKES)
      tileGuard.addNoisyEllipse(pitCx, pitCy, pitRadiusX + 3, pitRadiusX + 5, pitRadiusY + 3, pitRadiusY + 5, 0.8, PERLIN_OFFSET_LAKES)
      lakes.push({cx, cy, biome: rect.biome, layer: 'surface', liquidBody})
      // window.DEBUG_POINTS.push({x: cx, y: cy, color: 'orange'}) // DEBUG
    }

    return lakes
  }

  /**
 * Creuse des lacs souterrains ellipsoïdaux bruités.
 * Une dizaine en zone under, une quinzaine en zone caverns_top.
 * Remplissage WATER différé.
 *
 * @param {Int16Array} surfaceUnder
 * @param {Int16Array} underCaverns
 * @returns {Array<{cx, cy, radiusX, radiusY}>}
 */
  digUndergroundLakes (surfaceUnder, underCaverns) {
    const lakes = []

    const digOne = (y0, y1, layer) => {
      const radiusX = seededRNG.randomGetMinMax(UNDERGROUND_LAKE_RADIUS_MIN, UNDERGROUND_LAKE_RADIUS_MAX)
      const radiusY = seededRNG.randomGetMinMax(UNDERGROUND_LAKE_RADIUS_MIN, UNDERGROUND_LAKE_RADIUS_MAX)
      const cx = seededRNG.randomGetMinMax(radiusX + 2, WORLD_WIDTH - radiusX - 3)
      const cy = seededRNG.randomGetMinMax(y0 + radiusY, y1 - radiusY)

      if (this.isExcluded(cx - radiusX, cy - radiusY, cx + radiusX, cy + radiusY)) return

      // creusement d'une ellipse bruitée
      const tiles = []
      this.digNoisyEllipse(tiles, cx, cy, radiusX - 1, radiusX, radiusY - 1, radiusY, NODES.VOID.code, 0.3, PERLIN_OFFSET_LAKES)
      const rect = this.applyTiles(tiles)
      this.addExclusion(rect)

      // blocage des tuiles sous l'ellipse
      tileGuard.addNoisyEllipseBottom(cx, cy, radiusX + 2, radiusX + 4, radiusY + 2, radiusY + 4, 0.8, PERLIN_OFFSET_LAKES)

      // ajout de la WATER
      const liquidBody = liquidFiller.fillLake(cx, cy + 1, radiusX + 4, NODES.WATER.code)

      const biome = clusterGenerator.getRectAt(cx).biome
      lakes.push({cx, cy, biome, layer, liquidBody})
    }

    for (let i = 0; i < UNDERGROUND_LAKE_UNDER_COUNT; i++) {
      const x = seededRNG.randomGetMinMax(2, WORLD_WIDTH - 3)
      digOne(surfaceUnder[x], underCaverns[x], 'under')
    }

    for (let i = 0; i < UNDERGROUND_LAKE_CAVERNS_COUNT; i++) {
      const x = seededRNG.randomGetMinMax(2, WORLD_WIDTH - 3)
      digOne(underCaverns[x], Math.round((underCaverns[x] + 510) / 2), 'caverns_top')
    }
    return lakes
  }

  /**
 * Creuse BLIND_LAKE_COUNT lacs aveugles ellipsoïdaux bruités en caverns_bottom.
 * Rayons plus grands que les lacs souterrains — protection TileGuard complète.
 * Remplissage WATER différé.
 *
 * @param {Int16Array} underCaverns - Altitudes haute caverne par colonne X
 * @returns {Array<{cx, cy, biome, layer, liquidBody: {index, nodeCode}}>}
 */
  digBlindLakes (underCaverns) {
    const lakes = []

    for (let i = 0; i < BLIND_LAKE_COUNT; i++) {
      const radiusX = seededRNG.randomGetMinMax(BLIND_LAKE_RADIUS_MIN, BLIND_LAKE_RADIUS_MAX)
      const radiusY = seededRNG.randomGetMinMax(BLIND_LAKE_RADIUS_MIN, BLIND_LAKE_RADIUS_MAX)
      const cx = seededRNG.randomGetMinMax(radiusX + 2, WORLD_WIDTH - radiusX - 3)
      const y0 = Math.round((underCaverns[cx] + 510) / 2)
      const cy = seededRNG.randomGetMinMax(y0 + radiusY, 508 - radiusY)

      if (this.isExcluded(cx - radiusX, cy - radiusY, cx + radiusX, cy + radiusY)) continue

      const tiles = []
      this.digNoisyEllipse(tiles, cx, cy, radiusX - 1, radiusX, radiusY - 1, radiusY, NODES.VOID.code, 0.3, PERLIN_OFFSET_LAKES)
      const rect = this.applyTiles(tiles)
      this.addExclusion(rect)

      tileGuard.addNoisyEllipse(cx, cy, radiusX + 1, radiusX + 3, radiusY + 1, radiusY + 3, 0.8, PERLIN_OFFSET_LAKES)

      const liquidBody = liquidFiller.fillLake(cx, cy + 1, radiusX + 4, NODES.WATER.code)
      const biome = clusterGenerator.getRectAt(cx).biome

      lakes.push({cx, cy, biome, layer: 'caverns_bottom', liquidBody})
    }

    return lakes
  }

  /**
 * Creuse SAP_LAKE_UNDER_COUNT lacs de sève en zone under et SAP_LAKE_CAVERNS_COUNT
 * en caverns_top, uniquement dans le biome JUNGLE.
 * Protection TileGuard sur la demi-ellipse inférieure. Remplissage SAP différé.
 *
 * @param {Int16Array} surfaceUnder
 * @param {Int16Array} underCaverns
 * @returns {Array<{cx, cy, biome, layer, liquidBody: {index, nodeCode}}>}
 */
  digSapLakes (surfaceUnder, underCaverns) {
    const SAP = NODES.SAP.code
    const lakes = []

    const jungleRects = this.#zoneRects.filter(r => r.biome === BIOME_TYPE.JUNGLE)
    if (jungleRects.length === 0) return lakes

    const digOne = (rect, layer) => {
      const radiusX = seededRNG.randomGetMinMax(SAP_LAKE_RADIUS_MIN, SAP_LAKE_RADIUS_MAX)
      const radiusY = seededRNG.randomGetMinMax(SAP_LAKE_RADIUS_MIN, SAP_LAKE_RADIUS_MAX)
      const cx = seededRNG.randomGetMinMax(rect.x0 + radiusX + 2, rect.x1 - radiusX - 2)

      const y0 = layer === 'under' ? rect.ySurface : rect.yUnder
      const y1 = layer === 'under' ? rect.yUnder : rect.yCavernsMid
      const cy = seededRNG.randomGetMinMax(y0 + radiusY, y1 - radiusY)
      if (this.isExcluded(cx - radiusX, cy - radiusY, cx + radiusX, cy + radiusY)) return

      const tiles = []
      this.digNoisyEllipse(tiles, cx, cy, radiusX - 1, radiusX, radiusY - 1, radiusY, NODES.VOID.code, 0.3, PERLIN_OFFSET_CAVERN)
      const applyRect = this.applyTiles(tiles)
      this.addExclusion(applyRect)

      tileGuard.addNoisyEllipseBottom(cx, cy, radiusX + 1, radiusX + 3, radiusY + 1, radiusY + 3, 0.8, PERLIN_OFFSET_CAVERN)

      const liquidBody = liquidFiller.fillLake(cx, cy + 1, radiusX + 4, SAP, SAP)
      lakes.push({cx, cy, biome: BIOME_TYPE.JUNGLE, layer, liquidBody})
    }

    for (let i = 0; i < SAP_LAKE_UNDER_COUNT; i++) {
      digOne(seededRNG.randomGetArrayValue(jungleRects), 'under')
    }

    for (let i = 0; i < SAP_LAKE_CAVERNS_COUNT; i++) {
      digOne(seededRNG.randomGetArrayValue(jungleRects), 'caverns_top')
    }

    return lakes
  }

  /**
 * Creuse SAP_POCKET_COUNT poches de sève ellipsoïdales bruitées en caverns_bottom,
 * uniquement dans le biome JUNGLE.
 * Protection TileGuard complète. Remplissage SAP différé.
 *
 * @param {Int16Array} underCaverns - Altitudes haute caverne par colonne X
 * @returns {Array<{cx, cy, biome, layer, liquidBody: {index, nodeCode}}>}
 */
  digSapPockets (underCaverns) {
    const SAP = NODES.SAP.code
    const pockets = []

    const jungleRects = []
    for (let i = 0; i < this.#zoneRects.length; i++) {
      if (this.#zoneRects[i].biome === BIOME_TYPE.JUNGLE) jungleRects.push(this.#zoneRects[i])
    }
    if (jungleRects.length === 0) return pockets

    for (let i = 0; i < SAP_POCKET_COUNT; i++) {
      const radiusX = seededRNG.randomGetMinMax(SAP_POCKET_RADIUS_MIN, SAP_POCKET_RADIUS_MAX)
      const radiusY = seededRNG.randomGetMinMax(SAP_POCKET_RADIUS_MIN, SAP_POCKET_RADIUS_MAX)
      const rect = seededRNG.randomGetArrayValue(jungleRects)
      const cx = seededRNG.randomGetMinMax(rect.x0 + radiusX + 2, rect.x1 - radiusX - 2)
      const y0 = Math.round((underCaverns[cx] + 510) / 2)
      const cy = seededRNG.randomGetMinMax(y0 + radiusY, 508 - radiusY)

      if (this.isExcluded(cx - radiusX, cy - radiusY, cx + radiusX, cy + radiusY)) continue

      const tiles = []
      this.digNoisyEllipse(tiles, cx, cy, radiusX - 1, radiusX, radiusY - 1, radiusY, NODES.VOID.code, 0.3, PERLIN_OFFSET_LAKES)
      const applyRect = this.applyTiles(tiles)
      this.addExclusion(applyRect)

      tileGuard.addNoisyEllipse(cx, cy, radiusX + 1, radiusX + 3, radiusY + 1, radiusY + 3, 0.8, PERLIN_OFFSET_LAKES)

      const liquidBody = liquidFiller.fillLake(cx, cy + 1, radiusX + 4, SAP, SAP)
      pockets.push({cx, cy, biome: BIOME_TYPE.JUNGLE, layer: 'caverns_bottom', liquidBody})
    }

    return pockets
  }

  /**
 * Vérifie qu'au moins une tuile de la surface supérieure de la flaque
 * a du VOID au-dessus d'elle — détecte les poches fermées.
 *
 * @param {Set<number>} visited - Index des tuiles de la flaque (résultat du BFS)
 * @param {number} yMin - Y minimal de la flaque
 * @returns {boolean} — true si la flaque est ouverte vers le haut
 */
  #isPuddleOpen (visited, yMin) {
    const VOID = NODES.VOID.code

    for (const idx of visited) {
      if ((idx >> 10) === yMin) {
        if (worldBuffer.readAt(idx - WORLD_WIDTH) === VOID) return true
      }
    }
    return false
  }

  /**
 * Suit l'écoulement depuis (x, y) dans la direction dx jusqu'au point bas.
 * Descend verticalement, puis se déplace latéralement si possible, et recommence.
 * S'arrête quand le déplacement latéral est bloqué et qu'on ne peut pas descendre.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} dx - Direction : 1 (droite) ou -1 (gauche)
 * @returns {{x, y}|null} — coordonnées du point bas, ou null si ETERNAL atteint
 */
  #flowToBottom (x, y, dx) {
    const VOID = NODES.VOID.code

    while (true) {
    // Descendre jusqu'au sol
      while (worldBuffer.read(x, y + 1) === VOID) {
        y++
        if (ETERNAL_EXCLUDED.has(worldBuffer.read(x, y))) return null
      }

      // Regarder latéralement
      const nx = x + dx
      if (nx <= 1 || nx >= WORLD_WIDTH - 2) return {x, y}

      if (worldBuffer.read(nx, y) === VOID) {
        x = nx // se déplacer latéralement
      } else {
        return {x, y} // bloqué → point bas trouvé
      }
    }
  }

  /**
 * Teste si un remplissage depuis (cx, cy) crée une flaque de hauteur valide.
 * Descend depuis cy jusqu'à la première tuile solide, puis BFS sur les VOID adjacents.
 * Annule si la hauteur dépasse PUDDLE_HEIGHT_MAX. Effectue le vrai fill si valide.
 *
 * @param {number} cx
 * @param {number} cy - Point de départ — doit être VOID
 * @param {number} nodeCode - Code du liquide à poser (WATER ou SAP)
 * @returns {{index: number, nodeCode: number}|null} — null si hauteur invalide
 */
  #tryFillPuddle (cx, cy, nodeCode) {
    const VOID = NODES.VOID.code
    const LIQUID = new Set([NODES.WATER.code, NODES.SEA.code, NODES.HONEY.code, NODES.SAP.code, NODES.GRASSFERN.code])
    const yStart = cy

    const visited = new Set()
    const queue = []
    let head = 0
    let yMin = yStart

    if (LIQUID.has(worldBuffer.read(cx, cy + 1))) return null

    const src = (yStart << 10) | cx
    visited.add(src)
    queue.push(src)

    while (head < queue.length) {
      const idx = queue[head++]
      const ny = idx >> 10

      if (ny > yStart) return null
      if (ny < yMin) yMin = ny

      const neighbors = [idx - 1, idx + 1, idx - 1024, idx + 1024]
      for (let i = 0; i < 4; i++) {
        const nIdx = neighbors[i]
        if (visited.has(nIdx)) continue
        const nnx = nIdx & 0x3FF
        const nny = nIdx >> 10
        if (nnx <= 1 || nnx >= 1022 || nny <= 1 || nny >= 510) continue
        if (nny <= yStart - PUDDLE_HEIGHT_MAX) continue
        if (worldBuffer.readAt(nIdx) !== VOID) {
          if (LIQUID.has(worldBuffer.readAt(nIdx))) return null
          continue
        }
        visited.add(nIdx)
        queue.push(nIdx)
      }
    }

    if (yStart - yMin < PUDDLE_HEIGHT_MIN - 1) return null
    if (!this.#isPuddleOpen(visited, yMin)) return null

    // Vrai fill
    for (const idx of visited) {
      worldBuffer.writeAt(idx, nodeCode)
    }

    // return {index: src, nodeCode, cx, yStart}
    return {index: src, nodeCode}
  }

  /**
 * Creuse WATER_PUDDLE_COUNT flaques d'eau dans les zones under et caverns.
 * Hauteur comprise entre PUDDLE_HEIGHT_MIN et PUDDLE_HEIGHT_MAX tuiles.
 *
 * @param {Int16Array} surfaceUnder
 * @returns {Array<{index, nodeCode}>}
 */
  digWaterPuddles (surfaceUnder) {
    const WATER = NODES.WATER.code
    const liquidBodies = []
    let attempts = 0
    let count = 0

    while (count < WATER_PUDDLE_COUNT && attempts < WATER_PUDDLE_COUNT * 100) {
      attempts++
      const x = seededRNG.randomGetMinMax(2, WORLD_WIDTH - 3)
      const y = seededRNG.randomGetMinMax(surfaceUnder[x], WORLD_HEIGHT - 32)
      if (worldBuffer.read(x, y) !== NODES.VOID.code) continue

      // recherche d'un point bas
      const dx = seededRNG.randomGetBool() ? 1 : -1
      const bottom1 = this.#flowToBottom(x, y, dx)
      if (bottom1) {
        const lb = this.#tryFillPuddle(bottom1.x, bottom1.y, WATER)
        if (lb) { liquidBodies.push(lb); count++ }
      }
      if (count < WATER_PUDDLE_COUNT) {
        const bottom2 = this.#flowToBottom(x, y, -dx)
        if (bottom2) {
          const lb = this.#tryFillPuddle(bottom2.x, bottom2.y, WATER)
          if (lb) { liquidBodies.push(lb); count++ }
        }
      }
    }

    console.log('BBBBBBBBBBBBBBBBC digWaterPuddles', {WATER_PUDDLE_COUNT, liquidBodies})

    return liquidBodies
  }

  /**
 * Creuse SAP_PUDDLE_COUNT flaques de sève dans les zones under et caverns,
 * uniquement en biome JUNGLE.
 *
 * @param {Int16Array} surfaceUnder
 * @returns {Array<{index, nodeCode}>}
 */
  digSapPuddles (surfaceUnder) {
    const SAP = NODES.SAP.code
    const liquidBodies = []
    const jungleRects = []
    for (let i = 0; i < this.#zoneRects.length; i++) {
      if (this.#zoneRects[i].biome === BIOME_TYPE.JUNGLE) jungleRects.push(this.#zoneRects[i])
    }
    if (jungleRects.length === 0) return liquidBodies

    let attempts = 0
    let count = 0

    while (count < SAP_PUDDLE_COUNT && attempts < SAP_PUDDLE_COUNT * 100) {
      attempts++
      const rect = seededRNG.randomGetArrayValue(jungleRects)
      const x = seededRNG.randomGetMinMax(rect.x0 + 2, rect.x1 - 2)
      const y = seededRNG.randomGetMinMax(surfaceUnder[x], WORLD_HEIGHT - 32)
      if (worldBuffer.read(x, y) !== NODES.VOID.code) continue

      const dx = seededRNG.randomGetBool() ? 1 : -1
      const bottom1 = this.#flowToBottom(x, y, dx)
      if (bottom1) {
        const lb = this.#tryFillPuddle(bottom1.x, bottom1.y, SAP)
        if (lb) { liquidBodies.push(lb); count++ }
      }
      if (count < SAP_PUDDLE_COUNT) {
        const bottom2 = this.#flowToBottom(x, y, -dx)
        if (bottom2) {
          const lb = this.#tryFillPuddle(bottom2.x, bottom2.y, SAP)
          if (lb) { liquidBodies.push(lb); count++ }
        }
      }
    }

    console.log('BBBBBBBBBBBBBBBBC digSapPuddles', {SAP_PUDDLE_COUNT, liquidBodies})

    return liquidBodies
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

    // ajout des toiles d'araignées au plafond
    webFiller.fillCobwebCave(cx, cy)

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
      const rect = clusterGenerator.getRectAt(cx)

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
      const rect = clusterGenerator.getRectAt(cx)

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
 * Place HEART_COUNT spots de Life Heart (2×2) dans la layer underground.
 * Chaque spot nécessite 16 tuiles solides (carré 4×4 centré sur le coin haut-gauche).
 * Fallback automatique en caverns_top si le quota n'est pas atteint en underground.
 * Les spots sont enregistrés dans #exclusions.
 *
 * @param {Int16Array} surfaceUnder  - Altitudes basse surface par colonne X
 * @param {Int16Array} underCaverns  - Altitudes haute caverne par colonne X
 * @returns {Array<{cx, cy}>} - coin haut-gauche du carré
 */
  digHearts (surfaceUnder, underCaverns) {
    const MAX_ATTEMPTS = 100
    const HEART_COUNT = 15
    const VOID = NODES.VOID.code
    const LIQUID_OR_GAZ = new Set([
      NODES.VOID.code,
      NODES.SKY.code,
      NODES.FOG.code,
      NODES.WATER.code,
      NODES.SEA.code,
      NODES.DEEPSEA.code,
      NODES.HONEY.code,
      NODES.SAP.code
    ])
    const hearts = []

    const placeHeart = (x, y) => {
      if (this.isExcluded(x - 1, y - 1, x + 2, y + 2)) return false
      for (let dy = -1; dy <= 2; dy++) {
        for (let dx = -1; dx <= 2; dx++) {
          if (LIQUID_OR_GAZ.has(worldBuffer.read(x + dx, y + dy))) return false
        }
      }
      worldBuffer.write(x, y, VOID)
      worldBuffer.write(x + 1, y, VOID)
      worldBuffer.write(x, y + 1, VOID)
      worldBuffer.write(x + 1, y + 1, VOID)
      this.addExclusion({x1: x - 1, y1: y - 1, x2: x + 2, y2: y + 2})
      tileGuard.addRect(x - 1, y - 1, x + 2, y + 2)
      tileGuard.addNoisyCircle(x, y, 2, 5, 0.3, PERLIN_OFFSET_HEART)
      hearts.push({cx: x, cy: y})
      return true
    }

    let remaining = HEART_COUNT
    let attempts = 0
    while (remaining > 0 && attempts < MAX_ATTEMPTS) {
      attempts++
      const x = seededRNG.randomGetMinMax(150, WORLD_WIDTH - 151)
      const y = seededRNG.randomGetMinMax(surfaceUnder[x], underCaverns[x] - 2)
      if (placeHeart(x, y)) { remaining--; attempts = 0 }
    }

    // Fallback — caverns_top
    if (remaining > 0) {
      attempts = 0
      while (remaining > 0 && attempts < MAX_ATTEMPTS) {
        attempts++
        const x = seededRNG.randomGetMinMax(5, WORLD_WIDTH - 6)
        const y = seededRNG.randomGetMinMax(underCaverns[x], Math.round((underCaverns[x] + 510) / 2) - 2)
        if (placeHeart(x, y)) { remaining--; attempts = 0 }
      }
    }

    return hearts
  }

  /**
 * Place 3 Triskels (2×2) : 2 en caverns_top, 1 en caverns_bottom.
 * Les triskels non placés en caverns_top sont reportés en caverns_bottom.
 * Chaque spot nécessite 16 tuiles solides (carré 4×4 centré sur le coin haut-gauche).
 * Les spots sont enregistrés dans #exclusions.
 *
 * @param {Int16Array} underCaverns - Altitudes haute caverne par colonne X
 * @returns {Array<{cx, cy}>} — cx, cy = coin haut-gauche du carré 2×2
 */
  digTriskels (underCaverns) {
    const MAX_ATTEMPTS = 100
    const LIQUID_OR_GAZ = new Set([
      NODES.VOID.code,
      NODES.SKY.code,
      NODES.FOG.code,
      NODES.WATER.code,
      NODES.SEA.code,
      NODES.DEEPSEA.code,
      NODES.HONEY.code,
      NODES.SAP.code
    ])
    const VOID = NODES.VOID.code
    const triskels = []

    const placeTriskel = (x, y) => {
      if (this.isExcluded(x - 1, y - 1, x + 2, y + 2)) return false
      for (let dy = -1; dy <= 2; dy++) {
        for (let dx = -1; dx <= 2; dx++) {
          if (LIQUID_OR_GAZ.has(worldBuffer.read(x + dx, y + dy))) return false
        }
      }
      worldBuffer.write(x, y, VOID)
      worldBuffer.write(x + 1, y, VOID)
      worldBuffer.write(x, y + 1, VOID)
      worldBuffer.write(x + 1, y + 1, VOID)
      tileGuard.addNoisyCircle(x, y, 4, 8, 0.8, PERLIN_OFFSET_HEART)
      this.addExclusion({x1: x - 1, y1: y - 1, x2: x + 2, y2: y + 2})
      triskels.push({cx: x, cy: y})
      return true
    }

    // 2 triskels en caverns_top
    let remaining = 2
    let attempts = 0
    while (remaining > 0 && attempts < MAX_ATTEMPTS) {
      attempts++
      const x = seededRNG.randomGetMinMax(5, WORLD_WIDTH - 7)
      const y = seededRNG.randomGetMinMax(underCaverns[x], Math.round((underCaverns[x] + 510) / 2) - 2)
      if (placeTriskel(x, y)) { remaining--; attempts = 0 }
    }

    // 1 triskel en caverns_bottom + fallback pour les triskels non placés en caverns_top
    remaining = 1 + (2 - triskels.length)
    attempts = 0
    while (remaining > 0 && attempts < MAX_ATTEMPTS) {
      attempts++
      const x = seededRNG.randomGetMinMax(5, WORLD_WIDTH - 7)
      const y = seededRNG.randomGetMinMax(Math.round((underCaverns[x] + 510) / 2), 508)
      if (placeTriskel(x, y)) { remaining--; attempts = 0 }
    }

    return triskels
  }

  /**
 * Place FOSSIL_VEIN_COUNT veines de SHELL horizontales.
 * Biomes : DESERT + premier et dernier rect (maritimes).
 * Layer : caverns_top (90%), avec au maximum une migration en under ou caverns_bottom (10%, tirage 50/50).
 * Protection TileGuard autour de chaque point du chemin (rayon + 2).
 *
 * @returns {void}
 */
  digFossilVeins () {
    const SHELL = NODES.SHELL.code
    const MAX_ATTEMPTS = 100

    // Rects éligibles : DESERT + premier + dernier
    const eligibleRects = []
    for (let i = 0; i < this.#zoneRects.length; i++) {
      const rect = this.#zoneRects[i]
      if (rect.biome === BIOME_TYPE.DESERT || i === 0 || i === this.#zoneRects.length - 1) {
        eligibleRects.push(rect)
      }
    }
    if (eligibleRects.length === 0) return
    let migrationDone = false

    for (let i = 0; i < FOSSIL_VEIN_COUNT; i++) {
      const rect = seededRNG.randomGetArrayValue(eligibleRects)

      // Tirage de la layer
      let y0, y1
      if (!migrationDone && seededRNG.randomGetMax(99) < 10) {
        migrationDone = true
        if (seededRNG.randomGetBool()) {
          y0 = rect.ySurface; y1 = rect.yUnder // under
        } else {
          y0 = rect.yCavernsMid; y1 = rect.yCaverns // caverns_bottom
        }
      } else {
        y0 = rect.yUnder; y1 = rect.yCavernsMid // caverns_top
      }

      const radius = 2
      const length = seededRNG.randomGetMinMax(16, 20)
      const angle = seededRNG.randomGetBool() ? 90 : -90

      let cx, cy, valid
      let attempts = 0
      do {
        cx = seededRNG.randomGetMinMax(rect.x0 + length, rect.x1 - length)
        cy = seededRNG.randomGetMinMax(y0 + radius, y1 - radius)
        valid = !this.isExcluded(cx - length, cy - radius, cx + length, cy + radius)
        attempts++
      } while (!valid && attempts < MAX_ATTEMPTS)
      if (!valid) continue

      const path = this.pathTunnel(cx, cy, radius, length, angle, 12)

      // Accumule les tuiles SHELL
      const tiles = []
      for (let j = 0; j < path.length; j++) {
        const p = path[j]
        this.digNoisyCircle(tiles, p.x, p.y, p.radiusMin, p.radiusMax, SHELL, 0.3, PERLIN_OFFSET_SHELL)
      }

      // N'écrase que les tuiles solides
      const rect2 = this.applyTiles(tiles)
      this.addExclusion(rect2)

      // Protection TileGuard
      for (let j = 0; j < path.length; j++) {
        const p = path[j]
        tileGuard.addNoisyCircle(p.x, p.y, p.radiusMin + 2, p.radiusMax + 2, 0.3, PERLIN_OFFSET_SHELL)
      }
    }
  }

  /**
 * Creuse une fougère cave par zone de biome FOREST.
 * Forme : demi-ellipse supérieure + rectangle inférieur (fond plat).
 * Bords bruités via Perlin noise.
 * Prérequis : initZoneRects(), initExclusions().
 *
 * @returns {Array<{cx, cy, radiusX, radiusY}>}
 */
  digFernCaves () {
    const caves = []
    const MAX_ATTEMPTS = 100

    for (let i = 0; i < this.#zoneRects.length; i++) {
      const rect = this.#zoneRects[i]
      if (rect.biome !== BIOME_TYPE.FOREST) continue

      const radiusX = seededRNG.randomGetMinMax(FERN_CAVE_RADIUS_X_MIN, FERN_CAVE_RADIUS_X_MAX)
      const radiusY = seededRNG.randomGetMinMax(FERN_CAVE_RADIUS_Y_MIN, FERN_CAVE_RADIUS_Y_MAX)

      let cx, cy, valid
      let attempts = 0
      do {
        cx = seededRNG.randomGetMinMax(rect.x0 + radiusX, rect.x1 - radiusX)
        cy = seededRNG.randomGetMinMax(rect.ySurface + radiusY, rect.yUnder - radiusY - 2)
        valid = !this.isExcluded(cx - radiusX, cy - radiusY, cx + radiusX, cy + radiusY + 2)
        attempts++
      } while (!valid && attempts < MAX_ATTEMPTS)
      if (!valid) continue

      // Passe 1 — ellipse bruitée
      const tiles = []
      this.digNoisyEllipse(tiles, cx, cy, radiusX - 4, radiusX, radiusY - 4, radiusY, NODES.VOID.code, 0.3, PERLIN_OFFSET_FERNS)

      // Passe 2 — rectangle inférieur
      const rectCy = cy + Math.round((radiusY + 2) / 2)
      const rectHalfH = Math.round((radiusY + 2) / 2)
      this.digNoisyRect(tiles, cx, rectCy, radiusX - 1, radiusX + 3, rectHalfH - 1, rectHalfH + 1, NODES.VOID.code, 0.3, PERLIN_OFFSET_FERNS)

      const rect2 = this.applyTiles(tiles)
      this.addExclusion(rect2)
      tileGuard.addNoisyRect(cx, cy + radiusY + 2, radiusX + 2, radiusX + 6, 2, 4, 0.8, PERLIN_OFFSET_FERNS)
      this.#fillFernCaveFloor(cx, cy + 1, radiusX)

      caves.push({cx, cy, radiusX, radiusY})
    }

    return caves
  }

  /**
 * Tapisse le fond d'une Fern Cave avec GRASSFERN (surface) et HUMUS (substrat).
 * Parcourt les colonnes de cx-radiusX à cx+radiusX.
 * Descend depuis cy pour trouver le fond (première tuile non-VOID).
 * Profondeur du substrat : 2 ou 3 tuiles, avec transition Markov 75/25.
 *
 * @param {number} cx
 * @param {number} cy
 * @param {number} radiusX
 * @param {number} surfaceCode - Code de la tuile de surface (ex: GRASSFERN)
 * @param {number} substrateCode - Code du substrat (ex: HUMUS)
 */
  #fillFernCaveFloor (cx, cy, radiusX) {
    const VOID = NODES.VOID.code
    const surfaceCode = NODES.GRASSFERN.code
    const substrateCode = NODES.HUMUS.code

    let depth = seededRNG.randomGetBool() ? 2 : 3

    const fillColumn = (x) => {
    // Descend depuis cy jusqu'au fond
      let y = cy
      while (y < WORLD_HEIGHT - 1 && worldBuffer.read(x, y) === VOID) y++
      if (worldBuffer.read(x, y - 1) !== VOID) return false // hors cave

      // GRASSFERN sur le fond
      worldBuffer.write(x, y, surfaceCode)

      // HUMUS sur les tuiles suivantes
      for (let d = 1; d <= depth; d++) {
        if (worldBuffer.read(x, y + d) === VOID) break
        worldBuffer.write(x, y + d, substrateCode)
      }

      // Transition Markov pour la prochaine colonne
      depth = (depth === 2)
        ? (seededRNG.randomGetMax(99) < 75 ? 2 : 3)
        : (seededRNG.randomGetMax(99) < 75 ? 3 : 2)

      return true
    }

    // Centre puis droite
    fillColumn(cx)
    for (let x = cx + 1; x <= cx + radiusX; x++) {
      if (!fillColumn(x)) break
    }

    // Gauche
    depth = seededRNG.randomGetBool() ? 2 : 3
    for (let x = cx - 1; x >= cx - radiusX; x--) {
      if (!fillColumn(x)) break
    }
  }

  /**
 * Creuse une Moss Cave par zone de biome JUNGLE en layer under.
 * Forme : demi-ellipse supérieure bruitée + rectangle inférieur à fond plat bruité.
 * Protection TileGuard sur le bas de la cave.
 * Prérequis : initZoneRects(), initExclusions().
 *
 * @returns {Array<{cx, cy, radiusX, radiusY}>}
 */
  digMossCaves () {
    const caves = []
    const MAX_ATTEMPTS = 100

    for (let i = 0; i < this.#zoneRects.length; i++) {
      const rect = this.#zoneRects[i]
      if (rect.biome !== BIOME_TYPE.JUNGLE) continue

      const radiusX = seededRNG.randomGetMinMax(MOSS_CAVE_RADIUS_X_MIN, MOSS_CAVE_RADIUS_X_MAX)
      const radiusY = seededRNG.randomGetMinMax(MOSS_CAVE_RADIUS_Y_MIN, MOSS_CAVE_RADIUS_Y_MAX)

      let cx, cy, valid
      let attempts = 0
      do {
        cx = seededRNG.randomGetMinMax(rect.x0 + radiusX, rect.x1 - radiusX)
        cy = seededRNG.randomGetMinMax(rect.ySurface + radiusY, rect.yUnder - radiusY - 2)
        valid = !this.isExcluded(cx - radiusX, cy - radiusY, cx + radiusX, cy + radiusY + 2)
        attempts++
      } while (!valid && attempts < MAX_ATTEMPTS)
      if (!valid) continue

      const tiles = []
      this.digNoisyEllipse(tiles, cx, cy, radiusX - 4, radiusX, radiusY - 4, radiusY, NODES.VOID.code, 0.3, PERLIN_OFFSET_FERNS)

      const rectCy = cy + Math.round((radiusY + 2) / 2)
      const rectHalfH = Math.round((radiusY + 2) / 2)
      this.digNoisyRect(tiles, cx, rectCy, radiusX - 1, radiusX, rectHalfH - 1, rectHalfH, NODES.VOID.code, 0.3, PERLIN_OFFSET_FERNS)

      const rect2 = this.applyTiles(tiles)
      this.addExclusion(rect2)
      tileGuard.addNoisyRect(cx, cy + radiusY + 2, radiusX + 2, radiusX + 5, 2, 4, 0.8, PERLIN_OFFSET_FERNS)
      this.#fillMossCaveWalls(cx, cy, radiusX, radiusY)

      window.DEBUG_POINTS.push({x: cx, y: cy, color: 'orange'}) // DEBUG
      caves.push({cx, cy, radiusX, radiusY})
    }

    return caves
  }

  /**
 * Tapisse les parois et le sol d'une Moss Cave de GRASSMOSS (sol) et MUD (parois).
 * La mousse pousse sur le sol (VOID au-dessus) et les parois latérales (VOID à gauche ou droite).
 * Elle ne pousse pas sur le plafond (VOID en dessous).
 *
 * @param {number} cx
 * @param {number} cy
 * @param {number} radiusX
 * @param {number} radiusY
 */
  #fillMossCaveWalls (cx, cy, radiusX, radiusY) {
    const VOID = NODES.VOID.code
    const GRASSMOSS = NODES.GRASSMOSS.code
    const MUD = NODES.MUD.code
    const LIQUID_OR_GAZ = new Set([
      NODES.VOID.code,
      NODES.SKY.code,
      NODES.FOG.code,
      NODES.WATER.code,
      NODES.SEA.code,
      NODES.DEEPSEA.code,
      NODES.HONEY.code,
      NODES.SAP.code
    ])

    const x0 = cx - radiusX - 1
    const x1 = cx + radiusX + 1
    const y0 = cy - radiusY - 1
    const y1 = cy + radiusY + 3

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const code = worldBuffer.read(x, y)
        if (code === VOID || LIQUID_OR_GAZ.has(code)) continue

        const hasVoidAbove = worldBuffer.read(x, y - 1) === VOID
        const hasVoidBelow = worldBuffer.read(x, y + 1) === VOID
        const hasVoidLeft = worldBuffer.read(x - 1, y) === VOID
        const hasVoidRight = worldBuffer.read(x + 1, y) === VOID

        if (hasVoidBelow && hasVoidLeft && hasVoidRight) continue
        if (hasVoidAbove || hasVoidLeft || hasVoidRight) {
          worldBuffer.write(x, y, GRASSMOSS)
        }
        if (hasVoidAbove && !hasVoidBelow) {
          worldBuffer.write(x, y + 1, MUD)
        }
      }
    }
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

    let code, top, bot, left, right
    let topright, rightright, botleft, botright, botbot // pour doublons H et V

    const LIQUID_OR_GAZ = new Set([
      NODES.VOID.code,
      NODES.SKY.code,
      NODES.FOG.code,
      NODES.WATER.code,
      NODES.SEA.code,
      NODES.DEEPSEA.code,
      NODES.HONEY.code,
      NODES.SAP.code
    ])
    const GAZ = new Set([NODES.SKY.code, NODES.FOG.code, NODES.VOID.code])
    const SKY_OR_FOG = new Set([NODES.SKY.code, NODES.FOG.code])
    const LIQUID = new Set([NODES.WATER.code, NODES.SEA.code, NODES.HONEY.code, NODES.SAP.code, NODES.DEEPSEA.code])

    const propagateSky = (idx) => {
      world[idx] = SKY
      let below = idx + W
      while (below < W * (H - 1) && world[below] === VOID) {
        world[below] = SKY
        below += W
      }
    }

    // Remplace la tuile idx et toutes les tuiles SKY en dessous par VOID
    const propagateVoid = (idx) => {
      world[idx] = VOID
      let below = idx + W
      while (world[below] === SKY) {
        world[below] = VOID
        below += W
      }
    }

    // Remplace par SKY toutes les tuiles solides depuis idx vers le haut, tant qu'elles ne sont pas SKY
    const propagateSkyUp = (idx) => {
      let above = idx
      while (world[above] !== SKY) {
        world[above] = SKY
        above -= W
      }
    }

    // Remonte depuis idx jusqu'à trouver la première tuile non VOID — retourne son code
    // Utilisé uniquement par la règle 13, devenue obsolète
    // const solidAbove = (idx) => {
    //   let above = idx - W
    //   while (world[above] === VOID) above -= W
    //   return world[above]
    // }

    // Passe 1 — propagation SKY vers le bas colonne par colonne
    for (let x = 1; x < W - 1; x++) {
      let phaseB = false
      for (let y = 1; y < H - 1; y++) {
        const idx = (y << 10) | x
        const code = world[idx]
        if (!phaseB) {
          // Phase A : au-dessus de la première tuile solide
          if (code === SKY) continue
          if (code === VOID) { world[idx] = SKY; continue }
          phaseB = true // tuile solide rencontrée → bascule en phase B
        } else {
          // Phase B : sous la première tuile solide — SKY → VOID uniquement
          if (code === SKY) world[idx] = VOID
        }
      }
    }

    // Passe 2 — remplacement des tuiles CREATION par leur substrat définitif
    for (let i = 0; i < world.length; i++) {
      const remapped = CREATION_REMAP.get(world[i])
      if (remapped !== undefined) world[i] = remapped
    }

    // Passe 3 — application des règles
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = (y << 10) | x

        // récupération de tous les codes voisins
        code = world[idx]
        top = world[idx - W]
        topright = world[idx - W + 1]
        left = world[idx - 1]
        right = world[idx + 1]
        rightright = world[idx + 2]
        bot = world[idx + W]
        botleft = world[idx + W - 1]
        botright = world[idx + W + 1]
        botbot = world[idx + W + W]
        // target 1 tuile : code
        // target 2 tuiles horizontales : code, right
        // target 2 tuiles verticales : code, bot
        // neighbors 1 tuile : top, right, bot, left
        // neighbors 2 tuiles horizontales : left, top, bot, topright, botright, rightright
        // neighbors 2 tuiles verticales : top, left, right, botleft, botright, botbot

        // /////////////////////////////////// //
        // SUPPRESSION DES TUILES VOID ISOLEES //
        // /////////////////////////////////// //

        // Règle 1 — VOID isolé : 4 voisins solides → substrat aléatoire parmi les 4
        if (code === VOID && !LIQUID_OR_GAZ.has(top) && !LIQUID_OR_GAZ.has(bot) && !LIQUID_OR_GAZ.has(left) && !LIQUID_OR_GAZ.has(right)) {
          world[idx] = seededRNG.randomGetArrayValue([top, bot, left, right])
          continue
        }

        // Règle 1-H — paire horizontale VOID : 6 voisins solides → substrat aléatoire parmi les 6
        if (code === VOID && right === VOID && !LIQUID_OR_GAZ.has(top) && !LIQUID_OR_GAZ.has(bot) && !LIQUID_OR_GAZ.has(left) && !LIQUID_OR_GAZ.has(topright) && !LIQUID_OR_GAZ.has(botright) && !LIQUID_OR_GAZ.has(rightright)) {
          const candidates = [top, bot, left, topright, botright, rightright]
          world[idx] = seededRNG.randomGetArrayValue(candidates)
          world[idx + 1] = seededRNG.randomGetArrayValue(candidates)
          world[idx] = NODES.LAVA.code // débug
          world[idx + 1] = NODES.LAVA.code // débug
          continue
        }

        // Règle 1-V — paire verticale VOID : 6 voisins solides → substrat aléatoire parmi les 6
        if (code === VOID && bot === VOID && !LIQUID_OR_GAZ.has(top) && !LIQUID_OR_GAZ.has(left) && !LIQUID_OR_GAZ.has(right) && !LIQUID_OR_GAZ.has(botleft) && !LIQUID_OR_GAZ.has(botright) && !LIQUID_OR_GAZ.has(botbot)) {
          const candidates = [top, left, right, botleft, botright, botbot]
          world[idx] = candidates[seededRNG.randomGetMax(5)]
          world[idx + W] = candidates[seededRNG.randomGetMax(5)]
          continue
        }

        // Règle 2 — SKY, VOID non isolé, liquide, gaz : pas de modification
        if (LIQUID_OR_GAZ.has(code)) continue
        // à partir de maintenant, on est sûr que code est solide

        // ///////////////////////////////////////////////// //
        // SUPPRESSION DES TUILES SOLIDE ISOLEES DANS LE SKY //
        // ///////////////////////////////////////////////// //

        // Règle 3 — tuile solide suspendue dans le ciel (top=SKY, bot=VOID, côtés SKY/FOG) → SKY propagé
        if (top === SKY && bot === VOID && SKY_OR_FOG.has(left) && SKY_OR_FOG.has(right)) {
          propagateSky(idx)
          continue
        }
        // Règle 3-V — paire verticale solide suspendue dans le ciel → SKY propagé sur les deux tuiles
        if (!LIQUID_OR_GAZ.has(bot) && top === SKY && SKY_OR_FOG.has(left) && SKY_OR_FOG.has(right) && SKY_OR_FOG.has(botleft) && SKY_OR_FOG.has(botright) && botbot === VOID) {
          world[idx] = SKY
          propagateSky(idx + W)
          continue
        }
        // Règle 3-H — paire horizontale solide suspendue dans le ciel → SKY propagé sur les deux tuiles
        if (!LIQUID_OR_GAZ.has(right) && top === SKY && bot === VOID && SKY_OR_FOG.has(left) && topright === SKY && botright === VOID && SKY_OR_FOG.has(rightright)) {
          propagateSky(idx)
          propagateSky(idx + 1)
          continue
        }
        // ////////////////////////////////////////////////// //
        // SUPPRESSION DES TUILES SOLIDE ISOLEES DANS LE VOID //
        // ////////////////////////////////////////////////// //

        // Règle 4 — tuile solide isolée dans VOID → VOID
        if (top === VOID && bot === VOID && left === VOID && right === VOID) {
          world[idx] = VOID
          continue
        }

        // Règle 4-H — paire horizontale solide dans VOID → VOID
        if (!LIQUID_OR_GAZ.has(right) && top === VOID && bot === VOID && left === VOID && topright === VOID && botright === VOID && rightright === VOID) {
          world[idx] = VOID
          world[idx + 1] = VOID
          continue
        }

        // Règle 4-V — paire verticale solide dans VOID → VOID
        if (!LIQUID_OR_GAZ.has(bot) && top === VOID && left === VOID && right === VOID && botleft === VOID && botright === VOID && botbot === VOID) {
          world[idx] = VOID
          world[idx + W] = VOID
          continue
        }

        // ///////////////////////////////////////////////// //
        // SUPPRESSION DES TUILES SOLIDE TOUCHANT UN LIQUIDE //
        // ///////////////////////////////////////////////// //

        // Règle 10 — solide immergé ou juste sous la surface → LIQ
        if (LIQUID_OR_GAZ.has(top) && LIQUID.has(bot) && LIQUID.has(left) && LIQUID.has(right)) {
          world[idx] = bot
          continue
        }

        // Règle 10-H — paire horizontale solide immergée ou juste sous la surface → LIQ
        if (!LIQUID_OR_GAZ.has(right) && LIQUID_OR_GAZ.has(top) && LIQUID_OR_GAZ.has(topright) && LIQUID.has(bot) && LIQUID.has(left) && LIQUID.has(botright) && LIQUID.has(rightright)) {
          world[idx] = bot
          world[idx + 1] = botright
          continue
        }

        // Règle 10-V — paire verticale solide immergée ou juste sous la surface → LIQ
        if (!LIQUID_OR_GAZ.has(bot) && LIQUID_OR_GAZ.has(top) && LIQUID.has(left) && LIQUID.has(right) && LIQUID.has(botleft) && LIQUID.has(botright) && LIQUID.has(botbot)) {
          world[idx] = left
          world[idx + W] = botbot
          continue
        }

        // Règle 11 — solide juste au-dessus de la surface → SKY/VOID du dessus
        if (GAZ.has(top) && GAZ.has(left) && GAZ.has(right) && LIQUID.has(bot)) {
          world[idx] = top
          continue
        }

        // Règle 11-H — paire horizontale solide juste au-dessus de la surface → SKY/VOID du dessus
        if (!LIQUID_OR_GAZ.has(right) && GAZ.has(top) && GAZ.has(topright) && GAZ.has(left) && GAZ.has(rightright) && LIQUID.has(bot) && LIQUID.has(botright)) {
          world[idx] = top
          world[idx + 1] = topright
          continue
        }

        // Règle 11-V — paire verticale solide juste au-dessus de la surface → SKY/VOID du dessus
        if (!LIQUID_OR_GAZ.has(bot) && GAZ.has(top) && GAZ.has(left) && GAZ.has(right) && GAZ.has(botleft) && GAZ.has(botright) && LIQUID.has(botbot)) {
          world[idx] = top
          world[idx + W] = top
          continue
        }

        // Règle 12-V — paire verticale à cheval sur la surface → top pour tuile haute, LIQ pour tuile basse
        if (!LIQUID_OR_GAZ.has(bot) && GAZ.has(top) && GAZ.has(left) && GAZ.has(right) && LIQUID.has(botleft) && LIQUID.has(botright) && LIQUID.has(botbot)) {
          world[idx] = top
          world[idx + W] = botbot
          continue
        }

        // //////////////////////////////////////// //
        // AJOUT DE SOLID AU DESSUS DES WEB ISOLEES //
        // //////////////////////////////////////// //

        // Règle 13 Obsolète — WEB avec VOID au-dessus → remplace le VOID par le SOLID au-dessus
        // if (code === NODES.WEB.code && top === VOID) {
        //   world[idx - W] = solidAbove(idx - W)
        //   continue
        // }

        // if (isVoid) {
        // Règle 2 — VOID avec 4 voisins non VOID → devient l'un d'eux
        // if (top !== VOID && bot !== VOID && left !== VOID && right !== VOID) {
        //   const candidates = []
        //   if (!LIQUID_OR_SKY.has(top)) candidates.push(top)
        //   if (!LIQUID_OR_SKY.has(bot)) candidates.push(bot)
        //   if (!LIQUID_OR_SKY.has(left)) candidates.push(left)
        //   if (!LIQUID_OR_SKY.has(right)) candidates.push(right)
        //   world[idx] = seededRNG.randomGetArrayValue(candidates)
        //   continue
        // }

        // Règle 4 — paire horizontale VOID (x,y)+(x+1,y), 6 voisins non VOID → devient l'un des 6
        // if (x < W - 2 && right === VOID) {
        //   const top2 = world[idx - W + 1]
        //   const bot2 = world[idx + W + 1]
        //   const right2 = world[idx + 2]
        //   if (top !== VOID && top2 !== VOID && bot !== VOID && bot2 !== VOID && left !== VOID && right2 !== VOID) {
        //     const candidates = []
        //     if (!LIQUID_OR_SKY.has(top)) candidates.push(top)
        //     if (!LIQUID_OR_SKY.has(top2)) candidates.push(top2)
        //     if (!LIQUID_OR_SKY.has(bot)) candidates.push(bot)
        //     if (!LIQUID_OR_SKY.has(bot2)) candidates.push(bot2)
        //     if (!LIQUID_OR_SKY.has(left)) candidates.push(left)
        //     if (!LIQUID_OR_SKY.has(right2)) candidates.push(right2)
        //     world[idx] = seededRNG.randomGetArrayValue(candidates)
        //     continue
        //   }
        // }

        // Règle 6 — paire verticale VOID (x,y)+(x,y+1), 6 voisins non VOID → devient l'un des 6
        // if (y < H - 2 && bot === VOID) {
        //   const left2 = world[idx + W - 1]
        //   const right2 = world[idx + W + 1]
        //   const top2 = world[idx + W + W]
        //   if (top !== VOID && left !== VOID && left2 !== VOID && right !== VOID && right2 !== VOID && top2 !== VOID) {
        //     const candidates = []
        //     if (!LIQUID_OR_SKY.has(top)) candidates.push(top)
        //     if (!LIQUID_OR_SKY.has(left)) candidates.push(left)
        //     if (!LIQUID_OR_SKY.has(left2)) candidates.push(left2)
        //     if (!LIQUID_OR_SKY.has(right)) candidates.push(right)
        //     if (!LIQUID_OR_SKY.has(right2)) candidates.push(right2)
        //     if (!LIQUID_OR_SKY.has(top2)) candidates.push(top2)
        //     world[idx] = seededRNG.randomGetArrayValue(candidates)
        //     continue
        //   }
        // }
        // } else {
        // Règle 3 — non VOID avec 4 voisins VOID → devient VOID
        // if (top === VOID && bot === VOID && (left === VOID || left === SKY) && (right === VOID || right === SKY)) {
        //   world[idx] = VOID
        //   continue
        // }

        // // Règle 5 — paire horizontale non VOID (x,y)+(x+1,y), 6 voisins VOID → devient VOID
        // if (x < W - 2 && right !== VOID) {
        //   const top2 = world[idx - W + 1]
        //   const bot2 = world[idx + W + 1]
        //   const right2 = world[idx + 2]
        //   if (top === VOID && top2 === VOID && bot === VOID && bot2 === VOID && left === VOID && right2 === VOID) {
        //     world[idx] = VOID
        //     continue
        //   }
        // }

        // // Règle 7 — paire verticale non VOID (x,y)+(x,y+1), 6 voisins VOID → devient VOID
        // if (y < H - 2 && bot !== VOID) {
        //   const left2 = world[idx + W - 1]
        //   const right2 = world[idx + W + 1]
        //   const bot2 = world[idx + W + W]
        //   if (top === VOID && left === VOID && left2 === VOID && right === VOID && right2 === VOID && bot2 === VOID) {
        //     world[idx] = VOID
        //     continue
        //   }
        // }

        // // Règle 8 — pic isolé dans le ciel → SKY + propagation vers le bas
        // if (top === SKY && left === SKY && right === SKY && bot === VOID) {
        //   propagateSky(idx)
        //   world[idx] = SKY
        //   continue
        // }

        // Règle 9 — pic double vertical dans le ciel → SKY + propagation vers le bas
        // if (y < H - 2 && top === SKY && left === SKY && right === SKY) {
        //   const bot2code = world[idx + W + W]
        //   const left2 = world[idx + W - 1]
        //   const right2 = world[idx + W + 1]
        //   if (bot !== VOID && bot !== SKY && left2 === SKY && right2 === SKY && (bot2code === VOID || bot2code === SKY)) {
        //     world[idx] = SKY
        //     propagateSky(idx + W)
        //     continue
        //   }
        // }

        // Règle 10 — pic double horizontal dans le ciel → SKY + propagation vers le bas
        // if (x < W - 2 && top === SKY && (bot === VOID || bot === SKY)) {
        //   const top2 = world[idx - W + 1]
        //   const bot2 = world[idx + W + 1]
        //   const right2 = world[idx + 2]
        //   if (right !== VOID && right !== SKY && top2 === SKY && (bot2 === VOID || bot2 === SKY) && right2 === SKY) {
        //     propagateSky(idx)
        //     propagateSky(idx + 1)
        //     continue
        //   }
        // }
        // }
      }
    }

    // Passe 4 — suppression des colonnes étroites SKY/VOID en surface
    // La zone SKY est contiguë depuis le haut — dès qu'une ligne n'en contient plus,
    // toutes les lignes suivantes en sont exemptes et le parcours peut s'arrêter.

    // Retourne true si la colonne depuis idx est SKY sur au moins 3 tuiles de haut
    const isWhiteCol = (idx) =>
      world[idx] === SKY && world[idx + W] === SKY && world[idx + W + W] === SKY

    // Retourne true si la colonne depuis idx est VOID sur au moins 3 tuiles de haut
    const isBlackCol = (idx) =>
      world[idx] === VOID && world[idx + W] === VOID && world[idx + W + W] === VOID

    for (let y = 1; y < H - 1; y++) {
      // Détection rapide : arrêt du traitement si cette ligne ne contient pas de SKY ?
      let hasSky = false
      for (let x = 1; x < W - 1; x++) {
        if (world[(y << 10) | x] === SKY) { hasSky = true; break }
      }
      if (!hasSky) break

      for (let x = 1; x < W - 1; x++) {
        const idx = (y << 10) | x
        // règles ici

        // Règle P4-1 — colonne blanche de 1 tuile de large → remplacée par le substrat voisin
        if (isBlackCol(idx - 1) && isWhiteCol(idx) && isBlackCol(idx + 1)) {
          const fill = world[idx - W - 1] !== VOID ? world[idx - W - 1] : world[idx - W + 1]
          world[idx - W] = fill
          world[idx] = fill
          propagateVoid(idx + W)
        }

        // Règle P4-2 — colonne noire de 1 tuile de large → remplacée par SKY propagé
        if (isWhiteCol(idx - 1) && isBlackCol(idx) && isWhiteCol(idx + 1)) {
          propagateSkyUp(idx - W)
          propagateSky(idx)
        }

        // Règle P4-3 — colonne blanche de 2 tuiles de large → remplacée par le substrat voisin
        if (isBlackCol(idx - 1) && isWhiteCol(idx) && isWhiteCol(idx + 1) && isBlackCol(idx + 2)) {
          const fill = world[idx - W - 1] !== VOID ? world[idx - W - 1] : world[idx - W + 2]
          world[idx - W] = fill
          world[idx - W + 1] = fill
          world[idx] = fill
          world[idx + 1] = fill
          propagateVoid(idx + W)
          propagateVoid(idx + W + 1)
        }

        // Règle P4-4 — colonne noire de 2 tuiles de large → remplacée par SKY propagé
        if (isWhiteCol(idx - 1) && isBlackCol(idx) && isBlackCol(idx + 1) && isWhiteCol(idx + 2)) {
          propagateSkyUp(idx - W)
          propagateSkyUp(idx - W + 1)
          propagateSky(idx)
          propagateSky(idx + 1)
        }
      }
    }
  }

  /**
 * Calcule la ligne de surface (première tuile non SKY/FOG/liquide par colonne)
 * et applique une érosion légère (suppression des trous et bosses de 1 tuile).
 * Parcours séquentiel gauche→droite — l'érosion est in-place sur worldBuffer.
 *
 * @returns {Int16Array} surfaceLine — Y de la première tuile solide par colonne X
 */
  buildErodedSurfaceLine () {
    const world = worldBuffer.world
    const W = WORLD_WIDTH
    const H = WORLD_HEIGHT
    const surfaceLine = new Int16Array(W)
    const SKY = NODES.SKY.code
    const VOID = NODES.VOID.code

    const LIQUID_OR_GAZ = new Set([
      NODES.VOID.code,
      NODES.SKY.code,
      NODES.FOG.code,
      NODES.WATER.code,
      NODES.SEA.code,
      NODES.DEEPSEA.code,
      NODES.HONEY.code,
      NODES.SAP.code
    ])

    // Remplace idx par SKY et descend tant que VOID → SKY
    const propagateSky = (idx) => {
      world[idx] = SKY
      let below = idx + W
      while (world[below] === VOID) {
        world[below] = SKY
        below += W
      }
    }

    // Recalcule surfaceLine[x] en cherchant la première tuile non LIQUID_OR_GAZ depuis le haut
    const calcSurface = (x) => {
      for (let y = 1; y < H - 1; y++) {
        if (!LIQUID_OR_GAZ.has(world[(y << 10) | x])) {
          surfaceLine[x] = y
          return
        }
      }
    }

    // Calcul de la ligne de surface
    for (let x = 1; x < W - 1; x++) { calcSurface(x) }

    // Érosion — suppression des trous et bosses de 1 tuile
    for (let x = 1; x < W - 1; x++) {
      const y = surfaceLine[x]
      const idx = (y << 10) | x
      const yLeft = surfaceLine[x - 1]
      const yRight = surfaceLine[x + 1]

      // Trou : tuile plus basse que ses deux voisins → on bouche le creux (y-1) avec la tuile solide (y)
      if (y > yLeft && y > yRight) {
        world[idx - W] = world[idx]
        surfaceLine[x] = y - 1
      }

      // Bosse : tuile plus haute que ses deux voisines → on remplace par la tuile au dessus (y-1)
      if (y < yLeft && y < yRight) {
        if (world[idx - W] === SKY) {
          // dans le ciel, on propage le sky
          propagateSky(idx)
          calcSurface(x)
        } else {
          // Sous l'eau (tuile au-dessus = liquide) → copie la tuile au-dessus
          world[idx] = world[idx - W]
          surfaceLine[x] = y + 1
        }
      }
    }
    return surfaceLine
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

/* ====================================================================================================
   REMPLISSAGE DES TUNNELS, CAVERNES ET COBWEB CAVES PAR DES WEB
   ==================================================================================================== */

class WebFiller {
  constructor () {
    this.WEB = NODES.WEB.code
    this.VOID = NODES.VOID.code
    this.HIVE = NODES.HIVE.code
    this.WIDTH = WORLD_WIDTH
  }

  /**
   * Remonte au plafond depuis (cx, cy) et construit une toile organique
   * de `count` tuiles maximum. Abandon si le plafond est HIVE.
   *
   * @param {number} cx
   * @param {number} cy
   * @param {number} count
   */
  #buildWeb (cx, cy, count, notSolid) {
    const NOT_SOLID = new Set([NODES.VOID.code, NODES.WEB.code])
    let idx = (cy << 10) | cx

    const protect = (x, y) => {
      const idxAbove1 = ((y - 1) << 10) | x
      const idxAbove2 = idxAbove1 - this.WIDTH
      if (!NOT_SOLID.has(worldBuffer.readAt(idxAbove1))) tileGuard.add(idxAbove1)
      if (!NOT_SOLID.has(worldBuffer.readAt(idxAbove2))) tileGuard.add(idxAbove2)
    }

    // Remonte au plafond
    while (worldBuffer.readAt(idx - this.WIDTH) === this.VOID) {
      idx -= this.WIDTH
      cy--
    }
    if (worldBuffer.readAt(idx - this.WIDTH) === this.HIVE) return

    worldBuffer.writeAt(idx, this.WEB)
    protect(cx, cy)
    count--

    const webX = [cx]
    const webY = [cy]
    let tentative = 10

    while (count > 0 && tentative > 0) {
      const i = seededRNG.randomGetMax(webX.length - 1)
      const result = this.#stepWeb(webX[i], webY[i])
      if (result !== null) {
        webX.push(result.x)
        webY.push(result.y)
        protect(result.x, result.y)
        count--
        tentative = Math.max(10, 4 * webX.length)
      } else {
        tentative--
      }
    }
  }

  /**
   * Tente d'étendre la toile depuis (x, y).
   * Priorité : haut → gauche/droite (aléatoire) → bas.
   * Retourne {x, y} de la nouvelle tuile, ou null si aucun voisin libre.
   *
   * @param {number} x
   * @param {number} y
   * @returns {{x, y}|null}
   */
  #stepWeb (x, y) {
    const idx = (y << 10) | x

    if (worldBuffer.readAt(idx - this.WIDTH) === this.VOID) {
      worldBuffer.writeAt(idx - this.WIDTH, this.WEB)
      return {x, y: y - 1}
    }

    const leftVoid = worldBuffer.readAt(idx - 1) === this.VOID
    const rightVoid = worldBuffer.readAt(idx + 1) === this.VOID

    if (leftVoid && rightVoid) {
      if (seededRNG.randomGetBool()) {
        worldBuffer.writeAt(idx + 1, this.WEB)
        return {x: x + 1, y}
      }
      worldBuffer.writeAt(idx - 1, this.WEB)
      return {x: x - 1, y}
    }
    if (rightVoid) {
      worldBuffer.writeAt(idx + 1, this.WEB)
      return {x: x + 1, y}
    }
    if (leftVoid) {
      worldBuffer.writeAt(idx - 1, this.WEB)
      return {x: x - 1, y}
    }
    if (worldBuffer.readAt(idx + this.WIDTH) === this.VOID) {
      worldBuffer.writeAt(idx + this.WIDTH, this.WEB)
      return {x, y: y + 1}
    }
    return null
  }

  /**
   * Peuple une Cobweb Cave : 3 buildWeb depuis cx, cx-6, cx+6.
   *
   * @param {number} cx
   * @param {number} cy
   */
  fillCobwebCave (cx, cy) {
    const idx = (cy << 10) | cx
    this.#buildWeb(cx, cy, seededRNG.randomGetMinMax(COBWEB_CAVE_MAIN_MIN, COBWEB_CAVE_MAIN_MAX))
    if (worldBuffer.readAt(idx - 6) === this.VOID) {
      this.#buildWeb(cx - 6, cy, seededRNG.randomGetMinMax(COBWEB_CAVE_SIDE_MIN, COBWEB_CAVE_SIDE_MAX))
    }
    if (worldBuffer.readAt(idx + 6) === this.VOID) {
      this.#buildWeb(cx + 6, cy, seededRNG.randomGetMinMax(COBWEB_CAVE_SIDE_MIN, COBWEB_CAVE_SIDE_MAX))
    }
  }

  /**
   * Disperse COBWEB_SCATTER_COUNT toiles aléatoires dans tous les espaces
   * VOID souterrains (sous surfaceUnder[x]).
   *
   * @param {Int16Array} surfaceUnder
   */
  scatterWebs (surfaceUnder) {
    let count = COBWEB_SCATTER_COUNT
    while (count > 0) {
      const x = seededRNG.randomGetMinMax(32, WORLD_WIDTH - 32)
      const y = seededRNG.randomGetMinMax(surfaceUnder[x], WORLD_HEIGHT - 32)
      if (worldBuffer.read(x, y) === this.VOID) {
        this.#buildWeb(x, y, seededRNG.randomGetMinMax(COBWEB_SCATTER_SIZE_MIN, COBWEB_SCATTER_SIZE_MAX))
        count--
      }
    }
  }
}
export const webFiller = new WebFiller()
