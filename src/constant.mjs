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
  UPDATE: 3,     // Physique, Déplacement
  RENDER: 4,     // Canvas Drawing
  MICROTASK: 5,  // Pathfinding, Generation, UI Updates
  DOM: 4         // Browser overhead (GC, Event Loop)
}

// États du jeu (State Machine)
export const GAME_STATE = {
  EXPLORATION: 'state_exploration', // Temps réel
  COMBAT: 'state_combat',           // Tour par tour
  INFORMATION: 'state_information'  // Pause / Menus
}

/* =========================================
   2. WORLD & PHYSICS
   ========================================= */

// Dimensions fondamentales (cf. Design 3.1)
export const TILE_SIZE = 16 // pixels
export const CHUNK_SIZE = 16 // tuiles

// Dimensions du Monde (Fixe)
export const WORLD_WIDTH = 2048 // tuiles
export const WORLD_HEIGHT = 768 // tuiles

// Dimensions du Monde en Chunks
export const WORLD_WIDTH_CHUNKS = WORLD_WIDTH / CHUNK_SIZE // 128
export const WORLD_HEIGHT_CHUNKS = WORLD_HEIGHT / CHUNK_SIZE // 48
export const TOTAL_CHUNKS = WORLD_WIDTH_CHUNKS * WORLD_HEIGHT_CHUNKS // 6144

// Échelle physique
export const PIXEL_TO_METER = 0.03125 // 1px = 1/32m (donc 16px = 0.5m)

/* =========================================
   3. BITWISE OPERATIONS & OPTIMIZATIONS
   ========================================= */
// Optimisations pour éviter les multiplications/divisions
// Exemple: y * 2048 devient y << WORLD_WIDTH_SHIFT

export const WORLD_WIDTH_SHIFT = 11 // 2^11 = 2048
export const CHUNK_SHIFT = 4        // 2^4 = 16

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
  SOLID: 1 << 0,       // 1: Bloque le mouvement
  PLATFORM: 1 << 1,    // 2: Traversable par le bas
  LIQUID: 1 << 2,      // 4: Ralentit, nage
  DAMAGE: 1 << 3,      // 8: Lave, pics
  SLOW: 1 << 4,        // 16: Ralentit (Toile d'araignée)
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
   6. DATABASE CONFIG
   ========================================= */

export const DB_CONFIG = {
  NAME: 'SixtyBelowDB',
  VERSION: 1,
  STORES: {
    WORLD: 'world_chunks',    // Stockage des Uint16Array
    PLAYER: 'player_data',    // Position, Stats
    CONFIG: 'game_config',    // Time, Seed
    INVENTORY: 'inventory',   // Items, Gears, Chests
    BUFF: 'buff',             // Buffs/Debuffs
    PLANT: 'plant',           // Trees, Herbs, Mushrooms, Flowers, Corals
    MONSTER: 'monster',       // Enemies, Criters, Bosses
    FURNITURE: 'furniture'    // Furniture (Housing), Crafting Station
  }
}

/* =========================================
   7. UI LAYERS (Z-INDEX & ID)
   ========================================= */

export const UI_LAYERS = {
  GAME: 'game-layer',   // Canvas 0
  ENV: 'env-layer',     // Canvas 1
  UI: 'ui-layer',       // Canvas 2
  PANEL: 'modal-layer'  // DOM
}

/* =========================================
   8. COLORS & PALETTES (Fallback)
   ========================================= */

export const PALETTE = {
  DEBUG_GRID: 'rgba(255, 255, 255, 0.1)',
  DEBUG_CHUNK: 'rgba(255, 0, 0, 0.3)',
  BACKGROUND: '#0d0d15' // Couleur de fond par défaut
}
