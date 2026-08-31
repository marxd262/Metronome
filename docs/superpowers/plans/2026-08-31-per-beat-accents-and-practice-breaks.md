# Per-Beat Accents & Practice Bar-Length Breaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single "Accent first beat" checkbox with a per-beat
accent pattern set by clicking directly on the (now larger) beat-dot row,
applied across all three modes; change Practice mode's break duration from
one beat to one full bar; redesign the Practice readout to show all four
cycle phases with the active one emphasized.

**Architecture:** Four tasks against the existing single file. Task 1 adds
two brand-new pure functions with zero existing callers (genuinely
risk-free). Tasks 2 and 3 each bundle one breaking signature change to an
existing `LOGIC-BEGIN`/`LOGIC-END` function together with updating its sole
call site and its existing test, so the app never sits in a half-updated,
broken state between commits — the same pattern used successfully for the
`currentModeBpm`/`advanceModeAfterBeat` sequential edits in the original
build plan. Both tasks also make a second, later edit to the same line in
`scheduleBeat` (Task 2 lands the pattern-based accent check; Task 3 layers
the practice-break suppression on top) — this mirrors that same proven
precedent. A final task is human-performed manual verification, since no
agent in this project has ever had real browser/audio access.

**Tech Stack:** Same as the existing app — vanilla HTML/CSS/JS, Web Audio
API, no build step, no dependencies. No changes to the Node test harness
itself (`tests/loadLogic.js`).

## Global Constraints

- Still a single self-contained `metronome.html` file — no build step, no
  external fonts, no CDN links, no network calls, no new runtime files.
- Every existing element `id` referenced by the JS that is NOT explicitly
  called out for removal in this plan (`accentFirstBeat`, being removed)
  must remain unchanged.
- `state.topBar.accentPattern` is an array of booleans, one per beat,
  always kept the same length as `state.topBar.timeSigNum`. Default at
  4/4: `[true, false, false, false]`.
- The shared accent pattern applies during Metronome, Ramp, and Practice
  playback — except Practice's break beats, which are always unaccented
  regardless of what the pattern says for that beat position.
- Practice's break phase length equals `state.topBar.timeSigNum` (one full
  bar), not a fixed 1 beat.
- Run tests with `node --test tests/*.test.js` (the directory form
  `node --test tests/` does not work reliably on this Node/Windows setup —
  always use the glob form). The suite starts this plan at 28 passing
  tests; expect 33 after Task 1, 34 after Task 2, 35 after Task 3.

---

### Task 1: New pure logic — `resizeAccentPattern` and `practiceSegmentIndex`

**Files:**
- Modify: `metronome.html` (the `// LOGIC-BEGIN`/`// LOGIC-END` block only)
- Modify: `tests/logic.test.js`

**Interfaces:**
- Consumes: nothing — both functions are new, pure, and self-contained.
- Produces: `resizeAccentPattern(pattern, newLength) -> boolean[]`, consumed
  by Task 2's `bindTopBar` resize wiring and startup normalization.
  `practiceSegmentIndex(sequenceIndex, beatsPerPhase, breakBeats) -> 0|1|2|3`,
  consumed by Task 3's rewritten `updatePracticeReadout`.

This task is purely additive — neither function has any existing caller
yet, so there is no risk of breaking current behavior.

- [ ] **Step 1: Write failing tests for both functions**

Add to `tests/logic.test.js`, after the existing `clampPositiveInt rounds
and passes through positive input` test at the end of the file:

```js
test('resizeAccentPattern preserves existing values and pads with false when growing', () => {
  const { resizeAccentPattern } = loadLogic(['resizeAccentPattern']);
  assert.deepEqual(resizeAccentPattern([true, false, false, false], 6), [true, false, false, false, false, false]);
});

test('resizeAccentPattern truncates when shrinking', () => {
  const { resizeAccentPattern } = loadLogic(['resizeAccentPattern']);
  assert.deepEqual(resizeAccentPattern([true, false, true, true], 2), [true, false]);
});

test('resizeAccentPattern treats a missing pattern as all-false', () => {
  const { resizeAccentPattern } = loadLogic(['resizeAccentPattern']);
  assert.deepEqual(resizeAccentPattern(undefined, 3), [false, false, false]);
});

test('practiceSegmentIndex maps sequence position to the slow/break/fast/break segments', () => {
  const { practiceSegmentIndex } = loadLogic(['practiceSegmentIndex']);
  // beatsPerPhase=2, breakBeats=3 -> slow[0,1] break[2,3,4] fast[5,6] break[7,8,9]
  assert.equal(practiceSegmentIndex(0, 2, 3), 0);
  assert.equal(practiceSegmentIndex(1, 2, 3), 0);
  assert.equal(practiceSegmentIndex(2, 2, 3), 1);
  assert.equal(practiceSegmentIndex(4, 2, 3), 1);
  assert.equal(practiceSegmentIndex(5, 2, 3), 2);
  assert.equal(practiceSegmentIndex(6, 2, 3), 2);
  assert.equal(practiceSegmentIndex(7, 2, 3), 3);
  assert.equal(practiceSegmentIndex(9, 2, 3), 3);
});

test('practiceSegmentIndex handles a single beat per phase and a single break beat', () => {
  const { practiceSegmentIndex } = loadLogic(['practiceSegmentIndex']);
  // beatsPerPhase=1, breakBeats=1 -> slow[0] break[1] fast[2] break[3]
  assert.equal(practiceSegmentIndex(0, 1, 1), 0);
  assert.equal(practiceSegmentIndex(1, 1, 1), 1);
  assert.equal(practiceSegmentIndex(2, 1, 1), 2);
  assert.equal(practiceSegmentIndex(3, 1, 1), 3);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/*.test.js`
Expected: FAIL — `resizeAccentPattern is not a function` (and similarly for
`practiceSegmentIndex`).

- [ ] **Step 3: Implement both functions**

Add inside `// LOGIC-BEGIN` / `// LOGIC-END` in `metronome.html`, after the
existing `clampPositiveInt` function (the last one before `// LOGIC-END`):

```js
function resizeAccentPattern(pattern, newLength) {
  const result = [];
  for (let i = 0; i < newLength; i++) {
    result.push(Boolean(pattern && pattern[i]));
  }
  return result;
}

function practiceSegmentIndex(sequenceIndex, beatsPerPhase, breakBeats) {
  if (sequenceIndex < beatsPerPhase) return 0;
  if (sequenceIndex < beatsPerPhase + breakBeats) return 1;
  if (sequenceIndex < beatsPerPhase + breakBeats + beatsPerPhase) return 2;
  return 3;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/*.test.js`
Expected: all tests pass (28 existing + 5 new = 33).

- [ ] **Step 5: Commit**

```bash
git add metronome.html tests/logic.test.js
git commit -m "Add resizeAccentPattern and practiceSegmentIndex pure logic"
```

---

### Task 2: Per-beat accent pattern — clickable dots, remove the checkbox

**Files:**
- Modify: `metronome.html` (LOGIC block, `<style>` block, HTML markup, and
  `<script>` block)
- Modify: `tests/logic.test.js`

**Interfaces:**
- Consumes: `resizeAccentPattern` (Task 1) in the `timeSigNum` listener and
  at startup.
- Produces: `isAccentBeat(beatIndexInBar, accentPattern) -> boolean`
  (breaking signature change to the existing function — its sole caller,
  `scheduleBeat`, is updated in this same task), `toggleAccent(index)`,
  `updateAccentDotStyles()` — the latter two are new, internal to this
  task's dot-row wiring.

This task changes `isAccentBeat`'s signature. Its only current caller is
`scheduleBeat`, which this task also updates — so the change lands
atomically and the app is never left with accents silently broken between
commits.

- [ ] **Step 1: Write a failing test for the new `isAccentBeat` signature, replacing the old one**

In `tests/logic.test.js`, find this existing test:

```js
test('isAccentBeat is true only for beat index 0', () => {
  const { isAccentBeat } = loadLogic(['isAccentBeat']);
  assert.equal(isAccentBeat(0), true);
  assert.equal(isAccentBeat(1), false);
  assert.equal(isAccentBeat(3), false);
});
```

Replace it with:

```js
test('isAccentBeat reads the accent flag for that beat position from the pattern', () => {
  const { isAccentBeat } = loadLogic(['isAccentBeat']);
  assert.equal(isAccentBeat(0, [true, false, true, false]), true);
  assert.equal(isAccentBeat(1, [true, false, true, false]), false);
  assert.equal(isAccentBeat(2, [true, false, true, false]), true);
});

test('isAccentBeat returns false for an out-of-range index or a missing pattern', () => {
  const { isAccentBeat } = loadLogic(['isAccentBeat']);
  assert.equal(isAccentBeat(5, [true, false]), false);
  assert.equal(isAccentBeat(0, undefined), false);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test tests/*.test.js`
Expected: FAIL — the new tests fail because `isAccentBeat` still has its
old one-argument implementation (ignores the second argument, so
`isAccentBeat(1, [true, false, true, false])` currently returns `false`
correctly by accident but `isAccentBeat(0, [true, false, true, false])`
also returns `true` by accident — the real signal is that this step is
about to change the implementation, not that every assertion necessarily
fails; if any assertion happens to pass by coincidence with the old
one-arg body, that's fine, proceed to Step 3 regardless).

- [ ] **Step 3: Update `isAccentBeat`'s implementation**

Find:

```js
function isAccentBeat(beatIndexInBar) {
  return beatIndexInBar === 0;
}
```

Replace with:

```js
function isAccentBeat(beatIndexInBar, accentPattern) {
  return Boolean(accentPattern && accentPattern[beatIndexInBar]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/*.test.js`
Expected: all tests pass (33 from Task 1 − 1 replaced + 2 new = 34).

- [ ] **Step 5: Update `DEFAULT_STATE`**

Find:

```js
const DEFAULT_STATE = {
  topBar: { timeSigNum: 4, subdivision: 'none', soundStyle: 'click', volume: 80, activeTab: 'metronome' },
  metronome: { bpm: 120, percent: 100, accentFirstBeat: true },
  ramp: { startBpm: 80, stopBpm: 140, scaleMode: 'percent', scaleAmount: 2, stepBars: 4 },
  practice: { baseBpm: 120, deltaPercent: 50, beatsPerPhase: 4 },
};
```

Replace with:

```js
const DEFAULT_STATE = {
  topBar: { timeSigNum: 4, subdivision: 'none', soundStyle: 'click', volume: 80, activeTab: 'metronome', accentPattern: [true, false, false, false] },
  metronome: { bpm: 120, percent: 100 },
  ramp: { startBpm: 80, stopBpm: 140, scaleMode: 'percent', scaleAmount: 2, stepBars: 4 },
  practice: { baseBpm: 120, deltaPercent: 50, beatsPerPhase: 4 },
};
```

- [ ] **Step 6: Remove the checkbox from the HTML**

Find, inside `#panel-metronome`:

```html
    <label><input id="accentFirstBeat" type="checkbox" checked> Accent first beat</label>
```

Delete this line entirely.

- [ ] **Step 7: Remove `aria-hidden` from the beat-dot container**

Find:

```html
  <div id="heroZone">
    <div id="beatIndicator" aria-hidden="true"></div>
    <div id="heroBpm">120</div>
    <div id="heroBpmLabel">BPM</div>
  </div>
```

Replace with (only the `beatIndicator` line changes — the dots are about to
become real interactive controls, so they must no longer be hidden from
assistive tech):

```html
  <div id="heroZone">
    <div id="beatIndicator"></div>
    <div id="heroBpm">120</div>
    <div id="heroBpmLabel">BPM</div>
  </div>
```

- [ ] **Step 8: Resize the dots, add the accented idle style, remove dead checkbox CSS**

Find:

```css
#beatIndicator {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  justify-content: center;
  margin-bottom: 1rem;
}

.beat-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--dot-idle);
  transition: background-color 0.05s ease;
}

.beat-dot.pulse { background: var(--accent); }
.beat-dot.pulse.accent { background: var(--accent-beat); }
```

Replace with:

```css
#beatIndicator {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  justify-content: center;
  margin-bottom: 1rem;
}

.beat-dot {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  background: var(--dot-idle);
  transition: background-color 0.05s ease, border-color 0.15s ease;
}

.beat-dot.accented { border-color: var(--accent-beat); }
.beat-dot.pulse { background: var(--accent); }
.beat-dot.pulse.accent { background: var(--accent-beat); }
```

Then find and delete these two now-dead rules entirely (no checkbox will
remain anywhere in the app after Step 6):

```css
label:has(input[type="checkbox"]) {
  flex-direction: row;
  align-items: center;
}
```

and

```css
input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 1.15rem;
  height: 1.15rem;
  border: 1px solid var(--divider);
  border-radius: 4px;
  background: var(--panel);
  display: inline-block;
  vertical-align: middle;
  margin-right: 0.5rem;
  position: relative;
  cursor: pointer;
}

input[type="checkbox"]:checked {
  background: var(--accent);
  border-color: var(--accent);
}

input[type="checkbox"]:checked::after {
  content: "";
  position: absolute;
  left: 4px;
  top: 1px;
  width: 4px;
  height: 8px;
  border: solid var(--bg);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
```

- [ ] **Step 9: Make dots into clickable, keyboard-accessible buttons**

Find:

```js
function renderBeatDots() {
  const container = document.getElementById('beatIndicator');
  container.innerHTML = '';
  const n = state.topBar.timeSigNum;
  for (let i = 0; i < n; i++) {
    const dot = document.createElement('div');
    dot.className = 'beat-dot';
    container.appendChild(dot);
  }
}
```

Replace with:

```js
function renderBeatDots() {
  const container = document.getElementById('beatIndicator');
  container.innerHTML = '';
  const n = state.topBar.timeSigNum;
  for (let i = 0; i < n; i++) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'beat-dot';
    dot.addEventListener('click', () => toggleAccent(i));
    container.appendChild(dot);
  }
  updateAccentDotStyles();
}

function toggleAccent(index) {
  const pattern = state.topBar.accentPattern.slice();
  pattern[index] = !pattern[index];
  state.topBar.accentPattern = pattern;
  updateAccentDotStyles();
  persistState();
}

function updateAccentDotStyles() {
  const dots = document.getElementById('beatIndicator').children;
  state.topBar.accentPattern.forEach((accented, i) => {
    const dot = dots[i];
    if (!dot) return;
    dot.classList.toggle('accented', accented);
    dot.setAttribute('aria-pressed', String(accented));
    dot.setAttribute('aria-label', `Beat ${i + 1}, ${accented ? 'accented' : 'not accented'}`);
  });
}
```

- [ ] **Step 10: Resize the accent pattern when Beats per Bar changes**

Find, inside `bindTopBar()`:

```js
  timeSigNum.addEventListener('input', () => {
    state.topBar.timeSigNum = clampPositiveInt(timeSigNum.value, DEFAULT_STATE.topBar.timeSigNum);
    renderBeatDots();
    persistState();
  });
```

Replace with:

```js
  timeSigNum.addEventListener('input', () => {
    state.topBar.timeSigNum = clampPositiveInt(timeSigNum.value, DEFAULT_STATE.topBar.timeSigNum);
    state.topBar.accentPattern = resizeAccentPattern(state.topBar.accentPattern, state.topBar.timeSigNum);
    renderBeatDots();
    persistState();
  });
```

- [ ] **Step 11: Remove the checkbox wiring from `bindMetronomeTab`**

Find:

```js
function bindMetronomeTab() {
  const bpm = document.getElementById('metronomeBpm');
  const bpmRange = document.getElementById('metronomeBpmRange');
  const percent = document.getElementById('metronomePercent');
  const percentRange = document.getElementById('metronomePercentRange');
  const accent = document.getElementById('accentFirstBeat');

  function setBpm(value) {
    state.metronome.bpm = clampBpm(value);
    bpm.value = state.metronome.bpm;
    bpmRange.value = state.metronome.bpm;
    updateHeroBpm();
  }
  function setPercent(value) {
    state.metronome.percent = clampBpmPercent(value);
    percent.value = state.metronome.percent;
    percentRange.value = state.metronome.percent;
    updateHeroBpm();
  }

  bpm.addEventListener('change', () => { setBpm(bpm.value); persistState(); });
  bpmRange.addEventListener('input', () => { setBpm(bpmRange.value); persistState(); });
  percent.addEventListener('change', () => { setPercent(percent.value); persistState(); });
  percentRange.addEventListener('input', () => { setPercent(percentRange.value); persistState(); });
  accent.addEventListener('change', () => { state.metronome.accentFirstBeat = accent.checked; persistState(); });
}
```

Replace with (only the `const accent = ...` line and its listener are
removed):

```js
function bindMetronomeTab() {
  const bpm = document.getElementById('metronomeBpm');
  const bpmRange = document.getElementById('metronomeBpmRange');
  const percent = document.getElementById('metronomePercent');
  const percentRange = document.getElementById('metronomePercentRange');

  function setBpm(value) {
    state.metronome.bpm = clampBpm(value);
    bpm.value = state.metronome.bpm;
    bpmRange.value = state.metronome.bpm;
    updateHeroBpm();
  }
  function setPercent(value) {
    state.metronome.percent = clampBpmPercent(value);
    percent.value = state.metronome.percent;
    percentRange.value = state.metronome.percent;
    updateHeroBpm();
  }

  bpm.addEventListener('change', () => { setBpm(bpm.value); persistState(); });
  bpmRange.addEventListener('input', () => { setBpm(bpmRange.value); persistState(); });
  percent.addEventListener('change', () => { setPercent(percent.value); persistState(); });
  percentRange.addEventListener('input', () => { setPercent(percentRange.value); persistState(); });
}
```

- [ ] **Step 12: Remove the checkbox line from `refreshAllInputsFromState`**

Find:

```js
  document.getElementById('metronomePercentRange').value = state.metronome.percent;
  document.getElementById('accentFirstBeat').checked = state.metronome.accentFirstBeat;

  document.getElementById('rampStartBpm').value = state.ramp.startBpm;
```

Replace with:

```js
  document.getElementById('metronomePercentRange').value = state.metronome.percent;

  document.getElementById('rampStartBpm').value = state.ramp.startBpm;
```

- [ ] **Step 13: Update `scheduleBeat`'s accent computation to use the shared pattern across all modes**

Find:

```js
function scheduleBeat(time) {
  const bpm = currentModeBpm();
  const beatIndex = beatIndexInBar;
  const accent = state.topBar.activeTab === 'metronome'
    && state.metronome.accentFirstBeat
    && isAccentBeat(beatIndex);
  scheduleClick(time, accent, false);
```

Replace with:

```js
function scheduleBeat(time) {
  const bpm = currentModeBpm();
  const beatIndex = beatIndexInBar;
  const accent = isAccentBeat(beatIndex, state.topBar.accentPattern);
  scheduleClick(time, accent, false);
```

(The rest of `scheduleBeat` — subdivisions, the `setTimeout` flash/hero
update, the index increment, `advanceModeAfterBeat()`, `nextNoteTime` — is
unchanged in this step. Task 3 will edit this same accent line again to add
practice-break suppression.)

- [ ] **Step 14: Normalize and render the dot row at startup**

Find, at the very end of the script:

```js
refreshAllInputsFromState();
renderBeatDots();
```

Replace with:

```js
refreshAllInputsFromState();
state.topBar.accentPattern = resizeAccentPattern(state.topBar.accentPattern, state.topBar.timeSigNum);
renderBeatDots();
```

- [ ] **Step 15: Run the automated test suite**

Run: `node --test tests/*.test.js`
Expected: all 34 tests pass.

- [ ] **Step 16: Manual browser verification**

Open `metronome.html`. Confirm the "Accent first beat" checkbox is gone
from the Metronome tab. Confirm the beat dots are visibly larger than
before. Click the first dot — confirm it gets a red outline (idle-accented
look) and the others don't. Click it again — confirm the outline
disappears. Tab to a dot with the keyboard and press Enter or Space —
confirm it toggles the same way as a click. Start playback on the
Metronome tab with beat 1 accented — confirm beat 1 flashes red and the
rest flash amber. Accent a second beat (e.g. beat 3) while stopped, then
Start — confirm both beat 1 and beat 3 flash red. Switch to the Ramp tab
and Start — confirm accents (per the same pattern) now play there too
(previously Ramp never accented anything). Change Beats per Bar from 4 to
6 — confirm 2 new unaccented dots appear at the end and the existing 4
keep their on/off state; change it back to 4 — confirm the original 4
states are preserved (not reset). Reload the page — confirm the accent
pattern persisted. If you have no browser available, do your best static
verification (confirm no remaining references to `accentFirstBeat`
anywhere via a search, confirm the CSS is syntactically valid, confirm
`isAccentBeat`'s only call site matches its new signature) and clearly
flag the limitation in your report (DONE_WITH_CONCERNS, not a silent
skip).

- [ ] **Step 17: Commit**

```bash
git add metronome.html tests/logic.test.js
git commit -m "Replace accent-first-beat checkbox with a clickable per-beat accent pattern"
```

---

### Task 3: Practice bar-length breaks + four-segment readout

**Files:**
- Modify: `metronome.html` (LOGIC block, `<style>` block, and `<script>`
  block)
- Modify: `tests/logic.test.js`

**Interfaces:**
- Consumes: `practiceSegmentIndex` (Task 1) in the rewritten
  `updatePracticeReadout`.
- Produces: `buildPracticePhaseSequence(beatsPerPhase, breakBeats) -> string[]`
  (breaking signature change to the existing function — its sole caller,
  `startPlayback`, is updated in this same task).

Like Task 2, this task changes an existing `LOGIC-BEGIN` function's
signature together with its sole caller in the same commit, so the app
never sits in a broken intermediate state.

- [ ] **Step 1: Write a failing test for the new `buildPracticePhaseSequence` signature, replacing the old one**

In `tests/logic.test.js`, find:

```js
test('buildPracticePhaseSequence builds slow/break/fast/break cycle', () => {
  const { buildPracticePhaseSequence } = loadLogic(['buildPracticePhaseSequence']);
  assert.deepEqual(
    buildPracticePhaseSequence(2),
    ['slow', 'slow', 'break', 'fast', 'fast', 'break']
  );
  assert.deepEqual(
    buildPracticePhaseSequence(1),
    ['slow', 'break', 'fast', 'break']
  );
});
```

Replace it with:

```js
test('buildPracticePhaseSequence builds slow/break/fast/break with a single break beat', () => {
  const { buildPracticePhaseSequence } = loadLogic(['buildPracticePhaseSequence']);
  assert.deepEqual(
    buildPracticePhaseSequence(2, 1),
    ['slow', 'slow', 'break', 'fast', 'fast', 'break']
  );
  assert.deepEqual(
    buildPracticePhaseSequence(1, 1),
    ['slow', 'break', 'fast', 'break']
  );
});

test('buildPracticePhaseSequence repeats break beats to match a full bar', () => {
  const { buildPracticePhaseSequence } = loadLogic(['buildPracticePhaseSequence']);
  assert.deepEqual(
    buildPracticePhaseSequence(2, 3),
    ['slow', 'slow', 'break', 'break', 'break', 'fast', 'fast', 'break', 'break', 'break']
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/*.test.js`
Expected: FAIL — `buildPracticePhaseSequence(2, 3)` doesn't produce the
3-break-beat sequence yet (the current implementation ignores the second
argument entirely and always emits exactly 1 break beat).

- [ ] **Step 3: Update `buildPracticePhaseSequence`'s implementation**

Find:

```js
function buildPracticePhaseSequence(beatsPerPhase) {
  const seq = [];
  for (let i = 0; i < beatsPerPhase; i++) seq.push('slow');
  seq.push('break');
  for (let i = 0; i < beatsPerPhase; i++) seq.push('fast');
  seq.push('break');
  return seq;
}
```

Replace with:

```js
function buildPracticePhaseSequence(beatsPerPhase, breakBeats) {
  const seq = [];
  for (let i = 0; i < beatsPerPhase; i++) seq.push('slow');
  for (let i = 0; i < breakBeats; i++) seq.push('break');
  for (let i = 0; i < beatsPerPhase; i++) seq.push('fast');
  for (let i = 0; i < breakBeats; i++) seq.push('break');
  return seq;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/*.test.js`
Expected: all tests pass (34 from Task 2 − 1 replaced + 2 new = 35).

- [ ] **Step 5: Update `startPlayback`'s call site**

Find, inside `startPlayback()`:

```js
  if (state.topBar.activeTab === 'practice') {
    practiceRuntime = {
      sequence: buildPracticePhaseSequence(state.practice.beatsPerPhase),
      index: 0,
    };
    updatePracticeReadout();
  }
```

Replace with:

```js
  if (state.topBar.activeTab === 'practice') {
    practiceRuntime = {
      sequence: buildPracticePhaseSequence(state.practice.beatsPerPhase, state.topBar.timeSigNum),
      index: 0,
    };
    updatePracticeReadout();
  }
```

- [ ] **Step 6: Suppress accent during practice break beats**

Find (this is the same line Task 2 last edited):

```js
function scheduleBeat(time) {
  const bpm = currentModeBpm();
  const beatIndex = beatIndexInBar;
  const accent = isAccentBeat(beatIndex, state.topBar.accentPattern);
  scheduleClick(time, accent, false);
```

Replace with:

```js
function scheduleBeat(time) {
  const bpm = currentModeBpm();
  const beatIndex = beatIndexInBar;
  const isPracticeBreak = state.topBar.activeTab === 'practice'
    && practiceRuntime
    && practiceRuntime.sequence[practiceRuntime.index] === 'break';
  const accent = !isPracticeBreak && isAccentBeat(beatIndex, state.topBar.accentPattern);
  scheduleClick(time, accent, false);
```

- [ ] **Step 7: Rewrite the Practice readout as four segments with the active one emphasized**

Find:

```js
function updatePracticeReadout() {
  const phase = practiceRuntime.sequence[practiceRuntime.index];
  document.getElementById('practiceReadout').textContent = `Phase: ${phase.toUpperCase()}`;
}
```

Replace with:

```js
const PHASE_SEGMENT_LABELS = ['SLOW', 'BREAK', 'FAST', 'BREAK'];

function updatePracticeReadout() {
  const el = document.getElementById('practiceReadout');
  const activeSegment = (isPlaying && practiceRuntime)
    ? practiceSegmentIndex(practiceRuntime.index, state.practice.beatsPerPhase, state.topBar.timeSigNum)
    : 0;
  el.innerHTML = '';
  PHASE_SEGMENT_LABELS.forEach((label, i) => {
    if (i > 0) el.appendChild(document.createTextNode(' - '));
    const span = document.createElement('span');
    span.className = 'phase-segment' + (i === activeSegment ? ' active' : '');
    span.textContent = label;
    el.appendChild(span);
  });
}
```

This gates on `isPlaying` (not just `practiceRuntime` truthiness) so the
readout correctly reverts to previewing `SLOW` at rest once stopped,
rather than freezing on whatever phase was active when playback stopped —
`practiceRuntime` itself is never nulled by `stopPlayback`, matching the
existing pattern already used by `updateHeroBpm`.

- [ ] **Step 8: Add CSS for the phase segments**

Add this after the existing `#statusReadout, .readout { ... }` rule (the
last rule in the stylesheet):

```css
.phase-segment {
  transition: font-size 0.15s ease, text-shadow 0.15s ease, color 0.15s ease;
}

.phase-segment.active {
  color: var(--accent);
  font-size: 1.1em;
  font-weight: 600;
  text-shadow: 0 0 8px var(--accent);
}
```

- [ ] **Step 9: Reset the readout to its resting state on Stop**

Find:

```js
function stopPlayback() {
  if (!isPlaying) return;
  isPlaying = false;
  clearTimeout(schedulerTimerId);
  document.getElementById('startStop').textContent = 'Start';
}
```

Replace with:

```js
function stopPlayback() {
  if (!isPlaying) return;
  isPlaying = false;
  clearTimeout(schedulerTimerId);
  document.getElementById('startStop').textContent = 'Start';
  updatePracticeReadout();
}
```

- [ ] **Step 10: Show the readout at rest on page load**

Find, at the very end of the script:

```js
refreshAllInputsFromState();
state.topBar.accentPattern = resizeAccentPattern(state.topBar.accentPattern, state.topBar.timeSigNum);
renderBeatDots();
```

Replace with:

```js
refreshAllInputsFromState();
state.topBar.accentPattern = resizeAccentPattern(state.topBar.accentPattern, state.topBar.timeSigNum);
renderBeatDots();
updatePracticeReadout();
```

- [ ] **Step 11: Run the automated test suite**

Run: `node --test tests/*.test.js`
Expected: all 35 tests pass.

- [ ] **Step 12: Manual browser verification**

Open `metronome.html` and go to the Practice tab without pressing Start —
confirm the readout shows `SLOW - BREAK - FAST - BREAK` with `SLOW` larger
and glowing amber, the other three normal/muted. Set Beats per Bar to 2,
Beats per Phase to 2, Base BPM 160, Delta 50%. Press Start — confirm you
hear 2 slow beats, then a full 2-beat bar of break clicks at the slow
tempo (not just 1), then 2 fast beats, then another full 2-beat break bar,
repeating — and confirm the readout's highlighted segment moves
SLOW→BREAK→FAST→BREAK in sync. Accent beat 1 on the dot row before
starting — confirm beat 1 sounds accented during the SLOW and FAST
segments, but the break bars never sound accented even on their first
beat. Press Stop mid-cycle — confirm the readout reverts to `SLOW`
highlighted (not frozen on whatever phase it stopped in). If you have no
browser available, do your best static/hand-traced verification (trace
`buildPracticePhaseSequence`/`practiceSegmentIndex` together by hand for
the 2/2 example above and confirm the break-suppression logic in
`scheduleBeat` correctly identifies break beats) and clearly flag the
limitation in your report (DONE_WITH_CONCERNS, not a silent skip).

- [ ] **Step 13: Commit**

```bash
git add metronome.html tests/logic.test.js
git commit -m "Make practice breaks one bar long and redesign the practice readout"
```

---

### Task 4: Final manual verification walkthrough

**Files:** none (verification-only task; fix any bug found in
`metronome.html` before committing, following the same style as the
surrounding code).

**Interfaces:** none — this task exercises the finished feature set
end-to-end, on top of the already-verified core app.

- [ ] **Step 1: Run the full automated test suite one more time**

Run: `node --test tests/*.test.js`
Expected: all 35 tests pass.

- [ ] **Step 2: Full accent-pattern pass**

Confirm dots are clickable and keyboard-operable on all three tabs (the
dot row is shared), accents play correctly during Metronome and Ramp
playback, and multiple simultaneous accented beats (e.g. 1 and 3 in a 4/4
bar) both sound accented.

- [ ] **Step 3: Full practice bar-length-break pass**

Confirm break bars are always exactly `Beats per Bar` beats long, always
play at the slow tempo, and never sound accented regardless of the accent
pattern. Confirm the four-segment readout is accurate at rest, while
playing, and after stopping.

- [ ] **Step 4: Regression check against pre-existing functionality**

Confirm nothing broke: tap tempo, the spacebar Start/Stop shortcut,
tab-switch-stops-playback, settings persistence across a reload (including
the accent pattern and its correct resizing if Beats per Bar was changed
before reloading), ramp hold-at-target behavior, and subdivision behavior.

- [ ] **Step 5: Final commit (only if the walkthrough required fixes)**

```bash
git add metronome.html
git commit -m "Fix issues found during accent-pattern/practice-break verification walkthrough"
```

If no fixes were needed, this task requires no commit — the plan is
complete as of Task 3's commit.
