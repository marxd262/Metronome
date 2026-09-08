# Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the four experimental redesigns in `experiments/` plus the current look into `index.html` as five selectable themes sharing one copy of the markup and JavaScript, with a dropdown in the masthead and the choice persisted to `localStorage`.

**Architecture:** A `data-theme` attribute on the document element drives everything. CSS is organised into `@layer base, components, themes` so a theme block always outranks a component rule structurally rather than by specificity. Component rules are written against custom properties; each theme supplies a required token set plus whatever structural overrides it needs. One shared HTML skeleton (`.hero-frame` / `.hero-readout`) serves all five treatments.

**Tech Stack:** Plain HTML/CSS/JS in a single file. Node 18+ (`node --test`) for tests. No bundler, no dependencies, no package.json.

**Spec:** `docs/superpowers/specs/2026-09-07-theme-system-design.md`

## Global Constraints

- Single self-contained `index.html`. No build step, no external CSS/JS file, no network request, no new dependency. Adding any of these fails the task.
- **All CSS must live inside a layer.** An unlayered rule outranks every layered rule regardless of specificity and would silently beat all five themes.
- **No theme may declare `transition` on `.beat-dot`.** The components layer owns that declaration. Violating it causes a permanently stuck `.pulse` class.
- Theme switching must not stop playback, re-render beat dots, or touch `rampRuntime`, `practiceRuntime`, `beatIndexInBar`, or the scheduler.
- No change to the Web Audio scheduler, lookahead timing, or the capture-before-advance pattern in `scheduleBeat`.
- Dark-only. None of the five themes is a light mode.
- `#heroBpm` stays at `var(--font-weight-bold)` (700) in every theme. Do not lower it.
- Every existing id and class the JS queries keeps its current name: `#beatIndicator`, `.beat-dot`, `#heroBpm`, `#heroBpmLabel`, `#rampReadout`, `#practiceReadout`, `.readout`, `.panel`, `.field-group`, `.stepper-row`, `.step-btn`, `.step-5`, `.tapTempo`, `.quick-select-toggle`, `.quick-select-popup`, `.quick-select-option`, `.highlighted`, `.tab-btn`, `.active`, `.accented`, `.pulse`, `.accent`, `.clamped`, `#startStop`, `#topbar`, `#tabs`, `#heroZone`, `#controls`.
- Run `node --test tests/*.test.js` (glob form — the directory form does not discover tests reliably on all platforms).
- The full existing suite is 45 cases. It must stay green at every step.

**Required token set.** Every theme block defines all 23:

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

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `index.html` | Modify | The entire feature: layered stylesheet, shared skeleton, theme wiring |
| `tests/logic.test.js` | Modify | Add `resolveTheme` cases to the existing suite |
| `tests/themes.test.js` | Create | Dependency-free static analysis of the theme blocks in `index.html` |
| `tests/loadLogic.js` | Unchanged | Already extracts the LOGIC block; keeps working as-is |
| `experiments/*.html` | Read-only source | Where the four treatments' CSS is ported from. Not modified. |

---

### Task 1: `resolveTheme` pure LOGIC function

Guards the case where a persisted theme name no longer matches any rule — which would leave the document with no tokens at all, not merely a wrong colour.

**Files:**
- Modify: `index.html` (inside the `// LOGIC-BEGIN` / `// LOGIC-END` block)
- Test: `tests/logic.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `resolveTheme(saved, validThemes, fallback)` → `string`. Returns `saved` when `validThemes` contains it, otherwise `fallback`. Pure; reads no `state`, no DOM, no module-level variable. Used by Task 3.

- [ ] **Step 1: Write the failing tests**

Append to `tests/logic.test.js`:

```js
test('resolveTheme passes through a theme in the valid list', () => {
  const { resolveTheme } = loadLogic(['resolveTheme']);
  assert.equal(resolveTheme('pulse-field', ['classic', 'pulse-field'], 'classic'), 'pulse-field');
});

test('resolveTheme falls back for a theme not in the valid list', () => {
  const { resolveTheme } = loadLogic(['resolveTheme']);
  assert.equal(resolveTheme('retired-theme', ['classic', 'pulse-field'], 'classic'), 'classic');
});

test('resolveTheme falls back for null, undefined and non-strings', () => {
  const { resolveTheme } = loadLogic(['resolveTheme']);
  assert.equal(resolveTheme(null, ['classic'], 'classic'), 'classic');
  assert.equal(resolveTheme(undefined, ['classic'], 'classic'), 'classic');
  assert.equal(resolveTheme(42, ['classic'], 'classic'), 'classic');
  assert.equal(resolveTheme({}, ['classic'], 'classic'), 'classic');
});

test('resolveTheme falls back when the valid list is empty or missing', () => {
  const { resolveTheme } = loadLogic(['resolveTheme']);
  assert.equal(resolveTheme('classic', [], 'classic'), 'classic');
  assert.equal(resolveTheme('classic', null, 'classic'), 'classic');
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node --test tests/*.test.js`
Expected: FAIL — `loadLogic` throws because `resolveTheme` is not defined in the LOGIC block.

- [ ] **Step 3: Write the minimal implementation**

Add inside the LOGIC block in `index.html`, immediately before `// LOGIC-END`:

```js
function resolveTheme(saved, validThemes, fallback) {
  if (!Array.isArray(validThemes)) return fallback;
  return validThemes.includes(saved) ? saved : fallback;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `node --test tests/*.test.js`
Expected: PASS, 49 cases (45 existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/logic.test.js
git commit -m "feat: add resolveTheme pure function for theme name validation"
```

---

### Task 2: Restructure the stylesheet into cascade layers with Classic as the only theme

The whole current stylesheet moves into layers and its hardcoded values become the `classic` token block. **No visual change whatsoever** — this task is pure restructuring, and the way to verify it is a side-by-side comparison against the pre-change build.

**Files:**
- Modify: `index.html` (the `<style>` block only)

**Interfaces:**
- Consumes: nothing.
- Produces: the `@layer base, components, themes` structure; the `:root[data-theme="classic"]` token block; component rules written against the token names listed in Global Constraints. Tasks 5–8 add sibling theme blocks.

- [ ] **Step 1: Capture a baseline for comparison**

Before editing, open `index.html` in a browser and screenshot all three tabs (Metronome, Ramp, Practice) stopped. Keep these — Step 5 compares against them.

- [ ] **Step 2: Declare the layer order at the very top of `<style>`**

The first statement in the stylesheet, before anything else:

```css
@layer base, components, themes;
```

- [ ] **Step 3: Move every existing rule into a layer**

Wrap the existing content in layer blocks. Nothing may be left unlayered.

- `@layer base { … }` — `*{box-sizing}`, `body`, the `@media (prefers-reduced-motion: reduce)` token overrides, `button { font: inherit; cursor: pointer }`, the shared `:focus-visible` rule, and the default token values on bare `:root`.
- `@layer components { … }` — every component rule: `h1`, `#topbar`, `#tabs`, `.tab-btn`, `.panel`, `#heroZone`, `#heroBpm`, `#heroBpmLabel`, `label`, `.field-group`, `input`, `select`, `.stepper-row`, `.step-group`, `.step-btn`, `.tapTempo`, `.quick-select-*`, `#controls`, `#startStop`, `#beatIndicator`, `.beat-dot`, `.readout`, `.phase-segment`, and the keyframes' consumers.
- `@layer themes { … }` — initially just the `classic` block from Step 4.

`@keyframes` are not affected by layers and may sit at the top level of the stylesheet, outside any layer.

- [ ] **Step 4: Add the Classic token block inside `@layer themes`**

These are the current values, moved verbatim — this is why Classic looks unchanged:

```css
:root[data-theme="classic"] {
  --bg:                #15151a;
  --panel:             #1e1e25;
  --overlay:           #2a2a33;
  --divider:           #2a2a33;
  --text:              #e8e8ec;
  --text-muted:        #9ba0a8;
  --text-dim:          #666672;
  --accent:            #f5a623;
  --accent-beat:       #e5484d;
  --on-accent:         #1a1305;
  --accent-glow:       color-mix(in srgb, var(--accent) 16%, transparent);
  --dot-idle:          #666672;
  --dot-pulse-bg:      var(--accent);
  --dot-accent-bg:     var(--accent-beat);
  --dot-strike:        0.05s;
  --dot-decay:         0.05s;
  --dot-ease:          ease;
  --content-max-width: 480px;
  --radius:            8px;
  --radius-panel:      8px;
  --font-ui:      system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono:    ui-monospace, "Cascadia Mono", "SFMono-Regular", "SF Mono", Menlo, Consolas, monospace;
  --font-display: var(--font-ui);
}
```

Classic's `--dot-strike` and `--dot-decay` are both `0.05s` because that is today's `--duration-instant`, the duration the current `.beat-dot` background transition uses. Setting them equal reproduces the existing symmetric flash exactly. Classic does not get strike-and-decay; the other four do.

`--font-mono` and `--radius-panel` are unused by Classic but required by the contract, so they are defined rather than omitted.

- [ ] **Step 5: Replace the `.beat-dot` transition with the locked contract**

In `@layer components`, the `.beat-dot` rule's transition becomes exactly:

```css
.beat-dot {
  transition:
    background-color var(--dot-decay) var(--dot-ease),
    box-shadow       var(--dot-decay) var(--dot-ease),
    transform        var(--dot-decay) var(--dot-ease),
    filter           var(--duration-fast) var(--ease-standard),
    border-color     var(--duration-fast) var(--ease-standard);
}

.beat-dot.pulse       { background: var(--dot-pulse-bg); transition-duration: var(--dot-strike); }
.beat-dot.pulse.accent{ background: var(--dot-accent-bg); }
.beat-dot.accented    { border-color: var(--accent-beat); }
```

`filter` is in the list because Classic's `button.beat-dot:hover` uses `filter: brightness(1.25)` and transitions it today — it stays on `--duration-fast` rather than `--dot-decay` so Classic's hover timing is unchanged. `transition-duration` on `.pulse` applies to every listed property, which is what keeps the strike short and `transitionend` prompt.

- [ ] **Step 6: Point `body` at the token**

```css
body { max-width: var(--content-max-width); }
```

- [ ] **Step 7: Set the attribute so Classic actually applies**

Add `data-theme="classic"` to the `<html>` element as a static attribute. Task 3 makes it dynamic.

- [ ] **Step 8: Run the tests**

Run: `node --test tests/*.test.js`
Expected: PASS, 49 cases. (No test covers CSS yet — this confirms nothing regressed in the LOGIC block.)

- [ ] **Step 9: Verify visually — no change**

Open `index.html`. Compare all three tabs against the Step 1 screenshots. Start playback on each tab and confirm the beat dots flash exactly as before and **no dot stays lit after stopping**. Any visible difference is a bug in this task, not an improvement.

- [ ] **Step 10: Commit**

```bash
git add index.html
git commit -m "refactor: restructure stylesheet into cascade layers with classic theme tokens"
```

---

### Task 3: Shared skeleton, theme dropdown, and JS wiring

Adds everything the four new themes will attach to. Classic gains the dropdown and nothing else.

**Files:**
- Modify: `index.html` (HTML body, app `<script>` block, and `@layer components` for the new elements)

**Interfaces:**
- Consumes: `resolveTheme` (Task 1).
- Produces:
  - `THEMES` — array of `{ value, label }`, initially `[{ value: 'classic', label: 'Classic' }]`.
  - `applyTheme(name)` → `undefined`. Sets `document.documentElement.dataset.theme`. No other side effect.
  - `setTransportState(playing)` → `undefined`. Sets `#startStop` text and `.is-playing`, and toggles `.playing` on `body`.
  - `triggerBeatFlash(accent)` → `undefined`. Restarts the `#beatFlash` animation; no-op when the element is absent or `display:none`.
  - `.hero-frame`, `.hero-readout`, `#beatFlash`, `#masthead`, `#themeSelect` — the hooks Tasks 5–8 style.

- [ ] **Step 1: Wrap the masthead and add the dropdown**

Replace `<h1>Guitar Practice&nbsp;Metronome</h1>` with:

```html
  <header id="masthead">
    <h1>Guitar Practice&nbsp;Metronome</h1>
    <select id="themeSelect" aria-label="Theme"></select>
  </header>
```

The `<option>` elements are populated from `THEMES` in JS (Step 4) so the select and the theme list can never disagree.

- [ ] **Step 2: Restructure the hero zone**

Replace the existing `#heroZone` block with:

```html
  <div id="heroZone">
    <div class="hero-frame">
      <div id="beatFlash" aria-hidden="true"></div>
      <div class="hero-readout">
        <div id="heroBpm">120</div>
        <div id="heroBpmLabel">BPM</div>
      </div>
      <div id="beatIndicator"></div>
    </div>
    <div id="rampReadout" class="readout" hidden></div>
    <div id="practiceReadout" class="readout" hidden></div>
  </div>
```

Note the order change: `#beatIndicator` now comes *after* the readout in source order. Classic showed it above, so Classic restores that with `order` in Step 3 — not by changing this markup.

- [ ] **Step 3: Add base styling for the new elements**

In `@layer components`:

```css
#masthead {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xl);
}

#masthead h1 { flex: 1; margin: 0; }

#themeSelect { flex: 0 0 auto; }

.hero-frame { position: relative; }

#beatFlash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  #beatFlash { animation: none !important; }
}
```

Then, inside the `classic` theme block in `@layer themes`, keep Classic's centred title and hide the flash:

```css
:root[data-theme="classic"] .hero-frame  { display: flex; flex-direction: column; }
:root[data-theme="classic"] #beatIndicator { order: -1; }
:root[data-theme="classic"] #beatFlash   { display: none; }
:root[data-theme="classic"] #masthead h1 { text-align: center; }
```

- [ ] **Step 4: Add the theme roster and `applyTheme`**

In the app `<script>` block, above `bindTopBar`:

```js
const THEMES = [
  { value: 'classic', label: 'Classic' },
];

function applyTheme(name) {
  document.documentElement.dataset.theme = name;
}

function populateThemeSelect() {
  const select = document.getElementById('themeSelect');
  select.innerHTML = '';
  THEMES.forEach((theme) => {
    const option = document.createElement('option');
    option.value = theme.value;
    option.textContent = theme.label;
    select.appendChild(option);
  });
}
```

- [ ] **Step 5: Add `theme` to `DEFAULT_STATE`**

```js
topBar: { subdivision: 'none', soundStyle: 'click', volume: 80, activeTab: 'metronome', theme: 'classic' },
```

No migration is needed: `deserializeSettings` merges each saved section over `DEFAULT_STATE`, so a blob predating this feature has no `theme` key and receives `'classic'`.

- [ ] **Step 6: Bind the dropdown**

Inside `bindTopBar()`, alongside the existing listeners:

```js
  const themeSelect = document.getElementById('themeSelect');
  themeSelect.addEventListener('change', () => {
    state.topBar.theme = themeSelect.value;
    applyTheme(state.topBar.theme);
    persistState();
  });
```

This deliberately does **not** call `stopPlayback()`, `renderBeatDots()`, or `switchTab()`. Switching theme mid-playback must not interrupt audio.

- [ ] **Step 7: Apply the saved theme on load**

In `refreshAllInputsFromState()`, before the existing `activeTab` handling:

```js
  const themeValues = THEMES.map((t) => t.value);
  state.topBar.theme = resolveTheme(state.topBar.theme, themeValues, 'classic');
  applyTheme(state.topBar.theme);
  document.getElementById('themeSelect').value = state.topBar.theme;
```

Call `populateThemeSelect()` once before `bindTopBar()` runs, so the select has options to bind to and to set `.value` against.

- [ ] **Step 8: Add the shared transport and flash helpers**

Immediately above `function startPlayback()`:

```js
function setTransportState(playing) {
  const btn = document.getElementById('startStop');
  btn.textContent = playing ? 'Stop' : 'Start';
  btn.classList.toggle('is-playing', playing);
  document.body.classList.toggle('playing', playing);
}

function triggerBeatFlash(accent) {
  const flash = document.getElementById('beatFlash');
  if (!flash) return;
  flash.classList.remove('beat', 'beat-accent');
  void flash.offsetWidth;
  flash.classList.add('beat');
  if (accent) flash.classList.add('beat-accent');
}
```

Replace `document.getElementById('startStop').textContent = 'Stop';` in `startPlayback` with `setTransportState(true);` and `document.getElementById('startStop').textContent = 'Start';` in `stopPlayback` with `setTransportState(false);`.

Add `triggerBeatFlash(accent);` as the first statement inside `flashBeatIndicator`, before the `const dots = …` line. `flashBeatIndicator` is only ever called from inside `scheduleBeat`'s deferred callback, after that callback's `isPlaying` and `activeTab` guards — so no new gating is required and the capture-before-advance pattern is untouched.

- [ ] **Step 9: Run the tests**

Run: `node --test tests/*.test.js`
Expected: PASS, 49 cases.

- [ ] **Step 10: Verify in a browser**

Open `index.html`. Confirm: the dropdown appears at the right of the masthead showing "Classic"; the title is still centred; all three tabs render as before; playback works on each and no dot stays lit after stopping; reloading preserves the tab and all values.

- [ ] **Step 11: Commit**

```bash
git add index.html
git commit -m "feat: add theme skeleton, masthead dropdown and persistence wiring"
```

---

### Task 4: Static analysis test for theme blocks

The guard that makes adding four more themes safe. Written before the themes it protects.

**Files:**
- Create: `tests/themes.test.js`

**Interfaces:**
- Consumes: `index.html` as text. No import from `loadLogic`.
- Produces: coverage that grows automatically as Tasks 5–8 add themes — the theme list is derived from the file, not hardcoded.

- [ ] **Step 1: Write the test file**

Create `tests/themes.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// CSS analysis runs against the stylesheet with comments stripped, so a comment
// mentioning a selector can never be mistaken for the selector itself.
const STYLE = HTML
  .slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'))
  .replace(/\/\*[\s\S]*?\*\//g, '');

const REQUIRED_TOKENS = [
  '--bg', '--panel', '--overlay', '--divider',
  '--text', '--text-muted', '--text-dim',
  '--accent', '--accent-beat', '--on-accent', '--accent-glow',
  '--dot-idle', '--dot-pulse-bg', '--dot-accent-bg',
  '--dot-strike', '--dot-decay', '--dot-ease',
  '--content-max-width',
  '--radius', '--radius-panel',
  '--font-ui', '--font-mono', '--font-display',
];

// Returns the contents of the balanced { ... } block starting at or after `from`.
function blockAt(source, from) {
  const open = source.indexOf('{', from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  return null;
}

// Finds only the token block — `:root[data-theme="x"] {` — never a descendant
// rule like `:root[data-theme="x"] .hero-frame {`, which appears earlier in the
// file and would otherwise be measured instead, failing every token assertion.
// Uses a literal needle plus a literal regex: regexes built from strings need
// doubled backslashes and fail silently when they lose one.
function themeBlock(theme) {
  const needle = `:root[data-theme="${theme}"]`;
  let i = 0;
  while ((i = STYLE.indexOf(needle, i)) !== -1) {
    if (/^\s*\{/.test(STYLE.slice(i + needle.length))) {
      return blockAt(STYLE, i + needle.length);
    }
    i += needle.length;
  }
  return null;
}

// Exact property match, so `--text` never matches `--text-muted`. No regex, and
// it tolerates a final declaration with no trailing semicolon.
function declaredValue(block, token) {
  for (const declaration of block.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    if (declaration.slice(0, colon).trim() === token) {
      return declaration.slice(colon + 1).trim();
    }
  }
  return null;
}

// Every rule whose *selector* contains `substring`.
function rulesWithSelector(substring) {
  const found = [];
  let i = 0;
  while ((i = STYLE.indexOf(substring, i)) !== -1) {
    let start = i;
    while (start > 0 && !'{};'.includes(STYLE[start - 1])) start--;
    const brace = STYLE.indexOf('{', i);
    if (brace === -1) break;
    const selector = STYLE.slice(start, brace).trim();
    if (selector.includes(substring)) {
      found.push({ selector, body: blockAt(STYLE, brace) || '' });
    }
    i += substring.length;
  }
  return found;
}

// The roster comes from the JS THEMES array, which is what populates the select
// at runtime — the <select> is empty in the source file.
function rosterValues() {
  const arr = HTML.match(/const THEMES = \[([\s\S]*?)\];/);
  if (!arr) return [];
  return [...arr[1].matchAll(/value:\s*'([^']+)'/g)].map((m) => m[1]);
}

function definedThemes() {
  return [...STYLE.matchAll(/:root\[data-theme="([^"]+)"\]\s*\{/g)].map((m) => m[1]);
}

test('the theme roster is non-empty', () => {
  assert.ok(rosterValues().length > 0, 'THEMES array has no entries');
});

test('every theme in the roster has a token block', () => {
  for (const theme of rosterValues()) {
    assert.ok(themeBlock(theme), `no :root[data-theme="${theme}"] block for "${theme}"`);
  }
});

test('every defined theme block is in the roster', () => {
  const roster = rosterValues();
  for (const theme of new Set(definedThemes())) {
    assert.ok(roster.includes(theme), `theme "${theme}" is styled but not selectable`);
  }
});

test('every theme defines the full required token set', () => {
  for (const theme of rosterValues()) {
    const block = themeBlock(theme);
    for (const token of REQUIRED_TOKENS) {
      assert.ok(declaredValue(block, token), `theme "${theme}" is missing ${token}`);
    }
  }
});

test('every theme pulses to a different colour than its idle dot', () => {
  for (const theme of rosterValues()) {
    const block = themeBlock(theme);
    const idle = declaredValue(block, '--dot-idle');
    const pulse = declaredValue(block, '--dot-pulse-bg');
    assert.notEqual(pulse, idle,
      `theme "${theme}": --dot-pulse-bg equals --dot-idle, so adding .pulse would not ` +
      'change a transitioned property and transitionend would never fire');
  }
});

test('no theme overrides the locked .beat-dot transition', () => {
  for (const rule of rulesWithSelector('.beat-dot')) {
    if (!rule.selector.includes('[data-theme')) continue;
    assert.ok(!/(?:^|[;{\s])transition\s*:/.test(rule.body),
      `"${rule.selector}" declares transition on .beat-dot; the components layer owns it`);
  }
});
```

- [ ] **Step 2: Run the tests and verify they pass with one theme**

Run: `node --test tests/*.test.js`
Expected: PASS, 55 cases (49 + 6 new). Classic is the only theme and satisfies every assertion.

- [ ] **Step 3: Verify the guard actually catches violations**

Temporarily add `:root[data-theme="classic"] .beat-dot { transition: none; }` inside `@layer themes`, then run `node --test tests/*.test.js`. Expected: FAIL on "no theme overrides the locked .beat-dot transition". Also temporarily set `--dot-pulse-bg: #666672;` (equal to `--dot-idle`) and confirm the pulse-colour test fails. **Revert both** before continuing. A guard never seen to fail is not known to work.

- [ ] **Step 4: Commit**

```bash
git add tests/themes.test.js
git commit -m "test: add static analysis guarding the theme token and transition contracts"
```

---

### Task 5: Pulse Engine theme

**Files:**
- Modify: `index.html`
- Source: `experiments/01-pulse-engine.html` (read-only reference)

**Interfaces:**
- Consumes: `THEMES`, `applyTheme`, `.hero-frame`, `.hero-readout`, `#beatFlash` (Task 3).
- Produces: nothing later tasks depend on. Tasks 5–8 are independent of each other.

- [ ] **Step 1: Add the theme to the roster**

```js
const THEMES = [
  { value: 'classic',      label: 'Classic' },
  { value: 'pulse-engine', label: 'Pulse Engine' },
];
```

- [ ] **Step 2: Add the token block inside `@layer themes`**

```css
:root[data-theme="pulse-engine"] {
  --bg:                #07070a;
  --panel:             #1a1a20;
  --overlay:           #25252d;
  --divider:           #2e2e38;
  --text:              #edeef2;
  --text-muted:        #a2a7b0;
  --text-dim:          #52525e;
  --accent:            #ffab1f;
  --accent-beat:       #ff4b4b;
  --on-accent:         #1a1000;
  --accent-glow:       color-mix(in srgb, var(--accent) 55%, transparent);
  --dot-idle:          #2e2e38;
  --dot-pulse-bg:      var(--accent);
  --dot-accent-bg:     var(--accent-beat);
  --dot-strike:        30ms;
  --dot-decay:         340ms;
  --dot-ease:          cubic-bezier(0.15, 0.75, 0.3, 1);
  --content-max-width: 500px;
  --radius:            6px;
  --radius-panel:      14px;
  --font-ui:      system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono:    ui-monospace, "Cascadia Mono", "SFMono-Regular", "SF Mono", Menlo, Consolas, monospace;
  --font-display: var(--font-mono);

  /* theme-private */
  --chassis: #121217;
  --screen:  #050508;
  --raised:  #1a1a20;
  --key-top: #25252d;
  --sunken:  #0b0b0f;
  --beat-glow: color-mix(in srgb, var(--accent-beat) 55%, transparent);
  --bevel:  inset 0 1px 0 rgba(255, 255, 255, 0.07);
  --recess: inset 0 2px 6px rgba(0, 0, 0, 0.75);
  --lift:   0 10px 26px rgba(0, 0, 0, 0.55);
}
```

- [ ] **Step 3: Port the structural rules**

From the `<style>` block of `experiments/01-pulse-engine.html`, bring across the rules for: `body` background gradient, `h1`, `#topbar`, `#tabs`/`.tab-btn` (the segmented control), `.display-shell`, `.display-screen` and its scanline `::after`, `#beatFlash` + `@keyframes shell-strike`, `#heroBpm`, `#heroBpmLabel`, `#beatIndicator` (the recessed housing), `.beat-dot` geometry, `.readout`, `.phase-segment`, `.panel`, `body.playing` performance mode, the input/select/range treatments, `.step-btn`/`.tapTempo`/`.quick-select-toggle`, the popup, `#controls`, `#startStop` + `@keyframes transport-ring`.

Rewrite each selector as `:root[data-theme="pulse-engine"] <selector>`, place them all inside `@layer themes`, and apply these mappings:

| In `experiments/01-pulse-engine.html` | Here |
|---|---|
| `.display-shell` | `.hero-frame` |
| `.display-screen` | `.hero-readout` |
| hardcoded colours already in the token block above | the `var(--token)` name |
| the `.beat-dot { transition: … }` declaration | **omit entirely** — the components layer owns it |
| `#beatIndicator` inside `.display-shell` | `.hero-frame #beatIndicator` |

`@keyframes` stay at the stylesheet's top level, outside every layer, and must be given theme-unique names (`pulse-engine-shell-strike`, `pulse-engine-transport-ring`) so the four themes cannot collide.

Pulse Engine's hero order matches the source order from Task 3 (readout, then beat strip), so it needs no `order` override.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/*.test.js`
Expected: PASS, 55 cases. The theme tests now cover Pulse Engine as well as Classic — if the token block is incomplete or declares a `.beat-dot` transition, they fail here.

- [ ] **Step 5: Verify in a browser**

Select "Pulse Engine". Check all three tabs stopped; start playback on each and confirm the bezel flashes on the beat, the bars strike and decay, and **no bar stays lit after stopping**. Confirm the accent editor still toggles, the quick-select popups open and close, performance mode dims the chassis and restores on hover and on keyboard focus, and `#startStop` stays at full presentation while playing. Reload and confirm the theme persists. Switch theme while playing and confirm audio is uninterrupted. Narrow the window and confirm no stepper row overflows its panel.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add Pulse Engine theme"
```

---

### Task 6: Kinetic Type theme

**Files:**
- Modify: `index.html`
- Source: `experiments/02-kinetic-type.html` (read-only reference)

**Interfaces:**
- Consumes: `THEMES`, `applyTheme`, `.hero-frame`, `.hero-readout`, `#beatFlash` (Task 3).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Add the theme to the roster**

Append to `THEMES`: `{ value: 'kinetic-type', label: 'Kinetic Type' },`

- [ ] **Step 2: Add the token block inside `@layer themes`**

```css
:root[data-theme="kinetic-type"] {
  --bg:                #08080a;
  --panel:             #0f0f12;
  --overlay:           #1e1e23;
  --divider:           #2a2a31;
  --text:              #f4f4f7;
  --text-muted:        #8b8b96;
  --text-dim:          #4c4c57;
  --accent:            #ffb02e;
  --accent-beat:       #ff5252;
  --on-accent:         #150d00;
  --accent-glow:       color-mix(in srgb, var(--accent) 45%, transparent);
  --dot-idle:          #2a2a31;
  --dot-pulse-bg:      var(--accent);
  --dot-accent-bg:     var(--accent-beat);
  --dot-strike:        30ms;
  --dot-decay:         400ms;
  --dot-ease:          cubic-bezier(0.1, 0.8, 0.25, 1);
  --content-max-width: 640px;
  --radius:            3px;
  --radius-panel:      0;
  --font-ui:      system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono:    ui-monospace, "Cascadia Mono", "SFMono-Regular", "SF Mono", Menlo, Consolas, monospace;
  --font-display: var(--font-ui);

  /* theme-private */
  --ink:        #f4f4f7;
  --rule-faint: #1a1a1f;
  --dot-accent-idle: #4c4c57;
}
```

- [ ] **Step 3: Port the structural rules**

From `experiments/02-kinetic-type.html`, bring across: `body`, `h1` + its `::after` rule, `#topbar`, `#tabs`/`.tab-btn` with the `::after` underline block, `#heroZone`, `#beatFlash` + `@keyframes rule-flash`, `.hero-type`, `#heroBpm`, `#heroBpmLabel` (the vertical unit label), `#beatIndicator`, `.beat-dot` geometry, `.readout`, `.phase-segment`, `.panel`, the spec-sheet `.field-group` / `.panel > label` grid and its `max-width: 560px` fallback, `body.playing`, inputs, buttons, popup, `#startStop`.

Rewrite each selector as `:root[data-theme="kinetic-type"] <selector>`, place inside `@layer themes`, and apply:

| In `experiments/02-kinetic-type.html` | Here |
|---|---|
| `.hero-type` | `.hero-frame` |
| the number + vertical-label pair | `.hero-readout` (`display: flex; align-items: flex-end`) |
| `.beat-dot { transition: … }` | **omit** — components layer owns it |
| `@keyframes rule-flash` | rename `kinetic-type-rule-flash` |

`.hero-frame` here is the shared measure line: `display: flex; align-items: flex-end; padding-bottom: var(--space-2xs); border-bottom: 1px solid var(--divider);` with `#beatIndicator` as `flex: 1; justify-content: flex-end`.

Keep `#heroBpm { min-width: 3ch }` — it stops the vertical unit label sliding sideways as the digit count changes during a ramp.

Keep the accent-as-height treatment: `.beat-dot.accented { height: 54px }` against a 30px default. `height` is not in the locked transition list, so toggling an accent resizes the tick instantly rather than animating. **Do not add `height` to the transition** — that would mean restating the `transition` shorthand, which the contract forbids. Set geometry only:

```css
:root[data-theme="kinetic-type"] .beat-dot {
  height: 30px;
  /* geometry only — the transition shorthand stays in the components layer */
}
```

A snapping accent toggle is a far smaller cost than risking a stuck `.pulse`.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/*.test.js`
Expected: PASS, 55 cases.

- [ ] **Step 5: Verify in a browser**

Select "Kinetic Type". All three tabs stopped; playback on each; the top rule flashes on the beat; ticks strike and decay; **no tick stays lit after stopping**. Confirm the hero numeral does not shift the vertical BPM label as the tempo changes in Ramp mode. Confirm the spec-sheet layout at wide width and the stacked fallback below 560px. Check performance mode restores on hover and focus, and that de-emphasized text stays readable. Reload persists; switching theme mid-playback does not interrupt audio.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add Kinetic Type theme"
```

---

### Task 7: Pulse Field theme

**Files:**
- Modify: `index.html`
- Source: `experiments/03-pulse-field.html` (read-only reference)

**Interfaces:**
- Consumes: `THEMES`, `applyTheme`, `.hero-frame`, `.hero-readout`, `#beatFlash` (Task 3).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Add the theme to the roster**

Append to `THEMES`: `{ value: 'pulse-field', label: 'Pulse Field' },`

- [ ] **Step 2: Add the token block inside `@layer themes`**

```css
:root[data-theme="pulse-field"] {
  --bg:                #08080b;
  --panel:             #17171e;
  --overlay:           #1f1f28;
  --divider:           rgba(255, 255, 255, 0.07);
  --text:              #f2f3f7;
  --text-muted:        #9096a0;
  --text-dim:          #4e4e5c;
  --accent:            #ffa726;
  --accent-beat:       #ff5a5a;
  --on-accent:         #180f00;
  --accent-glow:       color-mix(in srgb, var(--accent) 30%, transparent);
  --dot-idle:          #383846;
  --dot-pulse-bg:      var(--accent);
  --dot-accent-bg:     var(--accent-beat);
  --dot-strike:        30ms;
  --dot-decay:         520ms;
  --dot-ease:          cubic-bezier(0.1, 0.82, 0.25, 1);
  --content-max-width: 520px;
  --radius:            10px;
  --radius-panel:      20px;
  --font-ui:      system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono:    ui-monospace, "Cascadia Mono", "SFMono-Regular", "SF Mono", Menlo, Consolas, monospace;
  --font-display: var(--font-ui);

  /* theme-private */
  --ink:          #f2f3f7;
  --accent-bloom: color-mix(in srgb, var(--accent) 16%, transparent);
  --beat-bloom:   color-mix(in srgb, var(--accent-beat) 20%, transparent);
  --shadow-panel: 0 20px 44px -20px rgba(0, 0, 0, 0.95);
}
```

- [ ] **Step 3: Port the structural rules**

From `experiments/03-pulse-field.html`: `body` with its radial ground, `h1` and `h1 span`, `#topbar`, the `#tabs` pill group and `.tab-btn.active` inverse pill, `#heroZone`, `#beatFlash` + `@keyframes field-bloom`, `#heroBpm`, `#heroBpmLabel`, `#beatIndicator`, `.beat-dot` geometry, `.readout`, `.phase-segment`, `.panel` (the elevated tinted surface), `body.playing`, inputs, buttons, popup, `#controls`, `#startStop`.

Rewrite each selector as `:root[data-theme="pulse-field"] <selector>`, place inside `@layer themes`, and apply:

| In `experiments/03-pulse-field.html` | Here |
|---|---|
| `#heroZone { position: relative; isolation: isolate }` | move to `.hero-frame` — that is what `#beatFlash` is positioned against |
| `.beat-dot { transition: … }` | **omit** — components layer owns it |
| `@keyframes field-bloom` | rename `pulse-field-bloom` |

This theme shows the beat dots above the readout, so add:

```css
:root[data-theme="pulse-field"] .hero-frame { display: flex; flex-direction: column; }
:root[data-theme="pulse-field"] #beatIndicator { order: -1; }
```

Keep `#beatFlash { width: min(150%, 100vw) }` exactly — the `100vw` cap is what stops a wide bloom introducing a horizontal scrollbar on a phone.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/*.test.js`
Expected: PASS, 55 cases.

- [ ] **Step 5: Verify in a browser**

Select "Pulse Field". All three tabs stopped; playback on each; the canvas blooms on the beat and blooms differently on accents; orbs strike and decay; **no orb stays lit after stopping**. Confirm the beat dots sit above the numeral. Resize to a narrow phone width and confirm **no horizontal scrollbar appears** while playing — this is the specific risk of the full-bleed bloom. Check performance mode, reload persistence, and mid-playback theme switching.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add Pulse Field theme"
```

---

### Task 8: Grid Console theme

The only theme that changes the page's column count, so it carries the most layout risk.

**Files:**
- Modify: `index.html`
- Source: `experiments/04-grid-console.html` (read-only reference)

**Interfaces:**
- Consumes: `THEMES`, `applyTheme`, `.hero-frame`, `.hero-readout`, `#beatFlash` (Task 3).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Add the theme to the roster**

Append to `THEMES`: `{ value: 'grid-console', label: 'Grid Console' },`

- [ ] **Step 2: Add the token block inside `@layer themes`**

```css
:root[data-theme="grid-console"] {
  --bg:                #050507;
  --panel:             #101014;
  --overlay:           #1d1d23;
  --divider:           #33333d;
  --text:              #e9eaef;
  --text-muted:        #9aa0aa;
  --text-dim:          #5a5a67;
  --accent:            #ffb020;
  --accent-beat:       #ff4f4f;
  --on-accent:         #170e00;
  --accent-glow:       color-mix(in srgb, var(--accent) 40%, transparent);
  --dot-idle:          #131318;
  --dot-pulse-bg:      var(--accent);
  --dot-accent-bg:     var(--accent-beat);
  --dot-strike:        30ms;
  --dot-decay:         280ms;
  --dot-ease:          cubic-bezier(0.15, 0.8, 0.3, 1);
  --content-max-width: 880px;
  --radius:            2px;
  --radius-panel:      0;
  --font-ui:      system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono:    ui-monospace, "Cascadia Mono", "SFMono-Regular", "SF Mono", Menlo, Consolas, monospace;
  --font-display: var(--font-mono);

  /* theme-private */
  --field:      #0a0a0d;
  --rule-faint: #26262e;
  --key-bg:     #1d1d23;
}
```

- [ ] **Step 3: Port the structural rules**

From `experiments/04-grid-console.html`: `body`, `h1` + `h1 span` + `h1::after`, `#topbar` (the bordered rail with its cell dividers), `#tabs`/`.tab-btn`, `#heroZone`, `.console-cell--primary` with its register-mark `::before`/`::after`, `#beatFlash` + `@keyframes cell-strike`, `#heroBpm`, `#heroBpmLabel`, `.console-cell--beats`, `#beatIndicator`, `.beat-dot` geometry, `.readout`, `.phase-segment`, `.panel`, the `.field-group` / `.panel > label` table grid and its `max-width: 560px` fallback, `body.playing`, inputs, buttons, popup, `#startStop`, and the `@media (min-width: 880px)` two-column block.

Rewrite each selector as `:root[data-theme="grid-console"] <selector>`, place inside `@layer themes`, and apply:

| In `experiments/04-grid-console.html` | Here |
|---|---|
| `#heroZone` border/background | `.hero-frame` |
| `.console-cell--primary` | `.hero-readout` |
| `.console-cell--beats` | `.hero-frame #beatIndicator` (give it the cell's `border-top`, padding and background) |
| `.beat-dot { transition: … }` | **omit** — components layer owns it |
| `@keyframes cell-strike` | rename `grid-console-cell-strike` |

Two details that were bugs found during the experiments and must survive the port:

```css
/* min-width:0 lets the row fit its grid track instead of overflowing the panel;
   wrap is the safety valve so the input can never be squeezed to zero width. */
:root[data-theme="grid-console"] .stepper-row {
  display: flex; flex-wrap: wrap; gap: 3px; align-items: stretch; min-width: 0;
}
:root[data-theme="grid-console"] .stepper-row input[type="number"] {
  flex: 1 1 4rem; min-width: 3.5rem;
}
```

and in the `@media (min-width: 880px)` block, the parameter column gets the extra room:

```css
grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
```

The two-column block places `#masthead` (not `h1`) at `grid-area: 1 / 1 / 2 / 3` — Task 3 wrapped the title, so the grid areas must target the wrapper.

The `.quick-select-popup` is `position: fixed` and appended to `document.body`. Fixed-position elements do not participate in grid layout, so making `body` a grid container at ≥880px does not disturb it. Confirm this in Step 5 rather than assuming it.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/*.test.js`
Expected: PASS, 55 cases.

- [ ] **Step 5: Verify in a browser**

Select "Grid Console". Above 880px, confirm the two-column layout with the readout in the right column and that it stays in view while the Practice panel is scrolled. Below 880px, confirm it collapses to one column. **At both widths, confirm no stepper row overflows its panel and no number input is squeezed to zero width** — this was a real bug in the experiment and is the highest-risk part of this task. Open a quick-select popup at ≥880px and confirm it positions correctly and is not affected by the body grid. Then all three tabs, playback on each, cell border flashes on the beat, **no cell stays lit after stopping**, performance mode, reload persistence, mid-playback theme switching.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add Grid Console theme"
```

---

### Task 9: Full cross-theme verification and retire `experiments/`

The spec lists retiring `experiments/` as a separate commit gated on browser verification. This task is that gate.

**Files:**
- Delete: `experiments/` (5 files)

- [ ] **Step 1: Walk the full manual matrix**

Work through the "Manual (human, in a real browser)" section of `docs/superpowers/specs/2026-09-07-theme-system-design.md` in full: all five themes × all three modes, plus the cross-theme checks. Do not skip the stuck-dot check on any theme — it is the one failure the automated tests can only partially guard.

- [ ] **Step 2: Verify the pre-feature settings path**

In devtools, set `localStorage.guitarMetronomeSettings` to a blob captured from the pre-merge build (one with no `theme` key), reload, and confirm the app opens on Classic with every other setting intact.

- [ ] **Step 3: Verify reduced motion**

Enable `prefers-reduced-motion: reduce` (devtools rendering panel) and confirm in every theme that the beat flash and the transport ring do not animate, while playback and the dot pulse still work.

- [ ] **Step 4: Run the full suite one final time**

Run: `node --test tests/*.test.js`
Expected: PASS, 55 cases.

- [ ] **Step 5: Delete the experiments folder**

```bash
git rm -r experiments
git commit -m "chore: retire experiments folder now that themes are merged"
```

- [ ] **Step 6: Update CLAUDE.md**

The "Architecture" section describes a single `<style>` block. Add a short subsection describing the `@layer base, components, themes` structure, the required token set, and the locked `.beat-dot` transition contract — the last of these is the rule a future contributor is most likely to break unknowingly.

```bash
git add CLAUDE.md
git commit -m "docs: describe the theme layer structure and beat-dot transition contract"
```

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: the five themes → Tasks 2, 5–8; the shared skeleton → Task 3; cascade layers → Task 2; the beat-dot contract → Task 2 (declaration) and Task 4 (enforcement); the required token set → Task 4 (enforcement) and each theme task (definition); state and persistence → Task 3; `resolveTheme` → Task 1; the dropdown → Task 3; Classic's faithfulness → Task 2 Step 9 and Task 3 Step 10; performance mode and the beat flash → Task 3 Step 8 plus each theme; scheduler safety → Task 3 Step 8; the manual matrix → Task 9; retiring `experiments/` → Task 9.

**Known gap, accepted:** the spec's performance-mode contrast floor (4.5:1, `#startStop` exempt) is verified by eye in each theme's Step 5 rather than by an automated check. Computing contrast through `color-mix()` and layered `opacity` without a browser is not practical here, and a test that approximates it would give false confidence.

**Deviation from the experiments, recorded:** Kinetic Type's accented beat-dot height change no longer animates (Task 6, Step 3). Animating it would mean overriding the locked `.beat-dot` transition, which the contract forbids.
