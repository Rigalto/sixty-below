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
