import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";


export default defineConfig([
    globalIgnores(["lib/**/*", "node_modules/**/*", "coverage/**/*", "**/*.js"]),
    {
        plugins: {
            "@typescript-eslint": typescriptEslint,
        },

        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
            },

            parser: tsParser,
            ecmaVersion: 2020,
            sourceType: "module",

            parserOptions: {},
        },

        rules: {
            "max-len": ["warn", {
                code: 120,
                ignoreUrls: true,
                ignoreStrings: true,
                ignoreTemplateLiterals: true,
            }],

            "require-jsdoc": "off",
            "valid-jsdoc": "off",
            "prefer-const": "error",
            "no-var": "error",
            "prefer-rest-params": "off",
            "no-throw-literal": "off",
            camelcase: "warn",
            "no-unused-vars": "off",

            "@typescript-eslint/no-unused-vars": ["warn", {
                argsIgnorePattern: "^_",
            }],
        },
    },
    {
        files: ["**/*.test.ts", "**/*.spec.ts"],

        rules: {
            "no-unused-expressions": "off",
            "max-len": "off",
        },
    },
]);