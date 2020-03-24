# TODO: remove me!

import streamlit as st

javascript = "return 'Hello, world!'"

my_plugin = st.plugin(javascript)

my_plugin(st._main, None)
