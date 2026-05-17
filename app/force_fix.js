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

    // 1. Remove "node:sea" string literal if present
    let newContent = content.replace(/'node:sea',/g, '').replace(/"node:sea",/g, '');

    // 2. Aggressively filter the array if defined
    // Look for: exports.NODE_STDLIB_MODULES = [...]
    // We'll replace the closing bracket ] with ].filter(x => !x.includes(':'))

    if (newContent.includes('exports.NODE_STDLIB_MODULES = [')) {
        newContent = newContent.replace(
            /exports\.NODE_STDLIB_MODULES\s*=\s*\[([\s\S]*?)\]/,
            match => match + ".filter(x => !x.includes(':'))",
        );
        console.log('Patched exports.NODE_STDLIB_MODULES definition.');
    }
    // Maybe it's defined as const NODE_STDLIB_MODULES =
    else if (newContent.includes('const NODE_STDLIB_MODULES = [')) {
        newContent = newContent.replace(
            /const NODE_STDLIB_MODULES\s*=\s*\[([\s\S]*?)\]/,
            match => match + ".filter(x => !x.includes(':'))",
        );
        console.log('Patched const NODE_STDLIB_MODULES definition.');
    } else {
        // 3. Fallback: Inject the filter at the top of the file if we can't find definitions
        // This might not work if it's strict mode or frozen.
        console.log(
            'Could not find array definition. Injecting filter into tapNodeShims loop if possible.',
        );

        // Look for the loop: for (const moduleName of NODE_STDLIB_MODULES)
        newContent = newContent.replace(
            /for\s*\(\s*const\s+moduleName\s+of\s+NODE_STDLIB_MODULES\s*\)/,
            'for (const moduleName of NODE_STDLIB_MODULES.filter(x => !x.includes(":")))',
        );
    }

    fs.writeFileSync(filePath, newContent);
    console.log('File written. New Length:', newContent.length);
} catch (e) {
    console.error('Error:', e);
}
