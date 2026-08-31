# Practice Phase-Progress Dots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Practice tab, while playing, the beat-dot row switches from
the accent-pattern editor to a phase-progress indicator — its dot count
resizes to match the current phase's length (Beats per Phase during
slow/fast, Break Length during break), flashing progress through that
phase and showing accent coloring during slow/fast only. Stopping (or
leaving the Practice tab) reverts the row to the normal accent editor.

**Architecture:** One purely-additive pure-logic task, one integration
task that wires the mode-switching behavior into the existing scheduler
and Start/Stop lifecycle, and one human verification task. No CSS changes
are needed — the phase-progress dots reuse the exact same `.beat-dot`
class styling already defined, they're just plain (non-button,
non-clickable) elements instead of the accent-editor's interactive
buttons.

**Tech Stack:** Same as the existing app — vanilla HTML/CSS/JS, no build
step, no dependencies. No changes to any existing test or to
`tests/loadLogic.js`.

## Global Constraints

- Still a single self-contained `metronome.html` file — no build step, no
  external files.
- Metronome and Ramp tabs are completely unaffected by this plan — the
  dot row's existing behavior there (accent editor, bar-position flash,
  editable anytime) is unchanged.
- On the Practice tab: **stopped** → dot row is the normal accent editor
  (`state.topBar.timeSigNum` dots, clickable). **Playing** → dot row shows
  `beatsPerPhase` dots during slow/fast or `breakBeats` dots during break,
  not clickable, flashing progress through the phase. Accent coloring on
  the flash only ever appears during slow/fast (never during break,
  matching the existing break-is-always-unaccented rule).
- No change to any existing `LOGIC-BEGIN`/`LOGIC-END` function or any
  existing test — this plan only ADDS a new pure function and its tests.
  The suite (currently 35 tests) must reach 37 and stay green.
- Run tests with `node --test tests/*.test.js` (the directory form does
  not work reliably on this Node/Windows setup).

---

### Task 1: New pure logic — `practicePhasePosition`

**Files:**
- Modify: `metronome.html` (the `// LOGIC-BEGIN`/`// LOGIC-END` block only)
- Modify: `tests/logic.test.js`

**Interfaces:**
- Consumes: nothing — purely additive, pairs with the existing
  `practiceSegmentIndex` (same two "shape" parameters, same sequence
  layout assumptions).
- Produces: `practicePhasePosition(sequenceIndex, beatsPerPhase, breakBeats) -> number`,
  the 0-based position within whichever phase `sequenceIndex` falls in.
  Consumed by Task 2's dot-row rendering.

This function has no existing caller yet, so this task carries zero risk
to current behavior.

- [ ] **Step 1: Write failing tests**

Add to `tests/logic.test.js`, after the existing tests:

```js
test('practicePhasePosition returns the 0-based position within the current phase', () => {
  const { practicePhasePosition } = loadLogic(['practicePhasePosition']);
  // beatsPerPhase=2, breakBeats=3 -> slow[0,1] break[2,3,4] fast[5,6] break[7,8,9]
  assert.equal(practicePhasePosition(0, 2, 3), 0);
  assert.equal(practicePhasePosition(1, 2, 3), 1);
  assert.equal(practicePhasePosition(2, 2, 3), 0);
  assert.equal(practicePhasePosition(4, 2, 3), 2);
  assert.equal(practicePhasePosition(5, 2, 3), 0);
  assert.equal(practicePhasePosition(6, 2, 3), 1);
  assert.equal(practicePhasePosition(7, 2, 3), 0);
  assert.equal(practicePhasePosition(9, 2, 3), 2);
});

test('practicePhasePosition handles a single beat per phase and a single break beat', () => {
  const { practicePhasePosition } = loadLogic(['practicePhasePosition']);
  assert.equal(practicePhasePosition(0, 1, 1), 0);
  assert.equal(practicePhasePosition(1, 1, 1), 0);
  assert.equal(practicePhasePosition(2, 1, 1), 0);
  assert.equal(practicePhasePosition(3, 1, 1), 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/*.test.js`
Expected: FAIL — `practicePhasePosition is not a function`.

- [ ] **Step 3: Implement the function**

Add inside `// LOGIC-BEGIN` / `// LOGIC-END` in `metronome.html`, after
`practiceSegmentIndex` (the last function before `// LOGIC-END`):

```js
function practicePhasePosition(sequenceIndex, beatsPerPhase, breakBeats) {
  if (sequenceIndex < beatsPerPhase) return sequenceIndex;
  if (sequenceIndex < beatsPerPhase + breakBeats) return sequenceIndex - beatsPerPhase;
  if (sequenceIndex < beatsPerPhase + breakBeats + beatsPerPhase) return sequenceIndex - (beatsPerPhase + breakBeats);
  return sequenceIndex - (beatsPerPhase + breakBeats + beatsPerPhase);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/*.test.js`
Expected: all tests pass (35 existing + 2 new = 37).

- [ ] **Step 5: Commit**

```bash
git add metronome.html tests/logic.test.js
git commit -m "Add practicePhasePosition pure logic"
```

---

### Task 2: Wire the Practice-tab dot-row mode switch

**Files:**
- Modify: `metronome.html` (`<script>` block only — no HTML/CSS changes;
  the phase-progress dots reuse the existing `.beat-dot` styling as plain
  elements)

**Interfaces:**
- Consumes: `practicePhasePosition` (Task 1); `practiceSegmentIndex`,
  `practiceRuntime.beatsPerPhase`/`.breakBeats` (existing).
- Produces: `renderPracticeProgressDots(count)` — new, internal to this
  task. Modifies `renderBeatDots`, `scheduleBeat`, `startPlayback`,
  `stopPlayback`.

- [ ] **Step 1: Add `renderPracticeProgressDots` and make `renderBeatDots` explicitly reclaim `aria-hidden`**

Find:

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
```

Replace with (only the new `container.removeAttribute('aria-hidden');`
line is added — everything else is unchanged):

```js
function renderBeatDots() {
  const container = document.getElementById('beatIndicator');
  container.removeAttribute('aria-hidden');
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

function renderPracticeProgressDots(count) {
  const container = document.getElementById('beatIndicator');
  container.setAttribute('aria-hidden', 'true');
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    dot.className = 'beat-dot';
    container.appendChild(dot);
  }
}
```

`renderPracticeProgressDots` creates plain `<div>`s, not buttons — no
click listener, no `aria-pressed`/`aria-label`, and the container gets
`aria-hidden="true"` since these dots are a transient, non-interactive
progress display while playing (mirroring how the dot row was originally
`aria-hidden` before it became the interactive accent editor).
`renderBeatDots` (the accent editor) explicitly clears that attribute so
the dots are exposed to assistive tech again once editing is possible.

- [ ] **Step 2: Update `scheduleBeat` to capture phase-relative dot info and resize/flash the correct row**

Find:

```js
function scheduleBeat(time) {
  const bpm = currentModeBpm();
  const beatIndex = beatIndexInBar;
  const isPracticeBreak = state.topBar.activeTab === 'practice'
    && practiceRuntime
    && practiceRuntime.sequence[practiceRuntime.index] === 'break';
  const accent = !isPracticeBreak && isAccentBeat(beatIndex, state.topBar.accentPattern);
  scheduleClick(time, accent, false);

  const subCount = subdivisionCount(state.topBar.subdivision);
  const subInterval = subdivisionIntervalSeconds(bpm, state.topBar.subdivision);
  for (let s = 1; s < subCount; s++) {
    scheduleClick(time + subInterval * s, false, true);
  }

  const rampDisplay = (state.topBar.activeTab === 'ramp' && rampRuntime)
    ? { currentBpm: rampRuntime.currentBpm, direction: rampRuntime.direction }
    : null;
  const practiceSegment = (state.topBar.activeTab === 'practice' && practiceRuntime)
    ? practiceSegmentIndex(practiceRuntime.index, practiceRuntime.beatsPerPhase, practiceRuntime.breakBeats)
    : null;

  const ctx = ensureAudioContext();
  setTimeout(() => {
    flashBeatIndicator(beatIndex, accent);
    updateHeroBpm(bpm);
    if (!isPlaying) return;
    if (rampDisplay) updateRampReadout(rampDisplay);
    if (practiceSegment !== null) updatePracticeReadout(practiceSegment);
  }, Math.max(0, (time - ctx.currentTime) * 1000));

  beatIndexInBar = (beatIndexInBar + 1) % state.topBar.timeSigNum;
  advanceModeAfterBeat();
  nextNoteTime = time + beatIntervalSeconds(bpm);
}
```

Replace with:

```js
function scheduleBeat(time) {
  const bpm = currentModeBpm();
  const beatIndex = beatIndexInBar;
  const isPracticeMode = state.topBar.activeTab === 'practice' && practiceRuntime;
  const isPracticeBreak = isPracticeMode && practiceRuntime.sequence[practiceRuntime.index] === 'break';
  const accent = !isPracticeBreak && isAccentBeat(beatIndex, state.topBar.accentPattern);
  scheduleClick(time, accent, false);

  const subCount = subdivisionCount(state.topBar.subdivision);
  const subInterval = subdivisionIntervalSeconds(bpm, state.topBar.subdivision);
  for (let s = 1; s < subCount; s++) {
    scheduleClick(time + subInterval * s, false, true);
  }

  const rampDisplay = (state.topBar.activeTab === 'ramp' && rampRuntime)
    ? { currentBpm: rampRuntime.currentBpm, direction: rampRuntime.direction }
    : null;
  const practiceSegment = isPracticeMode
    ? practiceSegmentIndex(practiceRuntime.index, practiceRuntime.beatsPerPhase, practiceRuntime.breakBeats)
    : null;
  const dotIndex = isPracticeMode
    ? practicePhasePosition(practiceRuntime.index, practiceRuntime.beatsPerPhase, practiceRuntime.breakBeats)
    : beatIndex;
  const dotCount = isPracticeMode
    ? (isPracticeBreak ? practiceRuntime.breakBeats : practiceRuntime.beatsPerPhase)
    : null;

  const ctx = ensureAudioContext();
  setTimeout(() => {
    if (dotCount !== null && document.getElementById('beatIndicator').children.length !== dotCount) {
      renderPracticeProgressDots(dotCount);
    }
    flashBeatIndicator(dotIndex, accent);
    updateHeroBpm(bpm);
    if (!isPlaying) return;
    if (rampDisplay) updateRampReadout(rampDisplay);
    if (practiceSegment !== null) updatePracticeReadout(practiceSegment);
  }, Math.max(0, (time - ctx.currentTime) * 1000));

  beatIndexInBar = (beatIndexInBar + 1) % state.topBar.timeSigNum;
  advanceModeAfterBeat();
  nextNoteTime = time + beatIntervalSeconds(bpm);
}
```

Notes on this change:
- `isPracticeMode` consolidates the repeated `state.topBar.activeTab ===
  'practice' && practiceRuntime` check (previously written out twice) into
  one local, now reused four times — a behavior-preserving simplification,
  not a new condition.
- `dotIndex` and `dotCount` are captured *before* `advanceModeAfterBeat()`
  runs, exactly like `beatIndex`/`bpm`/`rampDisplay`/`practiceSegment` —
  same established pattern, so the phase-progress display stays
  audio-synced rather than updating early.
- The resize check reads the *actual* current DOM child count and only
  rebuilds when it disagrees with `dotCount` — this means it naturally
  fires exactly once per phase transition (slow→break, break→fast,
  fast→break) and does nothing on every other beat, and it runs inside the
  same audio-synced `setTimeout` as the flash, so the row resizes at the
  same moment the new phase's first beat becomes audible, not early.
- Outside Practice mode (`isPracticeMode` false), `dotCount` is `null`, so
  the resize check is skipped entirely and `dotIndex` falls back to
  `beatIndex` — Metronome/Ramp behavior is completely unchanged.

- [ ] **Step 3: Enter progress mode when Practice playback starts**

Find, inside `startPlayback()`:

```js
  if (state.topBar.activeTab === 'practice') {
    practiceRuntime = {
      sequence: buildPracticePhaseSequence(state.practice.beatsPerPhase, state.practice.breakBeats),
      beatsPerPhase: state.practice.beatsPerPhase,
      breakBeats: state.practice.breakBeats,
      index: 0,
    };
    updatePracticeReadout();
  }
```

Replace with (only the new `renderPracticeProgressDots(...)` line is
added — everything else is unchanged):

```js
  if (state.topBar.activeTab === 'practice') {
    practiceRuntime = {
      sequence: buildPracticePhaseSequence(state.practice.beatsPerPhase, state.practice.breakBeats),
      beatsPerPhase: state.practice.beatsPerPhase,
      breakBeats: state.practice.breakBeats,
      index: 0,
    };
    renderPracticeProgressDots(practiceRuntime.beatsPerPhase);
    updatePracticeReadout();
  }
```

The very first phase in any practice sequence is always `slow`, whose
length is `beatsPerPhase` — so this immediately shows the correct-sized
progress row from the first beat, without waiting for the first
`scheduleBeat` call's resize check to catch up.

- [ ] **Step 4: Revert to the accent editor when Practice playback stops**

Find:

```js
function stopPlayback() {
  if (!isPlaying) return;
  isPlaying = false;
  clearTimeout(schedulerTimerId);
  document.getElementById('startStop').textContent = 'Start';
  updatePracticeReadout();
}
```

Replace with (only the new `if` block is added — everything else is
unchanged):

```js
function stopPlayback() {
  if (!isPlaying) return;
  isPlaying = false;
  clearTimeout(schedulerTimerId);
  document.getElementById('startStop').textContent = 'Start';
  updatePracticeReadout();
  if (state.topBar.activeTab === 'practice') renderBeatDots();
}
```

`switchTab(tabName)` calls `stopPlayback()` *before* it reassigns
`state.topBar.activeTab = tabName`, so this check still correctly reads
`'practice'` — the tab being left, not the one being switched to — when a
user switches away from Practice mid-run. Metronome/Ramp stops never
entered progress mode in the first place, so this guard correctly skips
an unnecessary rebuild for them.

- [ ] **Step 5: Run the automated test suite**

Run: `node --test tests/*.test.js`
Expected: all 37 tests pass (this task adds no new tests and modifies no
`LOGIC-BEGIN`/`LOGIC-END` function, so the count from Task 1 is
unaffected).

- [ ] **Step 6: Manual browser verification**

Open `metronome.html`, go to the Practice tab. Confirm the dot row is the
normal clickable accent editor while stopped. Set Beats per Phase to 3 and
Break Length to 2 (different values), accent beat 1 on the dot row, then
press Start. Confirm: during the SLOW phase, the row shows exactly 3 dots,
flashing in sequence, with the first one flashing red (accented) and the
rest amber; when BREAK begins, the row reflows to exactly 2 dots, flashing
in sequence with no red ever (breaks are always unaccented); when FAST
begins, the row goes back to 3 dots with the same accent pattern as SLOW;
the cycle repeats correctly. While playing, confirm clicking a dot does
nothing (no toggle, since editing is stopped-only). Press Stop mid-phase —
confirm the row immediately reverts to the 3/2/whatever-Beats-per-Bar-is
accent editor and is clickable again. Switch to the Metronome tab and
confirm its dot row (and accent editing) behaves exactly as before this
plan — completely unaffected. If you have no browser available, do your
best static/hand-traced verification (trace `scheduleBeat` by hand for a
phase transition, confirm `dotIndex`/`dotCount` compute correctly, confirm
no dangling references to old single-argument patterns) and clearly flag
the limitation in your report — use **DONE_WITH_CONCERNS**, not a plain
DONE, since this step cannot be genuinely completed without a browser.

- [ ] **Step 7: Commit**

```bash
git add metronome.html
git commit -m "Show practice phase progress on the beat-dot row while playing"
```

---

### Task 3: Final manual verification walkthrough

**Files:** none (verification-only task; fix any bug found in
`metronome.html` before committing, following the same style as the
surrounding code).

**Interfaces:** none — this task exercises the finished change end-to-end
on top of the already-verified app.

- [ ] **Step 1: Run the full automated test suite one more time**

Run: `node --test tests/*.test.js`
Expected: all 37 tests pass.

- [ ] **Step 2: Full phase-progress-dots pass**

Confirm the dot row's mode switch (editor ↔ progress) works correctly
across a full practice cycle with Beats per Phase, Break Length, and
Beats per Bar all set to different values from each other, including
after a Stop-and-restart and after switching away from and back to the
Practice tab.

- [ ] **Step 3: Regression check**

Confirm nothing else regressed: accent editing on Metronome/Ramp tabs,
the four-segment readout's audio-synced timing, Ramp's step-length-in-bars,
persistence, tap tempo, spacebar shortcut, and tab-switch-stops-playback.

- [ ] **Step 4: Final commit (only if the walkthrough required fixes)**

```bash
git add metronome.html
git commit -m "Fix issues found during phase-progress-dots verification walkthrough"
```

If no fixes were needed, this task requires no commit — the plan is
complete as of Task 2's commit.
