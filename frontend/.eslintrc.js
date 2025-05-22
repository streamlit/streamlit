/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const path = require("path")
const vitest = require("eslint-plugin-vitest")

module.exports = {
  env: {
    // allow using browser-defined globals like `window` and `document`
    browser: true,
    es6: true,
  },
  extends: [
    // Activate recommended eslint rules: https://eslint.org/docs/latest/rules
    "eslint:recommended",
    // Uses the recommended rules from airbnb-typescript/base
    "airbnb-typescript/base",
    // Uses the recommended rules from @eslint-plugin-react
    "plugin:react/recommended",
    // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    "plugin:@typescript-eslint/recommended",
    // Uses the recommended rules from the @typescript-eslint/eslint-plugin with type-checking
    "plugin:@typescript-eslint/recommended-type-checked",
    // Uses the recommended rules from react-hooks
    // @see https://react.dev/learn/editor-setup#linting
    "plugin:react-hooks/recommended-legacy",
    "plugin:import/recommended",
    "plugin:import/typescript",
    // Enables eslint-plugin-prettier and eslint-config-prettier.
    // This will display prettier errors as ESLint errors.
    // Make sure this is always the last configuration in the extends array.
    "plugin:prettier/recommended",
    // Uses the recommended rules from React Testing Library:
    "plugin:testing-library/react",
    // Uses the recommended rules from lodash
    "plugin:lodash/recommended",
    // This uses the `-legacy` nomenclature since we're on an older version of
    // eslint that doesn't support flat config
    // @see https://eslint-react.xyz/docs/presets
    "plugin:@eslint-react/recommended-type-checked-legacy",
  ],
  // Specifies the ESLint parser
  parser: "@typescript-eslint/parser",
  parserOptions: {
    // make the parser resolve the project configuration relative to .eslintrc.js
    tsconfigRootDir: path.resolve("."),
    project: "tsconfig.json",
    ecmaFeatures: {
      jsx: true, // Allows for the parsing of JSX
    },
    // Allows for the parsing of modern ECMAScript features
    ecmaVersion: 2018,
    // Allows for the use of imports
    sourceType: "module",
  },
  // Ignore our auto-generated and vendored code
  ignorePatterns: [
    "lib/src/proto.js",
    "lib/src/proto.d.ts",
    "**/vendor/*",
    "**/node_modules/*",
  ],
  plugins: [
    "no-relative-import-paths",
    "streamlit-custom",
    "vitest",
    "react-compiler",
    "@eslint-react",
  ],
  // Place to specify ESLint rules.
  // Can be used to overwrite rules specified from the extended configs
  rules: {
    // Recommended vitest configuration to enforce good testing practices
    ...vitest.configs.recommended.rules,
    // Use `const` or `let` instead of `var`
    "no-var": "error",
    // Prevent unintentional use of `console.log`
    "no-console": "error",
    // Prevent unintentional use of `debugger`
    "no-debugger": "error",
    // We don't use PropTypes
    "react/prop-types": "off",
    // We don't escape entities
    "react/no-unescaped-entities": "off",
    // We do want to discourage the usage of flushSync
    "@eslint-react/dom/no-flush-sync": "error",
    // This was giving false positives
    "@eslint-react/no-unused-class-component-members": "off",
    // This was giving false positives
    "@eslint-react/naming-convention/use-state": "off",
    // Helps us catch functions written as if they are hooks, but are not.
    "@eslint-react/hooks-extra/no-useless-custom-hooks": "error",
    // Turning off for now until we have clearer guidance on how to fix existing
    // usages
    "@eslint-react/hooks-extra/no-direct-set-state-in-use-effect": "off",
    // We don't want to warn about empty fragments
    "@eslint-react/no-useless-fragment": "off",
    // #region TypeScript rules with type-checking
    // We want to use these, but we have far too many instances of these rules
    // for it to be realistic right now. Over time, we should fix these.
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/unbound-method": "off",
    // #endregion
    // Some of these are being caught erroneously
    "@typescript-eslint/camelcase": "off",
    // Empty interfaces are ok
    "@typescript-eslint/no-empty-interface": "off",
    // Empty functions are ok
    "@typescript-eslint/no-empty-function": "off",
    // We prefer not using `any`, but don't disallow it (this rule
    // differs from the previous one in that it requires explicit types
    // for public module APIs)
    "@typescript-eslint/explicit-module-boundary-types": "off",
    // Don't warn about unused function params
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        vars: "all",
        args: "all",
        ignoreRestSiblings: false,
        argsIgnorePattern: "^_",
      },
    ],
    // It's safe to use functions before they're defined
    "@typescript-eslint/no-use-before-define": ["warn", { functions: false }],
    // Functions must have return types, but we allow
    // inline function expressions to omit them
    "@typescript-eslint/explicit-function-return-type": [
      "warn",
      { allowExpressions: true },
    ],
    // Disallow the @ts-ignore directive in favor of the more
    // strict @ts-expect-error.
    "@typescript-eslint/ban-ts-comment": [
      "error",
      {
        "ts-expect-error": false,
        "ts-nocheck": false,
        "ts-check": false,
        "ts-ignore": true,
      },
    ],
    // Permit for-of loops (https://stackoverflow.com/a/42237667)
    "no-restricted-syntax": [
      "error",
      "ForInStatement",
      "LabeledStatement",
      "WithStatement",
      {
        selector: "CallExpression[callee.name='withTheme']",
        message:
          "The use of withTheme HOC is not allowed for functional components. " +
          "Please use the useTheme hook instead.",
      },
    ],
    "no-restricted-globals": [
      "error",
      {
        name: "localStorage",
        message:
          "Please use window.localStorage instead since localStorage is not " +
          "supported in some browsers (e.g. Android WebView).",
      },
    ],
    // Imports should be `import "./FooModule"`, not `import "./FooModule.js"`
    // We need to configure this to check our .tsx files, see:
    // https://github.com/benmosher/eslint-plugin-import/issues/1615#issuecomment-577500405
    "import/extensions": [
      "error",
      "ignorePackages",
      {
        js: "never",
        jsx: "never",
        ts: "never",
        tsx: "never",
      },
    ],
    // Disable a bunch of AirBNB rules we're currently in violation of.
    // TODO: For each one, either fix and reenable, or provide a justification.
    "import/prefer-default-export": "off",
    "max-classes-per-file": "off",
    "no-shadow": "off",
    "no-param-reassign": "off",
    "no-plusplus": "off",
    "no-relative-import-paths/no-relative-import-paths": [
      "error",
      { allowSameFolder: true, rootDir: "src", prefix: "src" },
    ],
    "no-else-return": ["error", { allowElseIf: true }],
    "lodash/prefer-noop": "off",
    "lodash/prefer-constant": "off",
    "lodash/prefer-lodash-method": "off",
    "lodash/prefer-lodash-typecheck": "off",
    "lodash/prefer-get": "off",
    "lodash/prefer-includes": "off",
    "lodash/prefer-is-nil": "off",
    "lodash/prefer-matches": "off",
    "lodash/path-style": "off",
    "sort-imports": [
      "error",
      {
        ignoreCase: true,
        ignoreDeclarationSort: true,
      },
    ],
    "import/order": [
      1,
      {
        pathGroups: [
          {
            pattern: "react",
            group: "external",
            position: "before",
          },
          {
            pattern: "@streamlit/**",
            group: "internal",
            position: "before",
          },
        ],
        pathGroupsExcludedImportTypes: ["react"],
        groups: [
          "external",
          "builtin",
          "internal",
          "parent",
          "sibling",
          "index",
        ],
        "newlines-between": "always",
      },
    ],
    "react-compiler/react-compiler": "error",
    "streamlit-custom/no-hardcoded-theme-values": "error",
    "streamlit-custom/use-strict-null-equality-checks": "error",
    // We only turn this rule on for certain directories
    "streamlit-custom/enforce-memo": "off",
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "timezone-mock",
            message: "Please use the withTimezones test harness instead",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // allow hardcoded styles in our test files and in the theme definitions
      files: ["**/*.test.ts", "**/*.test.tsx", "lib/src/theme/**/*"],
      rules: {
        "streamlit-custom/no-hardcoded-theme-values": ["off"],
      },
    },
    {
      // test-only rules
      files: ["**/*.test.ts", "**/*.test.tsx"],
      extends: ["plugin:testing-library/react"],
      rules: {
        "testing-library/prefer-user-event": "error",
      },
    },
    {
      files: ["**/components/elements/**/*", "**/components/widgets/**/*"],
      rules: {
        "streamlit-custom/enforce-memo": "error",
      },
    },
    {
      // It is okay for Emotion to use template expressions with complex
      // stringified types
      files: ["**/styled-components.ts", "**/styled-components.tsx"],
      rules: {
        "@typescript-eslint/restrict-template-expressions": "off",
      },
    },
  ],
  settings: {
    react: {
      // Tells eslint-plugin-react to automatically detect
      // the version of React to use
      version: "detect",
    },
    // Check for import violation in all JS-like files
    "import/resolver": {
      typescript: {
        // tell eslint to look at these tsconfigs for import statements
        project: [path.resolve(".", "tsconfig.json")],
      },
    },
  },
}
