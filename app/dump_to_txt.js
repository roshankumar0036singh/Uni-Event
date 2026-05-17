const fs = require('fs');
const path = require('path');
const file = path.join(
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
    const content = fs.readFileSync(file, 'utf8');
    fs.writeFileSync('safe_dump.txt', content);
    console.log('Dumped externals.js to safe_dump.txt');
} catch (e) {
    console.error(e);
}
