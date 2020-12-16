import streamlit as st

with st.beta_form():
    st.checkbox("checkbox")
    st.text_input("text_input")

# with st.beta_expander("st.expander"):
#     st.code("Inside beta_exapnder")
#     st.button("submit")
#
# st.markdown("---")
#
# with st.beta_container():
#     st.code("Inside beta_container")
#     st.button("submit", key="asdf")
#
# st.markdown("---")
#
# cols = st.beta_columns(2)
# with cols[0]:
#     st.code("Inside beta_columns (1)")
#     st.button("submit", key="columns1")
# with cols[1]:
#     st.code("Inside beta_columns (2)")
#     st.button("submit", key="columns2")
#
# st.markdown("---")
#
# st.code("Not inside a container")
# st.button("submit", key="qwert")
