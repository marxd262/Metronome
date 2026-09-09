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
