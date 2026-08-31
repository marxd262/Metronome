# Independent Practice Break Length Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Practice mode's break duration its own "Break Length
(beats)" setting instead of always equaling "Beats per Bar".

**Architecture:** One implementation task (new state field, new HTML
input, and swapping which state field feeds Practice's break-length
parameter in the two places that currently read `state.topBar.timeSigNum`
for that purpose) plus one human verification task. No pure-logic function
signatures change — `buildPracticePhaseSequence` and `practiceSegmentIndex`
already accept break length as a plain parameter, so this is purely new
state and wiring.

**Tech Stack:** Same as the existing app — vanilla HTML/CSS/JS, no build
step, no dependencies. No changes to the Node test harness or any existing
test.

## Global Constraints

- Still a single self-contained `metronome.html` file — no build step, no
  external files.
- `state.practice.breakBeats` is a positive integer with no upper bound,
  validated via the existing `clampPositiveInt` pure function — same style
  as `state.practice.beatsPerPhase`.
- `DEFAULT_STATE.practice.breakBeats` is `4`.
- "Beats per Bar" (`state.topBar.timeSigNum`) keeps its other roles
  (accent-pattern length, Ramp step-length-in-bars, beat-dot count)
  unchanged — only its role in determining Practice's break length is
  removed.
- No change to any `LOGIC-BEGIN`/`LOGIC-END` function or to
  `tests/logic.test.js` — the suite (currently 35 tests) must pass
  unmodified.
- Run tests with `node --test tests/*.test.js` (the directory form does
  not work reliably on this Node/Windows setup).

---

### Task 1: Add the Break Length field and wire it in

**Files:**
- Modify: `metronome.html` (HTML markup and `<script>` block only — no
  CSS changes needed, the new input reuses existing styling; no LOGIC
  block changes)

**Interfaces:**
- Consumes: `clampPositiveInt` (existing pure function).
- Produces: `state.practice.breakBeats` (new state field), consumed by
  `startPlayback`'s practice-init block (both the
  `buildPracticePhaseSequence` call and the `practiceRuntime.breakBeats`
  snapshot).

- [ ] **Step 1: Add the HTML input**

Find, inside `#panel-practice`:

```html
  <div id="panel-practice" class="panel" hidden>
    <label>Base (Fast) BPM <input id="practiceBaseBpm" type="number" min="20" max="400" step="1" value="120"></label>
    <label>Speed Delta % <input id="practiceDeltaPercent" type="number" min="10" max="90" step="1" value="50"></label>
    <label>Beats per Phase <input id="practiceBeatsPerPhase" type="number" min="1" step="1" value="4"></label>
    <div id="practiceReadout" class="readout"></div>
  </div>
```

Replace with:

```html
  <div id="panel-practice" class="panel" hidden>
    <label>Base (Fast) BPM <input id="practiceBaseBpm" type="number" min="20" max="400" step="1" value="120"></label>
    <label>Speed Delta % <input id="practiceDeltaPercent" type="number" min="10" max="90" step="1" value="50"></label>
    <label>Beats per Phase <input id="practiceBeatsPerPhase" type="number" min="1" step="1" value="4"></label>
    <label>Break Length (beats) <input id="practiceBreakBeats" type="number" min="1" step="1" value="4"></label>
    <div id="practiceReadout" class="readout"></div>
  </div>
```

- [ ] **Step 2: Add the field to `DEFAULT_STATE`**

Find:

```js
  practice: { baseBpm: 120, deltaPercent: 50, beatsPerPhase: 4 },
```

Replace with:

```js
  practice: { baseBpm: 120, deltaPercent: 50, beatsPerPhase: 4, breakBeats: 4 },
```

- [ ] **Step 3: Restore the new field's value on load**

Find:

```js
  document.getElementById('practiceBeatsPerPhase').value = state.practice.beatsPerPhase;
```

Replace with:

```js
  document.getElementById('practiceBeatsPerPhase').value = state.practice.beatsPerPhase;
  document.getElementById('practiceBreakBeats').value = state.practice.breakBeats;
```

- [ ] **Step 4: Wire the input's change listener**

Find, inside `bindPracticeTab()`:

```js
function bindPracticeTab() {
  const baseBpm = document.getElementById('practiceBaseBpm');
  const deltaPercent = document.getElementById('practiceDeltaPercent');
  const beatsPerPhase = document.getElementById('practiceBeatsPerPhase');

  baseBpm.addEventListener('change', () => {
    state.practice.baseBpm = clampBpm(baseBpm.value);
    baseBpm.value = state.practice.baseBpm;
    updateHeroBpm();
    persistState();
  });
  deltaPercent.addEventListener('change', () => {
    const n = Math.round(Number(deltaPercent.value));
    state.practice.deltaPercent = Number.isFinite(n) ? Math.min(90, Math.max(10, n)) : DEFAULT_STATE.practice.deltaPercent;
    deltaPercent.value = state.practice.deltaPercent;
    persistState();
  });
  beatsPerPhase.addEventListener('change', () => {
    state.practice.beatsPerPhase = clampPositiveInt(beatsPerPhase.value, DEFAULT_STATE.practice.beatsPerPhase);
    beatsPerPhase.value = state.practice.beatsPerPhase;
    persistState();
  });
}
```

Replace with (only the new `const breakBeats = ...` line and its listener
are added — everything else is unchanged):

```js
function bindPracticeTab() {
  const baseBpm = document.getElementById('practiceBaseBpm');
  const deltaPercent = document.getElementById('practiceDeltaPercent');
  const beatsPerPhase = document.getElementById('practiceBeatsPerPhase');
  const breakBeats = document.getElementById('practiceBreakBeats');

  baseBpm.addEventListener('change', () => {
    state.practice.baseBpm = clampBpm(baseBpm.value);
    baseBpm.value = state.practice.baseBpm;
    updateHeroBpm();
    persistState();
  });
  deltaPercent.addEventListener('change', () => {
    const n = Math.round(Number(deltaPercent.value));
    state.practice.deltaPercent = Number.isFinite(n) ? Math.min(90, Math.max(10, n)) : DEFAULT_STATE.practice.deltaPercent;
    deltaPercent.value = state.practice.deltaPercent;
    persistState();
  });
  beatsPerPhase.addEventListener('change', () => {
    state.practice.beatsPerPhase = clampPositiveInt(beatsPerPhase.value, DEFAULT_STATE.practice.beatsPerPhase);
    beatsPerPhase.value = state.practice.beatsPerPhase;
    persistState();
  });
  breakBeats.addEventListener('change', () => {
    state.practice.breakBeats = clampPositiveInt(breakBeats.value, DEFAULT_STATE.practice.breakBeats);
    breakBeats.value = state.practice.breakBeats;
    persistState();
  });
}
```

- [ ] **Step 5: Use the new field instead of `timeSigNum` for Practice's break length**

Find, inside `startPlayback()`:

```js
  if (state.topBar.activeTab === 'practice') {
    practiceRuntime = {
      sequence: buildPracticePhaseSequence(state.practice.beatsPerPhase, state.topBar.timeSigNum),
      beatsPerPhase: state.practice.beatsPerPhase,
      breakBeats: state.topBar.timeSigNum,
      index: 0,
    };
    updatePracticeReadout();
  }
```

Replace with (only the two `state.topBar.timeSigNum` references become
`state.practice.breakBeats` — nothing else changes):

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

- [ ] **Step 6: Run the automated test suite**

Run: `node --test tests/*.test.js`
Expected: all 35 tests pass, unchanged (no LOGIC-block function or
existing test was touched).

- [ ] **Step 7: Manual browser verification**

Open `metronome.html`. Confirm the "Break Length (beats)" field appears on
the Practice tab right after "Beats per Phase". Set Beats per Bar to 4 (top
bar) and Break Length to 2 (Practice tab) — these are now different
values. Start a Practice run and confirm each break is exactly 2 beats
long (not 4), while the accent-pattern dot row still shows 4 dots and
still governs accents during the slow/fast phases as before. Reload the
page and confirm Break Length persisted at 2. Try entering `0` or a
negative number into Break Length — confirm it snaps back to a valid
value rather than accepting it. If you have no browser available, do your
best static verification (confirm the new field's ID matches everywhere
it's referenced, confirm `clampPositiveInt` is called with matching
arguments to the sibling `beatsPerPhase` field) and clearly flag the
limitation in your report (DONE_WITH_CONCERNS, not a silent skip).

- [ ] **Step 8: Commit**

```bash
git add metronome.html
git commit -m "Add an independent break-length setting for Practice mode"
```

---

### Task 2: Final manual verification walkthrough

**Files:** none (verification-only task; fix any bug found in
`metronome.html` before committing, following the same style as the
surrounding code).

**Interfaces:** none — this task exercises the finished change end-to-end
on top of the already-verified app.

- [ ] **Step 1: Run the full automated test suite one more time**

Run: `node --test tests/*.test.js`
Expected: all 35 tests pass.

- [ ] **Step 2: Regression check**

Confirm nothing else regressed: the accent pattern (dots, click-to-toggle,
cross-mode accenting), Ramp mode's step-length-in-bars (still tied to
Beats per Bar, unaffected by this change), the four-segment practice
readout's timing (still syncs to audio, per the prior round's fix), and
general persistence/tap-tempo/spacebar/tab-switch behavior.

- [ ] **Step 3: Final commit (only if the walkthrough required fixes)**

```bash
git add metronome.html
git commit -m "Fix issues found during break-length verification walkthrough"
```

If no fixes were needed, this task requires no commit — the plan is
complete as of Task 1's commit.
