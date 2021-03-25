# Get started

The easiest way to learn how to use Streamlit is to try things out yourself. As
you read through this guide, test each method. As long as your app is running,
every time you add a new element to your script and save, Streamlit's UI will
ask if you'd like to rerun the app and view the changes. This allows you to
work in a fast interactive loop: you write some code, save it, review the
output, write some more, and so on, until you're happy with the results. The
goal is to use Streamlit to create an interactive app for your data or model
and along the way to use Streamlit to review, debug, perfect, and share your
code.

## Create your first Streamlit app

First, we'll create a new Python script and import Streamlit.

1. Create a new Python file named `first_app.py`, then open it with your IDE
   or text editor.
2. Next, import Streamlit.

   ```python
   import streamlit as st
   # To make things easier later, we're also importing numpy and pandas for
   # working with sample data.
   import numpy as np
   import pandas as pd
   ```

3. Run your app. A new tab will open in your default browser. It'll be blank
   for now. That's OK.

   ```bash
   streamlit run first_app.py
   ```

   Running a Streamlit app is no different than any other Python script.
   Whenever you need to view the app, you can use this command.

   ```eval_rst
   .. tip::
      Did you know you can also pass a URL to `streamlit run`? This is great when combined with Github Gists. For example:

      `$ streamlit run https://raw.githubusercontent.com/streamlit/demo-uber-nyc-pickups/master/streamlit_app.py`
   ```

4. You can kill the app at any time by typing **Ctrl+c** in the terminal.

## Add text and data

### Add a title

Streamlit has a number of ways to add text to your app. Check out our
[API reference](api.md) for a complete list.

Let's add a title to test things out:

```python
st.title('My first app')
```

That's it! Your app has a title. You can use specific text functions to add
content to your app, or you can use [`st.write()`](api.html#streamlit.write)
and add your own markdown.

### Write a data frame

Along with [magic commands](api.html#magic-commands),
[`st.write()`](api.html#streamlit.write) is Streamlit's "Swiss Army knife". You
can pass almost anything to [`st.write()`](api.html#streamlit.write):
text, data, Matplotlib figures, Altair charts, and more. Don't worry, Streamlit
will figure it out and render things the right way.

```python
st.write("Here's our first attempt at using data to create a table:")
st.write(pd.DataFrame({
    'first column': [1, 2, 3, 4],
    'second column': [10, 20, 30, 40]
}))
```

There are other data specific functions like
[`st.dataframe()`](api.html#streamlit.dataframe) and
[`st.table()`](api.html#streamlit.table) that you can also use for displaying
data. Check our advanced guides on displaying data to understand when to use
these features and how to add colors and styling to your data frames.

```eval_rst
.. tip::
   For this guide we're using small amounts of data so that we can move
   quickly. You can check out our `Tutorial on creating a data explorer
   <tutorial/create_a_data_explorer_app.html>`_ to see an example of how to
   load data from an API and use `@st.cache <api.html#streamlit.cache>`_ to
   cache it.
```

## Use magic

You can also write to your app without calling any
Streamlit methods. Streamlit supports "[magic
commands](api.html#magic-commands)," which means you don't have to use
[`st.write()`](api.html#streamlit.write) at all! Try replacing the code above
with this snippet:

```python
"""
# My first app
Here's our first attempt at using data to create a table:
"""

df = pd.DataFrame({
  'first column': [1, 2, 3, 4],
  'second column': [10, 20, 30, 40]
})

df
```

Any time that Streamlit sees a variable or a literal
value on its own line, it automatically writes that to your app using
[`st.write()`](api.html#streamlit.write). For more information, refer to the
documentation on [magic commands](api.html#magic-commands).

## Draw charts and maps

Streamlit supports several popular data charting libraries like [Matplotlib,
Altair, deck.gl, and more](api.html#display-charts). In this section, you'll
add a bar chart, line chart, and a map to your app.

### Draw a line chart

You can easily add a line chart to your app with
[`st.line_chart()`](api.html#streamlit.line_chart). We'll generate a random
sample using Numpy and then chart it.

```python
chart_data = pd.DataFrame(
     np.random.randn(20, 3),
     columns=['a', 'b', 'c'])

st.line_chart(chart_data)
```

### Plot a map

With [`st.map()`](api.html#streamlit.map) you can display data points on a map.
Let's use Numpy to generate some sample data and plot it on a map of
San Francisco.

```python
map_data = pd.DataFrame(
    np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
    columns=['lat', 'lon'])

st.map(map_data)
```

## Add interactivity with widgets

With widgets, Streamlit allows you to bake interactivity directly into your
apps with checkboxes, buttons, sliders, and more. Check out our [API
reference](api.md) for a full list of interactive widgets.

### Use checkboxes to show/hide data

One use case for checkboxes is to hide or show a specific chart or section in
an app. [`st.checkbox()`](api.html#streamlit.checkbox) takes a single argument,
which is the widget label. In this sample, the checkbox is used to toggle a
conditional statement.

```python
if st.checkbox('Show dataframe'):
    chart_data = pd.DataFrame(
       np.random.randn(20, 3),
       columns=['a', 'b', 'c'])

    chart_data
```

### Use a selectbox for options

Use [`st.selectbox`](api.html#streamlit.selectbox) to choose from a series. You
can write in the options you want, or pass through an array or data frame
column.

Let's use the `df` data frame we created earlier.

```python
option = st.selectbox(
    'Which number do you like best?',
     df['first column'])

'You selected: ', option
```

## Lay out your app

For a cleaner look, you can move your widgets into a sidebar. This keeps your
app central, while widgets are pinned to the left. Let's take a look at how you
can use [`st.sidebar`](api.html#add-widgets-to-sidebar) in your app.

```python
option = st.sidebar.selectbox(
    'Which number do you like best?',
     df['first column'])

'You selected:', option
```

Most of the elements you can put into your app can also be put into a sidebar using this syntax:
`st.sidebar.[element_name]()`. Here are a few examples that show how it's used: `st.sidebar.markdown()`, `st.sidebar.slider()`, `st.sidebar.line_chart()`.

You can also use [`st.beta_columns`](https://docs.streamlit.io/en/latest/api.html#streamlit.beta_columns) to lay out widgets side-by-side, or
[`st.beta_expander`](https://docs.streamlit.io/en/latest/api.html#streamlit.beta_expander) to conserve space by hiding away large content.

```python
left_column, right_column = st.beta_columns(2)
pressed = left_column.button('Press me?')
if pressed:
    right_column.write("Woohoo!")

expander = st.beta_expander("FAQ")
expander.write("Here you could put in some really, really long explanations...")
```

The only exceptions right now are [`st.echo`](https://docs.streamlit.io/en/latest/api.html#streamlit.echo) and [`st.spinner`](https://docs.streamlit.io/en/latest/api.html#streamlit.spinner). Rest
assured, though, we're currently working on adding support for those too!

## Show progress

When adding long running computations to an app, you can use
[`st.progress()`](api.html#streamlit.progress) to display status in real time.

First, let's import time. We're going to use the `time.sleep()` method to
simulate a long running computation:

```python
import time
```

Now, let's create a progress bar:

```python
'Starting a long computation...'

# Add a placeholder
latest_iteration = st.empty()
bar = st.progress(0)

for i in range(100):
  # Update the progress bar with each iteration.
  latest_iteration.text(f'Iteration {i+1}')
  bar.progress(i + 1)
  time.sleep(0.1)

'...and now we\'re done!'
```

## Share your app

After you’ve built a Streamlit app, it's time to share it! To show it off to the world you can use **Streamlit sharing** to deploy, manage, and share your app for free. Streamlit sharing is currently invitation only, so please [request an invite](https://www.streamlit.io/sharing) and we'll get you one soon!

<!-- [[we'll need to grab the gif after the video editors are done with it on Wednesday]] -->

It works in 3 simple steps:

1. Put your app in a public Github repo (and make sure it has a requirements.txt!)
2. Sign into [share.streamlit.io](https://share.streamlit.io)
3. Click 'Deploy an app' and then paste in your GitHub URL

That's it! **🎈**You now have a publicly deployed app that you can share with the world. Click to learn more about [how to use Streamlit sharing](deploy_streamlit_app.md). If you're looking for private sharing for your team, check out [Streamlit for Teams](https://www.streamlit.io/for-teams).

## Get help

That's it for getting started, now you can go and build your own apps! If you
run into difficulties here are a few things you can do.

- Check out our [community forum](https://discuss.streamlit.io/) and post a
  question
- Quick help from command line with `$ streamlit --help`
- Read more documentation! Check out:
  <!-- - [Tutorials](tutorial/index.md) to make an app -->
  - [Streamlit Cookbook](advanced_concepts.md) for things like caching and
    inserting elements out of order
  - [API reference](api.md) for examples of every Streamlit command
