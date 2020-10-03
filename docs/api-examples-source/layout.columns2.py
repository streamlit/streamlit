import streamlit as st

col1, col2 = st.beta_columns([3, 1])

col1.write("A wide column with a chart")
col1.line_chart({"data": [1, 5, 2, 6]})

col2.write("A narrow column")
