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
    const lines = content.split('\n');
    console.log('--- EXTERNALS.JS CONTENT START ---');
    // Print lines around 64 where error is reported
    for (let i = 50; i < 80; i++) {
        if (lines[i] !== undefined) console.log(`${i + 1}: ${lines[i]}`);
    }
    console.log('--- EXTERNALS.JS CONTENT END ---');

    // Also search for NODE_STDLIB_MODULES definition
    console.log('--- DEFINITIONS ---');
    const match = content.match(/NODE_STDLIB_MODULES\s*=\s*\[(.*?)\]/s);
    if (match) {
        console.log('Found NODE_STDLIB_MODULES array (truncated):', match[1].substring(0, 100));
    } else {
        console.log('NODE_STDLIB_MODULES definition NOT found via simple regex.');
    }
} catch (e) {
    console.error('Error reading file:', e);
}
