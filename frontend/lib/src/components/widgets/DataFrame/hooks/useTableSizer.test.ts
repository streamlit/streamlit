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

import { act, renderHook } from "@testing-library/react"

import { Dataframe as DataframeProto, streamlit } from "@streamlit/protobuf"

import { calculateTableHeight } from "~lib/components/widgets/DataFrame/dimensionUtils"
import { VERY_TALL } from "~lib/mocks/arrow/tall"
import { TEN_BY_TEN } from "~lib/mocks/arrow/tenByTen"
import { UNICODE } from "~lib/mocks/arrow/types/unicode"

import { CustomGridTheme } from "./useCustomTheme"
import useTableSizer from "./useTableSizer"

const mockTheme = {
  tableBorderWidth: 1,
  defaultTableHeight: 400,
  minColumnWidth: 50,
  maxColumnWidth: 1000,
  maxColumnAutoWidth: 500,
  defaultRowHeight: 35,
  defaultHeaderHeight: 35,
} as CustomGridTheme

describe("useTableSizer hook", () => {
  it("applies the configured width via widthConfig", () => {
    // The width of the surrounding containers
    const CONTAINER_WIDTH = 700
    const TABLE_WIDTH = 350
    const widthConfig = new streamlit.WidthConfig({ pixelWidth: TABLE_WIDTH })
    const { result } = renderHook(() =>
      useTableSizer(
        DataframeProto.create({ arrowData: { data: TEN_BY_TEN } }),
        mockTheme,
        10,
        false,
        CONTAINER_WIDTH,
        undefined,
        false,
        widthConfig
      )
    )

    expect(result.current.resizableSize.width).toEqual(TABLE_WIDTH)
    expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
  })

  it("Uses the minimum table width if container width is -1", () => {
    // The width of the surrounding containers can be -1 in some edge cases
    // caused by the resize observer in the Block component.
    // We test that the dataframe component correctly handles this case
    // by falling back to the minimum table width instead.
    // Related to: https://github.com/streamlit/streamlit/issues/7949
    const CONTAINER_WIDTH = -1
    const widthConfig = new streamlit.WidthConfig({ useStretch: true })
    const { result } = renderHook(() =>
      useTableSizer(
        DataframeProto.create({ arrowData: { data: TEN_BY_TEN } }),
        mockTheme,
        10,
        false,
        CONTAINER_WIDTH,
        undefined,
        false,
        widthConfig
      )
    )

    const minTableWidth =
      mockTheme.minColumnWidth + 2 * mockTheme.tableBorderWidth

    expect(result.current.resizableSize.width).toEqual(minTableWidth)
    expect(result.current.maxWidth).toEqual(minTableWidth)
    expect(result.current.minWidth).toEqual(minTableWidth)
  })

  it("adapts to the surrounding container width", () => {
    // The width of the surrounding containers
    const CONTAINER_WIDTH = 200
    const TABLE_WIDTH = 350
    const widthConfig = new streamlit.WidthConfig({ pixelWidth: TABLE_WIDTH })
    const { result } = renderHook(() =>
      useTableSizer(
        DataframeProto.create({ arrowData: { data: TEN_BY_TEN } }),
        mockTheme,
        10,
        false,
        CONTAINER_WIDTH,
        undefined,
        false,
        widthConfig
      )
    )

    expect(result.current.resizableSize.width).toEqual(CONTAINER_WIDTH)
    expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
  })

  it("applies the configured height above minimum", () => {
    const NUMBER_OF_ROWS = 10
    const TABLE_HEIGHT = 100
    const heightConfig = new streamlit.HeightConfig({
      pixelHeight: TABLE_HEIGHT,
    })

    const { result } = renderHook(() =>
      useTableSizer(
        DataframeProto.create({ arrowData: { data: TEN_BY_TEN } }),
        mockTheme,
        NUMBER_OF_ROWS,
        false,
        700,
        undefined,
        false,
        undefined,
        heightConfig
      )
    )

    const FULL_TABLE_HEIGHT = calculateTableHeight({
      numRows: NUMBER_OF_ROWS,
      rowHeight: mockTheme.defaultRowHeight,
      theme: mockTheme,
    })
    // Base minimum is 72px, so 100px is respected
    expect(result.current.resizableSize.height).toEqual(TABLE_HEIGHT)
    expect(result.current.maxHeight).toEqual(FULL_TABLE_HEIGHT)
  })

  it("enforces 1-row minimum for configured height below minimum", () => {
    const NUMBER_OF_ROWS = 10
    const TABLE_HEIGHT = 50 // Below 1-row minimum of 72px
    const heightConfig = new streamlit.HeightConfig({
      pixelHeight: TABLE_HEIGHT,
    })

    const { result } = renderHook(() =>
      useTableSizer(
        DataframeProto.create({ arrowData: { data: TEN_BY_TEN } }),
        mockTheme,
        NUMBER_OF_ROWS,
        false,
        700,
        undefined,
        false,
        undefined,
        heightConfig
      )
    )

    // Base minimum: header + 1 row + borders = 35 + 35 + 2 = 72
    const BASE_MIN_HEIGHT = calculateTableHeight({
      numRows: 1,
      rowHeight: mockTheme.defaultRowHeight,
      theme: mockTheme,
    })

    // Enforced to 1-row minimum
    expect(result.current.resizableSize.height).toEqual(BASE_MIN_HEIGHT)
    expect(result.current.minHeight).toEqual(BASE_MIN_HEIGHT)
  })

  it("correctly includes group row in height calculation", () => {
    const NUMBER_OF_ROWS = 10
    const TABLE_HEIGHT = 100
    const heightConfig = new streamlit.HeightConfig({
      pixelHeight: TABLE_HEIGHT,
    })

    const { result } = renderHook(() =>
      useTableSizer(
        DataframeProto.create({ arrowData: { data: TEN_BY_TEN } }),
        mockTheme,
        NUMBER_OF_ROWS,
        true,
        700,
        undefined,
        false,
        undefined,
        heightConfig
      )
    )

    expect(result.current.resizableSize.height).toEqual(TABLE_HEIGHT)
    expect(result.current.maxHeight).toEqual(
      calculateTableHeight({
        numRows: NUMBER_OF_ROWS,
        rowHeight: mockTheme.defaultRowHeight,
        theme: mockTheme,
        numHeaderRows: 2, // group row + column header row
      })
    )
  })

  it("shows actual row count for default (auto) height with few rows", () => {
    const NUMBER_OF_ROWS = 2 // Less than 3 rows
    const { result } = renderHook(() =>
      useTableSizer(
        DataframeProto.create({
          arrowData: { data: UNICODE },
          // No height configured - should use default auto height
        }),
        mockTheme,
        NUMBER_OF_ROWS,
        false,
        700
      )
    )

    // Base minimum is header + 1 row + borders = 35 + 35 + 2 = 72
    const BASE_MIN_HEIGHT = calculateTableHeight({
      numRows: 1,
      rowHeight: mockTheme.defaultRowHeight,
      theme: mockTheme,
    })

    // With 2 rows: height = 2*35 + 35 + 2 = 107 (above 72px min)
    const EXPECTED_HEIGHT = calculateTableHeight({
      numRows: NUMBER_OF_ROWS,
      rowHeight: mockTheme.defaultRowHeight,
      theme: mockTheme,
    })

    expect(result.current.maxHeight).toEqual(EXPECTED_HEIGHT)
    expect(result.current.resizableSize.height).toEqual(EXPECTED_HEIGHT)
    expect(result.current.minHeight).toEqual(BASE_MIN_HEIGHT)
  })

  it("applies useStretch width configuration", () => {
    // The width of the surrounding containers
    const CONTAINER_WIDTH = 700
    const widthConfig = new streamlit.WidthConfig({ useStretch: true })
    const { result } = renderHook(() =>
      useTableSizer(
        DataframeProto.create({ arrowData: { data: TEN_BY_TEN } }),
        mockTheme,
        10,
        false,
        CONTAINER_WIDTH,
        undefined,
        false,
        widthConfig
      )
    )

    expect(result.current.resizableSize.width).toEqual(CONTAINER_WIDTH)
    expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
  })

  it("calculates correct container dimensions for a table", () => {
    // The width of the surrounding containers
    const CONTAINER_WIDTH = 700
    const { result } = renderHook(() =>
      useTableSizer(
        DataframeProto.create({
          arrowData: { data: UNICODE },
        }),
        mockTheme,
        2, // Unicode table has 2 rows
        false,
        CONTAINER_WIDTH
      )
    )

    // This is expected to be 100% to adapt to whatever width the glide data grid calculates
    expect(result.current.resizableSize.width).toEqual("100%")
    expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
  })

  it("calculates correct container dimensions for fullscreen mode", () => {
    // The width of the surrounding containers
    const CONTAINER_WIDTH = 1920
    const CONTAINER_HEIGHT = 1080
    const widthConfig = new streamlit.WidthConfig({ useStretch: true })

    const { result } = renderHook(() =>
      useTableSizer(
        DataframeProto.create({
          arrowData: { data: VERY_TALL },
        }),
        mockTheme,
        100, // VERY_TALL table has 100 rows
        false,
        CONTAINER_WIDTH,
        CONTAINER_HEIGHT,
        true,
        widthConfig
      )
    )

    expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
    expect(result.current.maxHeight).toEqual(CONTAINER_HEIGHT)
    expect(result.current.resizableSize.width).toEqual(CONTAINER_WIDTH)
    expect(result.current.resizableSize.height).toEqual(CONTAINER_HEIGHT)
  })

  it("adapts size on resizing", () => {
    // The width of the surrounding containers
    const CONTAINER_WIDTH = 700
    const TABLE_WIDTH = 350
    const NUMBER_OF_ROWS = 10 // TEN_BY_TEN has 10 rows
    const widthConfig = new streamlit.WidthConfig({ pixelWidth: TABLE_WIDTH })
    const { result } = renderHook(() =>
      useTableSizer(
        DataframeProto.create({ arrowData: { data: TEN_BY_TEN } }),
        mockTheme,
        NUMBER_OF_ROWS,
        false,
        CONTAINER_WIDTH,
        undefined,
        false,
        widthConfig
      )
    )

    const NEW_WIDTH = 100
    const NEW_HEIGHT = 100

    act(() => {
      const { setResizableSize } = result.current
      setResizableSize?.({
        width: NEW_WIDTH,
        height: NEW_HEIGHT,
      })
    })

    expect(result.current.resizableSize.width).toEqual(NEW_WIDTH)
    expect(result.current.resizableSize.height).toEqual(NEW_HEIGHT)
    expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
    expect(result.current.maxHeight).toEqual(
      calculateTableHeight({
        numRows: NUMBER_OF_ROWS,
        rowHeight: mockTheme.defaultRowHeight,
        theme: mockTheme,
      })
    )
  })

  describe("with heightConfig", () => {
    it("applies useStretch configuration with sufficient container height", () => {
      const NUMBER_OF_ROWS = 10
      const MEASURED_CONTAINER_HEIGHT = 300
      const heightConfig = new streamlit.HeightConfig({ useStretch: true })

      const { result } = renderHook(() =>
        useTableSizer(
          DataframeProto.create({
            arrowData: { data: TEN_BY_TEN },
          }),
          mockTheme,
          NUMBER_OF_ROWS,
          false,
          700,
          undefined,
          false,
          undefined,
          heightConfig,
          MEASURED_CONTAINER_HEIGHT,
          false // not in root
        )
      )

      // With 10 rows: maxHeight = 10*35 + 35 + 2 = 387
      // initialHeight = min(387, 400) = 387
      // Since stretch height doesn't override initialHeight, it uses the calculated height
      const expectedMaxHeight = calculateTableHeight({
        numRows: NUMBER_OF_ROWS,
        rowHeight: mockTheme.defaultRowHeight,
        theme: mockTheme,
      })

      expect(result.current.resizableSize.height).toEqual(expectedMaxHeight)
      // maxHeight should be the greater of measured container or calculated max
      expect(result.current.maxHeight).toBeGreaterThanOrEqual(
        MEASURED_CONTAINER_HEIGHT
      )
    })

    it("enforces 1-row minimum with stretch height when 0 rows", () => {
      const NUMBER_OF_ROWS = 0
      const MEASURED_CONTAINER_HEIGHT = 300
      const heightConfig = new streamlit.HeightConfig({ useStretch: true })

      const { result } = renderHook(() =>
        useTableSizer(
          DataframeProto.create({
            arrowData: { data: UNICODE },
          }),
          mockTheme,
          NUMBER_OF_ROWS,
          false,
          700,
          undefined,
          false,
          undefined,
          heightConfig,
          MEASURED_CONTAINER_HEIGHT,
          false // not in root
        )
      )

      // Stretch minimum with 0 rows: enforced to 1 row = 35 + 35 + 2 = 72
      const STRETCH_MIN_HEIGHT = calculateTableHeight({
        numRows: 1,
        rowHeight: mockTheme.defaultRowHeight,
        theme: mockTheme,
      })

      expect(result.current.resizableSize.height).toEqual(STRETCH_MIN_HEIGHT)
      expect(result.current.minHeight).toEqual(STRETCH_MIN_HEIGHT)
    })

    it("matches actual rows with stretch height when 2 rows", () => {
      const NUMBER_OF_ROWS = 2
      const MEASURED_CONTAINER_HEIGHT = 300
      const heightConfig = new streamlit.HeightConfig({ useStretch: true })

      const { result } = renderHook(() =>
        useTableSizer(
          DataframeProto.create({
            arrowData: { data: UNICODE },
          }),
          mockTheme,
          NUMBER_OF_ROWS,
          false,
          700,
          undefined,
          false,
          undefined,
          heightConfig,
          MEASURED_CONTAINER_HEIGHT,
          false // not in root
        )
      )

      // Stretch minimum matches actual rows: header + 2 rows + borders = 35 + 2*35 + 2 = 107
      const STRETCH_MIN_HEIGHT = calculateTableHeight({
        numRows: NUMBER_OF_ROWS,
        rowHeight: mockTheme.defaultRowHeight,
        theme: mockTheme,
      })

      // With 2 rows: calculated = 2*35 + 35 + 2 = 107, matches minimum
      expect(result.current.resizableSize.height).toEqual(STRETCH_MIN_HEIGHT)
      expect(result.current.minHeight).toEqual(STRETCH_MIN_HEIGHT)
    })

    it("matches actual rows with stretch height when 3 rows", () => {
      const NUMBER_OF_ROWS = 3
      const MEASURED_CONTAINER_HEIGHT = 15 // Small measured container height due to layout calculations
      const heightConfig = new streamlit.HeightConfig({ useStretch: true })

      const { result } = renderHook(() =>
        useTableSizer(
          DataframeProto.create({
            arrowData: { data: TEN_BY_TEN },
          }),
          mockTheme,
          NUMBER_OF_ROWS,
          false,
          700,
          undefined,
          false,
          undefined,
          heightConfig,
          MEASURED_CONTAINER_HEIGHT,
          false // not in root
        )
      )

      // Stretch minimum matches actual rows: header + 3 rows + borders = 35 + 3*35 + 2 = 142
      const STRETCH_MIN_HEIGHT = calculateTableHeight({
        numRows: 3,
        rowHeight: mockTheme.defaultRowHeight,
        theme: mockTheme,
      })

      // With 3 rows: calculated = 3*35 + 35 + 2 = 142, matches minimum
      expect(result.current.resizableSize.height).toEqual(STRETCH_MIN_HEIGHT)
      expect(result.current.maxHeight).toEqual(STRETCH_MIN_HEIGHT)
      expect(result.current.minHeight).toEqual(STRETCH_MIN_HEIGHT)
    })

    it("enforces 3-row minimum with stretch height when 5+ rows", () => {
      const NUMBER_OF_ROWS = 5
      const MEASURED_CONTAINER_HEIGHT = 15 // Small measured container height due to layout calculations
      const heightConfig = new streamlit.HeightConfig({ useStretch: true })

      const { result } = renderHook(() =>
        useTableSizer(
          DataframeProto.create({
            arrowData: { data: TEN_BY_TEN },
          }),
          mockTheme,
          NUMBER_OF_ROWS,
          false,
          700,
          undefined,
          false,
          undefined,
          heightConfig,
          MEASURED_CONTAINER_HEIGHT,
          false // not in root
        )
      )

      // Stretch min height (when > 3 rows) is capped at 3 rows = 35 + 3*35 + 2 = 142
      const STRETCH_MIN_HEIGHT = calculateTableHeight({
        numRows: 3,
        rowHeight: mockTheme.defaultRowHeight,
        theme: mockTheme,
      })

      // With 5 rows: calculated = 5*35 + 35 + 2 = 212, but minimum is enforced
      const CALCULATED_HEIGHT = calculateTableHeight({
        numRows: NUMBER_OF_ROWS,
        rowHeight: mockTheme.defaultRowHeight,
        theme: mockTheme,
      })

      expect(result.current.resizableSize.height).toEqual(CALCULATED_HEIGHT)
      expect(result.current.maxHeight).toEqual(CALCULATED_HEIGHT)
      expect(result.current.minHeight).toEqual(STRETCH_MIN_HEIGHT)
    })

    it("does not apply stretch height when in root container", () => {
      const NUMBER_OF_ROWS = 10
      const MEASURED_CONTAINER_HEIGHT = 300
      const heightConfig = new streamlit.HeightConfig({ useStretch: true })

      const { result } = renderHook(() =>
        useTableSizer(
          DataframeProto.create({
            arrowData: { data: TEN_BY_TEN },
          }),
          mockTheme,
          NUMBER_OF_ROWS,
          false,
          700,
          undefined,
          false,
          undefined,
          heightConfig,
          MEASURED_CONTAINER_HEIGHT,
          true // in root - stretch doesn't work here
        )
      )

      // When in root, stretch height shouldn't be applied
      // With 10 rows: maxHeight = 10*35 + 35 + 2 = 387
      // initialHeight = min(387, 400) = 387
      const expectedHeight = calculateTableHeight({
        numRows: NUMBER_OF_ROWS,
        rowHeight: mockTheme.defaultRowHeight,
        theme: mockTheme,
      })

      expect(result.current.resizableSize.height).not.toEqual("100%")
      expect(result.current.resizableSize.height).toEqual(expectedHeight)
    })
  })

  describe("with widthConfig", () => {
    it("applies useStretch configuration", () => {
      const CONTAINER_WIDTH = 700
      const widthConfig = new streamlit.WidthConfig({ useStretch: true })

      const { result } = renderHook(() =>
        useTableSizer(
          DataframeProto.create({
            arrowData: { data: TEN_BY_TEN },
          }),
          mockTheme,
          10,
          false,
          CONTAINER_WIDTH,
          undefined,
          false,
          widthConfig
        )
      )

      expect(result.current.resizableSize.width).toEqual(CONTAINER_WIDTH)
      expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
    })

    it("applies pixelWidth configuration", () => {
      const CONTAINER_WIDTH = 700
      const PIXEL_WIDTH = 350
      const widthConfig = new streamlit.WidthConfig({
        pixelWidth: PIXEL_WIDTH,
      })

      const { result } = renderHook(() =>
        useTableSizer(
          DataframeProto.create({
            arrowData: { data: TEN_BY_TEN },
          }),
          mockTheme,
          10,
          false,
          CONTAINER_WIDTH,
          undefined,
          false,
          widthConfig
        )
      )

      expect(result.current.resizableSize.width).toEqual(PIXEL_WIDTH)
      expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
    })

    it("adapts pixelWidth to container width when larger", () => {
      const CONTAINER_WIDTH = 200
      const PIXEL_WIDTH = 350
      const widthConfig = new streamlit.WidthConfig({
        pixelWidth: PIXEL_WIDTH,
      })

      const { result } = renderHook(() =>
        useTableSizer(
          DataframeProto.create({
            arrowData: { data: TEN_BY_TEN },
          }),
          mockTheme,
          10,
          false,
          CONTAINER_WIDTH,
          undefined,
          false,
          widthConfig
        )
      )

      // Should adapt to container width when configured width is larger
      expect(result.current.resizableSize.width).toEqual(CONTAINER_WIDTH)
      expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
    })

    it("prioritizes widthConfig over legacy width", () => {
      const CONTAINER_WIDTH = 700
      const PIXEL_WIDTH = 350
      const widthConfig = new streamlit.WidthConfig({
        pixelWidth: PIXEL_WIDTH,
      })

      const { result } = renderHook(() =>
        useTableSizer(
          DataframeProto.create({
            arrowData: { data: TEN_BY_TEN },
          }),
          mockTheme,
          10,
          false,
          CONTAINER_WIDTH,
          undefined,
          false,
          widthConfig
        )
      )

      expect(result.current.resizableSize.width).toEqual(PIXEL_WIDTH)
      expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
    })

    it("uses auto width behavior when widthConfig is null", () => {
      const CONTAINER_WIDTH = 700

      const { result } = renderHook(() =>
        useTableSizer(
          DataframeProto.create({
            arrowData: { data: TEN_BY_TEN },
          }),
          mockTheme,
          10,
          false,
          CONTAINER_WIDTH,
          undefined,
          false,
          null
        )
      )

      // When widthConfig is null, width should auto-size (100%)
      expect(result.current.resizableSize.width).toEqual("100%")
      expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
    })
  })

  it("uses auto width behavior when widthConfig is null", () => {
    const CONTAINER_WIDTH = 700

    const { result } = renderHook(() =>
      useTableSizer(
        DataframeProto.create({ arrowData: { data: TEN_BY_TEN } }),
        mockTheme,
        10,
        false,
        CONTAINER_WIDTH,
        undefined,
        false,
        null
      )
    )

    // When widthConfig is null, width should auto-size (100%)
    expect(result.current.resizableSize.width).toEqual("100%")
    expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
  })

  describe("with useContent height", () => {
    it("uses content-based height for fewer rows than the cap", () => {
      const NUMBER_OF_ROWS = 5
      const heightConfig = new streamlit.HeightConfig({ useContent: true })

      const { result } = renderHook(() =>
        useTableSizer(
          DataframeProto.create({ arrowData: { data: TEN_BY_TEN } }),
          mockTheme,
          NUMBER_OF_ROWS,
          false,
          700,
          undefined,
          false,
          undefined,
          heightConfig
        )
      )

      // height="content" shows all rows + 1px for grid spacing.
      const EXPECTED_CONTENT_HEIGHT =
        calculateTableHeight({
          numRows: NUMBER_OF_ROWS,
          rowHeight: mockTheme.defaultRowHeight,
          theme: mockTheme,
        }) + 1

      expect(result.current.resizableSize.height).toEqual(
        EXPECTED_CONTENT_HEIGHT
      )
      expect(result.current.maxHeight).toEqual(EXPECTED_CONTENT_HEIGHT)
    })

    it("caps content height by row count derived from 10,000px threshold", () => {
      // The cap is row-based: Math.ceil(10000 / rowHeight). With 1000 rows
      // and a 35px row height, the cap kicks in at ~286 rows.
      const NUMBER_OF_ROWS = 1000
      const heightConfig = new streamlit.HeightConfig({ useContent: true })

      const { result } = renderHook(() =>
        useTableSizer(
          DataframeProto.create({ arrowData: { data: VERY_TALL } }),
          mockTheme,
          NUMBER_OF_ROWS,
          false,
          700,
          undefined,
          false,
          undefined,
          heightConfig
        )
      )

      const maxRowsForHeightCap = Math.ceil(10000 / mockTheme.defaultRowHeight)
      const EXPECTED_CAPPED_HEIGHT =
        calculateTableHeight({
          numRows: maxRowsForHeightCap,
          rowHeight: mockTheme.defaultRowHeight,
          theme: mockTheme,
        }) + 1

      expect(result.current.resizableSize.height).toEqual(
        EXPECTED_CAPPED_HEIGHT
      )
      // With 1000 rows of full height, calculatedHeight exceeds the cap, so
      // maxHeight is the larger of the two.
      expect(result.current.maxHeight).toBeGreaterThanOrEqual(
        EXPECTED_CAPPED_HEIGHT
      )
    })

    it("enforces the 1-row minimum for content height when 0 rows", () => {
      const heightConfig = new streamlit.HeightConfig({ useContent: true })

      const { result } = renderHook(() =>
        useTableSizer(
          DataframeProto.create({ arrowData: { data: UNICODE } }),
          mockTheme,
          0,
          false,
          700,
          undefined,
          false,
          undefined,
          heightConfig
        )
      )

      const BASE_MIN_HEIGHT = calculateTableHeight({
        numRows: 1,
        rowHeight: mockTheme.defaultRowHeight,
        theme: mockTheme,
      })

      expect(result.current.resizableSize.height).toEqual(BASE_MIN_HEIGHT)
      expect(result.current.minHeight).toEqual(BASE_MIN_HEIGHT)
    })
  })

  it("uses content-based width when widthConfig has useContent set", () => {
    const CONTAINER_WIDTH = 700
    const widthConfig = new streamlit.WidthConfig({ useContent: true })

    const { result } = renderHook(() =>
      useTableSizer(
        DataframeProto.create({ arrowData: { data: TEN_BY_TEN } }),
        mockTheme,
        10,
        false,
        CONTAINER_WIDTH,
        undefined,
        false,
        widthConfig
      )
    )

    // width="content" falls back to "100%" with no initialWidth, letting the
    // data grid auto-size to its content.
    expect(result.current.resizableSize.width).toEqual("100%")
    expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
  })

  it("re-syncs width to the available container width on resize when stretching", () => {
    const widthConfig = new streamlit.WidthConfig({ useStretch: true })
    const INITIAL_CONTAINER_WIDTH = 700
    const NEW_CONTAINER_WIDTH = 900

    const { result, rerender } = renderHook(
      ({ containerWidth }: { containerWidth: number }) =>
        useTableSizer(
          DataframeProto.create({ arrowData: { data: TEN_BY_TEN } }),
          mockTheme,
          10,
          false,
          containerWidth,
          undefined,
          false,
          widthConfig
        ),
      { initialProps: { containerWidth: INITIAL_CONTAINER_WIDTH } }
    )

    expect(result.current.resizableSize.width).toEqual(INITIAL_CONTAINER_WIDTH)

    act(() => {
      result.current.setResizableSize({
        width: "100%",
        height: result.current.resizableSize.height,
      })
    })

    rerender({ containerWidth: NEW_CONTAINER_WIDTH })

    // The [availableWidth] effect picks up "100%" and replaces it with the
    // newly available container width.
    expect(result.current.resizableSize.width).toEqual(NEW_CONTAINER_WIDTH)
    expect(result.current.maxWidth).toEqual(NEW_CONTAINER_WIDTH)
  })
})
