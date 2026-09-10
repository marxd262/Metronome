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
   serialize/deserialize, and the whole rhythm-pattern model: slot
   indexing, level cycling, preset templates and level building, pattern
   resize,
   normalize and legacy migration, and the playhead entry scan). Every
   function here must stay a pure function of its arguments — no reads
   of `state`, the DOM, or module-level variables — because
   `tests/loadLogic.js` extracts this exact block via regex and evals it
   standalone under Node to run `tests/logic.test.js` against it. **Any
   new calculation logic belongs here, written pure, with tests added to
   `tests/logic.test.js`.** This is what makes a single-file, build-free
   app unit-testable at all.
   A preset is not a division shortcut: each entry in `PATTERN_PRESETS`
   carries a `slots` template describing which slots of one beat sound and
   which rest, and `buildPresetLevels(beats, preset)` repeats that template
   across every beat, mapping a resting slot to `LEVEL_MUTED` and a
   sounding one through `defaultLevelForSlot`. Four presets rest on their
   own first slot and so produce a bar with no accent anywhere; that is
   deliberate. Because seven presets share division 4, a division no longer
   identifies a preset — `presetForPattern` names a pattern by comparing
   its actual level array against every preset's output and answers
   `custom` when none matches. There is no `presetForDivision`.
2. **The app block** — DOM wiring, the `state` object, `localStorage`
   persistence, and the Web Audio scheduler. This is untested by design
   (no DOM/Web Audio available under plain Node) and is verified manually
   in a browser instead.

### State and persistence

`state` is a single object (shape defined by `DEFAULT_STATE`) with one
section per concern: `topBar` (shared settings + `pattern`, the one
rhythm pattern all three modes play: `{ beats, division, preset, levels }`,
where `levels` is a flat `beats * division` array of `LEVEL_*` values),
`metronome`, `ramp`, `practice`. It's loaded via `deserializeSettings`,
which merges each *section* of a saved `localStorage` blob over
`DEFAULT_STATE` independently — so adding a new field to a section is
automatically backward-compatible with old saves (they just get the
default for the new field), and no explicit migration code is needed. An
unrecognized/removed field from an old save is silently carried over as
an unused property rather than stripped; this has been the accepted
behavior across several past field removals (see
`docs/superpowers/specs/`), not a bug.

`topBar.pattern` is the one deliberate exception to that merge. A save
written before the pattern editor existed has no `topBar.pattern` at all,
so the section merge would hand it the default and silently discard the
user's meter and accents. Instead, immediately after `deserializeSettings`,
the load path overwrites `state.topBar.pattern` with
`migrateLegacyPattern(parseSavedSettings(savedSettingsJson),
DEFAULT_STATE)`, which rebuilds the pattern from the old
`topBar.subdivision` — resolved through `LEGACY_SUBDIVISION_DIVISIONS`, a
frozen map of the four values that retired `<select>` could hold, kept
separate from `PATTERN_PRESETS` so that renaming a preset cannot silently
downgrade an old save's division — plus the Metronome tab's `timeSigNum`
and
`accentPattern` — Metronome, because three per-mode patterns collapsed
into one and it's the tab a user is likeliest to have set. Note that only
the branch finding an already-migrated `topBar.pattern`, and the two
missing/malformed fallbacks, route through `normalizePattern`; the
legacy-rebuild branch builds its result directly, from parts it has
already clamped itself. Anything else new still gets the plain merge —
don't add a second migration unless a field genuinely cannot survive one.
`normalizePattern` does one narrow repair of its own: a saved `preset` name
that is no longer in the roster (`none`, from before the roster grew) is
discarded and re-derived from the levels, because a stale name reaching
`select.value` matches no `<option>` and renders the dropdown blank.

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

Per-**beat** feedback (hero dots, hero BPM, ramp/practice readouts) uses
the capture-before-advance deferred callback described above. Per-**slot**
feedback is the pattern grid's playhead and only that: it uses a ring
buffer of scheduled slot times plus one `requestAnimationFrame` loop,
rejecting records whose `runId` or `patternGeneration` is stale. The two
must not be mixed. Anything a beat-rate callback can serve belongs in the
first mechanism; the ring buffer exists because timer callbacks queue
rather than skip, and at high divisions that drags the highlight behind
the audio.

### Mode dispatch

`currentModeBpm()` and `advanceModeAfterBeat()` branch on
`state.topBar.activeTab` to unify Metronome/Ramp/Practice behind one
scheduler. `rampRuntime`/`practiceRuntime` hold a mode's live playback
state (built fresh in `startPlayback()`, **never explicitly nulled** —
code that reads them must itself check `isPlaying`/`activeTab` rather
than relying on nullness to mean "not running").

The shared pattern (`state.topBar.pattern`) plays during all three
modes; Practice's break beats are the one deliberate exception —
`scheduleBeat` ignores the pattern for them entirely and emits a single
normal-level click on the beat with every slot between it muted, so a
break stays audibly flat against a phase.

### The beat-dot row is a position indicator and nothing else

`#beatIndicator` used to serve two purposes — a clickable accent-pattern
editor on Metronome/Ramp, and a non-interactive phase-progress row during
Practice playback — which meant every code path rendering into it had to
know which mode it was in, and `bindTopBar`'s time-signature handler had to
be fixed once for calling the wrong renderer. Accent editing now lives in
the pattern editor, so the row has one job and one renderer,
`renderDotRow(count)`: `<div>` dots, always `aria-hidden`, never clickable.
It has three callers, and the count each passes is the whole contract:
`state.topBar.pattern.beats` for bar position, `practiceRuntime.beatsPerPhase`
for phase progress, and `practiceRuntime.breakBeats` during a Practice break —
break length is decoupled from the phase, so sizing a break row from
`beatsPerPhase` would be wrong. Its forced synchronous reflow is load-bearing
and is commented in place — do not remove it.

That reflow is also what makes it safe for `afterPatternResize` to re-render
the row mid-playback, which it does in every mode except Practice: a changed
beat count has to reach the dots immediately, or the indicator disagrees with
the audio. Practice is the exception because its row is showing phase
progress, not bar position.

### Quick-select value dropdown

Every numeric field has a chevron button (`attachQuickSelect`, called once
per field from each `bind*Tab()`) that opens a small popup of preset values
(`QUICK_SELECT_PRESETS`, one preset list per field kind) merged with the
field's current value at its sorted position (`buildQuickSelectValues`, a
LOGIC function). At most one popup can be open at a time — a single
module-level `openQuickSelectPopup` reference, closed via document-level
click/scroll/resize listeners, is what enforces that, not per-popup state.
The toggle deliberately isn't given the `.step-btn` class: each `bind*Tab()`
delegates `±`/`±5` stepper-button clicks with
`querySelectorAll('.step-btn')`, and reusing that class on the chevron would
fold it into the same click handling.

### Cascade layers and the theme system

`index.html` has a single `<style>` block (alongside the two `<script>`
blocks described above), organized into four cascade layers declared
once at the top: `@layer base, components, themes, motion;`. **Every
rule must live inside one of these layers** — an unlayered rule outranks
all layered rules regardless of specificity, so a stray rule added
outside `@layer` would silently beat all five themes. `@keyframes` is
the one exception: layers don't affect them, so they stay at top level
and are given theme-unique names (`pulse-engine-shell-strike`,
`kinetic-type-rule-flash`, `grid-console-cell-strike`, etc.) so two
themes' animations can never collide.

`base` holds resets, element defaults, the primitive tokens
(`--neutral-*`, `--accent-500`, `--red-500`), and shared motion/spacing
scales. `components` holds every component rule, written against custom
properties rather than raw values — including every rule the rhythm pattern
editor owns (`#patternEditor`, `#patternHeader`, `.pattern-field`,
`#patternGrid`, `.pattern-row`, `.pattern-slot` and its
level/`beat-start`/`playhead` states), none of which any theme overrides.
That is why the header fields are `.pattern-field` and deliberately *not*
`.field-group`: two themes restructure `.field-group` from the themes layer,
which outranks anything `#patternHeader` can say. The shared controls inside
the editor — its labels, `<select>`, number inputs and `.stepper-row` — do
still theme, through the same selectors every other field uses. Beyond those
shared selectors the editor reads base-layer scales (`--space-*`,
`--text-xs`, `--duration-fast`, `--ease-standard`,
`--font-weight-semibold`), tokens the themes already define, and two of
its own declared on `#patternEditor` (`--pattern-slot-size`,
`--pattern-grid-max-height`) — so it adds no new entries to
`REQUIRED_TOKENS`. A slot is that one size at every beat and division
count. The editor originally shrank slots past a slot-count threshold
(`--pattern-slot-size-compact`, `#patternGrid.compact`, and a
`PATTERN_COMPACT_THRESHOLD` constant, all now removed) so that a large
pattern could not push the Start button off screen; the transport now sits
above the editor, and the grid is capped at `--pattern-grid-max-height` and
scrolls on both axes, so a large pattern scrolls instead of resizing the
cells the user is aiming at. `#patternGrid` wraps rather than stacking:
beat blocks flow across the width and wrap onto the next line, so the only
thing that still scrolls sideways is a single beat wider than the whole
grid. Blocks are uniform width, so wrapped lines self-align into columns
with no grid template, and `scrollbar-gutter: stable` keeps the
blocks-per-line count from changing when the vertical scrollbar appears.
Because a beat block no longer spans the grid, the `ArrowUp`/`ArrowDown`
keys cannot mean "one beat" any more — they run through the pure LOGIC
function `patternVerticalNeighbor`, which jumps by a blocks-per-line count
the handler measures from the laid-out DOM (`offsetTop`, not a width
calculation) and returns the index unchanged when the target line does not
exist. `.playhead-row` correspondingly now marks one beat rather than a
screen row. The design spec
(`docs/superpowers/specs/2026-09-09-rhythm-pattern-editor-design.md`) still
describes the old two-size behaviour — it records the original reasoning,
not current behaviour. Don't reintroduce size tiers. `themes` holds one
`:root[data-theme="…"]` token block per theme, plus that theme's
structural overrides (hero element order, content max-width, and, for
Grid Console, the page's column count). `motion` holds
`prefers-reduced-motion` token overrides and is declared last so it
outranks every theme.

Five themes exist: `classic` (today's look, the default), `pulse-engine`,
`kinetic-type`, `pulse-field`, `grid-console`. The choice lives in
`state.topBar.theme`, follows the same per-section merge-over-
`DEFAULT_STATE` backward compatibility described above under "State and
persistence," and is guarded on load by the pure LOGIC function
`resolveTheme(saved, validThemes, fallback)`, which falls back to
`classic` if a persisted theme name no longer exists. The theme
`<select>` lives in `<header id="masthead">`; changing it sets
`data-theme` on `<html>` and persists — nothing else. It deliberately
does not stop playback, unlike `switchTab`. `tests/themes.test.js` is a
dependency-free static analysis of `index.html` that enforces the
contract below, plus that every theme in the roster has a matching token
block and vice versa.

Three rules of that contract are the easiest for a future change to
break without realizing it:

1. **The locked `.beat-dot` transition.** `@layer components` owns
   `.beat-dot`'s `transition` declaration; no theme may declare
   `transition` or any `transition-*` longhand on `.beat-dot` — a theme
   varies timing only through `--dot-strike`, `--dot-decay`,
   `--dot-ease`. `flashBeatIndicator` adds `.pulse` and removes it from a
   `transitionend` listener; if adding `.pulse` doesn't change a
   transitioned property, that event never fires and the class sticks on
   the dot permanently. `tests/themes.test.js` enforces this, including
   the longhand forms. The pattern editor's slots deliberately do *not*
   carry the `.beat-dot` class — a comment on `.pattern-slot` says so —
   because a slot is a different control with a different lifecycle, so
   this contract does not apply to it. Its playhead highlight is added and
   removed by the animation-frame loop rather than by a `transitionend`
   listener, so it cannot get stuck the way `.pulse` can.
   `tests/themes.test.js` separately asserts that every `.pattern-slot`
   rule sits inside a cascade layer.
2. **Every theme must define all 23 required tokens** — the list lives
   in the `REQUIRED_TOKENS` array at the top of `tests/themes.test.js`
   (read it there rather than here, so the two can't drift apart), and
   the suite fails any theme missing one. The companion rule, checked the
   same way: `--dot-pulse-bg` must differ from `--dot-idle`, for the
   identical stuck-`.pulse` reason as above — if they're equal, adding
   `.pulse` doesn't change the dot's background and `transitionend` never
   fires.
3. **Layer order beats specificity.** Because `themes` is declared after
   `components`, even a low-specificity shorthand in a theme rule (say
   `border: 1px solid X` on an input) silently overrides a *more
   specific* shared state rule sitting in `components` — `.clamped`,
   `:focus`, `.beat-dot.pulse`, `.pattern-slot:hover`,
   `.step-btn.step-5`. A theme that reaches for such a shorthand has to
   restate those states itself. This isn't cosmetic: the clamp flash, for
   instance, is how an out-of-range value announces itself. Relatedly,
   the shared rules use `font: inherit`, which carries no `font-weight` —
   a weight a theme wants has to be declared in the theme, not assumed
   inherited.

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
