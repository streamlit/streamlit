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
 * This rule will disallow properties that force reflow.
 * @see https://gist.github.com/paulirish/5d52fb081b3570c81e3a
 */
module.exports = {
  meta: {
    name: "no-force-reflow-access",
    type: "error",
    docs: {
      description: "Disallow properties that force reflow",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
  },
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

    function getPropertyAlternative(propertyName) {
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

    function getMethodAlternative(methodName) {
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

    function checkMemberExpression(node) {
      if (node.property.type === "Identifier") {
        const propertyName = node.property.name

        // Skip if this is a property definition in an object literal (like { offsetWidth: 100 })
        if (
          node.parent.type === "Property" &&
          node.parent.key === node.property
        ) {
          return
        }

        // Skip if this is an assignment (like obj.offsetWidth = 50)
        if (
          node.parent.type === "AssignmentExpression" &&
          node.parent.left === node
        ) {
          return
        }

        // Check for visualViewport property access FIRST (higher priority)
        if (
          node.object.type === "MemberExpression" &&
          node.object.property &&
          node.object.property.name === "visualViewport" &&
          visualViewportProperties.has(propertyName)
        ) {
          context.report({
            node,
            message: `Accessing 'visualViewport.${propertyName}' forces layout/reflow and can hurt performance. Consider using ResizeObserver instead.`,
          })
          return
        }

        // Check for direct property access that forces reflow
        if (forceReflowProperties.has(propertyName)) {
          // Only flag if this looks like a DOM element access
          // Skip obvious configuration objects
          if (
            node.object.type === "Identifier" &&
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
            message: `Accessing '${propertyName}' forces layout/reflow and can hurt performance. ${alternative}`,
          })
        }
      }
    }

    function checkCallExpression(node) {
      if (
        node.callee.type === "MemberExpression" &&
        node.callee.property.type === "Identifier"
      ) {
        const methodName = node.callee.property.name

        if (forceReflowMethods.has(methodName)) {
          const alternative = getMethodAlternative(methodName)
          context.report({
            node,
            message: `Calling '${methodName}()' forces layout/reflow and can hurt performance. ${alternative}`,
          })
        }
      }
    }

    return {
      MemberExpression: checkMemberExpression,
      CallExpression: checkCallExpression,
    }
  },
}
