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
 *   [[itemCode]]                 → nom de l'item + lien vers sa fiche
 *   [[itemCode|texte affiché]]   → texte personnalisé + lien
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
 *   ⏳  Feature non encore implémentée
 *       → Tant qu'il en reste dans le fichier, l'application n'est pas terminée.
 *
 *   ⚠️  Erreur d'hydratation (référence inconnue dans ITEMS/NODES/RECIPES)
 *       → Injecté automatiquement par le moteur à la place du code invalide.
 *       → Tolérance : la fiche s'affiche malgré l'erreur, avec le code et ⚠️ visible.
 *
 * ═══════════════════════════════════════════════════════════════
 */
