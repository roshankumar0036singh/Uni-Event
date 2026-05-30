const fs = require('node:fs');
const path = require('node:path');

const filePath = path.join(
    __dirname,
    '..',
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
    if (!fs.existsSync(filePath)) {
        console.log('externals.js not found, skipping');
        process.exit(0);
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    const oldFilter = `!["sys"].includes(x)`;
    const newFilter = `!["sys","sea"].includes(x)`;

    if (content.includes(oldFilter) && !content.includes(newFilter)) {
        content = content.replace(oldFilter, newFilter);
        changed = true;
        console.log('Patched: excluded "sea" from NODE_STDLIB_MODULES filter');
    }

    // ── Fix 2: Also handle the mkdir path for any module with ':' ──
    // Patch tapNodeShims to skip modules that would create invalid Windows paths
    const oldMkdir = `if (!_fs.default.existsSync(shimPath))`;
    const newMkdir = `if (!_fs.default.existsSync(shimPath) && !moduleId.includes(':') && !/^sea$/i.test(moduleId))`;

    if (content.includes(oldMkdir) && !content.includes('moduleId.includes')) {
        content = content.replace(oldMkdir, newMkdir);
        changed = true;
        console.log('Patched: skip mkdir for modules with ":" in name');
    }

    // ── Fix 3: Legacy literal string replacement (just in case) ──
    if (content.includes("'node:sea'")) {
        content = content.replace(/'node:sea'/g, "'_node_sea_disabled'");
        changed = true;
    }
    if (content.includes('"node:sea"')) {
        content = content.replace(/"node:sea"/g, '"_node_sea_disabled"');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(filePath, content);
        console.log('✅ Patched externals.js successfully!');
    } else {
        console.log('No node:sea found or already patched.');
    }
} catch (e) {
    console.error('Patch error:', e.message);
}
