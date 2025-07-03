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
const noForceReflowAccess = require("./no-force-reflow-access")

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
  },
})

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
  ],
  invalid: [
    // Element box metrics
    {
      code: "element.offsetLeft",
      errors: [
        {
          message:
            "Accessing 'offsetLeft' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "element.offsetTop",
      errors: [
        {
          message:
            "Accessing 'offsetTop' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "element.offsetWidth",
      errors: [
        {
          message:
            "Accessing 'offsetWidth' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "element.offsetHeight",
      errors: [
        {
          message:
            "Accessing 'offsetHeight' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "element.offsetParent",
      errors: [
        {
          message:
            "Accessing 'offsetParent' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "element.clientLeft",
      errors: [
        {
          message:
            "Accessing 'clientLeft' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "element.clientTop",
      errors: [
        {
          message:
            "Accessing 'clientTop' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "element.clientWidth",
      errors: [
        {
          message:
            "Accessing 'clientWidth' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "element.clientHeight",
      errors: [
        {
          message:
            "Accessing 'clientHeight' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    // Scroll properties
    {
      code: "element.scrollWidth",
      errors: [
        {
          message:
            "Accessing 'scrollWidth' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "element.scrollHeight",
      errors: [
        {
          message:
            "Accessing 'scrollHeight' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "element.scrollLeft",
      errors: [
        {
          message:
            "Accessing 'scrollLeft' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "element.scrollTop",
      errors: [
        {
          message:
            "Accessing 'scrollTop' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    // Computed properties
    {
      code: "element.computedRole",
      errors: [
        {
          message:
            "Accessing 'computedRole' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "element.computedName",
      errors: [
        {
          message:
            "Accessing 'computedName' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "element.innerText",
      errors: [
        {
          message:
            "Accessing 'innerText' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    // Window dimensions
    {
      code: "window.scrollX",
      errors: [
        {
          message:
            "Accessing 'scrollX' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "window.scrollY",
      errors: [
        {
          message:
            "Accessing 'scrollY' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "window.innerHeight",
      errors: [
        {
          message:
            "Accessing 'innerHeight' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "window.innerWidth",
      errors: [
        {
          message:
            "Accessing 'innerWidth' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    // Document
    {
      code: "document.scrollingElement",
      errors: [
        {
          message:
            "Accessing 'scrollingElement' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    // Mouse event offset data
    {
      code: "event.layerX",
      errors: [
        {
          message:
            "Accessing 'layerX' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "event.layerY",
      errors: [
        {
          message:
            "Accessing 'layerY' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "event.offsetX",
      errors: [
        {
          message:
            "Accessing 'offsetX' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "event.offsetY",
      errors: [
        {
          message:
            "Accessing 'offsetY' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    // Visual viewport properties
    {
      code: "window.visualViewport.height",
      errors: [
        {
          message:
            "Accessing 'visualViewport.height' forces layout/reflow and can hurt performance.",
        },
      ],
    },
    {
      code: "window.visualViewport.width",
      errors: [
        {
          message:
            "Accessing 'visualViewport.width' forces layout/reflow and can hurt performance.",
        },
      ],
    },
    {
      code: "window.visualViewport.offsetTop",
      errors: [
        {
          message:
            "Accessing 'visualViewport.offsetTop' forces layout/reflow and can hurt performance.",
        },
      ],
    },
    {
      code: "window.visualViewport.offsetLeft",
      errors: [
        {
          message:
            "Accessing 'visualViewport.offsetLeft' forces layout/reflow and can hurt performance.",
        },
      ],
    },
    // Method calls that force reflow
    {
      code: "element.getClientRects()",
      errors: [
        {
          message:
            "Calling 'getClientRects()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "element.getBoundingClientRect()",
      errors: [
        {
          message:
            "Calling 'getBoundingClientRect()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "window.getComputedStyle(element)",
      errors: [
        {
          message:
            "Calling 'getComputedStyle()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "document.elementFromPoint(x, y)",
      errors: [
        {
          message:
            "Calling 'elementFromPoint()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    // Range methods
    {
      code: "range.getClientRects()",
      errors: [
        {
          message:
            "Calling 'getClientRects()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "range.getBoundingClientRect()",
      errors: [
        {
          message:
            "Calling 'getBoundingClientRect()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    // SVG methods
    {
      code: "svgElement.computeCTM()",
      errors: [
        {
          message:
            "Calling 'computeCTM()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "svgElement.getBBox()",
      errors: [
        {
          message:
            "Calling 'getBBox()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "svgTextElement.getComputedTextLength()",
      errors: [
        {
          message:
            "Calling 'getComputedTextLength()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "svgTextElement.getEndPositionOfChar(0)",
      errors: [
        {
          message:
            "Calling 'getEndPositionOfChar()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "svgTextElement.getExtentOfChar(0)",
      errors: [
        {
          message:
            "Calling 'getExtentOfChar()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "svgTextElement.getNumberOfChars()",
      errors: [
        {
          message:
            "Calling 'getNumberOfChars()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "svgTextElement.getRotationOfChar(0)",
      errors: [
        {
          message:
            "Calling 'getRotationOfChar()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "svgTextElement.getStartPositionOfChar(0)",
      errors: [
        {
          message:
            "Calling 'getStartPositionOfChar()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "svgTextElement.getSubStringLength(0, 5)",
      errors: [
        {
          message:
            "Calling 'getSubStringLength()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "svgTextElement.selectSubString(0, 5)",
      errors: [
        {
          message:
            "Calling 'selectSubString()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "svgTextElement.getCharNumAtPosition(point)",
      errors: [
        {
          message:
            "Calling 'getCharNumAtPosition()' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    // SVG properties
    {
      code: "svgUseElement.instanceRoot",
      errors: [
        {
          message:
            "Accessing 'instanceRoot' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    // Complex expressions
    {
      code: "const width = element.offsetWidth + element.offsetHeight",
      errors: [
        {
          message:
            "Accessing 'offsetWidth' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
        {
          message:
            "Accessing 'offsetHeight' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
    {
      code: "if (element.clientWidth > 100) { /* ... */ }",
      errors: [
        {
          message:
            "Accessing 'clientWidth' forces layout/reflow and can hurt performance. Consider batching DOM reads or using alternatives.",
        },
      ],
    },
  ],
  valid: [
    {
      code: "element.scrollBy(10, 10)",
    },
    {
      code: "element.scrollTo(0, 0)",
    },
    {
      code: "element.scrollIntoView()",
    },
    {
      code: "element.scrollIntoViewIfNeeded()",
    },
    {
      code: "element.focus()",
    },
    {
      code: "input.select()",
    },
  ],
})

console.log("All 'no-force-reflow-access' tests passed!")
