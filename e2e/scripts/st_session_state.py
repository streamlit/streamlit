import streamlit as st

# st.session_state can only be accessed while running with streamlit
if st._is_running_with_streamlit:
    if "initialized" not in st.session_state:
        st.session_state["item_counter"] = 0
        st.session_state.attr_counter = 0

        st.session_state.initialized = True

    if st.button("inc_item_counter"):
        st.session_state["item_counter"] += 1

    if st.button("inc_attr_counter"):
        st.session_state.attr_counter += 1

    if st.button("del_item_counter"):
        del st.session_state["item_counter"]

    if st.button("del_attr_counter"):
        del st.session_state.attr_counter

    if "item_counter" in st.session_state:
        st.write(f"item_counter: {st.session_state['item_counter']}")

    if "attr_counter" in st.session_state:
        st.write(f"attr_counter: {st.session_state.attr_counter}")

    st.write(f"len(st.session_state): {len(st.session_state)}")
    st.write(st.session_state)
