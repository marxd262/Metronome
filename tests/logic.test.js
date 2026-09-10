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

test('beatIntervalSeconds converts bpm to seconds per beat', () => {
  const { beatIntervalSeconds } = loadLogic(['beatIntervalSeconds']);
  assert.equal(beatIntervalSeconds(60), 1);
  assert.equal(beatIntervalSeconds(120), 0.5);
});

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

test('computeNextRampBpm forces at least a 1 BPM move when the step rounds to zero', () => {
  const { computeNextRampBpm } = loadLogic(['computeNextRampBpm']);
  // 2% of 20 BPM is 0.4, which rounds back down to 20 and would stall forever.
  assert.equal(computeNextRampBpm(20, 'up', 'percent', 2, 400), 21);
});

test('barsToBeats multiplies bars by the time signature numerator', () => {
  const { barsToBeats } = loadLogic(['barsToBeats']);
  assert.equal(barsToBeats(4, 4), 16);
  assert.equal(barsToBeats(2, 7), 14);
});

test('computeSlowBpm applies the delta percent below base', () => {
  const { computeSlowBpm } = loadLogic(['computeSlowBpm']);
  assert.equal(computeSlowBpm(120, 50), 60);
  assert.equal(computeSlowBpm(120, 25), 90);
});

test('computeSlowBpm clamps to the 20-400 BPM range instead of flooring at 1', () => {
  const { computeSlowBpm } = loadLogic(['computeSlowBpm']);
  // 20 * (1 - 0.9) = 2, which is below the app's documented 20-400 BPM range.
  assert.equal(computeSlowBpm(20, 90), 20);
});

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

test('bpmForPhase returns base for fast and slow bpm for slow/break', () => {
  const { bpmForPhase } = loadLogic(['bpmForPhase']);
  assert.equal(bpmForPhase('fast', 120, 60), 120);
  assert.equal(bpmForPhase('slow', 120, 60), 60);
  assert.equal(bpmForPhase('break', 120, 60), 60);
});

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

test('wasValueClamped is false when the rounded raw value matches the clamped result', () => {
  const { wasValueClamped } = loadLogic(['wasValueClamped']);
  assert.equal(wasValueClamped(120, 120, 0), false);
  assert.equal(wasValueClamped(120.4, 120, 0), false); // plain rounding, not a boundary clamp
});

test('wasValueClamped is true when the raw value was out of range', () => {
  const { wasValueClamped } = loadLogic(['wasValueClamped']);
  assert.equal(wasValueClamped(999, 400, 0), true);
  assert.equal(wasValueClamped(5, 20, 0), true);
});

test('wasValueClamped is true for non-numeric input regardless of the fallback', () => {
  const { wasValueClamped } = loadLogic(['wasValueClamped']);
  assert.equal(wasValueClamped('abc', 120, 0), true);
});

test('wasValueClamped respects the decimals argument', () => {
  const { wasValueClamped } = loadLogic(['wasValueClamped']);
  assert.equal(wasValueClamped(2.3, 2.3, 1), false);
  assert.equal(wasValueClamped(-1, 0.1, 1), true);
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

test('patternVerticalNeighbor jumps one wrapped line and keeps the slot column', () => {
  const { patternVerticalNeighbor } = loadLogic(['patternVerticalNeighbor']);
  // beats=4, division=4, two beat blocks per visual line:
  //   1 [0..3]   2 [4..7]
  //   3 [8..11]  4 [12..15]
  assert.equal(patternVerticalNeighbor(0, 4, 4, 2, 1), 8);
  assert.equal(patternVerticalNeighbor(6, 4, 4, 2, 1), 14);
  assert.equal(patternVerticalNeighbor(14, 4, 4, 2, -1), 6);
  assert.equal(patternVerticalNeighbor(11, 4, 4, 2, -1), 3);
});

test('patternVerticalNeighbor stays put when the target line does not exist', () => {
  const { patternVerticalNeighbor } = loadLogic(['patternVerticalNeighbor']);
  assert.equal(patternVerticalNeighbor(0, 4, 4, 2, -1), 0);
  assert.equal(patternVerticalNeighbor(13, 4, 4, 2, 1), 13);
  // beats=5, beatsPerLine=2 leaves a partial last line holding only beat 5.
  // Beat 3 has a neighbour below it; beat 4 does not.
  assert.equal(patternVerticalNeighbor(9, 4, 5, 2, 1), 17);
  assert.equal(patternVerticalNeighbor(13, 4, 5, 2, 1), 13);
});

test('patternVerticalNeighbor degenerates to one beat when a line holds one block', () => {
  const { patternVerticalNeighbor } = loadLogic(['patternVerticalNeighbor']);
  assert.equal(patternVerticalNeighbor(2, 4, 4, 1, 1), 6);
  assert.equal(patternVerticalNeighbor(6, 4, 4, 1, -1), 2);
});

test('patternVerticalNeighbor treats a junk line count as a single block', () => {
  const { patternVerticalNeighbor } = loadLogic(['patternVerticalNeighbor']);
  assert.equal(patternVerticalNeighbor(2, 4, 4, 0, 1), 6);
  assert.equal(patternVerticalNeighbor(2, 4, 4, NaN, 1), 6);
});
