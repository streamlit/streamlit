import streamlit as st

i1 = st.checkbox("checkbox 1", True)
st.write("value 1:", i1)

i2 = st.checkbox("checkbox 2", False)
st.write("value 2:", i2)

i3 = st.checkbox("checkbox 3")
st.write("value 3:", i3)

if st._is_running_with_streamlit:

    def on_change():
        st.session_state.checkbox_clicked = True

    st.checkbox("checkbox 4", key="checkbox4", on_change=on_change)
    st.write("value 4:", st.session_state.checkbox4)
    st.write("checkbox clicked:", "checkbox_clicked" in st.session_state)

i5 = st.checkbox("checkbox 5", disabled=True)
st.write("value 5:", i5)

i6 = st.checkbox("checkbox 6", value=True, disabled=True)
st.write("value 6:", i6)
