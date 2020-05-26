import streamlit as st
from pathlib import Path

# Declare a Streamlit component.
# It will be served by the local webpack dev server that you can
# run via `npm run start`.
MyComponent = st.declare_component(url="http://localhost:3001")

# Alternately, if you've built a production version of the component,
# you can register the component's static files via the `path` param:

# parent_folder = Path(__file__).parent.absolute()
# frontend = str(parent_folder) + "/frontend/build"
# MyComponent = st.declare_component(path=frontend)

# Add a wrapper function to the component.
# This is an optional step that enables you to customize your component's
# API, pre-process its input args, and post-process its output value.
@MyComponent
def create_instance(f, name, key=None):
    return f(name=name, key=key, default=0)
