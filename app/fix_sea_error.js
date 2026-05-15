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
    let content = fs.readFileSync(p, 'utf8');

    // Brutal replacement
    const newContent = content
        .split("'node:sea'")
        .join("'node_sea_ignore'")
        .split('"node:sea"')
        .join('"node_sea_ignore"');

    if (content !== newContent) {
        fs.writeFileSync(p, newContent);
        console.log('PATCH APPLIED: Replaced node:sea with node_sea_ignore');
    } else {
        console.log('NO CHANGE: node:sea was not found (already patched?)');
    }
} catch (e) {
    console.error(e);
}
