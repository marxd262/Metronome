# Pattern Preset Roster — Design Spec

Date: 2026-09-10

## Purpose

The rhythm pattern editor ships with four presets — none, eighths,
triplets, sixteenths. Each one carries a single piece of information:
the division it sets. `buildPresetLevels` then fills every beat the
same way regardless of which preset was chosen (accent on beat 1's
first slot, normal on the other beats' first slots, quiet everywhere
else). A preset is therefore a division shortcut and nothing more.

That cannot express the rhythms a guitarist actually practises. There
is no way to pick "offbeat eighths", a gallop, a dotted-eighth figure,
or any of the truncated triplets, because every one of those is
defined by *which slots are silent*, and a preset has no way to say
that. Reaching them today means choosing a division and then clicking
individual slots to mute them, every time.

This spec grows the roster to fifteen presets, each carrying an
explicit rest pattern, and relabels the preset dropdown so each option
leads with the note glyph for its division.

## Behaviour

### A preset carries a rhythm, not just a division

`PATTERN_PRESETS` becomes a list of entries shaped
`{ name, division, glyph, label, slots }`, where `slots` is an array of
`division` entries, each `1` for a slot that sounds and `0` for a slot
that rests. The template describes **one beat**, and is repeated across
every beat of the pattern.

The fifteen presets, in the order the dropdown lists them:

| Name | Division | Glyph | Label | Slots |
|---|---|---|---|---|
| `quarter` | 1 | `♩` | Quarter | `[1]` |
| `eighths` | 2 | `♫` | Eighths | `[1,1]` |
| `offbeat-eighths` | 2 | `♫` | Offbeat eighths | `[0,1]` |
| `triplets` | 3 | `♪³` | Triplet | `[1,1,1]` |
| `triplet-first-two` | 3 | `♪³` | Triplet, first two | `[1,1,0]` |
| `triplet-outer` | 3 | `♪³` | Triplet, outer two | `[1,0,1]` |
| `triplet-last-two` | 3 | `♪³` | Triplet, last two | `[0,1,1]` |
| `triplet-middle` | 3 | `♪³` | Triplet, middle only | `[0,1,0]` |
| `sixteenths` | 4 | `♬` | Sixteenths | `[1,1,1,1]` |
| `offbeat-sixteenths` | 4 | `♬` | Sixteenth offbeats | `[0,1,0,1]` |
| `gallop` | 4 | `♬` | Gallop | `[1,1,1,0]` |
| `reverse-gallop` | 4 | `♬` | Reverse gallop | `[1,0,1,1]` |
| `sixteenth-eighth-sixteenth` | 4 | `♬` | 16th-8th-16th | `[1,1,0,1]` |
| `dotted-eighth-sixteenth` | 4 | `♬` | Dotted eighth + 16th | `[1,0,0,1]` |
| `sixteenth-dotted-eighth` | 4 | `♬` | 16th + dotted eighth | `[1,1,0,0]` |

Options are ordered by division ascending rather than by the order the
source image happened to lay them out, so the glyph column reads as
four contiguous runs instead of jumping between note values.

Two of the four old names survive unchanged (`eighths`, `sixteenths`)
and `triplets` keeps its name too, so most existing saves keep their
preset label across the upgrade. Only `none` is renamed, to `quarter`;
see *Old saves* below for what happens to a save carrying it.

### Building levels from a template

`buildPresetLevels(beats, preset)` replaces the current
`buildPresetLevels(beats, division)`. For each beat and each slot it
consults the template:

- A resting slot (`0`) becomes `LEVEL_MUTED`.
- A sounding slot (`1`) keeps the existing convention exactly:
  `defaultLevelForSlot(beat, slot)` — `LEVEL_ACCENT` for beat 0 slot 0,
  `LEVEL_NORMAL` for slot 0 of every other beat, `LEVEL_QUIET` for
  every later slot.

Four presets rest on their first slot: offbeat eighths, sixteenth
offbeats, triplet last-two, and triplet middle-only. For those, beat
1's downbeat is muted and **no accent is placed anywhere in the bar**.
The accent does
not migrate to the first slot that happens to sound. An offbeat pattern
has no downbeat click, and moving the accent onto the "and" would
misrepresent the figure — the point of practising offbeat eighths is
that the downbeat is silent. The bar start remains visible in the hero
dot row, which is unaffected by pattern levels.

`defaultLevelForSlot` is unchanged, and stays the single definition of
what a sounding slot's level is. `resizePatternLevels` continues to
call it for slots that did not exist before a resize; that behaviour is
deliberately not template-aware, because a resize is not a preset
application and should not silently mute slots the user never asked to
mute.

### Naming a pattern: presetForPattern replaces presetForDivision

`presetForDivision(division)` cannot survive the change — seven presets
share division 4, so a division no longer identifies a preset.

It is replaced by a pure function `presetForPattern(pattern)`, which
reads `beats`, `division` and `levels` from its argument, and returns
the `name` of the first preset whose `buildPresetLevels(beats, preset)`
output equals `levels` exactly, or the string `custom` when none does.

This also corrects a latent inaccuracy in the current code. Today,
typing 2 into the Division field runs `presetForDivision(2)` and labels
the pattern "Eighths", even though the levels were produced by
`resizePatternLevels` preserving whatever the user had before, and may
look nothing like an eighths pattern. Matching against the actual level
array makes the label honest in every path that sets it: preset
selection, division change, beats change, and load.

`divisionForPreset(name)` is unchanged and keeps its current contract,
returning `null` for `custom` and for any unknown name.

Cost: `presetForPattern` builds up to fifteen candidate arrays per
call. It is called on user input and on load, never from the scheduler
or the animation-frame playhead loop, so this is not on a timing path.

### Legacy subdivision names get their own map

`migrateLegacyPattern` currently derives a division from a pre-editor
save by calling `divisionForPreset(topBar.subdivision)`, relying on the
retired Subdivision `<select>` having used the same four strings as the
preset roster. That coupling is what makes renaming a preset dangerous:
`divisionForPreset('triplets')` returning `null` would silently
downgrade a legacy triplet save to division 1.

The legacy strings are now read through their own lookup,
`LEGACY_SUBDIVISION_DIVISIONS`, mapping none to 1, eighths to 2,
triplets to 3 and sixteenths to 4, with the same `|| 1` fallback for
anything unrecognised. That map describes a `<select>` that no longer
exists and must never gain entries; the preset roster is then free to
be renamed and extended without touching migration.

`migrateLegacyPattern`'s closing `presetForDivision(division)` call
becomes `presetForPattern` over the object it just built. A legacy save
with an irregular accent pattern will now be labelled Custom rather
than being given a preset name that does not describe it.

### Old saves

`normalizePattern` currently accepts any string in `source.preset`
verbatim. It now validates the name against the roster plus `custom`;
an unrecognised name falls back to `presetForPattern` over the
normalized pattern, exactly as a missing name already does.

This is what handles the one rename. A save written before this change
carries the preset name `none`, which is no longer a roster name. Left
unvalidated it would reach `select.value = 'none'`, match no option,
and leave the dropdown showing an empty box. With validation the
pattern is matched by its levels instead and the dropdown lands on
"Quarter" for an untouched default, or "Custom" if the user had edited
slots.

### The dropdown

The `<select id="patternPreset">` no longer carries hand-written
`<option>` elements. Its options are built once at startup from
`PATTERN_PRESETS`, followed by a final Custom option that is not a
roster entry. Fifteen entries duplicated between a JS array and a block
of HTML would drift; one source of truth removes that risk.

Each option's text is the preset's glyph, two spaces, then its label,
giving lines that read as "♩  Quarter", "♫  Offbeat eighths",
"♬  Gallop" and "♪³  Triplet, outer two". The Custom option carries no
glyph.

The four glyphs are U+2669, U+266B, U+266C, and U+266A followed by
U+00B3. All are ordinary Unicode in the Miscellaneous Symbols and
Latin-1 Supplement blocks, present in the default UI font on every
target platform. No webfont, no CDN, no SVG — the no-dependency
premise holds.

Division 3 uses an eighth note with a superscript three rather than a
quarter note, because a division of 3 is an eighth-note triplet.

The option list must be built before `refreshAllInputsFromState` runs,
since that function assigns `select.value` from saved state and a
`<select>` silently ignores a value with no matching option.

`setPreset(name)` keeps its current shape: `divisionForPreset`
returning `null` still means the user picked Custom, and still snaps
the control back to whatever the pattern actually is. Its
`buildPresetLevels` call passes the preset entry instead of the
division.

### What does not change

- The four levels, their gain factors, and the click-to-cycle grid.
- `PATTERN_MIN` and `PATTERN_MAX` and both clamps. Division stays a
  free numeric field accepting 1 through 64; presets are shortcuts into
  that range, not a restriction on it.
- The pattern grid, playhead, dot row, and scheduler read `division`
  and `levels` and are indifferent to how those were produced.
- Practice break beats still ignore the pattern entirely.
- Serialization: `topBar.pattern` keeps its `{ beats, division, preset,
  levels }` shape. `slots` lives only in the roster, never in state.
- No new CSS. The dropdown is the same `<select>` under the same
  `.pattern-field` rules.

## Testing

Everything in this spec except the option-building and the `<select>`
markup is pure LOGIC, and is tested in `tests/logic.test.js`:

- Roster integrity: every entry's `slots` length equals its `division`;
  every `name` is unique; no entry is named `custom`.
- `buildPresetLevels` maps rests to muted and sounding slots through
  `defaultLevelForSlot`, produces exactly `beats * division` entries,
  and places at most one accent — zero for the four rest-on-downbeat
  presets, one for the other eleven.
- `presetForPattern` round-trips: for every preset and a few beat
  counts, naming the output of `buildPresetLevels` returns that preset.
- `presetForPattern` returns `custom` for a division outside the
  roster, and for a roster division whose levels have been altered.
- `divisionForPreset` still returns `null` for `custom` and nonsense.
- `normalizePattern` replaces an unknown saved name, `none` in
  particular, with the result of `presetForPattern`, and preserves a
  known one.
- `migrateLegacyPattern` maps all four legacy subdivision strings to
  the right division, including triplets to 3.

The existing preset tests at `tests/logic.test.js` lines 364-392 and
453-456 are rewritten against the new roster; `divisionForPreset`'s
`none` assertion becomes `quarter`.

`tests/themes.test.js` is untouched — no theme tokens, no `.beat-dot`
rules, and no `.pattern-slot` rules are involved.

Manual browser verification, since the DOM half is untested by design:
the dropdown lists sixteen options with glyphs, picking each one
reshapes the grid correctly, editing a slot flips the label to Custom,
typing a division that matches a preset's shape names that preset, and
a `localStorage` blob carrying the preset name `none` loads showing
"Quarter".
