# DESIGN DOC: Sixty-Below

> **AI CONTEXT INSTRUCTION:**
> Ce document est la Source de Vérité pour le projet "Sixty-Below".
> Toute génération de code ou proposition d'architecture doit strictement respecter les contraintes définies ci-dessous, en particulier la performance (60 FPS) et l'absence de Backend.

-----

## 1\. Vision & Contraintes Globales

### 1.1 Concept

**Sixty-Below** est une démonstration technique de jeu par navigateur mélangeant deux gameplays distincts :

1.  **Exploration (Temps réel) :** Vue de côté, minage, génération procédurale (Type: *Terraria*).
2.  **Combat (Faune - Tour par tour) :** Grille tactique, points d'action/mouvement, stratégie (Type: *Dofus*).
3.  **Récolte (Flore) :** Grille tactique, points d'action/mouvement, stratégie (Type: *Terraria*).
3.  **Artisanat (ce qui ne se loote pas, se crafte) :** Grille tactique, points d'action/mouvement, stratégie (Type: *Dofus*).

### 1.2 Contraintes Techniques (Non-négociables)

  * **Performance :** 60 FPS constants. Budget frame \< 16ms.
  * **Stack :** JavaScript Moderne (ESNext). Pas de framework de jeu lourd (Phaser/Unity). Bibliothèques légères autorisées comme sources d'inspiration.
  * **Rendu :** Canvas API (2D context).
  * **Architecture :** Client-Side Only. Base de Données Locale.
  * **Hébergement :** Doit tourner nativement depuis un repository GitHub (GitHub Pages).

-----

## 2\. Architecture Technique & Core Engine

### 2.1 Paradigme

Priorité au **Data-Oriented Design** pour la performance.

  * Adoption d'une architecture de type **ECS (Entity Component System)** ou composition stricte pour éviter les chaînes d'héritage profondes de la POO classique.
  * Séparation stricte : État (Data) vs Logique (Systems) vs Rendu (View).

### 2.2 La Game Loop

  * Utilisation de `requestAnimationFrame`.
  * Dans la boucle principale, détermination de trois budgets :
      * **Update (Physic) :** physique déterministe, déplacemments (joueur, faune). Typiquement 3 millisecondes
      * **Render (Draw) :** Affichage du fond (tuiles) puis des sprites (flore, faune, meubles). Typiquement 4 millisecondes
      * **MicroTasks (Logic)** Tâches longues découpées en micro-tâches pouvant ainsi s'exécuter sur plusieurs frames. Typiquement 5 millisecondes

  __TO DO__ : définir où gérer les animations des sprites

### 2.3 Gestion des États (State Machine)

Le jeu bascule entre trois états majeurs qui changent les inputs et l'interface :

  * `STATE_EXPLORATION` : Moteur physique actif, Inputs temps réel, Hot Bar.
  * `STATE_INFORMATION` : Moteur physique figé, affichage de panels d'information (inventaire, craft, carte, équipement, boutique, aide en ligne...)
  * `STATE_COMBAT` : Moteur physique figé, Inputs tour par tour, HUD tactique.

### 2.4 Gestion des Micro-tâches (MicroTasker)

Pour assurer le respect des 60FPS, toute tâche sera découpée en une ou plusieurs 'micro-tâches' :
  * Exécutées dans le budget défini par 12 millliseondes (3+4+5) moins le temps réellement passé pour l'**Update** et le **Render**
  * Définies avec une priorité et une capacité (temps d'exécution maximum 95% des occurences)
  * Dans la phase **MicroTask**, on exécute le maximum de micro-tâches en respectant la priorité, la capacité et le temps restant

### 2.5 Gestion des Actions (TaskScheduler)

Pour ne tester qu'une seule fin de délai par boucle, on organise toutes les tâches de longue durée (celles qui sont typiquement définies en secondes ou centièmes de seconde) dans un seul tableau.
  * Le tableau est trié par ordre de timestamp d'exécution des tâches (de façon que la suppression d'une tâche supprime uniquement le dernier élément du tableau et non le premier)
  * Les tâches dans le tableau sont triées.
  * L'insertion dans le tableau est effectuée avec un algorithme dichthomique.
  * La suppression d'une tâche est effectuée par la mise à jour d'un booléen (deleted), la suppression effective intervient losque la tâche aurait été exécutée.
  * L'exécution d'une tâche du tableau est effectuée en créant une micro-tâche à partir des données stockées dans le tableau (fonction, paramètres, priorité, capacité).

### 2.6 Découplage (EventBus)

Pour découpler les composants de l'application, un module de gestion d'événements est mis en place :
  * Evénement défini par un identifiant et des paramètres optionnels
  * Emission d'un événement (`eventBus.submit()`)
  * Ecoute d'un événement (`eventBus.on(idEvent, fonction)`)
  * Appel direct des fonctions lorsque l'événement est déclenché (si le traitement dépasse 0.1 millisecondes, cette fonction est en charge de créer une micro-tâche)

### 2.6 Maitien d'un temps absolu

Le jeu se déroule dans un monde qui a son propre calendrier. Il est nécessaire que la date courante dans le monde soit indépendante de la date réelle de l'exécution de l'application.
  * Au lancement du jeu, la date est initialisée à 0.
  * La date est incrémentée dans le boucle (budget **Update**, état `STATE_EXPLORATION`)
  * La date est sauvegardée en base de données
  * Au lancement de l'application, la date est récupérée depuis la base de données
  * La date est mémorisée en timestamp (en milliseconde) et convertie en datation locale (heure, jour, minute)
  * Une seconde de temps réel correspond à une minute de temps du monde. Donc une minute de temps réel = 1 heure du monde. Donc 24 minutes de temps réel = 1 journée du monde.

__TO DO__ : trouver des termes corrects pour les deux références 'temps-réel' et 'du monde', termes à utiliser dans la documenation et le programme.

-----

## 3\. Système "World" (Exploration)

### 3.1 Structure du Monde

  * **Grille de Tuiles (Tilemap) :** Le monde est une grille 2D.
  * **Taille du Monde (fixe) :** Le monde fait 2048 tuiles de large et 768 tuiles de haut.
  * **Taille d'une tuile (fixe) :** Chaque tuile fait 16 pixels de haut et 16 pixels de large.
  * **Stockage des Tuiles :** Toutes les tuiles du monde sont présentes en mémoire. Cela représente une taille de 1.5Mbytes ou 3Mbytes, parfaitement acceptable pour les navigateurs et ordinateurs modernes.
  * **Chunk System :** Le monde est divisé en `Chunks` de 16x16 tuiles, pour le chargement/déchargement dynamique. Donc le monde fait 128 chunks en largeur et 48 en hauteur. Il comporte donc 6144 chunks, chacun étant un enregistrement en base de données.
  * **Taille fixe :** les dimensions du monde, des chunks et des tuiles sont fixes. Il est donc **interdit** d'utiliser des constantes et on codera en dur les **masks** et opérations **bitwise** permettant d'accéder et d'identifier rapidement aux données
  *  **Echelle :** La dimension d'une tuile correspond à 50 centimètres pour le personnage. Le monde fait donc un kilomètre de large et 350 mètre de profond.

__TO DO__ : définir un terme pour le joueur (personnage derrière le clavier) et le personnage dans le monde. Utiliser ensuite ce terme partout.
__TO DO__ : déterminer si le contenu des tuiles est stocké sur un ou deux octets. Un octet suffit largement pour coder les différents types de briques. Ajouter un deuxième octet permettrait d'ajouter des informations supplémentaires sans devoir utiliser une indirection (tuile bloquée ou non, minable ou non, solide, liquide ou gazeuse, etc.). Trois choix d'implémentation (au moins) sont à analyser : Tuiles codées sur un octet et indirection pour obtenir les informations supplémentaires / Tuiles codées sur deux octets pour éviter les indirections mais sauvegarde également de ces informations en base de données / Deux tableaux, un pour la nature des tuiles et l'autre pour les informations complémentaitres, même index pour accéder aux deux tableaux mais seul le premier est sauvegardé en base de données.

### 3.2 Génération Procédurale

  * Génération non temps réel : on gèle l'interface pendant la génération (état `STATE_INFORMATION`).
  * Découpage en zones verticales pour 3 **biomes** (forêt, désert et jungle) plus la mer à gauche et à droite.
  * Découpage en zones horizontales  (4 **Layers**) pour gérer la difficulté (surface, underworld, caverns...).
  * Bruit de Perlin/Simplex pour rendre plus naturelles les frontières entre les zones rectangulaires.
  * Algorithme de creusement pour les tunnels et cavernes.
  * Gestion des fluides pour remplissage des lacs (water), des ruches (honey), des mares de sève dans la jungle (sap).
  * Algorithme pour ajouter les coffres, les minerais, la flore, les éléments de décor, d'autres éléments minables.
  * Algorithme pour éviter les trous isolés ou les tuiles isolées (nettoyage final).
  * Le bas du monde est rempli de lave 'Lava' (pour éviter une limite verticale arbitraire) de 1 à 3 case de haut (Perlin Noise).
  * Cible temps d'exécution : **10 secondes**
  * Uilisation d'une **World Key** qui permet de regénérer le même monde à partir de la même clé (clé stockée en base de données et affichée).

### 3.3 Physique (Exploration)

  * Déplacement du joueur par flèches directionnelles et touches ZQSD
  * Caméra centrée sur le joeuur
  * Zoom possible sur le monde
  * Collision AABB (Axis-Aligned Bounding Box) simple.
  * Pas de moteur physique lourd (Matter.js), implémentation custom légère spécifique aux jeux de tuiles.
  * S'applique uniquement au personnage et aux monstres (pas de projectiles, ni d'effets spéciaux hormis l'animation des sprites)
  * Algorithme de gestion des fluides par 'LiquidBody' pour Water, Honey et Sap (paramétrable en fonction de la viscosité)
  * Algorithme de gestion des fluides pour le sable (automate cellulaire)
  * AI simplifiée pour le déplacement des monstres (ignore le joueur, suit le joueur, évite le joueur, aime/déteste ses semblables, chasseur/proies

-----

## 4\. Système "Tactical" (Combat)

### 4.1 Déclenchement

  * La rencontre d'un ennemi gèle le `World System` et instancie le `Tactical System`.
  * Certains énemis attaquent automatiquement le joueur (AI simplifiée, buffs/debuffs).
  * Le joueur peut toujours attaquer un monstre en cliquant dessus.
  * La zone de combat se dessine directement sur le terrain actuel (overlay de grille).

### 4.2 Mécaniques

  * **Initiative :** Ordre de jeu déterminé au début (caractéristique du joueur (modifiable) et des monstres (fixe)).
  * **Génération automatique :** Génération automatique du terrain (forme, présence de trous et de mur) en fonction de la zone (biome + layer
  * **Grille :** Pathfinding (A\* ou Dijkstra) contraint par les obstacles du terrain généré (on ne peut pas marcher dans un mur ni sauter un trou).
  * **Ligne de vue** : bloquée par les joueurs et les murs, non bloquée par les trous
  * **Ressources :** PA (Points d'Action) et PM (Points de Mouvement).
  * **Challenges :** sous-buts permettant de diversifier les combats (cf Dofus)
  * **Evolutivité :** possibilité d'ajout de mécaniques spéciales (Boss)

-----

## 5\. Données & Persistance

### 5.1 Base de Données Locale

  * Technologie : **IndexedDB**.
  * Wrapper : Utilisation de `idb` (bibliothèque légère de Jake Archibald) pour les Promesses.

### 5.2 Stratégie de Sauvegarde

  * Auto-save sur événement (changement de chunk, fin de combat).
  * Sérialisation : Les entités et chunks doivent avoir des méthodes `toJSON()` et `fromJSON()` performantes.

-----

## 6\. Stratégies d'Optimisation (Performance First)

### 6.1 Gestion Mémoire (Garbage Collection)

  * **Object Pooling :** Obligatoire pour les entités fréquentes (Projectiles, Particules, Ennemis). Interdiction d'instancier des objets (`new Class`) dans la boucle de rendu (`render`).
  * **Pre-allocation :** Les tableaux et buffers sont pré-alloués autant que possible.

### 6.2 Rendu

  * **Culling :** Ne dessiner que ce qui est visible à l'écran + une marge (buffer).
  * **OffscreenCanvas :** Étude de l'utilisation d'un Worker dédié au rendu si le thread principal sature.
  * **Sprite Batching :** Regrouper les appels de dessin pour limiter les context switchs GPU/CPU.

-----

## 7\. Organisation & Déploiement

### 7.1 Structure des fichiers (Draft)

```
/sixty-below
├── /public          # Assets statiques (images, sons)
├── /src
│   ├── /core        # Moteur (Loop, Events, ECS base)
│   ├── /modules
│   │   ├── /world   # Génération, Chunks, Physics
│   │   ├── /combat  # Tour par tour, Pathfinding, Spells
│   │   └── /render  # Canvas managers, Sprites
│   ├── /data        # IndexedDB managers, Schemas
│   └── /utils       # Math, Helpers, Constants
├── /tests           # Tests unitaires critiques
├── index.html
└── package.json
```

### 7.2 Tooling

  * **Bundler :** Vite.js (HMR rapide, Build optimisé).
  * **Linter :** ESLint + Prettier.
  * **CI/CD :** GitHub Action pour déploiement sur la branche `gh-pages` à chaque push sur `main`.

-----

## 8\. Journal des Décisions (Architecture Decision Records - ADR)

  * *2025-11-20* : Choix du nom "Sixty-Below".
  * *2025-11-20* : Validation du mode "Serverless" avec IndexedDB.

-----

### Prochaine étape pour l'IA :

Une fois ce fichier en place, nous attaquerons le **Chapitre 7 (Organisation détaillée)** pour initialiser le repo avec `Vite`, ou le **Chapitre 2 (Architecture)** pour coder la boucle principale.
