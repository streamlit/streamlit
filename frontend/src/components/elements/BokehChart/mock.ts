/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Serialized BokehChart data for testing purposes
export default {
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
