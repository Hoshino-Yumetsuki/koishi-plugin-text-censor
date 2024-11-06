import typescriptEslint from '@typescript-eslint/eslint-plugin'
import globals from 'globals'
import tsParser from '@typescript-eslint/parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
})

export default [
    {
        ignores: ['**/temp', '**/dist', '**/lib', '**/tests', '**/*.js']
    },
    ...compat.extends(
        'standard',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended'
    ),
    {
        plugins: {
            '@typescript-eslint': typescriptEslint
        },

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.mocha,
                NodeJS: true,
                KOISHI_CONFIG: true
            },

            parser: tsParser
        },

        settings: {
            'import/parsers': {
                '@typescript-eslint/parser': ['.ts']
            }
        },

        rules: {
            'prettier/prettier': [
                'error',
                {
                    printWidth: 80
                },
                {
                    tabWidth: 4
                }
            ],

            'array-callback-return': 'off',
            'comma-dangle': ['error', 'never'],
            'dot-notation': 'off',
            'generator-star-spacing': ['error', 'before'],
            'max-len': ['warn', 160],
            'multiline-ternary': 'off',
            'no-callback-literal': 'off',
            'no-mixed-operators': 'off',
            'no-use-before-define': 'off',
            'no-return-assign': 'off',
            'no-sequences': 'off',
            'no-useless-escape': 'off',
            'one-var': 'off',

            'operator-linebreak': [
                'error',
                'after',
                {
                    overrides: {
                        '?': 'before',
                        ':': 'before'
                    }
                }
            ],

            quotes: [
                'error',
                'single',
                {
                    avoidEscape: true,
                    allowTemplateLiterals: true
                }
            ],

            'sort-imports': [
                'warn',
                {
                    ignoreCase: true,
                    ignoreDeclarationSort: true
                }
            ],

            'valid-typeof': 'off',
            'yield-star-spacing': ['error', 'after'],
            'import/export': 'off',
            '@typescript-eslint/array-type': 'error',
            'default-param-last': 'off',
            '@typescript-eslint/default-param-last': 'error',
            'func-call-spacing': 'off',
            '@typescript-eslint/func-call-spacing': 'error',
            'keyword-spacing': 'off',
            '@typescript-eslint/keyword-spacing': 'error',
            camelcase: 'off',

            '@typescript-eslint/naming-convention': [
                'off',
                {
                    selector: 'default',
                    format: ['camelCase', 'UPPER_CASE'],
                    leadingUnderscore: 'allow'
                },
                {
                    selector: ['variableLike', 'memberLike'],
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
                    leadingUnderscore: 'allow'
                },
                {
                    selector: ['typeLike'],
                    format: ['PascalCase']
                },
                {
                    selector: ['function'],
                    format: ['camelCase', 'PascalCase']
                },
                {
                    selector: ['enum'],
                    format: ['UPPER_CASE', 'PascalCase']
                },
                {
                    selector: ['typeParameter'],
                    format: ['PascalCase']
                },
                {
                    selector: ['objectLiteralProperty'],
                    format: null
                },
                {
                    selector: ['typeProperty'],
                    format: null
                },
                {
                    selector: ['typeMethod'],
                    format: null
                }
            ],

            'no-redeclare': 'off',
            'no-undef': 'off',
            indent: 'off',
            'no-unused-vars': 'off',

            '@typescript-eslint/no-unused-vars': [
                'off',
                {
                    args: 'none'
                }
            ],

            'no-dupe-class-members': 'off',
            '@typescript-eslint/no-dupe-class-members': 'error',
            'no-inner-declarations': 'off',
            'no-useless-constructor': 'off',
            'node/no-callback-literal': 'off',
            'quote-props': 'off',
            semi: 'off',
            '@typescript-eslint/semi': ['error', 'never'],

            '@typescript-eslint/member-delimiter-style': [
                'error',
                {
                    multiline: {
                        delimiter: 'none'
                    }
                }
            ],

            'space-before-function-paren': 'off',

            '@typescript-eslint/space-before-function-paren': [
                'error',
                {
                    anonymous: 'always',
                    asyncArrow: 'always',
                    named: 'never'
                }
            ],

            '@typescript-eslint/type-annotation-spacing': 'error',

            '@typescript-eslint/no-explicit-any': 'off'
        }
    }
]
