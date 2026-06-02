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
  type CellClickedEventArgs,
  type Theme as GlideTheme,
  type GridCell,
  GridCellKind,
} from "@glideapps/glide-data-grid"
import { act, renderHook } from "@testing-library/react"
import { Field, Utf8 } from "apache-arrow"

import { Dataframe as DataframeProto } from "@streamlit/protobuf"

import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"
import ButtonColumn from "~lib/components/widgets/DataFrame/columns/ButtonColumn"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import useButtonColumnInteractions from "./useButtonColumnInteractions"
import { COLUMN_POSITION_PREFIX } from "./useColumnLoader"

const MOCK_BUTTON_COLUMN_PROPS = {
  id: "button-column-id",
  name: "button_column",
  title: "Button column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
  arrowType: {
    type: DataFrameCellType.DATA,
    arrowField: new Field("button_column", new Utf8(), true),
    pandasType: {
      field_name: "button_column",
      name: "button_column",
      pandas_type: "unicode",
      numpy_type: "object",
      metadata: null,
    },
  },
}

const MOCK_THEME: Pick<GlideTheme, "cellHorizontalPadding"> = {
  cellHorizontalPadding: 8,
}

function createButtonColumn(
  props: Partial<typeof MOCK_BUTTON_COLUMN_PROPS> = {}
): BaseColumn {
  return ButtonColumn({
    ...MOCK_BUTTON_COLUMN_PROPS,
    ...props,
  })
}

function createElement(
  buttonClickWidgets: Record<string, string>
): DataframeProto {
  return new DataframeProto({
    formId: "form-id",
    buttonClickWidgets,
  })
}

function createWidgetMgr(): {
  setStringTriggerValue: ReturnType<typeof vi.fn>
  widgetMgr: WidgetStateManager
} {
  const setStringTriggerValue = vi.fn()
  return {
    setStringTriggerValue,
    widgetMgr: {
      setStringTriggerValue,
    } as unknown as WidgetStateManager,
  }
}

function createCellClickedEvent(
  overrides: Partial<CellClickedEventArgs> = {}
): CellClickedEventArgs {
  return {
    bounds: { x: 0, y: 0, width: 100, height: 32 },
    localEventX: 50,
    localEventY: 16,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as CellClickedEventArgs
}

describe("useButtonColumnInteractions", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      callback(0)
      return 1
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("triggers the matching widget for button cell clicks", () => {
    const column = createButtonColumn()
    const buttonCell = column.getCell("Open")
    const getCellContent = vi.fn(() => buttonCell)
    const getOriginalIndex = vi.fn(row => row + 100)
    const { setStringTriggerValue, widgetMgr } = createWidgetMgr()

    const { result } = renderHook(() =>
      useButtonColumnInteractions({
        element: createElement({ button_column: "widget-id" }),
        widgetMgr,
        fragmentId: "fragment-id",
        columns: [column],
        getCellContent,
        getOriginalIndex,
        theme: MOCK_THEME,
      })
    )

    const event = createCellClickedEvent()

    act(() => result.current.onCellClicked([0, 2], event))

    expect(setStringTriggerValue).toHaveBeenCalledWith(
      { id: "widget-id", formId: "form-id" },
      JSON.stringify({ row: 102, label: "Open" }),
      { fromUi: true },
      "fragment-id"
    )
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it("falls back to positional button widget keys", () => {
    const column = createButtonColumn({
      indexNumber: 3,
    })
    const getCellContent = vi.fn(() => column.getCell("Open"))
    const { setStringTriggerValue, widgetMgr } = createWidgetMgr()

    const { result } = renderHook(() =>
      useButtonColumnInteractions({
        element: createElement({
          [`${COLUMN_POSITION_PREFIX}3`]: "positional-widget-id",
        }),
        widgetMgr,
        columns: [column],
        getCellContent,
        getOriginalIndex: row => row,
        theme: MOCK_THEME,
      })
    )

    act(() => result.current.onCellClicked([0, 1], createCellClickedEvent()))

    expect(setStringTriggerValue).toHaveBeenCalledWith(
      { id: "positional-widget-id", formId: "form-id" },
      JSON.stringify({ row: 1, label: "Open" }),
      { fromUi: true },
      undefined
    )
  })

  it("handles multi-action button menu selection", () => {
    const column = createButtonColumn()
    const getCellContent = vi.fn(() => column.getCell(["View", "Delete"]))
    const { setStringTriggerValue, widgetMgr } = createWidgetMgr()

    const { result } = renderHook(() =>
      useButtonColumnInteractions({
        element: createElement({ button_column: "widget-id" }),
        widgetMgr,
        columns: [column],
        getCellContent,
        getOriginalIndex: row => row + 10,
        theme: MOCK_THEME,
      })
    )

    const event = createCellClickedEvent({
      bounds: { x: 100, y: 200, width: 40, height: 24 },
      localEventX: 10,
      localEventY: 10,
    })

    act(() => result.current.onCellClicked([0, 4], event))

    expect(result.current.buttonActionMenu).toEqual({
      columnName: "button_column",
      rowIndex: 14,
      actions: ["View", "Delete"],
      screenTop: 210,
      screenLeft: 110,
    })

    act(() => {
      result.current.handleMenuSelectAction("Delete")
    })

    expect(setStringTriggerValue).toHaveBeenCalledWith(
      { id: "widget-id", formId: "form-id" },
      JSON.stringify({ row: 14, label: "Delete" }),
      { fromUi: true },
      undefined
    )
    expect(result.current.buttonActionMenu).toBeUndefined()
  })

  it("ignores non-button cells", () => {
    const column = createButtonColumn()
    const nonButtonCell = {
      kind: GridCellKind.Text,
      data: "Not a button",
      displayData: "Not a button",
      allowOverlay: true,
    } as GridCell

    const { result } = renderHook(() =>
      useButtonColumnInteractions({
        element: createElement({}),
        widgetMgr: undefined,
        columns: [column],
        getCellContent: () => nonButtonCell,
        getOriginalIndex: row => row,
        theme: MOCK_THEME,
      })
    )

    const event = createCellClickedEvent()

    act(() => result.current.onCellClicked([0, 0], event))

    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})
