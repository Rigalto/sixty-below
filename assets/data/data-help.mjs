// data-help.mjs

/*
 * ═══════════════════════════════════════════════════════════════
 * SYNTAXE DU Markdown enrichi
 * ═══════════════════════════════════════════════════════════════
 *
 * ── Consignes d'écriture ───────────────────────────────────────
 *
 *   Ne pas mettre 'Drops' dans les titres, mais 'Loot'.
 *   Ne pas mettre dans la section "See Also" une fiche cible déjà linkée dans le texte.
 *   Ne mettre une balise <hr> que si les sections qu'elles délimitent peuvent se lire seules, indépendamment de celles qui précèdent ou suivent.
 *
 * ── Markdown ───────────────────────────────────────────────────
 *   **gras**         _italique_        __souligné__
 *
 *   * puce niveau 1
 *     * puce niveau 2 (multiples niveaux, 2 espaces par niveau)
 *
 *   | col1 | col2 |   (table — ligne vide obligatoire avant et après)
 *   | ---- | ---- |
 *   Utiliser <br> pour forcer un passage à la ligne dans une cellule.
 *
 *   <hr>             → ligne horizontale (HTML direct)
 *
 *   ⚠️ Une ligne vide obligatoire entre chaque bloc
 *      (paragraphe, titre gras, liste, table, <hr>)
 *
 * ── Liens inter-fiches ──────────────────────────────────────────
 *   [[helpTopic]]                  → lien vers une fiche d'aide
 *   [[helpTopic|texte affiché]]    → lien avec texte personnalisé
 *   [[node:code]]                  → lien vers la fiche du node (node.name)
 *   [[node:code|texte affiché]]    → lien avec texte personnalisé
 *   [[item:code]]                  → lien vers la fiche de l'item (item.name)
 *   [[item:code|texte affiché]]    → lien avec texte personnalisé
 *   [[monster:code]]               → lien vers la fiche du monstre (monster.name)
 *   [[monster:code|texte affiché]] → lien avec texte personnalisé
 *   (aucun lien si la fiche courante est la cible du lien — texte seul)
 *
 * ── Données dynamiques ──────────────────────────────────────────
 *   Syntaxe générale :
 *   {{node:code:champ}}                     → valeur brute du champ
 *   {{node:code:champ|format}}              → valeur formatée
 *   {{node:code:champ:souschamp}}           → accès imbriqué
 *   {{node:code:champ:souschamp|format}}    → accès imbriqué formaté
 *   {{node:code:champ[0]:souschamp}}        → accès par index dans un tableau
 *   {{node:code:champ[0]:souschamp|format}} → accès par index dans un tableau et formatage
 *   {{node:code:champ[*]:souschamp|format}} → tous les éléments du tableau
 *   (même syntaxe pour item:code et monster:code)
 *
 *   Formats disponibles :
 *   |format|     → valeur brute (défaut si absent)
 *   |star|       → tier affiché en étoiles  ⭐⭐☆☆☆
 *   |link|       → [[obj.help|obj.name]]  (obj doit avoir .help et .name)
 *   |optional|   → chaîne vide si absent, pas de ⚠️
 *   |list|       → liste à puces  (* item\n* item\n...)
 *   |lines|      → valeurs séparées par <br>
 *   |loot|       → table de loot ⏳
 *
 *  * ── Données dynamiques des recettes ──────────────────────────
 *   Syntaxe générale :
 *   {{recipe:code|format}}
 *
 *   Formats disponibles :
 *   |station|     → affiche la station de travail utilisée sous forme de lien [[item:station]]
 *   |allStations| → affiche toutes les stations de travail utilisées sous forme de lien [[item:station]]
 *                   pour faire l'item et tous ses précurseurs
 *   |ingredients| → affiche les ingrédients d'une recette séparés par des virgules
 *   |allIngredients| → affiche tous les ingrédients utilisés sous forme de lien [[item:ingredient]]
 *                   pour faire l'item et tous ses précurseurs (les composants intermédiaires ne sont pas listés)
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
 *   ⭐  étoile pleine (tier)
 *   ☆   étoile vide  (tier)
 *
 *   ⏳  Feature non encore implémentée
 *       → Tant qu'il en reste dans le fichier, l'application n'est pas terminée.
 *
 *   ⚠️  Erreur d'hydratation (référence inconnue dans ITEMS/NODES/RECIPES)
 *       → Injecté automatiquement par le moteur à la place du code invalide.
 *       → Tolérance : la fiche s'affiche malgré l'erreur, avec le code et ⚠️ visible.
 * ═══════════════════════════════════════════════════════════════
 */

/* ====================================================================================================
   TEMPLATES
   ==================================================================================================== */

const HELP_TEMPLATES = {
  miningInfo: `
**How to mine**
Use a [[Mining Tools|{1}]] of at least ⭐{2} to mine [[node:{3}]].
Mining Loot: {{node:{3}:mining[:items[0]:item|link}}
  `,

  statTable: `
| Name | ⭐ | Speed | Sell |
| ---- | -- | ----- | ---- |
{{table:stype:{1}}}
  `,
  // templates réels en dessous

  mineableRow: '| {1} | [[node:{2}]]| {{node:{2}:star|star}} | {{node:{2}:mining:0:item:name}} | {{node:{2}:speed}} |',
  metalChunksRow: '| [[node:{1}]] | [[item:{2}]] | {{item:{2}:star|star}} | [[item:{3}]] | {{item:{3}:star|star}} |',
  metalBarsRow: '| [[item:{1}]] | {{item:{1}:star|star}} | {{recipe:{2}|station}} | [[item:{2}]] | {{item:{2}:star|star}} |',
  gemRawRow: '| [[node:{1}]] | [[item:{2}]] | {{item:{2}:star|star}} | [[item:{3}]] | {{item:{3}:star|star}} |',
  gemCutRow: '| [[item:{1}]] | {{item:{1}:star|star}} | [[Smelting|Furnace]] | [[item:{2}]] | {{item:{2}:star|star}} |',
  lootTableHeader: '| Item | Tier | Amount | Conditions | Modifiers |\n|---|---|---|---|---|',
  additiveNote: '_All modifiers are additive and stack with each other._',
  lootTable: '| Item | Tier | Amount | Conditions | Modifiers |\n|---|---|---|---|---|\n{{node:{1}:{2}:items[*]:helpRow|rows}}\n\n_All modifiers are additive and stack with each other._',
  miningDrop: '{{node:{1}:mining:items[0]:item|link}} {{node:{1}:mining:items[0]:item:star|star}}',

  // pour ajouter son tier à droite de l'item
  itemStar: '[[item:{1}]] {{item:{1}:star|star}}',
  // pour renseigner une cellule de table avec un node et son tier en dessous
  cellNodeStar: '[[node:{1}]]<br>{{node:{1}:star|star}}',
  // pour renseigner une cellule de table avec un item et son tier en dessous
  cellItemStar: '[[item:{1}]]<br>{{item:{1}:star|star}}'
}

/* ====================================================================================================
   FICHES D'AIDE
   ==================================================================================================== */

export const HELP = [
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
* Exposed to the [[Day & Night Cycle|day/night cycle]] and [[Weather]] ⏳

**Materials**

* [[node:grassForest]], [[node:dirt]] — [[Forest]]
* [[node:sand]], [[node:sandstone]] — [[Desert]]
* [[node:grassJungle]], [[node:silt]] — [[Jungle]]

**Resources**

* [[item:chunkCopper]], [[item:chunkIron]] — common
* Surface plants and critters ⏳

**Mini-biomes**

* [[Ant Hill]] — [[Forest]]
* [[Antlion Pit]] — [[Desert]]
* [[Termite Mound]] — [[Jungle]]
* [[Surface Lake]] — All biomes

**Damage type**

* Piercing

**Tips**

* _The safest layer — ideal for early game exploration._
* _[[Day & Night Cycle|Day/night cycle]] affects fauna behaviour and spawning._ ⏳
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

* [[node:stone]], [[node:clay]] — [[Forest]]
* [[node:sandstone]], [[node:stone]] — [[Desert]]
* [[node:mud]], [[node:clay]] — [[Jungle]]

**Resources**

* [[item:chunkCopper]], [[item:chunkIron]], [[item:chunkSilver]] — common

**Mini-biomes**

* [[Fern Cave]] — [[Forest]]
* [[Moss Cave]] — [[Jungle]]
* [[Sand Pocket]] — [[Desert]]
* [[Ruined Cabin]] — [[Forest]]
* [[Pyramid]] — [[Desert]]
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
* [[node:hellstone]] — [[Jungle]], rare in other biomes
* [[node:granite]], [[node:marble]] — [[Geode Cave]]s

**Resources**

* [[item:chunkGold]], [[item:chunkCobalt]], [[item:chunkPlatinum]] — rare to very rare
* [[item:rawTopaz]], [[item:rawRuby]], [[item:rawEmerald]], [[item:rawSapphire]] — rare to very rare⏳
* [[item:blockGranite]], [[item:blockMarble]] — [[Geode Cave]]s

**Mini-biomes**

* [[Mushroom Cave]] — [[Forest]], Caverns Top
* [[Hive]] — [[Jungle]], Caverns Top
* [[Fossil Vein]] — [[Desert]], Caverns Top
* [[Cobweb Cave]] — all biomes
* [[Geode Cave]] — all biomes, Caverns Bottom
* [[Blind Lake]] — all biomes, Caverns Bottom
* [[Sap Pocket]] — [[Jungle]], Caverns Bottom
* [[Ancient House]] — [[Desert]], Caverns Bottom
* [[Lost Temple]] — [[Jungle]], Caverns Top
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
| [[monster:blueSlug]] | Common, passive | Ambient <br> Harvesting [[Cave Mushrooms]] <br> Chopping [[Giant Mushroom|Giant Mushrooms]] |
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

**Loot** ⏳

* [[item:blockShell]] — mined from the vein
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

The Ancient House is a large desert dwelling buried deep in [[Desert]] biomes. Unlike the [[Ruined Cabin]], it is remarkably well preserved — its walls still standing, its roof intact, and its interior furnished. It contains the [[Transmutator]], a powerful [[Crafting Stations|crafting station]].

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

Hives are large circular caverns built by [[Bees]] deep in [[Jungle]] biomes. Their walls are made of [[node:hive]] blocks, which can be further processed into [[item:beeswax]], and their interior is filled with [[node:honey]], one of the most valuable liquids in the game. The inhabitants defend their home aggressively.

**Main Location**

* [[Caverns]] Top — [[Jungle]]

**Materials**

* [[node:hive]] — walls
* [[node:honey]] — fills the interior

**Access**

* A diagonal tunnel connects the Hive to the surrounding caverns.

**Inhabitants** ⏳

| Monster | Rarity |
|---|---|
| [[monster:bee]] | Common |
| [[monster:hornet]] | Uncommon |
| [[monster:beeQueen]] | Boss |

**Loot** ⏳

* [[node:honey]] — forms pools on the floor, abundant but dangerous to collect while [[Bees]] are present
  * Collected with a [[item:bottle]] in hand → <<itemStar|honey>>
* [[node:hive]] — makes up the walls and ceiling of the Hive
  * [[Mining|Mined]] with an [[item:pickaxeIron]] or better → **<<itemStar|blockHive>>**
  * [[item:blockHive]] can be [[Crafting|smelted]] in a [[item:cookingPot]] → **<<itemStar|beeswax>>**

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

The Lost Temple is an ancient Greek-style structure buried deep in the [[Jungle]] biomes. Built from indestructible [[node:Olympite]] blocks, it has stood for millennia, its columns still standing despite the encroaching jungle. A powerful guardian protects the secrets within — and the key to a unique [[Crafting Stations|crafting station]].

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
  * Wave 1 : 4 x [[monster:harpy]]
  * Wave 2 : 4 x [[monster:cyclops]]
  * Wave 3 : 2 x [[monster:harpy]], 2 x [[monster:cyclops]], 1 x [[monster:minotaur]] (boss)
* The Minotaur drops [[item:decomposerPart]] on defeat

**The Decomposer** ⏳

* The [[item:brokenDecomposer]] becomes usable after repair
* To repair : equip [[item:decomposerPart]] and click on the [[item:brokenDecomposer]]
* The [[item:brokenDecomposer]] is replaced by the [[item:decomposer]] — a powerful tier 5 [[Crafting Stations||crafting station]]
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
* Layer: [[Surface]]

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

**Tier**

{{node:web:star|star}}

**Main Location**

* [[Cobweb Cave]]s — concentrated, all biomes
* All tunnels and caverns — scattered, all biomes

**Collection** ⏳

* Mine with any [[Mining Tools|Pickaxes]] — drops [[item:silk]] {{item:silk:star|star}}
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
* Walking through [[node:web]] reduces Movement Speed ({{node:web:buffs:movementSpeed}}%)
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

* _Blind Lakes have no natural entrance — bring a [[Mining Tools|pickaxe]]._
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

  // ── Liquids ───────────────────────────────────────────────────
  //    Sea, Water, Honey, Sap
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

* <<itemStar|bottle>> — small quantity
* <<itemStar|bucket>> — large quantity

**Tips**

* _Water puddles form naturally in tunnels and caverns._
* _Removing the solid tile bordering a lake or a puddle will cause the water to flow._ ⏳
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

* <<itemStar|bottle>> — small quantity
* <<itemStar|bucket>> — large quantity

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

* <<itemStar|bottle>> — small quantity
* <<itemStar|bucket>> — large quantity

**Tips**

* _Sap Pockets are sealed by [[node:sandstone]] borders — removing them releases the sap._ ⏳
* _Sap is even more viscous than [[node:honey]] — movement is severely impaired._ ⏳
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

{{node:grassForest:star|star}}

**Main Location**

* [[Surface]] — [[Forest]], top layer of solid ground

**Mining Loot** ⏳

Mining Tool: [[item:pickaxeCopper]] ({{item:pickaxeCopper:star|star}}) or better

<<lootTable|grassForest|mining>>

**Foraging Loot** ⏳

Harvesting Tool: [[item:sickleCopper]] ({{item:sickleCopper:star|star}}) or better

<<lootTable|grassForest|foraging>>

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

{{node:grassJungle:star|star}}

**Main Location**

* [[Surface]] — [[Jungle]], top layer of solid ground

**Loot** ⏳

* <<miningDrop|grassJungle>>

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

{{node:grassFern:star|star}}

**Main Location**

* [[Fern Cave]] floor — [[Underground]], [[Forest]]

**Loot** ⏳

* <<miningDrop|grassFern>>

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

{{node:grassMoss:star|star}}

**Main Location**

* [[Moss Cave]] walls and floor — [[Underground]], [[Jungle]]

**Loot** ⏳

* {{node:grassMoss:mining:items[0]:item|link}}


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

{{node:grassMushroom:star|star}}

**Main Location**

* [[Mushroom Cave]] floor — [[Caverns]] Top, [[Forest]]

**Loot** ⏳

* <<miningDrop|grassMushroom>>

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

{{node:dirt:star|star}}

**Main Location**

* [[Surface]] and [[Underground]] — [[Forest]], high density

**Loot** ⏳

* <<miningDrop|dirt>>
* {{node:dirt:mining:items[1]:item|link}}

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

{{node:sand:star|star}}

**Main Location**

* [[Surface]] and [[Underground]] — [[Desert]], high density
* [[Sand Pocket]]s — [[Underground]], [[Desert]]

**Loot** ⏳

* <<miningDrop|sand>>

**Tips**

* _Sand falls when the tile below is empty — be careful when mining near Sand Pockets._
* _Sand Pockets are sealed by [[node:sandstone]] borders — removing them releases the sand._ ⏳
  `
  },
  {
    title: 'Silt',
    category: ['Topsoil'],
    content: `
**Description**

Silt is the primary topsoil of [[Jungle]] biomes. Its fine, damp texture supports the dense jungle vegetation above.

**Tier**

{{node:silt:star|star}}

**Main Location**

* [[Surface]] and [[Underground]] — [[Jungle]], high density

**Loot** ⏳

* <<miningDrop|silt>>

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

{{node:humus:star|star}}

**Main Location**

* [[Underground]] and [[Caverns]] Top — [[Forest]] and [[Jungle]], moderate density
* [[Fern Cave]] floor — [[Forest]]
* [[Mushroom Cave]] floor — [[Forest]]

**Loot** ⏳

* <<miningDrop|humus>>

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

{{node:antdirt:star|star}}

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

{{node:clay:star|star}}

**Main Location**

* [[Surface]] and [[Underground]] — [[Forest]], high density

**Loot** ⏳

* <<miningDrop|clay>>

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

{{node:stone:star|star}}

**Main Location**

* [[Underground]] — [[Forest]], dominant (native substrat)
* [[Caverns]] Top — [[Forest]], moderate density

**Loot** ⏳

* <<miningDrop|stone>>

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

{{node:hardstone:star|star}}

**Main Location**

* [[Caverns]] — [[Forest]], dominant (native substrat)

**Loot** ⏳

* <<miningDrop|hardstone>>

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

{{node:sandstone:star|star}}

**Main Location**

* [[Surface]] and [[Underground]] — [[Desert]], high density
* [[Sea]] borders
* [[Sand Pocket]]: [[Caverns]] — [[Desert]]

**Loot** ⏳

* <<miningDrop|sandstone>>

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

{{node:ash:star|star}}

**Main Location**

* [[Underground]] — [[Desert]], dominant (native substrat)
* [[Caverns]] Top — [[Desert]], moderate density

**Loot** ⏳

* <<miningDrop|ash>>

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

{{node:hellstone:star|star}}

**Main Location**

* [[Caverns]] — [[Desert]], dominant (native substrat)

**Loot** ⏳

* <<miningDrop|hellstone>>

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

{{node:mud:star|star}}

**Main Location**

* [[Surface]] and [[Underground]] — [[Jungle]], high density
* [[Moss Cave]] walls and floor

**Loot** ⏳

* <<miningDrop|mud>>

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

{{node:limestone:star|star}}

**Main Location**

* [[Underground]] — [[Jungle]], dominant (native substrat)
* [[Caverns]] Top — [[Jungle]], moderate density

**Loot** ⏳

* <<miningDrop|limestone>>

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

{{node:slate:star|star}}

**Main Location**

* [[Caverns]] — [[Jungle]], dominant (native substrat)

**Loot** ⏳

* <<miningDrop|slate>>

**Recipes** ⏳

* {{recipe:slateBlock}}
  `
  },

  // ── Metallic Ores / Chunks / Bars ────────────────────────────
  //    Metals, Metal Fittings (Copper, Iron, Silver, Gold, Cobalt, Platinum)
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
| Bar | Smelt chunks at a [[item:furnace]] | Higher-tier crafting |

**Metal Ores**

| Metal | Tier | Layer |
|---|---|---|---|
| [[node:copper]] | {{node:copper:star|star}} | [[Surface]], [[Underground]] |
| [[node:iron]] | {{node:iron:star|star}} | [[Underground]] |
| [[node:silver]] | {{node:silver:star|star}} | [[Caverns]] Top |
| [[node:gold]] | {{node:gold:star|star}} | [[Caverns]] |
| [[node:cobalt]] | {{node:cobalt:star|star}} | [[Caverns]] |
| [[node:platinum]] | {{node:platinum:star|star}} | [[Caverns]] Bottom |

**Metal Chunks**

Metal chunks are placed in your [[Inventory]] when mined with a [[Mining Tools|Pickaxe]].

| Ore | Chunk | Chunk Tier | Pickaxe | Pickaxe Tier |
|---|---|---|---|---|
<<metalChunksRow|copper|chunkCopper|pickaxeCopper>>
<<metalChunksRow|iron|chunkIron|pickaxeCopper>>
<<metalChunksRow|silver|chunkSilver|pickaxeIron>>
<<metalChunksRow|gold|chunkGold|pickaxeIron>>
<<metalChunksRow|cobalt|chunkCobalt|pickaxeGold>>
<<metalChunksRow|platinum|chunkPlatinum|pickaxeCobalt>>

**Metal Bars**

| Chunk | Chunk Tier | Crafting Station | Bar | Bar Tier |
|---|---|---|---|---|
<<metalBarsRow|chunkCopper|barCopper>>
<<metalBarsRow|chunkIron|barIron>>
<<metalBarsRow|chunkSilver|barSilver>>
<<metalBarsRow|chunkGold|barGold>>
<<metalBarsRow|chunkCobalt|barCobalt>>
<<metalBarsRow|chunkPlatinum|barPlatinum>>

**Metal Fittings**

The table below details the [[Metal Fittings]] available for each material, including _Fasteners_ (Nail, Rivet, Chain, Wire) and _Parts_ (Plate, Rod, Strip).

| Metal | Nail | Rivet | Chain | Wire | Plate | Rod | Strip |
|---|---|---|---|---|---|---|---|
| **Copper** | - | - | ✅ | ✅ | ✅ | - | ✅ |
| **Iron** | ✅ | - | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Silver** | - | - | ✅ | - | - | ✅ | ✅ |
| **Gold** | - | - | - | ✅ | ✅ | ✅ | - |
| **Cobalt** | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ |
| **Platinum** | - | ✅ | - | - | ✅ | ✅ | ✅ |


**Usages**

| Metal | Equipment tier | Other uses |
|---|---|---|
| [[item:barCopper]] | {{item:barCopper:star|star}} — basic tools & armor | ⏳ |
| [[item:barIron]] | {{item:barIron:star|star}} — improved tools & armor | ⏳ |
| [[item:barSilver]] | {{item:barSilver:star|star}} — advanced armor | ⏳ |
| [[item:barGold]] | {{item:barGold:star|star}} — advanced armor | ⏳ |
| [[item:barCobalt]] | {{item:barCobalt:star|star}} — expert armor | ⏳ |
| [[item:barPlatinum]] | {{item:barPlatinum:star|star}} — master armor | ⏳ |

**Tips**

* _Always bring a [[Mining Tools|Pickaxe]] strong enough to mine the ores of the layer you are exploring — deeper metals require better tools._ ⏳
* _Despite being a Tier 1 resource, Copper's ductility ensures its continued use in complex apparatuses across all Tiers._
* _Platinum is extremely rare and only found in the deepest caverns._
  `
  },
  {
    title: 'Metal Fittings',
    category: ['Forging'],
    content: `
**Description**

TODO

The table below details the [[Metal Fittings]] available for each material, including _Fasteners_ (Nail, Rivet, Chain, Wire) and _Parts_ (Plate, Rod, Strip).

**Crafting Stations**

* [[item:anvil]] : Copper, Iron, Silver and Gold
* [[item:forge]] : Cobalt and Platinum

**Fasteners**

| Metal | Nail | Rivet | Chain | Wire |
|---|---|---|---|---|
| **Copper** | - | - | <<cellItemStar|chainCopper>> | <<cellItemStar|wireCopper>> |
| **Iron** | <<cellItemStar|nailIron>> | - | <<cellItemStar|chainIron>> | <<cellItemStar|wireIron>> |
| **Silver** | - | - | <<cellItemStar|chainSilver>> | - |
| **Gold** | - | - | - | <<cellItemStar|wireGold>> |
| **Cobalt** | <<cellItemStar|nailCobalt>> | <<cellItemStar|rivetCobalt>> | - | <<cellItemStar|wireCobalt>> |
| **Platinum** | - | <<cellItemStar|rivetPlatinum>> | - | - |

**Parts**

| Metal | Plate | Rod | Strip |
|---|---|---|---|
| **Copper** | <<cellItemStar|plateCopper>> | - | yes |
| **Iron** | <<cellItemStar|plateIron>> | yes | yes |
| **Silver** | - | yes | yes |
| **Gold** | <<cellItemStar|plateGold>> | yes | - |
| **Cobalt** | <<cellItemStar|plateCobalt>> | yes | yes |
| **Platinum** | <<cellItemStar|platePlatinum>> | yes | yes |
    `
  },
  // ── Gems ─────────────────────────────────────────────────────
  //    Gems, Geode Stones
  {
    title: 'Gems',
    category: ['Crafting', 'Mining'],
    content: `
**Description**

Gems are rare crafting materials found deep underground. Each gem exists in three forms : gem deposits (placed in the World), raw gem (dropped when mined) and cut gem (shaped at a [[item:stoneBench]]).

**Forms & Transformation**

| Form | How to obtain | Notes |
|---|---|---|
| Gem Deposit | Gem veins placed in the World | Not directly usable |
| Raw Gem | Dropped when [[Mining]] deposits | Crafting ingredient |
| Cut Gem | Cut raw gems at a [[item:stoneBench]] | Crafting ingredient |

**Gem Deposits**

| Gem | Tier | Biome | Layer |
|---|---|---|---|
| [[node:topaz]] | {{node:topaz:star|star}} | [[Forest]] | [[Caverns]] |
| [[node:ruby]] | {{node:ruby:star|star}} | [[Desert]] | [[Caverns]] |
| [[node:emerald]] | {{node:emerald:star|star}} | [[Jungle]] | [[Caverns]] |
| [[node:sapphire]] | {{node:sapphire:star|star}} | All biomes | [[Caverns]] Bottom |

**Raw Gems**

Raw gems are placed in your [[Inventory]] when mined with a [[Mining Tools|Pickaxe]].

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
| [[item:rawTopaz]] | {{item:rawTopaz:star|star}} — accessories, weapons | ⏳ |
| [[item:rawRuby]] | {{item:rawRuby:star|star}} — accessories, weapons | ⏳ |
| [[item:rawEmerald]] | {{item:rawEmerald:star|star}} — accessories, weapons | ⏳ |
| [[item:rawSapphire]] | {{item:rawSapphire:star|star}} — accessories, weapons | ⏳ |

**Tips**

* _Gems are biome-specific — explore the right biome to find the gem you need._ ⏳
* _Always bring a [[Mining Tools|Pickaxe]] strong enough to mine the gems of the layer you are exploring._ ⏳
  `
  },

  // ── Rocks ─────────────────────────────────────────────────────
  //    Block Directory, Geode Stones, Obsidian, Meteorite, Hive, Shell
  {
    title: 'Block Directory',
    category: ['Topsoil', 'Substrat', 'Rock'],
    content: `
**Description**

A complete reference of all solid tile types found in the world of Sixty-Below.

<hr>

**Substrats**

Native solid layers of each biome, from surface to bedrock.

| Type | Layer | Forest | Desert | Jungle |
|---|---|---|---|---|
| Natural | [[Surface]] | <<cellNodeStar|grassForest>> | — | <<cellNodeStar|grassJungle>> |
| Topsoil | [[Surface]] | <<cellNodeStar|dirt>> | <<cellNodeStar|sand>> | <<cellNodeStar|silt>> |
| Substrat | [[Surface]] | <<cellNodeStar|clay>> | <<cellNodeStar|sandstone>> | <<cellNodeStar|mud>> |
| Substrat | [[Underground]] | <<cellNodeStar|stone>> | <<cellNodeStar|ash>> | <<cellNodeStar|limestone>> |
| Substrat | [[Caverns]] | <<cellNodeStar|hardstone>> | <<cellNodeStar|hellstone>> | <<cellNodeStar|slate>> |

<hr>

**Metal Ores**

Found in all biomes regardless of substrat. See [[Metals]] for chunks, bars and recipes.

| Ore | Tier | Main layer |
|---|---|---|
| [[node:copper]] | {{node:copper:star|star}} | [[Surface]] · [[Underground]] |
| [[node:iron]] | {{node:iron:star|star}} | [[Underground]] |
| [[node:silver]] | {{node:silver:star|star}} | [[Caverns|Caverns top]] |
| [[node:gold]] | {{node:gold:star|star}} | [[Caverns]] |
| [[node:cobalt]] | {{node:cobalt:star|star}} | [[Caverns]] |
| [[node:platinum]] | {{node:platinum:star|star}} | [[Caverns|Caverns bottom]] |

<hr>

**Gems**

Rare deposits found only in deep caverns. Each biome has one native gem; Sapphire is transversal. See [[Gems]] for raw gems, cut gems and recipes.

| Gem | Tier | Forest | Desert | Jungle |
|---|---|---|---|---|
| [[node:topaz]] | {{node:topaz:star|star}} | [[Caverns]] | — | — |
| [[node:ruby]] | {{node:ruby:star|star}} | — | [[Caverns]] | — |
| [[node:emerald]] | {{node:emerald:star|star}} | — | — | [[Caverns]] |
| [[node:sapphire]] | {{node:sapphire:star|star}} | [[Caverns|Caverns bottom]] | [[Caverns|Caverns bottom]] | [[Caverns|Caverns bottom]] |

<hr>

**Rocks**

Uncommon solid blocks found in specific geological formations, mini-biomes or world events — independent of the native substrat.

| Rock | Tier | Location |
|---|---|---|
| [[node:shell]] | {{node:shell:star|star}} | Shores of the [[Sea]] [[Fossil Vein]]s |
| [[node:hive]] | {{node:hive:star|star}} | [[Hive]]s - [[Jungle]] [[Underground]] |
| [[node:granite]] | {{node:granite:star|star}} | [[Caverns]] |
| [[node:marble]] | {{node:marble:star|star}} | [[Caverns]] |
| [[node:obsidian]] | {{node:obsidian:star|star}} | [[Caverns|Caverns bottom]] |
| [[node:meteorite]] | {{node:meteorite:star|star}} | [[Surface]] after a [[Meteor Strikes]] |

**Miscellaneous**

| Type | Block | Tier | Location |
|---|---|---|---|
| - | [[node:web]] | {{node:web:star|star}} | sticky blocks hanging from ceiling<br>More abundant in [[Cobweb Cave]]s |
| Topsoil | [[node:humus]] | {{node:humus:star|star}} | [[Moss Cave]] and [[Fern Cave]] |
| Topsoil | [[node:grassMushroom]] | {{node:grassMushroom:star|star}} | [[Mushroom Cave]] |
| Topsoil | [[node:grassFern]] | {{node:grassFern:star|star}} | [[Fern Cave]] |
| Topsoil | [[node:grassMoss]] | {{node:grassMoss:star|star}} | [[Moss Cave]] |

**Tips**
- See also [[Mineable Blocks]]
  `
  },
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
| [[node:granite]] | {{node:granite:star|star}} | All biomes | [[Caverns]] Bottom |
| [[node:marble]] | {{node:marble:star|star}} | All biomes | [[Caverns]] Bottom |

**Geode Stone Blocks**

Blocks are placed in your [[Inventory]] when mined with a [[Mining Tools|Pickaxe]].

| Deposit | Block | Block Tier | Pickaxe | Pickaxe Tier |
|---|---|---|---|---|
{{geodeRow|Granite|blockGranite|pickaxeCobalt}}
{{geodeRow|Marble|blockMarble|pickaxeCobalt}}

**Usages**

| Block | Tier | Uses |
|---|---|---|
| [[item:blockGranite]] | {{item:blockGranite:star|star}} | Construction, furniture ⏳ |
| [[item:blockMarble]] | {{item:blockMarble:star|star}} | Construction, furniture ⏳ |

**Tips**

* _Geode Caves always contain either Granite or Marble — never both._ ⏳
* _Always bring a [[Mining Tools|Pickaxe]] strong enough to mine the stones of the layer you are exploring._ ⏳
  `
  },
  {
    title: 'Obsidian',
    category: ['Rock'],
    content: `
**Description**

Obsidian is a volcanic glass formed where lava meets water. It is one of the hardest materials in the world, requiring high-tier tools to mine.

**Tier**

{{node:obsidian:star|star}}

**Main Location**

* [[Caverns]] — all biomes, rare clusters
* Created by the player by pouring water onto [[node:lava]] ⏳

**Mining** ⏳

* {{node:obsidian:mining:items[0]:item|link}}
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

Meteorite is an extraterrestrial rock that falls from the sky in rare [[Events]]. It glows faintly and has unique properties not found in any other material.

**Tier**

{{node:meteorite:star|star}}

**Main Location**

* Impact craters on the [[Surface]] — random [[Events]] ⏳
* Rare clusters near impact sites ⏳

**Loot** ⏳

* {{node:meteorite:mining:items[0]:item|link}}

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

{{node:hive:star|star}}

**Main Location**

* [[Hive]] walls — [[Jungle]], [[Caverns]] Top

**Loot** ⏳

* {{node:hive:mining:items[0]:item|link}}

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

{{node:shell:star|star}}

**Main Location**

* [[Fossil Vein]] — [[Desert]], [[Caverns]] Top
* [[Sea]] borders and floor — slow regeneration ⏳

**Loot** ⏳

* [[Mining]] with [[Mining Tools|Pickaxes]] (any tier): {{node:shell:mining:items[0]:item|link}}


**Main Usages** ⏳

* Basic ingredient for furntiure and construction
* Decorative ingredient for tools and weapons
* Secondary ingredient for accessories
* Can be grinded at a [[item:stoneBench]] in [[item:shellPowder]] {{item:shellPowder:star|star}}
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
* [[item:campfire]]
* [[Fireplaces]]
* [[item:platformOak]]
* [[Sofas]]
* [[Tables]]
* [[Tableware]]
* [[Toilets]]
* [[item:torch]]
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
  //    Accessories, Trinkets, Clocks, Sextant , Triskels, Ruler, Stopwatch, Astrolabe, Chronometer, Astrarium

  {
    title: 'Accessories',
    category: ['Accessory', 'Buff', 'Trinket'],
    content: `
**Description**

**How to use**

Unlike [[Trinkets]], Accessories must be placed in a dedicated Accessory slot in your [[Inventory]] to activate their effect. Simply carrying one in your bag is not enough.
    `
  },
  {
    title: 'Trinkets',
    category: ['Trinket', 'Buff', 'Accessory'],
    content: `
**Description**

⏳

**How to use**

Unlike [[Accessories]], Trinkets do not need to be placed in a dedicated slot — carrying one anywhere in your [[Inventory]] is enough to activate its effect.

**Trinket List**

[[Control Panel]] improvements:

| Trinket | Tier | Effect |
|---|---|---|
| [[item:clockCopper]] | {{item:clockCopper:star|star}} | Improve [[Day & Night Cycle|Time]] accuracy |
| [[item:clockSilver]] | {{item:clockSilver:star|star}} | Improve [[Day & Night Cycle|Time]] accuracy |
| [[item:clockGold]] | {{item:clockGold:star|star}} | Improve [[Day & Night Cycle|Time]] accuracy |
| [[item:bottledFrog]] | {{item:bottledFrog:star|star}} | Give [[Weather]] forecast |
| [[item:sextant]] | {{item:sextant:star|star}} | Improve [[Moon Phases]] accuracy |
| [[item:ruler]] | {{item:ruler:star|star}} | Display your position |
| [[item:stopwatch]] | {{item:stopwatch:star|star}} | Display your [[Movement Speed]] bonus in the [[Control Panel]] |
| [[item:astrolabe]] | {{item:astrolabe:star|star}} | Give [[Weather]] forecast and improve [[Moon Phases]] accuracy |
| [[item:chronometer]] | {{item:chronometer:star|star}} | Display your position and your [[Movement Speed]] bonus |
| [[item:astrarium]] | {{item:astrarium:star|star}} | Display [[Weather]] forecast, your position and your [[Movement Speed]] bonus. Also improve [[Day & Night Cycle|Time]] and [[Moon Phases]] accuracy |

Grid and Range Display:

To be defined. ⏳

    `
  },
  {
    title: 'Bottled Frog',
    category: ['Trinket'],
    content: `
**Description**

The [[item:bottledFrog]] is a [[Trinkets|Trinket]] that reveals tomorrow's weather forecast in the [[Control Panel]].

Without it, only the current weather is displayed. Carrying the [[item:bottledFrog]] in your [[Inventory]] adds the forecast for the following day alongside it.

See [[Weather]] for the complete weather type table.

**Acquisition**

* Tier: {{item:bottledFrog:star|star}}
* Crafting Station: {{recipe:bottledFrog|station}}
* Crafting Materials: {{recipe:bottledFrog|ingredients}}

**Upgrade**

* Combine with a [[item:sextant]] to craft an [[item:astrolabe]] — a single trinket providing both weather forecast and moon detail.
* The [[item:astrolabe]] can be further combined into an [[item:astrarium]] — the ultimate trinket providing complete environmental awareness.

**Tips**

* _Knowing tomorrow's weather helps planning outdoor activities, fishing trips and combat preparation._

**See also**

* [[Environment Panel]] — overview of all display features
* [[Weather]] — full weather type table and gameplay effects
* [[Trinkets]] — full list of trinkets and their effects
  `
  },
  {
    title: 'Clocks',
    category: ['Trinket'],
    content: `
    **Description**

Clocks are [[Trinkets|Trinkets]] that improve the accuracy of the time display in the [[Control Panel]].

Without any clock, [[Day & Night Cycle|Time]] is shown rounded to the nearest 3-hour period. Each clock tier offers a finer precision. Only the most accurate clock in your [[Inventory]] applies — carrying multiples has no additional effect.

| Clock | Tier | Accuracy |
|---|---|---|
| (none) | — | 3 in-game hours |
| [[item:clockCopper]] | {{item:clockCopper:star|star}} | 1 in-game hour |
| [[item:clockSilver]] | {{item:clockSilver:star|star}} | 15 in-game minutes |
| [[item:clockGold]] | {{item:clockGold:star|star}} | 5 in-game minutes |

**Furniture**

A [[item:grandfatherClock]] placed nearby also improves time precision, without occupying an [[Inventory]] slot.⏳

**Acquisition**

* [[item:clockCopper]] — Tier: {{item:clockCopper:star|star}} · Station: {{recipe:clockCopper|station}} · Materials: {{recipe:clockCopper|ingredients}}
* [[item:clockSilver]] — Tier: {{item:clockSilver:star|star}} · Station: {{recipe:clockSilver|station}} · Materials: {{recipe:clockSilver|ingredients}}
* [[item:clockGold]] — Tier: {{item:clockGold:star|star}} · Station: {{recipe:clockGold|station}} · Materials: {{recipe:clockGold|ingredients}}

**Upgrade**

* Combine [[item:clockGold]] with an [[item:astrolabe]] and a [[item:chronometer]] to craft an [[item:astrarium]] — the ultimate trinket providing complete environmental awareness.

**Tips**

* _A [[item:grandfatherClock]] at home removes the need to carry a clock at all — provided you stay nearby._

**See also**

* [[Environment Panel]] — overview of all display features
* [[Day & Night Cycle]] — time periods and their effects
* [[Trinkets]] — full list of trinkets and their effects
    `
  },
  {
    title: 'Sextant',
    category: ['Trinket'],
    content: `
**Description**

The [[item:sextant]] is a [[Trinkets|Trinket]] that improves the accuracy of the [[Moon Phases]] display in the [[Control Panel]].

Without it, only 4 icons are used to represent the full 8-phase cycle — several phases share the same icon. Carrying the [[item:sextant]] in your [[Inventory]] shows a distinct icon for each of the 8 phases.

See [[Moon Phases]] for the complete phase table.

**Acquisition**

* Tier: {{item:sextant:star|star}}
* Crafting Station: {{recipe:sextant|station}}
* Crafting Materials: {{recipe:sextant|ingredients}}

**Upgrade**

* Combine with a [[item:bottledFrog]] to craft an [[item:astrolabe]] — a single trinket providing both moon detail and weather forecast.
* The [[item:astrolabe]] can be further combined into an [[item:astrarium]] — the ultimate trinket providing complete environmental awareness.

**Tips**

* _Moon phases affect enemy spawn rates, fishing conditions and plant growth — knowing the exact phase helps planning._

**See also**

* [[Environment Panel]] — overview of all display features
* [[Moon Phases]] — full phase table and gameplay effects
* [[Trinkets]] — full list of trinkets and their effects
    `
  },
  {
    title: 'Triskels',
    category: ['Accessory', 'Buff'],
    content: `
    `
  },
  {
    title: 'Ruler',
    category: ['Accessory'],
    content: `
**Description**

A small measuring instrument that, when carried in your [[Inventory]], displays your current position in the [[Control Panel]].

**Display**

Your position is shown as tile coordinates:

* **X** — horizontal position, from 0 (left edge) to 1023 (right edge)
* **Y** — vertical position, from 0 (top) to 511 (bottom)

The world is **1024 x 512 tiles**.

**Upgrade**

* Combine with a [[item:stopwatch]] to craft a [[item:chronometer]] — a single 4★ trinket providing both speed and position display.
* The [[item:chronometer]] can be further combined into an [[item:astrarium]] — the ultimate trinket providing complete environmental awareness.

**Tips**

* _The position displayed corresponds to the tile under your feet._
* _X increases eastward, Y increases downward._
* _Use the coordinates to mark and share points of interest with other players._

**See also**

* [[Environment Panel]] — overview of all display features
* [[Trinkets]] — full list of trinkets and their effects
  `
  },
  {
    title: 'Stopwatch',
    category: ['Trinket'],
    content: `
**Description**

A precision instrument that, when carried in your [[Inventory]], displays your current [[Movement Speed]] in the [[Control Panel]].

**Display**

Speed is shown as a percentage:

* **100%** — base Movement Speed, no modifier active
* **> 100%** — movement is faster than normal
* **< 100%** — movement is slowed

**What affects speed**

* Terrain underfoot — liquids, [[Cobweb|cobwebs]] and certain surfaces slow movement
* Equipment — some armor and accessories grant speed bonuses or penalties
* [[Buffs]] — various active effects can modify speed temporarily

**Upgrade**

* Combine with a [[item:ruler]] to craft a [[item:chronometer]] — a single 4★ trinket providing both speed and position display.
* The [[item:chronometer]] can be further combined into an [[item:astrarium]] — the ultimate trinket providing complete environmental awareness.

**Tips**

* _Speed is updated in real time as you move across different terrain._

**See also**

* [[Environment Panel]] — overview of all display features
* [[Movement Speed]] — detailed breakdown of speed modifiers
* [[Trinkets]] — full list of trinkets and their effects
  `
  },
  {
    title: 'Astrolabe',
    category: ['Trinket'],
    content: `
**Description**

An ancient astronomical instrument of extraordinary precision. When carried in your [[Inventory]], it combines the functions of the [[Sextant]] and the [[Bottled Frog]], revealing both moon detail and tomorrow's weather in the [[Control Panel]].

**Effects**

* Shows the exact [[Moon Phases|Moon Phase]] among all 8 possible phases (instead of 4)
* Displays tomorrow's [[Weather]] forecast alongside the current weather

**Acquisition**

* Tier: {{item:astrolabe:star|star}}
* Crafting Station: {{recipe:astrolabe|station}}
* Crafting Materials: {{recipe:astrolabe|ingredients}}

**Upgrade**

* Combine with a [[item:chronometer]] and a [[item:clockGold]] to craft an [[item:astrarium]] — the ultimate trinket providing complete environmental awareness.

**Tips**

* _The Astrolabe frees up an [[Inventory]] slot compared to carrying both the [[Sextant]] and [[Bottled Frog]] separately._
* _Pair it with a [[Chronometer]] to have complete environmental awareness at a glance._

**See also**

* [[Environment Panel]] — overview of all display features
* [[Weather]] — full weather type table and gameplay effects
* [[Moon Phases]] — full phase table and gameplay effects
* [[Trinkets]] — full list of trinkets and their effects
  `
  },
  {
    title: 'Chronometer',
    category: ['Trinket'],
    content: `
**Description**

A precision timekeeping instrument originally designed for maritime navigation. When carried in your [[Inventory]], it combines the functions of the [[Ruler]] and the [[Stopwatch]], displaying both your position and [[Movement Speed]] in the [[Control Panel]].

**Effects**

* Displays your current tile coordinates (X / Y)
* Displays your current [[Movement Speed]] as a percentage

**Acquisition**

* Tier: {{item:chronometer:star|star}}
* Crafting Station: {{recipe:chronometer|station}}
* Crafting Materials: {{recipe:chronometer|ingredients}}

**Upgrade**

* Combine with an [[item:astrolabe]] and a [[item:clockGold]] to craft an [[item:astrarium]] — the ultimate trinket providing complete environmental awareness.

**Tips**

* _The Chronometer frees up an inventory slot compared to carrying both the [[Ruler]] and [[Stopwatch]] separately._
* _Pair it with an [[Astrolabe]] to have complete environmental awareness at a glance._

**See also**

* [[Ruler]] — the position component
* [[Stopwatch]] — the speed component
* [[Environment Panel]] — overview of all display features
* [[Trinkets]] — full list of trinkets and their effects
  `
  },
  {
    title: 'Astrarium',
    category: ['Trinket'],
    content: `
**Astrarium**

The pinnacle of exploration instruments. When carried in your [[Inventory]], it combines the effects of the [[Astrolabe]], the [[Chronometer]] and the [[item:clockGold]], providing complete environmental awareness in the [[Control Panel]].

**Effects**

* [[Day & Night Cycle|Time]] displayed with 5-minute precision
* Tomorrow's [[Weather]] forecast alongside the current weather
* All 8 [[Moon Phases]] shown with distinct icons
* Current tile coordinates (X / Y)
* Current [[Movement Speed]] as a percentage

**Acquisition**

* Tier: {{item:astrarium:star|star}}
* Crafting Station: {{recipe:astrarium|station}}
* Crafting Materials: {{recipe:astrarium|ingredients}}

<hr>

**Craft Tree**

The Astrarium is the final step of a multi-stage crafting chain.

* <<itemStar|clockCopper>>
  * <<itemStar|clockSilver>> ← [[item:clockCopper]]
    * <<itemStar|clockGold>> ← [[item:clockSilver]]
  * <<itemStar|bottledFrog>>
  * <<itemStar|sextant>>
    * <<itemStar|astrolabe>> ← [[item:bottledFrog]] + [[item:sextant]]
  * <<itemStar|ruler>>
  * <<itemStar|stopwatch>>
    * <<itemStar|chronometer>> ← [[item:ruler]] + [[item:stopwatch]]
      * <<itemStar|astrarium>> ← [[item:clockGold]] + [[item:astrolabe]] + [[item:chronometer]]

All stations and materials required from scratch are listed below

* {{recipe:astrarium|allStations}}
* {{recipe:astrarium|allIngredients}}

**Tips**

* _The Astrarium frees up to five inventory slots compared to carrying all its component trinkets separately._
* _It is the only trinket that provides all environment display bonuses simultaneously._

**See also**

* [[Astrolabe]] — the astronomy component
* [[Chronometer]] — the navigation component
* [[Clocks]] — the time precision component
* [[Environment Panel]] — overview of all display features
* [[Trinkets]] — full list of trinkets and their effects
  `
  },

  // ── Activities ───────────────────────────────────────────────
  {
    title: 'Activities',
    category: ['Gameplay'],
    content: `
    `
  },

  // ── Activities Mining ────────────────────────────────────────
  //    Mining, Mining Tools, Mineable Blocks, Mining Buffs
  {
    title: 'Mining',
    category: ['Activities', 'Mining'],
    content: `
**Description**

Mining a node in the world always yields an item for your [[Inventory]]. Some items can then be processed further into a refined material. ⏳ (non, certains node ne sont pas minables - certains node ne disparaissent pas après l'opération de minage - d'autres items peuvent être raremant obtenus en minant certains blocs)

**Resource types**

| Node type | World tile | Collected item | Refined item |
|---|---|---|---|
| Ore | [[node:copper]] | [[item:chunkCopper]] | [[item:barCopper]] |
| Gem | [[node:topaz]] | [[item:rawTopaz]] | [[item:cutTopaz]] |
| Rock | [[node:granite]] | [[item:blockGranite]] | — |
| Shell | [[node:shell]] | [[item:blockShell]] | [[item:shellPowder]] |
| Topsoil | [[node:dirt]] | [[item:blockDirt]] | — |
| Natural | [[node:grassForest]] | [[item:blockDirt]] | — |
| Cobweb | [[node:web]] | [[item:silk]] | [[item:fabric]] |
| Hive | [[node:hive]] | [[item:blockHive]] | [[item:beeswax]] |


**Tips**

* _Natural tiles (grass, moss...) drop the same block as the topsoil underneath._
* _Natural tiles can aslo be [[Foraging|foraged]]._⏳

**See also**

* [[Crafting]] — full crafting system overview
* [[Foraging]] — full foraging system overview
    `
  },
  {
    title: 'Mining Tools',
    category: ['Tool', 'Mining'],
    content: `
    Pickaxe
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

**Tips**
- See also [[Block Directory]]
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
* Craftable at specific [[Crafting Stations|crafting stations]] ⏳

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

{{item:flamethrower:star|star}}

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
  //    Armors, Armor Sets
  {
    title: 'Armors',
    category: ['Armor'],
    content: `
    Three slots: Head, Body, Foot
    Armor prefixes :
    [[Armor Sets]] :
    `
  },
  {
    title: 'Armor Sets',
    category: ['Armor'],
    content: `
    `
  },

  // ── Activities Crafting ──────────────────────────────────────
  //    Crafting, Crafting Stations, Crafting Tree, Crafting Buffs
  {
    title: 'Crafting',
    category: ['Activities', 'Crafting', 'Crafting Stations'],
    content: `
**Description**

Crafting transforms raw materials into tools, weapons, furniture and consumables.
Every craft requires a set of ingredients (**Crafting Materials**), a [[Crafting Stations|crafting station]], and enough room in your [[Inventory|bag]] to receive the result.

<hr>

**The Craft Panel — overview**

Open the panel with **[K]**. It is divided into two zones.

* _Left_ — filter bar and recipe grid
* _Right_ — selected recipe detail and craft execution

<hr>

**Filtering recipes**

* **Text search** — type any part of a result item name. The dropdowns disappear while text is entered. Clear with ✕.
* **Filter by result type** — select a category (Weapon, Tool, Material — Chunk, Furniture — Torch…)
* **Filter by crafting station** — show only recipes requiring a given station.
* **Filter by ingredient** — show only recipes that consume a given Crafting Material.

The last used filter is remembered between sessions.

<hr>

**Recipe grid**

Each slot shows the result item of one recipe.

* _Green background_ — you have all the required ingredients in your [[Inventory|bag]] or hotbar.
* _Blue background_ — at least one ingredient is missing or insufficient.

* _Number on the slot_ — shown when the recipe produces more than one item per run. This quantity is multiplied by the number of runs chosen at execution time.

<hr>

**Recipe detail**

Click any slot to see its full recipe on the right.

**Result** — the item produced. A quantity _x N_ appears only when the recipe produces more than one item per run.
If the recipe also **returns** items (containers, empty vessels…), they appear below the result.

**Crafting Station** — the Crafting Station required.
* _Green background_ — the Crafting Station is within range.
* _Blue background_ — the Crafting Station is not nearby.

**Ingredients** — each ingredient shows _available / needed_ for the current number of runs.
* _Green background_ — quantity is sufficient.
* _Blue background_ — quantity is insufficient.

**Ingredient sources** — ingredients are drawn from your [[Inventory|bag]], your [[Hotbar]], and any chest, cabinet or closet within range. The crafting station must also be within range. The effective range can be extended by certain [[Crafting Buffs]].

_Tip : clicking a green-bordered ingredient or station icon copies its name into the text filter, showing you the recipe that produces it — useful for tracing a crafting chain._

<hr>

**Executing a craft**

At the bottom right of the panel:

* **? button** — opens the [[Help Panel]]. If a recipe is selected, navigates directly to the help topic of the result item. Otherwise opens the Help Panel on its default page.
* **Runs** — number of times to execute the recipe. The range _(1 – N)_ shows the maximum possible given your current stock. The field is locked if no ingredients are available.
* **Craft x N** — the button shows the total number of items produced _(runs x yield)_. It turns green and becomes clickable only when all ingredients are available, the station is nearby, and the bag has room for the result.

After a successful craft, the ingredient counts and grid colours update automatically.

⚠ Changes are only saved when the panel is closed.

<hr>

**Crafting Buffs**

Certain buffs modify crafting behaviour. ⏳

* ⏳ _Artisan's Luck_ — chance to produce one extra item per run
* ⏳ _Frugal Hands_ — chance to not consume one or more ingredients
* ⏳ _[[Luck Buffs]]_ — small chance to not consume one or more ingredients and small chance to produce one extra item per run
* ⏳ _Extended Reach_ — increases the range within which bags, chests, cabinets, closets and crafting stations are accessible

See [[Crafting Buffs]] for more details.

<hr>

**See also**

* [[Crafting Stations]] — list of all workbenches and their unlock order
* [[Crafting Tree]] — dependency tree between stations
* [[Inventory]] — managing your bag and hotbar
A traduire en anglais : La quantité affichée sur un slot de recette indique le nombre d'items produits par une exécution de la recette — indépendamment du nombre de fois où on choisit de l'exécuter.
    `
  },
  {
    title: 'Crafting Stations',
    category: ['Crafting', 'Activities'],
    content: `
**Description**

Crafting Stations are specialized workbenches that allow the player to [[Crafting|craft]] advanced items. Each station is dedicated to a specific material or craft type. Most stations must be crafted first and placed in the world.

Crafting stations are required to craft higher-tier stations, forming a progression chain — see [[Crafting Tree]].

**Starting point**

* [[By Hand]] — your bare hands; always available, and the entry point to the entire crafting chain
* <<itemStar|tableWood>> — crafted by hand, first item of the crafting chain

**Woodworking**

* <<itemStar|workbench>> and <<itemStar|sawmill>>

**Metalworking**

* [[Smelting]] — <<itemStar|furnace>> and <<itemStar|blastFurnace>>
* [[Forging]] — <<itemStar|anvil>> and <<itemStar|forge>>

**Textiles**

* [[Weaving]] — <<itemStar|loom>>
* [[Leatherworking]] — <<itemStar|tanningRack>>

**Other crafts**

* [[Stoneworking]] — <<itemStar|stoneBench>>
* [[Jewelry]] — <<itemStar|jewelerBench>>
* [[Alchemy]] — <<itemStar|alchemyTable>>
* [[Cooking]] — <<itemStar|cookingPot>>

**Ancient stations**

* <<itemStar|decomposer>> — found in [[Lost Temple]]
* <<itemStar|transmutator>> — found in [[Ancient House]]
  `
  },
  {
    title: 'Crafting Tree',
    category: ['Crafting', 'Activities', 'Crafting Stations'],
    content: `
**Description**

The crafting tree shows which station is used to craft each station. The indentation reflects the crafting dependency, not the unlock order.

* [[By Hand]]
  * <<itemStar|tableWood>>
    * <<itemStar|workbench>>
      * <<itemStar|furnace>>
        * <<itemStar|cookingPot>>
        * <<itemStar|blastFurnace>>
      * <<itemStar|anvil>>
        * <<itemStar|stoneBench>>
        * <<itemStar|jewelerBench>>
        * <<itemStar|forge>>
      * <<itemStar|alchemyTable>>
      * <<itemStar|loom>>
        * <<itemStar|tanningRack>>
      * <<itemStar|sawmill>>
* Found in the world
  * <<itemStar|decomposer>> — [[Lost Temple]]
  * <<itemStar|transmutator>> — [[Ancient House]]

<hr>

**Unlock Order**

The unlock order shows when each station becomes buildable during a playthrough — taking into account both the station required to craft it and the materials it needs. A station deeper in the crafting tree is not necessarily harder to unlock than one at a shallower level.

* <<itemStar|tableWood>>: {{recipe:tableWood|allStations}}
  * <<itemStar|workbench>>: {{recipe:workbench|allStations}}
    * <<itemStar|furnace>>: {{recipe:furnace|allStations}}
      * <<itemStar|anvil>>: {{recipe:anvil|allStations}}
        * <<itemStar|cookingPot>>: {{recipe:cookingPot|allStations}}
        * <<itemStar|stoneBench>> {{recipe:stoneBench|allStations}}
        * <<itemStar|jewelerBench>> ⏳
      * <<itemStar|alchemyTable>>: {{recipe:alchemyTable|allStations}}
      * <<itemStar|loom>>: {{recipe:loom|allStations}}
        * <<itemStar|tanningRack>>: {{recipe:tanningRack|allStations}}
          * <<itemStar|forge>>: {{recipe:forge|allStations}}, [[item:tanningRack]]
        * <<itemStar|sawmill>>: {{recipe:tanningRack|allStations}}
          * <<itemStar|blastFurnace>>: {{recipe:blastFurnace|allStations}}, [[item:sawmill]]
  `
  },
  {
    title: 'Crafting Buffs',
    category: ['Buff', 'Crafting'],
    content: `
    `
  },
  {
    title: 'By Hand',
    category: ['Crafting Stations', 'Crafting'],
    content: `
**Description**

Your bare hands are always available as a crafting station — no placement required.
They serve two purposes: starting the crafting chain and crafting basic survival items in the field.

**Crafting chain**

Hands are the entry point of the entire [[Crafting Tree]].
Without them, no other [[Crafting Stations|crafting station]] can be built.

* [[item:tableWood]] — first station of the chain, unlocks most early recipes

**Field crafting**

A small set of essential items can be crafted anywhere, without a workstation nearby.

* [[item:torch]] — basic light source
* [[item:campfire]] — provides warmth and a resting point
* [[item:platformOak]] — basic traversal block
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
  //    Wooden Table, Woodworking, Smelting, Forging, Leatherworking, Weaving
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
    content: `
**Description**

⏳

**Furnace Acquisition**

* Tier: {{item:furnace:star|star}}
* Crafting Station: {{recipe:furnace|allStations}}
* Crafting Materials: {{recipe:furnace|allIngredients}}
* Requires multiple crafting stages

**Blast Furnace Acquisition**

* Tier: {{item:blastFurnace:star|star}}
* Crafting Station: {{recipe:blastFurnace|allStations}}
* Crafting Materials: {{recipe:blastFurnace|allIngredients}}
* Requires multiple crafting stages

**Metal Bars**

| Chunk | Chunk Tier | Crafting Station | Bar | Bar Tier |
|---|---|---|---|---|
<<metalBarsRow|chunkCopper|barCopper>>
<<metalBarsRow|chunkIron|barIron>>
<<metalBarsRow|chunkSilver|barSilver>>
<<metalBarsRow|chunkGold|barGold>>
<<metalBarsRow|chunkCobalt|barCobalt>>
<<metalBarsRow|chunkPlatinum|barPlatinum>>
    `
  },
  {
    title: 'Forging',
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

  //    Stoneworking, Jewelry, Alchemy, Cooking, Decomposer, Transmutator

  {
    title: 'Stoneworking',
    category: ['Crafting', 'Crafting Stations'],
    content: `
Le [[item:stoneBench]] is a [[Crafting Stations|Crafting Station]] qui permet de couper, polir, réduire en poudre différents types de matériaux durs et tendres.

**Stone Bench Acquisition**

* Tier: {{item:stoneBench:star|star}}
* Crafting Station: {{recipe:stoneBench|allStations}}
* Crafting Materials: {{recipe:stoneBench|allIngredients}}
* Requires multiple crafting stages

**Tips**
    `
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
    content: `


**Cooking Pot Acquisition**

* Tier: {{item:cookingPot:star|star}}
* Crafting Stations: {{recipe:cookingPot|allStations}}
* Crafting Materials: {{recipe:cookingPot|allIngredients}}
* Requires multiple crafting stages
    `
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

  // ── Activities Combat ───────────────────────────────────
  //    Combat, Combat Buffs
  {
    title: 'Combat',
    category: ['Combat', 'Activities'],
    content: `
    `
  },
  {
    title: 'Combat Buffs',
    category: ['Combat', 'Buff'],
    content: `
    `
  },

  // ── Activities Events ───────────────────────────────────
  //    Events, Alien Invasion, Pirate Attack, Meteor Strikes
  {
    title: 'Events',
    category: ['Events', 'Activities'],
    content: `
**Events List**
* [[Alien Invasion]]
* [[Pirate Attack]]
* [[Meteor Strikes]]
    `
  },
  {
    title: 'Alien Invasion',
    category: ['Events'],
    content: `
    `
  },
  {
    title: 'Pirate Attack',
    category: ['Events'],
    content: `
    `
  },
  {
    title: 'Meteor Strikes',
    category: ['Events'],
    content: `
    `
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
* <<itemStar|bowl>> — soups and stews
* <<itemStar|mug>> — ales and drinks
* <<itemStar|plate>> — solid food dishes
* <<itemStar|trencher>> — rustic wooden plate for simple meals

**Small Liquid Containers**

Filled directly from a liquid source in the world. Used as crafting ingredients in cooking and potion recipes.

* <<itemStar|bottle>> — empty bottle, filled by clicking on a liquid tile
  * [[item:water]] — [[node:water]] — healing item and potion ingredient
  * [[item:honey]] — [[node:honey]] — healing item and buff
  * [[item:sap]] — [[node:sap]] — buff

_[[Bottles]] are returned upon consuming the recipe result._ ⏳

**Large Liquid Containers**

Filled directly from a liquid source in the world. Used as tools to transport and pour liquids — the empty bucket is recovered after pouring.
* <<itemStar|bucket>> — empty bucket ⏳
  * [[item:bucketWater]] — Water Bucket — pour water into the world ⏳
  * [[item:bucketHoney]] — Honey Bucket — pour honey into the world ⏳
  * [[item:bucketSap]] — Sap Bucket — pour sap into the world ⏳

**See also**

* [[Bottles]] — detailed usage and recipes
* [[Buckets]] — detailed usage and liquid manipulation

**Tips**

* _Tableware can be placed on any flat-surfaced furniture as decoration._
* _[[Bottles]] are the primary ingredient for all potions — stock up early._ ⏳
* _[[Buckets]] allow precise liquid manipulation — essential for creating [[node:obsidian]]._ ⏳
* _An empty bucket worn on the head provides a surprisingly effective rudimentary helmet._ ⏳
* _Place a bucket of liquid near your [[item:cookingPot]] or [[item:alchemyTable]] to keep a ready supply of water, honey or sap within reach._ ⏳
  `
  },
  {
    title: 'Bottles',
    category: ['Liquid'],
    content: `
**Description**

Parler d'abord du Glass, puis des Bottles. Analyser s'il faut séparer Bottles et Glass dans l'aide.
⏳

**Bottle Types**

* <<itemStar|bottle>> — empty bottle
* <<itemStar|water>> — when full of [[node:water]]
* <<itemStar|honey>> — when full of [[node:honey]]
* <<itemStar|sap>> — when full of [[node:sap]]


**Bottle Crafting**

* Tier: {{item:bottle:star|star}}
* Crafting Station: {{recipe:bottle|station}}
* Crafting Materials: {{recipe:bottle|ingredients}}

**Glass Crafting**

* Tier: {{item:glass:star|star}}
* Crafting Station: {{recipe:glass|station}}
* Crafting Materials: {{recipe:glass|ingredients}}

**How to fill**

⏳

**How to empty**

⏳

**Bottle Usages**

⏳

**Glass Usages**

⏳

**Tips**
* Parler des [[item:bucket]]s.
* _See [[Tableware]] for the full list of containers._
    `
  },
  {
    title: 'Buckets',
    category: ['Liquid'],
    content: `

    **Description**

⏳

**Bucket Types**

* <<itemStar|bucket>> — empty bucket
* <<itemStar|bucketWater>> — when full of [[node:water]]
* <<itemStar|bucketHoney>> — when full of [[node:honey]]
* <<itemStar|bucketSap>> — when full of [[node:sap]]


**Bucket Crafting**

* Tier: {{item:bucket:star|star}}
* Crafting Station: {{recipe:bucket|station}}
* Crafting Materials: {{recipe:bucket|ingredients}}

**How to fill**

⏳

**How to empty**

⏳

**Usages**

⏳

**Tips**
* Parler des [[item:bucket]]s.
* _See [[Tableware]] for the full list of containers._
    `
  },

  // ── Furniture - Light ────────────────────────────────────────
  //    Torches, Fireplaces, Campfire, Toilets, Doors, Beds, Chairs, Cloks
  {
    title: 'Gel',
    category: ['Crafting Ingredient'],
    content: `
Dropped by [[monster:slime||Slimes]]
Used to craft [[item:torch]].
    `
  },
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
    title: 'Campfires',
    category: ['Furniture'],
    content: `
* Provide Cosy Buff (à vérifier) ⏳
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

  //    Tables, Platforms, Cabinets, Closets, Bookcases, Sofas, Grandfather Clock

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
**Platform Types**
* [[item:platformOak]]
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
  {
    title: 'Grandfather Clock',
    category: ['Furniture'],
    content: `

  Parler des [[Clocks]] qui permettent également d'obtenir un temps plus précis, quand elles se trouvent dans l'[[Inventory]].
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
  //    Luck Buffs
  {
    title: 'Luck Buffs',
    category: ['Buff'],
    content: `
    `
  },

  // ── Leather ────────────────────────────────────────────────
  {
    title: 'Leather',
    category: ['Buff'],
    content: `
  **Leather Types**

  * Velin
  * Leather
  * Hardened Leather (renforc& avec des Copper Wire)
    `
  },
  // ── Mechanics ────────────────────────────────────────────────

  // ── Food ─────────────────────────────────────────────────────
  //    Food, Soups, Eggs
  {
    title: 'Food',
    category: ['Gameplay'],
    content: `
**Description**

Food restores health and provides temporary buffs. More elaborate preparations require better ingredients and equipment, but confer stronger and longer-lasting effects.

**Food Tiers**

| Tier | Description | Example |
|---|---|---|
| ★☆☆☆☆ | Raw food — no cooking required | Fruits, seeds, mushrooms |
| ★★☆☆☆ | Cooked food — requires [[item:sunflowerOil|Sunflower Oil]] — does not withstand high temperatures | Basic cooked meals |
| ★★★☆☆ | Refined cooking — requires [[item:oleanderOil|Oleander Oil]] — stable at high temperatures | High-temperature dishes |
| ★★★★☆ | Elaborate preparations — noble ingredients conferring resistance to [[Bleeding DOT]], [[Poison DOT]], and [[Fire DOT]] ⏳ | ⏳ |
| ★★★★★ | Pheromone mastery — allows control of specific monster species ⏳ | ⏳ |

**Cooking Stations** ⏳

**Tips**

 ⏳
  `
  },
  {
    title: 'Soups',
    category: ['Food'],
    content: `
**Tier**

{{item:vegetableSoup:star|star}}

**Recipes**

[[item:vegetableSoup]]
      `
  },
  {
    title: 'Eggs',
    category: ['Food'],
    content: `
**Eggs Type**

{{item:vegetableSoup:star|star}}

**Recipes**

| Egg | Found | Usage |
|---|---|---|
| [[item:eggSpider]] | Mining [[node:web]] | Potions |
      `
  },

  // ── Potions ──────────────────────────────────────────────────
  //    Potions
  {
    title: 'Potions',
    category: ['Gameplay'],
    content: `
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

**Wild Plants**

| Name | Tier | Type | Location | Main Loot | Encounters |
|---|---|---|---|---|---|
| [[item:coconut]] | {{item:coconut:star|star}} | Tree | Sea shore, Desert Oasis shore | [[item:coconut]], [[item:coconutFiber]], [[item:coconutPulp]], [[item:coconutMilk]] | [[monster:coconutCrab]] (Shaking) |
| [[item:oak]] | {{item:oak:star|star}} | Tree | [[Forest]] / [[Surface]] | [[item:logOak]], [[item:acorn]] | [[monster:hornet]] (Shaking) / [[monster:boar]] (Chopping) |
| [[item:mahogany]] | {{item:mahogany:star|star}} | Tree | [[Jungle]] / [[Surface]] | [[item:logMahogany]] | [[monster:eyelashViper]] (Shaking) / [[monster:bulletAnt]] (Chopping) |
| [[item:giantMushroom]] | {{item:giantMushroom:star|star}} | Tree | [[Mushroom Cave]] | ⏳ | [[monster:isopod]]  (Chopping) |
| [[item:bolete]] | {{item:bolete:star|star}} | Mushroom | [[Forest]] / [[Surface]] | [[item:bolete]] | [[monster:adder]] (Foraging) |
| [[item:pinkMycenia]] | {{item:pinkMycenia:star|star}} | Mushroom | [[Jungle]] / [[Surface]] | [[item:pinkMycenia]] | [[monster:giantRedSlug]] (Foraging) |
| [[item:coralR]] | {{item:coralR:star|star}} | Herb | Under Sea / [[node:sand]] | [[item:coral]] | [[monster:moray]] (Foraging) |
| [[item:coralP]] | {{item:coralP:star|star}} | Herb | Under Sea / [[node:sand]] | [[item:coral]] | [[monster:moray]] (Foraging) |
| [[item:coralY]] | {{item:coralY:star|star}} | Herb | Under Sea / [[node:sand]] | [[item:coral]] | [[monster:moray]] (Foraging) |
| [[item:coralG]] | {{item:coralG:star|star}} | Herb | Under Sea / [[node:sand]] | [[item:coral]] | [[monster:moray]] (Foraging) |
| [[item:ambermirage]] | {{item:ambermirage:star|star}} | Herb | [[Surface]] / [[node:sand]] | [[item:ambermirage]] | [[monster:scorpion]] (Foraging) |
| [[item:parsnip]] | {{item:parsnip:star|star}} | Herb | [[Forest]] / [[Surface]] | [[item:parsnip]] | [[monster:vole]] (Foraging) |
| [[item:sunflower]] | {{item:sunflower:star|star}} | Herb | [[Forest]] / [[Surface]] | [[item:sunflowerSeed]] | [[monster:hedgehog]] (Foraging) |
| [[item:bloodmoon]] | {{item:bloodmoon:star|star}} | Herb | [[Jungle]] / [[Surface]] | [[item:bloodmoon]] | [[monster:mamba]] (Foraging) |
| [[item:fernS]] | {{item:fernS:star|star}} | Herb | Fern Cave / [[node:grassfern]] | [[item:fernLeaf]] | [[monster:dendrobate]] /  [[monster:mamba]] (Foraging) |
| [[item:fernC]] | {{item:fernC:star|star}} | Herb | Fern Cave / [[node:grassfern]] | [[item:fernLeaf]] | [[monster:dendrobate]] /  [[monster:mamba]] (Foraging) |
| [[item:fernG]] | {{item:fernG:star|star}} | Herb | Fern Cave / [[node:grassfern]] | [[item:fernLeaf]] | [[monster:dendrobate]] /  [[monster:mamba]] (Foraging) |
| [[item:fernM]] | {{item:fernM:star|star}} | Herb | Fern Cave / [[node:grassfern]] | [[item:fernLeaf]] | [[monster:dendrobate]] /  [[monster:mamba]] (Foraging) |
| [[item:velvetmoss]] | {{item:velvetmoss:star|star}} | Herb | Moss Cave / [[node:grassmoss]] | [[item:velvetmoss]] | [[monster:woodlouse]] (Foraging) |
| [[item:frostcap]] | {{item:frostcap:star|star}} | Herb | Mushroom Cave / [[node:grassmushroom]] | [[item:mushroomGill]] | [[monster:woodlouse]] (Foraging) |
| [[item:dawncap]] | {{item:dawncap:star|star}} | Herb | Mushroom Cave / [[node:grassmushroom]] | [[item:mushroomGill]] | [[monster:woodlouse]] (Foraging) |
| [[item:mandrake]] | {{item:mandrake:star|star}} | Herb | FOREST Underground / [[node:dirt]] | [[item:mandrakeRoot]] | [[monster:wraith]] (Foraging) |
| [[item:cactus]] | {{item:cactus:star|star}} | Herb | DESERT Underground / [[node:sand]] | [[item:cactus]] | [[monster:scorpion]] (Foraging) |
| [[item:bamboo]] | {{item:bamboo:star|star}} | Herb | JUNGLE Underground / [[node:silt]] | [[item:bambooStalk]] | [[monster:centipede]] (Foraging) |
| [[item:oleander]] | {{item:oleander:star|star}} | Herb | Underground / [[node:stone]] | [[item:oleander]] | [[monster:caveBeetle]] (Foraging) |
| [[item:satansCube]] | {{item:satansCube:star|star}} | Herb | FOREST+DESERT Caverns | [[item:satansCube]] | [[monster:firesalamander]] (Foraging) |
| [[item:sneakthorn]] | {{item:sneakthorn:star|star}} | Herb | FOREST+JUNGLE Caverns | [[item:sneakthorn]] | [[monster:vampire]] (Foraging) |
| [[item:cursedcrown]] | {{item:cursedcrown:star|star}} | Herb | JUNGLE+DESERT Caverns | [[item:cursedcrown]] | [[monster:fireAnt]] (Foraging) |
| [[item:abysshorn]] | {{item:abysshorn:star|star}} | Herb | Caverns top | [[item:abysshorn]] | [[monster:caveJellyfish]] (Foraging) |
| [[item:inferncap]] | {{item:inferncap:star|star}} | Herb | Caverns bottom | [[item:inferncap]] | [[monster:lavaWorm]] / [[monster:magmaCrab]] (Foraging) |

_For detailed information on each plant, click its name._

**Gardening** ⏳

Plants cultivated in [[item:clayPot1||Clay Pots]] stacked in [[Underground]] and [[Caverns]] zones. These plants are not found in the wild and require active care from the player.

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

* [[item:oak]] ({{item:oak:star|star}}) — [[Forest]] / [[Surface]], grows on [[node:grassForest]]
* [[item:mahogany]] ({{item:mahogany:star|star}}) — [[Jungle]] / [[Surface]], grows on [[node:grassJungle]]

**Growth**

* Trees grow through 5 visible stages (1 to 5)
* A new section grows every 2-3 in-game days for Oak, 3-4 days for Mahogany ⏳
* Maximum size is 5 sections

**Interactions - Shaking**

* A tree can only be shaken once per in-game day — shaking too frequently weakens the tree. ⏳

| Tree | Tool | Encounter |
| [[item:oak]] | Any [[Shaking Tools|Hammers]] | [[monster:hornet]] |
| [[item:mahogany]] | [[Shaking Tools|Iron Hammers]] or better | [[monster:eyelashViper]] |

| Tree | Loot |
| [[item:oak]] | {{item:oak:shaking:items}} |
| [[item:mahogany]] | {{item:oak:shaking:items}} |

**Interactions - Logging**

* Chopping removes one section — the tree shrinks by one stage
* When the last section is chopped, the tree disappears completely and yields an extra drop
* A chopped tree will regrow naturally over time if at least one section remains

| Tree | Tool | Encounter |
| [[item:oak]] | Any [[Chopping Tools|Axes]] | [[monster:boar]] |
| [[item:mahogany]] | [[Chopping Tools|Iron Axes]] or better | [[monster:bulletAnt]] |

| Tree | Loot | Extra Drop |
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

{{item:giantMushroom:star|star}}

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

| Tool | Loot | Extra Drop (last section) | Encounter |
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

{{item:coconut:star|star}}

**Location**

* Ocean shoreline — left and right sea borders
* Desert [[Surface Lake|Oasis]] shores
* Grows on [[node:sand]]

**Interactions — Shaking**

* A tree can only be shaken once per in-game day — shaking too frequently weakens the tree. ⏳

| Tool | Loot | Encounter |
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

* [[item:bolete]] ({{item:bolete:star|star}}) — [[Forest]] / [[Surface]], grows near [[Oak & Mahogany|Oak]] trees on [[node:grassForest]]
* [[item:pinkMycenia]] ({{item:pinkMycenia:star|star}}) — [[Jungle]] / [[Surface]], grows near [[Oak & Mahogany|Mahogany]] trees on [[node:grassJungle]]

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

| Mushroom | Tool | Loot |
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

{{item:frostcap:star|star}}

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
* Loot: [[item:mushroomGill]]

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

{{item:parsnip:star|star}}

**Location**

* Biome: [[Forest]]
* Layer: [[Surface]]
* Grows on [[node:grassForest]]

**Harvest**

* [[Foraging|Interact to harvest]] — the plant disappears on harvest
* Tool: any [[Harvesting Tools|Sickle]]⏳
* Loot: [[item:parsnip]]

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

{{item:sunflowerSeed:star|star}}

**Location**

* Biome: [[Forest]]
* Layer: [[Surface]]
* Grows on [[node:grassForest]] in open clearings, away from [[Oak & Mahogany|Oak]] trees

**Blooming Hours**

* Appears at dawn and disappears at dusk (in-game time)

**Harvest**

* [[Foraging|Interact to harvest]] — the flower disappears on harvest
* Tool: any [[Harvesting Tools|Sickle]]⏳
* Loot: [[item:sunflowerSeed]]

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

{{item:ambermirage:star|star}}

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
* Loot: [[item:ambermirage]]⏳

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

{{item:bloodmoon:star|star}}

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
* The plant is permanently destroyed only by [[Mining]] its supporting tile with a [[Mining Tools|Pickaxe]]
* Loot: [[item:bloodmoon]], rare chance of [[item:bloodmoonSeed]]

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

{{item:coralR:star|star}}

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
* Loot: [[item:coral]]

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

{{item:fernS:star|star}}. — Found exclusively in [[Fern Cave|Fern Caves]], a tier-3 environment.

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
* Tool: [[Harvesting Tools|Silver Sickle]] ({{item:sickleSilver:star|star}}) or better⏳
* Loot: [[item:fernLeaf]], rare chance of [[item:fernSpore]]

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
  {
    title: 'Velvetmoss',
    category: ['Plant', 'Jungle'],
    content: `
**Description**

Velvetmoss is a slow-growing, deep-purple moss found exclusively in [[Moss Cave|Moss Caves]]. Its velvety surface clings to the floor and lateral walls of the cave, forming dense interconnected patches that slowly reclaim every exposed surface over time.

**Tier**

{{item:velvetmoss:star|star}}

**Location**

* Biome: [[Jungle]]
* Layer: [[Underground]]
* Grows exclusively in [[Moss Cave|Moss Caves]] on [[node:grassMoss]]

**Harvest**

* [[Foraging|Interact to harvest]] — the patch disappears on harvest
* Tool: [[Harvesting Tools|Silver Sickle]] or better ⏳
* Loot: [[item:velvetmoss]]

**Regrowth**

* Harvesting a patch removes it permanently from that spot — the moss does not regrow where it was picked
* Velvetmoss spreads slowly but relentlessly across every exposed [[node:grassMoss]] surface in the cave
* A new patch appears every 2 to 3 in-game days on a random unoccupied spot
* Left unharvested, the moss will eventually cover every available surface

**Terrain Effect** ⏳

* Velvetmoss secretes a thin, permanent moisture that makes every step a negotiation with gravity — the harder you push, the more it slips away from under you.
* Walking on Velvetmoss reduces Movement Speed ({{item:velvetmoss:buffs:movementSpeed}}%)
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

{{item:mandrakeRoot:star|star}}

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
* Loot: [[item:mandrakeRoot]]

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

{{item:cactus:star|star}}

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
* Loot: [[item:cactus]], [[item:cactusFiber]], [[item:cactusSpine]]

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
    title: 'Bamboo',
    category: ['Plant', 'Jungle'],
    content: `
**Description**

Underground Bamboo thrives in the humid tunnels and passages of [[Jungle]] biomes. Growing in dense clusters wherever it takes root, it spreads aggressively across any available [[node:silt]] surface. Its hollow stems and tender shoots make it a versatile resource for both food and crafting.

**Tier**

{{item:bamboo:star|star}}

**Location**

* Biome: [[Jungle]]
* Layer: [[Surface]] tunnels and [[Underground]]
* Grows on [[node:silt]]

**Population**

* The species neither grows nor declines — natural balance maintains the population
* Harvested Bamboo does not regrow

**Harvest**

* [[Foraging|Interact to harvest]] — the plant disappears permanently on harvest
* Tool: [[Harvesting Tools|Silver Sickle]] or better ⏳
* Loot: [[item:bambooShoot]], [[item:bambooStalk]]

**Dangers**

* Harvesting Bamboo may disturb a [[monster:centipede]] coiled around the stems — it strikes without warning and inflicts [[Poison DOT]]. ⏳

**Usages** ⏳

* [[item:bambooShoot]] — food ingredient ⏳
* [[item:bambooStalk]] — construction and crafting ingredient ⏳

**Tips**

* _Bamboo grows in dense clusters — finding one stem usually means finding several nearby._ ⏳
* _Bamboo Shoots are edible raw — a reliable food source during early underground exploration._ ⏳
  `
  },
  {
    title: 'Oleander',
    category: ['Plant', 'Forest', 'Desert', 'Jungle', 'Underground'],
    content: `
**Description**

Oleander is a common shrub found in the underground passages of all three biomes. Its deep purple berries contain potent alkaloids that, when steeped in [[item:sunflowerOil]], produce [[item:oleanderOil]] — a heat-stable cooking oil prized by experienced explorers.

**Tier**

{{item:oleander:star|star}}

**Location**

* Biome: [[Forest]], [[Desert]], [[Jungle]]
* Layer: [[Underground]]
* Grows on [[node:stone]]

**Population**

* The species neither grows nor declines — natural balance maintains the population
* Harvested Oleander does not regrow

**Harvest**

* [[Foraging|Interact to harvest]] — the plant disappears permanently on harvest
* Tool: [[Harvesting Tools|Silver Sickle]] or better ⏳
* Loot: [[item:oleander]], [[item:oleanderBulb]]

**Dangers**

* The scent of Oleander berries attracts a [[monster:caveBeetle]] — its metallic blue-green carapace is nearly invisible against the stone walls. ⏳

**Usages** ⏳

* [[item:oleander]] — crafting ingredient ⏳
* [[item:oleanderBulb]] — crafting ingredient ⏳
* [[item:oleanderOil]] — heat-stable cooking oil, required for tier 3 food preparation ⏳

**Tips**

* _Oleander grows in all three biomes — it is the only underground plant found everywhere._ ⏳
* _Its purple berries catch the torchlight — a telltale shimmer against the stone walls._ ⏳
* _Harvest quickly — the Cave Beetle is fast and hits hard._ ⏳
  `
  },

  // ── Plants - Caverns Herbs ───────────────────────────────────
  //    Satan's Cube, Sneakthorn, Cursedcrown, Abysshorn, Inferncap, Amber-Moss

  {
    title: 'Satan\'s Cube',
    category: ['Plant', 'Forest', 'Desert', 'Caverns'],
    content: `
**Description**

Satan's Cube is one of the strangest organisms found in the deep [[Caverns]]. Its perfectly geometric shape — stacked cubes offset in alternating directions — has led many explorers to mistake it for a mineral formation. Its vivid yellow and electric orange colouring is nature's warning: do not touch.

**Tier**

{{item:satansCube:star|star}}

**Location**

* Biome: [[Forest]], [[Desert]]
* Layer: [[Caverns]]
* Grows on any [[Mineable Blocks|Topsoil]] or [[Mineable Blocks|Substrat]] surface with 3 tiles of clearance above

**Population**

* The species neither grows nor declines — natural balance maintains the population
* Harvested plants do not regrow

**Harvest**

* [[Foraging|Interact to harvest]] — the plant disappears permanently on harvest
* Tool: [[Harvesting Tools|Gold Sickle]] required ⏳
* Loot: [[item:satansCube]] ⏳

**Dangers**

* Harvesting disturbs a [[monster:firesalamander]] lurking in the nearby rock — its burning claws inflict both [[Fire DOT]] and [[Bleeding DOT]] simultaneously. ⏳

**Usages** ⏳

* [[item:satansCube]] — ingredient for anti-burn preparations ⏳

**Tips**

* _Its geometric shape looks like a mineral formation — easy to walk past without noticing._ ⏳
* _The Firesalamander strikes fast — clear the area before harvesting._ ⏳
* _Consuming preparations made from Satan's Cube provides resistance to [[Fire DOT]]._ ⏳
  `
  },
  {
    title: 'Sneakthorn',
    category: ['Plant', 'Forest', 'Jungle'],
    content: `
**Description**

Sneakthorn is a deep cavern plant that grows in the humid passages shared by [[Forest]] and [[Jungle]] biomes. Its branching arms — each splitting at 45 degrees from the one below — give it the silhouette of a frozen explosion. Its vivid scarlet and magenta colouring is an unambiguous warning. Explorers who ignore it rarely make the same mistake twice.

**Tier**

{{item:sneakthorn:star|star}}

**Location**

* Biome: [[Forest]], [[Jungle]]
* Layer: [[Caverns]]
* Grows on any [[Mineable Blocks|Topsoil]] or [[Mineable Blocks|Substrat]] surface

**Population**

* The species neither grows nor declines — natural balance maintains the population
* Harvested plants do not regrow

**Harvest**

* [[Foraging|Interact to harvest]] — the plant disappears permanently on harvest
* Tool: [[Harvesting Tools|Gold Sickle]] required ⏳
* Loot: [[item:sneakthorn]] ⏳

**Dangers**

* Harvesting Sneakthorn draws a [[monster:vampire]] out of the surrounding darkness — silent, fast, and venomous. Its bite inflicts both [[Bleeding DOT]] and [[Poison DOT]]. ⏳

**Usages** ⏳

* [[item:sneakthorn]] — ingredient for anti-poison preparations ⏳

**Tips**

* _Its branching silhouette is easy to miss against jagged cave walls — look for the colour, not the shape._ ⏳
* _The Vampire strikes from behind — clear your back before harvesting._ ⏳
* _Consuming preparations made from Sneakthorn provides resistance to [[Poison DOT]]._ ⏳
  `
  },
  {
    title: 'Cursedcrown',
    category: ['Plant', 'Jungle', 'Desert'],
    content: `
**Description**

Cursedcrown is the most alien plant found in the deep caverns. Its rigid radial arms — perfectly symmetrical, branching outward like a frozen star — look more like a crystal formation than a living organism. Its electric blue and cyan colouring blazes against the dark [[node:slate]] and [[node:hellstone]] walls. Nothing that glows that brightly in the deep dark is safe to touch.

**Tier**

{{item:cursedcrown:star|star}}

**Location**

* Biome: [[Jungle]], [[Desert]]
* Layer: [[Caverns]]
* Grows on any [[Mineable Blocks|Topsoil]] or [[Mineable Blocks|Substrat]] surface

**Population**

* The species neither grows nor declines — natural balance maintains the population
* Harvested plants do not regrow

**Harvest**

* [[Foraging|Interact to harvest]] — the plant disappears permanently on harvest
* Tool: [[Harvesting Tools|Gold Sickle]] required ⏳
* Loot: [[item:cursedcrown]] ⏳

**Dangers**

* Harvesting Cursedcrown agitates a nearby colony of [[monster:fireAnt|Fire Ants]] — they swarm instantly and inflict [[Fire DOT]] and [[Poison DOT]] simultaneously. ⏳

**Usages** ⏳

* [[item:cursedcrown]] — ingredient for anti-bleeding preparations ⏳

**Tips**

* _Cursedcrown is the only plant found in both [[Jungle]] and [[Desert]] caverns — a rare overlap worth seeking out._ ⏳
* _Fire Ants swarm — area-of-effect attacks are more effective than single targets._ ⏳
* _Consuming preparations made from Cursedcrown provides resistance to [[Bleeding DOT]]._ ⏳
  `
  },
  {
    title: 'Abysshorn',
    category: ['Plant', 'Forest', 'Desert', 'Jungle'],
    content: `
**Description**

Abysshorn is one of the strangest organisms in the known world. Its fractal structure — a single cone that splits into two, each splitting again, branching upward in an ever-widening crown of hollow trumpets — looks nothing like a plant. Its pearlescent white surface catches torchlight from across the cavern, making it unmistakable even at distance. Those who study it disagree on whether it is a plant, a fungus, or something else entirely.

**Tier**

{{item:abysshorn:star|star}}

**Location**

* Biome: [[Forest]], [[Desert]], [[Jungle]]
* Layer: [[Caverns]] Top
* Grows on any [[Mineable Blocks|Topsoil]] or [[Mineable Blocks|Substrat]] surface

**Population**

* The species neither grows nor declines — natural balance maintains the population
* Harvested plants do not regrow

**Harvest**

* [[Foraging|Interact to harvest]] — the plant disappears permanently on harvest
* Tool: [[Harvesting Tools|Gold Sickle]] required ⏳
* Loot: [[item:abysshorn]] ⏳

**Dangers**

* The hollow trumpets of the Abysshorn resonate at frequencies that attract [[monster:caveJellyfish|Cave Jellyfish]] from the surrounding cavern. Their translucent bodies are nearly invisible in the dark — and their sting causes [[Poison DOT]] and [[Fire DOT]] simultaneously. ⏳

**Usages** ⏳

* [[item:abysshorn]] — ingredient for pheromone preparations ⏳

**Tips**

* _Abysshorn reflects torchlight from a great distance — scan the cavern floor before engaging monsters._ ⏳
* _A Gold Sickle is required — lower-tier tools slide off the surface without cutting._ ⏳
* _Cave Jellyfish are nearly invisible — bring a strong light source and clear the area before harvesting._ ⏳
  `
  },
  {
    title: 'Inferncap',
    category: ['Plant', 'Forest', 'Desert', 'Jungle'],
    content: `
**Description**

Inferncap is the deepest-growing plant in the known world. Found only in the lowest caverns, where the heat of the earth makes the air shimmer and every rock face glows faintly red, it thrives where nothing else survives. Its stacked hemispherical leaves — deep violet, spotted with vivid red circles — look like something between a mushroom and a warning sign. Both interpretations are correct.

**Tier**

{{item:inferncap:star|star}}

**Location**

* Biome: [[Forest]], [[Desert]], [[Jungle]]
* Layer: [[Caverns]] Bottom
* Grows on any [[Mineable Blocks|Topsoil]] or [[Mineable Blocks|Substrat]] surface

**Population**

* The species neither grows nor declines — natural balance maintains the population
* Harvested plants do not regrow

**Harvest**

* [[Foraging|Interact to harvest]] — the plant disappears permanently on harvest
* Tool: [[Harvesting Tools|Gold Sickle]] required ⏳
* Loot: [[item:inferncap]] ⏳

**Dangers**

* Harvesting Inferncap draws both a [[monster:lavaWorm|Lava Worm]] and a [[monster:magmaCrab|Magma Crab]] from the surrounding rock. The combination is lethal — the Lava Worm attacks from below while the Magma Crab closes from the side. ⏳

**Usages** ⏳

* [[item:inferncap]] — rare ingredient for pheromone preparations ⏳

**Tips**

* _Inferncap is one of only two tier 5 plants — a Gold Sickle is required._ ⏳
* _Difficult to harvest alone at this depth — the Lava Worm and Magma Crab attack simultaneously._ ⏳
* _The violet and red colouring is visible without a torch — use it to spot plants from a safe distance._ ⏳
  `
  },
  {
    title: 'Amber-Moss',
    category: ['Plant', 'Forest'],
    content: `
    <<Note pour l'IA : fiche à traduire, la décision d'intégration de cette plante n'est pas encore prise>>
    La Mousse d'Ambre (Amber-Moss)
C'est une mousse d'un orange vif, presque luminescente, qui pousse exclusivement sur le côté nord des vieux chênes, là où l'humidité est constante.

**Tier**

item:amberMoss:star

**Benefits**⏳

* Hémostatique naturel (Soin) : Appliquée directement sur une plaie, elle stoppe instantanément le saignement. C'est le "pansement" de base du début de jeu.
* Allume-feu (Survie) : Une fois séchée, cette mousse devient extrêmement inflammable. Elle est indispensable pour réussir à allumer un [[item:campfire]] ou une [[item:torch]].
* Filtration : Placée dans un récipient, elle peut servir de filtre rudimentaire utilisé en cuisine.


Localisation : Base of Oak trees.

Foraging : [[Foraging|Sickle]] any tier.⏳

**Usages**⏳

* onguent qui diminue de 50% les démangeaisons causées par les [[monster:hornet]]s.
      `
  },

  // ── Fishs - Sea ──────────────────────────────────────────────
  // ── Fishs - Water ────────────────────────────────────────────
  // ── Fishs - Sap ──────────────────────────────────────────────
  // ── Monsters ─────────────────────────────────────────────────
  //    Fauna

  // ── Monsters ─────────────────────────────────────────────────
  //    Spiders, Bees

  {
    title: 'Spiders',
    category: ['Monster'],
    content: `
**Loot** ⏳

* [[item:spiderFang]] ({{item:spiderFang:star|star}}) — common ⏳
* [[item:spiderEgg]] ({{item:spiderEgg:star|star}}) — common ⏳
* [[item:silk]] ({{item:silk:star|star}}) — rare drop⏳

Note: those ingredients can also be dropped by [[Mining]] [[Cobweb]] with any [[Mining Tools|Pickaxe]].

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
  //    Getting Started, Help Panel, Hotbar, Control Panel, Inventory

  {
    title: 'Getting Started',
    category: ['Gameplay'],
    content: `
**Welcome to Sixty-Below**

You wake up alone on the surface of an unknown world. No instructions, no map — just the ground beneath your feet and whatever you can find.

**Your first minutes**

* Look around — the [[Surface]] layer is relatively safe during the day
* Three tools are waiting in your [[Inventory]]:
  * [[Chopping Tools|Copper Axe]] — chop trees to gather wood and craft your first items
  * [[Mining Tools|Copper Pickaxe]] — mine [[node:Stone], [[node:Dirt]] and [[Metals|ore veins]] underground
  * [[Harvesting Tools|Copper Sickle]] — harvest herbs and mushrooms on the surface
* Open your [[Inventory]] and check what you are carrying
* Build basic [[Crafting Stations]] as soon as possible

_Many other activities await you as you progress — see [[Activities]] for an overview._

**Before nightfall**

Night brings dangerous creatures to the surface.
Your first priority is to build a [[Housing|shelter]] before the sun sets.
* You need walls, a background wall, and a door at minimum
* Check the [[Day & Night Cycle]] fiche to know how much time you have

**Going deeper**

Once you have basic tools and a shelter, you can start exploring:
* The [[Underground]] layer holds ore, gems and secrets
* The [[Caverns]] go deeper still — come prepared

**Key topics to read**

* [[Mining]] — how to mine blocks and what tools you need
* [[Crafting]] — crafting stations and recipes
* [[Housing]] — building a valid shelter
* [[Forest]], [[Desert]] and [[Jungle]] — the different regions of the world
* Enviroment — [[Day & Night Cycle|Time]], [[Weather]] and [[Moon Phases]]

**The Game Screen**

* **[[Hotbar]]** — runs along the left edge. Select a slot with **1** to **9** to hold an item ready for use or placement.
* **World** — the central area. Move with arrow keys or **WASD**. The world extends far below the [[Surface]] — see [[Underground]] and [[Caverns]].
* **[[Control Panel]]** — runs along the right edge.
  * _Action buttons_ — [[Inventory]] **[I]**, [[Crafting]] **[K]**, [[Help Panel]] **[H]**, zoom, sound, new world
  * _Environment widget_ — [[Day & Night Cycle||day, time], [[Weather]], [[Moon Phases]], player coordinates
  * _Health gauge_
  * _Active [[Buff Panel||buffs/debuffs]]_
* **Panels** — pause exploration and open a full-screen panel. Press the same key again or click ✕ to close.
  * [[Inventory]] **[I]** — bag, hotbar, armor and accessories
  * [[Crafting]] **[K]** — browse recipes, inspect ingredients, craft items
  * [[Help Panel]] **[H]** — all reference topics, searchable
  * [[Achievements Panel]] **[U]** — to track your progress
  * [[Combat|Combat Panel]] — tactical combat, automatic opening, close when combat is done (win or lost)
  `
  },
  {
    title: 'Help Panel',
    category: ['Gameplay'],
    content: `
**The Help Panel** gives you access to all the game's reference topics at any time.
Press **[H]** or click the Help button in the [[Control Panel]] to open it.

**Left column — navigation**

* Type in the search box to filter topics by title, category or content
* When the search box is empty, use the category dropdown to browse by theme
* Click any topic button to display its page
* Use **◀** and **▶** to move back and forward through your reading history

**Right column — topic page**

* The topic title is displayed above the content area
* Click any highlighted link to navigate directly to the related topic

**Tips**

* _The search box accepts partial words — typing_ \`min\` _will match_ Mining, Mining Tools, Gemstones..._
* _The category filter updates automatically when you open a topic_
* _Your last visited topic is remembered between sessions_
  `
  },
  {
    title: 'Hotbar',
    category: ['Gameplay'],
    content: `
    `
  },
  {
    title: 'Control Panel',
    category: ['Gameplay'],
    content: `
**Description**

In the right part of the screen, shows:

* Icon actions
  * Open [[Inventory|Inventory Panel]] [I]
  * Open [[Crafting|Crafting Panel]] [K]
  * Open [[Achievements Panel]] [U]
  * Open [[Help Panel]] [H]
  * Creation of a [[World Creation|new world]]
  * Ambient sound and Music controls⏳
* [[Environment Panel]]
  * [[Day & Night Cycle|Day / Hours]]
  * [[Weather]] and [[Moon Phases]]
  * Player Position
  * Player Speed
  * Tile under the mouse
* [[Buff Panel]]
* Tile / Furniture / Plant under the mouse

_Note_ : the exct content of environnement panel is controled by trinket in your inventory. See [[Environment Panel]] for details

_The content and accuracy of the [[Environment Panel]] depend on the [[Trinkets]] you carry in your [[Inventory]]. See [[Environment Panel]] for details._

**Tips**
* _Use your browser's full-screen mode (F11) to display the complete game area._
    `
  },
  {
    title: 'Environment Panel',
    category: ['Gameplay'],
    content: `
**Description**

The Environment Panel is the second section of the [[Control Panel]], below the action buttons.
It provides a continuous read of the world's current state.
Some information is always visible; other details unlock when you carry specific [[Trinkets]] in your [[Inventory]].

**Always visible**

| Element | Description |
|---|---|
| [[Day & Night Cycle|Day]] | Current day number |
| [[Day & Night Cycle|Time]] | Current in-game time (hour:minute) |
| [[Weather]] | Current weather icon |
| [[Moon Phases]] | Current moon phase |

**Time accuracy**

By default, time is shown rounded to the nearest 3-hour period.
Carrying a [[Clocks|Clock]] improves this precision.
Only the most accurate clock in your inventory applies.
Grandfather Clocks placed nearby may also improve time accuracy.⏳

| Item | Precision |
|---|---|
| (none) | 3 hours |
| [[item:clockCopper]] | 1 hour |
| [[item:clockSilver]] | 15 minutes |
| [[item:clockGold]] | 5 minutes |

**Weather forecast**

Carrying a [[item:bottledFrog]] or an [[item:astrolabe]] displays tomorrow's weather alongside the current one.

**Moon phase detail**

By default, 4 icons represent the 8 possible phases.
Carrying a [[item:sextant]] or a [[item:astrolabe]] shows a unique icon for each of the 8 phases.

**Player position**

Carrying a [[item:ruler]] or an [[item:chronometer]] in your [[Inventory]] displays your current tile coordinates (X / Y) at the bottom of the panel.

**Movement Speed bonus**

Carrying a [[item:stopwatch]] or a [[item:chronometer]] in your [[Inventory]] displays your current Movement Speed as a percentage.

* A value of 100% means no modifier is active.
* Speed is affected by terrain, equipment, and [[Buffs]].
* See [[Movement Speed]] for details.
    `
  },
  {
    title: 'Inventory',
    category: ['Gameplay'],
    content: `
**The Inventory Panel** is where you manage everything you carry — tools, materials, equipment and consumables.

Press **(I)** or **(Escape)** to open and close it.

_Changes are only saved when the panel is closed._

<hr>

**Layout**

* **Hotbar** (left column, 8 slots) — quick-access slots, usable directly during exploration
* **Bag** (8x8 grid) — main storage, 64 slots
* **Armor** (3 slots) — Head, Body and Foot equipment
* **Accessories** (5 slots) — passive equipment worn at all times
* **Chest** (right panel) — contents of nearest containers in range

_If all three armor pieces belong to the same [[Armor Sets|Armor Set], their slots turn bright green — a visual indicator that the full set bonus is active._

<hr>

**Moving items**

Drag an item from one slot to another to move it.

* Dropping on an **empty slot** moves the item there
* Dropping on a **slot with the same item** stacks them (adds counts)
* Dropping on a **slot with a different item** swaps the two

_Armor slots only accept the correct piece type (Head, Body or Foot)._⏳

_Accessory slots only accept accessories. If the destination is occupied, the displaced item returns to the bag._

<hr>

**Action buttons** (center column)

| Button | Shortcut | Description |
| --- | --- | --- |
| Use | [Space] | Uses one unit of the selected item |
| Lock / Unlock | [L] | Prevents a slot from being modified |
| Split | — | Splits a stack into two - Enter the size of the new stack |
| Transfer | [Tab] | Moves selected bag item to chest, or chest item to bag |
| Trash | [Del] | Sends item to the trash |
| Restore | — | Recovers the last trashed item into the bag |
| Craft | [K]] | Opens [[Crafting]] for the selected item |
| Help | [H] | Opens help for the selected item |

* _Most action buttons are only active when a slot is selected._
* _Locked slots cannot be trashed, used or moved._
* _Some unique items cannot be trashed._
* _The trash is cleared when the panel is closed — restore any trashed item before closing._

<hr>

**Containers** (chest panel)

When a [[Housing|chest, closet or cabinet]] is within range, its contents appear in the right panel.⏳

* Use the dropdown to select which container to browse
* Use the Rename button to rename the selected container
* Drag items between the bag and the chest freely
* Use the Arrow button to quickly move the selected item

_If no container is in range, the chest panel is inactive._

<hr>

**Tips**

* Lock your most important tools so they cannot be accidentally trashed or moved
* Use the hotbar for items you need fast — [[Hotbar|read more]]
* Accessories and armor give passive bonuses as long as they are equipped
* Trinkets give bonuses simply by being present in your bag — no need to equip them
    `
  },

  // ── Gameplay ─────────────────────────────────────────────────
  //    Buffs, Buff Panel, Movement Speed,  World Creation

  {
    title: 'Buffs',
    category: ['Gameplay'],
    content: `
**What are Buffs?**

Buffs are temporary or permanent bonuses (and penalties) that affect almost every aspect of your character: mining speed, movement, loot quantity, crafting efficiency, and much more.

Buffs stack additively — if three sources each give +10% mining speed, you get +30% in total.

**Where do Buffs come from?**

_From the world around you:_

* The [[Moon Phases|moon phase]] influences creature behavior and rare drop rates
* [[Weather]] affects harvesting, movement and some creature spawns
* The [[Day & Night Cycle|time of day]] grants different bonuses depending on the period
* Tiles beneath your feet can slow you down or grant bonuses ([[node:web]], [[node:grassMoss]]...)
* [[Furnitures|Furniture]] placed nearby can provide passive bonuses when you are within range

_From your equipment:_

* Your [[Armors|armor]] (3 slots) provides protection and specialized bonuses
* [[Trinkets]] grant bonuses simply by being present in your inventory
* [[Accessories]] must be placed in dedicated slots to be active (4 slots)
* The tool currently in your hand provides bonuses related to its use

_From consumables:_

* [[Food]] provides a timed bonus after consumption
* [[Potions]] provide powerful timed bonuses — overuse extends the cooldown

_From the world events:_

* [[Events]] such as invasions or meteor strikes activate specific buffs for their duration

**Timed Buffs**

Potions and food activate buffs with a countdown visible in the [[Buff Panel]].
Consuming the same type too quickly extends the cooldown before you can benefit again.⏳

**Buff Categories**

* [[Mining Buffs]] — speed, yield, range
* [[Harvesting Buffs]] — speed, yield, range
* [[Movement Speed|Movement Buffs]] — speed, jump, friction
* [[Combat Buffs]] — damage, defense, critical hits
* [[Housing Buffs]] — placement speed, range
* [[Fishing Buffs]] — better yield, special encounters
* [[Gardening Buffs]] — better yield,
* [[Luck Buffs]] — rare loot, special encounters
* Environmental Buffs — [[Weather|weather]], [[Moon Phases|moon]], [[Day & Night Cycle|time of day]]
  `
  },
  {
    title: 'Buff Panel',
    category: ['Gameplay'],
    content: `
  **Description**

  The Buff Panel is a section in the [[Control Panel]] with display [[Buffs]] status.

  To be continued ⏳
  `
  },
  {
    title: 'Movement Speed',
    category: ['Gameplay'],
    content: `
**Description**

Movement Speed determines how fast the player moves through the world. The base speed can be altered by terrain, equipment, and buffs.

**Terrain Modifiers**

| Terrain | Effect | Location |
|---|---|---|
| [[node:web]] | -50% | [[Cobweb Cave]] and [[node:web]] hanging from ceilings of dark corners |
| [[item:velvetmoss]] | -10% | [[Moss Cave]] floor and walls |

**Equipment Modifiers** ⏳

**Buff & Debuff Modifiers** ⏳

**Display**

Carrying a [[item:stopwatch]] or a [[item:chronometer]] in your [[Inventory]] displays in the [[Control Panel]] your current Movement Speed as a percentage.

**Tips**

* _Velvetmoss patches are visually distinct — you can plan your path to avoid them if speed matters._ ⏳
* _Boots with traction bonuses can partially offset terrain penalties._ ⏳
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

**Display and Accuracy**

The current time is displayed in the [[Control Panel]], below the action icons.

By default, time is shown with a 3-hour precision.

Carrying one of the following [[Trinkets]] in your [[Inventory]] improves accuracy:

| Clock | Tier | Accuracy |
|---|---|---|
| [[item:clockCopper]] | {{item:clockCopper:star|star}} | 1 in-game hour |
| [[item:clockSilver]] | {{item:clockSilver:star|star}} | 15 in-game minutes |
| [[item:clockGold]] | {{item:clockGold:star|star}} | 5 in-game minutes |

**Tips**

* _Night lasts 6 in-game hours — make sure you are sheltered before 21:00._ ⏳
* _Dawn and Midnight are the most dangerous periods — monsters are most active._ ⏳
* _Use [[item:clockCopper|Clocks]], [[item:bottledFrog]] and [[item:sextant]] for precise environment tracking._
  `
  },
  {
    title: 'Weather',
    category: ['Gameplay', 'Plant', 'Foraging', 'Fishing'],
    content: `
**Description**

Weather changes every night at midnight and lasts the full day.
The current weather is displayed in the [[Control Panel]], beside the [[Moon Phases|moon phase]].

**Weather Types**

| Type | Description |
|---|---|
| Sunny | Clear skies and bright sunlight |
| Cloudy | Overcast with diffuse light |
| Rainy | Steady rainfall |
| Windy | Strong air currents |
| Stormy | Heavy rain with lightning |

**Forecast**

Carrying a [[item:bottledFrog]] or an [[item:astrolabe]] in your [[Inventory]] displays tomorrow's weather in the [[Control Panel]].

**Effects**

* Monster spawn rates and types ⏳
* Loot drop rates and available items ⏳
* [[Flora|Plant]] growth speed and harvest cycles ⏳
* [[Fishing]] conditions ⏳
* Triggering or preventing certain [[Events]] ⏳

**Tips**

* _Plan your activities around the forecast — a Stormy day may unlock rare loot._
* _Use [[item:clockCopper|Clocks]], [[item:bottledFrog]] and [[item:sextant]] for precise environment tracking._
  `
  },
  {
    title: 'Moon Phases',
    category: ['Gameplay', 'Plant', 'Foraging', 'Fishing'],
    content: `
**Description**

The moon progresses through an eight-phase cycle, changing every night at midnight.
Its current phase is visible in the [[Control Panel]].

**Moon Cycle**

| # | Phase | Description |
|---|---|---|
| 1 | Full Moon | Entire circular moon visible |
| 2 | Waning Gibbous | Mostly visible, right side darkening |
| 3 | Third Quarter | Left half visible |
| 4 | Waning Crescent | Thin left crescent visible |
| 5 | New Moon | No moon visible |
| 6 | Waxing Crescent | Thin right crescent visible |
| 7 | First Quarter | Right half visible |
| 8 | Waxing Gibbous | Mostly visible, left side filling |

The cycle begins with a Full Moon upon world creation and repeats every eight nights.

**Display**

By default, four icons are used to represent the eight phases:

* _Full Moon_ icon — Waning Gibbous, Full Moon, Waxing Gibbous
* _Third Quarter_ icon — Third Quarter, Waning Crescent
* _New Moon_ icon — New Moon
* _First Quarter_ icon — Waxing Crescent, First Quarter

The [[Sextant]] displays a unique icon for each of the eight phases.
It does not need to be equipped — carrying it in your [[Inventory]] is enough.

**Effects** ⏳

* Enemy spawn rates
* [[Fishing]] power
* [[Flora|Plant]] life cycle — growth stages and harvesting
* Other gameplay mechanics ⏳

**Tips**

* _Plan activities around beneficial moon phases._
* _Use [[item:clockCopper|Clocks]], [[item:bottledFrog]] and [[item:sextant]] for precise environment tracking._
  `
  },

  // ── Gameplay ─────────────────────────────────────────────────
  //    Achievements, Achievements Panel
  {
    title: 'Achievements',
    category: ['Gameplay'],
    content: `
**Description**

The Achievements system tracks your progress across all activities in Sixty-Below — mining, crafting, foraging, combat, and more. Points are awarded as you reach milestones, giving a sense of progression in the sandbox.

**How points are earned**

Each tracked item or activity has three thresholds. Reaching each threshold earns a fixed number of points:

| Threshold | Points earned | Running total |
| --- | --- | --- |
| 1st | +5 pts | 5 pts |
| 2nd | +2 pts | 7 pts |
| 3rd | +1 pt | 8 pts |

The maximum score per item is **8 points**.

**Categories**

Items are grouped into categories (e.g. Mining — Ores, Crafting — Bars). All items within a category share the same thresholds.

Each category also offers a **completion bonus** of up to 8 points, based on the minimum score of its members:

| Minimum score across all members | Completion bonus |
| --- | --- |
| All members ≥ 5 pts | 5 pts |
| All members ≥ 7 pts | 7 pts |
| All members = 8 pts | 8 pts |

**Multi-source items**

Some items can be obtained in multiple ways (e.g. baits from tree-shaking or foraging). They are tracked in a single counter, listed under their most natural collection method.

**Crafting**

Crafting achievements count the number of **runs** executed, not the number of items produced per run. This keeps thresholds consistent across all recipes regardless of yield.

**Tips**

* _Open the [[Achievements Panel]] with **[U]** to track your progress at any time._
* _Completion bonuses reward consistent progress — advancing all items in a category is more rewarding than maxing out a single one._
  `
  },
  {
    title: 'Achievements Panel',
    category: ['Gameplay'],
    content: `
**Description**

Displays your current achievement score and lets you browse progress by category.

Press **[U]** or click the trophy icon in the [[Control Panel]] to open it.

**Summary**

The header shows your total achievement points, the maximum possible score, and a percentage indicator.

**Category list**

Each row shows a category label and its current score out of the maximum. The score color reflects the category completion bonus level:

| Color | Completion level |
| --- | --- |
| Grey | No progress yet |
| Blue | At least one item started |
| Yellow | All items past the first threshold |
| Orange | All items past the second threshold |
| Green | Category fully completed |

**Category detail**

Click a category row to expand its detail. Each line shows:

* The item name
* Current count / next threshold (✓ when maxed)
* Points earned (0, 5, 7 or 8), using the same color convention

Click the same row again to collapse. Only one category can be expanded at a time.

**Tips**

* _See [[Achievements]] for a full explanation of how points are calculated._
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
// 3.1 Array des catégories (pour le menu déroulant)
const _catSet = new Set() // Intermédiaire : Set pour l'unicité
for (const entry of HELP) {
  for (const cat of entry.category) _catSet.add(cat)
}
// Export : tableau trié alphabétiquement
export const HELP_CATEGORIES = [..._catSet].sort()

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

// Dans data-help.mjs, avant hydrateHelp

const resolveNodeLinks = (entry, NODES) => {
  let errors = 0
  entry.content = entry.content.replace(/\[\[node:([^\]|]+)(?:\|([^\]]*))?\]\]/g, (match, code, text) => {
    const node = NODES[code.toUpperCase()]
    if (!node) {
      console.error(`[help] '${entry.title}' : node inconnu '${code}'`)
      errors++
      return `⚠️ [[node:${code}]]`
    }
    const label = text ?? node.name
    if (node.help === entry.title) return label
    return `[[${node.help}|${label}]]`
  })
  return errors
}

const resolveItemLinks = (entry, ITEMS) => {
  let errors = 0
  entry.content = entry.content.replace(/\[\[item:([^\]|]+)(?:\|([^\]]*))?\]\]/g, (match, code, text) => {
    const item = ITEMS[code]
    if (!item) {
      console.error(`[help] '${entry.title}' : item inconnu '${code}'`)
      errors++
      return `⚠️ [[item:${code}]]`
    }
    const label = text ?? item.name
    if (item.help === entry.title) return label
    return `[[${item.help}|${label}]]`
  })
  return errors
}

const resolveMonsterLinks = (entry, MONSTERS) => {
  let errors = 0
  entry.content = entry.content.replace(/\[\[monster:([^\]|]+)(?:\|([^\]]*))?\]\]/g, (match, code, text) => {
    const monster = MONSTERS[code]
    if (!monster) {
      console.warn(`[help] '${entry.title}' : monster inconnu '${code}'`)
      errors++
      return `⚠️ [[monster:${code}]]`
    }
    const label = text ?? monster.name
    if (monster.help === entry.title) return label
    return `[[${monster.help}|${label}]]`
  })
  return errors
}

const renderLists = (html) => {
  const LIST_STYLES = ['disc', 'circle', 'square']

  const lines = html.split('\n')
  const out = []
  let currentLevel = -1

  for (const line of lines) {
    const match = line.match(/^(\s*)\* (.+)/)

    if (!match) {
      // Fermeture de tous les niveaux ouverts
      while (currentLevel >= 0) {
        out.push('</ul>')
        currentLevel--
      }
      out.push(line)
      continue
    }

    const level = match[1].length / 2
    const content = match[2]

    if (level > currentLevel) {
      // Ouverture d'autant de <ul> que nécessaire
      while (currentLevel < level) {
        currentLevel++
        out.push(`<ul style="list-style-type:${LIST_STYLES[currentLevel % 3]}">`)
      }
    } else if (level < currentLevel) {
      // Fermeture des niveaux excédentaires
      while (currentLevel > level) {
        out.push('</ul>')
        currentLevel--
      }
    }

    out.push(`<li>${content}</li>`)
  }

  // Fermeture finale si la liste est en fin de contenu
  while (currentLevel >= 0) {
    out.push('</ul>')
    currentLevel--
  }

  return out.join('\n')
}

const resolveLinks = (entry) => {
  let errors = 0
  entry.html = entry.html.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (match, topic, label) => {
    const display = label ?? topic
    if (!HELP_TITLES.has(topic)) {
      if (!display.startsWith('monster:')) {
        console.error(`[help] '${entry.title}' : topic inconnu '${topic}'`)
      }
      errors++
      return `⚠️ ${label ? `${topic}|${label}` : topic}`
    }
    return `<a class="help-link" data-nav="${topic}">${display}</a>`
  })
  return errors
}

const renderTables = (html) => {
  const lines = html.split('\n')
  const out = []
  let inTable = false

  for (const line of lines) {
    if (!line.startsWith('|')) {
      // Fermeture de la table en cours
      if (inTable) {
        out.push('</tbody>')
        out.push('</table>')
        inTable = false
      }
      out.push(line)
      continue
    }

    // Ligne séparateur |---|---|---| → ignorée
    if (line.replace(/[|\-\s]/g, '') === '') continue

    // Parser les cellules
    const cells = line.split('|').map(c => c.trim()).filter((c, i, arr) => i > 0 && i < arr.length - 1)

    if (!inTable) {
      out.push('<table class="help-table">')
      out.push('<thead>')
      out.push('<tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr>')
      out.push('</thead>')
      out.push('<tbody>')
      inTable = true
      continue
    }

    out.push('<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>')
  }

  // Fermeture finale si table en fin de contenu
  if (inTable) {
    out.push('</tbody>')
    out.push('</table>')
  }

  return out.join('\n')
}

const BLOCK_TAGS = ['<ul', '<table', '<ol']

const renderParagraphs = (html) => html.split('\n\n').map(block => {
  const trimmed = block.trim()
  if (!trimmed) return ''
  if (BLOCK_TAGS.some(tag => trimmed.startsWith(tag))) return trimmed
  return `<p>${trimmed}</p>`
}).join('\n')

const resolvePath = (type, code, segments, NODES, ITEMS, MONSTERS) => {
  // 1. Objet racine
  let obj
  if (type === 'node') {
    obj = NODES[code.toUpperCase()]
  } else if (type === 'item') {
    obj = ITEMS[code]
  } else if (type === 'monster') {
    obj = MONSTERS[code]
  } else {
    return {value: null, tail: [], error: `type inconnu '${type}'`}
  }

  if (!obj) return {value: null, tail: [], error: `${type} inconnu '${code}'`}

  // 2. Traversal des segments
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const matchIndex = seg.match(/^([^[]+)\[(\d+)\]$/)
    const matchStar = seg.match(/^([^[]+)\[\*\]$/)

    if (matchStar) {
      // [*] — on s'arrête ici, tail = segments restants
      const field = matchStar[1]
      if (!Array.isArray(obj[field])) {
        return {value: null, tail: [], error: `'${field}' n'est pas un tableau`}
      }
      obj = obj[field]
      return {value: obj, tail: segments.slice(i + 1), error: null, isStar: true}
    } else if (matchIndex) {
      const field = matchIndex[1]
      const idx = parseInt(matchIndex[2])
      if (!Array.isArray(obj[field])) {
        return {value: null, tail: [], error: `'${field}' n'est pas un tableau`}
      }
      obj = obj[field][idx]
    } else {
      obj = obj[seg]
    }

    if (obj === undefined || obj === null) {
      return {value: null, tail: [], error: null, isMissing: true}
    }
  }

  return {value: obj, tail: [], error: null, isStar: false}
}

const formatValue = (resolved, format, entryTitle, path) => {
  const {value, tail, error, isStar, isMissing} = resolved

  // Erreur de traversal
  if (error) {
    if (error === '⏳ recipe non implémenté') {
      console.warn(`[help] '${entryTitle}' : ${error}`) // PROVISOIRE
    } else {
      console.error(`[help] '${entryTitle}' : ${error}`)
    }
    return `⚠️ ${path}`
  }

  // Champ absent
  if (isMissing) {
    if (format === 'optional') return ''
    // pas de console.error — champ optionnel toléré silencieusement
    return ''
  }

  // Valeur finale objet sans format adapté
  if (typeof value === 'object' && !isStar && format !== 'loot' && format !== 'link') {
    console.error(`[help] '${entryTitle}' : valeur non affichable (objet) '${path}'`)
    return `⚠️ ${path}`
  }

  switch (format) {
    case 'star': {
      let n = parseInt(value)
      if (isNaN(n)) {
        console.error(`[help] '${entryTitle}' : valeur star invalide '${value}'`)
        return `⚠️ ${path}`
      }
      n = Math.max(1, Math.min(5, n))
      return '⭐'.repeat(n) + '☆'.repeat(5 - n)
    }

    case 'link': {
      if (!value.help || !value.name) {
        console.error(`[help] '${entryTitle}' : objet sans .help ou .name '${path}'`)
        return `⚠️ ${path}`
      }
      if (value.help === entryTitle) return value.name // fiche courante → texte seul
      return `[[${value.help}|${value.name}]]`
    }

    case 'list': {
      if (!isStar) {
        console.error(`[help] '${entryTitle}' : format 'list' requiert [*] '${path}'`)
        return `⚠️ ${path}`
      }
      const lines = []
      for (const item of value) {
        const leaf = tail.length ? tail.reduce((o, s) => o?.[s], item) : item
        lines.push(`* ${leaf ?? '⚠️'}`)
      }
      return lines.join('\n')
    }

    case 'lines': {
      if (!isStar) {
        console.error(`[help] '${entryTitle}' : format 'lines' requiert [*] '${path}'`)
        return `⚠️ ${path}`
      }
      const parts = []
      for (const item of value) {
        const leaf = tail.length ? tail.reduce((o, s) => o?.[s], item) : item
        parts.push(String(leaf ?? '⚠️'))
      }
      return parts.join('<br>')
    }

    case 'rows': {
      if (!isStar) {
        console.error(`[help] '${entryTitle}' : format 'rows' requiert [*]`)
        return `⚠️ ${path}`
      }
      const lines = []
      for (const item of value) {
        const leaf = tail.length ? tail.reduce((o, s) => o?.[s], item) : item
        lines.push(String(leaf ?? '⚠️'))
      }
      return lines.join('\n')
    }

    case 'loot':
      // ⏳ à implémenter lors de la conception de combatOverlay
      return '⏳ loot'

    case 'optional':
      return String(value)

    default:
      // Pas de format ou format inconnu — valeur brute
      if (format && format !== '') {
        console.error(`[help] '${entryTitle}' : format inconnu '${format}'`)
        return `⚠️ ${path}`
      }
      return String(value)
  }
}

const resolveDynamic = (entry, NODES, ITEMS, MONSTERS) => {
  let errors = 0
  entry.content = entry.content.replace(
    /\{\{(node|item|monster):([^:}]+)((?::[^|}]+)*?)(?:\|([^}]*))?\}\}/g,
    (match, type, code, pathStr, format) => {
      const segments = pathStr ? pathStr.slice(1).split(':') : []
      const resolved = resolvePath(type, code, segments, NODES, ITEMS, MONSTERS)
      const result = formatValue(resolved, format ?? '', entry.title, match)
      if (result.startsWith('⚠️')) errors++
      return result
    }
  )
  return errors
}

const resolveRecipes = (entry, RECIPES, ITEMS, recipeByResult) => {
  let errors = 0
  entry.content = entry.content.replace(
    /\{\{recipe:([^|}\s]+)\|(\w+)\}\}/g,
    (match, code, format) => {
      let recipe = null
      for (const r of RECIPES) {
        if (r.result.item.code === code) { recipe = r; break }
      }
      if (!recipe) {
        console.error(`[help] '${entry.title}' : recipe pour item '${code}' introuvable`)
        errors++
        return `⚠️ {{recipe:${code}|${format}}}`
      }
      const result = formatRecipe(recipe, format, entry.title, ITEMS, recipeByResult)
      if (result === null) { errors++; return `⚠️ {{recipe:${code}|${format}}}` }
      return result
    }
  )
  return errors
}

const formatRecipe = (recipe, format, entryTitle, ITEMS, recipeByResult) => {
  switch (format) {
    case 'station': {
      const station = recipe.station
      if (!station?.code || !station?.help) {
        console.error(`[help] '${entryTitle}' : recipe '${recipe.result.item.code}' — station invalide`)
        return null
      }
      if (station.help === entryTitle) return station.name
      return `[[${station.help}|${station.name}]]`
    }
    case 'ingredients': {
      const parts = []
      for (const ing of recipe.ingredients) {
        const item = ing.item
        if (!item?.help || !item?.name) {
          console.error(`[help] '${entryTitle}' : recipe '${recipe.result.item.code}' — ingrédient invalide`)
          return null
        }
        parts.push(item.help === entryTitle ? item.name : `[[${item.help}|${item.name}]]`)
      }
      return parts.join(', ')
    }
    case 'allStations': {
      const stationCodes = new Set()
      const visited = new Set([recipe.result.item.code])
      const queue = [recipe]

      for (let i = 0; i < queue.length; i++) {
        const r = queue[i]
        stationCodes.add(r.station.code)
        for (const ing of r.ingredients) {
          const code = ing.item.code
          if (visited.has(code)) continue
          visited.add(code)
          const sub = recipeByResult.get(code)
          if (sub) queue.push(sub)
        }
      }

      const parts = []
      for (const code of stationCodes) {
        const item = ITEMS[code]
        parts.push(item.help === entryTitle ? item.name : `[[${item.help}|${item.name}]]`)
      }
      return parts.join(', ')
    }
    case 'allIngredients': {
      const leaves = new Map()
      const visited = new Set([recipe.result.item.code])
      const queue = [recipe]

      for (let i = 0; i < queue.length; i++) {
        const r = queue[i]
        for (const ing of r.ingredients) {
          const code = ing.item.code
          if (visited.has(code)) continue
          visited.add(code)
          const sub = recipeByResult.get(code)
          if (sub) {
            queue.push(sub)
          } else {
            leaves.set(code, ing.item)
          }
        }
      }

      const parts = []
      for (const item of leaves.values()) {
        parts.push(item.help === entryTitle ? item.name : `[[${item.help}|${item.name}]]`)
      }
      return parts.join(', ')
    }
    default:
      console.error(`[help] '${entryTitle}' : format recipe inconnu '${format}'`)
      return null
  }
}

// l'ordre est **très important**
const renderMarkdown = (entry) => {
  let errors = 0
  // 1. Copie dans le champ HTML
  entry.html = entry.content

  // 2. Gras
  entry.html = entry.html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // 3. Souligné (avant italique — double underscore)
  entry.html = entry.html.replace(/__(.+?)__/g, '<u>$1</u>')

  // 4. Italique
  entry.html = entry.html.replace(/_(.+?)_/g, '<em>$1</em>')

  // 5. Listes
  entry.html = renderLists(entry.html)

  // 6. Liens
  errors += resolveLinks(entry) // résout [[...|...]] → <a>

  // 7. Tables
  entry.html = renderTables(entry.html)

  // 8. Passe finale : blocs → <p>
  entry.html = renderParagraphs(entry.html)

  // entry.content est conservé intentionnellement pour le filtrage textuel dans HelpOverlay

  return errors
}

export const hydrateHelp = (NODES, ITEMS, RECIPES, MONSTERS = {}) => {
  let count = 0
  let errors = 0

  const recipeByResult = new Map()
  for (const recipe of RECIPES) {
    recipeByResult.set(recipe.result.item.code, recipe)
  }

  for (const entry of HELP) {
    // liens
    errors += resolveNodeLinks(entry, NODES)
    errors += resolveItemLinks(entry, ITEMS)
    errors += resolveMonsterLinks(entry, MONSTERS)
    // Résolution des données dynamiques {{...}}
    errors += resolveDynamic(entry, NODES, ITEMS, MONSTERS)
    errors += resolveRecipes(entry, RECIPES, ITEMS, recipeByResult)
    // Conversion Markdown → HTML (entry.html = html généré)
    errors += renderMarkdown(entry)
    count++
  }

  return {count, errors}
}
