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
  inventory: {state: STATE.INFORMATION, zIndex: 30},
  craft: {state: STATE.INFORMATION, zIndex: 40},
  help: {state: STATE.INFORMATION, zIndex: 50},
  map: {state: STATE.INFORMATION, zIndex: 60},
  combat: {state: STATE.COMBAT, zIndex: 100},
  creation: {state: STATE.CREATION, zIndex: 110}
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
    'world_chunks', // Stockage des Uint16Array
    'player_data', // Position, Stats
    'game_config', // Time, Seed
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

export const NODE_TYPE = {SPACE: 0x1, NATURAL: 0x2, TOPSOIL: 0x4, SUBSTRAT: 0x8, LIQUID: 0x10, ORE: 0x20, GEM: 0x40, ROCK: 0x80, WOOD: 0x100, WALL: 0x200, BWALL: 0x400, WEB: 0x800, STRONG: 0x1000, XXXX: 0x2000, CREATION: 0x4000}

export const NODES = {
  // modifier 'isEmptyTileCode' si les codes changent
  OUTSIDE: {code: 0, name: 'Out of World', type: NODE_TYPE.CREATION, color: '#000000'},
  SKY: {code: 1, name: 'Sky', type: NODE_TYPE.SPACE, color: '#E6F3FF', star: 0, solid: false},
  VOID: {code: 2, name: 'Void', type: NODE_TYPE.SPACE, color: '#300606', star: 0, solid: false},
  INVISIBLE: {code: 3, name: 'Invisible', type: NODE_TYPE.SPACE, color: '#300606', star: 0, solid: true},
  BASALT: {code: 4, name: 'Basalt', type: NODE_TYPE.STRONG, color: '#000000', star: 6, solid: true},

  CLAY: {code: 5, name: 'Clay', type: NODE_TYPE.TOPSOIL, stype: 'block', star: 1, solid: true, color: '#af784d', image: 'substrat_16_16+3', speed: 1000, mining: [{item: 'bkclay', count: 1}]},
  MUD: {code: 6, name: 'Mud', type: NODE_TYPE.TOPSOIL, stype: 'block', star: 1, solid: true, color: '#853a51', image: 'substrat_16_16+4', speed: 1000, mining: [{item: 'bkmud', count: 1}]},
  SILT: {code: 7, name: 'Silt', type: NODE_TYPE.TOPSOIL, stype: 'block', star: 1, solid: true, color: '#4f5b6c', image: 'substrat_16_16+7', speed: 1000, mining: [{item: 'bksilt', count: 1}]},
  ASH: {code: 8, name: 'Ash', type: NODE_TYPE.TOPSOIL, stype: 'block', star: 1, solid: true, color: '#1b283b', speed: 1000, image: 'substrat_16_16+8', mining: [{item: 'bkash', count: 1}]},

  DIRT: {code: 9, name: 'Dirt', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 1, solid: true, color: '#835537', image: 'substrat_16_16+1', speed: 1000, mining: [{item: 'bkdirt', count: 1}, {item: 'worm', count: 0.15, lucky: 1.2, rainy: 1.7}]},
  STONE: {code: 10, name: 'Stone', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 1, solid: true, color: '#a4937f', image: 'substrat_16_16+2', speed: 1000, mining: [{item: 'bkston', count: 1}]},
  SAND: {code: 11, name: 'Sand', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 1, solid: true, color: '#fee267', image: 'substrat_16_16+5', speed: 500, mining: [{item: 'bksand', count: 1}], viscosity: 1000}, // 500
  HUMUS: {code: 12, name: 'Humus', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 1, solid: true, color: '#036632', image: 'substrat_16_16+6', speed: 1000, mining: [{item: 'bkhumus', count: 1}]},
  SLUSH: {code: 13, name: 'Slush', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 1, solid: true, color: '#641f97', image: 'substrat_16_16+10', speed: 600, mining: [{item: 'bkslush', count: 1}]},

  GRASS: {code: 16, name: 'Regular Grass', type: NODE_TYPE.NATURAL, star: 1, solid: true, color: '#84de50', image: 'grass_16_16+0', speed: 500, mining: [{item: 'bkclay', count: 1}, {item: 'seedf', count: 0.2}, {item: 'worm', count: 0.02, rainy: 40}], foraging: [{item: 'seedf', count: 0.2, lucky: 1.5}, {item: 'worm', count: 0.05, lucky: 2, rainy: 10}, {item: 'slug', count: 0.04, lucky: 1.8, rainy: 10}, {item: 'goldworm', count: 0.01}]},
  GRASSJUNGLE: {code: 17, name: 'Jungle Grass', type: NODE_TYPE.NATURAL, star: 2, solid: true, color: '#56ba27', image: 'grass_16_16+1', speed: 500, mining: [{item: 'bkmud', count: 1}, {item: 'seedj', count: 0.15}], foraging: [{item: 'seedj', count: 0.15, lucky: 1.5}, {item: 'slug', count: 0.05, lucky: 2, rainy: 10}]},
  GRASSMUSHROOM: {code: 18, name: 'Mushroom Grass', type: NODE_TYPE.NATURAL, star: 3, solid: true, color: '#56ba27', image: 'grass_16_16+2', speed: 500, mining: [{item: 'bksilt', count: 1}, {item: 'seedm', count: 0.1, lucky: 1.5}], foraging: [{item: 'seedm', count: 0.1, lucky: 1.5}, {item: 'slug', count: 0.05, lucky: 2, rainy: 10}]},
  GRASSASH: {code: 19, name: 'Ash Grass', type: NODE_TYPE.NATURAL, star: 4, solid: true, color: '#56ba27', image: 'grass_16_16+3', speed: 500, mining: [{item: 'bkash', count: 1}, {item: 'seeda', count: 0.05}], foraging: [{item: 'seeda', count: 0.06, lucky: 1.5}]},

  GRANITE: {code: 20, name: 'Granite', type: NODE_TYPE.ROCK, star: 4, solid: true, color: '#1966cc', image: 'rock_16_16+0', speed: 1500, mining: [{item: 'granite', count: 1}]}, // UNDERWORLD
  MARBLE: {code: 21, name: 'Marble', type: NODE_TYPE.ROCK, star: 4, solid: true, color: '#e6ddc4', image: 'rock_16_16+1', speed: 1500, mining: [{item: 'marble', count: 1}]}, // UNDERWORLD
  METEORITE: {code: 22, name: 'Meteroite', type: NODE_TYPE.ROCK, stype: 'block', star: 5, solid: true, color: '#7d6f5f', image: 'rock_16_16+2', speed: 2000, mining: [{item: 'bkmtrt', count: 1}]}, // SURFACE
  OBSIDIAN: {code: 23, name: 'Obsidian', type: NODE_TYPE.ROCK, star: 5, solid: true, color: '#73c882', image: 'rock_16_16+3', speed: 2000, mining: [{item: 'obsidian', count: 1}]}, // HELL
  HELLSTONE: {code: 24, name: 'Hellstone', type: NODE_TYPE.ROCK, stype: 'block', star: 5, solid: true, color: '#cc0030', image: 'rock_16_16+4', speed: 2200, mining: [{item: 'hellstone', count: 1}]}, // HELL
  SANDSTONE: {code: 14, name: 'Sandstone', type: NODE_TYPE.ROCK, stype: 'block', star: 1, solid: true, color: '#b87141', image: 'rock_16_16+5', speed: 1200, mining: [{item: 'sandstone', count: 1}]},
  HIVE: {code: 15, name: 'Hive', type: NODE_TYPE.ROCK, stype: 'block', star: 1, solid: true, color: '#fd8431', image: 'rock_16_16+6', speed: 1200, mining: [{item: 'bkhive', count: 1}]},

  COPPER: {code: 25, name: 'Copper Ore', type: NODE_TYPE.ORE, star: 1, solid: true, color: '#fe602f', image: 'ore_16_16+0', speed: 1000, mining: [{item: 'orcu', count: 1}]}, // GROUND
  IRON: {code: 26, name: 'Iron Ore', type: NODE_TYPE.ORE, star: 1, solid: true, color: '#af784d', image: 'ore_16_16+1', speed: 1100, mining: [{item: 'orfe', count: 1}]}, // GROUND
  SILVER: {code: 27, name: 'Silver Ore', type: NODE_TYPE.ORE, star: 2, solid: true, color: '#788696', image: 'ore_16_16+2', speed: 1200, mining: [{item: 'orag', count: 1}]}, // UNDERGROUND
  GOLD: {code: 28, name: 'Gold Ore', type: NODE_TYPE.ORE, star: 2, solid: true, color: '#ffaa33', image: 'ore_16_16+3', speed: 1400, mining: [{item: 'orau', count: 1}]}, // UNDERGROUND
  COBALT: {code: 29, name: 'Cobalt Ore', type: NODE_TYPE.ORE, star: 3, solid: true, color: '#2797ea', image: 'ore_16_16+4', speed: 1600, mining: [{item: 'orco', count: 1}]}, // UNDERWORLD
  PLATINUM: {code: 30, name: 'Platinum Ore', type: NODE_TYPE.ORE, star: 4, solid: true, color: '#25874d', image: 'ore_16_16+5', speed: 1800, mining: [{item: 'orpt', count: 1}]}, // HELL - images de tungsten dans Terraria

  TOPAZ: {code: 31, name: 'Topaz Deposit', type: NODE_TYPE.GEM, star: 1, solid: true, color: '#788696', image: 'gem_16_16+0', speed: 900, mining: [{item: 'topaz', count: 1}]}, // FOREST GROUND - UNDERGROUND
  RUBY: {code: 32, name: 'Ruby Deposit', type: NODE_TYPE.GEM, star: 2, solid: true, color: '#788696', image: 'gem_16_16+1', speed: 900, mining: [{item: 'ruby', count: 1}]}, // DESERT UNDERGROUND
  EMERALD: {code: 33, name: 'Emerald Deposit', type: NODE_TYPE.GEM, star: 3, solid: true, color: '#788696', image: 'gem_16_16+2', speed: 900, mining: [{item: 'emerald', count: 1}]}, // JUNGLE UNDERGROUND
  SAPPHIRE: {code: 34, name: 'Sapphire Deposit', type: NODE_TYPE.GEM, star: 4, solid: true, color: '#788696', image: 'gem_16_16+3', speed: 1100, mining: [{item: 'sapphire', count: 1}]}, // CAVERN

  WOODWALL: {code: 35, name: 'Wood Wall', type: NODE_TYPE.WALL, star: 1, solid: true, color: '#855959', image: 'wall_16_16+0', speed: 1200, hammering: [{item: 'woodwall', count: 1}]},
  BRICKWALL: {code: 36, name: 'Brick Wall', type: NODE_TYPE.BWALL, star: 1, solid: false, color: '#788696', image: 'wall_16_16+1', speed: 1200, hammering: [{item: 'brickwall', count: 1}]},
  STONEWALL: {code: 37, name: 'Stone Wall', type: NODE_TYPE.BWALL, star: 1, solid: false, color: '#788696', image: 'wall_16_16+2', speed: 1200, hammering: [{item: 'stonewall', count: 1}]},
  SANDSTONEWALL: {code: 38, name: 'Sandstone Wall', type: NODE_TYPE.BWALL, star: 1, solid: false, color: '#788696', image: 'wall_16_16+3', speed: 1200, hammering: [{item: 'sandstonewall', count: 1}]},
  COPPERWALL: {code: 39, name: 'Copper Wall', type: NODE_TYPE.BWALL, star: 2, solid: false, color: '#788696', image: 'wall_16_16+4', speed: 1400, hammering: [{item: 'copperwall', count: 1}]},
  IRONWALL: {code: 40, name: 'Iron Wall', type: NODE_TYPE.BWALL, star: 2, solid: false, color: '#788696', image: 'wall_16_16+5', speed: 1400, hammering: [{item: 'ironwall', count: 1}]},
  SILVERWALL: {code: 41, name: 'Silver Wall', type: NODE_TYPE.BWALL, star: 2, solid: false, color: '#788696', image: 'wall_16_16+6', speed: 1400, hammering: [{item: 'silverwall', count: 1}]},
  GOLDWALL: {code: 42, name: 'Gold Wall', type: NODE_TYPE.BWALL, star: 2, solid: false, color: '#788696', image: 'wall_16_16+7', speed: 1400, hammering: [{item: 'goldwall', count: 1}]},
  TOPAZWALL: {code: 43, name: 'Topaz Wall', type: NODE_TYPE.BWALL, star: 3, solid: false, color: '#788696', image: 'wall_16_16+8', speed: 1600, hammering: [{item: 'topazwall', count: 1}]},
  RUBYWALL: {code: 44, name: 'Ruby Wall', type: NODE_TYPE.BWALL, star: 3, solid: false, color: '#788696', image: 'wall_16_16+9', speed: 1600, hammering: [{item: 'rubywall', count: 1}]},
  EMERALDWALL: {code: 45, name: 'Emerald Wall', type: NODE_TYPE.BWALL, star: 3, solid: false, color: '#788696', image: 'wall_16_16+10', speed: 1600, hammering: [{item: 'emeraldwall', count: 1}]},
  SAPPHIREWALL: {code: 46, name: 'Sapphire Wall', type: NODE_TYPE.BWALL, star: 3, solid: false, color: '#788696', image: 'wall_16_16+11', speed: 1600, hammering: [{item: 'sapphirewall', count: 1}]},
  COBALTWALL: {code: 47, name: 'Cobalt Wall', type: NODE_TYPE.BWALL, star: 4, solid: false, color: '#788696', image: 'wall_16_16+12', speed: 1800, hammering: [{item: 'cobaltwall', count: 1}]},
  PLATINUMWALL: {code: 48, name: 'Platinum Wall', type: NODE_TYPE.BWALL, star: 4, solid: false, color: '#788696', image: 'wall_16_16+13', speed: 1800, hammering: [{item: 'platinumwall', count: 1}]},
  GRANITEWALL: {code: 49, name: 'Granite Wall', type: NODE_TYPE.BWALL, star: 4, solid: false, color: '#788696', image: 'wall_16_16+14', speed: 1800, hammering: [{item: 'granitewall', count: 1}]},
  MARBLEWALL: {code: 50, name: 'Marble Wall', type: NODE_TYPE.BWALL, star: 4, solid: false, color: '#788696', image: 'wall_16_16+15', speed: 1800, hammering: [{item: 'marblewall', count: 1}]},

  WEB: {code: 53, name: 'Cobweb', type: NODE_TYPE.WEB, star: 1, solid: false, color: '#788696', image: 'substrat_16_16+9', speed: 1900, mining: [{item: 'cobweb', count: 1}, {item: 'spideregg', count: '1-3-0.08'}, {monster: 'spider', rate: '25'}]},

  BRICK: {code: 54, name: 'Brick', type: NODE_TYPE.WALL, star: 1, solid: true, color: '#A52A2A'}, // DUNGEON - à supprimer

  // modifier 'isLiquidTileCode' si les codes changent
  SEA: {code: 55, name: 'Sea', type: NODE_TYPE.LIQUID, stype: 'water', level: 16, star: 0, solid: false, color: '#2D5EBF', image: 'liquid_16_16-0-0', waveImage: 'liquid_16_16-4-0', viscosity: 200},
  WATER: {code: 56, name: 'Water', type: NODE_TYPE.LIQUID, stype: 'water', level: 16, star: 0, solid: false, color: '#477BFF', image: 'liquid_16_16-1-0', viscosity: 200},
  HONEY: {code: 57, name: 'Honey', type: NODE_TYPE.LIQUID, stype: 'honey', level: 16, star: 0, solid: false, color: '#FFC700', image: 'liquid_16_16-2-0', viscosity: 600},
  LAVA: {code: 58, name: 'Lava', type: NODE_TYPE.LIQUID, stype: 'lava', level: 16, star: 0, solid: false, color: '#DC143C', image: 'liquid_16_16-3-0', viscosity: 800},
  SAP: {code: 59, name: 'Sap', type: NODE_TYPE.LIQUID, solid: false, color: '#008000', viscosity: 500},

  SHORE: {code: 60, name: 'Shore'},
  // types utilisés de manière temporaire pendant la création du monde
  HEART: {code: 61, name: 'Life Heart', type: NODE_TYPE.CREATION, color: '#FF19CD'}
}

/* =========================================
   INITIALISATION AUTOMATIQUE
   ========================================= */
export const NODES_LOOKUP = [] // Array Lookup

const hexToRgb = (hex) => {
  if (!hex) return {r: 0, g: 0, b: 0, rgb: 'rgb(0,0,0)'}
  const h = hex.startsWith('#') ? hex.slice(1) : hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return {r, g, b, rgb: `rgb(${r}, ${g}, ${b})`}
}

for (const key in NODES) {
  const nodeDesc = NODES[key]
  NODES_LOOKUP[nodeDesc.code] = nodeDesc
  // Préparation pour hydratation (sera remplacé par assets.mjs)
  nodeDesc.renderData = null
  nodeDesc.rgbColor = hexToRgb(nodeDesc.color)
}

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
  UI_ENV_UPDATE: {priority: 20, capacity: 2, taskName: 'updateClockInOverlay'}, // exemple #1
  RENDER_DEBUG_OVERLAY: {priority: 10, capacity: 2, taskName: 'renderDebugOverlay'} // affichage des informations de débug (temps exéec et taille files)
}

export const MICROTASK_FN_NAME_TO_KEY = Object.keys(MICROTASK).reduce((acc, key) => {
  // on crée l'entrée dans notre table de correspondance
  acc[MICROTASK[key].taskName] = MICROTASK[key].capacity
  return acc
}, {})
