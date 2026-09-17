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

import { waitFor } from "@testing-library/react"
import Plotly from "plotly.js"

import { PlotlyChart as PlotlyChartProto } from "@streamlit/protobuf"

import { mockTheme } from "~lib/mocks/mockTheme"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { applyStreamlitTheme, layoutWithThemeDefaults } from "./CustomTheme"
import {
  applyTheming,
  assignLayoutInPlace,
  handleClickEvent,
  handleSelection,
  parseBoxSelection,
  parseLassoPath,
  plotlyFigureNeedsReactStateUpdate,
  sanitizePlotlyFigureForReact,
  sendEmptySelection,
} from "./utils"

vi.mock("./CustomTheme", () => ({
  replaceTemporaryColors: vi.fn().mockReturnValue("{}"),
  applyStreamlitTheme: vi.fn(),
  layoutWithThemeDefaults: vi.fn().mockReturnValue({}),
}))

describe("PlotlyChart utils", () => {
  describe("parseLassoPath", () => {
    it("parses a simple lasso path string into x and y coordinates", () => {
      const pathData = "M100,150L200,250L300,350Z"
      const result = parseLassoPath(pathData)
      expect(result).toEqual({
        x: [100, 200, 300],
        y: [150, 250, 350],
      })
    })

    it("does not error with an empty string", () => {
      const result = parseLassoPath("")
      expect(result).toEqual({
        x: [],
        y: [],
      })
    })

    it("handles path with only one point", () => {
      const pathData = "M100,150Z"
      const result = parseLassoPath(pathData)
      expect(result).toEqual({
        x: [100],
        y: [150],
      })
    })

    it("handles decimal coordinates", () => {
      const path =
        "M4.016412414518674,8.071685352641575L4.020620725933719,7.8197516509841165Z"
      expect(parseLassoPath(path)).toEqual({
        x: [4.016412414518674, 4.020620725933719],
        y: [8.071685352641575, 7.8197516509841165],
      })
    })
  })

  describe("parsePlotlySelections", () => {
    describe("parseBoxSelection", () => {
      it("parses a box selection into x and y ranges", () => {
        const selection = { x0: 100, y0: 150, x1: 200, y1: 250 }
        const result = parseBoxSelection(selection)
        expect(result).toEqual({
          x: [100, 200],
          y: [150, 250],
        })
      })

      it("returns an object of empty x and y", () => {
        const selection = {}
        const result = parseBoxSelection(selection)
        expect(result).toEqual({
          x: [],
          y: [],
        })
      })

      it("returns empty arrays when required fields are missing", () => {
        const selection = {
          x0: 0.1,
          y0: 0.3,
        }
        const result = parseBoxSelection(selection)
        expect(result).toEqual({
          x: [],
          y: [],
        })
      })
    })
  })

  describe("applyTheming", () => {
    it("applies Streamlit theme when theme is streamlit", () => {
      const mockPlotlyFigure = { data: [{}], layout: {}, frames: [] }
      const chartTheme = "streamlit"

      applyTheming(mockPlotlyFigure, chartTheme, mockTheme.emotion)

      expect(applyStreamlitTheme).toHaveBeenCalled()
    })

    it("applies default theme when not using the default plotly theme", () => {
      const mockPlotlyFigure = { data: [{}], layout: {}, frames: [] }
      const chartTheme = "default"

      applyTheming(mockPlotlyFigure, chartTheme, mockTheme.emotion)

      expect(layoutWithThemeDefaults).toHaveBeenCalled()
    })
  })

  describe("sanitizePlotlyFigureForReact", () => {
    const ownedSize = { width: 600, height: 450 }

    it("strips domain from constrained imshow-like axes and keeps range and scaleanchor", () => {
      const data = [
        {
          type: "heatmap" as const,
          z: [
            [1, 2],
            [3, 4],
          ],
        },
      ]
      const figure = {
        data,
        frames: null,
        layout: {
          xaxis: {
            scaleanchor: "y",
            constrain: "domain",
            domain: [0.66, 1],
            range: [-0.5, 1.5],
          },
          yaxis: {
            constrain: "domain",
            domain: [0, 0.85],
            range: [-0.5, 1.5],
          },
        },
      }

      const result = sanitizePlotlyFigureForReact(figure, ownedSize)

      expect(result.layout.xaxis?.domain).toBeUndefined()
      expect(result.layout.yaxis?.domain).toBeUndefined()
      expect(result.layout.xaxis?.range).toEqual([-0.5, 1.5])
      expect(result.layout.xaxis?.scaleanchor).toBe("y")
      expect(result.layout.xaxis?.constrain).toBe("domain")
      expect(result.layout.yaxis?.constrain).toBe("domain")
    })

    it("preserves explicit domain on unconstrained scatter axes", () => {
      const figure = {
        data: [{ type: "scatter" as const, x: [1, 2], y: [1, 2] }],
        frames: null,
        layout: {
          xaxis: { domain: [0, 0.45], range: [0, 10] },
          yaxis: { domain: [0, 1], range: [0, 5] },
        },
      }

      const result = sanitizePlotlyFigureForReact(figure, ownedSize)

      expect(result.layout.xaxis?.domain).toEqual([0, 0.45])
      expect(result.layout.yaxis?.domain).toEqual([0, 1])
      expect(result.layout.xaxis?.range).toEqual([0, 10])
    })

    it("strips domain from xaxis2 and yaxis2 when constrain is domain", () => {
      const figure = {
        data: [],
        frames: null,
        layout: {
          xaxis2: { constrain: "domain", domain: [0.5, 1], range: [1, 2] },
          yaxis2: { constrain: "domain", domain: [0.5, 1], range: [3, 4] },
        },
      }

      const result = sanitizePlotlyFigureForReact(figure, ownedSize)

      expect(result.layout.xaxis2?.domain).toBeUndefined()
      expect(result.layout.yaxis2?.domain).toBeUndefined()
      expect(result.layout.xaxis2?.constrain).toBe("domain")
      expect(result.layout.xaxis2?.range).toEqual([1, 2])
      expect(result.layout.yaxis2?.range).toEqual([3, 4])
    })

    it("uses Streamlit-owned size and forces autosize false", () => {
      const figure = {
        data: [],
        frames: null,
        layout: { width: 10, height: 10, autosize: true },
      }

      const result = sanitizePlotlyFigureForReact(figure, ownedSize)

      expect(result.layout.width).toBe(600)
      expect(result.layout.height).toBe(450)
      expect(result.layout.autosize).toBe(false)
    })

    it("restores previousLayout margin instead of Plotly automargin output", () => {
      const figure = {
        data: [],
        frames: null,
        layout: { margin: { l: 99, r: 99, t: 99, b: 99 } },
      }
      const previousLayout = { margin: { l: 10, r: 20, t: 30, b: 40 } }

      const result = sanitizePlotlyFigureForReact(
        figure,
        ownedSize,
        previousLayout
      )

      expect(result.layout.margin).toEqual({ l: 10, r: 20, t: 30, b: 40 })
    })

    it("drops Plotly-computed margin when previousLayout has no layout margin", () => {
      const figure = {
        data: [],
        frames: null,
        layout: { margin: { l: 99, r: 99, t: 99, b: 99 } },
      }

      const result = sanitizePlotlyFigureForReact(figure, ownedSize, {})

      expect(result.layout.margin).toBeUndefined()
    })

    it("keeps figure margin when previousLayout is omitted", () => {
      const margin = { l: 12, r: 12, t: 12, b: 12 }
      const result = sanitizePlotlyFigureForReact(
        { data: [], frames: null, layout: { margin } },
        ownedSize
      )

      expect(result.layout.margin).toEqual(margin)
    })

    it("copies scene.camera through unchanged", () => {
      const camera = { eye: { x: 1.5, y: 1.25, z: 0.75 } }
      const figure = {
        data: [],
        frames: null,
        layout: { scene: { camera } },
      }

      const result = sanitizePlotlyFigureForReact(figure, ownedSize)

      expect(result.layout.scene?.camera).toEqual(camera)
    })

    it("does not mutate the input figure layout", () => {
      const layout = {
        xaxis: {
          scaleanchor: "y" as const,
          constrain: "domain" as const,
          domain: [0.66, 1],
          range: [0, 1],
        },
      }
      const figure = { data: [], frames: null, layout }

      sanitizePlotlyFigureForReact(figure, ownedSize)

      expect(layout.xaxis.domain).toEqual([0.66, 1])
    })

    it("keeps the same data reference without deep cloning", () => {
      const data = [{ type: "scatter" as const, x: [1], y: [2] }]
      const figure = { data, frames: null, layout: {} }

      const result = sanitizePlotlyFigureForReact(figure, ownedSize)

      expect(result.data).toBe(data)
    })

    it("overlays zoom range onto previousLayout without adopting computed domain", () => {
      const previousLayout = {
        title: { text: "Keep me" },
        xaxis: {
          scaleanchor: "y" as const,
          constrain: "domain" as const,
          range: [-0.5, 1.5],
        },
        yaxis: { constrain: "domain" as const, range: [-0.5, 1.5] },
      }
      const figure = {
        data: [],
        frames: null,
        layout: {
          xaxis: {
            scaleanchor: "y",
            constrain: "domain",
            domain: [0.67, 0.99],
            range: [0.1, 0.9],
            tickvals: [0.1, 0.5, 0.9],
          },
          yaxis: {
            constrain: "domain",
            domain: [0.01, 0.84],
            range: [0.2, 0.8],
          },
        },
      }

      const result = sanitizePlotlyFigureForReact(
        figure,
        ownedSize,
        previousLayout
      )

      expect(result.layout.title).toEqual({ text: "Keep me" })
      expect(result.layout.xaxis?.range).toEqual([0.1, 0.9])
      expect(result.layout.yaxis?.range).toEqual([0.2, 0.8])
      expect(result.layout.xaxis?.domain).toBeUndefined()
      expect(result.layout.yaxis?.domain).toBeUndefined()
      expect(result.layout.xaxis?.scaleanchor).toBe("y")
      expect(
        (result.layout.xaxis as Record<string, unknown> | undefined)?.tickvals
      ).toBeUndefined()
    })

    it("preserves unconstrained domain from previousLayout while overlaying range", () => {
      const previousLayout = {
        xaxis: { domain: [0, 0.45], range: [0, 10] },
      }
      const figure = {
        data: [],
        frames: null,
        layout: {
          xaxis: { domain: [0.1, 0.4], range: [1, 5] },
        },
      }

      const result = sanitizePlotlyFigureForReact(
        figure,
        ownedSize,
        previousLayout
      )

      expect(result.layout.xaxis?.domain).toEqual([0, 0.45])
      expect(result.layout.xaxis?.range).toEqual([1, 5])
    })

    it("ignores tiny Plotly range drift so React layout stays stable", () => {
      const previousLayout = {
        xaxis: { range: [0, 10] },
      }
      const figure = {
        data: [],
        frames: null,
        layout: {
          xaxis: { range: [0, 10 + 1e-9], tickvals: [0, 5, 10] },
          polar: { radialaxis: { visible: true } },
        },
      }

      const result = sanitizePlotlyFigureForReact(
        figure,
        ownedSize,
        previousLayout
      )

      expect(result.layout.xaxis?.range).toEqual([0, 10])
      expect(
        (result.layout.xaxis as Record<string, unknown> | undefined)?.tickvals
      ).toBeUndefined()
      expect(result.layout.polar).toBeUndefined()
    })

    it("adopts live dragmode so modebar pan/select/zoom persist", () => {
      const previousLayout = {
        dragmode: "select" as const,
        hovermode: "closest" as const,
      }
      const figure = {
        data: [],
        frames: null,
        layout: {
          dragmode: "pan" as const,
          hovermode: "x" as const,
        },
      }

      const result = sanitizePlotlyFigureForReact(
        figure,
        ownedSize,
        previousLayout
      )

      expect(result.layout.dragmode).toBe("pan")
      expect(result.layout.hovermode).toBe("closest")
    })

    it("overlays zoom reset by adopting autorange and dropping the stale range", () => {
      const previousLayout = {
        xaxis: { range: [2, 8], autorange: false },
        yaxis: { range: [1, 5], autorange: false },
      }
      const figure = {
        data: [],
        frames: null,
        layout: {
          xaxis: { autorange: true },
          yaxis: { autorange: true, range: [0, 10] },
        },
      }

      const result = sanitizePlotlyFigureForReact(
        figure,
        ownedSize,
        previousLayout
      )

      expect(result.layout.xaxis?.autorange).toBe(true)
      expect(result.layout.xaxis?.range).toBeUndefined()
      expect(result.layout.yaxis?.autorange).toBe(true)
      expect(result.layout.yaxis?.range).toBeUndefined()
    })

    it("sets autorange false when adopting a zoom range", () => {
      const previousLayout = {
        xaxis: { autorange: true },
      }
      const figure = {
        data: [],
        frames: null,
        layout: {
          xaxis: { range: [2, 8] },
        },
      }

      const result = sanitizePlotlyFigureForReact(
        figure,
        ownedSize,
        previousLayout
      )

      expect(result.layout.xaxis?.range).toEqual([2, 8])
      expect(result.layout.xaxis?.autorange).toBe(false)
    })

    it("clears persisted selections when Plotly omits the key", () => {
      const previousLayout = {
        selections: [
          { type: "rect", xref: "x", yref: "y", x0: 1, x1: 2, y0: 1, y1: 2 },
        ],
      }
      const figure = {
        data: [],
        frames: null,
        layout: { xaxis: { range: [0, 1] } },
      }

      const result = sanitizePlotlyFigureForReact(
        figure,
        ownedSize,
        previousLayout
      )

      expect(result.layout.selections).toEqual([])
    })

    it("keeps unconstrained domain when scaleanchor is false", () => {
      const previousLayout = {
        xaxis: { domain: [0, 0.45], range: [0, 10] },
      }
      const figure = {
        data: [],
        frames: null,
        layout: {
          xaxis: { scaleanchor: false, domain: [0.1, 0.4], range: [1, 5] },
        },
      }

      const result = sanitizePlotlyFigureForReact(
        figure,
        ownedSize,
        previousLayout
      )

      expect(result.layout.xaxis?.domain).toEqual([0, 0.45])
      expect(result.layout.xaxis?.scaleanchor).toBe(false)
      expect(result.layout.xaxis?.range).toEqual([1, 5])
    })

    it("keeps authored subplot domain on constrained axes when previousLayout is provided", () => {
      const previousLayout = {
        xaxis: {
          scaleanchor: "y" as const,
          constrain: "domain" as const,
          domain: [0, 0.32],
          range: [0, 1],
        },
      }
      const figure = {
        data: [],
        frames: null,
        layout: {
          xaxis: {
            scaleanchor: "y",
            constrain: "domain",
            domain: [0.01, 0.31],
            range: [0.2, 0.8],
          },
        },
      }

      const result = sanitizePlotlyFigureForReact(
        figure,
        ownedSize,
        previousLayout
      )

      expect(result.layout.xaxis?.domain).toEqual([0, 0.32])
      expect(result.layout.xaxis?.range).toEqual([0.2, 0.8])
    })

    it("treats non-boolean autorange as a zoom reset", () => {
      const previousLayout = {
        yaxis: { range: [0, 10], autorange: false },
      }
      const figure = {
        data: [],
        frames: null,
        layout: {
          yaxis: { autorange: "reversed", range: [0, 10] },
        },
      }

      const result = sanitizePlotlyFigureForReact(
        figure,
        ownedSize,
        previousLayout
      )

      expect(result.layout.yaxis?.autorange).toBe("reversed")
      expect(result.layout.yaxis?.range).toBeUndefined()
    })

    it.each([
      ["min", [null, 10]],
      ["max", [0, null]],
      ["min reversed", [null, 10]],
      ["max reversed", [0, null]],
    ] as const)("keeps range for partial autorange %s", (autorange, range) => {
      const previousLayout = {
        xaxis: { range: [0, 10], autorange: false },
      }
      const figure = {
        data: [],
        frames: null,
        layout: {
          xaxis: { autorange, range },
        },
      }

      const result = sanitizePlotlyFigureForReact(
        figure,
        ownedSize,
        previousLayout
      )

      expect(result.layout.xaxis?.autorange).toBe(autorange)
      expect(result.layout.xaxis?.range).toEqual([...range])
    })

    it("clears persisted hiddenlabels when Plotly omits the key", () => {
      const previousLayout = {
        hiddenlabels: ["slice-a"],
      }
      const figure = {
        data: [],
        frames: null,
        layout: { xaxis: { range: [0, 1] } },
      }

      const result = sanitizePlotlyFigureForReact(
        figure,
        ownedSize,
        previousLayout
      )

      expect(result.layout.hiddenlabels).toEqual([])
    })

    it("does not need a React state update after applying a noisy live layout twice", () => {
      const data: never[] = []
      const previousLayout = {
        title: { text: "Owned" },
        xaxis: { range: [0, 10] },
        dragmode: "select" as const,
      }
      const liveFigure = {
        data,
        frames: null,
        layout: {
          xaxis: { range: [1e-12, 10 - 1e-12], tickvals: [0, 5, 10] },
          dragmode: "select" as const,
          selections: [
            {
              type: "rect",
              xref: "x",
              yref: "y",
              x0: 1,
              x1: 2,
              y0: 1,
              y1: 2,
              line: { color: "red", width: 2 },
              fillcolor: "rgba(0,0,255,0.2)",
              opacity: 0.4,
              name: "box",
              _inputIndex: 0,
            },
          ],
        },
      }

      const first = sanitizePlotlyFigureForReact(
        liveFigure,
        ownedSize,
        previousLayout
      )
      const second = sanitizePlotlyFigureForReact(
        liveFigure,
        ownedSize,
        first.layout
      )

      expect(plotlyFigureNeedsReactStateUpdate(first, second)).toBe(false)
      expect(first.layout.selections).toEqual([
        {
          type: "rect",
          xref: "x",
          yref: "y",
          x0: 1,
          x1: 2,
          y0: 1,
          y1: 2,
          line: { color: "red", width: 2 },
          fillcolor: "rgba(0,0,255,0.2)",
          opacity: 0.4,
          name: "box",
        },
      ])
    })
  })

  describe("assignLayoutInPlace", () => {
    it("keeps the target object identity while replacing contents", () => {
      const target: Partial<Plotly.Layout> = {
        xaxis: { range: [0, 1] },
        margin: { l: 99 },
      }
      const source: Partial<Plotly.Layout> = {
        xaxis: { range: [2, 8] },
        autosize: false,
      }

      const result = assignLayoutInPlace(target, source)

      expect(result).toBe(target)
      expect(target.xaxis).toEqual({ range: [2, 8] })
      expect(target.autosize).toBe(false)
      expect(target.margin).toBeUndefined()
    })

    it("deletes sanitizer-omitted keys such as polar and stale selections", () => {
      const target: Partial<Plotly.Layout> = {
        xaxis: { range: [0, 1] },
        polar: { radialaxis: { visible: true } },
        selections: [{ type: "rect", x0: 1, x1: 2, y0: 1, y1: 2 }],
        margin: { l: 99 },
      }
      const source: Partial<Plotly.Layout> = {
        xaxis: { range: [2, 8] },
        autosize: false,
      }

      assignLayoutInPlace(target, source)

      expect(target).toEqual({
        xaxis: { range: [2, 8] },
        autosize: false,
      })
      expect(target.polar).toBeUndefined()
      expect(target.selections).toBeUndefined()
      expect(target.margin).toBeUndefined()
    })
  })

  describe("plotlyFigureNeedsReactStateUpdate", () => {
    it("is false when data, frames, and layout contents match", () => {
      const prev = {
        data: [{ type: "scatter" as const, x: [1], y: [2] }],
        frames: null,
        layout: { xaxis: { range: [0, 1] }, width: 600, autosize: false },
      }
      const next = {
        data: prev.data,
        frames: null,
        layout: { xaxis: { range: [0, 1] }, width: 600, autosize: false },
      }

      expect(plotlyFigureNeedsReactStateUpdate(prev, next)).toBe(false)
    })

    it("treats null and undefined frames as the same", () => {
      const data: never[] = []
      expect(
        plotlyFigureNeedsReactStateUpdate(
          { data, frames: null, layout: {} },
          { data, frames: undefined, layout: {} }
        )
      ).toBe(false)
    })

    it("is false when data is a new array with the same selectedpoints", () => {
      const layout = { xaxis: { range: [0, 1] } }
      const prev = {
        data: [
          { type: "scatter" as const, x: [1], y: [2], selectedpoints: [0] },
        ],
        frames: null,
        layout,
      }
      const next = {
        data: [
          { type: "scatter" as const, x: [1], y: [2], selectedpoints: [0] },
        ],
        frames: null,
        layout: { xaxis: { range: [0, 1] } },
      }

      expect(plotlyFigureNeedsReactStateUpdate(prev, next)).toBe(false)
    })

    it("is true when zoom range changes", () => {
      const data: never[] = []
      const prev = {
        data,
        frames: null,
        layout: { xaxis: { range: [0, 1] } },
      }
      const next = {
        data,
        frames: null,
        layout: { xaxis: { range: [0.2, 0.8] } },
      }

      expect(plotlyFigureNeedsReactStateUpdate(prev, next)).toBe(true)
    })

    it("is true when a sub-epsilon absolute range still changes relatively", () => {
      const data: never[] = []
      const prev = {
        data,
        frames: null,
        layout: { xaxis: { range: [1e-9, 2e-9] } },
      }
      const next = {
        data,
        frames: null,
        layout: { xaxis: { range: [1.2e-9, 1.8e-9] } },
      }

      expect(plotlyFigureNeedsReactStateUpdate(prev, next)).toBe(true)
    })

    it("is true when a large-offset window pans by more than span-relative epsilon", () => {
      const data: never[] = []
      const prev = {
        data,
        frames: null,
        layout: { xaxis: { range: [1e12, 1e12 + 100] } },
      }
      const next = {
        data,
        frames: null,
        layout: { xaxis: { range: [1e12 + 1, 1e12 + 101] } },
      }

      expect(plotlyFigureNeedsReactStateUpdate(prev, next)).toBe(true)
    })

    it("is false when a large-offset window only drifts by a sub-span epsilon", () => {
      const data: never[] = []
      const prev = {
        data,
        frames: null,
        layout: { xaxis: { range: [1e12, 1e12 + 100] } },
      }
      const next = {
        data,
        frames: null,
        layout: { xaxis: { range: [1e12 + 1e-6, 1e12 + 100 + 1e-6] } },
      }

      expect(plotlyFigureNeedsReactStateUpdate(prev, next)).toBe(false)
    })
  })

  const getWidgetMgr = (): WidgetStateManager => {
    const sendRerunBackMsg = vi.fn()
    const formsDataChanged = vi.fn()
    return new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged,
    })
  }

  describe("handleSelection", () => {
    const mockFragmentId = "testFragment"
    const proto = {
      id: "plotly_chart",
      selectionMode: [0, 1, 2],
    } as PlotlyChartProto

    it("should return early if no event is provided", () => {
      const widgetMgr = getWidgetMgr()
      vi.spyOn(widgetMgr, "setStringValue")

      // @ts-expect-error
      handleSelection(undefined, widgetMgr, proto, mockFragmentId)
      expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
    })

    it("should handle an event with no points or selections", () => {
      const event = {
        points: undefined,
        selections: undefined,
      } as unknown as Plotly.PlotSelectionEvent
      const widgetMgr = getWidgetMgr()

      vi.spyOn(widgetMgr, "setStringValue")

      handleSelection(event, widgetMgr, proto, mockFragmentId)
      expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    })

    it("should process events with points correctly", () => {
      const event = {
        points: [
          {
            pointIndex: 1,
            data: { legendgroup: "group1" },
            pointIndices: [1],
            customdata: [10, null, { extraInfo: 7 }],
          },
        ],
      } as unknown as Plotly.PlotSelectionEvent
      const widgetMgr = getWidgetMgr()

      vi.spyOn(widgetMgr, "setStringValue")

      handleSelection(event, widgetMgr, proto, mockFragmentId)
      expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
        "plotly_chart",
        '{"selection":{"points":[{"point_index":1,"point_indices":[1],"customdata":[10,null,{"extra_info":7}],"legendgroup":"group1"}],"point_indices":[1],"box":[],"lasso":[]}}',
        { formId: undefined, fragmentId: "testFragment", fromUser: true }
      )
    })

    it("should process box selections correctly", () => {
      const event = {
        selections: [
          {
            type: "rect",
            xref: "x",
            yref: "y",
            x0: "0",
            x1: "1",
            y0: "0",
            y1: "1",
          },
        ],
      } as unknown as Plotly.PlotSelectionEvent
      const widgetMgr = getWidgetMgr()

      vi.spyOn(widgetMgr, "setStringValue")

      handleSelection(event, widgetMgr, proto, undefined)
      expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
        "plotly_chart",
        '{"selection":{"points":[],"point_indices":[],"box":[{"xref":"x","yref":"y","x":["0","1"],"y":["0","1"]}],"lasso":[]}}',
        { formId: undefined, fragmentId: undefined, fromUser: true }
      )
    })

    it("should process lasso selections correctly", () => {
      const event = {
        selections: [
          { type: "path", xref: "x", yref: "y", path: "M4.0,8.0L4.0,7.8Z" },
        ],
      } as unknown as Plotly.PlotSelectionEvent
      const widgetMgr = getWidgetMgr()

      vi.spyOn(widgetMgr, "setStringValue")

      handleSelection(event, widgetMgr, proto, mockFragmentId)
      expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
        "plotly_chart",
        '{"selection":{"points":[],"point_indices":[],"box":[],"lasso":[{"xref":"x","yref":"y","x":[4,4],"y":[8,7.8]}]}}',
        { formId: undefined, fragmentId: "testFragment", fromUser: true }
      )
    })

    it("should not rerun if lasso selection is present but has no lasso selection mode", () => {
      const event = {
        selections: [
          { type: "path", xref: "x", yref: "y", path: "M4.0,8.0L4.0,7.8Z" },
        ],
      } as unknown as Plotly.PlotSelectionEvent
      const widgetMgr = getWidgetMgr()

      vi.spyOn(widgetMgr, "setStringValue")

      handleSelection(
        event,
        widgetMgr,
        // @ts-expect-error
        { ...proto, selectionMode: [] },
        mockFragmentId
      )
      expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
    })

    it("should not rerun if box selection is present but has no box selection mode", () => {
      const event = {
        selections: [
          {
            type: "rect",
            xref: "x",
            yref: "y",
            x0: "0",
            x1: "1",
            y0: "0",
            y1: "1",
          },
        ],
      } as unknown as Plotly.PlotSelectionEvent
      const widgetMgr = getWidgetMgr()

      vi.spyOn(widgetMgr, "setStringValue")

      handleSelection(
        event,
        widgetMgr,
        // @ts-expect-error
        { ...proto, selectionMode: [] },
        mockFragmentId
      )
      expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
    })

    it("should not rerun if the return value is the same", () => {
      const event = {
        points: [],
        selections: [],
      } as unknown as Plotly.PlotSelectionEvent
      const widgetMgr = getWidgetMgr()

      vi.spyOn(widgetMgr, "setStringValue")

      widgetMgr.setStringValue(
        proto.id,
        '{"selection":{"points":[],"point_indices":[],"box":[],"lasso":[]}}',
        { formId: proto.formId, fragmentId: undefined, fromUser: true }
      )

      handleSelection(event, widgetMgr, proto, mockFragmentId)
      expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    })

    it('should rerun if there is a lasso select and a box select when selection_mode=["box", "lasso"]', () => {
      const boxEvent = {
        points: [
          {
            pointIndex: 0,
            data: { legendgroup: "group2" },
            pointIndices: [0],
            x: 0,
            y: 0,
          },
        ],
        selections: [
          {
            type: "rect",
            xref: "x",
            yref: "y",
            x0: "0",
            x1: "1",
            y0: "0",
            y1: "1",
          },
        ],
      } as unknown as Plotly.PlotSelectionEvent

      const widgetMgr = getWidgetMgr()

      vi.spyOn(widgetMgr, "setStringValue")
      handleSelection(
        boxEvent,
        widgetMgr,
        { ...proto, selectionMode: [1, 2] } as PlotlyChartProto,
        undefined
      )
      expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)

      const lassoEventAndBoxEvent = {
        points: [
          {
            pointIndex: 1,
            data: { legendgroup: "group1" },
            pointIndices: [1],
            x: 1,
            y: 1,
          },
          {
            pointIndex: 0,
            data: { legendgroup: "group2" },
            pointIndices: [0],
            x: 0,
            y: 0,
          },
        ],
        selections: [
          { type: "path", xref: "x", yref: "y", path: "M4.0,8.0L4.0,7Z" },
          {
            type: "rect",
            xref: "x",
            yref: "y",
            x0: "0",
            x1: "1",
            y0: "0",
            y1: "1",
          },
        ],
      } as unknown as Plotly.PlotSelectionEvent

      handleSelection(
        lassoEventAndBoxEvent,
        widgetMgr,
        { ...proto, selectionMode: [1, 2] } as PlotlyChartProto,
        undefined
      )
      expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(2)
      expect(widgetMgr.setStringValue).toHaveBeenLastCalledWith(
        "plotly_chart",
        '{"selection":{"points":[{"point_index":1,"point_indices":[1],"x":1,"y":1,"legendgroup":"group1"},{"point_index":0,"point_indices":[0],"x":0,"y":0,"legendgroup":"group2"}],"point_indices":[1,0],"box":[{"xref":"x","yref":"y","x":["0","1"],"y":["0","1"]}],"lasso":[{"xref":"x","yref":"y","x":[4,4],"y":[8,7]}]}}',
        { formId: undefined, fragmentId: undefined, fromUser: true }
      )
    })
  })

  describe("sendEmptySelection", () => {
    it("sets empty selection state", async () => {
      const sendRerunBackMsg = vi.fn()
      const widgetMgr = new WidgetStateManager({
        sendRerunBackMsg,
        formsDataChanged: vi.fn(),
      })
      const plotlyProto = { id: "plotly_chart" } as PlotlyChartProto

      sendEmptySelection(widgetMgr, plotlyProto, undefined)

      // Verify state is set correctly
      const newState = widgetMgr.getStringValue(plotlyProto)
      expect(newState).toBe(
        '{"selection":{"points":[],"point_indices":[],"box":[],"lasso":[]}}'
      )

      await waitFor(() => {
        // Verify rerun message is sent with correct widget states
        expect(sendRerunBackMsg).toHaveBeenCalledWith(
          {
            widgets: [
              {
                id: "plotly_chart",
                stringValue:
                  '{"selection":{"points":[],"point_indices":[],"box":[],"lasso":[]}}',
              },
            ],
          },
          undefined,
          undefined,
          undefined
        )
      })
    })

    it("sets empty selection state and sends rerun with fragmentId", async () => {
      const sendRerunBackMsg = vi.fn()
      const widgetMgr = new WidgetStateManager({
        sendRerunBackMsg,
        formsDataChanged: vi.fn(),
      })
      const plotlyProto = { id: "plotly_chart" } as PlotlyChartProto
      const fragmentId = "test-fragment"

      sendEmptySelection(widgetMgr, plotlyProto, fragmentId)

      // Verify state is set correctly
      const newState = widgetMgr.getStringValue(plotlyProto)
      expect(newState).toBe(
        '{"selection":{"points":[],"point_indices":[],"box":[],"lasso":[]}}'
      )

      // Verify rerun message is sent with correct widget states and fragmentId
      await waitFor(() => {
        expect(sendRerunBackMsg).toHaveBeenCalledWith(
          {
            widgets: [
              {
                id: "plotly_chart",
                stringValue:
                  '{"selection":{"points":[],"point_indices":[],"box":[],"lasso":[]}}',
              },
            ],
          },
          fragmentId,
          undefined,
          undefined
        )
      })
    })
  })

  describe("handleClickEvent", () => {
    const mockFragmentId = "testFragment"
    const proto = {
      id: "plotly_chart",
      selectionMode: [0, 1, 2],
    } as PlotlyChartProto

    it.each([
      ["undefined event", undefined],
      ["event with empty points array", { points: [] }],
      [
        "non-hierarchical chart click (no id/parent)",
        { points: [{ x: 100, y: 200, pointIndex: 1 }] },
      ],
    ])("should return early for %s", (_desc, event) => {
      const widgetMgr = getWidgetMgr()
      vi.spyOn(widgetMgr, "setStringValue")

      handleClickEvent(
        event as unknown as Plotly.PlotMouseEvent,
        widgetMgr,
        proto,
        mockFragmentId
      )
      expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
    })

    it("should process treemap/sunburst clicks correctly", () => {
      const event = {
        points: [
          {
            label: "China",
            id: "Asia/China",
            parent: "Asia",
            value: 1318683096,
            currentPath: "/Asia/",
            percentRoot: 0.21,
            percentEntry: 0.21,
            percentParent: 0.35,
            pointNumber: 25,
            curveNumber: 0,
          },
        ],
      } as unknown as Plotly.PlotMouseEvent
      const widgetMgr = getWidgetMgr()
      vi.spyOn(widgetMgr, "setStringValue")

      handleClickEvent(event, widgetMgr, proto, mockFragmentId)

      expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
        proto.id,
        '{"selection":{"points":[{"label":"China","id":"Asia/China","parent":"Asia","value":1318683096,"current_path":"/Asia/","percent_root":0.21,"percent_entry":0.21,"percent_parent":0.35,"point_number":25,"curve_number":0}],"point_indices":[25],"box":[],"lasso":[]}}',
        { formId: proto.formId, fragmentId: mockFragmentId, fromUser: true }
      )
    })

    it("should handle treemap click with undefined pointNumber", () => {
      const event = {
        points: [
          {
            label: "Root",
            id: "",
            parent: "",
            value: 1000,
          },
        ],
      } as unknown as Plotly.PlotMouseEvent
      const widgetMgr = getWidgetMgr()
      vi.spyOn(widgetMgr, "setStringValue")

      handleClickEvent(event, widgetMgr, proto, mockFragmentId)

      expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
        proto.id,
        expect.stringContaining('"point_indices":[]'),
        { formId: proto.formId, fragmentId: mockFragmentId, fromUser: true }
      )
    })

    it("should not rerun if selection state is unchanged", () => {
      const event = {
        points: [
          {
            label: "China",
            id: "Asia/China",
            parent: "Asia",
            value: 1318683096,
            currentPath: "/Asia/",
            percentRoot: 0.21,
            percentEntry: 0.21,
            percentParent: 0.35,
            pointNumber: 25,
            curveNumber: 0,
          },
        ],
      } as unknown as Plotly.PlotMouseEvent
      const widgetMgr = getWidgetMgr()
      vi.spyOn(widgetMgr, "setStringValue")

      // Pre-set the state to match what the click would produce
      widgetMgr.setStringValue(
        proto.id,
        '{"selection":{"points":[{"label":"China","id":"Asia/China","parent":"Asia","value":1318683096,"current_path":"/Asia/","percent_root":0.21,"percent_entry":0.21,"percent_parent":0.35,"point_number":25,"curve_number":0}],"point_indices":[25],"box":[],"lasso":[]}}',
        { formId: proto.formId, fragmentId: mockFragmentId, fromUser: true }
      )

      // Clear the mock to only count the handleClickEvent call
      vi.clearAllMocks()

      handleClickEvent(event, widgetMgr, proto, mockFragmentId)

      // Should not call setStringValue again since state is unchanged
      expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
    })
  })
})
