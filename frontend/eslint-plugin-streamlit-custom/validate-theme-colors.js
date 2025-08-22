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

// Cache the result since file analysis is expensive
let cachedValidColors = null

/**
 * Utility functions for file parsing
 */
const FileUtils = {
  /**
   * Read a TypeScript file
   */
  readTsFile(filePath) {
    try {
      return fs.readFileSync(filePath, "utf8")
    } catch (error) {
      throw new Error(`Failed to read ${filePath}: ${error.message}`)
    }
  },

  /**
   * Extract object properties from "const objectName = { ... }" pattern
   */
  extractObjectProperties(content, objectName) {
    const objectPattern = new RegExp(
      `(?:export\\s+)?const\\s+${objectName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\}`,
      "m"
    )
    const match = content.match(objectPattern)
    if (!match) return []

    const propertyPattern = /\s*(\w+):/g
    const properties = []
    let propMatch
    while ((propMatch = propertyPattern.exec(match[1])) !== null) {
      const propName = propMatch[1].trim()
      if (propName && !propName.startsWith("//")) {
        properties.push(propName)
      }
    }
    return properties
  },

  /**
   * Extract interface properties from "interface InterfaceName { ... }" pattern
   */
  extractInterfaceProperties(content, interfaceName) {
    const interfacePattern = new RegExp(
      `interface\\s+${interfaceName}\\s*\\{([\\s\\S]*?)\\n\\}`,
      "m"
    )
    const match = content.match(interfacePattern)
    if (!match) return []

    const optionalPropPattern = /\s*(\w+)\?\s*:\s*[^,\n]+/g
    const properties = []
    let propMatch
    while ((propMatch = optionalPropPattern.exec(match[1])) !== null) {
      const propName = propMatch[1].trim()
      if (propName && !propName.startsWith("//")) {
        properties.push(propName)
      }
    }
    return properties
  },

  /**
   * Extract type definition properties from "export type TypeName = { ... }" pattern
   */
  extractTypeProperties(content, typeName) {
    const typePattern = new RegExp(
      `export\\s+type\\s+${typeName}\\s*=\\s*\\{([\\s\\S]*?)\\}`,
      "m"
    )
    const match = content.match(typePattern)
    if (!match) return []

    const propertyPattern = /^\s*(\w+):\s*\w+/gm
    const properties = []
    let propMatch
    while ((propMatch = propertyPattern.exec(match[1])) !== null) {
      const propName = propMatch[1].trim()
      if (propName && !propName.startsWith("//")) {
        properties.push(propName)
      }
    }
    return properties
  },

  /**
   * Extract function call parameter
   */
  extractFunctionCallParam(content, functionName) {
    const callPattern = new RegExp(`${functionName}\\(([^)]+)\\)`)
    const match = content.match(callPattern)
    return match ? match[1].trim() : null
  },

  /**
   * Extract import statement
   */
  extractImport(content, importName) {
    const importPattern = new RegExp(
      `import\\s+${importName}\\s+from\\s+["']([^"']+)["']`
    )
    const match = content.match(importPattern)
    return match ? match[1] : null
  },

  /**
   * Extract return object properties from function
   */
  extractFunctionReturnProperties(content, functionName) {
    const functionPattern = new RegExp(
      `export\\s+const\\s+${functionName}\\s*=[\\s\\S]*?return\\s*\\{([\\s\\S]*?)\\n\\}`,
      "m"
    )
    const match = content.match(functionPattern)
    if (!match) return []

    const propertyPattern = /\s*(\w+):\s*[^,\n]+/g
    const properties = []
    let propMatch
    while ((propMatch = propertyPattern.exec(match[1])) !== null) {
      const propName = propMatch[1].trim()
      if (propName && !propName.startsWith("//")) {
        properties.push(propName)
      }
    }
    return properties
  },
}

/**
 * Theme color analysis functions
 */
const ThemeAnalysis = {
  basePath: path.resolve(__dirname, "../lib/src/theme"),

  /**
   * Get primitive colors from colors.ts
   */
  getPrimitiveColors() {
    const colorsPath = path.join(this.basePath, "primitives/colors.ts")
    const content = FileUtils.readTsFile(colorsPath)
    return FileUtils.extractObjectProperties(content, "colors")
  },

  /**
   * Get base theme colors (required + optional)
   */
  getBaseThemeColors() {
    const colors = []

    // Read the base theme file to find what gets passed to createEmotionColors
    const baseThemePath = path.join(this.basePath, "emotionBaseTheme/index.ts")
    const baseThemeContent = FileUtils.readTsFile(baseThemePath)

    const createEmotionParam = FileUtils.extractFunctionCallParam(
      baseThemeContent,
      "createEmotionColors"
    )

    if (createEmotionParam) {
      const importPath = FileUtils.extractImport(
        baseThemeContent,
        createEmotionParam
      )
      if (importPath) {
        const colorsFilePath = path.resolve(
          path.dirname(baseThemePath),
          importPath + ".ts"
        )
        const colorsContent = FileUtils.readTsFile(colorsFilePath)

        // Add primitive colors if included
        if (colorsContent.includes("...colors")) {
          colors.push(...this.getPrimitiveColors())
        }

        // Add required theme colors
        colors.push(
          ...FileUtils.extractObjectProperties(
            colorsContent,
            "requiredThemeColors"
          )
        )

        // Add optional theme colors
        colors.push(
          ...FileUtils.extractInterfaceProperties(
            colorsContent,
            "OptionalThemeColors"
          )
        )
      }
    }

    return colors
  },

  /**
   * Get derived colors from DerivedColors type
   */
  getDerivedColors() {
    const getColorsPath = path.join(this.basePath, "getColors.ts")
    const content = FileUtils.readTsFile(getColorsPath)
    return FileUtils.extractTypeProperties(content, "DerivedColors")
  },

  /**
   * Get additional colors from createEmotionColors function
   */
  getEmotionColors() {
    const getColorsPath = path.join(this.basePath, "getColors.ts")
    const content = FileUtils.readTsFile(getColorsPath)
    return FileUtils.extractFunctionReturnProperties(
      content,
      "createEmotionColors"
    )
  },

  /**
   * Get exception colors not defined in our theme
   * TODO: (mgbarnes) Remove remaining exception
   */
  getTemporaryColors() {
    return [
      "progressbarTrackFill", // Used in ProgressBar (accessed from baseui theme overrides, not directly from theme)
    ]
  },
}

/**
 * Main function to get all valid theme colors
 */
function getValidThemeColors() {
  if (cachedValidColors) {
    return cachedValidColors
  }

  try {
    const allColors = new Set()

    // Collect all color types
    const colorSources = [
      ThemeAnalysis.getBaseThemeColors(),
      ThemeAnalysis.getDerivedColors(),
      ThemeAnalysis.getEmotionColors(),
      ThemeAnalysis.getTemporaryColors(),
    ]

    colorSources.forEach(colors => {
      colors.forEach(color => allColors.add(color))
    })

    cachedValidColors = allColors
    return allColors
  } catch (error) {
    console.error(
      "Failed to analyze theme colors - ESLint rule disabled:",
      error.message
    )
    return new Set() // Disable validation on error
  }
}

/**
 * Color validation utilities
 */
const ColorValidation = {
  /**
   * Check if a color name contains "grey" and convert it to "gray"
   */
  getGraySuggestion(colorName) {
    if (/grey/i.test(colorName)) {
      const grayVersion = colorName.replace(/grey/gi, "gray")
      if (getValidThemeColors().has(grayVersion)) {
        return grayVersion
      }
    }
    return null
  },

  /**
   * Array/object methods that should not trigger validation
   */
  excludedMethods: new Set([
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
  ]),
}

/**
 * ESLint rule implementation
 */
function createRule(context) {
  const validColors = getValidThemeColors()

  function checkMemberExpression(node) {
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
    else if (
      node.object &&
      node.object.type === "Identifier" &&
      node.object.name === "colors" &&
      node.property &&
      node.property.type === "Identifier" &&
      !ColorValidation.excludedMethods.has(node.property.name)
    ) {
      colorName = node.property.name
      isValidPattern = true
    }

    if (isValidPattern && colorName && !validColors.has(colorName)) {
      // Check if this might be a "grey" typo that should be "gray"
      const graySuggestion = ColorValidation.getGraySuggestion(colorName)

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
  }

  return {
    MemberExpression: checkMemberExpression,
  }
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
  create: createRule,
}
