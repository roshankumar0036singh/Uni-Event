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
    if (!fs.existsSync(p)) {
        console.log('FILE NOT FOUND:', p);
        process.exit(1);
    }
    const content = fs.readFileSync(p, 'utf8');
    console.log(`File Size: ${content.length}`);
    console.log(`Has 'node:sea': ${content.includes("'node:sea'")}`);
    console.log(`Has "node:sea": ${content.includes('"node:sea"')}`);
    console.log(`Has 'node_sea_disabled': ${content.includes("'node_sea_disabled'")}`);

    // Print a snippet around any found occurrence
    const idx = content.indexOf("'node:sea'");
    if (idx > -1) {
        console.log('Snippet:', content.substring(idx - 20, idx + 20));
    }
} catch (e) {
    console.error(e);
}
