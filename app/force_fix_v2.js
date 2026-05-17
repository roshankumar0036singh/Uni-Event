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
    console.log('Original Length:', content.length);

    // The error comes from `await fs.promises.mkdir(...)` inside a loop over NODE_STDLIB_MODULES
    // We want to skip 'node:sea'

    // Pattern 1: Look for the loop and inject a continue
    // for (const moduleName of NODE_STDLIB_MODULES) {
    //    if (moduleName === 'node:sea') continue; // Inject this

    if (content.includes('for (const moduleName of NODE_STDLIB_MODULES) {')) {
        content = content.replace(
            'for (const moduleName of NODE_STDLIB_MODULES) {',
            'for (const moduleName of NODE_STDLIB_MODULES) { if (moduleName.includes(":")) continue;',
        );
        console.log('Patched loop directly.');
    }
    // Compiled JS might use `for(const e of t)` etc.
    // Let's rely on finding where `mkdir` is called with the module path.
    // It usually looks like `path.join(..., moduleName)` or similar inside that loop.

    // Alternative: Redefine the array itself again (in case previous patches missed)
    else if (content.includes('exports.NODE_STDLIB_MODULES=[')) {
        content = content.replace(
            /exports\.NODE_STDLIB_MODULES=\[(.*?)\]/s,
            (match, p1) => `exports.NODE_STDLIB_MODULES=[${p1}].filter(n => !n.includes(":"))`,
        );
        console.log('Patched exports.NODE_STDLIB_MODULES array.');
    } else {
        // Last resort: String replace the literal if present
        const count = (content.match(/'node:sea'/g) || []).length;
        if (count > 0) {
            content = content.replace(/'node:sea',/g, '').replace(/'node:sea'/g, '');
            console.log(`Removed ${count} occurrences of node:sea literal`);
        } else {
            console.log('Could not find known patterns. Dumping snippet for analysis:');
            const tapIndex = content.indexOf('tapNodeShims');
            if (tapIndex > -1) {
                console.log(content.substring(tapIndex, tapIndex + 300));
            }
        }
    }

    fs.writeFileSync(filePath, content);
    console.log('File written.');
} catch (e) {
    console.error('Error:', e);
}
