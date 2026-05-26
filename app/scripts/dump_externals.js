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
try {
    const content = fs.readFileSync(filePath, 'utf8');
    fs.writeFileSync('debug_externals.txt', content);
    console.log('Dumped content to debug_externals.txt');
} catch (e) {
    console.error(e);
}
