# Metronome UI Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `metronome.html`'s visual design from unstyled default-browser
HTML to a modern, clean dark theme with a warm amber accent, without changing
any existing tempo/persistence/validation logic.

**Architecture:** Two implementation tasks against the existing single file:
first a full CSS rework of every existing element (pure presentation, zero
JS/logic changes), then a scoped addition of two new pieces of real-time
visual feedback (a live hero BPM number and a per-beat dot row replacing the
single pulsing dot) that do require small, precise JS changes around the
scheduler's existing beat-timing calls. A final task is a human-performed
manual verification pass, since this project has no browser/audio automation
available to any agent.

**Tech Stack:** Same as the existing app — vanilla HTML/CSS/JS, Web Audio
API, no build step, no dependencies. No changes to the Node test harness.

## Global Constraints

- Still a single self-contained `metronome.html` file — no build step, no
  external fonts, no CDN links, no network calls, no new runtime files.
- Every existing element `id` referenced by the JS (`metronomeBpm`,
  `rampReadout`, `beatIndicator`, `startStop`, etc.) must remain unchanged.
- No change to any pure `LOGIC-BEGIN`/`LOGIC-END` function, and no change to
  `tests/logic.test.js` — all 28 existing tests must continue to pass
  unmodified after every task in this plan.
- Dark theme only (no light mode / theme toggle) with a warm amber accent
  (`--accent: #f5a623`) and a separate soft red reserved only for the
  accented-beat flash (`--accent-beat: #e5484d`).
- No new features and no change to existing behavior other than the two
  additions explicitly described in Task 2 (live hero BPM number, per-beat
  dot row) — this is a visual/UX rework, not a feature addition.
- Run tests with `node --test tests/*.test.js` (the directory form
  `node --test tests/` does not work reliably on this Node/Windows setup —
  always use the glob form).

---

### Task 1: Full CSS rework (dark theme, typography, layout, components)

**Files:**
- Modify: `metronome.html` (the `<style>` block only — no HTML markup or
  `<script>` changes in this task)

**Interfaces:**
- Consumes: nothing — pure CSS working against the existing, unchanged HTML
  element IDs/classes.
- Produces: CSS custom properties (`--bg`, `--panel`, `--divider`, `--text`,
  `--text-muted`, `--accent`, `--accent-beat`, `--radius`,
  `--radius-lg`) on `:root`, consumed by Task 2's new CSS rules.

- [ ] **Step 1: Replace the entire `<style>...</style>` block**

Replace everything between the `<style>` and `</style>` tags in
`metronome.html` with:

```css
:root {
  --bg: #15151a;
  --panel: #1c1c22;
  --divider: #2a2a33;
  --text: #e8e8ec;
  --text-muted: #8b8b95;
  --accent: #f5a623;
  --accent-beat: #e5484d;
  --radius: 8px;
  --radius-lg: 999px;
}

* { box-sizing: border-box; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  max-width: 480px;
  margin: 2.5rem auto;
  padding: 0 1.25rem 3rem;
  line-height: 1.45;
}

h1 {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-align: center;
  margin: 0 0 2rem;
}

#topbar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  align-items: flex-end;
  padding-bottom: 1.25rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--divider);
  font-size: 0.78rem;
}

#tabs {
  display: flex;
  gap: 1.75rem;
  border-bottom: 1px solid var(--divider);
  margin-bottom: 2rem;
}

.tab-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  padding: 0.65rem 0.05rem;
  margin-bottom: -1px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s ease;
}

.tab-btn:hover { color: var(--text); }

.tab-btn.active {
  color: var(--accent);
  font-weight: 600;
  border-bottom-color: var(--accent);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
  padding-bottom: 1.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--divider);
}

.panel[hidden] { display: none; }

label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

input[type="number"],
select {
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--divider);
  border-radius: var(--radius);
  padding: 0.5rem 0.6rem;
  font: inherit;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s ease;
}

#topbar input[type="number"] { width: 4rem; }

input[type="number"]:focus,
select:focus {
  border-color: var(--accent);
}

input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--divider);
  outline: none;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: none;
  cursor: pointer;
}

input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: none;
  cursor: pointer;
}

input[type="range"]::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: var(--divider);
}

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

button {
  font: inherit;
  cursor: pointer;
}

#tapTempo {
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--divider);
  border-radius: var(--radius);
  padding: 0.5rem 0.9rem;
  font-size: 0.8rem;
  transition: border-color 0.15s ease, color 0.15s ease;
}

#tapTempo:hover {
  border-color: var(--accent);
  color: var(--accent);
}

#controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

#startStop {
  background: var(--accent);
  color: #1a1305;
  border: none;
  border-radius: var(--radius-lg);
  padding: 0.9rem 3rem;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: filter 0.15s ease, transform 0.05s ease;
}

#startStop:hover { filter: brightness(1.08); }
#startStop:active { transform: scale(0.98); }

#beatIndicator {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--divider);
  transition: background-color 0.05s ease;
}

#beatIndicator.pulse { background: var(--accent); }
#beatIndicator.pulse.accent { background: var(--accent-beat); }

#statusReadout,
.readout {
  font-size: 0.8rem;
  color: var(--text-muted);
  min-height: 1.2em;
  text-align: center;
}
```

Note: the `#beatIndicator`/`.pulse`/`.pulse.accent` rules above are an
interim styling (single dot, now dark-themed) — Task 2 will replace these
three rules with a dot-row version. Leaving them functional here means the
app is fully working and good-looking after this task alone, without
waiting on Task 2.

- [ ] **Step 2: Run the automated test suite to confirm no regression**

Run: `node --test tests/*.test.js`
Expected: 28/28 passing (this task touches no JS, so this just confirms
nothing was accidentally broken while editing the file).

- [ ] **Step 3: Manual browser verification**

Open `metronome.html` in a browser. Confirm: dark background with light
text throughout; the active tab shows an amber underline and the inactive
tabs are muted gray; number/select inputs are dark-filled with an amber
border on focus; range sliders show a thin dark track with an amber round
thumb; the "Accent first beat" checkbox shows an amber-filled box with a
checkmark when checked; the Start/Stop button is a large amber pill;
switching tabs, dragging sliders, and toggling the checkbox all still work
exactly as before (this task changes no behavior, only appearance). If you
have no browser available in your environment, do your best static
verification (re-read the assembled `<style>` block for syntax correctness,
confirm every selector used still matches an ID/class present in the HTML)
and clearly flag in your report that live visual verification was not
possible (DONE_WITH_CONCERNS, not a silent skip).

- [ ] **Step 4: Commit**

```bash
git add metronome.html
git commit -m "Rework metronome UI with a modern dark theme"
```

---

### Task 2: Live hero BPM number + per-beat dot row

**Files:**
- Modify: `metronome.html` (HTML markup, `<style>` block, and `<script>`
  block)

**Interfaces:**
- Consumes: `state`, `rampRuntime`, `practiceRuntime`, `computeEffectiveBpm`,
  `computeSlowBpm`, `bpmForPhase`, `clampBpm` (all pre-existing), plus the
  CSS custom properties from Task 1 (`--accent`, `--accent-beat`,
  `--divider`, `--text`, `--text-muted`).
- Produces: `updateHeroBpm(explicitBpm)`, `renderBeatDots()`, and a changed
  signature for `flashBeatIndicator` (now `flashBeatIndicator(beatIndex,
  accent)` instead of `flashBeatIndicator(accent)`) — internal to this
  task, not consumed elsewhere in the app.

This task changes real-time visual feedback tied to the scheduler's
per-beat timing, so it has no automated test (Web Audio/DOM-dependent,
consistent with how the original scheduler work was verified) — it is
verified manually in a browser, same as Task 1.

- [ ] **Step 1: Add the hero zone markup**

In `metronome.html`, insert this new `<div>` right after the closing `</div>`
of `#tabs` and right before the `<div id="panel-metronome" ...>` line:

```html
  <div id="heroZone">
    <div id="heroBpm">120</div>
    <div id="heroBpmLabel">BPM</div>
  </div>
```

- [ ] **Step 2: Add hero zone CSS and replace the beat-indicator CSS with a dot-row version**

In the `<style>` block, add these new rules (anywhere after the `:root`
block, e.g. right after the `.panel[hidden]` rule):

```css
#heroZone {
  text-align: center;
  margin-bottom: 2rem;
}

#heroBpm {
  font-size: 4rem;
  font-weight: 700;
  line-height: 1;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

#heroBpmLabel {
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-top: 0.35rem;
}
```

Then find the three rules Task 1 added for the beat indicator:

```css
#beatIndicator {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--divider);
  transition: background-color 0.05s ease;
}

#beatIndicator.pulse { background: var(--accent); }
#beatIndicator.pulse.accent { background: var(--accent-beat); }
```

Replace those three rules with:

```css
#beatIndicator {
  display: flex;
  gap: 0.4rem;
  justify-content: center;
}

.beat-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--divider);
  transition: background-color 0.05s ease;
}

.beat-dot.pulse { background: var(--accent); }
.beat-dot.pulse.accent { background: var(--accent-beat); }
```

- [ ] **Step 3: Add `renderBeatDots()` and wire it to run on load and on time-signature change**

In the `<script>` block, add this function right after `flashBeatIndicator`
(before you rewrite `flashBeatIndicator` in Step 4 — add this new function
first so the diff is easy to follow):

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

In `bindTopBar()`, find the `timeSigNum` listener:

```js
  timeSigNum.addEventListener('input', () => {
    state.topBar.timeSigNum = clampPositiveInt(timeSigNum.value, DEFAULT_STATE.topBar.timeSigNum);
    persistState();
  });
```

Add a call to `renderBeatDots()` inside it:

```js
  timeSigNum.addEventListener('input', () => {
    state.topBar.timeSigNum = clampPositiveInt(timeSigNum.value, DEFAULT_STATE.topBar.timeSigNum);
    renderBeatDots();
    persistState();
  });
```

At the very end of the script (find the line `refreshAllInputsFromState();`
near the bottom of the file), add a call right after it so the dot row is
built once on load, after the persisted time signature has been restored:

```js
refreshAllInputsFromState();
renderBeatDots();
```

- [ ] **Step 4: Rewrite `flashBeatIndicator` to target a specific dot, and capture the beat's index before it changes**

Replace the existing `flashBeatIndicator` function:

```js
function flashBeatIndicator(accent) {
  const el = document.getElementById('beatIndicator');
  el.classList.add('pulse');
  el.classList.toggle('accent', accent);
  setTimeout(() => el.classList.remove('pulse'), 80);
}
```

with:

```js
function flashBeatIndicator(beatIndex, accent) {
  const dots = document.getElementById('beatIndicator').children;
  const dot = dots[beatIndex];
  if (!dot) return;
  dot.classList.add('pulse');
  dot.classList.toggle('accent', accent);
  setTimeout(() => dot.classList.remove('pulse'), 80);
}
```

Now find `scheduleBeat`:

```js
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
```

`beatIndexInBar` is a module-level variable that gets incremented later in
this same function, before the scheduled `setTimeout` callback actually
fires — so the callback can't read `beatIndexInBar` directly at fire-time
without getting the *next* beat's index instead of the one being flashed.
Replace the whole function with this version, which captures the beat's own
index into a local constant before the increment, and also wires in the
hero BPM update from Step 5 below:

```js
function scheduleBeat(time) {
  const bpm = currentModeBpm();
  const beatIndex = beatIndexInBar;
  const accent = state.topBar.activeTab === 'metronome'
    && state.metronome.accentFirstBeat
    && isAccentBeat(beatIndex);
  scheduleClick(time, accent, false);

  const subCount = subdivisionCount(state.topBar.subdivision);
  const subInterval = subdivisionIntervalSeconds(bpm, state.topBar.subdivision);
  for (let s = 1; s < subCount; s++) {
    scheduleClick(time + subInterval * s, false, true);
  }

  const ctx = ensureAudioContext();
  setTimeout(() => {
    flashBeatIndicator(beatIndex, accent);
    updateHeroBpm(bpm);
  }, Math.max(0, (time - ctx.currentTime) * 1000));

  beatIndexInBar = (beatIndexInBar + 1) % state.topBar.timeSigNum;
  advanceModeAfterBeat();
  nextNoteTime = time + beatIntervalSeconds(bpm);
}
```

(The `accent` computation now reads the new `beatIndex` local instead of
`beatIndexInBar` directly — same value at this point in the function, just
reusing the captured constant. No behavior change to accent detection.)

- [ ] **Step 5: Add `updateHeroBpm` and wire it into every place the displayed tempo can change**

Add this new function in the `<script>` block, right after
`updatePracticeReadout`:

```js
function updateHeroBpm(explicitBpm) {
  const el = document.getElementById('heroBpm');
  let bpm = explicitBpm;
  if (bpm === undefined) {
    if (state.topBar.activeTab === 'ramp') {
      bpm = rampRuntime ? rampRuntime.currentBpm : clampBpm(state.ramp.startBpm);
    } else if (state.topBar.activeTab === 'practice') {
      if (practiceRuntime) {
        const slowBpm = computeSlowBpm(state.practice.baseBpm, state.practice.deltaPercent);
        bpm = bpmForPhase(practiceRuntime.sequence[practiceRuntime.index], state.practice.baseBpm, slowBpm);
      } else {
        bpm = clampBpm(state.practice.baseBpm);
      }
    } else {
      bpm = computeEffectiveBpm(state.metronome.bpm, state.metronome.percent);
    }
  }
  el.textContent = bpm;
}
```

Calling it with no argument computes the correct value to show for
whichever tab is active right now, whether or not playback is running
(guarding against `rampRuntime`/`practiceRuntime` being `null` before the
first Start). Calling it with an explicit number (as `scheduleBeat` now
does in Step 4) skips recomputation and displays exactly that value — this
matters for ramp/practice, where the number playing right now can
momentarily differ from what a fresh recompute of `state` would show.

Now wire it into every place that changes what should be displayed while
**not** actively playing (the playing case is already covered by Step 4's
change to `scheduleBeat`):

In `switchTab`, add a call at the end of the function:

```js
function switchTab(tabName) {
  if (isPlaying) stopPlayback();
  state.topBar.activeTab = tabName;
  persistState();

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.getElementById('panel-metronome').hidden = tabName !== 'metronome';
  document.getElementById('panel-ramp').hidden = tabName !== 'ramp';
  document.getElementById('panel-practice').hidden = tabName !== 'practice';
  updateHeroBpm();
}
```

In `bindMetronomeTab`, add a call inside both `setBpm` and `setPercent`:

```js
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
```

In `bindRampTab`, add a call inside the `startBpm` listener only:

```js
  startBpm.addEventListener('change', () => {
    state.ramp.startBpm = clampBpm(startBpm.value);
    startBpm.value = state.ramp.startBpm;
    updateHeroBpm();
    persistState();
  });
```

In `bindPracticeTab`, add a call inside the `baseBpm` listener only (not
`deltaPercent` or `beatsPerPhase` — those don't change what the hero shows
while stopped, since the resting display is Base BPM):

```js
  baseBpm.addEventListener('change', () => {
    state.practice.baseBpm = clampBpm(baseBpm.value);
    baseBpm.value = state.practice.baseBpm;
    updateHeroBpm();
    persistState();
  });
```

In the `tapTempo` click handler, add a call right before `persistState();`:

```js
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
  updateHeroBpm();
  persistState();
});
```

- [ ] **Step 6: Run the automated test suite to confirm no regression**

Run: `node --test tests/*.test.js`
Expected: 28/28 passing (this task adds new functions and modifies
`scheduleBeat`/`flashBeatIndicator`/several listeners, but touches nothing
inside the `LOGIC-BEGIN`/`LOGIC-END` markers, so all 28 tests should be
unaffected — confirm this is actually true, don't just assume it).

- [ ] **Step 7: Manual browser verification**

Open `metronome.html`. Confirm: a large BPM number appears between the tab
bar and the active panel, showing 120 initially. Change the BPM field —
the hero number updates immediately. Switch to the Ramp tab — the hero
number shows the Ramp tab's Start BPM; switch to Practice — it shows
Practice's Base BPM. Below the Start/Stop button, confirm 4 small dots
appear (default 4/4 time signature) instead of the old single dot. Click
Start on the Metronome tab with Accent on — confirm the dots light up in
sequence, one per beat, with the first dot flashing red (accent) and the
other three flashing amber. Change Beats per Bar to 3 while stopped —
confirm the dot row updates to show 3 dots. Start a Ramp run and confirm
the hero number changes at each step boundary in sync with the ramp
readout text. Start a Practice run and confirm the hero number alternates
between the slow and fast tempo each beat, in sync with the phase readout.
If you have no browser available, do your best static/hand-traced
verification (confirm the beat-index capture logic is correct by tracing
through `scheduleBeat` by hand for a couple of beats, confirm no dangling
references to the old single-argument `flashBeatIndicator` signature
remain anywhere in the file) and clearly flag this limitation in your
report (DONE_WITH_CONCERNS, not a silent skip).

- [ ] **Step 8: Commit**

```bash
git add metronome.html
git commit -m "Add live hero BPM display and per-beat dot indicator"
```

---

### Task 3: Final manual verification walkthrough

**Files:** none (verification-only task; fix any bug found in
`metronome.html` before committing, following the same style as the
surrounding code).

**Interfaces:** none — this task exercises the finished UI rework
end-to-end, on top of the already-verified core app functionality.

- [ ] **Step 1: Run the full automated test suite one more time**

Run: `node --test tests/*.test.js`
Expected: 28/28 passing.

- [ ] **Step 2: Visual pass across all three tabs**

Confirm the dark theme, amber accents, hero BPM number, and beat-dot row
all look and behave correctly on the Metronome, Ramp, and Practice tabs
in turn, including each tab's specific controls (sliders, selects, the
accent checkbox, the ramp/practice readouts).

- [ ] **Step 3: Regression check against pre-existing functionality**

Confirm nothing from before this rework broke: tap tempo, the spacebar
Start/Stop shortcut, tab-switch-stops-playback, settings persistence
across a reload, ramp hold-at-target behavior, practice break-beats at
slow tempo, and accent/subdivision behavior across a couple of time
signatures (e.g. 3/4, 7/8).

- [ ] **Step 4: Final commit (only if the walkthrough required fixes)**

```bash
git add metronome.html
git commit -m "Fix issues found during UI rework verification walkthrough"
```

If no fixes were needed, this task requires no commit — the plan is
complete as of Task 2's commit.
