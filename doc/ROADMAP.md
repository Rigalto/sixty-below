# ROADMAP — Sixty-Below

> Document de suivi global du projet. Mis à jour au fil du développement.
> Pour la vision et les mécaniques → `DESIGN.md`. Pour l'API technique → `TECHNICAL.md`.

---

## En cours

- Génération du monde : topsoil, végétation, coffres, artefacts
---

## À faire — Génération du monde (`generate.mjs`)

### Tunnels
- Densité trop élevée, notamment juste sous la surface (revoir les constantes `SMALL_TUNNELS_COUNT` et `CAVERNS_TUNNEL_COUNT`)

### Mer — fuite vers le bas
- Le remplissage de la mer n'est pas bloqué vers le bas
- Ajouter une borne basse dans `#fillOneSea` (analogue à `maxY` existant mais côté fond)

### Topsoil
- Placement des TOPSOIL en surface
- Placement des TOPSOIL dans les cavernes et tunnels
- Phase post-creusement : recouvrement des parois de cavernes/tunnels par TOPSOIL (algorithme distinct)

### Surface végétale
- Ajout des NATURAL (GRASS, GRASSJUNGLE) sur les tuiles TOPSOIL exposées
- Traitement désert : écoulement du sable, consolidation des tunnels/cavernes

### Mini-biomes à implémenter
- `TileGuard` : intégrer pour tous les futurs mini-biomes
- `digMushroomCaves()` — Forest, caverns_top, HUMUS + GRASSMUSHROOM
- `digFernCaves()` — Forest, under, HUMUS + GRASSFERN
- `digAnthills()` — Forest, surface, structure conique
- `digTermiteMounds()` — Jungle, surface, structure rectangulaire
- `digAntlionPits()` — Desert, surface, creux triangulaire
- `digPyramids()` — Desert, under, deux chambres (pièges + boss)
- `digFossilVein()` — Desert, caverns_top, veine horizontale SHELL
- `digMossCave()` — Jungle, under, MUD + HUMUS
- `digUndergroundLake()` — Forest, caverns_top, WATER + HUMUS
- `digBlindLake()` — Tous biomes, caverns_bottom, WATER + HARDSTONE
- `digSapPockets()` — Jungle, caverns_bottom, SAPROCK + SAP
- `digRuinedCabin()` — Forest, under, STONEWALL
- `digTempleRuin()` — Jungle, caverns_top, EMERALDWALL + Décomposeur
- `digAncientHouse()` — Desert, caverns_bottom, GOLDWALL + Transmutateur
- `digAbandonedMine()` — Tous biomes, caverns_bottom, OBSIDIAN + COBALTWALL
- `digTriskels()` — Tous biomes, caverns

### Intrusions (mini-biomes hors biome natif)
- `digHiveIntrusions()` — 1 monde/2, biome étranger (déjà implémenté dans `digHives`)
- `digGeodeIntrusions()` — 1 monde/3, caverns_top (déjà implémenté dans `digGeodeCaves`)
- `digCobwebIntrusions()` — 1 caverne systématique en under (déjà implémenté dans `digCobwebCaves`)

### Peuplement différé
- Remplissage SAP dans les Sap Pockets
- Projection GRANITE/MARBLE sur parois des géodes (`projectAndFill` — déjà implémenté)

### Plage et fond de mer
- Ajout des tuiles SHORE en bordure de mer
- Placement des coraux et plantes marines
- Ajout des coffres et objets spéciaux

### Meteorite (événement runtime)
- Événement rare : impact depuis l'espace, détruit arbres/plantes/shelter/furniture
- Tuiles METEORITE minables, tier 5
- Oxydation progressive en quelques jours (timer global)
- À implémenter dans `ecosystem.mjs`, pas dans `generate.mjs`

---

## À faire — Data (`data.mjs`)

- Table MONSTERS : attributs complets (spawn, comportement, drops, conditions d'apparition)
- Compléter les items : Oak Root, Mahogany Root, Mycelium, Taproot, Shell
- Recettes utilisant les nouveaux matériaux (marbre, granite, obsidian, shell...)
- Machines ancestrales : Décomposeur (rendement 80%) et Transmutateur — comme Furniture spécial

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

### Housing
- Construction shelter (protection nocturne)
- Placement furniture (crafting stations, coffres, lits, torches...)
- Machines ancestrales inamovibles (Temple Ruin, Ancient House)

### Artisanat
- Recettes et crafting stations
- Décomposeur (rendement 80%) et Transmutateur (résolution pénurie de ressources)

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
- `addSubstratIntrusions()` — substrat hors biome natif (conception définie, non codée)
- `addOreIntrusions()` — ores dans layers supérieures (déjà implémenté)
- `addGemIntrusions()` — gemmes hors biome/layer natif (déjà implémenté)
- Sprites manquants : HARDSTONE, LIMESTONE, SLATE, GRASSFERN, GRASSMUSHROOM
- Optimisation `WorldCarver.applyTiles` : tester `NODE_TYPE.CREATION` de façon générique plutôt que lister chaque code
- Variante `digLakes` avec fosse (pit) — version de référence conservée sous `_digLakes`

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
- `WorldCarver.digCobwebCaves` — cavernes à toiles d'araignées (avec intrusion under)
- `WorldCarver.digGeodeCaves` — géodes granite/marble (avec intrusion caverns_top)
- `WorldCarver.digLakes` — lacs/oasis de surface avec pit, berges, fond protégés et TileGuard
- `WorldCarver.digHearts` — placement 15 HEART 2×2, fallback caverns_top
- `WorldCarver.digZigzagTunnels` — tunnels zigzag avec espacement minimal et évitement des lacs
- `WorldCarver.digSurfaceTunnel` — galeries de surface avec évitement des lacs
- `WorldCarver.cleanupAfterCarving` — nettoyage post-creusement (3 passes, règles déclaratives)
- `WorldCarver.buildErodedSurfaceLine` — ligne de surface + érosion (trous et bosses)
- `TileGuard` — protection tuiles contre creusement, formes bruitées (cercle, ellipse, rectangle)

### Rendu (partiel)
- `WorldRenderer` — rendu tuiles par chunks avec cache OffscreenCanvas
- `SkyRenderer` — cycle jour/nuit
- `Camera` — projection monde/canvas, culling, zoom
