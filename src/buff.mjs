/**
 * @file buff.mjs
 * @description Gestion centralisée des buffs du joueur.
 * Layer : 4. Dépendances autorisées : constant.mjs, utils.mjs, eventBus.
 *
 * ── Principes ───────────────────────────────────────────────────────────────
 *
 * Un buff est une valeur (numérique ou booléenne) qui modifie le comportement
 * du jeu. Les buffs s'additionnent (jamais multipliés).
 * Valeur par défaut : 0 (falsy pour les booléens, neutre pour les numériques).
 *
 * ── Notation ────────────────────────────────────────────────────────────────
 *
 * Buff élémentaire  : camelCase   — ex. armorHelmetMiningSpeed, rainy, lucky
 * Buff composé      : kebab-case  — ex. mining-speed, movement-speed
 *
 * Un buff composé est la somme de tous les élémentaires qui le constituent.
 * Sa fonction de calcul est écrite en dur dans BuffManager pour la vitesse.
 *
 * ── Sources de buffs ────────────────────────────────────────────────────────
 *
 * Buffs statiques — actifs tant que la source est présente :
 *   - Lune (changement de jour)
 *   - Météo (changement de jour)
 *   - Cycle circadien (toutes les 3h in-game)
 *   - Trinkets (présence dans l'inventaire)
 *   - Accessories (slots dédiés)
 *   - Armure (3 slots gear)
 *   - Outil en main (slot actif hotbar)
 *   - Événements (invasion, météorite...)
 *
 * Buffs dynamiques (timer) — actifs pendant une durée déterminée :
 *   - Nourriture
 *   - Potions (sur-consommation → allongement du cooldown)
 *
 * Buffs environnementaux — recalculés à chaque changement de tuile :
 *   - Tuiles sous le joueur (Cobweb, Moss...)
 *   - Furniture dans le range du joueur
 *
 * ── Architecture ────────────────────────────────────────────────────────────
 *
 * #values : Map<string, number>         — valeurs brutes des buffs élémentaires
 *                                         mise à jour via eventBus
 * #fns    : Map<string, () => number>   — fonctions de calcul des buffs composés
 *                                         (et élémentaires calculés)
 *
 * getBuff(name) :
 *   return #values.get(name) ?? #fns.get(name)?.() ?? 0
 *
 * getBuffs(names) :
 *   itère sur le tableau, retourne un objet {name: value}
 *   utilisé par ex. par rollLootWithBuffs via buffManager.getBuffs(action.buffList)
 */

/* ====================================================================================================
   GESTION DES BUFFS
   ==================================================================================================== */

class BuffManager {
  #values = new Map() // valeurs brutes : rainy, lucky, armorHelmetMiningSpeed...
  #fns = new Map() // fonctions : mining-speed, movement-speed...

  init () {
    //
  }

  /**
   * Retourne la valeur d'un buff.
   * Cherche d'abord dans #values (O(1)), puis dans #fns (calcul à la demande).
   * Retourne 0 si le buff est inconnu (neutre pour numériques, falsy pour booléens).
   * @param {string} name
   * @returns {number}
   */
  getBuff (name) {
    return this.#values.get(name) ?? this.#fns.get(name)?.() ?? 0
  }

  /**
   * Retourne les valeurs de plusieurs buffs en une seule opération.
   * Utilisé notamment par rollLootWithBuffs.
   * @param {string[]} names
   * @returns {Object.<string, number>}
   */
  getBuffs (names) {
    const result = {}
    for (const name of names) {
      result[name] = this.#values.get(name) ?? this.#fns.get(name)?.() ?? 0
    }
    return result
  }
}

export const buffManager = new BuffManager()

/* ====================================================================================================
   AFFICHAGE DES BUFFS ACTIFS
   ==================================================================================================== */

class BuffWidget {
}
export const buffWidget = new BuffWidget()
