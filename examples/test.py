import sys

import streamlit as st

MAX_INT64 = int((1 << 63) - 1)
MIN_INT64 = int(-MAX_INT64)

MAX_INT54 = int((1 << 53) - 1)
MIN_INT54 = int(-MAX_INT54)

MAX_FLOAT = sys.float_info.max
# MAX_FLOAT = 9e+296
MIN_FLOAT = -MAX_FLOAT
# MAX_FLOAT = float(MAX_INT)

value = st.slider("Slider: int54", min_value=MIN_INT54, max_value=MAX_INT54)
st.write(f"[value={value}, min={MIN_INT54}, max={MAX_INT54}]")

value = st.slider("Slider: int64", min_value=MIN_INT64, max_value=MAX_INT64)
st.write(f"[value={value}, min={MIN_INT64}, max={MAX_INT64}]")

value = st.slider("Slider: float", min_value=MIN_FLOAT, max_value=MAX_FLOAT)
st.write(f"[value={value}, min={MIN_FLOAT}, max={MAX_FLOAT}]")

value = st.number_input("Input: int54", min_value=MIN_INT54, max_value=MAX_INT54 + 10)
st.write(f"[value={value}, min={MIN_INT54}, max={MAX_INT54}]")

value = st.number_input("Input: int64", min_value=MIN_INT64, max_value=MAX_INT64)
st.write(f"[value={value}, min={MIN_INT64}, max={MAX_INT64}]")

value = st.number_input("Input: float", min_value=MIN_FLOAT, max_value=MAX_FLOAT)
st.write(f"[value={value}, min={MIN_FLOAT}, max={MAX_FLOAT}]")
