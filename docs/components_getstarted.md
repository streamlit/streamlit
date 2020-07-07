# Develop Streamlit Components

The first step in developing a Streamlit Component is deciding whether to create a static component (i.e. rendered once, controlled by Python) or to create a bi-directional component that can communicate from Python to JavaScript and back dynamically.

## Create a static component

If your goal in creating a Streamlit Component is solely to display HTML code or render a chart from a Python visualization library, Streamlit provides two methods that greatly simplify the process: `components.html()` and `components.iframe()`.

If you are unsure whether you need bi-directional communication, **start here first**!

### Rendering an HTML string

Explanation here

```eval_rst
.. autofunction:: streamlit.components.v1.html
```

Example here

### Rendering an iframe url

Explanation here

```eval_rst
.. autofunction:: streamlit.components.v1.iframe
```

Example here

## Create a bi-directional component

This section will be much longer, a lot of copy-paste from Notion
