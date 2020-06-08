import streamlit as st
from my_component import my_component

# Create an instance of the component. Arguments we pass here will be
# available in an "args" dictionary in the component. "default" is a special
# argument that specifies the initial return value of my_component, before the
# user has interacted with it.
num_clicks = my_component("World")
st.markdown("You've clicked %s times!" % int(num_clicks))

name_input = st.text_input("Enter a name", value="Streamlit")

# Use the special "key" argument to assign your component a fixed identity
# if you want to change its arguments over time and not have it be
# re-created. (If you remove the "key" argument here, then the component will
# be re-created whenever a new name is entered in 'name_input', which means
# it will lose its current state.)
num_clicks = my_component(name_input, key="foo")
st.markdown("You've clicked %s times!" % int(num_clicks))
