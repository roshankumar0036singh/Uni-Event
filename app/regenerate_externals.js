const fs = require('fs');
const path = require('path');
const backupPath = path.join(
    'node_modules',
    '@expo',
    'cli',
    'build',
    'src',
    'start',
    'server',
    'metro',
    'externals_backup.js',
);
const targetPath = path.join(
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
    console.log('Reading backup:', backupPath);
    let content = fs.readFileSync(backupPath, 'utf8');
    console.log('Original Size:', content.length);

    // Aggressive replacements
    content = content.replace(/'node:sea'/g, "'node_sea_skipped'");
    content = content.replace(/"node:sea"/g, '"node_sea_skipped"');

    // Patch mkdir specifically
    // We look for the exact signature of the problematic call
    const badCall = 'await fs.promises.mkdir(path.dirname(externalPath), { recursive: true });';
    const safeCall =
        "if(!externalPath.includes('node:sea')) await fs.promises.mkdir(path.dirname(externalPath), { recursive: true });";
    if (content.includes(badCall)) {
        content = content.replace(badCall, safeCall);
        console.log('Patched mkdir dirname call');
    }

    // Also patch the direct mkdir call if present
    const badCall2 = 'await fs.promises.mkdir(externalPath, { recursive: true });';
    const safeCall2 =
        "if(!externalPath.includes('node:sea')) await fs.promises.mkdir(externalPath, { recursive: true });";
    if (content.includes(badCall2)) {
        content = content.replace(badCall2, safeCall2);
        console.log('Patched mkdir direct call');
    }

    // Sanitize the array if we can match it
    // This is a catch-all for the array definition
    content = content.replace(
        /NODE_STDLIB_MODULES\s*=\s*\[(.*?)\]/s,
        (m, p1) => `NODE_STDLIB_MODULES = [${p1}].filter(x => !x.includes(':'))`,
    );

    fs.writeFileSync(targetPath, content);
    console.log('Written clean externals.js');
} catch (e) {
    console.error(e);
    // Restore backup if we failed to write
    try {
        if (!fs.existsSync(targetPath) && fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, targetPath);
            console.log('Restored backup due to error.');
        }
    } catch (ex) {}
}
