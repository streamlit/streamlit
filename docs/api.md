# API reference

Streamlit makes it easy for you to visualize, mutate, and share data. The API
reference is organized by activity type, like displaying data or optimizing
performance. Each section includes methods associated with the activity type,
including examples.

Know what you're looking for? Use these links or the left nav to move through
this API reference.

```eval_rst
.. contents::
    :local:
    :depth: 1
```

## Magic commands

Magic commands are a feature in Streamlit that allows you to write markdown and
data to your app with very few keypresses. Here's an example:

```python
# Draw a title and some text to the app:
'''
# This is the document title

This is some _markdown_.
'''

df = pd.DataFrame({'col1': [1,2,3]})
df  # <-- Draw the dataframe

x = 10
'x', x  # <-- Draw the string 'x' and then the value of x
```

How it works is simple: any time Streamlit sees either a variable or literal
value on its own line, it automatically writes that to your app using
[`st.write`](api.html#streamlit.write) (which you'll learn about later).

Also, magic is smart enough to ignore docstrings. That is, it ignores the
strings at the top of files and functions.

If you prefer to call Streamlit commands more explicitly, you can always turn
magic off in your `~/.streamlit/config.toml` with the following setting:

```toml
[runner]
magicEnabled = false
```

```eval_rst
.. important:: Right now, Magic only works on Python 3.
```

## Display text

Streamlit apps usually start with a call to `st.title` to set the
app's title. After that, there are 2 heading levels you can use:
`st.header` and `st.subheader`.

Pure text is entered with `st.text`, and Markdown with
`st.markdown`.

We also offer a "swiss-army knife" command called `st.write`, which accepts
multiple arguments, and multiple data types. And as described above, you can
also use [magic commands](api.html#magic-commands) in place of `st.write`.

```eval_rst
.. autofunction:: streamlit.text
.. autofunction:: streamlit.markdown
.. autofunction:: streamlit.latex
.. autofunction:: streamlit.write
.. autofunction:: streamlit.title
.. autofunction:: streamlit.header
.. autofunction:: streamlit.subheader
.. autofunction:: streamlit.code
```

## Display data

When you're working with data, it is extremely valuable to visualize that
data quickly, interactively, and from multiple different angles. That's what
Streamlit is actually built and optimized for.

You can display data via [charts](#display-charts), and you can display it in
raw form. These are the Streamlit commands you can use to display raw data.

```eval_rst
.. autofunction:: streamlit.dataframe
.. autofunction:: streamlit.table
.. autofunction:: streamlit.json
```

## Display charts

Streamlit supports several different charting libraries, and our goal is to
continually add support for more. Right now, the most basic library in our
arsenal is [Matplotlib](https://matplotlib.org/). Then there are also
interactive charting libraries like [Vega
Lite](https://vega.github.io/vega-lite/) (2D charts) and
[deck.gl](https://github.com/uber/deck.gl) (maps and 3D charts). And
finally we also provide a few chart types that are "native" to Streamlit,
like `st.line_chart` and `st.area_chart`.

```eval_rst
.. autofunction:: streamlit.line_chart
.. autofunction:: streamlit.area_chart
.. autofunction:: streamlit.bar_chart
.. autofunction:: streamlit.pyplot
.. autofunction:: streamlit.altair_chart
.. autofunction:: streamlit.vega_lite_chart
.. autofunction:: streamlit.plotly_chart
.. autofunction:: streamlit.bokeh_chart
.. autofunction:: streamlit.pydeck_chart
.. autofunction:: streamlit.deck_gl_chart
.. autofunction:: streamlit.graphviz_chart
.. autofunction:: streamlit.map
```

## Display media

It's easy to embed images, videos, and audio files directly into your Streamlit apps.

```eval_rst
.. autofunction:: streamlit.image
.. autofunction:: streamlit.audio
.. autofunction:: streamlit.video
```

## Display interactive widgets

With widgets, Streamlit allows you to bake interactivity directly into your apps with buttons, sliders, text inputs, and more.

```eval_rst
.. autofunction:: streamlit.button
.. autofunction:: streamlit.checkbox
.. autofunction:: streamlit.radio
.. autofunction:: streamlit.selectbox
.. autofunction:: streamlit.multiselect
.. autofunction:: streamlit.slider
.. autofunction:: streamlit.text_input
.. autofunction:: streamlit.number_input
.. autofunction:: streamlit.text_area
.. autofunction:: streamlit.date_input
.. autofunction:: streamlit.time_input
.. autofunction:: streamlit.file_uploader
.. autofunction:: streamlit.beta_color_picker
```

## Add widgets to sidebar

Not only can you add interactivity to your report with widgets, you can organize them into a sidebar with `st.sidebar.[element_name]`. Each element that's passed to `st.sidebar` is pinned to the left, allowing users to focus on the content in your app. The only elements that aren't supported are: `st.write` (you
should use `st.sidebar.markdown()` instead), `st.echo`, and `st.spinner`.

Here's an example of how you'd add a selectbox to your sidebar.

```python
import streamlit as st

add_selectbox = st.sidebar.selectbox(
    "How would you like to be contacted?",
    ("Email", "Home phone", "Mobile phone")
)
```

## Display code

Sometimes you want your Streamlit app to contain _both_ your usual
Streamlit graphic elements _and_ the code that generated those elements.
That's where `st.echo()` comes in.

```eval_rst
.. autofunction:: streamlit.echo
```

Ok so let's say you have the following file, and you want to make its
app a little bit more self-explanatory by making that middle section
visible in the Streamlit app:

```python
import streamlit as st

def get_user_name():
    return 'John'

# ------------------------------------------------
# Want people to see this part of the code...

def get_punctuation():
    return '!!!'

greeting = "Hi there, "
user_name = get_user_name()
punctuation = get_punctuation()

st.write(greeting, user_name, punctuation)

# ...up to here
# ------------------------------------------------

foo = 'bar'
st.write('Done!')
```

The file above creates a Streamlit app containing the words "Hi there,
`John`", and then "Done!".

Now let's use `st.echo()` to make that middle section of the code visible
in the app:

```python
import streamlit as st

def get_user_name():
    return 'John'

with st.echo():
    # Everything inside this block will be both printed to the screen
    # and executed.

    def get_punctuation():
        return '!!!'

    greeting = "Hi there, "
    value = get_user_name()
    punctuation = get_punctuation()

    st.write(greeting, value, punctuation)

# And now we're back to _not_ printing to the screen
foo = 'bar'
st.write('Done!')
```

It's _that_ simple!

```eval_rst
.. note:: You can have multiple `st.echo()` blocks in the same file.
  Use it as often as you wish!
```

## Display progress and status

Streamlit provides a few methods that allow you to add animation to your
apps. These animations include progress bars, status messages (like
warnings), and celebratory balloons.

```eval_rst
.. autofunction:: streamlit.progress
.. autofunction:: streamlit.spinner
.. autofunction:: streamlit.balloons
.. autofunction:: streamlit.error
.. autofunction:: streamlit.warning
.. autofunction:: streamlit.info
.. autofunction:: streamlit.success
.. autofunction:: streamlit.exception
```

## Placeholders, help, and options

There are a handful of methods that allow you to create placeholders in your
app, provide help using doc strings, and get and modify configuration options.

```eval_rst
.. autofunction:: streamlit.empty
.. autofunction:: streamlit.help
.. autofunction:: streamlit.get_option
.. autofunction:: streamlit.set_option
```

## Mutate data

With Streamlit you can modify the data within an existing element (chart,
table, dataframe).

```eval_rst
.. automethod:: streamlit.DeltaGenerator.DeltaGenerator.add_rows
```

## Optimize performance

When you mark a function with Streamlit’s cache annotation, it tells Streamlit
that whenever the function is called it should check three things:

1. The name of the function
2. The actual code that makes up the body of the function
3. The input parameters that you called the function with

If this is the first time Streamlit has seen those three items, with those exact
values, and in that exact combination, it runs the function and stores the
result in a local cache.

Then, next time the function is called, if those three values have not changed
Streamlit knows it can skip executing the function altogether. Instead, it just
reads the output from the local cache and passes it on to the caller.

The main limitation is that Streamlit’s cache feature doesn’t know about
changes that take place outside the body of the annotated function.

For more information about the Streamlit cache, its configuration parameters,
and its limitations, see [Caching](caching.md).

```eval_rst
.. autofunction:: streamlit.cache
```
