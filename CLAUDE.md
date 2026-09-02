# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file, no-build, no-dependency guitar-practice metronome. The
entire app — HTML, CSS, and JS — lives in `index.html`. It's meant to be
opened directly in a browser (double-click, or drag into a window) and
also serves as-is via GitHub Pages (https://marxd262.github.io/Metronome/).
There is no bundler, no package.json, and no npm dependency anywhere in
this repo — keep it that way. Adding a build step, a framework, a CDN
script, or a network call would break the project's core premise.

## Commands

Run the app: open `index.html` in a browser. Nothing to install or build.

Run tests:
```bash
node --test tests/*.test.js
```
Use the glob form above — `node --test tests/` (directory form) does not
reliably discover the test file on every platform/Node version. Requires
Node 18+ (developed against v26); no other tooling is installed or
required. There is no lint step.

## Architecture

### Two `<script>` blocks, two different testing strategies

`index.html` has exactly two `<script>` tags:

1. **The LOGIC block** — everything between the `// LOGIC-BEGIN` and
   `// LOGIC-END` comments. This holds every pure calculation function
   (BPM/percent clamping, ramp stepping math, practice phase-sequence and
   segment/position math, tap-tempo averaging, settings
   serialize/deserialize, accent-pattern resizing). Every function here
   must stay a pure function of its arguments — no reads of `state`, the
   DOM, or module-level variables — because `tests/loadLogic.js` extracts
   this exact block via regex and evals it standalone under Node to run
   `tests/logic.test.js` against it. **Any new calculation logic belongs
   here, written pure, with tests added to `tests/logic.test.js`.** This
   is what makes a single-file, build-free app unit-testable at all.
2. **The app block** — DOM wiring, the `state` object, `localStorage`
   persistence, and the Web Audio scheduler. This is untested by design
   (no DOM/Web Audio available under plain Node) and is verified manually
   in a browser instead.

### State and persistence

`state` is a single object (shape defined by `DEFAULT_STATE`) with one
section per concern: `topBar` (shared settings + the accent pattern),
`metronome`, `ramp`, `practice`. It's loaded via `deserializeSettings`,
which merges each *section* of a saved `localStorage` blob over
`DEFAULT_STATE` independently — so adding a new field to a section is
automatically backward-compatible with old saves (they just get the
default for the new field), and no explicit migration code is needed. An
unrecognized/removed field from an old save is silently carried over as
an unused property rather than stripped; this has been the accepted
behavior across several past field removals (see
`docs/superpowers/specs/`), not a bug.

### The Web Audio lookahead scheduler and the capture-before-advance pattern

Playback uses a lookahead scheduler (`schedulerTick` → `scheduleBeat`),
not `setInterval`, to avoid drift: `scheduleBeat` schedules a beat's audio
click up to `SCHEDULE_AHEAD_SEC` (100ms) before it's actually audible, via
a `setTimeout`-deferred callback that also handles that beat's visual
feedback (dot flash, hero BPM number, ramp/practice readouts).

**The one pattern to know before touching `scheduleBeat`:** every value
that deferred callback uses (`beatIndex`, `bpm`, `dotIndex`, `dotCount`,
`rampDisplay`, `practiceSegment`, `dotRuntime`) is captured into a local
*before* `advanceModeAfterBeat()` mutates the mode's runtime state a few
lines later — never read live from inside the callback. This project has
hit the same class of bug multiple times when a new piece of per-beat
feedback was added without following this: either it displays state that
hasn't become audible yet (updates ~100ms early), or a stale callback
fires after `stopPlayback()`/a mode switch and corrupts UI state that's
already moved on. If you add new per-beat visual/state feedback, capture
its value alongside the existing ones and gate any DOM mutation inside
the callback on `isPlaying` (and, if it's Practice-specific, on
`state.topBar.activeTab === 'practice' && practiceRuntime === <captured
runtime reference>` — object-identity-checking against a captured
reference, not just a boolean, is what closes the "user stopped and
started a new run before the stale callback fired" race).

### Mode dispatch

`currentModeBpm()` and `advanceModeAfterBeat()` branch on
`state.topBar.activeTab` to unify Metronome/Ramp/Practice behind one
scheduler. `rampRuntime`/`practiceRuntime` hold a mode's live playback
state (built fresh in `startPlayback()`, **never explicitly nulled** —
code that reads them must itself check `isPlaying`/`activeTab` rather
than relying on nullness to mean "not running").

The accent pattern (`state.topBar.accentPattern`) applies during all
three modes; Practice's break beats are the one deliberate exception
(always forced unaccented, regardless of the pattern).

### The beat-dot row is mode- and state-dependent

`#beatIndicator`'s dots serve different purposes depending on context:
on Metronome/Ramp, or on Practice while stopped, they're the clickable
accent-pattern editor (`renderBeatDots`). While Practice is playing, the
same element becomes a non-interactive phase-progress indicator
(`renderPracticeProgressDots`), resized per phase and `aria-hidden`. Any
code path that can render into `#beatIndicator` needs to know which mode
it's in — `bindTopBar`'s time-signature handler had to be fixed once
already for calling the wrong renderer while Practice was running.

## Project history and conventions

`docs/superpowers/specs/` and `docs/superpowers/plans/` hold, in
chronological order, the design spec and implementation plan for every
feature built so far — they're the authoritative record of *why* a given
piece of behavior is the way it is (e.g. why break length is decoupled
from time signature, why the accent pattern isn't reset per-phase). When
in doubt about intended behavior, check there before assuming something
is a bug. New non-trivial features in this repo have consistently gone
through the same cycle: brainstorm → write a spec → write a plan → build
it → review it — follow that pattern rather than editing `index.html`
directly for anything beyond a small, obvious fix.
