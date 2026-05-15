const fs = require('fs');
const path = require('path');

const filePath = 'node_modules/@expo/cli/build/src/start/server/metro/externals.js';

try {
    if (!fs.existsSync(filePath)) {
        console.log('externals.js not found, skipping');
        process.exit(0);
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Simple and safe: just replace the string literal 'node:sea' with something harmless
    let changed = false;

    if (content.includes("'node:sea'")) {
        content = content.replace(/'node:sea'/g, "'_node_sea_disabled'");
        changed = true;
    }

    if (content.includes('"node:sea"')) {
        content = content.replace(/"node:sea"/g, '"_node_sea_disabled"');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(filePath, content);
        console.log('Patched node:sea successfully!');
    } else {
        console.log('No node:sea found or already patched.');
    }
} catch (e) {
    console.error('Patch error:', e.message);
}
