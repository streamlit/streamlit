import streamlit as st
import pandas as pd

_selectable_datatable = st.declare_component(url="http://localhost:3001")


def selectable_datatable(data, key=None, loc=None):
    return _selectable_datatable(data=data, default=[], key=key, loc=loc)


raw_data = {
    "First Name": ["Jason", "Molly", "Tina", "Jake", "Amy"],
    "Last Name": ["Miller", "Jacobson", "Ali", "Milner", "Smith"],
    "Age": [42, 52, 36, 24, 73],
}
df = pd.DataFrame(raw_data, columns=["First Name", "Last Name", "Age"])

rows = selectable_datatable(df)
if rows:
    st.write("You have selected", rows)
