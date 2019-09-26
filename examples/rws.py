from datetime import date
from datetime import time
import streamlit as st


# default = True
# if st.checkbox("Change default"):
#     default = False

# checkbox = st.checkbox("Checkbox", default)
# st.write(checkbox)


# default = date(2020, 1, 1)
# if st.checkbox("Change default"):
#     default = date(1970, 1, 1)

# date_input = st.date_input("Date Input", default)
# st.write(date_input)

# default = (0, 1)
# if st.checkbox("Change default"):
#     default = (0,)

# options = ('Green', 'Yellow', 'Red', 'Blue')
# multiselectbox = st.multiselectbox("Multiselectbox", options, default)
# st.write(multiselectbox)


# default = 0
# if st.checkbox("Change default"):
#     default = 1

# radio = st.radio("Radio", ("female", "male"), default)
# st.write(radio)


# default = 0
# if st.checkbox("Change default"):
#     default = 1

# selectbox = st.selectbox("Selectbox", ("female", "male"), default)
# st.write(selectbox)


# default = "hello"
# if st.checkbox("Change default"):
#     default = "goodbye"

# text_area = st.text_area("Text Area", default)
# st.write(text_area)


default = "hello"
if st.checkbox("Change default"):
    default = "goodbye"

text_input = st.text_input("Text Input", default)
st.write(text_input)


# default = time(0, 0)
# if st.checkbox("Change default"):
#     default = time(23, 59)

# time_input = st.time_input("Time Input", default)
# st.write(time_input)


# default = 1
# if st.checkbox("Change default"):
#     default = 50

# slider = st.slider("Slider", 1, 100, default)
# st.write(slider)
