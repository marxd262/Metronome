# Rhythm Pattern Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the subdivision `<select>`, the three per-mode "Beats per Bar" fields, and the boolean accent pattern with one shared rhythm pattern editor whose every slot carries one of four levels.

**Architecture:** A single `state.topBar.pattern` object (`beats`, `division`, `preset`, flat `levels` array) drives all three modes. Audio scheduling stays beat-at-a-time and gains a per-slot inner loop. The slot-level playhead is driven by a `requestAnimationFrame` loop reading a ring buffer of scheduled slot times, deliberately *not* by the per-beat deferred-callback mechanism.

**Tech Stack:** Vanilla HTML/CSS/JS in a single file. No build, no dependencies. Tests are `node:test` + `node:assert/strict` running against the LOGIC block extracted by `tests/loadLogic.js`.

**Spec:** `docs/superpowers/specs/2026-09-09-rhythm-pattern-editor-design.md`

## Global Constraints

- Everything lands in `index.html`. **No** build step, bundler, framework, npm dependency, CDN script, or network call may be introduced.
- Every function added between `// LOGIC-BEGIN` and `// LOGIC-END` must be a pure function of its arguments. No reads of `state`, the DOM, or module-level variables. `tests/loadLogic.js` evals that block standalone under Node.
- Every CSS rule must live inside one of the four declared layers: `@layer base, components, themes, motion;`. An unlayered rule outranks all layered rules. `@keyframes` is the only exception.
- Tests run with `node --test tests/*.test.js` (glob form; the directory form does not discover reliably). Node 18+.
- Per-**beat** visual feedback keeps the capture-before-advance pattern: capture every value into a local before `advanceModeAfterBeat()` mutates runtime state, and gate DOM mutations inside the deferred callback on `isPlaying`. Per-**slot** feedback uses the ring buffer added in Task 9 and nothing else.
- Level integers are always referenced through the `LEVEL_*` constants. No raw `0`/`1`/`2`/`3` level literals outside the constant declarations and the gain table.
- Run the full test suite before every commit.

---

### Task 1: Pattern LOGIC primitives

**Files:**
- Modify: `index.html` — inside the LOGIC block, immediately after `subdivisionIntervalSeconds`
- Test: `tests/logic.test.js`

**Interfaces:**
- Consumes: `beatIntervalSeconds(bpm)` (already exists in the LOGIC block)
- Produces:
  - `LEVEL_MUTED = 0`, `LEVEL_QUIET = 1`, `LEVEL_NORMAL = 2`, `LEVEL_ACCENT = 3`, `LEVEL_COUNT = 4`
  - `PATTERN_MIN = 1`, `PATTERN_MAX = 64`
  - `patternSlotCount(beats, division) -> number`
  - `patternSlotIndex(beat, slot, division) -> number`
  - `clampPatternBeats(value) -> number` (1–64, fallback 4)
  - `clampPatternDivision(value) -> number` (1–64, fallback 1)
  - `slotIntervalSeconds(bpm, division) -> number`
  - `levelGainFactor(level) -> number`
  - `levelIsAccent(level) -> boolean`
  - `cyclePatternLevel(level, direction) -> number`
  - `patternLevelAt(pattern, beat, slot) -> number`

- [ ] **Step 1: Write the failing tests**

Append to `tests/logic.test.js`:

```js
test('patternSlotIndex is row-major over division', () => {
  const { patternSlotIndex } = loadLogic(['patternSlotIndex']);
  assert.equal(patternSlotIndex(0, 0, 4), 0);
  assert.equal(patternSlotIndex(0, 3, 4), 3);
  assert.equal(patternSlotIndex(1, 0, 4), 4);
  assert.equal(patternSlotIndex(2, 1, 3), 7);
});

test('patternSlotCount multiplies beats by division', () => {
  const { patternSlotCount } = loadLogic(['patternSlotCount']);
  assert.equal(patternSlotCount(4, 1), 4);
  assert.equal(patternSlotCount(7, 5), 35);
  assert.equal(patternSlotCount(64, 64), 4096);
});

test('clampPatternBeats holds the 1-64 range and falls back on junk', () => {
  const { clampPatternBeats } = loadLogic(['clampPatternBeats']);
  assert.equal(clampPatternBeats(0), 1);
  assert.equal(clampPatternBeats(1), 1);
  assert.equal(clampPatternBeats(64), 64);
  assert.equal(clampPatternBeats(65), 64);
  assert.equal(clampPatternBeats(7.4), 7);
  assert.equal(clampPatternBeats('abc'), 4);
  assert.equal(clampPatternBeats(undefined), 4);
});

test('clampPatternDivision holds the 1-64 range and falls back to 1', () => {
  const { clampPatternDivision } = loadLogic(['clampPatternDivision']);
  assert.equal(clampPatternDivision(0), 1);
  assert.equal(clampPatternDivision(64), 64);
  assert.equal(clampPatternDivision(100), 64);
  assert.equal(clampPatternDivision(null), 1);
});

test('slotIntervalSeconds divides the beat evenly', () => {
  const { slotIntervalSeconds } = loadLogic(['slotIntervalSeconds']);
  assert.equal(slotIntervalSeconds(60, 1), 1);
  assert.equal(slotIntervalSeconds(60, 4), 0.25);
  assert.equal(slotIntervalSeconds(120, 5), 0.1);
});

test('levelGainFactor reproduces the pre-existing gain values', () => {
  const { levelGainFactor, LEVEL_MUTED, LEVEL_QUIET, LEVEL_NORMAL, LEVEL_ACCENT } =
    loadLogic(['levelGainFactor', 'LEVEL_MUTED', 'LEVEL_QUIET', 'LEVEL_NORMAL', 'LEVEL_ACCENT']);
  assert.equal(levelGainFactor(LEVEL_MUTED), 0);
  assert.equal(levelGainFactor(LEVEL_QUIET), 0.4);
  assert.equal(levelGainFactor(LEVEL_NORMAL), 0.7);
  assert.equal(levelGainFactor(LEVEL_ACCENT), 1);
  assert.equal(levelGainFactor(99), 0.7);
});

test('levelIsAccent is true only for the accent level', () => {
  const { levelIsAccent, LEVEL_QUIET, LEVEL_NORMAL, LEVEL_ACCENT } =
    loadLogic(['levelIsAccent', 'LEVEL_QUIET', 'LEVEL_NORMAL', 'LEVEL_ACCENT']);
  assert.equal(levelIsAccent(LEVEL_ACCENT), true);
  assert.equal(levelIsAccent(LEVEL_NORMAL), false);
  assert.equal(levelIsAccent(LEVEL_QUIET), false);
});

test('cyclePatternLevel wraps forward and backward through four levels', () => {
  const { cyclePatternLevel } = loadLogic(['cyclePatternLevel']);
  assert.equal(cyclePatternLevel(0, 1), 1);
  assert.equal(cyclePatternLevel(3, 1), 0);
  assert.equal(cyclePatternLevel(0, -1), 3);
  assert.equal(cyclePatternLevel(2, -1), 1);
});

test('cyclePatternLevel treats a non-integer level as normal', () => {
  const { cyclePatternLevel } = loadLogic(['cyclePatternLevel']);
  assert.equal(cyclePatternLevel(undefined, 1), 3);
});

test('patternLevelAt reads a slot and defaults a missing one to normal', () => {
  const { patternLevelAt } = loadLogic(['patternLevelAt']);
  const pattern = { beats: 2, division: 2, levels: [3, 1, 2, 0] };
  assert.equal(patternLevelAt(pattern, 0, 0), 3);
  assert.equal(patternLevelAt(pattern, 1, 1), 0);
  assert.equal(patternLevelAt({ beats: 1, division: 1, levels: [] }, 0, 0), 2);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/*.test.js`
Expected: FAIL, with `loadLogic` throwing `ReferenceError: patternSlotIndex is not defined` (the extracted block does not define these names yet).

- [ ] **Step 3: Add the functions to the LOGIC block**

In `index.html`, immediately after the `subdivisionIntervalSeconds` function and before `isAccentBeat`, insert:

```js
// Slot levels. Ordered so cyclePatternLevel can step through them with modulo
// arithmetic, and so the gain table below can be indexed directly.
const LEVEL_MUTED = 0;
const LEVEL_QUIET = 1;
const LEVEL_NORMAL = 2;
const LEVEL_ACCENT = 3;
const LEVEL_COUNT = 4;

const PATTERN_MIN = 1;
const PATTERN_MAX = 64;

function patternSlotCount(beats, division) {
  return beats * division;
}

function patternSlotIndex(beat, slot, division) {
  return beat * division + slot;
}

function clampPatternValue(value, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(PATTERN_MAX, Math.max(PATTERN_MIN, n));
}

function clampPatternBeats(value) {
  return clampPatternValue(value, 4);
}

function clampPatternDivision(value) {
  return clampPatternValue(value, 1);
}

function slotIntervalSeconds(bpm, division) {
  return beatIntervalSeconds(bpm) / division;
}

// The three gain factors are exactly the ones the pre-pattern scheduler used
// (subdivision 0.4, unaccented beat 0.7, accent 1.0), so an equivalent pattern
// sounds identical to what the app produced before the editor existed.
function levelGainFactor(level) {
  const table = [0, 0.4, 0.7, 1.0];
  return table[level] === undefined ? table[LEVEL_NORMAL] : table[level];
}

function levelIsAccent(level) {
  return level === LEVEL_ACCENT;
}

function cyclePatternLevel(level, direction) {
  const current = Number.isInteger(level) ? level : LEVEL_NORMAL;
  const step = direction < 0 ? -1 : 1;
  return ((current + step) % LEVEL_COUNT + LEVEL_COUNT) % LEVEL_COUNT;
}

function patternLevelAt(pattern, beat, slot) {
  const levels = pattern && pattern.levels;
  const raw = levels ? levels[patternSlotIndex(beat, slot, pattern.division)] : undefined;
  return Number.isInteger(raw) ? raw : LEVEL_NORMAL;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/*.test.js`
Expected: PASS, all tests including the pre-existing ones.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/logic.test.js
git commit -m "feat: add pattern slot level primitives to LOGIC"
```

---

### Task 2: Presets and preset level generation

**Files:**
- Modify: `index.html` — LOGIC block, after `patternLevelAt`
- Test: `tests/logic.test.js`

**Interfaces:**
- Consumes: `LEVEL_QUIET`, `LEVEL_NORMAL`, `LEVEL_ACCENT` (Task 1)
- Produces:
  - `PATTERN_PRESETS` — array of `{ name, division }`
  - `divisionForPreset(preset) -> number | null`
  - `presetForDivision(division) -> string` (a preset name, or `'custom'`)
  - `buildPresetLevels(beats, division) -> number[]`

- [ ] **Step 1: Write the failing tests**

Append to `tests/logic.test.js`:

```js
test('divisionForPreset maps the four preset names to divisions', () => {
  const { divisionForPreset } = loadLogic(['divisionForPreset']);
  assert.equal(divisionForPreset('none'), 1);
  assert.equal(divisionForPreset('eighths'), 2);
  assert.equal(divisionForPreset('triplets'), 3);
  assert.equal(divisionForPreset('sixteenths'), 4);
  assert.equal(divisionForPreset('custom'), null);
  assert.equal(divisionForPreset('nonsense'), null);
});

test('presetForDivision round-trips the four presets and calls the rest custom', () => {
  const { presetForDivision, divisionForPreset } = loadLogic(['presetForDivision', 'divisionForPreset']);
  for (const name of ['none', 'eighths', 'triplets', 'sixteenths']) {
    assert.equal(presetForDivision(divisionForPreset(name)), name);
  }
  assert.equal(presetForDivision(5), 'custom');
  assert.equal(presetForDivision(64), 'custom');
});

test('buildPresetLevels accents only the first slot of the first beat', () => {
  const { buildPresetLevels } = loadLogic(['buildPresetLevels']);
  assert.deepEqual(buildPresetLevels(4, 1), [3, 2, 2, 2]);
  assert.deepEqual(buildPresetLevels(2, 3), [3, 1, 1, 2, 1, 1]);
});

test('buildPresetLevels produces exactly beats times division entries', () => {
  const { buildPresetLevels } = loadLogic(['buildPresetLevels']);
  assert.equal(buildPresetLevels(7, 5).length, 35);
  assert.equal(buildPresetLevels(7, 5).filter((l) => l === 3).length, 1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/*.test.js`
Expected: FAIL with `ReferenceError: divisionForPreset is not defined`.

- [ ] **Step 3: Add the functions to the LOGIC block**

Insert after `patternLevelAt`:

```js
// The four presets are the same roster the removed Subdivision <select>
// offered. They set division only; beats is never a preset's business.
const PATTERN_PRESETS = [
  { name: 'none',       division: 1 },
  { name: 'eighths',    division: 2 },
  { name: 'triplets',   division: 3 },
  { name: 'sixteenths', division: 4 },
];

function divisionForPreset(preset) {
  const found = PATTERN_PRESETS.find((entry) => entry.name === preset);
  return found ? found.division : null;
}

function presetForDivision(division) {
  const found = PATTERN_PRESETS.find((entry) => entry.division === division);
  return found ? found.name : 'custom';
}

function defaultLevelForSlot(beat, slot) {
  if (slot !== 0) return LEVEL_QUIET;
  return beat === 0 ? LEVEL_ACCENT : LEVEL_NORMAL;
}

function buildPresetLevels(beats, division) {
  const levels = [];
  for (let beat = 0; beat < beats; beat++) {
    for (let slot = 0; slot < division; slot++) {
      levels.push(defaultLevelForSlot(beat, slot));
    }
  }
  return levels;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/*.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/logic.test.js
git commit -m "feat: add pattern presets and preset level generation"
```

---

### Task 3: Resizing a level array

**Files:**
- Modify: `index.html` — LOGIC block, after `buildPresetLevels`
- Test: `tests/logic.test.js`

**Interfaces:**
- Consumes: `patternSlotIndex`, `defaultLevelForSlot` (Tasks 1–2)
- Produces: `resizePatternLevels(levels, oldBeats, oldDivision, newBeats, newDivision) -> number[]`

- [ ] **Step 1: Write the failing tests**

Append to `tests/logic.test.js`:

```js
test('resizePatternLevels is the identity when nothing changes', () => {
  const { resizePatternLevels } = loadLogic(['resizePatternLevels']);
  const levels = [3, 1, 0, 2, 2, 1];
  assert.deepEqual(resizePatternLevels(levels, 3, 2, 3, 2), levels);
});

test('resizePatternLevels pads new beat rows with a normal downbeat and quiet slots', () => {
  const { resizePatternLevels } = loadLogic(['resizePatternLevels']);
  //  beat 1: accent, quiet     beat 2: muted, muted     beat 3: normal, quiet
  const levels = [3, 1, 0, 0, 2, 1];
  assert.deepEqual(
    resizePatternLevels(levels, 3, 2, 5, 2),
    [3, 1, 0, 0, 2, 1, 2, 1, 2, 1]
  );
});

test('resizePatternLevels pads new subdivision slots with quiet', () => {
  const { resizePatternLevels } = loadLogic(['resizePatternLevels']);
  assert.deepEqual(
    resizePatternLevels([3, 2], 2, 1, 2, 3),
    [3, 1, 1, 2, 1, 1]
  );
});

test('resizePatternLevels truncates on shrink without disturbing survivors', () => {
  const { resizePatternLevels } = loadLogic(['resizePatternLevels']);
  const levels = [3, 1, 0, 2, 1, 0, 2, 1, 0];
  assert.deepEqual(resizePatternLevels(levels, 3, 3, 2, 2), [3, 1, 2, 1]);
});

test('resizePatternLevels fills defaults for a null or short source', () => {
  const { resizePatternLevels } = loadLogic(['resizePatternLevels']);
  assert.deepEqual(resizePatternLevels(null, 0, 0, 2, 2), [3, 1, 2, 1]);
  assert.deepEqual(resizePatternLevels([3], 2, 1, 2, 1), [3, 2]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/*.test.js`
Expected: FAIL with `ReferenceError: resizePatternLevels is not defined`.

- [ ] **Step 3: Add the function to the LOGIC block**

Insert after `buildPresetLevels`:

```js
// Preserves every level by its (beat, slot) position rather than by flat index,
// so changing division does not shear the pattern sideways. Positions that did
// not exist before get the same defaults a preset would give them.
function resizePatternLevels(levels, oldBeats, oldDivision, newBeats, newDivision) {
  const result = [];
  for (let beat = 0; beat < newBeats; beat++) {
    for (let slot = 0; slot < newDivision; slot++) {
      const survives = beat < oldBeats && slot < oldDivision;
      const previous = survives && levels
        ? levels[patternSlotIndex(beat, slot, oldDivision)]
        : undefined;
      result.push(Number.isInteger(previous) ? previous : defaultLevelForSlot(beat, slot));
    }
  }
  return result;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/*.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/logic.test.js
git commit -m "feat: add position-preserving pattern resize"
```

---

### Task 4: Normalizing and migrating saved settings

**Files:**
- Modify: `index.html` — LOGIC block, after `resizePatternLevels`
- Test: `tests/logic.test.js`

**Interfaces:**
- Consumes: `clampPatternBeats`, `clampPatternDivision`, `resizePatternLevels`, `presetForDivision`, `divisionForPreset`, `LEVEL_QUIET`, `LEVEL_NORMAL`, `LEVEL_ACCENT`
- Produces:
  - `parseSavedSettings(json) -> object | null`
  - `normalizePattern(pattern) -> { beats, division, preset, levels }`
  - `migrateLegacyPattern(parsed, defaults) -> { beats, division, preset, levels }`

`migrateLegacyPattern` is total: it always returns a usable pattern. Given a blob that already has `topBar.pattern` it normalizes and returns that; given a pre-editor blob it builds one from `topBar.subdivision` and the Metronome tab; given null or junk it returns the default.

- [ ] **Step 1: Write the failing tests**

Append to `tests/logic.test.js`:

```js
const PATTERN_DEFAULTS = {
  topBar: { pattern: { beats: 4, division: 1, preset: 'none', levels: [3, 2, 2, 2] } },
};

test('parseSavedSettings returns the object or null, never throws', () => {
  const { parseSavedSettings } = loadLogic(['parseSavedSettings']);
  assert.deepEqual(parseSavedSettings('{"a":1}'), { a: 1 });
  assert.equal(parseSavedSettings('not json'), null);
  assert.equal(parseSavedSettings(null), null);
  assert.equal(parseSavedSettings('42'), null);
});

test('normalizePattern clamps and re-sizes the level array to match', () => {
  const { normalizePattern } = loadLogic(['normalizePattern']);
  const result = normalizePattern({ beats: 200, division: 0, preset: 'none', levels: [3] });
  assert.equal(result.beats, 64);
  assert.equal(result.division, 1);
  assert.equal(result.levels.length, 64);
  assert.equal(result.levels[0], 3);
  assert.equal(result.levels[1], 2);
});

test('normalizePattern fills a preset name when one is missing', () => {
  const { normalizePattern } = loadLogic(['normalizePattern']);
  assert.equal(normalizePattern({ beats: 4, division: 3, levels: [] }).preset, 'triplets');
  assert.equal(normalizePattern({ beats: 4, division: 7, levels: [] }).preset, 'custom');
});

test('migrateLegacyPattern returns the default for null or junk input', () => {
  const { migrateLegacyPattern } = loadLogic(['migrateLegacyPattern']);
  assert.deepEqual(migrateLegacyPattern(null, PATTERN_DEFAULTS), PATTERN_DEFAULTS.topBar.pattern);
  assert.deepEqual(migrateLegacyPattern(42, PATTERN_DEFAULTS), PATTERN_DEFAULTS.topBar.pattern);
  assert.deepEqual(migrateLegacyPattern({}, PATTERN_DEFAULTS), PATTERN_DEFAULTS.topBar.pattern);
});

test('migrateLegacyPattern passes an already-migrated save through untouched', () => {
  const { migrateLegacyPattern } = loadLogic(['migrateLegacyPattern']);
  const saved = { topBar: { pattern: { beats: 3, division: 2, preset: 'eighths', levels: [3, 0, 2, 1, 2, 1] } } };
  assert.deepEqual(migrateLegacyPattern(saved, PATTERN_DEFAULTS), saved.topBar.pattern);
});

test('migrateLegacyPattern maps each legacy subdivision name to a division', () => {
  const { migrateLegacyPattern } = loadLogic(['migrateLegacyPattern']);
  const cases = { none: 1, eighths: 2, triplets: 3, sixteenths: 4 };
  for (const [name, division] of Object.entries(cases)) {
    const saved = {
      topBar: { subdivision: name },
      metronome: { timeSigNum: 4, accentPattern: [true, false, false, false] },
    };
    const result = migrateLegacyPattern(saved, PATTERN_DEFAULTS);
    assert.equal(result.division, division);
    assert.equal(result.preset, name);
    assert.equal(result.levels.length, 4 * division);
  }
});

test('migrateLegacyPattern carries the metronome beats and accents across', () => {
  const { migrateLegacyPattern } = loadLogic(['migrateLegacyPattern']);
  const saved = {
    topBar: { subdivision: 'eighths' },
    metronome: { timeSigNum: 3, accentPattern: [true, false, true] },
    ramp: { timeSigNum: 7, accentPattern: [true, true, true, true, true, true, true] },
  };
  const result = migrateLegacyPattern(saved, PATTERN_DEFAULTS);
  assert.equal(result.beats, 3);
  //  beat 1 accented, beat 2 normal, beat 3 accented; every off-slot quiet
  assert.deepEqual(result.levels, [3, 1, 2, 1, 3, 1]);
});

test('migrateLegacyPattern falls back when the metronome section is missing', () => {
  const { migrateLegacyPattern } = loadLogic(['migrateLegacyPattern']);
  const result = migrateLegacyPattern({ topBar: { subdivision: 'triplets' } }, PATTERN_DEFAULTS);
  assert.equal(result.beats, 4);
  assert.equal(result.division, 3);
  assert.equal(result.levels.length, 12);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/*.test.js`
Expected: FAIL with `ReferenceError: parseSavedSettings is not defined`.

- [ ] **Step 3: Add the functions to the LOGIC block**

Insert after `resizePatternLevels`:

```js
function parseSavedSettings(json) {
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

// Guards against a hand-edited or truncated save: clamps both dimensions, then
// forces the level array to exactly beats * division entries.
function normalizePattern(pattern) {
  const source = pattern && typeof pattern === 'object' ? pattern : {};
  const beats = clampPatternBeats(source.beats);
  const division = clampPatternDivision(source.division);
  const levels = resizePatternLevels(
    Array.isArray(source.levels) ? source.levels : null,
    beats, division, beats, division
  );
  const preset = typeof source.preset === 'string' ? source.preset : presetForDivision(division);
  return { beats: beats, division: division, preset: preset, levels: levels };
}

// Runs once per load. A save written before the pattern editor existed has its
// meter and accents rebuilt from the old fields rather than being reset to the
// default — Metronome is the source, because three per-mode patterns are
// collapsing into one and Metronome is the tab a user is likeliest to have set.
function migrateLegacyPattern(parsed, defaults) {
  const fallback = normalizePattern(defaults.topBar.pattern);
  if (!parsed || typeof parsed !== 'object') return fallback;
  const topBar = parsed.topBar;
  if (!topBar || typeof topBar !== 'object') return fallback;
  if (topBar.pattern && typeof topBar.pattern === 'object') return normalizePattern(topBar.pattern);

  const division = divisionForPreset(topBar.subdivision) || 1;
  const legacy = parsed.metronome && typeof parsed.metronome === 'object' ? parsed.metronome : {};
  const beats = clampPatternBeats(legacy.timeSigNum);
  const accents = Array.isArray(legacy.accentPattern) ? legacy.accentPattern : [];
  const levels = [];
  for (let beat = 0; beat < beats; beat++) {
    for (let slot = 0; slot < division; slot++) {
      if (slot !== 0) levels.push(LEVEL_QUIET);
      else levels.push(accents[beat] ? LEVEL_ACCENT : LEVEL_NORMAL);
    }
  }
  return { beats: beats, division: division, preset: presetForDivision(division), levels: levels };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/*.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/logic.test.js
git commit -m "feat: add pattern normalization and legacy save migration"
```

---

### Task 5: The playhead scan

**Files:**
- Modify: `index.html` — LOGIC block, after `migrateLegacyPattern`
- Test: `tests/logic.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `findPlayheadEntry(entries, now, runId, generation) -> entry | null`, where an entry is `{ time, slotIndex, runId, generation }`

This is the one piece of the animation-frame playhead that can be tested without a browser, which is why it is a pure function rather than inline in the frame callback.

- [ ] **Step 1: Write the failing tests**

Append to `tests/logic.test.js`:

```js
function entry(time, slotIndex, runId, generation) {
  return { time: time, slotIndex: slotIndex, runId: runId, generation: generation };
}

test('findPlayheadEntry returns the newest entry already in the past', () => {
  const { findPlayheadEntry } = loadLogic(['findPlayheadEntry']);
  const ring = [entry(1.0, 0, 1, 1), entry(1.5, 1, 1, 1), entry(2.0, 2, 1, 1)];
  assert.equal(findPlayheadEntry(ring, 1.7, 1, 1).slotIndex, 1);
  assert.equal(findPlayheadEntry(ring, 9.0, 1, 1).slotIndex, 2);
});

test('findPlayheadEntry returns null when every entry is still in the future', () => {
  const { findPlayheadEntry } = loadLogic(['findPlayheadEntry']);
  const ring = [entry(5.0, 0, 1, 1), entry(5.5, 1, 1, 1)];
  assert.equal(findPlayheadEntry(ring, 1.0, 1, 1), null);
});

test('findPlayheadEntry ignores entries from a previous playback run', () => {
  const { findPlayheadEntry } = loadLogic(['findPlayheadEntry']);
  const ring = [entry(1.0, 7, 1, 1), entry(1.5, 2, 2, 1)];
  assert.equal(findPlayheadEntry(ring, 9.0, 2, 1).slotIndex, 2);
  assert.equal(findPlayheadEntry(ring, 1.2, 2, 1), null);
});

test('findPlayheadEntry ignores entries from a stale pattern generation', () => {
  const { findPlayheadEntry } = loadLogic(['findPlayheadEntry']);
  const ring = [entry(1.0, 40, 1, 1), entry(1.5, 3, 1, 2)];
  assert.equal(findPlayheadEntry(ring, 9.0, 1, 2).slotIndex, 3);
  assert.equal(findPlayheadEntry(ring, 1.2, 1, 2), null);
});

test('findPlayheadEntry survives empty slots, an empty ring and junk input', () => {
  const { findPlayheadEntry } = loadLogic(['findPlayheadEntry']);
  assert.equal(findPlayheadEntry([null, null], 1.0, 1, 1), null);
  assert.equal(findPlayheadEntry([], 1.0, 1, 1), null);
  assert.equal(findPlayheadEntry(null, 1.0, 1, 1), null);
});

test('findPlayheadEntry reads a wrapped ring by time, not by position', () => {
  const { findPlayheadEntry } = loadLogic(['findPlayheadEntry']);
  //  Newest write landed at index 0 after wrapping past the end.
  const ring = [entry(3.0, 3, 1, 1), entry(1.0, 1, 1, 1), entry(2.0, 2, 1, 1)];
  assert.equal(findPlayheadEntry(ring, 3.5, 1, 1).slotIndex, 3);
  assert.equal(findPlayheadEntry(ring, 2.5, 1, 1).slotIndex, 2);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/*.test.js`
Expected: FAIL with `ReferenceError: findPlayheadEntry is not defined`.

- [ ] **Step 3: Add the function to the LOGIC block**

Insert after `migrateLegacyPattern`:

```js
// Scans by time rather than by ring position, so a wrapped buffer needs no
// bookkeeping. Rejecting stale runId/generation here is what stops a highlight
// surviving a stop-then-start or a mid-playback grid resize.
function findPlayheadEntry(entries, now, runId, generation) {
  if (!Array.isArray(entries)) return null;
  let best = null;
  for (let i = 0; i < entries.length; i++) {
    const candidate = entries[i];
    if (!candidate) continue;
    if (candidate.runId !== runId || candidate.generation !== generation) continue;
    if (candidate.time > now) continue;
    if (best === null || candidate.time > best.time) best = candidate;
  }
  return best;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/*.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/logic.test.js
git commit -m "feat: add pure playhead entry scan"
```

---

### Task 6: Editor markup and styling (inert)

**Files:**
- Modify: `index.html` — markup after the `#heroZone` div, and a new `@layer components` block before `@layer themes {`

**Interfaces:**
- Consumes: nothing
- Produces: DOM ids later tasks bind to — `#patternEditor`, `#patternPreset`, `#patternBeats`, `#patternDivision`, `#patternSlotCount`, `#patternToggle`, `#patternGrid`; classes `.pattern-row`, `.pattern-slot`, `.beat-start`, `.level-muted`, `.level-quiet`, `.level-normal`, `.level-accent`, `.playhead`, `.playhead-row`, and `#patternGrid.compact`

This task adds a visible but non-functional editor. The grid renders empty until Task 8.

- [ ] **Step 1: Add the markup**

In `index.html`, insert immediately after the closing `</div>` of `#heroZone` and before `<div id="panel-metronome" class="panel">`:

```html
  <section id="patternEditor" aria-label="Rhythm pattern">
    <div id="patternHeader">
      <div class="field-group pattern-field">
        <label for="patternPreset">Preset</label>
        <select id="patternPreset">
          <option value="none">None</option>
          <option value="eighths">Eighths</option>
          <option value="triplets">Triplets</option>
          <option value="sixteenths">Sixteenths</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div class="field-group pattern-field">
        <label for="patternBeats">Beats</label>
        <div class="stepper-row">
          <button class="step-btn" type="button" data-step-target="patternBeats" data-step="-1">&minus;</button>
          <input id="patternBeats" type="number" min="1" max="64" step="1" value="4">
          <button class="step-btn" type="button" data-step-target="patternBeats" data-step="1">&plus;</button>
        </div>
      </div>
      <div class="field-group pattern-field">
        <label for="patternDivision">Division</label>
        <div class="stepper-row">
          <button class="step-btn" type="button" data-step-target="patternDivision" data-step="-1">&minus;</button>
          <input id="patternDivision" type="number" min="1" max="64" step="1" value="1">
          <button class="step-btn" type="button" data-step-target="patternDivision" data-step="1">&plus;</button>
        </div>
      </div>
      <div id="patternMeta">
        <span id="patternSlotCount">4 slots</span>
        <button id="patternToggle" type="button" aria-expanded="true" aria-controls="patternBody">Hide</button>
      </div>
    </div>
    <div id="patternBody">
      <div id="patternGrid" role="group" aria-label="Rhythm pattern slots"></div>
      <div id="patternLegend">
        <span><span class="pattern-swatch level-muted" aria-hidden="true"></span>Muted</span>
        <span><span class="pattern-swatch level-quiet" aria-hidden="true"></span>Quiet</span>
        <span><span class="pattern-swatch level-normal" aria-hidden="true"></span>Normal</span>
        <span><span class="pattern-swatch level-accent" aria-hidden="true"></span>Accented</span>
        <span id="patternHint">Click a slot to cycle forward, shift-click to go back</span>
      </div>
    </div>
  </section>
```

The legend lives inside `#patternBody` so it collapses with the grid rather than floating under a hidden editor. Without it, four fill sizes are an undiscoverable code — this row is the only thing that teaches them.

- [ ] **Step 2: Add the styles**

Find the line `@layer themes {` (the first occurrence, around line 589). Insert this complete block **immediately before** it. A new `@layer components` block merges with the earlier ones, so this keeps every rule layered without hunting for the end of an existing block.

```css
@layer components {
  /* Sizing for the editor's own controls, deliberately outside the shared
     spacing scale for the same reason --quick-select-popup-* is: these are
     dimensions of one specific control, not gaps between things. */
  #patternEditor {
    /* 26px, not the 44px touch guideline. Adjacent grid cells cannot reach 44
       without their hit areas overlapping their neighbours, which trades a
       small target for a wrong one. 26px plus a 4px gap is the largest target
       that stays honest; the keyboard path added in Task 8 is the real
       accommodation for anyone who cannot hit it. */
    --pattern-slot-size: 26px;
    --pattern-slot-size-compact: 10px;
    --pattern-grid-max-height: 40vh;

    border: 1px solid var(--divider);
    border-radius: var(--radius-panel);
    padding: var(--space-sm);
    margin-bottom: var(--space-sm);
    background: var(--panel);
  }

  #patternHeader {
    display: flex;
    gap: var(--space-sm);
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .pattern-field { margin-bottom: 0; }

  #patternMeta {
    display: flex;
    align-items: center;
    gap: var(--space-2xs);
    margin-left: auto;
    font-size: var(--text-xs);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  #patternToggle {
    font: inherit;
    font-weight: var(--font-weight-semibold);
    color: var(--text-muted);
    background: none;
    border: 1px solid var(--divider);
    border-radius: var(--radius);
    padding: var(--space-2xs) var(--space-xs);
    cursor: pointer;
    transition: color var(--duration-fast) var(--ease-standard),
                border-color var(--duration-fast) var(--ease-standard);
  }

  #patternToggle:hover { color: var(--text); border-color: var(--accent); }

  /* An author display value beats the UA sheet's [hidden] { display: none },
     so the collapse silently does nothing without this rule. The project
     already hit this once: see .panel[hidden]. */
  #patternBody[hidden] { display: none; }

  #patternGrid {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: var(--space-sm);
    max-height: var(--pattern-grid-max-height);
    overflow: auto;
  }

  .pattern-row {
    display: flex;
    align-items: center;
    gap: 4px;
    border-radius: var(--radius);
    padding: 2px;
  }

  .pattern-beat-number {
    width: 1.5rem;
    flex: none;
    text-align: right;
    padding-right: var(--space-2xs);
    font-size: var(--text-xs);
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }

  /* Deliberately NOT .beat-dot: the components layer locks that class's
     transition and five themes restate its states. A slot is a different
     control with a different lifecycle and must not inherit either. */
  .pattern-slot {
    appearance: none;
    -webkit-appearance: none;
    flex: none;
    width: var(--pattern-slot-size);
    height: var(--pattern-slot-size);
    padding: 0;
    border: 1px solid var(--divider);
    /* Deliberately NOT var(--radius): each theme scales that token for inputs
       and buttons, from 3px to 10px, and 10px on a 26px cell is a pill. A cell
       radius wants to stay a cell radius, and varying it against the section's
       --radius-panel is the point. */
    border-radius: 3px;
    background: var(--overlay);
    cursor: pointer;
    position: relative;
    transition: border-color var(--duration-fast) var(--ease-standard),
                background-color var(--duration-fast) var(--ease-standard);
  }

  /* The inner mark carries the level, so the four levels differ in fill size
     as well as colour and stay distinguishable without colour vision. */
  .pattern-slot::after {
    content: "";
    position: absolute;
    inset: 0;
    margin: auto;
    border-radius: 2px;
    width: 0;
    height: 0;
    background: var(--text);
  }

  .pattern-slot.level-muted {
    background: transparent;
    border-style: dashed;
    opacity: 0.5;
  }

  .pattern-slot.level-quiet::after  { width: 6px;  height: 6px;  background: var(--text-dim); }
  .pattern-slot.level-normal::after { width: 11px; height: 11px; background: var(--text); }

  /* Border and fill carry the accent, and no third signal. An earlier draft
     also tinted the background with --accent-glow, which Pulse Engine defines
     at 55% accent — three accent cues on one 26px cell, blocking nearly solid
     and spending the accent budget on a control that repeats up to 4096 times. */
  .pattern-slot.level-accent { border-color: var(--accent); }
  .pattern-slot.level-accent::after { width: 16px; height: 16px; background: var(--accent); }

  .pattern-slot.beat-start { border-color: var(--text-dim); }

  .pattern-slot:hover { border-color: var(--accent); }

  /* Playhead. Applied and removed from an animation frame, never from a
     transitionend listener, so it cannot get stuck the way .pulse once did. */
  .pattern-slot.playhead { box-shadow: 0 0 0 2px var(--accent), 0 0 12px var(--accent-glow); }

  /* Not var(--overlay): in Classic that token is the slot's own background and
     the section's border colour, all three #2a2a33, so the row highlight would
     be invisible against the very cells it is meant to group. */
  .pattern-row.playhead-row { background: color-mix(in srgb, var(--accent) 10%, transparent); }

  /* While playing, everything but the sounding slot recedes so the playhead
     reads at a glance. The grid stays fully interactive — this is a reading
     emphasis, not a disabled state. body.playing is already toggled by
     setTransportState. */
  body.playing .pattern-slot:not(.playhead) { opacity: 0.7; }
  body.playing .pattern-slot.level-muted:not(.playhead) { opacity: 0.35; }

  #patternGrid.compact { gap: 2px; }
  #patternGrid.compact .pattern-row { gap: 2px; }
  #patternGrid.compact .pattern-slot {
    width: var(--pattern-slot-size-compact);
    height: var(--pattern-slot-size-compact);
    border-radius: 2px;
  }
  #patternGrid.compact .pattern-slot.level-quiet::after  { width: 3px; height: 3px; }
  #patternGrid.compact .pattern-slot.level-normal::after { width: 5px; height: 5px; }
  #patternGrid.compact .pattern-slot.level-accent::after { width: 6px; height: 6px; }
  #patternGrid.compact .pattern-beat-number { width: 1.1rem; }

  /* The legend is the only thing that teaches four fill sizes. It sits inside
     the collapsible body so it disappears with the grid it explains. */
  #patternLegend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
    padding-top: var(--space-xs);
    border-top: 1px solid var(--divider);
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  #patternLegend > span {
    display: flex;
    align-items: center;
    gap: var(--space-2xs);
  }

  #patternHint { margin-left: auto; color: var(--text-dim); }

  .pattern-swatch {
    width: 14px;
    height: 14px;
    flex: none;
    border: 1px solid var(--divider);
    border-radius: 3px;
    background: var(--overlay);
    position: relative;
  }

  .pattern-swatch::after {
    content: "";
    position: absolute;
    inset: 0;
    margin: auto;
    border-radius: 2px;
    width: 0;
    height: 0;
  }

  .pattern-swatch.level-muted { background: transparent; border-style: dashed; opacity: 0.5; }
  .pattern-swatch.level-quiet::after  { width: 4px; height: 4px; background: var(--text-dim); }
  .pattern-swatch.level-normal::after { width: 7px; height: 7px; background: var(--text); }
  .pattern-swatch.level-accent { border-color: var(--accent); }
  .pattern-swatch.level-accent::after { width: 9px; height: 9px; background: var(--accent); }
}
```

- [ ] **Step 3: Verify the layer contract still holds**

Run: `node --test tests/*.test.js`
Expected: PASS. `tests/themes.test.js` must not regress; the new rules touch no theme token block and no `.beat-dot` rule.

- [ ] **Step 4: Verify in a browser**

Open `index.html`. Expected: a bordered section with Preset, Beats, Division, a Hide button and a legend row, sitting between the hero and the Metronome panel. The grid between header and legend is empty and the controls do nothing yet. Check all five themes render it legibly (`--panel`, `--divider`, `--accent` are all in the required token set, so each theme supplies its own), and that the four legend swatches are distinguishable in each — that row is the only thing that teaches the fill sizes.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add rhythm pattern editor markup and styling"
```

---

### Task 7: Swap the state shape and the audio path

**Files:**
- Modify: `index.html` — `DEFAULT_STATE` and the load block, `scheduleClick`, `scheduleBeat`, `renderBeatDots`/`renderPracticeProgressDots`, `advanceModeAfterBeat`, `startPlayback`, `refreshAllInputsFromState`, `bindTopBar`, `bindMetronomeTab`, `bindRampTab`, `bindPracticeTab`, `QUICK_SELECT_PRESETS`, and the topbar/panel markup

**Interfaces:**
- Consumes: every LOGIC function from Tasks 1–5
- Produces:
  - `state.topBar.pattern` and `state.topBar.patternEditorOpen`
  - `renderDotRow(count)` — replaces both `renderBeatDots()` and `renderPracticeProgressDots(count)`
  - `scheduleClick(time, level)` — signature change from `(time, accent, isSubdivision)`

This is the atomic swap: the old fields cannot be removed without the new audio path, and vice versa. The editor's controls are still inert after this task — the app runs on the migrated or default pattern until Task 8.

- [ ] **Step 1: Replace DEFAULT_STATE and the load block**

Replace:

```js
const DEFAULT_STATE = {
  topBar: { subdivision: 'none', soundStyle: 'click', volume: 80, activeTab: 'metronome', theme: 'classic' },
  metronome: { bpm: 120, percent: 100, timeSigNum: 4, accentPattern: [true, false, false, false] },
  ramp: { startBpm: 80, stopBpm: 140, scaleMode: 'percent', scaleAmount: 2, stepBars: 4, timeSigNum: 4, accentPattern: [true, false, false, false] },
  practice: { baseBpm: 120, deltaPercent: 50, timeSigNum: 4, barsPerPhase: 1, breakBeats: 4, accentPattern: [true, false, false, false] },
};

const STORAGE_KEY = 'guitarMetronomeSettings';
let state = deserializeSettings(localStorage.getItem(STORAGE_KEY), DEFAULT_STATE);
['metronome', 'ramp', 'practice'].forEach((mode) => {
  state[mode].accentPattern = resizeAccentPattern(state[mode].accentPattern, state[mode].timeSigNum);
});
```

with:

```js
const DEFAULT_STATE = {
  topBar: {
    soundStyle: 'click', volume: 80, activeTab: 'metronome', theme: 'classic',
    // LEVEL_* come from the LOGIC <script>, which runs before this block, so
    // the seed states its levels by name like every other level reference.
    pattern: {
      beats: 4, division: 1, preset: 'none',
      levels: [LEVEL_ACCENT, LEVEL_NORMAL, LEVEL_NORMAL, LEVEL_NORMAL],
    },
    patternEditorOpen: true,
  },
  metronome: { bpm: 120, percent: 100 },
  ramp: { startBpm: 80, stopBpm: 140, scaleMode: 'percent', scaleAmount: 2, stepBars: 4 },
  practice: { baseBpm: 120, deltaPercent: 50, barsPerPhase: 1, breakBeats: 4 },
};

const STORAGE_KEY = 'guitarMetronomeSettings';
const savedSettingsJson = localStorage.getItem(STORAGE_KEY);
let state = deserializeSettings(savedSettingsJson, DEFAULT_STATE);
// deserializeSettings merges section-wise, so a pre-editor save would silently
// receive the default pattern and lose its meter and accents. Rebuild it from
// the raw blob instead.
state.topBar.pattern = migrateLegacyPattern(parseSavedSettings(savedSettingsJson), DEFAULT_STATE);
```

- [ ] **Step 2: Replace the audio path**

Replace `scheduleClick`:

```js
function scheduleClick(time, level) {
  const ctx = ensureAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = state.topBar.soundStyle === 'wood' ? 'triangle' : 'sine';
  osc.frequency.value = soundFrequency(state.topBar.soundStyle, levelIsAccent(level));
  const vol = (state.topBar.volume / 100) * levelGainFactor(level);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0001), time + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  osc.start(time);
  osc.stop(time + 0.06);
}
```

Then in `scheduleBeat`, replace these lines:

```js
  const accent = !isPracticeBreak && isAccentBeat(beatIndex, modeState.accentPattern);
  scheduleClick(time, accent, false);

  const subCount = subdivisionCount(state.topBar.subdivision);
  const subInterval = subdivisionIntervalSeconds(bpm, state.topBar.subdivision);
  for (let s = 1; s < subCount; s++) {
    scheduleClick(time + subInterval * s, false, true);
  }
```

with:

```js
  const pattern = state.topBar.pattern;
  const division = pattern.division;
  const slotInterval = slotIntervalSeconds(bpm, division);
  // Captured for the deferred per-beat callback below, alongside the other
  // capture-before-advance values.
  let beatLevel = LEVEL_NORMAL;
  for (let s = 0; s < division; s++) {
    // A practice break ignores the pattern entirely: one normal click on the
    // beat, nothing in between, so a break is audibly flat against a phase.
    const level = isPracticeBreak
      ? (s === 0 ? LEVEL_NORMAL : LEVEL_MUTED)
      : patternLevelAt(pattern, beatIndex, s);
    if (s === 0) beatLevel = level;
    if (level === LEVEL_MUTED) continue;
    scheduleClick(time + slotInterval * s, level);
  }
  const accent = levelIsAccent(beatLevel);
```

And at the bottom of `scheduleBeat`, replace:

```js
  beatIndexInBar = (beatIndexInBar + 1) % modeState.timeSigNum;
```

with:

```js
  beatIndexInBar = (beatIndexInBar + 1) % pattern.beats;
```

`modeState` is now unused inside `scheduleBeat`; delete its declaration line (`const modeState = state[scheduledTab];`).

- [ ] **Step 3: Collapse the two dot renderers into one**

Delete `renderBeatDots`, `toggleAccent` and `updateAccentDotStyles` entirely, and rename `renderPracticeProgressDots` to `renderDotRow`. The dot row is now always a non-interactive position indicator, so the two functions have become the same function with different counts:

```js
function renderDotRow(count) {
  const container = document.getElementById('beatIndicator');
  container.setAttribute('aria-hidden', 'true');
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    dot.className = 'beat-dot';
    container.appendChild(dot);
  }
  // Force a synchronous reflow so the freshly-created dots' resting style is
  // committed before scheduleBeat's immediately-following flashBeatIndicator()
  // call adds .pulse. Without this, a dot created and pulsed in the same tick
  // has no prior committed style to transition from, so no transition starts,
  // transitionend never fires, and the pulse class gets stuck forever on that
  // dot — which always happens to be index 0, the first beat of every segment
  // this function is called for.
  container.offsetHeight;
}
```

Update every call site:

| Was | Now |
|---|---|
| `renderPracticeProgressDots(dotCount)` in `scheduleBeat` | `renderDotRow(dotCount)` |
| `renderPracticeProgressDots(practiceRuntime.beatsPerPhase)` in `startPlayback` | `renderDotRow(practiceRuntime.beatsPerPhase)` |
| `if (state.topBar.activeTab === 'practice') renderBeatDots();` in `stopPlayback` | `renderDotRow(state.topBar.pattern.beats);` (unconditional — every mode returns to the bar-length row on stop) |
| `renderBeatDots()` in `switchTab` | `renderDotRow(state.topBar.pattern.beats)` |

- [ ] **Step 4: Point the bars-to-beats arithmetic at the shared count**

In `advanceModeAfterBeat`, replace:

```js
    const beatsPerStep = barsToBeats(state.ramp.stepBars, state.ramp.timeSigNum);
```

with:

```js
    const beatsPerStep = barsToBeats(state.ramp.stepBars, state.topBar.pattern.beats);
```

In `startPlayback`, replace:

```js
    const beatsPerPhase = barsToBeats(state.practice.barsPerPhase, state.practice.timeSigNum);
```

with:

```js
    const beatsPerPhase = barsToBeats(state.practice.barsPerPhase, state.topBar.pattern.beats);
```

- [ ] **Step 5: Remove the retired controls from the markup**

Delete the whole Subdivision label from `#topbar`:

```html
    <label>Subdivision
      <select id="subdivision">
        <option value="none">None</option>
        <option value="eighths">Eighths</option>
        <option value="triplets">Triplets</option>
        <option value="sixteenths">Sixteenths</option>
      </select>
    </label>
```

Then delete all three "Beats per Bar" field groups. Find them with:

```bash
grep -n "TimeSig" index.html
```

Each is a five-line `<div class="field-group">` wrapping a label, a stepper row, two `.step-btn` buttons and an `input` whose id is `metronomeTimeSig`, `rampTimeSig` or `practiceTimeSig`. Delete each group in full.

- [ ] **Step 6: Remove the retired wiring from the JS**

1. In `refreshAllInputsFromState`, delete these four lines:

```js
  document.getElementById('subdivision').value = state.topBar.subdivision;
  document.getElementById('metronomeTimeSig').value = state.metronome.timeSigNum;
  document.getElementById('rampTimeSig').value = state.ramp.timeSigNum;
  document.getElementById('practiceTimeSig').value = state.practice.timeSigNum;
```

2. In `bindTopBar`, delete the `subdivision` lookup and its `change` listener:

```js
  const subdivision = document.getElementById('subdivision');
  subdivision.addEventListener('change', () => {
    state.topBar.subdivision = subdivision.value;
    persistState();
  });
```

3. In each of `bindMetronomeTab`, `bindRampTab` and `bindPracticeTab`, delete:
   - the `const timeSig = document.getElementById('...TimeSig');` lookup
   - the whole `function setTimeSig(value) { ... }`
   - the `timeSig.addEventListener('change', ...)` line
   - the `attachQuickSelect(timeSig, QUICK_SELECT_PRESETS.timeSig, ...)` line
   - the `...TimeSig: { input: timeSig, set: setTimeSig },` entry in `stepperFields`

4. In `QUICK_SELECT_PRESETS`, delete the `timeSig: [2, 3, 4, 5, 6, 8],` entry.

- [ ] **Step 7: Verify no dangling references remain**

Run:

```bash
grep -n "timeSigNum\|accentPattern\|topBar.subdivision\|renderBeatDots\|renderPracticeProgressDots\|toggleAccent\|updateAccentDotStyles\|isAccentBeat\|subdivisionCount\|subdivisionIntervalSeconds" index.html
```

Expected: only the four LOGIC function definitions `isAccentBeat`, `subdivisionCount`, `subdivisionIntervalSeconds`, `resizeAccentPattern` (removed in Task 10) and any occurrences inside `migrateLegacyPattern`, which reads the legacy field names on purpose. No other hits.

- [ ] **Step 8: Run the tests**

Run: `node --test tests/*.test.js`
Expected: PASS. The four legacy LOGIC functions still exist, so their tests still pass.

- [ ] **Step 9: Verify in a browser**

1. Clear `localStorage` for the page, reload. Expected: 4 dots, plays 120 BPM with an accent on beat 1, sounding exactly as it did before this change.
2. Before reloading with a real saved blob, save one from the pre-change version if you have one; otherwise paste a legacy blob into the console and reload:

```js
localStorage.setItem('guitarMetronomeSettings', JSON.stringify({
  topBar: { subdivision: 'triplets', soundStyle: 'click', volume: 80, activeTab: 'metronome', theme: 'classic' },
  metronome: { bpm: 100, percent: 100, timeSigNum: 3, accentPattern: [true, false, true] },
  ramp: { startBpm: 80, stopBpm: 140, scaleMode: 'percent', scaleAmount: 2, stepBars: 4, timeSigNum: 4, accentPattern: [true, false, false, false] },
  practice: { baseBpm: 120, deltaPercent: 50, timeSigNum: 4, barsPerPhase: 1, breakBeats: 4, accentPattern: [true, false, false, false] },
}));
```

Expected after reload: 3 dots, triplet subdivisions audible, accents on beats 1 and 3.
3. Practice mode: phases play the pattern, break beats play one plain click each with no subdivisions.
4. Ramp mode: tempo steps still land on bar boundaries.

- [ ] **Step 10: Commit**

```bash
git add index.html
git commit -m "feat: drive playback from the shared slot-level pattern"
```

---

### Task 8: Wire the editor

**Files:**
- Modify: `index.html` — new `bindPatternEditor()` and helpers near the other `bind*` functions, plus `refreshAllInputsFromState`

**Interfaces:**
- Consumes: `#patternEditor` markup (Task 6), pattern LOGIC (Tasks 1–3), `attachQuickSelect`, `flashClamped`, `wasValueClamped`, `persistState`, `renderDotRow` (Task 7)
- Produces:
  - `let patternGeneration = 0;` — incremented on every beats/division change; consumed by Task 9
  - `renderPatternGrid()`, `applySlotStyle(el, level, division)`, `updatePatternSlotCountLabel()`, `applyPatternEditorOpen()`
  - `QUICK_SELECT_PRESETS.patternBeats` and `.patternDivision`

- [ ] **Step 1: Add the two quick-select preset lists and the generation counter**

In `QUICK_SELECT_PRESETS`, add:

```js
  patternBeats: [2, 3, 4, 5, 6, 7, 8, 12, 16],
  patternDivision: [1, 2, 3, 4, 5, 6, 8],
```

Then insert this immediately after `let practiceRuntime = null;`. It is declared here, next to the other playback runtime state and above every function that touches it, rather than beside the editor code that increments it — Task 9's playhead block goes directly below this line and reads it every frame.

```js
// Bumped whenever beats or division changes, so playhead records scheduled
// against the previous grid are rejected rather than highlighting a slot index
// that now means something else. Read by the playhead frame loop.
let patternGeneration = 0;
```

- [ ] **Step 2: Add the rendering and binding code**

Insert immediately before `function bindMetronomeTab() {`:

```js
// Above this many slots the grid switches to compact sizing. Chosen so a
// conventional pattern (up to 16 beats of sixteenths) stays full size.
const PATTERN_COMPACT_THRESHOLD = 128;

const LEVEL_CLASSES = ['level-muted', 'level-quiet', 'level-normal', 'level-accent'];
const LEVEL_NAMES = ['muted', 'quiet', 'normal', 'accented'];

// Roving tabindex anchor. Exactly one slot is tabbable at a time, so the grid
// is a single Tab stop however large it grows — without this, reaching the
// Start button from the editor means tabbing through up to 4096 buttons.
let patternFocusIndex = 0;

function applySlotStyle(el, level, division) {
  const index = Number(el.dataset.index);
  for (let i = 0; i < LEVEL_CLASSES.length; i++) {
    el.classList.toggle(LEVEL_CLASSES[i], i === level);
  }
  const beat = Math.floor(index / division) + 1;
  const slot = (index % division) + 1;
  el.setAttribute('aria-label', `Beat ${beat}, slot ${slot} of ${division}, ${LEVEL_NAMES[level]}`);
}

function updatePatternSlotCountLabel() {
  const pattern = state.topBar.pattern;
  const count = patternSlotCount(pattern.beats, pattern.division);
  document.getElementById('patternSlotCount').textContent =
    count === 1 ? '1 slot' : `${count} slots`;
}

// Builds the whole grid in one fragment. Click handling is delegated to the
// container in bindPatternEditor, so this attaches no per-slot listeners —
// 4096 elements is tractable, 4096 listeners is not.
function renderPatternGrid() {
  const grid = document.getElementById('patternGrid');
  const pattern = state.topBar.pattern;
  const fragment = document.createDocumentFragment();
  const total = patternSlotCount(pattern.beats, pattern.division);
  if (patternFocusIndex >= total) patternFocusIndex = total - 1;
  if (patternFocusIndex < 0) patternFocusIndex = 0;

  for (let beat = 0; beat < pattern.beats; beat++) {
    const row = document.createElement('div');
    row.className = 'pattern-row';
    const number = document.createElement('span');
    number.className = 'pattern-beat-number';
    number.setAttribute('aria-hidden', 'true');
    number.textContent = String(beat + 1);
    row.appendChild(number);
    for (let slot = 0; slot < pattern.division; slot++) {
      const index = patternSlotIndex(beat, slot, pattern.division);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = slot === 0 ? 'pattern-slot beat-start' : 'pattern-slot';
      el.dataset.index = String(index);
      el.tabIndex = index === patternFocusIndex ? 0 : -1;
      applySlotStyle(el, patternLevelAt(pattern, beat, slot), pattern.division);
      row.appendChild(el);
    }
    fragment.appendChild(row);
  }

  grid.classList.toggle(
    'compact',
    patternSlotCount(pattern.beats, pattern.division) > PATTERN_COMPACT_THRESHOLD
  );
  grid.innerHTML = '';
  grid.appendChild(fragment);
  updatePatternSlotCountLabel();
}

function applyPatternEditorOpen() {
  const open = state.topBar.patternEditorOpen !== false;
  const toggle = document.getElementById('patternToggle');
  // #patternBody, not #patternGrid — the legend collapses with the grid it
  // explains, and the CSS carries the matching [hidden] rule.
  document.getElementById('patternBody').hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.textContent = open ? 'Hide' : 'Show';
}

function bindPatternEditor() {
  const preset = document.getElementById('patternPreset');
  const beats = document.getElementById('patternBeats');
  const division = document.getElementById('patternDivision');
  const grid = document.getElementById('patternGrid');
  const toggle = document.getElementById('patternToggle');

  // Resizing the grid invalidates in-flight playhead records and can leave the
  // bar counter past the new end, so both are corrected here in one place.
  function afterPatternResize() {
    const pattern = state.topBar.pattern;
    patternGeneration++;
    beatIndexInBar = beatIndexInBar % pattern.beats;
    renderPatternGrid();
    // Never re-render the dot row mid-playback: during Practice it is showing
    // phase progress, not bar position, and would be silently replaced.
    if (!isPlaying) renderDotRow(pattern.beats);
  }

  function setBeats(value) {
    const pattern = state.topBar.pattern;
    const clamped = clampPatternBeats(value);
    if (wasValueClamped(value, clamped, 0)) flashClamped(beats);
    pattern.levels = resizePatternLevels(
      pattern.levels, pattern.beats, pattern.division, clamped, pattern.division
    );
    pattern.beats = clamped;
    beats.value = clamped;
    afterPatternResize();
  }

  function setDivision(value) {
    const pattern = state.topBar.pattern;
    const clamped = clampPatternDivision(value);
    if (wasValueClamped(value, clamped, 0)) flashClamped(division);
    pattern.levels = resizePatternLevels(
      pattern.levels, pattern.beats, pattern.division, pattern.beats, clamped
    );
    pattern.division = clamped;
    pattern.preset = presetForDivision(clamped);
    division.value = clamped;
    preset.value = pattern.preset;
    afterPatternResize();
  }

  function setPreset(name) {
    const target = divisionForPreset(name);
    if (target === null) {
      // "Custom" is a label the app applies, never a choice that changes the
      // grid; snap the control back to whatever the pattern actually is.
      preset.value = state.topBar.pattern.preset;
      return;
    }
    const pattern = state.topBar.pattern;
    pattern.division = target;
    pattern.preset = name;
    pattern.levels = buildPresetLevels(pattern.beats, target);
    division.value = target;
    afterPatternResize();
  }

  preset.addEventListener('change', () => { setPreset(preset.value); persistState(); });
  beats.addEventListener('change', () => { setBeats(beats.value); persistState(); });
  division.addEventListener('change', () => { setDivision(division.value); persistState(); });

  attachQuickSelect(beats, QUICK_SELECT_PRESETS.patternBeats, (v) => { setBeats(v); persistState(); });
  attachQuickSelect(division, QUICK_SELECT_PRESETS.patternDivision, (v) => { setDivision(v); persistState(); });

  const stepperFields = {
    patternBeats: { input: beats, set: setBeats },
    patternDivision: { input: division, set: setDivision },
  };
  document.getElementById('patternHeader').querySelectorAll('.step-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = stepperFields[btn.dataset.stepTarget];
      field.set(Number(field.input.value) + Number(btn.dataset.step));
      persistState();
    });
  });

  toggle.addEventListener('click', () => {
    state.topBar.patternEditorOpen = !(state.topBar.patternEditorOpen !== false);
    applyPatternEditorOpen();
    persistState();
  });

  function cycleSlot(el, direction) {
    const pattern = state.topBar.pattern;
    const index = Number(el.dataset.index);
    const next = cyclePatternLevel(pattern.levels[index], direction);
    pattern.levels[index] = next;
    pattern.preset = 'custom';
    preset.value = 'custom';
    patternFocusIndex = index;
    applySlotStyle(el, next, pattern.division);
    persistState();
  }

  // Moves the single tabbable slot. Focusing inside the scroll box scrolls it,
  // which is wanted here — unlike the playhead, which deliberately never
  // scrolls, because this movement is the user's own and that one is not.
  function moveSlotFocus(index) {
    const target = grid.querySelector(`.pattern-slot[data-index="${index}"]`);
    if (!target) return;
    const current = grid.querySelector('.pattern-slot[tabindex="0"]');
    if (current) current.tabIndex = -1;
    target.tabIndex = 0;
    target.focus();
    patternFocusIndex = index;
  }

  // Two delegated listeners for every slot, however many there are.
  grid.addEventListener('click', (e) => {
    const el = e.target.closest('.pattern-slot');
    if (!el) return;
    cycleSlot(el, e.shiftKey ? -1 : 1);
  });

  grid.addEventListener('keydown', (e) => {
    const el = e.target.closest('.pattern-slot');
    if (!el) return;
    const pattern = state.topBar.pattern;
    const total = patternSlotCount(pattern.beats, pattern.division);
    const index = Number(el.dataset.index);
    const rowStart = Math.floor(index / pattern.division) * pattern.division;

    // Plain Enter/Space fires a click and cycles forward for free. Shift plus
    // either is the keyboard equivalent of shift-click; preventDefault here
    // also suppresses the click that Space would otherwise fire on keyup, so
    // the level moves one step, not two.
    if ((e.key === 'Enter' || e.key === ' ') && e.shiftKey) {
      e.preventDefault();
      cycleSlot(el, -1);
      return;
    }

    let next = null;
    if (e.key === 'ArrowRight') next = Math.min(total - 1, index + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, index - 1);
    else if (e.key === 'ArrowDown') next = Math.min(total - 1, index + pattern.division);
    else if (e.key === 'ArrowUp') next = Math.max(0, index - pattern.division);
    else if (e.key === 'Home') next = rowStart;
    else if (e.key === 'End') next = Math.min(total - 1, rowStart + pattern.division - 1);
    else return;

    e.preventDefault();
    moveSlotFocus(next);
  });
}

bindPatternEditor();
```

- [ ] **Step 3: Refresh the editor from state on load**

In `refreshAllInputsFromState`, immediately after the `volumeValue` line, add:

```js
  document.getElementById('patternPreset').value = state.topBar.pattern.preset;
  document.getElementById('patternBeats').value = state.topBar.pattern.beats;
  document.getElementById('patternDivision').value = state.topBar.pattern.division;
  applyPatternEditorOpen();
  renderPatternGrid();
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/*.test.js`
Expected: PASS.

- [ ] **Step 5: Verify in a browser**

1. Grid renders 4 rows of 1 slot, accent on beat 1.
2. Each preset sets the expected division and relevels the grid; the Custom option snaps back rather than changing anything.
3. Click a slot: it cycles muted, quiet, normal, accented; shift-click reverses; the preset label flips to Custom.
4. Type `7` into Division: septuplets, in time with the beat. Type `100`: clamps to 64 and flashes.
5. Change Beats from 4 to 6: the first four rows keep their levels, rows 5 and 6 arrive with a normal downbeat.
6. Hide and Show fold the grid **and the legend**; reload and the state is remembered.
7. Keyboard, with 8 beats and 4 division: Tab reaches the grid in **one** stop, arrows move within it in both axes, Home and End jump to the ends of a beat's row, Enter cycles a level forward, Shift plus Enter cycles it back by exactly one step, and the next Tab leaves the grid for the Start button rather than walking 32 slots.
8. Set 64 beats and 64 division. Confirm Tab still crosses the grid in one stop. Note whether the grid build stutters and how long it takes. If it is unusable, stop and report — the fallback is capping the rendered grid while leaving audio uncapped.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: wire the rhythm pattern editor controls and grid"
```

---

### Task 9: The playhead

**Files:**
- Modify: `index.html` — new playhead block after the `practiceRuntime` declaration, plus `scheduleBeat`, `startPlayback`, `stopPlayback`

**Interfaces:**
- Consumes: `findPlayheadEntry` (Task 5), `patternGeneration` (Task 8), `patternSlotIndex`, `isPlaying`, `ensureAudioContext`
- Produces: `pushPlayheadEntry(time, slotIndex)`, `clearPlayhead()`, `startPlayhead()`, `stopPlayhead()`

- [ ] **Step 1: Add the playhead machinery**

Insert immediately after the `let patternGeneration = 0;` declaration added in Task 8. Do not redeclare that variable here.

```js
// The playhead is the app's only per-SLOT visual feedback, and deliberately
// does not use the deferred-setTimeout pattern that per-beat feedback uses:
// at high divisions those callbacks queue rather than skip, and the highlight
// would drag behind the audio. This loop reads the audio clock each frame and
// renders only slots already in the past, so it can neither run early nor
// fall behind — it just shows fewer slots when there are more than frames.
const PLAYHEAD_RING_SIZE = 256;
let playheadRing = new Array(PLAYHEAD_RING_SIZE).fill(null);
let playheadWriteIndex = 0;
let playbackRunId = 0;
let playheadFrameId = null;
let playheadSlotIndex = -1;

function pushPlayheadEntry(time, slotIndex) {
  playheadRing[playheadWriteIndex] = {
    time: time,
    slotIndex: slotIndex,
    runId: playbackRunId,
    generation: patternGeneration,
  };
  playheadWriteIndex = (playheadWriteIndex + 1) % PLAYHEAD_RING_SIZE;
}

function clearPlayhead() {
  const grid = document.getElementById('patternGrid');
  const slot = grid.querySelector('.pattern-slot.playhead');
  if (slot) slot.classList.remove('playhead');
  const row = grid.querySelector('.pattern-row.playhead-row');
  if (row) row.classList.remove('playhead-row');
  playheadSlotIndex = -1;
}

function playheadFrame() {
  if (!isPlaying) return;
  const ctx = ensureAudioContext();
  const entry = findPlayheadEntry(playheadRing, ctx.currentTime, playbackRunId, patternGeneration);
  // A slotIndex of -1 is pushed for practice-break beats and means "no slot is
  // sounding"; clearPlayhead leaves playheadSlotIndex at -1, so it settles
  // after one frame rather than clearing repeatedly.
  if (entry && entry.slotIndex !== playheadSlotIndex) {
    clearPlayhead();
    const el = document.getElementById('patternGrid')
      .querySelector(`.pattern-slot[data-index="${entry.slotIndex}"]`);
    if (el) {
      el.classList.add('playhead');
      const row = el.closest('.pattern-row');
      if (row) row.classList.add('playhead-row');
      playheadSlotIndex = entry.slotIndex;
    }
  }
  playheadFrameId = requestAnimationFrame(playheadFrame);
}

function startPlayhead() {
  playbackRunId++;
  playheadRing.fill(null);
  playheadWriteIndex = 0;
  playheadSlotIndex = -1;
  playheadFrameId = requestAnimationFrame(playheadFrame);
}

function stopPlayhead() {
  if (playheadFrameId !== null) cancelAnimationFrame(playheadFrameId);
  playheadFrameId = null;
  clearPlayhead();
}
```

- [ ] **Step 2: Push an entry for every scheduled slot**

In `scheduleBeat`, inside the slot loop added in Task 7, add the push **before** the muted `continue` so the playhead travels through silence:

```js
  for (let s = 0; s < division; s++) {
    const level = isPracticeBreak
      ? (s === 0 ? LEVEL_NORMAL : LEVEL_MUTED)
      : patternLevelAt(pattern, beatIndex, s);
    if (s === 0) beatLevel = level;
    // -1 during a break: the pattern is not playing, so no slot should light.
    pushPlayheadEntry(
      time + slotInterval * s,
      isPracticeBreak ? -1 : patternSlotIndex(beatIndex, s, division)
    );
    if (level === LEVEL_MUTED) continue;
    scheduleClick(time + slotInterval * s, level);
  }
```

- [ ] **Step 3: Start and stop it with the transport**

In `startPlayback`, add `startPlayhead();` immediately after `beatIndexInBar = 0;`.

In `stopPlayback`, add `stopPlayhead();` immediately after `clearTimeout(schedulerTimerId);`.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/*.test.js`
Expected: PASS.

- [ ] **Step 5: Verify in a browser**

1. Play at 4 beats, division 4: the highlight tracks the audio, one slot per click, and the row outline follows.
2. Play at 7 beats, division 5, 200 BPM: the highlight stays in step, not visibly lagging.
3. Stop, then immediately start again: no highlight from the previous run appears, and nothing stays lit.
4. Change beats and division mid-playback: the grid re-renders and the highlight resumes on the new grid without lighting a wrong slot.
5. Practice mode: the highlight moves during phases and goes dark during breaks.
6. Collapse the editor and play: the hero dots, hero BPM and readouts all behave exactly as before, with no console errors from the hidden grid.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add animation-frame playhead for the pattern grid"
```

---

### Task 10: Remove the dead model and document the new one

**Files:**
- Modify: `index.html` — LOGIC block, `@layer components` beat-dot rules, four theme blocks
- Modify: `tests/logic.test.js` — delete tests for the removed functions
- Modify: `tests/themes.test.js` — add the pattern-slot layer assertion
- Modify: `CLAUDE.md`

- [ ] **Step 1: Delete the four retired LOGIC functions**

From the LOGIC block, delete `subdivisionCount`, `subdivisionIntervalSeconds`, `isAccentBeat` and `resizeAccentPattern` in full.

- [ ] **Step 2: Delete their tests**

From `tests/logic.test.js`, delete every test whose name begins with `subdivisionCount`, `subdivisionIntervalSeconds`, `isAccentBeat` or `resizeAccentPattern`. Find them with:

```bash
grep -n "subdivisionCount\|subdivisionIntervalSeconds\|isAccentBeat\|resizeAccentPattern" tests/logic.test.js
```

- [ ] **Step 3: Run the tests to confirm nothing else depended on them**

Run: `node --test tests/*.test.js`
Expected: PASS, with a smaller test count than before.

- [ ] **Step 4: Delete the now-unreachable beat-dot rules**

Beat dots are `<div>` elements with no accent state now, so every `button.beat-dot` and `.beat-dot.accented` rule is dead. Find all of them:

```bash
grep -n "\.accented\|button\.beat-dot" index.html
```

Delete each matching rule, in the components layer and in the `pulse-engine`, `kinetic-type`, `pulse-field` and `grid-console` theme blocks. Two comments above the `grid-console` rules explain why they restate `.beat-dot.accented`; delete those comments with the rules they describe. Leave `.beat-dot.pulse` and `.beat-dot.pulse.accent` alone — the pulse flash is still live, and `.accent` there is a different class from `.accented`.

- [ ] **Step 5: Add the layer assertion to the theme suite**

Append to `tests/themes.test.js`:

```js
test('every .pattern-slot rule lives inside a cascade layer', () => {
  // An unlayered rule outranks all layered ones regardless of specificity, so
  // a stray editor rule outside @layer would silently beat all five themes.
  let depth = 0;
  let insideLayer = false;
  for (let i = 0; i < STYLE.length; i++) {
    if (STYLE.startsWith('@layer', i) && STYLE.indexOf('{', i) !== -1) {
      const header = STYLE.slice(i, STYLE.indexOf('{', i));
      if (!header.includes(';')) insideLayer = true;
    }
    if (STYLE[i] === '{') depth++;
    else if (STYLE[i] === '}') {
      depth--;
      if (depth === 0) insideLayer = false;
    }
    if (STYLE.startsWith('.pattern-slot', i)) {
      assert.ok(insideLayer, `.pattern-slot rule at offset ${i} is outside every @layer block`);
    }
  }
});
```

- [ ] **Step 6: Run the tests**

Run: `node --test tests/*.test.js`
Expected: PASS.

- [ ] **Step 7: Update CLAUDE.md**

Four sections describe the model this plan replaced and are now wrong. Rewrite them:

1. **"State and persistence"** — replace the accent-pattern references with the shared `topBar.pattern` object, and add a sentence noting that the section-merge backward compatibility has one deliberate exception: `migrateLegacyPattern` rebuilds a pre-editor save's pattern from `topBar.subdivision` and the Metronome tab rather than letting the merge hand it a default.

2. **"The Web Audio lookahead scheduler and the capture-before-advance pattern"** — add a paragraph drawing the boundary between the two feedback mechanisms:

> Per-**beat** feedback (hero dots, hero BPM, ramp/practice readouts) uses the capture-before-advance deferred callback described above. Per-**slot** feedback is the pattern grid's playhead and only that: it uses a ring buffer of scheduled slot times plus one `requestAnimationFrame` loop, rejecting records whose `runId` or `patternGeneration` is stale. The two must not be mixed. Anything a beat-rate callback can serve belongs in the first mechanism; the ring buffer exists because timer callbacks queue rather than skip, and at high divisions that drags the highlight behind the audio.

3. **"The beat-dot row is mode- and state-dependent"** — this hazard is gone. Replace the whole section, heading included, with:

> ### The beat-dot row is a position indicator and nothing else
>
> `#beatIndicator` used to serve two purposes — a clickable accent-pattern
> editor on Metronome/Ramp, and a non-interactive phase-progress row during
> Practice playback — which meant every code path rendering into it had to
> know which mode it was in, and `bindTopBar`'s time-signature handler had to
> be fixed once for calling the wrong renderer. Accent editing now lives in
> the pattern editor, so the row has one job and one renderer,
> `renderDotRow(count)`: `<div>` dots, always `aria-hidden`, never clickable.
> Call it with `state.topBar.pattern.beats` for bar position, or with
> `practiceRuntime.beatsPerPhase` for phase progress. Its forced synchronous
> reflow is load-bearing and is commented in place — do not remove it.

4. **"Cascade layers and the theme system"** — add the pattern editor to the list of components, noting that its slots deliberately avoid the `.beat-dot` class so the locked transition contract does not apply, that its playhead never depends on `transitionend`, and that it adds no new entries to `REQUIRED_TOKENS`.

- [ ] **Step 8: Final verification**

Run: `node --test tests/*.test.js`
Expected: PASS.

Then in a browser, walk the full manual list from the spec's "Manual (human, in a real browser)" section, all fourteen items, across all five themes.

- [ ] **Step 9: Commit**

```bash
git add index.html tests/logic.test.js tests/themes.test.js CLAUDE.md
git commit -m "refactor: remove the retired subdivision and accent model"
```
