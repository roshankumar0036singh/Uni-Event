const fs = require('fs');
const path = require('path');
try {
    const pkg = fs.readFileSync('node_modules/is-generator-function/package.json', 'utf8');
    console.log('--- PACKAGE.JSON ---');
    console.log(pkg);

    const idx = fs.readFileSync('node_modules/is-generator-function/index.js', 'utf8');
    console.log('--- INDEX.JS ---');
    console.log(idx);
} catch (e) {
    console.error(e);
}
