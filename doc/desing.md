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

  * `STATE_EXPLORATION` : Moteur physique actif, Inputs temps réel.
  * `STATE_INFORMATION` : Moteur physique figé, affichage de panels d'information (inventaire, carte, équipement, boutique, aide en ligne...)
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
  * **Chunk System :** Le monde est divisé en `Chunks` (ex: 32x32 tuiles) pour le chargement/déchargement dynamique.
  * **Stockage des Tuiles :** Utilisation de `TypedArrays` (ex: `Uint16Array`) pour stocker les ID des blocs en mémoire (Optimisation RAM).

### 3.2 Génération Procédurale

  * Utilisation de **Web Workers** pour ne pas geler l'interface pendant la génération.
  * Algorithmes : Bruit de Perlin/Simplex pour le relief, Automates Cellulaires pour les cavernes.

### 3.3 Physique (Exploration)

  * Collision AABB (Axis-Aligned Bounding Box) simple.
  * Pas de moteur physique lourd (Matter.js), implémentation custom légère spécifique aux jeux de tuiles.

-----

## 4\. Système "Tactical" (Combat)

### 4.1 Déclenchement

  * La rencontre d'un ennemi gèle le `World System` et instancie le `Tactical System`.
  * La zone de combat se dessine directement sur le terrain actuel (overlay de grille).

### 4.2 Mécaniques

  * **Initiative :** Ordre de jeu déterminé au début.
  * **Grille :** Pathfinding (A\* ou Dijkstra) contraint par les obstacles du terrain généré (ex: on ne peut pas marcher dans un mur, on peut sauter un trou).
  * **Ressources :** PA (Points d'Action) et PM (Points de Mouvement).

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
