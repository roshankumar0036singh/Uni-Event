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
console.log('Patching:', filePath);

try {
    let content = fs.readFileSync(filePath, 'utf8');
    const sizeBefore = content.length;
    console.log('File size:', sizeBefore);

    // Replace 'node:sea' or "node:sea" with nothing
    let newContent = content.replace(/'node:sea',/g, '').replace(/"node:sea",/g, '');
    // Also catch last item case without comma if any (unlikely for sea but good safety)
    newContent = newContent.replace(/'node:sea'/g, '').replace(/"node:sea"/g, '');

    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent);
        console.log('Patch applied successfully! Removed node:sea.');
    } else {
        console.log('node:sea not found in file. checking for alternate format...');
        // Debug: print part of file
        const match = content.match(/NODE_STDLIB_MODULES\s*=\s*\[(.*?)\]/s);
        if (match) {
            console.log('Found NODE_STDLIB_MODULES content length:', match[1].length);
            if (match[1].includes('sea')) {
                console.log('Found sea in modules list!');
            }
        }
    }
} catch (e) {
    console.error('Error patching:', e);
}
