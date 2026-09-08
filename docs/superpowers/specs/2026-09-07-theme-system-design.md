# Theme System — Design Spec

Date: 2026-09-07

## Purpose

The app currently has exactly one visual treatment, defined by a single
`<style>` block in `index.html`. Four experimental redesigns were built
in `experiments/` as standalone forks of the whole app — each a complete
copy of the HTML, CSS and JS. That fork layout guarantees drift: every
future bug fix has to land five times, and nothing enforces that it did.

This spec folds those four treatments plus the current look into
`index.html` as five selectable themes sharing one copy of the markup
and one copy of the JavaScript, so feature completeness cannot diverge
between them. A dropdown at the right end of the masthead selects the
theme, and the choice persists to `localStorage` alongside the existing
settings.

The four experimental treatments are the design input, not the
deliverable. `experiments/` is retired once the merge is verified.

## Behavior

### The five themes

| Value | Display name | Character |
|---|---|---|
| `classic` | Classic | The current look, unchanged. **Default.** |
| `pulse-engine` | Pulse Engine | Machined chassis, inset LCD readout, lit beat bars, round transport |
| `kinetic-type` | Kinetic Type | Editorial near-monochrome, display-scale numeral, accent means "running" |
| `pulse-field` | Pulse Field | Ambient; each beat blooms the canvas behind the readout |
| `grid-console` | Grid Console | Exposed hairline grid, register marks, two-column at ≥880px |

A theme may change anything visual: colors, type, spacing, radius,
component treatment, element order within the hero, the content
max-width, and the page's column count. Grid Console keeps its
two-column desktop layout.

### Selecting a theme

A `<select>` sits at the right end of the masthead row, opposite the
title. It carries `aria-label="Theme"` and no visible label — the
selected option's text names the theme. It uses each theme's existing
`select` styling, so it needs no bespoke rules in any theme.

Changing it:

1. sets `data-theme` on the document element,
2. writes `state.topBar.theme` and calls `persistState()`.

Nothing else. In particular it **does not stop playback**, does not
re-render the beat dots, and does not touch `rampRuntime`,
`practiceRuntime`, `beatIndexInBar`, or the scheduler. Theme switching
is a CSS-only operation; switching mid-playback is supported and must
not interrupt audio or drop a beat. (This differs deliberately from
`switchTab`, which does stop playback.)

The global Space-to-play/pause handler already ignores events whose
target is a `SELECT`, so Space while the theme dropdown is focused
continues to operate the dropdown rather than the transport. No change
needed.

### Classic is faithful, with one acknowledged exception

Because Classic is the default, every existing saved settings blob lands
on it. "No change on next open" has to mean no change *while playing*
too, not just a matching screenshot.

**The exception:** Classic gains the theme dropdown, which its header
never had. Nothing else about it changes — the `h1` stays centered and
everything below the masthead is untouched — but Classic is not
pixel-identical to today's build, and cannot be while the selector is
reachable in every theme. This is the one deliberate visual change to
the default experience, and it is the price of the feature.

Otherwise, under Classic:

- `#beatFlash` is not rendered (`display: none`),
- there is no performance-mode dimming,
- `--dot-strike` / `--dot-decay` are set to today's values, so the beat
  dots flash exactly as they do now.

These are all rules Classic simply declines to define; no base-layer
special-casing is required.

### Shared behavior in the other four themes

**Performance mode.** While playing, `body.playing` de-emphasizes the
settings so the readout carries the screen. Hover or focus within any
de-emphasized region restores it to full presentation immediately, so no
control is ever unreachable or unreadable while in use.

De-emphasis must keep every label, value and control legible on its own
— it is a hierarchy cue, not a disabled state. Concretely: no
de-emphasized text may fall below 4.5:1 against its background in the
de-emphasized state, and the effect may not be applied to `#startStop`,
which must stay at full presentation so stopping is never harder than
starting.

**Strike and decay.** Beat feedback hits in `--dot-strike` (~30ms) and
fades over `--dot-decay` (~300–500ms), rather than flashing
symmetrically. See the beat-dot contract below — this is the one piece
of theming that can produce a functional bug rather than a cosmetic one.

**Beat flash.** A `#beatFlash` element inside `.hero-frame` gives each
theme a per-beat page-level cue: a bezel flash (Pulse Engine), a rule
strike (Kinetic Type), a canvas bloom (Pulse Field), a cell border
(Grid Console). It is `aria-hidden`, purely decorative, and animation-free
under `prefers-reduced-motion`.

## Implementation Notes

### Shared HTML skeleton

One hero structure serves all five themes. Two semantically neutral
wrappers give themes something to attach layout to:

```
#heroZone
  .hero-frame              01 chassis · 02 measure line · 04 console box
                           classic/03 transparent passthrough
    #beatFlash             absolutely positioned against .hero-frame
    .hero-readout          01 inset LCD · 04 primary cell
                           02 numeral + vertical unit label
      #heroBpm
      #heroBpmLabel
    #beatIndicator
  #rampReadout             .readout, hidden per mode
  #practiceReadout         .readout, hidden per mode
```

Classic and Pulse Field place `#beatIndicator` above the readout using
`order`, not different markup.

The masthead gains a wrapper so the dropdown has somewhere to sit:

```
header#masthead
  h1
  select#themeSelect
```

Every id and class the JS queries — `#beatIndicator`, `.beat-dot`,
`#heroBpm`, `#heroBpmLabel`, `#rampReadout`, `#practiceReadout`,
`.panel`, `#startStop`, and the rest — keeps its current name and role.
`#beatIndicator` still holds `<button>` children in accent-editor mode
and `<div>` children in practice-progress mode, styled by the same
rules.

### CSS organization: cascade layers

The stylesheet declares its layer order once, at the top:

```css
@layer base, components, themes;
```

- **base** — resets, the element-level defaults, the shared motion and
  spacing scales, `prefers-reduced-motion` handling, focus-visible, and
  the default token values.
- **components** — every component rule (`.step-btn`, `.tapTempo`,
  `.tab-btn`, `.panel`, `.field-group`, `.quick-select-*`, `.beat-dot`,
  `#startStop`, …) written against custom properties.
- **themes** — one `:root[data-theme="…"]` token block per theme, plus
  that theme's structural overrides.

**All CSS must live inside a layer.** An unlayered rule outranks every
layered rule regardless of specificity, so a stray unlayered declaration
would silently beat all five themes. This is a hard requirement, not a
style preference.

Layer order is what makes "a theme always wins over a component rule"
structural rather than a specificity race. With five themes overriding a
shared component layer, specificity conflicts are the main way a theme
ends up quietly wrong in one place.

### The beat-dot transition contract

`flashBeatIndicator` adds `.pulse` and removes it from a
`transitionend` listener. If adding `.pulse` does not change a
transitioned property, the event never fires and the class sticks
permanently on that dot. This project has hit this class of bug
repeatedly (see CLAUDE.md), and five themes is five chances to
reintroduce it.

The **components** layer owns the declaration:

```css
.beat-dot {
  transition:
    background-color var(--dot-decay) var(--dot-ease),
    box-shadow       var(--dot-decay) var(--dot-ease),
    transform        var(--dot-decay) var(--dot-ease),
    border-color     var(--duration-fast) var(--ease-standard);
}
.beat-dot.pulse { transition-duration: var(--dot-strike); }
```

Themes set `--dot-strike`, `--dot-decay`, `--dot-ease`, `--dot-idle`,
`--dot-pulse-bg`, `--dot-accent-bg`, and the dot's geometry. **A theme
must never declare `transition` on `.beat-dot`.** Enforced by test
(below).

The asymmetry is deliberate: the strike is short so `transitionend`
fires quickly and reliably, and the return to idle is what the eye reads
as a decaying metronome LED.

### Required token set

Every theme block must define all of:

```
--bg  --panel  --overlay  --divider
--text  --text-muted  --text-dim
--accent  --accent-beat  --on-accent  --accent-glow
--dot-idle  --dot-pulse-bg  --dot-accent-bg
--dot-strike  --dot-decay  --dot-ease
--content-max-width
--radius  --radius-panel
--font-ui  --font-mono  --font-display
```

Anything not listed falls back to the base layer's value. A theme
omitting one of these would silently inherit a value tuned for a
different palette, which is exactly the failure the token test catches.

### State and persistence

- `DEFAULT_STATE.topBar.theme = 'classic'`.
- `deserializeSettings` already merges each saved section over
  `DEFAULT_STATE` independently, so a saved blob predating this feature
  has no `theme` key and receives `'classic'`. **No migration code.**
- Persisted by the existing `persistState()`. No change to
  `serializeSettings` or `deserializeSettings`.

### New pure LOGIC function

`resolveTheme(saved, validThemes, fallback)` — returns `saved` when it
appears in `validThemes`, otherwise `fallback`. Pure function of its
arguments; belongs between `LOGIC-BEGIN` and `LOGIC-END` with unit tests
in `tests/logic.test.js`.

This guards the case where a persisted theme name no longer exists —
a theme renamed or removed in a later change would otherwise leave the
document with a `data-theme` matching no rules and therefore no tokens
at all. It mirrors the existing inline `activeTab` validation in
`refreshAllInputsFromState`, promoted to a tested pure function because
it now has a failure mode worse than falling back to a default tab.

### Wiring

- `applyTheme(name)` — sets `document.documentElement.dataset.theme`.
  No other side effects.
- `bindTopBar()` gains a `change` listener on `#themeSelect` that sets
  `state.topBar.theme`, calls `applyTheme`, and persists.
- `refreshAllInputsFromState()` resolves the saved theme through
  `resolveTheme`, applies it, and syncs `#themeSelect.value` — alongside
  the existing input-syncing it already does.

### Scheduler safety

This feature does not touch `scheduleBeat`, `advanceModeAfterBeat`,
`currentModeBpm`, `startPlayback`, `stopPlayback`, or any mode runtime.
The capture-before-advance pattern documented in CLAUDE.md is unaffected:
no new per-beat value is read inside the deferred callback, and
`triggerBeatFlash` is called from within `flashBeatIndicator`, which
already runs inside the existing `isPlaying` / `activeTab` gate.

## Preserved Constraints

- Still a single self-contained `index.html` — no build step, no
  external CSS or JS file, no network request, no dependency.
- The `LOGIC-BEGIN`/`LOGIC-END` block gains one function and loses
  none; `tests/loadLogic.js` continues to work unchanged.
- No change to the Web Audio scheduler, the lookahead timing, or any
  mode's runtime state.
- Dark-only remains intentional and permanent (brief §6). Themes are
  five dark treatments; none of them is a light mode.
- `#heroBpm` stays at bold weight in every theme (brief §6).
- The accent pattern continues to apply across all three modes, with
  Practice break beats forced unaccented.

## Out of Scope

- Deleting `experiments/`. It stays until the merged themes are verified
  in a browser, then goes in a separate commit.
- A dev-time screenshot tool. Visual checking is the manual matrix below;
  automating it is a possible follow-up, not part of this change.
- Any user-authored or customizable theme, theme import/export, or
  per-mode themes.
- A light theme.
- Any change to the audio engine, sound styles, or the practice/ramp
  math.

## Testing / Verification

### Automated

`node --test tests/*.test.js` must pass, covering:

1. **Existing suite** — all 45 current cases, unchanged.
2. **`resolveTheme`** (in `tests/logic.test.js`) — returns the saved
   value when valid; returns the fallback for an unknown name, `null`,
   `undefined`, and a non-string.
3. **New `tests/themes.test.js`**, a dependency-free static analysis of
   `index.html` that asserts:
   - every theme in the known list has a `:root[data-theme="…"]` block;
   - each such block defines all of the required tokens listed above;
   - each theme's `--dot-pulse-bg` differs from its `--dot-idle`, so
     adding `.pulse` is guaranteed to change a transitioned property;
   - no rule whose selector contains both `[data-theme` and `.beat-dot`
     declares `transition`;
   - the `<option>` values in `#themeSelect` exactly match the set of
     defined theme blocks.

   Blocks are located by matching `:root[data-theme="…"] {` and reading
   to the balanced closing brace — no CSS parser, no dependency.

### Manual (human, in a real browser)

The matrix that cannot be automated. For **each of the five themes**:

- Each of the three modes renders correctly stopped, and the mode tabs
  switch cleanly between them.
- Start playback: the beat dots pulse and decay, and **no dot is left
  stuck lit** after stopping — the single most important check, and the
  one the automated tests can only partially guard.
- Ramp mode: the readout updates as the tempo climbs and the hero
  numeral does not shift the layout as digit count changes.
- Practice mode: the phase-progress dots resize per phase, the
  SLOW/BREAK/FAST/BREAK readout highlights the active segment, and the
  dot row returns to the accent editor on stop.
- The accent-pattern editor: clicking dots toggles accents, and accents
  survive a time-signature change.
- Quick-select popups open, position correctly, and close on outside
  click — including near the viewport edge.
- Performance mode (four themes): panels de-emphasize while playing and
  fully restore on hover and on keyboard focus.

Then, across themes:

- Switching theme **while playing** does not interrupt audio, drop a
  beat, or reset the beat position.
- Switching theme, closing the tab, and reopening restores that theme.
- An existing pre-feature `localStorage` blob loads on Classic, and
  Classic looks and behaves identically to today apart from the theme
  dropdown in its header — compared side by side against the pre-merge
  build, not from memory.
- Performance-mode de-emphasis keeps all text legible and leaves
  `#startStop` at full presentation in all four themes that use it.
- Grid Console's two-column layout appears above 880px and collapses
  cleanly below it; every other theme is checked at a narrow width for
  stepper-row overflow.
- `prefers-reduced-motion: reduce` suppresses the beat flash and the
  transport ring in every theme.
