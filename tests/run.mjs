// tests/run.mjs
// Exécution : node C:\Users\dcabu\Documents\sixty-below\tests\run.mjs
// cd C:\Users\dcabu\Documents\sixty-below
// node tests/run.mjs            → tous les tests, résumé une ligne par classe
// node tests/run.mjs EventBus   → détail complet pour cette classe
import {_results} from './kernel.mjs'

const REGISTRY = [
  {name: 'EventBus', file: './test-eventbus.mjs'},
  {name: 'MicroTasker', file: './test-microtasker.mjs'},
  {name: 'TaskScheduler', file: './test-taskscheduler.mjs'},
  {name: 'TimeManager', file: './test-timemanager.mjs'},
  {name: 'SeededRNG', file: './test-seededrng.mjs'},
  {name: 'WorldBuffer', file: './test-worldbuffer.mjs'},
  {name: 'BiomesGenerator', file: './test-biomesgenerator.mjs'},
  {name: 'BiomeNaturalizer', file: './test-biomenaturalizer.mjs'},
  {name: 'LiquidFiller', file: './test-liquidfiller.mjs'},
  {name: 'ClusterGenerator', file: './test-clustergenerator.mjs'}
]

const target = process.argv[2] ?? null

const entries = target
  ? REGISTRY.filter(e => e.name.toLowerCase() === target.toLowerCase())
  : REGISTRY

if (entries.length === 0) {
  console.error(`❓ Classe inconnue : "${target}"`)
  console.error(`   Classes disponibles : ${REGISTRY.map(e => e.name).join(', ')}`)
  process.exit(1)
}

for (const entry of entries) {
  await import(entry.file)
}

// Affichage
const verbose = target !== null
let totalPassed = 0
let totalFailed = 0

for (const suite of _results) {
  totalPassed += suite.passed
  totalFailed += suite.failed

  const icon = suite.failed === 0 ? '✅' : '❌'

  if (verbose) {
    console.log(`\n📦 ${suite.label}`)
    for (const line of suite.lines) console.log(line)
    console.log(`   ${icon} ${suite.passed} passés, ${suite.failed} échoués`)
  } else {
    const pad = suite.label.padEnd(36)
    console.log(`${icon} ${pad} ${suite.passed} ✅  ${suite.failed > 0 ? suite.failed + ' ❌' : ''}`)
  }
}

console.log(`\n${'─'.repeat(44)}`)
const allGreen = totalFailed === 0
console.log(`${allGreen ? '✅' : '❌'} Total : ${totalPassed} passés, ${totalFailed} échoués`)
if (!allGreen) process.exit(1)
