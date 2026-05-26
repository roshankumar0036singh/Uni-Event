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

    // Logic: Find where NODE_STDLIB_MODULES is assigned and wrap it with a filter
    // It likely looks like: NODE_STDLIB_MODULES = [...] or = require('module').builtinModules etc.

    // Regex to match "NODE_STDLIB_MODULES =" followed by anything until semicolon
    // However, simple string replacement is safer if we just append the filter logic right after assignment.

    // Strategy: Replace "NODE_STDLIB_MODULES =" with "NODE_STDLIB_MODULES = (global.hack_filter = "
    // and then append `.filter(x => x !== 'node:sea'))` ?? No, that's risky syntax.

    // Better Strategy:
    // Find `exports.NODE_STDLIB_MODULES = NODE_STDLIB_MODULES;` (export at end)
    // or `NODE_STDLIB_MODULES = ...;`

    // Let's assume it's `NODE_STDLIB_MODULES = ...`
    // We will replace `NODE_STDLIB_MODULES =` with `let NODE_STDLIB_MODULES_TEMP =`
    // and then add `NODE_STDLIB_MODULES = NODE_STDLIB_MODULES_TEMP.filter(x => x !== 'node:sea' && x !== 'node:test');`

    // Wait, if it's a const or var decl? `const NODE_STDLIB_MODULES =`

    // Let's try a very aggressive replacement that works for the likely compiled output.
    // Compiled babel output usually: `exports.NODE_STDLIB_MODULES = ...` or top level var.

    // Let's look for `require("module").builtinModules` or just `require("module")` usage.

    if (content.includes('require("module")')) {
        console.log('Found require("module")');
        // We will inject a shim for module
        const injection = `
      // PATCHED BY AGENT
      const _originalModule = require("module");
      const _patchedModule = { ..._originalModule, builtinModules: _originalModule.builtinModules.filter(m => !m.includes(':')) };
      // END PATCH
      `;

        // Replace `require("module")` with `_patchedModule`? Hard to scope correctly.
    }

    // Safest approach: find the specific variable assignment in the compiled code
    // The user showed:
    // NODE_STDLIB_MODULES = void 0;
    // ...
    // NODE_STDLIB_MODULES = ... (later?)

    // Let's just create a shim loop at the end of the file!
    // It's a module, so code at the end runs.
    // If NODE_STDLIB_MODULES is exported, we can modify it?
    // But likely it is used locally.

    // Let's try to string-replace the iteration.
    // `for (const moduleName of NODE_STDLIB_MODULES) {`
    // Replace with `for (const moduleName of NODE_STDLIB_MODULES.filter(m => !m.includes(':'))) {`

    let newContent = content.replace(
        /for\s*\(\s*(?:var|let|const)\s+(\w+)\s+of\s+NODE_STDLIB_MODULES\s*\)/g,
        'for (const $1 of NODE_STDLIB_MODULES.filter(m => !m.includes(":")))',
    );

    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent);
        console.log('SUCCESS: Patched the loop iteration over NODE_STDLIB_MODULES');
    } else {
        console.log('Could not match loop iteration. Trying explicit assignment patch.');

        // Fallback: Try to find where it takes values from `_module.builtinModules` logic
        // e.g. `NODE_STDLIB_MODULES = _module.builtinModules || ...`
        // We will replace `_module.builtinModules` with `(_module.builtinModules || []).filter(m => !m.includes(":"))`

        const newContent2 = content.replace(
            /_module\.builtinModules/g,
            '(_module.builtinModules || []).filter(m => !m.includes(":"))',
        );

        if (content !== newContent2) {
            fs.writeFileSync(filePath, newContent2);
            console.log('SUCCESS: Patched _module.builtinModules reference');
        } else {
            console.log('FAILED: Could not find loop or _module.builtinModules to patch.');
        }
    }
} catch (e) {
    console.error('Error patching:', e);
}
