import streamlit as st

# Register "my_component" as a Streamlit component.
# It will be served by the local webpack dev server that you can
# run via `npm run start`.
st.register_component("my_component", url="http://localhost:3001")

# Alternately, if you've built a production version of the component,
# you can register the component's static files via the `path` param:
# st.register_component("my_component", path="component_template/build")

# Create an instance of the component. Arguments we pass here will be
# available in an "args" dictionary in the component. "default" is a special
# argument that specifies the initial return value of my_component, before the
# user has interacted with it.
num_clicks = st.my_component(name="World", default=0)
st.markdown("You've clicked %s times!" % int(num_clicks))

# It can live in the sidebar.
num_clicks = st.sidebar.my_component(name="Sidebar", default=0)
st.sidebar.markdown("You've clicked %s times!" % int(num_clicks))

name_input = st.text_input("Enter a name", value="Streamlit")

# Use the special "key" argument to assign your component a fixed identity
# if you want to change its arguments over time and not have it be
# re-created. (If you remove the "key" argument here, then the component will
# be re-created whenever a new name is entered in 'name_input', which means
# it will lose its current state.)
num_clicks = st.my_component(name=name_input, default=0, key="foo")
st.markdown("You've clicked %s times!" % int(num_clicks))
