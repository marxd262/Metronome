# Metronome UI Rework — Design Spec

Date: 2026-08-31

## Purpose

The existing `metronome.html` is functionally complete (three working modes,
28 passing tests, human-verified in a browser) but visually is unstyled
default-browser HTML: system font at default size, default form widgets,
no color system, cramped spacing. This spec covers a visual/UX rework to a
modern, clean dark-themed look — without changing any existing behavior,
element IDs, or the automated test suite, except for one deliberate
behavior change (the beat indicator becomes a row of per-beat dots instead
of a single pulsing dot).

## Visual System

- **Theme**: dark. Background `#15151a`, panel/divider tone `#1f1f26`,
  primary text `#e8e8ec`, secondary/muted text `#8b8b95`.
- **Accent**: warm amber (`#f5a623`-family) for active/interactive states
  (active tab underline, Start/Stop button, slider fill, focus rings,
  non-accented beat dots).
- **Accent-beat color**: a separate soft red, reserved only for the
  downbeat/accented-beat flash, so it's visually distinct from the general
  amber accent used everywhere else.
- **Typography**: keep the existing `system-ui` font stack (no external
  fonts — must stay a single, network-free file). Introduce a clearer type
  scale: small uppercase labels, a large bold hero number for the current
  BPM, and consistent body text size for other controls.
- **Spacing**: generous gaps and padding throughout, replacing the current
  cramped default flexbox spacing. Larger touch targets for buttons and
  sliders.

## Layout Structure

Top to bottom:

1. **Header** — small, understated app title.
2. **Top bar** — shared settings (Beats per Bar, Subdivision, Sound,
   Volume, Tap Tempo) as one de-emphasized row of compact controls.
3. **Tab bar** — three flat text tabs (Metronome / Ramp / Practice), amber
   underline on the active tab, no boxed buttons.
4. **Hero zone** — the row of beat dots (see below) centered above a large
   bold number showing the current *effective* BPM (live-updating), with a
   small "BPM" unit label beneath it.
5. **Tab panel** — that mode's specific controls (unchanged fields/IDs),
   laid out as clean label/input pairs with consistent spacing; no
   card/box styling, just whitespace and a subtle divider line above and
   below the panel.
6. **Transport** — one large pill-shaped Start/Stop button, with the
   mode's readout text (ramp/practice status) directly beneath it.

## Component Styling

- **Buttons** (tabs, Start/Stop, Tap Tempo): flat, no default browser
  borders, rounded corners, clear hover/active states. Start/Stop uses the
  amber accent as its primary color.
- **Sliders** (`metronomeBpmRange`, `metronomePercentRange`, `volume`):
  custom-styled via `input[type=range]` pseudo-elements (`::-webkit-slider-thumb`,
  `::-moz-range-thumb`, etc.) — thin amber-filled track, round thumb —
  replacing the default OS widget.
- **Number/select inputs**: dark-filled fields with a subtle border,
  amber border/glow on focus, replacing default white browser inputs.
- **Checkbox** (`accentFirstBeat`): custom-styled (e.g. `appearance: none`
  plus a styled box/checkmark) to match the dark theme instead of the
  default OS checkbox.
- **Readouts** (`rampReadout`, `practiceReadout`, `statusReadout`): simple
  muted-color text, no boxing, positioned beneath the transport button.

## Behavior Change: Beat-Dot Row

The single `#beatIndicator` div (currently toggled via
`flashBeatIndicator(accent)`, which adds/removes `.pulse`/`.accent`
classes) becomes a **row of dots**, one per beat in the current bar
(`state.topBar.timeSigNum` dots total):

- The dot row is (re)generated whenever `timeSigNum` changes (on input, and
  on initial load/restore-from-localStorage).
- On each beat, the dot at the current `beatIndexInBar` lights up — amber
  for a normal beat, red for the accented beat (mirroring the existing
  `accent` flag already computed in `scheduleBeat`) — and un-lights on the
  next beat (or after a short delay, matching today's ~80ms pulse timing).
- This requires changes to the JS immediately around `flashBeatIndicator`
  and wherever `timeSigNum` is read/set, but does **not** change any pure
  `LOGIC-BEGIN`/`LOGIC-END` function, so all 28 existing automated tests
  are unaffected.
- `#beatIndicator` remains the container element's ID (now holding N child
  dot elements instead of being the dot itself), so no other code needs to
  change.

## Preserved Constraints

- Still a single self-contained `metronome.html` file — no build step, no
  external fonts, no CDN links, no network calls, no new files (aside from
  this spec/plan).
- Every existing element `id` that the JS references (`metronomeBpm`,
  `rampReadout`, `beatIndicator`, `startStop`, etc.) is unchanged.
- No change to any pure `LOGIC-BEGIN`/`LOGIC-END` function or to
  `tests/logic.test.js` — all 28 tests must continue to pass unmodified.
- No change to app *behavior* other than the beat-dot visualization
  described above (tempo math, persistence, validation, ramp/practice
  logic all stay exactly as they are).

## Out of Scope

- Any new features (this is a pure visual/UX rework of existing
  functionality).
- Light mode / theme toggle (dark only, per this spec).
- Changing the three-tab information architecture.
- Mobile-specific layout beyond what already works via the existing
  responsive `max-width` container (no new breakpoints planned unless
  testing surfaces a real problem).

## Testing / Verification

- Automated: `node --test tests/*.test.js` must still show 28/28 passing
  after the rework (no LOGIC-block changes expected).
- Manual (human, in a real browser — same limitation as the original
  build): visually confirm the dark theme renders correctly, all controls
  are usable and readable, the beat-dot row lights up correctly across a
  few time signatures (e.g. 4/4, 3/4, 7/8) with the accent beat visibly
  distinct, sliders/buttons/checkbox are styled and functional, and no
  existing functionality (ramp, practice, persistence, tap tempo, spacebar
  shortcut) regressed.
