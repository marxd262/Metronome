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
