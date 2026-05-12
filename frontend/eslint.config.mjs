/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import path from "path"
import { fileURLToPath } from "url"
import { createJiti } from "jiti"
import { fixupPluginRules } from "@eslint/compat"

// Core ESLint and plugins
import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import reactHooks from "eslint-plugin-react-hooks"
import eslintReact from "@eslint-react/eslint-plugin"
import importX from "eslint-plugin-import-x"
import lodash from "eslint-plugin-lodash"
import vitest from "@vitest/eslint-plugin"
import testingLibrary from "eslint-plugin-testing-library"
import noRelativeImportPaths from "eslint-plugin-no-relative-import-paths"
import globals from "globals"
import { defineConfig, globalIgnores } from "eslint/config"
import jsxA11y from "eslint-plugin-jsx-a11y"

// Import other configs
// Note: Some configs may need to be applied differently in flat config

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// This is to support our custom rules, which are written in TypeScript,
// but need to be imported as JS to work in ESLint.
const jiti = createJiti(import.meta.url)
const streamlitCustom = await jiti.import(
  path.resolve(__dirname, "./eslint-plugin-streamlit-custom/src/index.ts"),
  { default: true }
)

/**
 * Helper to create the no-restricted-imports rule config.
 *
 * @param {Object[]} additionalPatterns - Extra "patterns" to restrict (merged with the base rules).
 * @param {boolean} isTestFile - Whether to apply the relaxed rules for test files.
 */
export const getNoRestrictedImports = (
  additionalPatterns = [],
  isTestFile = false
) => {
  const restrictedImportPaths = [
    {
      name: "timezone-mock",
      message: "Please use the withTimezones test harness instead",
    },
    {
      name: "@emotion/react",
      message:
        "Please use the useEmotionTheme hook instead of useTheme for type-safety",
      importNames: ["useTheme"],
    },
    {
      name: "axios",
      importNames: ["CancelToken"],
      message: "Please use the `AbortController` API instead of `CancelToken`",
    },
    {
      name: "react",
      importNames: ["default"],
      message:
        "Please use named imports for React (e.g., import { useState } from 'react';)",
    },
  ]

  const basePaths = isTestFile
    ? restrictedImportPaths
    : [
        ...restrictedImportPaths,
        {
          name: "@streamlit/lib/testing",
          message: "Test utilities must stay in test files.",
        },
      ]
  return [
    "error",
    {
      paths: [...basePaths],
      patterns: [...additionalPatterns],
    },
  ]
}

const restrictedGlobals = [
  {
    name: "localStorage",
    message:
      "Please use window.localStorage instead since localStorage is not " +
      "supported in some browsers (e.g. Android WebView).",
  },
  {
    name: "innerWidth",
    message: "Please use the `useWindowDimensionsContext` hook instead.",
  },
  {
    name: "innerHeight",
    message: "Please use the `useWindowDimensionsContext` hook instead.",
  },
]

const useTimeoutRestrictedGlobals = [
  {
    name: "setTimeout",
    message:
      "Please use the `useTimeout` hook or another shared timeout helper instead of direct `setTimeout` in non-test source files.",
  },
]

const useTimeoutRestrictedProperties = [
  {
    object: "window",
    property: "setTimeout",
    message:
      "Please use the `useTimeout` hook or another shared timeout helper instead of `window.setTimeout` in non-test source files.",
  },
  {
    object: "globalThis",
    property: "setTimeout",
    message:
      "Please use the `useTimeout` hook or another shared timeout helper instead of `globalThis.setTimeout` in non-test source files.",
  },
]

/**
 * Helper to create the no-restricted-globals rule config.
 *
 * @param {Object} options
 * @param {boolean} [options.includeUseTimeout] - Whether to add setTimeout restrictions.
 */
export const getNoRestrictedGlobals = ({ includeUseTimeout = false } = {}) => {
  return [
    "error",
    ...restrictedGlobals,
    ...(includeUseTimeout ? useTimeoutRestrictedGlobals : []),
  ]
}

/**
 * Helper to create the no-restricted-properties rule config.
 *
 * @param {Object} options
 * @param {boolean} [options.allowWindowStreamlit] - Whether to allow window.__streamlit access.
 *   Set to true for files that need to mock the config module itself.
 * @param {boolean} [options.includeUseTimeout] - Whether to add setTimeout restrictions.
 */
const getRestrictedProperties = ({ allowWindowStreamlit = false } = {}) => {
  const restrictions = [
    {
      object: "window",
      property: "innerWidth",
      message: "Please use the `useWindowDimensionsContext` hook instead.",
    },
    {
      object: "window",
      property: "innerHeight",
      message: "Please use the `useWindowDimensionsContext` hook instead.",
    },
    {
      object: "navigator",
      property: "clipboard",
      message: "Please use the `useCopyToClipboard` hook instead.",
    },
  ]

  if (!allowWindowStreamlit) {
    restrictions.push({
      object: "window",
      property: "__streamlit",
      message:
        "Please access window.__streamlit properties via StreamlitConfig in '@streamlit/utils' instead.",
    })
  }

  return restrictions
}

export const getNoRestrictedProperties = ({
  allowWindowStreamlit = false,
  includeUseTimeout = false,
} = {}) => {
  return [
    "error",
    ...getRestrictedProperties({ allowWindowStreamlit }),
    ...(includeUseTimeout ? useTimeoutRestrictedProperties : []),
  ]
}

export default defineConfig([
  // Base recommended configs
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  reactHooks.configs.flat.recommended,
  eslintReact.configs["recommended-type-checked"],
  importX.flatConfigs.recommended,
  // Global configuration for all files
  {
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        // Node.js globals for config files
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
  // TypeScript files configuration
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      ...jsxA11y.flatConfigs.recommended.plugins,
      lodash,
      "no-relative-import-paths": fixupPluginRules(noRelativeImportPaths),
      "streamlit-custom": streamlitCustom,
    },
    rules: {
      "no-proto": "error",
      // Use `const` or `let` instead of `var`
      "no-var": "error",
      // Prevent unintentional use of `console.log`
      "no-console": "error",
      // Prevent unintentional use of `debugger`
      "no-debugger": "error",
      // We do want to discourage the usage of flushSync
      "@eslint-react/dom-no-flush-sync": "error",
      // This was giving false positives
      "@eslint-react/no-unused-class-component-members": "off",
      // This was giving false positives
      "@eslint-react/use-state": "off",
      // Turning off for now until we have clearer guidance on how to fix existing usages
      "@eslint-react/set-state-in-effect": "off",
      // We don't want to warn about empty fragments
      "@eslint-react/jsx-no-useless-fragment": "off",
      // Prevent context values from being recreated on every render
      "@eslint-react/no-unstable-context-value": "error",
      // We want to enforce display names for context providers for better debugging
      "@eslint-react/no-missing-context-display-name": "error",
      // New rules in @eslint-react v4/v5 — disable until existing violations are addressed
      "@eslint-react/exhaustive-deps": "off",
      // TypeScript rules with type-checking
      // We want to use these, but we have far too many instances of these rules
      // for it to be realistic right now. Over time, we should fix these.
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/unbound-method": "off",
      // Some of these are being caught erroneously
      "@typescript-eslint/camelcase": "off",
      // Empty interfaces are ok
      "@typescript-eslint/no-empty-interface": "off",
      // Empty functions are ok
      "@typescript-eslint/no-empty-function": "off",
      // We prefer not using `any`, but don't disallow it
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // Don't warn about unused function params
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "all",
          ignoreRestSiblings: false,
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // It's safe to use functions before they're defined
      "@typescript-eslint/no-use-before-define": ["warn", { functions: false }],
      // Functions must have return types, but we allow inline function expressions to omit them
      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        { allowExpressions: true },
      ],
      // Disallow the @ts-ignore directive in favor of the more strict @ts-expect-error.
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": false,
          "ts-nocheck": false,
          "ts-check": false,
          "ts-ignore": true,
        },
      ],
      // We want this on
      "@typescript-eslint/no-non-null-assertion": "error",
      // Prefer optional chaining over && chains
      "@typescript-eslint/prefer-optional-chain": "error",
      // Ensure switch statements cover all possible enum/union values
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        {
          considerDefaultExhaustiveForUnions: true, // Allow default case for unions
        },
      ],
      // Flag class properties that are never modified and should be readonly
      "@typescript-eslint/prefer-readonly": "warn",
      // Ensure return await is used in try/catch for proper error stack traces
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
      // Permit for-of loops
      "no-restricted-syntax": [
        "error",
        "ForInStatement",
        "LabeledStatement",
        "WithStatement",
        {
          selector: "CallExpression[callee.name='withTheme']",
          message:
            "The use of withTheme HOC is not allowed for functional components. " +
            "Please use the useEmotionTheme hook instead.",
        },
      ],
      "no-restricted-globals": getNoRestrictedGlobals(),
      "no-restricted-properties": getNoRestrictedProperties(),
      // Imports should be `import "./FooModule"`, not `import "./FooModule.js"`
      // We need to configure this to check our .tsx files, see:
      // https://github.com/benmosher/eslint-plugin-import/issues/1615#issuecomment-577500405
      "import-x/extensions": [
        "error",
        "ignorePackages",
        {
          js: "never",
          jsx: "never",
          ts: "never",
          tsx: "never",
        },
      ],
      "import-x/prefer-default-export": "off",
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
      "import-x/order": [
        "error",
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
            {
              pattern: "~lib/**",
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
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "streamlit-custom/no-hardcoded-theme-values": "error",
      "streamlit-custom/use-strict-null-equality-checks": "error",
      // We only turn this rule on for certain directories
      "streamlit-custom/enforce-memo": "off",
      "streamlit-custom/no-force-reflow-access": "error",
      "streamlit-custom/no-aria-hidden-with-focusable-children": "error",
      "no-restricted-imports": getNoRestrictedImports(),
      // React hooks rules
      ...reactHooks.configs.flat.recommended.rules,
      // New React Compiler rules in react-hooks v7.1 — disable until existing
      // violations are addressed. Only rules-of-hooks and exhaustive-deps were
      // previously enforced.
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      // Enforce "You Might Not Need an Effect" pattern - don't derive state in effects
      "react-hooks/no-deriving-state-in-effects": "error",
      // jsx-a11y rules
      ...jsxA11y.flatConfigs.recommended.rules,
      // prohibit autoFocus prop
      // https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-autofocus.md
      "jsx-a11y/no-autofocus": ["error", { ignoreNonDOM: true }],
      // Stricter a11y enforcement beyond the recommended ruleset:
      // - Require accessible names for icon-only controls
      "jsx-a11y/control-has-associated-label": "error",
      // - Do not hide focusable controls from assistive technology
      "jsx-a11y/no-aria-hidden-on-focusable": "error",
      // - Avoid making non-interactive elements keyboard-focusable via tabIndex>=0
      "jsx-a11y/no-noninteractive-tabindex": "error",
    },
    settings: {
      "import-x/resolver": {
        typescript: {
          // Use project service for import resolution as well
          project: path.resolve(__dirname, "./tsconfig.json"),
        },
      },
    },
  },
  {
    files: ["**/src/**/*.ts", "**/src/**/*.tsx"],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-globals": getNoRestrictedGlobals({
        includeUseTimeout: true,
      }),
      "no-restricted-properties": getNoRestrictedProperties({
        includeUseTimeout: true,
      }),
    },
  },
  // Test files specific configuration
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    ...testingLibrary.configs["flat/react"],
    plugins: {
      ...testingLibrary.configs["flat/react"].plugins,
      "testing-library": testingLibrary,
      vitest,
    },
    rules: {
      // Recommended vitest configuration to enforce good testing practices
      ...vitest.configs.recommended.rules,
      // Allow hardcoded styles in test files
      "streamlit-custom/no-hardcoded-theme-values": "off",
      // Allow force reflow access in test files
      "streamlit-custom/no-force-reflow-access": "off",

      // Testing library rules
      "testing-library/prefer-user-event": "error",
      // Prefer screen.getBy* over destructured queries for consistency
      "testing-library/prefer-screen-queries": "warn",
      // Prefer findBy* over waitFor + getBy* patterns
      "testing-library/prefer-find-by": "error",
      // Enforce consistent use of it() over test()
      "vitest/consistent-test-it": ["error", { fn: "it" }],
      "no-restricted-imports": getNoRestrictedImports([], true),
    },
  },
  // Specific test files that need to access window.__streamlit for testing the config module itself
  {
    files: ["utils/src/config/index.test.ts", "lib/src/theme/utils.test.ts"],
    rules: {
      // These test files need to set window.__streamlit to test the config capture behavior
      "no-restricted-properties": getNoRestrictedProperties({
        allowWindowStreamlit: true,
      }),
    },
  },
  // Config module - allow direct window.__streamlit access for capturing values
  {
    files: ["utils/src/config/index.ts"],
    rules: {
      // This is the only place where direct window.__streamlit access is allowed
      // as it captures values at module load time and exports frozen copies.
      // Other restrictions (innerWidth, innerHeight, clipboard) still apply.
      "no-restricted-properties": getNoRestrictedProperties({
        allowWindowStreamlit: true,
      }),
    },
  },
  // Theme files specific configuration
  {
    files: ["lib/src/theme/**/*"],
    rules: {
      // Allow hardcoded styles in theme definitions
      "streamlit-custom/no-hardcoded-theme-values": "off",
    },
  },
  // Elements and widgets components
  {
    files: ["**/components/elements/**/*", "**/components/widgets/**/*"],
    rules: {
      "streamlit-custom/enforce-memo": "error",
    },
  },
  // Styled components files
  {
    files: ["**/styled-components.ts", "**/styled-components.tsx"],
    rules: {
      // It is okay for Emotion to use template expressions with complex stringified types
      "@typescript-eslint/restrict-template-expressions": "off",
    },
  },
  // Globally ignored file/directory patterns
  globalIgnores([
    "eslint.config.mjs",
    "app/eslint.config.mjs",
    "vitest.config.ts",
    "vitest.setup.ts",
    "**/vite.config.ts",
    "lib/src/proto.js",
    "lib/src/proto.d.ts",
    "**/node_modules/*",
    "**/dist/*",
    "**/build/*",
  ]),
])
