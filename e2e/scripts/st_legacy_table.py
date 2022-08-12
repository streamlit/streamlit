import streamlit as st
import pandas as pd
import numpy as np

grid = np.arange(0, 100, 1).reshape(10, 10)
df = pd.DataFrame(grid)
st._legacy_table(df)
