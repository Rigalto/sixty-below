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
Layer 0 — constant.mjs       Zéro dépendance. Config, Enums, Bitmasks.
Layer 1 — utils.mjs          Utilitaires purs : EventBus, MicroTasker,
          database.mjs       TaskScheduler, TimeManager, seededRNG.
Layer 2 — core.mjs           Kernel : GameLoop, InputManager, KeyboardManager.
─────────────────────────────────────────────────────────────
Layer 3 — assets.mjs         Ressources graphiques/sons.
          persistence.mjs    Orchestration sauvegarde (connaît les stores métier).
─────────────────────────────────────────────────────────────
Layer 4+ — Modules Métier    world, render, player, combat, inventory…
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

### 3.2 Génération Procédurale

* Effectuée **hors temps réel** (`STATE.CREATION`), en import dynamique (`generate.mjs`).
* **World Key :** seed pour la re-génération déterministe.
* **Temps maximum :** 10 secondes.
* **Biomes (axe horizontal) :** Forêt (départ joueur, centre), Désert, Jungle + Océans latéraux.
* **Layers (axe vertical) :** Surface, Underworld, Caverns, Hell (Lava).
* **Fluides initiaux :** Lacs (Water), Ruches (Honey), Sève (Sap), Sable (Sand).
* **Algorithmes :** Perlin/Simplex pour le lissage, algorithmes dédiés pour tunnels et cavernes, placement de coffres/minerais/flore, nettoyage des isolats.

### 3.3 Biomes — Découpage Horizontal

| Biome | Position | Difficulté |
|---|---|---|
| Sea | Bords gauche (3 chunks) et droit (4 chunks, aléatoire) | — |
| Forêt | Centre du monde — zone de départ | Facile |
| Désert | Intermédiaire | Moyen |
| Jungle | Extrémités | Difficile |

### 3.4 Physique (Exploration)

* **Déplacement :** Flèches directionnelles + ZQSD. Caméra centrée joueur. Zoom possible.
* **Collision :** AABB (Axis-Aligned Bounding Box) custom.
* **Liquides :** Algorithme custom paramétrable (viscosité) pour Water, Honey, Sap. Automates cellulaires pour le sable.
* **AI Faune :** Comportements simples (Suit, Fuit, Erre) sans pathfinding complexe en temps réel.
* **Contrainte :** Pas de moteur physique externe (Matter.js…). Pas de projectiles ni d'effets spéciaux hormis les animations de sprites.

### 3.5 Simulation & Écosystème

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

---

## 5. Données & Persistance

### 5.1 Stockage Local

* **IndexedDB** native, via wrapper custom (`database.mjs`).
* Pas de sérialisation JSON complexe : stockage direct d'objets JS structurés.

### 5.2 Stratégie "Write-Behind"

* Les modifications en jeu ne déclenchent **pas** d'écriture immédiate.
* Chunks modifiés → **Dirty Flag** (Set de coordonnées).
* Le `TaskScheduler` déclenche la sauvegarde des chunks dirty **toutes les 2 secondes**.
* Chaque sauvegarde englobe chunks + métadonnées critiques (Inventaire, Position) dans **une transaction unique** → cohérence en cas de crash.

### 5.3 Transfer Pool (Zero-GC)

* Pool de 64 buffers `Uint8Array` couvrant 99 % des cas.
* En cas d'overflow : allocation à la volée + avertissement console + persistance du pool étendu.

### 5.4 GameState (K/V Global)

* Stockage clé/valeur pour les états dispersés (Météo, Temps, Position, Flags…).
* **Memory First :** la variable en RAM du Manager est la source de vérité. La DB est un miroir.
* Au démarrage de session : chargement complet du gamestate en **une seule requête**, puis injection dans chaque Manager via `.init()`.
* En runtime : écriture "Fire & Forget" (`database.setGameState`). Jamais d'`await` bloquant.

### 5.5 Identifiants Logiques vs Physiques

* **Problème :** La clé primaire IndexedDB est générée *a posteriori* (async). On ne peut pas lier des entités entre elles au moment de leur création si l'on doit attendre la DB.
* **Solution :** **UID logique** généré par l'application au moment de l'instanciation. Permet de construire des graphes d'objets en mémoire avant toute sauvegarde.
* **Génération :** Algorithme "Graine + Suffixe". Sauvegarde de la graine toutes les 26 générations. Au redémarrage, saut à la graine suivante (unicité garantie, trous acceptés).

---

## 6. Interface & Rendu (UI/UX)

### 6.1 Organisation de l'Écran

Découpage horizontal en 3 zones :

* **Gauche :** Hotbar (verticale).
* **Centre :** Monde (empilement de `<canvas>`). Dimensions : 1024 × 768 px (4 chunks × 3 chunks).
* **Droite :** Widgets empilés.
  * Boutons d'action : Inventaire, Artisanat, Aide, Zoom, Sons, Nouveau Monde.
  * Environnement : Jour / Heure / Météo / Phase de Lune / Position.
  * Jauges : Vie.
  * Buffs/Debuffs actifs.
  * Debug.

### 6.2 Stratégie "Layered Canvas"

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

### 6.3 Système d'Éclairage (LightRenderer)

* **Stratégie :** Shadow Mapping par Soustraction ("Surface & Punch").
* Le `LightRenderer` couvre la totalité du canvas et opère en 4 passes (`globalCompositeOperation`).
* Sources de lumière fournies par le `FurnitureManager` (Torches, Lampes).
* Optimisation : si la caméra est entièrement dans le ciel → `LightRenderer` désactivé.

*(Détail des 4 passes → `TECHNICAL.md §Éclairage`)*

### 6.4 Ordre d'Affichage (Empilement Vertical)

Tuiles → Flore → Meubles → Faune → Joueur. Pas de troisième dimension.

---

## 7. Modules Métier (Layer 4+)

Les modules communiquent via l'`EventBus` (couplage faible).

### 7.1 Système d'Inventaire [`inventory.mjs`]

* Gère : stockage, slots, équipement, artefacts passifs.
* À la fermeture de l'interface : scan du contenu → émission de `inventory/static-buffs` avec la liste des IDs d'artefacts actifs.
* L'inventaire **ne calcule pas** les stats.

### 7.2 Système de Buffs [`buff.mjs`]

* Centralise tous les bonus/malus (Temporaires, Passifs, Équipement).
* Pattern **"Re-emitter"** sur `inventory/static-buffs` :
  * Reçoit la liste d'artefacts → met à jour son état interne → émet des événements granulaires.
  * *Ex :* `'gps'` reçu → émet `buff/coords` (boolean).
  * *Ex :* `'clock_lvl2'` reçu → émet `buff/precision` (valeur).
* **Avantage :** L'UI ignore quels items déclenchent quels buffs. Changer une règle de game design ne touche pas l'UI.

### 7.3 Interface Environnement [`ui.mjs :: EnvironmentWidget`]

* Écoute les événements granulaires du `BuffManager` (`buff/moon`, `buff/weather`, `buff/coords`).
* **Abonnement dynamique :** le widget ne s'abonne à `player/move` (fréquent) **que si** le buff `buff/coords-display` est actif. Désabonnement immédiat si le buff est perdu.

---

## 8. Organisation du Projet

### 8.1 Structure des Fichiers

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
│   ├── player.mjs           # Layer 4 : PlayerManager, LifeManager
│   ├── action.mjs           # Layer 4 : ActionManager (Mining, Cutting, Fishing…)
│   ├── buff.mjs             # Layer 4 : BuffManager, StatModifiers
│   ├── housing.mjs          # Layer 4 : FurnitureManager, HousingManager
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

### 8.2 Déploiement

* GitHub Pages — hébergement statique, branche `main`.
* Pas de build step. Le navigateur charge les modules `.mjs` nativement.
* CI : GitHub Action sur push → exécution des tests unitaires.

### 8.3 Tooling

* **Linter :** Google JavaScript Style Guide.
  * Pas de point-virgule en fin d'instruction.
  * Champs privés natifs (`#variable`).
  * `Object.assign()` pour les styles CSS groupés.

---

*TODO : définir l'implémentation de l'aide en ligne et de l'encyclopédie (automatique + lore).*
