import {seededRNG} from './utils.mjs'

/* ====================================================================================================
   CREATION DU MONDE
   ==================================================================================================== */

class WorldGenerator {
  generate (seed) {
    const t0 = performance.now()
    console.log('[WorldGenerator] - Début avec la graine', seed)
    // 1. On passe le générateur de nombre aléatoire en mode déterminé par la clé
    seededRNG.init(seed)

    // N. Stochage du monde en base de données

    // N + 1. On repasse le générateur de nombres aléatoires en mode aléatoire
    seededRNG.init()

    console.log('[WorldGenerator] - Terminé en', (performance.now() - t0).toFixed(3), 'ms')
  }
}
export const worldGenerator = new WorldGenerator()
