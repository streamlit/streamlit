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

import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils"

import { createRule } from "./utils/createRule"

type MessageIds = "noFractionalRenderingThemeToken"

/**
 * Base font size used for rem->px conversion when validating pixel alignment.
 *
 * This rule enforces alignment at Streamlit's default root size so critical
 * tokens produce crisp defaults without forbidding rem-based authoring.
 */
const BASE_FONT_SIZE_PX = 16
const EPSILON = 0.000_001

/**
 * Rendering-critical token groups guarded by this rule.
 *
 * - `iconSizes`: all icon sizes are validated because icon glyphs are among the
 *   most sensitive surfaces for blur.
 * - `sizes.focusRingWidth` and `sizes.defaultStrokeWidth`: focus rings and
 *   icon strokes should resolve to whole pixels at the default base size.
 *
 * Additional token families can be added here as we expand coverage.
 */
const RENDERING_CRITICAL_TOKEN_KEYS: Record<string, Set<string> | "all"> = {
  iconSizes: "all",
  sizes: new Set(["focusRingWidth", "defaultStrokeWidth"]),
}

function isIntegerWithinTolerance(value: number): boolean {
  return Math.abs(value - Math.round(value)) < EPSILON
}

function isPixelAlignedLength(value: string): boolean {
  const normalized = value.trim()
  const remMatch = normalized.match(/^(-?\d+(?:\.\d+)?)rem$/)
  if (remMatch) {
    const remValue = Number(remMatch[1])
    return isIntegerWithinTolerance(remValue * BASE_FONT_SIZE_PX)
  }

  const pxMatch = normalized.match(/^(-?\d+(?:\.\d+)?)px$/)
  if (pxMatch) {
    const pxValue = Number(pxMatch[1])
    return isIntegerWithinTolerance(pxValue)
  }

  return false
}

function getPropertyName(
  node: TSESTree.Property
): string | number | undefined {
  if (node.key.type === AST_NODE_TYPES.Identifier) {
    return node.key.name
  }
  if (
    node.key.type === AST_NODE_TYPES.Literal &&
    (typeof node.key.value === "string" || typeof node.key.value === "number")
  ) {
    return node.key.value
  }
  return undefined
}

function getConstantValue(node: TSESTree.Node): string | number | undefined {
  if (
    node.type === AST_NODE_TYPES.Literal &&
    (typeof node.value === "string" || typeof node.value === "number")
  ) {
    return node.value
  }

  if (
    node.type === AST_NODE_TYPES.TemplateLiteral &&
    node.expressions.length === 0
  ) {
    return node.quasis[0]?.value.cooked ?? undefined
  }

  return undefined
}

function shouldCheckToken(
  variableName: string,
  tokenKey: string | number | undefined
): tokenKey is string {
  if (typeof tokenKey !== "string") {
    return false
  }

  const config = RENDERING_CRITICAL_TOKEN_KEYS[variableName]
  if (!config) {
    return false
  }

  return config === "all" || config.has(tokenKey)
}

const noFractionalRenderingThemeTokens = createRule<[], MessageIds>({
  name: "no-fractional-rendering-theme-tokens",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow fractional rendering-critical theme tokens that resolve to non-integer pixels.",
    },
    fixable: undefined,
    schema: [],
    messages: {
      noFractionalRenderingThemeToken:
        "Rendering-critical token '{{tokenName}}' has non-pixel-aligned value '{{value}}'. Use a value that resolves to whole pixels at 16px base font size.",
    },
  },
  defaultOptions: [],
  /**
   * Disallow fractional values for rendering-critical theme tokens.
   *
   * Motivation:
   * Many primitives (icons, strokes, focus rings) are rendered at small sizes
   * where fractional CSS pixels frequently blur edges or produce inconsistent
   * anti-aliasing across browsers, zoom levels, and DPRs.
   *
   * What this catches:
   * - Non-integer numeric literals for guarded numeric tokens
   * - `rem`/`px` string literals that resolve to non-integer pixels at 16px base
   *
   * Examples:
   * - Bad: `iconSizes.md = "0.9rem"` (14.4px)
   * - Bad: `sizes.defaultStrokeWidth = 2.25`
   * - Good: `iconSizes.md = "0.875rem"` (14px)
   * - Good: `sizes.focusRingWidth = "0.1875rem"` (3px)
   *
   * Scope intentionally focuses on static token declarations in primitive
   * objects. Dynamic/computed values are skipped to minimize false positives.
   */
  create(context) {
    return {
      VariableDeclarator(node): void {
        if (
          node.id.type !== AST_NODE_TYPES.Identifier ||
          node.init?.type !== AST_NODE_TYPES.ObjectExpression
        ) {
          return
        }

        const variableName = node.id.name
        if (!(variableName in RENDERING_CRITICAL_TOKEN_KEYS)) {
          return
        }

        node.init.properties.forEach(property => {
          if (property.type !== AST_NODE_TYPES.Property) {
            return
          }

          const tokenKey = getPropertyName(property)
          if (!shouldCheckToken(variableName, tokenKey)) {
            return
          }

          const value = getConstantValue(property.value)
          if (value === undefined) {
            return
          }

          const isValid =
            typeof value === "number"
              ? isIntegerWithinTolerance(value)
              : isPixelAlignedLength(value)

          if (isValid) {
            return
          }

          context.report({
            node: property.value,
            messageId: "noFractionalRenderingThemeToken",
            data: {
              tokenName: `${variableName}.${tokenKey}`,
              value: String(value),
            },
          })
        })
      },
    }
  },
})

export default noFractionalRenderingThemeTokens
