const fs = require('fs');
const path = require('path');
const src = path.join(
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
const dest = 'externals_copy.js';
try {
    fs.copyFileSync(src, dest);
    console.log('Copied to ' + dest);
} catch (e) {
    console.error(e);
}
