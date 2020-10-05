# Tutorial 2: Create a Streamlit Component

Starting with version [0.63.0](changelog.html#version-0-63-0), developers can write JavaScript and HTML "components" that can be rendered in Streamlit apps. Streamlit Components can receive data from, and also send data to, Streamlit Python scripts.

Streamlit Components let you expand the functionality provided in the base Streamlit package. Use Streamlit Components to create the needed functionality for your use case, then wrap it up in a Python package and share with the broader Streamlit community!

**Types of Streamlit Components you could create include:**

- Custom versions of existing Streamlit elements and widgets, such as `st.slider` or `st.file_uploader`
- Completely new Streamlit elements and widgets by wrapping existing React.js, Vue.js, or other JavaScript widget toolkits
- Rendering Python objects having methods that output HTML, such as IPython [`__repr_html__`](https://ipython.readthedocs.io/en/stable/config/integrating.html#rich-display)
- Convenience functions for commonly-used web features like [GitHub gists and Pastebin](https://github.com/randyzwitch/streamlit-embedcode)

Check out this [Streamlit Components Tutorial video](https://www.youtube.com/watch?v=BuD3gILJW-Q&feature=youtu.be) by Streamlit engineer Tim Conkling to get started:

```eval_rst
.. raw:: html

  <div class='embed-container'><iframe
    width="560"
    height="315"
    src="https://www.youtube.com/embed/BuD3gILJW-Q"
    style="margin: 0 0 2rem 0;"
    frameborder="0"
    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen>
  </iframe></div>
```

```eval_rst
.. note::
   The remainder of the documentation in this section is for users
   that want to **develop Streamlit Components** or are generally interested in the
   Streamlit project from a developer/contributor perspective.

   If you are only interested in **using Streamlit Components**, then you can skip these sections and head over to the `Streamlit Components Gallery <https://streamlit.io/components>`_ to see examples created by the community!
```
