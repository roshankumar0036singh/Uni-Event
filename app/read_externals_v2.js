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
console.log('Reading:', p);
try {
    const data = fs.readFileSync(p, 'utf8');
    console.log('---START---');
    console.log(data);
    console.log('---END---');
} catch (e) {
    console.error(e);
}
