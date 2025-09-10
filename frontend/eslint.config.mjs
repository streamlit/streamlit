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

import path from "path"
import { fileURLToPath } from "url"
import { createJiti } from "jiti"

// Core ESLint and plugins
import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import react from "eslint-plugin-react"
import * as reactHooks from "eslint-plugin-react-hooks"
import eslintReact from "@eslint-react/eslint-plugin"
import importPlugin from "eslint-plugin-import"
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended"
import lodash from "eslint-plugin-lodash"
import vitest from "@vitest/eslint-plugin"
import testingLibrary from "eslint-plugin-testing-library"
import noRelativeImportPaths from "eslint-plugin-no-relative-import-paths"
import globals from "globals"
import { globalIgnores } from "eslint/config"
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

export default tseslint.config([
  // Base recommended configs
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  reactHooks.configs.recommended,
  eslintReact.configs["recommended-type-checked"],
  importPlugin.flatConfigs.recommended,
  eslintPluginPrettierRecommended,
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
      react,
      lodash,
      "no-relative-import-paths": noRelativeImportPaths,
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
      // We don't use PropTypes
      "react/prop-types": "off",
      // We don't escape entities
      "react/no-unescaped-entities": "off",
      // Opting into the latest react-compiler rules
      // @see https://react.dev/blog/2025/04/21/react-compiler-rc
      "react-hooks/react-compiler": "error",
      // We do want to discourage the usage of flushSync
      "@eslint-react/dom/no-flush-sync": "error",
      // This was giving false positives
      "@eslint-react/no-unused-class-component-members": "off",
      // This was giving false positives
      "@eslint-react/naming-convention/use-state": "off",
      // Helps us catch functions written as if they are hooks, but are not.
      "@eslint-react/hooks-extra/no-useless-custom-hooks": "error",
      // Turning off for now until we have clearer guidance on how to fix existing usages
      "@eslint-react/hooks-extra/no-direct-set-state-in-use-effect": "off",
      // We don't want to warn about empty fragments
      "@eslint-react/no-useless-fragment": "off",
      // We want to enforce display names for context providers for better debugging
      "@eslint-react/no-missing-context-display-name": "error",
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
        },
      ],
      // It's safe to use functions before they're defined
      "@typescript-eslint/no-use-before-define": [
        "warn",
        { functions: false },
      ],
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
      "no-restricted-globals": [
        "error",
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
      ],
      "no-restricted-properties": [
        "error",
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
      "no-restricted-imports": [
        "error",
        {
          paths: [
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
              message:
                "Please use the `AbortController` API instead of `CancelToken`",
            },
          ],
        },
      ],
      // React configuration
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      // React hooks rules
      ...reactHooks.configs.recommended.rules,
      // jsx-a11y rules
      ...jsxA11y.flatConfigs.recommended.rules,
      // prohibit autoFocus prop
      // https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-autofocus.md
      "jsx-a11y/no-autofocus": ["error", { ignoreNonDOM: true }],
    },
    settings: {
      react: {
        version: "detect",
      },
      "import/resolver": {
        typescript: {
          // Use project service for import resolution as well
          project: path.resolve(__dirname, "./tsconfig.json"),
        },
      },
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
    "lib/src/proto.js",
    "lib/src/proto.d.ts",
    "**/vendor/*",
    "**/node_modules/*",
    "**/dist/*",
    "**/build/*",
  ]),
])
