import streamlit as st
import pandas as pd

st.register_component("custom_dataframe", url="http://localhost:3001")

raw_data = {
    "First Name": ["Jason", "Molly", "Tina", "Jake", "Amy"],
    "Last Name": ["Miller", "Jacobson", "Ali", "Milner", "Cooze"],
    "Age": [42, 52, 36, 24, 73],
}

df = pd.DataFrame(raw_data, columns=["First Name", "Last Name", "Age"])
st.custom_dataframe(data=df, default=[])
