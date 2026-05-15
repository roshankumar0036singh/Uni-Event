const fs = require('fs');
const path = require('path');
const file = 'node_modules/@expo/cli/build/src/start/server/metro/externals.js';

try {
    console.log('--- DEBUG START ---');
    if (!fs.existsSync(file)) {
        console.log('ERROR: File not found at ' + file);
        process.exit(1);
    }

    const content = fs.readFileSync(file, 'utf8');
    console.log('Current Size:', content.length);
    const seaIndex = content.indexOf('node:sea');
    console.log('Index of "node:sea":', seaIndex);

    if (seaIndex > -1) {
        console.log('Snippet around node:sea:', content.substring(seaIndex - 20, seaIndex + 20));

        const newContent = content.replace(/['"]node:sea['"]/g, '"node_sea_skipped"');
        fs.writeFileSync(file, newContent);
        console.log('Replaced node:sea literal.');
    } else {
        console.log('Literal "node:sea" not found.');

        // Check for mkdir
        const mkdirIndex = content.indexOf('fs.promises.mkdir');
        console.log('Index of mkdir:', mkdirIndex);
        if (mkdirIndex > -1) {
            console.log(
                'Snippet around mkdir:',
                content.substring(mkdirIndex - 50, mkdirIndex + 100),
            );
        }
    }
    console.log('--- DEBUG END ---');
} catch (e) {
    console.error('EXCEPTION:', e);
}
