# Per-Beat Accents & Practice Bar-Length Breaks — Design Spec

Date: 2026-08-31

## Purpose

Replace the single "Accent first beat" checkbox with a per-beat accent
pattern that the user sets by clicking directly on the beat-dot row, applied
consistently across all three modes. Also change Practice mode's break
duration from one beat to one full bar, and redesign the Practice readout to
show all four cycle phases at once with the active one visually emphasized.

## 1. Data Model & Persistence

- `state.metronome.accentFirstBeat` (boolean) is removed entirely, along
  with its checkbox and all wiring/persistence references.
- New shared field: `state.topBar.accentPattern` — an array of booleans,
  one entry per beat, always kept the same length as `state.topBar.timeSigNum`.
  Default: `[true, false, false, false]` (matches today's "beat 1 accented"
  default behavior at the default 4/4 time signature).
- A new pure function `resizeAccentPattern(pattern, newLength)` handles
  length changes: existing entries keep their boolean value where the index
  still exists; growing appends `false` for new beats; shrinking truncates.
  This runs whenever `timeSigNum` changes, and once defensively right after
  the app loads persisted state (in case a saved `accentPattern` and
  `timeSigNum` ever disagree — e.g. an older save, or hand-edited
  `localStorage`).
- An old save that still contains the removed `accentFirstBeat` key is
  harmless — it becomes an unused, ignored property on the in-memory state
  object, consistent with how the earlier `timeSigDen` removal was handled.

## 2. Dot Interaction & Accessibility

- Each beat dot becomes a real `<button type="button">` (not a decorative
  `<div>`), so it is natively keyboard-focusable and activatable via
  Enter/Space, in addition to click.
- Activating a dot flips that beat's entry in `accentPattern` immediately.
  This works identically whether the metronome is stopped or actively
  playing — a live edit takes effect the next time the scheduler passes
  through that beat.
- Each dot carries `aria-pressed` reflecting its current accent state, and
  an `aria-label` such as `"Beat 2, accented"` / `"Beat 2, not accented"`,
  kept in sync whenever the pattern changes.
- The dot row container's `aria-hidden="true"` (added in the previous UI
  rework, when the dots were purely decorative) is removed — the dots are
  now interactive controls and must be exposed to assistive tech.

## 3. Visual Design

- Dot diameter increases from 10px to 18px, with a proportionally larger
  gap between them. At the maximum allowed 16 beats, this still comfortably
  fits the existing 440px content width.
- An idle (not currently flashing) dot whose beat is accented gets a subtle
  `--accent-beat` red border/outline — not a filled background — so the
  accent pattern is visible at rest without competing visually with the
  actual per-beat flash.
- The existing flash states (`.pulse` for a normal beat, `.pulse.accent`
  for an accented beat, both using background-color fills) are unchanged
  and layer visually on top of the idle border with no conflict.
- The focus-visible amber ring already added to interactive controls
  extends naturally to the dots now that they are real `<button>` elements.

## 4. Practice Mode: Bar-Length Breaks

- `buildPracticePhaseSequence` gains a second parameter, `breakBeats`,
  passed by the caller as the current `state.topBar.timeSigNum` (the
  function itself stays pure/generic, with no direct dependency on global
  state). The cycle becomes:
  `[Slow × N] → [Break × breakBeats] → [Fast × N] → [Break × breakBeats] → repeat`
  where `N` is `state.practice.beatsPerPhase` as before.
- Break beats are **always unaccented**, regardless of `accentPattern` —
  the scheduler forces `accent = false` whenever the current beat falls
  inside a practice break phase, independent of what the shared accent
  pattern says for that beat position. This keeps breaks feeling like a
  distinct "rest" from the accented groove.

## 5. Accent Pattern Applies Across All Three Modes

Unlike the old checkbox (Metronome-tab only), the shared `accentPattern`
now applies during Ramp and Practice playback too (except practice break
beats, per section 4). This follows naturally from the accent pattern
living on the shared dot row rather than a per-tab control.

## 6. Practice Readout Redesign

- The current plain `"Phase: SLOW"` text is replaced with four segment
  labels always shown together: `SLOW - BREAK - FAST - BREAK`.
- The currently-active segment renders slightly larger with an amber
  (`--accent`) glow (e.g. `text-shadow`); the other three segments render
  at normal size in the muted text color.
- The readout is visible on the Practice tab at all times, including
  before the first Start — at rest, `SLOW` is highlighted as the upcoming
  first phase. Once playing, the highlighted segment tracks
  `practiceRuntime`'s actual position live.
- Since the underlying phase sequence only distinguishes `'break'` as a
  type (not "first break" vs. "second break"), the readout computes which
  of the four segments is active from position: using
  `state.practice.beatsPerPhase` (N) and `state.topBar.timeSigNum` (the
  break length, B), an index `i` into the sequence maps to segment 0
  (slow) if `i < N`, segment 1 (first break) if `i < N + B`, segment 2
  (fast) if `i < N + B + N`, else segment 3 (second break). At rest
  (before the first Start), this is computed as if `i = 0`.

## 7. Removed Checkbox Cleanup

- Delete the "Accent first beat" checkbox and its `<label>` from the
  Metronome panel.
- Remove `accentFirstBeat` from `DEFAULT_STATE.metronome`, its wiring in
  `bindMetronomeTab`, and its line in `refreshAllInputsFromState`.
- Since no checkboxes remain anywhere in the app after this removal, the
  now-dead generic `input[type="checkbox"]` styling and the
  `label:has(input[type="checkbox"])` layout override (both added in the
  previous UI-rework round) are removed as dead CSS.

## Preserved Constraints

- Still a single self-contained `metronome.html` file — no build step, no
  external fonts, no CDN links, no network calls, no new files.
- No change to any *other* existing element `id` referenced by the JS.
- `isAccentBeat`'s signature changes from `(beatIndexInBar)` to
  `(beatIndexInBar, accentPattern)` — this is a deliberate, tested change
  to an existing `LOGIC-BEGIN`/`LOGIC-END` function (unlike the UI-rework
  plan, which touched no logic functions at all); its existing test must be
  updated to match the new signature, and `buildPracticePhaseSequence`'s
  test must be updated for its new `breakBeats` parameter.
- All automated tests must pass after this change — the exact count will
  shift (one existing test updated for the new `isAccentBeat` signature,
  new tests added for `resizeAccentPattern` and the updated
  `buildPracticePhaseSequence`), but the full suite must be green.
- Run tests with `node --test tests/*.test.js` (the directory form does not
  work reliably on this Node/Windows setup).

## Out of Scope

- Any change to the Ramp mode's own settings/behavior beyond now playing
  accented beats per the shared pattern.
- Saving/loading multiple named accent patterns or presets.
- Any change to sound synthesis, subdivisions, tap tempo, or persistence
  mechanics beyond the fields explicitly listed above.

## Testing / Verification

- Automated: `node --test tests/*.test.js` must show a fully green suite
  after the rework, including updated/new tests for `isAccentBeat`,
  `resizeAccentPattern`, and `buildPracticePhaseSequence`.
- Manual (human, in a real browser — same limitation as prior rounds):
  confirm clicking/keyboard-activating dots toggles their accent
  border and produces an accented click during playback; confirm changing
  Beats per Bar resizes the pattern sensibly (preserving existing on/off
  states); confirm Ramp and Practice now play accents (except practice
  break bars, which must stay silent-of-accent even if that beat position
  is marked accented); confirm a full bar's worth of clicks plays during
  each practice break, at the slow tempo; confirm the four-segment
  Practice readout shows all four labels, highlights the correct one
  (including distinguishing the two break segments), and is visible before
  the first Start; confirm dot buttons are reachable and operable via
  Tab/Enter/Space and show a visible focus ring; confirm settings persist
  correctly across a reload including the accent pattern.
