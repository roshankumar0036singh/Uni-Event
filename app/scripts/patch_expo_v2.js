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
console.log('Target:', filePath);

try {
    let content = fs.readFileSync(filePath, 'utf8');
    console.log('File size:', content.length);

    // Look for node:sea in generic string form
    // It is likely in an array like: NODE_STDLIB_MODULES = [ ..., "node:sea", ... ]

    // We want to remove "node:sea", or 'node:sea', (with comma)
    // or just "node:sea" (last element)

    let newContent = content;
    let replaced = false;

    // Pattern 1: comma after
    if (newContent.includes("'node:sea',")) {
        newContent = newContent.replace(/'node:sea',/g, '');
        replaced = true;
        console.log("Removed 'node:sea',");
    }
    if (newContent.includes('"node:sea",')) {
        newContent = newContent.replace(/"node:sea",/g, '');
        replaced = true;
        console.log('Removed "node:sea",');
    }

    // Pattern 2: just the string (maybe last in array or different spacing)
    if (!replaced) {
        // Use regex to be safe
        const regex = /['"]node:sea['"]\s*,?/g;
        if (regex.test(newContent)) {
            newContent = newContent.replace(regex, '');
            replaced = true;
            console.log('Removed node:sea via regex match.');
        }
    }

    if (replaced) {
        fs.writeFileSync(filePath, newContent);
        console.log('SUCCESS: Patch applied and file saved.');
    } else {
        console.log('WARNING: node:sea string NOT found in file.');
        // print context of NODE_STDLIB_MODULES if possible
        const idx = content.indexOf('NODE_STDLIB_MODULES');
        if (idx !== -1) {
            console.log('Snippet around NODE_STDLIB_MODULES:', content.substring(idx, idx + 300));
        }
    }
} catch (e) {
    console.error('Error patching file:', e);
}
