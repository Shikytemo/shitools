// ESLint flat config — minimal, opinionated, Prettier owns formatting.
import js from '@eslint/js'
import globals from 'globals'

export default [
	{
		ignores: [
			'node_modules',
			'data',
			'output',
			'tmp',
			'temp',
			'types',
			'coverage',
			'src/source-profiles.js'
		]
	},
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2024,
			sourceType: 'module',
			globals: {
				...globals.node,
				...globals.es2024
			}
		},
		rules: {
			'no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					ignoreRestSiblings: true
				}
			],
			'no-console': 'off',
			'prefer-const': 'error',
			'no-var': 'error',
			eqeqeq: ['error', 'smart']
		}
	},
	{
		files: ['tests/**/*.js', '**/*.test.js'],
		languageOptions: {
			globals: {
				...globals.node
			}
		}
	}
]
