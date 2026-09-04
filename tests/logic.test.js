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
