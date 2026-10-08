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

import { remapFormString, remapFormStrings } from "./useFormLabelRefresh"

describe("remapFormString", () => {
  const options = ["D (1)", "E (1)", "F (1)"]
  const previous = ["D (0)", "E (0)", "F (0)"]

  it("rewrites a stale label to the option at the same index", () => {
    expect(remapFormString("E (0)", options, previous)).toBe("E (1)")
  })

  it("leaves a label that is already current", () => {
    expect(remapFormString("E (1)", options, previous)).toBeUndefined()
  })

  it("leaves typed text that was not a previous label", () => {
    expect(remapFormString("custom", options, previous)).toBeUndefined()
  })

  it("does nothing without a previous generation", () => {
    expect(remapFormString("E (0)", options, [])).toBeUndefined()
  })

  it("does nothing when the option list changed length", () => {
    expect(remapFormString("E (0)", ["E (1)"], previous)).toBeUndefined()
  })
})

describe("remapFormStrings", () => {
  it("rewrites options and keeps typed text", () => {
    expect(
      remapFormStrings(
        ["D (0)", "typed-note"],
        ["D (1)", "E (1)"],
        ["D (0)", "E (0)"]
      )
    ).toEqual(["D (1)", "typed-note"])
  })

  it("returns undefined when nothing changed", () => {
    expect(
      remapFormStrings(["D (1)"], ["D (1)", "E (1)"], ["D (0)", "E (0)"])
    ).toBeUndefined()
  })
})
