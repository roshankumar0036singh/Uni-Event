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
    const index = content.indexOf('NODE_STDLIB_MODULES =');
    if (index !== -1) {
        console.log('--- FOUND ASSIGNMENT ---');
        console.log(content.substring(index, index + 500));
    } else {
        console.log('Assignment not found. Searching for usages...');
        const index2 = content.indexOf('NODE_STDLIB_MODULES');
        console.log(content.substring(index2, index2 + 500));
    }
} catch (e) {
    console.error(e);
}
