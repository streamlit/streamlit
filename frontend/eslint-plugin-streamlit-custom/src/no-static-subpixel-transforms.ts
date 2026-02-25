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

type MessageIds = "noStaticSubpixelTransform"

/**
 * Transform patterns that are high-risk for subpixel blur in static layout.
 *
 * Why these:
 * - `translateY(-50%)` / `translateY(50%)` often land on fractional pixels.
 * - Tiny negative em nudges (for icon/text alignment) are almost always
 *   fractional and produce browser-dependent crispness.
 *
 * We intentionally do NOT ban all transforms because transform-based animation
 * (e.g. `scale`, `opacity` transitions) is still a valid and recommended
 * performance pattern.
 */
const DISALLOWED_TRANSFORM_PATTERNS = [
  /translateY\(\s*-50%\s*\)/i,
  /translateY\(\s*50%\s*\)/i,
  /translateY\(\s*-(?:\d+\.\d+|0?\.\d+)em\s*\)/i,
]

function isDisallowedTransform(value: string): boolean {
  return DISALLOWED_TRANSFORM_PATTERNS.some(pattern => pattern.test(value))
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

function getStaticStringValue(node: TSESTree.Node): string | undefined {
  if (node.type === AST_NODE_TYPES.Literal && typeof node.value === "string") {
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

const noStaticSubpixelTransforms = createRule<[], MessageIds>({
  name: "no-static-subpixel-transforms",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow static subpixel transform nudges that commonly blur rendering.",
    },
    fixable: undefined,
    schema: [],
    messages: {
      noStaticSubpixelTransform:
        "Avoid static transform '{{transform}}'. Prefer layout alignment (flex/grid/line-height), or use an explicit eslint disable when required.",
    },
  },
  defaultOptions: [],
  /**
   * Prevent static transform nudges that are known to cause blurry rendering.
   *
   * This rule is designed to catch alignment hacks where `transform` is used to
   * "nudge" steady-state UI into place. These hacks are fragile across zoom
   * levels and device pixel ratios, and commonly regress visual sharpness.
   *
   * What this catches:
   * - Object-style declarations, e.g. `{ transform: "translateY(-50%)" }`
   * - Styled template declarations, e.g. ``transform: translateY(-0.1em);``
   *
   * What this encourages:
   * - Layout-based alignment (flex/grid/line-height/padding/insets)
   * - Explicit opt-out with eslint-disable comments when a true exception is needed
   *
   * Examples:
   * - Bad: `transform: "translateY(-50%)"`
   * - Bad: `transform: "translateY(-0.05em)"`
   * - Good: `display: "flex", alignItems: "center"`
   * - Good: `top: inset; bottom: inset; display: "flex"; alignItems: "center"`
   */
  create(context) {
    function checkStyleProperty(node: TSESTree.Property): void {
      const propertyName = getPropertyName(node)
      if (propertyName !== "transform") {
        return
      }

      const value = getStaticStringValue(node.value)
      if (!value || !isDisallowedTransform(value)) {
        return
      }

      context.report({
        node: node.value,
        messageId: "noStaticSubpixelTransform",
        data: {
          transform: value,
        },
      })
    }

    function checkTemplateExpression(
      node: TSESTree.TaggedTemplateExpression
    ): void {
      if (
        node.tag.type !== AST_NODE_TYPES.MemberExpression ||
        node.tag.object.type !== AST_NODE_TYPES.Identifier ||
        node.tag.object.name !== "styled"
      ) {
        return
      }

      node.quasi.quasis.forEach(quasi => {
        const raw = quasi.value.raw
        const matches = raw.matchAll(/transform\s*:\s*([^;]+)/gi)

        for (const match of matches) {
          const transform = match[1]?.trim()
          if (transform && isDisallowedTransform(transform)) {
            context.report({
              node: quasi,
              messageId: "noStaticSubpixelTransform",
              data: {
                transform,
              },
            })
          }
        }
      })
    }

    return {
      Property: checkStyleProperty,
      TaggedTemplateExpression: checkTemplateExpression,
    }
  },
})

export default noStaticSubpixelTransforms
