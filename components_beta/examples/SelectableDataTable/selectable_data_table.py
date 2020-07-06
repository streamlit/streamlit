import pandas as pd

import streamlit as st
import streamlit.components.v1 as components

_selectable_data_table = components.declare_component(
    "selectable_data_table", url="http://localhost:3001",
)


def selectable_data_table(data, key=None):
    return _selectable_data_table(data=data, default=[], key=key)


raw_data = {
    "First Name": ["Jason", "Molly", "Tina", "Jake", "Amy"],
    "Last Name": ["Miller", "Jacobson", "Ali", "Milner", "Smith"],
    "Age": [42, 52, 36, 24, 73],
}
df = pd.DataFrame(raw_data, columns=["First Name", "Last Name", "Age"])

rows = selectable_data_table(df)
if rows:
    st.write("You have selected", rows)
