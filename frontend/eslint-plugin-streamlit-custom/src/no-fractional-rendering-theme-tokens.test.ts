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

import noFractionalRenderingThemeTokens from "./no-fractional-rendering-theme-tokens"
import { ruleTester } from "./utils/ruleTester"

ruleTester.run(
  "no-fractional-rendering-theme-tokens",
  noFractionalRenderingThemeTokens,
  {
    valid: [
      {
        code: `
          export const iconSizes = {
            xs: "0.5rem",
            md: "0.875rem",
            twoXL: "1.75rem",
            threeXL: "2.25rem",
          }
        `,
      },
      {
        code: `
          export const sizes = {
            focusRingWidth: "0.1875rem",
            defaultStrokeWidth: 2,
            appRunningMen: "1.6rem",
          }
        `,
      },
      {
        code: `
          export const otherConfig = {
            iconSizes: { md: "0.9rem" },
          }
        `,
      },
    ],
    invalid: [
      {
        code: `
          export const iconSizes = {
            md: "0.9rem",
          }
        `,
        errors: [{ messageId: "noFractionalRenderingThemeToken" }],
      },
      {
        code: `
          export const iconSizes = {
            md: "14.5px",
          }
        `,
        errors: [{ messageId: "noFractionalRenderingThemeToken" }],
      },
      {
        code: `
          export const sizes = {
            focusRingWidth: "0.2rem",
            defaultStrokeWidth: 2.25,
          }
        `,
        errors: [
          { messageId: "noFractionalRenderingThemeToken" },
          { messageId: "noFractionalRenderingThemeToken" },
        ],
      },
    ],
  }
)
