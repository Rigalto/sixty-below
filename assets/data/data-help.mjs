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
Use a [[Pickaxes|{1}]] of at least ⭐{2} to mine [[node:{3}]].
Mining drops: {{node:{3}:mining}}
  `,

  statTable: `
| Name | ⭐ | Speed | Sell |
| ---- | -- | ----- | ---- |
{{table:stype:{1}}}
  `,
  // templates réels en dessous

  mineableRow: '| {1} | [[node:{2}]]| {{node:{2}:star}} | {{node:{2}:mining:0:item:name}} | {{node:{2}:speed}} |',
  metalChunksRow: '| [[node:{1}]] | [[item:{2}]] | {{item:{2}:star}} | [[item:{3}]] | {{item:{3}:star}} |',
  metalBarsRow: '| [[item:{1}]] | {{item:{1}:star}} | [[Smelting|Furnace]] | [[item:{2}]] | {{item:{2}:star}} |',
  gemRawRow: '| [[node:{1}]] | [[item:{2}]] | {{item:{2}:star}} | [[item:{3}]] | {{item:{3}:star}} |',
  gemCutRow: '| [[item:{1}]] | {{item:{1}:star}} | [[Smelting|Furnace]] | [[item:{2}]] | {{item:{2}:star}} |'
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
Copper is the most common ore found near the [[Surface|Surface layer]].
It is used in many early-game [[Crafting|recipes]].

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
* _Tip: [[Torches|Bring torches]] when mining underground!_ ⏳
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
* [[item:chunkCopper]], [[item:chunkIron]] — common
* Surface plants and critters ⏳

**Mini-biomes**
* [[Ant Hill]] — Forest
* [[Antlion Pit]] — Desert
* [[Termite Mound]] — Jungle
* [[Surface Lake]] — All biomes

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
* [[item:chunkCopper]], [[item:chunkIron]], [[item:chunkSilver]] — common

**Mini-biomes**
* [[Fern Cave]] — Forest
* [[Moss Cave]] — Jungle
* [[Sand Pocket]] — Desert
* [[Ruined Cabin]] — Forest
* [[Pyramid]] — Desert
* [[Underground Lake]] — All biomes

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
* [[node:granite]], [[node:marble]] — [[Geode Cave]]s

**Resources**
* [[item:chunkGold]], [[item:chunkCobalt]], [[item:chunkPlatinum]] — rare to very rare
* [[item:rawTopaz]], [[item:rawRuby]], [[item:rawEmerald]], [[item:rawSapphire]] — rare to very rare⏳
* [[item:blockGranite]], [[item:blockMarble]] — [[Geode Cave]]s

**Mini-biomes**
* [[Mushroom Cave]] — Forest, Caverns Top
* [[Hive]] — Jungle, Caverns Top
* [[Fossil Vein]] — Desert, Caverns Top
* [[Cobweb Cave]] — all biomes
* [[Geode Cave]] — all biomes, Caverns Bottom
* [[Blind Lake]] — all biomes, Caverns Bottom
* [[Sap Pocket]] — Jungle, Caverns Bottom
* [[Ancient House]] — Desert, Caverns Bottom
* [[Lost Temple]] — Jungle, Caverns Top
* [[Graveyard]] — all biomes, Caverns Bottom

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
* [[Metals|Chunks]]: [[item:chunkCopper]], [[item:chunkIron]], [[item:chunkSilver]], [[item:chunkGold]], [[item:chunkCobalt]], [[item:chunkPlatinum]]
* Gems: [[item:rawTopaz]], [[item:rawSapphire]]
* Topsoil: [[node:dirt]], [[node:humus]]

**Mini-biomes**
* [[Fern Cave]] — Underground
* [[Mushroom Cave]] — Caverns
* [[Ruined Cabin]] — Underground
* [[Ant Hill]] — Surface
* [[Underground Lake]] — Caverns
* [[Graveyard]] — Caverns Bottom

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
* [[Metals|Chunks]]: [[item:chunkCopper]], [[item:chunkIron]], [[item:chunkSilver]], [[item:chunkGold]], [[item:chunkCobalt]], [[item:chunkPlatinum]]
* Gems: [[item:rawRuby]], [[item:rawSapphire]]
* Topsoil: [[node:sand]], [[node:silt]]

**Mini-biomes**
* [[Antlion Pit]] — Surface
* [[Sand Pocket]] — Underground
* [[Fossil Vein]] — Caverns
* [[Pyramid]] — Underground
* [[Ancient House]] — Caverns deep
* [[Graveyard]] — Caverns Bottom

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
* [[Metals|Chunks]]: [[item:chunkCopper]], [[item:chunkIron]], [[item:chunkSilver]], [[item:chunkGold]], [[item:chunkCobalt]], [[item:chunkPlatinum]]
* Gems: [[item:rawEmerald]], [[item:rawSapphire]]
* Topsoil: [[node:silt]], [[node:humus]]
* Liquid: [[node:sap]] — found in Sap Lakes and Sap Pockets
* [[Bees]] product: [[node:honey], [[node:hive] — found in [[Hive]]s

**Mini-biomes**
* [[Termite Mound]] — Surface
* [[Moss Cave]] — Underground
* [[Hive]] — Caverns
* [[Sap Pocket]] — Caverns deep
* [[Lost Temple]] — Caverns
* [[Graveyard]] — Caverns Bottom

**Fauna** ⏳
* [[monster:jungleSpider]] — Surface
* [[monster:bat]], [[monster:caveWorm]] — Underground
* [[monster:bee]], [[monster:hornet]] — Hive

**Tips**
* _Sap is a rare and valuable liquid — bring containers when exploring Sap Pockets._ ⏳
  `
  },

  // ── Mini-biomes / Forest ──────────────────────────────────────
  //    Fern Cave, Mushroom Cave, Ruined Cabin, Ant Hill
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

| Monster | Role | Trigger |
|---|---|---|
| [[monster:blueSlug]] | Common, passive | Ambient / Harvesting [[Cave Mushrooms]] / Chopping [[Giant Mushroom|Giant Mushrooms]] |
| [[monster:woodlouse]] | Common | Harvesting [[Cave Mushrooms]] |
| [[monster:hydra]] | Uncommon | Chopping [[Giant Mushroom|Giant Mushrooms]] |
| [[monster:isopod]] | Mini-boss, rare | Chopping [[Giant Mushroom|Giant Mushrooms]] |

**Loot** ⏳
* Giant mushroom spores — rare harvest from mushroom caps ⏳
* Chest — tier 3-4 ⏳

**Tips**
* _The giant mushrooms provide enough light to explore without torches._ ⏳
* _[[Foraging]] mushroom caps without destroying the [[node:grassMushroom]] allows them to regrow over time._ ⏳
* _Mushroom spores are powerful potion ingredients — worth the detour._ ⏳
  `
  },
  {
    title: 'Ruined Cabin',
    category: ['Mini-biome', 'Forest'],
    content: `
**Description**
Ruined Cabins are the remains of ancient wooden shelters found deep in [[Forest]] biomes. Their walls are crumbling, their floor is covered in old stonework, and a mysterious chest sits inside — guarded by restless spirits.

**Main Location**
* [[Underground]] — [[Forest]]

**Materials**
* [[node:woodwall]] — crumbling outer walls (degraded)
* [[node:stonewall]] — interior background wall (degraded)

**Structure**
* Doorway on the left or right side
* Piece of furniture — chair, table or toilet
* One [[item:chestAncient]] — triggers combat when opened

**Combat** ⏳
* Clicking the [[item:chestAncient]] triggers a ghost encounter
* Enemies : ghosts + Arthur, the Ghost Boss
* Victory : the chest opens and its contents can be looted
* Defeat : the chest disappears
* The chest and its contents regenerate after a few in-game days

**Inhabitants** ⏳
* Ghosts — common
* Arthur — boss

**Tips**
* _The chest contains consumables — it is worth revisiting regularly._ ⏳
* _Defeating Arthur gets easier with better equipment — come back stronger if you fail._ ⏳
* _The cabin walls are degraded but its floor plan is always the same — learn the layout._ ⏳
  `
  },
  {
    title: 'Ant Hill',
    category: ['Mini-biome', 'Forest'],
    content: `
**Description**
Ant Hills are conical mounds of [[Compacted Earth]] found on the surface of [[Forest]] biomes. They are home to a colony of ants led by a powerful queen. If destroyed, the ants will rebuild their home over time.

**Main Location**
* Biome: [[Forest]]
* Layer: Surface

**Materials**
* [[node:antDirt]] — [[Compacted Earth]], indestructible

**Structure**
* Conical mound rising above the surface
* Underground chamber housing the Ant Queen

**Inhabitants** ⏳
* [[monster:ant]] — common
* [[monster:antSoldier]] — defender
* [[monster:antQueen]] — boss, spawns in the underground chamber

**Tips**
* _Ant Hills are indestructible — the ants will always defend their home._
* _Defeating the Ant Queen will temporarily stop ant activity._ ⏳
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
* [[Caverns]] Top — [[Desert]] and [[Sea|maritime zones]]

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
* Entrance on the left or right side (random per world)
* Entering Chamber 1 triggers combat immediately ⏳

**Chamber 1 — Trap Room** ⏳
* Arrow traps and boulder launchers
  * Even turns : boulders launch vertically
  * Odd turns : boulders launch horizontally
* Pressure plates trigger traps ⏳
* Inhabitants : [[monster:momie]], [[monster:sphinx]]

**Chamber 2 — Boss Room** ⏳
* Spike traps on floor tiles
  * Even turns : light tiles are dangerous
  * Odd turns : dark tiles are dangerous
* Some [[node:kheprite]] blocks conceal secret passages between tiles ⏳
* Inhabitants : [[monster:momie]], [[monster:sphinx]], [[monster:pharaon]]
* Chamber may be empty if the Pharaon was recently defeated ⏳

**Inhabitants** ⏳
* [[monster:momie]] — common, both chambers
* [[monster:sphinx]] — uncommon, both chambers
* [[monster:pharaon]] — boss, chamber 2

**Loot** ⏳
* Chest — tier 4-5, chamber 1 ⏳
* Chest — tier 5, chamber 2 ⏳

**Tips**
* _The Pyramid walls are indestructible — find the entrance rather than trying to mine through._
* _Clear the trap room carefully before engaging the boss._ ⏳
* _Learn the boulder pattern before advancing — even turns vertical, odd turns horizontal._ ⏳
* _Watch the floor tile colors in Chamber 2 — standing on the wrong tile is lethal._ ⏳
* _The Pharaon respawns after a delay — the Pyramid is never permanently cleared._ ⏳
* _Only one Pyramid exists per world — it is worth the effort to find it._ ⏳
  `
  },
  {
    title: 'Antlion Pit',
    category: ['Mini-biome', 'Desert'],
    content: `
**Description**
Antlion Pits are conical hollow traps found on the surface of [[Desert]] biomes. The steep sandy walls cause anything that steps inside to slide helplessly toward the waiting antlion at the bottom. If destroyed, the antlion will rebuild its trap over time.

**Main Location**
* Biome: [[Desert]]
* Layer: Surface

**Materials**
* [[node:sand]] — unstable, causes sliding
* [[node:sandstone]] — structural borders

**Structure**
* Inverted cone dug into the sand surface
* Antlion waiting at the bottom center

**Inhabitants** ⏳
* [[monster:antlion]] — ambush predator at the pit bottom
* [[monster:sunburstAntlion]] — boss variant, rare

**Tips**
* _Once you fall in, the sand walls make it very difficult to climb back out._ ⏳
* _Ranged attacks from above are the safest strategy._ ⏳
  `
  },
  {
    title: 'Ancient House',
    category: ['Mini-biome', 'Desert'],
    content: `
**Description**
The Ancient House is a large desert dwelling buried deep in [[Desert]] biomes. Unlike the [[Ruined Cabin]], it is remarkably well preserved — its walls still standing, its roof intact, and its interior furnished. It contains the [[Transmutator]], a powerful crafting station.

**Main Location**
* [[Caverns]] Bottom — [[Desert]]

**Materials**
* [[node:woodwall]] — outer walls and roof
* [[node:olympite]] — floor
* [[node:goldwall]] — interior background wall

**Furnitures** ⏳
* Roof : [[Crafting Stations]] and decorative furnitures
* Floor : [[item:transmutator]]
* Ground floor : [[Crafting Stations]], [[Chests]] and decorative furnitures

**The Transmutator** ⏳
* [[item:transmutator]] is always usable
* The [[item:transmutator]] converts materials into other materials of equivalent value
* The [[item:transmutator]] is immovable — the Ancient House is its permanent location

**Housing** ⏳
* The Ancient House is large enough to serve as a player home
* Place a [[item:noticeBoard]] to activate the [[Housing Buffs]] system

**Tips**
* _The Ancient House is the largest structure in the game — explore every corner._ ⏳
* _Repair the walls and roof before using the [[item:transmutator]] — the missing tiles leave the house open to monster invasions._ ⏳
* _The Ancient House makes an excellent base camp for [[Caverns]] [[Desert]] exploration._ ⏳
  `
  },

  // ── Mini-biomes / Jungle ──────────────────────────────────────
  //    Moss Cave, Hive, Sap Lake, Sap Pocket, Lost Temple, Termite Mound
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

| Monster | Role | Trigger |
|---|---|---|
| [[monster:millipede]] | Common | Harvesting [[Velvetmoss]] — attacks in waves of 4-5 |

**Loot** ⏳
* Rare vegetal drops from the moss walls
* Crafting material from millipedes

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
  {
    title: 'Lost Temple',
    category: ['Mini-biome', 'Jungle'],
    content: `
**Description**
The Lost Temple is an ancient Greek-style structure buried deep in the [[Jungle]] biomes. Built from indestructible [[node:Olympite]] blocks, it has stood for millennia, its columns still standing despite the encroaching jungle. A powerful guardian protects the secrets within — and the key to a unique crafting station.

**Main Location**
* [[Caverns]] Top — [[Jungle]]

**Materials**
* [[node:olympite]] — indestructible walls and fronton
* [[node:olympitewall]] — decorative columns (passable)
* [[node:emeraldwall]] — interior background wall

**Structure**
* Greek temple shape : triangular fronton + columns + base
* Single interior chamber
* One [[item:brokenDecomposer]] on the chamber floor

**Combat** ⏳
* The Minotaur attacks on sight — the chamber cannot be safely entered until it is defeated
* Three waves :
  * Wave 1 : 4 × [[monster:harpy]]
  * Wave 2 : 4 × [[monster:cyclops]]
  * Wave 3 : 2 × [[monster:harpy]], 2 × [[monster:cyclops]], 1 × [[monster:minotaur]] (boss)
* The Minotaur drops [[item:decomposerPart]] on defeat

**The Decomposer** ⏳
* The [[item:brokenDecomposer]] becomes usable after repair
* To repair : equip [[item:decomposerPart]] and click on the [[item:brokenDecomposer]]
* The [[item:brokenDecomposer]] is replaced by the [[item:decomposer]] — a powerful tier 5 crafting station
* The [[item:decomposer]] is immovable — the Lost Temple is its permanent location
* The [[item:decomposer]] breaks down items into a portion of their crafting ingredients — a powerful tool for recovering rare materials from unwanted equipment.

**Tips**
* _Clear the Harpy waves carefully before the Cyclops arrive — their ranged attacks are dangerous in the confined space._ ⏳
  `
  },
  {
    title: 'Termite Mound',
    category: ['Mini-biome', 'Jungle'],
    content: `
**Description**
Termite Mounds are tall cylindar structures of [[Compacted Earth]] rising above the surface of [[Jungle]] biomes. They house a thriving termite colony led by a powerful king. If destroyed, the termites will rebuild their home over time.

**Main Location**
* Biome: [[Jungle]]
* Layer: Surface

**Materials**
* [[node:antDirt]] — [[Compacted Earth]], indestructible

**Structure**
* Rectangular tower rising above the surface
* Underground chamber housing the Termite King

**Inhabitants** ⏳
* [[monster:termite]] — common
* [[monster:termiteSoldier]] — defender
* [[monster:termiteKing]] — boss, spawns in the underground chamber

**Tips**
* _Termite Mounds are indestructible — the termites will always defend their home._
* _Defeating the Termite King will temporarily stop termite activity._ ⏳
  `
  },

  // ── Mini-biomes / Transversal ─────────────────────────────────
  //    Cobweb, Cobweb Cave, Geode Cave, Blind Lake, Underground Lake, Graveyard
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
* Deleted with a [[item:flamethrower]] - No loot

**Crafting chain**
* [[item:silk]] → [[item:fabric]] — craft at [[item:loom]] ⏳
* [[item:fabric]] is an essential ingredient for armors, furniture and accessories.

**Ecosystem** ⏳
* Spiders continuously spin new cobwebs over time.
* If left uncleared, cobwebs will eventually fill entire tunnel sections.
* Clearing cobwebs regularly is essential to maintain access to deep areas.

**Terrain Effect** ⏳
* Cobweb threads are nearly invisible until you are already tangled in them — by then, each step pulls a dozen more filaments across your legs and arms.
* Walking through [[node:web]] reduces movement speed ({{node:web:buffs:movementSpeed}}%)
* See [[Movement Speed]] for details

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
* [[item:silk]] — abundant
* [[item:spiderEgg]] — rare drop ⏳
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
* [[Mining]] : [[item:blockGranite]] and [[item:blockMarble]] — abundant from walls

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
* _Blind Lakes have no natural entrance — bring a [[Pickaxes|pickaxe]]._
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
  {
    title: 'Graveyard',
    category: ['Mini-biome', 'Forest', 'Desert', 'Jungle'],
    content: `
**Description**
Graveyards are ancient burial chambers found deep underground in all biomes. Their catacomb-like structure features rows of burial tunnels separated by layers of dirt and stone. They are haunted by restless spirits and guarded by undead creatures.

**Main Location**
* All biomes
* Layer: [[Caverns]] Bottom

**Materials**
* [[node:stone]] — walls, ceiling and floor
* [[node:dirt]] — burial tunnel floors

**Structure**
* 2 or 3 rows of burial tunnels
* Accessible from connecting caverns

**Tombstones**
Tombstones are found inside the burial tunnels. All tombstones behave identically — they differ only in appearance.
* [[item:tomb]]
* [[item:tombHead]]
* [[item:tombGrave]]
* [[item:tombStrange]]
* [[item:tombCross]]

**Inhabitants** ⏳
* [[monster:ghost]] — common
* [[monster:skeleton]] — common
* [[monster:lich]] — rare boss

**Loot** ⏳
* Tombstones — interacting triggers a combat encounter, rewards high-tier items ⏳

**Tips**
* _Tombs can be visited for rare crafting ingredients._ ⏳
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
* _[[Foraging]] mushrooms without destroying the grass allows them to regrow over time._ ⏳
  `
  },

  // ── Topsoil ───────────────────────────────────────────────────
  //    Dirt, Sand, Silt, Humus, Commpacted Earth
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
  {
    title: 'Compacted Earth',
    category: ['Surface'],
    content: `
**Description**
Compacted Earth is a dense, hardened form of soil found exclusively in [[Ant Hill]] and [[Termite Mound]] structures. It cannot be mined or destroyed by the player.

**Tier**
{{node:antdirt:star}}

**Properties**
* Indestructible — cannot be mined
* Solid — the player can walk on it

**Location**
* [[Ant Hill]] — [[Forest]] surface
* [[Termite Mound]] — [[Jungle]] surface

**Tips**
* _Compacted Earth is maintained by the colony — destroying the structure is impossible._ ⏳
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

  // ── Mettalic Ores / Chunks / Bars ──────────────────────────────────────────────────────
  //    Copper, Iron, Silver, Gold, Cobalt, Platinum
  {
    title: 'Metals',
    category: ['Crafting'],
    content: `
**Description**
Metals are the primary crafting materials in Sixty-Below. Each metal exists in three forms : ore (placed in the World), chunk (dropped when mined), and bar (smelted from chunks at a furnace).

**Forms & Transformation**

| Form | How to obtain | Notes |
|---|---|---|
| Ore | Ore veins placed in the World | Not directly usable |
| Chunk | Dropped when [[Mining]] ore | Crafting ingredient |
| Bar | Smelt chunks at a [[Smelting||Furnace]] | Higher-tier crafting |

**Metal Ores**

| Metal | Tier | Layer |
|---|---|---|---|
| [[node:copper]] | {{node:copper:star}} | [[Surface]], [[Underground]] |
| [[node:iron]] | {{node:iron:star}} | [[Underground]] |
| [[node:silver]] | {{node:silver:star}} | [[Caverns]] Top |
| [[node:gold]] | {{node:gold:star}} | [[Caverns]] |
| [[node:cobalt]] | {{node:cobalt:star}} | [[Caverns]] |
| [[node:platinum]] | {{node:platinum:star}} | [[Caverns]] Bottom |

**Metal Chunks**

Metal chunks are placed in your [[Inventory]] when mined with a [[Pickaxes||Pickaxe]].

| Ore | Chunk | Chunk Tier | Pickaxe | Pickaxe Tier |
|---|---|---|---|---|
{{metalChunksRow|copper|chunkCopper|pickaxeCopper}}
{{metalChunksRow|iron|chunkIron|pickaxeCopper}}
{{metalChunksRow|silver|chunkSilver|pickaxeIron}}
{{metalChunksRow|gold|chunkGold|pickaxeSilver}}
{{metalChunksRow|cobalt|chunkCobalt|pickaxeGold}}
{{metalChunksRow|platinum|chunkPlatinum|pickaxeCobalt}}

**Metal Bars**

| Chunk | Chunk Tier | Crafting Station | Bar | Bar Tier |
|---|---|---|---|---|
{{metalBarsRow|chunkCopper|barCopper}}
{{metalBarsRow|chunkIron|barIron}}
{{metalBarsRow|chunkSilver|barSilver}}
{{metalBarsRow|chunkGold|barGold}}
{{metalBarsRow|chunkCobalt|barCobalt}}
{{metalBarsRow|chunkPlatinum|barPlatinum}}

**Metal Bars Recipes** ⏳
* {{recipe:shellPowder}}

**Usages**

| Metal | Equipment tier | Other uses |
|---|---|---|
| [[item:barCopper]] | {{item:barCopper:star}} — basic tools & armor | ⏳ |
| [[item:barIron]] | {{item:barIron:star}} — improved tools & armor | ⏳ |
| [[item:barSilver]] | {{item:barSilver:star}} — advanced armor | ⏳ |
| [[item:barGold]] | {{item:barGold:star}} — advanced armor | ⏳ |
| [[item:barCobalt]] | {{item:barCobalt:star}} — expert armor | ⏳ |
| [[item:barPlatinum]] | {{item:barPlatinum:star}} — master armor | ⏳ |

**Tips**
* _Always bring a [[Pickaxes|Pickaxe]] strong enough to mine the ores of the layer you are exploring — deeper metals require better tools._ ⏳
* _Platinum is extremely rare and only found in the deepest caverns._ ⏳
  `
  },
  // ── Gems ─────────────────────────────────────────────────────
  //    Gems, Geode Stones
  {
    title: 'Gems',
    category: ['Crafting', 'Mining'],
    content: `
**Description**
Gems are rare crafting materials found deep underground. Each gem exists in three forms : gem deposits (placed in the World), raw gem (dropped when mined) and cut gem (shaped at a [[Stonecutting||Stonecutter]]).

**Forms & Transformation**

| Form | How to obtain | Notes |
|---|---|---|
| Gem Deposit | Gem veins placed in the World | Not directly usable |
| Raw Gem | Dropped when [[Mining]] deposits | Crafting ingredient |
| Cut Gem | Cut raw gems at a [[Stonecutting||Stonecutter]] | Crafting ingredient |

**Gem Deposits**

| Gem | Tier | Biome | Layer |
|---|---|---|---|
| [[node:topaz]] | {{node:topaz:star}} | [[Forest]] | [[Caverns]] |
| [[node:ruby]] | {{node:ruby:star}} | [[Desert]] | [[Caverns]] |
| [[node:emerald]] | {{node:emerald:star}} | [[Jungle]] | [[Caverns]] |
| [[node:sapphire]] | {{node:sapphire:star}} | All biomes | [[Caverns]] Bottom |

**Raw Gems**

Raw gems are placed in your [[Inventory]] when mined with a [[Pickaxes||Pickaxe]].

| Deposit | Raw Gem | Raw Gem Tier | Pickaxe | Pickaxe Tier |
|---|---|---|---|---|
{{gemRawRow|topaz|rawTopaz|pickaxeCopper}}
{{gemRawRow|ruby|rawRuby|pickaxeCopper}}
{{gemRawRow|emerald|rawEmerald|pickaxeIron}}
{{gemRawRow|sapphire|rawSapphire|pickaxeSilver}}

**Raw Gems Recipes** ⏳
* {{recipe:shellPowder}}

**Cut Gems**

| Raw Gem | Raw Gem Tier | Crafting Station | Cut Gem | Cut Gem Tier |
|---|---|---|---|---|
{{gemCutRow|rawTopaz|Topaz}}
{{gemCutRow|rawRuby|Ruby}}
{{gemCutRow|rawEmerald|Emerald}}
{{gemCutRow|rawSapphire|Sapphire}}

**Usages**

| Gem | Equipment tier | Other uses |
|---|---|---|
| [[item:rawTopaz]] | {{item:rawTopaz:star}} — accessories, weapons | ⏳ |
| [[item:rawRuby]] | {{item:rawRuby:star}} — accessories, weapons | ⏳ |
| [[item:rawEmerald]] | {{item:rawEmerald:star}} — accessories, weapons | ⏳ |
| [[item:rawSapphire]] | {{item:rawSapphire:star}} — accessories, weapons | ⏳ |

**Tips**
* _Gems are biome-specific — explore the right biome to find the gem you need._ ⏳
* _Always bring a [[Pickaxes|Pickaxe]] strong enough to mine the gems of the layer you are exploring._ ⏳
  `
  },

  // ── Rocks ─────────────────────────────────────────────────────
  //    Geode Stones, Obsidian, Meteorite, Hive, Shell
  {
    title: 'Geode Stones',
    category: ['Crafting', 'Mining'],
    content: `
**Description**
Geode Stones are rare decorative and structural materials found exclusively in [[Geode Cave]]s deep underground. Their distinctive crystalline appearance makes them highly sought after for construction and furniture crafting.

**Forms & Transformation**

| Form | How to obtain | Notes |
|---|---|---|
| Stone | Stone placed in [[Geode Cave]]s in the World | Not directly usable |
| Stone Block | Dropped when [[Mining]] Stones | Crafting ingredient |

**Geode Stone**

| Stone | Tier | Biome | Layer |
|---|---|---|---|
| [[node:granite]] | {{node:granite:star}} | All biomes | [[Caverns]] Bottom |
| [[node:marble]] | {{node:marble:star}} | All biomes | [[Caverns]] Bottom |

**Geode Stone Blocks**

Blocks are placed in your [[Inventory]] when mined with a [[Pickaxes||Pickaxe]].

| Deposit | Block | Block Tier | Pickaxe | Pickaxe Tier |
|---|---|---|---|---|
{{geodeRow|Granite|blockGranite|pickaxeCobalt}}
{{geodeRow|Marble|blockMarble|pickaxeCobalt}}

**Usages**

| Block | Tier | Uses |
|---|---|---|
| [[item:blockGranite]] | {{item:blockGranite:star}} | Construction, furniture ⏳ |
| [[item:blockMarble]] | {{item:blockMarble:star}} | Construction, furniture ⏳ |

**Tips**
* _Geode Caves always contain either Granite or Marble — never both._ ⏳
* _Always bring a [[Pickaxes|Pickaxe]] strong enough to mine the stones of the layer you are exploring._ ⏳
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
* Created by the player by pouring water onto [[node:lava]] ⏳

**Mining** ⏳
* {{node:obsidian:mining}}
* Requires a tier 5 [[item:pickaxePlatinum]] — applies to both natural and player-created Obsidian

**Creating Obsidian** ⏳
* Equip a [[item:water]]
* Click on an empty tile above a [[node:lava]] tile
* An Obsidian block appears at the clicked location
* _Warning : lava is extremely dangerous — keep your distance and act quickly._

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
* [[Mining]] with [[Pickaxes]] (any tier): {{node:shell:mining}}

**Main Usages** ⏳
* Basic ingredient for furntiure and construction
* Decorative ingredient for tools and weapons
* Secondary ingredient for accessories
* Can be grinded at a [[Stonecutting|Stonecutter]] in [[item:shellPowder]] {{item:shellPowder:star}}
* [[item:shellPowder]] is used in potions

**Recipes** ⏳
* {{recipe:shellPowder}}

**Tips**
* _Shell veins are protected by a [[Sandstone]] border — look for exposed Shell on cave walls to locate a vein._⏳
  `
  },

  // ── Housing (walls) ──────────────────────────────────────────
  //    Housing, Housing Buffs, Furnitures, Wood Wall, Background Wall
  {
    title: 'Housing',
    category: ['Activities', 'Housing'],
    content: `
    `
  },
  {
    title: 'Housing Buffs',
    category: ['Buff', 'Housing'],
    content: `
    Managed trough the [[item:noticeBoard]].
    `
  },
  {
    title: 'Furnitures',
    category: ['Housing'],
    content: `

    **Furnitures list**
    * [[Beds]]
    * [[Bookcases]]
    * [[Cabinets]]
    * [[Chairs]]
    * [[Chests]]
    * [[Clocks]]
    * [[Closets]]
    * [[Crafting Stations]]
    * [[Doors]]
    * [[Firecamps]]
    * [[Fireplaces]]
    * [[Platforms]]
    * [[Sofas]]
    * [[Tables]]
    * [[Tableware]]
    * [[Toilets]]
    * [[Torches]]
    `
  },
  {
    title: 'Wood Wall',
    category: ['Housing'],
    content: `
    `
  },
  {
    title: 'Background Wall',
    category: ['Housing'],
    content: `
    `
  },

  // ── Accessories ──────────────────────────────────────────────
  //    Triskels
  {
    title: 'Triskels',
    category: ['Accessory', 'Buff'],
    content: `
    `
  },

  // ── Activities Mining ────────────────────────────────────────
  //    Mining, Pickaxes, Mineable Blocks, Mining Buffs
  {
    title: 'Mining',
    category: ['Activities', 'Mining'],
    content: `
    `
  },
  {
    title: 'Pickaxes',
    category: ['Tool', 'Mining'],
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
    category: ['Mining', 'Buff'],
    content: `
    `
  },

  // ── Activities Fishing ───────────────────────────────────────
  //    Fishing, Fishing Rods, Fishing Baits, Fisheable Monsters, Fishing Buffs
  {
    title: 'Fishing',
    category: ['Activities', 'Fishing'],
    content: `
    `
  },
  {
    title: 'Fishing Rods',
    category: ['Tool', 'Fishing'],
    content: `
    `
  },
  {
    title: 'Fishing Baits',
    category: ['Bait', 'Fishing'],
    content: `
    `
  },
  {
    title: 'Fisheable Monsters',
    category: ['Fish', 'Fishing'],
    content: `
    `
  },
  {
    title: 'Fishing Buffs',
    category: ['Buff', 'Fishing'],
    content: `
    `
  },

  // ── Activities Hamming  ─────────────────────────────────────
  //    Axes
  {
    title: 'Hammers',
    category: ['Tool'],
    content: `
    `
  },

  // ── Activities Chopping  ─────────────────────────────────────
  //    Axes
  {
    title: 'Axes',
    category: ['Tool'],
    content: `
    `
  },

  // ── Activities Fighting ──────────────────────────────────────
  //    Fighting, Damage Types, Gear Prefixes, Weapons, Swords, Bows, Flamethrower
  {
    title: 'Fighting',
    category: ['Activities', 'Weapon'],
    content: `
    `
  },
  {
    title: 'Damage Types',
    category: ['Fighting'],
    content: `
**Description**
Every source of damage in Sixty-Below deals a specific type. Understanding damage types helps you choose the right equipment and potions for each environment and enemy.

**Physical Damage**

| Type | Layer | Weapon | Fauna Sources |
|---|---|---|---|
| Piercing | [[Surface]] | Bows | stingers, spines, quills |
| Slashing | [[Underground]] | Swords | jaws, mandibles, tails, claws |
| Crushing | [[Caverns]] | Hammers | legs, tails, heads |

**Damage Over Time (DOT)**

| Type | Biome | Sources | Notes |
|---|---|---|---|
| [[Bleeding DOT|Bleeding]] | [[Forest]] | [[Forest]] fauna | Deals damage over time |
| [[Fire DOT|Fire]] | [[Desert]] | [[Desert]] fauna and environment | Deals damage over time |
| [[Poison DOT|Poison]] | [[Jungle]] [[Jungle]] fauna | Deals damage over time |

**Environment**
Damage accumulates based on your position in the world. The two independent axes are applied simultaneously.

_Example : in [[Caverns]] Bottom in the [[Jungle]] monsters inflict Crushing and Poison simultaneously._

_Some monsters may deal unexpected damage types for their environment — stay alert._  ⏳
_Bosses can combine multiple physical damage types and DOT effects simultaneously._ ⏳

**Tips**
* _Physical damage is mitigated by armor and shields — invest in good equipment before exploring deeper layers._ ⏳
* _DOT effects can be cured with the appropriate antidote potion._ ⏳
* _Equip the right armor and potions before venturing into a new layer or biome._ ⏳
  `
  },
  {
    title: 'Gear Prefixes',
    category: ['Fighting', 'Crafting'],
    content: `
**Description**
Prefixes enhance weapons, armors and tools, adding special properties beyond their base stats. A piece of gear can carry at most one prefix.

**Prefixes**

| Prefix | Effect | Type |
|---|---|---|
| Quick | +PA (Action Points) | Offensive |
| Swift | +PM (Movement Points) | Mobility |
| Farshot | +PO (Range) | Mobility |
| Keen | +ATQ (Attack) | Offensive |
| Sturdy | +DEF (Defense) | Defensive |
| Extended | +Tool Range | Utility |
| Blazing | Inflicts [[Fire DOT]] on hit | DOT |
| Venomous | Inflicts [[Poison DOT]] on hit | DOT |
| Serrated | Inflicts [[Bleeding DOT]] on hit | DOT |

**Prefix Compatibility**

[[Weapons]] are split by range (Melee, Mid-range, Ranged) and [[Armors]] by slot (Head, Torso, Feet).

| Prefix | Melee | Mid-range | Ranged | Head | Torso | Feet | Tool |
|---|---|---|---|---|---|---|---|
| Quick | ✅ | ✅ | ✅ | ✅ | ✅ | | ✅ |
| Swift | | ✅ | ✅ | | | ✅ | |
| Farshot | | | ✅ | | | | |
| Keen | ✅ | ✅ | ✅ | | | | ✅ |
| Sturdy | | | | ✅ | ✅ | ✅ | ✅ |
| Extended | | | | | | | ✅ |
| Blazing | ✅ | ✅ | ✅ | | | | |
| Venomous | ✅ | ✅ | ✅ | | | | |
| Serrated | ✅ | ✅ | ✅ | | | | |

_Some specific gear pieces may deviate from these rules._ ⏳

**Obtaining Prefixes** ⏳
* Mechanics to be defined
* Found on looted gear in chests and monster drops
* Craftable at specific crafting stations ⏳

**Tips**
* _DOT prefixes are especially effective against high-health enemies — the damage adds up over time._ ⏳
* _Combine Keen with a DOT prefix for a devastating offensive build._ ⏳
* _Sturdy is essential for deep layer exploration where environmental damage accumulates._ ⏳
  `
  },
  {
    title: 'Weapons',
    category: ['Fighting', 'Weapon', 'Armor'],
    content: `
    Three ranges: Melee, Mid-range, Ranged
      `
  },
  {
    title: 'Swords',
    category: ['Weapon'],
    content: `
    `
  },
  {
    title: 'Bows',
    category: ['Weapon'],
    content: `
    `
  },
  {
    title: 'Flamethrower',
    category: ['Weapon', 'Tool'],
    content: `
**Tier**
{{node:flamethrower:star}}

**Main usages**
* Used as a tool for deleting large bulks of [[Cobweb]]⏳
    `
  },
  //    Bleeding DOT, Fire DOT, Poison DOT
  {
    title: 'Bleeding DOT',
    category: ['Buff'],
    content: `
Biome: [[Forest]]
    `
  },
  {
    title: 'Fire DOT',
    category: ['Buff'],
    content: `
Biome: [[Desert]]
    `
  },
  {
    title: 'Poison DOT',
    category: ['Buff'],
    content: `
Biome: [[Jungle]]
    `
  },

  // ── Activities Fighting ──────────────────────────────────────
  //    Armors
  {
    title: 'Armors',
    category: ['Armor'],
    content: `
    Three slots: Head, Torso, Feet
    Armor prefixes :
    `
  },

  // ── Activities Crafting ──────────────────────────────────────
  //    Crafting, Crafting Stations, Crafting Tree, Crafting Buffs
  {
    title: 'Crafting',
    category: ['Activities', 'Crafting'],
    content: `
    `
  },
  {
    title: 'Crafting Stations',
    category: ['Activities', 'Crafting'],
    content: `
**Description**
Crafting Stations are specialized workbenches that allow the player to [[Crafting|craft]] advanced items. Each station is dedicated to a specific material or craft type. Most stations must be crafted first and placed in the world.

**Starting point**
* [[Wooden Table]] — [[item:tableWood]] ⭐ — crafted by hand, unlocks the entire crafting chain

**Woodworking**
* [[Woodworking]] — [[item:workbench]] ⭐ and [[item:sawmill]] ⭐⭐⭐

**Metalworking**
* [[Smelting]] — [[item:furnace]] ⭐⭐ and [[item:blastFurnace]] ⭐⭐⭐⭐
* [[Forging]] — [[item:anvilIron]] ⭐⭐ and [[item:anvilPlatinum]] ⭐⭐⭐⭐
* [[Sharpening]] — [[item:grindstone]] ⭐⭐⭐

**Textiles**
* [[Weaving]] — [[item:loom]] ⭐⭐
* [[Leatherworking]] — [[item:tanningRack]] ⭐⭐⭐

**Other crafts**
* [[Stonecutting]] — [[item:stonecutter]] ⭐
* [[Jewelry]] — [[item:jewelerBench]] ⭐⭐⭐
* [[Alchemy]] — [[item:alchemyTable]] ⭐⭐
* [[Cooking]] — [[item:cookingPot]] ⭐⭐

**Ancient stations** ⏳
* [[Decomposer]] — found in [[Lost Temple]] ⭐⭐⭐⭐⭐
* [[Transmutator]] — found in [[Ancient House]] ⭐⭐⭐⭐⭐
  `
  },
  {
    title: 'Crafting Tree',
    category: ['Activities', 'Crafting'],
    content: `
**Description**
The crafting tree shows the order in which crafting stations must be built. Each station unlocks the next tier of crafting possibilities.

* By hand
  * [[Wooden Table]] ⭐
    * [[Woodworking|Workbench]] ⭐
      * [[Stonecutting|Stonecutter]] ⭐
        * [[Smelting|Furnace]] ⭐⭐
          * [[Cooking|Cooking Pot]] ⭐⭐
          * [[Smelting|Blast Furnace]] ⭐⭐⭐⭐
      * [[Forging|Iron Anvil]] ⭐⭐
        * [[Sharpening|Grindstone]] ⭐⭐⭐
        * [[Jewelry|Jeweler's Bench]] ⭐⭐⭐
        * [[Forging|Platinum Anvil]] ⭐⭐⭐⭐
      * [[Alchemy|Alchemy Table]] ⭐⭐
      * [[Weaving|Loom]] ⭐⭐
        * [[Leatherworking|Tanning Rack]] ⭐⭐⭐
      * [[Woodworking|Sawmill]] ⭐⭐⭐
* Found in the world ⏳
  * [[Decomposer]] ⭐⭐⭐⭐⭐ — [[Lost Temple]]
  * [[Transmutator]] ⭐⭐⭐⭐⭐ — [[Ancient House]]
  `
  },
  {
    title: 'Crafting Buffs',
    category: ['Buff', 'Crafting'],
    content: `
    `
  },

  // ── Activities Foraging ──────────────────────────────────────
  //    Foraging, Harvesting Tools (Sickles), Harvesting Buffs
  {
    title: 'Foraging',
    category: ['Activities', 'Foraging'],
    content: `
    `
  },
  {
    title: 'Harvesting Tools',
    category: ['Tool', 'Foraging'],
    content: `
    Sickles
    `
  },
  {
    title: 'Harvesting Buffs',
    category: ['Buff', 'Foraging'],
    content: `
    `
  },

  // ── Activities Logging ─────────────────────────────────────
  //    Logging, Chopping Tools (Axes), Shaking Buffs
  {
    title: 'Logging',
    category: ['Activities', 'Logging'],
    content: `
    `
  },
  {
    title: 'Chopping Tools',
    category: ['Tool', 'Logging'],
    content: `
    Sickles
    `
  },
  {
    title: 'Chopping Buffs',
    category: ['Buff', 'Logging'],
    content: `
    `
  },

  // ── Activities Shaking ─────────────────────────────────────
  //    Shaking, Shaking Tools (Hammers), Shaking Buffs
  {
    title: 'Shaking',
    category: ['Activities', 'Shaking'],
    content: `
    `
  },
  {
    title: 'Shaking Tools',
    category: ['Tool', 'Shaking'],
    content: `
    Sickles
    `
  },
  {
    title: 'Shaking Buffs',
    category: ['Buff', 'Shaking'],
    content: `
    `
  },

  // ── Activities Gardening ───────────────────────────────────
  //    Gardening, Clay Pots, Gardening Buffs
  {
    title: 'Gardening',
    category: ['Activities', 'Gardening'],
    content: `
    `
  },
  {
    title: 'Clay Pots',
    category: ['Tool', 'Gardening'],
    content: `
    Sickles
    `
  },
  {
    title: 'Gardening Buffs',
    category: ['Buff', 'Gardening'],
    content: `
    `
  },

  // ── Crafting Stations ────────────────────────────────────────
  //    Wooden Table, Woodworking, Smelting, Forging, Sharpening, Leatherworking, Weaving
  {
    title: 'Wooden Table',
    category: ['Crafting', 'Crafting Stations'],
    content: ''
  },
  {
    title: 'Woodworking',
    category: ['Crafting', 'Crafting Stations'],
    content: ''
  },
  {
    title: 'Smelting',
    category: ['Crafting', 'Crafting Stations'],
    content: ''
  },
  {
    title: 'Forging',
    category: ['Crafting', 'Crafting Stations'],
    content: ''
  },
  {
    title: 'Sharpening',
    category: ['Crafting', 'Crafting Stations'],
    content: ''
  },
  {
    title: 'Leatherworking',
    category: ['Crafting', 'Crafting Stations'],
    content: ''
  },
  {
    title: 'Weaving',
    category: ['Crafting', 'Crafting Stations'],
    content: ''
  },

  //    Stonecutting, Jewelry, Alchemy, Cooking, Decomposer, Transmutator
  {
    title: 'Stonecutting',
    category: ['Crafting', 'Crafting Stations'],
    content: ''
  },
  {
    title: 'Jewelry',
    category: ['Crafting', 'Crafting Stations'],
    content: ''
  },
  {
    title: 'Alchemy',
    category: ['Crafting', 'Crafting Stations'],
    content: ''
  },
  {
    title: 'Cooking',
    category: ['Crafting', 'Crafting Stations'],
    content: ''
  },
  {
    title: 'Decomposer',
    category: ['Crafting', 'Crafting Stations'],
    content: ''
  },
  {
    title: 'Transmutator',
    category: ['Crafting', 'Crafting Stations'],
    content: ''
  },

  // ── Tableware ────────────────────────────────────────────────
  //    Tableware, Bottles, Buckets
  {
    title: 'Tableware',
    category: ['Furniture', 'Housing'],
    content: `
**Description**
Tableware is a category of [[Furnitures]] that serve as containers for food and liquids. They can be placed on any flat-surfaced furniture ([[Wooden Table]], [[Woodworking|Workbench]], etc.) as decorative items.

**Food Containers**
Empty containers used as crafting ingredients in cooking and potion recipes. They are returned to the player's inventory upon consuming the food or potion.
* [[item:bowl]] ({{item:bowl:star}}) — soups and stews
* [[item:mug]] ({{item:botmugtle:star}}) — ales and drinks
* [[item:plate]] ({{item:plate:star}}) — solid food dishes
* [[item:trencher]] ({{item:trencher:star}}) — rustic wooden plate for simple meals

**Small Liquid Containers**
Filled directly from a liquid source in the world. Used as crafting ingredients in cooking and potion recipes.
* [[item:bottle]] ({{item:bottle:star}}) — empty bottle, filled by clicking on a liquid tile
  * [[item:water]] — [[node:water|Bottled Water]] — healing item and potion ingredient
  * [[item:honey]] — [[node:honey|Bottled Honey]] — healing item and buff
  * [[item:sap]] — [[node:sap|Bottled Sap]] — buff
* _Bottles are returned upon consuming the recipe result._ ⏳

**Large Liquid Containers**
Filled directly from a liquid source in the world. Used as tools to transport and pour liquids — the empty bucket is recovered after pouring.
* [[item:bucket]] ({{item:bucket:star}}) — empty bucket ⏳
  * [[item:bucketWater]] — Water Bucket — pour water into the world ⏳
  * [[item:bucketHoney]] — Honey Bucket — pour honey into the world ⏳
  * [[item:bucketSap]] — Sap Bucket — pour sap into the world ⏳

**See also**
* [[Bottles]] — detailed usage and recipes
* [[Buckets]] — detailed usage and liquid manipulation

**Tips**
* _Tableware can be placed on any flat-surfaced furniture as decoration._
* _Bottles are the primary ingredient for all potions — stock up early._ ⏳
* _Buckets allow precise liquid manipulation — essential for creating [[Obsidian]]._ ⏳
* _An empty bucket worn on the head provides a surprisingly effective rudimentary helmet._ ⏳
* _Place a bucket of liquid near your [[Cooking|Cooking Pot]] or [[Alchemy|Alchemy Table]] to keep a ready supply of water, honey or sap within reach._ ⏳
  `
  },
  {
    title: 'Bottles',
    category: ['Tree'],
    content: `
    * _See [[Tableware]] for the full list of containers._
    `
  },
  {
    title: 'Buckets',
    category: ['Tree'],
    content: `
    * _See [[Tableware]] for the full list of containers._
    `
  },

  // ── Furniture - Light ────────────────────────────────────────
  //    Torches, Fireplaces, Firecamps, Toilets, Doors, Beds, Chairs, Cloks
  {
    title: 'Torches',
    category: ['Furniture'],
    content: `
    `
  },
  {
    title: 'Fireplaces',
    category: ['Furniture'],
    content: `
    `
  },
  {
    title: 'Firecamps',
    category: ['Furniture'],
    content: `
    `
  },
  {
    title: 'Toilets',
    category: ['Furniture'],
    content: `
    `
  },
  {
    title: 'Doors',
    category: ['Furniture'],
    content: `
    `
  },
  {
    title: 'Beds',
    category: ['Furniture'],
    content: `
    `
  },
  {
    title: 'Chairs',
    category: ['Furniture'],
    content: `
    `
  },
  {
    title: 'Clocks',
    category: ['Furniture'],
    content: `
    `
  },
  //    Tables, Platforms, Cabinets, Closets, Bookcases, Sofas
  {
    title: 'Tables',
    category: ['Furniture'],
    content: `
    `
  },
  {
    title: 'Platforms',
    category: ['Furniture'],
    content: `
    `
  },
  {
    title: 'Cabinets',
    category: ['Furniture'],
    content: `
    48 slots
    `
  },
  {
    title: 'Closets',
    category: ['Furniture'],
    content: `
    64 slots
    `
  },
  {
    title: 'Bookcases',
    category: ['Furniture'],
    content: `
    `
  },
  {
    title: 'Sofas',
    category: ['Furniture'],
    content: `
    `
  },

  // ── Chests ───────────────────────────────────────────────────
  //    Chests
  {
    title: 'Chests',
    category: ['Tree'],
    content: `
    56 slots
    `
  },

  // ── Life Potion ──────────────────────────────────────────────
  //    Life Crystal
  {
    title: 'Life Crystal',
    category: ['Furniture'],
    content: `
    `
  },

  // ── Items & Crafting ─────────────────────────────────────────
  // ── Fauna & Critters ─────────────────────────────────────────
  // ── Buffs & Debuffs ──────────────────────────────────────────
  // ── Mechanics ────────────────────────────────────────────────

  // ── Food ─────────────────────────────────────────────────────
  //    Soups
  {
    title: 'Soups',
    category: ['Food'],
    content: `
**Tier**
{{item:vegetableSoup:star}}

**Recipes**
[[item:vegetableSoup]]
      `
  },

  // ── Plants ───────────────────────────────────────────────────
  //    Flora
  {
    title: 'Flora',
    category: ['Plant', 'Gameplay'],
    content: `
**Description**
All plants found in the world of Sixty-Below. Plants can be harvested for loot, and some may trigger an encounter when disturbed. Some plants can also be cultivated through [[Gardening]].

## Wild Plants

| Name | Tier | Type | Location | Main Loot | Encounters |
|---|---|---|---|---|---|
| [[item:coconut]] | {{item:coconut:star}} | Tree | Sea shore, Desert Oasis shore | [[item:coconut]], [[item:coconutFiber]], [[item:coconutPulp]], [[item:coconutMilk]] | [[monster:coconutCrab]] (Shaking) |
| [[item:oak]] | {{item:oak:star}} | Tree | [[Forest]] / [[Surface]] | [[item:logOak]], [[item:acorn]] | [[monster:hornet]] (Shaking) / [[monster:boar]] (Chopping) |
| [[item:mahogany]] | {{item:mahogany:star}} | Tree | [[Jungle]] / [[Surface]] | [[item:logMahogany]] | [[monster:eyelashViper]] (Shaking) / [[monster:bulletAnt]] (Chopping) |
| [[item:giantMushroom]] | {{item:giantMushroom:star}} | Tree | [[Mushroom Cave]] | ⏳ | [[monster:isopod]]  (Chopping) |
| [[item:bolete]] | {{item:bolete:star}} | Mushroom | [[Forest]] / [[Surface]] | [[item:bolete]] | [[monster:adder]] (Foraging) |
| [[item:pinkMycenia]] | {{item:pinkMycenia:star}} | Mushroom | [[Jungle]] / [[Surface]] | [[item:pinkMycenia]] | [[monster:giantRedSlug]] (Foraging) |
| [[item:coralR]] | {{item:coralR:star}} | Herb | Under Sea / [[node:sand]] | [[item:coral]] | [[monster:moray]] (Foraging) |
| [[item:coralP]] | {{item:coralP:star}} | Herb | Under Sea / [[node:sand]] | [[item:coral]] | [[monster:moray]] (Foraging) |
| [[item:coralY]] | {{item:coralY:star}} | Herb | Under Sea / [[node:sand]] | [[item:coral]] | [[monster:moray]] (Foraging) |
| [[item:coralG]] | {{item:coralG:star}} | Herb | Under Sea / [[node:sand]] | [[item:coral]] | [[monster:moray]] (Foraging) |
| [[item:ambermirage]] | {{item:ambermirage:star}} | Herb | [[Surface]] / [[node:sand]] | [[item:ambermirage]] | [[monster:scorpion]] (Foraging) |
| [[item:parsnip]] | {{item:parsnip:star}} | Herb | [[Forest]] / [[Surface]] | [[item:parsnip]] | [[monster:vole]] (Foraging) |
| [[item:sunflower]] | {{item:sunflower:star}} | Herb | [[Forest]] / [[Surface]] | [[item:sunflowerSeed]] | [[monster:hedgehog]] (Foraging) |
| [[item:bloodmoon]] | {{item:bloodmoon:star}} | Herb | [[Jungle]] / [[Surface]] | [[item:bloodmoon]] | [[monster:mamba]] (Foraging) |
| [[item:fernS]] | {{item:fernS:star}} | Herb | Fern Cave / [[node:grassfern]] | [[item:fernLeaf]] | [[monster:dendrobate]] /  [[monster:mamba]] (Foraging) |
| [[item:fernC]] | {{item:fernC:star}} | Herb | Fern Cave / [[node:grassfern]] | [[item:fernLeaf]] | [[monster:dendrobate]] /  [[monster:mamba]] (Foraging) |
| [[item:fernG]] | {{item:fernG:star}} | Herb | Fern Cave / [[node:grassfern]] | [[item:fernLeaf]] | [[monster:dendrobate]] /  [[monster:mamba]] (Foraging) |
| [[item:fernM]] | {{item:fernM:star}} | Herb | Fern Cave / [[node:grassfern]] | [[item:fernLeaf]] | [[monster:dendrobate]] /  [[monster:mamba]] (Foraging) |
| [[item:velvetmoss]] | {{item:velvetmoss:star}} | Herb | Moss Cave / [[node:grassmoss]] | [[item:velvetmoss]] | [[monster:woodlouse]] (Foraging) |

| [[item:frostcap]] | {{item:frostcap:star}} | Herb | Mushroom Cave / [[node:grassmushroom]] | [[item:mushroomGill]] | [[monster:woodlouse]] (Foraging) |
| [[item:dawncap]] | {{item:dawncap:star}} | Herb | Mushroom Cave / [[node:grassmushroom]] | [[item:mushroomGill]] | [[monster:woodlouse]] (Foraging) |
| [[item:mandrake]] | {{item:mandrake:star}} | Herb | FOREST Underground / [[node:dirt]] | [[item:mandrakeRoot]] | [[monster:wraith]] (Foraging) |
| [[item:cactus]] | {{item:cactus:star}} | Herb | DESERT Underground / [[node:sand]] | [[item:cactus]] | [[monster:scorpion]] (Foraging) |

_For detailed information on each plant, click its name._

## Gardening ⏳

Plants cultivated in [[Clay Pots]] stacked in [[Underground]] and [[Caverns]] zones. These plants are not found in the wild and require active care from the player.

_Gardening plants and their details will be added in a future update._ ⏳
  `
  },

  // ── Plants - Trees ───────────────────────────────────────────
  //    Oak & Mahogany, Giant Mushroom, Coconut
  {
    title: 'Oak & Mahogany',
    category: ['Plant', 'Forest', 'Jungle'],
    content: `
**Description**
Oaks and Mahoganies are the dominant trees of the [[Forest]] and [[Jungle]] biomes respectively. They grow on the surface, providing wood, seeds and shelter for various creatures. Both species share the same growth mechanics and interactions.
sickle
**Location**
* [[item:oak]] ({{item:oak:star}}) — [[Forest]] / [[Surface]], grows on [[node:grassForest]]
* [[item:mahogany]] ({{item:mahogany:star}}) — [[Jungle]] / [[Surface]], grows on [[node:grassJungle]]

**Growth**
* Trees grow through 5 visible stages (1 to 5)
* A new section grows every 2-3 in-game days for Oak, 3-4 days for Mahogany ⏳
* Maximum size is 5 sections

**Interactions - Shaking**

* A tree can only be shaken once per in-game day — shaking too frequently weakens the tree. ⏳

| Tree | Tool | Encounter |
| [[item:oak]] | Any [[Shaking Tools|Hammers]] | [[monster:hornet]] |
| [[item:mahogany]] | [[Shaking Tools|Iron Hammers]] or better | [[monster:eyelashViper]] |

| Tree | Drops |
| [[item:oak]] | {{item:oak:shaking:items}} |
| [[item:mahogany]] | {{item:oak:shaking:items}} |

**Interactions - Logging**

* Chopping removes one section — the tree shrinks by one stage
* When the last section is chopped, the tree disappears completely and yields an extra drop
* A chopped tree will regrow naturally over time if at least one section remains

| Tree | Tool | Encounter |
| [[item:oak]] | Any [[Chopping Tools|Axes]] | [[monster:boar]] |
| [[item:mahogany]] | [[Chopping Tools|Iron Axes]] or better | [[monster:bulletAnt]] |

| Tree | Drops | Extra Drop |
| [[item:oak]] | {{item:oak:logging:items}} | [[item:rootOak]] |
| [[item:mahogany]] | {{item:oak:logging:items}} | [[item:rootMahogany]] |

**Planting**
* Shaking and logging both yield [[item:acorn]] (Oak) or [[item:samara]] (Mahogany)
* Place a seed on 3 consecutive horizontal [[node:grassForest]] (acorn) or [[node:grassJungle]] (samara) tiles
* The tree immediately appears at stage 1 and grows naturally from there

**Tips**
* _Chopping a tree down to its last section is risky — one more chop removes it permanently._ ⏳
* _Shaking a tree is less rewarding but safer than chopping — no wood, but no stumps either._ ⏳
* _Chopping removes the tree permanently — it will not regrow unless replanted._ ⏳
* _Too many oaks reduce [[Sunflower]] growing spots — manage your forest density carefully._ ⏳
  `
  },
  {
    title: 'Giant Mushroom',
    category: ['Plant', 'Forest'],
    content: `
**Description**
Giant Mushrooms grow in the depths of [[Mushroom Cave|Mushroom Caves]], their bioluminescent caps providing the only light source in these dark caverns. They grow in dense clusters, their overlapping caps creating a spectacular underground canopy. ⏳

**Tier**
{{item:giantMushroom:star}}

**Location**
* Biome: [[Forest]]
* Layer: [[Caverns]] Top
* Grows exclusively in [[Mushroom Cave|Mushroom Caves]] on [[node:grassMushroom]]

**Growth**
* Giant Mushrooms grow through 3 stages (1 to 3)
* Growth takes several in-game days between each stage ⏳

**Interactions — Logging**

* Chopping removes one section — the mushroom shrinks by one stage
* When the last section is chopped, the mushroom disappears completely

| Tool | Drops | Extra Drop (last section) | Encounter |
|---|---|---|---|
| Any [[Chopping Tools|Axe]] | {{item:giantMushroom:logging:items}} | ⏳ | [[monster:isopod]] |

**Tips**
* _Giant Mushrooms provide natural light in [[Mushroom Cave|Mushroom Caves]] — chopping them all will leave the cave in complete darkness._ ⏳
* _Their bioluminescent spores are rare and highly valuable crafting ingredients._ ⏳
  `
  },
  {
    title: 'Coconut',
    category: ['Plant', 'Forest', 'Desert'],
    content: `
**Description**
Coconut trees grow on sandy shores — along the ocean coastline and at the edges of desert oases. Their tall silhouette and distinctive crown make them easy to spot from a distance. Unlike Oaks and Mahoganies, Coconut trees do not grow or change size.

**Tier**
{{item:coconut:star}}

**Location**
* Ocean shoreline — left and right sea borders
* Desert [[Surface Lake|Oasis]] shores
* Grows on [[node:sand]]

**Interactions — Shaking**

* A tree can only be shaken once per in-game day — shaking too frequently weakens the tree. ⏳

| Tool | Drops | Encounter |
|---|---|---|
| Any [[Shaking Tools|Hammer]] | {{item:coconut:shaking:items}} | [[monster:coconutCrab]] |

**Interactions — Logging**

* Coconut trees cannot be logged — they are permanently rooted in the sand ⏳

**Recipes**

TODO : add recipes with dropped items as ingredient⏳

**Tips**
* _Coconut trees never grow or shrink — they are a permanent fixture of the landscape._ ⏳
* _Coconut Crabs are attracted by the vibration of shaking — be ready to fight._ ⏳
* _[[item:coconutMilk]] and [[item:coconutPulp]] are valuable food ingredients._ ⏳
  `
  },

  // ── Plants - Mushrooms ───────────────────────────────────────────
  // Surface Mushrooms, Cave Mushrooms
  {
    title: 'Surface Mushrooms',
    category: ['Plant', 'Forest', 'Jungle'],
    content: `
**Description**
Surface Mushrooms grow at the base of [[Oak & Mahogany|Trees]] on the [[Forest]] and [[Jungle]] floor. Two species have been identified, each associated with a specific tree species. They appear and disappear with the night cycle, fruiting in darkness and retreating at dawn.

**Location**
* [[item:bolete]] ({{item:bolete:star}}) — [[Forest]] / [[Surface]], grows near [[Oak & Mahogany|Oak]] trees on [[node:grassForest]]
* [[item:pinkMycenia]] ({{item:pinkMycenia:star}}) — [[Jungle]] / [[Surface]], grows near [[Oak & Mahogany|Mahogany]] trees on [[node:grassJungle]]

**Blooming**

| Mushroom | Appears | Disappears |
|---|---|---|
| [[item:bolete]] | 21:00 | 9:00 |
| [[item:pinkMycenia]] | 22:00 | 7:00 |
_All times are in-game. See [[Day & Night Cycle]] for reference._

* All mushrooms of the same species appear and disappear simultaneously ⏳
* Mushrooms are more abundant during [[Weather|Rainy Weather]] ⏳

**Harvest**
* [[Foraging|Interact to harvest]] — the mushroom disappears on harvest

| Mushroom | Tool | Drops |
|  [[item:bolete]] | Any [[Harvesting Tools|Sickle]] | {{item:bolete:foraging:items}} |
|  [[item:pinkMycenia]] | [[Harvesting Tools|Iron Sickle]] or better | {{item:pinkMycenia:foraging:items}} |

**Usages**
* Food, potion and crafting ingredient. ⏳

**Dangers**
* [[monster:adder]] may attack when harvesting [[item:bolete]]. ⏳
* [[monster:giantRedSlug]] may attack when harvesting [[item:pinkMycenia]]. ⏳

**Tips**
* _Surface Mushrooms only appear at night — plan your foraging accordingly._ ⏳
* _Knowing tomorrow's weather helps plan your foraging — the [[item:bottledFrog]] accessory reveals the next day's forecast._ ⏳
* _All mushrooms of the same species appear simultaneously — a single rainy night can yield a large harvest._ ⏳
  `
  },
  {
    title: 'Cave Mushrooms',
    category: ['Plant', 'Forest'],
    content: `
**Description**
Cave Mushrooms grow on the floor of [[Mushroom Cave|Mushroom Caves]], thriving in the dim light cast by the [[Giant Mushroom|Giant Mushrooms]] above them. Two species have been identified, both pale and luminous, fruiting during daylight hours and retreating at nightfall.

**Tier**
{{item:frostcap:star}}

**Location**
* Biome: [[Forest]]
* Layer: [[Caverns]] Top
* Grows exclusively in [[Mushroom Cave|Mushroom Caves]] on [[node:grassMushroom]]

**Species**

| Name | Appearance |
|---|---|
| [[item:frostcap]] | Pale blue-white, domed cap, pearlescent sheen |
| [[item:dawncap]] | Golden yellow, flat cap, translucent |

**Blooming Hours**

| Mushroom | Appears | Disappears |
|---|---|---|
| [[item:frostcap]] | 8:30 | 21:30 |
| [[item:dawncap]] | 8:30 | 21:30 |

_All times are in-game. See [[Day & Night Cycle]] for reference._

* All cave mushrooms appear and disappear simultaneously ⏳
* Never appear on [[Weather|Sunny]] days ⏳

**Harvest**
* [[Foraging|Interact to harvest]] — the mushroom disappears on harvest
* Tool: [[Harvesting Tools|Silver Sickle]] or better ⏳
* Drops: [[item:mushroomGill]]

**Usages** ⏳
[[item:mushroomGill]] — food and crafting ingredient ⏳

**Dangers**
* [[monster:redSlug]] — common in [[Mushroom Cave|Mushroom Caves]] ⏳
* [[monster:hydra]] — uncommon, aggressive ⏳

**Tips**
* _Cave Mushrooms are the inverse of [[Surface Mushrooms]] — they fruit by day and retreat at night. Plan accordingly._ ⏳
* _Sunny days cancel all blooming — check the weather before making the trip underground._ ⏳
* _[[Giant Mushroom|Giant Mushrooms]] provide just enough light to harvest without a torch — but only just._ ⏳
  `
  },

  // ── Plants - Surface Herbs ───────────────────────────────────
  // Parsnip, Sunflower, Ambermirage, Bloodmoon, Corals
  {
    title: 'Parsnip',
    category: ['Plant', 'Forest'],
    content: `
**Description**
Parsnips are root vegetables found growing on the [[Forest]] floor. Their white flowers make them easy to spot among the undergrowth.

**Tier**
{{item:parsnip:star}}

**Location**
* Biome: [[Forest]]
* Layer: [[Surface]]
* Grows on [[node:grassForest]]

**Harvest**
* [[Foraging|Interact to harvest]] — the plant disappears on harvest
* Tool: any [[Harvesting Tools|Sickle]]⏳
* Drops: [[item:parsnip]]

**Dangers**
* Harvesting a Parsnip may disturb a [[monster:vole]] hiding among the roots — its bite inflicts [[Damage Types|Piercing]] damage and may cause [[Bleeding DOT]]. ⏳

**Usages** ⏳
* [[item:parsnip]] — food (when used, give +20 Health during 1 in-game hour)
* [[item:parsnip]] — crafting ingredient ⏳
* [[item:parsnipMash]] — when used, give +20 Health and +10 Max Health during 2 in-game hours)
* [[item:vegetableSoup]] — when used, give +20 Health and ???

**Recipes** ⏳
* [[item:parsnipMash]]
* [[item:vegetableSoup]]

**Tips**
* _Harvesting parsnips repeatedly in the same forest area will gradually deplete the local population._
* _Varying your foraging routes across different forest zones ensures a steady supply._ ⏳
  `
  },
  {
    title: 'Sunflower',
    category: ['Plant', 'Forest'],
    content: `
**Description**
Sunflowers grow in forest clearings, thriving where sunlight reaches the ground unobstructed by the canopy. They bloom at dawn and close at dusk, following the arc of the sun throughout the day.

**Tier**
{{item:sunflowerSeed:star}}

**Location**
* Biome: [[Forest]]
* Layer: [[Surface]]
* Grows on [[node:grassForest]] in open clearings, away from [[Oak & Mahogany|Oak]] trees

**Blooming Hours**
* Appears at dawn and disappears at dusk (in-game time)

**Harvest**
* [[Foraging|Interact to harvest]] — the flower disappears on harvest
* Tool: any [[Harvesting Tools|Sickle]]⏳
* Drops: [[item:sunflowerSeed]]

**Dangers**
* Harvesting a Sunflower may disturb a [[monster:hedgehog]] hiding nearby — its spines inflict [[Damage Types|Piercing]] damage and may cause [[Bleeding DOT]]. ⏳

**Planting**
* Place a [[item:sunflowerSeed]] on a [[node:grassForest]] tile to increase the chance of a Sunflower growing the next day (from 18% to 80%). ⏳

**Usages**
* [[item:sunflowerSeed]] — replanting Sunflowers ⏳
* [[item:sunflowerOil]] — extracted from seeds, essential ingredient for food and ointments ⏳
* [[item:oleanderOil]] — contains 50% [[item:sunflowerOil]] ⏳

**Tips**
* _Sunflowers only grow in clearings — planting too many [[Oak & Mahogany|Oak]] trees will eliminate their growing spots._
* _Managing your forest density is key : fewer trees means more Sunflowers, and vice versa._ ⏳
  `
  },
  {
    title: 'Ambermirage',
    category: ['Plant', 'Desert'],
    content: `
**Description**
The Ambermirage is a common desert flower that blooms only during the hottest hours of the day. Its golden petals close tightly at dawn and dusk, making it nearly invisible outside its blooming window. It never appears during rain or storms.

**Tier**
{{item:ambermirage:star}}

**Location**
* Biome: [[Desert]]
* Layer: [[Surface]]
* Grows on [[node:sand]] exposed to the sky

**Blooming Hours**
* Appears at 10:00 and disappears at 14:00 (in-game time)
* Never appears during Rainy or Stormy [[Weather]]

**Harvest**
* [[Foraging|Interact to harvest]] — the flower disappears on harvest⏳
* Tool: any [[Harvesting Tools|Sickle]]⏳
* Drops: [[item:ambermirage]]⏳

**Dangers**
* Harvesting an AmberMirage may disturb a [[monster:scorpion]] hiding beneath its petals — be ready to [[Fighting|fight]]. ⏳

**Usages** ⏳
* [[item:ambermirage]] — crafting ingredient

**Tips**
* _Plan your desert expeditions around the blooming window — Ambermirages are only available for 4 hours a day._
* _Bad [[Weather]] cancels all blooming for the entire day._ ⏳
  `
  },
  {
    title: 'Bloodmoon',
    category: ['Plant', 'Jungle'],
    content: `
**Description**
The Bloodmoon is a nocturnal flower found in the [[Jungle]] forests. Its deep crimson petals unfurl only under moonlight, making it both elusive and dangerous to harvest. Its powerful regenerative properties make it an essential ingredient for any explorer venturing [[Underground]].

**Tier**
{{item:bloodmoon:star}}

**Location**
* Biome: [[Jungle]]
* Layer: [[Surface]]
* Grows on [[node:grassJungle]]

**Blooming Hours**
* Appears at night and disappears at dawn⏳
* Does not bloom during the [[Moon Phases|New Moon]] — nourished by moonlight⏳

**Harvest**
* [[Foraging|Interact to harvest]] the flower — it will regrow next night
* Tool: any [[Harvesting Tools|Sickle]]⏳
* The plant is permanently destroyed only by [[Mining]] its supporting tile with a [[Pickaxes|Pickaxe]]
* Drops: [[item:bloodmoon]], rare chance of [[item:bloodmoonSeed]]

**Planting**
* Place a [[item:bloodmoonSeed]] on a [[node:mud]] tile to grow a new Bloodmoon plant ⏳

**Usages** ⏳
* [[item:bloodmoon]] — health regeneration during combat
* [[item:bloodmoon]] — essential ingredient for [[Underground]] potions ⏳

**Dangers**
* Harvesting a Bloodmoon at night may disturb a [[monster:mamba]] hiding among the undergrowth — its bite inflicts [[Damage Types|Piercing]] damage and [[Damage Types|Poison]]. ⏳
* Harvesting at night in the [[Jungle]] exposes you to increased fauna activity — proceed with caution. ⏳

**Tips**
* _The Bloodmoon does not bloom during the [[Moon Phases|New Moon]] — plan your foraging around the lunar cycle._
* _Its regenerative potions are essential before venturing into the [[Underground]]._ ⏳
* _The supporting tile can be mined to permanently remove the plant — useful for clearing paths, but irreversible._ ⏳
  `
  },
  {
    title: 'Corals',
    category: ['Plant', 'Ocean'],
    content: `
**Description**
Corals are marine organisms found on the sandy floor of the ocean. Four distinct species thrive in the underwater environment, each recognizable by its unique color.

**Tier**
{{item:coralR:star}}

**Location**
* Layer: Under Sea
* Grows on [[node:sand]] — ocean floor only

**Species**

| Name | Color |
|---|---|
| [[item:coralR]] | Red |
| [[item:coralP]] | Purple |
| [[item:coralY]] | Yellow |
| [[item:coralG]] | Green |

**Harvest**
* [[Foraging|Interact to harvest]] — the coral disappears on harvest
* Tool: any [[Harvesting Tools|Sickle]] ⏳
* Drops: [[item:coral]]

**Regrowth**
* Harvesting a coral triggers the slow growth of another coral elsewhere on the ocean floor
* New corals take 2 to 4 in-game days to fully grow before they can be harvested

**Usages** ⏳
* [[item:coral]] — crafting ingredient ⏳

**Dangers**
* [[monster:moray]] may attack when harvesting coral. ⏳

**Tips**
* _The ocean always maintains the same number of corals — patience is rewarded._ ⏳
* _Bring a breathing potion before diving to harvest corals._ ⏳
  `
  },

  // ── Plants - Mini-biome Herbs ────────────────────────────────
  // Ferns, Velvet Moss
  {
    title: 'Ferns',
    category: ['Plant', 'Forest'],
    content: `
**Description**
Ferns are ancient plants thriving in the humid darkness of [[Fern Cave|Fern Caves]]. Four distinct species have adapted to this underground environment, each recognizable by its unique color and frond shape. Their dense, overlapping foliage creates a lush, tangled undergrowth.

**Tier**
{{item:fernS:star}}. — Found exclusively in [[Fern Cave|Fern Caves]], a tier-3 environment.

**Location**
* Biome: [[Forest]]
* Layer: [[Underground]]
* Grows exclusively in [[Fern Cave|Fern Caves]] on [[node:grassFern]]

**Species**

| Name | Color | Shape |
|---|---|---|
| [[item:fernS]] | Very dark green, almost black | Wide, drooping fronds |
| [[item:fernC]] | Deep red | Serrated fronds |
| [[item:fernG]] | Golden, translucent | Fine, luminous fronds |
| [[item:fernM]] | Blue-grey | Vaporous, delicate fronds |

**Harvest**
* [[Foraging|Interact to harvest]] — the fern enters a dormant state and regrows after a few in-game hours
* Tool: [[Harvesting Tools|Silver Sickle]] ({{item:sickleSilver:star}}) or better⏳
* Drops: [[item:fernLeaf]], rare chance of [[item:fernSpore]]

**Planting** ⏳
* Place a [[item:fernSpore]] on a [[node:grassFern]] tile to grow a new fern ⏳
* The tile must have [[node:grassFern]] on both its left and right neighbours ⏳

**Usages** ⏳
* [[item:fernLeaf]] — crafting ingredient ⏳
* [[item:fernSpore]] — rare ingredient, planting ⏳

**Dangers**
* [[monster:dendrobate]] and [[monster:mamba]] inhabit Fern Caves — expect encounters while foraging. ⏳

**Tips**
* _Ferns grow densely and their fronds overlap — the caves can feel like a living maze._ ⏳
* _Harvesting temporarily removes the fern — return after a few hours for a fresh crop._ ⏳
* _FernSpores are rare but valuable — prioritize harvesting mature ferns._ ⏳
  `
  },
  // ── Plants - Mini-biome Herbs ────────────────────────────────
  // Ferns, Velvetmoss
  {
    title: 'Velvetmoss',
    category: ['Plant', 'Jungle'],
    content: `
**Description**
Velvetmoss is a slow-growing, deep-purple moss found exclusively in [[Moss Cave|Moss Caves]]. Its velvety surface clings to the floor and lateral walls of the cave, forming dense interconnected patches that slowly reclaim every exposed surface over time.

**Tier**
{{item:velvetmoss:star}}

**Location**
* Biome: [[Jungle]]
* Layer: [[Underground]]
* Grows exclusively in [[Moss Cave|Moss Caves]] on [[node:grassMoss]]

**Harvest**
* [[Foraging|Interact to harvest]] — the patch disappears on harvest
* Tool: [[Harvesting Tools|Silver Sickle]] or better ⏳
* Drops: [[item:velvetmoss]]

**Regrowth**
* Harvesting a patch removes it permanently from that spot — the moss does not regrow where it was picked
* Velvetmoss spreads slowly but relentlessly across every exposed [[node:grassMoss]] surface in the cave
* A new patch appears every 2 to 3 in-game days on a random unoccupied spot
* Left unharvested, the moss will eventually cover every available surface

**Terrain Effect** ⏳
* Velvetmoss secretes a thin, permanent moisture that makes every step a negotiation with gravity — the harder you push, the more it slips away from under you.
* Walking on Velvetmoss reduces movement speed ({{item:velvetmoss:buffs:movementSpeed}}%)
* See [[Movement Speed]] for details

**Placement**
* Grows on the floor (below open air) and on lateral walls (beside open air)
* Does not grow on the ceiling
* Each patch interconnects visually with its neighbours in all four directions

**Usages** ⏳
* [[item:velvetmoss]] — crafting ingredient ⏳

**Dangers**
* Harvesting Velvetmoss may disturb a colony of [[monster:millipede|Millipedes]] hidden beneath the moss — they attack in successive waves. Clear the first wave quickly or risk being overwhelmed. ⏳

**Tips**
* _Velvetmoss grows slowly but persistently — even a single unoccupied spot will eventually be claimed._ ⏳
* _Its purple hue deepens near the cave floor — patches near the ceiling tend to be paler._ ⏳
* _Harvest systematically from one side to the other — scattered harvesting wastes regrowth cycles._ ⏳
  `
  },

  // ── Plants - Underground Herbs ───────────────────────────────
  //    Mandrake, Cactus, Bamboo, Oleander
  {
    title: 'Mandrake',
    category: ['Plant', 'Forest'],
    content: `
**Description**
The Mandrake is a root plant found in the tunnels and underground passages of [[Forest]] biomes. Its gnarled, humanoid root is unmistakable — and its scream when uprooted is said to drive the unwary mad. Whether that is true or merely a story told to scare apprentice foragers is a matter of debate.

**Tier**
{{item:mandrakeRoot:star}}

**Location**
* Biome: [[Forest]]
* Layer: [[Surface]] tunnels and [[Underground]]
* Grows on [[node:dirt]]

**Population**
* The species neither grows nor declines — natural balance maintains the population
* Harvested Mandrakes do not regrow

**Harvest**
* [[Foraging|Interact to harvest]] — the plant disappears permanently on harvest
* Tool: [[Harvesting Tools|Silver Sickle]] or better ⏳
* Drops: [[item:mandrakeRoot]]

**Dangers**
* Uprooting a Mandrake releases a piercing scream that attracts a [[monster:wraith]] from the surrounding darkness. ⏳

**Usages** ⏳
* [[item:mandrakeRoot]] — crafting ingredient ⏳

**Tips**
* _Their humanoid silhouette makes them recognizable even in dim underground light._ ⏳
  `
  },
  {
    title: 'Cactus',
    category: ['Plant', 'Desert'],
    content: `
**Description**
The underground Cactus is a hardy desert plant that has adapted to the complete absence of sunlight. Its thick, ribbed trunk and characteristic branching arms are unmistakable — even in the dark tunnels of [[Desert]] biomes.

**Tier**
{{item:cactus:star}}

**Location**
* Biome: [[Desert]]
* Layer: [[Surface]] tunnels and [[Underground]]
* Grows on [[node:sand]]

**Population**
* The species neither grows nor declines — natural balance maintains the population
* Harvested Cactus do not regrow

**Harvest**
* [[Foraging|Interact to harvest]] — the plant disappears permanently on harvest
* Tool: [[Harvesting Tools|Silver Sickle]] or better ⏳
* Drops: [[item:cactus]], [[item:cactusFiber]], [[item:cactusSpine]]

**Dangers**
* Harvesting a Cactus triggers the spines — each harvest inflicts [[Bleeding DOT]] regardless of equipment. ⏳
* The disturbance may attract a [[monster:scorpion]] lurking in the surrounding tunnels. ⏳

**Usages** ⏳
* [[item:cactus]] — food and crafting ingredient ⏳
* [[item:cactusFiber]] — crafting ingredient ⏳
* [[item:cactusSpine]] — crafting ingredient ⏳

**Tips**
* _Cactus plants are well-spaced — finding one rarely means finding another nearby._ ⏳
* _Their silhouette is recognizable even without a [[Torches|Torch]] — use that to navigate._ ⏳
  `
  },
  {
    title: 'Oleander',
    category: ['Plant', 'Underground'],
    content: `
**Tier**
{{item:oleander:star}}
      `
  },

  // ── Plants - Caverns Herbs ───────────────────────────────────
  //    Amber-Moss
  {
    title: 'Amber-Moss',
    category: ['Plant', 'Forest'],
    content: `
    <<Note pour l'IA : fiche à traduire, la décision d'intégration de cette plante n'est pas encore prise>>
    La Mousse d'Ambre (Amber-Moss)
C'est une mousse d'un orange vif, presque luminescente, qui pousse exclusivement sur le côté nord des vieux chênes, là où l'humidité est constante.

**Tier**
{{item:amberMoss:star}}

**Benefits**⏳
* Hémostatique naturel (Soin) : Appliquée directement sur une plaie, elle stoppe instantanément le saignement. C'est le "pansement" de base du début de jeu.
* Allume-feu (Survie) : Une fois séchée, cette mousse devient extrêmement inflammable. Elle est indispensable pour réussir à allumer un Campfire ou une Torch.
* Filtration : Placée dans un récipient, elle peut servir de filtre rudimentaire utilisé en cuisine.


Localisation : Base of Oak trees.

Foraging : [[Foraging|Sickle]] any tier.⏳

**Usages**⏳
* onguent qui diminue de 50% les démangeaisons causées par les [[monster:hornet]]s.
      `
  },

  // ── Fishs ────────────────────────────────────────────────────
  // ── Monsters ─────────────────────────────────────────────────
  //    Spiders, Bees
  {
    title: 'Spiders',
    category: ['Monster'],
    content: `
**Loot** ⏳
* [[item:spiderFang]] ({{item:spiderFang:star}}) — common ⏳
* [[item:spiderEgg]] ({{item:spiderEgg:star}}) — common ⏳
* [[item:silk]] ({{item:silk:star}}) — rare drop⏳

Note: those ingredients can also be dropped by [[Mining]] [[Cobweb]] with any [[Pickaxes|Pickaxe]].

**Tips**
* if you are looking for [[item:silk]], prefers [[Mining]] [[Cobweb]] as the drop rate is far better
    `
  },
  {
    title: 'Bees',
    category: ['Monster'],
    content: `
    `
  },

  // ── Gameplay ─────────────────────────────────────────────────
  //    Movement Speed, Inventory, Weather, Moon Phases, World Creation
  {
    title: 'Movement Speed',
    category: ['Gameplay'],
    content: `
**Description**
Movement speed determines how fast the player moves through the world. The base speed can be altered by terrain, equipment, and buffs.

**Terrain Modifiers**

| Terrain | Effect | Location |
|---|---|---|
| [[node:web]] | -50% | [[Cobweb Cave]] and [[node:web]] hanging from ceilings of dark corners |
| [[item:velvetmoss]] | -10% | [[Moss Cave]] floor and walls |

**Equipment Modifiers** ⏳

**Buff & Debuff Modifiers** ⏳

**Tips**
* _Velvetmoss patches are visually distinct — you can plan your path to avoid them if speed matters._ ⏳
* _Boots with traction bonuses can partially offset terrain penalties._ ⏳
  `
  },
  {
    title: 'Inventory',
    category: ['Gameplay'],
    content: `
    `
  },
  {
    title: 'World Creation',
    category: ['Gameplay', 'World'],
    content: `
    `
  },

  // ── Gameplay ─────────────────────────────────────────────────
  //    Day & Night Cycle, Weather, Moon Phases
  {
    title: 'Day & Night Cycle',
    category: ['Gameplay'],
    content: `
**Description**
The world of Sixty-Below follows a continuous day/night cycle, shaped by time, [[Weather]], and [[Moon Phases]]. Surviving the night is one of the core challenges — it brings unique dangers, but also unique opportunities.

**Time Rate**

| In-game | Real World |
|---|---|
| 1 minute | 1 second |
| 1 hour | 1 minute |
| 1 full day | 24 minutes |

**Day Periods**

| Period | From | To | |
|---|---|---|---|
| Midnight | 0:00 | 2:59 | Night |
| Dawn | 3:00 | 5:59 | Night |
| Morning | 6:00 | 8:59 | Day |
| Noon | 9:00 | 11:59 | Day |
| Afternoon | 12:00 | 14:59 | Day |
| Dusk | 15:00 | 17:59 | Day |
| Evening | 18:00 | 20:59 | Day |
| Night | 21:00 | 23:59 | Night |

**Tips**
* _Night lasts 6 in-game hours — make sure you are sheltered before 21:00._ ⏳
* _Dawn and Midnight are the most dangerous periods — monsters are most active._ ⏳
  `
  },
  {
    title: 'Weather',
    category: ['Gameplay', 'Plant', 'Foraging', 'Fishing'],
    content: `

    **Buffs**
    If [[item:bottledFrog]] accessory is in your [[Inventory]], the weather for tomorow is displayed at the right of current weather.
    `
  },
  {
    title: 'Moon Phases',
    category: ['Gameplay', 'Plant', 'Foraging', 'Fishing'],
    content: `
    `
  }
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

// /////////////
// 4 HYDRATATION
// /////////////

export const hydrateHelp = (NODES, ITEMS) => {
  let count = 0
  let errors = 0

  for (const entry of HELP) {
    // 1. Vérification des liens [[...]]
    entry.content = entry.content.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (match, ref, text) => {
      // Lien node:code
      if (ref.startsWith('node:')) {
        const code = ref.slice(5)
        const node = NODES[code.toUpperCase()]
        if (!node) {
          console.error(`[help] '${entry.title}' : node inconnu '${code}'`)
          errors++
          return `⚠️ &lbrack;&lbrack;${ref}&rbrack;&rbrack;`
        }
        return match // valide — sera résolu plus tard
      }

      // Lien item:code
      if (ref.startsWith('item:')) {
        const code = ref.slice(5)
        if (!ITEMS[code]) {
          console.error(`[help] '${entry.title}' : item inconnu '${code}'`)
          errors++
          return `⚠️ &lbrack;&lbrack;${ref}&rbrack;&rbrack;`
        }
        return match // valide — sera résolu plus tard
      }

      // Lien item:code
      if (ref.startsWith('monster:')) {
        const code = ref.slice(8)
        // if (!ITEMS[code]) {
        console.warn(`[help] '${entry.title}' : monstre inconnu '${code}'`)
        errors++
        return `⚠️ &lbrack;&lbrack;${ref}&rbrack;&rbrack;`
        // }
        // return match // valide — sera résolu plus tard
      }

      // Lien helpTopic
      if (!HELP_TITLES.has(ref)) {
        console.error(`[help] '${entry.title}' : topic inconnu '${ref}'`)
        errors++
        return `⚠️ &lbrack;&lbrack;${ref}&rbrack;&rbrack;`
      }
      return match // valide — sera résolu plus tard
    })
    // TODO : résolution des données dynamiques {{...}}
    // TODO : conversion Markdown → HTML
    // TODO : entry.html = html généré
    count++
  }

  console.log('HELP', HELP) // DEBUG

  return {count, errors}
}
