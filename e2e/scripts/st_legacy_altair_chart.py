import streamlit as st
import pandas as pd
import numpy as np
import altair as alt

data = np.random.randn(200, 3)
df = pd.DataFrame(data, columns=["a", "b", "c"])
chart = alt.Chart(df).mark_circle().encode(x="a", y="b", size="c", color="c")
st._legacy_altair_chart(chart)
