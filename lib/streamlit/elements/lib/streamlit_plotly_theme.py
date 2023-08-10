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
CATEGORIES = ["#00000{}".format(i + 1) for i in range(9)]
SEQUENTIAL = ["#00001{}".format(i) for i in range(9) + "000020"]
DIVERGING = ["#00002{}".format(i) for i in range(1, 10)] + ["#000030", "000031"]

# Others
INCREASING, DECREASING, TOTAL = "#000032", "#000033", "#000034"
GRAY_30, GRAY_70, GRAY_90, BG_COLOR, FADED_TEXT_05, BG_MIX = (
    "#000035",
    "#000036",
    "#000037",
    "#000038",
    "#000039",
    "#000040",
)


# Plotly represents continuous colorscale through an array of pairs.
# The pair's first index is the starting point and the next pair's first index is the end point.
# The pair's second index is the starting color and the next pair's second index is the end color.
# For more information, please refer to https://plotly.com/python/colorscales/

streamlit_colorscale = [[i / 8, SEQUENTIAL[i]] for i in range(9)]

pio.templates["streamlit"] = go.layout.Template(
    data=go.layout.template.Data(
        candlestick=[
            go.layout.template.data.Candlestick(
                decreasing=go.candlestick.Decreasing(
                    line=go.candlestick.decreasing.Line(color=DECREASING)
                ),
                increasing=go.candlestick.Increasing(
                    line=go.candlestick.increasing.Line(color=INCREASING)
                ),
            )
        ],
        contour=[go.layout.template.data.Contour(colorscale=streamlit_colorscale)],
        contourcarpet=[
            go.layout.template.data.Contourcarpet(colorscale=streamlit_colorscale)
        ],
        heatmap=[go.layout.template.data.Heatmap(colorscale=streamlit_colorscale)],
        histogram2d=[
            go.layout.template.data.Histogram2d(colorscale=streamlit_colorscale)
        ],
        icicle=[
            go.layout.template.data.Icicle(textfont=go.icicle.Textfont(color="white"))
        ],
        sankey=[
            go.layout.template.data.Sankey(textfont=go.sankey.Textfont(color=GRAY_70))
        ],
        scatter=[
            go.layout.template.data.Scatter(
                marker=go.scatter.Marker(line=go.scatter.marker.Line(width=0))
            )
        ],
        table=[
            go.layout.template.data.Table(
                cells=go.table.Cells(
                    fill=go.table.cells.Fill(color=BG_COLOR),
                    font=go.table.cells.Font(color=GRAY_90),
                    line=go.table.cells.Line(color=FADED_TEXT_05),
                ),
                header=go.table.Header(
                    font=go.table.header.Font(color=GRAY_70),
                    line=go.table.header.Line(color=FADED_TEXT_05),
                    fill=go.table.header.Fill(color=BG_MIX),
                ),
            )
        ],
        waterfall=[
            go.layout.template.data.Waterfall(
                increasing=go.waterfall.Increasing(
                    marker=go.waterfall.increasing.Marker(color=INCREASING)
                ),
                decreasing=go.waterfall.Decreasing(
                    marker=go.waterfall.decreasing.Marker(color=DECREASING)
                ),
                totals=go.waterfall.Totals(
                    marker=go.waterfall.totals.Marker(color=TOTAL)
                ),
                connector=go.waterfall.Connector(
                    line=go.waterfall.connector.Line(color=GRAY_70, width=2)
                ),
            )
        ],
    ),
    layout=go.Layout(
        colorway=CATEGORIES,
        colorscale=go.layout.Colorscale(
            sequential=streamlit_colorscale,
            sequentialminus=streamlit_colorscale,
            diverging=[[i / 10, DIVERGING[i]] for i in range(11)],
        ),
        coloraxis=go.layout.Coloraxis(colorscale=streamlit_colorscale),
    ),
)
