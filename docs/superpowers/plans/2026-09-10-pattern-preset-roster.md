# Pattern Preset Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the rhythm pattern editor's preset roster from four
division shortcuts to fifteen rhythm templates that carry their own rests,
and label every dropdown option with the note glyph for its division.

**Architecture:** `PATTERN_PRESETS` gains a `slots` template describing one
beat, which `buildPresetLevels` repeats across the pattern. Because seven
presets now share division 4, the division-to-name lookup
(`presetForDivision`) is replaced by `presetForPattern`, which names a
pattern by comparing its actual level array against every preset's output.
Legacy save migration is decoupled from the roster onto its own frozen
lookup so preset names stay free to change. The `<select>` is rendered from
the roster instead of hand-written HTML.

**Tech Stack:** Plain HTML, CSS and JS in a single `index.html`. No build,
no bundler, no dependencies. Tests are `node:test` + `node:assert/strict`,
run with `node --test tests/*.test.js`, requiring Node 18+.

**Spec:** `docs/superpowers/specs/2026-09-10-pattern-preset-roster-design.md`

## Global Constraints

- **Never add a dependency, build step, framework, CDN script, or network
  call.** The app must keep opening by double-clicking `index.html`.
- **Every function added between `// LOGIC-BEGIN` and `// LOGIC-END` in
  `index.html` must be a pure function of its arguments.** No reads of
  `state`, the DOM, or module-level mutable variables. `tests/loadLogic.js`
  extracts that block by regex and evals it standalone under Node, so a
  DOM or `state` reference there breaks every test in the file.
- Constants declared in the LOGIC block (such as `PATTERN_PRESETS`) are
  readable from the app block, which runs later in the same page. The app
  block already relies on this for `LEVEL_ACCENT` and friends.
- Run tests with the glob form: `node --test tests/*.test.js`. The
  directory form does not reliably discover the file on every platform.
- Levels are `LEVEL_MUTED = 0`, `LEVEL_QUIET = 1`, `LEVEL_NORMAL = 2`,
  `LEVEL_ACCENT = 3`. Tests assert the numbers directly, because
  `loadLogic` returns only the names it is asked for.
- The pattern shape persisted to `localStorage` stays exactly
  `{ beats, division, preset, levels }`. `slots`, `glyph` and `label` live
  in the roster only and are never written to state.
- Do not touch `tests/themes.test.js`, any `@layer` block, or any CSS.
  This change adds no styles.

---

### Task 1: The preset roster carries a rhythm template

Replaces the four-entry `PATTERN_PRESETS` with the fifteen-entry roster and
makes `buildPresetLevels` read a preset's `slots` template instead of a bare
division. `presetForDivision` still exists after this task and still
compiles, because nothing about it changes yet; Task 2 removes it.

**Files:**
- Modify: `index.html:3244-3277` (the `PATTERN_PRESETS` block through
  `buildPresetLevels`)
- Modify: `index.html:4287` (the one `buildPresetLevels` call in the app
  block, inside `setPreset`)
- Test: `tests/logic.test.js:364-392` (replaces the existing
  `divisionForPreset` and `buildPresetLevels` tests)

**Interfaces:**
- Consumes: `defaultLevelForSlot(beat, slot)` and `LEVEL_MUTED`, both
  already in the LOGIC block and unchanged by this task.
- Produces:
  - `PATTERN_PRESETS` — array of
    `{ name: string, division: number, glyph: string, label: string, slots: number[] }`
  - `presetByName(name) -> entry | null`
  - `divisionForPreset(name) -> number | null` (unchanged contract)
  - `buildPresetLevels(beats, preset) -> number[]` — **signature change**,
    second argument is now a roster entry, not a division

- [ ] **Step 1: Write the failing tests**

In `tests/logic.test.js`, delete these three existing tests outright:
`'divisionForPreset maps the four preset names to divisions'`,
`'presetForDivision round-trips the four presets and calls the rest custom'`,
and `'buildPresetLevels accents only the first slot of the first beat'`.
Also delete `'buildPresetLevels produces exactly beats times division entries'`.
They span lines 364 through 392. Replace all four with:

```js
test('every preset carries one template entry per slot of its division', () => {
  const { PATTERN_PRESETS } = loadLogic(['PATTERN_PRESETS']);
  assert.equal(PATTERN_PRESETS.length, 15);
  const names = new Set();
  for (const entry of PATTERN_PRESETS) {
    assert.equal(entry.slots.length, entry.division, entry.name);
    assert.ok(entry.slots.every((s) => s === 0 || s === 1), entry.name);
    assert.ok(entry.slots.includes(1), entry.name + ' is entirely silent');
    assert.notEqual(entry.name, 'custom');
    assert.equal(names.has(entry.name), false, 'duplicate name ' + entry.name);
    names.add(entry.name);
    assert.ok(entry.glyph.length > 0, entry.name);
    assert.ok(entry.label.length > 0, entry.name);
  }
});

test('divisionForPreset maps roster names to divisions and rejects the rest', () => {
  const { divisionForPreset } = loadLogic(['divisionForPreset']);
  assert.equal(divisionForPreset('quarter'), 1);
  assert.equal(divisionForPreset('offbeat-eighths'), 2);
  assert.equal(divisionForPreset('triplet-middle'), 3);
  assert.equal(divisionForPreset('gallop'), 4);
  assert.equal(divisionForPreset('custom'), null);
  assert.equal(divisionForPreset('none'), null);
  assert.equal(divisionForPreset('nonsense'), null);
});

test('buildPresetLevels mutes resting slots and accents only the first beat', () => {
  const { buildPresetLevels, presetByName } = loadLogic(['buildPresetLevels', 'presetByName']);
  assert.deepEqual(buildPresetLevels(4, presetByName('quarter')), [3, 2, 2, 2]);
  assert.deepEqual(buildPresetLevels(2, presetByName('triplets')), [3, 1, 1, 2, 1, 1]);
  assert.deepEqual(buildPresetLevels(2, presetByName('offbeat-eighths')), [0, 1, 0, 1]);
  assert.deepEqual(buildPresetLevels(2, presetByName('gallop')), [3, 1, 1, 0, 2, 1, 1, 0]);
});

test('buildPresetLevels sizes the array and places at most one accent', () => {
  const { buildPresetLevels, PATTERN_PRESETS } = loadLogic(['buildPresetLevels', 'PATTERN_PRESETS']);
  for (const entry of PATTERN_PRESETS) {
    const levels = buildPresetLevels(7, entry);
    assert.equal(levels.length, 7 * entry.division, entry.name);
    const accents = levels.filter((l) => l === 3).length;
    assert.equal(accents, entry.slots[0] ? 1 : 0, entry.name);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/*.test.js`

Expected: FAIL. `presetByName` is not defined, so `loadLogic` throws
`ReferenceError: presetByName is not defined` in the two tests that request
it; `PATTERN_PRESETS.length` is 4, not 15; `divisionForPreset('quarter')` is
`null`.

- [ ] **Step 3: Replace the roster and the two functions**

In `index.html`, replace the comment and `const PATTERN_PRESETS` array
currently at lines 3244-3251 with:

```js
// Each preset describes the rhythm of ONE beat and is repeated across every
// beat: `slots` has `division` entries, 1 for a slot that sounds and 0 for
// one that rests. `glyph` is the note value the division represents and
// prefixes the option text in the preset <select>. Four presets rest on
// their own first slot; those bars carry no accent anywhere, which is the
// point of practising them — see the design spec.
const PATTERN_PRESETS = [
  { name: 'quarter',                    division: 1, glyph: '♩',       label: 'Quarter',              slots: [1] },
  { name: 'eighths',                    division: 2, glyph: '♫',       label: 'Eighths',              slots: [1, 1] },
  { name: 'offbeat-eighths',            division: 2, glyph: '♫',       label: 'Offbeat eighths',      slots: [0, 1] },
  { name: 'triplets',                   division: 3, glyph: '♪³', label: 'Triplet',              slots: [1, 1, 1] },
  { name: 'triplet-first-two',          division: 3, glyph: '♪³', label: 'Triplet, first two',   slots: [1, 1, 0] },
  { name: 'triplet-outer',              division: 3, glyph: '♪³', label: 'Triplet, outer two',   slots: [1, 0, 1] },
  { name: 'triplet-last-two',           division: 3, glyph: '♪³', label: 'Triplet, last two',    slots: [0, 1, 1] },
  { name: 'triplet-middle',             division: 3, glyph: '♪³', label: 'Triplet, middle only', slots: [0, 1, 0] },
  { name: 'sixteenths',                 division: 4, glyph: '♬',       label: 'Sixteenths',           slots: [1, 1, 1, 1] },
  { name: 'offbeat-sixteenths',         division: 4, glyph: '♬',       label: 'Sixteenth offbeats',   slots: [0, 1, 0, 1] },
  { name: 'gallop',                     division: 4, glyph: '♬',       label: 'Gallop',               slots: [1, 1, 1, 0] },
  { name: 'reverse-gallop',             division: 4, glyph: '♬',       label: 'Reverse gallop',       slots: [1, 0, 1, 1] },
  { name: 'sixteenth-eighth-sixteenth', division: 4, glyph: '♬',       label: '16th-8th-16th',        slots: [1, 1, 0, 1] },
  { name: 'dotted-eighth-sixteenth',    division: 4, glyph: '♬',       label: 'Dotted eighth + 16th', slots: [1, 0, 0, 1] },
  { name: 'sixteenth-dotted-eighth',    division: 4, glyph: '♬',       label: '16th + dotted eighth', slots: [1, 1, 0, 0] },
];

function presetByName(name) {
  return PATTERN_PRESETS.find((entry) => entry.name === name) || null;
}
```

Then replace the body of `divisionForPreset` (lines 3253-3256) with:

```js
function divisionForPreset(preset) {
  const found = presetByName(preset);
  return found ? found.division : null;
}
```

Leave `presetForDivision` exactly as it is; Task 2 deletes it.

Then replace `buildPresetLevels` (lines 3268-3276) with:

```js
// Division comes from the template's own length, so a roster entry cannot
// disagree with itself about how many slots a beat has.
function buildPresetLevels(beats, preset) {
  const slots = preset && Array.isArray(preset.slots) ? preset.slots : [1];
  const levels = [];
  for (let beat = 0; beat < beats; beat++) {
    for (let slot = 0; slot < slots.length; slot++) {
      levels.push(slots[slot] ? defaultLevelForSlot(beat, slot) : LEVEL_MUTED);
    }
  }
  return levels;
}
```

- [ ] **Step 4: Fix the one app-block caller**

In `index.html`, inside `bindPatternEditor`'s `setPreset` (around line
4278), the call `buildPresetLevels(pattern.beats, target)` passes a
division. Change `setPreset` to resolve the roster entry once:

```js
  function setPreset(name) {
    const entry = presetByName(name);
    if (entry === null) {
      // "Custom" is a label the app applies, never a choice that changes the
      // grid; snap the control back to whatever the pattern actually is.
      preset.value = state.topBar.pattern.preset;
      return;
    }
    const pattern = state.topBar.pattern;
    pattern.division = entry.division;
    pattern.preset = entry.name;
    pattern.levels = buildPresetLevels(pattern.beats, entry);
    division.value = entry.division;
    afterPatternResize();
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/*.test.js`

Expected: PASS, all tests in both files.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/logic.test.js
git commit -m "feat: give every pattern preset a per-beat rhythm template"
```

---

### Task 2: Name a pattern by its levels, not its division

Seven presets now share division 4, so `presetForDivision` can no longer
identify one. This task replaces it with `presetForPattern`, teaches
`normalizePattern` to reject a saved preset name that is no longer in the
roster, and updates the three app-block paths that set the preset label.

**Files:**
- Modify: `index.html:3258-3261` (delete `presetForDivision`, add
  `presetForPattern` after `buildPresetLevels`)
- Modify: `index.html:3305-3316` (`normalizePattern`)
- Modify: `index.html:3481` (`DEFAULT_STATE`'s `preset: 'none'`)
- Modify: `index.html:4251-4275` (`setBeats` and `setDivision` in
  `bindPatternEditor`)
- Test: `tests/logic.test.js` (fixture at line 432, plus new tests after
  the Task 1 block)

**Interfaces:**
- Consumes: `PATTERN_PRESETS`, `presetByName`, `buildPresetLevels(beats, preset)`
  from Task 1.
- Produces: `presetForPattern(pattern) -> string` — returns a roster `name`
  or the literal `'custom'`. Reads `beats`, `division` and `levels` off its
  argument; tolerates `null` and a missing `levels`.
- Removes: `presetForDivision`. After this task no code may reference it.

- [ ] **Step 1: Update the shared test fixture**

`migrateLegacyPattern`'s null-input fallback is
`normalizePattern(defaults.topBar.pattern)`, and after this task
`normalizePattern` rewrites the unknown name `'none'` to `'quarter'`. The
existing deep-equality assertions against the fixture would fail on the
preset field alone. In `tests/logic.test.js` at line 432, change:

```js
const PATTERN_DEFAULTS = {
  topBar: { pattern: { beats: 4, division: 1, preset: 'quarter', levels: [3, 2, 2, 2] } },
};
```

- [ ] **Step 2: Write the failing tests**

Delete the existing test `'normalizePattern fills a preset name when one is
missing'` (lines 453-456). Add these five tests immediately after it:

```js
test('presetForPattern names the output of every preset template', () => {
  const { presetForPattern, buildPresetLevels, PATTERN_PRESETS } =
    loadLogic(['presetForPattern', 'buildPresetLevels', 'PATTERN_PRESETS']);
  for (const entry of PATTERN_PRESETS) {
    for (const beats of [1, 4, 7]) {
      const pattern = {
        beats: beats,
        division: entry.division,
        levels: buildPresetLevels(beats, entry),
      };
      assert.equal(presetForPattern(pattern), entry.name, entry.name + ' at ' + beats + ' beats');
    }
  }
});

test('presetForPattern calls anything it cannot match custom', () => {
  const { presetForPattern } = loadLogic(['presetForPattern']);
  //  division 5 is outside the roster entirely
  assert.equal(presetForPattern({ beats: 4, division: 5, levels: new Array(20).fill(2) }), 'custom');
  //  division 2 is in the roster, but neither eighths nor offbeat eighths
  //  looks like this
  assert.equal(presetForPattern({ beats: 2, division: 2, levels: [3, 1, 2, 0] }), 'custom');
  assert.equal(presetForPattern({ beats: 2, division: 2, levels: [] }), 'custom');
  assert.equal(presetForPattern(null), 'custom');
});

test('normalizePattern fills a preset name when one is missing', () => {
  const { normalizePattern } = loadLogic(['normalizePattern']);
  assert.equal(normalizePattern({ beats: 4, division: 3, levels: [] }).preset, 'triplets');
  assert.equal(normalizePattern({ beats: 4, division: 7, levels: [] }).preset, 'custom');
});

test('normalizePattern rewrites a saved preset name that left the roster', () => {
  const { normalizePattern } = loadLogic(['normalizePattern']);
  //  'none' is what every pre-roster save carries; it is now called 'quarter'
  assert.equal(normalizePattern({ beats: 4, division: 1, preset: 'none', levels: [3, 2, 2, 2] }).preset, 'quarter');
  assert.equal(normalizePattern({ beats: 2, division: 2, preset: 'garbage', levels: [3, 1, 2, 1] }).preset, 'eighths');
  assert.equal(normalizePattern({ beats: 2, division: 2, preset: 'garbage', levels: [3, 1, 2, 0] }).preset, 'custom');
});

test('normalizePattern keeps a preset name that is still in the roster', () => {
  const { normalizePattern } = loadLogic(['normalizePattern']);
  assert.equal(normalizePattern({ beats: 3, division: 2, preset: 'eighths', levels: [3, 0, 2, 1, 2, 1] }).preset, 'eighths');
  assert.equal(normalizePattern({ beats: 2, division: 2, preset: 'custom', levels: [3, 1, 2, 1] }).preset, 'custom');
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test tests/*.test.js`

Expected: FAIL. `loadLogic(['presetForPattern', ...])` throws
`ReferenceError: presetForPattern is not defined`, and
`normalizePattern({ preset: 'none', ... }).preset` is still `'none'`.

- [ ] **Step 4: Replace presetForDivision with presetForPattern**

In `index.html`, delete `presetForDivision` entirely (lines 3258-3261).
In its place, put `presetForPattern` — it must sit **after**
`buildPresetLevels` in the file, so move it below that function if the
deletion leaves it above:

```js
// Names a pattern by what its levels actually are rather than by its
// division: seven presets share division 4, and changing the division
// preserves the old levels instead of rebuilding them, so only a full
// comparison can say whether the grid still matches the preset it came
// from. Called on user input and on load, never from the scheduler or the
// playhead frame loop, so building up to fifteen candidates is not on a
// timing path.
function presetForPattern(pattern) {
  const source = pattern && typeof pattern === 'object' ? pattern : {};
  const levels = Array.isArray(source.levels) ? source.levels : [];
  for (let i = 0; i < PATTERN_PRESETS.length; i++) {
    const preset = PATTERN_PRESETS[i];
    if (preset.division !== source.division) continue;
    const candidate = buildPresetLevels(source.beats, preset);
    if (candidate.length !== levels.length) continue;
    let same = true;
    for (let j = 0; j < candidate.length; j++) {
      if (candidate[j] !== levels[j]) { same = false; break; }
    }
    if (same) return preset.name;
  }
  return 'custom';
}
```

- [ ] **Step 5: Teach normalizePattern to validate the saved name**

In `normalizePattern`, replace this line:

```js
  const preset = typeof source.preset === 'string' ? source.preset : presetForDivision(division);
```

with:

```js
  // A saved name from an older roster ('none', in particular) would reach
  // select.value and match no <option>, leaving the dropdown blank. Anything
  // not in today's roster is re-derived from the levels instead.
  const saved = source.preset;
  const known = saved === 'custom' || presetByName(saved) !== null;
  const preset = known
    ? saved
    : presetForPattern({ beats: beats, division: division, levels: levels });
```

- [ ] **Step 6: Repair the one caller the deletion broke**

Run: `node --test tests/*.test.js`

Expected at this point: FAIL, but only inside `migrateLegacyPattern`. That function still
calls `presetForDivision(division)` on its last line, which no longer
exists, so every `migrateLegacyPattern` test throws
`ReferenceError: presetForDivision is not defined`. Task 3 fixes it. To
keep this task's commit green, apply the one-line stopgap now — replace the
closing `return` of `migrateLegacyPattern` (line 3340) with:

```js
  const migrated = { beats: beats, division: division, preset: 'custom', levels: levels };
  migrated.preset = presetForPattern(migrated);
  return migrated;
```

Then update the legacy roster expectation in the existing test
`'migrateLegacyPattern maps each legacy subdivision name to a division'`.
Replace its body with:

```js
  const { migrateLegacyPattern } = loadLogic(['migrateLegacyPattern']);
  const cases = { none: 1, eighths: 2, triplets: 3, sixteenths: 4 };
  const expected = { none: 'quarter', eighths: 'eighths', triplets: 'triplets', sixteenths: 'sixteenths' };
  for (const [name, division] of Object.entries(cases)) {
    const saved = {
      topBar: { subdivision: name },
      metronome: { timeSigNum: 4, accentPattern: [true, false, false, false] },
    };
    const result = migrateLegacyPattern(saved, PATTERN_DEFAULTS);
    assert.equal(result.division, division);
    assert.equal(result.preset, expected[name]);
    assert.equal(result.levels.length, 4 * division);
  }
```

Re-run: `node --test tests/*.test.js`

Expected: PASS, all tests in both files.

- [ ] **Step 7: Update the three app-block paths that set the label**

Changing the division or the beat count both preserve the old levels through
`resizePatternLevels`, so neither can assume the result still matches a
preset. In `bindPatternEditor`, replace `setBeats` and `setDivision` with:

```js
  function setBeats(value) {
    const pattern = state.topBar.pattern;
    const clamped = clampPatternBeats(value);
    if (wasValueClamped(value, clamped, 0)) flashClamped(beats);
    pattern.levels = resizePatternLevels(
      pattern.levels, pattern.beats, pattern.division, clamped, pattern.division
    );
    pattern.beats = clamped;
    pattern.preset = presetForPattern(pattern);
    beats.value = clamped;
    preset.value = pattern.preset;
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
    pattern.preset = presetForPattern(pattern);
    division.value = clamped;
    preset.value = pattern.preset;
    afterPatternResize();
  }
```

Then in `DEFAULT_STATE` (line 3481), change `preset: 'none'` to
`preset: 'quarter'`.

- [ ] **Step 8: Confirm presetForDivision is gone**

Run: `grep -n "presetForDivision" index.html tests/*.js`

Expected: no output. If anything matches, replace that call with
`presetForPattern` before committing.

- [ ] **Step 9: Run the full suite**

Run: `node --test tests/*.test.js`

Expected: PASS, all tests in both files.

- [ ] **Step 10: Commit**

```bash
git add index.html tests/logic.test.js
git commit -m "refactor: name a pattern by its levels instead of its division"
```

---

### Task 3: Decouple legacy migration from the preset roster

`migrateLegacyPattern` reads a pre-editor save's `topBar.subdivision` by
calling `divisionForPreset`, which only worked while the retired
Subdivision `<select>`'s four values happened to equal the preset names.
Task 1 renamed one of them. This task gives migration its own lookup so the
roster can be renamed freely from now on.

**Files:**
- Modify: `index.html:3318-3341` (`migrateLegacyPattern` and a new constant
  above it)
- Test: `tests/logic.test.js` (two new tests after the existing
  `migrateLegacyPattern` tests, plus one added assertion)

**Interfaces:**
- Consumes: `presetForPattern` from Task 2, `clampPatternBeats`,
  `LEVEL_QUIET`, `LEVEL_NORMAL`, `LEVEL_ACCENT`.
- Produces: `LEGACY_SUBDIVISION_DIVISIONS` — a frozen object literal mapping
  the four retired subdivision strings to divisions. Nothing else reads it.

- [ ] **Step 1: Write the failing tests**

In `tests/logic.test.js`, add these two tests immediately after
`'migrateLegacyPattern falls back when the metronome section is missing'`:

```js
test('migrateLegacyPattern reads legacy names through its own map, not the roster', () => {
  const { migrateLegacyPattern } = loadLogic(['migrateLegacyPattern']);
  //  'quarter' is a preset name but was never a Subdivision <select> value,
  //  so migration must not resolve it — it falls back to division 1.
  const saved = {
    topBar: { subdivision: 'quarter' },
    metronome: { timeSigNum: 4, accentPattern: [true, false, false, false] },
  };
  assert.equal(migrateLegacyPattern(saved, PATTERN_DEFAULTS).division, 1);
  //  'gallop' likewise: a roster name, never a legacy value.
  const other = {
    topBar: { subdivision: 'gallop' },
    metronome: { timeSigNum: 4, accentPattern: [true, false, false, false] },
  };
  assert.equal(migrateLegacyPattern(other, PATTERN_DEFAULTS).division, 1);
});

test('LEGACY_SUBDIVISION_DIVISIONS holds exactly the four retired values', () => {
  const { LEGACY_SUBDIVISION_DIVISIONS } = loadLogic(['LEGACY_SUBDIVISION_DIVISIONS']);
  assert.deepEqual(LEGACY_SUBDIVISION_DIVISIONS, { none: 1, eighths: 2, triplets: 3, sixteenths: 4 });
  assert.equal(Object.isFrozen(LEGACY_SUBDIVISION_DIVISIONS), true);
});
```

Then add one assertion to the existing test `'migrateLegacyPattern carries
the metronome beats and accents across'`, after its `assert.deepEqual` of
`result.levels`:

```js
  //  beat 3 is accented too, which no eighths template produces
  assert.equal(result.preset, 'custom');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/*.test.js`

Expected: FAIL. `loadLogic(['LEGACY_SUBDIVISION_DIVISIONS'])` throws
`ReferenceError: LEGACY_SUBDIVISION_DIVISIONS is not defined`. The
roster-name test still passes at this point, because Task 2 already made
`divisionForPreset('quarter')` return 1 — which is the right answer for the
wrong reason, and the `'gallop'` case would return 4 and fail.

- [ ] **Step 3: Add the map and use it**

In `index.html`, immediately above `migrateLegacyPattern`'s comment block
(line 3318), add:

```js
// The four values the retired Subdivision <select> could hold. That control
// no longer exists, so this map must never gain entries. It is deliberately
// separate from PATTERN_PRESETS: migration used to read the roster, which
// meant renaming a preset silently downgraded an old save's division.
const LEGACY_SUBDIVISION_DIVISIONS = Object.freeze({
  none: 1, eighths: 2, triplets: 3, sixteenths: 4,
});
```

Then inside `migrateLegacyPattern`, replace:

```js
  const division = divisionForPreset(topBar.subdivision) || 1;
```

with:

```js
  const division = LEGACY_SUBDIVISION_DIVISIONS[topBar.subdivision] || 1;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/*.test.js`

Expected: PASS, all tests in both files.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/logic.test.js
git commit -m "fix: read legacy subdivision names through their own map"
```

---

### Task 4: Render the preset dropdown from the roster

The `<select>` still lists the four hand-written options from before Task 1,
so eleven presets are unreachable and three of the four listed values no
longer resolve. This task builds the options from `PATTERN_PRESETS` at
startup, each prefixed with its note glyph.

There is no unit test for this task: it is DOM wiring in the app block,
which this project verifies manually in a browser by design. The manual
checklist in Step 4 is the verification.

**Files:**
- Modify: `index.html:2960-2967` (the `<select id="patternPreset">` markup)
- Modify: `index.html:4225-4232` (the top of `bindPatternEditor`)

**Interfaces:**
- Consumes: `PATTERN_PRESETS` from Task 1.
- Produces: nothing other tasks read.

- [ ] **Step 1: Empty the hand-written option list**

In `index.html`, replace the whole `<select id="patternPreset">` element
(lines 2961-2967, including its five `<option>` children) with a single
self-explaining empty element:

```html
        <!-- Options are built from PATTERN_PRESETS in bindPatternEditor;
             fifteen entries duplicated here would drift from the roster. -->
        <select id="patternPreset"></select>
```

- [ ] **Step 2: Build the options in bindPatternEditor**

In `bindPatternEditor`, immediately after the `const toggle = ...` line
(around line 4230) and before the `afterPatternResize` definition, insert:

```js
  // Runs at bind time, which is before refreshAllInputsFromState assigns
  // select.value from saved state — a <select> silently ignores a value
  // matching no option, and would render blank. Non-breaking spaces because
  // an <option>'s ordinary whitespace collapses.
  PATTERN_PRESETS.forEach((entry) => {
    const option = document.createElement('option');
    option.value = entry.name;
    option.textContent = entry.glyph + '\u00A0\u00A0' + entry.label;
    preset.appendChild(option);
  });
  const customOption = document.createElement('option');
  customOption.value = 'custom';
  customOption.textContent = 'Custom';
  preset.appendChild(customOption);
```

- [ ] **Step 3: Run the test suite**

Run: `node --test tests/*.test.js`

Expected: PASS, all tests in both files. Nothing in this task is testable
under Node, but the suite must stay green — `tests/themes.test.js` parses
`index.html` statically and would catch a malformed edit.

- [ ] **Step 4: Verify manually in a browser**

Open `index.html` directly in a browser. In DevTools, run
`localStorage.clear()` and reload, then check each of these:

1. The Preset dropdown lists sixteen options. The first fifteen each show a
   note glyph, then a gap, then a name; Custom is last and has no glyph.
2. Selecting **Offbeat eighths** sets Division to 2 and leaves every
   beat's first slot muted, with no accent anywhere in the grid.
3. Selecting **Gallop** sets Division to 4 and mutes the fourth slot of
   every beat, with the accent on beat 1 slot 1.
4. Selecting **Triplet, outer two** sets Division to 3 and mutes the middle
   slot of every beat.
5. Pressing Start plays each of those and the muted slots are silent.
6. Clicking any slot flips the dropdown to Custom. Clicking it back to its
   previous level flips the dropdown back to the preset's name.
7. With Sixteenths selected, raising Beats from 4 to 5 leaves the
   dropdown reading Sixteenths: every slot in its template sounds, so the
   resize fill matches `buildPresetLevels(5, sixteenths)` exactly. Doing
   the same with Gallop selected instead flips the dropdown to Custom:
   Gallop rests its fourth slot, but the resize fill leaves the new
   beat's off-slots quiet rather than muted, so the grid no longer
   matches the template.
8. Typing 3 into Division while on Quarter names the pattern Triplet, not
   Custom — Quarter's carried-over downbeats resize into exactly
   `buildPresetLevels(4, triplets)`.
9. Reload the page. The dropdown comes back showing whatever it showed
   before, not a blank box.
10. Run
    `localStorage.setItem('metronomeSettings', JSON.stringify({ topBar: { pattern: { beats: 4, division: 1, preset: 'none', levels: [3,2,2,2] } } }))`
    and reload. The dropdown shows **♩ Quarter**, not a blank box. Confirm
    the exact `localStorage` key first with `Object.keys(localStorage)`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: build the preset dropdown from the roster with note glyphs"
```

---

### Task 5: Update the architecture notes

`CLAUDE.md` describes the preset model as division-only and names
`presetForDivision` among the LOGIC functions. Both are now wrong, and this
file is what a future session reads first.

**Files:**
- Modify: `CLAUDE.md` (the LOGIC block description under "Two `<script>`
  blocks", and the "State and persistence" paragraph on `migrateLegacyPattern`)

**Interfaces:** none.

- [ ] **Step 1: Correct the LOGIC block inventory**

In `CLAUDE.md` at line 39, replace this text:

```
   indexing, level cycling, preset and level building, pattern resize,
```

with:

```
   indexing, level cycling, preset templates and level building, pattern
   resize,
```

Then add this paragraph directly after the LOGIC block's numbered item
(after the sentence ending "with tests added to `tests/logic.test.js`.**"):

```
   A preset is not a division shortcut: each entry in `PATTERN_PRESETS`
   carries a `slots` template describing which slots of one beat sound and
   which rest, and `buildPresetLevels(beats, preset)` repeats that template
   across every beat, mapping a resting slot to `LEVEL_MUTED` and a
   sounding one through `defaultLevelForSlot`. Four presets rest on their
   own first slot and so produce a bar with no accent anywhere; that is
   deliberate. Because seven presets share division 4, a division no longer
   identifies a preset — `presetForPattern` names a pattern by comparing
   its actual level array against every preset's output and answers
   `custom` when none matches. There is no `presetForDivision`.
```

- [ ] **Step 2: Correct the migration paragraph**

In `CLAUDE.md` at line 75, replace this text:

```
DEFAULT_STATE)`, which rebuilds the pattern from the old
`topBar.subdivision` plus the Metronome tab's `timeSigNum` and
```

with:

```
DEFAULT_STATE)`, which rebuilds the pattern from the old
`topBar.subdivision` — resolved through `LEGACY_SUBDIVISION_DIVISIONS`, a
frozen map of the four values that retired `<select>` could hold, kept
separate from `PATTERN_PRESETS` so that renaming a preset cannot silently
downgrade an old save's division — plus the Metronome tab's `timeSigNum`
and
```

Then append this sentence to the end of that same paragraph, after
"don't add a second migration unless a field genuinely cannot survive one.":

```
`normalizePattern` does one narrow repair of its own: a saved `preset` name
that is no longer in the roster (`none`, from before the roster grew) is
discarded and re-derived from the levels, because a stale name reaching
`select.value` matches no `<option>` and renders the dropdown blank.
```

- [ ] **Step 3: Verify nothing else in CLAUDE.md is now stale**

Run: `grep -n "presetForDivision\|subdivision\|preset" CLAUDE.md`

Expected: every remaining mention still describes current behaviour. The
"retired subdivision and accent model" references are historical and stay.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update the architecture notes for the preset roster"
```

---

## Done When

- `node --test tests/*.test.js` passes with no failures.
- `grep -n "presetForDivision" index.html tests/*.js CLAUDE.md` returns nothing.
- All ten manual browser checks in Task 4 Step 4 pass.
- `index.html` still opens by double-click with no server, no build, and no
  network request.
