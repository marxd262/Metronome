# Guitar Practice Metronome

A single-file, no-install metronome built for guitar practice. Open
`index.html` in a browser and go — no build step, no server, no
dependencies.

**Live:** https://marxd262.github.io/Metronome/

## Running it

Just open `index.html` in any modern browser (double-click it, or drag
it into a browser window). Everything — markup, styling, and logic —
lives in that one file, and your settings are saved locally in the
browser between sessions.

## Features

### Shared controls (top bar)

- **Beats per Bar** — how many beats make up a bar, driving the accent
  pattern, the beat-dot row, and Ramp's step length.
- **Subdivision** — none / eighths / triplets / sixteenths, played as
  soft clicks between main beats.
- **Sound** — click / beep / wood block.
- **Volume**
- **Tap Tempo** — tap the button in rhythm to set the BPM of whichever
  tab is currently active.
- **Spacebar** starts/stops playback from anywhere (unless a text field
  has focus).

### Per-beat accents

The row of dots below the transport button *is* the accent editor: click
or keyboard-activate any dot to toggle that beat's accent on or off —
any combination of beats can be accented at once, and it works whether
the metronome is running or stopped. The accent pattern is shared across
all three modes below.

### Metronome tab

Standard metronome: **BPM** plus a **% of BPM** quick-scale dial for
practicing slower without losing your target tempo.

### Ramp tab

Gradually steps the tempo from a **Start BPM** to a **Stop BPM**, either
by a **percentage** or a **fixed BPM** amount every N bars (**Step
Length**). Holds at the target tempo once reached — it never stops on
its own or loops.

### Practice tab

A slow/fast interval drill: cycles `Slow → Break → Fast → Break →
repeat`.

- **Base BPM** is the fast/target tempo; **Speed Delta %** sets how much
  slower the slow phase is (e.g. 50% = half speed).
- **Beats per Phase** sets how long the slow and fast phases each last.
- **Break Length** sets how long the (always unaccented, always
  slow-tempo) breaks last — independent of Beats per Bar.
- The readout always shows all four phases (`SLOW - BREAK - FAST -
  BREAK`), with the current one highlighted.
- While playing, the beat-dot row switches from the accent editor to a
  live progress indicator sized to whichever phase is currently
  running, reverting to the accent editor as soon as you stop.

## Project structure

```
index.html               The entire app (HTML + CSS + JS)
tests/
  logic.test.js          Automated tests for the app's pure calculation logic
  loadLogic.js            Test harness that extracts that logic from index.html
docs/superpowers/
  specs/                  Design specs for each feature, in the order they were built
  plans/                  Implementation plans for each feature
```

The pure calculation logic (BPM math, ramp stepping, practice phase
sequencing, persistence, validation) lives inside `// LOGIC-BEGIN` /
`// LOGIC-END` markers in `index.html` so it can be unit-tested
without a build step — `tests/loadLogic.js` extracts that block and runs
it under Node.

## Running the tests

Requires Node.js (v18+; developed against v26).

```bash
node --test tests/*.test.js
```

(The directory form `node --test tests/` doesn't reliably discover the
test file on every platform — always use the glob form above.)

Currently 37 tests covering all of the app's pure logic. DOM- and
audio-dependent behavior (the Web Audio scheduler, visual feedback,
persistence to `localStorage`) has no automated tests and is verified
manually in a browser.

## Tech notes

- Vanilla HTML/CSS/JavaScript — no framework, no dependencies, no CDN
  links, no network calls of any kind.
- Timing uses a Web Audio API lookahead scheduler (rather than
  `setInterval`) for drift-free playback.
- Settings persist to `localStorage` and restore automatically on your
  next visit.
