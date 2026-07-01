import type { Rng } from './rng'

/** The d8 random-event table lives in code, so events can never be forgotten,
 *  duplicated at random, or invented by the model. Categories mirror v15. */
export const EVENT_TABLE: { category: number; title: string; directive: string }[] = [
  { category: 1, title: 'Economic shock', directive: 'An economic shock breaks this week — a gilt lurch, a bank wobble, a surprise inflation print, or a firm collapsing. Weave it in; it should bite the state block.' },
  { category: 2, title: 'Security / terror incident', directive: 'A security or terror incident occurs. Scale it realistically; COBRA may be convened. The threat level and Home Office come into play.' },
  { category: 3, title: 'Cabinet leak or resignation', directive: 'A cabinet leak or resignation threat lands. One of the standing cast is the source or the casualty — pick the one whose agenda fits and whose standing is weakest.' },
  { category: 4, title: 'Foreign crisis', directive: 'A foreign crisis flares — a bilateral relationship under stress escalates, or a new flashpoint opens. Drive it through the realist engine.' },
  { category: 5, title: 'Personal scandal', directive: 'A personal scandal surfaces around a minister or ally. It may connect to a buried-but-live item if one fits.' },
  { category: 6, title: 'NHS or prisons collapse', directive: 'A public-services breaking point — an NHS trust in crisis or prisons hitting hard capacity. Ties to the relevant stream.' },
  { category: 7, title: 'Royal or constitutional', directive: 'A royal or constitutional wrinkle — the Andrew Mountbatten-Windsor legislation, a Palace briefing, a Lords or devolution clash.' },
  { category: 8, title: 'Climate / weather', directive: 'A climate or severe-weather event — flooding, a heat emergency, an energy-grid strain intersecting the Iran energy shock.' },
]

/** World-variance d6: a small mood nudge the model must colour the scene with. */
export const WORLD_VARIANCE: { roll: number; label: string; directive: string }[] = [
  { roll: 1, label: 'hostile press', directive: 'Colour: hostile press cycle — the lobby is hunting, front pages unfriendly.' },
  { roll: 2, label: 'markets jittery', directive: 'Colour: markets jittery — traders twitchy, any signal moves gilts and sterling.' },
  { roll: 3, label: 'backbenches restive', directive: 'Colour: backbenches restive — the WhatsApp groups are busy, whips uneasy.' },
  { roll: 4, label: 'quiet week', directive: 'Colour: a genuinely quiet week — rare breathing room; do not manufacture a crisis.' },
  { roll: 5, label: 'favourable coverage', directive: 'Colour: favourable coverage — a sympathetic splash, the mood a shade warmer.' },
  { roll: 6, label: 'momentum', directive: 'Colour: momentum — things breaking the PM’s way, allies emboldened.' },
]

export function rollWorldVariance(rng: Rng): { roll: number; label: string; directive: string } {
  const roll = rng.d(6)
  const row = WORLD_VARIANCE[roll - 1]
  return { roll, label: row.label, directive: row.directive }
}

/** Every 3rd turn: roll d8 trigger; on 6+ an event fires. Category is a second
 *  draw, never repeating the previous event's category. */
export function maybeRollEvent(
  rng: Rng,
  turnIndex: number,
  lastCategory: number | null,
): { roll: number; category: number; title: string; directive: string } | null {
  if (turnIndex % 3 !== 0) return null
  const trigger = rng.d(8)
  if (trigger < 6) return null
  let category = rng.d(8)
  let guard = 0
  while (category === lastCategory && guard < 8) {
    category = rng.d(8)
    guard++
  }
  const row = EVENT_TABLE[category - 1]
  return { roll: trigger, category, title: row.title, directive: row.directive }
}
