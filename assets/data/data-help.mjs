/**
 * @file data-help.mjs
 * @description Aide en ligne du jeu Sixty-Below.
 * Contenu rédigé en Markdown enrichi — voir syntaxe ci-dessous.
 *
 * ═══════════════════════════════════════════════════════════════
 * SYNTAXE
 * ═══════════════════════════════════════════════════════════════
 *
 * ── Markdown standard ───────────────────────────────────────────
 *   **gras**         _italique_        __souligné__
 *   * puce niveau 1
 *     * puce niveau 2
 *   | col1 | col2 |  (table)
 *   | ---- | ---- |
 *
 * ── Liens inter-fiches ──────────────────────────────────────────
 *   [[node:code]]                → nom du noeud + lien vers sa fiche
 *   [[item:code]]                → nom de l'item + lien vers sa fiche
 *   [[helpTopic]]                → titre de la fiche d'aide + lien vers sa fiche
 *   [[node:code|texte affiché]]   → lien avec texte personnalisé
 *   [[item:code|texte affiché]]   → lien avec texte personnalisé
 *   [[helpTopic|texte affiché]]   → lien avec texte personnalisé
 *   (pas de lien si la fiche courante est celle du lien)
 *
 * ── Données dynamiques ──────────────────────────────────────────
 *   {{item:code}}       → affiche les infos de ITEMS.code
 *   {{node:code}}       → affiche les infos de NODES.code
 *   {{recipe:code}}     → affiche la recette de RECIPES[code]
 *   {{table:type:TOOL}} → affiche une table de tous les items du type donné
 *
 * ── Templates ───────────────────────────────────────────────────
 *   <<templateName|param1|param2>>   → inclusion d'un template
 *   Dans le template : {1}, {2}...   → placeholders des paramètres
 *   (un seul niveau d'inclusion — pas de template dans un template)
 *
 * ═══════════════════════════════════════════════════════════════
 * CARACTÈRES SPÉCIAUX  (copier/coller depuis ici)
 * ═══════════════════════════════════════════════════════════════
 *
 *   ⭐  nombre de star (tier) de l'entité
*
 *   ⏳  Feature non encore implémentée
 *       → Tant qu'il en reste dans le fichier, l'application n'est pas terminée.
 *
 *   ⚠️  Erreur d'hydratation (référence inconnue dans ITEMS/NODES/RECIPES)
 *       → Injecté automatiquement par le moteur à la place du code invalide.
 *       → Tolérance : la fiche s'affiche malgré l'erreur, avec le code et ⚠️ visible.
 *
 * ═══════════════════════════════════════════════════════════════
 */

/* ====================================================================================================
   TEMPLATES
   ==================================================================================================== */

const HELP_TEMPLATES = {
  miningInfo: `
**How to mine**
Use a [[{1}||Pickaxe]] of at least ⭐{2} to mine [[node:{3}]].
Mining drops: {{node:{3}:mining}}
  `,

  statTable: `
| Name | ⭐ | Speed | Sell |
| ---- | -- | ----- | ---- |
{{table:stype:{1}}}
  `
}

/* ====================================================================================================
   FICHES D'AIDE
   ==================================================================================================== */

export const HELP = [
  {
    title: 'Copper Ore',
    category: ['Mining', 'Ore'],
    content: `
**Description**
Copper is the most common ore found near the [[Surface||Surface layer]].
It is used in many early-game [[Crafting||recipes]].

**Location**
* Layer: [[node:surface]] and [[node:under]] ⏳
  * More common near the surface
  * Rarely found in [[node:caverns]]

**Mining**
<<miningInfo|copperPickaxe|1|copper>>

**Drops**
{{node:copper:mining}}

**Recipes using Copper**
{{recipe:copperBar}}
{{recipe:copperSword}} ⏳

**All Pickaxes**
<<statTable|pickaxe>>

**Tips**
* Copper veins are often found near [[node:stone]] clusters.
* _Tip: [[Torches||Bring torches]] when mining underground!_ ⏳
    `
  }, {
    title: 'Fern Cave',
    category: ['Mini-biome', 'Forest'],
    content: `
**Description**
A large underground cave found in [[Forest]] biomes, characterized by giant ferns growing on its flat floor.

**Location**
* Biome: [[Forest]]
* Layer: [[Underground]]
* One per Forest zone

**Floor**
* [[node:grassFern]] — surface layer
* [[node:humus]] — 2-3 tiles deep

**Inhabitants** ⏳
* [[monster:dendrobate]]
* [[monster:mamba]]
  `
  }
]

/* ====================================================================================================
   POST-TRAITEMENTS
   ==================================================================================================== */

// Remplacement textuel des <<...>> par le template correspondant.
// ⚠️ est injecté si le template ou un paramètre est manquant.
const expandTemplates = (content) =>
  content.replace(/<<(\w+)\|?([^>]*)>>/g, (_, name, params) => {
    const template = HELP_TEMPLATES[name]
    if (!template) return `⚠️ template inconnu: ${name}`
    const args = params ? params.split('|') : []
    return template.replace(/\{(\d+)\}/g, (_, i) => args[parseInt(i) - 1] ?? `⚠️ param {${i}} manquant`)
  })

// Expansion au chargement
for (const entry of HELP) {
  entry.content = expandTemplates(entry.content)
}

console.log('HELP', HELP)
