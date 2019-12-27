import streamlit as st
import pandas as pd
import numpy as np

# TODO:
# 1. clean up this file
# 2. create tests using the examples below

# grid = [["a", "b", "c"], ["d", "e", "f"]]
# grid = [[9223372036854775807, "b", "c"], [2, "e", "f"]]
# grid = [[1, 2], [9223372036854775807, 0]]
# grid = [[1, 2], [18446744073709551615, 0]]
grid = np.arange(0, 6, 1).reshape(2, 3)

# df = pd.DataFrame(grid, index=[["aa", "bb"], ["cc", "dd"], ["ee", "ff"]], columns=["a", "b", "c"])
# df = pd.DataFrame(grid, index=["r1", "r2"], columns=["c1", "c2", "c3"])
# df = pd.DataFrame(grid)

df = pd.DataFrame(
    grid,
    index=[[50, 51], ["r1", "r2"]],
    columns=[[100, 101, 102], ["c1", "c2", "c3"], [True, False, True]],
)

# df = pd.DataFrame(
#     {
#         "one": [1, 1.5, 2],
#         # "two": ["january", "february", "march"],
#         # "three": [True, False, True],
#     },
#     index=list("abc"),
# )


def color_negative_red(val):
    """
    Takes a scalar and returns a string with
    the css property `'color: red'` for negative
    strings, black otherwise.
    """
    color = "red" if val == 2 or val == 4 else "black"
    return "color: %s" % color


custom_styles = [
    {
        "selector": ".blank",
        "props": [("background-color", "red"), ("background-color", "yellow"),],
    }
]

# df = df.style.applymap(color_negative_red)
# df = df.style.highlight_max(color="yellow", axis=None)
df = (
    df.style.applymap(color_negative_red)
    .format("{:.2%}")
    .set_table_styles(custom_styles)
    .set_caption("The caption")
)

# st.title("Table")
# st.table(df)

st.title("Arrow Table")
st.arrow_table(df)
