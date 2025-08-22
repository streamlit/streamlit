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

const { RuleTester } = require("eslint")
const rule = require("./validate-theme-colors")

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
})

ruleTester.run("validate-theme-colors", rule, {
  valid: [
    // Valid color access

    // Sample of color primitives
    "theme.colors.gray10",
    "theme.colors.red20",
    "theme.colors.orange30",
    "theme.colors.yellow40",
    "theme.colors.green50",
    "theme.colors.blueGreen60",
    "theme.colors.lightBlue70",
    "theme.colors.blue80",
    "theme.colors.purple90",

    // Derived colors
    "theme.colors.fadedText05",
    "theme.colors.fadedText10",
    "theme.colors.fadedText20",
    "theme.colors.fadedText40",
    "theme.colors.fadedText60",
    "theme.colors.bgMix",
    "theme.colors.darkenedBgMix100",
    "theme.colors.darkenedBgMix25",
    "theme.colors.darkenedBgMix15",
    "theme.colors.lightenedBg05",

    // Sample of base theme colors
    "theme.colors.bgColor",
    "theme.colors.secondaryBg",
    "theme.colors.bodyText",
    "theme.colors.primary",
    "theme.colors.secondary",
    "theme.colors.disabled",
    "theme.colors.link",
    // optional
    "theme.colors.widgetBorderColor",

    // Sample of createEmotionColors additional colors
    "theme.colors.codeTextColor",
    "theme.colors.codeBackgroundColor",
    "theme.colors.borderColor",
    "theme.colors.borderColorLight",
    "theme.colors.dataframeBorderColor",
    "theme.colors.dataframeHeaderBackgroundColor",
    "theme.colors.headingColor",
    "theme.colors.chartCategoricalColors",
    "theme.colors.chartSequentialColors",

    // Array methods should not trigger false positives
    "colors.map(x => x)",
    "colors.filter(x => x)",
    "colors.forEach(x => x)",
    "colors.find(x => x)",
    "colors.some(x => x)",
    "colors.every(x => x)",
    "colors.reduce((a, b) => a + b)",
    "colors.length",
    "colors.push(item)",
    "colors.pop()",
    "colors.slice(0, 1)",
    "colors.indexOf('red')",
    "colors.includes('blue')",
    "colors.join(',')",

    // Non-theme color access should be ignored
    "theme.otherProperty.gray90",
  ],

  invalid: [
    // Invalid color - typo
    {
      code: "theme.colors.grey90",
      errors: [
        {
          messageId: "typoSuggestion",
          data: { colorName: "grey90", suggestion: "gray90" },
        },
      ],
    },

    {
      code: "colors.grey90",
      errors: [
        {
          messageId: "typoSuggestion",
          data: { colorName: "grey90", suggestion: "gray90" },
        },
      ],
    },

    // Another typo
    {
      code: "theme.colors.GREY10",
      errors: [
        {
          messageId: "typoSuggestion",
          data: { colorName: "GREY10", suggestion: "gray10" },
        },
      ],
    },

    {
      code: "colors.GREY10",
      errors: [
        {
          messageId: "typoSuggestion",
          data: { colorName: "GREY10", suggestion: "gray10" },
        },
      ],
    },

    // Invalid color - doesn't exist
    {
      code: "theme.colors.invalidColor",
      errors: [
        {
          messageId: "invalidColor",
          data: { colorName: "invalidColor" },
        },
      ],
    },

    {
      code: "colors.invalidColor",
      errors: [
        {
          messageId: "invalidColor",
          data: { colorName: "invalidColor" },
        },
      ],
    },
  ],
})
