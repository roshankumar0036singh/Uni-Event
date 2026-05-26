const fs = require('fs');
const path = require('path');
const p = path.join(
    'node_modules',
    '@expo',
    'cli',
    'build',
    'src',
    'start',
    'server',
    'metro',
    'externals.js',
);
try {
    const content = fs.readFileSync(p, 'utf8');
    const lines = content.split('\n');
    console.log('--- CRITICAL LINES ---');
    lines.slice(55, 75).forEach((l, i) => console.log(`${55 + i + 1}: ${l}`));
} catch (e) {
    console.error(e);
}
