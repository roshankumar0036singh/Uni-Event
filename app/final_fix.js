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

    // 1. Sanitize the string literal "node:sea" globally
    content = content
        .replace(/'node:sea'/g, "'node_sea_disabled'")
        .replace(/"node:sea"/g, '"node_sea_disabled"');

    // 2. Wrap the critical mkdir call in a safety check
    // Looking for: await fs.promises.mkdir(..., { recursive: true })
    // We'll replace it with a block that checks for colon in the path (if variable name is available) or generally safe wraps it.

    // Since we don't know the exact variable name for the path (could be `r` or `externalPath`),
    // we will try to match the pattern `await fs.promises.mkdir(VAR, { recursive: true })`

    const mkdirRegex = /await\s+fs\.promises\.mkdir\(([^,]+),\s*\{\s*recursive:\s*true\s*\}\);/g;

    content = content.replace(mkdirRegex, (match, pathVar) => {
        console.log('Found mkdir call with var:', pathVar);
        return `if (!${pathVar}.includes('node:sea') && !${pathVar}.includes('node_sea') && !${pathVar}.endsWith(':sea')) { ${match} }`;
    });

    // 3. Just in case, also filter the array if we can match it roughly
    // Logic: "const NODE_STDLIB_MODULES = ["  ...
    const arrayStart = content.indexOf('const NODE_STDLIB_MODULES = [');
    if (arrayStart > -1) {
        const arrayEnd = content.indexOf('];', arrayStart);
        if (arrayEnd > -1) {
            const arrayContent = content.substring(arrayStart, arrayEnd + 2); // include ];
            // Append filter
            const newArrayContent = arrayContent + ".filter(m => !m.includes(':'))";
            // This is invalid JS syntax to append .filter to declaration unless we change const logic.
            // Better to replace the whole definition if possible, but it's risky.
            // Instead, let's inject a line after it.

            content = content.replace(
                arrayContent,
                arrayContent +
                    ";\n// PATCH INJECTED\nif(Array.isArray(NODE_STDLIB_MODULES)) { const idx = NODE_STDLIB_MODULES.indexOf('node:sea'); if(idx>-1) NODE_STDLIB_MODULES.splice(idx, 1); }",
            );
            console.log('Injected array filter logic.');
        }
    }

    fs.writeFileSync(filePath, content);
    console.log('Final fix applied.');
} catch (e) {
    console.error('Error applying final fix:', e);
}
