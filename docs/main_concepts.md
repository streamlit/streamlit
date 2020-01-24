# Main concepts

Working with Streamlit is simple. First you sprinkle a few Streamlit commands into a normal Python script. Then you run the script:

```
$ streamlit run your_script.py [script args]
```

```eval_rst
.. tip::
   Did you know you can also pass a URL to `streamlit run`? This is great when combined with Github Gists. For example:

   `$ streamlit run https://raw.githubusercontent.com/streamlit/demo-uber-nyc-pickups/master/app.py`
```

As soon as you run the script, a new tab will open in your default browser and connect to a Streamlit server that's automatically launched behind the scenes. In the tab, you'll find your Streamlit app. This is your canvas, where you'll draw charts, text, tables, and more.

What gets drawn in the app is up to you. For example [`st.text`](apid.html#streamlit.text) writes raw text to your app, and [`st.line_chart`](api.html#streamlit.line_chart) draws — you guessed it — a line chart.

## Data flow

Every time you want to update your app, just save your script. The Streamlit server is listening, and will automatically update the report as needed.

Behind the scenes, Streamlit re-executes the entire Python script from top to bottom on each save. Then Streamlit does a bunch of computer-science magic to make sure that your report is updated efficiently. If you're wondering how we deal with non-trivial code, the answers is [`@st.cache`](#caching), which we'll cover in the next section.

What this all means is that Streamlit allows you to work in a fast interactive loop: you type some code, save, type some more code, save, and on-and-on until you're happy with your app. The idea is to use Streamlit as a place where you can understand your code, debug it, perfect it, and finally share your results.

## Widgets

When you've got the data or model into the state that you want to explore, you can add in widgets like [`st.slider()`](api.html#streamlit.slider), [`st.button()`](api.html#streamlit.button) or [`st.selectbox()`](api.html#streamlit.selectbox). It's really straightforward - just treat widgets as variables. There are no callbacks in Streamlit! Every interaction simply reruns the script from top-to-bottom. Streamlit assigns each variable an up-to-date value given the app state. This approach leads to really clean code:

```python
import streamlit as st
x = st.slider('x')
st.write(x, 'squared is', x * x)

```

## Sidebar

Streamlit makes it easy to organize your widgets in a left panel sidebar with [`st.sidebar`](api.html#add-widgets-to-sidebar). Each element that's passed to [`st.sidebar`](api.html#add-widgets-to-sidebar) is pinned to the left, allowing users to focus on the content in your app. The only elements that aren't supported are: `st.write` (you
should use `st.sidebar.markdown()` instead), `st.echo`, and `st.spinner`.

```python
import streamlit as st

# Adds a selectbox to the sidebar
add_selectbox = st.sidebar.selectbox(
    'How would you like to be contacted?',
    ('Email', 'Home phone', 'Mobile phone')
)

# Adds a slider to the sidebar
add_slider = st.sidebar.slider(
    'Select a range of values',
    0.0, 100.0, (25.0, 75.0)
)
```

## Caching

The Streamlit cache allows your app to stay performant even when loading data from the web, manipulating large datasets, or performing expensive computations.

To use the cache, just wrap functions in the [`@st.cache`](api.html#streamlit.cache) decorator:

```python
@st.cache  # <-- This function will be cached
def my_slow_function(arg1, arg2):
    # Do something really slow in here!
    return the_output
```

When you mark a function with the [`@st.cache`](api.html#streamlit.cache) decorator, it tells Streamlit that whenever the function is called it needs to check three things:

1. The input parameters that you called the function with
2. The body of the function
3. The body of any function used inside the cached function

If this is the first time Streamlit has seen these items with these exact values and in this exact combination and order, it runs the function and stores the result in a local cache. Think of the cache as a simple in-memory key-value store, where the key is a hash of all 3 above and the value is the actual output object passed by reference.

Then, next time the cached function is called, if the key hasn’t changed, Streamlit will just skip executing the function altogether and, instead, return the output previously stored in the cache.

For more information about the Streamlit cache, its configuration parameters, and its limitations, see [Caching](new-caching-doc).

## App model

Now that you have an idea of what Streamlit is, let's close the loop and review how it works:

1. The entire script is rerun with each save.
2. Streamlit assigns each variable an up-to-date value based on the current state of the app.
3. Caching allows Streamlit to skip redundant data fetches and computation.

![](media/app_model.png)

## Next steps

- [Get started](getting_started.md) with Streamlit
- Read up on [advanced concepts](advanced_concepts.md)
- [Build your first app ](tutorial/index.md)
