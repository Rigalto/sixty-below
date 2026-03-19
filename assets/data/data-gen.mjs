/**
 * @file data-gen.mjs
 * @description Données de génération procédurale.
 * Layer : 3. Dépendances autorisées : data.mjs, constant.mjs.
 * Point d'entrée unique pour generate.mjs — re-exporte tout ce dont il a besoin.
 */

import {NODES, NODES_LOOKUP, NODE_TYPE, BIOME_TYPE} from './data.mjs'
import {WORLD_WIDTH, WORLD_HEIGHT, SEA_LEVEL, WEATHER_TYPE} from '../../src/constant.mjs'

// Re-exports pour generate.mjs
export {NODES, NODES_LOOKUP, NODE_TYPE, BIOME_TYPE, WORLD_WIDTH, WORLD_HEIGHT, SEA_LEVEL, WEATHER_TYPE}

// ── Table d'indirection biome × layer → code de tuile substrat ───────────────
// Source de vérité : DESIGN.md
// Couches : 'sky' | 'surface' | 'under' | 'caverns'
export const BIOME_TILE_MAP = {
  [BIOME_TYPE.FOREST]: {
    sky: NODES.SKY.code,
    surface: NODES.CLAY.code,
    under: NODES.STONE.code,
    caverns: NODES.HARDSTONE.code
  },
  [BIOME_TYPE.DESERT]: {
    sky: NODES.SKY.code,
    surface: NODES.SANDSTONE.code,
    under: NODES.ASH.code,
    caverns: NODES.HELLSTONE.code
  },
  [BIOME_TYPE.JUNGLE]: {
    sky: NODES.SKY.code,
    surface: NODES.MUD.code,
    under: NODES.LIMESTONE.code,
    caverns: NODES.SLATE.code
  }
}

// taille maximale de la mer
export const SEA_MAX_WIDTH = 90
export const SEA_MAX_HEIGHT = 150
export const SEA_MAX_JITTER = 10

export const CLUSTER_SCATTER_MAP = {
  [BIOME_TYPE.FOREST]: {
    surface: [{code: NODES.DIRT.code, percent: 0.02},
      {code: NODES.STONE.code, percent: 0.002}],
    under: [{code: NODES.STONE.code, percent: 0.02},
      {code: NODES.DIRT.code, percent: 0.005}],
    caverns_top: [{code: NODES.HARDSTONE.code, percent: 0.02},
      {code: NODES.DIRT.code, percent: 0.01},
      {code: NODES.HUMUS.code, percent: 0.002}],
    caverns_bottom: [{code: NODES.HARDSTONE.code, percent: 0.02},
      {code: NODES.HUMUS.code, percent: 0.002}]
  },
  [BIOME_TYPE.DESERT]: {
    surface: [{code: NODES.SAND.code, percent: 0.01},
      {code: NODES.SANDSTONE.code, percent: 0.01},
      {code: NODES.STONE.code, percent: 0.002}],
    under: [{code: NODES.ASH.code, percent: 0.02},
      {code: NODES.DIRT.code, percent: 0.008},
      {code: NODES.SANDSTONE.code, percent: 0.002}],
    caverns_top: [{code: NODES.HELLSTONE.code, percent: 0.02},
      {code: NODES.ASH.code, percent: 0.01},
      {code: NODES.SAND.code, percent: 0.001}],
    caverns_bottom: [{code: NODES.HELLSTONE.code, percent: 0.02},
      {code: NODES.ASH.code, percent: 0.005},
      {code: NODES.SAND.code, percent: 0.001}]
  },
  [BIOME_TYPE.JUNGLE]: {
    surface: [{code: NODES.SILT.code, percent: 0.02},
      {code: NODES.STONE.code, percent: 0.002}],
    under: [{code: NODES.LIMESTONE.code, percent: 0.02},
      {code: NODES.HUMUS.code, percent: 0.006},
      {code: NODES.DIRT.code, percent: 0.001}],
    caverns_top: [{code: NODES.SLATE.code, percent: 0.02},
      {code: NODES.HUMUS.code, percent: 0.015},
      {code: NODES.SILT.code, percent: 0.003}],
    caverns_bottom: [{code: NODES.SLATE.code, percent: 0.02},
      {code: NODES.HUMUS.code, percent: 0.02},
      {code: NODES.SILT.code, percent: 0.003}]
  }
}

export const ORE_GEM_SCATTER_MAP = {
  [BIOME_TYPE.FOREST]: {
    surface: [
      {code: NODES.COPPER.code, percent: 0.002, sizeMin: 3, sizeMax: 5}
    ],
    under: [
      {code: NODES.COPPER.code, percent: 0.008, sizeMin: 4, sizeMax: 8},
      {code: NODES.IRON.code, percent: 0.004, sizeMin: 4, sizeMax: 8},
      {code: NODES.SILVER.code, percent: 0.001, sizeMin: 3, sizeMax: 6} // pénalisé /2
    ],
    caverns_top: [
      {code: NODES.COPPER.code, percent: 0.004, sizeMin: 4, sizeMax: 8},
      {code: NODES.IRON.code, percent: 0.004, sizeMin: 4, sizeMax: 8},
      {code: NODES.SILVER.code, percent: 0.002, sizeMin: 4, sizeMax: 8}, // pénalisé /2
      {code: NODES.GOLD.code, percent: 0.004, sizeMin: 5, sizeMax: 9},
      {code: NODES.COBALT.code, percent: 0.002, sizeMin: 5, sizeMax: 10},
      {code: NODES.TOPAZ.code, percent: 0.003, sizeMin: 8, sizeMax: 14}
    ],
    caverns_bottom: [
      {code: NODES.COPPER.code, percent: 0.001, sizeMin: 3, sizeMax: 6},
      {code: NODES.IRON.code, percent: 0.002, sizeMin: 4, sizeMax: 8},
      {code: NODES.SILVER.code, percent: 0.001, sizeMin: 4, sizeMax: 8}, // pénalisé /2
      {code: NODES.GOLD.code, percent: 0.002, sizeMin: 5, sizeMax: 9},
      {code: NODES.COBALT.code, percent: 0.004, sizeMin: 6, sizeMax: 12},
      {code: NODES.PLATINUM.code, percent: 0.004, sizeMin: 6, sizeMax: 12},
      {code: NODES.TOPAZ.code, percent: 0.002, sizeMin: 6, sizeMax: 12},
      {code: NODES.SAPPHIRE.code, percent: 0.003, sizeMin: 8, sizeMax: 16}
    ]
  },
  [BIOME_TYPE.DESERT]: {
    surface: [
      {code: NODES.COPPER.code, percent: 0.002, sizeMin: 3, sizeMax: 5}
    ],
    under: [
      {code: NODES.COPPER.code, percent: 0.008, sizeMin: 4, sizeMax: 8},
      {code: NODES.IRON.code, percent: 0.004, sizeMin: 4, sizeMax: 8},
      {code: NODES.SILVER.code, percent: 0.002, sizeMin: 3, sizeMax: 6}
    ],
    caverns_top: [
      {code: NODES.COPPER.code, percent: 0.004, sizeMin: 4, sizeMax: 8},
      {code: NODES.IRON.code, percent: 0.004, sizeMin: 4, sizeMax: 8},
      {code: NODES.SILVER.code, percent: 0.004, sizeMin: 4, sizeMax: 8},
      {code: NODES.GOLD.code, percent: 0.002, sizeMin: 5, sizeMax: 9}, // pénalisé /2
      {code: NODES.COBALT.code, percent: 0.002, sizeMin: 5, sizeMax: 10},
      {code: NODES.RUBY.code, percent: 0.003, sizeMin: 8, sizeMax: 14}
    ],
    caverns_bottom: [
      {code: NODES.COPPER.code, percent: 0.001, sizeMin: 3, sizeMax: 6},
      {code: NODES.IRON.code, percent: 0.002, sizeMin: 4, sizeMax: 8},
      {code: NODES.SILVER.code, percent: 0.002, sizeMin: 4, sizeMax: 8},
      {code: NODES.GOLD.code, percent: 0.001, sizeMin: 5, sizeMax: 9}, // pénalisé /2
      {code: NODES.COBALT.code, percent: 0.004, sizeMin: 6, sizeMax: 12},
      {code: NODES.PLATINUM.code, percent: 0.004, sizeMin: 6, sizeMax: 12},
      {code: NODES.RUBY.code, percent: 0.002, sizeMin: 6, sizeMax: 12},
      {code: NODES.SAPPHIRE.code, percent: 0.003, sizeMin: 8, sizeMax: 16}
    ]
  },
  [BIOME_TYPE.JUNGLE]: {
    surface: [
      {code: NODES.COPPER.code, percent: 0.002, sizeMin: 3, sizeMax: 5}
    ],
    under: [
      {code: NODES.COPPER.code, percent: 0.008, sizeMin: 4, sizeMax: 8},
      {code: NODES.IRON.code, percent: 0.004, sizeMin: 4, sizeMax: 8},
      {code: NODES.SILVER.code, percent: 0.002, sizeMin: 3, sizeMax: 6}
    ],
    caverns_top: [
      {code: NODES.COPPER.code, percent: 0.004, sizeMin: 4, sizeMax: 8},
      {code: NODES.IRON.code, percent: 0.004, sizeMin: 4, sizeMax: 8},
      {code: NODES.SILVER.code, percent: 0.004, sizeMin: 4, sizeMax: 8},
      {code: NODES.GOLD.code, percent: 0.004, sizeMin: 5, sizeMax: 9},
      {code: NODES.COBALT.code, percent: 0.001, sizeMin: 5, sizeMax: 10}, // pénalisé /2
      {code: NODES.EMERALD.code, percent: 0.003, sizeMin: 8, sizeMax: 14}
    ],
    caverns_bottom: [
      {code: NODES.COPPER.code, percent: 0.001, sizeMin: 3, sizeMax: 6},
      {code: NODES.IRON.code, percent: 0.002, sizeMin: 4, sizeMax: 8},
      {code: NODES.SILVER.code, percent: 0.002, sizeMin: 4, sizeMax: 8},
      {code: NODES.GOLD.code, percent: 0.002, sizeMin: 5, sizeMax: 9},
      {code: NODES.COBALT.code, percent: 0.002, sizeMin: 6, sizeMax: 12}, // pénalisé /2
      {code: NODES.PLATINUM.code, percent: 0.004, sizeMin: 6, sizeMax: 12},
      {code: NODES.EMERALD.code, percent: 0.002, sizeMin: 6, sizeMax: 12},
      {code: NODES.SAPPHIRE.code, percent: 0.003, sizeMin: 8, sizeMax: 16}
    ]
  }
}


export const PERLIN_OFFSET_NATURALIZER = 100
export const PERLIN_OFFSET_TUNNEL = 200
export const PERLIN_OFFSET_SURFACE_TUNNEL = 300
export const PERLIN_OFFSET_SMALL_TUNNEL = 400
export const PERLIN_OFFSET_CAVERN = 500
export const PERLIN_OFFSET_HIVE = 600
export const PERLIN_OFFSET_COBWEB = 700

export const SMALL_CAVERNS_COUNT = 80
export const MEDIUM_CAVERNS_COUNT = 120
export const UNDERGROUND_TUNNEL_COUNT = 50
export const CAVERNS_TUNNEL_COUNT = 75
export const SMALL_TUNNELS_COUNT = 150
export const HIVE_RADIUS_MIN = 10
export const HIVE_RADIUS_MAX = 15

export const COBWEB_CAVE_COUNT_MIN = 4
export const COBWEB_CAVE_COUNT_MAX = 8
export const COBWEB_RADIUS_X_MIN = 16
export const COBWEB_RADIUS_X_MAX = 22
export const COBWEB_RADIUS_Y_MIN = 8
export const COBWEB_RADIUS_Y_MAX = 12
