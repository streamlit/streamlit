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

import { describe, expect, it } from "vitest"

import {
  applyDateFieldSingleTabStop,
  exposeEnabledSegmentsForPointer,
} from "./dateFieldTabStop"

function makeSegment(type: string, tabIndex = 0): HTMLElement {
  const el = document.createElement("span")
  el.setAttribute("data-type", type)
  el.tabIndex = tabIndex
  return el
}

describe("applyDateFieldSingleTabStop", () => {
  it("leaves only one editable segment in the tab order", () => {
    const container = document.createElement("div")
    const year = makeSegment("year")
    const month = makeSegment("month")
    const day = makeSegment("day")
    const literal = document.createElement("span")
    literal.setAttribute("data-type", "literal")
    literal.tabIndex = 0
    container.append(year, literal, month, day)

    expect(applyDateFieldSingleTabStop(container)).toBe(year)
    expect(year.tabIndex).toBe(0)
    expect(month.tabIndex).toBe(-1)
    expect(day.tabIndex).toBe(-1)
    // Literals are ignored by SEGMENT_SELECTOR.
    expect(literal.tabIndex).toBe(0)
  })

  it("promotes the preferred segment when provided", () => {
    const container = document.createElement("div")
    const year = makeSegment("year")
    const month = makeSegment("month")
    const day = makeSegment("day")
    container.append(year, month, day)

    expect(applyDateFieldSingleTabStop(container, day)).toBe(day)
    expect(year.tabIndex).toBe(-1)
    expect(month.tabIndex).toBe(-1)
    expect(day.tabIndex).toBe(0)
  })

  it("keeps disabled segments out of the tab order", () => {
    const container = document.createElement("div")
    // React Aria omits the tabindex attribute when disabled.
    const year = makeSegment("year", -1)
    const month = makeSegment("month", -1)
    const day = makeSegment("day", -1)
    for (const segment of [year, month, day]) {
      segment.setAttribute("aria-disabled", "true")
      segment.removeAttribute("tabindex")
    }
    container.append(year, month, day)

    expect(applyDateFieldSingleTabStop(container)).toBeNull()
    expect(year.getAttribute("tabindex")).toBe("-1")
    expect(month.getAttribute("tabindex")).toBe("-1")
    expect(day.getAttribute("tabindex")).toBe("-1")
  })

  it("ignores a disabled preferred segment", () => {
    const container = document.createElement("div")
    const year = makeSegment("year", -1)
    const month = makeSegment("month")
    const day = makeSegment("day", -1)
    year.setAttribute("aria-disabled", "true")
    container.append(year, month, day)

    expect(applyDateFieldSingleTabStop(container, year)).toBe(month)
    expect(year.tabIndex).toBe(-1)
    expect(month.tabIndex).toBe(0)
    expect(day.tabIndex).toBe(-1)
  })

  it("exposes every enabled segment for pointer focus", () => {
    const container = document.createElement("div")
    const year = makeSegment("year")
    const month = makeSegment("month", -1)
    const day = makeSegment("day", -1)
    const disabled = makeSegment("hour", -1)
    disabled.setAttribute("aria-disabled", "true")
    container.append(year, month, day, disabled)

    applyDateFieldSingleTabStop(container)
    exposeEnabledSegmentsForPointer(container)

    expect(year.tabIndex).toBe(0)
    expect(month.tabIndex).toBe(0)
    expect(day.tabIndex).toBe(0)
    expect(disabled.tabIndex).toBe(-1)
  })
})
