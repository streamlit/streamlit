import streamlit as st

tab1, tab2, tab3 = st.tabs(["Tab 1", "Tab 2", "Tab 3"])

with tab1:
    st.write("tab1")
    st.text_input("Text input")

with tab2:
    st.write("tab2")
    st.number_input("Number input")

with tab3:
    st.write("tab3")
    st.date_input("Date input")

with st.expander("Expander", expanded=True):
    many_tabs = st.tabs([f"Tab {i}" for i in range(25)])

sidebar_tab1, sidebar_tab2 = st.sidebar.tabs(["Foo", "Bar"])
sidebar_tab1.write("I am in the sidebar")
sidebar_tab2.write("I'm also in the sidebar")
