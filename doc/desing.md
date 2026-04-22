# DESIGN DOC — Sixty-Below

> **AI CONTEXT INSTRUCTION:**
> Ce document est la **Source de Vérité Gameplay** du projet "Sixty-Below".
> Il décrit le *quoi* et le *pourquoi* : vision, mécaniques, monde, UI.
> Pour le *comment* (architecture, API, budgets, algorithmes) → voir `TECHNICAL.md`.
> Toute génération de code doit respecter les contraintes définies dans ces deux documents.

---

## 1. Vision & Contraintes Globales

### 1.1 Concept

**Sixty-Below** est une démonstration technique de jeu par navigateur mélangeant plusieurs gameplays :

1. **Exploration (Temps réel) :** Vue de côté, minage, génération procédurale (type *Terraria*).
2. **Combat (Faune — Tour par tour) :** Grille tactique, points d'action/mouvement, stratégie (type *Dofus*).
3. **Récolte (Flore) :** Vue de côté, outils (hache, faucille, couteau…), écosystème, agriculture.
4. **Artisanat :** Ce qui ne se loote pas se crafte. Recettes, ingrédients, stations.
5. **Housing :** Shelter (protection nocturne), Crafting Station, Entrepôt.

### 1.2 Contraintes Non-Négociables

* **Performance :** 60 FPS constants, navigateur uniquement.
* **Stack :** Vanilla JavaScript (ESNext). Zéro framework (Phaser, Unity…). Zéro bundler (Webpack, Vite…).
* **Architecture :** Client-Side Only. Persistance locale via IndexedDB.
* **Hébergement :** Serverless via GitHub Pages.
* **Patterns :** Singletons pour les Managers. Composition préférentielle à l'héritage.

---

## 2. Architecture Générale

### 2.1 Paradigme

Priorité au **Data-Oriented Design**.

* Architecture de type **ECS (Entity Component System)** pragmatique : composition stricte, pas de chaînes d'héritage.
* Séparation stricte : **Data** (State) / **Logic** (Systems) / **View** (Render).

### 2.2 Couches Architecturales

```
Layer 0 — constant.mjs       Zéro dépendance. Config technique, Enums système, Bitmasks.
Layer 1 — utils.mjs          Utilitaires purs : EventBus, MicroTasker,
          database.mjs       TaskScheduler, TimeManager, seededRNG.
Layer 2 — core.mjs           Kernel : GameLoop, InputManager, KeyboardManager.
─────────────────────────────────────────────────────────────
Layer 3 — assets.mjs         Ressources graphiques/sons.
          persistence.mjs    Orchestration sauvegarde (connaît les stores métier).
          data/data.mjs      Données métier : tuiles, items, plantes, recettes. Zéro dépendance hors constant.mjs.
          data/data-gen.mjs  Données génération (biomes, courbes, paramètres proc-gen)
─────────────────────────────────────────────────────────────
Layer 4+ — Modules Métier    world, render, player, combat, inventory…
          generate.mjs       Algorithmes de génération — importé dynamiquement - Dépend uniquement de utils.mjs, database.mjs, constant.mjs et data-generate.mjs
```

**Règle absolue :** les dépendances ne vont que vers le bas. Un module de Layer N n'importe jamais un module de Layer N+.

### 2.3 Gestion des États (State Machine)

L'`InputManager` (kernel) est l'autorité qui détient l'état courant via une **pile d'overlays**.

| État | Déclencheur | Physique | Rendu | MicroTasker |
|---|---|---|---|---|
| `EXPLORATION` (0) | Défaut | Active | 60 FPS | Actif |
| `INFORMATION` (1) | Overlay ouvert (Inventaire, Craft, Aide) | Hard Stop | Hard Stop | Inactif |
| `CREATION` (2) | Création d'un nouveau monde confirmée | Figée | Figée | Inactif |
| `COMBAT` (3) | Contact faune | Identique à INFORMATION | — | — |

**Routing des inputs :** Combat > Creation > Aide > Craft > Inventory > Exploration.

**Signals d'input :**
* *Continuous (Polling) :* Mouvement en Exploration → Bitmask binaire lu à chaque frame.
* *Discrete (Events) :* Actions one-shot (Ouvrir UI, Taper, Changer Slot) → EventBus.

### 2.4 Découplage (EventBus)

* Communication inter-modules via **Pub/Sub** (`eventBus`), sans dépendance cyclique.
* Règle : si un listener dépasse 0,1 ms de traitement, il délègue au `MicroTasker`.

### 2.5 Le Temps

Deux temporalités strictement séparées :

* **Temps Réel (Playtime) :** ms écoulées moteur allumé. Utilisé par le `TaskScheduler`.
* **Temps Monde (World Time) :** Temps fictif in-game (cycle jour/nuit, météo, lune). Géré par le `TimeManager`.

---

## 3. Système "World" (Exploration)

### 3.1 Structure du Monde

* **Grille 2D :** 1024 × 512 tuiles. Taille tuile : 16 × 16 px. Dimensions fixes, non paramétrables.
* **Stockage Runtime :** `Uint8Array` unique (flat array). 1 octet par tuile = référence vers `NODES_LOOKUP`.
* **Adressage :** `index = (y << 10) | x`. Jamais de clé string `"x_y"`.
* **Optimisation "Ghost Cells" :** Les bords (x=0, x=1023, y=0, y=511) sont immuables → suppression du bounds checking dans les boucles critiques.
* **Échelle :** 1 tuile = 50 cm. Monde ≈ 510 m de large × 254 m de haut.

**Classification des entités :**

* **Tuiles (Grid-based) :** Terrain naturel, liquides, vides (SKY, VOID), murs de fond et de construction. Stockés dans le `Uint8Array`.
* **Furniture (Object-based) :** Éléments posés par le joueur (stations de craft, coffres, lits, portes, feux de camp…). Stockés dans le store `furniture` avec coordonnées.
  * *Cas spécifiques :* Plateformes et sources de lumière (Torches, Lampes) sont des Furniture — pas des tuiles — pour ne pas perturber la physique ni l'éclairage.
  * *Cycle de vie :* L'item est dans l'`inventory` store tant qu'il n'est pas posé. Une fois posé → `furniture` store.

**Map de debug :** Touche `M` → affichage de la carte complète à l'échelle 1/16, couleur dominante des tuiles (`NODES.color`). Disparition par `M` ou `Escape`.

### 3.2 Biomes — Découpage Horizontal

| Biome | Position | Difficulté |
|---|---|---|
| Sea | Bords - 50/50 entre (gauche=3 chunks, droite=4 chunks) et (gauche=4 chunks, droite=3 chunks) | — |
| Forêt | Centre du monde — zone de départ + réparti | Facile |
| Désert | Réparti | Moyen |
| Jungle | Réparti | Difficile |

### 3.3 Layers — Découpage Vertical

| Layer | Position | Difficulté |
|---|---|---|
| Fog | Bord supérieur du monde | — |
| Sky | Au-dessus du monde | — |
| Surface | Haut du monde — zone de départ | Facile |
| Underground | Centrale | Moyen |
| Caverns | Bas du monde | Difficile |
| Lava | Bord inférieur du monde | Difficile |

### 3.4 Types de Tuiles (NODE_TYPE)

Les types sont des bitmasks combinables :

| Type | Rôle |
|---|---|
| `GAZ` | Traversable, pas de collision (ciel, vide) |
| `LIQUID` | Fluide, ralentit le joueur (mer, eau, miel, sève) |
| `SOLID` | Bloque le mouvement |
| `ETERNAL` | Indestructible — tuiles de pourtour intégrées à la lore |
| `NATURAL` | Topsoil en surface recouvert de végétation |
| `TOPSOIL` | Terrain nourricier, propice aux plantes |
| `SUBSTRAT` | Roche de base, peu propice aux plantes |
| `ORE` | Minerai minable, présent en inclusion dans le substrat |
| `GEM` | Gemme minable, présente en inclusion dans le substrat |
| `ROCK` | Roche spéciale (caves exceptionnelles et enfer) |
| `WALL` | Mur de côté des maisons, posable par le joueur |
| `BWALL` | Mur de fond des maisons, posable par le joueur |
| `WEB` | Toile d'araignée — ralentit, piège |

### 3.5 Tuiles de Pourtour (ETERNAL)

Indestructibles, intégrées à la lore. Ne jamais réutiliser leurs noms pour des tuiles ordinaires.

| Tuile | Emplacement | Lore |
|---|---|---|
| `FOG` | Bord supérieur | Brouillard impénétrable |
| `DEEPSEA` | Bords latéraux | Océan abyssal |
| `BASALT` | Bords latéraux profonds | Roche primordiale |
| `LAVA` | Bord inférieur | Magma originel |

### 3.6 Tuiles par Biome et Couche

Chaque combinaison biome/couche correspond à une tuile de substrat distincte avec ses propres propriétés (vitesse de minage, drops, végétation, pop de monstres).

| Couche | FOREST | DESERT | JUNGLE |
|---|---|---|---|
| **natural** | `GRASS` | — | `GRASSJUNGLE` |
| **topsoil** | `DIRT` | `SAND` | `SILT` |
| **surface** | `CLAY` | `SANDSTONE` | `MUD` |
| **underground** | `STONE` | `ASH` | `LIMESTONE` |
| **caverns** | `HARDSTONE` | `HELLSTONE` | `SLATE` |

Le désert n'a pas de tuile NATURAL, car sa végétation est éparse et non couvrante.

Tuiles TOPSOIL transversales (présentes dans plusieurs biomes) :
- `HUMUS` — sous-bois, grottes à champignons, grottes à fougères
- `INVISIBLE` — utilisée derrière les portes fermées (furniture) pour simplifier la détection de collision

Caves spéciales :
- **Granite Cave** (Forêt - GRANITE)
- **Marble Cave** (Desert - MARBLE)
- **Obsidian Cave** (Jungle - OBSIDIAN)
- **Météorite** (Tombe du ciel - METEORITE)
- **Mushroom Cave** (Forest - HUMUS / GRASSMUSHROOM)
- **Fern Cave** (Jungle - HUMUS / GRASSFERN)
- **Hive** (Desert - HIVE / HONEY)

Tuiles spéciales :
- **SKY** : gaz, éclairé par le soleil
- **VOID** : gaz, non éclairé par le soleil
- **INVISIBLE** : gaz, utilisée derrière les portes fermées (furniture) pour simplifier la détection de collision
- **SEA** : eau salée, sur les bords gauche et droit du monde
- **WATER** : eau douce
- **HONEY** : liquide créé dans les **Hive**
- **SAP** : liquide créé dans la jungle

#### 3.6.1 Intrusions de Substrat

Les substrats ne sont pas confinés à leur biome/layer natif. Des processus géologiques
(érosion, pression, sédimentation) et biologiques (faune fouisseuse, racines) provoquent
des migrations de matière entre zones adjacentes.

Ces intrusions sont définies dans `CLUSTER_SCATTER_MAP` (`data-gen.mjs`) et appliquées
par `addSubstratClusters()`. Elles suivent les règles suivantes :

**Substrats de surface** (CLAY / SANDSTONE / MUD) — actifs, mélangés par les liquides,
le vent et la faune :
- Intrusion latérale dans la surface des 2 autres biomes — quantité moyenne
- Migration vers le bas dans le under du même biome — quantité moyenne
- Migration latérale + bas dans le under des 2 autres biomes — quantité faible

**Substrats de under** (STONE / ASH / LIMESTONE) — semi-stables :
- Remontée dans la surface du même biome — quantité moyenne
- Remontée latérale dans la surface des 2 autres biomes — quantité faible
- Intrusion latérale dans le under des 2 autres biomes — quantité moyenne
- Descente dans les caverns_top du même biome — quantité faible
- Descente latérale dans les caverns_top des 2 autres biomes — quantité très faible

**Substrats de caverns** (HARDSTONE / HELLSTONE / SLATE) — lourds, peu mobiles :
- Intrusion latérale dans les caverns des 2 autres biomes — quantité moyenne
- Remontée dans le under du même biome — quantité faible
- Remontée latérale dans le under des 2 autres biomes — quantité très faible

Les caverns_bottom ne reçoivent que les flux latéraux depuis les caverns des autres
biomes — trop profondes pour être atteintes par les remontées depuis under.

| Quantité | percent dans CLUSTER_SCATTER_MAP |
|---|---|
| Moyenne | 0.010 |
| Faible | 0.003 |
| Très faible | 0.001 |

#### 3.6.2 Clusters de Topsoil (pré-creusement)

Les tuiles TOPSOIL (DIRT, SAND, SILT, HUMUS) sont dispersées en clusters avant le
creusement des tunnels et cavernes. Leur taille varie linéairement avec la profondeur :
grands en surface (sizeMin 8, sizeMax 14), petits en profondeur (sizeMin 3, sizeMax 6).
La taille est calculée au moment du tirage du Y de chaque cluster.

Les caverns_bottom ne reçoivent aucun TOPSOIL — les roches y sont trop dures.

HUMUS est transversal : présent principalement dans FOREST et JUNGLE (under et
caverns_top), rare en surface, et anecdotique dans DESERT (surprise géologique).

Une seconde passe post-creusement (algorithme distinct) recouvrira les parois des
tunnels et cavernes formés.

Les densités sont définies dans `TOPSOIL_SCATTER_MAP` (`data-gen.mjs`).
Les constantes d'interpolation Y sont dans `constant.mjs` (`TOPSOIL_Y_*`).

| Quantité | percent |
|---|---|
| Natif surface | 0.020 |
| Étranger surface | 0.012 |
| Natif under | 0.009 |
| Étranger under | 0.005 |
| Natif caverns_top | 0.006 |
| Étranger caverns_top | 0.003 |
| HUMUS principal (under) | 0.008 |
| HUMUS moyen (caverns_top) | 0.005 |
| HUMUS rare (surface) | 0.002 |
| HUMUS surprise Desert | 0.0005 |

#### 3.6.3 Conventions de nommage

Les tuiles et leurs items correspondants ont des noms distincts pour éviter toute ambiguïté :

| Type | Tuile (monde) | Item (inventaire) | Item transformé |
|---|---|---|---|
| Ore | `Copper Ore` | `Copper Chunk` | `Copper Bar` (fonte) |
| Gem | `Topaz Ore` | `Raw Topaz` | `Topaz` (taille) |
| Rock | `Granite` | `Granite Block` | — |
| Topsoil | `Dirt` | `Dirt Block` | — |
| Natural | `Forest Grass` | `Dirt Block` | — |
| Cobweb | `Cobweb` | `Silk` | `Fabric` (loom) |

### 3.7 Minerais (Ore)

Six minerais métalliques, classés par tier de difficulté (`star`). Les localisations
sont indicatives — les densités et tailles de clusters exactes sont définies dans
`ORE_GEM_SCATTER_MAP` (`data-gen.mjs`).

| Minerai | Tier | Surface | Under | Cavern-top | Cavern-bottom | Biome pénalisé |
|---|---|---|---|---|---|---|
| `COPPER`   | ★☆☆☆☆ | moyenne | grande  | moyenne | faible  | — |
| `IRON`     | ★☆☆☆☆ | —       | moyenne | moyenne | faible  | — |
| `SILVER`   | ★★☆☆☆ | —       | petite  | moyenne | petite  | Forest (plus rare) |
| `GOLD`     | ★★★☆☆ | —       | —       | moyenne | petite  | Desert (plus rare) |
| `COBALT`   | ★★★★☆ | —       | —       | petite  | moyenne | Jungle (plus rare) |
| `PLATINUM` | ★★★★★ | —       | —       | —       | moyenne | — |

### 3.8 Gemmes (Gem)

Quatre gemmes, chacune associée à un biome ou une profondeur. Les localisations
sont indicatives — les densités exactes sont définies dans `ORE_GEM_SCATTER_MAP`
(`data-gen.mjs`).

| Gemme | Tier | Biome | Localisation indicative |
|---|---|---|---|
| `TOPAZ` | ★★☆☆☆ | Forest | Underground (rare) et Cavernes. |
| `RUBY` | ★★★☆☆ | Desert | Cavernes. |
| `EMERALD` | ★★★★☆ | Jungle | Cavernes. |
| `SAPPHIRE` | ★★★★★ | Tous | Cavernes profondes uniquement. |

### 3.9 Génération Procédurale

* Effectuée **hors temps réel** (`STATE.CREATION`), en import dynamique (`generate.mjs`).
* **World Key :** seed pour la re-génération déterministe.
* **Temps maximum :** 10 secondes.
* **Biomes (axe horizontal) :** Forêt (départ joueur, centre), Désert, Jungle + Océans latéraux.
* **Layers (axe vertical) :** Surface, Underworld, Caverns, Hell (Lava).
* **Fluides initiaux :** Lacs (Water), Ruches (Honey), Sève (Sap), Sable (Sand).
* **Algorithmes :** Perlin noise pour le lissage, algorithmes dédiés pour tunnels et cavernes, placement de coffres/minerais/flore, nettoyage des isolats.

### 3.10 Physique (Exploration)

* **Déplacement :** Flèches directionnelles + ZQSD. Caméra centrée joueur. Zoom possible.
* **Collision :** AABB (Axis-Aligned Bounding Box) custom.
* **Liquides :** Algorithme custom paramétrable (viscosité) pour Water, Honey, Sap. Automates cellulaires pour le sable.
* **AI Faune :** Comportements simples (Suit, Fuit, Erre) sans pathfinding complexe en temps réel.
* **Contrainte :** Pas de moteur physique externe (Matter.js…). Pas de projectiles ni d'effets spéciaux hormis les animations de sprites.

### 3.11 Simulation & Écosystème

* **Faune :** Active uniquement dans le Viewport + buffer de sécurité. Entités hors-zone désactivées ou despawnées. Spawning calculé juste hors-vue.
* **Flore :** Croissance **décorrélée des chunks**. Données dans le store `plant` (liste clairsemée). Calcul temporel global (timestamp) → une forêt peut pousser hors-vue sans charger ses chunks.
* **Régénération :** Minerais rares, ruches et toiles d'araignées se régénèrent via timers globaux générant des modifications de tuiles ponctuelles.

---

## 4. Système "Tactical" (Combat)

### 4.1 Déclenchement & Contexte

* Déclenchement : clic joueur sur faune, ou IA faune (comportement simple + buffs/debuffs).
* Passage en `STATE.COMBAT` — irréversible jusqu'à la fin du combat.
* Rendu : entièrement DOM (overlay, comme les autres panels).
* Terrain : généré procéduralement en fonction du biome + layer (forme, trous, murs).

### 4.2 Mécaniques

* **Initiative :** Déterminée par la caractéristique `Initiative` (joueur buffable, monstres). Modifiable en cours de combat.
* **Ressources :** PA (Points d'Action) et PM (Points de Mouvement).
* **Grille :** Pathfinding A\* ou Dijkstra sur grille locale. Murs et trous bloquants.
* **Ligne de vue (LOS) :** Raycasting simple, bloqué par murs et entités.
* **Challenges :** Sous-buts en combat pour diversifier les parties (cf. *Dofus*).
* **Évolutivité :** Possibilité d'ajout de mécaniques spéciales (Boss).
* **Damage types** : Piercing (bow, stinger), Slashing (sword, jaw, mandibles, tail, claws), Crushing (hammer, legs, tail, head)
* **Damage over time (DOT)** : Poison, Fire, Bleeding

### 4.3 Buffs & Debuffs Environnementaux

Les dégâts subis par le joueur dépendent de sa position dans le monde, selon deux axes indépendants qui se cumulent.

**Damage Type par layer** (s'intensifie avec la profondeur) :

| Layer | Damage Type dominant |
|---|---|
| Surface | Piercing |
| Underground | Slashing |
| Caverns | Crushing |

**DOT par biome** :

| Biome | DOT |
|---|---|
| Forest | Bleeding |
| Desert | Fire |
| Jungle | Poison |

Les deux effets se cumulent — un joueur en caverns_bottom dans la jungle subira du Crushing et du Poison simultanément. Des équipements et potions spécifiques permettent de résister à chaque type.

---

## 5. Mini-Biomes & Lieux Remarquables

Les mini-biomes sont des zones de taille limitée, générées procéduralement, qui
rompent la monotonie de l'exploration. Chaque mini-biome est caractérisé par des
matériaux distinctifs, une faune ou des pièges spécifiques, et parfois un loot unique.

Certains mini-biomes déclenchent un combat tactique (§4) à l'entrée ou à l'interaction.
Les mini-biomes peuvent apparaître dans leur biome natif ou, rarement, en intrusion
dans un biome étranger (cf. §3.9).

---

### 5.1 Mini-Biomes FOREST

| Mini-biome | Layer | Matériau dominant | Contenu / Lore |
|---|---|---|---|
| **Anthill** | surface | DIRT | Fourmilière conique s'élevant au-dessus de la surface. Reconstruite par les habitants si détruite. ANT, ANT SOLDIER. Boss ANT QUEEN. |
| **Fern Cave** | under | HUMUS + GRASSFERN | Fougères géantes. Sol meuble. Loot végétal rare. |
| **Ruined Cabin** | under | STONEWALL | Forest. Cabane effondrée. Murs vermoulus, pièges simples, coffre tier 3 biomes mélangés. Faune commune de la zone. |
| **Mushroom Cave** | caverns_top | HUMUS + GRASSMUSHROOM | Champignons géants lumineux. Faune passive. Spores récoltables pour de puissantes potions. |
| **Underground Lake** | caverns_top | WATER + HUMUS | Poche d'eau douce. Plafond de mousse. Poissons rares. Accès par tunnel vertical. |

---

### 5.2 Mini-Biomes DESERT

| Mini-biome | Layer | Matériau dominant | Contenu / Lore |
|---|---|---|---|
| **Antlion Pit** | surface | SAND | Piège conique creux dans le sable. Reconstruit par les habitants si détruit. ANTLION. Boss SUNBURST ANTLION. |
| **Pyramid** | under | SANDSTONE | Deux chambres. Chambre 1 : salle de pièges (flèches, rouleaux — combat tactique). Chambre 2 : salle triangulaire — boss Pharaon + gardes (momies, sphinx). Loot high-tier. |
| **Sand Pocket** | under, caverns_top | SAND | Grande poche de SAND sous pression. S'effondre partiellement si le plafond est miné. |
| **Fossil Vein** | caverns_top | SHELL | Veine horizontale d'accumulation sédimentaire (ancien fond marin). Minage → item Shell (ingrédient pour mécanique délicate ou potion (réduit en poudre)). Source secondaire : bords et fond de mer (régénération lente). |
| **Ancient House** | caverns_bottom | GOLDWALL | Ruines d'une civilisation ancienne. Architecture et matériaux différents du Temple Ruin. Pièges, coffres (tier 4-5). Machine ancestrale : Transmutateur. Inamovible. Faune commune de la zone. |

---

### 5.3 Mini-Biomes JUNGLE

| Mini-biome | Layer | Matériau dominant | Contenu / Lore |
|---|---|---|---|
| **Termite Mound** | surface | MUD + STONEWALL | Jungle. Termitière rectangulaire s'élevant au-dessus de la surface, partie souterraine plus profonde. Reconstruite par les habitants si détruite. TERMITE, TERMITE SOLDIER. Boss TERMITE KING. Loot : matériaux de construction, ingrédients rares. |
| **Moss Cave** | under | MUD + GRASSMOSS | Parois recouvertes de mousse lumineuse. Faune passive rare. Loot végétal. |
| **Hive** | caverns_top | HIVE + HONEY | Ruche d'abeilles (BEE, HORNET). Boss Queen Bee. Remplie de HONEY après génération (liquide, artisanat tier 4). HONEY difficile à récupérer car défendu par les habitants de la ruche : mise en place par le joueur d'une canalisation détournant le miel pour le récolter facilement. |
| **Temple Ruin** | caverns_top | EMERALDWALL | Ruines d'une civilisation ancienne. Architecture et matériaux différents du Ancient House. Murs effondrés, planchers vermoulus, pièges, coffres (tier 3-4). Machine ancestrale : Décomposeur (rendement 80%). Inamovible. Faune commune de la zone. |
| **Sap Pocket** | caverns_bottom | LIMESTONE + SAP | Poche de SAP piégeant des insectes fossilisés. Loot d'artisanat rare. |

---

### 5.4 Mini-Biomes Transversaux (tous biomes)

| Mini-biome | Layer | Matériau dominant | Contenu / Lore |
|---|---|---|---|

| **Lake / Oasis** | surface | WATER + substrat natif | Un lac par zone de biome (Oasis en Desert). Double ellipse : corps principal peu profond + fosse centrale plus profonde et bruitée. Bords et fond protégés par des tuiles CREATION remplacées après creusement par le substrat natif du biome (CLAY/STONE en Forest, SAND/SANDSTONE en Desert, MUD/LIMESTONE en Jungle). Remplissage WATER différé. Faune et flore spécifiques en bordure. Poissons pêchables. |
| **Cobweb Cave** | caverns | WEB | Caverne elliptique à forte densité de toiles. Les tuiles WEB sont minables mais se régénèrent rapidement dans tout espace vide souterrain (régénération globale plus lente — cf. §3.11). Les Cobweb Caves concentrent cette régénération à un rythme bien supérieur et sont les seuls lieux où spawent les monstres SPIDER, MYGALE, et le boss TARENTULA. Les toiles entravent les déplacements mais constituent une matière première essentielle à l'artisanat. |
| **Granite Cave** | caverns_bottom | GRANITE 4* | Géode de granite. Ennemis rocheux (Stonegnaw, Rockborer). |
| **Marble Cave** | caverns_bottom | MARBLE 4* | Géode de marble. Ennemis rocheux.  (Stonegnaw, Rockborer). |
| **Abandoned Mine** | caverns_bottom | OBSIDIAN + COBALTWALL | Tous biomes. Galerie horizontale creusée par une civilisation ancienne. OBSIDIAN en toit et sol. Étais de COBALTWALL tous les 5 tuiles (minables sans conséquence). Coffres de matériaux de construction et minerais extraits. Faune commune de la zone. |
| **Blind Lake** | caverns_bottom | WATER + HARDSTONE | Tous biomes. Lac aveugle sans accès naturel — le joueur doit creuser pour y accéder. Fond et parois de HARDSTONE. Poissons aveugles et AXOLOTL pêchables (tier 4-5). Pas de faune agressive. Bioluminescence ambiante. |
| **Shore** | caverns | SAND, SANDSTONE, SHELL | Zone aux abords des deux SEA, constituant une plage de sable. Des SANDSTONE limitent l'écoulement du SAND et des SHELL parsèment cette zone. Faune et flore spécifique à ce mini-biome. |
| **Hearts** | under | VOID | un Life Heart (furniture) dans un trou carré de 2 tuiles entouré de matière solide. |
| **Triskels** | caverns | VOID | un des 3 triskels (furniture) dans un trou carré de 2 tuiles entouré de matière solide. 2 triskels en caverns_top et 1 en caverns_bottom. |

---

### 5.5 Règles Générales

- Chaque mini-biome est entouré d'une **zone d'exclusion** empêchant le chevauchement
  avec d'autres mini-biomes (cf. `#exclusions` dans `WorldCarver`).
- Les mini-biomes déclenchant un combat utilisent le système tactique standard (§4),
  avec un terrain généré en fonction du biome et de la layer hôtes.
- Un mini-biome peut apparaître en **intrusion** dans un biome étranger (1 occurrence
  par monde maximum pour les intrusions). Les règles d'intrusion sont définies dans
  les fonctions `digXxxIntrusions()` de `WorldCarver`.
- Les loot et ennemis spécifiques à chaque mini-biome sont définis dans `data.mjs`.

---

### 5.6 Règles de Tier

Le tier d'un monstre indique sa place dans la progression du joueur — à quelle
profondeur il est prévu de le rencontrer et quel niveau d'équipement est requis
pour le battre confortablement. Un boss de zone N a le même tier que la faune
commune de la zone N+1 : la progression est continue, sans palier artificiel.

| Tier | Zone principale | Contenu |
|---|---|---|
| 1 | Surface | Faune commune de surface |
| 2 | Underground | Faune commune de under / Boss de surface |
| 3 | Caverns_top | Faune commune de caverns_top / Boss de under |
| 4 | Caverns_bottom | Faune commune de caverns_bottom / Boss de caverns_top |
| 5 | — | Boss de caverns_bottom uniquement |

**Règles complémentaires :**

- La table est indicative — une espèce peut spawner hors de sa zone principale
  (intrusion, migration, curiosité). Sa Strength reste celle de son tier natif,
  ce qui crée des surprises dans les deux sens (ennemi facile en profondeur,
  ennemi difficile en surface).
- La densité de spawn est calibrée pour que l'exploration ne devienne pas une
  succession infinie de combats. Leviers disponibles : délai de réaction avant
  qu'un monstre devienne agressif, artefacts et potions qui éloignent ou calment
  certains types, cycle jour/nuit affectant les spawns.
- Certaines espèces ont des variantes (couleur, taille) avec des mécaniques de
  combat différentes — destinées à habituer progressivement le joueur aux
  systèmes tactiques. Exemple : les Slimes de forêt introduisent les bases du
  combat dès les premiers jours.
- Les boss ont un délai d'apparition minimum (exprimé en jours de jeu) pour
  laisser au joueur le temps de se préparer. Exemple : Blue Slime n'apparaît
  pas avant le jour 5. Une fois vaincu, il y a un délai de réapparition, obligeant
  le joueur à diversifier ses activités.

---

## 5.7 Faune & Monstres

| Nom | Tier | Strength | Biome / Mini-biome / Layer |
|---|---|---|---|
| **BEETLE** | 1 | ★☆☆☆☆ | Forest — surface |
| **SCORPION** | 1 | ★★☆☆☆ | Desert — surface |
| **SAND SNAKE** | 1 | ★★☆☆☆ | Desert — surface |
| **JUNGLE SPIDER** | 1 | ★★☆☆☆ | Jungle — surface |
| **BAT** | 2 | ★★☆☆☆ | Tous biomes — under |
| **CAVE WORM** | 2 | ★★☆☆☆ | Tous biomes — under |
| **CAVE FISH** | 3 | ★☆☆☆☆ | Underground Lake, Underground River |
| **DEEP CRAWLER** | 4 | ★★★★☆ | Tous biomes — caverns_bottom |
| **LAVA SPRITE** | 4 | ★★★★☆ | Tous biomes — caverns_bottom |
| **DEEP CRAWLER KING** | 5 | ★★★★★ | Tous biomes — caverns_bottom |

| **FIREFLY** | TBD| - | Critter - Tous biomes — surface (nuit) |
| **SLUG** | TBD| - | Critter - Forest — surface |
| **DRAGONFLY** | TBD| - | Critter -Jungle — surface (jour) |
| **SNAIL** | TBD| - | Critter - To be defined |
| **BUTTERFLY** | TBD| - | Critter - To be defined |
| **FROG** | TBD| - | Critter - Forest et Jungle / Surface |
| **WORM** | TBD| - | Critter - Forest et Jungle / Surface et under |
| **LOCUST** | TBD | — | Critter — Desert — surface |

| **GREEN SLIME** | 1 | ★☆☆☆☆ | Forest — surface, under - day |
| **BLUE SLIME** | 1 | ★★☆☆☆ | Forest — surface, under - night |
| **GOLDEN SLIME** | 2 | ★★★★☆ | Forest — surface, under |

| **ANTLION** | 1 | ★★☆☆☆ | Antlion Pit |
| **SUNBURST ANTLION** | 2 | ★★★★☆ | Antlion Pit |
| **ANT** | 1 | ★☆☆☆☆ | Anthill |
| **ANT SOLDIER** | 2 | ★★☆☆☆ | Anthill |
| **ANT QUEEN** | 2 | ★★★☆☆ | Anthill |
| **TERMITE** | 1 | ★☆☆☆☆ | Termite Mound |
| **TERMITE SOLDIER** | 2 | ★★☆☆☆ | Termite Mound |
| **TERMITE KING** | 2 | ★★★☆☆ | Termite Mound |
| **BEE** | 2 | ★★☆☆☆ | Hive |
| **HORNET** | 3 | ★★★☆☆ | Hive |
| **BEE QUEEN** | 3 | ★★★★☆ | Hive |
| **RED SLUG** | 3 | ★★☆☆☆ | Mushroom Cave |
| **HYDRA** | 3 | ★★★☆☆ | Mushroom Cave |
| **ISOPOD** | 4 | ★★★★★ | Mushroom Cave |
| **SPIDER** | 3 | ★★☆☆☆ | Cobweb Cave |
| **MYGALE** | 3 | ★★★☆☆ | Cobweb Cave |
| **TARENTULA KING** | 4 | ★★★★☆ | Cobweb Cave |
| **STONEGNAW** | 4 | ★★★★☆ | Granite Cave, Marble Cave |
| **ROCKBORER** | 4 | ★★★★★ | Granite Cave, Marble Cave |
| **MOMIE** | 3 | ★★★☆☆ | Pyramid |
| **SPHINX** | 4 | ★★★★☆ | Pyramid |
| **PHARAON** | 4 | ★★★★★ | Pyramid |
| **DENDROBATE** | 2 | ★★☆☆☆ | Fern Cave |
| **MAMBA** | 2 | ★★★☆☆ | Fern Cave |
| **AMBER SQUID** | 4 | ★★☆☆☆ | Fish - Sap Pocket |
| **GLIDER** | 4 | ★★☆☆☆ | Fish - Sap Pocket |
| **MANTIS** | 4 | ★★★★☆ | Sap Pocket |
| **BLIND FISH** | 5 | ★★★★☆ | Fish — Blind Lake |
| **AXOLOTL** | 5 | ★★★★★ | Fish — Blind Lake |

## 5.8 Flore

| Nom | Tier | Type | Biome / Mini-biome / Layer | Loot |
|---|---|---|---|
| **COCONUT** | 1 | Tree | Sea shore, Desert Surface Lake Shore | Coconut (fruit), Coconut Fiber, Coconut Pulp, Coconut Milk |

---

## 6. Données & Persistance

### 6.1 Stockage Local

* **IndexedDB** native, via wrapper custom (`database.mjs`).
* Pas de sérialisation JSON complexe : stockage direct d'objets JS structurés.

### 6.2 Stratégie "Write-Behind"

* Les modifications en jeu ne déclenchent **pas** d'écriture immédiate.
* Chunks modifiés → **Dirty Flag** (Set de coordonnées).
* Le `TaskScheduler` déclenche la sauvegarde des chunks dirty **toutes les 2 secondes**.
* Chaque sauvegarde englobe chunks + métadonnées critiques (Inventaire, Position) dans **une transaction unique** → cohérence en cas de crash.

### 6.3 Transfer Pool (Zero-GC)

* Pool de 64 buffers `Uint8Array` couvrant 99 % des cas.
* En cas d'overflow : allocation à la volée + avertissement console + persistance du pool étendu.

### 6.4 GameState (K/V Global)

* Stockage clé/valeur pour les états dispersés (Météo, Temps, Position, Flags…).
* **Memory First :** la variable en RAM du Manager est la source de vérité. La DB est un miroir.
* Au démarrage de session : chargement complet du gamestate en **une seule requête**, puis injection dans chaque Manager via `.init()`.
* En runtime : écriture "Fire & Forget" (`database.setGameState`). Jamais d'`await` bloquant.

### 6.5 Identifiants Logiques vs Physiques

* **Problème :** La clé primaire IndexedDB est générée *a posteriori* (async). On ne peut pas lier des entités entre elles au moment de leur création si l'on doit attendre la DB.
* **Solution :** **UID logique** généré par l'application au moment de l'instanciation. Permet de construire des graphes d'objets en mémoire avant toute sauvegarde.
* **Génération :** Algorithme "Graine + Suffixe". Sauvegarde de la graine toutes les 26 générations. Au redémarrage, saut à la graine suivante (unicité garantie, trous acceptés).

---

## 7. Interface & Rendu (UI/UX)

### 7.1 Organisation de l'Écran

Découpage horizontal en 3 zones :

* **Gauche :** Hotbar (verticale).
* **Centre :** Monde (empilement de `<canvas>`). Dimensions : 1024 × 768 px (4 chunks × 3 chunks).
* **Droite :** Widgets empilés.
  * Boutons d'action : Inventaire, Artisanat, Aide, Zoom, Sons, Nouveau Monde.
  * Environnement : Jour / Heure / Météo / Phase de Lune / Position.
  * Jauges : Vie.
  * Buffs/Debuffs actifs.
  * Debug.

### 7.2 Stratégie "Layered Canvas"

La zone centrale est composée de `<canvas>` superposés (z-index CSS) :

| Z-Index | Élément | Description |
|---|---|---|
| 0 | `SkyRenderer` | Couleur atmosphérique. Cycle jour/nuit. |
| 10 | `WorldRenderer` | Tuiles, flore, faune, meubles, joueur. Les tuiles SKY/FOG sont transparentes. |
| 20 | `LightRenderer` | Occlusion et sources de lumière locales. |
| 30 | Voile sombre (`ModalBlocker`) | Apparaît dès qu'un overlay est actif. |
| 40–70 | Overlays DOM | Inventaire (40), Craft (50), Aide (60), Carte (70). |
| 100 | Combat | Overlay tactique. |
| 110 | Creation | Overlay création de monde. |
| 150 | Dialog | Modaux. |
| 200 | System | Priorité absolue. |

**Overlays :** centrés sur l'écran physique. S'empilent dans un ordre prédéterminé. Interruptifs (pause du jeu) si leur `state` est non-null.

### 7.3 Système d'Éclairage (LightRenderer)

* **Stratégie :** Shadow Mapping par Soustraction ("Surface & Punch").
* Le `LightRenderer` couvre la totalité du canvas et opère en 4 passes (`globalCompositeOperation`).
* Sources de lumière fournies par le `FurnitureManager` (Torches, Lampes).
* Optimisation : si la caméra est entièrement dans le ciel → `LightRenderer` désactivé.

*(Détail des 4 passes → `TECHNICAL.md §Éclairage`)*

### 7.4 Ordre d'Affichage (Empilement Vertical)

Tuiles → Flore → Meubles → Faune → Joueur. Pas de troisième dimension.

---

## 8. Modules Métier (Layer 4+)

Les modules communiquent via l'`EventBus` (couplage faible).

### 8.1 Système d'Inventaire [`inventory.mjs`]

* Gère : stockage, slots, équipement, artefacts passifs.
* À la fermeture de l'interface : scan du contenu → émission de `inventory/static-buffs` avec la liste des IDs d'artefacts actifs.
* L'inventaire **ne calcule pas** les stats.

### 8.2 Système de Buffs [`buff.mjs`]

* Centralise tous les bonus/malus (Temporaires, Passifs, Équipement).
* Pattern **"Re-emitter"** sur `inventory/static-buffs` :
  * Reçoit la liste d'artefacts → met à jour son état interne → émet des événements granulaires.
  * *Ex :* `'gps'` reçu → émet `buff/coords` (boolean).
  * *Ex :* `'clock_lvl2'` reçu → émet `buff/precision` (valeur).
* **Avantage :** L'UI ignore quels items déclenchent quels buffs. Changer une règle de game design ne touche pas l'UI.

### 8.3 Interface Environnement [`ui.mjs :: EnvironmentWidget`]

* Écoute les événements granulaires du `BuffManager` (`buff/moon`, `buff/weather`, `buff/coords`).
* **Abonnement dynamique :** le widget ne s'abonne à `player/move` (fréquent) **que si** le buff `buff/coords-display` est actif. Désabonnement immédiat si le buff est perdu.

### 8.4 Système Écosystème [`ecosystem.mjs`]
* Gère la simulation temps réel des entités naturelles : croissance des plantes,
  production de HONEY, reconstruction des ruches, croissance des toiles d'araignées, chute de météroites.
* Chaque système est déclenché par le `TaskScheduler` (timer global, décorrélé des chunks).
* Les modifications de tuiles sont ponctuelles — elles passent par le `ChunkManager`.

---

## 9. Organisation du Projet

### 9.1 Structure des Fichiers

```
/sixty-below
├── /assets
│   ├── /sprites             # Tilesets, Charsets, Icons (PNG)
│   ├── /sounds              # SFX, Ambiances (MP3/OGG)
│   └── /data                # Tiles, Items, Recipes, Loot tables, Actions de combat
├── /src
│   ├── constant.mjs         # Layer 0 : Config, Enums, Bitmasks
│   ├── utils.mjs            # Layer 1 : EventBus, MicroTasker, TaskScheduler, TimeManager, seededRNG
│   ├── database.mjs         # Layer 1 : IDBWrapper
│   ├── core.mjs             # Layer 2 : GameLoop, InputManager, KeyboardManager
│   ├── assets.mjs           # Layer 3 : Loader, Parser, Resolver
│   ├── persistence.mjs      # Layer 3 : SaveManager
│   ├── world.mjs            # Layer 4 : ChunkManager, PhysicsSystem, LiquidSimulator
│   ├── render.mjs           # Layer 4 : WorldRenderer, Camera, SkyRenderer, LightRenderer
│   ├── generate.mjs         # Layer 4 : Proc-Gen (Dynamic Import)
│   │                        #   WorldBuffer : TypedArray 1024×512, API read/write (x,y) et (index)
│   │                        #   Algorithmes : Biomes, Ores, Gems, Plants, Hives, Chests, CobWebs…
│   │                        #   WorldGenerator : orchestration complète
│   ├── player.mjs           # Layer 4 : PlayerManager, LifeManager
│   ├── action.mjs           # Layer 4 : ActionManager (Mining, Cutting, Fishing…)
│   ├── buff.mjs             # Layer 4 : BuffManager, StatModifiers
│   ├── housing.mjs          # Layer 4 : FurnitureManager, HousingManager
│   ├── ecosystem.mjs        # Layer 4 : HiveSystem, PlantSystem, CobwebSystem…
│   ├── combat.mjs           # Layer 4 : ArenaCreator, TurnManager, SpellSystem, CombatAI
│   ├── inventory.mjs        # Layer 4 : InventorySystem
│   ├── craft.mjs            # Layer 4 : CraftSystem
│   ├── ui.mjs               # Layer 4 : HUD, Panels, Factories
│   ├── help.mjs             # Layer 4 : HelpPanel
│   └── ui-debug.mjs         # Layer 4 : Debug UI
├── /tests
├── index.html               # Entry Point + Canvas Layers + DOM Containers
└── package.json             # ESLint + Tests uniquement
```
### 9.2 Tests Unitaires

Les classes du Kernel (Layer 0–2) sont testées unitairement via un mini-framework
Vanilla JS sans dépendance, situé dans `/tests`.

- `tests/kernel.mjs` — framework de test (assert, describe, captureConsole)
- `tests/run.mjs` — point d'entrée CLI
- `tests/test-[classname].mjs` — un fichier par classe testée

**Lancement :**
- `node tests/run.mjs` → tous les tests, une ligne de résumé par suite
- `node tests/run.mjs EventBus` → détail complet pour une classe

**Tests de génération procédurale (`generate.mjs`) :**

`WorldGenerator.generate()` accepte un paramètre `debug` (défaut : `false`).

- `debug = false` (production) : écrit dans la base de données, ne retourne rien.
- `debug = true` (test) : **n'écrit pas** dans la base de données, retourne le `WorldBuffer`
  pour inspection. L'appelant est responsable de libérer la référence (`buffer = null`).

Les algorithmes individuels (`BiomesGenerator`, `BiomeNaturalizer`...) peuvent être
testés unitairement en instanciant directement un `WorldBuffer` sans passer par `WorldGenerator`.

### 9.3 Déploiement

* GitHub Pages — hébergement statique, branche `main`.
* Pas de build step. Le navigateur charge les modules `.mjs` nativement.
* CI : GitHub Action sur push → exécution des tests unitaires.

### 9.4 Tooling

* **Linter :** Google JavaScript Style Guide.
  * Pas de point-virgule en fin d'instruction.
  * Champs privés natifs (`#variable`).
  * `Object.assign()` pour les styles CSS groupés.

---

*TODO : définir l'implémentation de l'aide en ligne et de l'encyclopédie (automatique + lore).*
