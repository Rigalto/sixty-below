/**
 * @file data.mjs
 * @description Données métier : tuiles, items, plantes, recettes.
 * Layer : 3.
 * Seul fichier autorisé à être importé : constant.mjs.
 * Post-traitements exécutés au premier import (top-level).
 */

// import {NODE_TYPE} from '../../src/constant.mjs'

/* ============================================================================
   1. ENUMS MÉTIER
   ============================================================================ */

export const BIOME_TYPE = {SEA: 1, FOREST: 2, DESERT: 3, JUNGLE: 4}

// le type permet de fournir les informations suivantes :
// l'état de la matière correspodnant : 'gaz', 'liquide', 'solide', 'eternal' donnant son comportement dynamique
// sa nature (ce qu'il est) : 'NATURAL', 'TOPSOIL', ..., 'WEB'
// les actions qui peuvent être conduite dessus : 'MINABLE', 'FORAGEABLE', 'BUCKETABLE'...
export const NODE_TYPE = {GAZ: 0x1, LIQUID: 0x2, SOLID: 0x4, ETERNAL: 0x8, NATURAL: 0x10, TOPSOIL: 0x20, SUBSTRAT: 0x40, ORE: 0x80, GEM: 0x100, ROCK: 0x200, WOOD: 0x400, WALL: 0x800, BWALL: 0x1000, WEB: 0x2000}

/* ============================================================================
   2. NODES
   ============================================================================ */

export const NODES = {
  // ── Pourtour (ETERNAL — indestructibles, intégrées à la lore) ────────────────
  FOG: {code: 1, name: 'Fog', type: NODE_TYPE.ETERNAL | NODE_TYPE.GAZ, star: 6, color: 'none', image: null, help: null},
  DEEPSEA: {code: 2, name: 'Deep Sea', type: NODE_TYPE.ETERNAL | NODE_TYPE.LIQUID, star: 6, color: '#2D5EBF', image: null, waveImage: 'liquid_16_16-4-0', help: null},
  BASALT: {code: 3, name: 'Basalt', type: NODE_TYPE.ETERNAL | NODE_TYPE.SOLID, star: 6, color: '#3a3a3a', image: null, help: null},
  LAVA: {code: 4, name: 'Lava', type: NODE_TYPE.ETERNAL | NODE_TYPE.SOLID, star: 6, color: '#DC143C', image: null, help: 'Obsidian'},
  KHEPRITE: {code: 5, name: 'Kheprite', type: NODE_TYPE.ETERNAL | NODE_TYPE.SOLID, stype: 'block', star: 6, color: '#D4919A', image: null, help: 'Pyramid'},
  OLYMPITE: {code: 6, name: 'Olympite', type: NODE_TYPE.ETERNAL | NODE_TYPE.SOLID, stype: 'block', star: 6, color: '#C8D8E8', image: null, help: 'Lost Temple'},
  ANTDIRT: {code: 7, name: 'Ant Dirt', type: NODE_TYPE.ETERNAL | NODE_TYPE.SOLID, stype: 'ant', star: 6, color: '#8B4513', image: null, help: 'Compacted Earth'},

  // ── Gaz ──────────────────────────────────────────────────────────────────────
  SKY: {code: 10, name: 'Sky', type: NODE_TYPE.GAZ, star: 0, color: 'none', image: null, help: null},
  VOID: {code: 11, name: 'Void', type: NODE_TYPE.GAZ, star: 0, color: '#300606', image: null, help: null},
  INVISIBLE: {code: 12, name: 'Invisible', type: NODE_TYPE.SOLID, star: 0, color: '#300606', image: null, help: null},

  // ── Liquides ─────────────────────────────────────────────────────────────────
  SEA: {code: 20, name: 'Sea', type: NODE_TYPE.LIQUID, star: 0, color: '#2D5EBF', image: null, waveImage: 'liquid_16_16-4-0', viscosity: 200, help: 'Sea'},
  WATER: {code: 21, name: 'Water', type: NODE_TYPE.LIQUID, star: 0, color: '#477BFF', image: null, viscosity: 200, help: 'Water'},
  HONEY: {code: 22, name: 'Honey', type: NODE_TYPE.LIQUID, star: 0, color: '#FFC700', image: null, viscosity: 600, help: 'Honey'},
  SAP: {code: 23, name: 'Sap', type: NODE_TYPE.LIQUID, star: 0, color: '#008000', image: null, viscosity: 400, help: 'Sap'},

  // ── Natural (topsoil en surface recouvert de végétation) ─────────────────────
  GRASSFOREST: {code: 30, name: 'Forest Grass', type: NODE_TYPE.NATURAL, star: 1, solid: true, color: '#84de50', image: 'grass_16_16+0', speed: 500, mining: [{item: 'bkdirt', count: 1}, {item: 'seedf', count: 0.2}, {item: 'worm', count: 0.02, rainy: 40}], foraging: [{item: 'seedf', count: 0.2, lucky: 1.5}, {item: 'worm', count: 0.05, lucky: 2, rainy: 10}, {item: 'slug', count: 0.04, lucky: 1.8, rainy: 10}, {item: 'goldworm', count: 0.01}], help: 'Forest Grass'},
  GRASSJUNGLE: {code: 31, name: 'Jungle Grass', type: NODE_TYPE.NATURAL, star: 2, solid: true, color: '#56ba27', image: 'grass_16_16+1', speed: 500, mining: [{item: 'bkmud', count: 1}, {item: 'seedj', count: 0.15}], foraging: [{item: 'seedj', count: 0.15, lucky: 1.5}, {item: 'slug', count: 0.05, lucky: 2, rainy: 10}], help: 'Jungle Grass'},
  GRASSMUSHROOM: {code: 32, name: 'Mushroom Grass', type: NODE_TYPE.NATURAL, star: 3, solid: true, color: '#4cad1fff', image: 'grass_16_16+2', speed: 500, mining: [{item: 'bksilt', count: 1}, {item: 'seedm', count: 0.1, lucky: 1.5}], foraging: [{item: 'seedm', count: 0.1, lucky: 1.5}, {item: 'slug', count: 0.05, lucky: 2, rainy: 10}], help: 'Mushroom Grass'},
  GRASSFERN: {code: 33, name: 'Fern Grass', type: NODE_TYPE.NATURAL, star: 4, solid: true, color: '#56ba27', image: 'grass_16_16+3', speed: 500, mining: [{item: 'fern', count: 4, lucky: 5}], foraging: [{item: 'fern', count: 1, lucky: 1.5}], help: 'Fern Grass'},
  GRASSMOSS: {code: 34, name: 'Moss Grass', type: NODE_TYPE.NATURAL, star: 4, solid: true, color: '#b73ed6ff', image: 'grass_16_16+4', speed: 500, mining: [{item: 'moss', count: 2, lucky: 2.5}], foraging: [{item: 'moss', count: 1, lucky: 1.4}], help: 'Moss Grass'},
  WEB: {code: 35, name: 'Cobweb', type: NODE_TYPE.WEB, star: 1, solid: false, color: '#788696', image: 'substrat_16_16+9', speed: 1900, mining: [{item: 'cobweb', count: 1}, {item: 'spideregg', count: '1-3-0.08'}, {monster: 'spider', rate: '25'}], help: 'Cobweb'},

  // ── Topsoil (terrain nourricier, propice aux plantes) ────────────────────────
  DIRT: {code: 40, name: 'Dirt', type: NODE_TYPE.TOPSOIL, stype: 'block', star: 1, solid: true, color: '#835537', image: 'substrat_16_16+1', speed: 1000, mining: [{item: 'bkdirt', count: 1}, {item: 'worm', count: 0.15, lucky: 1.2, rainy: 1.7}], help: 'Dirt'},
  SAND: {code: 41, name: 'Sand', type: NODE_TYPE.TOPSOIL, stype: 'block', star: 1, solid: true, color: '#fee267', image: 'substrat_16_16+5', speed: 500, mining: [{item: 'bksand', count: 1}], viscosity: 500, help: 'Sand'},
  SILT: {code: 42, name: 'Silt', type: NODE_TYPE.TOPSOIL, stype: 'block', star: 1, solid: true, color: '#4f5b6c', image: 'substrat_16_16+7', speed: 1000, mining: [{item: 'bksilt', count: 1}], help: 'Silt'},
  HUMUS: {code: 43, name: 'Humus', type: NODE_TYPE.TOPSOIL, stype: 'block', star: 1, solid: true, color: '#036632', image: 'substrat_16_16+6', speed: 1000, mining: [{item: 'bkhumus', count: 1}], help: 'Humus'},

  // ── Substrat (roche de base, peu propice aux plantes) ────────────────────────
  // Forest
  CLAY: {code: 50, name: 'Clay', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 1, solid: true, color: '#af784d', image: 'substrat_16_16+3', speed: 1000, mining: [{item: 'bkclay', count: 1}], help: 'Clay'},
  STONE: {code: 51, name: 'Stone', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 2, solid: true, color: '#a4937f', image: 'substrat_16_16+2', speed: 1200, mining: [{item: 'bkston', count: 1}], help: 'Stone'},
  HARDSTONE: {code: 52, name: 'Hardstone', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 3, solid: true, color: '#5a5060', image: 'substrat_16_16+0', speed: 1800, mining: [{item: 'bkhard', count: 1}], help: 'Hardstone'},
  // Desert
  SANDSTONE: {code: 53, name: 'Sandstone', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 1, solid: true, color: '#b87141', image: 'rock_16_16+5', speed: 1200, mining: [{item: 'bksandst', count: 1}], help: 'Sandstone'},
  ASH: {code: 54, name: 'Ash', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 2, solid: true, color: '#1b283b', image: 'substrat_16_16+8', speed: 1400, mining: [{item: 'bkash', count: 1}], help: 'Ash'},
  HELLSTONE: {code: 55, name: 'Hellstone', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 5, solid: true, color: '#a14c5a', image: 'rock_16_16+4', speed: 2200, mining: [{item: 'hellstone', count: 1}], help: 'Hellstone'},
  // Jungle
  MUD: {code: 56, name: 'Mud', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 1, solid: true, color: '#853a51', image: 'substrat_16_16+4', speed: 1000, mining: [{item: 'bkmud', count: 1}], help: 'Mud'},
  LIMESTONE: {code: 57, name: 'Limestone', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 2, solid: true, color: '#c8c0a0', image: 'substrat_16_16+0', speed: 1400, mining: [{item: 'bklime', count: 1}], help: 'Limestone'},
  SLATE: {code: 58, name: 'Slate', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 3, solid: true, color: '#2a3a4a', image: 'substrat_16_16+0', speed: 1600, mining: [{item: 'bkslate', count: 1}], help: 'Slate'},

  // ── Ore (gisement de minerais) ────────────────────────
  COPPER: {code: 70, name: 'Copper Ore', type: NODE_TYPE.ORE, star: 1, solid: true, color: '#fe602f', image: 'ore_16_16+0', speed: 1000, mining: [{item: 'orcu', count: 1}], help: 'Metals'},
  IRON: {code: 71, name: 'Iron Ore', type: NODE_TYPE.ORE, star: 1, solid: true, color: '#af784d', image: 'ore_16_16+1', speed: 1100, mining: [{item: 'orfe', count: 1}], help: 'Metals'},
  SILVER: {code: 72, name: 'Silver Ore', type: NODE_TYPE.ORE, star: 2, solid: true, color: '#788696', image: 'ore_16_16+2', speed: 1200, mining: [{item: 'orag', count: 1}], help: 'Metals'},
  GOLD: {code: 73, name: 'Gold Ore', type: NODE_TYPE.ORE, star: 3, solid: true, color: '#ffaa33', image: 'ore_16_16+3', speed: 1400, mining: [{item: 'orau', count: 1}], help: 'Metals'},
  COBALT: {code: 74, name: 'Cobalt Ore', type: NODE_TYPE.ORE, star: 4, solid: true, color: '#2797ea', image: 'ore_16_16+4', speed: 1600, mining: [{item: 'orco', count: 1}], help: 'Metals'},
  PLATINUM: {code: 75, name: 'Platinum Ore', type: NODE_TYPE.ORE, star: 5, solid: true, color: '#25874d', image: 'ore_16_16+5', speed: 1800, mining: [{item: 'orpt', count: 1}], help: 'Metals'},

  // ── Gem (gisement de pierres précieuses) ────────────────────────
  TOPAZ: {code: 80, name: 'Topaz Deposit', type: NODE_TYPE.GEM, star: 2, solid: true, color: '#788696', image: 'gem_16_16+0', speed: 900, mining: [{item: 'rawTopaz', count: 1}], help: 'Gems'},
  RUBY: {code: 81, name: 'Ruby Deposit', type: NODE_TYPE.GEM, star: 3, solid: true, color: '#788696', image: 'gem_16_16+1', speed: 900, mining: [{item: 'rawRuby', count: 1}], help: 'Gems'},
  EMERALD: {code: 82, name: 'Emerald Deposit', type: NODE_TYPE.GEM, star: 4, solid: true, color: '#788696', image: 'gem_16_16+2', speed: 900, mining: [{item: 'rawEmerald', count: 1}], help: 'Gems'},
  SAPPHIRE: {code: 83, name: 'Sapphire Deposit', type: NODE_TYPE.GEM, star: 5, solid: true, color: '#788696', image: 'gem_16_16+3', speed: 1100, mining: [{item: 'rawSapphire', count: 1}], help: 'Gems'},

  // ── Rock (gisement de pierres précieuses) ────────────────────────

  GRANITE: {code: 90, name: 'Granite', type: NODE_TYPE.ROCK, star: 4, solid: true, color: '#1966cc', image: 'rock_16_16+0', speed: 1500, mining: [{item: 'blockGranite', count: 1}], help: 'Geode Stones'}, // UNDERWORLD
  MARBLE: {code: 91, name: 'Marble', type: NODE_TYPE.ROCK, star: 4, solid: true, color: '#e6ddc4', image: 'rock_16_16+1', speed: 1500, mining: [{item: 'blockMarble', count: 1}], help: 'Geode Stones'}, // UNDERWORLD
  OBSIDIAN: {code: 92, name: 'Obsidian', type: NODE_TYPE.ROCK, star: 5, solid: true, color: '#73c882', image: 'rock_16_16+3', speed: 2000, mining: [{item: 'obsidian', count: 1}], help: 'Obsidian'}, // HELL
  METEORITE: {code: 93, name: 'Meteorite', type: NODE_TYPE.ROCK, stype: 'block', star: 5, solid: true, color: '#7d6f5f', image: 'rock_16_16+2', speed: 2000, mining: [{item: 'bkmtrt', count: 1}], help: 'Meteorite'}, // SURFACE
  HIVE: {code: 94, name: 'Hive', type: NODE_TYPE.ROCK, stype: 'block', star: 3, solid: true, color: '#fd8431', image: 'rock_16_16+6', speed: 1200, mining: [{item: 'blokHive', count: 1}], help: 'Hive'},
  SHELL: {code: 95, name: 'Shell', type: NODE_TYPE.ROCK, stype: 'block', star: 2, solid: true, color: '#e9e3e0ff', image: 'rock_16_16+7', speed: 1800, mining: [{item: 'shell', count: 4}], help: 'Shell'},

  // ── HOUSING (murs des maisons) ────────────────────────

  WOODWALL: {code: 100, name: 'Wood Wall', type: NODE_TYPE.WALL, star: 1, solid: true, color: '#855959', image: 'wall_16_16+0', speed: 1200, hammering: [{item: 'woodwall', count: 1}], help: 'Wood Wall'},
  BRICKWALL: {code: 101, name: 'Brick Wall', type: NODE_TYPE.BWALL, star: 1, solid: false, color: '#788696', image: 'wall_16_16+1', speed: 1200, hammering: [{item: 'brickwall', count: 1}], help: 'Background Wall'},
  STONEWALL: {code: 102, name: 'Stone Wall', type: NODE_TYPE.BWALL, star: 1, solid: false, color: '#788696', image: 'wall_16_16+2', speed: 1200, hammering: [{item: 'stonewall', count: 1}], help: 'Background Wall'},
  SANDSTONEWALL: {code: 103, name: 'Sandstone Wall', type: NODE_TYPE.BWALL, star: 1, solid: false, color: '#788696', image: 'wall_16_16+3', speed: 1200, hammering: [{item: 'sandstonewall', count: 1}], help: 'Background Wall'},
  COPPERWALL: {code: 104, name: 'Copper Wall', type: NODE_TYPE.BWALL, star: 2, solid: false, color: '#788696', image: 'wall_16_16+4', speed: 1400, hammering: [{item: 'copperwall', count: 1}], help: 'Background Wall'},
  IRONWALL: {code: 105, name: 'Iron Wall', type: NODE_TYPE.BWALL, star: 2, solid: false, color: '#788696', image: 'wall_16_16+5', speed: 1400, hammering: [{item: 'ironwall', count: 1}], help: 'Background Wall'},
  SILVERWALL: {code: 106, name: 'Silver Wall', type: NODE_TYPE.BWALL, star: 2, solid: false, color: '#788696', image: 'wall_16_16+6', speed: 1400, hammering: [{item: 'silverwall', count: 1}], help: 'Background Wall'},
  GOLDWALL: {code: 107, name: 'Gold Wall', type: NODE_TYPE.BWALL, star: 2, solid: false, color: '#788696', image: 'wall_16_16+7', speed: 1400, hammering: [{item: 'goldwall', count: 1}], help: 'Background Wall'},
  TOPAZWALL: {code: 108, name: 'Topaz Wall', type: NODE_TYPE.BWALL, star: 3, solid: false, color: '#788696', image: 'wall_16_16+8', speed: 1600, hammering: [{item: 'topazwall', count: 1}], help: 'Background Wall'},
  RUBYWALL: {code: 109, name: 'Ruby Wall', type: NODE_TYPE.BWALL, star: 3, solid: false, color: '#788696', image: 'wall_16_16+9', speed: 1600, hammering: [{item: 'rubywall', count: 1}], help: 'Background Wall'},
  EMERALDWALL: {code: 110, name: 'Emerald Wall', type: NODE_TYPE.BWALL, star: 3, solid: false, color: '#788696', image: 'wall_16_16+10', speed: 1600, hammering: [{item: 'emeraldwall', count: 1}], help: 'Background Wall'},
  SAPPHIREWALL: {code: 111, name: 'Sapphire Wall', type: NODE_TYPE.BWALL, star: 3, solid: false, color: '#788696', image: 'wall_16_16+11', speed: 1600, hammering: [{item: 'sapphirewall', count: 1}], help: 'Background Wall'},
  COBALTWALL: {code: 112, name: 'Cobalt Wall', type: NODE_TYPE.BWALL, star: 4, solid: false, color: '#788696', image: 'wall_16_16+12', speed: 1800, hammering: [{item: 'cobaltwall', count: 1}], help: 'Background Wall'},
  PLATINUMWALL: {code: 113, name: 'Platinum Wall', type: NODE_TYPE.BWALL, star: 4, solid: false, color: '#788696', image: 'wall_16_16+13', speed: 1800, hammering: [{item: 'platinumwall', count: 1}], help: 'Background Wall'},
  GRANITEWALL: {code: 114, name: 'Granite Wall', type: NODE_TYPE.BWALL, star: 4, solid: false, color: '#788696', image: 'wall_16_16+14', speed: 1800, hammering: [{item: 'granitewall', count: 1}], help: 'Background Wall'},
  MARBLEWALL: {code: 115, name: 'Marble Wall', type: NODE_TYPE.BWALL, star: 4, solid: false, color: '#788696', image: 'wall_16_16+15', speed: 1800, hammering: [{item: 'marblewall', count: 1}], help: 'Background Wall'},
  OLYMPITEWALL: {code: 116, name: 'Olympite Column', type: NODE_TYPE.ETERNAL | NODE_TYPE.GAZ | NODE_TYPE.WALL, stype: 'background', star: 6, color: '#C8D8E8', image: 'wall_16_16+15', help: 'Lost Temple'},

  // ── A SUPPRIMER ────────────────────────

  SHORE: {code: 121, name: 'Shore', type: NODE_TYPE.SOLID, star: 1, color: '#FFCC00', image: null, help: null}
}

/** Lookup par code numérique — hot path render/physics */
export const NODES_LOOKUP = []

/* ============================================================================
   3. ITEMS - A LA FOIS DANS L'INVENTAIRE OU PLACE DANS LE MONDE
   ============================================================================ */

// le type permet de fournir les informations suivantes :
// sa nature (ce qu'il est) : 'FURNITURE', 'WALL', ...
// les actions qui peuvent être conduite dessus : 'CRAFTING' (à renommer), 'USABLE', 'PLACABLE', 'UNDELETABLE', 'CRAFTABLLE', 'REMOVABLE', 'AMMUNITION'...
export const ITEM_TYPE = {
  FURNITURE: 0x1, TOOL: 0x2, MATERIAL: 0x4, FOOD: 0x08, BLOCK: 0x10, WALL: 0x20, MECHANISM: 0x40, AMMUNITION: 0x80, CHUNK: 0x100, ARMOR: 0x200, BAR: 0x400, WEAPON: 0x800, CRAFTABLE: 0x1000, ACCESSORY: 0x2000, GEM: 0x4000, POTION: 0x8000, SEMABLE: 0x10000, BAG: 0x20000, BAIT: 0x40000, USABLE: 0x80000, PLACABLE: 0x100000, UNIQUE: 0x200000, DISPOSABLE: 0x400000, NONE: 0
}

// MATERIAL: objet utilisé comme ingrédient dans au moins une recette
// CRAFTABLE : objet pouvant être crée via l'artisanat
// UNIQUE: objet unique, ne peut pas être détruit/vendu/démonté/transmuté
// PLACABLE: objet pouvant être placé dans le monde :
//   placed : image de l'objet symétrique dans le monde, pour les portes : image de la porte fermée
//   placedLeft : image de gauche de l'objet asymétrique, image de la porte ouverte à gauche
//   placedRight : image de droite de l'objet asymétrique, image de la porte ouverte à droite
//   Remarque : un objet peut être placé dans le monde à la création, cela ne le rend pas PLACABLE

// OAK ROOT — drop lorsque l'on abat complètement un Oak
// MAHOGANY ROOT — drop lorsque l'on abat complètement un Mahogany
// TAPROOT — drop lorsque l'on abat complètement un Cactus
// MYCELIUM —
// drop lorsque l'on abat complètement un Giant Mushroom

export const ITEMS = {

  // Chunks
  chunkCopper: {name: 'Copper Chunk', type: ITEM_TYPE.MATERIAL, star: 1, stype: 'chunk', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Primary crafting materials crafted into bars at a Furnace'},
  chunkIron: {name: 'Iron Chunk', type: ITEM_TYPE.MATERIAL, star: 2, stype: 'chunk', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Primary crafting materials crafted into bars at a Furnace'},
  chunkSilver: {name: 'Silver Chunk', type: ITEM_TYPE.MATERIAL, star: 3, stype: 'chunk', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Primary crafting materials crafted into bars at a Furnace'},
  chunkGold: {name: 'Gold Chunk', type: ITEM_TYPE.MATERIAL, star: 3, stype: 'chunk', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Primary crafting materials crafted into bars at a Furnace'},
  chunkCobalt: {name: 'Cobalt Chunk', type: ITEM_TYPE.MATERIAL, star: 4, stype: 'chunk', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Primary crafting materials crafted into bars at a Furnace'},
  chunkPlatinum: {name: 'Platinum Chunk', type: ITEM_TYPE.MATERIAL, star: 5, stype: 'chunk', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Primary crafting materials crafted into bars at a Furnace'},

  // Bars
  barCopper: {name: 'Copper Bar', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, star: 1, stype: 'bar', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Crafting material used to craft tools, weapons, armor, and other items'},
  barIron: {name: 'Iron Bar', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, star: 2, stype: 'bar', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Crafting material used to craft tools, weapons, armor, and other items'},
  barSilver: {name: 'Silver Bar', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, star: 3, stype: 'bar', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Crafting material used to craft tools, weapons, armor, and other items'},
  barGold: {name: 'Gold Bar', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, star: 3, stype: 'bar', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Crafting material used to craft tools, weapons, armor, and other items'},
  barCobalt: {name: 'Cobalt Bar', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, star: 4, stype: 'bar', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Crafting material used to craft tools, weapons, armor, and other items'},
  barPlatinum: {name: 'Platinum Bar', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, star: 5, stype: 'bar', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Crafting material used to craft tools, weapons, armor, and other items'},

  // Gems
  rawTopaz: {name: 'Raw Topaz', type: ITEM_TYPE.MATERIAL, star: 3, stype: 'gem', image: 'blocks_16_16-0-0', help: 'Gems', tooltip: 'Valuable crafting materials to be cut at a Stonecutter'},
  rawRuby: {name: 'Raw Ruby', type: ITEM_TYPE.MATERIAL, star: 3, stype: 'gem', image: 'blocks_16_16-0-0', help: 'Gems', tooltip: 'Valuable crafting materials to be cut at a Stonecutter'},
  rawEmerald: {name: 'Raw Emerald', type: ITEM_TYPE.MATERIAL, star: 3, stype: 'gem', image: 'blocks_16_16-0-0', help: 'Gems', tooltip: 'Valuable crafting materials to be cut at a Stonecutter'},
  rawSapphire: {name: 'Raw Sapphire', type: ITEM_TYPE.MATERIAL, star: 3, stype: 'gem', image: 'blocks_16_16-0-0', help: 'Gems', tooltip: 'Valuable crafting materials to be cut at a Stonecutter'},

  // Geode Stones
  blockGranite: {name: 'Granite Block', type: ITEM_TYPE.MATERIAL, star: 4, stype: 'stone', image: 'blocks_16_16-0-0', help: 'Geode Stones', tooltip: 'Prized crafting materials found in crystalline structures'},
  blockMarble: {name: 'Marble Block', type: ITEM_TYPE.MATERIAL, star: 4, stype: 'stone', image: 'blocks_16_16-0-0', help: 'Geode Stones', tooltip: 'Prized crafting materials found in crystalline structures'},

  // Shell
  shell: {name: 'Shell', type: ITEM_TYPE.MATERIAL, star: 1, stype: 'shell', image: 'blocks_16_16-0-0', help: 'Shell', tooltip: '???'},
  shellPowder: {name: 'Shell Powder', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, star: 1, stype: 'shell', image: 'blocks_16_16-0-0', help: 'Shell', tooltip: '???'},

  // Cobweb
  silk: {name: 'Silk', type: ITEM_TYPE.MATERIAL, star: 1, stype: 'cobweb', image: 'blocks_16_16-0-0', help: 'Cobweb', tooltip: '???'},
  fabric: {name: 'Fabric', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, star: 1, stype: 'cobweb', image: 'blocks_16_16-0-0', help: 'Cobweb', tooltip: '???'},

  // pickaxes
  pickaxeCopper: {name: 'Copper Pickaxe', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'pickaxe', star: 2, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Pickaxes', tooltip: 'Tools used to remove blocks, converting them to item form'},
  pickaxeIron: {name: 'Iron Pickaxe', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'pickaxe', star: 2, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Pickaxes', tooltip: 'Tools used to remove blocks, converting them to item form'},
  pickaxeSilver: {name: 'Silver Pickaxe', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'pickaxe', star: 3, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Pickaxes', tooltip: 'Tools used to remove blocks, converting them to item form'},
  pickaxeGold: {name: 'Gold Pickaxe', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'pickaxe', star: 3, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Pickaxes', tooltip: 'Tools used to remove blocks, converting them to item form'},
  pickaxeCobalt: {name: 'Cobalt Pickaxe', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'pickaxe', star: 4, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Pickaxes', tooltip: 'Tools used to remove blocks, converting them to item form'},
  pickaxePlatinum: {name: 'Platinum Pickaxe', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'pickaxe', star: 4, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Pickaxes', tooltip: 'Tools used to remove blocks, converting them to item form'},
  pickaxeBone: {name: 'Bone Pickaxe', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'pickaxe', star: 4, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Pickaxes', tooltip: 'Tools used to remove blocks, converting them to item form'},

  // hammers
  hammerCopper: {name: 'Copper Hammer', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'hammer', star: 2, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Hammers', tooltip: 'Tools used to remove wall, furniture, workstation, converting them to item form'},

  // Axes
  axeCopper: {name: 'Copper Axe', type: ITEM_TYPE.TOOL | ITEM_TYPE.WEAPON | ITEM_TYPE.MATERIAL, stype: 'axe', star: 2, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Axes', tooltip: 'Basic tools used to chop trees. Can be used as a slow weapon'},

  // Swords
  swordCopper: {name: 'Copper Sword', type: ITEM_TYPE.WEAPON | ITEM_TYPE.MATERIAL, stype: 'axe', star: 2, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Swords', tooltip: 'Melee weapon'},

  // Bows
  bowCopper: {name: 'Copper Bow', type: ITEM_TYPE.WEAPON | ITEM_TYPE.MATERIAL, stype: 'bow', star: 2, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Bows', tooltip: 'Range weapon'},

  // Other Weapons
  flamethrower: {name: 'Flamethrower', type: ITEM_TYPE.WEAPON | ITEM_TYPE.TOOL, stype: 'fire', star: 5, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Flamethrower', tooltip: 'Small Range weapon - Can be used for removing Cobweb'},

  // Monster - Spiders
  spiderEgg: {name: 'Spider Egg', type: ITEM_TYPE.MATERIAL, stype: 'egg', star: 2, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', help: 'Spiders', tooltip: '???'},
  spiderFang: {name: 'Spider Fang', type: ITEM_TYPE.MATERIAL, stype: 'fang', star: 3, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', help: 'Spiders', tooltip: '???'},

  // crystall
  lifeCrystal: {name: 'Life Crystal', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.UNIQUE | ITEM_TYPE.USABLE, stype: 'life', star: 1, image: 'furniture_32_32-12-2', placed: 'furniture_32_32-6-3', help: 'Life Crystal', tooltip: 'Permanently increases maximum life by 20\nCollect with a Hammer'},

  // triskel
  triskelCopper: {name: 'Copper Triskel', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.UNIQUE | ITEM_TYPE.MATERIAL, stype: 'triskel', star: 3, image: 'furniture_32_32-12-2', placed: 'furniture_32_32-6-3', help: 'Triskels', tooltip: ''},
  triskelSilver: {name: 'Silver Triskel', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.UNIQUE | ITEM_TYPE.MATERIAL, stype: 'triskel', star: 4, image: 'furniture_32_32-12-2', placed: 'furniture_32_32-6-3', help: 'Triskels', tooltip: ''},
  triskelGold: {name: 'Gold Triskel', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.UNIQUE | ITEM_TYPE.MATERIAL, stype: 'triskel', star: 5, image: 'furniture_32_32-12-2', placed: 'furniture_32_32-6-3', help: 'Triskels', tooltip: ''},
  triskelAncient: {name: 'Ancient Triskel', type: ITEM_TYPE.ACCESSORY | ITEM_TYPE.UNIQUE | ITEM_TYPE.CRAFTABLE, stype: 'triskel', star: 5, image: 'furniture_32_32-12-2', placed: 'furniture_32_32-6-3', help: 'Triskels', tooltip: ''},

  // Tombstone
  tomb: {name: 'Tombstone', type: ITEM_TYPE.FURNITURE, stype: 'tomb', star: 1, undisposable: true, image: 'furniture_32_32-13-2', placed: 'fuws_32_32-3-4', help: 'Graveyard', tooltip: 'Summons specific enemies'},
  tombHead: {name: 'Headstone', type: ITEM_TYPE.FURNITURE, stype: 'tomb', star: 1, undisposable: true, image: 'furniture_32_32-4-8', placed: 'fuws_32_32-4-4', help: 'Graveyard', tooltip: 'Summons specific enemies'},
  tombGrave: {name: 'Gravestone', type: ITEM_TYPE.FURNITURE, stype: 'tomb', star: 1, undisposable: true, image: 'furniture_32_32-5-8', placed: 'fuws_32_32-5-4', help: 'Graveyard', tooltip: 'Summons specific enemies'},
  tombStrange: {name: 'Strange Looking Tombstone', type: ITEM_TYPE.FURNITURE, star: 1, stype: 'tomb', undisposable: true, image: 'furniture_32_32-6-8', placed: 'fuws_32_32-6-4', help: 'Graveyard', tooltip: 'Summons specific enemies'},
  tombCross: {name: 'Cross Tombstone', type: ITEM_TYPE.FURNITURE, stype: 'tomb', star: 1, undisposable: true, image: 'furniture_32_32-7-8', placed: 'fuws_32_32-7-4', help: 'Graveyard', tooltip: 'Summons specific enemies'},

  // Wood furniture set
  chairWood: {name: 'Wooden Chair', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chair', star: 1, image: 'furniture_32_32-0-5', placedLeft: 'fuws_16_48-1-0', placedRight: 'fuws_16_48-2-0', help: 'Chairs', tooltip: '???', furnitureSet: 'wood', comfort: true},
  toiletWood: {name: 'Wooden Toilet', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'toilet', star: 1, image: 'furniture_32_32-0-5', placed: 'fuws_16_48-2-0', help: 'Toilets', tooltip: '???', furnitureSet: 'wood', comfort: true},
  doorWood: {name: 'Wooden Door', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'door', star: 1, furnitureSet: 'wood', image: 'furniture_32_32-0-6', placed: 'fuws_16_48-0-0', placedLeft: 'fuws_32_48-0-0', placedRight: 'fuws_32_48-0-1', help: 'Doors', tooltip: 'Furniture that prevent enemies from entering an area when closed'},

  // Glass furniture set
  tableGlass: {name: 'Glass Table', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'table', star: 1, image: 'furniture_32_32-2-0', placed: 'fuws_48_32-1-0', help: 'Tables', tooltip: '???', furnitureSet: 'glass', surface: true},
  chairGlass: {name: 'Glass Chair', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chair', star: 1, image: 'furniture_32_32-0-5', placedLeft: 'fuws_16_48-1-0', placedRight: 'fuws_16_48-2-0', help: 'Chairs', tooltip: '???', furnitureSet: 'glass', comfort: true},
  toiletGlass: {name: 'Glass Toilet', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'toilet', star: 1, image: 'furniture_32_32-0-5', placed: 'fuws_16_48-2-0', help: 'Toilets', tooltip: '???', furnitureSet: 'glass', comfort: true},
  doorGlass: {name: 'Glass Door', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'door', star: 1, furnitureSet: 'glass', image: 'furniture_32_32-0-6', placed: 'fuws_16_48-0-0', placedLeft: 'fuws_32_48-0-0', placedRight: 'fuws_32_48-0-1', help: 'Doors', tooltip: 'Furniture that prevent enemies from entering an area when closed'},

  // chests (56 slots)
  // Sea Chests
  oceanChest: {name: 'Water Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', star: 1, capacity: 56, image: 'furniture_32_32-6-1', placed: 'fuws_32_32-6-1', help: 'Chests', tooltip: 'Items container'},
  // Surface Chests
  woodChest: {name: 'Wood Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', star: 1, capacity: 56, image: 'furniture_32_32-0-1', placed: 'fuws_32_32-0-1', help: 'Chests', tooltip: 'Items container'},
  mahoganyChest: {name: 'Mahogany Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', star: 1, capacity: 56, image: 'furniture_32_32-2-1', placed: 'fuws_32_32-2-1', help: 'Chests', tooltip: 'Items container'},
  sandstoneChest: {name: 'Sandstone Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', star: 1, capacity: 56, image: 'furniture_32_32-3-1', placed: 'fuws_32_32-3-1', help: 'Chests', tooltip: 'Items container'},
  // Underground Chests
  copperChest: {name: 'Copper Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', star: 2, capacity: 56, image: 'furniture_32_32-1-1', placed: 'fuws_32_32-1-1', help: 'Chests', tooltip: 'Items container'},
  silverChest: {name: 'Silver Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', star: 2, capacity: 56, image: 'furniture_32_32-1-1', placed: 'fuws_32_32-1-1', help: 'Chests', tooltip: 'Items container'},
  goldChest: {name: 'Gold Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', star: 2, capacity: 56, image: 'furniture_32_32-1-1', placed: 'fuws_32_32-1-1', help: 'Chests', tooltip: 'Items container'},
  // Caverns Chests
  forestChest: {name: 'Forest Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', star: 4, capacity: 56, image: 'furniture_32_32-9-1', placed: 'fuws_32_32-7-3', help: 'Chests', tooltip: 'Items container'},
  desertChest: {name: 'Desert Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', star: 4, capacity: 56, image: 'furniture_32_32-5-1', placed: 'fuws_32_32-5-1', help: 'Chests', tooltip: 'Items container'},
  jungleChest: {name: 'Jungle Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', star: 4, capacity: 56, image: 'furniture_32_32-4-1', placed: 'fuws_32_32-4-1', help: 'Chests', tooltip: 'Items container'},
  // Autres Chests
  chestAncient: {name: 'Ancient Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', star: 2, capacity: 56, image: 'furniture_32_32-0-1', placed: 'fuws_32_32-0-1', help: 'Chests', tooltip: 'Items container'},
  // boletechest: {name: 'Mushroom Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', capacity: 56, star: 4, key: 'junglekey', sell: 15500, image: 'furniture_32_32-7-1', placed: 'fuws_32_32-7-1', locked: 'fuws_32_32-6-2', help: 'Chests', tooltip: 'Items container'},
  // cobwebchest: {name: 'Web Covered Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', capacity: 56, star: 1, key: 'desertkey', sell: 800, image: 'furniture_32_32-0-2', placed: 'fuws_32_32-0-2', locked: 'fuws_32_32-6-2', help: 'Chests', tooltip: 'Items container'},
  // nitechest: {name: 'Granite Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', capacity: 56, star: 4, key: 'strongkey', sell: 7200, image: 'furniture_32_32-1-2', placed: 'fuws_32_32-1-2', locked: 'fuws_32_32-6-2', help: 'Chests', tooltip: 'Items container'},
  // rblechest: {name: 'Marble Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', capacity: 56, star: 4, key: 'strongkey', sell: 7200, image: 'furniture_32_32-2-2', placed: 'fuws_32_32-2-2', locked: 'fuws_32_32-6-2', help: 'Chests', tooltip: 'Items container'},
  // ashchest: {name: 'Shadow Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', capacity: 56, star: 5, key: 'shadowkey', sell: 26600, image: 'furniture_32_32-3-2', placed: 'fuws_32_32-3-2', locked: 'fuws_32_32-6-2', help: 'Chests', tooltip: 'Items container'},
  // piratchest: {name: 'Golden Chest', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'chest', capacity: 56, star: 1, key: 'piratekey', sell: 800, image: 'furniture_32_32-4-2', placed: 'fuws_32_32-4-2', locked: 'fuws_32_32-6-2', help: 'Chests', tooltip: 'Items container'},

  // cabinet (48 slots)

  // closet (64 slots)

  // crafting station
  tableWood: {name: 'Wooden Table', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 1, image: 'furniture_32_32-2-0', placed: 'fuws_48_32-1-0', help: 'Wooden Table', tooltip: 'A precision assembly requires a very flat surface.', furnitureSet: 'wood', surface: true},

  workbench: {name: 'Workbench', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 1, furnitureSet: 'wood', surface: true, image: 'furniture_32_32-3-0', placed: 'fuws_48_32-2-0', help: 'Woodworking', tooltip: 'Crafting station for many essential items'},
  sawmill: {name: 'Sawmill', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 3, image: 'furniture_32_32-0-0', placed: 'fuws_48_48-0-1', help: 'Woodworking', tooltip: ' Crafting station for advanced Wood and Furniture crafting'},

  anvilIron: {name: 'Iron Anvil', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 2, image: 'furniture_32_32-8-1', placed: 'fuws_32_32-1-0', help: 'Forging', tooltip: 'Crafting station used to craft metal bars into tools, weapons, armor, and other items'},
  anvilPlatinum: {name: 'Platinum Anvil', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 4, image: 'furniture_32_32-8-2', placed: 'fuws_32_32-2-0', help: 'Forging', tooltip: 'Crafting stations used to craft metal bars into tools, weapons, armor, and other items'},

  furnace: {name: 'Furnace', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 2, image: 'furniture_32_32-6-0', placed: 'fuws_48_48-0-0', help: 'Smelting', tooltip: 'Crafting station for metal smelting'},
  blastFurnace: {name: 'Blast Furnace', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 4, image: 'furniture_32_32-5-0', placed: 'fuws_48_48-1-0', help: 'Smelting', tooltip: 'Crafting station for strong metal smelting'},
  grindstone: {name: 'Grindstone', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 3, image: 'furniture_32_32-1-0', placed: 'fuws_48_32-0-0', help: 'Sharpening', tooltip: 'Crafting station for sharpenig tools and weapons'},

  loom: {name: 'Loom', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 2, image: 'furniture_32_32-1-0', placed: 'fuws_48_32-0-0', help: 'Weaving', tooltip: 'Crafting station for cloth'},
  tanningRack: {name: 'Tanning Rack', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 3, image: 'furniture_32_32-1-0', placed: 'fuws_48_32-0-0', help: 'Leatherworking', tooltip: 'Crafting station for leather'},

  stonecutter: {name: 'Stonecutter', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 1, image: 'furniture_32_32-2-0', placed: 'fuws_48_32-1-0', help: 'Stonecutting', tooltip: '???', surface: true},
  jewelerBench: {name: 'Jeweler\'s Bench', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 3, surface: true, image: 'furniture_32_32-7-0', placed: 'fuws_48_48-2-0', help: 'Jewelry', tooltip: 'Crafting station for jewels and accessories'},
  alchemyTable: {name: 'Alchemy Table', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 2, image: 'furniture_32_32-8-0', placed: 'fuws_48_48-2-1', help: 'Alchemy', tooltip: 'Crafting station for potions'},
  cookingPot: {name: 'Cooking Pot', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 2, image: 'furniture_32_32-9-0', placed: 'fuws_32_32-7-2', help: 'Cooking', tooltip: 'Crafting station for food'},

  brokenDecomposer: {name: 'Broken Decomposer', type: ITEM_TYPE.FURNITURE, immovable: true, stype: 'immovable', star: 5, image: null, placed: 'fuws_48_32-0-1', help: 'Lost Temple', tooltip: '????'},
  decomposerPart: {name: 'Decomposer Part', type: ITEM_TYPE.TOOL, stype: 'part', star: 5, image: null, placed: 'fuws_48_32-0-1', help: 'Decomposer', tooltip: 'Part used to repair Broken Decomposer'},
  decomposer: {name: 'Decomposer', type: ITEM_TYPE.FURNITURE, immovable: true, stype: 'station', star: 5, image: null, placed: 'fuws_48_32-0-1', help: 'Decomposer', tooltip: '????'},
  transmutator: {name: 'Transmutator', type: ITEM_TYPE.FURNITURE, immovable: true, stype: 'station', star: 5, image: null, placed: 'fuws_48_32-0-1', help: 'Transmutator', tooltip: '????'},

  // housing furniture
  noticeBoard: {name: 'Notice Board', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.CRAFTABLE, stype: 'housing', star: 3, image: '...', placed: '...', help: 'Housing', tooltip: 'Displays and applies the housing buff of this house'},

  // Food containers
  bowl: {name: 'Bowl', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, stype: 'tableware', star: 1, image: 'furniture_32_32-6-2', placed: 'fuws_32_32-3-0', help: 'Tableware', tooltip: 'The best soups are made in old bowls'},
  mug: {name: 'Mug', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, stype: 'tableware', star: 1, image: 'furniture_32_32-7-7', placed: 'fuws_32_32-1-3', help: 'Tableware', tooltip: 'The best Ale container'},
  plate: {name: 'Plate', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, stype: 'tableware', star: 1, image: 'furniture_32_32-8-7', placed: 'fuws_16_16-0-0', help: 'Tableware', tooltip: 'Looks as good as it tastes'},
  trencher: {name: 'Wooden Trencher', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, stype: 'tableware', star: 1, image: 'furniture_32_32-9-7', placed: 'fuws_16_16-1-0', help: 'Tableware', tooltip: 'A rustic wooden plate, perfect for simple meals'},

  // Liquid containers (small capacity)
  bottle: {name: 'Bottle', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, stype: 'tableware', star: 1, furnitureSet: 'glass', image: 'furniture_32_32-10-2', placed: 'fuws_32_32-0-0', help: 'Bottles', tooltip: 'Crafting container for potions and food'},
  water: {name: 'Bottled Water', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.POTION | ITEM_TYPE.MATERIAL | ITEM_TYPE.USABLE, stype: 'tableware', star: 1, image: 'potions_32_32-0-5', placed: 'fuws_32_32-4-0', heal: 20, sickness: 40, help: 'Bottles', tooltip: 'Healing item and Crafting Material for potions'},
  honey: {name: 'Bottled Honey', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.POTION | ITEM_TYPE.MATERIAL | ITEM_TYPE.USABLE, stype: 'tableware', star: 1, image: 'potions_32_32-1-5', placed: 'fuws_32_32-4-0', heal: 80, sickness: 60, timedbuff: 'honey', time: 15, help: 'Bottles', tooltip: 'Healing item'},
  sap: {name: 'Bottled Sap', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.POTION | ITEM_TYPE.MATERIAL | ITEM_TYPE.USABLE, stype: 'tableware', star: 1, image: 'potions_32_32-1-5', placed: 'fuws_32_32-4-0', heal: 80, sickness: 60, timedbuff: 'honey', time: 15, help: 'Bottles', tooltip: 'Healing item'},

  // Liquid containers (large capacity)
  bucket: {name: 'Empty Bucket', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.TOOL | ITEM_TYPE.CRAFTABLE | ITEM_TYPE.ARMOR, stype: 'tableware', placable: true, sell: 500, star: 2, image: 'furniture_32_32-10-0', placed: 'fuws_32_32-5-0', help: 'Buckets', tooltip: 'Used to scoop up a small amount of water, honey or lava', placedright: 'heads_26_22-0-2', placedleft: 'heads_26_22-0-3', defense: 1, armor: 'head', set: 'bucket'},
  bucketWater: {name: 'Water Bucket', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'tableware', star: 2, image: 'furniture_32_32-11-0', placed: 'fuws_32_32-6-0', help: 'Buckets', tooltip: 'Amount of water. Can be poured ou'},
  bucketHoney: {name: 'Honey Bucket', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'tableware', star: 2, image: 'furniture_32_32-12-0', placed: 'fuws_32_32-7-0', help: 'Buckets', tooltip: 'Amount of honey. Can be poured ou'},
  bucketSap: {name: 'Sap Bucket', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'tableware', star: 2, image: 'furniture_32_32-13-0', placed: 'fuws_32_32-0-3', help: 'Buckets', tooltip: 'Amount of lava. Can be poured ou'}
}
export const BAG_CAPACITY = 64

/* ============================================================================
   4. RECIPES
   ============================================================================ */

export const RECIPES = [
  {result: {item: 'triskelAncient', count: 1}, station: 'alchemyTable', ingredients: [{item: 'triskelCopper', count: 1}, {item: 'triskelSilver', count: 1}, {item: 'triskelGold', count: 1}]}
]

/* ============================================================================
   5. PLANTS
   ============================================================================ */

export const PLANT_SYSTEM = {GRASS: 1, TREE: 2, HERB: 3}

export const GRASS_TYPE = {FERN: 1, MOSS: 2, MUSHROOM: 3, FOREST: 4, JUNGLE: 5}
export const TREE_TYPE = {OAK: 1, MAHOGANY: 2, GIANT_MUSHROOM: 3, COCONUT: 4}
export const HERB_TYPE = { }

/* ============================================================================
   6. MONSTERS
   ============================================================================ */

/* ============================================================================
   7. MISCELLANEOUS
   ============================================================================ */

/* ============================================================================
   8. POST-TRAITEMENTS (top-level — exécutés une fois au premier import)
   ============================================================================ */

// export pour le debug (WorldMapDebug.drawMap)
export const hexToRgb = (hex) => {
  if (!hex) return {r: 0, g: 0, b: 0, rgb: 'rgb(0,0,0)'}
  const h = hex.startsWith('#') ? hex.slice(1) : hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return {r, g, b, rgb: `rgb(${r}, ${g}, ${b})`}
}

// — 8.1. Construction de NODES_LOOKUP + tests intégritée + couleur + résolution mining[].item string → objet —
const REQUIRED_NODE_FIELDS = ['code', 'name', 'type', 'star', 'image', 'color', 'help']
for (const key in NODES) {
  const nodeDesc = NODES[key]
  NODES_LOOKUP[nodeDesc.code] = nodeDesc
  // vérification de la présence des attributs obligatoires
  for (const field of REQUIRED_NODE_FIELDS) {
    if (nodeDesc[field] === undefined) {
      console.error(`[data.mjs] NODES.${key} : champ obligatoire manquant : '${field}'`)
    }
  }
  // optimisation des couleurs
  nodeDesc.rgbColor = hexToRgb(nodeDesc.color)
  // résolution mining[].item string → objet
//   if (!nodeDesc.mining) continue
//   for (let i = 0; i < nodeDesc.mining.length; i++) {
//     const entry = nodeDesc.mining[i]
//     const resolved = ITEMS[entry.item]
//     if (resolved) { entry.item = resolved } // string → référence objet
//     // les items non résolus sont signalés par la validation ci-dessous
//   }
}

// — 8.2. Validation des ITEMS
const REQUIRED_ITEM_FIELDS = ['name', 'type', 'stype', 'star', 'image', 'help', 'tooltip']
for (const key in ITEMS) {
  const itemDesc = ITEMS[key]

  itemDesc.code = key // Injection du code dans chaque item (la clé devient ITEMS.worm.code)
  // vérification de la présence des attributs obligatoires
  for (const field of REQUIRED_ITEM_FIELDS) {
    if (itemDesc[field] === undefined) {
      console.error(`[data.mjs] ITEMS.${key} : champ obligatoire manquant : '${field}'`)
    }
  }
  if ((itemDesc.type & ITEM_TYPE.FURNITURE) && !itemDesc.placed && !itemDesc.placedLeft) {
    console.error(`[data.mjs] ITEMS.${key} : FURNITURE sans attribut 'placed' ni 'placedLeft'`)
  }
  // le post traitement des images est effectué par GameCore.#hydrateItems()
}

// — 8.3. Résolution placesNode string → objet node —
// for (const key in ITEMS) {
//   const item = ITEMS[key]
//   if (!item.placesNode) continue
//   item.placesNode = NODES[item.placesNode] ?? item.placesNode
// }

// — 8.4. Résolution PLANTS (growsOn[], drops[].item) —
// for (const key in PLANTS) {
//   const plant = PLANTS[key]

//   if (plant.growsOn) {
//     for (let i = 0; i < plant.growsOn.length; i++) {
//       plant.growsOn[i] = NODES[plant.growsOn[i]] ?? plant.growsOn[i]
//     }
//   }

//   if (plant.drops) {
//     for (let i = 0; i < plant.drops.length; i++) {
//       const entry = plant.drops[i]
//       entry.item = ITEMS[entry.item] ?? entry.item
//     }
//   }
// }

// — 8.5. Validation des RECIPES
for (const recipe of RECIPES) {
  if (!ITEMS[recipe.result.item]) {
    console.error(`[data.mjs] RECIPES '${recipe.result.item}' : result item inconnu`)
  }
  for (const ing of recipe.ingredients) {
    if (!ITEMS[ing.item]) {
      console.error(`[data.mjs] RECIPES '${recipe.result.item}' : ingredient inconnu '${ing.item}'`)
    }
  }
  if (!ITEMS[recipe.station]) {
    console.error(`[data.mjs] RECIPES.${recipe.result.item} : crafting station inconnue '${recipe.station}'`)
  }
}

// — 8.5. Résolution RECIPES (ingredients[].item, result.item)
const MATERIALS = new Set()
const CRAFTABLES = new Set()

for (const key in RECIPES) {
  const recipe = RECIPES[key]
  // result
  CRAFTABLES.add(recipe.result.item)
  ITEMS[recipe.result.item].type |= ITEM_TYPE.CRAFTABLE
  recipe.result.item = ITEMS[recipe.result.item]
  // ingredients
  for (const ing of recipe.ingredients) {
    MATERIALS.add(ing.item)
    ITEMS[ing.item].type |= ITEM_TYPE.MATERIAL
    ing.item = ITEMS[ing.item]
  }
  // crafting station
  CRAFTABLES.add(recipe.station)
  ITEMS[recipe.station].type |= ITEM_TYPE.CRAFTABLE
  recipe.station = ITEMS[recipe.station]
}

/* ============================================================================
   9. VALIDATION D'INTÉGRITÉ (top-level — throw bloquant si KO)
   ============================================================================ */

{
  const errors = []

  // 9.1. Codes NODES uniques
  const seenCodes = new Set()
  for (const key in NODES) {
    const {code} = NODES[key]
    if (seenCodes.has(code)) errors.push(`[NODES] Code dupliqué : ${code} (${key})`)
    seenCodes.add(code)
  }

  // tests de cohérence et de complétude (les tests relatifs à l'aide en ligne sont dans rpg-help.mjs)
  // for (const key in NODES) {
  //   const node = NODES[key]

  //   if (node.type & NODE_TYPE.MINABLE) {
  //     if (node.speed === undefined) {
  //       console.error('Attribut \'speed\' manquant pour', node)
  //     }
  //     if (node.mining === undefined) {
  //       console.error('Attribut \'mining\' manquant pour', node)
  //     } else {
  //       node.mining.forEach(({item, count, monster, rate}) => {
  //         if ((item === undefined) && (monster === undefined)) {
  //           console.error('Attribut \'item\' ou \'monster\' manquant dans l\'attribut \'mining\' pour', node)
  //         } else {
  //           if (item !== undefined) {
  //             if (ITEM[item] === undefined) {
  //               console.error('Attribut \'item\'', item, 'inconnu pour', node)
  //             }
  //             if (count === undefined) {
  //               console.error('Attribut \'count\' manquant dans l\'attribut \'mining\' pour', node)
  //             }
  //           }
  //           if (monster !== undefined) {
  //             if (rate === undefined) {
  //               console.error('Attribut \'rate\' manquant dans l\'attribut \'mining\' pour', node)
  //             }
  //           }
  //         }
  //       })
  //     }
  //   }
  // }

  // 9.2. Toutes les références croisées sont résolues (pas de string résiduelle)
  //   for (const key in NODES) {
  //     const node = NODES[key]
  //     if (!node.mining) continue
  //     for (let i = 0; i < node.mining.length; i++) {
  //       if (typeof node.mining[i].item === 'string') {
  //         errors.push(`[NODES.${key}] mining[${i}].item non résolu : '${node.mining[i].item}'`)
  //       }
  //     }
  //   }

  //   for (const key in ITEMS) {
  //     const item = ITEMS[key]
  //     if (item.placesNode && typeof item.placesNode === 'string') {
  //       errors.push(`[ITEMS.${key}] placesNode non résolu : '${item.placesNode}'`)
  //     }
  //   }

  //   for (const key in PLANTS) {
  //     const plant = PLANTS[key]
  //     if (plant.growsOn) {
  //       for (let i = 0; i < plant.growsOn.length; i++) {
  //         if (typeof plant.growsOn[i] === 'string') {
  //           errors.push(`[PLANTS.${key}] growsOn[${i}] non résolu : '${plant.growsOn[i]}'`)
  //         }
  //       }
  //     }
  //     if (plant.drops) {
  //       for (let i = 0; i < plant.drops.length; i++) {
  //         if (typeof plant.drops[i].item === 'string') {
  //           errors.push(`[PLANTS.${key}] drops[${i}].item non résolu : '${plant.drops[i].item}'`)
  //         }
  //       }
  //     }
  //   }

  // 9.3. Vérification des recettes

  if (errors.length) {
    throw new Error(`[data.mjs] Intégrité des données KO :\n${errors.join('\n')}`)
  }
}
