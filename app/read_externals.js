const fs = require('fs');
const path = require('path');
const filePath = path.join(
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
console.log(fs.readFileSync(filePath, 'utf8'));
