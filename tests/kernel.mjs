// tests/kernel.mjs

let _currentSuite = null
export const _results = []

// ─── Console Mock ────────────────────────────────────────────────────────────

const _realLog = console.log
const _realError = console.error
const _realWarn = console.warn
let _consoleCaptured = null // null = pas de capture active

export function captureConsole () {
  _consoleCaptured = []
  console.log = (...args) => _consoleCaptured.push(args.join(' '))
  console.error = (...args) => _consoleCaptured.push(args.join(' '))
  console.warn = (...args) => _consoleCaptured.push(args.join(' '))
}

export function releaseConsole () {
  console.log = _realLog
  console.error = _realError
  console.warn = _realWarn

  const lines = _consoleCaptured ?? []
  _consoleCaptured = null
  return lines // retourne ce qui a été capturé pour les assertions
}

// ─── Kernel ──────────────────────────────────────────────────────────────────

export function describe (label, fn) {
  const suite = {label, passed: 0, failed: 0, lines: []}
  _currentSuite = suite
  fn()
  _currentSuite = null
  _results.push(suite)
}

export function assert (label, condition) {
  if (!_currentSuite) throw new Error(`assert() appelé hors d'un describe() : "${label}"`)
  if (condition) {
    _currentSuite.passed++
    _currentSuite.lines.push(`  ✅ ${label}`)
  } else {
    _currentSuite.failed++
    _currentSuite.lines.push(`  ❌ ${label}`)
  }
}
