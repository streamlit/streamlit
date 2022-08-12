from typing import Any, cast

import streamlit as st
import pandas as pd
import numpy as np

# Empty map.

st.map()

# Simple map.

# Cast is needed due to mypy not understanding the outcome of dividing
# an array by a list of numbers.
coords: "np.typing.NDArray[np.float_]" = cast(
    Any,
    np.random.randn(1000, 2) / [50, 50],
) + [37.76, -122.4]
df = pd.DataFrame(coords, columns=["lat", "lon"])

st.map(df)

# Same but with custom zoom level:

st.map(df, zoom=8)
