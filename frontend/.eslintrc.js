module.exports = {
  'env': {
    // allow using browser-defined globals like `window` and `document`
    'browser': true,
    'es6': true
  },
  'parserOptions': {
    'ecmaFeatures': {
      'ecmaVersion': 2018,  // we're using the spread operator
      'jsx': true
    },
    'sourceType': 'module'
  },
  'extends': ['eslint:recommended', 'fbjs'],
  'rules': {
    // Enforce spaces inside of blocks after opening
    // block and before closing block
    'block-spacing': ['warn', 'always'],

    // We don't want extra spaces inside parens
    'space-in-parens': ['warn', 'never'],

    // Use 'const' or 'let' instead of 'var'
    'no-var': 'error',

    // 2-space indent. 'case' inside 'switch' is indented 1 level
    'indent': ['warn', 2, { 'SwitchCase': 1 }],

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
