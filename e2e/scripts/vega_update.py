import streamlit as st
import numpy as np
import time

arr = np.sin(np.arange(0, 100, 0.1))
chart = st.line_chart([0.0])

N = 100
for i in range(0, len(arr), N):     # Chunk the data
    chart.add_rows(arr[i : i + N])  # Append chunks
    time.sleep(0.1)                 # Fake computation, so we can see the add_rows animate :)
