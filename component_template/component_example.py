import streamlit as st

# Declare a Streamlit component.
# It will be served by the local webpack dev server that you can
# run via `npm run start`.
MyComponent = st.declare_component(url="http://localhost:3001")

# Alternately, if you've built a production version of the component,
# you can register the component's static files via the `path` param:
# MyComponent = st.declare_component(path="component_template/build")

# Register the component. This assigns it a name within the Streamlit
# namespace. "Declaration" and "registration" are separate steps:
# generally, the component *creator* will do the declaration part,
# and a component *user* will do the registration.
st.register_component("my_component", MyComponent)

# Create an instance of the component. Arguments we pass here will be
# available in an "args" dictionary in the component. "default" is a special
# argument that specifies the initial return value of my_component, before the
# user has interacted with it.
num_clicks = st.my_component(name="Streamlit", default=0)
st.markdown("You've clicked %s times!" % int(num_clicks))

# We can create multiple instances of the component.
num_clicks = st.my_component(name="again", default=0)
st.markdown("You've clicked %s times!" % int(num_clicks))

# It can live in the sidebar.
num_clicks = st.sidebar.my_component(name="Sidebar", default=0)
st.sidebar.markdown("You've clicked %s times!" % int(num_clicks))
