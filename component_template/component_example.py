import streamlit as st
import pandas as pd

# Register "my_component" as a Streamlit component.
# It will be served by the local webpack dev server that you can
# run via `npm run start`.
st.register_component("my_component", url="http://localhost:3001")

# # Alternately, if you've built a production version of the component,
# # you can register the component's static files via the `path` param:
# # st.register_component("my_component", path="component_template/build")

# # Create an instance of the component. Arguments we pass here will be
# # available in an "args" dictionary in the component. "default" is a special
# # argument that specifies the initial return value of my_component, before the
# # user has interacted with it.
# num_clicks = st.my_component(name="Streamlit", default=0)
# st.markdown("You clicked %s times!" % int(num_clicks))

# # We can create multiple instances of the component.
# num_clicks = st.my_component(name="World", default=0)
# st.markdown("You clicked %s times!" % int(num_clicks))

# # It can live in the sidebar.
# num_clicks = st.sidebar.my_component(name="Sidebar", default=0)
# st.sidebar.markdown("You clicked %s times!" % int(num_clicks))

raw_data = {
    "First Name": ["Jason", "Molly", "Tina", "Jake", "Amy"],
    "Last Name": ["Miller", "Jacobson", "Ali", "Milner", "Cooze"],
    "Age": [42, 52, 36, 24, 73],
}

df = pd.DataFrame(raw_data, columns=["First Name", "Last Name", "Age"])

# Create an instance of the component. Arguments we pass here will be
# available in an "args" dictionary in the component. "default" is a special
# argument that specifies the initial return value of my_component, before the
# user has interacted with it.
rows = st.my_component(data=df, default=[])

if rows:
    st.write("You have selected", rows)
