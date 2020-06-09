import os
import streamlit as st

# Declare a Streamlit component. It will be served by the local dev server
# that you run via `npm run start`.
_my_component = st.declare_component(url="http://localhost:3001")

# When you're ready to distribute a production version of the component,
# replace the `url` param with `path`, and point it to to the component's
# build directory:
# parent_dir = os.path.dirname(os.path.abspath(__file__))
# build_dir = os.path.join(parent_dir, "frontend/build")
# _my_component = st.declare_component(path=build_dir)

# Add a wrapper function to the component.
# This is an optional step that lets you customize your component's
# API, pre-process its input args, and post-process its output value.
def my_component(name, key=None):
    component_value = _my_component(name=name, key=key, default=0)

    # You can optionally modify the value returned from the component,
    # if it makes sense for your API. (There's no need to do that here,
    # so we're not. But it's an option!)
    return component_value
