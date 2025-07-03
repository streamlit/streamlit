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
      // Range methods
      "getClientRects",
      "getBoundingClientRect",
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
      // This section is for methods that we are choosing to disablesince there
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
            message: `Accessing 'visualViewport.${propertyName}' forces layout/reflow and can hurt performance.`,
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

          context.report({
            node,
            message: `Accessing '${propertyName}' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.`,
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
          context.report({
            node,
            message: `Calling '${methodName}()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.`,
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
