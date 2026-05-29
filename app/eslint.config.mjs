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
            // Historically, prop validation was disabled to prevent warnings.
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

    // ── Cypress E2E tests ─────────────────────────────────────────────────────
    {
        files: ['cypress/**/*.cy.js', 'cypress/**/*.js'],
        languageOptions: {
            globals: {
                cy: 'readonly',
                Cypress: 'readonly',
                describe: 'readonly',
                context: 'readonly',
                it: 'readonly',
                specify: 'readonly',
                before: 'readonly',
                beforeEach: 'readonly',
                after: 'readonly',
                afterEach: 'readonly',
                expect: 'readonly',
                assert: 'readonly',
            },
        },
    },
];
