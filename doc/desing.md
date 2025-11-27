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

L'état du jeu définit quels sous-systèmes sont actifs (boucle principale et overlay temps réel / overlays qui bloquent le temps réel / génération d'un nouveau monde). L'``InputManager`` est l'autorité qui détient l'état courant (Pattern Input Authority).

  * `STATE_EXPLORATION` (0) :
      * Physique : Active (Mouvement fluide, Gravité).
      * Rendu du monde : Rafraîchissement constant (60 FPS).
      * MicroTasker et TaskScheduler : Actifs.
      * Inputs : Polling
          * Bitmask pour les touches clavier de mouvement
          * Position souris
          * click gauche / droit souris
          * molette souris
  * `STATE_INFORMATION` (1) :
      * Déclencheur : Ouverture d'un overlay (Inventaire, Craft, Aide).
      * Physique : Hard Stop (Figée). Le DeltaTime n'est plus calculé.
      * Rendu du monde : Hard Stop (Figée).
      * MicroTasker et TaskScheduler : Inactifs.
      * Inputs : Routés vers l'overlay actif.
      * Sortie du state : Fermeture du dernier overlay actif.
  * `STATE_CREATION` (1) :
      * Déclencheur : Demande de création, confirmée par introduction de la WorldKey.
      * Overlay (Inventaire, Craft, Aide) : Fermés automatiquement.
      * Boucle principale : Figée
      * Inputs : aucun
      * Sortie du state : quand le monde est créé et enregistré en base de données. Appel de startSession pour tout réinitialiser.
  * `STATE_COMBAT` (2) :
      * Identique au `STATE_INFORMATION`
      * L'utilité de ce mode sera déterminée ultérieurement

### 2.4 Gestion des Tâches (MicroTasker & Scheduler)

  * **MicroTasker** [`utils.mjs :: MicroTasker`] : Exécute des tâches fractionnées dans le temps restant de la frame. Priorité et Capacité définies par tâche.

  * **TaskScheduler** [`utils.mjs :: TaskManager`] : Gère les tâches longues (ex: cuisson, craft long). Tableau trié par timestamp d'exécution, recherche dichotomique, suppression "lazy" (flag deleted).

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
* **Détails d'implémentaton :**
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
    * Précision Accès DB : `database.mjs` est un driver pur (Get/Set/Batch). Il ne connaît ni le `ChunkManager` ni le `Player`.
* **Layer 2 (Systems - Interdependent) :** `world.mjs`, `action.mjs`, `buff.mjs`, `combat.mjs`, `ui.mjs`, `render.mjs`...
    * Comportement : Peuvent s'importer mutuellement.
    * Sécurité : Utilisation obligatoire du pattern init() pour les interactions croisées.
    * Exception : `generate.mjs` est isolé (importé dynamiquement ou statiquement sans dépendance retour).
    * Persistance : `persistence.mjs` (`SaveManager`) importe le Driver (Layer 1 - `database.mjs`), mémorise la liste des enregistrements provenant des Managers de données (Layer 2) pour orchestrer la sauvegarde toutes les 2 secondes.
* **Layer 3 (Application) :** `core.mjs`
    * Rôle : Point d'entrée. Importe les Layers 0, 1, 2. Orchestre l'initialisation séquentielle.

#### 2.7.2 Cycle de Vie  [`core.mjs :: GameCore`]

Pour permettre les références croisées dans la Layer 2 (ex: World a besoin de Combat, Combat a besoin de World) sans provoquer d'erreurs d'évaluation ESM, le cycle de vie est strict :
* **Instantiation :** Au chargement du module, le Singleton est créé via `new Class()`. Le constructeur ne doit jamais accéder à une autre instance de la Layer 2.
* **Initialisation :** Chaque Manager expose une méthode publique `init()`.

__Note__ : la création du singleton n'est effectuée qu'une seule fois. La fonction `init` peut être appelée plusieurs fois. On veillera à placer dans le `constructor` ce qui est constant (ex: création du DOM pour un overlay) et dans `init` ce qui change suite à la création d'un nouveau monde (ex: initialisation des informations dans le DOM, valeurs mises en cache).

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

### 2.8 Architecture des Inputs (Input Authority)

  * Responsabilité Inversée : L'InputManager ne dépend pas du GameCore. C'est lui qui détermine l'état du jeu via une pile d'overlays (Stack). Exemple : Si la pile contient ['inventory'], l'état est INFORMATION.
  * Séparation des Signaux :
      * Continuous (Polling) : Pour le mouvement en Exploration. Le Core lit un Bitmask binaire (inputFlags) à chaque frame.
      * Discrete (Events) : Pour les actions "One-Shot" (Ouvrir UI, Taper, Changer Slot). Transmis via l'EventBus.
  * Routing Hiérarchique : Les inputs sont traités en cascade :  Combat > Creation > Aide > Craft > Inventory > Exploration.

-----

## 3\. Système "World" (Exploration)

### 3.1 Structure du Monde

  * **Grille 2D de Tuiles (Tilemap) :** 1024 (Largeur) x 512 (Hauteur) tuiles. Taille tuile : 16x16px. Tailles fixes non paramétrées.
  * **Implémentation :**  [`world.mjs :: ChunkManager`] : Singleton maître de la donnée.
      * Stockage : `Uint8Array` unique (1 octet par tuile).
      * Optimisation : Utilisation stricte d'opérations bitwise (>> 4, & 15) pour les conversions de coordonnées.
      * Dirty Flags : Maintient deux listes de chunks modifiés : `dirtyRenderChunks` (pour le Renderer) et `dirtySaveChunks` (pour la Persistence).
  * **Stockage Mémoire (Runtime) :**
      * **Structure :** Un unique `Uint8Array` (Flat Array) stockant l'ID de la tuile (référence vers `NODES` via `NODES_LOOKUP`).
      * **Adressage :** Index calculé par opérations binaires : `index = (y << 10) | x`. Cet index sera utilisé comme référence unique à une tuile (on utilise **jamais** une String `x_y`).
      * **Evolutin :** Si des données supplémentaires sont nécessaires (ex: Murs, Liquides, tuiles bloquées), elles feront l'objet d'uune conception spécifique.
  * **Optimisation "Ghost Cells" (Padding) :**
      * Les bords de la carte sont **interdits à la modification** (Immuables) pour supprimer les vérifications de limites (Bounds Checking) dans les boucles critiques.
      * **Haut (y=0) :** SKY. Permet la détection de surface.
      * **Bas (y=511) :** LAVA.
      * **Latéral (x=0 et x=1023) :** Colonnes composées de DEEPSKY (haut), DEEPSEA (milieu) et BASALT (fond).
  * **Echelle :** 1 tuile = 50cm. Monde = 510 de large x 254m de haut.
  * **Classification des Entités (Grid vs Objects) :**
      * **Tuiles (Grid-based) :** Tout élément structurel répétitif stocké dans le `Uint8Array`.
          * Comprend : Terrain naturel (Terre, Pierre), Liquides, Vides (SKY, VOID), **Murs de fond** (Background Walls) et Murs de construction (Wood Walls).
      * **Furniture (Object-based) :** Tout élément posé manuellement par le joueur, stocké dans un Store dédié (`furniture`).
          * Comprend : Stations de craft, Coffres, Lits, Portes, Feux de camp...
          * **Cas spécifiques :** Les **Plateformes** et les **Sources de lumière** (Torches, Lampes) sont traitées comme des Furniture (entités libres) et non des Tuiles, pour ne pas bloquer la physique ou l'éclairage de la grille.
          * Gestion : Un item "Meuble" est dans l'inventaire (`inventory` store) tant qu'il n'est pas posé. Une fois posé, il passe dans le `furniture` store avec ses coordonnées.
  * **Map :** pour le débug, on pourra afficher la totalité de la carte à l'échelle 1/16 en utilisant la couleur dominante (attribut `color` de `NODES`). Affichage par la touche 'M', Disparition par 'M' ou 'Escape'.

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

### 3.4 Simulation & Écosystème

  * **Portée des mises à jour (Update Scope) :**
      * **Faune (Mobs) :** Gestion stricte dans l'espace visible (Viewport) + Buffer de sécurité ("Active Area"). Les entités hors zone sont désactivées ou despawnées pour économiser le CPU. L'apparition (Spawning) est calculée juste en dehors de la vue pour paraître naturelle.
      * **Liquides & Physique locale :** La simulation des fluides (eau, miel, sève, sable)

  * **Flore (Global Simulation) :**
      * La croissance des plantes (Arbres, Buissons, Fleurs) est **décorrélée des chunks**.
      * Les données sont stockées dans le Store `plant` dédié (Liste clairsemée).
      * La simulation est temporelle et globale (calcul mathématique basé sur le timestamp), ce qui permet à une forêt de pousser à l'autre bout du monde sans charger les chunks graphiques correspondants.

  * **Régénération :**
      * Certains matériaux critiques (Minerais rares, Ruches) possèdent des règles de régénération lente déclenchées par des timers globaux, générant des modifications de tuiles ponctuelles.
      * La lente croissance des toiles d'araignées (tuile spécifique) est déclenchées par des timers globaux, générant des modifications de tuiles ponctuelles.

-----

## 4\. Système "Tactical" (Combat)

### 4.1 Déclenchement & Rendu
  * État : Passage irréversible en STATE_COMBAT jusqu'à la fin du combat, si cet état est maintenu.
  * Rendu : Entièrement géré par le DOM, comme les autres overlays.
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

### 5.2 Sauvegarde et Persistance

* **Stratégie "Write-Behind" :**
    * Les modifications en jeu ne déclenchent pas d'écriture immédiate en base.
    * Les chunks modifiés sont marqués via un "Dirty Flag" (Set de coordonnées - `(chunk_y << 7) | chunk_x`).
    * Périodicité : Le `TaskScheduler` déclenche la sauvegarde des chunks 'Dirty' toutes les 2 secondes.

* **Dimensionnement du Transfer Pool (Elastic Pool) :**
    * **Principe :** Le pool possède une taille initiale fixe (64 buffers) couvrant 99% des cas d'usage pour garantir le "Zero-GC".
    * **Expansion d'Urgence :** Si le nombre de chunks modifiés dépasse la capacité du pool (Overflow), le système **doit** allouer de nouveaux buffers `Uint8Array` à la volée pour garantir l'intégrité des données.
    * **Persistance de l'expansion :** Les nouveaux buffers créés sont ajoutés définitivement au pool. Le pool ne réduit jamais sa taille, s'adaptant ainsi dynamiquement aux pics de charge spécifiques du style de jeu du joueur.
    * **Monitoring :** Toute extension du pool doit générer un avertissement (Error) dans la console pour permettre l'analyse et l'ajustement de la taille initiale dans les futures versions.

* **Session Transactionnelle :**
    * Une sauvegarde englobe les chunks modifiés ET les métadonnées critiques (Inventaire, Position) dans une même transaction pour garantir la cohérence en cas de crash. Elle s'effectue en utilisant `database.batchUpdate`.

 * **Orchestrateur [`persistence.mjs :: SaveManager`] :**
    * Module de Layer 2 qui utilise le `TaskScheduler` (toutes les 2s).
    * Interroge `ChunkManager` pour récupérer les deltas (Dirty Chunks), puis Formate les données brutes.
    * Récupère les records à créer/modifier/supprimer, informations envoyées les managers de données (InventoryManager, PlayerManager, Flore, Faune, Meubles...). Du point de vue des managers de données : Fire & Forget.
    * Appelle `database.mjs` (Layer 1) pour l'écriture physique (batchUpdate).
    * Confirme la sauvegarde à `ChunkManager` pour qu'ils nettoient leurs Dirty Flags.

### 5.3 Gestion de l'État Global (GameState Pattern)

Le `gamestate` est un stockage clé/valeur (K/V) utilisé pour persister les états dispersés des différents systèmes (Météo, Temps, Stats joueur, Flags divers, etc.).

* **Principe "Memory First" :** La source de vérité est **toujours** la variable en mémoire vive (RAM) dans l'instance du Manager concerné. La base de données n'est qu'un miroir de persistance.
* **Cycle de Vie (Session Start) [`core.mjs`] :**
    * **1. Chargement Global :** Au début de `startSession`, l'application charge l'intégralité du `gamestate` en une seule requête via `database.getAllGameState()`.
    * **Distribution (Injection) :** Les valeurs récupérées sont extraites et passées en arguments aux méthodes `.init()` des différents Managers (`timeManager.init(state.timestamp)`, `playerManager.init(state.pos)`...).
* **Mise à jour (Runtime) :**
    * Lorsqu'un Manager modifie une donnée d'état, il met à jour sa variable locale (immédiat).
    * Il déclenche ensuite une sauvegarde asynchrone via `database.setGameState(key, value)` (ou `batchSetGameState`).
    * **Règle stricte :** Le Manager n'attend pas (`await`) la fin de l'écriture pour continuer son traitement. C'est du "Fire and Forget".
* **Lecture (Runtime) :**
    * L'utilisation de `database.getGameStateValue(key)` est **déconseillée** pendant le jeu. Les Managers doivent utiliser leurs propres variables membres.
* **Nettoyage :**
    * Aucune suppression de clé n'est gérée manuellement. Le nettoyage se fait naturellement lors de la suppression complète des stores à la création d'un nouveau monde (`database.clearAllObjectStores`).

### 5.4 Identifiants Logiques vs Physiques

* **Problème :** La création d'entités en base de données (`IndexedDB`) est asynchrone et génère des clés primaires (Physical ID - attribut `key`) *a posteriori* (Fire & Forget). Cela empêche de lier des entités entre elles (ex: un Arbre et ses Champignons) lors de leur instanciation en mémoire si l'on doit attendre le retour de la base.
* **Solution:** Utilisation d'un **Identifiant Logique (UID)** généré par l'application au moment de l'instanciation.
    * Permet de créer des graphes d'objets complets en mémoire avant même que la sauvegarde ne soit lancée.
    * L'UID est stocké dans le record et sert de référence pour les liens (parent/enfant/voisins).
    * La clé physique (IndexedDB Key) reste utilisée pour l'indexation interne du moteur de stockage, mais n'est pas exposée à la logique métier pour les liaisons.
* **Génération :** Algorithme à "Graine + Suffixe".
    * Pour optimiser les E/S, la graine (Seed) n'est sauvegardée qu'une fois toutes les 26 générations.
    * En cas de redémarrage, on saute systématiquement à la graine suivante pour garantir l'unicité, acceptant des "trous" dans la séquence d'IDs.

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
* **Diffusion :** Pour rendre plus naturelle la transition entre deux tuiles, elles ont un bord de 2 pixels partiellement transparent. Les pixels transparents sont peints de la couleur dominante des tuiles adjacentes.

### 6.2 Implémentation [`render.mjs :: WorldRenderer`] :**
    * Ne stocke aucune donnée de jeu. Lit exclusivement le `ChunkManager`.
    * Cache : Utilise un pool d'OffscreenCanvas (ou Canvas cachés) par chunk visible.
    * Camera : Singleton responsable uniquement des mathématiques de projection (World <-> Screen), du Culling (Quels chunks sont visibles ?) et du zoom.

### 6.3 Organisation spatiale

* **Taille des Canvas :** Le monde est affiché dans un canvas de 4 chunks de large (1024 pixels) et 3 chunks de haut (768 pixels).
* **Centrage :** Ces canvas sont centrés dans l'écran physique.
* **Overlays de jeu :** Les overlays affichés pendant le jeu (pendant le temps réel) sont collés sur les bords de l'écran (avec un padding de 10px pour l'esthétique). Sur grand écran, ils n'empiètent pas sur l'affichage du monde.
* **Overlays de jeu :** Les overlays qui interrompent le déroulement du jeu (inventaire, craft, aide, paramètres...) sont affichés centrés sur l'écran. Ils peuvent s'empiler les uns sur les autres.

### 6.4 Hiérarchie Visuelle et Input (Z-Index Strategy)

L'ordre d'affichage et de capture des clics est statique, défini par le CSS et respecté par l'InputManager.

  * Game Layer (Z: 0) : Canvas du Monde (Personnage, Décors).
  * HUD Layer (Z: 20) : Éléments DOM permanents (Hotbar, Jauge Vie, Environment, Debug).
  * Info Panels (Z: 30 à 90) : Overlays bloquants
    * 30 : Inventaire.
    * 40 : Craft.
    * 50 : Aide.
  * Combat (Z: 100)
  * Creation (Z: 110)
  * System Layer (Z: 200) : Dialogues Modaux (Priorité absolue).

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
│   ├── database.mjs         # DRIVER / STORAGE : IDBWrapper (Abstraction bas niveau IndexedDB). Aucune logique métier.
│   ├── world.mjs            # PHYSICS : ChunkManager (Grid storage), PhysicsSystem (AABB Collisions, Gravity, Velocity), LiquidSimulator
│   ├── world.mjs            # DATA & PHYSICS : ChunkManager (Uint8Array Grid storage, Dirty Flags), PhysicsSystem (AABB Collisions, Gravity, Velocity), LiquidSimulator.
│   ├── persistence.mjs      # ORCHESTRATOR : SaveManager. Coordonne la sauvegarde (Player/World/Flore/Faune -> Database).
├── action.mjs           # GAMEPLAY : ActionManager (Mining, Cutting, Fishing, Foraging...)
│   ├── player.mjs           # PLAYER : PlayerManager (Déplacement, animation des actions, équipement, caractéristiques), LifeManager
│   ├── buff.mjs             # BUFFS/DEBUFFS : BuffManager, EffectDefinitions, StatModifiers (Middleware de calcul des bonus/malus), BuffDisplay (dans un Canvas en overlay)
│   ├── housing.mjs          # HOUSING : FurnitureManager (Placememnt/suppression Furniture/Crafting Station), HousingManager, Buffs
│   ├── combat.mjs           # TACTICAL : ArenaCreator (procédural - forme, murs et trous), TurnManager, Pathfinding (A* pour le combat), SpellSystem (Portée, DamageCalculator), CombatAI (CombatBehaviors combinables)
│   ├── ui.mjs               # INTERFACE PANEL/DOM (LOGIQUE) :
│   │                        # - Logic : InventorySystem (Slots, Stacking, Drag&Drop logic), CraftSystem (Recettes, validation)
│   │                        # - DOM Managers : InventoryPanel, HelpPanel, PreferencePanel (configuration UI, clavier, souris...)
│   │                        # - Canvas Managers : HotbarOverlay, EnvironmentOverlay (Draw logic)
│   ├── ui-debug.mjs         # INTERFACE PANEL/DOM uniquement dédiée au debug
│   ├── render.mjs           # GRAPHICS : WorldRenderer (OffscreenCanvas Cache), Camera (Maths & Culling), SpriteManager (Animations, Batching virtuel).
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

## 8. Modules Métier (Layer 2) - Contrats d'interface

Cette couche contient la logique spécifique du jeu. Les modules communiquent le plus possible via l'EventBus (Pattern Pub/Sub) pour garantir un couplage faible.

### 8.1 Système d'Inventaire [`ui.mjs` / `inventory.mjs`]
* **Responsabilité :** Gérer le stockage, les slots, l'équipement et les artefacts passifs.
* **Cycle de vie des Buffs Statiques :**
    * L'inventaire ne calcule pas les stats. Il se contente de scanner son contenu.
    * À la fermeture de l'interface, il génère une liste d'IDs d'artefacts actifs (ex: `['sextant', 'gps']`).
    * **Événement émis :** `inventory/static-buffs` avec la liste en payload.

### 8.2 Système de Buffs [`buff.mjs`]
* **Responsabilité :** Centraliser tous les bonus/malus (Temporaires, Passifs, d'Équipement).
* **Buffs Statiques : Pattern "Re-emitter" :**
    1.  S'abonne à `inventory/static-buffs`.
    2.  Met à jour son état interne (quels artefacts sont présents).
    3.  Émet des événements granulaires pour les consommateurs finaux (UI, Player).
        * *Exemple :* Réception de `'gps'` -> Émission de `buff/coords` (boolean).
        * *Exemple :* Réception de `'clock_lvl2'` -> Émission de `buff/precision` (valeur).
* **Avantage :** L'UI ne sait pas qu'il faut un "Sextant" pour voir la météo, elle sait juste qu'elle a reçu le signal `buff/weather-forecast`. Cela permet de changer les règles de Game Design (ex: changer l'item requis) sans toucher à l'UI.

### 8.3 Interface Environnement [`ui.mjs`]
* **Abonnement :** Écoute les événements granulaires du `BuffManager` (`buff/moon`, `buff/weather`, `buff/coords`).
* **Optimisation dynamique :**
    * Pour les coordonnées (mise à jour fréquente), l'UI [`EnvironmentOverlay`] ne s'abonne à l'événement `player/move` **QUE** si le buff `buff/coords-display` est actif.
    * Si le buff est perdu, l'UI se désabonne immédiatement de `player/move` pour économiser le CPU.
