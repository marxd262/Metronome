# Quick-Select Value Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a chevron-triggered quick-select popup (a short list of common values) next to every numeric field's `<input type="number">` across all three tabs, as a third way to set a value alongside typing and the range slider/steppers.

**Architecture:** One pure LOGIC function computes the list of values to show (presets plus the current value inserted if missing). One small, reusable, framework-free app-block component (`attachQuickSelect`) builds the chevron button + popup DOM, and is called once per numeric field from each tab's existing `bind*Tab()` function, reusing that field's existing `setXxx()` setter so clamping/persistence/UI-refresh logic is never duplicated.

**Tech Stack:** Vanilla JS/CSS/HTML inside the existing single `index.html` file. No new dependency, no build step (per CLAUDE.md). Verification uses a throwaway Playwright script run from outside the repo (dev-only tool, never committed, never added as a project dependency).

**Spec:** `docs/superpowers/specs/2026-09-07-quick-select-value-dropdown-design.md`

## Global Constraints

- Single self-contained `index.html` file — no build step, no external files, no new runtime dependency.
- No change to any existing `LOGIC-BEGIN`/`LOGIC-END` function or any existing test — only additions.
- No change to `state`'s shape, `persistState`, or `deserializeSettings` — preset lists are static data in the app block, not saved settings.
- No change to existing number-input typing or range-slider dragging behavior, for any field.
- The new toggle button must NOT carry the `.step-btn` class — every `bind*Tab()` function does `document.getElementById('panel-x').querySelectorAll('.step-btn').forEach(btn => btn.addEventListener('click', () => { ... stepperFields[btn.dataset.stepTarget] ... }))`, keyed on `btn.dataset.stepTarget`, which the new toggle button doesn't have. If the toggle carried `.step-btn`, that delegation would match it and throw on click (`stepperFields[undefined]` is `undefined`, so `.set` throws). Give it its own class with its own (duplicated) visual CSS instead.

---

## Verification tool setup (used by Tasks 2-5)

Every app-block task below is verified with a throwaway Playwright script, run from a scratch directory *outside* the repo — mirroring how the `#heroBpm` pointer-events bug earlier in this project was diagnosed and verified. This keeps the repo free of any new dependency while still giving a non-visual executor a deterministic, scriptable way to confirm DOM/interaction behavior (the project's own convention of "verified manually in a browser" assumes a human with eyes; this is the scripted equivalent).

One-time setup (skip if already done in this environment):

```bash
mkdir -p /tmp/quick-select-verify
cd /tmp/quick-select-verify
npm init -y
npm install playwright@1.63.0 --no-save
npx playwright install chromium
```

Each task below gives the exact script content to drop into that directory as `verify.mjs` and run with `node verify.mjs`. Replace the `file` path inside each script with the actual absolute path to this repo's `index.html` on your machine.

---

### Task 1: `buildQuickSelectValues` pure function

**Files:**
- Modify: `index.html:837` (end of `LOGIC-BEGIN` block, just before `// LOGIC-END` on line 838) — add the new function
- Test: `tests/logic.test.js` (append new test cases)

**Interfaces:**
- Produces: `buildQuickSelectValues(presets: number[], currentValue: number) -> number[]` — a new sorted array containing every value in `presets` plus `currentValue` (inserted at its sorted position, not duplicated if already present). Used by Task 2's `attachQuickSelect`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/logic.test.js`:

```js
test('buildQuickSelectValues returns the presets unchanged when the current value already matches one', () => {
  const { buildQuickSelectValues } = loadLogic(['buildQuickSelectValues']);
  assert.deepEqual(buildQuickSelectValues([60, 80, 100, 120, 140], 100), [60, 80, 100, 120, 140]);
});

test('buildQuickSelectValues inserts the current value at its sorted position when absent', () => {
  const { buildQuickSelectValues } = loadLogic(['buildQuickSelectValues']);
  assert.deepEqual(buildQuickSelectValues([60, 80, 100, 120, 140], 137), [60, 80, 100, 120, 137, 140]);
});

test('buildQuickSelectValues inserts a current value below every preset at the front', () => {
  const { buildQuickSelectValues } = loadLogic(['buildQuickSelectValues']);
  assert.deepEqual(buildQuickSelectValues([60, 80, 100], 20), [20, 60, 80, 100]);
});

test('buildQuickSelectValues appends a current value above every preset at the end', () => {
  const { buildQuickSelectValues } = loadLogic(['buildQuickSelectValues']);
  assert.deepEqual(buildQuickSelectValues([60, 80, 100], 400), [60, 80, 100, 400]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/*.test.js`
Expected: 4 failures with `buildQuickSelectValues is not a function` (or `not defined`), all other existing tests still passing.

- [ ] **Step 3: Implement the function**

In `index.html`, immediately before the `// LOGIC-END` line (currently line 838), add:

```js
function buildQuickSelectValues(presets, currentValue) {
  const values = presets.includes(currentValue) ? presets.slice() : presets.concat([currentValue]);
  return values.sort((a, b) => a - b);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/*.test.js`
Expected: all tests pass (41 previously existing + 4 new = 45).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/logic.test.js
git commit -m "$(cat <<'EOF'
Add buildQuickSelectValues pure function for the quick-select dropdown

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: CSS + component + Metronome tab wiring

**Files:**
- Modify: `index.html:399-401` (CSS — insert new rules between the end of the existing `.step-btn` block and `#controls`)
- Modify: `index.html:1226-1228` (JS — insert the new data/component block between the existing top-level `document.addEventListener('click', ...)` blur handler and `function bindMetronomeTab()`)
- Modify: `index.html:1264-1266` (JS — inside `bindMetronomeTab()`, insert 3 wiring calls between the existing field `change`/`input` listeners and the `stepperFields` object)

**Interfaces:**
- Consumes: `buildQuickSelectValues` from Task 1 (same script scope, no import needed).
- Produces: `QUICK_SELECT_PRESETS` (object of named preset arrays), `attachQuickSelect(inputEl: HTMLInputElement, presets: number[], onSelect: (value: number) => void) -> void`. Both used by Tasks 3 and 4 for the remaining 10 fields.

- [ ] **Step 1: Add the CSS**

In `index.html`, between the existing `.step-btn:active { transform: scale(0.94); }` rule (ends line 399) and `#controls {` (line 401), insert:

```css
/* Deliberately its own class, not .step-btn — see Global Constraints:
   bind*Tab()'s querySelectorAll('.step-btn') delegation keys off
   data-step-target, which this button doesn't have. */
.quick-select-toggle {
  flex: 0 0 auto;
  width: 1.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--panel);
  color: var(--text-muted);
  border: 1px solid var(--divider);
  border-radius: var(--radius);
  font: inherit;
  font-size: var(--text-xs);
  transition: background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard), transform var(--duration-instant) var(--ease-standard);
}

.quick-select-toggle:hover {
  background: var(--neutral-850);
  border-color: var(--accent);
  color: var(--accent);
}

.quick-select-toggle:active {
  transform: scale(0.94);
}

.quick-select-toggle[aria-expanded="true"] {
  border-color: var(--accent);
  color: var(--accent);
}

.quick-select-popup {
  position: fixed;
  z-index: 20;
  max-height: 12.5rem;
  overflow-y: auto;
  background: var(--panel);
  border: 1px solid var(--divider);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  padding: var(--space-2xs) 0;
  min-width: 4.5rem;
}

.quick-select-option {
  padding: var(--space-2xs) var(--space-sm);
  font-size: var(--text-base);
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--text-muted);
  cursor: pointer;
}

.quick-select-option:hover {
  background: var(--neutral-850);
  color: var(--text);
}

.quick-select-option.highlighted {
  background: var(--accent);
  color: var(--on-accent);
}
```

- [ ] **Step 2: Add the data and component**

In `index.html`, between the existing:

```js
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn && e.detail !== 0) btn.blur();
});
```

and `function bindMetronomeTab() {`, insert:

```js
const QUICK_SELECT_PRESETS = {
  bpm: [40, 60, 80, 100, 120, 140, 160, 180, 200],
  percent: [50, 70, 85, 100, 115, 130],
  deltaPercent: [20, 35, 50, 65, 80],
  scaleAmount: [1, 2, 3, 5, 10],
  timeSig: [2, 3, 4, 5, 6, 8],
  bars: [1, 2, 4, 8],
  breakBeats: [2, 4, 8, 16],
};

let quickSelectIdCounter = 0;
let openQuickSelectPopup = null;

function closeOpenQuickSelectPopup() {
  if (!openQuickSelectPopup) return;
  const { popup, toggle } = openQuickSelectPopup;
  popup.remove();
  toggle.setAttribute('aria-expanded', 'false');
  openQuickSelectPopup = null;
}

document.addEventListener('scroll', closeOpenQuickSelectPopup, true);
window.addEventListener('resize', closeOpenQuickSelectPopup);
document.addEventListener('click', (e) => {
  if (!openQuickSelectPopup) return;
  const { popup, toggle } = openQuickSelectPopup;
  if (e.target === toggle || popup.contains(e.target)) return;
  closeOpenQuickSelectPopup();
});

function attachQuickSelect(inputEl, presets, onSelect) {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  // Not `.step-btn` — see the CSS comment above `.quick-select-toggle`.
  toggle.className = 'quick-select-toggle';
  toggle.setAttribute('aria-haspopup', 'listbox');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Quick-select value');
  toggle.textContent = '▾';
  inputEl.insertAdjacentElement('afterend', toggle);

  function openPopup() {
    closeOpenQuickSelectPopup();
    const currentValue = Number(inputEl.value);
    const values = buildQuickSelectValues(presets, currentValue);

    const popup = document.createElement('div');
    popup.className = 'quick-select-popup';
    popup.setAttribute('role', 'listbox');
    popup.tabIndex = -1;

    let highlightedIndex = values.indexOf(currentValue);
    if (highlightedIndex === -1) highlightedIndex = 0;

    const options = values.map((value) => {
      const option = document.createElement('div');
      option.id = `quick-select-option-${quickSelectIdCounter++}`;
      option.className = 'quick-select-option';
      option.setAttribute('role', 'option');
      option.textContent = String(value);
      option.addEventListener('click', () => {
        onSelect(value);
        closeOpenQuickSelectPopup();
        inputEl.focus();
      });
      popup.appendChild(option);
      return option;
    });

    function setHighlight(index) {
      options.forEach((opt, i) => {
        opt.classList.toggle('highlighted', i === index);
        opt.setAttribute('aria-selected', i === index ? 'true' : 'false');
      });
      highlightedIndex = index;
      popup.setAttribute('aria-activedescendant', options[index].id);
      options[index].scrollIntoView({ block: 'center' });
    }

    popup.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight(Math.min(highlightedIndex + 1, options.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight(Math.max(highlightedIndex - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        options[highlightedIndex].click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeOpenQuickSelectPopup();
        toggle.focus();
      }
    });

    document.body.appendChild(popup);
    const rect = toggle.getBoundingClientRect();
    popup.style.top = rect.bottom + 4 + 'px';
    popup.style.left = rect.left + 'px';

    setHighlight(highlightedIndex);
    toggle.setAttribute('aria-expanded', 'true');
    openQuickSelectPopup = { popup, toggle };
    popup.focus();
  }

  toggle.addEventListener('click', () => {
    if (openQuickSelectPopup && openQuickSelectPopup.toggle === toggle) {
      closeOpenQuickSelectPopup();
    } else {
      openPopup();
    }
  });

  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && !openQuickSelectPopup) {
      e.preventDefault();
      openPopup();
    }
  });
}
```

- [ ] **Step 3: Wire the three Metronome tab fields**

In `index.html`, inside `bindMetronomeTab()`, between the existing:

```js
  timeSig.addEventListener('change', () => { setTimeSig(timeSig.value); persistState(); });
```

and `const stepperFields = {`, insert:

```js
  attachQuickSelect(bpm, QUICK_SELECT_PRESETS.bpm, (v) => { setBpm(v); persistState(); });
  attachQuickSelect(percent, QUICK_SELECT_PRESETS.percent, (v) => { setPercent(v); persistState(); });
  attachQuickSelect(timeSig, QUICK_SELECT_PRESETS.timeSig, (v) => { setTimeSig(v); persistState(); });
```

- [ ] **Step 4: Verify with a Playwright script**

Create `/tmp/quick-select-verify/verify.mjs`:

```js
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// Replace with the absolute path to this repo's index.html.
const file = pathToFileURL('/absolute/path/to/Metronome/index.html').href;

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (err) => { throw err; });

await page.goto(file);

// 1. Chevron exists next to metronomeBpm, closed by default.
const toggle = page.locator('#metronomeBpm + .quick-select-toggle');
assert.equal(await toggle.count(), 1, 'chevron should exist right after #metronomeBpm');
assert.equal(await toggle.getAttribute('aria-expanded'), 'false');

// 2. Opening shows the preset list with current value (120) highlighted.
await toggle.click();
const popup = page.locator('.quick-select-popup');
await popup.waitFor({ state: 'visible' });
const optionTexts = await popup.locator('.quick-select-option').allTextContents();
assert.deepEqual(optionTexts, ['40', '60', '80', '100', '120', '140', '160', '180', '200']);
const highlighted = await popup.locator('.quick-select-option.highlighted').textContent();
assert.equal(highlighted, '120');
assert.equal(await toggle.getAttribute('aria-expanded'), 'true');

// 3. ArrowDown moves the highlight, Enter selects it, popup closes, focus returns to input.
await page.keyboard.press('ArrowDown');
const highlightedAfterArrow = await popup.locator('.quick-select-option.highlighted').textContent();
assert.equal(highlightedAfterArrow, '140');
await page.keyboard.press('Enter');
await popup.waitFor({ state: 'detached' });
assert.equal(await page.locator('#metronomeBpm').inputValue(), '140');
assert.equal(await page.evaluate(() => document.activeElement.id), 'metronomeBpm');
assert.equal(await toggle.getAttribute('aria-expanded'), 'false');

// 4. Selecting persisted the value.
const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('guitarMetronomeSettings')).metronome.bpm);
assert.equal(persisted, 140);

// 5. Escape closes without changing the value, focus returns to the toggle.
await toggle.click();
await popup.waitFor({ state: 'visible' });
await page.keyboard.press('Escape');
await popup.waitFor({ state: 'detached' });
assert.equal(await page.locator('#metronomeBpm').inputValue(), '140');
assert.equal(await page.evaluate(() => document.activeElement.className), 'quick-select-toggle');

// 6. Clicking outside closes without changing the value.
await toggle.click();
await popup.waitFor({ state: 'visible' });
await page.mouse.click(5, 5);
await popup.waitFor({ state: 'detached' });

// 7. Opening the percent field's popup while the bpm one is closed still works,
//    and a value not in the preset list is inserted, highlighted.
await page.locator('#metronomeBpm').fill('137');
await page.locator('#metronomeBpm').dispatchEvent('change');
await toggle.click();
const optionTextsWithInsert = await popup.locator('.quick-select-option').allTextContents();
assert.deepEqual(optionTextsWithInsert, ['40', '60', '80', '100', '120', '137', '140', '160', '180', '200']);
assert.equal(await popup.locator('.quick-select-option.highlighted').textContent(), '137');

// 8. Existing typing and slider behavior are unaffected.
await page.locator('#metronomeBpm').fill('90');
await page.locator('#metronomeBpm').dispatchEvent('change');
assert.equal(await page.locator('#metronomeBpm').inputValue(), '90');
await page.locator('#metronomeBpmRange').fill('200');
await page.locator('#metronomeBpmRange').dispatchEvent('input');
assert.equal(await page.locator('#metronomeBpm').inputValue(), '200');

await browser.close();
console.log('PASS: Metronome tab quick-select verified');
```

Run: `node /tmp/quick-select-verify/verify.mjs`
Expected: `PASS: Metronome tab quick-select verified` with no assertion errors.

- [ ] **Step 5: Run the full automated test suite**

Run: `node --test tests/*.test.js`
Expected: all 45 tests still pass (this task touched no LOGIC function).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Add quick-select value dropdown component, wire up Metronome tab

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire the Ramp tab

**Files:**
- Modify: `index.html:1393-1395` (inside `bindRampTab()`, insert 5 wiring calls between the existing field listeners and the `stepperFields` object)

**Interfaces:**
- Consumes: `QUICK_SELECT_PRESETS`, `attachQuickSelect` from Task 2.

- [ ] **Step 1: Wire the five Ramp tab fields**

In `index.html`, inside `bindRampTab()`, between the existing:

```js
  stepBars.addEventListener('change', () => { setStepBars(stepBars.value); persistState(); });
```

and `const stepperFields = {`, insert:

```js
  attachQuickSelect(startBpm, QUICK_SELECT_PRESETS.bpm, (v) => { setStartBpm(v); persistState(); });
  attachQuickSelect(stopBpm, QUICK_SELECT_PRESETS.bpm, (v) => { setStopBpm(v); persistState(); });
  attachQuickSelect(scaleAmount, QUICK_SELECT_PRESETS.scaleAmount, (v) => { setScaleAmount(v); persistState(); });
  attachQuickSelect(timeSig, QUICK_SELECT_PRESETS.timeSig, (v) => { setTimeSig(v); persistState(); });
  attachQuickSelect(stepBars, QUICK_SELECT_PRESETS.bars, (v) => { setStepBars(v); persistState(); });
```

- [ ] **Step 2: Verify with a Playwright script**

Create `/tmp/quick-select-verify/verify-ramp.mjs`:

```js
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const file = pathToFileURL('/absolute/path/to/Metronome/index.html').href;

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (err) => { throw err; });

await page.goto(file);
await page.locator('.tab-btn[data-tab="ramp"]').click();

const fields = [
  { id: 'rampStartBpm', expected: ['40', '60', '80', '100', '120', '140', '160', '180', '200'] },
  { id: 'rampStopBpm', expected: ['40', '60', '80', '100', '120', '140', '160', '180', '200'] },
  { id: 'rampScaleAmount', expected: ['1', '2', '3', '5', '10'] },
  { id: 'rampTimeSig', expected: ['2', '3', '4', '5', '6', '8'] },
  { id: 'rampStepBars', expected: ['1', '2', '4', '8'] },
];

for (const field of fields) {
  const toggle = page.locator(`#${field.id} + .quick-select-toggle`);
  assert.equal(await toggle.count(), 1, `chevron missing for ${field.id}`);
  await toggle.click();
  const popup = page.locator('.quick-select-popup');
  await popup.waitFor({ state: 'visible' });
  const texts = await popup.locator('.quick-select-option').allTextContents();
  assert.deepEqual(texts, field.expected, `preset list wrong for ${field.id}`);
  // Select the last option and confirm it lands in the input.
  await popup.locator('.quick-select-option').last().click();
  await popup.waitFor({ state: 'detached' });
  assert.equal(await page.locator(`#${field.id}`).inputValue(), field.expected[field.expected.length - 1]);
}

await browser.close();
console.log('PASS: Ramp tab quick-select verified');
```

Run: `node /tmp/quick-select-verify/verify-ramp.mjs`
Expected: `PASS: Ramp tab quick-select verified` with no assertion errors.

- [ ] **Step 3: Run the full automated test suite**

Run: `node --test tests/*.test.js`
Expected: all 45 tests still pass.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Wire quick-select value dropdown into the Ramp tab

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire the Practice tab

**Files:**
- Modify: `index.html:1466-1468` (inside `bindPracticeTab()`, insert 5 wiring calls between the existing field listeners and the `stepperFields` object)

**Interfaces:**
- Consumes: `QUICK_SELECT_PRESETS`, `attachQuickSelect` from Task 2.

- [ ] **Step 1: Wire the five Practice tab fields**

In `index.html`, inside `bindPracticeTab()`, between the existing:

```js
  breakBeats.addEventListener('change', () => { setBreakBeats(breakBeats.value); persistState(); });
```

and `const stepperFields = {`, insert:

```js
  attachQuickSelect(baseBpm, QUICK_SELECT_PRESETS.bpm, (v) => { setBaseBpm(v); persistState(); });
  attachQuickSelect(deltaPercent, QUICK_SELECT_PRESETS.deltaPercent, (v) => { setDeltaPercent(v); persistState(); });
  attachQuickSelect(timeSig, QUICK_SELECT_PRESETS.timeSig, (v) => { setTimeSig(v); persistState(); });
  attachQuickSelect(barsPerPhase, QUICK_SELECT_PRESETS.bars, (v) => { setBarsPerPhase(v); persistState(); });
  attachQuickSelect(breakBeats, QUICK_SELECT_PRESETS.breakBeats, (v) => { setBreakBeats(v); persistState(); });
```

- [ ] **Step 2: Verify with a Playwright script**

Create `/tmp/quick-select-verify/verify-practice.mjs`:

```js
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const file = pathToFileURL('/absolute/path/to/Metronome/index.html').href;

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (err) => { throw err; });

await page.goto(file);
await page.locator('.tab-btn[data-tab="practice"]').click();

const fields = [
  { id: 'practiceBaseBpm', expected: ['40', '60', '80', '100', '120', '140', '160', '180', '200'] },
  { id: 'practiceDeltaPercent', expected: ['20', '35', '50', '65', '80'] },
  { id: 'practiceTimeSig', expected: ['2', '3', '4', '5', '6', '8'] },
  { id: 'practiceBarsPerPhase', expected: ['1', '2', '4', '8'] },
  { id: 'practiceBreakBeats', expected: ['2', '4', '8', '16'] },
];

for (const field of fields) {
  const toggle = page.locator(`#${field.id} + .quick-select-toggle`);
  assert.equal(await toggle.count(), 1, `chevron missing for ${field.id}`);
  await toggle.click();
  const popup = page.locator('.quick-select-popup');
  await popup.waitFor({ state: 'visible' });
  const texts = await popup.locator('.quick-select-option').allTextContents();
  assert.deepEqual(texts, field.expected, `preset list wrong for ${field.id}`);
  await popup.locator('.quick-select-option').first().click();
  await popup.waitFor({ state: 'detached' });
  assert.equal(await page.locator(`#${field.id}`).inputValue(), field.expected[0]);
}

// Practice's beat-dot accent editor (a pre-existing, unrelated control) must
// still work — regression check that this feature didn't collide with it.
await page.locator('#beatIndicator .beat-dot').nth(1).click();
const secondDotAccented = await page.locator('#beatIndicator .beat-dot').nth(1).evaluate((el) => el.classList.contains('accented'));
assert.equal(secondDotAccented, true, 'accent-pattern beat-dot editor should be unaffected');

await browser.close();
console.log('PASS: Practice tab quick-select verified, beat-dot editor unaffected');
```

Run: `node /tmp/quick-select-verify/verify-practice.mjs`
Expected: `PASS: Practice tab quick-select verified, beat-dot editor unaffected` with no assertion errors.

- [ ] **Step 3: Run the full automated test suite**

Run: `node --test tests/*.test.js`
Expected: all 45 tests still pass.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Wire quick-select value dropdown into the Practice tab

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Final regression pass

**Files:** None modified — this task only verifies the completed feature end-to-end and fixes anything Tasks 2-4's narrower scripts didn't cover.

**Interfaces:** None — terminal task.

- [ ] **Step 1: Run the full automated test suite one more time**

Run: `node --test tests/*.test.js`
Expected: 45/45 passing.

- [ ] **Step 2: Run a cross-tab popup-exclusivity check**

Create `/tmp/quick-select-verify/verify-exclusivity.mjs`:

```js
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const file = pathToFileURL('/absolute/path/to/Metronome/index.html').href;

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (err) => { throw err; });

await page.goto(file);

// Opening the percent field's popup while the bpm field's popup is open
// must close the bpm one — only one popup exists at a time, ever.
await page.locator('#metronomeBpm + .quick-select-toggle').click();
assert.equal(await page.locator('.quick-select-popup').count(), 1);
await page.locator('#metronomePercent + .quick-select-toggle').click();
assert.equal(await page.locator('.quick-select-popup').count(), 1);
const remainingPopupOptions = await page.locator('.quick-select-popup .quick-select-option').allTextContents();
assert.deepEqual(remainingPopupOptions, ['50', '70', '85', '100', '115', '130']);

await browser.close();
console.log('PASS: only one quick-select popup is ever open at a time');
```

Run: `node /tmp/quick-select-verify/verify-exclusivity.mjs`
Expected: `PASS: only one quick-select popup is ever open at a time`.

- [ ] **Step 3: Manual spot-check (human, in a real browser)**

Open `index.html` directly in a browser and confirm, per the spec's Testing/Verification section:
- The chevron is visually consistent with the existing `±`/`±5` stepper buttons on at least one field per tab.
- Tab/Shift+Tab keyboard focus order through a field-group (number input → chevron → Tap, where present → `+`/`+5`) is sensible.
- On a narrow (mobile-width) viewport, the popup doesn't render off-screen for fields near the edge of the panel.

- [ ] **Step 4: Update CLAUDE.md if the component warrants a mention**

Read the current `CLAUDE.md`. If its Architecture section would benefit from a short pointer to this new reusable component (in the style of its existing "Mode dispatch" / "beat-dot row" subsections), add one short paragraph under a new `### Quick-select value dropdown` heading describing what it is and where it lives (`attachQuickSelect`, `QUICK_SELECT_PRESETS`, the `.step-btn` class-collision gotcha from Global Constraints). Keep it to the same length/style as the existing subsections. If the maintainer prefers not to grow CLAUDE.md for this, skip this step.

- [ ] **Step 5: Final commit (only if Step 4 made changes)**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
Document the quick-select value dropdown component in CLAUDE.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
