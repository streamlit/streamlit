import streamlit as st
import pandas as pd
import numpy as np


def highlight_first(value):
    color = "yellow" if value == 0 else "white"
    return "background-color: %s" % color


grid = np.arange(0, 100, 1).reshape(10, 10)
df = pd.DataFrame(grid)
st._legacy_dataframe(df.style.applymap(highlight_first))
