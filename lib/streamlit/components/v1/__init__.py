# Modules that the user should have access to. These are imported with "as"
# syntax pass mypy checking with implicit_reexport disabled.
from .components import declare_component as declare_component

# `html` and `iframe` are part of Custom Components, so they appear in this
# `streamlit.components.v1` namespace.
import streamlit

html = streamlit._main._html
iframe = streamlit._main._iframe
