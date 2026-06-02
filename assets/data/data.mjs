// data.mjs

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
  GRASSFOREST: {code: 30, name: 'Forest Grass', type: NODE_TYPE.NATURAL, star: 1, solid: true, color: '#84de50', image: 'grass_16_16+0', mining: {speed: 500, items: [{item: 'blockDirt', count: 1}, {item: 'seedForest', count: 0.2}, {item: 'worm', count: 0.02, buffs: ['rainy:900', 'lucky:100']}]}, foraging: {speed: 500, items: [{item: 'seedForest', count: 0.2, buffs: ['lucky:3000']}, {item: 'worm', count: 0.05, buffs: ['lucky:900', 'rainy:900']}, {item: 'slug', count: 0.04, buffs: ['lucky:950', 'rainy:850']}, {item: 'goldWorm', count: 0.02, buffs: ['+lucky']}, {item: 'goldSlug', count: 0.01, buffs: ['+lucky']}]}, help: 'Forest Grass'},
  GRASSJUNGLE: {code: 31, name: 'Jungle Grass', type: NODE_TYPE.NATURAL, star: 2, solid: true, color: '#56ba27', image: 'grass_16_16+1', mining: {speed: 500, items: [{item: 'blockSilt', count: 1}, {item: 'seedJungle', count: 0.15}], foraging: [{item: 'seedJungle', count: 0.15, lucky: 1.5}, {item: 'slug', count: 0.05, lucky: 2, rainy: 10}]}, help: 'Jungle Grass'},
  GRASSMUSHROOM: {code: 32, name: 'Mushroom Grass', type: NODE_TYPE.NATURAL, star: 3, solid: true, color: '#4cad1fff', image: 'grass_16_16+2', mining: {speed: 500, items: [{item: 'blockHumus', count: 1}, {item: 'slug', count: 0.05, lucky: 200, rainy: 100}]}, foraging: {speed: 500, items: [{item: 'slug', count: 0.15, lucky: 2, rainy: 10}]}, help: 'Mushroom Grass'},
  GRASSFERN: {code: 33, name: 'Fern Grass', type: NODE_TYPE.NATURAL, star: 4, solid: true, color: '#56ba27', image: 'grass_16_16+3', speed: 500, mining: {speed: 500, items: [{item: 'blockHumus', count: 4, lucky: 5}, {item: 'fernLeaf', count: 0.2, lucky: 75}], foraging: [{item: 'fernLeaf', count: 0.6, lucky: 1.5}, {item: 'frog', count: 0.2, lucky: 50}, {item: 'fernSpore', count: 0.1, lucky: 50}]}, help: 'Fern Grass'},
  GRASSMOSS: {code: 34, name: 'Moss Grass', type: NODE_TYPE.NATURAL, star: 4, solid: true, color: '#b73ed6ff', image: 'grass_16_16+4', mining: {speed: 500, items: [{item: 'blockSilt', count: 1, lucky: 2.5}], foraging: [{item: 'moss', count: 1, lucky: 1.4}]}, help: 'Moss Grass'},
  WEB: {code: 35, name: 'Cobweb', type: NODE_TYPE.WEB, star: 1, solid: false, color: '#788696', image: 'substrat_16_16+10', speed: 1900, mining: {speed: 500, items: [{item: 'silk', count: 1}, {item: 'eggSpider', count: '1-3-0.08'}]}, help: 'Cobweb'},

  // ── Topsoil (terrain nourricier, propice aux plantes) ────────────────────────
  DIRT: {code: 40, name: 'Dirt', type: NODE_TYPE.TOPSOIL, stype: 'block', star: 1, solid: true, color: '#db9b63', image: 'substrat_16_16+11', mining: {speed: 1000, items: [{item: 'blockDirt', count: 1}, {item: 'worm', count: 0.15, lucky: 1.2, rainy: 1.7}]}, help: 'Dirt'},
  SAND: {code: 41, name: 'Sand', type: NODE_TYPE.TOPSOIL, stype: 'block', star: 1, solid: true, color: '#fff198', image: 'substrat_16_16+12', mining: {speed: 500, items: [{item: 'blockSand', count: 1}]}, viscosity: 500, help: 'Sand'},
  SILT: {code: 42, name: 'Silt', type: NODE_TYPE.TOPSOIL, stype: 'block', star: 2, solid: true, color: '#73c882', image: 'substrat_16_16+13', mining: {speed: 1000, items: [{item: 'blockSilt', count: 1}]}, help: 'Silt'},
  HUMUS: {code: 43, name: 'Humus', type: NODE_TYPE.TOPSOIL, stype: 'block', star: 2, solid: true, color: '#e2b3ff', image: 'substrat_16_16+14', mining: {speed: 1000, items: [{item: 'blockHumus', count: 1}]}, help: 'Humus'},

  // ── Substrat (roche de base, peu propice aux plantes) ────────────────────────
  // Forest
  CLAY: {code: 50, name: 'Clay', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 1, solid: true, color: '#e6ddc4', image: 'substrat_16_16+1', mining: {speed: 1000, items: [{item: 'blockClay', count: 1}]}, help: 'Clay'},
  STONE: {code: 51, name: 'Stone', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 2, solid: true, color: '#a4b4c1', image: 'substrat_16_16+2', mining: {speed: 1200, items: [{item: 'blockStone', count: 1}]}, help: 'Stone'},
  HARDSTONE: {code: 52, name: 'Hardstone', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 4, solid: true, color: '#788696', image: 'substrat_16_16+3', mining: {speed: 1800, items: [{item: 'blockHardstone', count: 1}]}, help: 'Hardstone'},
  // Desert
  SANDSTONE: {code: 53, name: 'Sandstone', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 2, solid: true, color: '#fee267', image: 'substrat_16_16+4', mining: {speed: 1200, items: [{item: 'blockSandstone', count: 1}]}, help: 'Sandstone'},
  ASH: {code: 54, name: 'Ash', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 3, solid: true, color: '#e0acad', image: 'substrat_16_16+5', speed: 1400, mining: {speed: 1400, items: [{item: 'blockAsh', count: 1}]}, help: 'Ash'},
  HELLSTONE: {code: 55, name: 'Hellstone', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 5, solid: true, color: '#df6e78', image: 'substrat_16_16+6', mining: {speed: 2200, items: [{item: 'blockHellstone', count: 1}]}, help: 'Hellstone'},
  // Jungle
  MUD: {code: 56, name: 'Mud', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 2, solid: true, color: '#c1c186', image: 'substrat_16_16+7', mining: {speed: 1000, items: [{item: 'blockMud', count: 1}]}, help: 'Mud'},
  LIMESTONE: {code: 57, name: 'Limestone', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 4, solid: true, color: '#dfff9e', image: 'substrat_16_16+8', mining: {speed: 1400, items: [{item: 'blockLimestone', count: 1}]}, help: 'Limestone'},
  SLATE: {code: 58, name: 'Slate', type: NODE_TYPE.SUBSTRAT, stype: 'block', star: 5, solid: true, color: '#2797ea', image: 'substrat_16_16+9', mining: {speed: 1600, items: [{item: 'blockSlate', count: 1}]}, help: 'Slate'},

  // ── Ore (gisement de minerais) ────────────────────────
  COPPER: {code: 70, name: 'Copper Ore', type: NODE_TYPE.ORE, star: 1, solid: true, color: '#fe602f', image: 'mineral_16_16+1', speed: 1000, mining: {speed: 1000, items: [{item: 'chunkCopper', count: 1}]}, help: 'Metals'},
  IRON: {code: 71, name: 'Iron Ore', type: NODE_TYPE.ORE, star: 2, solid: true, color: '#db9b63', image: 'mineral_16_16+2', speed: 1100, mining: {speed: 1100, items: [{item: 'chunkIron', count: 1}]}, help: 'Metals'},
  SILVER: {code: 72, name: 'Silver Ore', type: NODE_TYPE.ORE, star: 3, solid: true, color: '#788696', image: 'mineral_16_16+3', mining: {speed: 1200, items: [{item: 'chunkSilver', count: 1}]}, help: 'Metals'},
  GOLD: {code: 73, name: 'Gold Ore', type: NODE_TYPE.ORE, star: 3, solid: true, color: '#ffaa33', image: 'mineral_16_16+4', mining: {speed: 1400, items: [{item: 'chunkGold', count: 1}]}, help: 'Metals'},
  COBALT: {code: 74, name: 'Cobalt Ore', type: NODE_TYPE.ORE, star: 4, solid: true, color: '#2797ea', image: 'mineral_16_16+5', mining: {speed: 1600, items: [{item: 'chunkCobalt', count: 1}]}, help: 'Metals'},
  PLATINUM: {code: 75, name: 'Platinum Ore', type: NODE_TYPE.ORE, star: 5, solid: true, color: '#25874d', image: 'mineral_16_16+6', mining: {speed: 1800, items: [{item: 'chunkPlatinum', count: 1}]}, help: 'Metals'},

  // ── Gem (gisement de pierres précieuses) ────────────────────────
  TOPAZ: {code: 80, name: 'Topaz Deposit', type: NODE_TYPE.GEM, star: 2, solid: true, color: '#788696', image: 'mineral_16_16+7', mining: {speed: 900, items: [{item: 'rawTopaz', count: 1}]}, help: 'Gems'},
  RUBY: {code: 81, name: 'Ruby Deposit', type: NODE_TYPE.GEM, star: 3, solid: true, color: '#788696', image: 'mineral_16_16+8', mining: {speed: 900, items: [{item: 'rawRuby', count: 1}]}, help: 'Gems'},
  EMERALD: {code: 82, name: 'Emerald Deposit', type: NODE_TYPE.GEM, star: 4, solid: true, color: '#788696', image: 'mineral_16_16+9', mining: {speed: 900, items: [{item: 'rawEmerald', count: 1}]}, help: 'Gems'},
  SAPPHIRE: {code: 83, name: 'Sapphire Deposit', type: NODE_TYPE.GEM, star: 5, solid: true, color: '#788696', image: 'mineral_16_16+10', mining: {speed: 1100, items: [{item: 'rawSapphire', count: 1}]}, help: 'Gems'},

  // ── Rock (gisement de pierres précieuses) ────────────────────────

  GRANITE: {code: 90, name: 'Granite', type: NODE_TYPE.ROCK, star: 4, solid: true, color: '#1966cc', image: 'rock_16_16+0', mining: {speed: 1500, items: [{item: 'blockGranite', count: 1}]}, help: 'Geode Stones'}, // UNDERWORLD
  MARBLE: {code: 91, name: 'Marble', type: NODE_TYPE.ROCK, star: 4, solid: true, color: '#e6ddc4', image: 'rock_16_16+1', mining: {speed: 1500, items: [{item: 'blockMarble', count: 1}]}, help: 'Geode Stones'},
  OBSIDIAN: {code: 92, name: 'Obsidian', type: NODE_TYPE.ROCK, star: 5, solid: true, color: '#73c882', image: 'rock_16_16+3', mining: {speed: 2000, items: [{item: 'blockObsidian', count: 1}]}, help: 'Obsidian'},
  METEORITE: {code: 93, name: 'Meteorite', type: NODE_TYPE.ROCK, stype: 'block', star: 5, solid: true, color: '#7d6f5f', image: 'rock_16_16+2', mining: {speed: 2000, items: [{item: 'blockMeteorite', count: 1}]}, help: 'Meteorite'}, // SURFACE
  HIVE: {code: 94, name: 'Hive', type: NODE_TYPE.ROCK, stype: 'block', star: 3, solid: true, color: '#fd8431', image: 'rock_16_16+6', mining: {speed: 1200, items: [{item: 'blockHive', count: 1}]}, help: 'Hive'},
  SHELL: {code: 95, name: 'Shell', type: NODE_TYPE.ROCK, stype: 'block', star: 2, solid: true, color: '#e9e3e0ff', image: 'rock_16_16+7', mining: {speed: 1800, items: [{item: 'shell', count: 4}]}, help: 'Shell'},

  // ── HOUSING (murs des maisons) ────────────────────────

  WOODWALL: {code: 100, name: 'Wood Wall', type: NODE_TYPE.WALL, star: 1, solid: true, color: '#855959', image: 'wall_16_16+0', hammering: {speed: 1200, items: [{item: 'woodwall', count: 1}]}, help: 'Wood Wall'},
  BRICKWALL: {code: 101, name: 'Brick Wall', type: NODE_TYPE.BWALL, star: 1, solid: false, color: '#788696', image: 'wall_16_16+1', hammering: {speed: 1200, items: [{item: 'brickwall', count: 1}]}, help: 'Background Wall'},
  STONEWALL: {code: 102, name: 'Stone Wall', type: NODE_TYPE.BWALL, star: 1, solid: false, color: '#788696', image: 'wall_16_16+2', hammering: {speed: 1200, items: [{item: 'stonewall', count: 1}]}, help: 'Background Wall'},
  SANDSTONEWALL: {code: 103, name: 'Sandstone Wall', type: NODE_TYPE.BWALL, star: 1, solid: false, color: '#788696', image: 'wall_16_16+3', hammering: {speed: 1200, items: [{item: 'sandstonewall', count: 1}]}, help: 'Background Wall'},
  COPPERWALL: {code: 104, name: 'Copper Wall', type: NODE_TYPE.BWALL, star: 2, solid: false, color: '#788696', image: 'wall_16_16+4', hammering: {speed: 1400, items: [{item: 'copperwall', count: 1}]}, help: 'Background Wall'},
  IRONWALL: {code: 105, name: 'Iron Wall', type: NODE_TYPE.BWALL, star: 2, solid: false, color: '#788696', image: 'wall_16_16+5', hammering: {speed: 1400, items: [{item: 'ironwall', count: 1}]}, help: 'Background Wall'},
  SILVERWALL: {code: 106, name: 'Silver Wall', type: NODE_TYPE.BWALL, star: 2, solid: false, color: '#788696', image: 'wall_16_16+6', hammering: {speed: 1400, items: [{item: 'silverwall', count: 1}]}, help: 'Background Wall'},
  GOLDWALL: {code: 107, name: 'Gold Wall', type: NODE_TYPE.BWALL, star: 2, solid: false, color: '#788696', image: 'wall_16_16+7', hammering: {speed: 1400, items: [{item: 'goldwall', count: 1}]}, help: 'Background Wall'},
  TOPAZWALL: {code: 108, name: 'Topaz Wall', type: NODE_TYPE.BWALL, star: 3, solid: false, color: '#788696', image: 'wall_16_16+8', hammering: {speed: 1600, items: [{item: 'topazwall', count: 1}]}, help: 'Background Wall'},
  RUBYWALL: {code: 109, name: 'Ruby Wall', type: NODE_TYPE.BWALL, star: 3, solid: false, color: '#788696', image: 'wall_16_16+9', hammering: {speed: 1600, items: [{item: 'rubywall', count: 1}]}, help: 'Background Wall'},
  EMERALDWALL: {code: 110, name: 'Emerald Wall', type: NODE_TYPE.BWALL, star: 3, solid: false, color: '#788696', image: 'wall_16_16+10', hammering: {speed: 1600, items: [{item: 'emeraldwall', count: 1}]}, help: 'Background Wall'},
  SAPPHIREWALL: {code: 111, name: 'Sapphire Wall', type: NODE_TYPE.BWALL, star: 3, solid: false, color: '#788696', image: 'wall_16_16+11', hammering: {speed: 1600, items: [{item: 'sapphirewall', count: 1}]}, help: 'Background Wall'},
  COBALTWALL: {code: 112, name: 'Cobalt Wall', type: NODE_TYPE.BWALL, star: 4, solid: false, color: '#788696', image: 'wall_16_16+12', hammering: {speed: 1800, items: [{item: 'cobaltwall', count: 1}]}, help: 'Background Wall'},
  PLATINUMWALL: {code: 113, name: 'Platinum Wall', type: NODE_TYPE.BWALL, star: 4, solid: false, color: '#788696', image: 'wall_16_16+13', hammering: {speed: 1800, items: [{item: 'platinumwall', count: 1}]}, help: 'Background Wall'},
  GRANITEWALL: {code: 114, name: 'Granite Wall', type: NODE_TYPE.BWALL, star: 4, solid: false, color: '#788696', image: 'wall_16_16+14', hammering: {speed: 1800, items: [{item: 'granitewall', count: 1}]}, help: 'Background Wall'},
  MARBLEWALL: {code: 115, name: 'Marble Wall', type: NODE_TYPE.BWALL, star: 4, solid: false, color: '#788696', image: 'wall_16_16+15', hammering: {speed: 1800, items: [{item: 'marblewall', count: 1}]}, help: 'Background Wall'},
  OLYMPITEWALL: {code: 116, name: 'Olympite Column', type: NODE_TYPE.ETERNAL | NODE_TYPE.GAZ | NODE_TYPE.WALL, stype: 'background', star: 6, color: '#C8D8E8', image: 'wall_16_16+15', help: 'Lost Temple'}
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
  FURNITURE: 0x1, TOOL: 0x2, MATERIAL: 0x4, FOOD: 0x08, BLOCK: 0x10, WALL: 0x20, MECHANISM: 0x40, AMMUNITION: 0x80, CHUNK: 0x100, ARMOR: 0x200, BAR: 0x400, WEAPON: 0x800, TRINKET: 0x1000, ACCESSORY: 0x2000, GEM: 0x4000, POTION: 0x8000, SEMABLE: 0x10000, BAG: 0x20000, BAIT: 0x40000, USABLE: 0x80000, PLACABLE: 0x100000, UNIQUE: 0x200000, UNDISPOSABLE: 0x400000, NONE: 0, CRAFTABLE: 0x800000
}

export const MAX_FURNITURE_W = 3 // tuiles — vérification taille réelle dans GameCore.#hydrateItems()
export const MAX_FURNITURE_H = 3 // tuiles — idem

// MATERIAL et CRAFTABLE sont ajoutés automatiquement en post-traitement
// en fonction des recettes.

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1)

export const itemTypeToString = (type, armorSlot = null) => {
  const ch = []
  if (type & ITEM_TYPE.FURNITURE) { ch.push('Furniture') }
  if (type & ITEM_TYPE.TOOL) { ch.push('Tool') }
  if (type & ITEM_TYPE.MATERIAL) { ch.push('Crafting Material') }
  if (type & ITEM_TYPE.FOOD) { ch.push('Food') }
  if (type & ITEM_TYPE.BLOCK) { ch.push('Block') }
  if (type & ITEM_TYPE.WALL) { ch.push('Wall') }
  if (type & ITEM_TYPE.MECHANISM) { ch.push('Mechanism') }
  if (type & ITEM_TYPE.AMMUNITION) { ch.push('Ammunition') }
  if (type & ITEM_TYPE.CHUNK) { ch.push('Ore Chunk') }
  if (type & ITEM_TYPE.ARMOR) { ch.push(armorSlot !== null ? `Armor ${capitalize(armorSlot)}` : 'Armor') }
  if (type & ITEM_TYPE.BAR) { ch.push('Bar') }
  if (type & ITEM_TYPE.WEAPON) { ch.push('Weapon') }
  if (type & ITEM_TYPE.TRINKET) { ch.push('Trinket') }
  if (type & ITEM_TYPE.ACCESSORY) { ch.push('Accessory') }
  if (type & ITEM_TYPE.GEM) { ch.push('Gem') }
  if (type & ITEM_TYPE.POTION) { ch.push('Potion') }
  if (type & ITEM_TYPE.BAG) { ch.push('Grab Bag') }
  if (type & ITEM_TYPE.BAIT) { ch.push('Bait') }
  return ch.join(', ')
}

// MATERIAL: objet utilisé comme ingrédient dans au moins une recette (mise à jour en post-traitement)
// CRAFTABLE : objet pouvant être crée via l'artisanat (mise à jour en post-traitement)
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

  // Topsoil Blocks
  blockDirt: {name: 'Dirt Block', type: 0, star: 1, stype: 'block', image: 'mined_32_32-3-1', help: 'Dirt', tooltip: '???'},
  blockSand: {name: 'Sand Block', type: 0, star: 1, stype: 'block', image: 'mined_32_32-4-1', help: 'Sand', tooltip: '???'},
  blockSilt: {name: 'Silt Block', type: 0, star: 2, stype: 'block', image: 'mined_32_32-5-1', help: 'Silt', tooltip: '???'},
  blockHumus: {name: 'Humus Block', type: 0, star: 2, stype: 'block', image: 'mined_32_32-0-2', help: 'Humus', tooltip: '???'},

  // Forest Substrat Blocks
  blockClay: {name: 'Clay Block', type: 0, star: 1, stype: 'block', image: 'mined_32_32-0-0', help: 'Clay', tooltip: '???'},
  blockStone: {name: 'Stone Block', type: 0, star: 2, stype: 'block', image: 'mined_32_32-1-0', help: 'Stone', tooltip: '???'},
  blockHardstone: {name: 'Hardstone Block', type: 0, star: 4, stype: 'block', image: 'mined_32_32-2-0', help: 'Hardstone', tooltip: '???'},
  // Desert Substrat Blocks
  blockSandstone: {name: 'Sandstone Block', type: 0, star: 2, stype: 'block', image: 'mined_32_32-3-0', help: 'Sandstone', tooltip: '???'},
  blockAsh: {name: 'Ash Block', type: 0, star: 3, stype: 'block', image: 'mined_32_32-4-0', help: 'Ash', tooltip: '???'},
  blockHellstone: {name: 'Hellstone Block', type: 0, star: 5, stype: 'block', image: 'mined_32_32-5-0', help: 'Hellstone', tooltip: '???'},
  // Jungle Substrat Blocks
  blockMud: {name: 'Mud Block', type: 0, star: 2, stype: 'block', image: 'mined_32_32-0-1', help: 'Mud', tooltip: '???'},
  blockLimestone: {name: 'Limestone Block', type: 0, star: 4, stype: 'block', image: 'mined_32_32-1-1', help: 'Limestone', tooltip: '???'},
  blockSlate: {name: 'Slate Block', type: 0, star: 5, stype: 'block', image: 'mined_32_32-2-1', help: 'Slate', tooltip: '???'},

  // Chunks
  chunkCopper: {name: 'Copper Chunk', type: ITEM_TYPE.MATERIAL, star: 1, stype: 'chunk', image: 'mined_32_32-3-2', help: 'Metals', tooltip: 'Primary crafting materials crafted into bars at a Furnace'},
  chunkIron: {name: 'Iron Chunk', type: ITEM_TYPE.MATERIAL, star: 2, stype: 'chunk', image: 'mined_32_32-4-2', help: 'Metals', tooltip: 'Primary crafting materials crafted into bars at a Furnace'},
  chunkSilver: {name: 'Silver Chunk', type: ITEM_TYPE.MATERIAL, star: 3, stype: 'chunk', image: 'mined_32_32-5-2', help: 'Metals', tooltip: 'Primary crafting materials crafted into bars at a Furnace'},
  chunkGold: {name: 'Gold Chunk', type: ITEM_TYPE.MATERIAL, star: 3, stype: 'chunk', image: 'mined_32_32-0-3', help: 'Metals', tooltip: 'Primary crafting materials crafted into bars at a Furnace'},
  chunkCobalt: {name: 'Cobalt Chunk', type: ITEM_TYPE.MATERIAL, star: 4, stype: 'chunk', image: 'mined_32_32-1-3', help: 'Metals', tooltip: 'Primary crafting materials crafted into bars at a Furnace'},
  chunkPlatinum: {name: 'Platinum Chunk', type: ITEM_TYPE.MATERIAL, star: 5, stype: 'chunk', image: 'mined_32_32-2-3', help: 'Metals', tooltip: 'Primary crafting materials crafted into bars at a Furnace'},

  // Bars
  barCopper: {name: 'Copper Bar', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, star: 1, stype: 'bar', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Crafting material used to craft tools, weapons, armor, and other items'},
  barIron: {name: 'Iron Bar', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, star: 2, stype: 'bar', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Crafting material used to craft tools, weapons, armor, and other items'},
  chain: {name: 'Chain', type: 0, star: 2, stype: 'misc', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: '???'},
  barSilver: {name: 'Silver Bar', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, star: 3, stype: 'bar', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Crafting material used to craft tools, weapons, armor, and other items'},
  barGold: {name: 'Gold Bar', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, star: 3, stype: 'bar', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Crafting material used to craft tools, weapons, armor, and other items'},
  barCobalt: {name: 'Cobalt Bar', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, star: 4, stype: 'bar', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Crafting material used to craft tools, weapons, armor, and other items'},
  barPlatinum: {name: 'Platinum Bar', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, star: 5, stype: 'bar', image: 'blocks_16_16-0-0', help: 'Metals', tooltip: 'Crafting material used to craft tools, weapons, armor, and other items'},

  // Gems
  rawTopaz: {name: 'Raw Topaz', type: 0, star: 2, stype: 'gem', image: 'mined_32_32-3-3', help: 'Gems', tooltip: 'Valuable crafting materials to be cut at a Stone Bench'},
  rawRuby: {name: 'Raw Ruby', type: 0, star: 3, stype: 'gem', image: 'mined_32_32-4-3', help: 'Gems', tooltip: 'Valuable crafting materials to be cut at a Stone Bench'},
  rawEmerald: {name: 'Raw Emerald', type: 0, star: 4, stype: 'gem', image: 'mined_32_32-5-3', help: 'Gems', tooltip: 'Valuable crafting materials to be cut at a Stone Bench'},
  rawSapphire: {name: 'Raw Sapphire', type: 0, star: 5, stype: 'gem', image: 'mined_32_32-0-4', help: 'Gems', tooltip: 'Valuable crafting materials to be cut at a Stone Bench'},
  cutTopaz: {name: 'Cut Topaz', type: 0, star: 2, stype: 'gem', image: 'blocks_16_16-0-0', help: 'Gems', tooltip: 'Enhances weapons, gears and accessories'},
  cutRuby: {name: 'Cut Ruby', type: 0, star: 3, stype: 'gem', image: 'blocks_16_16-0-0', help: 'Gems', tooltip: 'Enhances weapons, gears and accessories'},
  cutEmerald: {name: 'Cut Emerald', type: 0, star: 4, stype: 'gem', image: 'blocks_16_16-0-0', help: 'Gems', tooltip: 'Enhances weapons, gears and accessories'},
  cutSapphire: {name: 'Cut Sapphire', type: 0, star: 5, stype: 'gem', image: 'blocks_16_16-0-0', help: 'Gems', tooltip: 'Enhances weapons, gears and accessories'},

  // Rock - Geode Stones
  blockGranite: {name: 'Granite Block', type: ITEM_TYPE.MATERIAL, star: 4, stype: 'block', image: 'blocks_16_16-0-0', help: 'Geode Stones', tooltip: 'Prized crafting materials found in crystalline structures'},
  blockMarble: {name: 'Marble Block', type: ITEM_TYPE.MATERIAL, star: 4, stype: 'block', image: 'blocks_16_16-0-0', help: 'Geode Stones', tooltip: 'Prized crafting materials found in crystalline structures'},
  // Rock - Others
  blockObsidian: {name: 'Obsidian Block', type: ITEM_TYPE.MATERIAL, star: 5, stype: 'block', image: 'blocks_16_16-0-0', help: 'Obsidian', tooltip: 'Hardest material'},
  blockMeteorite: {name: 'Meteorite Block', type: ITEM_TYPE.MATERIAL, star: 5, stype: 'block', image: 'blocks_16_16-0-0', help: 'Meteorite', tooltip: 'Falling from space, hard to use'},
  blockHive: {name: 'Hive Block', type: ITEM_TYPE.MATERIAL, star: 3, stype: 'block', image: 'blocks_16_16-0-0', help: 'Hive', tooltip: 'Hexagonal alveoles build by Bees'},

  // Shell
  shell: {name: 'Shell', type: ITEM_TYPE.MATERIAL, star: 3, stype: 'block', image: 'mined_32_32-2-2', help: 'Shell', tooltip: 'Can be easily powdered'},
  shellPowder: {name: 'Shell Powder', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, star: 3, stype: 'powder', image: 'blocks_16_16-0-0', help: 'Shell', tooltip: '???'},

  // Cobweb
  silk: {name: 'Silk', type: ITEM_TYPE.MATERIAL, star: 1, stype: 'cobweb', image: 'mined_32_32-2-1', help: 'Cobweb', tooltip: '???'},
  fabric: {name: 'Fabric', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, star: 1, stype: 'cobweb', image: 'blocks_16_16-0-0', help: 'Cobweb', tooltip: '???'},
  eggSpider: {name: 'Spider Egg', type: ITEM_TYPE.MATERIAL, star: 1, stype: 'egg', image: 'blocks_16_16-0-0', help: 'Eggs', tooltip: '???'},

  // Baits
  worm: {name: 'Worm', type: ITEM_TYPE.BAIT, star: 1, stype: 'bait', image: 'blocks_16_16-0-0', help: 'Fishing Baits', tooltip: '???'},
  goldWorm: {name: 'Gold Worm', type: ITEM_TYPE.BAIT, star: 2, stype: 'bait', image: 'blocks_16_16-0-0', help: 'Fishing Baits', tooltip: '???'},
  slug: {name: 'Slug', type: ITEM_TYPE.BAIT, star: 1, stype: 'bait', image: 'blocks_16_16-0-0', help: 'Fishing Baits', tooltip: '???'},
  goldSlug: {name: 'Gold Slug', type: ITEM_TYPE.BAIT, star: 1, stype: 'bait', image: 'blocks_16_16-0-0', help: 'Fishing Baits', tooltip: '???'},
  snail: {name: 'Snail', type: ITEM_TYPE.BAIT, star: 1, stype: 'bait', image: 'blocks_16_16-0-0', help: 'Fishing Baits', tooltip: '???'},
  frog: {name: 'Snail', type: ITEM_TYPE.BAIT | ITEM_TYPE.MATERIAL, star: 1, stype: 'bait', image: 'blocks_16_16-0-0', help: 'Fishing Baits', tooltip: '???'},

  // pickaxes
  pickaxeCopper: {name: 'Copper Pickaxe', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'pickaxe', star: 2, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Mining Tools', tooltip: 'Tools used to remove blocks, converting them to item form'},
  pickaxeIron: {name: 'Iron Pickaxe', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'pickaxe', star: 3, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Mining Tools', tooltip: 'Tools used to remove blocks, converting them to item form'},
  pickaxeSilver: {name: 'Silver Pickaxe', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'pickaxe', star: 4, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Mining Tools', tooltip: 'Tools used to remove blocks, converting them to item form'},
  pickaxeGold: {name: 'Gold Pickaxe', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'pickaxe', star: 4, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Mining Tools', tooltip: 'Tools used to remove blocks, converting them to item form'},
  pickaxeCobalt: {name: 'Cobalt Pickaxe', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'pickaxe', star: 5, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Mining Tools', tooltip: 'Tools used to remove blocks, converting them to item form'},
  pickaxePlatinum: {name: 'Platinum Pickaxe', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'pickaxe', star: 5, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Mining Tools', tooltip: 'Tools used to remove blocks, converting them to item form'},
  pickaxeBone: {name: 'Bone Pickaxe', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'pickaxe', star: 4, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Mining Tools', tooltip: 'Tools used to remove blocks, converting them to item form'},

  // Sickles
  sickleCopper: {name: 'Copper Sickle', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, stype: 'pickaxe', star: 1, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Harvesting Tools', tooltip: 'Tools used to harvest plants'},
  sickleSilver: {name: 'Silver Sickle', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, stype: 'pickaxe', star: 3, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Harvesting Tools', tooltip: 'Tools used to harvest plants'},
  sickleGold: {name: 'Gold Sickle', type: ITEM_TYPE.TOOL | ITEM_TYPE.CRAFTABLE, stype: 'pickaxe', star: 5, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Harvesting Tools', tooltip: 'Tools used to harvest plants'},

  // hammers
  hammerCopper: {name: 'Copper Hammer', type: ITEM_TYPE.TOOL | ITEM_TYPE.MATERIAL, stype: 'hammer', star: 2, image: 'tools_32_32-4-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Hammers', tooltip: 'Tools used to remove wall, furniture, workstation, converting them to item form'},

  // Axes
  axeCopper: {name: 'Copper Axe', type: ITEM_TYPE.TOOL | ITEM_TYPE.WEAPON | ITEM_TYPE.MATERIAL, stype: 'axe', star: 2, image: 'tools_32_32-2-0', placedright: 'w_42_42-0-0', placedleft: 'w_42_42-0-1', speed: 0, help: 'Axes', tooltip: 'Basic tools used to chop trees. Can be used as a slow weapon'},

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
  tomb: {name: 'Tombstone', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.UNDISPOSABLE, stype: 'tomb', star: 1, image: 'furniture_32_32-13-2', placed: 'fuws_32_32-3-4', help: 'Graveyard', tooltip: 'Summons specific enemies'},
  tombHead: {name: 'Headstone', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.UNDISPOSABLE, stype: 'tomb', star: 1, image: 'furniture_32_32-4-8', placed: 'fuws_32_32-4-4', help: 'Graveyard', tooltip: 'Summons specific enemies'},
  tombGrave: {name: 'Gravestone', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.UNDISPOSABLE, stype: 'tomb', star: 1, image: 'furniture_32_32-5-8', placed: 'fuws_32_32-5-4', help: 'Graveyard', tooltip: 'Summons specific enemies'},
  tombStrange: {name: 'Strange Looking Tombstone', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.UNDISPOSABLE, star: 1, stype: 'tomb', image: 'furniture_32_32-6-8', placed: 'fuws_32_32-6-4', help: 'Graveyard', tooltip: 'Summons specific enemies'},
  tombCross: {name: 'Cross Tombstone', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.UNDISPOSABLE, stype: 'tomb', star: 1, image: 'furniture_32_32-7-8', placed: 'fuws_32_32-7-4', help: 'Graveyard', tooltip: 'Summons specific enemies'},

  // accessories - combat
  bezoar: {name: 'Bezoar', type: ITEM_TYPE.ACCESSORY, stype: 'accessory', star: 3, image: 'accessories_32_32-0-0', help: 'Accessories', tooltip: 'Immunity to Bleeding, Poisoned', immunity: ['bleeding', 'poisoned']},

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

  byHand: {name: 'By Hand', type: ITEM_TYPE.FURNITURE, stype: 'station', star: 0, image: 'furniture_32_32-3-0', placed: null, help: 'Crafting Stations', tooltip: 'No Crafting Station required'},
  workbench: {name: 'Workbench', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 1, furnitureSet: 'wood', surface: true, image: 'furniture_32_32-3-0', placed: 'fuws_48_32-2-0', help: 'Woodworking', tooltip: 'Crafting station for many essential items'},
  sawmill: {name: 'Sawmill', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 3, image: 'furniture_32_32-0-0', placed: 'fuws_48_48-0-1', help: 'Woodworking', tooltip: ' Crafting station for advanced Wood and Furniture crafting'},

  anvil: {name: 'Anvil', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 2, image: 'furniture_32_32-8-1', placed: 'fuws_32_32-1-0', help: 'Forging', tooltip: 'Crafting station used to craft metal bars into tools, weapons, armor, and other items'},
  forge: {name: 'Forge', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 4, image: 'furniture_32_32-8-2', placed: 'fuws_32_32-2-0', help: 'Forging', tooltip: 'Crafting stations used to craft metal bars into tools, weapons, armor, and other items'},

  furnace: {name: 'Furnace', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 2, image: 'furniture_32_32-6-0', placed: 'fuws_48_48-0-0', help: 'Smelting', tooltip: 'Crafting station for metal smelting'},
  blastFurnace: {name: 'Blast Furnace', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 4, image: 'furniture_32_32-5-0', placed: 'fuws_48_48-1-0', help: 'Smelting', tooltip: 'Crafting station for strong metal smelting'},

  // Metal Fittings
  nailIron: {name: 'Iron Nail', type: 0, stype: 'fitting', star: 2, image: 'crafting_32_32-2-0', help: 'Metal Fittings', tooltip: 'Fastener used to built or repair a lot of items'},
  nailCobalt: {name: 'Cobalt Nail', type: 0, stype: 'fitting', star: 4, image: 'crafting_32_32-2-0', help: 'Metal Fittings', tooltip: 'Fastener used to built or repair a lot of items'},
  rivetCobalt: {name: 'Cobalt Rivet', type: 0, stype: 'fitting', star: 4, image: 'crafting_32_32-2-0', help: 'Metal Fittings', tooltip: 'Strong fastener used to built a lot of high tier items'},
  rivetPlatinum: {name: 'Platinum Rivet', type: 0, stype: 'fitting', star: 5, image: 'crafting_32_32-2-0', help: 'Metal Fittings', tooltip: 'Strong fastener used to built a lot of high tier items'},
  chainCopper: {name: 'Copper Chain', type: 0, stype: 'fitting', star: 1, image: 'crafting_32_32-2-0', help: 'Metal Fittings', tooltip: 'Fastener used to built a lot of sensitive items'},
  chainIron: {name: 'Copper Chain', type: 0, stype: 'fitting', star: 2, image: 'crafting_32_32-2-0', help: 'Metal Fittings', tooltip: 'Fastener used to built a lot of sensitive items'},
  chainSilver: {name: 'Copper Chain', type: 0, stype: 'fitting', star: 3, image: 'crafting_32_32-2-0', help: 'Metal Fittings', tooltip: 'Fastener used to built a lot of sensitive items'},
  wireCopper: {name: 'Copper Wire', type: 0, stype: 'fitting', star: 1, image: 'crafting_32_32-2-0', help: 'Metal Fittings', tooltip: 'Fastener used to built a lot of sensitive items'},
  wireIron: {name: 'Iron Wire', type: 0, stype: 'fitting', star: 2, image: 'crafting_32_32-2-0', help: 'Metal Fittings', tooltip: 'Fastener used to built a lot of items'},
  wireGold: {name: 'Gold Wire', type: 0, stype: 'fitting', star: 3, image: 'crafting_32_32-2-0', help: 'Metal Fittings', tooltip: 'Fastener used to built a lot of items'},
  wireCobalt: {name: 'Cobalt Wire', type: 0, stype: 'fitting', star: 4, image: 'crafting_32_32-2-0', help: 'Metal Fittings', tooltip: 'Fastener used to built a lot of items'},

  stoneBench: {name: 'Stone Bench', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 3, image: 'furniture_32_32-1-0', placed: 'fuws_48_32-0-0', help: 'Stoneworking', tooltip: 'Crafting station for sharpenig tools and weapons'},

  loom: {name: 'Loom', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 2, image: 'furniture_32_32-1-0', placed: 'fuws_48_32-0-0', help: 'Weaving', tooltip: 'Crafting station for cloth'},

  // Leatherworking
  tanningRack: {name: 'Tanning Rack', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 3, image: 'furniture_32_32-1-0', placed: 'fuws_48_32-0-0', help: 'Leatherworking', tooltip: 'Crafting station for leather'},
  leather: {name: 'Leather', type: 0, stype: 'leather', star: 1, image: 'crafting_32_32-2-0', help: 'Leatherworking', tooltip: '???'},

  jewelerBench: {name: 'Jeweler\'s Bench', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 3, surface: true, image: 'furniture_32_32-7-0', placed: 'fuws_48_48-2-0', help: 'Jewelry', tooltip: 'Crafting station for jewels and accessories'},
  alchemyTable: {name: 'Alchemy Table', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 2, image: 'furniture_32_32-8-0', placed: 'fuws_48_48-2-1', help: 'Alchemy', tooltip: 'Crafting station for potions'},
  cookingPot: {name: 'Cooking Pot', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'station', star: 2, image: 'furniture_32_32-9-0', placed: 'fuws_32_32-7-2', help: 'Cooking', tooltip: 'Crafting station for food'},

  brokenDecomposer: {name: 'Broken Decomposer', type: ITEM_TYPE.FURNITURE, immovable: true, stype: 'immovable', star: 5, image: null, placed: 'fuws_48_32-0-1', help: 'Lost Temple', tooltip: '????'},
  decomposerPart: {name: 'Decomposer Part', type: ITEM_TYPE.TOOL, stype: 'part', star: 5, image: null, placed: 'fuws_48_32-0-1', help: 'Decomposer', tooltip: 'Part used to repair Broken Decomposer'},
  decomposer: {name: 'Decomposer', type: ITEM_TYPE.FURNITURE, immovable: true, stype: 'station', star: 5, image: null, placed: 'fuws_48_32-0-1', help: 'Decomposer', tooltip: '????'},
  transmutator: {name: 'Transmutator', type: ITEM_TYPE.FURNITURE, immovable: true, stype: 'station', star: 5, image: null, placed: 'fuws_48_32-0-1', help: 'Transmutator', tooltip: '????'},

  // housing furniture
  noticeBoard: {name: 'Notice Board', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE, stype: 'housing', star: 3, image: '...', placed: '...', help: 'Housing', tooltip: 'Displays and applies the housing buff of this house'},

  // Food containers
  bowl: {name: 'Bowl', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, stype: 'tableware', star: 1, onTop: true, image: 'furniture_32_32-6-2', placed: 'fuws_32_32-3-0', help: 'Tableware', tooltip: 'The best soups are made in old bowls'},
  mug: {name: 'Mug', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, stype: 'tableware', star: 1, onTop: true, image: 'furniture_32_32-7-7', placed: 'fuws_32_32-1-3', help: 'Tableware', tooltip: 'The best Ale container'},
  plate: {name: 'Plate', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, stype: 'tableware', star: 1, onTop: true, image: 'furniture_32_32-8-7', placed: 'fuws_16_16-0-0', help: 'Tableware', tooltip: 'Looks as good as it tastes'},
  trencher: {name: 'Wooden Trencher', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, stype: 'tableware', onTop: true, star: 1, image: 'furniture_32_32-9-7', placed: 'fuws_16_16-1-0', help: 'Tableware', tooltip: 'A rustic wooden plate, perfect for simple meals'},

  // Liquid containers (small capacity)
  glass: {name: 'Glass', type: 0, stype: 'tableware', star: 1, image: 'crafting_32_32-3-5', help: 'Bottles', tooltip: 'Used to make Bottles or decorative furniture'},
  bottle: {name: 'Bottle', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.TOOL, stype: 'tableware', star: 1, furnitureSet: 'glass', image: 'furniture_32_32-10-2', placed: 'fuws_32_32-0-0', help: 'Bottles', tooltip: 'Crafting container for potions and food'},
  water: {name: 'Bottled Water', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.POTION | ITEM_TYPE.USABLE, stype: 'tableware', star: 1, image: 'potions_32_32-0-5', placed: 'fuws_32_32-4-0', heal: 20, sickness: 40, help: 'Bottles', tooltip: 'Healing item and Crafting Material for potions'},
  honey: {name: 'Bottled Honey', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.POTION | ITEM_TYPE.USABLE, stype: 'tableware', star: 1, image: 'potions_32_32-1-5', placed: 'fuws_32_32-4-0', heal: 80, sickness: 60, timedbuff: 'honey', time: 15, help: 'Bottles', tooltip: 'Healing item'},
  sap: {name: 'Bottled Sap', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.POTION | ITEM_TYPE.USABLE, stype: 'tableware', star: 1, image: 'potions_32_32-1-5', placed: 'fuws_32_32-4-0', heal: 80, sickness: 60, timedbuff: 'honey', time: 15, help: 'Bottles', tooltip: 'Healing item'},

  // Liquid containers (large capacity)
  bucket: {name: 'Empty Bucket', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.TOOL | ITEM_TYPE.ARMOR, stype: 'tableware', armor: 'head', star: 1, image: 'furniture_32_32-10-0', placed: 'fuws_32_32-5-0', help: 'Buckets', tooltip: 'Used to scoop up a small amount of water, honey or sap', placedright: 'heads_26_22-0-2', placedleft: 'heads_26_22-0-3', defense: 1},
  bucketWater: {name: 'Water Bucket', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.TOOL, stype: 'tableware', star: 1, image: 'furniture_32_32-11-0', placed: 'fuws_32_32-6-0', help: 'Buckets', tooltip: 'Amount of water. Can be poured out'},
  bucketHoney: {name: 'Honey Bucket', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.TOOL, stype: 'tableware', star: 1, image: 'furniture_32_32-12-0', placed: 'fuws_32_32-7-0', help: 'Buckets', tooltip: 'Amount of honey. Can be poured out'},
  bucketSap: {name: 'Sap Bucket', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.TOOL, stype: 'tableware', star: 1, image: 'furniture_32_32-13-0', placed: 'fuws_32_32-0-3', help: 'Buckets', tooltip: 'Amount of lava. Can be poured out'},

  // Trees
  coconut: {name: 'Coconut', type: ITEM_TYPE.MATERIAL, stype: 'tree', star: 1, image: 'potions_32_32-1-5', placed: 'fuws_32_32-4-0', help: 'Coconut', tooltip: '???'},
  coconutFiber: {name: 'Coconut Fiber', type: ITEM_TYPE.MATERIAL, stype: 'textile', star: 1, image: 'potions_32_32-1-5', help: 'Coconut', tooltip: '???'},
  coconutPulp: {name: 'Coconut Pulp', type: ITEM_TYPE.MATERIAL, stype: 'fruit', star: 1, image: 'potions_32_32-1-5', help: 'Coconut', tooltip: '???'},
  coconutMilk: {name: 'Coconut Milk', type: ITEM_TYPE.MATERIAL, stype: 'beverage', star: 1, image: 'potions_32_32-1-5', help: 'Coconut', tooltip: '???'},

  oak: {name: 'Oak', type: 0, stype: 'tree', star: 1, image: null, help: 'Oak & Mahogany', tooltip: '???'},
  logOak: {name: 'Wood Log', type: ITEM_TYPE.MATERIAL, stype: 'wood', star: 1, image: 'potions_32_32-1-5', help: 'Oak & Mahogany', tooltip: '???'},
  rootOak: {name: 'Wood Root', type: ITEM_TYPE.MATERIAL, stype: 'root', star: 1, image: 'potions_32_32-1-5', help: 'Oak & Mahogany', tooltip: '???'},
  acorn: {name: 'Acorn', type: ITEM_TYPE.MATERIAL, stype: 'seed', star: 1, image: 'potions_32_32-1-5', help: 'Oak & Mahogany', tooltip: '???'},
  seedForest: {name: 'Forest Grass Seed', type: ITEM_TYPE.PLACABLE, stype: 'seed', star: 1, image: 'potions_32_32-1-5', help: 'Forest Grass', tooltip: 'Plant to change Dirt into Forest Grass'},
  seedJungle: {name: 'Jungle Grass Seed', type: ITEM_TYPE.PLACABLE, stype: 'seed', star: 1, image: 'potions_32_32-1-5', help: 'Jungle Grass', tooltip: 'Plant to change Silt into Jungle Grass'},

  mahogany: {name: 'Mahogany', type: 0, stype: 'tree', star: 2, image: null, help: 'Oak & Mahogany', tooltip: '???'},
  logMahogany: {name: 'Mahogany Log', type: ITEM_TYPE.MATERIAL, stype: 'wood', star: 2, image: 'potions_32_32-1-5', help: 'Oak & Mahogany', tooltip: '???'},
  rootMahogany: {name: 'Mahogany Root', type: ITEM_TYPE.MATERIAL, stype: 'root', star: 2, image: 'potions_32_32-1-5', help: 'Oak & Mahogany', tooltip: '???'},
  samara: {name: 'Samara', type: ITEM_TYPE.MATERIAL, stype: 'seed', star: 2, image: 'potions_32_32-1-5', help: 'Oak & Mahogany', tooltip: '???'},

  giantMushroom: {name: 'Giant Mushroom', type: 0, stype: 'tree', star: 1, image: null, help: 'Oak & Mahogany', tooltip: '???'},

  // Mushrooms
  bolete: {name: 'Bolete', type: ITEM_TYPE.MATERIAL, stype: 'mushroom', star: 1, image: 'potions_32_32-1-5', placed: 'fuws_32_32-4-0', help: 'Surface Mushrooms', tooltip: '???'},
  pinkMycenia: {name: 'Pink Mycenia', type: ITEM_TYPE.MATERIAL, stype: 'mushroom', star: 1, image: 'potions_32_32-1-5', placed: 'fuws_32_32-4-0', help: 'Surface Mushrooms', tooltip: '???'},
  frostcap: {name: 'Frostcap', type: 0, stype: 'mushroom', star: 3, image: null, placed: 'potions_32_32-1-5', help: 'Cave Mushrooms', tooltip: '???'},
  dawncap: {name: 'Dawncap', type: 0, stype: 'mushroom', star: 3, image: null, placed: 'potions_32_32-1-5', help: 'Cave Mushrooms', tooltip: '???'},
  mushroomGill: {name: 'Mushroom Gill', type: ITEM_TYPE.MATERIAL, stype: 'mushroom', star: 3, image: 'potions_32_32-1-5', help: 'Cave Mushrooms', tooltip: '???'},

  // Herbs
  parsnip: {name: 'Parsnip', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 1, image: 'potions_32_32-1-5', placed: 'fuws_32_32-4-0', help: 'Parsnip', tooltip: '???'},
  parsnipMash: {name: 'Parsnip Mash', type: ITEM_TYPE.FOOD | ITEM_TYPE.CRAFTABLE | ITEM_TYPE.USABLE, stype: 'food', star: 1, image: 'potions_32_32-1-5', help: 'Parsnip', tooltip: '???'},
  vegetableSoup: {name: 'Vegetable Soup', type: ITEM_TYPE.FOOD | ITEM_TYPE.CRAFTABLE | ITEM_TYPE.USABLE, stype: 'food', star: 2, image: 'potions_32_32-1-5', help: 'Soups', tooltip: '???'},

  sunflower: {name: 'Sunflower', type: 0, stype: 'herb', star: 1, image: null, placed: 'fuws_32_32-4-0', placedLeft: 'fuws_32_32-4-0', placedRight: 'fuws_32_32-4-0', help: 'Sunflower', tooltip: '???'},
  sunflowerSeed: {name: 'Sunflower Seed', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.SEED, stype: 'seed', star: 1, image: 'potions_32_32-1-5', placed: 'fuws_32_32-4-0', help: 'Sunflower', tooltip: '???'},
  sunflowerOil: {name: 'Sunflower Oil', type: ITEM_TYPE.CRAFTABLE, stype: 'seed', star: 1, image: 'potions_32_32-1-5', placed: 'fuws_32_32-4-0', help: 'Sunflower', tooltip: '???'},

  oleander: {name: 'Oleander', type: 0, stype: 'herb', star: 1, image: 'fuws_32_32-4-0', placed: 'fuws_32_32-4-0', help: 'Oleander', tooltip: '???'},
  oleanderOil: {name: 'Oleander Oil', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.CRAFTABLE, stype: 'seed', star: 1, image: 'potions_32_32-1-5', placed: 'fuws_32_32-4-0', help: 'Oleander', tooltip: '???'},
  oleanderBulb: {name: 'Oleander Bulb', type: ITEM_TYPE.MATERIAL, stype: 'seed', star: 1, image: 'potions_32_32-1-5', placed: 'fuws_32_32-4-0', help: 'Oleander', tooltip: '???'},

  ambermirage: {name: 'Ambermirage', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 1, image: 'potions_32_32-1-5', placed: 'fuws_32_32-4-0', help: 'Ambermirage', tooltip: '???'},

  bloodmoon: {name: 'Bloodmoon', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 2, image: 'potions_32_32-1-5', placed: 'fuws_32_32-4-0', help: 'Bloodmoon', tooltip: '???'},
  bloodmoonSeed: {name: 'Bloodmoon Seed', type: ITEM_TYPE.MATERIAL | ITEM_TYPE.SEED, stype: 'seed', star: 2, image: 'potions_32_32-1-5', placed: 'fuws_32_32-4-0', help: 'Bloodmoon', tooltip: '???'},

  fernS: {name: 'Shadowfern', type: 0, stype: 'herb', star: 3, image: null, placed: 'fuws_32_32-2-3', speed: 1900, foraging: [{item: 'fernLeaf', count: 1, rainy: 1.8, windy: 1.8}], help: 'Ferns', tooltip: '???'},
  fernC: {name: 'Crimsonfrond', type: 0, stype: 'herb', star: 3, image: null, placed: 'fuws_32_32-2-3', speed: 1900, foraging: [{item: 'fernLeaf', count: 1, rainy: 1.8, windy: 1.8}], help: 'Ferns', tooltip: '???'},
  fernG: {name: 'Goldenveil', type: 0, stype: 'herb', star: 3, image: null, placed: 'fuws_32_32-2-3', speed: 1900, foraging: [{item: 'fernLeaf', count: 1, rainy: 1.8, windy: 1.8}], help: 'Ferns', tooltip: '???'},
  fernM: {name: 'Mistfern', type: 0, stype: 'herb', star: 3, image: null, placed: 'fuws_32_32-2-3', speed: 1900, foraging: [{item: 'fernLeaf', count: 1, rainy: 1.8, windy: 1.8}], help: 'Ferns', tooltip: '???'},
  fernLeaf: {name: 'Fern Leaf', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 3, image: 'crafting_32_32-0-1', help: 'Ferns', tooltip: 'Crafting Material for Potions and Furniture'},
  fernSpore: {name: 'Fern Spore', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 3, image: 'crafting_32_32-0-1', help: 'Ferns', tooltip: 'Crafting Material for Potions and Furniture'},

  velvetmoss: {name: 'Velvetmoss', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 3, image: 'crafting_32_32-0-1', placed: 'fuws_32_32-2-3', speed: 1900, foraging: [{item: 'velvetmoss', count: 1, rainy: 1.8, windy: 1.8}], help: 'Velvetmoss', tooltip: '???'},

  coralR: {name: 'Sunburst Brain Coral', type: 0, stype: 'herb', star: 2, image: null, placed: 'fuws_32_32-2-3', speed: 1900, foraging: [{item: 'coral', count: 1, rainy: 1.8, windy: 1.8}], help: 'Corals', tooltip: 'Crafting Material for Potions and Furniture'},
  coralP: {name: 'Starfire Pillar Coral', type: 0, stype: 'herb', star: 2, image: null, placed: 'fuws_32_32-3-3', speed: 1900, foraging: [{item: 'coral', count: 1, rainy: 1.8, windy: 1.8}], help: 'Corals', tooltip: 'Crafting Material for Potions and Furniture'},
  coralY: {name: 'Flickering Torch Coral', type: 0, stype: 'herb', star: 2, image: null, placed: 'fuws_32_32-4-3', speed: 1900, foraging: [{item: 'coral', count: 1, rainy: 1.8, windy: 1.8}], help: 'Corals', tooltip: 'Crafting Material for Potions and Furniture'},
  coralG: {name: 'Whispering Fan Coral', type: 0, stype: 'herb', star: 2, image: null, placed: 'fuws_32_32-5-3', speed: 1900, foraging: [{item: 'coral', count: 1, rainy: 1.8, windy: 1.8}], help: 'Corals', tooltip: 'Crafting Material for Potions and Furniture'},
  coral: {name: 'Coral', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 2, image: 'crafting_32_32-0-1', help: 'Corals', tooltip: 'Crafting Material for Potions and Furniture'},

  mandrake: {name: 'Mandrake', type: 0, stype: 'herb', star: 2, image: null, placed: 'fuws_32_32-2-3', speed: 1900, foraging: [{item: 'mandrakeRoot', count: 1, rainy: 1.8, windy: 1.8}], help: 'Mandrake', tooltip: 'Harvest to collect Potions and Food ingredients'},
  mandrakeRoot: {name: 'Mandrake Root', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 3, image: 'crafting_32_32-0-1', help: 'Mandrake', tooltip: 'Crafting Material for Potions and Food'},

  cactus1: {name: 'Cactus', type: 0, stype: 'herb', star: 2, image: null, placed: 'fuws_32_32-2-3', help: 'Cactus', tooltip: '???'},
  cactus2: {name: 'Cactus', type: 0, stype: 'herb', star: 2, image: null, placed: 'fuws_32_32-2-3', help: 'Cactus', tooltip: '???'},
  cactus3: {name: 'Cactus', type: 0, stype: 'herb', star: 2, image: null, placed: 'fuws_32_32-2-3', help: 'Cactus', tooltip: '???'},
  cactus4: {name: 'Cactus', type: 0, stype: 'herb', star: 2, image: null, placed: 'fuws_32_32-2-3', help: 'Cactus', tooltip: '???'},
  cactus: {name: 'Cactus', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 2, image: 'fuws_32_32-2-3', help: 'Cactus', tooltip: '???'},
  cactusFiber: {name: 'Cactus Fiber', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 2, image: 'fuws_32_32-2-3', help: 'Cactus', tooltip: '???'},
  cactusSpine: {name: 'Cactus Spine', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 2, image: 'fuws_32_32-2-3', help: 'Cactus', tooltip: '???'},

  bamboo: {name: 'Bamboo', type: 0, stype: 'herb', star: 2, image: null, placed: 'fuws_32_32-2-3', help: 'Bamboo', tooltip: '???'},
  bambooStalk: {name: 'Bamboo Stalk', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 2, image: 'fuws_32_32-2-3', help: 'Bamboo', tooltip: '???'},
  bambooShoot: {name: 'Bamboo Shoot', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 2, image: 'fuws_32_32-2-3', help: 'Bamboo', tooltip: '???'},

  satansCube: {name: 'Satan\'s Cube', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 4, image: 'fuws_32_32-2-3', placed: 'fuws_32_32-2-3', foraging: [{item: 'satansCube', count: 1, rainy: 1.8, windy: 1.8}], help: 'Satan\'s Cube', tooltip: 'Harvest to collect Potions and Food ingredients'},
  sneakthorn: {name: 'Sneakthorn', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 4, image: 'fuws_32_32-2-3', placed: 'fuws_32_32-2-3', foraging: [{item: 'sneakthorn', count: 1, rainy: 1.8, windy: 1.8}], help: 'Sneakthorn', tooltip: 'Harvest to collect Potions and Food ingredients'},
  cursedcrown: {name: 'Cursedcrown ', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 4, image: 'fuws_32_32-2-3', placed: 'fuws_32_32-2-3', foraging: [{item: 'cursedcrown', count: 1, rainy: 1.8, windy: 1.8}], help: 'Cursedcrown', tooltip: 'Harvest to collect Potions and Food ingredients'},
  abysshorn: {name: 'Abysshorn', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 5, image: 'fuws_32_32-2-3', placed: 'fuws_32_32-2-3', foraging: [{item: 'abysshorn', count: 1, rainy: 1.8, windy: 1.8}], help: 'Abysshorn', tooltip: 'Harvest to collect Potions and Food ingredients'},
  inferncap: {name: 'Inferncap', type: ITEM_TYPE.MATERIAL, stype: 'herb', star: 5, image: 'fuws_32_32-2-3', placed: 'fuws_32_32-2-3', foraging: [{item: 'inferncap', count: 1, rainy: 1.8, windy: 1.8}], help: 'Inferncap', tooltip: 'Harvest to collect Potions and Food ingredients'},

  // Gardening
  clayPot1: {name: 'Clay Pot (1x1)', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.CRAFTABLE, stype: 'pot', surface: true, onTop: true, star: 1, capacity: 1, image: 'furniture_32_32-0-8', placed: 'fuws_16_16-0-2', placedleft: 'fuws_16_16-1-2', placedright: 'fuws_16_16-2-2', help: 'Clay Pots', tooltip: 'Gardening Container'},
  clayPot2: {name: 'Clay Pot (2x1)', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.CRAFTABLE, stype: 'pot', surface: true, onTop: true, star: 1, capacity: 2, image: 'furniture_32_32-1-8', placed: 'fuws_32_16-0-0', placedleft: 'fuws_32_16-1-0', placedright: 'fuws_32_16-2-0', help: 'Clay Pots', tooltip: 'Gardening Container'},
  clayPot3: {name: 'Clay Pot (3x1)', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.CRAFTABLE, stype: 'pot', surface: true, onTop: true, star: 1, capacity: 3, image: 'furniture_32_32-2-8', placed: 'fuws_48_16-0-0', placedleft: 'fuws_48_16-1-0', placedright: 'fuws_48_16-2-0', help: 'Clay Pots', tooltip: 'Gardening Container'},
  clayPot4: {name: 'Clay Pot (2x2)', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.CRAFTABLE, stype: 'pot', surface: true, onTop: true, star: 1, capacity: 4, image: 'furniture_32_32-3-8', placed: 'fuws_32_32-0-4', placedleft: 'fuws_32_32-1-4', placedright: 'fuws_32_32-2-4', help: 'Clay Pots', tooltip: 'Gardening Container'},

  // Accessories

  // Torches
  gel: {name: 'Gel', type: ITEM_TYPE.MATERIAL, stype: 'light', star: 1, image: 'crafting_32_32-2-0', help: 'Gel', tooltip: 'Crafting material dropped by most slimes'},
  torch: {name: 'Torch', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.CRAFTABLE | ITEM_TYPE.MATERIAL, stype: 'light', star: 1, floating: true, furnitureSet: 'wood', image: 'furniture_32_32-0-3', placed: 'fuws_16_16-2-0', help: 'Torches', tooltip: 'Illuminates the night and closed spaces'},

  // Campfires
  campfire: {name: 'Campfire', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.CRAFTABLE, stype: 'light', star: 1, image: 'furniture_32_32-7-3', placed: 'fuws_48_32-2-1', help: 'Campfires', tooltip: 'Provides Cozy Buff when lit'},

  // Platforms
  platformOak: {name: 'Wood Platform', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE | ITEM_TYPE.CRAFTABLE, stype: 'platform', star: 1, furnitureSet: 'wood', image: 'furniture_32_32-6-7', placed: 'fuws_16_16-0-1', placedleft: 's_42_42-0-5', placedright: 's_42_42-0-4', help: 'Platforms', tooltip: 'Can be walked on, but also allow movement through the space they occupy'},

  // woodptfm: {name: 'Wood Platform', type: ITEM_TYPE.FURNITURE, stype: 'platform', floating: true, furnitureSet: 'wood', sell: 25, star: 1, image: 'furniture_32_32-6-7', placed: 'fuws_16_16-0-1', placedleft: 's_42_42-0-5', placedright: 's_42_42-0-4', help: 'Platforms', tooltip: 'Can be walked on, but also allow movement through the space they occupy'},

  // reefptfm: {name: 'Reef Platform', type: ITEM_TYPE.FURNITURE, stype: 'platform', floating: true, furnitureSet: 'coral', sell: 250, star: 2, image: 'furniture_32_32-0-7', placed: 'fuws_16_16-1-1', placedleft: 's_42_42-1-5', placedright: 's_42_42-1-4', help: 'Platforms', tooltip: 'Can be walked on, but also allow movement through the space they occupy'},
  // mahoganyptfm: {name: 'Mahogany Platform', type: ITEM_TYPE.FURNITURE, stype: 'platform', floating: true, furnitureSet: 'mahogany', sell: 75, star: 2, image: 'furniture_32_32-1-7', placed: 'fuws_16_16-2-1', placedleft: 's_42_42-2-5', placedright: 's_42_42-2-4', help: 'Platforms', tooltip: 'Can be walked on, but also allow movement through the space they occupy'},
  // glassptfm: {name: 'Glass Platform', type: ITEM_TYPE.FURNITURE, stype: 'platform', floating: true, furnitureSet: 'glass', sell: 25, star: 1, image: 'furniture_32_32-2-7', placed: 'fuws_16_16-3-1', placedleft: 's_42_42-3-5', placedright: 's_42_42-3-4', help: 'Platforms', tooltip: 'Can be walked on, but also allow movement through the space they occupy'},
  // stoneptfm: {name: 'Stone Platform', type: ITEM_TYPE.FURNITURE, stype: 'platform', floating: true, sell: 25, star: 1, image: 'furniture_32_32-3-7', placed: 'fuws_16_16-4-1', placedleft: 's_42_42-4-5', placedright: 's_42_42-4-4', help: 'Platforms', tooltip: 'Can be walked on, but also allow movement through the space they occupy'},
  // sandstoneptfm: {name: 'Sandstone Platform', type: ITEM_TYPE.FURNITURE, stype: 'platform', floating: true, furnitureSet: 'sandstone', sell: 350, star: 3, image: 'furniture_32_32-4-7', placed: 'fuws_16_16-5-1', placedleft: 's_42_42-5-5', placedright: 's_42_42-5-4', help: 'Platforms', tooltip: 'Can be walked on, but also allow movement through the space they occupy'},
  // slimeptfm: {name: 'Slime Platform', type: ITEM_TYPE.FURNITURE, stype: 'platform', floating: true, furnitureSet: 'slime', sell: 25, star: 1, image: 'furniture_32_32-5-7', placed: 'fuws_16_16-6-1', placedleft: 's_42_42-5-3', placedright: 's_42_42-5-2', help: 'Platforms', tooltip: 'Can be walked on, but also allow movement through the space they occupy'},

  // coralcampfire: {name: 'Coral Campfire', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.LIGHT, stype: 'onoff', cozy: true, sell: 3500, star: 2, image: 'furniture_32_32-8-3', placed: 'fuws_48_32-4-1', placedleft: 'fuws_48_32-5-1', help: 'Furniture', tooltip: 'Provides Cozy Buff when lit'},
  // junglecampfire: {name: 'Jungle Campfire', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.LIGHT, stype: 'onoff', cozy: true, sell: 1500, star: 2, image: 'furniture_32_32-9-3', placed: 'fuws_48_32-4-0', placedleft: 'fuws_48_32-5-0', help: 'Furniture', tooltip: 'Provides Cozy Buff when lit'},
  // desertcampfire: {name: 'Desert Campfire', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.LIGHT, stype: 'onoff', cozy: true, sell: 800, star: 3, image: 'furniture_32_32-10-3', placed: 'fuws_48_32-0-1', placedleft: 'fuws_48_32-1-1', help: 'Furniture', tooltip: 'Provides Cozy Buff when lit'},
  // ancientcampfire: {name: 'Ancient Campfire', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.LIGHT, stype: 'onoff', cozy: true, sell: 900, star: 2, image: 'furniture_32_32-11-3', placed: 'fuws_48_32-2-1', placedleft: 'fuws_48_32-3-1', help: 'Furniture', tooltip: 'Provides Cozy Buff when lit'},
  // lizardcampfire: {name: 'Lizard Campfire', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.LIGHT, stype: 'onoff', cozy: true, sell: 3400, star: 3, image: 'furniture_32_32-12-3', placed: 'fuws_48_32-4-1', placedleft: 'fuws_48_32-5-1', help: 'Furniture', tooltip: 'Provides Cozy Buff when lit'},
  // ultracampfire: {name: 'Ultra Bright Campfire', type: ITEM_TYPE.FURNITURE | ITEM_TYPE.LIGHT, stype: 'onoff', cozy: true, sell: 1500, star: 4, image: 'furniture_32_32-13-3', placed: 'fuws_48_32-0-2', placedleft: 'fuws_48_32-1-2', help: 'Furniture', tooltip: 'Provides Cozy Buff when lit'},

  // Trinkets
  clockCopper: {name: 'Copper Clock', type: ITEM_TYPE.TRINKET, stype: 'trinket', star: 2, image: 'furniture_32_32-3-8', help: 'Clocks', tooltip: 'When in Inventory, increases Time accuracy', buff: [{buff: 'displayTimePrecision', value: 1, op: 'max'}]},
  clockSilver: {name: 'Silver Clock', type: ITEM_TYPE.TRINKET, stype: 'trinket', star: 3, image: 'furniture_32_32-3-8', help: 'Clocks', tooltip: 'When in Inventory, increases Time accuracy', buff: [{buff: 'displayTimePrecision', value: 2, op: 'max'}]},
  clockGold: {name: 'Gold Clock', type: ITEM_TYPE.TRINKET, stype: 'trinket', star: 4, image: 'furniture_32_32-3-8', help: 'Clocks', tooltip: 'When in Inventory, increases Time accuracy', buff: [{buff: 'displayTimePrecision', value: 3, op: 'max'}]},
  bottledFrog: {name: 'Bottled Frog', type: ITEM_TYPE.TRINKET, stype: 'trinket', star: 3, image: 'furniture_32_32-3-8', help: 'Bottled Frog', tooltip: 'When in Inventory, give weather forecasts', buff: [{buff: 'displayNextWeather', value: true}]},
  sextant: {name: 'Sextant', type: ITEM_TYPE.TRINKET, stype: 'trinket', star: 3, image: 'furniture_32_32-3-8', help: 'Sextant', tooltip: 'When in Inventory, increases Moon Phases accuracy', buff: [{buff: 'displayMoonDetail', value: true}]},
  ruler: {name: 'Ruler', type: ITEM_TYPE.TRINKET, stype: 'trinket', star: 3, image: 'furniture_32_32-3-8', help: 'Ruler', tooltip: 'When in Inventory, display your position', buff: [{buff: 'displayCoords', value: true}]},
  stopwatch: {name: 'Stopwatch', type: ITEM_TYPE.TRINKET, stype: 'trinket', star: 3, image: 'furniture_32_32-3-8', help: 'Stopwatch', tooltip: 'When in Inventory, display your bonus Speed (percent)', buff: [{buff: 'displaySpeed', value: true}]},

  // Armors ITEM_TYPE.ARMOR, stype: 'tableware', armor: 'head'
  headWood: {name: 'Wood Helmet', type: ITEM_TYPE.ARMOR | ITEM_TYPE.CRAFTING, stype: 'head', armor: 'head', star: 1, image: 'tools_32_32-10-7', placedright: 'heads_26_22-1-0', placedleft: 'heads_26_22-1-1', defense: 1, help: 'Armors', tooltip: 'Provides sturdy protection', set: 'wood'},
  bodyWood: {name: 'Wood Chainmail', type: ITEM_TYPE.ARMOR | ITEM_TYPE.CRAFTING, stype: 'body', armor: 'body', star: 1, image: 'tools_32_32-11-7', placedright: 'bodies_26_18-1-0', placedleft: 'bodies_26_18-1-1', defense: 1, help: 'Armors', tooltip: 'Provides sturdy protection', set: 'wood'},
  footWood: {name: 'Wood Greaves', type: ITEM_TYPE.ARMOR | ITEM_TYPE.CRAFTING, stype: 'foot', armor: 'foot', star: 1, image: 'tools_32_32-12-7', placedright: 'feet_26_12-1-0', placedleft: 'feet_26_12-1-1', defense: 0, help: 'Armors', tooltip: 'Provides sturdy protection', set: 'wood'},

  // Monster drops
  antlionMandible: {name: 'Antlion Mandible', type: 0, stype: 'monster', star: 2, image: 'tools_32_32-12-7', help: 'Antlion Pit', tooltip: 'Component for cutting tools'},

  // Food
  flour: {name: 'Flour', type: 0, stype: 'food', star: 1, image: 'tools_32_32-12-7', help: 'Food', tooltip: 'Component for daw'},
  daw: {name: 'Daw', type: 0, stype: 'food', star: 1, image: 'tools_32_32-12-7', help: 'Food', tooltip: 'To cook for bread and pies'},
  bread: {name: 'Bread', type: ITEM_TYPE.FOOD, stype: 'food', star: 1, image: 'tools_32_32-12-7', help: 'Food', tooltip: 'Restaure health when eated'},
  croissant: {name: 'Croissant', type: ITEM_TYPE.FOOD, stype: 'food', star: 1, image: 'tools_32_32-12-7', help: 'Food', tooltip: 'Restaure health when eated'}
}

/* ============================================================================
   4. RECIPES
   ============================================================================ */

export const RECIPES = [
  // Accessories
  {result: {item: 'triskelAncient', count: 1}, station: 'alchemyTable', ingredients: [{item: 'triskelCopper', count: 1}, {item: 'triskelSilver', count: 1}, {item: 'triskelGold', count: 1}]},

  // Gems
  {result: {item: 'cutTopaz', count: 3}, station: 'stoneBench', ingredients: [{item: 'rawTopaz', count: 1}]},
  {result: {item: 'cutRuby', count: 2}, station: 'stoneBench', ingredients: [{item: 'rawRuby', count: 1}]},
  {result: {item: 'cutEmerald', count: 2}, station: 'stoneBench', ingredients: [{item: 'rawEmerald', count: 1}]},
  {result: {item: 'cutSapphire', count: 1}, station: 'stoneBench', ingredients: [{item: 'rawSapphire', count: 1}]},

  // Crafting Stations
  {result: {item: 'tableWood', count: 1}, station: 'byHand', ingredients: [{item: 'logOak', count: 8}]},
  {result: {item: 'workbench', count: 1}, station: 'tableWood', ingredients: [{item: 'logOak', count: 10}]},
  {result: {item: 'anvil', count: 1}, station: 'workbench', ingredients: [{item: 'barIron', count: 5}, {item: 'logOak', count: 2}]},
  {result: {item: 'sawmill', count: 1}, station: 'workbench', ingredients: [{item: 'barIron', count: 2}, {item: 'chain', count: 1}, {item: 'cutRuby', count: 1}]},
  {result: {item: 'loom', count: 1}, station: 'workbench', ingredients: [{item: 'logOak', count: 12}, {item: 'barIron', count: 2}, {item: 'silk', count: 2}, {item: 'barCopper', count: 1}]},
  {result: {item: 'tanningRack', count: 1}, station: 'loom', ingredients: [{item: 'silk', count: 12}, {item: 'logMahogany', count: 10}, {item: 'barCopper', count: 2}, {item: 'barSilver', count: 2}]},
  {result: {item: 'alchemyTable', count: 1}, station: 'workbench', ingredients: [{item: 'logMahogany', count: 6}, {item: 'logOak', count: 6}, {item: 'barCopper', count: 5}, {item: 'bottle', count: 10}, {item: 'torch', count: 2}, {item: 'sunflowerOil', count: 1}]},
  {result: {item: 'furnace', count: 1}, station: 'workbench', ingredients: [{item: 'blockStone', count: 20}, {item: 'logOak', count: 4}, {item: 'torch', count: 3}]},
  {result: {item: 'blastFurnace', count: 1}, station: 'furnace', ingredients: [{item: 'blockHardstone', count: 50}, {item: 'barCobalt', count: 21}, {item: 'blockLimestone', count: 12}, {item: 'logMahogany', count: 10}, {item: 'torch', count: 9}]},

  {result: {item: 'cookingPot', count: 1}, station: 'anvil', ingredients: [{item: 'barCopper', count: 2}, {item: 'barIron', count: 8}, {item: 'logOak', count: 4}, {item: 'torch', count: 2}]},
  {result: {item: 'forge', count: 1}, station: 'anvil', ingredients: [{item: 'barCobalt', count: 12}, {item: 'barIron', count: 6}, {item: 'logMahogany', count: 4}, {item: 'leather', count: 2}]},
  {result: {item: 'stoneBench', count: 1}, station: 'anvil', ingredients: [{item: 'blockSandstone', count: 12}, {item: 'blockAsh', count: 8}, {item: 'barIron', count: 8}, {item: 'logMahogany', count: 6}, {item: 'shell', count: 3}]},

  // containers
  {result: {item: 'glass', count: 1}, station: 'furnace', ingredients: [{item: 'blockSand', count: 2}]},
  {result: {item: 'bottle', count: 2}, station: 'furnace', ingredients: [{item: 'glass', count: 1}]},
  {result: {item: 'bucket', count: 2}, station: 'furnace', ingredients: [{item: 'logOak', count: 1}, {item: 'barCopper', count: 1}]},

  // torches
  {result: {item: 'torch', count: 3}, station: 'byHand', ingredients: [{item: 'gel', count: 1}, {item: 'logOak', count: 1}]},

  // {output: 'coraltorch', station: 'byhand', recipe: [{item: 'gel', count: 1}, {item: 'coral', count: 1}], built: 3},
  // {output: 'jungletorch', station: 'byhand', recipe: [{item: 'gel', count: 1}, {item: 'mahogany', count: 1}], built: 3},
  // {output: 'ancienttorch', station: 'byhand', recipe: [{item: 'gel', count: 1}, {item: 'bkhive', count: 1}], built: 3},
  // {output: 'deserttorch', station: 'byhand', recipe: [{item: 'gel', count: 1}, {item: 'sandstone', count: 1}], built: 3},
  // {output: 'lizardtorch', station: 'byhand', recipe: [{item: 'gel', count: 1}, {item: 'emerald', count: 1}], built: 3},
  // {output: 'ultratorch', station: 'byhand', recipe: [{item: 'gel', count: 1}, {item: 'marble', count: 1}], built: 3},

  // bars
  {result: {item: 'barCopper', count: 1}, station: 'furnace', ingredients: [{item: 'chunkCopper', count: 3}, {item: 'logOak', count: 1}]},
  {result: {item: 'barIron', count: 1}, station: 'furnace', ingredients: [{item: 'chunkIron', count: 3}, {item: 'logOak', count: 1}]},
  {result: {item: 'barSilver', count: 1}, station: 'furnace', ingredients: [{item: 'chunkSilver', count: 4}, {item: 'logMahogany', count: 1}]},
  {result: {item: 'barGold', count: 1}, station: 'furnace', ingredients: [{item: 'chunkGold', count: 4}, {item: 'logMahogany', count: 1}]},
  {result: {item: 'barCobalt', count: 1}, station: 'furnace', ingredients: [{item: 'chunkCobalt', count: 5}, {item: 'logOak', count: 1}, {item: 'logMahogany', count: 1}]},
  {result: {item: 'barPlatinum', count: 1}, station: 'blastFurnace', ingredients: [{item: 'chunkPlatinum', count: 5}, {item: 'logOak', count: 1}, {item: 'logMahogany', count: 1}]},
  {result: {item: 'shellPowder', count: 1}, station: 'stoneBench', ingredients: [{item: 'shell', count: 1}]},

  // Metal fittings
  {result: {item: 'nailIron', count: 32}, station: 'anvil', ingredients: [{item: 'barIron', count: 1}]},
  {result: {item: 'nailCobalt', count: 30}, station: 'forge', ingredients: [{item: 'barCobalt', count: 1}]},
  {result: {item: 'rivetCobalt', count: 28}, station: 'forge', ingredients: [{item: 'barCobalt', count: 1}]},
  {result: {item: 'rivetPlatinum', count: 26}, station: 'forge', ingredients: [{item: 'barPlatinum', count: 1}]},
  {result: {item: 'chainCopper', count: 12}, station: 'anvil', ingredients: [{item: 'barCopper', count: 1}]},
  {result: {item: 'chainIron', count: 11}, station: 'anvil', ingredients: [{item: 'barIron', count: 1}]},
  {result: {item: 'chainSilver', count: 10}, station: 'anvil', ingredients: [{item: 'barSilver', count: 1}]},
  {result: {item: 'wireCopper', count: 24}, station: 'anvil', ingredients: [{item: 'barCopper', count: 1}]},
  {result: {item: 'wireCopper', count: 24}, station: 'anvil', ingredients: [{item: 'barCopper', count: 1}]},
  {result: {item: 'wireCopper', count: 24}, station: 'anvil', ingredients: [{item: 'barCopper', count: 1}]},
  {result: {item: 'wireCopper', count: 24}, station: 'anvil', ingredients: [{item: 'barCopper', count: 1}]},
  {result: {item: 'wireIron', count: 22}, station: 'anvil', ingredients: [{item: 'barIron', count: 1}]},
  {result: {item: 'wireGold', count: 20}, station: 'anvil', ingredients: [{item: 'barGold', count: 1}]},
  {result: {item: 'wireCobalt', count: 18}, station: 'forge', ingredients: [{item: 'barCobalt', count: 1}]},

  // Food - Tier 1-3
  {result: {item: 'daw', count: 4}, station: 'byHand', ingredients: [{item: 'flour', count: 1}, {item: 'water', count: 1}], returned: [{item: 'bottle', count: 1}]},
  {result: {item: 'bread', count: 1}, station: 'furnace', ingredients: [{item: 'daw', count: 1}]},
  {result: {item: 'croissant', count: 2}, station: 'furnace', ingredients: [{item: 'daw', count: 1}, {item: 'sunflowerOil', count: 1}]}
  // {output: 'clafoutis', station: 'furnace', recipe: [{item: 'flour', count: 1}, {item: 'milk', count: 1}, {item: 'cherry', count: 1}], bonus: [{item: 'cherryseed', count: 1}], built: 2},
  // {output: 'jelly', station: 'cook', recipe: [{item: 'trawberry', count: 1}, {item: 'gel', count: 2}]},
  // {output: 'trawberrypie', station: 'cook', recipe: [{item: 'flour', count: 1}, {item: 'milk', count: 1}, {item: 'trawberry', count: 1}, {item: 'gel', count: 1}, {item: 'lemon', count: 1}]}
]

/* ============================================================================
   5. PLANTS
   ============================================================================ */

export const PLANT_SYSTEM = {GRASS: 1, TREE: 2, HERB: 3}

export const PLANT_KIND = {
  NATURAL: 1, // tuiles NATURAL (GRASSFOREST, GRASSJUNGLE, GRASSMOSS, GRASSFERN, GRASSMUSHROOM)
  TREE: 2, // arbres (Oak, Mahogany, Giant Mushroom, Coconut)
  MUSHROOM: 3, // champignons (Bolete, Pink Mycenia)
  HERB: 4, // herbes (Coral)
  SPREAD: 5, // tuiles ensemencées (GRASSFOREST, GRASSJUNGLE)
  SEED: 6 // Graines plantées
}

export const PLANT_TYPE = {
  NONE: 0,
  // Trees
  OAK: 11,
  MAHOGANY: 12,
  COCONUT: 13,
  GIANT_MUSHROOM: 14,
  // Surface Herbs
  PARSNIP: 21,
  SUNFLOWER: 22,
  AMBERMIRAGE: 24,
  BLOODMOON: 25,
  // Mini-biome Herbs
  SHADOWFERN: 31,
  CRIMSONFROND: 32,
  GOLDENVEIL: 33,
  MISTFERN: 34,
  VELVETMOSS: 35,
  // Underground Herbs
  MANDRAKE: 41,
  CACTUS: 42,
  BAMBOO: 43,
  OLEANDER: 44,
  // Caverns Herbs
  SATANS_CUBE: 51,
  SNEAKTHORN: 52,
  CURSEDCROWN: 53,
  ABYSSHORN: 54,
  INFERNCAP: 55,
  // Under Sea Herbs
  CORAL_R: 61,
  CORAL_P: 62,
  CORAL_Y: 63,
  CORAL_G: 64,
  // Mushrooms
  BOLETE: 71,
  PINKMYCENIA: 72,
  FROSTCAP: 73,
  DAWNCAP: 74
}

export const PARSNIP_COUNT = 12
export const MANDRAKE_COUNT = 40
export const CACTUS_COUNT = 40
export const BAMBOO_COUNT = 40
export const OLEANDER_COUNT = 100
export const SATANS_CUBE_COUNT = 80
export const SNEAKTHORN_COUNT = 80
export const CURSEDCROWN_COUNT = 80
export const ABYSSHORN_COUNT = 80
export const INFERNCAP_COUNT = 60

export const TREE_IMAGES = {
  coconut: [
    ['coconut_64_48-0-0', 'coconut_64_48-0-1', 'coconut_64_48-0-2'],
    ['coconut_64_48-0-3', 'coconut_64_48-0-4', 'coconut_64_48-0-5'],
    ['coconut_64_48-1-0', 'coconut_64_48-1-1'],
    ['coconut_64_48-1-2', 'coconut_64_48-1-3', 'coconut_64_48-1-4'],
    ['coconut_64_48-1-5', 'coconut_64_48-2-0', 'coconut_64_48-2-1', 'coconut_64_48-2-2']
  ],
  oak: [
    ['oak_80_48-0-0', 'oak_80_48-0-1', 'oak_80_48-0-2'],
    ['oak_80_48-0-3', 'oak_80_48-0-4', 'oak_80_48-0-5'],
    ['oak_80_48-1-0', 'oak_80_48-1-1'],
    ['oak_80_48-1-2', 'oak_80_48-1-3', 'oak_80_48-1-4'],
    ['oak_80_48-1-5', 'oak_80_48-2-0', 'oak_80_48-2-1', 'oak_80_48-2-2'],
    ['oak_80_48-1-5', 'oak_80_48-2-0', 'oak_80_48-2-1', 'oak_80_48-2-2'],
    ['oak_80_48-1-5', 'oak_80_48-2-0', 'oak_80_48-2-1', 'oak_80_48-2-2']
  ],
  mahogany: [
    ['mahogany_80_48-0-0', 'mahogany_80_48-0-1', 'mahogany_80_48-0-2'],
    ['mahogany_80_48-0-3', 'mahogany_80_48-0-4', 'mahogany_80_48-0-5'],
    ['mahogany_80_48-1-0', 'mahogany_80_48-1-1'],
    ['mahogany_80_48-1-2', 'mahogany_80_48-1-3', 'mahogany_80_48-1-4'],
    ['mahogany_80_48-1-5', 'mahogany_80_48-2-0', 'mahogany_80_48-2-1', 'mahogany_80_48-2-2'],
    ['mahogany_80_48-1-5', 'mahogany_80_48-2-0', 'mahogany_80_48-2-1', 'mahogany_80_48-2-2'],
    ['mahogany_80_48-1-5', 'mahogany_80_48-2-0', 'mahogany_80_48-2-1', 'mahogany_80_48-2-2']
  ],
  giantMushroom: [
    ['giantmushroom_64_48-0-0', 'giantmushroom_64_48-0-1', 'giantmushroom_64_48-0-2'],
    ['giantmushroom_64_48-0-3', 'giantmushroom_64_48-0-4', 'giantmushroom_64_48-0-5'],
    ['giantmushroom_64_48-1-0', 'giantmushroom_64_48-1-1'],
    ['giantmushroom_64_48-1-2', 'giantmushroom_64_48-1-3', 'giantmushroom_64_48-1-4'],
    ['giantmushroom_64_48-1-5', 'giantmushroom_64_48-2-0', 'giantmushroom_64_48-2-1', 'giantmushroom_64_48-2-2']
  ]
}

/* ============================================================================
   6. MONSTERS
   ============================================================================ */

export const MONSTERS = {

}

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
export const TRINKET_BUFF_TABLE = {}
for (const key in ITEMS) {
  const itemDesc = ITEMS[key]

  itemDesc.code = key // Injection du code dans chaque item (la clé devient ITEMS.worm.code)
  // vérification de la présence des attributs obligatoires
  for (const field of REQUIRED_ITEM_FIELDS) {
    if (itemDesc[field] === undefined) {
      console.error(`[data.mjs] ITEMS.${key} : champ obligatoire manquant : '${field}'`)
    }
  }
  const PLACABLE_FURNITURE = ITEM_TYPE.FURNITURE | ITEM_TYPE.PLACABLE
  if ((itemDesc.type & PLACABLE_FURNITURE) === PLACABLE_FURNITURE && !itemDesc.placed && !itemDesc.placedLeft) {
    console.error(`[data.mjs] ITEMS.${key} : FURNITURE sans attribut 'placed' ni 'placedLeft'`)
  }
  // post traitement des buffs
  if ((itemDesc.type & ITEM_TYPE.TRINKET) && itemDesc.buff) {
    for (const {buff, op} of itemDesc.buff) {
      const resolvedOp = op ?? ''
      if (buff in TRINKET_BUFF_TABLE) {
        if (TRINKET_BUFF_TABLE[buff] !== resolvedOp) {
          console.error(`[data.mjs] ITEMS.${key} : op mismatch pour le buff '${buff}' (attendu '${TRINKET_BUFF_TABLE[buff]}', trouvé '${resolvedOp}')`)
        }
      } else {
        TRINKET_BUFF_TABLE[buff] = resolvedOp
      }
    }
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
for (const key in RECIPES) {
  const recipe = RECIPES[key]
  // result
  ITEMS[recipe.result.item].type |= ITEM_TYPE.CRAFTABLE
  recipe.result.item = ITEMS[recipe.result.item]
  // ingredients
  for (const ing of recipe.ingredients) {
    ITEMS[ing.item].type |= ITEM_TYPE.MATERIAL
    ing.item = ITEMS[ing.item]
  }
  // crafting station
  recipe.station = ITEMS[recipe.station]
  // vérification de l'équivalence en star
  let maxIngStar = 0
  for (const ing of recipe.ingredients) {
    if (ing.item.star > maxIngStar) maxIngStar = ing.item.star
  }
  if (maxIngStar !== recipe.result.item.star) {
    console.error(`[data.mjs] RECIPES '${recipe.result.item.name}' : star mismatch — max ingredient star=${maxIngStar}, result star=${recipe.result.item.star}`)
  }
  // returned (optionnel)
  if (recipe.returned) {
    for (const ret of recipe.returned) {
      if (!ITEMS[ret.item]) {
        console.error(`[data.mjs] RECIPES '${recipe.result.item.name}' : returned item inconnu '${ret.item}'`)
      } else {
        ret.item = ITEMS[ret.item]
      }
    }
  }
}

// — 8.6. Résolution MONSTERS

// — 8.7. Validations transverses  ────────────────────

// obligatoirement après l'ajout des types MATERIAL et CRAFTABLE
for (const key in ITEMS) {
  const itemDesc = ITEMS[key]
  const stars = '★'.repeat(Math.min(5, Math.max(0, itemDesc.star ?? 0)))
  itemDesc.hoverTitle = `${itemDesc.name}\nTier: ${stars}\n${itemDesc.tooltip}\nType: ${itemTypeToString(itemDesc.type, itemDesc.armor)}`
}

// obligatoirement après l'ajout des 'code' dans ITEMS et MONSTERS
{
  const allCodes = new Set()
  for (const key in NODES) {
    const {code} = NODES[key]
    if (allCodes.has(code)) console.error(`[data.mjs] code node dupliqué : ${code} (NODES.${key})`)
    allCodes.add(code)
  }
  for (const key in ITEMS) {
    const {code} = ITEMS[key]
    if (allCodes.has(code)) console.error(`[data.mjs] code item dupliqué : '${code}' (ITEMS.${key})`)
    allCodes.add(code)
  }
  for (const key in MONSTERS) {
    const {code} = MONSTERS[key]
    if (allCodes.has(code)) console.error(`[data.mjs] code monster dupliqué : '${code}' (MONSTERS.${key})`)
    allCodes.add(code)
  }
}

// — 9.x. Détection des cycles dans la chaîne de craft ────────────────────

const _recipeByResult = new Map()
for (const recipe of RECIPES) {
  _recipeByResult.set(recipe.result.item.code, recipe)
}

const _verified = new Set() // items confirmés sans cycle

const _checkCycle = (code, path) => {
  if (_verified.has(code)) return false // déjà validé — court-circuit

  if (path.has(code)) {
    console.error(`[data.mjs] RECIPES : cycle détecté : ${[...path, code].join(' → ')}`)
    return true
  }

  const recipe = _recipeByResult.get(code)
  if (!recipe) { // item non craftable — feuille du graphe
    _verified.add(code)
    return false
  }

  path.add(code)
  let hasCycle = false
  for (const ing of recipe.ingredients) {
    if (_checkCycle(ing.item.code, path)) hasCycle = true
  }
  path.delete(code)

  if (!hasCycle) _verified.add(code)
  return hasCycle
}

for (const recipe of RECIPES) {
  _checkCycle(recipe.result.item.code, new Set())
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

// ─── §10. LISTES DÉRIVÉES POUR LES OVERLAYS ──────────────────────────────

const _allDisplayTypes = []
for (const mask of Object.values(ITEM_TYPE)) {
  if (mask === 0) continue
  const label = itemTypeToString(mask)
  if (label) _allDisplayTypes.push({label, mask})
}

// Types qui combinent avec stype, et leur préfixe court
const STYPE_SUBDIVIDED = new Map([
  [ITEM_TYPE.MATERIAL, 'Material'],
  [ITEM_TYPE.FURNITURE, 'Furniture']
])

const _allFilterLabels = new Set() // ← avant la boucle

for (const recipe of RECIPES) {
  const item = recipe.result.item
  const labels = new Set()

  for (const {label, mask} of _allDisplayTypes) {
    if (!(item.type & mask)) continue
    const prefix = STYPE_SUBDIVIDED.get(mask)
    const computed = (prefix && item.stype) ? `${prefix} - ${capitalize(item.stype)}` : label
    labels.add(computed)
    _allFilterLabels.add(computed)
  }

  item.craftFilterLabels = labels
}

export const CRAFT_RESULT_TYPES = [..._allFilterLabels].sort()

// let _resultTypeBits = 0
const _stationSet = new Set()
const _ingredientSet = new Set()

for (const key in RECIPES) {
  const recipe = RECIPES[key]
  // _resultTypeBits |= recipe.result.item.type
  _stationSet.add(recipe.station)
  for (const ing of recipe.ingredients) {
    _ingredientSet.add(ing.item)
  }
}

// export const CRAFT_RESULT_TYPES = _allDisplayTypes.filter(({mask}) => _resultTypeBits & mask)
export const CRAFT_STATIONS = [..._stationSet].sort((a, b) => a.name.localeCompare(b.name))
export const CRAFT_INGREDIENTS = [..._ingredientSet].sort((a, b) => a.name.localeCompare(b.name))

console.log('...<<<<>>>>>....', {CRAFT_RESULT_TYPES, CRAFT_STATIONS, CRAFT_INGREDIENTS})
