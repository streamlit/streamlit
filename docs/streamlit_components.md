# Overview of Streamlit Components

Starting with version [0.63.0](http://localhost:8000/changelog.html#version-0-63-0), developers can write JavaScript and HTML "components" that can be rendered in Streamlit apps. Streamlit components can receive data from, and also send data to, Streamlit Python scripts.

Streamlit Components let you expand the functionality provided in the base Streamlit package. Use Streamlit components to create the needed functionality for your use case, then wrap it up in a Python package and share with the broader Streamlit community!

**Types of Streamlit Components you could create include:**

- Custom versions of existing Streamlit elements and widgets, such as `st.slider` or `st.file_uploader`
- Completely new Streamlit elements and widgets by wrapping existing React.js, Vue.js, or other JavaScript widget toolkits
- Rendering Python objects having methods that output HTML, such as IPython [`__repr_html__`](https://ipython.readthedocs.io/en/stable/config/integrating.html#rich-display)
- Convenience functions for commonly-used web features like [GitHub gists and Pastebin](https://github.com/randyzwitch/streamlit-embedcode)

```eval_rst
.. note::
   The remainder of the documentation in this section is for users
   that want to **develop Streamlit Components** or are generally interested in the
   Streamlit project from a developer/contributor perspective.

   If you are only interested in **using Streamlit Components**, then you can skip these sections and/or refer to the documentation of the component you would like to use for example usage.
```
