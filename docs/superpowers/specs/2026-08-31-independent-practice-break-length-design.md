# Independent Practice Break Length — Design Spec

Date: 2026-08-31

## Purpose

Practice mode's break duration currently equals "Beats per Bar" (the
shared top-bar time signature), added in an earlier round. This spec
decouples break length into its own setting so it can be tuned
independently of the time signature.

## Data Model & Persistence

- New field: `state.practice.breakBeats` (positive integer, no upper
  bound — same validation style as `state.practice.beatsPerPhase`).
- `DEFAULT_STATE.practice.breakBeats` is `4`, matching
  `DEFAULT_STATE.topBar.timeSigNum`'s default of `4` — a fresh install
  sees the same starting numbers as before this change. (An existing save
  from before this field existed will pick up this same `4` default on
  first load after upgrading, regardless of that user's actual saved time
  signature — a one-time, low-stakes default they can adjust once; no
  migration logic beyond the existing `deserializeSettings` merge is
  needed.)

## UI

- New number input, labeled "Break Length (beats)", placed on the
  Practice panel immediately after "Beats per Phase" and before the
  existing readout. Same input style/validation as `beatsPerPhase`
  (`min="1"`, `step="1"`, clamped via the existing `clampPositiveInt`
  pure function on change).

## Behavior Change

Every place that currently reads `state.topBar.timeSigNum` to determine
Practice's break length instead reads `state.practice.breakBeats`:

- The call to `buildPracticePhaseSequence(beatsPerPhase, breakBeats)` in
  `startPlayback` passes `state.practice.breakBeats` instead of
  `state.topBar.timeSigNum`.
- The `practiceRuntime.breakBeats` snapshot (taken at Start, so a
  mid-run edit to either "Beats per Phase" or the new "Break Length"
  field doesn't desync the readout from what's actually playing — the
  same snapshot mechanism added in the prior round for exactly this
  reason) is set from `state.practice.breakBeats` instead of
  `state.topBar.timeSigNum`.

No change to the pure `buildPracticePhaseSequence` or `practiceSegmentIndex`
functions themselves — both already accept break length as a plain
parameter; only which state field feeds that parameter changes. No
existing test needs to change as a result.

## Preserved Constraints

- Still a single self-contained `metronome.html` file — no build step, no
  external files.
- Break beats remain always unaccented and always played at the slow
  tempo — unaffected by this change.
- "Beats per Bar" continues to govern accent-pattern length, bar-based
  Ramp step length, and the beat-dot row count, exactly as before — this
  change only removes its (secondary, previously implicit) role in
  determining Practice's break length.

## Out of Scope

- Any change to Ramp mode's step-length-in-bars behavior (still tied to
  "Beats per Bar", unaffected).
- Any change to the accent pattern, beat-dot row, or the four-segment
  readout's visual design.

## Testing / Verification

- Automated: `node --test tests/*.test.js` must show the full suite
  (currently 35 tests) still passing, unmodified, after this change.
- Manual (human, in a real browser): confirm the new field appears in the
  right place with correct validation; confirm setting Break Length to a
  value different from Beats per Bar produces a break of that length, not
  the time-signature length; confirm settings persist across reload;
  confirm no regression in the rest of Practice mode (phase readout,
  accent suppression during breaks, slow-tempo break beats) or in any
  other mode.
