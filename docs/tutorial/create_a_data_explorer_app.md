# Tutorial: Create a data explorer app

If you've made it this far, chances are you've
[installed Streamlit](https://docs.streamlit.io/en/latest/#install-streamlit) and
run through the basics in our [get started guide](../getting_started.md). If
not, now is a good time to take a look.

In this tutorial, you're going to use Streamlit's core features to
create an interactive app; exploring a public Uber dataset for pickups and
drop-offs in New York City. When you're finished, you'll know how to fetch
and cache data, draw charts, plot information on a map, and use interactive
widgets, like a slider, to filter results.

```eval_rst
.. tip::
  If you'd like to skip ahead and see everything at once, the `complete script
  is available below <#let-s-put-it-all-together>`_.
```

## Create an app

1. The first step is to create a new Python script. Let's call it
   `uber_pickups.py`.
2. Open `uber_pickups.py` in your favorite IDE or text editor, then add these
   lines:
   ```Python
   import streamlit as st
   import pandas as pd
   import numpy as np
   ```
3. Every good app has a title, so let's add one:
   ```Python
   st.title('Uber pickups in NYC')
   ```
4. Now it's time to run Streamlit from the command line:
   ```Bash
   $ streamlit run uber_pickups.py
   ```
5. As usual, the app should automatically open in a new tab in your
   browser.

## Fetch some data

Now that you have an app, the next thing you'll need to do is fetch the Uber
dataset for pickups and drop-offs in New York City.

1. Let's start by writing a function to load the data. Add this code to your
   script:

   ```Python
   DATE_COLUMN = 'date/time'
   DATA_URL = ('https://s3-us-west-2.amazonaws.com/'
            'streamlit-demo-data/uber-raw-data-sep14.csv.gz')

   def load_data(nrows):
       data = pd.read_csv(DATA_URL, nrows=nrows)
       lowercase = lambda x: str(x).lower()
       data.rename(lowercase, axis='columns', inplace=True)
       data[DATE_COLUMN] = pd.to_datetime(data[DATE_COLUMN])
       return data
   ```

   You'll notice that `load_data` is a plain old function that downloads some
   date, puts it in a Pandas dataframe, and converts the date column from text
   to datetime. The function accepts a single parameter (`nrows`), which
   specifies the number of rows that you want to load into the dataframe.

2. Now let's test the function and review the output. Below your function, add
   these lines:

   ```Python
   # Create a text element and let the reader know the data is loading.
   data_load_state = st.text('Loading data...')
   # Load 10,000 rows of data into the dataframe.
   data = load_data(10000)
   # Notify the reader that the data was successfully loaded.
   data_load_state.text('Loading data...done!')
   ```

   You'll see a few buttons in the upper-right corner of your app asking if
   you'd like to rerun the app. Choose **Always rerun**, and you'll see your
   changes automatically each time you save.

Ok, that's underwhelming...

It turns out that it takes a long time to download data, and load 10,000 lines
into a dataframe. Converting the date column into datetime isn’t a quick job
either. You don’t want to reload the data each time the app is updated –
luckily Streamlit allows you to cache the data.

## Effortless caching

1. Try adding `@st.cache` before the `load_data` declaration:

   ```python
   @st.cache
   def load_data(nrows):
   ```

2. Then save the script, and Streamlit will automatically rerun your app. Since
   this is the first time you’re running the script with `@st.cache`, you won't
   see anything change. Let’s tweak your file a little bit more so that you can
   see the power of caching.

3. Replace the line `data_load_state.text('Loading data...done!')` with this:

   ```python
   data_load_state.text("Done! (using st.cache)")
   ```

4. Now save. See how the line you added appeared immediately? If you take a
   step back for a second, this is actually quite amazing. Something magical is
   happening behind the scenes, and it only takes one line of code to activate
   it.

### How's it work?

Let's take a few minutes to discuss how `@st.cache` actually works.

When you mark a function with Streamlit’s cache annotation, it tells Streamlit
that whenever the function is called that it should check three things:

1. The actual bytecode that makes up the body of the function
2. Code, variables, and files that the function depends on
3. The input parameters that you called the function with

If this is the first time Streamlit has seen these items, with these exact
values, and in this exact combination, it runs the function and stores the
result in a local cache. The next time the function is called, if the three
values haven't changed, then Streamlit knows it can skip executing the function
altogether. Instead, it reads the output from the local cache and passes it on
to the caller -- like magic.

"But, wait a second," you’re saying to yourself, "this sounds too good to be
true. What are the limitations of all this awesomesauce?"

Well, there are a few:

1. Streamlit will only check for changes within the current working directory.
   This means that Streamlit only detects code updates inside installed Python
   libraries.
2. If your function is not deterministic (that is, its output depends on random
   numbers), or if it pulls data from an external time-varying source (for
   example, a live stock market ticker service) the cached value will be
   none-the-wiser.
3. Lastly, you should not mutate the output of a cached function since cached
   values are stored by reference (for performance reasons and to be able to
   support libraries such as TensorFlow). Note that, here, Streamlit is smart
   enough to detect these mutations and show a loud warning explaining how to
   fix the problem.

While these limitations are important to keep in mind, they tend not to be an
issue a surprising amount of the time. Those times, this cache is really
transformational.

```eval_rst
.. tip::
  Whenever you have a long-running computation in your code, consider
  refactoring it so you can use `@st.cache`, if possible.
```

Now that you know how caching with Streamlit works, let’s get back to the Uber
pickup data.

## Inspect the raw data

It's always a good idea to take a look at the raw data you're working with
before you start working with it. Let's add a subheader and a printout of the
raw data to the app:

```Python
st.subheader('Raw data')
st.write(data)
```

In the [get started guide](../getting_started.md) you learned that
[`st.write`](../api.html#streamlit.write) will render almost anything you pass
to it. In this case, you're passing in a dataframe and it's rendering as an
interactive table.

[`st.write`](../api.html#streamlit.text) tries to do the right thing based on
the data type of the input. If it isn't doing what you expect you can use a
specialized command like [`st.dataframe`](../api.html#streamlit.dataframe)
instead. For a full list, see [API reference](../api.md).

Alternatively, you could use a specialized statement, like
[`st.dataframe()`](../api.html#streamlit.dataframe), to add a specific
dataset to your app.

## Draw a histogram

Now that you've had a chance to take a look at the dataset and observe what's
available, let's take things a step further and draw a histogram to see what
Uber's busiest hours are in New York City.

1. To start, let's add a subheader just below the raw data section:
   ```Python
   st.subheader('Number of pickups by hour')
   ```
2. Use NumPy to generate a histogram that breaks down pickup times binned by
   hour:
   ```Python
   hist_values = np.histogram(
       data[DATE_COLUMN].dt.hour, bins=24, range=(0,24))[0]
   ```
3. Now, let's use Streamlit's
   [`st.bar_chart()`](../api.html#streamlit.bar_chart) method to draw this
   histogram.
   ```Python
   st.bar_chart(hist_values)
   ```
4. Save your script. This histogram should show up in your app right away.
   After a quick review, it looks like the busiest time is 17:00 (5 P.M.).

To draw this diagram we used Streamlit's native `bar_chart()` method, but it's
important to know that Streamlit supports more complex charting libraries like
Altair, Bokeh, Plotly, Matplotlib and more. For a full list, see
[supported charting libraries](../api.html#display-charts).

## Plot data on a map

Using a histogram with Uber's dataset helped us determine what the busiest
times are for pickups, but what if we wanted to figure out where pickups were
concentrated throughout the city. While you could use a bar chart to show this
data, it wouldn't be easy to interpret unless you were intimately familiar with
latitudinal and longitudinal coordinates in the city. To show pickup
concentration, let's use Streamlit [`st.map()`](../api.html#streamlit.map)
function to overlay the data on a map of New York City.

1. Add a subheader for the section:
   ```Python
   st.subheader('Map of all pickups')
   ```
2. Use the `st.map()` function to plot the data:
   ```Python
   st.map(data)
   ```
3. Save your script. The map is fully interactive. Give it a try by panning or
   zooming in a bit.

After drawing your histogram, you determined that the busiest hour for Uber
pickups was 17:00. Let's redraw the map to show the concentration of pickups
at 17:00.

1. Locate the following code snippet:
   ```Python
   st.subheader('Map of all pickups')
   st.map(data)
   ```
2. Replace it with:
   ```Python
   hour_to_filter = 17
   filtered_data = data[data[DATE_COLUMN].dt.hour == hour_to_filter]
   st.subheader(f'Map of all pickups at {hour_to_filter}:00')
   st.map(filtered_data)
   ```
3. You should see the data update instantly.

To draw this map we used a simple map function that's built into Streamlit, but
if you'd like to visualize complex map data, we encourage you to take a look at
the [`st.deckgl_chart`](../api.html#streamlit.deck_gl_chart).

## Filter results with a slider

In the last section, when you drew the map, the time used to filter results was
hardcoded into the script, but what if we wanted to let a reader dynamically
filter the data in real time? Using Streamlit's widgets you can. Let's add a
slider to the app with the `st.slider()` method.

1. Locate `hour_to_filter` and replace it with this code snippet:
   ```Python
   hour_to_filter = st.slider('hour', 0, 23, 17)  # min: 0h, max: 23h, default: 17h
   ```
2. Use the slider and watch the map update in real time.

## Use a button to toggle data

Sliders are just one way to dynamically change the composition of your app.
Let's use the [`st.checkbox`](../api.html#streamlit.checkbox) function to add a
checkbox to your app. We'll use this checkbox to show/hide the raw data
table at the top of your app.

1. Locate these lines:

   ```Python
   st.subheader('Raw data')
   st.write(data)
   ```

2. Replace these lines with the following code:
   ```Python
   if st.checkbox('Show raw data'):
       st.subheader('Raw data')
       st.write(data)
   ```

We're sure you've got your own ideas. When you're done with this tutorial,
check out all the widgets that Streamlit exposes in our [API
reference](../api.md).

## Let's put it all together

That's it, you've made it to the end. Here's the complete script for our interactive
app.

```eval_rst
.. tip::
  If you've skipped ahead, after you've created your script, the command to run
  Streamlit is `streamlit run [app name]`.
```

```Python
import streamlit as st
import pandas as pd
import numpy as np

st.title('Uber pickups in NYC')

DATE_COLUMN = 'date/time'
DATA_URL = ('https://s3-us-west-2.amazonaws.com/'
            'streamlit-demo-data/uber-raw-data-sep14.csv.gz')

@st.cache
def load_data(nrows):
    data = pd.read_csv(DATA_URL, nrows=nrows)
    lowercase = lambda x: str(x).lower()
    data.rename(lowercase, axis='columns', inplace=True)
    data[DATE_COLUMN] = pd.to_datetime(data[DATE_COLUMN])
    return data

data_load_state = st.text('Loading data...')
data = load_data(10000)
data_load_state.text("Done! (using st.cache)")

if st.checkbox('Show raw data'):
    st.subheader('Raw data')
    st.write(data)

st.subheader('Number of pickups by hour')
hist_values = np.histogram(data[DATE_COLUMN].dt.hour, bins=24, range=(0,24))[0]
st.bar_chart(hist_values)

# Some number in the range 0-23
hour_to_filter = st.slider('hour', 0, 23, 17)
filtered_data = data[data[DATE_COLUMN].dt.hour == hour_to_filter]

st.subheader('Map of all pickups at %s:00' % hour_to_filter)
st.map(filtered_data)
```
