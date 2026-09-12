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

import { type GridCell } from "@glideapps/glide-data-grid"
import { act, screen } from "@testing-library/react"

import { Dataframe as DataframeProto } from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { EMPTY } from "~lib/mocks/arrow/empty"
import { TEN_BY_TEN } from "~lib/mocks/arrow/tenByTen"
import { ScriptRunState } from "~lib/ScriptRunState"
import { render, renderWithContexts } from "~lib/test_util"
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
    getElementState: vi.fn(),
    setElementState: vi.fn(),
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
    vi.useRealTimers()
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
    const widgetMgr = {
      getStringValue: vi.fn(),
      setStringValue: vi.fn(),
      getElementState: vi.fn(),
      setElementState: vi.fn(),
    } as unknown as WidgetStateManager

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

  describe("commit-edits mode", () => {
    const EMPTY_EDITS_JSON = JSON.stringify({
      edited_rows: {},
      added_rows: [],
      deleted_rows: [],
    })

    /**
     * Builds a mock widget manager that backs element state with a real Map so
     * useWidgetManagerElementState (which stores the run scope) works, and
     * exposes the setStringValue mock for assertions.
     */
    const createCommitEditsWidgetMgr = (): {
      widgetMgr: WidgetStateManager
      setStringValue: ReturnType<typeof vi.fn>
    } => {
      const elementStates = new Map<string, unknown>()
      const setStringValue = vi.fn()
      const widgetMgr = {
        getStringValue: vi.fn(),
        setStringValue,
        getElementState: (id: string, key: string): unknown =>
          elementStates.get(`${id}:${key}`),
        setElementState: (id: string, key: string, value: unknown): void => {
          elementStates.set(`${id}:${key}`, value)
        },
        addFormClearedListener: vi.fn(() => ({ disconnect: vi.fn() })),
      } as unknown as WidgetStateManager
      return { widgetMgr, setStringValue }
    }

    const getCommitEditsProps = (
      widgetMgr: WidgetStateManager,
      {
        commitEdits = true,
        clearEdits = false,
      }: { commitEdits?: boolean; clearEdits?: boolean } = {}
    ): DataFrameProps => ({
      element: DataframeProto.create({
        id: "commit-editor",
        arrowData: { data: TEN_BY_TEN },
        editingMode: DataframeProto.EditingMode.FIXED,
        commitEdits,
        clearEdits,
      }),
      elementHash: "commit-hash",
      disabled: false,
      widgetMgr,
    })

    const submitCellEdit = (): void => {
      const dataEditorProps = dataEditorMockFn.mock.lastCall?.[0]
      const updatedCell = {
        ...dataEditorProps.getCellContent([1, 0]),
        data: 999,
        displayData: "999",
      }
      act(() => {
        dataEditorProps.onCellEdited([1, 0], updatedCell)
      })
    }

    it("disables editing immediately after a commit-edits submission", () => {
      const { widgetMgr, setStringValue } = createCommitEditsWidgetMgr()

      renderWithContexts(<DataFrame {...getCommitEditsProps(widgetMgr)} />, {
        scriptRunContext: {
          scriptRunState: ScriptRunState.NOT_RUNNING,
          scriptRunId: "run-1",
          scriptRunFinishedSequence: 0,
        },
      })

      // Editing is enabled before the submission.
      expect(dataEditorMockFn.mock.lastCall?.[0].onCellEdited).toEqual(
        expect.any(Function)
      )

      submitCellEdit()

      // The edit was written to the widget manager as a UI submission
      // (immediately, without any debounce timer advancing).
      expect(setStringValue).toHaveBeenCalledWith(
        "commit-editor",
        expect.any(String),
        {
          formId: "",
          fragmentId: undefined,
          fromUser: true,
        }
      )
      // The editor is now disabled: editing handlers are no longer wired.
      expect(dataEditorMockFn.mock.lastCall?.[0].onCellEdited).toBeUndefined()
    })

    it("does not re-enable on an unrelated or earlier run finish", () => {
      const { widgetMgr } = createCommitEditsWidgetMgr()
      const props = getCommitEditsProps(widgetMgr)

      const { rerenderWithContexts } = renderWithContexts(
        <DataFrame {...props} />,
        {
          scriptRunContext: {
            scriptRunState: ScriptRunState.NOT_RUNNING,
            scriptRunId: "run-1",
            scriptRunFinishedSequence: 0,
          },
        }
      )

      submitCellEdit()
      expect(dataEditorMockFn.mock.lastCall?.[0].onCellEdited).toBeUndefined()

      // A finish from the run that was already in flight at submit time (same
      // scriptRunId) must NOT re-enable the editor, even though the sequence
      // advanced.
      rerenderWithContexts(<DataFrame {...props} />, {
        scriptRunContext: {
          scriptRunState: ScriptRunState.RUNNING,
          scriptRunId: "run-1",
          scriptRunFinishedSequence: 1,
          scriptRunFinishedFragmentIds: [],
        },
      })
      expect(dataEditorMockFn.mock.lastCall?.[0].onCellEdited).toBeUndefined()

      // A finish from a fresh run but with a sequence at/below the submit
      // baseline must also NOT re-enable the editor.
      rerenderWithContexts(<DataFrame {...props} />, {
        scriptRunContext: {
          scriptRunState: ScriptRunState.NOT_RUNNING,
          scriptRunId: "run-2",
          scriptRunFinishedSequence: 0,
          scriptRunFinishedFragmentIds: [],
        },
      })
      expect(dataEditorMockFn.mock.lastCall?.[0].onCellEdited).toBeUndefined()
    })

    it("re-enables editing when the matching run finishes", () => {
      const { widgetMgr } = createCommitEditsWidgetMgr()
      const props = getCommitEditsProps(widgetMgr)

      const { rerenderWithContexts } = renderWithContexts(
        <DataFrame {...props} />,
        {
          scriptRunContext: {
            scriptRunState: ScriptRunState.NOT_RUNNING,
            scriptRunId: "run-1",
            scriptRunFinishedSequence: 0,
          },
        }
      )

      submitCellEdit()
      expect(dataEditorMockFn.mock.lastCall?.[0].onCellEdited).toBeUndefined()

      // The triggered run starts with a fresh id and stays disabled while running.
      rerenderWithContexts(<DataFrame {...props} />, {
        scriptRunContext: {
          scriptRunState: ScriptRunState.RUNNING,
          scriptRunId: "run-2",
          scriptRunFinishedSequence: 0,
        },
      })
      expect(dataEditorMockFn.mock.lastCall?.[0].onCellEdited).toBeUndefined()

      // The triggered run finishes (fresh id + advanced sequence + full-script
      // completion) -> the editor re-enables.
      rerenderWithContexts(<DataFrame {...props} />, {
        scriptRunContext: {
          scriptRunState: ScriptRunState.NOT_RUNNING,
          scriptRunId: "run-2",
          scriptRunFinishedSequence: 1,
          scriptRunFinishedFragmentIds: [],
        },
      })
      expect(dataEditorMockFn.mock.lastCall?.[0].onCellEdited).toEqual(
        expect.any(Function)
      )
    })

    it("clears the editing state and widget value once when clearEdits is set", () => {
      const { widgetMgr, setStringValue } = createCommitEditsWidgetMgr()
      const props = getCommitEditsProps(widgetMgr, { clearEdits: true })

      const { rerender } = render(<DataFrame {...props} />)

      // Empty edits are persisted without triggering a rerun.
      expect(setStringValue).toHaveBeenCalledWith(
        "commit-editor",
        EMPTY_EDITS_JSON,
        {
          formId: "",
          fragmentId: undefined,
          fromUser: false,
        }
      )
      // The clear must never write with fromUser: true (which would rerun).
      expect(setStringValue).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ fromUser: true })
      )

      // Re-rendering with the same element proto must not reprocess the clear.
      const callsAfterClear = setStringValue.mock.calls.length
      rerender(<DataFrame {...props} />)
      expect(setStringValue.mock.calls.length).toBe(callsAfterClear)
    })

    it("reprocesses clearEdits on a new proto (consecutive commits)", () => {
      const { widgetMgr, setStringValue } = createCommitEditsWidgetMgr()

      const clearCalls = (): number =>
        setStringValue.mock.calls.filter(
          call => call[1] === EMPTY_EDITS_JSON && call[2]?.fromUser === false
        ).length

      // First successful commit delivers a clearEdits proto -> clear runs once.
      const { rerender } = render(
        <DataFrame {...getCommitEditsProps(widgetMgr, { clearEdits: true })} />
      )
      expect(clearCalls()).toBe(1)

      // A second consecutive value-only commit delivers a NEW proto that also
      // carries clearEdits=true. The clear must run again (regression guard: a
      // stale editing state would otherwise be overlaid on the committed data).
      rerender(
        <DataFrame {...getCommitEditsProps(widgetMgr, { clearEdits: true })} />
      )
      expect(clearCalls()).toBe(2)
    })

    it("never disables editing after an edit when commitEdits is false", () => {
      vi.useFakeTimers()
      const { widgetMgr } = createCommitEditsWidgetMgr()
      const props = getCommitEditsProps(widgetMgr, { commitEdits: false })

      const { rerenderWithContexts } = renderWithContexts(
        <DataFrame {...props} />,
        {
          scriptRunContext: {
            scriptRunState: ScriptRunState.NOT_RUNNING,
            scriptRunId: "run-1",
            scriptRunFinishedSequence: 0,
          },
        }
      )

      submitCellEdit()
      // Flush the (non-commit) debounced sync.
      act(() => {
        vi.runAllTimers()
      })

      // Editing stays enabled right after the edit (no disable-in-flight).
      expect(dataEditorMockFn.mock.lastCall?.[0].onCellEdited).toEqual(
        expect.any(Function)
      )

      // A subsequent run finish does not toggle the editor either.
      rerenderWithContexts(<DataFrame {...props} />, {
        scriptRunContext: {
          scriptRunState: ScriptRunState.NOT_RUNNING,
          scriptRunId: "run-2",
          scriptRunFinishedSequence: 1,
          scriptRunFinishedFragmentIds: [],
        },
      })
      expect(dataEditorMockFn.mock.lastCall?.[0].onCellEdited).toEqual(
        expect.any(Function)
      )
    })
  })
})
