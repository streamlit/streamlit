/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React from "react"

import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"

import { render } from "@streamlit/lib/src/test_util"
import { BokehChart as BokehChartProto } from "@streamlit/lib/src/proto"
import Bokeh from "@streamlit/lib/src/vendor/bokeh/bokeh.esm"

import { BokehChart, BokehChartProps } from "./BokehChart"

vi.mock("@streamlit/lib/src/vendor/bokeh/bokeh.esm", () => ({
  // needed to parse correctly
  __esModule: true,
  default: {
    // the js source code has main.register_plugin so we need to mock it
    register_plugin: jest.fn(),
    // actual function that we need to mock and check
    embed: {
      embed_item: jest.fn(),
    },
  },
}))

const mockBokehEmbed = vi.mocked(Bokeh)

// Serialized BokehChart data for testing purposes
const MOCK_FIGURE = {
  target_id: null,
  root_id: "1088",
  doc: {
    roots: {
      references: [
        {
          attributes: {},
          id: "1113",
          type: "ResetTool",
        },
        {
          attributes: {
            data_source: { id: "1122", type: "ColumnDataSource" },
            glyph: { id: "1123", type: "Line" },
            hover_glyph: null,
            muted_glyph: null,
            nonselection_glyph: { id: "1124", type: "Line" },
            selection_glyph: null,
            view: { id: "1126", type: "CDSView" },
          },
          id: "1125",
          type: "GlyphRenderer",
        },
        { attributes: {}, id: "1114", type: "HelpTool" },
        {
          attributes: { callback: null },
          id: "1091",
          type: "DataRange1d",
        },
        {
          attributes: {
            line_alpha: 0.1,
            line_color: "#1f77b4",
            line_width: 2,
            x: { field: "x" },
            y: { field: "y" },
          },
          id: "1124",
          type: "Line",
        },
        { attributes: {}, id: "1097", type: "LinearScale" },
        {
          attributes: {
            axis_label: "x",
            formatter: { id: "1131", type: "BasicTickFormatter" },
            ticker: { id: "1100", type: "BasicTicker" },
          },
          id: "1099",
          type: "LinearAxis",
        },
        {
          attributes: {
            callback: null,
            data: { x: [1, 2, 3, 4, 5], y: [6, 7, 2, 4, 5] },
            selected: { id: "1140", type: "Selection" },
            selection_policy: { id: "1141", type: "UnionRenderers" },
          },
          id: "1122",
          type: "ColumnDataSource",
        },
        {
          attributes: { items: [{ id: "1134", type: "LegendItem" }] },
          id: "1133",
          type: "Legend",
        },
        {
          attributes: {
            active_drag: "auto",
            active_inspect: "auto",
            active_multi: null,
            active_scroll: "auto",
            active_tap: "auto",
            tools: [
              { id: "1109", type: "PanTool" },
              { id: "1110", type: "WheelZoomTool" },
              {
                id: "1111",
                type: "BoxZoomTool",
              },
              { id: "1112", type: "SaveTool" },
              { id: "1113", type: "ResetTool" },
              {
                id: "1114",
                type: "HelpTool",
              },
            ],
          },
          id: "1115",
          type: "Toolbar",
        },
        {
          attributes: {
            dimension: 1,
            ticker: { id: "1105", type: "BasicTicker" },
          },
          id: "1108",
          type: "Grid",
        },
        {
          attributes: {},
          id: "1131",
          type: "BasicTickFormatter",
        },
        {
          attributes: {
            below: [{ id: "1099", type: "LinearAxis" }],
            center: [
              { id: "1103", type: "Grid" },
              { id: "1108", type: "Grid" },
              {
                id: "1133",
                type: "Legend",
              },
            ],
            left: [{ id: "1104", type: "LinearAxis" }],
            renderers: [{ id: "1125", type: "GlyphRenderer" }],
            title: { id: "1089", type: "Title" },
            toolbar: { id: "1115", type: "Toolbar" },
            x_range: { id: "1091", type: "DataRange1d" },
            x_scale: { id: "1095", type: "LinearScale" },
            y_range: { id: "1093", type: "DataRange1d" },
            y_scale: { id: "1097", type: "LinearScale" },
          },
          id: "1088",
          subtype: "Figure",
          type: "Plot",
        },
        { attributes: {}, id: "1109", type: "PanTool" },
        {
          attributes: {},
          id: "1100",
          type: "BasicTicker",
        },
        {
          attributes: {},
          id: "1129",
          type: "BasicTickFormatter",
        },
        {
          attributes: {
            line_color: "#1f77b4",
            line_width: 2,
            x: { field: "x" },
            y: { field: "y" },
          },
          id: "1123",
          type: "Line",
        },
        { attributes: {}, id: "1140", type: "Selection" },
        {
          attributes: { text: "simple line example" },
          id: "1089",
          type: "Title",
        },
        { attributes: {}, id: "1110", type: "WheelZoomTool" },
        {
          attributes: {
            ticker: {
              id: "1100",
              type: "BasicTicker",
            },
          },
          id: "1103",
          type: "Grid",
        },
        {
          attributes: { source: { id: "1122", type: "ColumnDataSource" } },
          id: "1126",
          type: "CDSView",
        },
        { attributes: {}, id: "1141", type: "UnionRenderers" },
        {
          attributes: {
            overlay: {
              id: "1132",
              type: "BoxAnnotation",
            },
          },
          id: "1111",
          type: "BoxZoomTool",
        },
        { attributes: {}, id: "1112", type: "SaveTool" },
        {
          attributes: { callback: null },
          id: "1093",
          type: "DataRange1d",
        },
        { attributes: {}, id: "1105", type: "BasicTicker" },
        {
          attributes: {
            label: { value: "Trend" },
            renderers: [{ id: "1125", type: "GlyphRenderer" }],
          },
          id: "1134",
          type: "LegendItem",
        },
        { attributes: {}, id: "1095", type: "LinearScale" },
        {
          attributes: {
            axis_label: "y",
            formatter: { id: "1129", type: "BasicTickFormatter" },
            ticker: { id: "1105", type: "BasicTicker" },
          },
          id: "1104",
          type: "LinearAxis",
        },
        {
          attributes: {
            bottom_units: "screen",
            fill_alpha: { value: 0.5 },
            fill_color: { value: "lightgrey" },
            left_units: "screen",
            level: "overlay",
            line_alpha: { value: 1.0 },
            line_color: { value: "black" },
            line_dash: [4, 4],
            line_width: { value: 2 },
            render_mode: "css",
            right_units: "screen",
            top_units: "screen",
          },
          id: "1132",
          type: "BoxAnnotation",
        },
      ],
      root_ids: ["1088"],
    },
    title: "",
    version: "1.4.0",
  },
}

const getProps = (
  elementProps: Partial<BokehChartProto> = {}
): BokehChartProps => ({
  element: BokehChartProto.create({
    figure: JSON.stringify(MOCK_FIGURE),
    useContainerWidth: false,
    elementId: "1",
    ...elementProps,
  }),
  height: 400,
  width: 400,
})

expect.extend({
  toMatchBokehDimensions(data, width, height) {
    const plot =
      data && data.doc && data.doc.roots && data.doc.roots.references
        ? data.doc.roots.references.find((e: any) => e.type === "Plot")
        : undefined

    if (!plot) {
      return {
        message: () => `expected data to contain attributes`,
        pass: false,
      }
    }

    const pass =
      plot.attributes.plot_width === width &&
      plot.attributes.plot_height === height

    return {
      message: () =>
        `expected ${plot.attributes.plot_width}x${plot.attributes.plot_height} to be ${width}x${height}`,
      pass,
    }
  },
})

describe("BokehChart element", () => {
  // Avoid Warning: render(): Rendering components directly into document.body is discouraged.
  let div: HTMLDivElement
  beforeEach(() => {
    div = document.createElement("div")
    document.body.appendChild(div)
  })

  afterEach(() => {
    // @ts-expect-error
    mockBokehEmbed.embed.embed_item.mockClear() // clear so embed item calls don't add up
    document.body.removeChild(div)
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<BokehChart {...props} />)
    const bokehElement = screen.getByTestId("stBokehChart")
    expect(bokehElement).toBeInTheDocument()
    expect(bokehElement).toHaveClass("stBokehChart")
  })

  describe("Chart dimensions", () => {
    it("should use height if not useContainerWidth", () => {
      const props = getProps()
      render(<BokehChart {...props} />)
      expect(mockBokehEmbed.embed.embed_item).toHaveBeenCalledWith(
        // @ts-expect-error
        expect.toMatchBokehDimensions(400, 400),
        "bokeh-chart-1"
      )
    })

    it("should have width if useContainerWidth", () => {
      const props = {
        ...getProps({
          useContainerWidth: true,
        }),
        height: 0,
      }

      render(<BokehChart {...props} />)

      expect(mockBokehEmbed.embed.embed_item).toHaveBeenCalledWith(
        // @ts-expect-error
        expect.toMatchBokehDimensions(400),
        "bokeh-chart-1"
      )
    })
  })

  it("should re-render the chart when the component updates", () => {
    const props = getProps()
    const { rerender } = render(<BokehChart {...props} />)
    rerender(<BokehChart {...props} width={500} height={500} />)
    expect(mockBokehEmbed.embed.embed_item).toHaveBeenCalledTimes(2)
  })
})
