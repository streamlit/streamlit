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

import rule from "./no-aria-hidden-with-focusable-children"
import { ruleTester } from "./utils/ruleTester"

ruleTester.run("no-aria-hidden-with-focusable-children", rule, {
  valid: [
    {
      name: "aria-hidden wrapper with only static children",
      code: `
        const El = () => (
          <div aria-hidden="true">
            <span>Text</span>
          </div>
        )
      `,
    },
    {
      name: "aria-hidden applied only to a text span inside a label",
      code: `
        const El = () => (
          <label>
            <span aria-hidden="true">Label</span>
            <button type="button" aria-label="Help" />
          </label>
        )
      `,
    },
    {
      name: "tabIndex -1 is not focusable",
      code: `
        const El = () => (
          <div aria-hidden="true">
            <span tabIndex={-1} />
          </div>
        )
      `,
    },
  ],
  invalid: [
    {
      name: "aria-hidden wrapper contains a button",
      code: `
        const El = () => (
          <div aria-hidden="true">
            <button type="button">Click</button>
          </div>
        )
      `,
      errors: [{ messageId: "ariaHiddenWithFocusableChildren" }],
    },
    {
      name: "aria-hidden wrapper contains an anchor",
      code: `
        const El = () => (
          <div aria-hidden>
            <a href="#foo">Link</a>
          </div>
        )
      `,
      errors: [{ messageId: "ariaHiddenWithFocusableChildren" }],
    },
    {
      name: "aria-hidden wrapper contains a focusable element via tabIndex",
      code: `
        const El = () => (
          <div aria-hidden="true">
            <span tabIndex={0}>Focusable</span>
          </div>
        )
      `,
      errors: [{ messageId: "ariaHiddenWithFocusableChildren" }],
    },
    {
      name: "aria-hidden wrapper contains a known focusable component",
      code: `
        const TooltipIcon = () => <button type="button" aria-label="Help" />
        const El = () => (
          <div aria-hidden="true">
            <TooltipIcon />
          </div>
        )
      `,
      errors: [{ messageId: "ariaHiddenWithFocusableChildren" }],
    },
  ],
})
