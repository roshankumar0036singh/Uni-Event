const fs = require('fs');
const path = require('path');

const isGenPath = path.join('node_modules', 'is-generator-function', 'index.js');

try {
    let isGenContent = fs.readFileSync(isGenPath, 'utf8');
    console.log('Original is-generator-function content read.');

    // We want to replace `var generatorFunction = require('generator-function');`
    // with the inlined logic.

    const replacement =
        "var generatorFunction = (function(){ try { return Function('return function*() {}')().constructor; } catch(e) { return function(){}; } })();";

    let newContent = isGenContent;

    // Try single quotes
    if (newContent.includes("require('generator-function')")) {
        newContent = newContent.replace("require('generator-function')", replacement);
    }
    // Try double quotes
    else if (newContent.includes('require("generator-function")')) {
        newContent = newContent.replace('require("generator-function")', replacement);
    }

    // Verify replacement
    if (newContent !== isGenContent) {
        fs.writeFileSync(isGenPath, newContent);
        console.log(
            'SUCCESS: Inlined generator-function logic into is-generator-function/index.js',
        );
    } else {
        console.log('WARNING: Could not find require("generator-function") to replace.');
        // print content snippet for debugging if it fails
        console.log('Snippet:', isGenContent.substring(0, 100));
    }
} catch (e) {
    console.error('Error patching:', e);
}
