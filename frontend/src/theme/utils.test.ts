/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { computeSpacingStyle } from "./utils"
import mainTheme from "./mainTheme"

describe("Styling utils", () => {
  describe("computeSpacingStyle", () => {
    test("pulls correct theme values", async () => {
      expect(computeSpacingStyle("sm md lg none", mainTheme)).toEqual(
        "0.5rem 0.75rem 1rem 0"
      )
      expect(computeSpacingStyle("xs  0  px  lg", mainTheme)).toEqual(
        "0.375rem 0 1px 1rem"
      )
    })
  })
})
