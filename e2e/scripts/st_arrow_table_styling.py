# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Adapted from https://pandas.pydata.org/pandas-docs/stable/user_guide/style.html
"""

import numpy as np
import pandas as pd

import streamlit as st


def color_negative_red(val):
    """
    Takes a scalar and returns a string with
    the css property `'color: red'` for negative
    strings, black otherwise.
    """
    color = "red" if val < 0 else "black"
    return "color: %s" % color


def highlight_max(data, color="yellow"):
    """highlight the maximum in a Series or DataFrame"""
    attr = "background-color: {}".format(color)
    if data.ndim == 1:  # Series from .apply(axis=0) or axis=1
        is_max = data == data.max()
        return [attr if v else "" for v in is_max]
    else:  # from .apply(axis=None)
        is_max = data == data.max().max()
        return pd.DataFrame(
            np.where(is_max, attr, ""), index=data.index, columns=data.columns
        )


# Create a table to be styled in various ways
np.random.seed(24)
df = pd.DataFrame({"A": np.linspace(1, 5, 5)})
df = pd.concat([df, pd.DataFrame(np.random.randn(5, 4), columns=list("BCDE"))], axis=1)
df.iloc[0, 2] = np.nan

# Unstyled
st._arrow_table(df)

# Custom formatting
st._arrow_table(df.style.format("{:.2%}"))

# Colors
st._arrow_table(
    df.style.applymap(color_negative_red).apply(
        highlight_max, color="darkorange", axis=0
    )
)

# Add rows throws an exception when the dataframe has a styler
x = st._arrow_table(
    df.style.set_properties(**{"background-color": "black", "color": "lawngreen"})
)
x._arrow_add_rows(
    pd.DataFrame(np.random.randn(3, 5)).style.set_properties(
        **{"background-color": "lawngreen", "color": "black"}
    )
)
