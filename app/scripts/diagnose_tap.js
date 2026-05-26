const fs = require('fs');
const path = require('path');
const p = 'node_modules/@expo/cli/build/src/start/server/metro/externals.js';

try {
    const content = fs.readFileSync(p, 'utf8');
    const idx = content.indexOf('async function tapNodeShims');
    if (idx > -1) {
        console.log('--- FUNCTION START ---');
        console.log(content.substring(idx, idx + 600));
        console.log('--- FUNCTION END ---');
    } else {
        console.log('Function tapNodeShims not found. Dumping first 500 chars:');
        console.log(content.substring(0, 500));
    }
} catch (e) {
    console.error(e);
}
