import streamlit as st


def increment_num_clicks():
    num_clicks = st.session_state.get("num_clicks", 0)
    st.session_state["num_clicks"] = num_clicks + 1


st.write(f"Hello, Snowflake!")
st.write(f"You've clicked {st.session_state.get('num_clicks', 0)} times.")
st.button("Click Me!", on_click=increment_num_clicks)
