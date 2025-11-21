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

### 2.2 La Game Loop & Budgets Temps

  * Utilisation de `requestAnimationFrame`. Pour garantir la fluidité, chaque frame (16.6ms) est budgetée :
  * Dans la boucle principale, détermination de trois budgets :
      * **Update (Physic/Input) - Budget ~3ms :**
          * Déplacement Joueur/Faune
          * Physique déterministe
          * Incrémentation du temps "Monde"
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
MicroTasker : Exécute des tâches fractionnées dans le temps restant de la frame. Priorité et Capacité définies par tâche.

TaskScheduler : Gère les tâches longues (ex: cuisson, craft long). Tableau trié par timestamp d'exécution, recherche dichotomique, suppression "lazy" (flag deleted).

### 2.4 Gestion desTâches (MicroTasker & Scheduler)

* **MicroTasker :** Exécute des tâches fractionnées dans le temps restant de la frame. Priorité et Capacité définies par tâche.
* **TaskScheduler :** Gère les tâches longues (ex: minage, croissance de la flore). Tableau trié par timestamp d'exécution, insertion dichotomique, suppression "lazy" (flag `deleted`), exécution par création d'une micro-tâche.

### 2.5 Découplage (EventBus)

* **Système Pub/Sub** pour la communication entre modules sans dépendance cyclique.
* Si un listener dépasse 0.1ms, il doit déléguer son travail au `MicroTasker`.
* **Implémentation**
  * Evénement défini par un identifiant et des paramètres optionnels
  * Publication d'un événement (`eventBus.submit()`)
  * Ecoute d'un événement (`eventBus.on(idEvent, fonction)`)
  * Appel direct des fonctions lorsque l'événement est déclenché

### 2.6 Le temps

Distinction stricte entre :
* **Temps Réel** : Date système.
* **Temps Monde** : Stocké en Timestamp (ms). Ratio : 1 minute réelle = 1 heure monde (Cycle 24h monde = 24 min réelles).

Détails d'implémentaton :
  * **Initialisation :** A la création du monde, la date est initialisée à 0.
  * **Incrémentation :** La date est incrémentée dans la Game Loop (budget **Update**, état `STATE_EXPLORATION`)
  * **Persistence :** La date est sauvegardée en base de données et récupérée au lancement de l'application

### 2.7 Directive d'implémentation pour les Singletons

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

  * **Initiative :** Ordre de jeu déterminé au début (caractéristique du joueur (modifiable) et des monstres (fixe)).
  * **Grille :** Pathfinding (A\* ou Dijkstra) contraint par les obstacles du terrain généré (on ne peut pas marcher dans un mur ni sauter un trou).
  * **Ligne de vue** : bloquée par les joueurs et les murs, non bloquée par les trous
  * **Ressources :** PA (Points d'Action) et PM (Points de Mouvement).
  * **Challenges :** sous-buts permettant de diversifier les combats (cf Dofus)
  * **Evolutivité :** possibilité d'ajout de mécaniques spéciales (Boss)

-----

## 5\. Données & Persistance

### 5.1 Base de Données Locale

  * Technologie : **IndexedDB**.
  * Wrapper : Codage d'une classe dédiée.
  * Sérialisation : Inutile, la base de données le fait en interne (attention à certaines contraintes de performance)

### 5.2 Sauvegarde synchrone

Pour ne pas avoir de création ou de disparition d'items et assurer la sauvegarde consistante de l'état du monde, une classe est dédiée à la gestion de la basse de données locale.
  * Point d'entrée permettant de signaler qu'un élément a été modifié et doit être sauvegardé de façon synchrone (paramètres : objectStore, opération (update/create ou delete), record)
  * Point d'entrée permettant de signaler qu'au moins une des tuiles du monde a été modifié (paramètre : le chunk de la tuile modifiée)
  * Sauvegarde effectuée deux secondes après le premier signalement d'une modification (utilisation deu TaskManager)
  * Utilisatoin d'une session pour rollback en cas de problème lors de la sauvegarde
  * Conception interne : attention aux problèmes de performance avec les tableaux compacts.

### 5.2 Item de configuration

Une table particulière permet de mémoriser les éléments de configuration qui ne sont pas directement reliés au monde et ses objets :
  * Lecture d'un éléments de configuration (paramètre : identifiant (Strong) de l'élément de configuration / Retour : valeur de l'élément de configuration)
  * Ecriture d'un éléments de configuration (paramètre : identifiant (Strong) de l'élément de configuration, valeur de l'élément de configuration)
  * Utilisée pour la position du joueur, l'heure du monde (timestamp)...

-----

## 6\. Stratégies d'Optimisation (Performance First)

### 6.1 Gestion Mémoire (Garbage Collection)

  * **Singleton :** Une seule création des instances pour la majorité des classes. Ces classes vont souvent gérer des 'Array' (ou des Map) d'objets.
  * **Object Pooling :** A implémenter uniquement si les performances ne sont pas respectées. A priori, il y a peu de création/suppression d'objets. A monitorer.
  * **Pre-allocation :** Les tableaux et buffers sont pré-alloués autant que possible. Par exemple, l'ensemble des tuiles du monde est chargé en mémoire au lancement d'une partie dans un `Array` qui n'est plus modifié par la suite.

### 6.2 Rendu

  * **Culling :** Ne dessiner que ce qui est visible à l'écran + une marge (buffer). Dans la pratique, l'écran visible est de 4 chunks de haut et 3 de large. On générera donc uniquement les images pour un rectangle de 5*4 chunks.
  * **Conversion chunk vers image** : La conversion d'un chunk en image à afficher est effectuée dans une micro-tâche (budget **MicroTasks** au lieu de budget **Render**). On peut donc être amené à afficher une ancienne version du chunk pendant une à quelques frames. Ce délai est acceptable.
  * **Framing** : on utilisera la technique de Bitmasking (méthode **4-connectivity**) pour ajuster l'image affichée pour une tuile en fonction de ses voisins. Les tuiles ont des bords en partie transparents, qui seront remplis par la couleur dominante de la tuile adjacente. Cela permet la visualisation d'une diffusion d'une matière dans une autre.
  * **OffscreenCanvas :** Étude de l'utilisation d'un Worker dédié au rendu si le thread principal sature.
  * **Sprite Batching :** Regrouper les appels de dessin pour limiter les context switchs GPU/CPU. Analyser la pertinence de ce point pour une utilisation Canvas uniquement.

-----

## 7\. Organisation & Déploiement

### 7.1 Structure des fichiers (Draft)

Contrairement à l'usage, plusieurs classes sont regroupées dans un même fichier source. Le but est d'améliorer le temps de chargement de l'application.

```
L'architecture privilégie le regroupement par domaine fonctionnel (Functional Cohesion) pour limiter le nombre de requêtes HTTP (module loading) sans bundler.

/sixty-below
├── /assets
│   ├── /sprites             # Tilesets, Charsets (PNG)
│   ├── /sounds              # SFX, Ambiances (MP3/OGG)
│   └── /data                # Tiles, Items, Recipes, Chests, Tables de loot, Actions de combat
├── /src
│   ├── core.mjs             # LE CERVEAU
│   │                        # - GameLoop (Update/Render/MicroTask budgets)
│   │                        # - InputManager (Keyboard/Mouse listeners)
│   │                        # - EventBus (Pub/Sub)
│   │                        # - TimeManager (Temps réel vs Temps monde)
│   │                        # - MicroTaskManager
│   │                        # - TaskScheduler
│   │
│   ├── world.mjs            # LA PHYSIQUE & L'ESPACE
│   │                        # - ChunkManager (Grid storage)
│   │                        # - PhysicsSystem (AABB Collisions, Gravity, Velocity)
│   │                        # - LiquidSimulator
│   │
│   ├── action.mjs           # LES INTERACTIONS
│   │                        # - PlayerManager (Déplacement, animation des actions, équipement, caractéristiques)
│   │                        # - ActionManager (Mining, Cutting, Fishing, Foraging)
│   │                        # - FurnitureManager (Placememnt/suppression Furniture/Crafting Station)
│   │                        # - BuffManager (Placememnt/suppression Furniture/Crafting Station)
│   │                        # - Interaction logique (ex: ouvrir un coffre, remplir une bouteille d'eau)
│   │
│   ├── buff.mjs             # LES MODIFICATEURS (STATUS EFFECTS)
│   │                        # - BuffManager (Container par entité (joueur, monstre, plante...) et par état (exploration / combat)
│   │                        # - Definitions (Static, Timed, Periodic, Aura)
│   │                        # - StatModifiers (Calcul des bonus/malus)
│   │                        # - BuffDisplay (Dans un Canvas en overlay - Affichage configurable)
│   │                        # - Implentation de type middleware
│   │
│   ├── combat.mjs           # LE TACTIQUE
│   │                        # - ArenaCreator (Création procédurale du terrain - forme, murs et trous)
│   │                        # - TurnManager (Initiative, tours)
│   │                        # - GridPathfinder (A* pour le combat)
│   │                        # - SpellSystem (Portée, DamageCalculator)
│   │                        # - CombatAI (définition des behaviors possibles, chaque monstre utilisera un ou plusieurs behaviors)
│   │
│   ├── ui.mjs               # LES INTERFACES PANEL/DOM (LOGIQUE)
│   │                        # - UIManager (State machine des fenêtres)
│   │                        # - InventorySystem (Slots, Stacking, Drag&Drop logic)
│   │                        # - CraftSystem (Recettes, validation)
│   │                        # - HelpSystem (aide en ligne, Encyclopédie)
│   │                        # - PreferenceSystem (configuration UI, clavier, souris...)
│   │
│   ├── render.mjs           # LES YEUX
│   │                        # - Renderer (Canvas Context management)
│   │                        # - Camera (Viewport, Culling, Zoom)
│   │                        # - SpriteManager (Animations, Batching virtuel)
│   │                        # - Layering (Background, World, Entity, UI)
│   │                        # - Overlays (Environnement, Hotbar, buffs)
│   │
│   ├── database.mjs         # LA MÉMOIRE
│   │                        # - IDBWrapper (IndexedDB abstraction)
│   │                        # - SaveManager (Serializer/Deserializer)
│   │
│   ├── generate.mjs         # LE CRÉATEUR (Chargé dynamiquement)
│   │                        # - ProcGen (Perlin, Automates)
│   │
│   ├── constant.mjs         # LES RÉFÉRENCES
│   │                        # - Constantes globales (Taille tuile, FPS)
│   │                        # - Enums (State, Biome, ItemType)
│   │
│   └── utils.mjs            # LA BOÎTE À OUTILS
│                            # - Math helpers, Random custom
│
├── /tests                   # Tests unitaires critiques
├── index.html               # Point d'entrée (ES Module Loader)
└── package.json             # Pour ESLint/Tests uniquement
```

__To Do__ : comment utiliser GitHub pour lancer l'application ?
__To Do__ : comment implémenter l'aide en ligne et l'encyclopédie (le plus possible automatique, mais avec un peu de lore)

### 7.2 Tooling

  * **Bundler :** Aucun
  * **Linter :** Respect de la convnetion 'Format' de Google :
      * pas de point virgule à la fin des instructions
  * **CI/CD :** GitHub Action pour déploiement sur la branche `gh-pages` à chaque push sur `main`. A m'expliquer.
  * **Tests unitaires :** Outil à écrire - Politique à déterminer. Moking à prévoir. 

