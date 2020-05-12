import streamlit as st

# Declare a Streamlit component.
# It will be served by the local webpack dev server that you can
# run via `npm run start`.
MyComponent = st.declare_component(url="http://localhost:3001")

# Alternately, if you've built a production version of the component,
# you can register the component's static files via the `path` param:
# MyComponent = st.declare_component(path="component_template/build")

# Add a wrapper function to the component.
# This is an optional step that enables you to customize your component's
# API, pre-process its input args, and post-process its output value.
@MyComponent
def create_instance(f, name, key=None):
    return f(name=name, key=key, default=0)


# Register the component. This assigns it a name within the Streamlit
# namespace. "Declaration" and "registration" are separate steps:
# generally, the component *creator* will do the declaration part,
# and a component *user* will do the registration.
st.register_component("my_component", MyComponent)

# Create an instance of the component. Arguments we pass here will be
# available in an "args" dictionary in the component. "default" is a special
# argument that specifies the initial return value of my_component, before the
# user has interacted with it.
num_clicks = st.my_component("World")
st.markdown("You've clicked %s times!" % int(num_clicks))

# It can live in the sidebar.
num_clicks = st.sidebar.my_component("Sidebar")
st.sidebar.markdown("You've clicked %s times!" % int(num_clicks))

name_input = st.text_input("Enter a name", value="Streamlit")

# Use the special "key" argument to assign your component a fixed identity
# if you want to change its arguments over time and not have it be
# re-created. (If you remove the "key" argument here, then the component will
# be re-created whenever a new name is entered in 'name_input', which means
# it will lose its current state.)
num_clicks = st.my_component(name_input, key="foo")
st.markdown("You've clicked %s times!" % int(num_clicks))
