// data-achievement.mjs

export const ACHIEVEMENT_CATEGORIES = [
  {
    id: 'crafting-bars',
    label: 'Crafting — Bars',
    thresholds: [1, 10, 50],
    items: ['barCopper', 'barIron', 'barSilver', 'barGold', 'barCobalt', 'barPlatinum']
  },
  {
    id: 'mining-ore',
    label: 'Mining — Ores',
    thresholds: [5, 50, 200],
    items: ['chunkCopper', 'chunkIron', 'chunkSilver', 'chunkGold', 'chunkCobalt', 'chunkPlatinum']
  }
]
