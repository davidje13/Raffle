'use strict';

module.exports = {
	'env': {
		'browser': true,
		'es6': true,
		'jasmine': true,
		'node': true,
	},
	'extends': [
		'eslint:recommended',
		'plugin:jasmine/recommended',
	],
	'globals': {'SharedArrayBuffer': false},
	'plugins': ['jasmine'],
	'rules': {
		'accessor-pairs': ['error'],
		'array-bracket-newline': ['error', {'multiline': true}],
		'array-bracket-spacing': ['error'],
		'array-callback-return': ['error'],
		'arrow-body-style': ['error'],
		'arrow-parens': ['error'],
		'arrow-spacing': ['error'],
		'block-scoped-var': ['error'],
		'block-spacing': ['error'],
		'brace-style': ['error'],
		'capitalized-comments': ['error'],
		'class-methods-use-this': ['error'],
		'comma-dangle': ['error', 'always-multiline'],
		'comma-spacing': ['error'],
		'comma-style': ['error'],
		'complexity': ['error', 6],
		'computed-property-spacing': ['error'],
		'consistent-return': ['error'],
		'consistent-this': ['error', 'me'],
		'curly': ['error', 'all'],
		'dot-location': ['error', 'property'],
		'dot-notation': ['error'],
		'eol-last': ['error'],
		'eqeqeq': ['error'],
		'for-direction': ['error'],
		'func-call-spacing': ['error'],
		'func-name-matching': ['error'],
		'function-paren-newline': ['error', 'consistent'],
		'generator-star-spacing': ['error'],
		'getter-return': ['error'],
		'global-require': ['off'], // Need to use closures in-browser
		'guard-for-in': ['error'],
		'handle-callback-err': ['error'],
		'implicit-arrow-linebreak': ['error'],
		'indent': ['error', 'tab'],
		'init-declarations': ['error'],
		'jasmine/expect-matcher': ['error'],
		'jasmine/expect-single-argument': ['error'],
		'jasmine/missing-expect': ['error'],
		'jasmine/named-spy': ['error'],
		'jasmine/new-line-before-expect': ['error'],
		'jasmine/new-line-between-declarations': ['error'],
		'jasmine/no-assign-spyon': ['error'],
		'jasmine/no-describe-variables': ['error'],
		'jasmine/no-disabled-tests': ['error'],
		'jasmine/no-expect-in-setup-teardown': ['error'],
		'jasmine/no-spec-dupes': ['error', 'branch'],
		'jasmine/no-suite-dupes': ['error', 'branch'],
		'jasmine/no-unsafe-spy': ['error'],
		'jasmine/prefer-jasmine-matcher': ['error'],
		'jasmine/prefer-toHaveBeenCalledWith': ['error'],
		'key-spacing': ['error'],
		'keyword-spacing': [
			'error',
			{
				'overrides': {
					'catch': {'after': false},
					'for': {'after': false},
					'if': {'after': false},
					'switch': {'after': false},
					'while': {'after': false},
				},
			},
		],
		'linebreak-style': ['error', 'unix'],
		'lines-between-class-members': ['error'],
		'max-depth': ['error', 4],
		'max-len': ['error', {'ignoreUrls': true}],
		'max-lines': ['error', 600],
		'max-nested-callbacks': ['error', 5], // Includes jasmine blocks
		'max-params': ['error', 4],
		'max-statements': ['error', 30],
		'max-statements-per-line': ['error'],
		'new-cap': ['error'],
		'new-parens': ['error'],
		'newline-per-chained-call': ['error'],
		'no-alert': ['error'],
		'no-array-constructor': ['error'],
		'no-await-in-loop': ['error'],
		'no-bitwise': [
			'error',
			{
				'allow': [
					'~',
					'<<',
					'>>',
					'>>>',
					'>>=',
					'<<=',
					'>>>=',
				],
			},
		],
		'no-buffer-constructor': ['error'],
		'no-caller': ['error'],
		'no-catch-shadow': ['error'],
		'no-confusing-arrow': ['error'],
		'no-duplicate-imports': ['error'],
		'no-empty-function': ['error'],
		'no-eq-null': ['error'],
		'no-eval': ['error'],
		'no-extend-native': ['error'],
		'no-extra-bind': ['error'],
		'no-extra-label': ['error'],
		'no-extra-parens': ['error', 'functions'],
		'no-floating-decimal': ['error'],
		'no-implicit-coercion': ['error'],
		'no-implicit-globals': ['error'],
		'no-implied-eval': ['error'],
		'no-invalid-this': ['error'],
		'no-iterator': ['error'],
		'no-label-var': ['error'],
		'no-labels': ['error'],
		'no-lone-blocks': ['error'],
		'no-lonely-if': ['error'],
		'no-loop-func': ['error'],
		'no-mixed-operators': [
			'error',
			{
				'groups': [
					['*', '/', '%', '**'],
					['+', '-'],
					['&', '|', '^', '~', '<<', '>>', '>>>'],
					['==', '!=', '===', '!==', '>', '>=', '<', '<='],
					['&&', '||'],
					['in', 'instanceof'],
				],
			},
		],
		'no-mixed-requires': ['error'],
		'no-multi-assign': ['error'],
		'no-multi-spaces': ['error'],
		'no-multi-str': ['error'],
		'no-multiple-empty-lines': ['error'],
		'no-negated-condition': ['error'],
		'no-new': ['error'],
		'no-new-func': ['error'],
		'no-new-object': ['error'],
		'no-new-require': ['error'],
		'no-new-wrappers': ['error'],
		'no-octal-escape': ['error'],
		'no-param-reassign': ['error'],
		'no-path-concat': ['error'],
		'no-process-env': ['error'],
		'no-process-exit': ['error'],
		'no-proto': ['error'],
		'no-prototype-builtins': ['error'],
		'no-restricted-globals': ['error'],
		'no-restricted-modules': ['error'],
		'no-restricted-properties': ['error'],
		'no-return-assign': ['error'],
		'no-return-await': ['error'],
		'no-script-url': ['error'],
		'no-self-compare': ['error'],
		'no-sequences': ['error'],
		'no-shadow': ['error'],
		'no-shadow-restricted-names': ['error'],
		'no-sync': ['error'],
		'no-template-curly-in-string': ['error'],
		'no-throw-literal': ['error'],
		'no-trailing-spaces': ['error'],
		'no-undef-init': ['error'],
		'no-undefined': ['error'],
		'no-underscore-dangle': ['error'],
		'no-unmodified-loop-condition': ['error'],
		'no-unneeded-ternary': ['error'],
		'no-unused-expressions': ['error'],
		'no-use-before-define': ['error'],
		'no-useless-call': ['error'],
		'no-useless-computed-key': ['error'],
		'no-useless-concat': ['error'],
		'no-useless-constructor': ['error'],
		'no-useless-rename': ['error'],
		'no-useless-return': ['error'],
		'no-var': ['error'],
		'no-void': ['error'],
		'no-warning-comments': ['error'],
		'no-whitespace-before-property': ['error'],
		'no-with': ['error'],
		'object-curly-newline': ['error', {'multiline': true}],
		'object-shorthand': ['error'],
		'one-var': ['error', 'never'],
		'one-var-declaration-per-line': ['error', 'always'],
		'operator-assignment': ['error'],
		'operator-linebreak': ['error', 'before'],
		'padded-blocks': ['error', 'never'],
		'prefer-arrow-callback': ['error'],
		'prefer-const': ['error'],
		'prefer-destructuring': ['error'],
		'prefer-numeric-literals': ['error'],
		'prefer-promise-reject-errors': ['error'],
		'prefer-rest-params': ['error'],
		'prefer-spread': ['error'],
		'prefer-template': ['error'],
		'quote-props': ['error', 'consistent'],
		'quotes': ['error', 'single'],
		'radix': ['error'],
		'require-await': ['error'],
		'rest-spread-spacing': ['error'],
		'semi': ['error', 'always'],
		'semi-spacing': ['error'],
		'semi-style': ['error'],
		'sort-imports': ['error'],
		'sort-keys': ['error'],
		'space-before-blocks': ['error'],
		'space-before-function-paren': ['error', 'never'],
		'space-in-parens': ['error'],
		'space-infix-ops': ['error'],
		'space-unary-ops': ['error', {'overrides': {'++': true, '--': true}}],
		'spaced-comment': ['error'],
		'strict': ['error'],
		'switch-colon-spacing': ['error'],
		'symbol-description': ['error'],
		'template-curly-spacing': ['error'],
		'template-tag-spacing': ['error'],
		'unicode-bom': ['error'],
		'valid-jsdoc': ['error'],
		'vars-on-top': ['error'],
		'wrap-iife': ['error'],
		'wrap-regex': ['error'],
		'yield-star-spacing': ['error'],
		'yoda': ['error'],
	},
};
