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
  drawTextCell,
  Theme as GlideTheme,
  GridCellKind,
} from "@glideapps/glide-data-grid"
import { renderHook } from "@testing-library/react"
import { Field, Int64, Utf8 } from "apache-arrow"

import {
  BaseColumn,
  getEmptyCell,
  getErrorCell,
  NumberColumn,
  TextColumn,
} from "~lib/components/widgets/DataFrame/columns"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import useCustomRenderer from "./useCustomRenderer"

vi.mock("@glideapps/glide-data-grid", async importOriginal => {
  const actual =
    await importOriginal<typeof import("@glideapps/glide-data-grid")>()
  return {
    ...actual,
    drawTextCell: vi.fn(),
  }
})

const MOCK_COLUMNS: BaseColumn[] = [
  NumberColumn({
    id: "column_1",
    name: "column_1",
    title: "column_1",
    indexNumber: 0,
    arrowType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field("column_1", new Int64(), true),
      pandasType: {
        field_name: "column_1",
        name: "column_1",
        pandas_type: "int64",
        numpy_type: "int64",
        metadata: null,
      },
    },
    isEditable: true,
    isRequired: true,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
  }),
  TextColumn({
    id: "column_2",
    name: "column_2",
    title: "column_2",
    indexNumber: 1,
    arrowType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field("column_2", new Utf8(), true),
      pandasType: {
        field_name: "column_2",
        name: "column_2",
        pandas_type: "unicode",
        numpy_type: "object",
        metadata: null,
      },
    },
    isEditable: true,
    isRequired: false,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
  }),
]

const MOCK_THEME: Partial<GlideTheme> = {
  cellHorizontalPadding: 8,
  accentColor: "#ff0000",
  textDark: "#000000",
  textLight: "#888888",
  headerFontStyle: "600 13px",
  baseFontStyle: "13px",
  markerFontStyle: "600 9px",
  fontFamily: "sans-serif",
}

const createMockCanvasContext = (): CanvasRenderingContext2D => {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fill: vi.fn(),
    fillStyle: "",
  } as unknown as CanvasRenderingContext2D
}

describe("useCustomRenderer hook", () => {
  beforeEach(() => {
    vi.mocked(drawTextCell).mockClear()
  })

  it("returns correct initial state", () => {
    const { result } = renderHook(() => {
      return useCustomRenderer(MOCK_COLUMNS)
    })

    // Initial state assertions
    expect(typeof result.current.drawCell).toBe("function")
    expect(Array.isArray(result.current.customRenderers)).toBeTruthy()
  })

  it("includes expected custom renderers", () => {
    const { result } = renderHook(() => {
      return useCustomRenderer(MOCK_COLUMNS)
    })

    // Should include multiple custom renderers
    expect(result.current.customRenderers?.length).toBeGreaterThan(0)
  })

  describe("drawCell callback", () => {
    it("calls draw() for normal cells", () => {
      const { result } = renderHook(() => {
        return useCustomRenderer(MOCK_COLUMNS)
      })

      const drawMock = vi.fn()
      const ctx = createMockCanvasContext()

      const normalCell = {
        kind: GridCellKind.Number,
        data: 123,
        displayData: "123",
        allowOverlay: true,
      }

      const args = {
        cell: normalCell,
        theme: MOCK_THEME as GlideTheme,
        ctx,
        rect: { x: 0, y: 0, width: 100, height: 35 },
        col: 0,
        row: 0,
      }

      result.current.drawCell?.(args as never, drawMock)

      expect(drawMock).toHaveBeenCalled()
    })

    it("draws attention indicator for error cells", () => {
      const { result } = renderHook(() => {
        return useCustomRenderer(MOCK_COLUMNS)
      })

      const drawMock = vi.fn()
      const ctx = createMockCanvasContext()

      const errorCell = getErrorCell("Error", "Error details")

      const args = {
        cell: errorCell,
        theme: MOCK_THEME as GlideTheme,
        ctx,
        rect: { x: 0, y: 0, width: 100, height: 35 },
        col: 0,
        row: 0,
      }

      result.current.drawCell?.(args as never, drawMock)

      // Should draw attention indicator
      expect(ctx.beginPath).toHaveBeenCalled()
      expect(ctx.fill).toHaveBeenCalled()
      // Should still call draw
      expect(drawMock).toHaveBeenCalled()
    })

    it("accepts custom missing placeholder parameter without error", () => {
      const customPlaceholder = "N/A"
      // Verify hook initializes successfully with custom placeholder
      // Full rendering behavior is covered by E2E tests
      expect(() => {
        renderHook(() => useCustomRenderer(MOCK_COLUMNS, customPlaceholder))
      }).not.toThrow()
    })

    it("draws missing placeholder for missing-value cells with default placeholder", () => {
      const { result } = renderHook(() => useCustomRenderer(MOCK_COLUMNS))

      const drawMock = vi.fn()
      const ctx = createMockCanvasContext()

      const args = {
        cell: getEmptyCell(true),
        theme: MOCK_THEME as GlideTheme,
        ctx,
        rect: { x: 0, y: 0, width: 100, height: 35 },
        // Use the second column (TextColumn) so that we don't also draw the
        // attention indicator (TextColumn is not isRequired in the mock).
        col: 1,
        row: 0,
      }

      result.current.drawCell?.(args as never, drawMock)

      // Default placeholder should be used when no override is supplied.
      expect(drawTextCell).toHaveBeenCalledTimes(1)
      expect(drawTextCell).toHaveBeenCalledWith(
        expect.anything(),
        "None",
        undefined
      )
      // Missing branch returns early without invoking the default draw().
      expect(drawMock).not.toHaveBeenCalled()
    })

    it("uses the custom placeholder when one is provided", () => {
      const { result } = renderHook(() =>
        useCustomRenderer(MOCK_COLUMNS, "N/A")
      )

      const drawMock = vi.fn()
      const ctx = createMockCanvasContext()

      const args = {
        cell: getEmptyCell(true),
        theme: MOCK_THEME as GlideTheme,
        ctx,
        rect: { x: 0, y: 0, width: 100, height: 35 },
        col: 1,
        row: 0,
      }

      result.current.drawCell?.(args as never, drawMock)

      expect(drawTextCell).toHaveBeenCalledWith(
        expect.anything(),
        "N/A",
        undefined
      )
    })

    it("draws attention indicator on top of placeholder for required editable columns", () => {
      const { result } = renderHook(() => useCustomRenderer(MOCK_COLUMNS))

      const drawMock = vi.fn()
      const ctx = createMockCanvasContext()

      const args = {
        cell: getEmptyCell(true),
        theme: MOCK_THEME as GlideTheme,
        ctx,
        rect: { x: 0, y: 0, width: 100, height: 35 },
        // Column 0 is the NumberColumn with isRequired=true and isEditable=true,
        // so the attention indicator should be drawn after the placeholder.
        col: 0,
        row: 0,
      }

      result.current.drawCell?.(args as never, drawMock)

      expect(drawTextCell).toHaveBeenCalledTimes(1)
      expect(ctx.beginPath).toHaveBeenCalled()
      expect(ctx.fill).toHaveBeenCalled()
      expect(drawMock).not.toHaveBeenCalled()
    })

    it.each([
      ["checkbox"],
      ["line_chart"],
      ["bar_chart"],
      ["progress"],
    ] as const)(
      "delegates to draw() (no placeholder) for missing %s cells",
      kind => {
        const columnsWithKind: BaseColumn[] = [
          {
            ...MOCK_COLUMNS[1],
            kind,
            isRequired: false,
            isEditable: false,
          },
        ]
        const { result } = renderHook(() => useCustomRenderer(columnsWithKind))

        const drawMock = vi.fn()
        const ctx = createMockCanvasContext()

        const args = {
          cell: getEmptyCell(true),
          theme: MOCK_THEME as GlideTheme,
          ctx,
          rect: { x: 0, y: 0, width: 100, height: 35 },
          col: 0,
          row: 0,
        }

        result.current.drawCell?.(args as never, drawMock)

        // For these column types, default rendering applies and the placeholder
        // path is skipped entirely.
        expect(drawMock).toHaveBeenCalledTimes(1)
        expect(drawTextCell).not.toHaveBeenCalled()
        // Without isRequired+isEditable, no attention indicator either.
        expect(ctx.fill).not.toHaveBeenCalled()
      }
    )

    it("falls back to default draw() when missing cell's column index is out of range", () => {
      const { result } = renderHook(() => useCustomRenderer(MOCK_COLUMNS))

      const drawMock = vi.fn()
      const ctx = createMockCanvasContext()

      const args = {
        cell: getEmptyCell(true),
        theme: MOCK_THEME as GlideTheme,
        ctx,
        rect: { x: 0, y: 0, width: 100, height: 35 },
        // Out-of-range column index should bypass the missing-cell branch.
        col: 99,
        row: 0,
      }

      result.current.drawCell?.(args as never, drawMock)

      expect(drawMock).toHaveBeenCalledTimes(1)
      expect(drawTextCell).not.toHaveBeenCalled()
    })
  })
})
