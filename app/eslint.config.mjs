import prettier from 'eslint-plugin-prettier';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default [
    // ── Ignore files that should not be linted ──────────────────────────────
    {
        ignores: [
            'copy_externals.js',
            'debug_and_fix.js',
            'diagnose_externals.js',
            'diagnose_tap.js',
            'dump_externals.js',
            'dump_to_txt.js',
            'final_fix.js',
            'fix_sea_error.js',
            'fix_syntax.js',
            'force_fix.js',
            'force_fix_v2.js',
            'grep_externals.js',
            'inspect_externals.js',
            'patch_expo.js',
            'patch_expo_final.js',
            'patch_expo_v2.js',
            'patch_is_generator.js',
            'read_critical.js',
            'read_dependency.js',
            'read_externals.js',
            'read_externals_v2.js',
            'regenerate_externals.js',
            'verify_status.js',
            'eslint.config.mjs',
            'node_modules/**',
            'web-build/**',
            '.expo/**',
            'coverage/**',
        ],
    },

    // ── Base: expo + prettier extends ────────────────────────────────────────
    ...compat.extends('expo', 'prettier'),

    // ── Global overrides ─────────────────────────────────────────────────────
    {
        plugins: { prettier },

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.jest,
            },
        },

        rules: {
            'prettier/prettier': 'error',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            // TODO: Currently prop validation is disabled to prevent hundreds of warnings.
            // Change setting to 'warn' to incrementally restore runtime prop-type checks,
            // or if migrating to TypeScript, enable only for JS/JSX files via overrides so TSX uses TS typing.
            'react/prop-types': 'error',
            'react/no-unescaped-entities': 'warn',
            'import/named': 'warn',
        },
    },

    // ── Node.js scripts ───────────────────────────────────────────────────────
    {
        files: ['metro.config.js', 'babel.config.js', 'scripts/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },

    // ── Service worker ────────────────────────────────────────────────────────
    {
        files: ['public/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.browser,
                importScripts: 'readonly',
                firebase: 'readonly',
                self: 'readonly',
            },
        },
    },
];
