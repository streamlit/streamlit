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
import { tableFromArrays, tableToIPC } from "apache-arrow"

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
        this.options = options
        mockEngineInstances.push(this)
      }
    },
  }
})

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
    expect(parseStoredSelection(stored, 4)).toEqual([[1, 2], []])
  })

  it("returns an empty selection for missing or invalid values", () => {
    expect(parseStoredSelection(undefined, 4)).toEqual([])
    expect(parseStoredSelection("not json", 4)).toEqual([])
    expect(parseStoredSelection("{}", 4)).toEqual([])
  })
})

describe("ScatterplotMatrixChart", () => {
  beforeEach(() => {
    mockEngineInstances.length = 0
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
