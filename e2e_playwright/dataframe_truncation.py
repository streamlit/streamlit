import numpy as np
import pandas as pd

import streamlit as st

# create a random dataframe
df = pd.DataFrame(np.random.randn(50000, 20), columns=("col %d" % i for i in range(20)))
st.dataframe(df)
