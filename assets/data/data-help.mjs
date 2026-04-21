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

**Location**
* Layer: [[node:surface]] and [[node:under]] ⏳
  * More common near the surface
  * Rarely found in [[node:caverns]]

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
  // ── Biomes ───────────────────────────────────────────────────
  //    Forest, Desert, Jungle
  {
    title: 'Forest',
    category: ['Biome'],
    content: `
**Description**
The Forest is the starting biome, located at the center of the world. It is the most balanced biome, with moderate resources and fauna. The player always spawns here.

**Location**
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

**Location**
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

**Location**
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

**Location**
* Biome: [[Forest]]
* Layer: [[Underground]]
* One per Forest zone

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

**Location**
* Biome: [[Jungle]]
* Layer: [[Underground]]
* One per Jungle zone

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
  // ── Mini-biomes / Transversal ────────────────────────────────
  //    Cobweb Cave, Geode Cave, Blind Lake, Underground Lake
  // ── Ores & Gems ──────────────────────────────────────────────
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
