# ROADMAP — Sixty-Below

> Document de suivi global du projet. Mis à jour au fil du développement.
> Pour la vision et les mécaniques → `DESIGN.md`. Pour l'API technique → `TECHNICAL.md`.

---

## En cours

- Génération du monde : végétation
---

## À faire — Bugs connus
- Dans le panel qui génère un nouveau monde, il faut pouvoir rendre le champ input vide (il est rempli par '1' lorsque l'on tente de le vider, rendant très difficile l'entrée d'une graine ne commençant pas par 1)
- Ajouter dans le panel de droite la clé courante de génération du monde
- Il n'y a pas assez de Cactus dans le monde => sans doute pas assez de SAND sur le sol souterrain.
- Il n'y a pas assez de Bamboo dans le monde => sans doute pas assez de SILT sur le sol souterrain.
- Il n'y a pas assez de Oleanders dans le monde => sans doute pas assez de STONE sur le sol souterrain.

## À faire — Génération du monde (`generate.mjs`)

### Tunnels
- Densité un peu trop faible en Surface
- Densité trop élevée en Underground et Caverns (revoir les constantes `SMALL_TUNNELS_COUNT` et `CAVERNS_TUNNEL_COUNT`)

### Ajout des artefacts et plantes
- Ajout de herbes : Blinkroot, Fireblossom, Oleander, Skorn
- Ajout plante E : biome Forest et Desert / zone caverns
- Ajout plante F : biome Forest et Jungle / zone caverns
- Ajout plante G : biome Jungle et Desert / zone caverns
- Ajout plante H : tous biomes / zone caverns top
- Ajout plante I : tous biomes / zone caverns bottom

---

## À faire — Data (`data.mjs`)

- Table MONSTERS : attributs complets (spawn, comportement, drops, conditions d'apparition)
- Compléter les items : Oak Root, Mahogany Root, Mycelium, Taproot, Shell
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
- Placement furniture (crafting stations, coffres, lits, torches...)
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

---

## À faire — Combat (`combat.mjs`)

- Déclenchement au contact faune agressive
- Grille tactique générée selon biome + layer
- PA / PM, initiative, ligne de vue (LOS)
- Challenges (sous-buts en combat)
- Boss avec mécaniques spécifiques
- Pièges dans Pyramid et structures anciennes

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

- Inventaire complet (slots, équipement, artefacts)
- Panel craft
- Panel carte (touche M, échelle 1/16)
- Buffs/debuffs actifs
- Panel combat (overlay tactique)
- Panel aide

---

## Connu mais différé

- Nettoyage `ROADMAP.md` : supprimer les entrées au fur et à mesure
- Sprites manquants : HARDSTONE, LIMESTONE, SLATE, GRASSFERN, GRASSMUSHROOM
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
- `ClusterGenerator.initZoneRects` — pré-calcul des rectangles biome × layer
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
- `WorldCarver.digHearts` — placement 15 Life Cristals 2×2, under fallback caverns_top
- `WorldCarver.digTriskels` — placement 3 Tryskels 2×2, 2 en caverns_top fallback caverns_bottom et 1 en caverns_bottom
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

### Rendu (partiel)
- `WorldRenderer` — rendu tuiles par chunks avec cache OffscreenCanvas
- `SkyRenderer` — cycle jour/nuit
- `Camera` — projection monde/canvas, culling, zoom
