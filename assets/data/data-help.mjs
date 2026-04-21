/**
 * @file data-help.mjs
 * @description Aide en ligne du jeu Sixty-Below.
 * Contenu rédigé en Markdown enrichi — voir syntaxe ci-dessous.
 *
 * ═══════════════════════════════════════════════════════════════
 * SYNTAXE
 * ═══════════════════════════════════════════════════════════════
 *
 * ── Markdown standard ───────────────────────────────────────────
 *   **gras**         _italique_        __souligné__
 *   * puce niveau 1
 *     * puce niveau 2
 *   | col1 | col2 |  (table)
 *   | ---- | ---- |
 *
 * ── Liens inter-fiches ──────────────────────────────────────────
 *   [[node:code]]                → nom du noeud + lien vers sa fiche
 *   [[item:code]]                → nom de l'item + lien vers sa fiche
 *   [[helpTopic]]                → titre de la fiche d'aide + lien vers sa fiche
 *   [[node:code|texte affiché]]   → lien avec texte personnalisé
 *   [[item:code|texte affiché]]   → lien avec texte personnalisé
 *   [[helpTopic|texte affiché]]   → lien avec texte personnalisé
 *   (pas de lien si la fiche courante est celle du lien)
 *
 * ── Données dynamiques ──────────────────────────────────────────
 *   {{node:code:star}}  → affiche le tier de NODES.code (⭐☆☆☆☆)
 *   {{item:code:star}}  → affiche le tier de ITEMS.code (⭐☆☆☆☆)
 *   {{item:code}}       → affiche les infos de ITEMS.code
 *   {{node:code}}       → affiche les infos de NODES.code
 *   {{recipe:code}}     → affiche la recette de RECIPES[code]
 *   {{table:type:TOOL}} → affiche une table de tous les items du type donné
 *
 * ── Templates ───────────────────────────────────────────────────
 *   <<templateName|param1|param2>>   → inclusion d'un template
 *   Dans le template : {1}, {2}...   → placeholders des paramètres
 *   (un seul niveau d'inclusion — pas de template dans un template)
 *
 * ═══════════════════════════════════════════════════════════════
 * CARACTÈRES SPÉCIAUX  (copier/coller depuis ici)
 * ═══════════════════════════════════════════════════════════════
 *
 *   ⭐  nombre de star (tier) de l'entité
 *   ☆  nombre de star (tier) de l'entité
*
 *   ⏳  Feature non encore implémentée
 *       → Tant qu'il en reste dans le fichier, l'application n'est pas terminée.
 *
 *   ⚠️  Erreur d'hydratation (référence inconnue dans ITEMS/NODES/RECIPES)
 *       → Injecté automatiquement par le moteur à la place du code invalide.
 *       → Tolérance : la fiche s'affiche malgré l'erreur, avec le code et ⚠️ visible.
 *
 * ═══════════════════════════════════════════════════════════════
 */

/* ====================================================================================================
   TEMPLATES
   ==================================================================================================== */

const HELP_TEMPLATES = {
  miningInfo: `
**How to mine**
Use a [[{1}||Pickaxe]] of at least ⭐{2} to mine [[node:{3}]].
Mining drops: {{node:{3}:mining}}
  `,

  statTable: `
| Name | ⭐ | Speed | Sell |
| ---- | -- | ----- | ---- |
{{table:stype:{1}}}
  `
}

/* ====================================================================================================
   FICHES D'AIDE
   ==================================================================================================== */

export const HELP = [
  {
    title: 'Copper Ore',
    category: ['Mining', 'Ore'],
    content: `
**Description**
Copper is the most common ore found near the [[Surface||Surface layer]].
It is used in many early-game [[Crafting||recipes]].

**Main Location**
* All biomes
* Layer: [[Underground]], [[Surface]]

**Mining**
<<miningInfo|copperPickaxe|1|copper>>

**Drops**
{{node:copper:mining}}

**Recipes using Copper**
{{recipe:copperBar}}
{{recipe:copperSword}} ⏳

**All Pickaxes**
<<statTable|pickaxe>>

**Tips**
* Copper veins are often found near [[node:stone]] clusters.
* _Tip: [[Torches||Bring torches]] when mining underground!_ ⏳
    `
  },
  // ── World ────────────────────────────────────────────
  // ── Layers ────────────────────────────────────────────
  //    Surface, Underground, Caverns
  {
    title: 'Surface',
    category: ['Layer'],
    content: `
**Description**
The Surface is the topmost layer of the world, where the player begins their adventure. It is the most accessible layer, with moderate resources and fauna.

**Main Location**
* From the sky down to the Underground boundary
* Includes several tile-layers below the visible surface line
* Exposed to the day/night cycle and weather ⏳

**Materials**
* [[node:grass]], [[node:dirt]] — Forest
* [[node:sand]], [[node:sandstone]] — Desert
* [[node:jungleGrass]], [[node:silt]] — Jungle

**Resources**
* [[item:copper]], [[item:iron]] — common
* Surface plants and critters ⏳

**Mini-biomes**
* [[Anthill]] — Forest ⏳
* [[Antlion Pit]] — Desert ⏳
* [[Termite Mound]] — Jungle ⏳

**Damage type**
* Piercing

**Tips**
* _The safest layer — ideal for early game exploration._
* _Day/night cycle affects fauna behaviour and spawning._ ⏳
  `
  },
  {
    title: 'Underground',
    category: ['Layer'],
    content: `
**Description**
The Underground layer begins just below the surface. It is darker, more dangerous, and richer in resources than the surface.

**Main Location**
* Below the Surface
* Above the Caverns

**Materials**
* [[node:stone]], [[node:clay]] — Forest
* [[node:sandstone]], [[node:stone]] — Desert
* [[node:mud]], [[node:clay]] — Jungle

**Resources**
* [[item:copper]], [[item:iron]], [[item:silver]] — common
* [[item:topaz]], [[item:ruby]], [[item:emerald]] — rare ⏳

**Mini-biomes**
* [[Fern Cave]] — Forest
* [[Moss Cave]] — Jungle
* [[Sand Pocket]] — Desert
* [[Ruined Cabin]] — Forest ⏳
* [[Pyramid]] — Desert ⏳

**Damage type**
* Slashing

**Tips**
* _Bring a light source — torches are essential here._ ⏳
* _Water puddles and Sap puddles can form in this layer._
  `
  },
  {
    title: 'Caverns',
    category: ['Layer'],
    content: `
**Description**
The Caverns are the deepest accessible layer, divided into two sub-layers : Caverns Top and Caverns Bottom. This is where the rarest resources and most dangerous fauna are found.

**Main Location**
* Below the Underground
* Above Hell

**Sub-layers**
* _Caverns Top_ — upper half, more accessible
* _Caverns Bottom_ — lower half, more dangerous

**Materials**
* [[node:hardstone]], [[node:slate]] — all biomes
* [[node:hellstone]] — Jungle, rare in other biomes

**Resources**
* [[item:gold]], [[item:cobalt]], [[item:platinum]] — rare to very rare
* [[item:sapphire]], [[item:emerald]] — very rare
* [[node:granite]], [[node:marble]] — Geode Caves

**Mini-biomes**
* [[Mushroom Cave]] — Forest, Caverns Top
* [[Hive]] — Jungle, Caverns Top
* [[Fossil Vein]] — Desert, Caverns Top
* [[Cobweb Cave]] — all biomes
* [[Geode Cave]] — all biomes, Caverns Bottom
* [[Blind Lake]] — all biomes, Caverns Bottom
* [[Sap Pocket]] — Jungle, Caverns Bottom
* [[Ancient House]] — Desert, Caverns Bottom ⏳
* [[Temple Ruin]] — Jungle, Caverns Top ⏳

**Damage type**
* Crushing

**Tips**
* _Caverns Bottom is extremely dangerous — prepare well before venturing here._
* _Blind Lakes contain rare fish species found nowhere else._ ⏳
  `
  },
  // ── Biomes ───────────────────────────────────────────────────
  //    Forest, Desert, Jungle
  {
    title: 'Forest',
    category: ['Biome'],
    content: `
**Description**
The Forest is the starting biome, located at the center of the world. It is the most balanced biome, with moderate resources and fauna. The player always spawns here.

**Main Location**
* The world always contains at least one Forest zone, at the center — the player spawns here.
* Additional Forest zones may appear elsewhere in the world.
* Layer: all layers

**Materials**
* Surface: [[node:dirt]], [[node:grass]]
* Underground: [[node:stone]], [[node:clay]]
* Caverns: [[node:hardstone]], [[node:slate]]

**Resources**
* Ores: [[item:copper]], [[item:iron]], [[item:silver]], [[item:topaz]]
* Topsoil: [[node:dirt]], [[node:humus]]

**Mini-biomes**
* [[Fern Cave]] — Underground
* [[Mushroom Cave]] — Caverns
* [[Ruined Cabin]] — Underground ⏳
* [[Anthill]] — Surface ⏳
* [[Underground Lake]] — Caverns

**Fauna** ⏳
* [[monster:beetle]], [[monster:greenSlime]], [[monster:blueSlime]]
* [[monster:bat]], [[monster:caveWorm]] — Underground
  `
  },
  {
    title: 'Desert',
    category: ['Biome'],
    content: `
**Description**
The Desert biome is characterized by its sandy terrain and arid atmosphere. It contains unique geological formations and ancient ruins. One of the two non-starting biomes.

**Main Location**
* One or more Desert zones, distributed across the world.
* Layer: all layers

**Materials**
* Surface: [[node:sand]], [[node:sandstone]]
* Underground: [[node:sandstone]], [[node:stone]]
* Caverns: [[node:hardstone]], [[node:slate]]

**Resources**
* Ores: [[item:copper]], [[item:iron]], [[item:gold]], [[item:ruby]]
* Topsoil: [[node:sand]], [[node:silt]]

**Mini-biomes**
* [[Antlion Pit]] — Surface ⏳
* [[Sand Pocket]] — Underground
* [[Fossil Vein]] — Caverns
* [[Pyramid]] — Underground ⏳
* [[Ancient House]] — Caverns deep ⏳

**Fauna** ⏳
* [[monster:scorpion]], [[monster:sandSnake]] — Surface
* [[monster:bat]], [[monster:caveWorm]] — Underground

**Tips**
* _Sand falls when unsupported — be careful when mining near Sand Pockets._
  `
  },
  {
    title: 'Jungle',
    category: ['Biome'],
    content: `
**Description**
The Jungle is a lush, dangerous biome teeming with life. It features unique liquid resources (Sap) and the most complex mini-biome ecosystem in the game.

**Main Location**
* One or more Jungle zones, distributed across the world.
* Layer: all layers

**Materials**
* Surface: [[node:silt]], [[node:jungleGrass]]
* Underground: [[node:mud]], [[node:clay]]
* Caverns: [[node:hardstone]], [[node:hellstone]]

**Resources**
* Ores: [[item:copper]], [[item:iron]], [[item:cobalt]], [[item:emerald]]
* Topsoil: [[node:silt]], [[node:humus]]
* Liquid: [[node:sap]] — found in Sap Lakes and Sap Pockets

**Mini-biomes**
* [[Termite Mound]] — Surface ⏳
* [[Moss Cave]] — Underground
* [[Hive]] — Caverns
* [[Sap Pocket]] — Caverns deep
* [[Temple Ruin]] — Caverns ⏳

**Fauna** ⏳
* [[monster:jungleSpider]] — Surface
* [[monster:bat]], [[monster:caveWorm]] — Underground
* [[monster:bee]], [[monster:hornet]] — Hive

**Tips**
* _Sap is a rare and valuable liquid — bring containers when exploring Sap Pockets._ ⏳
  `
  },
  // ── Mini-biomes / Forest ──────────────────────────────────────
  //    Fern Cave, Mushroom Cave, Ruined Cabin, Anthill, Underground Lake
  {
    title: 'Fern Cave',
    category: ['Mini-biome', 'Forest'],
    content: `
**Description**
A large underground cave found in [[Forest]] biomes, characterized by giant ferns growing on its flat floor.

**Main Location**
* Biome: [[Forest]]
* Layer: [[Underground]]

**Floor**
* [[node:grassFern]] — surface layer
* [[node:humus]] — 2-3 tiles deep

**Inhabitants** ⏳
* [[monster:dendrobate]]
* [[monster:mamba]]
  `
  },
  // ── Mini-biomes / Desert ─────────────────────────────────────
  //    Sand Pocket, Fossil Vein, Pyramid, Antlion Pit, Ancient House
  // ── Mini-biomes / Jungle ─────────────────────────────────────
  //    Moss Cave, Hive, Sap Pocket, Temple Ruin, Termite Mound
  {
    title: 'Moss Cave',
    category: ['Mini-biome', 'Jungle'],
    content: `
**Description**
A large underground cave found in [[Jungle]] biomes. Its walls are covered in luminous moss, creating a soft green glow. The air is humid and rich in spores.

**Main Location**
* Biome: [[Jungle]]
* Layer: [[Underground]]

**Materials**
* [[node:grassMoss]] — floor and lateral walls
* [[node:mud]] — substrate beneath the moss floor

**Inhabitants** ⏳
* Passive fauna only — rare encounters

**Loot** ⏳
* Rare vegetal drops from the moss walls

**Tips**
* _The luminous moss makes this cave one of the few underground areas that doesn't require a light source._ ⏳
* Moss grows on the floor and lateral walls, but not on the ceiling.
  `
  },
  // ── Mini-biomes / Transversal ────────────────────────────────
  //    Sea, Cobweb Cave, Geode Cave, Blind Lake, Underground Lake

  // ── Ores ─────────────────────────────────────────────────────
  {
    title: 'Copper',
    category: ['Ore', 'Mining'],
    content: `
**Description**
Copper is the most common ore in the world. It is the first metal the player will encounter and is essential for early-game crafting.

**Tier**
{{node:copper:star}}

**Main Location**
* [[Surface]] — all biomes, moderate density
* [[Underground]] — all biomes, high density
* [[Caverns]] Top — all biomes, moderate density

**Drops** ⏳
* {{node:copper:mining}}

**Recipes** ⏳
* {{recipe:copperBar}}
  `
  },
  {
    title: 'Iron',
    category: ['Ore', 'Mining'],
    content: `
**Description**
Iron is a common ore found from the Underground layer downwards. It is the second metal tier and is required for most basic tools and weapons.

**Tier**
{{node:iron:star}}

**Main Location**
* [[Underground]] — all biomes, moderate density
* [[Caverns]] Top — all biomes, moderate density

**Drops** ⏳
* {{node:iron:mining}}

**Recipes** ⏳
* {{recipe:ironBar}}
  `
  },
  {
    title: 'Silver',
    category: ['Ore', 'Mining'],
    content: `
**Description**
Silver is an uncommon ore found in the Underground and Caverns. It is rarer in [[Forest]] biomes.

**Tier**
{{node:silver:star}}

**Main Location**
* [[Caverns]] Top — all biomes, moderate density
* [[Caverns]] Bottom — all biomes, small density
* Rarer in [[Forest]].

**Drops** ⏳
* {{node:silver:mining}}

**Recipes** ⏳
* {{recipe:silverBar}}
  `
  },
  {
    title: 'Gold',
    category: ['Ore', 'Mining'],
    content: `
**Description**
Gold is a rare ore found in the Caverns. It is rarer in [[Desert]] biomes.

**Tier**
{{node:gold:star}}

**Main Location**
* [[Caverns]] Top — all biomes, moderate density
* [[Caverns]] Bottom — all biomes, small density
* Rarer in [[Desert]].

**Drops** ⏳
* {{node:gold:mining}}

**Recipes** ⏳
* {{recipe:goldBar}}
  `
  },
  {
    title: 'Cobalt',
    category: ['Ore', 'Mining'],
    content: `
**Description**
Cobalt is a rare ore found deep in the Caverns. It is rarer in [[Jungle]] biomes.

**Tier**
{{node:platinum:star}}

**Main Location**
* [[Caverns]] Top — all biomes, small density
* [[Caverns]] Bottom — all biomes, moderate density
* Rarer in [[Jungle]].


**Drops** ⏳
* {{node:cobalt:mining}}

**Recipes** ⏳
* {{recipe:cobaltBar}}
  `
  },
  {
    title: 'Platinum',
    category: ['Ore', 'Mining'],
    content: `
**Description**
Platinum is the rarest metal ore in the world. It is found exclusively in the deepest part of the Caverns.

**Main Location**
* [[Caverns]] Bottom — all biomes, moderate density

**Drops** ⏳
* {{node:platinum:mining}}

**Recipes** ⏳
* {{recipe:platinumBar}}
  `
  },
  // ── Gems ─────────────────────────────────────────────────────
  //    Topaz, Ruby, Emerald, Sapphire
  {
    title: 'Topaz',
    category: ['Gem', 'Mining'],
    content: `
**Description**
Topaz is the most common gemstone, found in [[Forest]] biomes. Its warm golden hue makes it a sought-after crafting material.

**Tier**
{{node:topaz:star}}

**Main Location**
* Biome: [[Forest]]
* [[Caverns]] Top — moderate density
* [[Caverns]] Bottom — small density

**Drops** ⏳
* {{node:topaz:mining}}

**Recipes** ⏳
* {{recipe:topaz}}
  `
  },
  {
    title: 'Ruby',
    category: ['Gem', 'Mining'],
    content: `
**Description**
Ruby is an uncommon gemstone found in [[Desert]] biomes. Its deep red color is associated with fire and heat.

**Tier**
{{node:ruby:star}}

**Main Location**
* Biome: [[Desert]]
* [[Caverns]] Top — moderate density
* [[Caverns]] Bottom — small density

**Drops** ⏳
* {{node:ruby:mining}}

**Recipes** ⏳
* {{recipe:ruby}}
  `
  },
  {
    title: 'Emerald',
    category: ['Gem', 'Mining'],
    content: `
**Description**
Emerald is a rare gemstone found in [[Jungle]] biomes. Its vivid green reflects the lush environment it comes from.

**Tier**
{{node:emerald:star}}

**Main Location**
* Biome: [[Jungle]]
* [[Caverns]] Top — moderate density
* [[Caverns]] Bottom — small density

**Drops** ⏳
* {{node:emerald:mining}}

**Recipes** ⏳
* {{recipe:emerald}}
  `
  },
  {
    title: 'Sapphire',
    category: ['Gem', 'Mining'],
    content: `
**Description**
Sapphire is the rarest gemstone, found in the deepest parts of all biomes. Its brilliant blue glow is visible even in complete darkness.

**Tier**
{{node:sapphire:star}}

**Main Location**
* Biome: all biomes
* [[Caverns]] Bottom — small density

**Drops** ⏳
* {{node:sapphire:mining}}

**Recipes** ⏳
* {{recipe:sapphire}}
  `
  },
  // ── Rocks ────────────────────────────────────────────────────
  //    Granite, Marble, Obsidian, Meteorite, Hive, Shell
  {
    title: 'Granite',
    category: ['Rock', 'Mining'],
    content: `
**Description**
Granite is a hard igneous rock found exclusively inside [[Geode Cave]]s. Its pink-grey crystalline structure makes it a distinctive building material.

**Tier**
{{node:granite:star}}

**Main Location**
* [[Geode Cave]] walls — all biomes, [[Caverns]] Bottom

**Drops** ⏳
* {{node:granite:mining}}

**Recipes** ⏳
* {{recipe:graniteBlock}}
  `
  },
  {
    title: 'Marble',
    category: ['Rock', 'Mining'],
    content: `
**Description**
Marble is a metamorphic rock found exclusively inside [[Geode Cave]]s. Its smooth white surface makes it a prized building material.

**Tier**
{{node:marble:star}}

**Main Location**
* [[Geode Cave]] walls — all biomes, [[Caverns]] Bottom

**Drops** ⏳
* {{node:marble:mining}}

**Recipes** ⏳
* {{recipe:marbleBlock}}
  `
  },
  {
    title: 'Obsidian',
    category: ['Rock', 'Mining'],
    content: `
**Description**
Obsidian is a volcanic glass formed where lava meets water. It is one of the hardest materials in the world, requiring high-tier tools to mine.

**Tier**
{{node:obsidian:star}}

**Main Location**
* [[Caverns]] — all biomes, rare clusters

**Drops** ⏳
* {{node:obsidian:mining}}

**Recipes** ⏳
* {{recipe:obsidianBlock}}
  `
  },
  {
    title: 'Meteorite',
    category: ['Rock', 'Mining'],
    content: `
**Description**
Meteorite is an extraterrestrial rock that falls from the sky in rare events. It glows faintly and has unique properties not found in any other material.

**Tier**
{{node:meteorite:star}}

**Main Location**
* Impact craters on the [[Surface]] — random events ⏳
* Rare clusters near impact sites ⏳

**Drops** ⏳
* {{node:meteorite:mining}}

**Recipes** ⏳
* {{recipe:meteoriteBar}}
  `
  },
  {
    title: 'Hive',
    category: ['Rock', 'Mining'],
    content: `
**Description**
Hive is a biological material that forms the walls of [[Hive]] mini-biomes. It is secreted by bees and has a distinctive honeycomb structure.

**Tier**
{{node:hive:star}}

**Main Location**
* [[Hive]] walls — [[Jungle]], [[Caverns]] Top

**Drops** ⏳
* {{node:hive:mining}}

**Recipes** ⏳
* {{recipe:hiveBlock}}

**Tips**
* _Destroying Hive blocks will anger the inhabitants._ ⏳
  `
  },
  {
    title: 'Shell',
    category: ['Rock', 'Mining'],
    content: `
**Description**
Shell is a sedimentary material formed from ancient marine organisms. It is found in [[Fossil Vein]]s and along the shores of the [[Sea]].

**Tier**
{{node:shell:star}}

**Main Location**
* [[Fossil Vein]] — [[Desert]], [[Caverns]] Top
* [[Sea]] borders and floor — slow regeneration ⏳

**Drops** ⏳
* {{node:shell:mining}}

**Recipes** ⏳
* {{recipe:shellPowder}}

**Tips**
* _Shell veins are protected by a SANDSTONE border — look for exposed Shell on cave walls to locate a vein._⏳
  `

  // ── Accessories ──────────────────────────────────────────────
  // ── Items & Crafting ─────────────────────────────────────────
  // ── Fauna & Critters ─────────────────────────────────────────
  // ── Buffs & Debuffs ──────────────────────────────────────────
  // ── Mechanics ────────────────────────────────────────────────
  }
]

/* ====================================================================================================
   POST-TRAITEMENTS
   ==================================================================================================== */

// Remplacement textuel des <<...>> par le template correspondant.
// ⚠️ est injecté si le template ou un paramètre est manquant.
const expandTemplates = (content) =>
  content.replace(/<<(\w+)\|?([^>]*)>>/g, (_, name, params) => {
    const template = HELP_TEMPLATES[name]
    if (!template) return `⚠️ template inconnu: ${name}`
    const args = params ? params.split('|') : []
    return template.replace(/\{(\d+)\}/g, (_, i) => args[parseInt(i) - 1] ?? `⚠️ param {${i}} manquant`)
  })

// Expansion au chargement
for (const entry of HELP) {
  entry.content = expandTemplates(entry.content)
}

console.log('HELP', HELP)
