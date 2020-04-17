import streamlit as st
import pandas as pd
import numpy as np

# Register "my_plugin" as a Streamlit component.
st.plugin("my_plugin", "plugin_template/build")

# # Create an instance of the component. Arguments we pass here
# # will be available in an "args" dictionary in the component.
# # "Default" is a special argument that specifies the initial return value of
# # my_plugin, before the user has interacted with it.
# num_clicks = st.my_plugin(name="Streamlit", default=0)
# st.markdown("You clicked %s times!" % int(num_clicks))

# # We can create multiple instances of the component
# num_clicks = st.my_plugin(name="World", default=0)
# st.markdown("You clicked %s times!" % int(num_clicks))

# # It can live in the sidebar
# num_clicks = st.sidebar.my_plugin(name="Sidebar", default=0)
# st.sidebar.markdown("You clicked %s times!" % int(num_clicks))

# Dataframe example
df = pd.DataFrame(np.arange(0, 16, 1).reshape(4, 4))
st.my_plugin(data=df)
