import time

import pandas as pd
import streamlit as st


current_time = pd.to_datetime("08:00:00 2021-01-01", utc=True)
simulation_step = pd.Timedelta(seconds=10)

df1 = pd.DataFrame(data=[[current_time, 1]], columns=["t", "y"]).set_index("t")
line_chart = st._arrow_line_chart(df1, use_container_width=True)

for count in range(5):
    current_time += simulation_step

    df2 = pd.DataFrame(data=[[current_time, count]], columns=["t", "y"]).set_index("t")
    line_chart._arrow_add_rows(df2)
    time.sleep(1)
