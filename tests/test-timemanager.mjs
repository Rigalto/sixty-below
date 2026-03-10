// tests/test-timemanager.mjs
// Lancement : node tests/run.mjs TimeManager
//
// Chaque describe() instancie sa propre TimeManager.
// Les listeners sont enregistrés sur le singleton eventBus et nettoyés après chaque suite.
//
// Table de conversion (REAL_MS_PER_GAME_MINUTE = 1000) :
//   1 minute jeu =     1 000 ms réelles
//   5 minutes jeu =    5 000 ms réelles
//   1 heure jeu  =    60 000 ms réelles
//   3 heures jeu =   180 000 ms réelles
//   1 jour jeu   = 1 440 000 ms réelles
//
// Timestamps de référence :
//   Jour 0, 00:00 =         0 ms
//   Jour 0, 06:00 =   360 000 ms
//   Jour 0, 08:00 =   480 000 ms  (valeur par défaut)
//   Jour 0, 21:00 = 1 260 000 ms
//   Jour 1, 00:00 = 1 440 000 ms

import {describe, assert} from './kernel.mjs'
import {TimeManager, eventBus} from '../src/utils.mjs'

// ─── Helper ───────────────────────────────────────────────────────────────────

// Enregistre un listener sur eventBus, retourne les données reçues et un cleanup
function capture (event) {
  const received = []
  const handler = (data) => received.push(data)
  eventBus.on(event, handler)
  return {received, cleanup: () => eventBus.off(event, handler)}
}

// ─── init ─────────────────────────────────────────────────────────────────────

describe('TimeManager — init() : mémorise les valeurs passées en paramètre', () => {
  const tm = new TimeManager()
  tm.init(480000, 2, 3)

  assert('timestamp est mémorisé', tm.timestamp === 480000)
  assert('weather est mémorisée', tm.weather === 2)
  assert('nextWeather est mémorisée', tm.nextWeather === 3)
})

describe('TimeManager — init() : valeurs par défaut', () => {
  const tm = new TimeManager()
  tm.init()

  assert('timestamp par défaut = 480000', tm.timestamp === 480000)
  assert('weather par défaut = 0', tm.weather === 0)
  assert('nextWeather par défaut = 0', tm.nextWeather === 0)
})

describe('TimeManager — init() : reset du cache calendrier', () => {
  const tm = new TimeManager()
  tm.init(480000)

  assert('day vaut -1', tm.day === -1)
  assert('hour vaut -1', tm.hour === -1)
  assert('minute vaut -1', tm.minute === -1)
  assert('timeSlot vaut -1', tm.timeSlot === -1)
})

describe('TimeManager — init() : n\'émet aucun événement', () => {
  const tm = new TimeManager()

  const events = []
  const handler = (data) => events.push(data)
  const watched = ['time/clock', 'time/every-5-minutes', 'time/every-hour',
    'time/timeslot', 'time/daily', 'time/first-loop', 'time/sky-color-changed']
  for (const e of watched) { eventBus.on(e, handler) }

  tm.init(480000)

  for (const e of watched) { eventBus.off(e, handler) }
  assert('Aucun événement émis par init()', events.length === 0)
})

// ─── update : first-loop ──────────────────────────────────────────────────────

describe('TimeManager — update() : first-loop émet time/first-loop une seule fois', () => {
  const tm = new TimeManager()
  tm.init(480000)

  const c = capture('time/first-loop')
  tm.update(0) // 1ère frame → doit émettre
  tm.update(0) // 2ème frame → ne doit pas réémettre
  tm.update(0)
  c.cleanup()

  assert('time/first-loop émis exactement une fois', c.received.length === 1)
})

describe('TimeManager — update() : time/first-loop contient le snapshot complet', () => {
  const tm = new TimeManager()
  tm.init(480000) // Jour 0, 08:00

  const c = capture('time/first-loop')
  tm.update(0)
  c.cleanup()

  const snap = c.received[0]
  assert('snapshot contient day', snap.day !== undefined)
  assert('snapshot contient hour', snap.hour !== undefined)
  assert('snapshot contient minute', snap.minute !== undefined)
  assert('snapshot contient tslot', snap.tslot !== undefined)
  assert('snapshot contient weather', snap.weather !== undefined)
  assert('snapshot contient nextWeather', snap.nextWeather !== undefined)
  assert('snapshot contient skyColor', snap.skyColor !== undefined)
  assert('snapshot contient moonPhase', snap.moonPhase !== undefined)
  assert('snapshot contient isDay', snap.isDay !== undefined)
})

// ─── update : calendrier ──────────────────────────────────────────────────────

describe('TimeManager — update() : calcul correct du calendrier à 08:00', () => {
  const tm = new TimeManager()
  tm.init(480000) // Jour 0, 08:00
  tm.update(0)

  assert('day = 0', tm.day === 0)
  assert('hour = 8', tm.hour === 8)
  assert('minute = 0', tm.minute === 0)
  assert('isDay = true à 08:00', tm.isDay === true)
})

describe('TimeManager — update() : calcul correct du calendrier à 00:00', () => {
  const tm = new TimeManager()
  tm.init(0) // Jour 0, 00:00
  tm.update(0)

  assert('day = 0', tm.day === 0)
  assert('hour = 0', tm.hour === 0)
  assert('minute = 0', tm.minute === 0)
  assert('isDay = false à 00:00', tm.isDay === false)
})

describe('TimeManager — update() : passage au jour 1', () => {
  const tm = new TimeManager()
  tm.init(1440000) // Jour 1, 00:00
  tm.update(0)

  assert('day = 1', tm.day === 1)
  assert('hour = 0', tm.hour === 0)
})

describe('TimeManager — update() : moonPhase = day & 7', () => {
  const tm = new TimeManager()
  for (let d = 0; d < 10; d++) {
    tm.init(d * 1440000)
    tm.update(0)
    assert(`moonPhase correcte pour jour ${d}`, tm.moonPhase === (d & 7))
  }
})

// ─── update : événement time/clock ────────────────────────────────────────────

describe('TimeManager — update() : time/clock émis à chaque minute', () => {
  const tm = new TimeManager()
  tm.init(480000) // 08:00

  const c = capture('time/clock')
  tm.update(0) // minute 0 → émis (first-loop)
  tm.update(1000) // +1 min → émis
  tm.update(1000) // +1 min → émis
  tm.update(500) // < 1 min → pas d'émission
  c.cleanup()

  assert('time/clock émis 3 fois (first-loop + 2 minutes)', c.received.length === 3)
})

describe('TimeManager — update() : time/clock payload correct', () => {
  const tm = new TimeManager()
  tm.init(480000) // Jour 0, 08:00

  const c = capture('time/clock')
  tm.update(0)
  c.cleanup()

  const payload = c.received[0]
  assert('payload contient day = 0', payload.day === 0)
  assert('payload contient hour = 8', payload.hour === 8)
  assert('payload contient minute = 0', payload.minute === 0)
})

// ─── update : événement time/every-5-minutes ─────────────────────────────────

describe('TimeManager — update() : time/every-5-minutes émis toutes les 5 minutes', () => {
  const tm = new TimeManager()
  tm.init(0) // 00:00

  const c = capture('time/every-5-minutes')
  tm.update(0) // min 0 → émis (first-loop)
  tm.update(5000) // +5 min → émis
  tm.update(1000) // +1 min → pas d'émission
  tm.update(4000) // +4 min → total +5 min → émis
  c.cleanup()

  assert('time/every-5-minutes émis 3 fois', c.received.length === 3)
})

// ─── update : événement time/every-hour ──────────────────────────────────────

describe('TimeManager — update() : time/every-hour émis à chaque heure', () => {
  const tm = new TimeManager()
  tm.init(0) // 00:00

  const c = capture('time/every-hour')
  tm.update(0) // heure 0 → émis (first-loop)
  tm.update(60000) // +1h → émis
  tm.update(30000) // +30min → pas d'émission
  tm.update(30000) // +30min → total +1h → émis
  c.cleanup()

  assert('time/every-hour émis 3 fois', c.received.length === 3)
})

describe('TimeManager — update() : isDay correct aux bornes 06:00 et 21:00', () => {
  const tm = new TimeManager()

  // 05:59 → nuit (359 min * 1000ms)
  tm.init(359000)
  tm.update(0)
  assert('isDay = false à 05:59', tm.isDay === false)

  // 06:00 → jour (360 min * 1000ms)
  tm.init(360000)
  tm.update(0)
  assert('isDay = true à 06:00', tm.isDay === true)

  // 20:59 → jour (1259 min * 1000ms)
  tm.init(1259000)
  tm.update(0)
  assert('isDay = true à 20:59', tm.isDay === true)

  // 21:00 → nuit (1260 min * 1000ms)
  tm.init(1260000)
  tm.update(0)
  assert('isDay = false à 21:00', tm.isDay === false)
})

// ─── update : événement time/timeslot ────────────────────────────────────────

describe('TimeManager — update() : time/timeslot émis toutes les 3 heures', () => {
  const tm = new TimeManager()
  tm.init(0) // 00:00 → slot 0

  const c = capture('time/timeslot')
  tm.update(0) // slot 0 → émis (first-loop)
  tm.update(181000) // +3h01min → slot 1 → émis (minute change → cascade déclenchée)
  tm.update(60000) // +1h → même slot → pas d'émission
  tm.update(119000) // +1h59min → slot 2 → émis
  c.cleanup()

  assert('time/timeslot émis 3 fois', c.received.length === 3)
  assert('tslot = 0 au démarrage', c.received[0].tslot === 0)
  assert('tslot = 1 après ~3h', c.received[1].tslot === 1)
  assert('tslot = 2 après ~6h', c.received[2].tslot === 2)
})

// ─── update : événement time/daily ───────────────────────────────────────────

describe('TimeManager — update() : time/daily émis à minuit', () => {
  const tm = new TimeManager()
  tm.init(0)

  const c = capture('time/daily')
  tm.update(0) // jour 0, H0, min 0 → émis (first-loop)
  tm.update(1501000) // +25h01min → jour 1, H1, min 1 → émis
  tm.update(660000) // +11h → jour 1, H12, min 1 → pas d'émission
  tm.update(1561000) // +26h01min → jour 2, H14, min 2 → émis

  assert('time/daily émis 3 fois', c.received.length === 3)
  assert('payload day = 0 au démarrage', c.received[0].day === 0)
  assert('payload day = 1', c.received[1].day === 1)
  assert('payload day = 2', c.received[2].day === 2)
  c.cleanup()
})

describe('TimeManager — update() : rotation météo à minuit (sauf first-loop)', () => {
  const tm = new TimeManager()
  tm.init(0, 1, 2) // weather=1, nextWeather=2

  tm.update(0) // first-loop → pas de rotation
  assert('weather inchangée au first-loop', tm.weather === 1)
  assert('nextWeather inchangée au first-loop', tm.nextWeather === 2)

  tm.update(1501000) // +25h01min → jour 1, H1, min 1 → cascade complète → rotation
  assert('weather = ancienne nextWeather après minuit', tm.weather === 2)
})

// ─── update : couleur du ciel ─────────────────────────────────────────────────

describe('TimeManager — update() : time/sky-color-changed émis au démarrage', () => {
  const tm = new TimeManager()
  tm.init(480000) // 08:00 — plein jour

  const c = capture('time/sky-color-changed')
  tm.update(0)
  c.cleanup()

  assert('time/sky-color-changed émis au first-loop', c.received.length === 1)
  assert('La couleur reçue est une string non vide',
    typeof c.received[0] === 'string' && c.received[0].length > 0)
})

describe('TimeManager — update() : time/sky-color-changed non émis si couleur inchangée', () => {
  const tm = new TimeManager()
  tm.init(480000) // 08:00 — plein jour
  tm.update(0) // first-loop consommé

  const c = capture('time/sky-color-changed')
  tm.update(1000) // +1 min — même tranche de couleur (5min)
  tm.update(1000) // +1 min — idem
  c.cleanup()

  assert('Pas d\'émission si la couleur ne change pas', c.received.length === 0)
})

describe('TimeManager — update() : currentSkyColor est une string hex valide', () => {
  const tm = new TimeManager()
  tm.init(480000)
  tm.update(0)

  assert('currentSkyColor existe', tm.currentSkyColor !== undefined)
  assert('currentSkyColor est une string', typeof tm.currentSkyColor === 'string')
  assert('currentSkyColor commence par #', tm.currentSkyColor.startsWith('#'))
})

// ─── update : timestamp ───────────────────────────────────────────────────────

describe('TimeManager — update() : timestamp s\'incrémente correctement', () => {
  const tm = new TimeManager()
  tm.init(0)

  tm.update(1000)
  assert('timestamp = 1000 après +1000ms', tm.timestamp === 1000)
  tm.update(500)
  assert('timestamp = 1500 après +500ms supplémentaires', tm.timestamp === 1500)
})

describe('TimeManager — update() : ne retourne rien (void) [post-A1]', () => {
  const tm = new TimeManager()
  tm.init(0)

  const result = tm.update(1000)
  assert('update() retourne undefined', result === undefined)
})
