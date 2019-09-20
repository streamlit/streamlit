import streamlit as st
import pandas as pd
import random
import time
import numpy as np

df = pd.DataFrame({
    "a": [random.uniform(1, 3), random.uniform(1, 3), random.uniform(1, 3)],
    "b": [random.uniform(0, 30), random.uniform(0, 30), random.uniform(0, 30)],
    "c": [random.uniform(-100, 200), random.uniform(-100, 200),
          random.uniform(-100, 200)]
})
bar_df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])


chart = st.line_chart(df)
chart2 = st.area_chart(df)
bar_chart = st.bar_chart(df)

empty_data = pd.DataFrame({"a": [], "b": []})

empty_data

new_test = st.line_chart(empty_data)

for i in range(10):
    time.sleep(0.5)
    row = {
        "a": [random.uniform(1, 3), random.uniform(1, 3),
              random.uniform(1, 3)],
        "b": [random.uniform(0, 30), random.uniform(0, 30),
              random.uniform(0, 30)],
        "c": [random.uniform(-100, 200), random.uniform(-100, 200),
              random.uniform(-100, 200)]
    }
    chart.add_rows(row)
    chart2.add_rows(row)
    bar_chart.add_rows(row)
    new_test.add_rows({"a": np.random.randn(1), "b": np.random.randn(1)})


# for i in range(10):

