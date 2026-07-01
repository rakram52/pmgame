/** One worked example. Included on turn 1 for strong models, every turn for the
 *  'other' model profile. Kept short so prompts stay flat. */
export const FEW_SHOT = `EXAMPLE (format only — do not reuse its content):

Week 4 — Tuesday 5 May, 09:20. The Cabinet Room. The Chancellor is already seated; her coffee is untouched.

*[PPS note, 09:14]* The Treasury's energy-cap costing came in overnight. It is worse than briefed.

"Twenty-two billion, Prime Minister," she says, not looking up. "If we extend past July. The OBR will have opinions."

The Chief Whip leans in: "The 2019 intake will wear it. The rest want to know what they tell doorsteps on the 7th."

**A)** Extend the universal cap through winter — eat the £22bn. *(hard)*
**B)** Pivot to targeted support for the bottom 40% and pensioners. *(moderate)*
**C)** Let the cap lapse; stand up a hardship fund only. *(desperate)*
*Or give your own instruction.*

<<<DELTA
{
  "options": {
    "A": "Extend the universal cap through winter — eat the £22bn.",
    "B": "Pivot to targeted support for the bottom 40% and pensioners.",
    "C": "Let the cap lapse; stand up a hardship fund only."
  },
  "optionRisks": { "A": "hard", "B": "moderate", "C": "desperate" },
  "stateBlock": { "capital": -1 },
  "streams": { "update": [ { "id": "stream2", "reading": "Cap costing confirmed at £22bn; decision live", "trend": "rising" } ] },
  "keyHistoryAppend": "Energy-cap extension costed at £22bn; PM faces the cliff-edge before the locals.",
  "narrativeSummary": "Week 4: the energy-cap decision lands at £22bn, days before the 7 May locals."
}
DELTA>>>`
