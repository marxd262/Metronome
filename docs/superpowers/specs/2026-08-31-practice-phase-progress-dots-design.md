# Practice Phase-Progress Dots — Design Spec

Date: 2026-08-31

## Purpose

Practice mode's beat-dot row currently always shows "Beats per Bar" dots
and always represents position within the bar (the same as Metronome and
Ramp), even while playing. Now that Practice's phase lengths (Beats per
Phase, Break Length) are independently configurable and don't necessarily
match "Beats per Bar", that bar-position display no longer corresponds to
anything meaningful during Practice playback — a phase's beats don't line
up with a fixed bar-relative position. This spec makes the Practice tab's
dot row show progress through the *current phase* instead, while playing.

## Behavior

- **Metronome and Ramp tabs:** completely unchanged. Dot row is always
  "Beats per Bar" dots, click-to-toggle accent editor, flashes bar
  position during playback — anytime, stopped or playing.
- **Practice tab, stopped:** dot row is the same accent editor as every
  other tab ("Beats per Bar" dots, clickable). This is the *only* time
  accent-pattern editing is available while the Practice tab is active.
- **Practice tab, playing:** the same physical dot row switches to a
  **phase-progress** display:
  - Dot count matches the *current phase's* length: `beatsPerPhase` during
    SLOW or FAST, `breakBeats` during either BREAK.
  - The row resizes automatically at each phase transition.
  - Dots are not interactive (no click-to-toggle) while in this state.
  - During SLOW/FAST, a flashing dot shows accent coloring (the reserved
    accent-beat red) if that specific beat is accented per the shared
    accent pattern — otherwise the normal amber flash.
  - During BREAK, no dot ever shows accent coloring, matching the existing
    rule that breaks are always unaccented regardless of the pattern.
- **Pressing Stop (or switching away from the Practice tab while
  playing):** the dot row immediately reverts to the accent editor.

## Why Accent Coloring Uses the Flash, Not a Persistent Border

The accent-editor's idle dots show a persistent border for pattern
membership because each dot has a fixed, stable meaning (bar position N is
always bar position N). Phase-progress dots don't have that property: the
same phase-position (e.g., "first beat of this SLOW phase") can land on a
*different* bar position each time the phase repeats, since "Beats per
Bar" advances independently and continuously through the whole session
and isn't reset at phase boundaries. Only the transient flash — computed
fresh for the specific beat actually sounding — is meaningful; a
persistent per-dot accent indicator would be misleading.

## Implementation Note

No new state, no CSS changes, and no changes to any pure `LOGIC-BEGIN`
function other than adding one new one (`practicePhasePosition`, mirroring
the existing `practiceSegmentIndex`) — this is a rendering-and-scheduling
change layered on top of state that already exists (`practiceRuntime`'s
`beatsPerPhase`/`breakBeats` snapshot, the shared `accentPattern`, the
existing `flashBeatIndicator`/`isAccentBeat` machinery).

## Preserved Constraints

- Still a single self-contained `metronome.html` file — no build step, no
  external files.
- No change to any existing `LOGIC-BEGIN`/`LOGIC-END` function or any
  existing test.
- No change to the accent pattern's data model, persistence, or its
  behavior on Metronome/Ramp tabs.
- No change to break beats always being unaccented and always played at
  the slow tempo.

## Out of Scope

- Any change to the four-segment (`SLOW - BREAK - FAST - BREAK`) readout
  — it already displays correctly and is unaffected by this spec.
- Any change to how the accent pattern itself is edited (still click-based
  on the dot row, still only while the row is in accent-editor mode).

## Testing / Verification

- Automated: `node --test tests/*.test.js` must show the full suite
  (35 existing + 2 new for `practicePhasePosition` = 37) passing.
- Manual (human, in a real browser): confirm the dot row correctly
  switches modes on Start/Stop/tab-switch, resizes at each phase
  transition when Beats per Phase and Break Length differ, shows accent
  coloring only during SLOW/FAST and never during BREAK, is non-clickable
  while playing, and that Metronome/Ramp tabs are completely unaffected.
