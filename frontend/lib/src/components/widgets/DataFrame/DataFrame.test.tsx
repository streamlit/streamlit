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

import { forwardRef, useImperativeHandle } from "react"

import {
  CompactSelection,
  type GridCell,
  type GridSelection,
} from "@glideapps/glide-data-grid"
import { act, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { Dataframe as DataframeProto } from "@streamlit/protobuf"

import { DATAFRAME_PORTAL_ID } from "~lib/components/core/Portal/constants"
import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { EMPTY } from "~lib/mocks/arrow/empty"
import { TEN_BY_TEN } from "~lib/mocks/arrow/tenByTen"
import { render, renderWithContexts } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

// Track DataEditor calls for assertions - separate from the component so we can use forwardRef
const dataEditorMockFn = vi.fn()
const dataEditorScrollToMock = vi.fn()
const dataEditorRemeasureColumnsMock = vi.fn()
const dataEditorUpdateCellsMock = vi.fn()

vi.mock("@glideapps/glide-data-grid", async () => ({
  ...(await vi.importActual("@glideapps/glide-data-grid")),
  // Use forwardRef to properly handle refs passed from DataFrame.
  // Don't spread props to the div - they contain non-DOM attributes like
  // imageEditorOverride, headerIcons, validateCell, onPaste, etc.
  DataEditor: forwardRef((props, ref) => {
    dataEditorMockFn(props, {})
    useImperativeHandle(ref, () => ({
      updateCells: dataEditorUpdateCellsMock,
      remeasureColumns: dataEditorRemeasureColumnsMock,
      scrollTo: dataEditorScrollToMock,
    }))
    return <div data-testid="mock-data-editor" />
  }),
}))

// The native-file-system-adapter creates some issues in the test environment
// so we mock it out. The errors might be related to the missing typescript
// distribution. But the file picker most likely wouldn't work anyways in jest-dom.
vi.mock("native-file-system-adapter", () => ({}))

import DataFrame, { DataFrameProps } from "./DataFrame"

const getProps = (
  data: Uint8Array,
  editingMode: DataframeProto.EditingMode = DataframeProto.EditingMode
    .READ_ONLY
): DataFrameProps => ({
  element: DataframeProto.create({
    arrowData: { data },
    editingMode,
  }),
  elementHash: "test-hash",
  disabled: false,
  widgetMgr: {
    getStringValue: vi.fn(),
  } as unknown as WidgetStateManager,
})

describe("DataFrame widget", () => {
  const props = getProps(TEN_BY_TEN)

  const getDataEditorProps = (): Record<string, unknown> =>
    dataEditorMockFn.mock.lastCall?.[0] as Record<string, unknown>

  const getEditorColumns = (): { title: string }[] =>
    getDataEditorProps().columns as { title: string }[]

  const createWidgetMgr = (): WidgetStateManager =>
    ({
      getStringValue: vi.fn(),
      setStringValue: vi.fn(),
    }) as unknown as WidgetStateManager

  const emptyGridSelection = (): GridSelection => ({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
    current: undefined,
  })

  const cellSelection = (): GridSelection => ({
    ...emptyGridSelection(),
    current: {
      cell: [1, 0],
      range: { x: 1, y: 0, width: 1, height: 1 },
      rangeStack: [],
    },
  })

  const COLUMN_MENU_BOUNDS = { x: 10, y: 20, width: 80, height: 24 }

  const invokeDataEditorCallback = (
    name: string,
    ...args: unknown[]
  ): void => {
    const callback = getDataEditorProps()[name] as (
      ...cbArgs: unknown[]
    ) => void
    callback(...args)
  }

  const selectRows = (rowIndex: number): void => {
    act(() => {
      invokeDataEditorCallback("onGridSelectionChange", {
        ...emptyGridSelection(),
        rows: CompactSelection.fromSingleSelection(rowIndex),
      })
    })
  }

  const clickColumnHeader = (columnIdx = 1): void => {
    act(() => {
      invokeDataEditorCallback("onHeaderClicked", columnIdx, {})
    })
  }

  const openColumnMenu = (columnIdx = 1): void => {
    act(() => {
      invokeDataEditorCallback(
        "onHeaderMenuClick",
        columnIdx,
        COLUMN_MENU_BOUNDS
      )
    })
  }

  const renderRowSelectionDataFrame = (selectionState?: string): void => {
    render(
      <DataFrame
        {...getProps(TEN_BY_TEN)}
        element={DataframeProto.create({
          arrowData: { data: TEN_BY_TEN },
          editingMode: DataframeProto.EditingMode.READ_ONLY,
          selectionMode: [DataframeProto.SelectionMode.MULTI_ROW],
          selectionState,
        })}
        widgetMgr={createWidgetMgr()}
      />
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    dataEditorMockFn.mockClear()
    dataEditorScrollToMock.mockClear()
    dataEditorRemeasureColumnsMock.mockClear()
    dataEditorUpdateCellsMock.mockClear()
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
    if (!document.getElementById(DATAFRAME_PORTAL_ID)) {
      const portal = document.createElement("div")
      portal.id = DATAFRAME_PORTAL_ID
      document.body.appendChild(portal)
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.getElementById(DATAFRAME_PORTAL_ID)?.remove()
  })

  it("renders without crashing", () => {
    render(<DataFrame {...props} />)
    expect(screen.getAllByTestId("stDataFrameResizable").length).toBe(1)
  })

  it("renders when widgetMgr is undefined", () => {
    const propsWithoutWidgetMgr = {
      ...getProps(TEN_BY_TEN),
      widgetMgr: undefined,
    }

    render(<DataFrame {...propsWithoutWidgetMgr} />)

    // If it renders, the main container should be in the document
    expect(screen.getByTestId("stDataFrame")).toBeVisible()
  })

  it("should have correct className", () => {
    render(<DataFrame {...props} />)

    const styledResizableContainer = screen.getByTestId("stDataFrame")

    expect(styledResizableContainer).toHaveClass("stDataFrame")
  })

  it("should have a toolbar", () => {
    render(<DataFrame {...props} />)

    const dataframeToolbar = screen.getByTestId("stElementToolbar")

    expect(dataframeToolbar).toBeInTheDocument()

    // Verify expected toolbar buttons: search, column visibility, download, fullscreen
    const toolbarButtons = screen.getAllByTestId("stElementToolbarButton")
    expect(toolbarButtons).toHaveLength(4)
  })

  it("hides CSV export when data export is disabled", () => {
    renderWithContexts(<DataFrame {...props} />, {
      libConfigContext: { disableDataExport: true },
    })

    expect(screen.queryByLabelText("Download as CSV")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Search")).toBeInTheDocument()
    expect(screen.getByLabelText("Show/hide columns")).toBeInTheDocument()
  })

  it("disables clipboard copy for read-only dataframes when data export is disabled", () => {
    renderWithContexts(<DataFrame {...props} />, {
      libConfigContext: { disableDataExport: true },
    })

    expect(dataEditorMockFn.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        getCellsForSelection: true,
        keybindings: expect.objectContaining({
          copy: false,
        }),
      })
    )
  })

  it("keeps clipboard editing enabled for data editors when data export is disabled", () => {
    renderWithContexts(
      <DataFrame
        {...getProps(TEN_BY_TEN, DataframeProto.EditingMode.DYNAMIC)}
      />,
      {
        libConfigContext: { disableDataExport: true },
      }
    )

    expect(dataEditorMockFn.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        getCellsForSelection: true,
        keybindings: expect.objectContaining({
          copy: true,
        }),
        onPaste: expect.any(Function),
      })
    )
  })

  const renderEditableDataFrame = (): {
    widgetMgr: WidgetStateManager
    updatedCell: GridCell
  } => {
    vi.useFakeTimers()
    const widgetMgr = createWidgetMgr()

    render(
      <DataFrame
        {...getProps(TEN_BY_TEN, DataframeProto.EditingMode.FIXED)}
        widgetMgr={widgetMgr}
      />
    )

    const dataEditorProps = dataEditorMockFn.mock.lastCall?.[0]
    const updatedCell = {
      ...dataEditorProps.getCellContent([1, 0]),
      data: 999,
      displayData: "999",
    }
    return { widgetMgr, updatedCell }
  }

  it("flushes a pending edit when clicking outside the data editor", () => {
    const { widgetMgr, updatedCell } = renderEditableDataFrame()
    const dataEditorProps = dataEditorMockFn.mock.lastCall?.[0]

    act(() => {
      const pointerDownEvent = new MouseEvent("pointerdown")
      Object.defineProperty(pointerDownEvent, "target", {
        value: document.body,
      })
      expect(dataEditorProps.isOutsideClick(pointerDownEvent)).toBe(true)
      dataEditorProps.onCellEdited([1, 0], updatedCell)
      dataEditorProps.onFinishedEditing(updatedCell, [0, 0])
    })
    expect(widgetMgr.setStringValue).toHaveBeenCalledOnce()

    act(() => {
      vi.runAllTimers()
    })
    expect(widgetMgr.setStringValue).toHaveBeenCalledOnce()
  })

  it("keeps a pending edit debounced when clicking another grid cell", () => {
    const { widgetMgr, updatedCell } = renderEditableDataFrame()
    const dataEditorProps = dataEditorMockFn.mock.lastCall?.[0]

    const pointerDownEvent = new MouseEvent("pointerdown")
    Object.defineProperty(pointerDownEvent, "target", {
      value: screen.getByTestId("mock-data-editor"),
    })

    act(() => {
      expect(dataEditorProps.isOutsideClick(pointerDownEvent)).toBe(true)
      dataEditorProps.onCellEdited([1, 0], updatedCell)
      dataEditorProps.onFinishedEditing(updatedCell, [0, 0])
    })
    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()

    act(() => {
      vi.runAllTimers()
    })
    expect(widgetMgr.setStringValue).toHaveBeenCalledOnce()
  })

  it.each([
    ["Enter", [0, 1], true],
    ["Tab", [1, 0], true],
    ["a zero-movement editor completion", [0, 0], false],
  ] as const)(
    "keeps pending edits debounced for %s",
    (_key, movement, armOutsideClick) => {
      const { widgetMgr, updatedCell } = renderEditableDataFrame()
      const dataEditorProps = dataEditorMockFn.mock.lastCall?.[0]
      let outsideClickResult: boolean | undefined

      act(() => {
        if (armOutsideClick) {
          const pointerDownEvent = new MouseEvent("pointerdown")
          Object.defineProperty(pointerDownEvent, "target", {
            value: document.body,
          })
          outsideClickResult = dataEditorProps.isOutsideClick(pointerDownEvent)
        }
        dataEditorProps.onCellEdited([1, 0], updatedCell)
        dataEditorProps.onFinishedEditing(updatedCell, movement)
      })
      expect(outsideClickResult).toBe(armOutsideClick ? true : undefined)
      expect(widgetMgr.setStringValue).not.toHaveBeenCalled()

      act(() => {
        vi.runAllTimers()
      })
      expect(widgetMgr.setStringValue).toHaveBeenCalledOnce()
    }
  )

  it("shows search when Ctrl+F is pressed and search is enabled", () => {
    render(<DataFrame {...props} />)

    const event = {
      ctrlKey: true,
      metaKey: false,
      key: "f",
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    }

    expect(dataEditorMockFn.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        showSearch: false,
      })
    )

    act(() => {
      dataEditorMockFn.mock.lastCall?.[0].onKeyDown(event)
    })

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(event.preventDefault).toHaveBeenCalled()
    expect(dataEditorMockFn.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        showSearch: true,
      })
    )
  })

  it("shows search when Cmd+F is pressed and search is enabled", () => {
    render(<DataFrame {...props} />)

    const event = {
      ctrlKey: false,
      metaKey: true,
      key: "f",
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    }

    expect(dataEditorMockFn.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        showSearch: false,
      })
    )

    act(() => {
      dataEditorMockFn.mock.lastCall?.[0].onKeyDown(event)
    })

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(event.preventDefault).toHaveBeenCalled()
    expect(dataEditorMockFn.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        showSearch: true,
      })
    )
  })

  it("does not handle Ctrl+F when search is disabled", () => {
    render(<DataFrame {...getProps(EMPTY)} />)

    const event = {
      ctrlKey: true,
      metaKey: false,
      key: "f",
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    }

    act(() => {
      dataEditorMockFn.mock.lastCall?.[0].onKeyDown(event)
    })

    expect(event.stopPropagation).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(dataEditorMockFn.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        showSearch: false,
      })
    )
  })

  it("hides the search overlay when search becomes disabled while open", () => {
    const { rerender } = render(<DataFrame {...props} />)

    act(() => {
      dataEditorMockFn.mock.lastCall?.[0].onKeyDown({
        ctrlKey: true,
        metaKey: false,
        key: "f",
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      })
    })

    expect(dataEditorMockFn.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        showSearch: true,
      })
    )

    // The dataframe becomes empty, which disables search. The overlay must
    // not stay stuck open since both the toolbar button and the keyboard
    // shortcut are disabled in that case.
    rerender(<DataFrame {...getProps(EMPTY)} />)

    expect(dataEditorMockFn.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        showSearch: false,
      })
    )
  })

  it("should show column visibility button when all columns are visible", () => {
    render(<DataFrame {...props} />)

    // The column visibility button should be present even when all columns are shown
    // (it appears when the toolbar is shown via hover)
    expect(screen.getByLabelText("Show/hide columns")).toBeInTheDocument()
  })

  it("Touch detection correctly deactivates some features", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(
      <DataFrame {...getProps(TEN_BY_TEN, DataframeProto.EditingMode.FIXED)} />
    )
    // Check the mock was called with the expected props
    expect(dataEditorMockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        rangeSelect: "cell",
        fillHandle: false,
        onColumnResize: undefined,
      }),
      {}
    )
  })

  it("enables trailing row for ADD_ONLY editing mode", () => {
    render(
      <DataFrame
        {...getProps(TEN_BY_TEN, DataframeProto.EditingMode.ADD_ONLY)}
      />
    )

    // ADD_ONLY mode should enable trailingRowOptions for adding rows
    expect(dataEditorMockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        trailingRowOptions: expect.objectContaining({
          sticky: false,
          tint: true,
        }),
      }),
      {}
    )

    // ADD_ONLY mode should NOT enable row deletion features
    expect(dataEditorMockFn).not.toHaveBeenCalledWith(
      expect.objectContaining({
        rowSelect: "multi",
        rowSelectionMode: "multi",
      }),
      {}
    )
  })

  it("enables row selection for DELETE_ONLY editing mode", () => {
    render(
      <DataFrame
        {...getProps(TEN_BY_TEN, DataframeProto.EditingMode.DELETE_ONLY)}
      />
    )

    // DELETE_ONLY mode should enable row selection for deleting rows
    expect(dataEditorMockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        rowSelect: "multi",
        rowSelectionMode: "multi",
      }),
      {}
    )

    // DELETE_ONLY mode should NOT enable row adding features
    expect(dataEditorMockFn).not.toHaveBeenCalledWith(
      expect.objectContaining({
        trailingRowOptions: expect.anything(),
      }),
      {}
    )
  })

  it("enables both trailing row and row selection for DYNAMIC editing mode", () => {
    render(
      <DataFrame
        {...getProps(TEN_BY_TEN, DataframeProto.EditingMode.DYNAMIC)}
      />
    )

    // DYNAMIC mode should enable both adding and deleting rows
    expect(dataEditorMockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        trailingRowOptions: expect.objectContaining({
          sticky: false,
          tint: true,
        }),
        rowSelect: "multi",
        rowSelectionMode: "multi",
      }),
      {}
    )
  })

  it("renders empty-state cell content when the table has no rows", () => {
    render(<DataFrame {...getProps(EMPTY)} />)

    const cell = (
      getDataEditorProps().getCellContent as (
        item: readonly [number, number]
      ) => {
        displayData: string
        contentAlign: string
        allowOverlay: boolean
      }
    )([0, 0])

    expect(cell.displayData).toBe("empty")
    expect(cell.contentAlign).toBe("center")
    expect(cell.allowOverlay).toBe(false)
  })

  it("throws when a lazy dataframe is missing its initial chunk", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    expect(() =>
      render(
        <DataFrame
          {...getProps(TEN_BY_TEN)}
          element={DataframeProto.create({
            lazyData: {
              sourceId: "lazy-source",
              pageSize: 50,
              rowCount: 100,
            },
          })}
        />
      )
    ).toThrow("Lazy dataframe is missing its initial chunk")

    consoleError.mockRestore()
  })

  it("throws when arrow data is missing and no data prop is provided", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    expect(() =>
      render(
        <DataFrame
          {...getProps(TEN_BY_TEN)}
          element={DataframeProto.create({
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          })}
        />
      )
    ).toThrow("DataFrame element is missing arrowData")

    consoleError.mockRestore()
  })

  it("toggles search from the toolbar and closes it from the grid", async () => {
    const user = userEvent.setup()
    render(<DataFrame {...props} />)

    await user.click(screen.getByLabelText("Search"))
    expect(getDataEditorProps().showSearch).toBe(true)

    await user.click(screen.getByLabelText("Search"))
    expect(getDataEditorProps().showSearch).toBe(false)

    await user.click(screen.getByLabelText("Search"))
    act(() => {
      invokeDataEditorCallback("onSearchClose")
    })
    expect(getDataEditorProps().showSearch).toBe(false)
  })

  it("sorts a column from the header and hides an open search overlay", async () => {
    const user = userEvent.setup()
    render(<DataFrame {...props} />)

    await user.click(screen.getByLabelText("Search"))
    expect(getDataEditorProps().showSearch).toBe(true)

    const unsortedTitle = getEditorColumns()[1].title
    clickColumnHeader()

    expect(getDataEditorProps().showSearch).toBe(false)
    expect(getEditorColumns()[1].title).toBe(`↑ ${unsortedTitle}`)
  })

  it("does not sort when column selection is activated", () => {
    render(
      <DataFrame
        {...getProps(TEN_BY_TEN)}
        element={DataframeProto.create({
          arrowData: { data: TEN_BY_TEN },
          editingMode: DataframeProto.EditingMode.READ_ONLY,
          selectionMode: [DataframeProto.SelectionMode.MULTI_COLUMN],
        })}
      />
    )

    const titlesBeforeSort = getEditorColumns().map(column => column.title)
    clickColumnHeader()
    expect(getEditorColumns().map(column => column.title)).toEqual(
      titlesBeforeSort
    )
  })

  it("applies row selection and clears it from the toolbar", async () => {
    const user = userEvent.setup()
    renderRowSelectionDataFrame()

    expect(screen.queryByLabelText("Clear selection")).not.toBeInTheDocument()

    selectRows(2)

    expect(screen.getByLabelText("Clear selection")).toBeInTheDocument()
    await user.click(screen.getByLabelText("Clear selection"))
    expect(screen.queryByLabelText("Clear selection")).not.toBeInTheDocument()
  })

  it("preserves selected rows after a column sort", () => {
    vi.useFakeTimers()
    renderRowSelectionDataFrame()

    selectRows(2)

    expect(screen.getByLabelText("Clear selection")).toBeInTheDocument()

    act(() => {
      invokeDataEditorCallback("onHeaderClicked", 1, {})
      vi.runAllTimers()
    })

    expect(screen.getByLabelText("Clear selection")).toBeInTheDocument()
  })

  it("applies programmatic selection from selectionState", () => {
    renderRowSelectionDataFrame(
      JSON.stringify({
        selection: { rows: [1], columns: [], cells: [] },
      })
    )

    expect(screen.getByLabelText("Clear selection")).toBeInTheDocument()
  })

  it("adds a row from the toolbar in dynamic editing mode", async () => {
    const user = userEvent.setup()

    render(
      <DataFrame
        {...getProps(TEN_BY_TEN, DataframeProto.EditingMode.DYNAMIC)}
        widgetMgr={createWidgetMgr()}
      />
    )

    expect(getDataEditorProps().rows).toBe(10)
    expect(screen.getByLabelText("Add row")).toBeInTheDocument()
    expect(screen.queryByLabelText("Delete row(s)")).not.toBeInTheDocument()

    await user.click(screen.getByLabelText("Add row"))

    expect(getDataEditorProps().rows).toBe(11)
    expect(dataEditorScrollToMock).toHaveBeenCalledWith(0, 10, "vertical")
    expect(screen.getByLabelText("Add row")).toBeInTheDocument()
  })

  it("deletes selected rows from the toolbar in delete-only mode", async () => {
    const user = userEvent.setup()

    render(
      <DataFrame
        {...getProps(TEN_BY_TEN, DataframeProto.EditingMode.DELETE_ONLY)}
        widgetMgr={createWidgetMgr()}
      />
    )

    expect(getDataEditorProps().rows).toBe(10)
    selectRows(1)

    expect(screen.getByLabelText("Delete row(s)")).toBeInTheDocument()
    await user.click(screen.getByLabelText("Delete row(s)"))

    expect(getDataEditorProps().rows).toBe(9)
    expect(screen.queryByLabelText("Delete row(s)")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Clear selection")).not.toBeInTheDocument()
  })

  it("toggles the column visibility menu from the toolbar", async () => {
    const user = userEvent.setup()
    render(<DataFrame {...props} />)

    expect(
      screen.queryByTestId("stDataFrameColumnVisibilityMenu")
    ).not.toBeInTheDocument()

    await user.click(screen.getByLabelText("Show/hide columns"))
    expect(screen.getByTestId("stDataFrameColumnVisibilityMenu")).toBeVisible()

    await user.click(screen.getByLabelText("Show/hide columns"))
    expect(
      screen.queryByTestId("stDataFrameColumnVisibilityMenu")
    ).not.toBeInTheDocument()
  })

  it("opens the column menu and pins the column", async () => {
    const user = userEvent.setup()
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [2000],
    })
    render(<DataFrame {...props} />)

    const freezeColumnsBeforePin = getDataEditorProps().freezeColumns as number
    openColumnMenu()

    expect(screen.getByTestId("stDataFrameColumnMenu")).toBeVisible()
    await user.click(screen.getByText("Pin column"))

    expect(
      screen.queryByTestId("stDataFrameColumnMenu")
    ).not.toBeInTheDocument()
    expect(getDataEditorProps().freezeColumns).toBe(freezeColumnsBeforePin + 1)
  })

  it("autosizes a column from the column menu", async () => {
    const user = userEvent.setup()
    render(<DataFrame {...props} />)

    openColumnMenu()
    await user.click(screen.getByText("Autosize"))

    expect(
      screen.queryByTestId("stDataFrameColumnMenu")
    ).not.toBeInTheDocument()
    expect(dataEditorRemeasureColumnsMock).toHaveBeenCalled()
  })

  it("sorts a column from the column menu", async () => {
    const user = userEvent.setup()
    render(<DataFrame {...props} />)

    const unsortedTitle = getEditorColumns()[1].title
    openColumnMenu()
    await user.click(screen.getByText("Sort ascending"))

    expect(
      screen.queryByTestId("stDataFrameColumnMenu")
    ).not.toBeInTheDocument()
    expect(getEditorColumns()[1].title).toBe(`↑ ${unsortedTitle}`)
  })

  it("hides a column from the column menu", async () => {
    const user = userEvent.setup()
    render(<DataFrame {...props} />)

    const columnCount = getEditorColumns().length
    openColumnMenu()
    await user.click(screen.getByText("Hide column"))

    expect(
      screen.queryByTestId("stDataFrameColumnMenu")
    ).not.toBeInTheDocument()
    expect(getEditorColumns()).toHaveLength(columnCount - 1)
  })

  it("does not open a column menu while the visibility menu is open", async () => {
    const user = userEvent.setup()
    render(<DataFrame {...props} />)

    await user.click(screen.getByLabelText("Show/hide columns"))
    expect(screen.getByTestId("stDataFrameColumnVisibilityMenu")).toBeVisible()

    openColumnMenu()

    expect(
      screen.queryByTestId("stDataFrameColumnMenu")
    ).not.toBeInTheDocument()
  })

  it("tracks focus from mouse movement over the grid", () => {
    render(<DataFrame {...props} />)

    act(() => {
      invokeDataEditorCallback("onMouseMove", { kind: "out-of-bounds" })
    })
    act(() => {
      invokeDataEditorCallback("onGridSelectionChange", cellSelection())
    })
    expect(
      (getDataEditorProps().gridSelection as GridSelection).current
    ).toBeUndefined()

    act(() => {
      invokeDataEditorCallback("onMouseMove", { kind: "cell" })
    })
    act(() => {
      invokeDataEditorCallback("onGridSelectionChange", cellSelection())
    })
    expect(
      (getDataEditorProps().gridSelection as GridSelection).current?.cell
    ).toEqual([1, 0])
  })

  it("highlights the hovered row", () => {
    render(<DataFrame {...props} />)

    act(() => {
      invokeDataEditorCallback("onItemHovered", {
        kind: "cell",
        location: [1, 0],
        bounds: { x: 0, y: 0, width: 40, height: 24 },
        isTouchDevice: false,
      })
    })

    const getRowThemeOverride = getDataEditorProps().getRowThemeOverride as (
      row: number
    ) => { bgCell?: string } | undefined
    expect(getRowThemeOverride(0)).toEqual(
      expect.objectContaining({ bgCell: expect.any(String) })
    )
    expect(getRowThemeOverride(1)).toBeUndefined()
  })
})
