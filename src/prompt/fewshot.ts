/** One worked example. Included on turn 1 for strong models, every turn for the
 *  'other' model profile. Models the target RICHNESS as well as the format —
 *  stakes, continuity, characterful staging, consequence, then the decision. */
export const FEW_SHOT = `EXAMPLE (format & RICHNESS to match — do not reuse its content):

Week 4 — Tuesday 5 May 2026, 09:20. Two days to the locals, and the coldest number in Westminster this morning isn't in the polls — it's in a Treasury spreadsheet nobody was meant to see yet.

WEEK SO FAR
- The energy-cap costing you commissioned last week came back overnight, and it's worse than the line the Chancellor gave the House: not £15bn, but £22bn to hold bills through winter.
- Reform spent the weekend on the doorsteps you're about to lose, promising exactly the cap you can't afford.
- A Number 11 aide has already been overheard calling it "the PM's bill, not ours" — the Treasury is pre-writing the story where this goes wrong.
- The 2019 intake is holding; everyone else wants a doorstep answer by Thursday.

The Cabinet Room. Rachel Beaumont has her coffee untouched and her red folder closed — never a good sign.

*[PPS note, 09:14]* Chancellor briefed the lobby "no unfunded commitments" at 8. If you extend, she's on record against you before you've decided.

Beaumont (finally looking up): "Twenty-two billion, Prime Minister. I can find it. I can't find it *and* keep the fiscal rules *and* keep the markets calm two days before you ask the country to trust us with the councils. Pick two."

Dolan (quieter): "The benches will wear the money. What they won't wear is finding out from the *Mail* that we dithered."

Whatever you choose is a story by tonight — the only question is whose.

**A)** Extend the universal cap through winter — eat the £22bn, dare the markets. *(hard)*
**B)** Pivot to targeted support for the bottom 40% and pensioners — defensible, dull. *(moderate)*
**C)** Let the cap lapse; stand up a hardship fund only — hold the line, own the pain. *(desperate)*
*Or give your own instruction.*

<<<DELTA
{
  "options": {
    "A": "Extend the universal cap through winter — eat the £22bn, dare the markets.",
    "B": "Pivot to targeted support for the bottom 40% and pensioners.",
    "C": "Let the cap lapse; stand up a hardship fund only."
  },
  "optionRisks": { "A": "hard", "B": "moderate", "C": "desperate" },
  "stateBlock": { "capital": -1 },
  "streams": { "update": [ { "id": "stream2", "reading": "Cap costing confirmed at £22bn; Chancellor on record against; decision live", "trend": "rising" } ] },
  "keyHistoryAppend": "Energy-cap extension costed at £22bn; Chancellor briefs against it two days before the locals.",
  "narrativeSummary": "Week 4: the £22bn energy-cap decision lands days before the 7 May locals, with the Treasury already distancing itself."
}
DELTA>>>`
