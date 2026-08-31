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

test('isAccentBeat is true only for beat index 0', () => {
  const { isAccentBeat } = loadLogic(['isAccentBeat']);
  assert.equal(isAccentBeat(0), true);
  assert.equal(isAccentBeat(1), false);
  assert.equal(isAccentBeat(3), false);
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
