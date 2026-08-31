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
