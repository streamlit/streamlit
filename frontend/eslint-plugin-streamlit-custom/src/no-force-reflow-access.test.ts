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

import noForceReflowAccess from "./no-force-reflow-access"
import { ruleTester } from "./utils/ruleTester"

ruleTester.run("no-force-reflow-access", noForceReflowAccess, {
  valid: [
    // Safe property access
    "element.className",
    "element.id",
    "element.style.color",
    "element.textContent",
    "element.dataset.foo",
    "window.location",
    "document.title",
    // Safe method calls
    "element.addEventListener('click', fn)",
    "element.setAttribute('class', 'foo')",
    "element.querySelector('.foo')",
    "document.createElement('div')",
    "window.setTimeout(fn, 100)",
    // Safe computed style access (without forcing layout)
    "getComputedStyle(element).color",
    // Variables with similar names
    "const offsetLeft = 10",
    "const clientWidth = 100",
    // Object properties with same names
    "const config = { offsetWidth: 100 }",
    "config.offsetWidth",
    // Assignments (setting properties, not reading them)
    "element.offsetWidth = 100",
    "element.scrollTop = 0",
    "element.clientHeight = 200",
    // Methods that are allowed
    "element.scrollBy(10, 10)",
    "element.scrollTo(0, 0)",
    "element.scrollIntoView()",
    "element.scrollIntoViewIfNeeded()",
    "element.focus()",
    "input.select()",
    // Safe destructuring from config objects
    "const { offsetWidth, scrollTop } = config",
    "const { clientHeight } = options",
    "const { scrollWidth } = settings",
    "const { innerHeight } = props",
    "const { offsetLeft } = state",
    // Destructuring without init
    "const { scrollWidth } = undefined",
    // Destructuring with computed property names
    "const { [key]: value } = element",
    // Destructuring from null
    "const { offsetWidth } = null",
    // Destructuring from literals
    "const { scrollTop } = 123",
    "const { clientHeight } = 'string'",
    "const { offsetLeft } = true",
    // Destructuring from function calls (abstracts performance concerns)
    "const { innerWidth } = useWindowDimensionsContext()",
    "const { scrollWidth } = getDimensions()",
    "const { offsetHeight } = calculateLayout()",
    "const { clientWidth } = getElementSize(element)",
    // Destructuring from hook calls
    "const { scrollY } = useScrollPosition()",
    "const { innerHeight } = useViewportSize()",
    // Destructuring from constructor calls
    "const { offsetWidth } = new DOMRect()",
    "const { scrollLeft } = new Object()",
  ],
  invalid: [
    // Element box metrics
    {
      code: "element.offsetLeft",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "element.offsetTop",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "element.offsetWidth",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "element.offsetHeight",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "element.offsetParent",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "element.clientLeft",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "element.clientTop",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "element.clientWidth",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "element.clientHeight",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    // Scroll properties
    {
      code: "element.scrollWidth",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "element.scrollHeight",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "element.scrollLeft",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "element.scrollTop",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    // Computed properties
    {
      code: "element.computedRole",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "element.computedName",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "element.innerText",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    // Window dimensions
    {
      code: "window.scrollX",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "window.scrollY",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "window.innerHeight",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "window.innerWidth",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    // Document
    {
      code: "document.scrollingElement",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    // Mouse event offset data
    {
      code: "event.layerX",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "event.layerY",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "event.offsetX",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "event.offsetY",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    // Visual viewport properties
    {
      code: "window.visualViewport.height",
      errors: [{ messageId: "noForceReflowVisualViewport" }],
    },
    {
      code: "window.visualViewport.width",
      errors: [{ messageId: "noForceReflowVisualViewport" }],
    },
    {
      code: "window.visualViewport.offsetTop",
      errors: [{ messageId: "noForceReflowVisualViewport" }],
    },
    {
      code: "window.visualViewport.offsetLeft",
      errors: [{ messageId: "noForceReflowVisualViewport" }],
    },
    // Method calls that force reflow
    {
      code: "element.getClientRects()",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    {
      code: "element.getBoundingClientRect()",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    {
      code: "window.getComputedStyle(element)",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    {
      code: "document.elementFromPoint(x, y)",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    // Range methods
    {
      code: "range.getClientRects()",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    {
      code: "range.getBoundingClientRect()",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    // SVG methods
    {
      code: "svgElement.computeCTM()",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    {
      code: "svgElement.getBBox()",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    {
      code: "svgTextElement.getComputedTextLength()",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    {
      code: "svgTextElement.getEndPositionOfChar(0)",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    {
      code: "svgTextElement.getExtentOfChar(0)",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    {
      code: "svgTextElement.getNumberOfChars()",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    {
      code: "svgTextElement.getRotationOfChar(0)",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    {
      code: "svgTextElement.getStartPositionOfChar(0)",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    {
      code: "svgTextElement.getSubStringLength(0, 5)",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    {
      code: "svgTextElement.selectSubString(0, 5)",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    {
      code: "svgTextElement.getCharNumAtPosition(point)",
      errors: [{ messageId: "noForceReflowMethod" }],
    },
    // SVG properties
    {
      code: "svgUseElement.instanceRoot",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    // Complex expressions
    {
      code: "const width = element.offsetWidth + element.offsetHeight",
      errors: [
        { messageId: "noForceReflowProperty" },
        { messageId: "noForceReflowProperty" },
      ],
    },
    {
      code: "if (element.clientWidth > 100) { /* ... */ }",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    // Destructuring patterns that force reflow (direct element references)
    {
      code: "const { scrollWidth, clientWidth } = element",
      errors: [
        { messageId: "noForceReflowProperty" },
        { messageId: "noForceReflowProperty" },
      ],
    },
    {
      code: "const { offsetWidth } = domElement",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "const { scrollTop } = tabListRef.current",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "const { clientHeight, offsetLeft } = node",
      errors: [
        { messageId: "noForceReflowProperty" },
        { messageId: "noForceReflowProperty" },
      ],
    },
    {
      code: "const { innerText } = textElement",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
    {
      code: "const { scrollX, scrollY } = window",
      errors: [
        { messageId: "noForceReflowProperty" },
        { messageId: "noForceReflowProperty" },
      ],
    },
    {
      code: "const { offsetX, offsetY } = event",
      errors: [
        { messageId: "noForceReflowProperty" },
        { messageId: "noForceReflowProperty" },
      ],
    },
    // Mixed destructuring with safe and unsafe properties
    {
      code: "const { className, scrollWidth } = element",
      errors: [{ messageId: "noForceReflowProperty" }],
    },
  ],
})
