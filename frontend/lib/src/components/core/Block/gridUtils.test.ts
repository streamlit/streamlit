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
  gridTracksMinWidthPx,
  resolveDefaultGridContentBoxPx,
  resolveGridColumnCount,
  resolveMinColumnWidthPx,
  shouldEnableOverflowScroll,
  shouldScrollHorizontally,
} from "./gridUtils"

describe("cssLengthToPx", () => {
  it("parses px, rem, and zero", () => {
    expect(cssLengthToPx("16px", 16)).toBe(16)
    expect(cssLengthToPx("1rem", 16)).toBe(16)
    expect(cssLengthToPx("0", 16)).toBe(0)
  })
})

describe("resolveMinColumnWidthPx", () => {
  it("uses an explicit pixel width unchanged", () => {
    expect(
      resolveMinColumnWidthPx({
        minColumnWidthPx: 280,
        autoMinColumnWidthPx: 200,
      })
    ).toBe(280)
  })

  it("keeps a bordered auto floor at 200px for a 16px root", () => {
    const autoMinColumnWidthPx = cssLengthToPx("12.5rem", 16)
    expect(autoMinColumnWidthPx).toBe(200)
    expect(
      resolveMinColumnWidthPx({
        minColumnWidthPx: 0,
        autoMinColumnWidthPx,
      })
    ).toBe(200)
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

  it("wraps st.grid(4) to 3 columns at the default 704px content box", () => {
    expect(
      resolveGridColumnCount({
        ...autoFloor,
        availableWidthPx: 704,
        maxColumns: 4,
        wrap: true,
      })
    ).toBe(3)
  })

  it("fits one more column in raw contentMaxWidth than in the padded box", () => {
    const narrowFloor = {
      minColumnWidthPx: 170,
      columnGapPx: 16,
      maxColumns: 0,
      wrap: true,
      fallbackWidthPx: 0,
    }
    expect(
      resolveGridColumnCount({
        ...narrowFloor,
        availableWidthPx: 736,
      })
    ).toBe(4)
    expect(
      resolveGridColumnCount({
        ...narrowFloor,
        availableWidthPx: 704,
      })
    ).toBe(3)
  })

  it("resolves st.grid(4, border=True) to 3 columns at 704px", () => {
    const minColumnWidthPx = resolveMinColumnWidthPx({
      minColumnWidthPx: 0,
      autoMinColumnWidthPx: cssLengthToPx("12.5rem", 16),
    })
    expect(
      resolveGridColumnCount({
        availableWidthPx: 704,
        minColumnWidthPx,
        columnGapPx: 16,
        maxColumns: 4,
        wrap: true,
        fallbackWidthPx: 736,
      })
    ).toBe(3)
  })

  it("uses the padded content box when unmeasured", () => {
    expect(
      resolveGridColumnCount({
        ...autoFloor,
        availableWidthPx: undefined,
        maxColumns: 4,
        wrap: true,
        fallbackWidthPx: resolveDefaultGridContentBoxPx({
          contentMaxWidthPx: 736,
          horizontalPaddingPx: 16,
        }),
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

describe("resolveDefaultGridContentBoxPx", () => {
  it("subtracts horizontal padding from contentMaxWidth", () => {
    expect(
      resolveDefaultGridContentBoxPx({
        contentMaxWidthPx: cssLengthToPx("736px", 16),
        horizontalPaddingPx: cssLengthToPx("1rem", 16),
      })
    ).toBe(704)
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

describe("shouldScrollHorizontally", () => {
  it("does not scroll a wrapping grid or a no-wrap grid whose tracks fit", () => {
    expect(shouldScrollHorizontally(true, 848, 400)).toBe(false)
    expect(shouldScrollHorizontally(false, 216, 704)).toBe(false)
    expect(shouldScrollHorizontally(false, 705, 704)).toBe(false)
    expect(shouldScrollHorizontally(false, 848, 0)).toBe(false)
  })

  it("scrolls a no-wrap grid once tracks exceed the box", () => {
    expect(gridTracksMinWidthPx(4, 200, 16)).toBe(848)
    expect(shouldScrollHorizontally(false, 848, 704)).toBe(true)
  })
})

describe("shouldEnableOverflowScroll", () => {
  it("does not scroll when the box has no definite height", () => {
    expect(shouldEnableOverflowScroll(400, 0)).toBe(false)
  })

  it("does not scroll when in-flow content fits, including one pixel of slack", () => {
    expect(shouldEnableOverflowScroll(180, 200)).toBe(false)
    expect(shouldEnableOverflowScroll(200, 200)).toBe(false)
    expect(shouldEnableOverflowScroll(201, 200)).toBe(false)
  })

  it("scrolls when in-flow content exceeds the box", () => {
    expect(shouldEnableOverflowScroll(202, 200)).toBe(true)
    expect(shouldEnableOverflowScroll(240, 200)).toBe(true)
  })
})
