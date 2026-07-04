// extrude-atlas.mjs — script de build (hors moteur), aucune classe.
//
// Ajoute une bordure d'extrusion de N pixels autour de chaque cellule d'un tilemap, pour
// éliminer le texture bleeding lors du drawImage avec scale (zoom caméra).
//
// La taille de tuile n'est PAS un paramètre global : chaque fichier encode sa propre taille
// dans son nom, convention déjà utilisée par le projet (ex: 'fuws_32_32', 'coconut_80_48') —
// <base>_<tileW>_<tileH>.png, tuiles non nécessairement carrées. Le nom de fichier en sortie
// est identique à celui d'entrée : seul le contenu pixel change (bordure ajoutée), la taille
// logique de tuile déclarée par le nom reste la référence utilisée par le code d'hydratation.
//
// Chaque pixel de bordure est une COPIE du pixel de bord le plus proche de la cellule
// d'origine (y compris les 4 coins) — pas une bordure transparente, qui ne ferait que
// déplacer le problème.
//
// Usage :
//   npm install pngjs
//   node extrude-atlas.mjs <inputDir> <outputDir> [padding=1]
//
//   cd C:\Users\dcabu\Documents\sixty-below
//   node extrude-atlas.mjs C:\Users\dcabu\Documents\sixty-below/assets/sprites C:\Users\dcabu\Documents\sixty-below/assets/sprites-padded
//
// Traite tous les .png d'inputDir dont le nom respecte la convention <base>_<W>_<H>.png.
// Un fichier hors convention, ou dont les dimensions ne sont pas un multiple exact de W/H,
// est signalé en erreur et sauté — le reste du lot continue.

import {readdirSync, mkdirSync, existsSync, readFileSync, writeFileSync} from 'fs'
import {join, extname, basename} from 'path'
import {PNG} from 'pngjs'

const [, , inputDir, outputDir, paddingArg] = process.argv

if (!inputDir || !outputDir) {
  console.error('Usage: node extrude-atlas.mjs <inputDir> <outputDir> [padding=1]')
  process.exit(1)
}

const PADDING = paddingArg ? parseInt(paddingArg, 10) : 1
const NAME_PATTERN = /^(.+)_(\d+)_(\d+)$/ // <base>_<tileW>_<tileH>, base peut contenir des '_'

if (!existsSync(outputDir)) mkdirSync(outputDir, {recursive: true})

const clamp = (v, min, max) => (v < min ? min : (v > max ? max : v))

/**
 * Extrait (tileW, tileH) du nom de fichier (sans extension), convention <base>_<W>_<H>.
 * @param {string} fileName — nom complet avec extension
 * @returns {{tileW: number, tileH: number}|null} null si le nom ne respecte pas la convention
 */
const parseTileSize = (fileName) => {
  const stem = basename(fileName, extname(fileName))
  const match = NAME_PATTERN.exec(stem)
  if (match === null) return null
  return {tileW: parseInt(match[2], 10), tileH: parseInt(match[3], 10)}
}

/**
 * Construit l'image paddée à partir d'un PNG source organisé en grille tileW×tileH.
 * Pour chaque pixel de destination, le pixel source lu est celui de la cellule d'origine
 * avec les coordonnées locales bornées à [0, tileW-1]/[0, tileH-1] — ce clamp couvre à la
 * fois la copie du contenu intérieur, l'extrusion des bords et celle des 4 coins.
 * @param {PNG} srcPng — image source décodée (pngjs)
 * @param {number} tileW — largeur de tuile logique (pixels, avant padding)
 * @param {number} tileH — hauteur de tuile logique (pixels, avant padding)
 * @returns {PNG} image paddée, mêmes proportions de grille
 * @throws {Error} si les dimensions ne sont pas des multiples exacts de tileW/tileH
 */
const extrudeImage = (srcPng, tileW, tileH) => {
  const {width: srcW, height: srcH} = srcPng

  if (srcW % tileW !== 0 || srcH % tileH !== 0) {
    throw new Error(`dimensions ${srcW}x${srcH} non multiples de la tuile ${tileW}x${tileH}`)
  }

  const cols = srcW / tileW
  const rows = srcH / tileH
  const cellW = tileW + 2 * PADDING
  const cellH = tileH + 2 * PADDING
  const dstW = cols * cellW
  const dstH = rows * cellH
  const dst = new PNG({width: dstW, height: dstH})

  for (let row = 0; row < rows; row++) {
    const srcCellY = row * tileH
    const dstCellY = row * cellH

    for (let col = 0; col < cols; col++) {
      const srcCellX = col * tileW
      const dstCellX = col * cellW

      for (let dy = 0; dy < cellH; dy++) {
        const sy = srcCellY + clamp(dy - PADDING, 0, tileH - 1)

        for (let dx = 0; dx < cellW; dx++) {
          const sx = srcCellX + clamp(dx - PADDING, 0, tileW - 1)
          const srcIdx = (srcW * sy + sx) << 2
          const dstIdx = (dstW * (dstCellY + dy) + (dstCellX + dx)) << 2

          dst.data[dstIdx] = srcPng.data[srcIdx]
          dst.data[dstIdx + 1] = srcPng.data[srcIdx + 1]
          dst.data[dstIdx + 2] = srcPng.data[srcIdx + 2]
          dst.data[dstIdx + 3] = srcPng.data[srcIdx + 3]
        }
      }
    }
  }

  return dst
}

const files = readdirSync(inputDir).filter((f) => extname(f).toLowerCase() === '.png')
if (files.length === 0) console.warn(`Aucun .png trouvé dans ${inputDir}`)

let done = 0
for (const file of files) {
  const tileSize = parseTileSize(file)
  if (tileSize === null) {
    console.error(`✗ ${file} — nom hors convention <base>_<W>_<H>.png, ignoré`)
    continue
  }

  const srcPng = PNG.sync.read(readFileSync(join(inputDir, file)))

  let dstPng
  try {
    dstPng = extrudeImage(srcPng, tileSize.tileW, tileSize.tileH)
  } catch (err) {
    console.error(`✗ ${file} — ${err.message}`)
    continue
  }

  writeFileSync(join(outputDir, file), PNG.sync.write(dstPng))
  console.log(`✓ ${file} — tuile ${tileSize.tileW}x${tileSize.tileH} — ${srcPng.width}x${srcPng.height} → ${dstPng.width}x${dstPng.height}`)
  done++
}

console.log(`\nTerminé : ${done}/${files.length} fichier(s) traité(s).`)
