



##### Parnsnip

* Taille : 1x1 tuile
* Disparition : 3h00
* Apparition : 3h00
  - Nombre : proportionnel au nombre de slots, plus petite variation aléatoire
  - tirage aléatoire parmi les spots
  - rejet si tuiles bloquées
* Spots :
  - Tuile de GRASSFOREST (donc sur la ligne de surface)
  - Pas sous les trois tuiles des arbres
  - Spot possible sous un meuble
* Foraging :
  - loot
  - suppression de la plante, pas du slot
* Mining :
  - possible sur la tuile sous la plante (non protégée)
* Placing :
  - impossible directement (tuile protégée)
  - possible via gestion des fluides (sand, liquid)
* Suppression SKY de la plante
  - pas de loot
  - suppression de la plante, pas du slot
* Suppression ou remplacement tuile du soil
  - pas de loot
  - suppression de la plante et du slot
* Use Case : du SAND tombe sur la plante :
  - le SAND atteint la tuile de SKY => plante supprimée, slot conservé (ParsnipSystem)
  - le SAND atteint la tuile au-dessus de la tuile de GRASSFOREST = la tuile de GRASSFOREST devient du DIRT (GrassForestSystem)
  - la tuile de GRASSFOREST est devenue du DIRT => suppression du slot (ParsnipSystem)
