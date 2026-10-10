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

import { releaseInactiveFormLabelRefreshClaims } from "~lib/formLabelRefreshClaims"

import {
  claimFormLabelRefresh,
  remapFormString,
  remapFormStrings,
  resetFormLabelRefreshClaims,
} from "./useFormLabelRefresh"

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

  it("keeps the previous index when a label moves to another option", () => {
    expect(remapFormString("A", ["B", "A"], ["A", "B"])).toBe("B")
  })

  it("uses the last duplicate label by default", () => {
    expect(
      remapFormString("Choice", ["A new", "B new"], ["Choice", "Choice"])
    ).toBe("B new")
  })

  it("uses the first duplicate label when asked", () => {
    expect(
      remapFormString(
        "Choice",
        ["A new", "B new"],
        ["Choice", "Choice"],
        "first"
      )
    ).toBe("A new")
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

  it("keeps the first shared label for multiselect", () => {
    expect(
      remapFormStrings(
        ["Choice"],
        ["A new", "B new"],
        ["Choice", "Choice"],
        "first"
      )
    ).toEqual(["A new"])
  })
})

describe("claimFormLabelRefresh", () => {
  beforeEach(() => {
    resetFormLabelRefreshClaims()
  })

  it("applies one generation once", () => {
    expect(claimFormLabelRefresh("widget", ["A"], ["B"], false)).toBe(true)
    expect(claimFormLabelRefresh("widget", ["A"], ["B"], false)).toBe(false)
  })

  it("lets a server update win and blocks a later remap", () => {
    expect(claimFormLabelRefresh("widget", ["A"], ["B"], true)).toBe(false)
    expect(claimFormLabelRefresh("widget", ["A"], ["B"], false)).toBe(false)
  })

  it("allows the same generation after the widget leaves the app", () => {
    expect(
      claimFormLabelRefresh("widget", ["A", "B"], ["B", "A"], false)
    ).toBe(true)
    releaseInactiveFormLabelRefreshClaims(new Set(["widget"]))
    expect(
      claimFormLabelRefresh("widget", ["A", "B"], ["B", "A"], false)
    ).toBe(false)

    releaseInactiveFormLabelRefreshClaims(new Set())
    expect(
      claimFormLabelRefresh("widget", ["A", "B"], ["B", "A"], false)
    ).toBe(true)
  })
})
