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

# Start at #0000001 because people may be likely to use #000000
TEMP_COLOR_0 = "#000001"
TEMP_COLOR_1 = "#000002"
TEMP_COLOR_2 = "#000003"
TEMP_COLOR_3 = "#000004"
TEMP_COLOR_4 = "#000005"
TEMP_COLOR_5 = "#000006"
TEMP_COLOR_6 = "#000007"
TEMP_COLOR_7 = "#000008"
TEMP_COLOR_8 = "#000009"
TEMP_COLOR_9 = "#000010"
TEMP_COLOR_10 = "#000011"
TEMP_COLOR_11 = "#000012"
TEMP_COLOR_12 = "#000013"
TEMP_COLOR_13 = "#000014"
TEMP_COLOR_14 = "#000015"
TEMP_COLOR_15 = "#000016"
TEMP_COLOR_16 = "#000017"
TEMP_COLOR_17 = "#000018"
TEMP_COLOR_18 = "#000019"
TEMP_COLOR_19 = "#000020"

pio.templates["streamlit"] = go.layout.Template(
    data=pio.templates["plotly"].data,
    layout=go.Layout(
        colorway=[
            "#000001",
            "#000002",
            "#000003",
            "#000004",
            "#000005",
            "#000006",
            "#000007",
            "#000008",
            "#000009",
            "#000010",
        ],
        colorscale=go.layout.Colorscale(
            sequential=[
                [0.0, "#000011"],
                [0.1111111111111111, "#000012"],
                [0.2222222222222222, "#000013"],
                [0.3333333333333333, "#000014"],
                [0.4444444444444444, "#000015"],
                [0.5555555555555556, "#000016"],
                [0.6666666666666666, "#000017"],
                [0.7777777777777778, "#000018"],
                [0.8888888888888888, "#000019"],
                [1.0, "#000020"],
            ],
            sequentialminus=[
                [0.0, "#000011"],
                [0.1111111111111111, "#000012"],
                [0.2222222222222222, "#000013"],
                [0.3333333333333333, "#000014"],
                [0.4444444444444444, "#000015"],
                [0.5555555555555556, "#000016"],
                [0.6666666666666666, "#000017"],
                [0.7777777777777778, "#000018"],
                [0.8888888888888888, "#000019"],
                [1.0, "#000020"],
            ],
            # this is not really used but here just in case.
            diverging=[
                [0.0, "#000011"],
                [0.1111111111111111, "#000012"],
                [0.2222222222222222, "#000013"],
                [0.3333333333333333, "#000014"],
                [0.4444444444444444, "#000015"],
                [0.5555555555555556, "#000016"],
                [0.6666666666666666, "#000017"],
                [0.7777777777777778, "#000018"],
                [0.8888888888888888, "#000019"],
                [1.0, "#000020"],
            ],
        ),
        coloraxis=go.layout.Coloraxis(
            colorscale=[
                [0.0, "#000011"],
                [0.1111111111111111, "#000012"],
                [0.2222222222222222, "#000013"],
                [0.3333333333333333, "#000014"],
                [0.4444444444444444, "#000015"],
                [0.5555555555555556, "#000016"],
                [0.6666666666666666, "#000017"],
                [0.7777777777777778, "#000018"],
                [0.8888888888888888, "#000019"],
                [1.0, "#000020"],
            ]
        ),
    ),
)
