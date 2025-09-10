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

import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils"

import { createRule } from "./utils/createRule"

type MessageIds =
  | "noForceReflowProperty"
  | "noForceReflowMethod"
  | "noForceReflowVisualViewport"

/**
 * This rule will disallow properties that force reflow.
 * @see https://gist.github.com/paulirish/5d52fb081b3570c81e3a
 */
const noForceReflowAccess = createRule<[], MessageIds>({
  name: "no-force-reflow-access",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow properties that force reflow",
    },
    fixable: undefined,
    schema: [],
    messages: {
      noForceReflowProperty:
        "Accessing '{{property}}' forces layout/reflow and can hurt performance. {{alternative}}",
      noForceReflowMethod:
        "Calling '{{method}}()' forces layout/reflow and can hurt performance. {{alternative}}",
      noForceReflowVisualViewport:
        "Accessing 'visualViewport.{{property}}' forces layout/reflow and can hurt performance. Consider using ResizeObserver instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    // Properties that force reflow when accessed
    const forceReflowProperties = new Set([
      // Element box metrics
      "offsetLeft",
      "offsetTop",
      "offsetWidth",
      "offsetHeight",
      "offsetParent",
      "clientLeft",
      "clientTop",
      "clientWidth",
      "clientHeight",
      // Scroll properties
      "scrollWidth",
      "scrollHeight",
      "scrollLeft",
      "scrollTop",
      // Computed properties
      "computedRole",
      "computedName",
      "innerText",
      // Window dimensions
      "scrollX",
      "scrollY",
      "innerHeight",
      "innerWidth",
      // Document
      "scrollingElement",
      // Mouse event offset data
      "layerX",
      "layerY",
      "offsetX",
      "offsetY",
      // SVG properties
      "instanceRoot",
    ])

    // Methods that force reflow when called
    const forceReflowMethods = new Set([
      // Element methods
      "getClientRects",
      "getBoundingClientRect",
      // Window methods
      "getComputedStyle",
      // Document methods
      "elementFromPoint",
      // SVG methods
      "computeCTM",
      "getBBox",
      "getCharNumAtPosition",
      "getComputedTextLength",
      "getEndPositionOfChar",
      "getExtentOfChar",
      "getNumberOfChars",
      "getRotationOfChar",
      "getStartPositionOfChar",
      "getSubStringLength",
      "selectSubString",
      // This section is for methods that we are choosing to disable since there
      // are legitimate uses of these methods without any real alternative.
      // "scrollBy",
      // "scrollTo",
      // "scrollIntoView",
      // "scrollIntoViewIfNeeded",
      // "focus",
      // "select",
    ])

    // Visual viewport properties that force reflow
    const visualViewportProperties = new Set([
      "height",
      "width",
      "offsetTop",
      "offsetLeft",
    ])

    function getPropertyAlternative(propertyName: string): string {
      // Element box metrics
      if (
        ["offsetLeft", "offsetTop", "offsetWidth", "offsetHeight"].includes(
          propertyName
        )
      ) {
        return "Consider using ResizeObserver for size tracking instead."
      }
      if (propertyName === "offsetParent") {
        return "Consider alternative layout approaches that don't require offset calculations."
      }
      if (
        ["clientLeft", "clientTop", "clientWidth", "clientHeight"].includes(
          propertyName
        )
      ) {
        return "Consider using ResizeObserver or batching DOM measurements."
      }

      // Scroll properties
      if (["scrollWidth", "scrollHeight"].includes(propertyName)) {
        return "Consider using ResizeObserver to track content size changes."
      }
      if (["scrollLeft", "scrollTop"].includes(propertyName)) {
        return "Consider using scroll event listeners to track position changes."
      }

      // Computed properties
      if (propertyName === "innerText") {
        return "Consider using textContent instead, which doesn't trigger reflow."
      }
      if (["computedRole", "computedName"].includes(propertyName)) {
        return "Consider using aria attributes directly when possible."
      }

      // Window dimensions
      if (["scrollX", "scrollY"].includes(propertyName)) {
        return "Consider using scroll event listeners instead of direct property access."
      }
      if (["innerHeight", "innerWidth"].includes(propertyName)) {
        return "Consider using ResizeObserver on document.documentElement instead."
      }

      // Mouse event offset data
      if (["layerX", "layerY", "offsetX", "offsetY"].includes(propertyName)) {
        return "Consider calculating coordinates using clientX/clientY and element bounds."
      }

      // Document
      if (propertyName === "scrollingElement") {
        return "Consider using document.documentElement directly when possible."
      }

      // SVG properties
      if (propertyName === "instanceRoot") {
        return "Avoid accessing SVG instance properties that trigger layout calculations."
      }

      return "Consider alternative approaches that don't require layout calculations."
    }

    function getMethodAlternative(methodName: string): string {
      if (["getClientRects", "getBoundingClientRect"].includes(methodName)) {
        return "Consider batching these calls or using IntersectionObserver for visibility detection."
      }
      if (methodName === "getComputedStyle") {
        return "Consider using CSS custom properties or batching style calculations."
      }
      if (methodName === "elementFromPoint") {
        return "Consider using event delegation or alternative element selection methods."
      }

      // SVG methods
      if (["computeCTM", "getBBox"].includes(methodName)) {
        return "Consider using viewBox/transform attributes or alternative SVG approaches."
      }
      if (
        [
          "getCharNumAtPosition",
          "getComputedTextLength",
          "getEndPositionOfChar",
          "getExtentOfChar",
          "getNumberOfChars",
          "getRotationOfChar",
          "getStartPositionOfChar",
          "getSubStringLength",
        ].includes(methodName)
      ) {
        return "Consider alternative approaches that don't require text measurement calculations."
      }
      if (methodName === "selectSubString") {
        return "Consider using alternative text selection methods."
      }

      return "Consider alternative approaches that don't trigger layout calculations."
    }

    function checkMemberExpression(node: TSESTree.MemberExpression): void {
      if (node.property.type === AST_NODE_TYPES.Identifier) {
        const propertyName = node.property.name

        // Skip if this is a property definition in an object literal (like { offsetWidth: 100 })
        if (
          node.parent?.type === AST_NODE_TYPES.Property &&
          node.parent.key === node.property
        ) {
          return
        }

        // Skip if this is an assignment (like obj.offsetWidth = 50)
        if (
          node.parent?.type === AST_NODE_TYPES.AssignmentExpression &&
          node.parent.left === node
        ) {
          return
        }

        // Check for visualViewport property access FIRST (higher priority)
        if (
          node.object.type === AST_NODE_TYPES.MemberExpression &&
          node.object.property?.type === AST_NODE_TYPES.Identifier &&
          node.object.property.name === "visualViewport" &&
          visualViewportProperties.has(propertyName)
        ) {
          context.report({
            node,
            messageId: "noForceReflowVisualViewport",
            data: {
              property: propertyName,
            },
          })
          return
        }

        // Check for direct property access that forces reflow
        if (forceReflowProperties.has(propertyName)) {
          // Only flag if this looks like a DOM element access
          // Skip obvious configuration objects
          if (
            node.object.type === AST_NODE_TYPES.Identifier &&
            (node.object.name === "config" ||
              node.object.name === "options" ||
              node.object.name === "settings" ||
              node.object.name === "props" ||
              node.object.name === "state")
          ) {
            return
          }

          const alternative = getPropertyAlternative(propertyName)
          context.report({
            node,
            messageId: "noForceReflowProperty",
            data: {
              property: propertyName,
              alternative,
            },
          })
        }
      }
    }

    function checkCallExpression(node: TSESTree.CallExpression): void {
      if (
        node.callee.type === AST_NODE_TYPES.MemberExpression &&
        node.callee.property.type === AST_NODE_TYPES.Identifier
      ) {
        const methodName = node.callee.property.name

        if (forceReflowMethods.has(methodName)) {
          const alternative = getMethodAlternative(methodName)
          context.report({
            node,
            messageId: "noForceReflowMethod",
            data: {
              method: methodName,
              alternative,
            },
          })
        }
      }
    }

    function checkVariableDeclarator(node: TSESTree.VariableDeclarator): void {
      // Check for destructuring patterns like: const { scrollWidth, clientWidth } = element
      if (
        node.id.type === AST_NODE_TYPES.ObjectPattern &&
        node.init // Make sure there's an initializer
      ) {
        // Skip if the init looks like a configuration object
        if (
          node.init.type === AST_NODE_TYPES.Identifier &&
          (node.init.name === "config" ||
            node.init.name === "options" ||
            node.init.name === "settings" ||
            node.init.name === "props" ||
            node.init.name === "state")
        ) {
          return
        }

        // Skip if the init is undefined or null (these are not DOM elements)
        if (
          node.init.type === AST_NODE_TYPES.Identifier &&
          (node.init.name === "undefined" || node.init.name === "null")
        ) {
          return
        }

        // Skip if the init is a literal (like number, string, boolean)
        if (node.init.type === AST_NODE_TYPES.Literal) {
          return
        }

        // Skip if the init is a function call or hook call (these abstract performance concerns)
        if (node.init.type === AST_NODE_TYPES.CallExpression) {
          return
        }

        // Skip if the init is a new expression (constructor call)
        if (node.init.type === AST_NODE_TYPES.NewExpression) {
          return
        }

        // Only flag destructuring from direct object/element references
        // This includes:
        // - Direct identifiers: const { scrollWidth } = element
        // - Member expressions: const { scrollWidth } = ref.current
        // - But NOT function calls: const { scrollWidth } = getElement()

        // Check each property in the destructuring pattern
        for (const property of node.id.properties) {
          if (
            property.type === AST_NODE_TYPES.Property &&
            property.key.type === AST_NODE_TYPES.Identifier &&
            !property.computed
          ) {
            const propertyName = property.key.name

            // Check if this property forces reflow
            if (forceReflowProperties.has(propertyName)) {
              const alternative = getPropertyAlternative(propertyName)
              context.report({
                node: property.key,
                messageId: "noForceReflowProperty",
                data: {
                  property: propertyName,
                  alternative,
                },
              })
            }
          }
        }
      }
    }

    return {
      MemberExpression: checkMemberExpression,
      CallExpression: checkCallExpression,
      VariableDeclarator: checkVariableDeclarator,
    }
  },
})

export default noForceReflowAccess
