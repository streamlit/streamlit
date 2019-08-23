module.exports = {
  'env': {
    // allow using browser-defined globals like `window` and `document`
    'browser': true,
    'es6': true
  },
  'parser': '@typescript-eslint/parser',
  'plugins': ['@typescript-eslint'],
  'parserOptions': {
    'ecmaFeatures': {
      'ecmaVersion': 2018,  // we're using the spread operator
      'jsx': true
    },
    'sourceType': 'module'
  },
  'extends': [
    'plugin:@typescript-eslint/recommended',
    'fbjs',
  ],
  'rules': {
    // No semicolons,
    'semi': ['warn', 'never'],

    // Enforce spaces inside of blocks after opening
    // block and before closing block
    'block-spacing': ['warn', 'always'],

    // We don't want extra spaces inside parens
    'space-in-parens': ['warn', 'never'],

    // Use 'const' or 'let' instead of 'var'
    'no-var': 'error',

    // Disable the eslint indent rule, which conflicts with typescript-eslint's same rule
    'indent': 'off',

    // 2-space indent. 'case' inside 'switch' is indented 1 level
    '@typescript-eslint/indent': ['warn', 2, { 'SwitchCase': 1 }],

    // It's safe to use functions before they're defined
    '@typescript-eslint/no-use-before-define': ['warn', { 'functions': false }],

    // Don't warn about unused function params
    '@typescript-eslint/no-unused-vars': ['warn', { 'args': 'none' }],

    // typescript-eslint is catching some of these erroneously
    '@typescript-eslint/camelcase': 'off',

    // We prefer not using 'any', but don't disallow it
    '@typescript-eslint/no-explicit-any': 'off',

    // Functions must have return types, but we allow inline function expressions to omit them
    '@typescript-eslint/explicit-function-return-type': ['warn', { 'allowExpressions': true }],

    '@typescript-eslint/no-empty-interface': 'off',

    // max-len is set to 120, to accommodate jsx, but we prefer
    // that non-jsx code stay within an 80-column max width
    'max-len': ['warn', {
      'code': 120,
      'ignoreComments': true,
      'ignoreUrls': true
    }],

    // console statements are currently allowed, but we may want to reconsider this!
    'no-console': 'off',
  }
};
