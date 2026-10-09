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

import { REQUIRED_FIELD_MESSAGE, requiredFieldError } from "./requiredField"

describe("REQUIRED_FIELD_MESSAGE", () => {
  it("is the user-facing required copy", () => {
    expect(REQUIRED_FIELD_MESSAGE).toBe("This field is required.")
  })
})

describe("requiredFieldError", () => {
  it.each([
    [true, true, true, REQUIRED_FIELD_MESSAGE],
    [false, true, true, null],
    [true, false, true, null],
    [true, true, false, null],
  ] as const)(
    "required=%s hasRequiredError=%s isEmpty=%s → %s",
    (required, hasRequiredError, isEmpty, expected) => {
      expect(requiredFieldError(required, hasRequiredError, isEmpty)).toBe(
        expected
      )
    }
  )
})
