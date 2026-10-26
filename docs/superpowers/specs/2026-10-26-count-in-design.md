# Count-in — Design

Date: 2026-10-26

## Purpose

A player who starts a Ramp (or any mode) needs time between pressing Start and
playing: to get the pick ready and be in position for the first beat. The
count-in plays a chosen number of beats first, with a visible countdown, and
the real run begins when it ends. Off by default.

## Behavior

- One shared setting, `state.topBar.countInBeats`, integer 0–16 (`COUNT_IN_MAX`),
  default 0 (off). It applies to Metronome, Ramp and Practice alike.
- On Start with a count-in of N: N beats click, then the run begins exactly as
  it would have with no count-in. Nothing advances during the count-in — not the
  bar position, not the ramp, not the practice phase.
- Each count-in beat is one normal-level click on the beat with the pattern
  ignored (as a Practice break does), at the tempo of the first real beat:
  Metronome's effective BPM, Ramp's Start BPM, Practice's slow BPM.
- The hero number shows the beats remaining (N … 1) and its label reads
  "Count-in"; the dot row shows N dots and pulses one per beat. The pattern
  grid's playhead stays dark. The first real beat restores the BPM, its label,
  and the bar's (or, in Practice, the phase's) dot row.
- Stopping, or switching tab, mid-count-in restores the hero immediately.
- Changing a tempo mid-count-in does not touch the countdown.
- Changing the pattern's beat count mid-count-in does not replace the countdown
  row; the first real beat draws the new bar.

## UI

A "Count-in" stepper field (− / number / + / quick-select chevron, presets
0, 1, 2, 4, 8) in the top bar, beside Sound, with Volume on the row below. The
top bar is where session settings live, and the top bar dims while playing in
the themes that dim it, which suits a setting that is irrelevant mid-run. It is
a transport setting, not part of the pattern, so it lives on `topBar` rather
than `topBar.pattern`. A saved value is clamped when loaded into the input and
again when Start reads it.

History: the field first shipped as a fourth item in the pattern editor's
header, where it wrapped onto an orphaned row. Four alternatives were prototyped
(in-box grid column, a segmented control under Start, a cycling text line under
Start, and the top bar); the top bar was chosen. The prototypes are in
`experiments/count-in-layouts/`.

The pattern editor's header was re-laid-out in the same change: Preset on its
own row, spanning the width of Beats and Division beneath it, with the slot
count and Hide at the end of the preset row. It reflows on the editor's own
width (a container query), collapsing to two columns on a phone.

## Design notes

- `clampCountIn` is a new LOGIC function; `clampPositiveInt` cannot serve
  because zero is a legal value. An empty string is "no number", not 0.
- The scheduler and the screen disagree by up to `SCHEDULE_AHEAD_SEC`, so there
  are two pieces of state: `countInRemaining` (decremented as beats are
  scheduled) and `countInDisplayActive` (cleared by the first real beat's
  deferred callback). The hero and pattern-resize guards read the second.
- Count-in beats follow the capture-before-advance rule and gate their deferred
  callback on `playbackRunId`, so a stale callback cannot paint a countdown over
  a restarted run.

## Out of scope

Per-mode count-in lengths; a count-in on the Practice loop's phase boundaries
(it happens once, at Start); an accented or different sound for the count-in.
