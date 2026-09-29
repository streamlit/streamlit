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

import { Theme as GlideTheme, GridCellKind } from "@glideapps/glide-data-grid"
import { renderHook } from "@testing-library/react"
import { Field, Int64, Utf8 } from "apache-arrow"

import {
  BaseColumn,
  getErrorCell,
  NumberColumn,
  TextColumn,
} from "~lib/components/widgets/DataFrame/columns"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import useCustomRenderer from "./useCustomRenderer"

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

// Checkbox columns render their own missing-value state, so the placeholder
// path is skipped. drawCell only branches on `column.kind`, so we reuse a real
// column and override its kind to one of the excluded kinds.
const MOCK_EXCLUDED_COLUMN = {
  ...MOCK_COLUMNS[1],
  kind: "checkbox",
} as BaseColumn

const MOCK_THEME: Partial<GlideTheme> = {
  cellHorizontalPadding: 8,
  cellVerticalPadding: 3,
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
    fillText: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    // drawTextCell (used by the missing-value placeholder) needs measureText
    // to return real font metrics to compute the vertical text bias.
    measureText: vi.fn((text: string) => ({
      width: (text?.length ?? 0) * 8,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
    })),
    fillStyle: "",
  } as unknown as CanvasRenderingContext2D
}

/** Builds a missing-value grid cell of the given kind for drawCell tests. */
const createMissingCell = (kind: GridCellKind): object => ({
  kind,
  data: undefined,
  displayData: "",
  allowOverlay: true,
  contentAlign: "left",
  isMissingValue: true,
})

describe("useCustomRenderer hook", () => {
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

    it("draws a faded placeholder for missing values of non-excluded columns", () => {
      const { result } = renderHook(() => {
        return useCustomRenderer(MOCK_COLUMNS)
      })

      const drawMock = vi.fn()
      const ctx = createMockCanvasContext()

      const args = {
        // column_2 (index 1) is a non-required text column.
        cell: createMissingCell(GridCellKind.Text),
        theme: MOCK_THEME as GlideTheme,
        ctx,
        rect: { x: 0, y: 0, width: 100, height: 35 },
        col: 1,
        row: 0,
      }

      result.current.drawCell?.(args as never, drawMock)

      // The placeholder text is rendered instead of the cell's own content.
      expect(ctx.fillText).toHaveBeenCalledWith(
        "None",
        expect.any(Number),
        expect.any(Number)
      )
      // A non-required column must not get the red required indicator...
      expect(ctx.fill).not.toHaveBeenCalled()
      // ...and the default draw() must be skipped for placeholder cells.
      expect(drawMock).not.toHaveBeenCalled()
    })

    it("uses a custom missing placeholder token when provided", () => {
      const { result } = renderHook(() => {
        return useCustomRenderer(MOCK_COLUMNS, "N/A")
      })

      const drawMock = vi.fn()
      const ctx = createMockCanvasContext()

      const args = {
        cell: createMissingCell(GridCellKind.Text),
        theme: MOCK_THEME as GlideTheme,
        ctx,
        rect: { x: 0, y: 0, width: 100, height: 35 },
        col: 1,
        row: 0,
      }

      result.current.drawCell?.(args as never, drawMock)

      expect(ctx.fillText).toHaveBeenCalledWith(
        "N/A",
        expect.any(Number),
        expect.any(Number)
      )
      expect(ctx.fillText).not.toHaveBeenCalledWith(
        "None",
        expect.any(Number),
        expect.any(Number)
      )
    })

    it("draws the required indicator for missing values of required editable columns", () => {
      const { result } = renderHook(() => {
        return useCustomRenderer(MOCK_COLUMNS)
      })

      const drawMock = vi.fn()
      const ctx = createMockCanvasContext()

      const args = {
        // column_1 (index 0) is a required + editable number column.
        cell: createMissingCell(GridCellKind.Number),
        theme: MOCK_THEME as GlideTheme,
        ctx,
        rect: { x: 0, y: 0, width: 100, height: 35 },
        col: 0,
        row: 0,
      }

      result.current.drawCell?.(args as never, drawMock)

      // Placeholder is still drawn...
      expect(ctx.fillText).toHaveBeenCalledWith(
        "None",
        expect.any(Number),
        expect.any(Number)
      )
      // ...plus the red attention indicator triangle (uses fill()).
      expect(ctx.fill).toHaveBeenCalled()
      expect(drawMock).not.toHaveBeenCalled()
    })

    it("delegates missing-value rendering to the cell for excluded column kinds", () => {
      const { result } = renderHook(() => {
        return useCustomRenderer([MOCK_EXCLUDED_COLUMN])
      })

      const drawMock = vi.fn()
      const ctx = createMockCanvasContext()

      const args = {
        cell: createMissingCell(GridCellKind.Boolean),
        theme: MOCK_THEME as GlideTheme,
        ctx,
        rect: { x: 0, y: 0, width: 100, height: 35 },
        col: 0,
        row: 0,
      }

      result.current.drawCell?.(args as never, drawMock)

      // Checkbox columns render their own missing state, so draw() is used...
      expect(drawMock).toHaveBeenCalled()
      // ...and no faded placeholder text is drawn.
      expect(ctx.fillText).not.toHaveBeenCalled()
    })

    it("does not draw a placeholder when the column index is out of range", () => {
      const { result } = renderHook(() => {
        return useCustomRenderer(MOCK_COLUMNS)
      })

      const drawMock = vi.fn()
      const ctx = createMockCanvasContext()

      const args = {
        cell: createMissingCell(GridCellKind.Text),
        theme: MOCK_THEME as GlideTheme,
        ctx,
        rect: { x: 0, y: 0, width: 100, height: 35 },
        // Out-of-range column index -> falls through to the default draw().
        col: 99,
        row: 0,
      }

      result.current.drawCell?.(args as never, drawMock)

      expect(drawMock).toHaveBeenCalled()
      expect(ctx.fillText).not.toHaveBeenCalled()
    })
  })
})
