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

import noHardcodedThemeValues from "./no-hardcoded-theme-values"
import { ruleTester } from "./utils/ruleTester"

ruleTester.run("no-hardcoded-theme-values", noHardcodedThemeValues, {
  valid: [
    {
      name: "theme value is allowed",
      code: "var a = { color: theme.colors.primary };",
    },
    {
      name: "zIndex is checked",
      code: "var a = { zIndex: theme.someZIndex };",
    },
    {
      name: "built-in values are allowed: 'auto'",
      code: "var a = { lineHeight: 'auto' };",
    },
    {
      name: "built-in values are allowed: 'transparent'",
      code: "var a = { lineHeight: 'transparent' };",
    },
    {
      name: "built-in values are allowed: 'solid'",
      code: "var a = { lineHeight: 'solid' };",
    },
    {
      name: "built-in values are allowed: 'initial'",
      code: "var a = { lineHeight: 'initial' };",
    },
    {
      name: "built-in values are allowed: 'none'",
      code: "var a = { lineHeight: 'none' };",
    },
    {
      name: "built-in values are allowed: 'collapse'",
      code: "var a = { border: 'collapse' };",
    },
    {
      name: "built-in values are allowed: 'fit-content'",
      code: "var a = { width: 'fit-content' };",
    },
    {
      name: "built-in values are allowed: 'inherit'",
      code: "var a = { lineHeight: 'inherit' };",
    },
    {
      name: "built-in values are allowed together with the '!important' directive: 'inherit !important'",
      code: "var a = { lineHeight: 'inherit !important' };",
    },
    {
      name: "number value of 0 is allowed",
      code: "var a = { color: theme.colors.primary, lineHeight: 0 };",
    },
    {
      name: "null is allowed",
      code: "var a = { lineHeight: null };",
    },
    {
      name: "undefined is allowed",
      code: "var a = { lineHeight: undefined };",
    },
    {
      name: "em, vh, vw, % units after numbers are allowed",
      code: "var a = { color: theme.colors.primary, height: '1em', maxHeight: '100vh', width: '42vw', maxWidth: '99%' };",
    },
    {
      name: "negative and decimal numbers with valid units are allowed",
      code: "var a = { color: theme.colors.primary, height: '1.0em', maxHeight: '0.09vh', width: '-4.2vw' };",
    },
    {
      name: "'small-caps' is allowed, which is used by fonts",
      code: "var a = { fontVariant: 'small-caps' };",
    },
    {
      name: "template strings with valid values are allowed",
      code: "var MyComponent = styled.div`color: theme.colors.primary; line-height: theme.lineHeights.body;`",
    },
    {
      name: "multiple numbers are allowed to account for shorthand assignment",
      code: "var a = { margin: '10em 0 30em 40em' };",
    },
  ],
  invalid: [
    {
      name: "color value should not be allowed",
      code: "var a = { color: 'red' };",
      errors: [{ messageId: "noHardcodedTheme" }],
    },
    {
      name: "color value and line-height number should not be allowed",
      code: "var a = { color: 'red', lineHeight: 1.5 };",
      errors: [
        { messageId: "noHardcodedTheme" },
        { messageId: "noHardcodedTheme" },
      ],
    },
    {
      name: "color value should not be allowed, but line-height value is allowed",
      code: "var a = { color: 'red', lineHeight: 'inherit' };",
      errors: [{ messageId: "noHardcodedTheme" }],
    },
    {
      name: "number should not be allowed",
      code: "var a = { margin: 40 };",
      errors: [{ messageId: "noHardcodedTheme" }],
    },
    {
      name: "zIndex is not allowed to have a number",
      code: "var a = { zIndex: 100 };",
      errors: [{ messageId: "noHardcodedTheme" }],
    },
    {
      name: "percentages in non-numbers are disallowed",
      code: "var a = { color: theme.colors.primary, lineHeight: 'sneaky-non-number%' };",
      errors: [{ messageId: "noHardcodedTheme" }],
    },
    {
      name: "rem unit with number is disallowed",
      code: "var a = { lineHeight: '1rem' };",
      errors: [{ messageId: "noHardcodedTheme" }],
    },
    {
      name: "hardcoded fonts are not allowed",
      code: "var a = { font: 'Helvetica, Calibri, Roboto, \"Open Sans\", Arial, sans-serif' };",
      errors: [{ messageId: "noHardcodedTheme" }],
    },
    {
      name: "template strings with hardcoded values are not allowed",
      code: "var MyComponent = styled.div`\n        color: 1px;\n        line-height: theme.lineHeights.body;\n        `",
      errors: [{ messageId: "noHardcodedThemeTemplate" }],
    },
  ],
})
