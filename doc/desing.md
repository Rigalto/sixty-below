# DESIGN DOC: Sixty-Below

> **AI CONTEXT INSTRUCTION:**
> Ce document est la Source de Vérité pour le projet "Sixty-Below".
> Toute génération de code ou proposition d'architecture doit strictement respecter les contraintes définies ci-dessous, en particulier la performance (60 FPS) et l'absence de Backend.

-----

## 1\. Vision & Contraintes Globales

### 1.1 Concept

**Sixty-Below** est une démonstration technique de jeu par navigateur mélangeant plusieurs gameplays :

1.  **Exploration (Temps réel) :** Vue de côté, minage, génération procédurale (Type: *Terraria*).
2.  **Combat (Faune - Tour par tour) :** Grille tactique, points d'action/mouvement, stratégie (Type: *Dofus*).
3.  **Récolte (Flore) :** Vue de côté, outils (hache, faucille, couteau...), eco-système, agriculture (Type: *Terraria*).
4.  **Artisanat (ce qui ne se loote pas, se crafte) :** Grille tactique, points d'action/mouvement, stratégie (Type: *Dofus*).
5.  **Housing (Shelter, Crafting Station) :** Vue de côté, outils (hache, faucille, couteau...), eco-système, agriculture (Type: *Terraria*).

### 1.2 Contraintes Techniques (Non-négociables)

  * **Performance :** 60 FPS constants. Budget frame = 12ms.
  * **Stack :** Vanilla JavaScript Moderne (ESNext). Pas de framework (Phaser/Unity). Pas de Bundler (Webpack/Vite).
  * **Rendu :** Canvas API (2D context).
  * **Architecture :** Client-Side Only. Base de Données Locale (IndexDB).
  * **Hébergement :** "Serverless" via GitHub Pages.
  * **Design Pattern :** Singletons pour la majorité des Managers. Composition préférentielle à l'héritage.

-----

## 2\. Architecture Technique & Core Engine

### 2.1 Paradigme

Priorité au **Data-Oriented Design** pour la performance.

  * Adoption d'une architecture de type **ECS (Entity Component System)** pragmatique ou composition stricte pour éviter les chaînes d'héritage profondes de la POO classique.
  * Séparation stricte : Data (State) / Logic (Systems) / View (Render).

### 2.2 La Game Loop & Budgets Temps [`core.mjs :: GameCore`]

  * Utilisation de `requestAnimationFrame`. Pour garantir la fluidité, chaque frame (16.6ms) est budgetée :
  * Dans la boucle principale, détermination de trois budgets [`constant.mjs :: TIME_BUDGET`] :
      * **Update (Physic/Input) - Budget ~3ms :**
          * Déplacement Joueur/Faune
          * Physique déterministe
          * Incrémentation du temps "Monde" (plus météo, phase de la lune) [`utils.mjs :: TimeManager`]
      * **Render (World Draw) - Budget ~4ms :**
          * Dessin du fond, des tuiles visibles (Culling) et des entités (Sprites : flore, faune, meubles).
          * Concerne uniquement le canvas principal `#game-layer`.
      * **MicroTasks (Logic) - Budget ~5ms**
          * Exécution des tâches lourdes découpées (Pathfinding, Génération).
          * Mise à jour des Overlays UI (Canvases secondaires) si nécessaire.
      * **Navigateur (DOM) - Budget ~4ms**
          * Gestion du DOM, E/S, affichage, Garbage Collector.

  __TO DO__ : définir où gérer les animations des sprites

### 2.3 Gestion des États (State Machine)

Le jeu bascule entre trois états majeurs qui changent les inputs et l'interface :

  * `STATE_EXPLORATION` : Moteur physique actif, Inputs temps réel
  * `STATE_INFORMATION` : Moteur physique figé, affichage de panels d'information (inventaire, craft, carte, équipement, boutique, aide en ligne...), création du monde
  * `STATE_COMBAT` : Moteur physique figé, Inputs tour par tour, HUD tactique.

  * 2.4 Gestion des Tâches (MicroTasker & Scheduler)

  * **MicroTasker** [`utils.mjs :: MicroTasker`] : Exécute des tâches fractionnées dans le temps restant de la frame. Priorité et Capacité définies par tâche.

  * **TaskScheduler** [`utils.mjs :: TaskManager`] : Gère les tâches longues (ex: cuisson, craft long). Tableau trié par timestamp d'exécution, recherche dichotomique, suppression "lazy" (flag deleted).

### 2.4 Gestion desTâches (MicroTasker & Scheduler)

* **MicroTasker :** Exécute des tâches fractionnées dans le temps restant de la frame. Priorité et Capacité définies par tâche.
* **TaskScheduler :** Gère les tâches longues (ex: minage, croissance de la flore). Tableau trié par timestamp d'exécution, insertion dichotomique, suppression "lazy" (flag `deleted`), exécution par création d'une micro-tâche.

### 2.5 Découplage [`utils.mjs :: EventBus`]

* **Système Pub/Sub** pour la communication entre modules sans dépendance cyclique.
* Si un listener dépasse 0.1ms, il doit déléguer son travail au `MicroTasker`.
* **Implémentation**
  * Evénement défini par un identifiant et des paramètres optionnels
  * Publication (`emit`) et Abonnement (`on`).
  * Appel direct des fonctions lorsque l'événement est déclenché

### 2.6 Le temps [`utils.mjs :: TimeManager`]

Distinction stricte entre :

* **Temps Réel (Playtime) :** Nombre de ms écoulées moteur allumé (depuis la création du monde). Utilisé par le `TaskScheduler`.
* **Temps Monde :** Calculé à partir du Playtime (Ratio 1000ms réelles = 1 min monde). Utilisé pour l'affichage et les cycles jour/nuit.

Détails d'implémentaton :
  * **Initialisation :** A la création du monde, la date est initialisée à : Jour 1 - 8h00.
  * **Incrémentation :** La date est incrémentée dans la Game Loop (budget **Update**, état `STATE_EXPLORATION`)
  * **Persistence :** La date est sauvegardée en base de données et récupérée au lancement de l'application

### 2.7 Cycle de Vie et Initialisation (Anti-Circularité)

#### 2.7.1 Hiérarchie des Modules (Dependency Layering)

Pour garantir la stabilité du chargement, l'application respecte 4 niveaux de dépendance :
* **Layer 0 (Roots) :** `constant.mjs`
    * Contrainte : N'importe aucun fichier local.
* **Layer 1 (Kernel) :** `utils.mjs`, `database.mjs`, `assets.mjs`
    * Contrainte : N'importent que la Layer 0.
    * Rôle : Outils, Accès DB, Chargement & Parsing des ressources.
* **Layer 2 (Systems - Interdependent) :** `world.mjs`, `action.mjs`, `buff.mjs`, `combat.mjs`, `ui.mjs`, `render.mjs`...
    * Comportement : Peuvent s'importer mutuellement.
    * Sécurité : Utilisation obligatoire du pattern init() pour les interactions croisées.
    * Exception : `generate.mjs` est isolé (importé dynamiquement ou statiquement sans dépendance retour).
* **Layer 3 (Application) :** `core.mjs`
    * Rôle : Point d'entrée. Importe les Layers 0, 1, 2. Orchestre l'initialisation séquentielle.

#### 2.7.2 Cycle de Vie  [`core.mjs :: GameCore`]

Pour permettre les références croisées dans la Layer 2 (ex: World a besoin de Combat, Combat a besoin de World) sans provoquer d'erreurs d'évaluation ESM, le cycle de vie est strict :
* **Instantiation :** Au chargement du module, le Singleton est créé via `new Class()`. Le constructeur ne doit jamais accéder à une autre instance de la Layer 2.
* **Initialisation :** Chaque Manager expose une méthode publique `init()`.

Boot Sequence (dans core.mjs) :
* **1. INSTANTIATION :** Création des Singletons (new Class). Importe tous les modules.
* **2. LOAD ASSETS :** Appel de [`assets.mjs :: loadAssets`]. Chargement de toutes les images et sons. Construction des index d'atlas.
* **3. HYDRATION (Linkage) :** Une fois les assets chargés (synchrone), on parcourt `TILE_DB` et `ITEM_DB` (de `constant.mjs`) pour remplacer les chaînes de caractères (ex: "ore_16_16+1") par les données de rendu calculées par assets.mjs (Index image, sx, sy). [`assets.mjs :: loadAssets`]
* **4. INIT :** Appelle `eventBus.init()`, `microTasker.init()`, `taskManager.init()`, `worldManager.init()`, `combatManager.init()`, `uiManager.init()`... L'ordre peut avoir de l'importance.
    * **Contrainte :** Configuration de l'état interne uniquement. Interdiction d'émettre des événements ou d'appeler d'autres managers (qui peuvent ne pas être prêts).
* **5. RUN :** Lance la Game Loop.
* **5.1 RUN - First Loop :** Première exécution de la boucle.
    * Le `TimeManager` détecte la première frame et émet l'eventBus `time/first-loop`.
    * Les systèmes réagissent pour initialiser leur logique croisée (Cross-System Logic).

__Note__ : Après la création d'un nouveau monde, pour relancer le jeu, il faudra effectuer la phase `INIT` avant de lancer la phase `RUN`.

#### 2.7.3 Directive d'implémentation pour les Singletons

La plupart des managers sont implémentés sous la forme d'un **singleton** :

```javascript
class GrassManager {
...
}
export const grassManager = new GrassManager()
```

-----

## 3\. Système "World" (Exploration)

### 3.1 Structure du Monde

  * **Grille 2D de Tuiles (Tilemap) :** 2048 x 768 tuiles. Taille tuile : 16x16px. Tailles fixes non paramétrées.
  * **Mémoire :** Totalité de la map chargée en TypedArray (Uint8Array ou Uint16Array). Pas de lazy loading depuis la DB pour la map active. Justification : taille de seulement 1.5Mbytes ou 3Mbytes.
  * **Chunks :** Division logique en 16x16 tuiles (128x48 chunks) pour la gestion des redraws et des updates partiels (6144 chunks).
  * **Bitmasks :** Utilisation de masques binaires pour coder les propriétés des tuiles (Solide, Liquide, Minable) afin d'éviter les objets JS lourds. Utilisation de masques et de décalages binaires pour effectuer les changements de coordonnées et le calcul des index (`index = (y << 11) & x`).
  *  **Echelle :** La dimension d'une tuile correspond à 50 centimètres pour le personnage. Le monde fait donc un kilomètre de large et 350 mètre de profond.

__TO DO__ : définir un terme pour le joueur (personnage derrière le clavier) et le personnage dans le monde. Utiliser ensuite ce terme partout.
__TO DO__ : déterminer si le contenu des tuiles est stocké sur un ou deux octets. Un octet suffit largement pour coder les différents types de briques. Ajouter un deuxième octet permettrait d'ajouter des informations supplémentaires sans devoir utiliser une indirection (tuile bloquée ou non, minable ou non, solide, liquide ou gazeuse, etc.). Trois choix d'implémentation (au moins) sont à analyser : Tuiles codées sur un octet et indirection pour obtenir les informations supplémentaires / Tuiles codées sur deux octets pour éviter les indirections mais sauvegarde également de ces informations en base de données / Deux tableaux, un pour la nature des tuiles et l'autre pour les informations complémentaitres, même index pour accéder aux deux tableaux mais seul le premier est sauvegardé en base de données.

### 3.2 Génération Procédurale

  * **Effectuée hors temps réel :** état `STATE_INFORMATION`.
  * **Mémoire :** Importation dynamique du module générant le monde
  * **Biomes :** découpage vertical : Forêt, Désert, Jungle + Océans latéraux.
  * **Layers :** découpage horizontal : Surface, Underworld, Caverns, Hell (Lava).
  * **Fluides :** Lacs (Water), Ruches (Honey), Sève (Sap), Sable (Sand).
  * **Détail d'implémentation :**
      * **World Key :** Seed permettant la re-génération déterministe.
      * **Temps d'exécution :** 10 secondes maximum
      * **Lissage :** Bruit de Perlin/Simplex.
      * **Creusement :** Algorithme dédiés pour les tunnels et cavernes.
      * **Fluides :** creusement et remplissage initial.
      * **Décors :** Algorithme d'ajout de coffres, minerais, flore...
      * **Nettoyage :** Suppression  des trous ou tuiles isolés

### 3.3 Physique (Exploration)

  * **Déplacement du joueur :** par flèches directionnelles et touches ZQSD. Caméra centrée sur le joueur. Zoom possible sur le monde.
  * **Collision :** AABB (Axis-Aligned Bounding Box) simple custom.
  * **Liquides :** Algorithme custom pour Water, Honey et Sap (paramétrable en fonction de la viscosité) et Automates cellulaires (Cellular Automata) pour le sable.
  * **AI :** Comportements simples (Suit, Fuit, Erre) sans Pathfinding complexe en temps réel.
  * **Performance :** Pas de moteur physique lourd (Matter.js). Implémentation custom légère spécifique aux jeux de tuiles. Pas de projectiles, ni d'effets spéciaux hormis l'animation des sprites.

-----

## 4\. Système "Tactical" (Combat)

### 4.1 Déclenchement

  * Passage en `STATE_COMBAT`.
  * Overlay de grille dessiné par dessus le monde.
  * Déclenchement par le joueur (click souris) ou par le monstre (AI simplifiée, buffs/debuffs).
  * Génération automatique du terrain (forme, présence de trous et de murs) en fonction de la zone (biome + layer)

### 4.2 Mécaniques

  * **Initiative :** Ordre de jeu déterminé par la caractéristique 'Initiative' (joueur (buffable), monstres) midifiable en combat.
  * **Ressources :** PA (Points d'Action) et PM (Points de Mouvement).
  * **Grille :** Pathfinding (A\* ou Dijkstra) sur la grille locale, prenant en compte les obstacles du terrain généré (on ne peut pas marcher dans un mur ni sauter un trou).
  * **Ligne de vue (LOS) :** B: Raycasting simple bloqué par murs/entités
  * **Challenges :** sous-buts permettant de diversifier les combats (cf Dofus)
  * **Evolutivité :** possibilité d'ajout de mécaniques spéciales (Boss)

-----

## 5\. Données & Persistance

### 5.1 Base de Données Locale

  * **IndexedDB** native via wrapper custom.
  * Pas de sérialisation JSON complexe : stockage direct des objets JS structurés.

### 5.2 Sauvegarde synchrone

* **Stratégie "Write-Behind" :** Les modifications sont signalées (Dirty Flag) et persitées après un délai (2 secondes) via le `TaskScheduler`.
* **Session :** Gestion transactionnelle pour rollback en cas de crash pendant la sauvegarde.
* **Configuration :** Table Key-Value pour la métadonnée (Position joueur, Heure monde, Paramètres).
* **Détail d'implémentation :**
    * La liste des chunks modifiés est mise à jour par le composant gérant les tuiles et fournie au composant `Database`.
    * Les autres modifications sont signalées par une API (`database.change(objectStore, operation, record)`). Operation : DB_UPDATE_CREATE, DB_DELETE
    * Lecture d'un éléments de configuration (`database.getItem(id) => value`)
    * Ecriture d'un éléments de configuration (paramètre : identifiant (Strong) de l'élément de configuration, valeur de l'élément de configuration)
    * Conception interne : attention aux problèmes de performance avec les tableaux compacts.

-----

## 6\. Interface & Rendu (UI/UX)

### 6.1 Stratégie "Layered Canvas"

L'interface est divisée en couches HTML superposées pour optimiser les redraws.
    * **Layer 0 (Game Canvas) :** Le monde, la flore, la faune, les meubles, le joueur. Redessiné à chaque requestAnimationFrame.
        * Techniquement, deux canvas superposés. Le plus profond est juste un rectangle rempli avec la couleur du ciel. Devant le monde, avec les tuiles vides (SKY) transparentes.
    * **Layer 1 (UI Canvas) :** Redessiné sur événement
        * **Environment Overlay** [`ui.mjs :: EnvironmentOverlay`] : Affiche l'heure, la météo, la lune... Abonné aux événements du `TimeManager`.
        * **Hotbar**
        * **Buffs/Debuffs actifs**
        * **Jauges** (Vie)
    * **Layer 2 (DOM Panels) :** Inventaire complet, Craft, Aide. Éléments HTML standards (<div>) affichés/masqués. Interruptifs (Pause du jeu).

### 6.2 Optimisations Graphiques

* **Culling :** Rendu strict du viewport + buffer de 1 chunk.
* **Asset Hydration (Zero-Cost Runtime) :** Les coordonnées de texture (sx, sy, sw, sh) et les index d'images sont calculés une seule fois au démarrage via `assets.mjs`. Le moteur de rendu accède à des entiers pré-calculés, jamais à des chaînes de caractères ou des calculs de grille pendant la frame.
* **Framing (Auto-tiling) :** Bitmasking (4-connectivity) calculé à la volée ou au chargement pour les transitions de textures.
* **Conversions :** Chunk -> Image via OffscreenCanvas (MicroTask) pour mettre en cache les chunks statiques. Mise à jour uniquement si modification (dirty flag)

-----

## 7\. Organisation & Déploiement

### 7.1 Structure des fichiers (ES Modules)

L'architecture sépare la logique (UI Logic) du rendu pur (Render) et distingue les types d'interfaces.

```
/sixty-below
├── /assets
│   ├── /sprites             # Tilesets, Charsets, Icons (PNG)
│   ├── /sounds              # SFX, Ambiances (MP3/OGG)
│   └── /data                # Tiles, Items, Recipes, Chests, Tables de loot, Actions de combat
├── /src
│   ├── constant.mjs         # CONFIG : Constantes, Enums (State, Biome, ItemType), Bitmasks
│   ├── assets.mjs           # RESOURCES : Loader (Images/Sons), Parser (Atlas Grid), Resolver (String -> UV Coords)
│   ├── utils.mjs            # TOOLS : MicroTasker, TaskScheduler, EventBus, TimeManager, Math, Helpers, Random custom, TimeManager
│   ├── database.mjs         # STORAGE : IDBWrapper (IndexedDB abstraction), SaveManager
│   ├── world.mjs            # PHYSICS : ChunkManager (Grid storage), PhysicsSystem (AABB Collisions, Gravity, Velocity), LiquidSimulator
│   ├── action.mjs           # GAMEPLAY : ActionManager (Mining, Cutting, Fishing, Foraging...)
│   ├── player.mjs           # PLAYER : PlayerManager (Déplacement, animation des actions, équipement, caractéristiques), LifeManager
│   ├── buff.mjs             # BUFFS/DEBUFFS : BuffManager, EffectDefinitions, StatModifiers (Middleware de calcul des bonus/malus), BuffDisplay (dans un Canvas en overlay)
│   ├── housing.mjs          # HOUSING : FurnitureManager (Placememnt/suppression Furniture/Crafting Station), HousingManager, Buffs
│   ├── combat.mjs           # TACTICAL : ArenaCreator (procédural - forme, murs et trous), TurnManager, Pathfinding (A* pour le combat), SpellSystem (Portée, DamageCalculator), CombatAI (CombatBehaviors combinables)
│   ├── ui.mjs               # INTERFACE PANEL/DOM (LOGIQUE) :
│   │                        # - Logic : InventorySystem (Slots, Stacking, Drag&Drop logic), CraftSystem (Recettes, validation)
│   │                        # - DOM Managers : InventoryPanel, HelpPanel, PreferencePanel (configuration UI, clavier, souris...)
│   │                        # - Canvas Managers : HotbarOverlay, EnvironmentOverlay (Draw logic)
│   ├── render.mjs           # GRAPHICS : MainRenderer (Canvas Context management), Camera (Viewport, Culling, Zoom), SpriteManager (Animations, Batching virtuel)
│   ├── generate.mjs         # PROC-GEN : Algorithmes de génération (Dynamic Import)
│   └── core.mjs             # SYSTEM : GameLoop (Update/Render/MicroTask), InputManager (Keyboard/Mouse listeners)
├── /tests                   # Tests unitaires
├── index.html               # Entry Point (ES Module Loader) + Canvas Layers + DOM Containers
└── package.json             # Pour ESLint/Tests uniquement
```

### 7.2 Déploiement (GitHub Pages)
* Hébergement statique direct depuis la branche main.
* Pas de build step. Le navigateur charge les modules .mjs.
* Contrôle Qualité : GitHub Action sur push pour exécuter les tests unitaires.

__To Do__ : comment implémenter l'aide en ligne et l'encyclopédie (le plus possible automatique, mais avec un peu de lore)

### 7.2 Tooling

  * **Linter :** Respect de la convention 'Format' de Google :
      * pas de point virgule à la fin des instructions
