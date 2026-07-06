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

import {
  compileTextInputValidationRegex,
  getInvalidTextInputMessage,
  passesTextInputValidation,
} from "./validation"

describe("compileTextInputValidationRegex", () => {
  it.each([undefined, null, ""])(
    "returns undefined when no pattern is provided (%s)",
    pattern => {
      expect(compileTextInputValidationRegex(pattern)).toBeUndefined()
    }
  )

  it("compiles a valid pattern into a RegExp with the unicode + dotAll flags", () => {
    const result = compileTextInputValidationRegex("^[a-z]+$")

    expect(result).toBeInstanceOf(RegExp)
    // The "us" flags (unicode + dotAll) match the st.column_config.TextColumn
    // convention.
    expect((result as RegExp).flags).toBe("su")
  })

  it("applies dotAll so '.' matches newlines", () => {
    const result = compileTextInputValidationRegex("^a.b$")

    expect(result).toBeInstanceOf(RegExp)
    expect((result as RegExp).test("a\nb")).toBe(true)
  })

  it("applies the unicode flag for unicode-aware matching", () => {
    const result = compileTextInputValidationRegex("^\\p{Letter}+$")

    expect(result).toBeInstanceOf(RegExp)
    expect((result as RegExp).test("café")).toBe(true)
    expect((result as RegExp).test("a1")).toBe(false)
  })

  it("returns a descriptive error message for an invalid pattern", () => {
    const result = compileTextInputValidationRegex("[")

    expect(typeof result).toBe("string")
    expect(result).toContain("Invalid validate regex: [")
  })
})

describe("getInvalidTextInputMessage", () => {
  it("includes the actual compiled regex in the default message", () => {
    const regex = new RegExp("^[a-z]+$", "su")

    expect(getInvalidTextInputMessage(regex)).toBe(
      "Invalid input. Must match pattern: /^[a-z]+$/su"
    )
  })
})

describe("passesTextInputValidation", () => {
  const regex = new RegExp("^[a-z]+$", "su")

  it.each([null, ""])(
    "always passes empty values so clearing is never blocked (%s)",
    value => {
      expect(passesTextInputValidation(value, regex)).toBe(true)
    }
  )

  it("returns true when the value matches the regex", () => {
    expect(passesTextInputValidation("abc", regex)).toBe(true)
  })

  it("returns false when the value does not match the regex", () => {
    expect(passesTextInputValidation("abc123", regex)).toBe(false)
  })
})
