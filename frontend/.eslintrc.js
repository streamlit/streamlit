/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

module.exports = {
  env: {
    // allow using browser-defined globals like `window` and `document`
    browser: true,
    es6: true,
  },
  extends: [
    "airbnb-typescript/base",
    // Uses the recommended rules from @eslint-plugin-react
    "plugin:react/recommended",
    // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    "plugin:@typescript-eslint/recommended",
    // Uses the recommended rules from react-hooks
    "plugin:react-hooks/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    // Enables eslint-plugin-prettier and eslint-config-prettier.
    // This will display prettier errors as ESLint errors.
    // Make sure this is always the last configuration in the extends array.
    "plugin:prettier/recommended",
    // Recommended Jest configuration to enforce good testing practices
    "plugin:jest/recommended",
    // Uses the recommended rules from React Testing Library:
    "plugin:testing-library/react",
    // Uses the recommended rules from lodash
    "plugin:lodash/recommended",
  ],
  // Specifies the ESLint parser
  parser: "@typescript-eslint/parser",
  parserOptions: {
    // make the parser resolve the project configuration relative to .eslintrc.js
    tsconfigRootDir: __dirname,
    project: "./tsconfig.dev.json",
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
  plugins: ["no-relative-import-paths", "streamlit-custom"],
  // Place to specify ESLint rules.
  // Can be used to overwrite rules specified from the extended configs
  rules: {
    // Use `const` or `let` instead of `var`
    "no-var": "error",
    // We don't use PropTypes
    "react/prop-types": "off",
    // We don't escape entities
    "react/no-unescaped-entities": "off",
    // Some of these are being caught erroneously
    "@typescript-eslint/camelcase": "off",
    // Console statements are currently allowed,
    // but we may want to reconsider this!
    "@typescript-eslint/no-console": "off",
    // Empty interfaces are ok
    "@typescript-eslint/no-empty-interface": "off",
    // Empty functions are ok
    "@typescript-eslint/no-empty-function": "off",
    // We prefer not using `any`, but don't disallow it
    "@typescript-eslint/no-explicit-any": "off",
    // We prefer not using `any`, but don't disallow it (this rule
    // differs from the previous one in that it requires explicit types
    // for public module APIs)
    "@typescript-eslint/explicit-module-boundary-types": "off",
    // Don't warn about unused function params
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        vars: "all",
        args: "after-used",
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
    ],
    // Allow foo.hasOwnProperty("bar")
    "no-prototype-builtins": "off",
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

    // Surpresses compile warnings for vars already declared in the upper scope
    "@typescript-eslint/no-shadow": "off",
    // Surpresses compile warnings for use of an exported name as a property on the default (ex: React.useState vs. useState)
    // TODO: Go through each instance and resolve -> import React, { useState } from "react" & call useState directly
    "import/no-named-as-default-member": "off",
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
    "streamlit-custom/no-hardcoded-theme-values": "error",
    "streamlit-custom/use-strict-null-equality-checks": "error",
  },
  overrides: [
    {
      // allow hardcoded styles in our test files and in the theme definitions
      files: ["**/*.test.ts", "**/*.test.tsx", "lib/src/theme/**/*"],
      rules: {
        "streamlit-custom/no-hardcoded-theme-values": ["off"],
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
        project: ["lib/tsconfig.json", "app/tsconfig.json"],
      },
    },
  },
}
