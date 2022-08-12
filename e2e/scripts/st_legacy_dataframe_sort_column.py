from typing import Any, cast

import numpy as np
import pandas as pd
import streamlit as st

cols = st.number_input("Number of columns", value=5)
df = pd.DataFrame(
    np.random.randint(
        0,
        10,
        # Cast is needed due to faulty typing from numpy
        size=cast(Any, (10, cols)),
    )
)
st._legacy_dataframe(df)
