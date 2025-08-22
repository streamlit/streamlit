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

/**
 * ESLint rule to validate theme color access.
 * Prevents access to non-existent theme colors in both patterns:
 * - theme.colors.invalidColor
 * - colors.invalidColor (direct import usage)
 */

const fs = require("fs")
const path = require("path")

/**
 * Handle dynamic analysis of theme colors.
 */
function getValidThemeColors() {
  try {
    const colors = new Set()

    // 1. Get base colors that are passed to createEmotionColors
    const baseColors = getBaseThemeColors()
    baseColors.forEach(color => colors.add(color))

    // 2. Analyze createEmotionColors to see what it adds
    const computedColors = analyzeCreateEmotionColors()
    computedColors.forEach(color => colors.add(color))

    // TODO (mgbarnes): Move to valid theme colors
    const remainingColors = [
      "text", // Used in BaseButton but not properly defined
      "primaryBg", // Used in MainMenu but not properly defined
      "progressbarTrackFill", // Used in ProgressBar but can probably transition to actual theme color
    ]
    remainingColors.forEach(color => colors.add(color))

    return colors
  } catch (error) {
    console.error("Failed to analyze theme colors - ESLint rule disabled")
    return new Set() // Disable validation entirely
  }
}

/**
 * Get the base colors that are passed to createEmotionColors.
 * This analyzes the actual theme structure.
 */
function getBaseThemeColors() {
  const colors = new Set()

  // Read the base theme file to see what gets passed to createEmotionColors
  const baseThemePath = path.resolve(
    __dirname,
    "../lib/src/theme/emotionBaseTheme/index.ts"
  )
  const baseThemeContent = fs.readFileSync(baseThemePath, "utf8")

  // Find: colors: createEmotionColors(genericColors)
  const colorsCallMatch = baseThemeContent.match(
    /colors:\s*createEmotionColors\(([^)]+)\)/
  )
  if (colorsCallMatch) {
    const paramName = colorsCallMatch[1].trim()

    // Find where this parameter is imported/defined
    const importMatch = baseThemeContent.match(
      new RegExp(`import\\s+${paramName}\\s+from\\s+["']([^"']+)["']`)
    )
    if (importMatch) {
      const importPath = importMatch[1]
      const fullPath = path.resolve(
        path.dirname(baseThemePath),
        importPath + ".ts"
      )

      // Read the colors file
      const colorsContent = fs.readFileSync(fullPath, "utf8")

      // The file exports: export default { ...colors, ...requiredThemeColors, ...optionalThemeColors }
      // So we need to get all the spread objects

      // Get primitive colors
      if (colorsContent.includes("...colors")) {
        const primitiveColors = getPrimitiveColors()
        primitiveColors.forEach(color => colors.add(color))
      }

      // Get required theme colors
      const requiredMatch = colorsContent.match(
        /const requiredThemeColors = \{([\s\S]*?)\n\}/m
      )
      if (requiredMatch) {
        const props = requiredMatch[1].match(/\s*(\w+):\s*[^,\n]+,?/g)
        if (props) {
          props.forEach(prop => {
            const propName = prop.trim().split(":")[0].trim()
            if (propName && !propName.startsWith("//")) {
              colors.add(propName)
            }
          })
        }
      }

      // Get optional theme colors from the interface
      const optionalMatch = colorsContent.match(
        /interface OptionalThemeColors \{([\s\S]*?)\n\}/m
      )
      if (optionalMatch) {
        const props = optionalMatch[1].match(/\s*(\w+)\?\s*:\s*[^,\n]+/g)
        if (props) {
          props.forEach(prop => {
            const propName = prop.trim().split("?")[0].trim()
            if (propName && !propName.startsWith("//")) {
              colors.add(propName)
            }
          })
        }
      }
    }
  }

  return colors
}

/**
 * Get primitive colors from colors.ts
 */
function getPrimitiveColors() {
  const colors = new Set()
  const colorsPath = path.resolve(
    __dirname,
    "../lib/src/theme/primitives/colors.ts"
  )
  const colorsContent = fs.readFileSync(colorsPath, "utf8")

  const colorsMatch = colorsContent.match(
    /export const colors = \{([\s\S]*?)\n\}/m
  )
  if (colorsMatch) {
    const colorProps = colorsMatch[1].match(/^\s*(\w+):\s*"[^"]+",?$/gm)
    if (colorProps) {
      colorProps.forEach(prop => {
        const colorName = prop.trim().split(":")[0].trim()
        if (colorName) colors.add(colorName)
      })
    }
  }

  return colors
}

/**
 * This is the key insight: Analyze createEmotionColors to see what it computes.
 * We don't execute it, we analyze its structure - just like @typescript-eslint does.
 */
function analyzeCreateEmotionColors() {
  const colors = new Set()
  const getColorsPath = path.resolve(
    __dirname,
    "../lib/src/theme/getColors.ts"
  )
  const getColorsContent = fs.readFileSync(getColorsPath, "utf8")

  // 1. Find the DerivedColors type to see what computeDerivedColors produces
  const derivedTypeMatch = getColorsContent.match(
    /export type DerivedColors = \{([\s\S]*?)\}/m
  )
  if (derivedTypeMatch) {
    const derivedProps = derivedTypeMatch[1].match(/^\s*(\w+):\s*string$/gm)
    if (derivedProps) {
      derivedProps.forEach(prop => {
        const propName = prop.trim().split(":")[0].trim()
        if (propName) colors.add(propName)
      })
    }
  }

  // 2. Analyze the return statement of createEmotionColors function specifically
  const createEmotionColorsMatch = getColorsContent.match(
    /export const createEmotionColors = [\s\S]*?return \{([\s\S]*?)\n\}/m
  )
  if (createEmotionColorsMatch) {
    const returnContent = createEmotionColorsMatch[1]

    // Find explicit property assignments (not spread operators)
    const explicitProps = returnContent.match(/\s*(\w+):\s*[^,\n]+,?/g)

    if (explicitProps) {
      explicitProps.forEach(prop => {
        const propName = prop.trim().split(":")[0].trim()
        if (propName && !propName.startsWith("//")) {
          colors.add(propName)
        }
      })
    }
  }

  return colors
}

// Get valid colors by analyzing the actual code structure
const VALID_THEME_COLORS = getValidThemeColors()

/**
 * Check if a color name contains "grey" and convert it to the "gray" equivalent
 */
function getGraySuggestion(colorName) {
  // Check if the color contains "grey" (case-insensitive)
  if (/grey/i.test(colorName)) {
    // Convert all variations of "grey" to "gray" (lowercase)
    const grayVersion = colorName.replace(/grey/gi, "gray")

    // Check if this gray version exists in our valid colors
    if (VALID_THEME_COLORS.has(grayVersion)) {
      return grayVersion
    }
  }
  return null
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Validate theme color access",
      category: "Best Practices",
      recommended: true,
    },
    messages: {
      invalidColor:
        'Invalid theme color "{{colorName}}". This color does not exist in the theme.',
      typoSuggestion:
        'Invalid theme color "{{colorName}}". Did you mean "{{suggestion}}"?',
    },
    schema: [],
  },

  create(context) {
    return {
      MemberExpression(node) {
        let colorName = null
        let isValidPattern = false

        // Check for theme.colors.colorName pattern
        if (
          node.object &&
          node.object.type === "MemberExpression" &&
          node.object.property &&
          node.object.property.name === "colors" &&
          node.property &&
          node.property.type === "Identifier"
        ) {
          colorName = node.property.name
          isValidPattern = true
        }
        // Check for colors.colorName pattern (direct import usage)
        // But exclude common array/object methods to avoid false positives
        else if (
          node.object &&
          node.object.type === "Identifier" &&
          node.object.name === "colors" &&
          node.property &&
          node.property.type === "Identifier" &&
          // Exclude common array/object methods
          ![
            "map",
            "filter",
            "forEach",
            "find",
            "some",
            "every",
            "reduce",
            "length",
            "push",
            "pop",
            "shift",
            "unshift",
            "slice",
            "splice",
            "indexOf",
            "includes",
            "join",
            "toString",
            "valueOf",
            "hasOwnProperty",
            "propertyIsEnumerable",
            "isPrototypeOf",
            "toLocaleString",
          ].includes(node.property.name)
        ) {
          colorName = node.property.name
          isValidPattern = true
        }

        if (
          isValidPattern &&
          colorName &&
          !VALID_THEME_COLORS.has(colorName)
        ) {
          // Check if this might be a "grey" typo that should be "gray"
          const graySuggestion = getGraySuggestion(colorName)

          if (graySuggestion) {
            context.report({
              node: node.property,
              messageId: "typoSuggestion",
              data: { colorName, suggestion: graySuggestion },
            })
          } else {
            context.report({
              node: node.property,
              messageId: "invalidColor",
              data: { colorName },
            })
          }
        }
      },
    }
  },
}
