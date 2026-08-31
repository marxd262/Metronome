# Guitar Practice Metronome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single self-contained `metronome.html` file that provides a
guitar-practice-focused metronome with three modes: standard metronome, gradual
BPM ramp, and a slow/break/fast/break speed-training drill.

**Architecture:** All HTML/CSS/JS lives in one file with no build step. Pure
calculation logic (BPM math, ramp stepping, practice phase sequencing,
persistence serialization) lives inside `// LOGIC-BEGIN` / `// LOGIC-END`
markers in a `<script>` tag so it can be extracted and unit-tested with Node's
built-in test runner without adding any dependency or build tooling to the
shipped app. Playback uses a Web Audio API lookahead scheduler for
drift-free timing; DOM/audio-dependent behavior is verified manually in a
browser per task, per the spec's manual-testing approach.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Web Audio API. Node.js (v18+) is
used only as a development-time tool to run automated tests against the
extracted pure-logic functions (`node:test` / `node:assert`, both built into
Node — no npm install, no package.json needed). Node is not required to run
the shipped `metronome.html`.

## Global Constraints

- Deliverable is a single file: `metronome.html`. No external JS/CSS files,
  no CDN links, no build step — open the file directly in a browser to run it.
- No network calls, no external dependencies, no accounts/cloud sync.
- BPM range: 20–400. Metronome "% of BPM": 50–150 (default 100). Practice
  "delta %": 10–90 (default 50).
- Ramp end behavior: hold at Stop BPM indefinitely once reached (no auto-stop,
  no looping).
- Practice cycle: `[Slow × N] → [Break × 1 @ Slow tempo] → [Fast × N] →
  [Break × 1 @ Slow tempo] → repeat`, where Base BPM is the Fast/target tempo
  and `Slow = Base × (1 − delta%)`. `N` (beats per phase) is shared between
  slow and fast phases; break beats are always exactly 1 beat, not settable.
- Ramp step length is entered in bars and converted to beats via the shared
  time signature numerator.
- Switching tabs while playing stops playback.
- All settings persist to `localStorage` and are restored on load.
- Pure logic functions must live between `// LOGIC-BEGIN` and `// LOGIC-END`
  comment markers in `metronome.html` so `tests/loadLogic.js` can extract them.

---

### Task 1: Project scaffold, test harness, and BPM/percent core logic

**Files:**
- Create: `metronome.html`
- Create: `tests/loadLogic.js`
- Create: `tests/logic.test.js`

**Interfaces:**
- Produces: `clampBpm(bpm) -> number`, `clampBpmPercent(pct) -> number`,
  `computeEffectiveBpm(bpm, percent) -> number` (all inside the LOGIC markers,
  reused by every later task).
- Produces: `loadLogic(names: string[]) -> object` in `tests/loadLogic.js`,
  the extraction helper every later test file will import.

- [ ] **Step 1: Create the HTML skeleton with full markup for all three tabs**

Create `metronome.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Guitar Practice Metronome</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.25rem; }
  #topbar { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; font-size: 0.85rem; align-items: center; }
  #tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  .tab-btn { flex: 1; padding: 0.5rem; cursor: pointer; background: #eee; border: 1px solid #ccc; }
  .tab-btn.active { font-weight: bold; background: #ddd; border-bottom: 2px solid #333; }
  .panel { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }
  .panel[hidden] { display: none; }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; }
  #controls { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
  #startStop { font-size: 1.25rem; padding: 0.75rem 2rem; cursor: pointer; }
  #beatIndicator { width: 24px; height: 24px; border-radius: 50%; background: #ccc; }
  #beatIndicator.pulse { background: #f44; }
  #beatIndicator.pulse.accent { background: #22c; }
  #statusReadout, .readout { font-size: 0.85rem; color: #555; min-height: 1.2em; }
</style>
</head>
<body>
  <h1>Guitar Practice Metronome</h1>

  <div id="topbar">
    <label>Time Sig
      <span>
        <input id="timeSigNum" type="number" min="1" max="16" step="1" value="4" style="width:3em">
        /
        <select id="timeSigDen">
          <option value="2">2</option>
          <option value="4" selected>4</option>
          <option value="8">8</option>
          <option value="16">16</option>
        </select>
      </span>
    </label>
    <label>Subdivision
      <select id="subdivision">
        <option value="none">None</option>
        <option value="eighths">Eighths</option>
        <option value="triplets">Triplets</option>
        <option value="sixteenths">Sixteenths</option>
      </select>
    </label>
    <label>Sound
      <select id="soundStyle">
        <option value="click">Click</option>
        <option value="beep">Beep</option>
        <option value="wood">Wood Block</option>
      </select>
    </label>
    <label>Volume
      <input id="volume" type="range" min="0" max="100" step="1" value="80">
    </label>
    <button id="tapTempo" type="button">Tap Tempo</button>
  </div>

  <div id="tabs">
    <button class="tab-btn active" data-tab="metronome" type="button">Metronome</button>
    <button class="tab-btn" data-tab="ramp" type="button">Ramp</button>
    <button class="tab-btn" data-tab="practice" type="button">Practice</button>
  </div>

  <div id="panel-metronome" class="panel">
    <label>BPM
      <input id="metronomeBpm" type="number" min="20" max="400" step="1" value="120">
      <input id="metronomeBpmRange" type="range" min="20" max="400" step="1" value="120">
    </label>
    <label>% of BPM
      <input id="metronomePercent" type="number" min="50" max="150" step="1" value="100">
      <input id="metronomePercentRange" type="range" min="50" max="150" step="1" value="100">
    </label>
    <label><input id="accentFirstBeat" type="checkbox" checked> Accent first beat</label>
  </div>

  <div id="panel-ramp" class="panel" hidden>
    <label>Start BPM <input id="rampStartBpm" type="number" min="20" max="400" step="1" value="80"></label>
    <label>Stop BPM <input id="rampStopBpm" type="number" min="20" max="400" step="1" value="140"></label>
    <label>Scale Mode
      <select id="rampScaleMode">
        <option value="percent">% per step</option>
        <option value="fixed">Fixed BPM per step</option>
      </select>
    </label>
    <label>Scale Amount <input id="rampScaleAmount" type="number" min="0.1" step="0.1" value="2"></label>
    <label>Step Length (bars) <input id="rampStepBars" type="number" min="1" step="1" value="4"></label>
    <div id="rampReadout" class="readout"></div>
  </div>

  <div id="panel-practice" class="panel" hidden>
    <label>Base (Fast) BPM <input id="practiceBaseBpm" type="number" min="20" max="400" step="1" value="120"></label>
    <label>Speed Delta % <input id="practiceDeltaPercent" type="number" min="10" max="90" step="1" value="50"></label>
    <label>Beats per Phase <input id="practiceBeatsPerPhase" type="number" min="1" step="1" value="4"></label>
    <div id="practiceReadout" class="readout"></div>
  </div>

  <div id="controls">
    <button id="startStop" type="button">Start</button>
    <div id="beatIndicator"></div>
    <div id="statusReadout"></div>
  </div>

<script>
// LOGIC-BEGIN
function clampBpm(bpm) {
  const n = Math.round(Number(bpm));
  if (Number.isNaN(n)) return 120;
  return Math.min(400, Math.max(20, n));
}

function clampBpmPercent(pct) {
  const n = Math.round(Number(pct));
  if (Number.isNaN(n)) return 100;
  return Math.min(150, Math.max(50, n));
}

function computeEffectiveBpm(bpm, percent) {
  return clampBpm(bpm * (percent / 100));
}
// LOGIC-END
</script>
<script>
// App state, DOM wiring, and scheduler are added in later tasks.
</script>
</body>
</html>
```

- [ ] **Step 2: Create the logic-extraction test helper**

Create `tests/loadLogic.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

function loadLogic(names) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'metronome.html'), 'utf8');
  const match = html.match(/\/\/ LOGIC-BEGIN([\s\S]*?)\/\/ LOGIC-END/);
  if (!match) {
    throw new Error('LOGIC-BEGIN/LOGIC-END markers not found in metronome.html');
  }
  const source = match[1];
  const body = source + '\nreturn { ' + names.join(', ') + ' };';
  const factory = new Function(body);
  return factory();
}

module.exports = { loadLogic };
```

- [ ] **Step 3: Write failing tests for the three BPM/percent functions**

Create `tests/logic.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLogic } = require('./loadLogic');

test('clampBpm clamps below minimum to 20', () => {
  const { clampBpm } = loadLogic(['clampBpm']);
  assert.equal(clampBpm(5), 20);
});

test('clampBpm clamps above maximum to 400', () => {
  const { clampBpm } = loadLogic(['clampBpm']);
  assert.equal(clampBpm(1000), 400);
});

test('clampBpm rounds and passes through in-range values', () => {
  const { clampBpm } = loadLogic(['clampBpm']);
  assert.equal(clampBpm(120.4), 120);
});

test('clampBpmPercent clamps to the 50-150 range', () => {
  const { clampBpmPercent } = loadLogic(['clampBpmPercent']);
  assert.equal(clampBpmPercent(10), 50);
  assert.equal(clampBpmPercent(999), 150);
  assert.equal(clampBpmPercent(80), 80);
});

test('computeEffectiveBpm scales bpm by percent and clamps', () => {
  const { computeEffectiveBpm } = loadLogic(['computeEffectiveBpm']);
  assert.equal(computeEffectiveBpm(120, 50), 60);
  assert.equal(computeEffectiveBpm(120, 100), 120);
  assert.equal(computeEffectiveBpm(300, 150), 400);
});
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `node --test tests/`
Expected: all 5 tests pass (this task writes the implementation inline with
the scaffold in Step 1, so there is no red-then-green cycle here — the point
of the test is to prove the extraction harness works end-to-end. From Task 2
onward, tests are written before their implementation.)

- [ ] **Step 5: Commit**

```bash
git add metronome.html tests/loadLogic.js tests/logic.test.js
git commit -m "Add HTML scaffold, test harness, and BPM/percent core logic"
```

---

### Task 2: Time signature, subdivision, and accent logic + Top Bar wiring

**Files:**
- Modify: `metronome.html`
- Modify: `tests/logic.test.js`

**Interfaces:**
- Consumes: nothing new from Task 1 (adds independent pure functions).
- Produces: `subdivisionCount(subdivision) -> number`,
  `beatIntervalSeconds(bpm) -> number`,
  `subdivisionIntervalSeconds(bpm, subdivision) -> number`,
  `isAccentBeat(beatIndexInBar) -> boolean` — all consumed by the scheduler
  in Task 3.
- Produces (DOM): a `state.topBar` object (`timeSigNum`, `timeSigDen`,
  `subdivision`, `soundStyle`, `volume`) kept in sync with the top-bar inputs,
  consumed by Task 3's scheduler and every later task.

- [ ] **Step 1: Write failing tests for the new pure functions**

Add to `tests/logic.test.js`:

```js
test('subdivisionCount maps subdivision names to click counts', () => {
  const { subdivisionCount } = loadLogic(['subdivisionCount']);
  assert.equal(subdivisionCount('none'), 1);
  assert.equal(subdivisionCount('eighths'), 2);
  assert.equal(subdivisionCount('triplets'), 3);
  assert.equal(subdivisionCount('sixteenths'), 4);
});

test('beatIntervalSeconds converts bpm to seconds per beat', () => {
  const { beatIntervalSeconds } = loadLogic(['beatIntervalSeconds']);
  assert.equal(beatIntervalSeconds(60), 1);
  assert.equal(beatIntervalSeconds(120), 0.5);
});

test('subdivisionIntervalSeconds divides the beat interval', () => {
  const { subdivisionIntervalSeconds } = loadLogic(['subdivisionIntervalSeconds']);
  assert.equal(subdivisionIntervalSeconds(60, 'eighths'), 0.5);
  assert.equal(subdivisionIntervalSeconds(60, 'none'), 1);
});

test('isAccentBeat is true only for beat index 0', () => {
  const { isAccentBeat } = loadLogic(['isAccentBeat']);
  assert.equal(isAccentBeat(0), true);
  assert.equal(isAccentBeat(1), false);
  assert.equal(isAccentBeat(3), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL — `subdivisionCount is not a function` (and similar for the
other three).

- [ ] **Step 3: Implement the pure functions**

Add inside the `// LOGIC-BEGIN` / `// LOGIC-END` block in `metronome.html`,
after `computeEffectiveBpm`:

```js
function subdivisionCount(subdivision) {
  const table = { none: 1, eighths: 2, triplets: 3, sixteenths: 4 };
  return table[subdivision] || 1;
}

function beatIntervalSeconds(bpm) {
  return 60 / bpm;
}

function subdivisionIntervalSeconds(bpm, subdivision) {
  return beatIntervalSeconds(bpm) / subdivisionCount(subdivision);
}

function isAccentBeat(beatIndexInBar) {
  return beatIndexInBar === 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: all tests pass (5 from Task 1 + 4 new = 9).

- [ ] **Step 5: Add app state and wire the top bar inputs**

Replace the second `<script>` block (currently just a comment) in
`metronome.html` with:

```html
<script>
const DEFAULT_STATE = {
  topBar: { timeSigNum: 4, timeSigDen: 4, subdivision: 'none', soundStyle: 'click', volume: 80, activeTab: 'metronome' },
  metronome: { bpm: 120, percent: 100, accentFirstBeat: true },
  ramp: { startBpm: 80, stopBpm: 140, scaleMode: 'percent', scaleAmount: 2, stepBars: 4 },
  practice: { baseBpm: 120, deltaPercent: 50, beatsPerPhase: 4 },
};

const state = JSON.parse(JSON.stringify(DEFAULT_STATE));

function bindTopBar() {
  const timeSigNum = document.getElementById('timeSigNum');
  const timeSigDen = document.getElementById('timeSigDen');
  const subdivision = document.getElementById('subdivision');
  const soundStyle = document.getElementById('soundStyle');
  const volume = document.getElementById('volume');

  timeSigNum.addEventListener('input', () => {
    state.topBar.timeSigNum = clampPositiveInt(timeSigNum.value, DEFAULT_STATE.topBar.timeSigNum);
  });
  timeSigDen.addEventListener('change', () => {
    state.topBar.timeSigDen = Number(timeSigDen.value);
  });
  subdivision.addEventListener('change', () => {
    state.topBar.subdivision = subdivision.value;
  });
  soundStyle.addEventListener('change', () => {
    state.topBar.soundStyle = soundStyle.value;
  });
  volume.addEventListener('input', () => {
    state.topBar.volume = Number(volume.value);
  });
}

bindTopBar();
</script>
```

Note: `clampPositiveInt` is introduced in Task 9; for this task, inline a
minimal version directly above `bindTopBar` inside the same script block so
the top bar works standalone:

```js
function clampPositiveInt(value, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}
```

(Task 9 will move this into the LOGIC block and add tests for it once other
tasks also depend on it.)

- [ ] **Step 6: Manual browser verification**

Open `metronome.html` in a browser. Change the time signature numerator to
`7`, denominator to `8`, subdivision to `Triplets`, sound to `Beep`, and drag
the volume slider. Open the browser dev console and run
`console.log(state.topBar)` after each change to confirm the object reflects
your selections. Expected: `state.topBar` matches every change (e.g.
`{ timeSigNum: 7, timeSigDen: 8, subdivision: 'triplets', soundStyle: 'beep',
volume: <slider value>, activeTab: 'metronome' }`).

- [ ] **Step 7: Commit**

```bash
git add metronome.html tests/logic.test.js
git commit -m "Add time signature/subdivision/accent logic and top bar wiring"
```

---

### Task 3: Web Audio scheduler engine, sound synthesis, and Metronome tab

**Files:**
- Modify: `metronome.html`

**Interfaces:**
- Consumes: `computeEffectiveBpm`, `beatIntervalSeconds`,
  `subdivisionCount`, `isAccentBeat` from Task 1/2; `state.topBar`,
  `state.metronome` from Task 2.
- Produces: `ensureAudioContext()`, `scheduleClick(time, accent,
  isSubdivision)`, `flashBeatIndicator(accent)`, `schedulerTick()`,
  `startPlayback()`, `stopPlayback()`, and module-level `isPlaying` — all
  reused unchanged by Ramp (Task 6) and Practice (Task 7) via the
  `currentModeBpm()` / `advanceModeAfterBeat()` seam defined here.

This task is DOM/Web-Audio-dependent and has no automated test; it is
verified manually in a browser per the spec's testing approach.

- [ ] **Step 1: Add the scheduler engine and metronome-only mode logic**

Append to the second `<script>` block in `metronome.html` (after
`bindTopBar()` call):

```js
let audioCtx = null;
let isPlaying = false;
let nextNoteTime = 0;
let schedulerTimerId = null;
let beatIndexInBar = 0;

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.1;

function ensureAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function soundFrequency(style, accent) {
  const table = {
    click: accent ? 1500 : 1000,
    beep: accent ? 1800 : 1200,
    wood: accent ? 900 : 500,
  };
  return table[style] || table.click;
}

function scheduleClick(time, accent, isSubdivision) {
  const ctx = ensureAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = state.topBar.soundStyle === 'wood' ? 'triangle' : 'sine';
  osc.frequency.value = soundFrequency(state.topBar.soundStyle, accent);
  const vol = (state.topBar.volume / 100) * (accent ? 1.0 : isSubdivision ? 0.4 : 0.7);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0001), time + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  osc.start(time);
  osc.stop(time + 0.06);
}

function flashBeatIndicator(accent) {
  const el = document.getElementById('beatIndicator');
  el.classList.add('pulse');
  el.classList.toggle('accent', accent);
  setTimeout(() => el.classList.remove('pulse'), 80);
}

function currentModeBpm() {
  return computeEffectiveBpm(state.metronome.bpm, state.metronome.percent);
}

function advanceModeAfterBeat() {
  // No-op for the metronome tab; Ramp (Task 6) and Practice (Task 7)
  // override behavior by checking state.topBar.activeTab here.
}

function scheduleBeat(time) {
  const bpm = currentModeBpm();
  const accent = state.topBar.activeTab === 'metronome'
    && state.metronome.accentFirstBeat
    && isAccentBeat(beatIndexInBar);
  scheduleClick(time, accent, false);

  const subCount = subdivisionCount(state.topBar.subdivision);
  const subInterval = subdivisionIntervalSeconds(bpm, state.topBar.subdivision);
  for (let s = 1; s < subCount; s++) {
    scheduleClick(time + subInterval * s, false, true);
  }

  const ctx = ensureAudioContext();
  setTimeout(() => flashBeatIndicator(accent), Math.max(0, (time - ctx.currentTime) * 1000));

  beatIndexInBar = (beatIndexInBar + 1) % state.topBar.timeSigNum;
  advanceModeAfterBeat();
  nextNoteTime = time + beatIntervalSeconds(bpm);
}

function schedulerTick() {
  const ctx = ensureAudioContext();
  while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
    scheduleBeat(nextNoteTime);
  }
  schedulerTimerId = setTimeout(schedulerTick, LOOKAHEAD_MS);
}

function startPlayback() {
  if (isPlaying) return;
  const ctx = ensureAudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  isPlaying = true;
  beatIndexInBar = 0;
  nextNoteTime = ctx.currentTime + 0.05;
  schedulerTick();
  document.getElementById('startStop').textContent = 'Stop';
}

function stopPlayback() {
  if (!isPlaying) return;
  isPlaying = false;
  clearTimeout(schedulerTimerId);
  document.getElementById('startStop').textContent = 'Start';
}

document.getElementById('startStop').addEventListener('click', () => {
  if (isPlaying) stopPlayback(); else startPlayback();
});
```

- [ ] **Step 2: Wire the Metronome tab's BPM, percent, and accent controls**

Append to the same script block:

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
  }
  function setPercent(value) {
    state.metronome.percent = clampBpmPercent(value);
    percent.value = state.metronome.percent;
    percentRange.value = state.metronome.percent;
  }

  bpm.addEventListener('change', () => setBpm(bpm.value));
  bpmRange.addEventListener('input', () => setBpm(bpmRange.value));
  percent.addEventListener('change', () => setPercent(percent.value));
  percentRange.addEventListener('input', () => setPercent(percentRange.value));
  accent.addEventListener('change', () => { state.metronome.accentFirstBeat = accent.checked; });
}

bindMetronomeTab();
```

- [ ] **Step 3: Manual browser verification**

Open `metronome.html`. Click Start with default settings (120 BPM, 4/4, no
subdivision, accent on). Expected: a steady click roughly twice per second,
with every 4th click sounding higher-pitched (the accent). Drag the BPM
range slider while playing — the tempo should audibly speed up/slow down
within a beat or two (not instantly glitch). Set % of BPM to 50 — tempo
should audibly halve. Change Subdivision to "Eighths" — you should hear a
soft click between each main beat. Change Sound to "Wood Block" and "Beep"
and confirm the timbre changes. Click Stop — sound stops immediately and the
button label reverts to "Start".

- [ ] **Step 4: Commit**

```bash
git add metronome.html
git commit -m "Add Web Audio scheduler engine and wire Metronome tab"
```

---

### Task 4: Tap Tempo

**Files:**
- Modify: `metronome.html`
- Modify: `tests/logic.test.js`

**Interfaces:**
- Consumes: `clampBpm` from Task 1; `state.topBar.activeTab`,
  `state.metronome`, `state.ramp`, `state.practice` from Task 2.
- Produces: `bpmFromTapTimestamps(timestamps) -> number|null`.

- [ ] **Step 1: Write failing tests**

Add to `tests/logic.test.js`:

```js
test('bpmFromTapTimestamps returns null with fewer than 2 taps', () => {
  const { bpmFromTapTimestamps } = loadLogic(['bpmFromTapTimestamps']);
  assert.equal(bpmFromTapTimestamps([]), null);
  assert.equal(bpmFromTapTimestamps([1000]), null);
});

test('bpmFromTapTimestamps computes bpm from average interval', () => {
  const { bpmFromTapTimestamps } = loadLogic(['bpmFromTapTimestamps']);
  // Four taps exactly 500ms apart = 120 BPM
  assert.equal(bpmFromTapTimestamps([0, 500, 1000, 1500]), 120);
});

test('bpmFromTapTimestamps ignores a gap larger than 2000ms', () => {
  const { bpmFromTapTimestamps } = loadLogic(['bpmFromTapTimestamps']);
  // First two taps 5000ms apart (stale), last two 500ms apart (120 BPM)
  assert.equal(bpmFromTapTimestamps([0, 5000, 5500, 6000]), 120);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL — `bpmFromTapTimestamps is not a function`.

- [ ] **Step 3: Implement the function**

Add inside `// LOGIC-BEGIN` / `// LOGIC-END`, after `isAccentBeat`:

```js
function bpmFromTapTimestamps(timestamps) {
  if (!Array.isArray(timestamps) || timestamps.length < 2) return null;
  const diffs = [];
  for (let i = 1; i < timestamps.length; i++) {
    const diff = timestamps[i] - timestamps[i - 1];
    if (diff > 0 && diff <= 2000) diffs.push(diff);
  }
  if (diffs.length === 0) return null;
  const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  return clampBpm(60000 / avg);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: all tests pass (9 from Tasks 1-2 + 3 new = 12).

- [ ] **Step 5: Wire the Tap Tempo button**

Append to the app script block:

```js
let tapTimestamps = [];

function activeBpmField() {
  const tab = state.topBar.activeTab;
  if (tab === 'ramp') return { input: document.getElementById('rampStartBpm'), key: 'ramp', prop: 'startBpm' };
  if (tab === 'practice') return { input: document.getElementById('practiceBaseBpm'), key: 'practice', prop: 'baseBpm' };
  return { input: document.getElementById('metronomeBpm'), key: 'metronome', prop: 'bpm' };
}

document.getElementById('tapTempo').addEventListener('click', () => {
  const now = Date.now();
  if (tapTimestamps.length > 0 && now - tapTimestamps[tapTimestamps.length - 1] > 2000) {
    tapTimestamps = [];
  }
  tapTimestamps.push(now);
  if (tapTimestamps.length > 8) tapTimestamps = tapTimestamps.slice(-8);

  const bpm = bpmFromTapTimestamps(tapTimestamps);
  if (bpm === null) return;

  const field = activeBpmField();
  state[field.key][field.prop] = bpm;
  field.input.value = bpm;
  if (field.key === 'metronome') {
    document.getElementById('metronomeBpmRange').value = bpm;
  }
});
```

- [ ] **Step 6: Manual browser verification**

Open `metronome.html`. Click "Tap Tempo" four times at a steady, roughly
120-BPM pace (about twice per second). Expected: the Metronome tab's BPM
field updates to a value close to 120 after the second tap and refines with
each subsequent tap. Click it once, wait 3+ seconds, then tap again —
expected: no error in the console, and the tap sequence effectively resets
(first tap after the pause produces no update since fewer than 2 usable
taps exist yet).

- [ ] **Step 7: Commit**

```bash
git add metronome.html tests/logic.test.js
git commit -m "Add tap tempo logic and wiring"
```

---

### Task 5: Tab switching (stop-on-switch)

**Files:**
- Modify: `metronome.html`

**Interfaces:**
- Consumes: `state.topBar.activeTab`, `isPlaying`, `stopPlayback()` from
  earlier tasks.
- Produces: tab-switching behavior consumed visually by the rest of the app;
  no new functions.

This task is DOM-dependent and has no automated test; verified manually.

- [ ] **Step 1: Wire the tab buttons**

Append to the app script block:

```js
function switchTab(tabName) {
  if (isPlaying) stopPlayback();
  state.topBar.activeTab = tabName;

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.getElementById('panel-metronome').hidden = tabName !== 'metronome';
  document.getElementById('panel-ramp').hidden = tabName !== 'ramp';
  document.getElementById('panel-practice').hidden = tabName !== 'practice';
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});
```

- [ ] **Step 2: Manual browser verification**

Open `metronome.html`, click Start on the Metronome tab, then click the
"Ramp" tab button. Expected: playback stops immediately (click sounds and
beat indicator pulsing stop, Start/Stop button reverts to "Start"), the Ramp
panel becomes visible, and the Ramp tab button is visually marked active.
Repeat switching to "Practice" and back to "Metronome" to confirm each panel
shows/hides correctly and the correct tab button is highlighted each time.

- [ ] **Step 3: Commit**

```bash
git add metronome.html
git commit -m "Add tab switching with stop-on-switch behavior"
```

---

### Task 6: Ramp mode logic, UI, and scheduler integration

**Files:**
- Modify: `metronome.html`
- Modify: `tests/logic.test.js`

**Interfaces:**
- Consumes: `clampBpm` (Task 1); `currentModeBpm()`,
  `advanceModeAfterBeat()`, `startPlayback()` seams (Task 3);
  `state.ramp`, `state.topBar.timeSigNum` (Task 2).
- Produces: `inferRampDirection(startBpm, stopBpm) -> 'up'|'down'|null`,
  `computeNextRampBpm(currentBpm, direction, scaleMode, scaleAmount,
  stopBpm) -> number`, `barsToBeats(bars, timeSigNumerator) -> number` — all
  consumed only within this task's scheduler-integration step.

- [ ] **Step 1: Write failing tests**

Add to `tests/logic.test.js`:

```js
test('inferRampDirection detects up, down, and equal', () => {
  const { inferRampDirection } = loadLogic(['inferRampDirection']);
  assert.equal(inferRampDirection(80, 140), 'up');
  assert.equal(inferRampDirection(140, 80), 'down');
  assert.equal(inferRampDirection(100, 100), null);
});

test('computeNextRampBpm steps up by a fixed amount and clamps at stop', () => {
  const { computeNextRampBpm } = loadLogic(['computeNextRampBpm']);
  assert.equal(computeNextRampBpm(96, 'up', 'fixed', 5, 100), 100);
  assert.equal(computeNextRampBpm(80, 'up', 'fixed', 5, 140), 85);
});

test('computeNextRampBpm steps down by a percentage and clamps at stop', () => {
  const { computeNextRampBpm } = loadLogic(['computeNextRampBpm']);
  assert.equal(computeNextRampBpm(100, 'down', 'percent', 10, 95), 95);
  assert.equal(computeNextRampBpm(100, 'down', 'percent', 10, 50), 90);
});

test('computeNextRampBpm holds at stop when direction is null', () => {
  const { computeNextRampBpm } = loadLogic(['computeNextRampBpm']);
  assert.equal(computeNextRampBpm(100, null, 'fixed', 5, 100), 100);
});

test('barsToBeats multiplies bars by the time signature numerator', () => {
  const { barsToBeats } = loadLogic(['barsToBeats']);
  assert.equal(barsToBeats(4, 4), 16);
  assert.equal(barsToBeats(2, 7), 14);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL — `inferRampDirection is not a function` (and similarly for
the other two).

- [ ] **Step 3: Implement the pure functions**

Add inside `// LOGIC-BEGIN` / `// LOGIC-END`, after `bpmFromTapTimestamps`:

```js
function inferRampDirection(startBpm, stopBpm) {
  if (startBpm === stopBpm) return null;
  return startBpm < stopBpm ? 'up' : 'down';
}

function computeNextRampBpm(currentBpm, direction, scaleMode, scaleAmount, stopBpm) {
  if (direction === null) return stopBpm;
  const delta = scaleMode === 'percent' ? currentBpm * (scaleAmount / 100) : scaleAmount;
  let next = direction === 'up' ? currentBpm + delta : currentBpm - delta;
  next = direction === 'up' ? Math.min(next, stopBpm) : Math.max(next, stopBpm);
  return Math.round(next);
}

function barsToBeats(bars, timeSigNumerator) {
  return bars * timeSigNumerator;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: all tests pass (12 from Tasks 1-4 + 5 new = 17).

- [ ] **Step 5: Integrate ramp stepping into the scheduler**

Modify `currentModeBpm()` and `advanceModeAfterBeat()` (both defined in Task
3) to branch on the active tab, and add a `rampRuntime` variable and readout
updater:

```js
let rampRuntime = null;

function currentModeBpm() {
  if (state.topBar.activeTab === 'ramp') {
    return rampRuntime.currentBpm;
  }
  return computeEffectiveBpm(state.metronome.bpm, state.metronome.percent);
}

function updateRampReadout() {
  document.getElementById('rampReadout').textContent =
    `Current: ${rampRuntime.currentBpm} BPM` + (rampRuntime.direction === null ? ' (holding at target)' : '');
}

function advanceModeAfterBeat() {
  if (state.topBar.activeTab !== 'ramp' || !rampRuntime) return;
  rampRuntime.beatsIntoStep++;
  const beatsPerStep = barsToBeats(state.ramp.stepBars, state.topBar.timeSigNum);
  if (rampRuntime.direction !== null && rampRuntime.beatsIntoStep >= beatsPerStep) {
    rampRuntime.currentBpm = computeNextRampBpm(
      rampRuntime.currentBpm, rampRuntime.direction, state.ramp.scaleMode,
      state.ramp.scaleAmount, state.ramp.stopBpm
    );
    rampRuntime.beatsIntoStep = 0;
    if (rampRuntime.currentBpm === state.ramp.stopBpm) rampRuntime.direction = null;
  }
  updateRampReadout();
}
```

Modify `startPlayback()` (Task 3) to initialize `rampRuntime` when the ramp
tab is active — add this block right after `nextNoteTime = ctx.currentTime +
0.05;`:

```js
if (state.topBar.activeTab === 'ramp') {
  rampRuntime = {
    currentBpm: clampBpm(state.ramp.startBpm),
    direction: inferRampDirection(state.ramp.startBpm, state.ramp.stopBpm),
    beatsIntoStep: 0,
  };
  updateRampReadout();
}
```

- [ ] **Step 6: Wire the Ramp tab's inputs**

Append to the app script block:

```js
function bindRampTab() {
  const startBpm = document.getElementById('rampStartBpm');
  const stopBpm = document.getElementById('rampStopBpm');
  const scaleMode = document.getElementById('rampScaleMode');
  const scaleAmount = document.getElementById('rampScaleAmount');
  const stepBars = document.getElementById('rampStepBars');

  startBpm.addEventListener('change', () => {
    state.ramp.startBpm = clampBpm(startBpm.value);
    startBpm.value = state.ramp.startBpm;
  });
  stopBpm.addEventListener('change', () => {
    state.ramp.stopBpm = clampBpm(stopBpm.value);
    stopBpm.value = state.ramp.stopBpm;
  });
  scaleMode.addEventListener('change', () => { state.ramp.scaleMode = scaleMode.value; });
  scaleAmount.addEventListener('change', () => {
    const n = Number(scaleAmount.value);
    state.ramp.scaleAmount = Number.isFinite(n) && n > 0 ? n : DEFAULT_STATE.ramp.scaleAmount;
    scaleAmount.value = state.ramp.scaleAmount;
  });
  stepBars.addEventListener('change', () => {
    state.ramp.stepBars = clampPositiveInt(stepBars.value, DEFAULT_STATE.ramp.stepBars);
    stepBars.value = state.ramp.stepBars;
  });
}

bindRampTab();
```

- [ ] **Step 7: Manual browser verification**

Open `metronome.html`, click the "Ramp" tab, set Start BPM to 80, Stop BPM
to 100, Scale Mode to "Fixed BPM per step", Scale Amount to 10, Step Length
to 1 bar (with the default 4/4 time signature, that's 4 beats/step). Click
Start. Expected: the readout shows "Current: 80 BPM", and every 4 clicks the
readout jumps by 10 (80 → 90 → 100), audibly speeding up each time; once it
reaches 100 the readout shows "(holding at target)" and playback continues
at that steady speed until you click Stop.

- [ ] **Step 8: Commit**

```bash
git add metronome.html tests/logic.test.js
git commit -m "Add ramp mode logic, UI, and scheduler integration"
```

---

### Task 7: Practice mode logic, UI, and scheduler integration

**Files:**
- Modify: `metronome.html`
- Modify: `tests/logic.test.js`

**Interfaces:**
- Consumes: `currentModeBpm()`, `advanceModeAfterBeat()`, `startPlayback()`
  seams (Task 3); `state.practice` (Task 2).
- Produces: `computeSlowBpm(baseBpm, deltaPercent) -> number`,
  `buildPracticePhaseSequence(beatsPerPhase) -> string[]`,
  `bpmForPhase(phase, baseBpm, slowBpm) -> number` — consumed only within
  this task's scheduler-integration step.

- [ ] **Step 1: Write failing tests**

Add to `tests/logic.test.js`:

```js
test('computeSlowBpm applies the delta percent below base', () => {
  const { computeSlowBpm } = loadLogic(['computeSlowBpm']);
  assert.equal(computeSlowBpm(120, 50), 60);
  assert.equal(computeSlowBpm(120, 25), 90);
});

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

test('bpmForPhase returns base for fast and slow bpm for slow/break', () => {
  const { bpmForPhase } = loadLogic(['bpmForPhase']);
  assert.equal(bpmForPhase('fast', 120, 60), 120);
  assert.equal(bpmForPhase('slow', 120, 60), 60);
  assert.equal(bpmForPhase('break', 120, 60), 60);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL — `computeSlowBpm is not a function` (and similarly for the
other two).

- [ ] **Step 3: Implement the pure functions**

Add inside `// LOGIC-BEGIN` / `// LOGIC-END`, after `barsToBeats`:

```js
function computeSlowBpm(baseBpm, deltaPercent) {
  return Math.max(1, Math.round(baseBpm * (1 - deltaPercent / 100)));
}

function buildPracticePhaseSequence(beatsPerPhase) {
  const seq = [];
  for (let i = 0; i < beatsPerPhase; i++) seq.push('slow');
  seq.push('break');
  for (let i = 0; i < beatsPerPhase; i++) seq.push('fast');
  seq.push('break');
  return seq;
}

function bpmForPhase(phase, baseBpm, slowBpm) {
  return phase === 'fast' ? baseBpm : slowBpm;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: all tests pass (17 from Tasks 1-6 + 3 new = 20).

- [ ] **Step 5: Integrate practice phase sequencing into the scheduler**

Modify `currentModeBpm()` and `advanceModeAfterBeat()` again to add a
`practice` branch, and add a `practiceRuntime` variable and readout updater:

```js
let practiceRuntime = null;

function currentModeBpm() {
  if (state.topBar.activeTab === 'ramp') {
    return rampRuntime.currentBpm;
  }
  if (state.topBar.activeTab === 'practice') {
    return bpmForPhase(practiceRuntime.sequence[practiceRuntime.index], state.practice.baseBpm, practiceRuntime.slowBpm);
  }
  return computeEffectiveBpm(state.metronome.bpm, state.metronome.percent);
}

function updatePracticeReadout() {
  const phase = practiceRuntime.sequence[practiceRuntime.index];
  document.getElementById('practiceReadout').textContent = `Phase: ${phase.toUpperCase()}`;
}

function advanceModeAfterBeat() {
  if (state.topBar.activeTab === 'ramp' && rampRuntime) {
    rampRuntime.beatsIntoStep++;
    const beatsPerStep = barsToBeats(state.ramp.stepBars, state.topBar.timeSigNum);
    if (rampRuntime.direction !== null && rampRuntime.beatsIntoStep >= beatsPerStep) {
      rampRuntime.currentBpm = computeNextRampBpm(
        rampRuntime.currentBpm, rampRuntime.direction, state.ramp.scaleMode,
        state.ramp.scaleAmount, state.ramp.stopBpm
      );
      rampRuntime.beatsIntoStep = 0;
      if (rampRuntime.currentBpm === state.ramp.stopBpm) rampRuntime.direction = null;
    }
    updateRampReadout();
  } else if (state.topBar.activeTab === 'practice' && practiceRuntime) {
    practiceRuntime.index = (practiceRuntime.index + 1) % practiceRuntime.sequence.length;
    updatePracticeReadout();
  }
}
```

Modify `startPlayback()` to initialize `practiceRuntime` — add this block
next to the ramp initialization block added in Task 6:

```js
if (state.topBar.activeTab === 'practice') {
  practiceRuntime = {
    sequence: buildPracticePhaseSequence(state.practice.beatsPerPhase),
    index: 0,
    slowBpm: computeSlowBpm(state.practice.baseBpm, state.practice.deltaPercent),
  };
  updatePracticeReadout();
}
```

- [ ] **Step 6: Wire the Practice tab's inputs**

Append to the app script block:

```js
function bindPracticeTab() {
  const baseBpm = document.getElementById('practiceBaseBpm');
  const deltaPercent = document.getElementById('practiceDeltaPercent');
  const beatsPerPhase = document.getElementById('practiceBeatsPerPhase');

  baseBpm.addEventListener('change', () => {
    state.practice.baseBpm = clampBpm(baseBpm.value);
    baseBpm.value = state.practice.baseBpm;
  });
  deltaPercent.addEventListener('change', () => {
    const n = Math.round(Number(deltaPercent.value));
    state.practice.deltaPercent = Number.isFinite(n) ? Math.min(90, Math.max(10, n)) : DEFAULT_STATE.practice.deltaPercent;
    deltaPercent.value = state.practice.deltaPercent;
  });
  beatsPerPhase.addEventListener('change', () => {
    state.practice.beatsPerPhase = clampPositiveInt(beatsPerPhase.value, DEFAULT_STATE.practice.beatsPerPhase);
    beatsPerPhase.value = state.practice.beatsPerPhase;
  });
}

bindPracticeTab();
```

- [ ] **Step 7: Manual browser verification**

Open `metronome.html`, click the "Practice" tab, set Base BPM to 120, Speed
Delta % to 50 (Slow = 60), Beats per Phase to 2. Click Start. Expected: the
readout cycles PHASE: SLOW, SLOW, BREAK, FAST, FAST, BREAK, repeating, and
you can audibly hear two slow clicks at 60 BPM, one click at 60 BPM (break),
two fast clicks at 120 BPM, one click at 60 BPM (break), then the cycle
repeats.

- [ ] **Step 8: Commit**

```bash
git add metronome.html tests/logic.test.js
git commit -m "Add practice mode logic, UI, and scheduler integration"
```

---

### Task 8: Persistence (localStorage)

**Files:**
- Modify: `metronome.html`
- Modify: `tests/logic.test.js`

**Interfaces:**
- Consumes: `DEFAULT_STATE`, `state` (Task 2); all `bind*Tab()` functions
  (Tasks 2, 3, 6, 7) to refresh inputs after loading persisted state.
- Produces: `serializeSettings(state) -> string`,
  `deserializeSettings(json, defaults) -> object`.

- [ ] **Step 1: Write failing tests**

Add to `tests/logic.test.js`:

```js
test('serializeSettings round-trips through JSON', () => {
  const { serializeSettings } = loadLogic(['serializeSettings']);
  const state = { metronome: { bpm: 100 } };
  assert.equal(serializeSettings(state), JSON.stringify(state));
});

test('deserializeSettings merges saved values over defaults', () => {
  const { deserializeSettings } = loadLogic(['deserializeSettings']);
  const defaults = { metronome: { bpm: 120, percent: 100 }, ramp: { startBpm: 80 } };
  const saved = JSON.stringify({ metronome: { bpm: 90 } });
  assert.deepEqual(deserializeSettings(saved, defaults), {
    metronome: { bpm: 90, percent: 100 },
    ramp: { startBpm: 80 },
  });
});

test('deserializeSettings falls back to defaults on invalid JSON', () => {
  const { deserializeSettings } = loadLogic(['deserializeSettings']);
  const defaults = { metronome: { bpm: 120 } };
  assert.deepEqual(deserializeSettings('not json', defaults), { metronome: { bpm: 120 } });
});

test('deserializeSettings falls back to defaults on missing input', () => {
  const { deserializeSettings } = loadLogic(['deserializeSettings']);
  const defaults = { metronome: { bpm: 120 } };
  assert.deepEqual(deserializeSettings(null, defaults), { metronome: { bpm: 120 } });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL — `serializeSettings is not a function`.

- [ ] **Step 3: Implement the pure functions**

Add inside `// LOGIC-BEGIN` / `// LOGIC-END`, after `bpmForPhase`:

```js
function serializeSettings(state) {
  return JSON.stringify(state);
}

function deserializeSettings(json, defaults) {
  const merged = JSON.parse(JSON.stringify(defaults));
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return merged;
  }
  if (!parsed || typeof parsed !== 'object') return merged;
  for (const section of Object.keys(defaults)) {
    if (parsed[section] && typeof parsed[section] === 'object') {
      Object.assign(merged[section], parsed[section]);
    }
  }
  return merged;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: all tests pass (20 from Tasks 1-7 + 4 new = 24).

- [ ] **Step 5: Wire load-on-start and save-on-change**

Replace the `const state = JSON.parse(JSON.stringify(DEFAULT_STATE));` line
(added in Task 2) with:

```js
const STORAGE_KEY = 'guitarMetronomeSettings';
let state = deserializeSettings(localStorage.getItem(STORAGE_KEY), DEFAULT_STATE);

function persistState() {
  localStorage.setItem(STORAGE_KEY, serializeSettings(state));
}

function refreshAllInputsFromState() {
  document.getElementById('timeSigNum').value = state.topBar.timeSigNum;
  document.getElementById('timeSigDen').value = state.topBar.timeSigDen;
  document.getElementById('subdivision').value = state.topBar.subdivision;
  document.getElementById('soundStyle').value = state.topBar.soundStyle;
  document.getElementById('volume').value = state.topBar.volume;

  document.getElementById('metronomeBpm').value = state.metronome.bpm;
  document.getElementById('metronomeBpmRange').value = state.metronome.bpm;
  document.getElementById('metronomePercent').value = state.metronome.percent;
  document.getElementById('metronomePercentRange').value = state.metronome.percent;
  document.getElementById('accentFirstBeat').checked = state.metronome.accentFirstBeat;

  document.getElementById('rampStartBpm').value = state.ramp.startBpm;
  document.getElementById('rampStopBpm').value = state.ramp.stopBpm;
  document.getElementById('rampScaleMode').value = state.ramp.scaleMode;
  document.getElementById('rampScaleAmount').value = state.ramp.scaleAmount;
  document.getElementById('rampStepBars').value = state.ramp.stepBars;

  document.getElementById('practiceBaseBpm').value = state.practice.baseBpm;
  document.getElementById('practiceDeltaPercent').value = state.practice.deltaPercent;
  document.getElementById('practiceBeatsPerPhase').value = state.practice.beatsPerPhase;

  switchTab(state.topBar.activeTab);
}
```

Add a call to `refreshAllInputsFromState();` at the very end of the app
script block (after all `bind*Tab()` calls), and add `persistState();` as
the last line inside every `addEventListener` callback that mutates `state`
across the `bindTopBar`, `bindMetronomeTab`, `bindRampTab`, and
`bindPracticeTab` functions (Tasks 2, 3, 6, 7).

- [ ] **Step 6: Manual browser verification**

Open `metronome.html`. Change the BPM to 140, switch to the Ramp tab and set
Stop BPM to 160, switch to Practice and set Beats per Phase to 6. Reload the
page. Expected: the Metronome tab shows BPM 140, the Ramp tab shows Stop BPM
160, and the Practice tab shows Beats per Phase 6 — and the app reopens on
whichever tab was last active. Then open the browser dev console, run
`localStorage.removeItem('guitarMetronomeSettings')`, and reload again.
Expected: all fields revert to the documented defaults (120 BPM, 4/4, no
subdivision, click sound, 80% volume, etc.).

- [ ] **Step 7: Commit**

```bash
git add metronome.html tests/logic.test.js
git commit -m "Add localStorage persistence for all settings"
```

---

### Task 9: Validation and edge-case hardening

**Files:**
- Modify: `metronome.html`
- Modify: `tests/logic.test.js`

**Interfaces:**
- Consumes: `clampPositiveInt` (already present inline since Task 2; this
  task moves it into the LOGIC block and adds tests).
- Produces: no new functions — `clampPositiveInt` relocates from the app
  script block into the LOGIC block so it is covered by automated tests.

- [ ] **Step 1: Write failing tests for `clampPositiveInt`**

Add to `tests/logic.test.js`:

```js
test('clampPositiveInt returns the fallback for non-positive or non-numeric input', () => {
  const { clampPositiveInt } = loadLogic(['clampPositiveInt']);
  assert.equal(clampPositiveInt(0, 4), 4);
  assert.equal(clampPositiveInt(-3, 4), 4);
  assert.equal(clampPositiveInt('abc', 4), 4);
});

test('clampPositiveInt rounds and passes through positive input', () => {
  const { clampPositiveInt } = loadLogic(['clampPositiveInt']);
  assert.equal(clampPositiveInt(3.6, 4), 4);
  assert.equal(clampPositiveInt(7, 4), 7);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL — `clampPositiveInt is not a function` (it currently only
exists in the app script block, outside the LOGIC markers the test harness
extracts).

- [ ] **Step 3: Move `clampPositiveInt` into the LOGIC block**

Remove this function from the app script block (where Task 2 placed it,
just above `bindTopBar`):

```js
function clampPositiveInt(value, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}
```

Add the same function inside `// LOGIC-BEGIN` / `// LOGIC-END`, after
`deserializeSettings`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: all tests pass (24 from Tasks 1-8 + 2 new = 26).

- [ ] **Step 5: Add the "already at target" ramp message**

Modify `updateRampReadout()` (Task 6) — it already appends "(holding at
target)" whenever `rampRuntime.direction === null`, which covers both the
"reached stop" case and the "start equals stop" case, since
`inferRampDirection` returns `null` for equal values too. No code change
needed here; this step is a verification-only checkpoint — confirm the
existing logic already covers it (see Step 6).

- [ ] **Step 6: Manual browser verification**

Open `metronome.html`. On the Ramp tab, set Start BPM and Stop BPM to the
same value (e.g. both 100), click Start. Expected: the readout immediately
shows "Current: 100 BPM (holding at target)" and the tempo never changes.
On each tab, try entering `0`, a negative number, and letters into the
"beats per phase" / "step bars" / BPM fields, then click elsewhere to
trigger the `change` event. Expected: every field snaps back to a valid
value (its previous value or the documented default) rather than accepting
an invalid state, and playback (if started afterward) does not throw a
console error or freeze.

- [ ] **Step 7: Commit**

```bash
git add metronome.html tests/logic.test.js
git commit -m "Harden input validation and cover clampPositiveInt with tests"
```

---

### Task 10: Final acceptance walkthrough

**Files:** none (verification-only task; no code changes are expected
unless the walkthrough surfaces a bug, in which case fix it in
`metronome.html` before committing).

**Interfaces:** none — this task exercises the finished app end-to-end.

- [ ] **Step 1: Timing accuracy spot-check**

In each of the three tabs, set BPM/Base BPM to 60 and start playback. Using
a stopwatch (or your phone's), count 10 clicks and confirm they span
approximately 10 seconds (60 BPM = 1 click/second). Expected: within ~0.5s
tolerance over 10 seconds.

- [ ] **Step 2: Tab-switch-stops-playback re-check**

Start playback on the Practice tab, switch to Metronome. Expected: playback
stops immediately, no residual clicks or console errors.

- [ ] **Step 3: Persistence re-check**

Set distinct, non-default values in all three tabs and the top bar, reload
the page. Expected: every value is restored exactly as set.

- [ ] **Step 4: Ramp hold-at-stop re-check**

Run a ramp from 80 to 90 BPM with a 1-bar step and a large step (e.g. +20
fixed BPM) so it reaches Stop BPM quickly. Expected: it holds at exactly 90
BPM indefinitely once reached, never overshooting.

- [ ] **Step 5: Practice break-at-slow-tempo re-check**

Run a practice drill with Base BPM 160, Delta % 50 (Slow = 80), Beats per
Phase 3. Listen for the break beats. Expected: both break beats (after slow
and after fast) are audibly at 80 BPM speed, not 160.

- [ ] **Step 6: Accent and subdivision re-check across time signatures**

On the Metronome tab, set time signature to 3/4, confirm the accent lands
every 3rd click. Set it to 7/8, confirm the accent lands every 7th click.
With subdivision set to "Sixteenths", confirm 4 evenly-spaced clicks occur
per main beat.

- [ ] **Step 7: Run the full automated test suite one more time**

Run: `node --test tests/`
Expected: all 26 tests pass.

- [ ] **Step 8: Final commit (only if the walkthrough required fixes)**

```bash
git add metronome.html
git commit -m "Fix issues found during final acceptance walkthrough"
```

If no fixes were needed, this task requires no commit — the plan is
complete as of Task 9's commit.
