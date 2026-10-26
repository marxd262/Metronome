const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// CSS analysis runs against the stylesheet with comments stripped, so a comment
// mentioning a selector can never be mistaken for the selector itself.
const STYLE = HTML
  .slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'))
  .replace(/\/\*[\s\S]*?\*\//g, '');

const REQUIRED_TOKENS = [
  '--bg', '--panel', '--overlay', '--divider',
  '--text', '--text-muted', '--text-dim',
  '--accent', '--accent-beat', '--on-accent', '--accent-glow',
  '--dot-idle', '--dot-pulse-bg', '--dot-accent-bg',
  '--dot-strike', '--dot-decay', '--dot-ease',
  '--content-max-width',
  '--radius', '--radius-panel',
  '--font-ui', '--font-mono', '--font-display',
];

// Returns the contents of the balanced { ... } block starting at or after `from`.
function blockAt(source, from) {
  const open = source.indexOf('{', from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  return null;
}

// Finds only the token block — `:root[data-theme="x"] {` — never a descendant
// rule like `:root[data-theme="x"] .hero-frame {`, which appears earlier in the
// file and would otherwise be measured instead, failing every token assertion.
// Uses a literal needle plus a literal regex: regexes built from strings need
// doubled backslashes and fail silently when they lose one.
function themeBlock(theme) {
  const needle = `:root[data-theme="${theme}"]`;
  let i = 0;
  while ((i = STYLE.indexOf(needle, i)) !== -1) {
    if (/^\s*\{/.test(STYLE.slice(i + needle.length))) {
      return blockAt(STYLE, i + needle.length);
    }
    i += needle.length;
  }
  return null;
}

// Exact property match, so `--text` never matches `--text-muted`. No regex, and
// it tolerates a final declaration with no trailing semicolon.
function declaredValue(block, token) {
  for (const declaration of block.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    if (declaration.slice(0, colon).trim() === token) {
      return declaration.slice(colon + 1).trim();
    }
  }
  return null;
}

// Every rule whose *selector* contains `substring`.
function rulesWithSelector(substring) {
  const found = [];
  let i = 0;
  while ((i = STYLE.indexOf(substring, i)) !== -1) {
    let start = i;
    while (start > 0 && !'{};'.includes(STYLE[start - 1])) start--;
    const brace = STYLE.indexOf('{', i);
    if (brace === -1) break;
    const selector = STYLE.slice(start, brace).trim();
    if (selector.includes(substring)) {
      found.push({ selector, body: blockAt(STYLE, brace) || '' });
    }
    i += substring.length;
  }
  return found;
}

// The roster comes from the JS THEMES array, which is what populates the select
// at runtime — the <select> is empty in the source file.
function rosterValues() {
  const arr = HTML.match(/const THEMES = \[([\s\S]*?)\];/);
  if (!arr) return [];
  return [...arr[1].matchAll(/value:\s*'([^']+)'/g)].map((m) => m[1]);
}

function definedThemes() {
  return [...STYLE.matchAll(/:root\[data-theme="([^"]+)"\]\s*\{/g)].map((m) => m[1]);
}

test('the theme roster is non-empty', () => {
  assert.ok(rosterValues().length > 0, 'THEMES array has no entries');
});

test('every theme in the roster has a token block', () => {
  for (const theme of rosterValues()) {
    assert.ok(themeBlock(theme), `no :root[data-theme="${theme}"] block for "${theme}"`);
  }
});

test('every defined theme block is in the roster', () => {
  const roster = rosterValues();
  for (const theme of new Set(definedThemes())) {
    assert.ok(roster.includes(theme), `theme "${theme}" is styled but not selectable`);
  }
});

test('every theme defines the full required token set', () => {
  for (const theme of rosterValues()) {
    const block = themeBlock(theme);
    for (const token of REQUIRED_TOKENS) {
      assert.ok(declaredValue(block, token), `theme "${theme}" is missing ${token}`);
    }
  }
});

test('every theme pulses to a different colour than its idle dot', () => {
  for (const theme of rosterValues()) {
    const block = themeBlock(theme);
    const idle = declaredValue(block, '--dot-idle');
    const pulse = declaredValue(block, '--dot-pulse-bg');
    assert.notEqual(pulse, idle,
      `theme "${theme}": --dot-pulse-bg equals --dot-idle, so adding .pulse would not ` +
      'change a transitioned property and transitionend would never fire');
  }
});

test('no theme overrides the locked .beat-dot transition', () => {
  for (const rule of rulesWithSelector('.beat-dot')) {
    if (!rule.selector.includes('[data-theme')) continue;
    assert.ok(!/(?:^|[;{\s])transition(?:-(?:duration|property|delay|timing-function))?\s*:/.test(rule.body),
      `"${rule.selector}" declares transition on .beat-dot; the components layer owns it`);
  }
});

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

// Returns the name of the cascade layer containing each byte offset in STYLE,
// or null where an offset sits outside every @layer block. Layer order is what
// decides these contests, and it is invisible to a rule-local read.
function layerNameAt(offsets) {
  const order = [];
  const result = new Map();
  let depth = 0;
  const stack = [];
  for (let i = 0; i < STYLE.length; i++) {
    if (STYLE.startsWith('@layer', i)) {
      const brace = STYLE.indexOf('{', i);
      const semi = STYLE.indexOf(';', i);
      if (brace !== -1 && (semi === -1 || brace < semi)) {
        stack.push({ name: STYLE.slice(i + 6, brace).trim(), depth: depth });
      } else if (semi !== -1) {
        // The `@layer a, b, c;` statement — this is what fixes the order.
        STYLE.slice(i + 6, semi).split(',').forEach((n) => order.push(n.trim()));
      }
    }
    if (STYLE[i] === '{') depth++;
    else if (STYLE[i] === '}') {
      depth--;
      if (stack.length && depth === stack[stack.length - 1].depth) stack.pop();
    }
    if (offsets.includes(i)) result.set(i, stack.length ? stack[stack.length - 1].name : null);
  }
  return { order: order, layerOf: result };
}

function offsetsOf(pattern) {
  return [...STYLE.matchAll(pattern)].map((m) => m.index);
}

test('no outline suppression outranks the shared focus-visible ring', () => {
  // `outline: none` and the focus ring both declare `outline`, so when a
  // control is focused BOTH rules match and layer order decides — before
  // specificity, not after it. Parking the ring in an earlier layer than the
  // suppression silently removes the keyboard focus indicator, which is how
  // the range slider ended up with none at all. Same layer is required: there
  // the ring's :focus-visible makes it the more specific rule and it wins.
  const ringOffsets = offsetsOf(/outline:\s*2px\s+solid/g);
  const noneOffsets = offsetsOf(/outline:\s*none/g);
  assert.ok(ringOffsets.length > 0, 'no focus-visible outline ring found at all');

  const { order, layerOf } = layerNameAt([...ringOffsets, ...noneOffsets].sort((a, b) => a - b));
  assert.ok(order.length > 0, 'no @layer order statement found');

  const ringLayer = layerOf.get(ringOffsets[0]);
  assert.ok(order.includes(ringLayer), `focus ring sits in unlayered or unknown layer "${ringLayer}"`);

  for (const offset of noneOffsets) {
    const suppressionLayer = layerOf.get(offset);
    assert.ok(order.includes(suppressionLayer),
      `an "outline: none" at offset ${offset} sits outside every layer`);
    assert.ok(order.indexOf(suppressionLayer) <= order.indexOf(ringLayer),
      `"outline: none" in @layer ${suppressionLayer} outranks the focus ring in @layer ${ringLayer}`);
  }

  // The stronger guarantee, and the reason the layer check above can never fire
  // for rules written this way: every suppression has to be scoped to focus that
  // is not keyboard focus. A selector ending in :focus:not(:focus-visible)
  // cannot match an element the ring matches, so the two never compete. A bare
  // `outline: none` on a control (what the range slider once had) is what
  // removes keyboard focus indicators.
  for (const offset of noneOffsets) {
    const open = STYLE.lastIndexOf('{', offset);
    const selectorStart = Math.max(STYLE.lastIndexOf('}', open), STYLE.lastIndexOf(';', open), STYLE.lastIndexOf('{', open - 1)) + 1;
    const selector = STYLE.slice(selectorStart, open).trim();
    assert.ok(selector.includes(':not(:focus-visible)'),
      `"outline: none" in "${selector.slice(0, 80)}" is not scoped to :focus:not(:focus-visible); it would hide the keyboard focus ring`);
  }
});

test('every control that suppresses its outline still declares a focus ring', () => {
  const ring = rulesWithSelector(':focus-visible').map((r) => r.selector).join(' ');
  for (const control of ['input[type="number"]', 'select', 'input[type="range"]', 'button']) {
    assert.ok(ring.includes(control + ':focus-visible'),
      `${control} has no :focus-visible ring; keyboard focus would be invisible`);
  }
});

test('a theme that lets .stepper-row wrap restates no-wrap for the two fixed steppers', () => {
  // The pattern header and the count-in field both need their "+" beside the
  // input. Their no-wrap rule lives in components, and a themes-layer
  // .stepper-row outranks it whatever its specificity, so any theme that sets
  // flex-wrap there has to say nowrap again for these two itself.
  const themed = [...STYLE.matchAll(/:root\[data-theme="([\w-]+)"\]\s+\.stepper-row\s*\{([^}]*)\}/g)]
    .filter((m) => /flex-wrap\s*:\s*wrap/.test(m[2]))
    .map((m) => m[1]);
  assert.ok(themed.length > 0, 'expected at least one theme to wrap .stepper-row (Grid Console does)');
  for (const theme of themed) {
    const restated = new RegExp(
      String.raw`:root\[data-theme="${theme}"\]\s+:is\(#patternHeader,\s*\.countin-field\)\s+\.stepper-row\s*\{[^}]*flex-wrap\s*:\s*nowrap`
    );
    assert.ok(restated.test(STYLE), `${theme} wraps .stepper-row but does not restate nowrap for the pattern header and count-in`);
  }
});

test('the joined stepper block comes after every theme rule it overrides and restates the states it erases', () => {
  // One block gives every theme the same joined control, which only works if it
  // is the last word: a themes-layer rule outranks components whatever its
  // specificity, so a per-theme .step-btn / input / .stepper-row rule added
  // AFTER it would quietly take its look back. And its `border: 0` erases the
  // focus, clamp-flash and open-toggle states those themes restate for
  // themselves, so the block has to say them again, once, for all of them.
  const joinedAt = STYLE.indexOf(':root[data-theme] .stepper-row {');
  assert.ok(joinedAt !== -1, 'the joined stepper block is missing');

  const themed = /:root\[data-theme="[\w-]+"\][^{}]*(\.step-btn|\.tapTempo|\.quick-select-toggle|\.stepper-row|input\[type="number"\])[^{}]*\{/g;
  const late = [...STYLE.matchAll(themed)].filter((m) => m.index > joinedAt).map((m) => m[0].trim().slice(0, 90));
  assert.deepEqual(late, [], 'per-theme stepper rules sit after the joined block and would override it');

  const block = STYLE.slice(joinedAt);
  assert.ok(/\.stepper-row:has\(input\.clamped\)/.test(block), 'the clamp flash is not restated on the box');
  assert.ok(/\.stepper-row:focus-within/.test(block), 'focus is not restated on the box');
  assert.ok(/\.quick-select-toggle\[aria-expanded="true"\]/.test(block), 'the open quick-select toggle is not restated');
  assert.ok(/outline-offset\s*:\s*-2px/.test(block), 'the focus ring is not pulled inside the clipping box');
  assert.ok(!/outline\s*:/.test(block), 'the joined block must not declare outline; the shared ring does that');
});

// WCAG relative luminance and contrast ratio for a #rrggbb value.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('every theme keeps --text-dim readable and still a tier below --text-muted', () => {
  // --text-dim carries real information (beat numbers, the slot hint, inactive
  // practice phases, inactive tabs, field labels), so it has to clear the AA
  // floor for small text on the surfaces it sits on. It also has to stay
  // visibly quieter than --text-muted, or the three-tier hierarchy collapses:
  // raising dim toward muted without raising muted too is how that happens.
  // The gap is a ratio of contrast ratios, so it is theme-independent.
  const HEX = /^#[0-9a-fA-F]{6}$/;
  for (const theme of rosterValues()) {
    const block = themeBlock(theme);
    const token = (name) => declaredValue(block, name);
    const [dim, muted, panel, bg] = ['--text-dim', '--text-muted', '--panel', '--bg'].map(token);
    for (const [name, value] of [['--text-dim', dim], ['--text-muted', muted], ['--panel', panel], ['--bg', bg]]) {
      assert.ok(HEX.test(value || ''), `${theme}: ${name} must be a #rrggbb value for this check (got ${value})`);
    }
    assert.ok(contrast(dim, panel) >= 4.5, `${theme}: --text-dim is ${contrast(dim, panel).toFixed(2)}:1 on --panel, under 4.5:1`);
    assert.ok(contrast(dim, bg) >= 4.5, `${theme}: --text-dim is ${contrast(dim, bg).toFixed(2)}:1 on --bg, under 4.5:1`);
    const gap = contrast(muted, panel) / contrast(dim, panel);
    assert.ok(gap >= 1.3, `${theme}: --text-muted is only ${gap.toFixed(2)}x the contrast of --text-dim on --panel; the tiers blur`);
  }
});

test('nothing decorative can push the page sideways on a phone', () => {
  // There is no browser under plain Node, so this guards the two causes found
  // by measurement rather than the symptom. An absolutely positioned box counts
  // as scrollable overflow however transparent it is, so Classic's hero glow
  // (a ::before that used to run a fixed 3.5rem past the numeral each side)
  // made every phone-width page scroll sideways by a constant 36px; and the
  // masthead's title and theme select are a no-wrap row that cannot fit at 320px.
  const glow = rulesWithSelector(':root[data-theme="classic"] #heroBpm::before');
  assert.ok(glow.length >= 2, 'expected the glow rule and its two-column override');
  for (const { body } of glow) {
    const inset = (body.match(/inset\s*:\s*([^;]+);/) || [])[1] || '';
    assert.ok(/max\(/.test(inset), `the glow's horizontal bleed must be capped by the room that exists, got "inset: ${inset}"`);
  }
  assert.ok(!/inset\s*:\s*-2\.5rem\s+-3\.5rem/.test(STYLE), 'a fixed 3.5rem bleed is back on the hero glow');

  const masthead = rulesWithSelector('#masthead').find((r) => r.selector === '#masthead');
  assert.ok(masthead, 'the base #masthead rule is missing');
  assert.ok(/flex-wrap\s*:\s*wrap/.test(masthead.body), '#masthead must wrap so the theme select cannot be pushed off a 320px screen');
});
