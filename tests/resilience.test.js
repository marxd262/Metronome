const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Static analysis of index.html, like tests/themes.test.js, but for the app
// block rather than the stylesheet. The app block has no unit tests by design —
// there is no DOM or Web Audio under plain Node — so the invariants worth
// guarding there are the ones whose failure kills the page on load, where a
// manual browser check would only catch them in the one configuration that
// breaks. Comments and string literals are stripped so neither can be mistaken
// for code.
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const SCRIPT = HTML
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');

// Contents of the balanced { ... } block of the named function declaration.
function functionBody(name) {
  const at = SCRIPT.indexOf(`function ${name}(`);
  if (at === -1) return null;
  const open = SCRIPT.indexOf('{', at);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < SCRIPT.length; i++) {
    if (SCRIPT[i] === '{') depth++;
    else if (SCRIPT[i] === '}') {
      depth--;
      if (depth === 0) return SCRIPT.slice(open + 1, i);
    }
  }
  return null;
}

const STORAGE_ACCESSORS = ['readSavedSettings', 'writeSavedSettings'];

test('the two storage accessors exist and each guards its access', () => {
  for (const name of STORAGE_ACCESSORS) {
    const body = functionBody(name);
    assert.ok(body !== null, `${name} is missing`);
    assert.ok(body.includes('localStorage.'), `${name} does not touch localStorage`);
    assert.ok(/try\s*\{/.test(body), `${name} does not wrap its access in try`);
    assert.ok(/catch\s*\(/.test(body), `${name} has no catch clause`);
  }
});

test('Space and the tempo keys share one focus guard', () => {
  // Every global shortcut has to stand aside for the same three contexts: a
  // focused field, an open quick-select listbox, and the pattern grid, which
  // owns BOTH Space and the arrows for its own slots. A second copy of that
  // logic is how the two keys drift apart and one of them starts stealing a
  // keystroke the grid needs.
  const guard = functionBody('globalShortcutAllowed');
  assert.ok(guard !== null, 'globalShortcutAllowed is missing');
  assert.ok(guard.includes('openQuickSelectPopup'),
    'the guard does not stand aside for an open quick-select popup');
  assert.equal([...SCRIPT.matchAll(/closest\('#patternEditor'\)/g)].length, 1,
    'the pattern-editor exemption is spelled out in more than one place');
});

test('every mode registers a main tempo field for the Up and Down keys', () => {
  for (const tab of ['metronome', 'ramp', 'practice']) {
    assert.ok(new RegExp(`mainBpmField\\.${tab}\\s*=`).test(SCRIPT),
      `${tab} does not register a main tempo field, so Up/Down would do nothing there`);
  }
});

test('audio start is guarded and failure never reports itself as playing', () => {
  // Constructing an AudioContext throws in a locked-down or embedded context,
  // and resume() rejects where a gesture policy refuses the tab. The second is
  // the nastier one: it happens AFTER the transport has flipped to "Stop", so
  // without a rejection handler the button, the dots and the readouts all claim
  // the metronome is running while nothing is audible — the surface lying about
  // the one thing it exists to do.
  const ensure = functionBody('ensureAudioContext');
  assert.ok(ensure !== null, 'ensureAudioContext is missing');
  assert.ok(/try\s*\{/.test(ensure) && /catch\s*\(/.test(ensure),
    'ensureAudioContext does not guard the constructor');

  const start = functionBody('startPlayback');
  assert.ok(start !== null, 'startPlayback is missing');
  assert.ok(/if\s*\(\s*!\s*ctx\s*\)/.test(start),
    'startPlayback does not bail when there is no audio context');
  assert.ok(/\.catch\s*\(/.test(start),
    'startPlayback does not handle a rejected resume()');
});

test('no localStorage access escapes those two accessors', () => {
  // A bare read at top level is the dangerous one: it throws outright where
  // site data is blocked, and because it runs during initial evaluation the
  // exception aborts the rest of the script — every binding after it is
  // skipped, so the page renders unwired rather than merely forgetting its
  // settings. A bare write throws on quota in private browsing.
  const total = [...SCRIPT.matchAll(/localStorage\./g)].length;
  const guarded = STORAGE_ACCESSORS
    .map((name) => [...(functionBody(name) || '').matchAll(/localStorage\./g)].length)
    .reduce((sum, n) => sum + n, 0);
  assert.equal(total, guarded,
    `${total - guarded} localStorage access(es) sit outside ${STORAGE_ACCESSORS.join(' and ')}`);
});

test('a count-in beat advances nothing and is gated against a stale run', () => {
  // The count-in is meant to leave the run exactly as it would have been
  // without one. Advancing the bar position, ramp or practice phase here would
  // shift where the real run begins; and a callback that skips the run-id
  // check can paint a countdown over a run the player has since restarted.
  const body = functionBody('scheduleCountInBeat');
  assert.ok(body !== null, 'scheduleCountInBeat is missing');
  assert.ok(!body.includes('advanceModeAfterBeat'), 'a count-in beat must not advance the mode');
  assert.ok(!body.includes('beatIndexInBar'), 'a count-in beat must not move the bar position');
  assert.ok(body.includes('runId !== playbackRunId'), 'the deferred callback does not check its run id');
});

test('the hero readout refuses tempo writes while the countdown owns it', () => {
  const body = functionBody('updateHeroBpm');
  assert.ok(body !== null, 'updateHeroBpm is missing');
  assert.ok(/isPlaying\s*&&\s*countInDisplayActive/.test(body),
    'updateHeroBpm can overwrite the count-in countdown');
});

test('stopping a run restores the hero a count-in took over', () => {
  const body = functionBody('stopPlayback');
  assert.ok(body !== null, 'stopPlayback is missing');
  assert.ok(body.includes('countInDisplayActive = false'), 'stopPlayback does not clear the count-in display');
  assert.ok(body.includes('HERO_LABEL_BPM'), 'stopPlayback does not restore the hero label');
});
