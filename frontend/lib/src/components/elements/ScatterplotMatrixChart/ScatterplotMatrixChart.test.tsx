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

import { act, screen } from "@testing-library/react"
import {
  Table,
  tableFromArrays,
  tableToIPC,
  vectorFromArray,
} from "apache-arrow"

import { ScatterplotMatrixChart as ScatterplotMatrixChartProto } from "@streamlit/protobuf"

import { Quiver } from "~lib/dataframes/Quiver"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import ScatterplotMatrixChart, {
  extractChartData,
  parseStoredSelection,
} from "./ScatterplotMatrixChart"
import type {
  ScatterplotMatrixEngineOptions,
  ScatterplotMatrixSelection,
} from "./scatterplotMatrixEngine"

const mockEngineInstances: Array<{
  options: ScatterplotMatrixEngineOptions
  dispose: ReturnType<typeof vi.fn>
  clearAllQueries: ReturnType<typeof vi.fn>
  setDisabled: ReturnType<typeof vi.fn>
}> = []

// A plain module-level `let` wouldn't be visible to the mock factory below:
// vitest hoists vi.mock calls above regular imports/declarations, so the
// factory needs vi.hoisted() to share mutable state with the test bodies.
const { engineConstructionState } = vi.hoisted(() => ({
  engineConstructionState: { shouldThrow: false },
}))

vi.mock("./scatterplotMatrixEngine", async importOriginal => {
  const original =
    await importOriginal<typeof import("./scatterplotMatrixEngine")>()
  return {
    ...original,
    ScatterplotMatrixEngine: class {
      options: ScatterplotMatrixEngineOptions

      dispose = vi.fn()

      clearAllQueries = vi.fn()

      setDisabled = vi.fn()

      constructor(options: ScatterplotMatrixEngineOptions) {
        if (engineConstructionState.shouldThrow) {
          throw new Error("WebGL 2 is not supported in this browser.")
        }
        this.options = options
        mockEngineInstances.push(this)
      }
    },
  }
})

let capturedFormClearListener: (() => void) | undefined

vi.mock("~lib/components/widgets/Form/FormClearHelper", () => ({
  FormClearHelper: class {
    manageFormClearListener(
      _widgetMgr: WidgetStateManager,
      _formId: string,
      listener: () => void
    ): void {
      capturedFormClearListener = listener
    }

    disconnect(): void {}
  },
}))

function makeArrowData(): Uint8Array {
  const table = tableFromArrays({
    alpha: Float64Array.from([1, 2, Number.NaN, 4]),
    beta: Float64Array.from([10, 20, 30, 40]),
    name: ["first", "second", "third", "fourth"],
  })
  return tableToIPC(table)
}

function makeProto(
  overrides: Partial<ScatterplotMatrixChartProto> = {}
): ScatterplotMatrixChartProto {
  return ScatterplotMatrixChartProto.create({
    id: "chart_id",
    data: { data: makeArrowData() },
    columns: ["alpha", "beta"],
    label: "",
    title: "My matrix",
    queryColors: [],
    rollSpeed: 1,
    selectionsActivated: false,
    formId: "",
    ...overrides,
  })
}

function makeWidgetMgr(): WidgetStateManager {
  return new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  })
}

describe("extractChartData", () => {
  it("extracts numeric rows and skips rows with non-finite values", () => {
    const quiverData = new Quiver({ data: makeArrowData() })
    const { attributes, points } = extractChartData(
      quiverData,
      ["alpha", "beta"],
      ""
    )

    expect(attributes).toEqual(["alpha", "beta"])
    // The third row contains NaN and must be skipped:
    expect(points.map(point => point.id)).toEqual([0, 1, 3])
    expect(points[0].atts).toEqual([1, 10])
    // Without a label column, the positional row index is used:
    expect(points.map(point => point.label)).toEqual(["0", "1", "3"])
  })

  it("uses the label column when provided", () => {
    const quiverData = new Quiver({ data: makeArrowData() })
    const { points } = extractChartData(quiverData, ["beta"], "name")

    expect(points.map(point => point.label)).toEqual([
      "first",
      "second",
      "third",
      "fourth",
    ])
  })

  it("skips rows with a null (missing) value instead of plotting it as zero", () => {
    // Number(null) is 0, which is finite — a plain "is this finite" check
    // would silently plot a missing value as zero, so nulls (e.g. a pandas
    // NA in a nullable numeric column) need their own explicit check.
    // tableFromArrays with a plain array doesn't preserve nulls in this
    // arrow version, so the nullable column is built via vectorFromArray.
    const table = new Table({
      alpha: vectorFromArray([1, null, 3, 4]),
      beta: vectorFromArray([10, 20, 30, 40]),
    })
    const quiverData = new Quiver({ data: tableToIPC(table) })

    const { points } = extractChartData(quiverData, ["alpha", "beta"], "")

    // Row 1 (alpha=null) must be skipped entirely, not kept with alpha
    // coerced to 0:
    expect(points.map(point => point.id)).toEqual([0, 2, 3])
  })
})

describe("parseStoredSelection", () => {
  it("parses per-layer indices from a stored widget state", () => {
    const stored = JSON.stringify({
      selection: {
        indices: [1, 2],
        query_layers: [
          { label: "Query 1", indices: [1, 2] },
          { label: "Query 2", indices: [] },
        ],
      },
    })
    expect(parseStoredSelection(stored)).toEqual([[1, 2], []])
  })

  it("returns an empty selection for missing or invalid values", () => {
    expect(parseStoredSelection(undefined)).toEqual([])
    expect(parseStoredSelection("not json")).toEqual([])
    expect(parseStoredSelection("{}")).toEqual([])
  })

  it("does not truncate to any layer count", () => {
    // Truncation (if the current query_colors is smaller) is the engine's
    // job, not the parser's — see the "reconciles when a restored layer no
    // longer exists" component test below.
    const stored = JSON.stringify({
      selection: {
        indices: [1, 2, 3],
        query_layers: [
          { label: "Query 1", indices: [1] },
          { label: "Query 2", indices: [2] },
          { label: "Query 3", indices: [3] },
        ],
      },
    })
    expect(parseStoredSelection(stored)).toEqual([[1], [2], [3]])
  })
})

describe("ScatterplotMatrixChart", () => {
  beforeEach(() => {
    mockEngineInstances.length = 0
    engineConstructionState.shouldThrow = false
    capturedFormClearListener = undefined
  })

  it("renders a focusable canvas and initializes the engine", () => {
    render(
      <ScatterplotMatrixChart
        element={makeProto()}
        widgetMgr={makeWidgetMgr()}
      />
    )

    expect(screen.getByTestId("stScatterplotMatrixChart")).toBeVisible()
    const canvas = screen.getByTestId("stScatterplotMatrixChartCanvas")
    expect(canvas).toHaveAttribute("tabindex", "0")
    expect(canvas).toHaveAccessibleName("My matrix")

    expect(mockEngineInstances).toHaveLength(1)
    const { options } = mockEngineInstances[0]
    expect(options.attributes).toEqual(["alpha", "beta"])
    expect(options.points).toHaveLength(3)
    expect(options.title).toBe("My matrix")
    // Selections are not activated, so no selection listener is wired up:
    expect(options.onSelectionChange).toBeUndefined()
  })

  it("sends the selection state to the widget manager", () => {
    const widgetMgr = makeWidgetMgr()
    const setStringValueSpy = vi.spyOn(widgetMgr, "setStringValue")
    const element = makeProto({ selectionsActivated: true })

    render(
      <ScatterplotMatrixChart
        element={element}
        widgetMgr={widgetMgr}
        fragmentId="my_fragment"
      />
    )

    const { options } = mockEngineInstances[0]
    expect(options.onSelectionChange).toBeDefined()

    const selection: ScatterplotMatrixSelection = {
      indices: [0, 1],
      query_layers: [{ label: "Query 1", indices: [0, 1] }],
    }
    act(() => options.onSelectionChange?.(selection))

    expect(setStringValueSpy).toHaveBeenCalledWith(
      element,
      JSON.stringify({ selection }),
      { fromUi: true },
      "my_fragment"
    )
  })

  it("does not resend an unchanged selection state", () => {
    const widgetMgr = makeWidgetMgr()
    const element = makeProto({ selectionsActivated: true })

    render(<ScatterplotMatrixChart element={element} widgetMgr={widgetMgr} />)

    const { options } = mockEngineInstances[0]
    const selection: ScatterplotMatrixSelection = {
      indices: [2],
      query_layers: [{ label: "Query 1", indices: [2] }],
    }
    act(() => options.onSelectionChange?.(selection))

    const setStringValueSpy = vi.spyOn(widgetMgr, "setStringValue")
    act(() => options.onSelectionChange?.(selection))
    expect(setStringValueSpy).not.toHaveBeenCalled()
  })

  it("restores a stored selection on remount", () => {
    const widgetMgr = makeWidgetMgr()
    const element = makeProto({ selectionsActivated: true })
    widgetMgr.setStringValue(
      element,
      JSON.stringify({
        selection: {
          indices: [1],
          query_layers: [{ label: "Query 1", indices: [1] }],
        },
      }),
      { fromUi: false },
      undefined
    )

    render(<ScatterplotMatrixChart element={element} widgetMgr={widgetMgr} />)

    const { options } = mockEngineInstances[0]
    expect(options.initialSelection).toEqual([[1]])
  })

  it("passes a restored selection to the engine untruncated even when query_colors shrank", () => {
    // The engine (not the wrapper) is responsible for reconciling a
    // restored selection against the current layer count, so that it can
    // also report the reconciled result back to Python. If the wrapper
    // truncated here instead, the extra layers would be dropped from the
    // engine's input without ever being written back to the widget state.
    const widgetMgr = makeWidgetMgr()
    const element = makeProto({
      selectionsActivated: true,
      queryColors: ["#ff0000"],
    })
    widgetMgr.setStringValue(
      element,
      JSON.stringify({
        selection: {
          indices: [1, 2],
          query_layers: [
            { label: "Query 1", indices: [1] },
            { label: "Query 2", indices: [2] },
          ],
        },
      }),
      { fromUi: false },
      undefined
    )

    render(<ScatterplotMatrixChart element={element} widgetMgr={widgetMgr} />)

    const { options } = mockEngineInstances[0]
    expect(options.initialSelection).toEqual([[1], [2]])
  })

  it("persists and restores the navigation state across remounts", () => {
    const widgetMgr = makeWidgetMgr()
    const element = makeProto()

    const { unmount } = render(
      <ScatterplotMatrixChart element={element} widgetMgr={widgetMgr} />
    )
    const viewState = {
      selectedPlot: { col: 1, row: 0 },
      selectedQueryIndex: 2,
      view: { zoom: 2, panX: -10, panY: 5, autoFit: false },
    }
    act(() => mockEngineInstances[0].options.onViewStateChange?.(viewState))
    unmount()

    render(<ScatterplotMatrixChart element={element} widgetMgr={widgetMgr} />)
    expect(mockEngineInstances[1].options.initialViewState).toEqual(viewState)
  })

  it("blocks interactions when disabled", () => {
    render(
      <ScatterplotMatrixChart
        element={makeProto()}
        widgetMgr={makeWidgetMgr()}
        disabled
      />
    )

    const canvas = screen.getByTestId("stScatterplotMatrixChartCanvas")
    expect(canvas).toHaveAttribute("tabindex", "-1")
    expect(canvas).toHaveStyle("pointer-events: none")
    // The engine's own keyboard handling must also be turned off, not just
    // the CSS/tabIndex (which don't affect an already-focused element):
    expect(mockEngineInstances[0].setDisabled).toHaveBeenCalledWith(true)
  })

  it("blurs an already-focused canvas when it becomes disabled", () => {
    const element = makeProto()
    const widgetMgr = makeWidgetMgr()
    // Reuse the same element/widgetMgr across the rerender (as a real app
    // would across reruns) so only `disabled` changes and the existing
    // engine is reused via setDisabled, instead of being torn down/rebuilt.
    const { rerender } = render(
      <ScatterplotMatrixChart element={element} widgetMgr={widgetMgr} />
    )

    const canvas = screen.getByTestId("stScatterplotMatrixChartCanvas")
    act(() => canvas.focus())
    expect(canvas).toHaveFocus()

    rerender(
      <ScatterplotMatrixChart
        element={element}
        widgetMgr={widgetMgr}
        disabled
      />
    )

    // tabIndex alone wouldn't remove focus from an already-focused element;
    // the component must explicitly blur it so keydown events stop
    // targeting the (now disabled) canvas.
    expect(canvas).not.toHaveFocus()
    expect(mockEngineInstances).toHaveLength(1)
    expect(mockEngineInstances[0].setDisabled).toHaveBeenLastCalledWith(true)
  })

  it("does not blur the canvas when it remains enabled", () => {
    const element = makeProto()
    const widgetMgr = makeWidgetMgr()
    const { rerender } = render(
      <ScatterplotMatrixChart element={element} widgetMgr={widgetMgr} />
    )

    const canvas = screen.getByTestId("stScatterplotMatrixChartCanvas")
    act(() => canvas.focus())
    expect(canvas).toHaveFocus()

    rerender(
      <ScatterplotMatrixChart
        element={element}
        widgetMgr={widgetMgr}
        disabled={false}
      />
    )

    expect(canvas).toHaveFocus()
    expect(mockEngineInstances).toHaveLength(1)
  })

  it("clears the engine's queries when the enclosing form is cleared", () => {
    render(
      <ScatterplotMatrixChart
        element={makeProto({ selectionsActivated: true, formId: "my_form" })}
        widgetMgr={makeWidgetMgr()}
      />
    )

    expect(capturedFormClearListener).toBeDefined()
    act(() => capturedFormClearListener?.())

    expect(mockEngineInstances[0].clearAllQueries).toHaveBeenCalled()
  })

  it("resets the widget selection on form clear when the engine failed to initialize", () => {
    engineConstructionState.shouldThrow = true
    const widgetMgr = makeWidgetMgr()
    const element = makeProto({
      selectionsActivated: true,
      formId: "my_form",
      queryColors: ["#ff0000", "#00ff00"],
    })
    widgetMgr.setStringValue(
      element,
      JSON.stringify({
        selection: {
          indices: [1],
          query_layers: [
            { label: "Query 1", indices: [1] },
            { label: "Query 2", indices: [] },
          ],
        },
      }),
      { fromUi: false },
      undefined
    )

    render(<ScatterplotMatrixChart element={element} widgetMgr={widgetMgr} />)

    // The engine failed to construct, so there's no mock instance to clear:
    expect(mockEngineInstances).toHaveLength(0)
    expect(capturedFormClearListener).toBeDefined()

    act(() => capturedFormClearListener?.())

    expect(widgetMgr.getStringValue(element)).toEqual(
      JSON.stringify({
        selection: {
          indices: [],
          query_layers: [
            { label: "Query 1", indices: [] },
            { label: "Query 2", indices: [] },
          ],
        },
      })
    )
  })

  it("disposes the engine on unmount", () => {
    const { unmount } = render(
      <ScatterplotMatrixChart
        element={makeProto()}
        widgetMgr={makeWidgetMgr()}
      />
    )
    const instance = mockEngineInstances[0]
    expect(instance.dispose).not.toHaveBeenCalled()
    unmount()
    expect(instance.dispose).toHaveBeenCalled()
  })
})
