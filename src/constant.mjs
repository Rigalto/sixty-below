// constant.mjs

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
  combat: {state: STATE.COMBAT, zIndex: 90},
  achievement: {state: STATE.INFORMATION, zIndex: 100},
  creation: {state: STATE.CREATION, zIndex: 110},
  dialog: {state: null, zIndex: 150},
  system: {state: null, zIndex: 200}
}

export const UI_LAYOUT = {
  MENU_BAR: 10,
  ENVIRONMENT: 20,
  LIFE: 30,
  BUFF: 40,
  WORLD_KEY: 80,
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
// Pas de constantes, on écrira en dur :
//    const index = y << 10 | x

/* =========================================
   4. TILE PROPERTIES (BITMASKS)
   ========================================= */
// Encodage des propriétés des tuiles sur les bits supérieurs si nécessaire
// ou usage pour les collisions

// à concevoir

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

export const WEATHER_TYPE_CODE = {SUNNY: 0, CLOUDY: 1, RAINY: 2, WINDY: 3, STORMY: 4}
export const WEATHER_TYPE = [
  {code: WEATHER_TYPE_CODE.SUNNY, name: 'Sunny', weight: 10, icon: '☀️'},
  {code: WEATHER_TYPE_CODE.CLOUDY, name: 'Cloudy', weight: 20, icon: '☁️'},
  {code: WEATHER_TYPE_CODE.RAINY, name: 'Rainy', weight: 30, icon: '🌧️'},
  {code: WEATHER_TYPE_CODE.WINDY, name: 'Windy', weight: 25, icon: '💨'},
  {code: WEATHER_TYPE_CODE.STORMY, name: 'Stormy', weight: 15, icon: '⛈️'}
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
  VERSION: 3,
  DEBUG: true,
  STORES: [
    'world_chunks', // Stockage des chunks (Uint8Array)
    'gamestate', // Time, Seed, Player position...
    'inventory', // Items, Gears, Chests
    'buff', // Buffs/Debuffs
    'plant', // Trees, Herbs, Mushrooms, Flowers, Corals
    'monster', // Enemies, Criters, Bosses
    'furniture', // Furniture (Housing), Crafting Station
    'liquid', // 'index' et 'code' d'une des tuiles de chaque liquid body
    'achievements' // Compteurs de succès : {code, count}
  ]
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
   DEFINITION DE L'INVENTAIRE
   ========================================= */

export const BAG_CAPACITY = 64
export const HOTBAR_CAPACITY = 8
export const ARMOR_CAPACITY = 3
export const ACCESSORY_CAPACITY = 5
export const CONTAINER_STYPES = new Set(['chest', 'closet', 'cabinet'])
export const CONTAINER_CAPACITY = {chest: 56, closet: 64, cabinet: 48}
export const ARMOR_SLOTS = ['head', 'body', 'foot']
export const ARMOR_SLOT_LABELS = ['Head', 'Body', 'Foot']

/* =========================================
   DEFINITION DES ITEMS
   ========================================= */

export const MAX_FURNITURE_W = 3 // largeur max d'un furniture, en tuiles
export const MAX_FURNITURE_H = 3 // hauteur max d'un furniture, en tuiles

/* =========================================
      DEFINITION DU PLAYER
      ========================================= */

export const PLAYER = {
  w: 26, // px — largeur hitbox
  h: 46, // px — hauteur hitbox
  speed: 0.3 // px/ms — vitesse de déplacement de base (sans buff)
}

/* =========================================
   DEFINITION DES ICONES
   ========================================= */

export const PATH_RENAME = 'M16.76 15.37l1.33-1.33c0.21-0.21 0.57-0.06 0.57 0.24V20.33c0 1.1-0.9 2-2 2H2c-1.1 0-2-0.9-2-2V5.67c0-1.1 0.9-2 2-2h11.4c0.3 0 0.45 0.36 0.24 0.57l-1.33 1.33c-0.06 0.06-0.15 0.1-0.24 0.1H2v14.67h14.67V15.6c0-0.09 0.03-0.17 0.1-0.23Zm6.53-8.41L12.35 17.9l-3.77 0.42c-1.09 0.12-2.02-0.8-1.9-1.9l0.42-3.77L18.04 1.71c0.95-0.95 2.5-0.95 3.45 0l1.8 1.8c0.95 0.95 0.95 2.5 0 3.45ZM19.17 8.25L16.75 5.83 9.01 13.58l-0.3 2.72 2.72-0.3L19.17 8.25Zm2.7-3.32l-1.8-1.8c-0.17-0.17-0.45-0.17-0.62 0L18.17 4.42l2.42 2.42 1.29-1.29c0.17-0.17 0.17-0.45 0-0.62Z'
export const PATH_LOCKED = 'M4 13a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-10a3 3 0 0 1-3-3zM6 19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1zM10 16a2 2 0 0 1 4 0 2 2 0 0 1-4 0zM7 11v-4a5 5 0 0 1 10 0v4h-2v-4a3 3 0 0 0-6 0v4z'
export const PATH_UNLOCKED = 'M4 13a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-10a3 3 0 0 1-3-3zM6 19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1zM10 16a2 2 0 0 1 4 0 2 2 0 0 1-4 0zM7 11v-4a5 5 0 0 1 10 0 1 1 0 0 1-2 0 3 3 0 0 0-6 0v4z'
export const PATH_HELP = 'M20 2h-16a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-16a2 2 0 0 0-2-2zM20 20h-16v-16h16v16zM10 9a1 1 0 0 1-2 0 4 4 0 0 1 8 0 2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 1-2 0v-2a3 3 0 0 1 3-3 2 2 0 0 0-4 0zM11 17a1 1 0 0 1 2 0 1 1 0 0 1-2 0z'
export const PATH_CRAFT = 'M2 6a2 2 0 0 1 0-4h14v4zM22 2h2v4h-2zM17 1a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1zM0 11a1 1 0 0 1 1-1h22a1 1 0 0 1 1 1v4h-24zM2 14h2v6h16v-6h2v10h-4v-2h-12v2h-4zM6 14h2v2h8v-2h2v4h-12z'
export const PATH_DEBUG = 'M7 7a5 5 0 0 1 10 0h-2a3 3 0 0 0-6 0zM5 7h14v2h-14zM5 9h2v7a5 4 0 0 0 10 0v-7h2v7a7 6 0 0 1-14 0zM11 21v-8a1 1 0 0 1 2 0v8zM18 13h4a1 1 0 0 1 0 2h-4zM6 15h-4a1 1 0 0 1 0-2h4zM18 7l2.5-2.5a1 1 0 0 1 1.42 1.42l-4 4zM6.08 9.92l-4-4a1 1 0 0 1 1.42-1.42l2.5 2.5zM18 18.29l3 3a1 1 0 0 1-1.42 1.42l-3-3zM7.42 19.71l-3 3a1 1 0 0 1-1.42-1.42l3-3z'
export const PATH_TRASH_UP = 'M2 6a1 1 0 0 1 0-2h20a1 1 0 0 1 0 2zM3 5h2v17h14v-17h2v17a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2zM6 5l1.95-3.89a2 2 0 0 1 1.79-1.11h4.53a2 2 0 0 1 1.79 1.11l1.95 3.89h-2.5l-1.5-3h-4l-1.5 3zM13 11h-2v7a1 1 0 0 0 2 0zM7.29 13.29a1 1 0 0 0 1.42 1.42l3.29-3.29 3.29 3.29a1 1 0 0 0 1.42-1.42l-4-4a1 1 0 0 0-1.42 0z'
export const PATH_TRASH_DOWN = 'M2 6a1 1 0 0 1 0-2h20a1 1 0 0 1 0 2zM3 5h2v17h14v-17h2v17a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2zM6 5l1.95-3.89a2 2 0 0 1 1.79-1.11h4.53a2 2 0 0 1 1.79 1.11l1.95 3.89h-2.5l-1.5-3h-4l-1.5 3zM11 17h2v-7a1 1 0 0 0-2 0zM16.71 14.71a1 1 0 0 0-1.42-1.42l-3.29 3.29-3.29-3.29a1 1 0 0 0-1.42 1.42l4 4a1 1 0 0 0 1.42 0z'
export const PATH_ARROW_RIGHT = 'M2.36 10a2 2 0 0 1 2-2h6v-4.59a2 2 0 0 1 3.41-1.41l7.88 7.88a3 3 0 0 1 0 4.24l-7.88 7.88a2 2 0 0 1-3.41-1.41v-4.59h-6a2 2 0 0 1-2-2zM4.36 10v4h8v6l8-8-8-8v6z'
export const PATH_SPLIT = 'M2 11a1 1 0 0 0 0 2h6a3 3 0 0 1 3 3 3 3 0 0 0 3 3h7v-2h-7a1 1 0 0 1-1-1 5 5 0 0 0-5-5zM2 11a1 1 0 0 0 0 2h6a5 5 0 0 0 5-5 1 1 0 0 1 1-1h7v-2h-7a3 3 0 0 0-3 3 3 3 0 0 1-3 3zM20.24 17.94l-2.61 2.61a1 1 0 0 0 1.42 1.42l3.32-3.32a1 1 0 0 0 0-1.41l-3.32-3.32a1 1 0 0 0-1.42 1.42zM20.24 5.94l-2.61 2.61a1 1 0 0 0 1.42 1.42l3.32-3.32a1 1 0 0 0 0-1.41l-3.32-3.32a1 1 0 0 0-1.42 1.42z'
export const PATH_USE = 'M0 4a4 4 0 0 1 8 0 4 4 0 0 1-8 0zM2 4a2 2 0 0 0 4 0 2 2 0 0 0-4 0zM12 4a4 4 0 0 1 8 0 4 4 0 0 1-8 0zM14 4a2 2 0 0 0 4 0 2 2 0 0 0-4 0zM12 16a4 4 0 0 1 8 0 4 4 0 0 1-8 0zM14 16a2 2 0 0 0 4 0 2 2 0 0 0-4 0zM0 16a4 4 0 0 1 8 0 4 4 0 0 1-8 0zM2 16a2 2 0 0 0 4 0 2 2 0 0 0-4 0zM18.71 17.29l4.8 4.8a1 1 0 0 1-1.42 1.42l-4-4z'
export const PATH_SEARCH = 'M0 10a10 10 0 0 1 20 0 10 10 0 0 1-20 0zM2 10a8 8 0 0 0 16 0 8 8 0 0 0-16 0zM17.19 18.61a1 1 0 0 1 1.42-1.42l5 5a1 1 0 0 1-1.42 1.42z'
export const PATH_CANCEL = 'M20 2h-16a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-16a2 2 0 0 0-2-2zM20 20h-16v-16h16v16zM7.08 8.5a1 1 0 0 1 1.42-1.42l3.5 3.5 3.5-3.5a1 1 0 0 1 1.42 1.42l-3.5 3.5 3.5 3.5a1 1 0 0 1-1.42 1.42l-3.5-3.5-3.5 3.5a1 1 0 0 1-1.42-1.42l3.5-3.5z'
export const PATH_NEW_WORLD = 'M15 12a9 9 0 0 1 9 9 1 1 0 0 1-2 0 7 7 0 0 0-7-7 1 1 0 0 1 0-2zM19 18a1 1 0 0 1 0 2 1 1 0 0 1 0-2zM17 23a1 1 0 0 1-2 0 7 7 0 0 0-1.5-4.67 1 1 0 0 1 1.63-1.17 9 9 0 0 1 1.87 5.84zM12 15a9 9 0 0 1-9 9 1 1 0 0 1 0-2 7 7 0 0 0 7-7 1 1 0 0 1 2 0zM6 19a1 1 0 0 1-2 0 1 1 0 0 1 2 0zM1 17a1 1 0 0 1 0-2 7 7 0 0 0 4.67-1.5 1 1 0 0 1 1.17 1.63 9 9 0 0 1-5.84 1.87zM9 12a9 9 0 0 1-9-9 1 1 0 0 1 2 0 7 7 0 0 0 7 7 1 1 0 0 1 0 2zM5 6a1 1 0 0 1 0-2 1 1 0 0 1 0 2zM7 1a1 1 0 0 1 2 0 7 7 0 0 0 1.5 4.67 1 1 0 0 1-1.63 1.17 9 9 0 0 1-1.87-5.84zM12 9a9 9 0 0 1 9-9 1 1 0 0 1 0 2 7 7 0 0 0-7 7 1 1 0 0 1-2 0zM18 5a1 1 0 0 1 2 0 1 1 0 0 1-2 0zM23 7a1 1 0 0 1 0 2 7 7 0 0 0-4.67 1.5 1 1 0 0 1-1.17-1.63 9 9 0 0 1 5.84-1.87zM11 12a1 1 0 0 1 2 0 1 1 0 0 1-2 0z'
export const PATH_INVENTORY = 'M9 11a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM11 11v2h2v-2zM18 11a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM20 11v2h2v-2zM0 11a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM2 11v2h2v-2zM9 2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM11 2v2h2v-2zM18 2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM20 2v2h2v-2zM0 2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM2 2v2h2v-2zM9 20a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM11 20v2h2v-2zM18 20a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM20 20v2h2v-2zM0 20a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM2 20v2h2v-2z'
export const PATH_ZOOM_IN = 'M0 10a10 10 0 0 1 20 0 10 10 0 0 1-20 0zM2 10a8 8 0 0 0 16 0 8 8 0 0 0-16 0zM17.19 18.61a1 1 0 0 1 1.42-1.42l5 5a1 1 0 0 1-1.42 1.42zM9 6a1 1 0 0 1 2 0v3h3a1 1 0 0 1 0 2h-3v3a1 1 0 0 1-2 0v-3h-3a1 1 0 0 1 0-2h3z'
export const PATH_ZOOM_OUT = 'M0 10a10 10 0 0 1 20 0 10 10 0 0 1-20 0zM2 10a8 8 0 0 0 16 0 8 8 0 0 0-16 0zM17.19 18.61a1 1 0 0 1 1.42-1.42l5 5a1 1 0 0 1-1.42 1.42zM14.5 9a1 1 0 0 1 0 2h-9a1 1 0 0 1 0-2z'
export const PATH_MUSIC_ON = 'M22.5 0a1.5 1.5 0 0 0-0.45 0.07l-14.25 4.5A1.5 1.5 0 0 0 6.75 6v11.02A5.14 5.14 0 0 0 4.5 16.5c-2.48 0-4.5 1.68-4.5 3.75s2.02 3.75 4.5 3.75c2.31 0 4.2-1.46 4.45-3.33a1.82 1.82 0 0 0 0.05-0.41V12l12.75-4.03v6.05A5.15 5.15 0 0 0 19.5 13.5c-2.48 0-4.5 1.68-4.5 3.75s2.02 3.75 4.5 3.75c2.31 0 4.2-1.46 4.45-3.33a1.83 1.83 0 0 0 0.05-0.39c0-0.01 0-0.02 0-0.03V1.5a1.5 1.5 0 0 0-1.5-1.5ZM4.5 21.75c-1.33 0-2.25-0.79-2.25-1.5s0.92-1.5 2.25-1.5 2.25 0.79 2.25 1.5-0.92 1.5-2.25 1.5Zm17.25-4.5c0 0.71-0.92 1.5-2.25 1.5s-2.25-0.79-2.25-1.5 0.92-1.5 2.25-1.5 2.25 0.79 2.25 1.5Zm0-11.64l-12.75 4.03v-3.09l12.75-4.03Z'
export const PATH_MUSIC_OFF = 'M19.8 4.52v2.47l-7.09 2.24 1.72 1.34L19.8 8.88v5.89l1.8 1.41V3.7a1.2 1.2 0 0 0-1.56-1.14L8.74 6.12l1.72 1.34ZM23.78 20.16L1.35 2.63A0.6 0.6 0 0 0 0.51 2.73l-0.37 0.47A0.6 0.6 0 0 0 0.23 4.04l22.43 17.53a0.6 0.6 0 0 0 0.84-0.09l0.38-0.47A0.6 0.6 0 0 0 23.78 20.16ZM7.8 16.12A4.11 4.11 0 0 0 6 15.7c-1.99 0-3.6 1.34-3.6 3s1.61 3 3.6 3c1.85 0 3.36-1.17 3.56-2.67a1.45 1.45 0 0 0 0.04-0.32V13.65l-1.8-1.41ZM6 19.9c-1.06 0-1.8-0.63-1.8-1.2s0.74-1.2 1.8-1.2 1.8 0.63 1.8 1.2-0.74 1.2-1.8 1.2Z'
export const PATH_AMBIENT_ON = 'M4 10a3 3 0 0 1 3-3h4l4.59-4.59a2 2 0 0 1 3.41 1.41v16.34a2 2 0 0 1-3.41 1.41l-4.59-4.59h-4a3 3 0 0 1-3-3zM6 14a1 1 0 0 0 1 1h5l5 5v-16l-5 5h-5a1 1 0 0 0-1 1z'
export const PATH_AMBIENT_OFF = 'M1.29 2.71a1 1 0 0 1 1.42-1.42l20 20a1 1 0 0 1-1.42 1.42zM11 7l4.59-4.59a2 2 0 0 1 3.41 1.41v11.17l-2-2v-9l-4.5 4.5zM4 10a3 3 0 0 1 0.5-1.5l1.5 1.5v4a1 1 0 0 0 1 1h4l6.8 6.8a2 2 0 0 1-2 0l-4.8-4.8h-4a3 3 0 0 1-3-3z'
export const PATH_WARNING = 'M2.23 23a2 2 0 0 1-1.75-2.98l9.77-17.48a2 2 0 0 1 3.49 0l9.77 17.48a2 2 0 0 1-1.75 2.98zM2.5 21h19l-9.5-17zM11 10.5a1 1 0 0 1 2 0v4a1 1 0 0 1-2 0zM11 17.5a1 1 0 0 1 2 0 1 1 0 0 1-2 0z'
export const PATH_TROPHY = 'M18 1a1 1 0 0 1 1 1 7 15 0 0 1-14 0 1 1 0 0 1 1-1zM7 3a5 12 0 0 0 10 0zM11 16h2v5h3a1.5 1.5 0 0 1 1.5 1.5 0.5 0.5 0 0 1-0.5 0.5h-10a0.5 0.5 0 0 1-0.5-0.5 1.5 1.5 0 0 1 1.5-1.5h3zM18 4h5a1 1 0 0 1 1 1v3a8 5 0 0 1-8 5v-2a6 3 0 0 0 6-3v-2h-4zM6 6h-4v2a6 3 0 0 0 6 3v2a8 5 0 0 1-8-5v-3a1 1 0 0 1 1-1h5z'

export const SVG_ICON = (icon, config = '') => `<svg viewBox="0 0 24 24" ${config}><path fill="currentColor" d="${icon}"/></svg>`

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
