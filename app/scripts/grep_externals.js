const fs = require('fs');
const path = require('path');
const p = 'node_modules/@expo/cli/build/src/start/server/metro/externals.js';

try {
    const content = fs.readFileSync(p, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        if (line.includes('node:sea') || line.includes('mkdir')) {
            console.log(`${index + 1}: ${line.trim()}`);
        }
    });
} catch (e) {
    console.error(e);
}
