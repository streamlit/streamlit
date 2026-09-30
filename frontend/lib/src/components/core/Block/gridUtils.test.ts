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
  clampColumnSpan,
  computeGridTemplateColumns,
  cssLengthToPx,
  GRID_AUTO_COLUMN_CAP,
  resolveGridColumnCount,
  resolveMinColumnWidthPx,
  shouldScrollGridCell,
} from "./gridUtils"

describe("cssLengthToPx", () => {
  it("parses px, rem, and zero", () => {
    expect(cssLengthToPx("16px", 16)).toBe(16)
    expect(cssLengthToPx("1rem", 16)).toBe(16)
    expect(cssLengthToPx("0", 16)).toBe(0)
  })
})

describe("resolveMinColumnWidthPx", () => {
  it("uses an explicit pixel width without border padding", () => {
    expect(
      resolveMinColumnWidthPx({
        minColumnWidthPx: 280,
        showBorder: true,
        autoMinColumnWidthPx: 200,
        borderPaddingPx: 32,
      })
    ).toBe(280)
  })

  it("uses the auto token, plus border padding when bordered", () => {
    expect(
      resolveMinColumnWidthPx({
        minColumnWidthPx: 0,
        showBorder: false,
        autoMinColumnWidthPx: 200,
        borderPaddingPx: 32,
      })
    ).toBe(200)
    expect(
      resolveMinColumnWidthPx({
        minColumnWidthPx: 0,
        showBorder: true,
        autoMinColumnWidthPx: 200,
        borderPaddingPx: 32,
      })
    ).toBe(232)
  })
})

describe("resolveGridColumnCount", () => {
  const autoFloor = {
    minColumnWidthPx: 200,
    columnGapPx: 16,
    fallbackWidthPx: 736,
  }

  it("caps auto-resolved N at 24", () => {
    expect(
      resolveGridColumnCount({
        availableWidthPx: 10_000,
        minColumnWidthPx: 1,
        columnGapPx: 0,
        maxColumns: 0,
        wrap: true,
        fallbackWidthPx: 736,
      })
    ).toBe(GRID_AUTO_COLUMN_CAP)
  })

  it("wraps st.grid(4) to 3 columns at the default 736px content width", () => {
    expect(
      resolveGridColumnCount({
        ...autoFloor,
        availableWidthPx: 736,
        maxColumns: 4,
        wrap: true,
      })
    ).toBe(3)
  })

  it("uses fallback width when unmeasured so first paint matches content width", () => {
    expect(
      resolveGridColumnCount({
        ...autoFloor,
        availableWidthPx: undefined,
        maxColumns: 4,
        wrap: true,
      })
    ).toBe(3)
  })

  it("keeps the declared count when wrap is false", () => {
    expect(
      resolveGridColumnCount({
        ...autoFloor,
        availableWidthPx: 320,
        maxColumns: 4,
        wrap: false,
      })
    ).toBe(4)
  })

  it("renders one column when the container is narrower than the minimum", () => {
    expect(
      resolveGridColumnCount({
        ...autoFloor,
        availableWidthPx: 180,
        maxColumns: 4,
        wrap: true,
      })
    ).toBe(1)
  })

  it("fits as many auto columns as the container allows", () => {
    expect(
      resolveGridColumnCount({
        availableWidthPx: 1100,
        minColumnWidthPx: 200,
        columnGapPx: 16,
        maxColumns: 0,
        wrap: true,
        fallbackWidthPx: 736,
      })
    ).toBe(5)
  })
})

describe("clampColumnSpan", () => {
  it("clamps an integer span to the resolved column count", () => {
    expect(clampColumnSpan(4, 2)).toBe(2)
    expect(clampColumnSpan(1, 3)).toBe(1)
  })
})

describe("computeGridTemplateColumns", () => {
  it("uses equal fr tracks when wrapping", () => {
    expect(
      computeGridTemplateColumns({
        columnCount: 3,
        minColumnWidthPx: 200,
        wrap: true,
      })
    ).toBe("repeat(3, minmax(0, 1fr))")
  })

  it("keeps the min-width floor when not wrapping", () => {
    expect(
      computeGridTemplateColumns({
        columnCount: 4,
        minColumnWidthPx: 200,
        wrap: false,
      })
    ).toBe("repeat(4, minmax(200px, 1fr))")
  })
})

describe("shouldScrollGridCell", () => {
  it("does not scroll when the cell has no definite height", () => {
    expect(shouldScrollGridCell(400, 0)).toBe(false)
  })

  it("does not scroll when in-flow content fits", () => {
    expect(shouldScrollGridCell(180, 200)).toBe(false)
    expect(shouldScrollGridCell(200, 200)).toBe(false)
  })

  it("scrolls when in-flow content exceeds the cell", () => {
    expect(shouldScrollGridCell(240, 200)).toBe(true)
  })
})
