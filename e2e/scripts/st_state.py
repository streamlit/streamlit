import streamlit as st

st.beta_state.init("count", 0)
st.beta_state.init("count", 0, key="Someplace")

st.write("Global Count:", st.beta_state.get("count"))
st.write("Someplace Count:", st.beta_state.get("count", key="Someplace"))


def callback():
    st.beta_state.set("count", st.beta_state.get("count") + 1)


st.button("Increment", on_click=callback)

# Uncomment any below to produce an error
# st.beta_state.get("cot")
# st.beta_state.get("count", key="Nowhere")
# st.beta_state.get(key="Nowhere")
# st.beta_state.set("cot", 6)
# st.beta_state.set("count", 6, key="Nowhere")

location = st.selectbox("Select Namespace", ["global", "Someplace"])


def namespace_callback():
    key = None if location == "global" else location
    count = st.beta_state.get("count", key=key)
    st.beta_state.set("count", count + 1, key=key)


st.button("Namespace Increment", on_click=namespace_callback)


def dict_namespace_callback():
    key = None if location == "global" else location
    state = st.beta_state.get(key=key)
    state["count"] += 1


st.button("Namespace Dict Increment", on_click=dict_namespace_callback)
