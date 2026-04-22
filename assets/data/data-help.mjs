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
 *   [[node:code]]                 → nom du noeud (NODES.CODE.name) + lien vers sa fiche (NODES.CODE..help)
 *   [[item:code]]                 → nom de l'item (ITEMS.code.name) + lien vers sa fiche (ITEMS.code.help)
 *   [[monster:code]]              → nom du monstre + lien vers sa fiche
 *   [[helpTopic]]                 → titre de la fiche d'aide + lien vers sa fiche
 *   [[node:code|texte affiché]]   → lien avec texte personnalisé
 *   [[item:code|texte affiché]]   → lien avec texte personnalisé
 *   [[monster:code|texte]]        → lien avec texte personnalisé
 *   [[helpTopic|texte affiché]]   → lien avec texte personnalisé
 *   (pas de lien si la fiche courante est celle du lien)
 *
 * ── Données dynamiques ──────────────────────────────────────────
 *   {{node:code:name}}  → affiche le nom de NODES.CODE.name
 *   {{node:code:star}}  → affiche le tier de NODES.CODE.star (⭐☆☆☆☆)
 *   {{item:code:star}}  → affiche le tier de ITEMS.code.star (⭐☆☆☆☆)
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
  `,
  // templates réels en dessous

  mineableRow: '| {1} | [[node:{2}]]| {{node:{2}:star}} | {{node:{2}:mining:0:item:name}} | {{node:{2}:speed}} |'

}

/* ====================================================================================================
   FICHES D'AIDE
   ==================================================================================================== */

export const HELP = [
  {
    title: 'Exemple: Copper Ore',
    category: ['Ore'],
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
  // ── World ─────────────────────────────────────────────────────
  // ── Layers ────────────────────────────────────────────────────
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
* [[node:grassForest]], [[node:dirt]] — Forest
* [[node:sand]], [[node:sandstone]] — Desert
* [[node:grassJungle]], [[node:silt]] — Jungle

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

  // ── Biomes ────────────────────────────────────────────────────
  //    Forest, Desert, Jungle
  {
    title: 'Forest',
    category: ['Biome', 'Forest'],
    content: `
**Description**
The Forest is the starting biome, located at the center of the world. It is the most balanced biome, with moderate resources and fauna. The player always spawns here.

**Main Location**
* The world always contains at least one Forest zone, at the center — the player spawns here.
* Additional Forest zones may appear elsewhere in the world.
* Layer: all layers

**Materials**
* Surface: [[node:dirt]], [[node:grassForest]]
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
    category: ['Biome', 'Desert'],
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
    category: ['Biome', 'Jungle'],
    content: `
**Description**
The Jungle is a lush, dangerous biome teeming with life. It features unique liquid resources (Sap) and the most complex mini-biome ecosystem in the game.

**Main Location**
* One or more Jungle zones, distributed across the world.
* Layer: all layers

**Materials**
* Surface: [[node:silt]], [[node:grassJungle]]
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
  //    Fern Cave, Mushroom Cave, Ruined Cabin, Anthill
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
  {
    title: 'Mushroom Cave',
    category: ['Mini-biome', 'Forest'],
    content: `
**Description**
Mushroom Caves are large caverns found deep in [[Forest]] biomes. Their floor is covered in [[node:grassMushroom]], from which giant luminous mushrooms grow, providing a natural light source and rare crafting ingredients.

**Main Location**
* [[Caverns]] Top — [[Forest]], one per Forest zone

**Materials**
* [[node:grassMushroom]] — floor
* [[node:humus]] — substrate beneath the floor, 2-3 tiles deep

**Inhabitants** ⏳
* [[monster:redSlug]] — common, passive
* [[monster:hydra]] — uncommon
* [[monster:isopod]] — boss, rare

**Loot** ⏳
* Giant mushroom spores — rare harvest from mushroom caps ⏳
* Chest — tier 3-4 ⏳

**Tips**
* _The giant mushrooms provide enough light to explore without torches._ ⏳
* _Harvesting mushroom caps without destroying the [[node:grassMushroom]] allows them to regrow over time._ ⏳
* _Mushroom spores are powerful potion ingredients — worth the detour._ ⏳
  `
  },

  // ── Mini-biomes / Desert ──────────────────────────────────────
  //    Sand Pocket, Fossil Vein, Pyramid, Antlion Pit, Ancient House
  {
    title: 'Sand Pocket',
    category: ['Mini-biome', 'Desert'],
    content: `
**Description**
Sand Pockets are pressurized elliptical cavities filled with [[node:sand]], found in [[Desert]] biomes. They are sealed by a [[node:sandstone]] border. Removing it releases the sand, which falls and accumulates in nearby tunnels and caverns.

**Main Location**
* [[Underground]] — [[Desert]], most common
* [[Caverns]] Top — [[Desert]], less common

**Materials**
* [[node:sand]] — fills the entire cavity
* [[node:sandstone]] — sealing border (lower half)

**Tips**
* _Sand Pockets are sealed — look for [[node:sandstone]] borders in cave walls to locate one._
* _Removing the sandstone border releases the sand — it will fall and fill any open space below._ ⏳
* _Sand accumulates in pyramidal piles — it can block tunnel access if released carelessly._ ⏳
* _Experienced players use Sand Pockets as a source of bulk [[node:sand]] for construction._ ⏳
  `
  },
  {
    title: 'Fossil Vein',
    category: ['Mini-biome', 'Desert'],
    content: `
**Description**
Fossil Veins are horizontal deposits of [[node:shell]] embedded in the rock. They are the remnants of an ancient seabed, compressed over millennia into dense sedimentary layers.

**Main Location**
* [[Caverns]] Top — [[Desert]] and [[Sea||maritime zones]]

**Materials**
* [[node:shell]] — horizontal vein
* Protected by a [[node:sandstone]] border visible on cave walls

**Drops** ⏳
* [[item:shell]] — mined from the vein
* [[item:shellPowder]] — crafted from Shell ⏳

**Tips**
* _Fossil Veins are protected — look for exposed [[node:shell]] on cave walls to locate one._
* _Shell is also found along the [[Sea]] floor and borders — a secondary renewable source._ ⏳
* _Shell Powder is a rare crafting ingredient used in delicate mechanical recipes._ ⏳
  `
  },
  {
    title: 'Pyramid',
    category: ['Mini-biome', 'Desert'],
    content: `
**Description**
Pyramids are ancient stone structures buried deep in [[Desert]] biomes. Built from indestructible Kheprite blocks, they are the remnants of a powerful civilization that mastered stone-cutting and trap engineering.

**Main Location**
* [[Underground]] — [[Desert]]

**Materials**
* [[node:kheprite]] — indestructible walls and structure

**Structure**
* Two chambers connected by a narrow corridor
* Chamber 1 — trap room : arrow traps, rolling boulders ⏳
* Chamber 2 — boss room : triangular ceiling, boss spawn point ⏳
* Entrance on the left or right side

**Inhabitants** ⏳
* [[monster:momie]] — common, both chambers
* [[monster:sphinx]] — uncommon, boss chamber
* [[monster:pharaon]] — boss, chamber 2

**Loot** ⏳
* Chest — tier 4-5, chamber 1 ⏳
* Chest — tier 5, chamber 2 ⏳

**Tips**
* _The Pyramid walls are indestructible — find the entrance rather than trying to mine through._
* _Clear the trap room carefully before engaging the boss._ ⏳
* _The Pharaon respawns after a delay — the Pyramid is never permanently cleared._ ⏳
* _Only one Pyramid exists per world — it is worth the effort to find it._ ⏳
  `
  },
  // ── Mini-biomes / Jungle ──────────────────────────────────────
  //    Moss Cave, Hive, Sap Lake, Sap Pocket, Temple Ruin, Termite Mound
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
  {
    title: 'Hive',
    category: ['Mini-biome', 'Jungle'],
    content: `
**Description**
Hives are large circular caverns built by bees deep in [[Jungle]] biomes. Their walls are made of [[node:hive]] blocks and their interior is filled with [[node:honey]], one of the most valuable liquids in the game. The inhabitants defend their home aggressively.

**Main Location**
* [[Caverns]] Top — [[Jungle]], main location

**Materials**
* [[node:hive]] — walls
* [[node:honey]] — fills the interior

**Access**
* A diagonal tunnel connects the Hive to the surrounding caverns.

**Inhabitants** ⏳
* [[monster:bee]] — common
* [[monster:hornet]] — uncommon
* [[monster:beeQueen]] — boss

**Loot** ⏳
* [[node:honey]] — abundant, difficult to collect while defended
* [[node:hive]] — walls
* Chest — tier 3-4 ⏳

**Tips**
* _Honey is extremely difficult to collect while the Hive is inhabited — consider building a diversion canal to extract it safely._ ⏳
* _Destroying [[node:hive]] blocks will anger the inhabitants immediately._ ⏳
* _The Bee Queen must be defeated before the Hive can be safely exploited._ ⏳
* _Hives regenerate over time if left intact — a sustainable source of Honey._ ⏳
  `
  },
  {
    title: 'Sap Lake',
    category: ['Mini-biome', 'Jungle'],
    content: `
**Description**
Sap Lakes are bodies of [[node:sap]] found in [[Jungle]] biomes. Unlike [[Sap Pocket]]s, they are open cavities accessible via natural tunnels and caverns.

**Main Location**
* [[Underground]] — [[Jungle]], most common
* [[Caverns]] Top — [[Jungle]], less common

**Materials**
* [[node:sap]] — fills the lower half of the cavity

**Inhabitants** ⏳
* [[monster:amberSquid]] — [[Fishing]] only
* [[monster:glider]] — [[Fishing]] only

**Loot** ⏳
* [[node:sap]] — collectable with [[item:bottle]] or [[item:bucket]] ⏳
* Rare aquatic species unique to Sap environments ⏳

**Tips**
* _Sap Lakes are one of the few accessible sources of [[node:sap]] — bring containers._ ⏳
* _Sap severely impairs movement — avoid falling in without a plan to escape._ ⏳
* _[[Fishing]] in Sap yields unique species not found in water lakes._ ⏳
  `
  },
  {
    title: 'Sap Pocket',
    category: ['Mini-biome', 'Jungle'],
    content: `
**Description**
Sap Pockets are pressurized elliptical cavities filled with [[node:sap]], found deep in [[Jungle]] biomes. They are sealed by a [[node:sandstone]] border — removing it releases the sap, which can flood nearby tunnels and caverns.

**Main Location**
* [[Caverns]] Bottom — [[Jungle]]

**Materials**
* [[node:sap]] — fills the entire cavity
* [[node:sandstone]] — sealing border

**Inhabitants** ⏳
* [[monster:amberSquid]] — [[Fishing]] only
* [[monster:glider]] — [[Fishing]] only
* [[monster:mantis]] — aggressive

**Loot** ⏳
* Rare aquatic species unique to Sap Pockets
* Chest — tier 4-5 ⏳

**Tips**
* _Sap Pockets are sealed — look for [[node:sandstone]] borders in the cave walls to locate one._
* _Removing the sandstone border releases the sap — make sure you have containers ready._ ⏳
* _Sap severely impairs movement — avoid falling in without a plan to escape._ ⏳
* _The Mantis is extremely dangerous in the confined space of a Sap Pocket._ ⏳
  `
  },

  // ── Mini-biomes / Transversal ─────────────────────────────────
  //    Cobweb, Cobweb Cave, Geode Cave, Blind Lake, Underground Lake
  {
    title: 'Cobweb',
    category: ['Natural'],
    content: `
**Description**
Cobwebs are sticky threads spun by [[Spiders]]. They slow movement significantly and accumulate progressively in tunnels and caverns if left uncleared.
In extreme cases, cobwebs can obstruct entire tunnel networks.
Despite the nuisance they represent, cobwebs are one of the most valuable resources in the game — the silk extracted from them is an essential component in dozens of crafting recipes, from armor to furniture and accessories.

**Main Location**
* [[Cobweb Cave]]s — concentrated, all biomes
* All tunnels and caverns — scattered, all biomes

**Collection** ⏳
* Mine with any [[Pickaxes]] — drops [[item:silk]]

**Crafting chain**
* [[item:silk]] → [[item:fabric]] — craft at [[item:loom]] ⏳
* [[item:fabric]] is an essential ingredient for armors, furniture and accessories.

**Ecosystem** ⏳
* Spiders continuously spin new cobwebs over time.
* If left uncleared, cobwebs will eventually fill entire tunnel sections.
* Clearing cobwebs regularly is essential to maintain access to deep areas.

**Tips**
* _Cobwebs slow movement drastically — avoid getting surrounded by spiders while slowed._ ⏳
* _A [[item:flamethrower]] clears large cobweb areas quickly._ ⏳
* _Cobwebs are a renewable resource — spiders will always spin new ones._ ⏳
  `
  },
  {
    title: 'Cobweb Cave',
    category: ['Mini-biome', 'Forest', 'Desert', 'Jungle'],
    content: `
**Description**
Cobweb Caves are caverns densely packed with spider webs. They are found in all biomes and are home to increasingly dangerous spider species the deeper they are located.

**Main Location**
* [[Caverns]] Top — all biomes, most common
* [[Caverns]] Bottom — all biomes, rarer and more dangerous

**Materials**
* [[node:web]] — dense coverage on ceiling

**Inhabitants** ⏳
* [[monster:spider]] — common
* [[monster:mygale]] — uncommon
* [[monster:tarentulaKing]] — boss, rare

**Loot** ⏳
* [[item:web]] — abundant
* [[item:spideregg]] — rare drop ⏳
* [[item:spiderFang]] — rare drop ⏳
* Chest — tier 3-4 depending on layer ⏳

**Tips**
* _Clear the webs before engaging the spiders — being slowed in a Cobweb Cave is extremely dangerous._ ⏳
* _The deeper the Cobweb Cave, the more dangerous its inhabitants._
  `
  },
  {
    title: 'Geode Cave',
    category: ['Mini-biome', 'Forest', 'Desert', 'Jungle'],
    content: `
**Description**
Geode Caves are elliptical caverns lined with crystals of [[node:granite]] or [[node:marble]]. They are found in the deepest parts of all biomes and are among the most visually striking locations in the world.

**Main Location**
* [[Caverns]] Bottom — all biomes

**Materials**
* [[node:granite]] or [[node:marble]] — crystal-lined walls
* Hollow interior

**Inhabitants** ⏳
* [[monster:stonegnaw]]
* [[monster:rockborer]] — boss

**Loot** ⏳
* [[item:granite]] and [[item:marble]] — abundant from walls
* Chest — tier 4-5 ⏳

**Tips**
* _Geode Caves always contain either Granite or Marble — never both._
* _The crystals project inward from the walls — the center of the cave is always open._ ⏳
* _Stonegnaws are attracted to the vibrations of mining — proceed carefully._ ⏳
  `
  },
  {
    title: 'Blind Lake',
    category: ['Mini-biome', 'Forest', 'Desert', 'Jungle'],
    content: `
**Description**
Blind Lakes are pockets of water found in the deepest parts of all biomes. They have no natural access — the player must dig their way in. Their isolated environment has allowed unique species to evolve in complete darkness.

**Main Location**
* [[Caverns]] Bottom — all biomes

**Materials**
* [[node:water]] — fills the bottom of the cavity
* [[node:hardstone]] — floor and walls

**Inhabitants** ⏳
* [[monster:blindFish]] — rare, [[Fishing]] only
* [[monster:axolotl]] — very rare, [[Fishing]] only

**Loot** ⏳
* Rare fish species found nowhere else in the world
* Chest — tier 4-5 ⏳

**Tips**
* _Blind Lakes have no natural entrance — bring a [[Pickaxes||pickaxe]]._
* _The fish found here are unique to this environment and cannot be found anywhere else._ ⏳
  `
  },
  {
    title: 'Underground Lake',
    category: ['Mini-biome', 'Forest', 'Desert', 'Jungle'],
    content: `
**Description**
Underground Lakes are pockets of fresh water found below the surface. They are accessible via natural tunnels and caverns, and support a variety of aquatic life rarely seen on the surface.

**Main Location**
* [[Underground]] — all biomes, most common
* [[Caverns]] Top — all biomes, less common

**Materials**
* [[node:water]] — fills the lower half of the cavity
* [[node:humus]] — ceiling and upper walls, [[Forest]]
* [[node:mud]] — ceiling and upper walls, [[Jungle]]
* [[node:sandstone]] — ceiling and upper walls, [[Desert]]

**Inhabitants** ⏳
* [[monster:caveFish]] — common, [[Fishing]] only

**Loot** ⏳
* Rare fish species ⏳
* Chest — tier 2-3 ⏳

**Tips**
* _Underground Lakes are one of the few sources of fresh water below the surface._
* _[[Fishing]] here yields species not found in surface lakes._ ⏳
  `
  },
  {
    title: 'Surface Lake',
    category: ['Mini-biome', 'Forest', 'Desert', 'Jungle'],
    content: `
**Description**
Surface Lakes are bodies of water found at ground level. Each biome has its own variant with distinctive materials and fauna. In the [[Desert]], they take the form of an Oasis — a rare and welcome sight in an arid landscape.

**Main Location**
* [[Surface]] — spread on all biomes

**Variants**
* [[Forest]] — freshwater lake, mossy banks
* [[Desert]] — Oasis, sandy banks
* [[Jungle]] — jungle lake, muddy banks

**Materials**
* [[node:water]] — fills the lake body and pit
* Banks and floor vary by biome ⏳

**Inhabitants** ⏳
* Surface fish species — common, [[Fishing]] only
* Aquatic critters — [[monster:frog]] near Forest lakes ⏳

**Loot** ⏳
* Common fish species
* Chest — tier 1-2 ⏳

**Tips**
* _Surface Lakes are the most accessible source of water early in the game._
* _The Desert Oasis is a landmark — it often signals the presence of underground resources nearby._ ⏳
* _Each lake has a deeper pit section — [[Fishing]] there yields rarer catches._ ⏳
  `
  },
  // ── Liquid ────────────────────────────────────────────────────
  //    Sea, Water, Honey, Sap
  // ── Liquids ───────────────────────────────────────────────────
  {
    title: 'Water',
    category: ['Liquid'],
    content: `
**Description**
Water is the most common liquid in the world. It fills surface lakes, underground lakes and blind lakes. It supports aquatic life and is used in many crafting recipes.

**Main Location**
* [[Surface]] lakes — all biomes
* [[Underground]] lakes — all biomes
* [[Blind Lake]]s — all biomes, [[Caverns]] Bottom
* Water puddles — [[Underground]] and [[Caverns]]

**Collection** ⏳
* [[item:bottle]] — small quantity
* [[item:bucket]] — large quantity

**Recipes** ⏳
* {{recipe:waterBottle}}
* {{recipe:waterBucket}}

**Tips**
* _Water puddles form naturally in tunnels and caverns._
* _Removing the solid tile bordering a lake will cause the water to flow._ ⏳
  `
  },
  {
    title: 'Honey',
    category: ['Liquid'],
    content: `
**Description**
Honey is a viscous golden liquid produced by [[Bees]] in [[Hive]]s. It is harder to move through than water and is a valuable crafting ingredient.

**Main Location**
* [[Hive]]s — [[Jungle]], [[Caverns]] Top

**Collection** ⏳
* [[item:bottle]] — small quantity
* [[item:bucket]] — large quantity

**Recipes** ⏳
* {{recipe:honeyBottle}}
* {{recipe:honeyBucket}}

**Tips**
* _Honey slows movement — avoid falling into it without a plan to escape._ ⏳
* _The [[Bees]] will defend their honey aggressively — consider building a diversion canal to collect it safely._ ⏳
  `
  },
  {
    title: 'Sap',
    category: ['Liquid'],
    content: `
**Description**
Sap is a rare green liquid found exclusively in [[Jungle]] biomes. It fills Sap Lakes and Sap Pockets and is one of the most valuable crafting ingredients in the game.

**Main Location**
* Sap Lakes — [[Jungle]], [[Underground]] and [[Caverns]] Top
* [[Sap Pocket]]s — [[Jungle]], [[Caverns]] Bottom
* Sap puddles — [[Jungle]], [[Underground]] and [[Caverns]]

**Collection** ⏳
* [[item:bottle]] — small quantity
* [[item:bucket]] — large quantity

**Recipes** ⏳
* {{recipe:sapBottle}}
* {{recipe:sapBucket}}

**Tips**
* _Sap Pockets are sealed by [[Sandstone]] borders — removing them releases the sap._ ⏳
* _Sap is even more viscous than [[Honey]] — movement is severely impaired._ ⏳
  `
  },
  {
    title: 'Sea',
    category: ['Liquid', 'Mini-biome'],
    content: `
**Description**
The Sea borders both sides of the world. Its deep, dark waters are home to unique fauna and hide rare treasures on the ocean floor.

**Main Location**
* Left and right borders of the world
* Depth : from [[Surface]] level down to [[Caverns]] Bottom

**Collection** ⏳
* [[item:bottle]] — small quantity
* [[item:bucket]] — large quantity

**Tips**
* _The Sea is bordered by [[Sandstone]] walls that prevent it from flooding the world. Destroying these walls may cause seawater to flood tunnels and caverns — potentially destroying entire ecosystems and making large areas of the world inaccessible._ ⏳
* _Deep Sea areas are extremely dangerous — bring strong equipment._ ⏳
  `
  },

  // ── Natural ───────────────────────────────────────────────────
  //    Forest Grass, Jungle Grass, Mushroom Grass, Fern Grass, Moss Grass
  {
    title: 'Forest Grass',
    category: ['Natural'],
    content: `
**Description**
Grass covers the surface of [[Forest]] biomes. It is the most common natural tile and supports a wide variety of surface plants and critters.

**Tier**
{{node:grassForest:star}}

**Main Location**
* [[Surface]] — [[Forest]], top layer of solid ground

**Drops** ⏳
* {{node:grass:mining}}

**Tips**
* _Grass grows back naturally on exposed [[Dirt]] tiles over time._ ⏳
  `
  },
  {
    title: 'Jungle Grass',
    category: ['Natural'],
    content: `
**Description**
Jungle Grass covers the surface of [[Jungle]] biomes. Denser and more vibrant than regular [[node:grassForest]], it supports exotic plants and fauna.

**Tier**
{{node:grassJungle:star}}

**Main Location**
* [[Surface]] — [[Jungle]], top layer of solid ground

**Drops** ⏳
* {{node:jungleGrass:mining}}

**Tips**
* _Jungle Grass grows back naturally on exposed [[node:silt]] tiles over time._ ⏳
  `
  },
  {
    title: 'Fern Grass',
    category: ['Natural'],
    content: `
**Description**
Fern Grass covers the floor of [[Fern Cave]]s. Giant ferns grow from this soft, mossy substrate.

**Tier**
{{node:grassFern:star}}

**Main Location**
* [[Fern Cave]] floor — [[Underground]], [[Forest]]

**Drops** ⏳
* {{node:grassFern:mining}}

**Tips**
* _Fern Grass only grows in [[Fern Cave]]s — it cannot spread outside its native environment._ ⏳
  `
  },
  {
    title: 'Moss Grass',
    category: ['Natural'],
    content: `
**Description**
Luminous moss that covers the walls and floor of [[Moss Cave]]s. Its soft green glow makes it one of the few self-illuminating natural tiles.

**Tier**
{{node:grassMoss:star}}

**Main Location**
* [[Moss Cave]] walls and floor — [[Underground]], [[Jungle]]

**Drops** ⏳
* {{node:grassMoss:mining}}

**Tips**
* _Moss grows on the floor and lateral walls, but not on the ceiling._
* _Its bioluminescence makes torches unnecessary inside a Moss Cave._ ⏳
  `
  },
  {
    title: 'Mushroom Grass',
    category: ['Natural'],
    content: `
**Description**
Mushroom Grass covers the floor of [[Mushroom Cave]]s. [[Giant Mushroom]]s grow from this rich substrate, providing rare ingredients.

**Tier**
{{node:grassMushroom:star}}

**Main Location**
* [[Mushroom Cave]] floor — [[Caverns]] Top, [[Forest]]

**Drops** ⏳
* {{node:grassMushroom:mining}}

**Tips**
* _Mushroom Grass is the only substrate from which giant mushrooms can grow._ ⏳
* _Harvesting mushrooms without destroying the grass allows them to regrow over time._ ⏳
  `
  },

  // ── Topsoil ───────────────────────────────────────────────────
  //    Dirt, Sand, Silt, Humus
  {
    title: 'Dirt',
    category: ['Topsoil'],
    content: `
**Description**
Dirt is the primary topsoil of [[Forest]] biomes. It supports surface vegetation and is the most workable material for early construction⏳.

**Tier**
{{node:dirt:star}}

**Main Location**
* [[Surface]] and [[Underground]] — [[Forest]], high density

**Drops** ⏳
* {{node:dirt:mining}}

**Recipes** ⏳
* {{recipe:dirtBlock}}
  `
  },
  {
    title: 'Sand',
    category: ['Topsoil'],
    content: `
**Description**
Sand is the primary topsoil of [[Desert]] biomes. It is subject to gravity — unsupported sand falls and accumulates in piles.

**Tier**
{{node:sand:star}}

**Main Location**
* [[Surface]] and [[Underground]] — [[Desert]], high density
* [[Sand Pocket]]s — [[Underground]], [[Desert]]

**Drops** ⏳
* {{node:sand:mining}}

**Tips**
* _Sand falls when the tile below is empty — be careful when mining near Sand Pockets._
* _Sand Pockets are sealed by [[Sandstone]] borders — removing them releases the sand._ ⏳
  `
  },
  {
    title: 'Silt',
    category: ['Topsoil'],
    content: `
**Description**
Silt is the primary topsoil of [[Jungle]] biomes. Its fine, damp texture supports the dense jungle vegetation above.

**Tier**
{{node:silt:star}}

**Main Location**
* [[Surface]] and [[Underground]] — [[Jungle]], high density

**Drops** ⏳
* {{node:silt:mining}}

**Recipes** ⏳
* {{recipe:siltBlock}}
  `
  },
  {
    title: 'Humus',
    category: ['Topsoil'],
    content: `
**Description**
Humus is a rich organic topsoil found across all biomes, though it is most abundant in [[Forest]] and [[Jungle]] biomes. It forms the substrate beneath [[Fern Cave]] and [[Mushroom Cave]] floors.

**Tier**
{{node:humus:star}}

**Main Location**
* [[Underground]] and [[Caverns]] Top — [[Forest]] and [[Jungle]], moderate density
* [[Fern Cave]] floor — [[Forest]]
* [[Mushroom Cave]] floor — [[Forest]]

**Drops** ⏳
* {{node:humus:mining}}

**Recipes** ⏳
* {{recipe:humusBlock}}

**Tips**
* _Humus is the only topsoil found in both Forest and Jungle biomes at significant depth._
  `
  },

  // ── Substrat ──────────────────────────────────────────────────
  //    Forest : Clay, Stone, Hardstone
  //    Desert : Sandstone, Ash, Hellstone
  //    Jungle : Mud, Limestone, Slate
  {
    title: 'Clay',
    category: ['Substrat'],
    content: `
**Description**
Clay is the most common substrat in [[Forest]] biomes. Its soft, workable texture makes it a versatile early-game building material.

**Tier**
{{node:clay:star}}

**Main Location**
* [[Surface]] and [[Underground]] — [[Forest]], high density

**Drops** ⏳
* {{node:clay:mining}}

**Recipes** ⏳
* {{recipe:clayBlock}}
  `
  },
  {
    title: 'Stone',
    category: ['Substrat'],
    content: `
**Description**
Stone is the second most common substrat in [[Forest]] biomes, found deeper than [[Clay]].

**Tier**
{{node:stone:star}}

**Main Location**
* [[Underground]] — [[Forest]], dominant (native substrat)
* [[Caverns]] Top — [[Forest]], moderate density

**Drops** ⏳
* {{node:stone:mining}}

**Recipes** ⏳
* {{recipe:stoneBlock}}
  `
  },
  {
    title: 'Hardstone',
    category: ['Substrat'],
    content: `
**Description**
Hardstone is a dense, resistant substrat found in the deepest parts of [[Forest]] biome. It requires high-tier tools to mine.

**Tier**
{{node:hardstone:star}}

**Main Location**
* [[Caverns]] — [[Forest]], dominant (native substrat)

**Drops** ⏳
* {{node:hardstone:mining}}

**Recipes** ⏳
* {{recipe:hardstoneBlock}}
  `
  },
  {
    title: 'Sandstone',
    category: ['Substrat'],
    content: `
**Description**
Sandstone is the primary substrat of [[Desert]] biomes. It also forms the natural borders of the [[Sea]] and acts as a containment layer around [[Sand Pocket]]s.

**Tier**
{{node:sandstone:star}}

**Main Location**
* [[Surface]] and [[Underground]] — [[Desert]], high density
* [[Sea]] borders
* [[Sand Pocket]]: [[Caverns]] — [[Desert]]

**Drops** ⏳
* {{node:sandstone:mining}}

**Recipes** ⏳
* {{recipe:sandstoneBlock}}
  `
  },
  {
    title: 'Ash',
    category: ['Substrat'],
    content: `
**Description**
Ash is the second most common substrat in [[Forest]] biomes, found deeper than [[Sandstone]]. The dark color of this volcanic substrat and its fragile structure make it a distinctive material.

**Tier**
{{node:ash:star}}

**Main Location**
* [[Underground]] — [[Desert]], dominant (native substrat)
* [[Caverns]] Top — [[Desert]], moderate density

**Drops** ⏳
* {{node:ash:mining}}

**Recipes** ⏳
* {{recipe:ashBlock}}
  `
  },
  {
    title: 'Hellstone',
    category: ['Substrat'],
    content: `
**Description**
Hellstone is an extremely hard volcanic substrat found in the deepest parts of [[Desert]] biome. It requires the best tools available to mine and emits a faint heat glow.

**Tier**
{{node:hellstone:star}}

**Main Location**
* [[Caverns]] — [[Desert]], dominant (native substrat)

**Drops** ⏳
* {{node:hellstone:mining}}

**Recipes** ⏳
* {{recipe:hellstoneBar}}

**Tips**
* _Hellstone is one of the hardest materials to mine — bring your best pickaxe._ ⏳
  `
  },
  {
    title: 'Mud',
    category: ['Substrat'],
    content: `
**Description**
Mud is the primary substrat of [[Jungle]] biomes. Its soft, damp texture supports the lush vegetation above.

**Tier**
{{node:mud:star}}

**Main Location**
* [[Surface]] and [[Underground]] — [[Jungle]], high density
* [[Moss Cave]] walls and floor

**Drops** ⏳
* {{node:mud:mining}}

**Recipes** ⏳
* {{recipe:mudBlock}}
  `
  },
  {
    title: 'Limestone',
    category: ['Substrat'],
    content: `
**Description**
Limestone is a sedimentary substrat found as intrusions across [[Jungle]] biome. The pale color of this sedimentary substrat and its layered structure make it recognizable underground.

**Tier**
{{node:limestone:star}}

**Main Location**
* [[Underground]] — [[Jungle]], dominant (native substrat)
* [[Caverns]] Top — [[Jungle]], moderate density

**Drops** ⏳
* {{node:limestone:mining}}

**Recipes** ⏳
* {{recipe:limestoneBlock}}
  `
  },
  {
    title: 'Slate',
    category: ['Substrat'],
    content: `
**Description**
Slate is a hard metamorphic substrat found in the deepest parts of [[Jungle]] biome. Its dark, layered structure requires advanced tools to mine.

**Tier**
{{node:slate:star}}

**Main Location**
* [[Caverns]] — [[Jungle]], dominant (native substrat)

**Drops** ⏳
* {{node:slate:mining}}

**Recipes** ⏳
* {{recipe:slateBlock}}
  `
  },

  // ── Ores ──────────────────────────────────────────────────────
  //    Copper, Iron, Silver, Gold, Cobalt, Platinum
  {
    title: 'Copper Ore',
    category: ['Ore'],
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
    title: 'Iron Ore',
    category: ['Ore'],
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
    title: 'Silver Ore',
    category: ['Ore'],
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
    title: 'Gold Ore',
    category: ['Ore'],
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
    title: 'Cobalt Ore',
    category: ['Ore'],
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
    title: 'Platinum Ore',
    category: ['Ore'],
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

  // ── Gems ──────────────────────────────────────────────────────
  //    Topaz, Ruby, Emerald, Sapphire
  {
    title: 'Topaz Deposit',
    category: ['Gem'],
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
    title: 'Ruby Deposit',
    category: ['Gem'],
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
    title: 'Emerald Deposit',
    category: ['Gem'],
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
    title: 'Sapphire Deposit',
    category: ['Gem'],
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

  // ── Rocks ─────────────────────────────────────────────────────
  //    Granite, Marble, Obsidian, Meteorite, Hive, Shell
  {
    title: 'Granite',
    category: ['Rock'],
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
    category: ['Rock'],
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
    category: ['Rock'],
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
    category: ['Rock'],
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
    category: ['Rock'],
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
    category: ['Rock'],
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
  },
  // ── Housing (walls) ──────────────────────────────────────────
  // ── Accessories ──────────────────────────────────────────────
  // ── Activities Mining ────────────────────────────────────────
  //    Mining, Mineable Blocks, Mining Buffs
  {
    title: 'Mining',
    category: ['Activities', 'Mining'],
    content: `
    `
  },
  {
    title: 'Mineable Blocks',
    category: ['Mining', 'Natural', 'Topsoil', 'Substrat', 'Ore', 'Gem', 'Rock'],
    content: `
    **All mineable blocks**

| Type | Name | Tier | Drop | Speed |
| ---- | ---- | ---- | ---- | ----- |
<<mineableRow|Natural|grassForest>>
<<mineableRow|Natural|grassJungle>>
<<mineableRow|Natural|grassFern>>
<<mineableRow|Natural|grassMoss>>
<<mineableRow|Natural|grassMushroom>>
<<mineableRow|Natural|web>>
<<mineableRow|Topsoil|dirt>>
<<mineableRow|Topsoil|sand>>
<<mineableRow|Topsoil|silt>>
<<mineableRow|Topsoil|humus>>
<<mineableRow|Substrat|clay>>
<<mineableRow|Substrat|stone>>
<<mineableRow|Substrat|hardstone>>
<<mineableRow|Substrat|sandstone>>
<<mineableRow|Substrat|ash>>
<<mineableRow|Substrat|hellstone>>
<<mineableRow|Substrat|mud>>
<<mineableRow|Substrat|limestone>>
<<mineableRow|Substrat|slate>>
<<mineableRow|Rock|granite>>
<<mineableRow|Rock|marble>>
<<mineableRow|Rock|obsidian>>
<<mineableRow|Rock|meteorite>>
<<mineableRow|Rock|hive>>
<<mineableRow|Rock|shell>>
<<mineableRow|Ore|copper>>
<<mineableRow|Ore|iron>>
<<mineableRow|Ore|silver>>
<<mineableRow|Ore|gold>>
<<mineableRow|Ore|cobalt>>
<<mineableRow|Ore|platinum>>
<<mineableRow|Gem|topaz>>
<<mineableRow|Gem|ruby>>
<<mineableRow|Gem|emerald>>
<<mineableRow|Gem|sapphire>>
    `
  },
  {
    title: 'Mining Buffs',
    category: ['Mining', 'Buffs'],
    content: `
    `
  },

  // ── Activities Fishing ────────────────────────────────────────
  //    Fishing, Fishing Baits, Fisheable Monsters, Fishing Buffs
  {
    title: 'Fishing',
    category: ['Activities', 'Fishing'],
    content: `
    `
  }

  // ── Items & Crafting ─────────────────────────────────────────
  // ── Fauna & Critters ─────────────────────────────────────────
  // ── Buffs & Debuffs ──────────────────────────────────────────
  // ── Mechanics ────────────────────────────────────────────────

]

/* ====================================================================================================
   POST-TRAITEMENTS
   ==================================================================================================== */

// 1. Remplacement textuel des <<...>> par le template correspondant.
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

// 2. Liste complète de tous les topics de l'aide
export const HELP_TITLES = new Set(HELP.map(entry => entry.title))

// 3. Catégories de l'aide
// 3.1 Set des catégories (pour le menu déroulant)
export const HELP_CATEGORIES = new Set()
for (const entry of HELP) {
  for (const cat of entry.category) {
    HELP_CATEGORIES.add(cat)
  }
}

// 3.2 Debug — affiche chaque catégorie avec le nombre de topics
export const debugHelpCategories = () => {
  const counts = new Map()
  for (const entry of HELP) {
    for (const cat of entry.category) {
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  console.group('📚 Help categories')
  for (const [cat, count] of sorted) {
    console.log(`  ${cat.padEnd(20)} ${count} topic${count > 1 ? 's' : ''}`)
  }
  console.groupEnd()
  console.log('.............................;;;;')
}
debugHelpCategories()
