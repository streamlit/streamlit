import streamlit as st

i1 = st.text_input("text input 1")
st.write('value 1: "', i1, '"')

i2 = st.text_input("text input 2", "default text")
st.write('value 2: "', i2, '"')

i3 = st.text_input("text input 3", 1234)
st.write('value 3: "', i3, '"')

i4 = st.text_input("text input 4", None)
st.write('value 4: "', i4, '"')

i5 = st.text_input("text input 5", placeholder="Placeholder")
st.write('value 5: "', i5, '"')

i6 = st.text_input("text input 6", "default text", disabled=True)
st.write('value 6: "', i6, '"')

i7 = st.text_input("text input 7", "default text", label_visibility="hidden")
st.write('value 7: "', i7, '"')

i8 = st.text_input("text input 8", "default text", label_visibility="collapsed")
st.write('value 8: "', i8, '"')

if st._is_running_with_streamlit:

    def on_change():
        st.session_state.text_input_changed = True

    st.text_input("text input 9", key="text_input9", on_change=on_change)
    st.write('value 9: "', st.session_state.text_input9, '"')
    st.write("text input changed:", "text_input_changed" in st.session_state)
