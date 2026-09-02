const fs = require('node:fs');
const path = require('node:path');

function loadLogic(names) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const match = html.match(/\/\/ LOGIC-BEGIN([\s\S]*?)\/\/ LOGIC-END/);
  if (!match) {
    throw new Error('LOGIC-BEGIN/LOGIC-END markers not found in index.html');
  }
  const source = match[1];
  const body = source + '\nreturn { ' + names.join(', ') + ' };';
  const factory = new Function(body);
  return factory();
}

module.exports = { loadLogic };
