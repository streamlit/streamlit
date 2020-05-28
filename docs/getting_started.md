# 10-minute Streamlit Tutorial

The easiest way to learn Streamlit is to try things out yourself! As
you work through this tutorial, be sure to run each line of code.
Each time you make a change to your script and save, the Streamlit UI will
ask if you'd like to rerun the app and view the changes. This workflow allows for
working in a fast, interactive loop: write some code, save it, review the
output, write some more, and so on until you're happy with the results.

## Part 1: Install Streamlit in a virtual environment

Regardless of which package manager you choose ([pipenv](https://pipenv.pypa.io/en/latest/),
[conda](https://www.anaconda.com/distribution/), [venv](https://docs.python.org/3/library/venv.html), etc.),
we recommend installing Streamlit in a separate virtual environment for each Streamlit application.
This ensures that the dependencies pulled in for Streamlit don't impact any other Python projects
you're working on.

These instructions assume you have already installed Python 3.6 or higher on your machine. If you need to download Python,
please see the [official Python.org website](https://www.python.org/downloads/). Additionally, the [Streamlit wiki](https://github.com/streamlit/streamlit/wiki) provides detailed instructions for [creating Python virtual environments](https://github.com/streamlit/streamlit/wiki/Installing-in-a-virtual-environment).

### Installing Streamlit on macOS and Linux using Pipenv

The officially-supported environment manager for Streamlit on macOS and Linux is [Pipenv](https://pypi.org/project/pipenv/):

1. Navigate to your project folder: `cd <myproject>`
2. Install Streamlit in your environment: `pipenv install streamlit`
   <br />When you run the command above, two files named `Pipfile` and `Pipfile.lock` will appear in `myprojects/`. These files are where your Pipenv environment and its dependencies are declared.
3. Activate your pipenv environment from the `<myproject>` folder: `pipenv shell`
4. Test that the installation worked: `streamlit hello`

The 'Streamlit Hello' app should appear in a new tab in your web browser at [http://localhost:8501](http://localhost:8501)!

### Installing Streamlit on Windows using Anaconda

The officially-supported environment manager for Streamlit on Windows is [Anaconda Navigator](https://docs.anaconda.com/anaconda/navigator/). If
you don't have Anaconda installed yet, please follow the steps provided on the [Anaconda installation page](https://docs.anaconda.com/anaconda/install/windows/).

Once you have installed Anaconda, please follow the steps to [set up and manage your environment](https://docs.anaconda.com/anaconda/navigator/getting-started/#managing-environments) using the Anaconda Navigator.

1. Select the "▶" icon next to your new environment. Then select "Open terminal":
   !["Open terminal" in Anaconda Navigator](https://i.stack.imgur.com/EiiFc.png)
2. In the terminal that appears, type: `pip install streamlit`
3. Test that the installation worked: `streamlit hello`

The 'Streamlit Hello' should appear in a new tab in your web browser at [http://localhost:8501](http://localhost:8501)!

## Part 2: Setting up a Streamlit app

Now that Streamlit is installed our virtual environment and we've validated everything is working correctly,
let's set up a minimal Streamlit app:

1. Create a new Python file named `first_app.py`, then open it with your IDE
   or text editor.
2. Next, import Streamlit.
   ```Python
   import streamlit as st
   # To make things easier later, we're also importing numpy and pandas for
   # working with sample data.
   import numpy as np
   import pandas as pd
   ```
3. Run your app from a terminal window (i.e. `Terminal` for Linux/OSX, `Powershell` for Windows). A new tab will open in your default browser, which will be blank.
   This is expected, as no Streamlit widgets have been defined yet.

   ```bash
   $ streamlit run first_app.py
   ```

   Running a Streamlit app is no different than any other Python script. Whenever you want to view your app, run this command and your Streamlit app
   will be served. You can stop your app at any time by typing **Ctrl+c** in the terminal or by closing its terminal window.

   ```eval_rst
   .. tip::
      Did you know you can also pass a URL to `streamlit run`? This is great when combined with Github Gists. For example:

      `$ streamlit run https://raw.githubusercontent.com/streamlit/demo-uber-nyc-pickups/master/app.py`
   ```

## Part 3: Adding widgets to a Streamlit app

Streamlit has dozens of ways to add UI widgets to your app. Check out our [API reference](api.md) for a complete list.

### Adding a title

Let's add a title to our app by placing this text in the `first_app.py` file:

```Python
st.title('My first app')
```

That's it, your app has a title! You can use specific text functions to add
content to your app, or you can use [`st.write()`](api.html#streamlit.write)
and add your own markdown.

### Writing a data frame

Along with [magic commands](api.html#magic-commands),
[`st.write()`](api.html#streamlit.write) is "Swiss Army knife" of Streamlit. You
can pass almost anything to [`st.write()`](api.html#streamlit.write):
text, data, Matplotlib figures, Altair charts, and more. Don't worry, Streamlit
will figure it out and render things the right way.

```Python
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

### Streamlit "Magic"

You can also write to your app without calling any
Streamlit methods. Streamlit supports "[magic
commands](api.html#magic-commands)," which means you don't have to use
[`st.write()`](api.html#streamlit.write) at all! Try replacing the code above
with this snippet:

```Python
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

Any time that Streamlit sees a variable or a literal value on its own line, it automatically
writes its value to your app using [`st.write()`](api.html#streamlit.write). For more information,
refer to the documentation on [magic commands](api.html#magic-commands).

### Drawing charts and maps

Streamlit supports several popular data charting libraries like [Matplotlib,
Altair, deck.gl, and more](api.html#display-charts). In this section, you'll
add a bar chart, line chart, and a map to your app.

#### Drawing a line chart

You can easily add a line chart to your app with
[`st.line_chart()`](api.html#streamlit.line_chart). We'll generate a random
sample using Numpy and then chart it.

```Python
chart_data = pd.DataFrame(
     np.random.randn(20, 3),
     columns=['a', 'b', 'c'])

st.line_chart(chart_data)
```

#### Plotting a map

With [`st.map()`](api.html#streamlit.map) you can display data points on a map.
Let's use Numpy to generate some sample data and plot it on a map of
San Francisco.

```Python
map_data = pd.DataFrame(
    np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
    columns=['lat', 'lon'])

st.map(map_data)
```

### Adding interactivity with widgets

With widgets, Streamlit allows you to bake interactivity directly into your
apps with checkboxes, buttons, sliders, and more. Check out our [API
reference](api.md) for a full list of interactive widgets.

#### Using checkboxes to show/hide data

One use case for checkboxes is to hide or show a specific chart or section in
an app. [`st.checkbox()`](api.html#streamlit.checkbox) takes a single argument,
the widget's label. In this sample, the checkbox is used to toggle a
conditional statement.

```Python
if st.checkbox('Show dataframe'):
    chart_data = pd.DataFrame(
       np.random.randn(20, 3),
       columns=['a', 'b', 'c'])

    st.line_chart(chart_data)
```

#### Using a selectbox for options

Use [`st.selectbox`](api.html#streamlit.selectbox) to choose from a series. You
can write in the options you want as a literal array, or pass through an array or data frame
column.

Let's use the `df` data frame we created earlier.

```Python
option = st.selectbox(
    'Which number do you like best?',
     df['first column'])

'You selected: ', option
```

#### Putting widgets in a sidebar

For a cleaner look, you can move your widgets into a sidebar. This keeps your
app central, while widgets are pinned to the left. Here's how to use [`st.sidebar`](api.html#add-widgets-to-sidebar) in your app.

```Python
option = st.sidebar.selectbox(
    'Which number do you like best?',
     df['first column'])

'You selected:', option
```

Most of the elements you can put into your app can also be put into a sidebar using this syntax:
`st.sidebar.[element_name]()`, including:

- `st.sidebar.markdown()`
- `st.sidebar.slider()`
- `st.sidebar.line_chart()`

Currently, the only exceptions to using widgets in the sidebar right now are `st.write` (you
should use `st.sidebar.markdown()` instead), `st.echo`, and `st.spinner`.

#### Showing calculation progress

When adding long running computations to an app, you can use
[`st.progress()`](api.html#streamlit.progress) to display the calculation status.
For this example, we'll use `time.sleep()` to simulate a long running computation:

```Python
import time
```

Now, let's create a progress bar:

```Python
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

## Part 4: Recording a screencast (optional)

After you've built a Streamlit app, you may want to discuss some of it with co-workers over email or Slack, or share it with the world on Twitter.
A great way to share your app is by using the Streamlit built-in screencast recorder. With it, you can record, narrate, stop, save, and share with a few clicks.

To start a screencast, locate the menu in the upper right corner of your app (**☰**), select **Record a screencast**, and follow the prompts.
Before the recording starts, you'll see a countdown — this means it's showtime.

To stop your screencast, go back to the menu (**☰**) and select **Stop recording** (or hit the **ESC** key). Follow the prompts to preview your recording and save it to disk. That's it, you're ready to share your Streamlit app.

```eval_rst
.. image:: ./media/screenshare.gif
```

## Getting help with Streamlit

If you run into difficulties building your own Streamlit apps, here are a few resources you can turn to:

- Stop by the [community forum](https://discuss.streamlit.io/) and post a question
- Get quick help from command line with `$ streamlit --help`
- Read more documentation!
  - [Tutorials](tutorial/index.md) to make an app
  - [Advanced concepts](advanced_concepts.md) for things like caching and
    inserting elements out of order
  - [API reference](api.md) for examples of every Streamlit command
