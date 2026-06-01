# ROADMAP — Sixty-Below

> Document de suivi global du projet. Mis à jour au fil du développement.
> Pour la vision et les mécaniques → `DESIGN.md`. Pour l'API technique → `TECHNICAL.md`.

---

## En cours

- implémentation de l'affichage des tuiles (top soil à faire)
- ajouter l'affichage du furniture sous la souris (`TileHoverWidget`)
- Sauvegarde de la position du joueur en database
- brancher les vrais meubles à l'inventaire
- brancher les vrais meubles au craft panel
- continuer la correction et l'ajout de fiches d'aide (`HELP`) et d'items (`ITEMS`)

---

## Dette technique

- Vérifier que la convention pour les variables privées est prise en compte partout :
  - fait pour `inventory.mjs`, `craft.mjs`, `help.mjs`, `achievement.mjs`, `ui.mjs`
- Vérifier que les en-têtes des fonctions sont présents et à jour (prise en compte des modifications de conception) :
  - fait pour `inventory.mjs`, `craft.mjs`, `help.mjs`, `achievement.mjs`, `ui.mjs`
- Remplacer les styles inline par des règles CSS injectées dans le DOM.
  - fait pour `inventory.mjs`, `craft.mjs`, `help.mjs`, `achievement.mjs`, `ui.mjs`

---

## À faire — Bugs connus dans génération du monde
- Les coffres de surface semble une tuile trop basse
- Les coffres de surface sont posés dans la SEA : on doit annuler la pose dans ce cas
- Les meubles sont mal positionnés en y dans les maisons anciennes

## À faire — Bugs connus
- bound bound processSave : double 'bind' pour cette fonction
- Dans le control panel, le survol de l'heure doit donner la période du jour (dawn...)
- Il n'y a pas assez de Cactus dans le monde => sans doute pas assez de SAND sur le sol souterrain.
- Il n'y a pas assez de Bamboo dans le monde => sans doute pas assez de SILT sur le sol souterrain.
- Il n'y a pas assez de Oleanders dans le monde => sans doute pas assez de STONE sur le sol souterrain.
- Il est aussi possible que le sol soit trop accidenté pour disposer de spots élligibles en nombre suffisant, il faudrait ajouter alors une érosion partielle, en bouchant les trous et supprimant les bosses dans 80-90% des cas.
- Génération du monde : densité un peu trop faible des tunnels en Surface
- Génération du monde : densité trop élevée des tunnels en Underground et Caverns (revoir les constantes `SMALL_TUNNELS_COUNT` et `CAVERNS_TUNNEL_COUNT`)

## À faire — Amélioration

- Mettre les bonnes icônes dans le titre des Overlays
- Remplacer toutes les icônes Unicode par des icônes SVG ou image png (météo, phases de la lune)
- Remplacer le `new Uint8Array(256)` de `getChunkData` par un buffer statique réutilisable pré-alloué — quand la fonction sera à nouveau nécessaire (sauvegarde, génération). Si elle n'est pas utilisée : la supprimer (code mort).

---

## À faire — Buffs

- `BuffManager` :
  - récupération des timer buffs dans la fonction `init`, lancement `TaskScheduler`
  - traitement de chaque `eventBus` qui impacte un ou plusieurs buff
  - implémenter les buffs composés à chaque fois que l'un d'entre eux est défini (`#fns`) :
    - `range-chest`
    - `range-station`
  - vérifier que l'affichage des anciens buffs après création du monde pendant une seconde max est acceptable

---

## À faire — Data (`data.mjs`)

- Table MONSTERS : attributs complets (spawn, comportement, drops, conditions d'apparition)
- Compléter les items : Oak Root, Mahogany Root, Mycelium, Taproot
- Recettes utilisant les nouveaux matériaux (marbre, granite, obsidian, shell...)
- Machines ancestrales : Décomposeur (rendement 80%) et Transmutateur — comme Furniture spécial

### Utilitaire node.js pour génération du fichier d'aide

Le fichier d'aide servira de référence pour l'IA, format HTML.
Mettre le fichier dans le dossier 'Téléchargement'.

```javascript
import {HELP, hydrateHelp} from '../src/data-help.mjs'
import {NODES, ITEMS, RECIPES} from '../src/data.mjs'
import fs from 'fs'

hydrateHelp(NODES, ITEMS, RECIPES)
const htmlHelp = []
for (const {html} of HELP) {
  htmlHelp.push(html)
  htmlHelp.push('<hr>')
}
fs.writeFileSync('docs/help-rendered.html', htmlHelp.join('\n'))
```

---

## À faire — Gameplay

### Exploration
- Physique AABB et collisions
- Caméra centrée joueur, zoom
- Minage (vitesse selon `speed` du node, drops)
- Cycle jour/nuit, météo, phases de lune
- implémenter playerManager.getCenterTile() // renvoie l'index de la tuile située au milieu du player (pour les Ranges)

### Faune & Critters
- Spawning par biome/layer (table MONSTERS)
- Comportements : suit, fuit, erre
- Critters : capture au filet, bait pour pêche
- Boss : mécaniques spécifiques (Pharaon, Queen Bee, Tarentula King...)

### Pêche
- Canne à pêche + bait
- Poissons par tier selon la zone liquide (SEA, WATER, SAP)
- Blind Lake : BLIND FISH et AXOLOTL (tier 5)

### Flore
- Croissance des arbres (Oak, Mahogany, Cactus, Giant Mushroom)
- Drops à l'abattage complet (Root, Mycelium, Taproot)
- Agriculture : semences, pousses, récolte
- Utiliser `placed`, `placedLeft` et `placedRight` pour sunfower en fonction de l'heure du jour

### Housing
- Construction shelter (protection nocturne)
- Furniture (`FurnitureManager`) :
  - Tests
  - Ajout de l'affichage
- Machines ancestrales inamovibles (Lost Temple, Ancient House)

### Artisanat
- Recettes et crafting stations
- Décomposeur (rendement 80%) et Transmutateur (résolution pénurie de ressources)


### Meteorite (événement runtime)
- Événement rare : impact depuis l'espace, détruit arbres/plantes/shelter/furniture
- Tuiles METEORITE minables, tier 5
- Oxydation progressive en quelques jours (timer global)
- À implémenter dans `ecosystem.mjs`, pas dans `generate.mjs`

### Invasion de pirates (événement runtime)

### Invasion d'aliens (événement runtime)

### Bucket Capacity

Ajouter une capacity (12) aux buckets :
* quand on le remplit, capacity = 12
* à chaque utilisation en tant qu'outil (bucket en main, clic sur une tuile vide du monde), capacity--
* à chaque fois qu'une bouteille est remplie (bouteille vide en main, clic sur un bucket placed), capacity--
* quand capacity devient 0 => empty bucket
* affichage de la capacity dans l'inventaire, en 'title' sur les slots
* lors des manipulations de l'inventaire, il faut également recopier capacity, uniquement s'il existe

### Gold Bucket

La Sap corrode le Copper. Il doit donc être remplacer par du Gold.
* ajout d'un item 'Gold BUcket'
* modification du tooltip du 'Bucket'
* à chaque utilisation du bucket en tant qu'outil (bucket en main, clic sur une tuile vide du monde), si 'Bucket' alors Ssap interdite, si 'Gold Bucket' alors seul Sap autorisée
* quand capacity devient 0 => empty Gold Bucket

---

## À faire — Combat (`combat.mjs`)

- Déclenchement au contact faune agressive
- Grille tactique générée selon biome + layer
- PA / PM, initiative, ligne de vue (LOS)
- Challenges (sous-buts en combat)
- Boss avec mécaniques spécifiques
- Pièges dans Pyramid et structures anciennes
- Idée : boss 'Chimera' dont les sorts sont tirés aléatoirement parmi les sorts de trois autres monstres (tirage slot à clot)

---

## À faire — Rendu (`render.mjs`)

- Auto-tiling (transitions de texture entre tuiles adjacentes)
- Rendu flore (arbres, mushrooms, cactus)
- Rendu liquides (animations)
- Éclairage (LightRenderer — 4 passes)
- Cycle jour/nuit (SkyRenderer)
- Rendu faune et player (sprites animés)

---

## À faire — Écosystème (`ecosystem.mjs`)

- Régénération WEB (timer global, tous espaces vides souterrains)
- Régénération HONEY dans les ruches
- Régénération SAP dans les Sap Pockets (lente)
- Régénération Shell en bord/fond de mer
- Croissance flore hors-vue (décorrélée des chunks)
- Événement Meteorite (impact, dégâts, oxydation)

---

## À faire — UI (`ui.mjs`)

- Panel combat (overlay tactique)

---

## Connu mais différé

- Nettoyage `ROADMAP.md` : supprimer les entrées au fur et à mesure
- Sprites manquants : GRASSFERN, GRASSMUSHROOM
---

## Terminé

### Kernel (Layer 0–2)
- `constant.mjs` — constantes, enums, bitmasks
- `utils.mjs` — EventBus, MicroTasker, TaskScheduler, TimeManager, seededRNG
- `database.mjs` — Database
- `core.mjs` — GameLoop, InputManager, KeyboardManager

### Données (Layer 3)
- `data.mjs` — NODES, ITEMS, PLANTS, RECIPES (structure + cross-références)
- `data-gen.mjs` — BIOME_TILE_MAP, CLUSTER_SCATTER_MAP, ORE_GEM_SCATTER_MAP, TOPSOIL_SCATTER_MAP, LAKE_CREATION_MAP, constantes de génération

### Génération du monde
- `BiomesGenerator` — disposition horizontale des biomes, largeurs des mers
- `BiomeNaturalizer` — substrats par biome/layer (Perlin + diffusion), frontières horizontales et verticales
- `ClusterGenerator` — substrats, ores, gemmes, obsidian, topsoil (clusters)
- `ClusterGenerator.initZoneRects` — pré-calcul des rectangles biome x layer
- `ClusterGenerator.addSubstratClusters` — clusters substrat avec intrusions inter-biomes
- `ClusterGenerator.addOreClusters` — clusters ore/gem
- `ClusterGenerator.addGemIntrusions` — gemmes hors biome/layer natif
- `ClusterGenerator.addOreIntrusions` — ores dans layers supérieures
- `LiquidFiller.fillSea` — BFS flood-fill mer gauche et droite
- `LiquidFiller.fillLake` — BFS flood-fill lacs de surface
- `LiquidFiller.fillHive` — BFS VOID → HONEY depuis cy+1
- `WebFiller.fillCobwebCave` — peuplement WEB des cobweb caves
- `WebFiller.scatterWebs` — dispersion WEB globale post-creusement
- `WorldCarver.digCavernsTunnels` — tunnels profonds
- `WorldCarver.digSmallTunnels` — petites galeries
- `WorldCarver.digHives` — ruches avec HONEY, protection TileGuard (avec intrusion 1 monde/2)
- `WorldCarver.digCobwebCaves` — cavernes à toiles d'araignées  (avec 1 intrusion en layer 'under')
- `WorldCarver.digGeodeCaves` — géodes granite/marble (avec intrusion caverns_top)
- `WorldCarver.digSurfaceLakes` — lacs/oasis de surface avec pit, berges, fond protégés et TileGuard
- `WorldCarver.digUndergroundLakes` — lacs ouverts en profondeur, moitié inférieure du fond protégée et TileGuard
- `WorldCarver.digBlindLakes` — lacs fermés en grande profondeur, protégée et TileGuard
- `WorldCarver.digWaterPuddles` — flaques d'eau dans le fond des tunnels et cavernes
- `WorldCarver.digSapLakes` — lacs de sève ouverts en profondeur, moitié inférieure du fond protégée et TileGuard (JUNGLE uniquemen)
- `WorldCarver.digSapPockets` — poches des sève en grande profondeur, protégée et TileGuard (JUNGLE uniquemen)
- `WorldCarver.digHearts` — placement 15 Life Cristals 2x2, under fallback caverns_top
- `WorldCarver.digTriskels` — placement 3 Tryskels 2x2, 2 en caverns_top fallback caverns_bottom et 1 en caverns_bottom
- `WorldCarver.digZigzagTunnels` — tunnels zigzag avec espacement minimal et évitement des lacs
- `WorldCarver.digSurfaceTunnel` — galeries de surface avec évitement des lacs
- `WorldCarver.digFossilVein` — Desert + premier et dernier biome, caverns_top avec migration en under/caverns_bottom, veine horizontale SHELL
- `WorldCarver.digSandPocket` — Desert, under et caverns_top, SAND + SANDSTONE
- `WorldCarver.digFernCaves)` — Forest, under, HUMUS + GRASSFERN
- `WorldCarver.digMossCave` — Jungle, under, MUD + GRASSMOSS
- `WorldCarver.digMushroomCaves` — Forest, caverns_top, HUMUS + GRASSMUSHROOM
- `WorldCarver.digPyramid` — Desert, under, deux chambres (pièges + boss), KEPHRITE
- `WorldCarver.digRuinedCabin` — Forest, under, WOODWALL + STONEWALL + 1 furniture + 1 Chest
- `WorldCarver.digGraveyard` — caverns bottom, tout biome, STONE + DIRT + VOID + furnitures (stype='tomb')
- `WorldCarver.digLostTemple` — Jungle, caverns_top, EMERALDWALL + Décomposeur
- `WorldCarver.digAncientHouse` — Desert, caverns_bottom, WOODWALL + GOLDWALL + OLYMPITE + Transmutator
- `WorldCarver.digAbandonedMine` — Tous biomes, caverns_bottom, COBALT + SAPPHIRE + SANDSTONEWALL
- `WorldCarver.cleanupAfterCarving` — nettoyage post-creusement (4 passes, règles déclaratives)
- `WorldCarver.buildErodedSurfaceLine` — ligne de surface + érosion (trous et bosses)
- `WorldCarver.paintSurfaceNatural` — ajoute les tuiles NATURAL en surface
- `WorldCarver.buildBeach` — ajoute les plages au bord des mers de gauche et de droite
- `WorldCarver.buildSeaFloorAndWalls` — ajoute du sable en fond de mer
- `WorldCarver.digAntlionPits` — Desert, surface, creux triangulaire
- `WorldCarver.digAnthills` — Forest, surface, structure conique ANTDIRT + VOID
- `WorldCarver.reserveTermiteMounds`, `WorldCarver.buildTermiteMounds` — Jungle, surface, structure rectangulaire ANTDIRT + VOID
- `TileGuard` — utilitaire de protection tuiles contre creusement, formes bruitées (cercle, ellipse, rectangle)
- `furnitureGenerator.place...Chests` - ajout des coffres
- `plantGenerator.placeSeaCoconut` - ajout des cocotiers
- `plantGenerator.placeCorals` - ajout des coraux
- `plantGenerator.placeTrees` - ajout des Oaks et Mahoganies
- `plantGenerator.placeGiantMushrooms` - ajout des Giant Mushrooms
- `plantGenerator.spreadNatural` - ajout des tuiles de TOPSOIL ensemencées par des tuiles de NATURAL
- `plantGenerator.placeAmbermirages` - ajout des Ambermirages sur les tuiles de SAND
- `plantGenerator.placeParsnipsSunflowers` - ajout des Parsnips et Sunflowers sur les tuiles de GRASSFOREST
- `plantGenerator.placeBloodmoons` - ajout des Bloodmoon sur les tuiles de GRASSJUNGLE
- `plantGenerator.placeFerns` - ajout des Ferns sur les tuiles de GRASSFERN
- `plantGenerator.placeMoss` - ajout de la mousse sur les tuiles de GRASSMOSS
- `plantGenerator.placeCaveMushrooms` - ajout des champignons sur les tuiles de GRASSMUSHROOM
- `plantGenerator.placeMandrakes` - ajout des Mandrakes en FOREST / Underground / DIRT
- `plantGenerator.placeCactus` - ajout des Cactus en DESERT / Underground / SAND
- `plantGenerator.placeBamboo` - ajout des Bamboos en JUNGLE / Underground / SILT
- `plantGenerator.placeOleanders` - ajout des Oleander en Underground / STONE
- `plantGenerator.placeSatansCubes` - ajout des Satan's Cube en Caverns / FOREST + DESERT
- `plantGenerator.placeSneakthorns` - ajout des Sneakthorns en Caverns / FOREST + JUNGLE
- `plantGenerator.placeCursedcrowns` - ajout des Cursedcrowns en Caverns / DESERT + JUNGLE
- `plantGenerator.placeAbysshorns` - ajout des Abysshorns en Caverns_top
- `plantGenerator.placeInferncaps` - ajout des Inferncaps en Caverns_bottom

### Overlays
- Gestion des dialogue modaux (`ModalBlocker`, `createOverlayHeader`)
- Nouveau monde (`CreationDialogOverlay`)
- Help Panel (`HelpOverlay` et `hydrateHelp`) :
  - Markdown standard
  - Templates avec paramètres ``<<...>>`
  - Liens inter-fiches `[[title]]`
  - Liens `[[item:...]]` et `[[node:...]]`
  - Informations dynamiques : `{{node:...}}` et `{{item:...}}`
- Control Panel
  - `MenuBarWidget`
  - `EnvironmentWidget`
  - `BuffWidget`
  - `RealtimeDebugWidget`
- Inventory Panel (`InventoryOverlay`, `InventorySlot`)
  - Hotbar, Bag, Chest, Armor, Accessory
  - Barre d'actions
  - Déplacement intra et inter containers
  - Verrouillage/déverrouillage des slots
  - Utilisation du contenu d'un slot
  - Séparation d'une pile d'items en deux
  - Gestion de la poubelle
  - Affichage du contenu des coffres à proximité
  - Renommage du coffre sélectionné
- Craft Panel (`CraftOverlay`)
  - Zone de filtrage (textuel, par Crafting Station, par type, par Crafting Material)
  - Mémorisation en database des critères de filtrage (pas le filtre textuel)
  - Affichage liste des recettes (couleur du fond pour recette réalisable avec les ingrédients)
  - Affichage de la recette en cours (indication disponibilité)
  - Panneau de craft (nombre de runs, réalisation du craft)
  - Affichage du Help Panel contextuel
  - Gestion du craft (suppression des Crafting Material, ajout du 'résultat' et des 'returned')

### Gameplay - gestion des items/buffs/recettes

- Gestion de l'inventaire (`InventoryManager`)
- Gestion des buffs (`BuffManager`)
- Affichage des buffs (`BuffWidget`)
- Gestion des meubles placés dans le monde (`FurnitureManager`) / Affichage manquant

### Rendu (partiel)
- `WorldRenderer` — rendu tuiles par chunks avec cache OffscreenCanvas
- `SkyRenderer` — cycle jour/nuit
- `Camera` — projection monde/canvas, culling, zoom
- `FurnitureManager` — affichage des meubles
