# Don't merge this

from typing import List

import streamlit as st


@st.experimental_memo
def create_array(size: int) -> List[int]:
    return [0] * size


st.write(create_array(10))
st.write(create_array(100))
st.write(create_array(1000))
