# Quick-Select Value Dropdown — Design Spec

Date: 2026-09-07

## Purpose

Every numeric field in the app (BPM, percent, time signature, bars,
break beats) currently offers exactly two ways to set a value: type it
directly into the `<input type="number">`, or drag its `±`
stepper/range-slider pair. There is no fast way to jump straight to a
commonly-used value (e.g. 120 BPM, 100%) without either remembering and
typing it or stepping/dragging there one increment at a time. This spec
adds a third input mode — a quick-select popup listing a short set of
common values per field — without removing or changing the existing two.

## Behavior

Every numeric field's stepper row gains one new control: a small
chevron toggle button (`▾`), placed immediately after the number input,
visually matching the existing `.step-btn` treatment:

```
[−5] [−1]   120 ▾   [Tap]   [+1] [+5]
```

Clicking (or activating via keyboard) the chevron opens a popup listbox
anchored directly below the number input:

```
┌──────────┐
│   80     │
│   100    │
│  [120]   │  <- current value, highlighted, aria-selected="true"
│   140    │
│   160    │
└──────────┘
```

- **List contents:** a fixed, per-field preset array (below) plus, if
  the field's current value is not already in that array, the current
  value inserted at its sorted position. The list is recomputed every
  time the popup opens — it is never persisted or user-editable.
- **Selecting a value:** calls the same `setXxx()` function the number
  input's `change` handler already calls (e.g. `setBpm`), so clamping,
  clamp-flash, `persistState()`, and hero-BPM/readout updates are
  reused exactly as they exist today — no parallel code path. The popup
  then closes and focus returns to the number input.
- **The number input and range slider are unchanged** — typing and
  dragging keep working exactly as they do now. The chevron is strictly
  additive.

### Interaction and accessibility

Standard "listbox popup button" ARIA pattern:

- Toggle button: `type="button"`, `aria-haspopup="listbox"`,
  `aria-expanded` (kept in sync with open state).
- Popup: `role="listbox"`; each row `role="option"` with
  `aria-selected` set on the current/highlighted row only.
- Keyboard on the toggle button: `Enter`/`Space`/`ArrowDown` opens the
  popup with the current-value row focused/highlighted.
- Keyboard while open: `ArrowDown`/`ArrowUp` moves the highlighted row
  (no wraparound), `Enter` selects the highlighted row, `Escape` closes
  without changing the value and returns focus to the toggle button.
- Mouse: clicking outside the open popup closes it without changing the
  value. Clicking a row selects it.
- On open, if the list overflows its max height, it scrolls so the
  highlighted (current-value) row is centered in the visible area —
  this is what makes "the current value sits in the middle" true both
  logically (sorted neighbors on each side) and visually (scroll
  position) whenever the field isn't at the extreme edge of its range.
- Only one popup is open at a time; opening one closes any other that
  was already open.

### Preset values per field

| Field(s) | Valid range | Presets |
|---|---|---|
| `metronomeBpm`, `rampStartBpm`, `rampStopBpm`, `practiceBaseBpm` | 20–400 | 40, 60, 80, 100, 120, 140, 160, 180, 200 |
| `metronomePercent` | 50–150 | 50, 70, 85, 100, 115, 130 |
| `practiceDeltaPercent` | 10–90 | 20, 35, 50, 65, 80 |
| `rampScaleAmount` | > 0 | 1, 2, 3, 5, 10 |
| `metronomeTimeSig`, `rampTimeSig`, `practiceTimeSig` | 1–16 | 2, 3, 4, 5, 6, 8 |
| `rampStepBars`, `practiceBarsPerPhase` | positive int | 1, 2, 4, 8 |
| `practiceBreakBeats` | positive int | 2, 4, 8, 16 |

`metronomePercent` and `practiceDeltaPercent` are visually similar
("percent") fields but have different ranges and different centers (100
vs. 50 respectively) — they get distinct preset arrays, not a shared
one.

## Implementation Notes

- **New pure LOGIC function:** `buildQuickSelectValues(presets,
  currentValue)` — takes a preset array and the field's current value,
  returns the sorted array with the current value inserted if it isn't
  already present (de-duplicated if it already matches a preset
  exactly). Pure function of its arguments, belongs in the
  `LOGIC-BEGIN`/`LOGIC-END` block with unit tests in
  `tests/logic.test.js` (mirroring how `resizeAccentPattern` is
  tested).
- **New app-block component:** one small reusable function (e.g.
  `attachQuickSelect(inputEl, presets, setter)`) that builds the
  chevron button + popup markup, wires open/close/keyboard/click-outside
  handling, and calls `setter(value)` on selection. Called once per
  field, from each tab's existing `bindMetronomeTab`/`bindRampTab`/
  `bindPracticeTab` functions, passing that field's existing `setXxx`
  closure as the setter — no new state object, no changes to `state`'s
  shape, no changes to `persistState`/`deserializeSettings`.
- **CSS:** new rules for `.quick-select-toggle` (matching `.step-btn`
  sizing/hover/active states) and `.quick-select-popup`/`.quick-select-option`
  (popup positioning, scrolling, current-value highlight), added
  alongside the existing stepper/field-group styles. No new CSS custom
  properties are needed beyond existing tokens (`--accent`, `--panel`,
  `--divider`, spacing scale).
- This is pure UI-input surface — it does not touch the scheduler,
  `scheduleBeat`, `state.topBar.activeTab` dispatch, or any mode
  runtime, so none of the capture-before-advance concerns in
  CLAUDE.md apply.

## Preserved Constraints

- Still a single self-contained `index.html` file — no build step, no
  external files, no new dependency.
- No change to any existing `LOGIC-BEGIN`/`LOGIC-END` function or any
  existing test; only a new pure function and new tests are added.
- No change to `state`'s shape, `persistState`, or
  `deserializeSettings` — preset lists are static data in the app block,
  not part of saved settings.
- No change to existing number-input or range-slider behavior for any
  field.

## Out of Scope

- User-customizable or persisted preset lists.
- Any change to `tapTempo`, stepper `±` buttons, or the range sliders.
- Any change to the accent-pattern beat-dot editor (`renderBeatDots`,
  `toggleAccent`) — unrelated control, not touched by this feature.
- Touch/mobile-specific gestures beyond standard tap-to-open,
  tap-to-select, tap-outside-to-close (already covered by the click
  handling above).

## Testing / Verification

- Automated: `node --test tests/*.test.js` must show the full suite
  (41 existing + new cases for `buildQuickSelectValues`) passing.
- Manual (human, in a real browser): for at least one field of each
  range shape (a BPM field, both percent fields, a time-sig field, a
  bars/break-beats field) — confirm the chevron opens the popup with
  the current value highlighted, arrow keys move the highlight, Enter
  selects and closes, Escape closes without changing the value,
  clicking outside closes without changing the value, selecting a value
  updates the number input/range slider/hero BPM exactly as typing that
  value would, and that opening one field's popup closes any other
  open popup. Also confirm the existing number-input typing and
  range-slider dragging are completely unaffected on every field.
