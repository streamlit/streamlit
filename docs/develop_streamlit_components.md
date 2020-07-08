# Develop Streamlit Components

The first step in developing a Streamlit Component is deciding whether to create a static component (i.e. rendered once, controlled by Python) or to create a bi-directional component that can communicate from Python to JavaScript and back.

## Create a static component

If your goal in creating a Streamlit Component is solely to display HTML code or render a chart from a Python visualization library, Streamlit provides two methods that greatly simplify the process: `components.html()` and `components.iframe()`.

If you are unsure whether you need bi-directional communication, **start here first**!

### Render an HTML string

While [`st.text`](http://localhost:8000/api.html#streamlit.text), [`st.markdown`](http://localhost:8000/api.html#streamlit.text) and [`st.write`](http://localhost:8000/api.html#streamlit.text) make it easy to write text to a Streamlit app, sometimes it would be easier to implement a custom piece of HTML or you need to implement a specific HTML/JavaScript template for a charting library. `components.html` gives you the ability to embed an iframe inside of a Streamlit app containing your output.

```eval_rst
.. autofunction:: streamlit.components.v1.html
```

**Example**

```python
import streamlit as st
import streamlit.components.v1 as components

# embed a twitter feed in streamlit
components.html("""
                <a class="twitter-timeline"
                href="https://twitter.com/streamlit?ref_src=twsrc%5Etfw">Tweets by streamlit</a>
                <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
                """
                )
```

### Render an iframe url

`components.iframe` is similar in features to `components.html`, with the difference being that `components.iframe` takes a URL as its input. This is used for situations where you want to include an entire page within a Streamlit app.

```eval_rst
.. autofunction:: streamlit.components.v1.iframe
```

**Example**

```python
import streamlit as st
import streamlit.components.v1 as components

# embed streamlit docs in a streamlit app
components.iframe("https://docs.streamlit.io/en/latest")
```

## Create a bi-directional component

This section will be much longer, a lot of copy-paste from Notion
