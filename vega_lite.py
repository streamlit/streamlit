import streamlit as st
import pandas as pd
import numpy as np

# import plost


# GROUPED BAR CHART:

grouped_bar_spec = {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "title": f"Static Bar Chart Example",
    "description": "A simple bar chart with embedded data.",
    "data": {
        "values": [
            {"a": "A", "b": 28},
            {"a": "B", "b": 55},
            {"a": "C", "b": 43},
            {"a": "D", "b": 91},
            {"a": "E", "b": 81},
            {"a": "F", "b": 53},
            {"a": "G", "b": 19},
            {"a": "H", "b": 87},
            {"a": "I", "b": 52},
        ]
    },
    "mark": "bar",
    "encoding": {
        "x": {"field": "a", "type": "nominal", "axis": {"labelAngle": 0}},
        "y": {"field": "b", "type": "quantitative"},
    },
}

# st.vega_lite_chart(grouped_bar_spec, None, use_container_width=True)

# Interactive BAR CHART:

control = st.number_input("Control Spec", step=1, min_value=20, max_value=30)

bar_spec = {
    "title": f"Interactive Bar Chart Example",
    "data": {
        "values": [
            {"a": "A", "b": control},
            {"a": "B", "b": 55},
            {"a": "C", "b": 43},
            {"a": "D", "b": 91},
            {"a": "E", "b": 81},
            {"a": "F", "b": 53},
            {"a": "G", "b": 19},
            {"a": "H", "b": 87},
            {"a": "I", "b": 52},
        ]
    },
    "params": [
        {"name": "highlight", "select": {"type": "point", "on": "mouseover"}},
        {"name": "select", "select": "point"},
    ],
    "mark": {"type": "bar", "fill": "#4C78A8", "stroke": "black", "cursor": "pointer"},
    "encoding": {
        "x": {"field": "a", "type": "ordinal"},
        "y": {"field": "b", "type": "quantitative"},
        "fillOpacity": {"condition": {"param": "select", "value": 1}, "value": 0.3},
        "strokeWidth": {
            "condition": [
                {"param": "select", "empty": False, "value": 2},
                {"param": "highlight", "empty": False, "value": 1},
            ],
            "value": 0,
        },
    },
    "config": {"scale": {"bandPaddingInner": 0.2}},
}

st.vega_lite_chart(bar_spec, None, use_container_width=True)

# # HORIZONTAL BAR CHART:

# horizontal_bar_spec = {
#   "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
#   "title": f"Horizontal Bar Chart Example",
#   "data": {"url": "https://vega.github.io/vega-datasets/data/barley.json"},
#   "mark": "bar",
#   "encoding": {
#     "x": {"aggregate": "sum", "field": "yield"},
#     "y": {"field": "variety"},
#     "color": {"field": "site"}
#   }
# }

# st.vega_lite_chart(horizontal_bar_spec, None, use_container_width=True)

# # Histogram Heatmap:

# histogram_heatmap_spec = {
#   "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
#   "title": f"Histogram Heatmap Example",
#   "data": {"url": "https://vega.github.io/vega-datasets/data/movies.json"},
#   "transform": [{
#     "filter": {"and": [
#       {"field": "IMDB Rating", "valid": True},
#       {"field": "Rotten Tomatoes Rating", "valid": True}
#     ]}
#   }],
#   "mark": "rect",
#   "width": 700,
#   "height": 400,
#   "encoding": {
#     "x": {
#       "bin": {"maxbins":60},
#       "field": "IMDB Rating",
#       "type": "quantitative"
#     },
#     "y": {
#       "bin": {"maxbins": 40},
#       "field": "Rotten Tomatoes Rating",
#       "type": "quantitative"
#     },
#     "color": {
#       "aggregate": "count",
#       "type": "quantitative"
#     }
#   },
#   "config": {
#     "view": {
#       "stroke": "transparent"
#     }
#   }
# }

# st.vega_lite_chart(histogram_heatmap_spec, None, use_container_width=True)


# Colored Scatter Example:

colored_scatter_spec = {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "description": "A scatterplot showing body mass and flipper lengths of penguins.",
    "title": f"Static Scatter Chart Example",
    "data": {"url": "https://vega.github.io/vega-datasets/data/penguins.json"},
    "mark": "point",
    "encoding": {
        "x": {
            "field": "Flipper Length (mm)",
            "type": "quantitative",
            "scale": {"zero": False},
        },
        "y": {
            "field": "Body Mass (g)",
            "type": "quantitative",
            "scale": {"zero": False},
        },
        "color": {"field": "Species", "type": "nominal"},
        "shape": {"field": "Species", "type": "nominal"},
    },
}

# st.vega_lite_chart(colored_scatter_spec, None, use_container_width=True)


# Interactive Scatter Plot Example

interactive_scatter_spec = {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "description": "Drag the sliders to highlight points.",
    "title": f"Interactive Scatter Chart Example",
    "data": {"url": "https://vega.github.io/vega-datasets/data/cars.json"},
    "transform": [{"calculate": "year(datum.Year)", "as": "Year"}],
    "layer": [
        {
            "params": [
                {
                    "name": "CylYr",
                    "value": [{"Cylinders": 4, "Year": 1977}],
                    "select": {"type": "point", "fields": ["Cylinders", "Year"]},
                    "bind": {
                        "Cylinders": {"input": "range", "min": 3, "max": 8, "step": 1},
                        "Year": {"input": "range", "min": 1969, "max": 1981, "step": 1},
                    },
                }
            ],
            "mark": "circle",
            "encoding": {
                "x": {"field": "Horsepower", "type": "quantitative"},
                "y": {"field": "Miles_per_Gallon", "type": "quantitative"},
                "color": {
                    "condition": {
                        "param": "CylYr",
                        "field": "Origin",
                        "type": "nominal",
                    },
                    "value": "grey",
                },
            },
        },
        {
            "transform": [{"filter": {"param": "CylYr"}}],
            "mark": "circle",
            "encoding": {
                "x": {"field": "Horsepower", "type": "quantitative"},
                "y": {"field": "Miles_per_Gallon", "type": "quantitative"},
                "color": {"field": "Origin", "type": "nominal"},
                "size": {"value": 100},
            },
        },
    ],
}

# st.vega_lite_chart(interactive_scatter_spec, None, use_container_width=True)

# with st.sidebar:
#     st.write("Sidebar")

# Testing:

# // Not an append if # of columns don't match
# const testCase1 = [[
#   {"a": "A", "b": 28, "c": 0}, {"a": "B", "b": 55, "c": 0}, {"a": "C", "b": 43, "c": 0},
# ],[
#   {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
#   {"a": "D", "b": 91},
# ]]

# // Not an append if prev # rows = current # rows
# const testCase2 = [[
#   {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
# ],[
#   {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
# ]]

# // Not an append if prev # rows > current # rows
# const testCase3 = [[
#   {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
# ],[
#   {"a": "A", "b": 28}, {"a": "B", "b": 55},
# ]]

# // Not an append if prev # rows == 0
# const testCase4 = [
#   [],
#   [{"a": "A", "b": 28}, {"a": "B", "b": 55},],
# ]

# // Test light check of prev vs. new's last col, first and last row
# const testCase5 = [[
#   {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
# ],[
#   {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 12},
#   {"a": "D", "b": 91},
# ]]

# const testCase6 = [[
#   {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
# ],[
#   {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
#   {"a": "D", "b": 91},
# ]]


# it("tests for appended data properly", () => {
#   const cases = [ testCase1, testCase2, testCase3, testCase4, testCase5, testCase6 ]
#   const expectedVals = [false, false, false, false, false, true]

#   cases.forEach( (test, idx) => {
#     const expected = expectedVals[idx]
#     const prevData = test[0]
#     const prevNumRows = prevData.length
#     const prevNumCols = prevData[0] ? Object.keys(prevData[0]).length : 0
#     const data = test[1]
#     const numRows = data.length
#     const numCols = data[0] ? Object.keys(data[0]).length : 0

#     expect(dataIsAnAppendOfPrev(prevData, prevNumRows, prevNumCols, data, numRows, numCols)).toEqual(expected)
#   })
# })


#   // Not an append if # of columns don't match
# // const testCase1 = [[
# //   {"a": "A", "b": 28, "c": 0}, {"a": "B", "b": 55, "c": 0}, {"a": "C", "b": 43, "c": 0},
# // ],[
# //   {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
# //   {"a": "D", "b": 91},
# // ]]

# // // Not an append if prev # rows = current # rows
# // const testCase2 = [[
# //   {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
# // ],[
# //   {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
# // ]]

# // // Not an append if prev # rows > current # rows
# // const testCase3 = [[
# //   {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
# // ],[
# //   {"a": "A", "b": 28}, {"a": "B", "b": 55},
# // ]]

# // // Not an append if prev # rows == 0
# // const testCase4 = [
# //   [],
# //   [{"a": "A", "b": 28}, {"a": "B", "b": 55},],
# // ]

# // // Test light check of prev vs. new's last col, first and last row
# // const testCase5 = [[
# //   {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
# // ],[
# //   {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 12},
# // ]]

# // // Is an append
# // const testCase6 = [[
# //   {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
# // ],[
# //   {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
# //   {"a": "D", "b": 91},
# // ]]
