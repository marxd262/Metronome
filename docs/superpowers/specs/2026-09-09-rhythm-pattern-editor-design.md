# Rhythm Pattern Editor — Design Spec

Date: 2026-09-09

## Purpose

Rhythm is currently expressed through three separate, coarse controls:

- A top-bar `Subdivision` `<select>` with four fixed choices (none,
  eighths, triplets, sixteenths), global to all modes.
- A `Beats per Bar` numeric field, duplicated in each of the three mode
  panels (`metronome.timeSigNum`, `ramp.timeSigNum`,
  `practice.timeSigNum`).
- A clickable beat-dot row that toggles a per-beat boolean accent
  (`accentPattern`), also duplicated per mode.

That model can express "4 beats, sixteenths, accent on beat 1" and very
little else. Subdivisions are always audible at a fixed volume, always
unaccented, and cannot be silenced individually. A beat is either
accented or not — there is no way to make one softer than another, and
no way to drop one entirely.

This spec replaces all three controls with a single shared **rhythm
pattern editor**: a preset dropdown, a free-input beats field, a
free-input division field, and a grid in which every individual slot —
beat or subdivision — carries one of four levels: muted, quiet, normal,
accented.

## Behavior

### One shared pattern

The pattern is a single object on `state.topBar`, used by all three
modes. This follows the precedent already set by `subdivision`,
`soundStyle` and `volume`, which are top-bar settings shared across
modes. Switching tabs no longer changes the meter.

The per-mode `timeSigNum` and `accentPattern` fields are removed.

### The editor's place on the page

The editor is its own bordered section (`#patternEditor`) sitting
between `#heroZone` and the active mode panel. It is not inside a mode
panel, because it is not per-mode.

It is **collapsible**. The header row (preset, beats, division, slot
count, and a hide/show toggle) is always visible; the grid folds away.
Collapsed state persists with the rest of the settings. This exists so
a user who only wants the hero readout is not forced to look at a grid
they are done editing — see Preserved Constraints, principle 3.

The hero's beat-dot row (`#beatIndicator`) keeps showing one dot per
beat as a playback position indicator, but **loses its click
handling**. Accent editing now lives in the grid. `renderBeatDots`,
`toggleAccent` and `updateAccentDotStyles` are replaced accordingly.

The dot row now sizes from `state.topBar.pattern.beats`, which can
reach 64. The dots wrap and the existing every-fourth-dot grouping
margin keeps a long row countable; no cap is applied, because a
truncated position indicator would lie about where the beat is.

### Header controls

```
Preset            Beats        Division
[ Sixteenths ▾ ]  [ 4 ▾ ]      [ 4 ▾ ]      16 slots   [ Hide ▴ ]
```

- **Preset** — a `<select>` with `None`, `Eighths`, `Triplets`,
  `Sixteenths`, `Custom`. The first four correspond to divisions 1, 2,
  3 and 4 — the same set the removed `Subdivision` select offered.
- **Beats** — a numeric input with the existing quick-select chevron
  (`attachQuickSelect`) and `±` steppers. Free input, range 1–64.
- **Division** — same treatment. Free input, range 1–64. This is what
  makes quintuplets, septuplets and anything else reachable; the
  presets are shortcuts, not the limit.

Both numeric fields are already "comboboxes" in the sense the request
asks for: `attachQuickSelect` pairs a freely typed number input with a
chevron listing presets merged with the current value. Reusing it means
clamping, clamp-flash, keyboard handling and the single-open-popup rule
all come for free.

Out-of-range typed values clamp and flash exactly as every other
numeric field in the app does (`wasValueClamped` → `flashClamped`).

### What a preset does

Choosing a preset sets `division` **and regenerates every level**:

- Slot 0 of beat 1 → accented
- Slot 0 of every other beat → normal
- Every other slot → quiet

It leaves `beats` alone. Presets describe how a beat is divided, not
how long a bar is.

Editing any slot, or setting a division no preset names, switches the
preset label to `Custom` without altering the grid.

### The grid

One row per beat, one slot per division within the beat. Row labels are
the beat numbers.

Each slot is a button cycling **forward** on click and **backward** on
shift-click:

```
muted → quiet → normal → accented → muted
```

Levels are distinguished by fill size as well as colour, so they remain
readable without colour vision:

| Level    | Appearance                        |
|----------|-----------------------------------|
| Muted    | dashed outline, no fill           |
| Quiet    | small fill, de-emphasised colour  |
| Normal   | medium fill, foreground colour    |
| Accented | large fill, accent colour + ring  |

The first slot of each beat is marked so beat boundaries stay visible
at high divisions.

### How levels sound

| Level    | Gain                        | Pitch            |
|----------|-----------------------------|------------------|
| Muted    | no audio node created       | —                |
| Quiet    | 0.4 × volume                | non-accent       |
| Normal   | 0.7 × volume                | non-accent       |
| Accented | 1.0 × volume                | accent frequency |

These are exactly today's three gain factors (subdivision 0.4,
unaccented beat 0.7, accent 1.0), so nothing about the existing sound
changes for a pattern that mirrors today's defaults. Accented keeps the
higher `soundFrequency` so an accent stays a recognisably different
click, not merely a louder one — this is the timbral cue that survives
a loud room.

**Muted schedules nothing at all**, rather than scheduling silence.
This is what makes wide grids practical: a mostly-muted 64×64 pattern
costs almost nothing.

### Playback feedback

While playing, the grid shows a playhead: the currently sounding slot
is ringed, and its beat's row is outlined. Unedited slots dim slightly
so the playhead reads clearly.

The grid stays **fully editable and fully exposed to assistive tech**
while playing — unlike the practice progress dots, which are
non-interactive decoration and are therefore `aria-hidden`. Slots here
are real controls, and hiding focusable controls from assistive tech is
a defect, not a courtesy. The playhead is a class swap on an existing
button, which announces nothing on its own; no `aria-live` region is
introduced, so a screen reader user hears silence from the moving
highlight rather than 128 announcements a second.

The playhead **never auto-scrolls**. A grid that jumps while the user
is playing is worse than one they scroll themselves.

The hero dot row, the hero BPM number, and the ramp/practice readouts
are unchanged — they still update once per beat.

### At the top of the range

64 beats × 64 division is 4096 slots. At 120 BPM that is roughly 128
clicks per second, well past the point where 50 ms click envelopes
merge into a buzz, and past what 60 fps can distinctly show. The
design permits it and degrades honestly rather than picking an
arbitrary lower cap:

- Slots render at full size up to 128 total slots and at a compact
  size above that, and the grid scrolls (both axes) inside a box
  capped at roughly 40% of the viewport height, so the Start button is
  never pushed off screen at any setting.
- The grid is built in a single `DocumentFragment` pass with **one
  delegated click listener** on the container. 4096 elements is
  tractable; 4096 listeners is not.
- The playhead shows whatever slot is current at each animation frame.
  Above ~60 slots per second it necessarily shows a subset. It never
  falls behind, because it reads the clock rather than replaying a
  queue.

### Practice breaks

Break beats ignore the pattern entirely: one normal-level click per
beat, no subdivisions. This is a deliberate change from today (where
break beats currently do sound their subdivisions, only never
accented). It maximises the audible contrast between playing and
resting, which is the whole point of a break.

## Implementation Notes

### State shape

`DEFAULT_STATE.topBar` gains:

```js
pattern: {
  beats: 4,
  division: 1,
  preset: 'none',
  levels: [3, 2, 2, 2],   // length === beats * division
},
patternEditorOpen: true,
```

and loses `subdivision`. Each mode section loses `timeSigNum` and
`accentPattern`.

Levels are integers behind named constants
(`LEVEL_MUTED = 0`, `LEVEL_QUIET = 1`, `LEVEL_NORMAL = 2`,
`LEVEL_ACCENT = 3`), not strings. At the top of the range the array is
4096 entries and is written to `localStorage` on every edit; integers
keep that at a few kilobytes where names would be tens.

The array is flat, indexed `beat * division + slot`, matching the flat
boolean `accentPattern` it replaces.

### Migration from existing saves

`deserializeSettings` merges each saved *section* over
`DEFAULT_STATE`, so a save written before this change simply has no
`topBar.pattern` and would silently receive the default 4/1 pattern —
discarding the meter and accents the user had set.

A pure function `migrateLegacyPattern(parsed, defaults)` runs during
load when `parsed.topBar.pattern` is absent:

- `division` ← from `parsed.topBar.subdivision`
  (`none`→1, `eighths`→2, `triplets`→3, `sixteenths`→4)
- `beats` ← `parsed.metronome.timeSigNum`
- `levels` ← accented where `parsed.metronome.accentPattern[beat]` is
  true, normal on other beats' first slots, quiet on all other slots
- `preset` ← the preset name matching the resolved division

Metronome is the source for beats and accents because three per-mode
patterns are collapsing into one, and Metronome is the tab a user is
most likely to have configured.

Removed fields (`subdivision`, `timeSigNum`, `accentPattern`) are left
in the saved blob as unused properties, which is the accepted behaviour
across previous field removals in this project.

### New pure LOGIC functions

All of the following go inside the `LOGIC-BEGIN`/`LOGIC-END` block, as
pure functions of their arguments, with tests in `tests/logic.test.js`:

| Function | Responsibility |
|---|---|
| `patternSlotCount(beats, division)` | `beats * division` |
| `patternSlotIndex(beat, slot, division)` | flat index arithmetic |
| `clampPatternBeats(value)` | 1–64, integer |
| `clampPatternDivision(value)` | 1–64, integer |
| `divisionForPreset(preset)` | preset name → division, or null |
| `presetForDivision(division)` | division → preset name or `custom` |
| `buildPresetLevels(beats, division)` | the accented/normal/quiet layout |
| `resizePatternLevels(levels, oldBeats, oldDiv, newBeats, newDiv)` | preserve by position, pad with defaults, truncate on shrink |
| `cyclePatternLevel(level, direction)` | forward/backward wrap through the four levels |
| `levelGainFactor(level)` | 0 / 0.4 / 0.7 / 1.0 |
| `levelIsAccent(level)` | accent pitch selection |
| `slotIntervalSeconds(bpm, division)` | replaces `subdivisionIntervalSeconds` |
| `migrateLegacyPattern(parsed, defaults)` | described above |
| `findPlayheadEntry(entries, now, runId, generation)` | the playhead scan, described below |

Removed from the LOGIC block, along with their tests:
`subdivisionCount`, `subdivisionIntervalSeconds`, `isAccentBeat`,
`resizeAccentPattern`.

`buildQuickSelectValues` gains two entries in `QUICK_SELECT_PRESETS`:

```js
patternBeats:    [2, 3, 4, 5, 6, 7, 8, 12, 16],
patternDivision: [1, 2, 3, 4, 5, 6, 8],
```

### Audio scheduling

`scheduleBeat` keeps its structure and its position as the scheduler's
unit of work. The change is inside it:

```js
// before: one accent-or-not click, then a loop of silent subdivisions
// after:  one pass over this beat's slots, each at its own level
for (let s = 0; s < division; s++) {
  const level = isPracticeBreak
    ? (s === 0 ? LEVEL_NORMAL : LEVEL_MUTED)
    : levels[patternSlotIndex(beatIndex, s, division)];
  if (level === LEVEL_MUTED) continue;
  scheduleClick(time + slotInterval * s, level);
}
```

`scheduleClick(time, accent, isSubdivision)` becomes
`scheduleClick(time, level)`. This collapses two booleans that could
contradict each other (an accented subdivision was expressible but
meaningless) into one value that cannot.

`beatIndexInBar` now wraps on `state.topBar.pattern.beats`.

### The playhead: a second timing mechanism, and its boundary

This feature adds the first visual feedback in the app that fires
*between* beats. It deliberately does **not** use the deferred
`setTimeout` callback pattern that per-beat feedback uses, because at
128 slots per second, timer callbacks queue up rather than skip, and a
backlog of them would drag the highlight behind the audio.

Instead:

1. As it schedules each slot, `scheduleBeat` pushes a record into a
   fixed-size ring buffer: `{ time, slotIndex, runId, generation }`.
   **Muted slots are pushed too** — the playhead should visibly travel
   through silence.
2. A single `requestAnimationFrame` loop runs while and only while
   `isPlaying`. Each frame it reads `audioCtx.currentTime` and calls
   `findPlayheadEntry` to get the newest record already in the past.
   If that slot differs from the currently highlighted one, it moves a
   class.

Three guards, each closing a failure class this project has already
hit at least once:

- **Run identity.** `playbackRunId` increments in `startPlayback`.
  Records from an earlier run are ignored, so stopping and starting a
  new run cannot leave the previous run driving the highlight. This is
  the object-identity check that `practiceRuntime` uses, expressed as a
  counter.
- **Pattern generation.** `patternGeneration` increments whenever
  `beats` or `division` changes. Editing the grid mid-playback
  invalidates in-flight records rather than lighting a slot index that
  now means something else.
- **Time, not intent.** The loop renders only records whose scheduled
  time has already passed, so the playhead can never run ahead of the
  audio (principle 4).

The loop is cancelled in `stopPlayback`, which also clears the
highlight. `switchTab` already stops playback, so a mode switch is
covered by the same path.

`findPlayheadEntry` is a pure function so the one genuinely subtle
piece of this feature is unit-testable rather than browser-only.

**The boundary to document in CLAUDE.md:** per-*beat* feedback (hero
dots, hero BPM, ramp/practice readouts) continues to use the
capture-before-advance deferred-callback pattern. Per-*slot* feedback
(the grid playhead only) uses the ring buffer and animation frame loop.
Nothing should be added to the second mechanism that a beat-rate
callback can serve.

### Accepted limits

- A level edited mid-playback takes effect within about one beat, since
  up to a beat of audio is already scheduled. Beats/division edits take
  effect at the next beat boundary and clear the playhead for one
  frame.
- Above roughly 60 slots per second the playhead shows a subset of
  slots. The audio is unaffected.

### Mode integration

- `barsToBeats(bars, timeSigNumerator)` is unchanged; its call sites in
  `advanceModeAfterBeat` and `startPlayback` now pass
  `state.topBar.pattern.beats`.
- Practice progress dots remain per beat and are unaffected.
- The `Beats per Bar` field, its steppers and its quick-select are
  removed from all three panels, together with `setTimeSig` in each
  `bind*Tab()`.
- `bindTopBar`'s subdivision handler is removed; a new `bindPatternEditor()`
  owns the three header controls, the collapse toggle, and the grid's
  single delegated listener.

### CSS and the theme contract

All new rules go in `@layer components`. Slots use a new class
(`.pattern-slot`), deliberately **not** `.beat-dot`, so the locked
`.beat-dot` transition rule and the stuck-`.pulse` hazard behind it do
not apply here.

The playhead adds and removes a class from an animation frame and does
**not** depend on `transitionend` to clean itself up, so it cannot get
stuck the way beat dots once did.

The editor is styled with tokens the five themes already define
(`--dot-idle`, `--dot-accent`, `--accent-500`, surface and border
tokens), plus size and fill differences. **No new entries are added to
`REQUIRED_TOKENS`**, so all five themes get a coherent editor without
each needing a new token block. Per-theme editor overrides are possible
later but are not required now.

## Preserved Constraints

- **Single file, no build, no dependencies, no network.** Everything
  lands in `index.html`.
- **Principle 1, the glance beats the click.** The hero readout is
  untouched. The editor sits below it and can be collapsed entirely.
- **Principle 3, minimal by subtraction.** This adds one section but
  removes a top-bar select and three duplicated numeric fields, and the
  one section it adds collapses.
- **Principle 4, the beat must never lie.** The playhead renders only
  slots the audio clock says have already sounded, and stops with
  playback. Per-beat feedback keeps its existing capture-before-advance
  discipline unchanged.
- **Backward compatibility.** Old saves are migrated rather than reset.
- **Theme layer order.** Every new rule is layered; no unlayered rule
  is introduced.

## Out of Scope

- **Per-beat division.** Division is uniform across the bar. Mixed and
  additive meters (beat 1 in triplets, beat 2 in sixteenths) are a
  possible later feature; the flat level array and the slot-index
  helpers do not preclude it, but nothing here anticipates it.
- **Per-mode pattern overrides.** One shared pattern, deliberately.
- **Named meter presets** (waltz, shuffle, 6/8 compound). Presets set
  division only, matching today's subdivision roster.
- **Saving or naming multiple patterns.** One pattern at a time.
- **Per-slot pitch or sound-style selection.** Level controls gain, and
  accent additionally selects the existing accent pitch. Nothing else.
- **Undo.** Consistent with the rest of the app, which has none.
- **Per-theme editor styling.** Shared tokens only, for now.

## Testing / Verification

### Automated (`node --test tests/*.test.js`)

New coverage in `tests/logic.test.js`:

- Slot count and flat index arithmetic across several divisions.
- Beats and division clamping at 0, 1, 64, 65 and non-numeric input.
- `buildPresetLevels` places exactly one accent, at slot 0 of beat 1.
- `resizePatternLevels`: growing beats pads with a normal downbeat and
  quiet subdivisions; growing division pads quiet; shrinking either
  truncates without disturbing surviving positions; a same-size call is
  the identity.
- `cyclePatternLevel` wraps correctly in both directions.
- `levelGainFactor` and `levelIsAccent` return today's values, so the
  existing sound is provably unchanged for an equivalent pattern.
- `divisionForPreset` / `presetForDivision` round-trip for the four
  presets and return `custom` for anything else.
- `migrateLegacyPattern`: each of the four legacy subdivision names; a
  legacy accent pattern maps to accented slots at the right indices; a
  save that already has a pattern is left alone; a malformed or absent
  legacy section falls back to defaults.
- `findPlayheadEntry`: returns the newest past record; returns nothing
  when all records are in the future; ignores records from a stale
  `runId`; ignores records from a stale `generation`; handles an empty
  buffer and a wrapped ring.

In `tests/themes.test.js`:

- Every `.pattern-slot` rule sits inside a cascade layer.
- `REQUIRED_TOKENS` is unchanged and all five themes still pass.

### Manual (human, in a real browser)

1. Default load with no saved settings gives 4 beats, division 1,
   accent on beat 1 — audibly identical to today's default.
2. Load with an existing pre-change `localStorage` blob: meter,
   subdivision and accents are carried over, not reset.
3. Each preset sets the expected division and relevels the grid; then
   editing one slot flips the label to Custom without changing the
   grid.
4. Typing 7 into division produces septuplets that stay in time with
   the beat; typing 100 clamps to 64 and flashes.
5. All four levels are audibly distinct, and a muted slot is silent.
6. The playhead tracks the audio at 4×4 and stays in step at 7×5.
7. Stop and immediately restart: no highlight from the previous run
   survives, and no slot keeps a stuck highlight.
8. Change beats and division mid-playback: the grid re-renders and the
   playhead resumes on the new grid without highlighting a wrong slot.
9. Collapse the editor and play: hero dots, hero BPM and readouts all
   behave exactly as before; collapsed state survives a reload.
10. Practice mode: phases play the pattern, breaks play a plain count
    with no subdivisions, and progress dots behave as they do today.
11. Ramp mode: bars-per-step now spans the shared beats count, and
    tempo steps land on bar boundaries.
12. All five themes: the editor is legible in each, the clamp flash
    still fires on the beats and division fields, and beat dots still
    pulse without sticking.
13. Keyboard: the grid is reachable and operable, slot labels announce
    beat, position and level, and slots stay operable while playing
    without the moving playhead producing any announcements.
14. Render cost at 64×64: note whether the grid build stutters. If it
    does, cap the rendered grid size and leave the audio uncapped.
