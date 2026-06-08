// action.mjs — miningManager

/* ====================================================================================================
   HELPERS COMMUNS A TOUS LES MANAGERS
   ==================================================================================================== */

/* ====================================================================================================
   GESTION DU MINAGE DE TUILES
   ==================================================================================================== */

class MiningManager {
  tryMine (tileIndex, tileNode, tool, prefix) {
    console.log('MiningManager.tryMine', {tileIndex, tileNode, tool, prefix})
  }
}
export const miningManager = new MiningManager()
