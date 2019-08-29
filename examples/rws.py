import streamlit as st

# default = "hello"
# if st.checkbox("Change default"):
#     default = "goodbye"

# text = st.text_input("Text", default)
# st.write(text)


# default = True
# if st.checkbox("Change default"):
#     default = False

# checkbox = st.checkbox("Checkbox", default)
# st.write(checkbox)


# default = 0
# if st.checkbox("Change default"):
#     default = 1

# checkbox = st.radio("Radio", ("female", "male"), default)
# st.write(checkbox)

default = 0
if st.checkbox("Change default"):
    default = 1

selectbox = st.selectbox("Selectbox", ("female", "male"), default)
st.write(selectbox)
