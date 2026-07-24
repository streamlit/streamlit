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

import { renderHook } from "@testing-library/react"

import { useFirstDayOfWeek } from "./useFirstDayOfWeek"
import { getSafeLocale } from "./weekInfo"

describe("useFirstDayOfWeek", () => {
  it("returns 'mon' for a locale whose week starts on Monday", () => {
    const { result } = renderHook(() => useFirstDayOfWeek("de"))
    expect(result.current).toBe("mon")
  })

  it("returns 'sat' for a locale whose week starts on Saturday", () => {
    const { result } = renderHook(() => useFirstDayOfWeek("ar"))
    expect(result.current).toBe("sat")
  })

  it("returns 'sun' for en-US", () => {
    const { result } = renderHook(() => useFirstDayOfWeek("en-US"))
    expect(result.current).toBe("sun")
  })

  it("falls back to 'sun' for an invalid locale", () => {
    const { result } = renderHook(() => useFirstDayOfWeek("does-not-exist"))
    expect(result.current).toBe("sun")
  })
})

describe("getSafeLocale", () => {
  it("returns valid locale strings unchanged (canonicalized)", () => {
    expect(getSafeLocale("en-US")).toBe("en-US")
    expect(getSafeLocale("de")).toBe("de")
  })

  it("falls back to en-US for a malformed locale string", () => {
    expect(getSafeLocale("does-not-exist")).toBe("en-US")
  })
})
