/**
 * @file constant.mjs
 * @description Layer 0 - Constantes globales, Enums et Bitmasks.
 * Aucune dépendance externe autorisée.
 */

/* =========================================
   1. SYSTEM & PERFORMANCE
   ========================================= */

export const FPS = 60
export const FRAME_DURATION = 1000 / FPS // ~16.66ms

// Budgets temps en millisecondes (cf. Design 2.2)
export const TIME_BUDGET = {
  UPDATE: 3, // Physique, Déplacement
  RENDER: 4, // Canvas Drawing
  MICROTASK: 5, // Pathfinding, Generation, UI Updates
  DOM: 4 // Browser overhead (GC, Event Loop)
}

// États du jeu (State Machine)
export const STATE = {
  EXPLORATION: 0, // Temps réel
  INFORMATION: 1, // Pause / Menus
  CREATION: 2, // Pause / Menus
  COMBAT: 3 // Tour par tour - TODO: peut-être à intégrer dans INFORMATION
}

export const OVERLAYS = {
  sky: {state: null, zIndex: 0},
  world: {state: null, zIndex: 10},
  light: {state: null, zIndex: 20},
  backdrop: {state: null, zIndex: 30},
  inventory: {state: STATE.INFORMATION, zIndex: 40},
  craft: {state: STATE.INFORMATION, zIndex: 50},
  help: {state: STATE.INFORMATION, zIndex: 60},
  map: {state: STATE.INFORMATION, zIndex: 70},
  combat: {state: STATE.COMBAT, zIndex: 100},
  creation: {state: STATE.CREATION, zIndex: 110},
  dialog: {state: null, zIndex: 150},
  system: {state: null, zIndex: 200}
}

export const UI_LAYOUT = {
  MENU_BAR: 10,
  ENVIRONMENT: 20,
  LIFE: 30,
  BUFF: 40,
  DEBUG_REALTIME: 90
}

/* =========================================
   2. WORLD & PHYSICS
   ========================================= */

// Dimensions fondamentales (cf. Design 3.1)
// export const TILE_SIZE = 16 // pixels
// export const CHUNK_SIZE = 16 // tuiles

// Dimensions du Monde (Fixes)
export const WORLD_WIDTH = 1024 // tuiles
export const WORLD_HEIGHT = 512 // tuiles

// Dimensions du Canvas (Fixes)
export const CANVAS_WIDTH = 1024 // pixels
export const CANVAS_HEIGHT = 768 // pixels
// Niveau de la mer
export const SEA_LEVEL = 56 // tuiles
// Frontières Y de référence pour les différentes layers
export const TOPSOIL_Y_SKY_SURFACE = 48
export const TOPSOIL_Y_SURFACE_UNDER = 96
export const TOPSOIL_Y_UNDER_CAVERNS = 240
export const TOPSOIL_Y_CAVERNS_MID = 375

// Dimensions du Monde en Chunks
// export const WORLD_WIDTH_CHUNKS = WORLD_WIDTH / CHUNK_SIZE // 128
// export const WORLD_HEIGHT_CHUNKS = WORLD_HEIGHT / CHUNK_SIZE // 48

// Échelle physique
// export const PIXEL_TO_METER = 0.03125 // 1px = 1/32m (donc 16px = 0.5m)

/* =========================================
   3. BITWISE OPERATIONS & OPTIMIZATIONS
   ========================================= */
// Optimisations pour éviter les multiplications/divisions
// Exemple: y * 2048 devient y << WORLD_WIDTH_SHIFT

export const WORLD_WIDTH_SHIFT = 11 // 2^11 = 2048
export const CHUNK_SHIFT = 4 // 2^4 = 16

// Masque pour obtenir la position locale dans un chunk (0-15)
// Exemple: x % 16 devient x & CHUNK_MASK
export const CHUNK_MASK = 0b1111 // 15

/* =========================================
   4. TILE PROPERTIES (BITMASKS)
   ========================================= */
// Encodage des propriétés des tuiles sur les bits supérieurs si nécessaire
// ou usage pour les collisions

export const COLLISION_MASK = {
  NONE: 0,
  SOLID: 1 << 0, // 1: Bloque le mouvement
  PLATFORM: 1 << 1, // 2: Traversable par le bas
  LIQUID: 1 << 2, // 4: Ralentit, nage
  DAMAGE: 1 << 3, // 8: Lave, pics
  SLOW: 1 << 4 // 16: Ralentit (Toile d'araignée)
}

/* =========================================
   5. TIME & CALENDAR
   ========================================= */
// 1 min réelle = 1 heure monde
// 24 min réelles = 1 jour monde (24h)
export const REAL_MS_PER_GAME_MIN = 1000 // 1 sec réelle = 1 min jeu
export const GAME_MIN_PER_REAL_MS = 1 / REAL_MS_PER_GAME_MIN

export const DAY_DURATION_GAME_MIN = 24 * 60 // 1440 minutes jeu

/* =========================================
   6. ENVIRONNEMENT (TIME & WEATHER)
   ========================================= */

export const SKY_COLORS = [
  '#300606', '#380715', '#400824', '#480933', '#500A42', '#580B51', '#600C60', '#680D6F',
  '#700E7E', '#780F8D', '#80109C', '#8811AB', '#9012BA', '#9813C9', '#A014D8', '#A815E7',
  '#B016F6', '#B817FF', '#C026FF', '#C835FF', '#D044FF', '#D853FF', '#E062FF', '#E871FF',
  '#F080FF', '#F88FFF', '#FF9EFF', '#FFADFF', '#FFBCF7', '#FFCBEF', '#FFDAE7', '#FFE9DF',
  '#FFF8D7', '#FFFFCF', '#FFFFE7', '#E6F3FF' // Jour (Index 35)
]

export const WEATHER_TYPE = [
  {code: 0, name: 'Sunny', weight: 10, icon: '☀️'},
  {code: 1, name: 'Cloudy', weight: 20, icon: '☁️'},
  {code: 2, name: 'Rainy', weight: 30, icon: '🌧️'},
  {code: 3, name: 'Windy', weight: 25, icon: '💨'},
  {code: 4, name: 'Stormy', weight: 15, icon: '⛈️'}
]

export const MOON_PHASE = [
  {code: 0, name: 'Full Moon', icon: '🌕'},
  {code: 1, name: 'Waning Gibbous', icon: '🌖'},
  {code: 2, name: 'Third Quarter', icon: '🌗'},
  {code: 3, name: 'Waning Crescent', icon: '🌘'},
  {code: 4, name: 'New Moon', icon: '🌑'},
  {code: 5, name: 'Waxing Crescent', icon: '🌒'},
  {code: 6, name: 'First Quarter', icon: '🌓'},
  {code: 7, name: 'Waxing Gibbous', icon: '🌔'}
]
export const MOON_PHASE_BLURRED = [0, 0, 2, 2, 4, 6, 6, 0]

// Index des tranches horaires (3h)
export const TIME_SLOT = ['Midnight', 'Dawn', 'Morning', 'Noon', 'Afternoon', 'Dusk', 'Evening', 'Night']

/* =========================================
   6. DATABASE CONFIG
   ========================================= */

export const DB_CONFIG = {
  NAME: 'SixtyBelowDB',
  VERSION: 1,
  DEBUG: true,
  STORES: [
    'world_chunks', // Stockage des chunks (Uint8Array)
    'gamestate', // Time, Seed, Player position...
    'inventory', // Items, Gears, Chests
    'buff', // Buffs/Debuffs
    'plant', // Trees, Herbs, Mushrooms, Flowers, Corals
    'monster', // Enemies, Criters, Bosses
    'furniture' // Furniture (Housing), Crafting Station
  ]
  // STORES1: {
  //   WORLD: 'world_chunks', // Stockage des Uint16Array
  //   PLAYER: 'player_data', // Position, Stats
  //   CONFIG: 'game_config', // Time, Seed
  //   INVENTORY: 'inventory', // Items, Gears, Chests
  //   BUFF: 'buff', // Buffs/Debuffs
  //   PLANT: 'plant', // Trees, Herbs, Mushrooms, Flowers, Corals
  //   MONSTER: 'monster', // Enemies, Criters, Bosses
  //   FURNITURE: 'furniture' // Furniture (Housing), Crafting Station
  // }
}

/* =========================================
   7. UI LAYERS (Z-INDEX & ID)
   ========================================= */

export const UI_LAYERS = {
  GAME: 'game-layer', // Canvas 0
  ENV: 'env-layer', // Canvas 1
  UI: 'ui-layer', // Canvas 2
  PANEL: 'modal-layer' // DOM
}

/* =========================================
   COLORS & PALETTES (Fallback)
   ========================================= */

// pas encore utilisé
export const PALETTE = {
  DEBUG_GRID: 'rgba(255, 255, 255, 0.1)',
  DEBUG_CHUNK: 'rgba(255, 0, 0, 0.3)',
  BACKGROUND: '#0d0d15' // Couleur de fond par défaut
}

/* =========================================
   DEFINITION DES NOEUDS
   ========================================= */

// const tileCode = NODES.CLAY.code
// const tileDesc = NODES.CLAY
// const tileDesc = NODES_LOOKUP[tileCode]

// CI-DESSOUS A SUPPRIMER

// 1. Calcul des Flags
//   let flags = TILE_FLAG.NONE
//   if (node.solid) flags |= TILE_FLAG.SOLID
//   if (node.type === TILE_TYPE.LIQUID) flags |= TILE_FLAG.LIQUID
//   if (node.type === TILE_TYPE.WALL || node.type === TILE_TYPE.BWALL) flags |= TILE_FLAG.WALL
//   if (node.speed > 0) flags |= TILE_FLAG.MINABLE

// 2. Enrichissement de l'objet (Mutation)
//   node.flags = flags
//   node.rgbColor = hexToRgb(node.color) // TODO Vérifier si utile
//   node.viscosity = node.viscosity || 0
//   node.speed = node.speed || 0

// Préparation pour hydratation (sera remplacé par assets.mjs)
//   node._imageRaw = node.image // utilité ?
//   node._waveRaw = node.waveImage
//   node.renderData = null
//   node.waveRenderData = null

// 3. Stockage Référence
//   NODES_LOOKUP[node.code] = node

// 4. Linkage Biomes
//   if (node.biome !== undefined && BIOME.code[node.biome]) {
//     const b = BIOME.code[node.biome]
//     if (node.type === TILE_TYPE.TOPSOIL) b.ground = node.code
//     else if (node.type === TILE_TYPE.GEM) b.gem = node.code
//   }
// }

/* =========================================
   CAPACITES ET PRIORITES DES MICRO-TACHES
   ========================================= */

export const MICROTASK = {
  RENDER_CHUNK_QUEUE: {priority: 30, capacity: 12, taskName: 'processRenderQueue'}, // génère les images des dirty chunks
  UI_ENV_UPDATE: {priority: 20, capacity: 2, taskName: 'updateClockInOverlay'}, // affiche l'overlay time/weather/Moon/Location
  PROCESS_SAVE: {priority: 15, capacity: 12, taskName: 'processSave'}, // sauvegarde en database des chunks et autres records
  RENDER_DEBUG_OVERLAY: {priority: 10, capacity: 2, taskName: 'renderDebugOverlay'}, // affichage des informations de débug (temps exéec et taille files)
  PRUNE_CACHE: {priority: 8, capacity: 2, taskName: 'pruneCache'} // supprime les images des chunks distants
}

export const MICROTASK_FN_NAME_TO_KEY = Object.keys(MICROTASK).reduce((acc, key) => {
  // on crée l'entrée dans notre table de correspondance
  acc[MICROTASK[key].taskName] = MICROTASK[key].capacity
  return acc
}, {})
