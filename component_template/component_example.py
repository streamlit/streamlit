import streamlit as st

# Register "my_component" as a Streamlit component.
# st.register_component("my_component", path="component_template/build")

# Alternately, you can serve your in-development component with node,
# and edit it live. Pass its URL instead of a path:
st.register_component("my_component", url="http://localhost:3001")

# Create an instance of the component. Arguments we pass here
# will be available in an "args" dictionary in the component.
# "Default" is a special argument that specifies the initial return value of
# my_component, before the user has interacted with it.
num_clicks = st.my_component(name="Streamlit", default=0)
st.markdown("You clicked %s times!" % int(num_clicks))

# We can create multiple instances of the component
num_clicks = st.my_component(name="World", default=0)
st.markdown("You clicked %s times!" % int(num_clicks))

# It can live in the sidebar
num_clicks = st.sidebar.my_component(name="Sidebar", default=0)
st.sidebar.markdown("You clicked %s times!" % int(num_clicks))
