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

type Options = [
  {
    /**
     * Additional JSX component names that should be treated as focusable
     * (interactive). This is useful for components like TooltipIcon that render
     * a focusable trigger by default.
     */
    additionalFocusableComponents?: string[]
  }?,
]

type MessageIds = "ariaHiddenWithFocusableChildren"

const DEFAULT_FOCUSABLE_COMPONENTS = new Set([
  // Streamlit components that render focusable triggers by default.
  "TooltipIcon",
  "InlineTooltipIcon",
  "WidgetLabelHelpIcon",
  "WidgetLabelHelpIconInline",
  // Common Streamlit "button-like" components.
  "BaseButton",
])

function getJsxNameText(name: TSESTree.JSXTagNameExpression): string | null {
  if (name.type === AST_NODE_TYPES.JSXIdentifier) {
    return name.name
  }
  if (name.type === AST_NODE_TYPES.JSXMemberExpression) {
    // e.g. Foo.Bar -> "Foo.Bar"
    const object = getJsxNameText(name.object)
    if (object === null) {
      return null
    }
    const property = name.property.name
    return `${object}.${property}`
  }
  return null
}

function isAriaHiddenTruthy(attr: TSESTree.JSXAttribute): boolean {
  if (attr.value === null || attr.value === undefined) {
    // <div aria-hidden />
    return true
  }

  if (attr.value.type === AST_NODE_TYPES.Literal) {
    return attr.value.value === true || attr.value.value === "true"
  }

  if (attr.value.type === AST_NODE_TYPES.JSXExpressionContainer) {
    const expr = attr.value.expression
    if (
      expr.type === AST_NODE_TYPES.Literal &&
      (expr.value === true || expr.value === "true")
    ) {
      return true
    }
  }

  return false
}

function getJsxAttribute(
  node: TSESTree.JSXOpeningElement,
  attributeName: string
): TSESTree.JSXAttribute | null {
  for (const attr of node.attributes) {
    if (
      attr.type === AST_NODE_TYPES.JSXAttribute &&
      attr.name.type === AST_NODE_TYPES.JSXIdentifier &&
      attr.name.name === attributeName
    ) {
      return attr
    }
  }
  return null
}

function getTabIndexValue(
  openingElement: TSESTree.JSXOpeningElement
): number | null {
  const attr = getJsxAttribute(openingElement, "tabIndex")
  if (!attr) {
    return null
  }

  if (attr.value === null || attr.value === undefined) {
    // <div tabIndex /> is uncommon; treat as focusable.
    return 0
  }

  if (attr.value.type === AST_NODE_TYPES.Literal) {
    return typeof attr.value.value === "number" ? attr.value.value : null
  }

  if (attr.value.type === AST_NODE_TYPES.JSXExpressionContainer) {
    const expr = attr.value.expression
    if (
      expr.type === AST_NODE_TYPES.Literal &&
      typeof expr.value === "number"
    ) {
      return expr.value
    }
  }

  return null
}

function isFocusableHtmlTag(tagName: string): boolean {
  // This is intentionally conservative: we only include tags that are
  // unambiguously interactive/focusable in common usage.
  return (
    tagName === "button" ||
    tagName === "a" ||
    tagName === "input" ||
    tagName === "select" ||
    tagName === "textarea" ||
    tagName === "summary"
  )
}

function hasFocusableDescendant(
  node: TSESTree.JSXElement | TSESTree.JSXFragment,
  focusableComponents: Set<string>
): boolean {
  for (const child of node.children) {
    if (child.type === AST_NODE_TYPES.JSXElement) {
      const nameText = getJsxNameText(child.openingElement.name)
      if (nameText) {
        if (isFocusableHtmlTag(nameText.toLowerCase())) {
          return true
        }

        if (focusableComponents.has(nameText)) {
          return true
        }
      }

      const tabIndex = getTabIndexValue(child.openingElement)
      if (tabIndex !== null && tabIndex >= 0) {
        return true
      }

      // Recurse.
      if (hasFocusableDescendant(child, focusableComponents)) {
        return true
      }
    } else if (child.type === AST_NODE_TYPES.JSXFragment) {
      if (hasFocusableDescendant(child, focusableComponents)) {
        return true
      }
    }
  }

  return false
}

const noAriaHiddenWithFocusableChildren = createRule<Options, MessageIds>({
  name: "no-aria-hidden-with-focusable-children",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow aria-hidden on elements that contain focusable descendants",
    },
    schema: [
      {
        type: "object",
        properties: {
          additionalFocusableComponents: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      ariaHiddenWithFocusableChildren:
        "Do not set aria-hidden on a wrapper that contains focusable descendants. This hides interactive controls from assistive technology. Apply aria-hidden only to the specific visual text node instead (e.g. a <span>).",
    },
  },
  defaultOptions: [{}],
  create(context, [options]) {
    const focusableComponents = new Set(DEFAULT_FOCUSABLE_COMPONENTS)
    for (const name of options?.additionalFocusableComponents ?? []) {
      focusableComponents.add(name)
    }

    return {
      JSXElement(node) {
        const ariaHiddenAttr = getJsxAttribute(
          node.openingElement,
          "aria-hidden"
        )
        if (
          ariaHiddenAttr?.type !== AST_NODE_TYPES.JSXAttribute ||
          !isAriaHiddenTruthy(ariaHiddenAttr)
        ) {
          return
        }

        if (hasFocusableDescendant(node, focusableComponents)) {
          context.report({
            node: ariaHiddenAttr,
            messageId: "ariaHiddenWithFocusableChildren",
          })
        }
      },
    }
  },
})

export default noAriaHiddenWithFocusableChildren
