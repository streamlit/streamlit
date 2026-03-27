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

import { describe, expect, it, vi } from "vitest"

import { DateTimeInput as DateTimeInputProto } from "@streamlit/protobuf"

import { ValueWithSource } from "~lib/hooks/useBasicWidgetState"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  combineDateAndTime,
  isSameDay,
  normalizeDateValue,
  stringToDate,
  updateWidgetMgrState,
} from "./dateTimeInputUtils"

describe("stringToDate", () => {
  it("parses valid datetime strings and resets seconds", () => {
    const result = stringToDate("2024/05/10, 13:47")
    expect(result).not.toBeNull()
    expect(result?.getMinutes()).toBe(47)
    expect(result?.getSeconds()).toBe(0)
  })

  it("returns null for invalid or falsy values", () => {
    expect(stringToDate("invalid")).toBeNull()
    expect(stringToDate(null)).toBeNull()
    expect(stringToDate(undefined)).toBeNull()
    expect(stringToDate("")).toBeNull()
  })
})

describe("normalizeDateValue", () => {
  it("normalizes arrays by picking the first valid date", () => {
    const first = new Date("2024-01-01T10:15:30Z")
    const second = new Date("2024-01-02T11:30:00Z")
    const normalized = normalizeDateValue([null, undefined, first, second])
    expect(normalized?.getMinutes()).toBe(first.getMinutes())
    expect(normalized?.getSeconds()).toBe(0)
  })

  it("returns null when no valid date exists", () => {
    expect(normalizeDateValue([null, undefined])).toBeNull()
  })
})

describe("dateHelpers", () => {
  it("identifies same day values", () => {
    expect(
      isSameDay(
        new Date("2024-06-01T03:00:00Z"),
        new Date("2024-06-01T20:00:00Z")
      )
    ).toBe(true)
    expect(
      isSameDay(
        new Date("2024-06-01T03:00:00Z"),
        new Date("2024-06-02T03:00:00Z")
      )
    ).toBe(false)
  })

  it("combines date and time portions", () => {
    const date = new Date("2024-06-01T00:00:00Z")
    const time = new Date("2024-06-01T13:45:00Z")
    const combined = combineDateAndTime(date, time)
    expect(combined.getHours()).toBe(13)
    expect(combined.getMinutes()).toBe(45)
  })
})

describe("updateWidgetMgrState", () => {
  const element = {
    min: "2024/01/01, 00:00",
    max: "2024/12/31, 23:45",
  } as unknown as DateTimeInputProto

  const makeWidgetMgr = (): WidgetStateManager =>
    ({
      setStringArrayValue: vi.fn(),
    }) as unknown as WidgetStateManager

  it("commits values within bounds", () => {
    const widgetMgr = makeWidgetMgr()
    const vws: ValueWithSource<string | null> = {
      value: "2024/06/01, 12:00",
      fromUi: true,
    }

    updateWidgetMgrState(element, widgetMgr, vws, "fragment")

    expect(widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      element,
      ["2024/06/01, 12:00"],
      { fromUi: true },
      "fragment"
    )
  })

  it("rejects values outside bounds", () => {
    const widgetMgr = makeWidgetMgr()
    const vws: ValueWithSource<string | null> = {
      value: "2025/01/01, 12:00",
      fromUi: true,
    }

    updateWidgetMgrState(element, widgetMgr, vws, undefined)

    expect(widgetMgr.setStringArrayValue).not.toHaveBeenCalled()
  })

  it("allows null values", () => {
    const widgetMgr = makeWidgetMgr()
    const vws: ValueWithSource<string | null> = {
      value: null,
      fromUi: false,
    }

    updateWidgetMgrState(element, widgetMgr, vws, undefined)

    expect(widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      element,
      [],
      { fromUi: false },
      undefined
    )
  })
})
