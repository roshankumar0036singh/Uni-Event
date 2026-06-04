import { defineConfig, globalIgnores } from 'eslint/config';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
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

export default defineConfig([
    globalIgnores(['lib/**/*', 'node_modules/**/*', 'coverage/**/*', '**/*.js', '**/*.mjs']),
    {
        extends: compat.extends('google'),

        plugins: {
            '@typescript-eslint': typescriptEslint,
        },

        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
            },

            parser: tsParser,
            ecmaVersion: 2020,
            sourceType: 'module',

            parserOptions: {
                project: './tsconfig.json',
            },
        },

        rules: {
            'max-len': [
                'warn',
                {
                    code: 120,
                    ignoreUrls: true,
                    ignoreStrings: true,
                    ignoreTemplateLiterals: true,
                },
            ],

            'require-jsdoc': 'off',
            'valid-jsdoc': 'off',
            'prefer-const': 'error',
            'no-var': 'error',
            'prefer-rest-params': 'off',
            'no-throw-literal': 'off',
            camelcase: 'warn',
            'no-unused-vars': 'off',

            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                },
            ],
        },
    },
    {
        files: ['**/*.test.ts', '**/*.spec.ts'],
        languageOptions: {
            parserOptions: {
                project: null,
            },
        },

        rules: {
            'no-unused-expressions': 'off',
            'max-len': 'off',
        },
    },
]);
