# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from __future__ import annotations

import random
from typing import TYPE_CHECKING, Any

import numpy as np
import pandas as pd

import streamlit as st
from shared.data_mocks import (
    BASE_TYPES_DF,
    DATETIME_TYPES_DF,
    INTERVAL_TYPES_DF,
    LIST_TYPES_DF,
    NUMBER_TYPES_DF,
    PERIOD_TYPES_DF,
    SPECIAL_TYPES_DF,
    UNSUPPORTED_TYPES_DF,
)

if TYPE_CHECKING:
    from pandas.io.formats.style import Styler

np.random.seed(0)
random.seed(0)

st.set_page_config(layout="wide")

st.header("Empty tables")
st.table()
st.table([])
st.table(np.array(0))
st.table(pd.DataFrame([]))
st.table(np.array([]))
st.table(pd.DataFrame({"lat": [], "lon": []}))

st.header("Column types")

st.subheader("Base types")
st.table(BASE_TYPES_DF)

st.subheader("Number types")
st.table(NUMBER_TYPES_DF)

st.subheader("Date, time and datetime types")
st.table(DATETIME_TYPES_DF)

st.subheader("List types")
st.table(LIST_TYPES_DF)

st.subheader("Interval dtypes in pd.DataFrame")
st.table(INTERVAL_TYPES_DF)

st.subheader("Period dtypes in pd.DataFrame")
st.table(PERIOD_TYPES_DF)

st.subheader("Special types")
st.table(SPECIAL_TYPES_DF)

st.subheader("Unsupported types (by Arrow)")
st.table(UNSUPPORTED_TYPES_DF)

st.header("Index types")

st.subheader("String Index (pd.Index)")
st.table(BASE_TYPES_DF.set_index("string"))

st.subheader("Float64 Index (pd.Float64Index)")
st.table(NUMBER_TYPES_DF.set_index("float64"))

st.subheader("Int64 Index (pd.Int64Index)")
st.table(NUMBER_TYPES_DF.set_index("int64"))

st.subheader("Uint64 Index (pd.UInt64Index)")
st.table(NUMBER_TYPES_DF.set_index("uint64"))

st.subheader("Datetime Index (pd.DatetimeIndex)")
st.table(DATETIME_TYPES_DF.set_index("datetime"))

st.subheader("Date Index (pd.Index)")
st.table(DATETIME_TYPES_DF.set_index("date"))

st.subheader("Time Index (pd.Index)")
st.table(DATETIME_TYPES_DF.set_index("time"))

st.subheader("Interval Index (pd.IntervalIndex)")
st.table(INTERVAL_TYPES_DF.set_index("int64_both"))

st.subheader("List Index (pd.Index)")
st.table(LIST_TYPES_DF.set_index("string_list"))

st.subheader("Multi Index (pd.MultiIndex)")
st.table(BASE_TYPES_DF.set_index(["string", "int64"]))

st.subheader("Categorical Index (pd.CategoricalIndex)")
st.table(SPECIAL_TYPES_DF.set_index("categorical"))

st.subheader("Period Index (pd.PeriodIndex)")
st.table(PERIOD_TYPES_DF.set_index("D"))

st.subheader("Timedelta Index (pd.TimedeltaIndex)")
st.table(SPECIAL_TYPES_DF.set_index("timedelta"))

st.header("Pandas Styler Support")

st.subheader("Pandas Styler: Value formatting")
df = pd.DataFrame({"test": [3.1423424, 3.1]})
st.table(df.style.format({"test": "{:.2f}"}))

st.subheader("Pandas Styler: Background color")


def highlight_first(value: float) -> str:
    return "background-color: yellow" if value == 0 else ""


df = pd.DataFrame(np.arange(0, 100, 1).reshape(10, 10))
st.table(df.style.map(highlight_first))

st.subheader("Pandas Styler: Background and font styling")

df = pd.DataFrame(np.random.randn(10, 4), columns=["A", "B", "C", "D"])


def style_negative(v: float, props: str) -> str | None:
    return props if v < 0 else None


def highlight_max(s: Any, props: str = "") -> np.ndarray:
    return np.where(s == np.nanmax(s.values), props, "")


# Passing style values w/ all color formats to test css-style-string parsing robustness.
styled_df = df.style.map(style_negative, props="color:#FF0000;").map(
    lambda v: "opacity: 20%;" if (v < 0.3) and (v > -0.3) else None
)

styled_df.apply(
    highlight_max, props="color:white;background-color:rgb(255, 0, 0)", axis=0
)

styled_df.apply(
    highlight_max, props="color:white;background-color:hsl(273, 98%, 60%);", axis=1
).apply(highlight_max, props="color:white;background-color:purple", axis=None)

st.table(styled_df)

st.subheader("Pandas Styler: Gradient Styling + Caption")

weather_df = pd.DataFrame(
    np.random.rand(10, 2) * 5,
    index=pd.date_range(start="2021-01-01", periods=10),
    columns=["Tokyo", "Beijing"],
)


def rain_condition(v: float) -> str:
    if v < 1.75:
        return "Dry"
    if v < 2.75:
        return "Rain"
    return "Heavy Rain"


def make_pretty(styler: Styler) -> Styler:
    styler.set_caption("Weather Conditions")
    styler.format(rain_condition)
    styler.background_gradient(axis=None, vmin=1, vmax=5, cmap="YlGnBu")
    return styler


styled_df = weather_df.style.pipe(make_pretty)

st.table(styled_df)

# Advanced styling example with styled headers, hovering and caption:
df = pd.DataFrame(
    [[38.0, 2.0, 18.0, 22.0, 21, np.nan], [19, 439, 6, 452, 226, 232]],
    index=pd.Index(
        ["Tumour (Positive)", "Non-Tumour (Negative)"], name="Actual Label:"
    ),
    columns=pd.MultiIndex.from_product(
        [["Decision Tree", "Regression", "Random"], ["Tumour", "Non-Tumour"]],
        names=["Model:", "Predicted:"],
    ),
)
styled_df = df.style

# Apply formatting
styled_df.format("{:.0f}").hide(
    [("Random", "Tumour"), ("Random", "Non-Tumour")], axis="columns"
)

cell_hover = {  # for row hover use <tr> instead of <td>
    "selector": "td:hover",
    "props": [("background-color", "#ffffb3")],
}
headers = {
    "selector": "th",
    "props": "background-color: #000066; color: white;",
}
styled_df.set_table_styles([cell_hover, headers])
styled_df.set_table_styles(
    {
        ("Regression", "Tumour"): [
            {"selector": "th", "props": "border-left: 1px solid white"},
            {"selector": "td", "props": "border-left: 1px solid #000066"},
        ]
    },
    overwrite=False,
    axis=0,
)
styled_df.set_caption("Confusion matrix for multiple cancer prediction models.")

tt = pd.DataFrame(
    [
        [
            "This model has a very strong true positive rate",
            "This model's total number of false negatives is too high",
        ]
    ],
    index=["Tumour (Positive)"],
    columns=df.columns[[0, 3]],
)
styled_df.set_tooltips(
    tt,
    props="visibility: hidden; position: absolute; z-index: 1; border: 1px solid #000066;"
    "background-color: white; color: #000066; font-size: 0.8em;"
    "transform: translate(0px, -24px); padding: 0.6em; border-radius: 0.5em;",
)

st.table(styled_df)


st.header("Markdown Support")
index = pd.Index(
    [
        ":material/check_circle: Row 1",
        ":streamlit: Row 2",
        "**Bold** Row 3",
        "*Italic* Row 4",
        "~Strikethrough~ Row 5",
        "`Code Block` Row 6",
    ]
)

data = pd.DataFrame(
    {
        "**Basic** Formatting": [
            "**Bold** text",
            "*Italic* text",
            "~Strikethrough~ text",
            "`Code Block` text",
            "# Heading 1",
            "> This is a blockquote",
        ],
        "*Advanced* Features": [
            ":red[Red text] :red-background[Red background]",
            "[Streamlit](https://streamlit.io)",
            "![Image](app/static/cat.jpg)",
            "| Table | Row |\n|---|---|\n| Cell | Cell |",
            "```python\ndef code():\n    pass\n```",
            "<- -> <-> -- >= <= ~=",
        ],
    },
    index=index,
)

st.table(data)
