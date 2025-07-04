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

import { isNullOrUndefined, notNullOrUndefined } from "."

describe("types", () => {
  describe("isNullOrUndefined", () => {
    it("should return true for null", () => {
      expect(isNullOrUndefined(null)).toBe(true)
    })

    it("should return true for undefined", () => {
      expect(isNullOrUndefined(undefined)).toBe(true)
    })

    it("should return false for a value", () => {
      expect(isNullOrUndefined(1)).toBe(false)
    })
  })

  describe("notNullOrUndefined", () => {
    it("should return false for null", () => {
      expect(notNullOrUndefined(null)).toBe(false)
    })

    it("should return false for undefined", () => {
      expect(notNullOrUndefined(undefined)).toBe(false)
    })

    it("should return true for a value", () => {
      expect(notNullOrUndefined(1)).toBe(true)
    })
  })
})
