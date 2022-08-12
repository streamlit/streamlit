import streamlit.components.v1 as components

url = "http://not.a.real.url"
test_component = components.declare_component("test_component", url=url)

test_component()
