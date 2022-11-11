# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import plotly.graph_objects as go
import plotly.io as pio

# This is the streamlit theme for plotly where we pass in a template.data
# and a template.layout.

# Template.data is for changing specific graph properties in a general aspect
# such as Contour plots or Waterfall plots.

# Template.layout is for changing things such as the x axis and fonts and other
# general layout properties for general graphs.

# We pass in temporary colors to the frontend and the frontend will replace
# those colors because we want to change colors based on the background color.

# Start at #0000001 because developers may be likely to use #000000
CATEGORY_0 = "#000001"
CATEGORY_1 = "#000002"
CATEGORY_2 = "#000003"
CATEGORY_3 = "#000004"
CATEGORY_4 = "#000005"
CATEGORY_5 = "#000006"
CATEGORY_6 = "#000007"
CATEGORY_7 = "#000008"
CATEGORY_8 = "#000009"
CATEGORY_9 = "#000010"

SEQUENTIAL_10 = "#000011"
SEQUENTIAL_11 = "#000012"
SEQUENTIAL_12 = "#000013"
SEQUENTIAL_13 = "#000014"
SEQUENTIAL_14 = "#000015"
SEQUENTIAL_15 = "#000016"
SEQUENTIAL_16 = "#000017"
SEQUENTIAL_17 = "#000018"
SEQUENTIAL_18 = "#000019"
SEQUENTIAL_19 = "#000020"

DIVERGING_20 = "#000021"
DIVERGING_21 = "#000022"
DIVERGING_22 = "#000023"
DIVERGING_23 = "#000024"
DIVERGING_24 = "#000025"
DIVERGING_25 = "#000026"
DIVERGING_26 = "#000027"
DIVERGING_27 = "#000028"
DIVERGING_28 = "#000029"
DIVERGING_29 = "#000030"
DIVERGING_30 = "#000031"

INCREASING_31 = "#000032"
DECREASING_32 = "#000033"
TOTAL_33 = "#000034"

GRAY_30_34 = "#000035"
GRAY_70_35 = "#000036"
GRAY_90_36 = "#000037"
BG_COLOR_37 = "#000038"
FADED_TEXT_05_38 = "#000039"
BG_MIX_39 = "#000040"

BODY_FONT = '"Source Sans Pro", sans-serif'


# Plotly represents continuous colorscale through an array of pairs.
# The pair's first index is the starting point and the next pair's first index is the end point.
# The pair's second index is the starting color and the next pair's second index is the end color.
# For more information, please refer to https://plotly.com/python/colorscales/

streamlit_colorscale = [
    [0.0, SEQUENTIAL_10],
    [0.1111111111111111, SEQUENTIAL_11],
    [0.2222222222222222, SEQUENTIAL_12],
    [0.3333333333333333, SEQUENTIAL_13],
    [0.4444444444444444, SEQUENTIAL_14],
    [0.5555555555555556, SEQUENTIAL_15],
    [0.6666666666666666, SEQUENTIAL_16],
    [0.7777777777777778, SEQUENTIAL_17],
    [0.8888888888888888, SEQUENTIAL_18],
    [1.0, SEQUENTIAL_19],
]

pio.templates["streamlit"] = go.layout.Template(
    data=go.layout.template.Data(
        contour=[go.layout.template.data.Contour(colorscale=streamlit_colorscale)],
        contourcarpet=[
            go.layout.template.data.Contourcarpet(colorscale=streamlit_colorscale)
        ],
        candlestick=[
            go.layout.template.data.Candlestick(
                decreasing=go.candlestick.Decreasing(
                    line=go.candlestick.decreasing.Line(color=DECREASING_32)
                ),
                increasing=go.candlestick.Increasing(
                    line=go.candlestick.increasing.Line(color=INCREASING_31)
                ),
            )
        ],
        waterfall=[
            go.layout.template.data.Waterfall(
                increasing=go.waterfall.Increasing(
                    marker=go.waterfall.increasing.Marker(color=INCREASING_31)
                ),
                decreasing=go.waterfall.Decreasing(
                    marker=go.waterfall.decreasing.Marker(color=DECREASING_32)
                ),
                totals=go.waterfall.Totals(
                    marker=go.waterfall.totals.Marker(color=TOTAL_33)
                ),
                connector=go.waterfall.Connector(
                    line=go.waterfall.connector.Line(color=GRAY_70_35, width=2)
                ),
            )
        ],
        table=[
            go.layout.template.data.Table(
                cells=go.table.Cells(
                    fill=go.table.cells.Fill(color=BG_COLOR_37),
                    font=go.table.cells.Font(family=BODY_FONT, color=GRAY_90_36),
                    line=go.table.cells.Line(color=FADED_TEXT_05_38),
                ),
                header=go.table.Header(
                    font=go.table.header.Font(family=BODY_FONT, color=GRAY_70_35),
                    line=go.table.header.Line(color=FADED_TEXT_05_38),
                    fill=go.table.header.Fill(color=BG_MIX_39),
                ),
            )
        ],
    ),
    layout=go.Layout(
        colorway=[
            CATEGORY_0,
            CATEGORY_1,
            CATEGORY_2,
            CATEGORY_3,
            CATEGORY_4,
            CATEGORY_5,
            CATEGORY_6,
            CATEGORY_7,
            CATEGORY_8,
            CATEGORY_9,
        ],
        colorscale=go.layout.Colorscale(
            sequential=streamlit_colorscale,
            sequentialminus=streamlit_colorscale,
            diverging=[
                [0.0, DIVERGING_20],
                [0.1, DIVERGING_21],
                [0.2, DIVERGING_22],
                [0.3, DIVERGING_23],
                [0.4, DIVERGING_24],
                [0.5, DIVERGING_25],
                [0.6, DIVERGING_26],
                [0.7, DIVERGING_27],
                [0.8, DIVERGING_28],
                [0.9, DIVERGING_29],
                [1.0, DIVERGING_30],
            ],
        ),
        coloraxis=go.layout.Coloraxis(colorscale=streamlit_colorscale),
    ),
)
