// data-achievement.mjs

export const ACHIEVEMENT_CATEGORIES = [
  {
    id: 'crafting-bars',
    label: 'Crafting — Bars',
    thresholds: [1, 10, 50],
    items: ['barCopper', 'barIron', 'barSilver', 'barGold', 'barCobalt', 'barPlatinum']
  },
  {
    id: 'crafting-fit-fast',
    label: 'Crafting — Metal Fittings - Fasteners',
    thresholds: [24, 120, 360],
    items: ['nailIron', 'nailCobalt', 'rivetCobalt', 'rivetPlatinum', 'chainCopper', 'chainIron', 'chainSilver', 'chainPlatinum', 'wireCopper', 'wireIron', 'wireGold', 'wireCobalt']
  },
  {
    id: 'crafting-fit-part',
    label: 'Crafting — Metal Fittings - Parts',
    thresholds: [24, 120, 360],
    items: ['plateCopper', 'plateIron', 'plateIron', 'plateGold', 'plateCobalt', 'platePlatinum']
  },
  {
    id: 'crafting-gem',
    label: 'Crafting — Gems',
    thresholds: [10, 80, 160],
    items: ['cutTopaz', 'cutRuby', 'cutEmerald', 'cutSapphire']
  },
  {
    id: 'crafting-trinket-env',
    label: 'Crafting — Trinkets - Environment',
    thresholds: [1, 1, 1],
    items: ['clockCopper', 'clockSilver', 'clockGold', 'bottledFrog', 'sextant', 'ruler', 'stopwatch', 'astrolabe', 'chronometer', 'astrarium']
  },
  {
    id: 'crafting-trinket-surv',
    label: 'Crafting — Trinkets - Surveyor',
    thresholds: [1, 1, 1],
    items: ['setSquare', 'slidingBevel', 'draftingCompass', 'theodolite']
  },
  {
    id: 'crafting-pickaxe',
    label: 'Crafting — Pickaxes',
    thresholds: [1, 1, 1],
    items: ['pickaxeCopper', 'pickaxeIron', 'pickaxeSilver', 'pickaxeGold', 'pickaxeCobalt', 'pickaxePlatinum', 'pickaxeProspector', 'pickaxeGeologist', 'pickaxeBone']
  },
  {
    id: 'mining-ore',
    label: 'Mining — Ores',
    thresholds: [5, 50, 200],
    items: ['chunkCopper', 'chunkIron', 'chunkSilver', 'chunkGold', 'chunkCobalt', 'chunkPlatinum']
  },
  {
    id: 'mining-gem',
    label: 'Mining — Gems',
    thresholds: [4, 40, 80],
    items: ['rawTopaz', 'rawRuby', 'rawEmerald', 'rawSapphire']
  }
]
