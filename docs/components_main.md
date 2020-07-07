# Overview

Starting with version [0.63.0](http://localhost:8000/changelog.html#version-0-63-0), developers can write JavaScript and HTML "components" that can be rendered in Streamlit apps. Streamlit components can receive data from, and also send data to, Streamlit Python scripts.

No longer are you limited to the functionality provided in the base Streamlit package. Use Streamlit components to create the needed functionality for your use case, then wrap it up in a Python package and share with the broader Streamlit community!

Example Streamlit components:

- Custom versions of existing Streamlit elements and widgets, such as `st.slider` or `st.file_uploader`
- Completely new Streamlit elements and widgets by wrapping existing React.js, Vue.js, or other JavaScript widget toolkits
- Rendering Python objects supporting `__repr_html__`
- Convenience functions for commonly-used web features like [GitHub gists and Pastebin](https://github.com/randyzwitch/streamlit-embedcode)
