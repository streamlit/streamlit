import streamlit as st

col1 = st.beta_columns(1)[0]
fruit_type = ["apple-4", "apple-17", "apple-78", "orange-175", "orange-176"]

with col1:
    selected_fruit_type = st.multiselect("Select Fruit Selection", options=fruit_type)
