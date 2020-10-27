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

Any time Streamlit sees either a variable or literal
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
.. important:: Right now, Magic only works in the main Python app file, not in imported files. See `GitHub issue #288 <https://github.com/streamlit/streamlit/issues/288>`_ for a discussion of the issues.
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
.. autofunction:: streamlit.select_slider
.. autofunction:: streamlit.text_input
.. autofunction:: streamlit.number_input
.. autofunction:: streamlit.text_area
.. autofunction:: streamlit.date_input
.. autofunction:: streamlit.time_input
.. autofunction:: streamlit.file_uploader
.. autofunction:: streamlit.color_picker
```

## Control flow

By default, Streamlit apps execute the script entirely, but we allow some functionality to handle control flow in your applications.

```eval_rst
.. autofunction:: streamlit.stop
```

## Add widgets to sidebar

Not only can you add interactivity to your report with widgets, you can organize them into a sidebar with `st.sidebar.[element_name]`. Each element that's passed to `st.sidebar` is pinned to the left, allowing users to focus on the content in your app. The only elements that aren't supported are `st.echo` and `st.spinner`.

Here's an example of how you'd add a selectbox to your sidebar.

```python
import streamlit as st

add_selectbox = st.sidebar.selectbox(
    "How would you like to be contacted?",
    ("Email", "Home phone", "Mobile phone")
)
```

## Lay out your app

In addition to the sidebar, you have a few other options for controlling how your app is laid out.

```eval_rst
.. note:: These are beta features. See
  https://docs.streamlit.io/en/latest/api.html#pre-release-features for more information.
```

```eval_rst
.. autofunction:: streamlit.beta_container
.. autofunction:: streamlit.beta_columns
.. autofunction:: streamlit.beta_expander
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
.. autofunction:: streamlit.set_page_config
```

## Mutate data

With Streamlit you can modify the data within an existing element (chart,
table, dataframe).

```eval_rst
.. automethod:: streamlit.delta_generator.DeltaGenerator.add_rows
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

## Pre-release features

At Streamlit, we like to move quick while keeping things stable. In our latest effort to move even faster without sacrificing stability, we're offering our bold and fearless users two ways to try out Streamlit's bleeding-edge features:

1. [Nightly releases](#nightly-releases)
2. [Beta and experimental features](#beta-and-experimental-features)

### Nightly releases

At the end of each day (at night 🌛), our bots run automated tests against the latest Streamlit code and, if everything looks good, it publishes them as the `streamlit-nightly` package. This means the nightly build includes all our latest features, bug fixes, and other enhancements on the same day they land on our codebase.

**How does this differ from official releases?**

Official Streamlit releases go not only through both automated tests but also rigorous manual testing, while nightly releases only have automated tests. It's important to keep in mind that new features introduced in nightly releases often lack polish. In our official releases, we always make double-sure all new features are ready for prime time.

**How do I use the nightly release?**

All you need to do is install the `streamlit-nightly` package:

```bash
pip uninstall streamlit
pip install streamlit-nightly --upgrade
```

```eval_rst
.. warning::

   You should never have both `streamlit` and `streamlit-nightly` installed in the same environment!
```

**Why should I use the nightly release?**

Because you can't wait for official releases, and you want to help us find bugs early!

**Why shouldn't I use the nightly release?**

While our automated tests have high coverage, there's still a significant likelihood that there will be some bugs in the nightly code.

**Can I choose which nightly release I want to install?**

If you'd like to use a specific version, you can find the version number in our [Release history](https://pypi.org/project/streamlit-nightly/#history). Specify the desired version using `pip` as usual: `pip install streamlit-nightly==x.yy.zz-123456`.

**Can I compare changes between releases?**

If you'd like to review the changes for a nightly release, you can use the [comparison tool on GitHub](https://github.com/streamlit/streamlit/compare/0.57.3...0.57.4.dev20200412).

### Beta and Experimental Features

In addition to nightly releases, we also have two naming conventions for less stable Streamlit features: `st.beta_` and `st.experimental_`. These distinctions are prefixes we attach to our function names to make sure their status is clear to everyone.

Here's a quick rundown of what you get from each naming convention:

- **st**: this is where our core features like `st.write` and `st.dataframe` live. If we ever make backward-incompatible changes to these, they will take place gradually and with months of announcements and warnings.
- **beta\_**: this is where all new features land before they becoming part of Streamlit core. This gives you a chance to try the next big thing we're cooking up weeks or months before we're ready to stabilize its API.
- **experimental\_**: this is where we'll put features that may or may not ever make it into Streamlit core. We don't know whether these features have a future, but we want you to have access to everything we're trying, and work with us to figure them out.

The main difference between `beta_` and `experimental_` is that beta features are expected to make it into Streamlit core at some point soon, while experimental features may never make it.

#### Beta

Features with the `beta_` naming convention are all scheduled to become part of Streamlit core. While in beta, a feature's API and behaviors may not be stable, and it's possible they could change in ways that aren't backward-compatible.

**The lifecycle of a beta feature**

1. A feature is added with the `beta_` prefix.
2. The feature's API stabilizes and the feature is _cloned_ without the `beta_` prefix, so it exists as both `st` and `beta_`. At this point, users will see a warning when using the version of the feature with the `beta_` prefix -- but the feature will still work.
3. At some point, the code of the `beta_`-prefixed feature is _removed_, but there will still be a stub of the function prefixed with `beta_` that shows an error with appropriate instructions.
4. Finally, at a later date the `beta_` version is removed.

#### Experimental

Features with the `experimental_` naming convention are things that we're still working on or trying to understand. If these features are successful, at some point they'll become part of Streamlit core, by moving to the `beta_` naming convention and then to Streamlit core. If unsuccessful, these features are removed without much notice.

```eval_rst
.. warning::

   Experimental features and their APIs may change or be removed at any time.
```

**The lifecycle of an experimental feature**

1. A feature is added with the `experimental_` prefix.
2. The feature is potentially tweaked over time, with possible API/behavior breakages.
3. At some point, we either promote the feature to `beta_` or remove it from `experimental_`. Either way, we leave a stub in `experimental_` that shows an error with instructions.
