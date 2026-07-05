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

import { forwardRef } from "react"

import { act, screen } from "@testing-library/react"

import { Dataframe as DataframeProto } from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { EMPTY } from "~lib/mocks/arrow/empty"
import { TEN_BY_TEN } from "~lib/mocks/arrow/tenByTen"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

// Track DataEditor calls for assertions - separate from the component so we can use forwardRef
const dataEditorMockFn = vi.fn()

vi.mock("@glideapps/glide-data-grid", async () => ({
  ...(await vi.importActual("@glideapps/glide-data-grid")),
  // Use forwardRef to properly handle refs passed from DataFrame.
  // Don't spread props to the div - they contain non-DOM attributes like
  // imageEditorOverride, headerIcons, validateCell, onPaste, etc.
  DataEditor: forwardRef((props, _ref) => {
    dataEditorMockFn(props, {})
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

  beforeEach(() => {
    vi.clearAllMocks()
    dataEditorMockFn.mockClear()
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
    // Set window.matchMedia to simulate a touch device
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
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
})
