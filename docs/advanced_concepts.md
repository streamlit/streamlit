# Advanced concepts

Now that you've mastered Streamlit's main concepts, let's take a look at some advanced functionality, like styling data, adjusting the order of elements in a report, and adding animations.

```eval_rst
.. note::
   We're adding these sections as quickly as we can, but please let us know what's important to you. Ping us in the `community forum <https://discuss.streamlit.io/>`_.
```
## Display and style data

There are a few ways to display data (tables, arrays, data frames) in Streamlit apps. In [getting started](getting_started.md), you were introduced to *magic* and [`st.write()`](api.md#streamlit.write), which can be used to write anything from text to tables. Now let's take a look at methods designed specifically for visualizing data.

You might be asking yourself, "why wouldn't I always use st.write()?" There are
a few reasons:

1. *Magic* and [`st.write()`](api.md#streamlit.write) inspect the type of data that you've passed in, and then decide how to best render it in the app. Sometimes you want to draw it another way. For example, instead of drawing a dataframe as an interactive table, you may want to draw it as a static table by using st.table(df).    
2. The second reason is that other methods return an object that can be used and modified by adding data or replacing it with a completely different element.  
3. Finally, if you use a more specific Streamlit method you can pass additional arguments to customize its behavior.  

For example, let's create a data frame and change its formatting with a Pandas `Styler` object. In this sample, you'll use Numpy to generate a random sample, and the [`st.dataframe()`](api.md#streamlit.dataframe) method to draw an interactive table.

```eval_rst
.. note::
   This sample uses Numpy to generate a random sample, but you can use Pandas DataFrames, Numpy arrays, or plain Python arrays.
```

```Python
dataframe = numpy.random.randn(10, 20)
st.dataframe(dataframe)
```

Let's expand on the first example using the Pandas `Styler` object to highlight some elements in the interactive table.

```eval_rst
.. note::
   If you used PIP to install Streamlit, you'll need to install Jinja2 to use the Styler object. To install Jinja2, run: pip install jinja2.
```

```Python
dataframe = pandas.DataFrame(
    numpy.random.randn(10, 20),
    columns=('col %d' % i for i in range(20)))

st.dataframe(dataframe.style.highlight_max(axis=0))
```

Streamlit also has a method for static table generation: [`st.table()`](api.md#streamlit.table).

```Python
dataframe = pandas.DataFrame(
    numpy.random.randn(10, 20),
    columns=('col %d' % i for i in range(20)))
st.table(dataframe)
```

## Insert elements out of order

You can use the [`st.empty`](api.html#streamlit.empty) command so you can
"save" a slot in your app for use later on.

```python
st.text('This will appear first')
# Appends some text to the app.

my_slot1 = st.empty()
# Appends an empty slot to the app. We'll use this later.

my_slot2 = st.empty()
# Appends another empty slot.

st.text('This will appear last')
# Appends some more text to the app.

my_slot1.text('This will appear second')
# Replaces the first empty slot with a text string.

my_slot2.line_chart(np.random.randn(20, 2))
# Replaces the second empty slot with a chart.
```

## Animate elements

If you put together all the tools you learned about above you can create
compelling animations using Streamlit. Just replace elements in the app or
update their data every so often. For example:

```python
progress_bar = st.progress(0)
status_text = st.empty()
chart = st.line_chart(np.random.randn(10, 2))

for i in range(100):
    # Update progress bar.
    progress_bar.progress(i)

    new_rows = np.random.randn(10, 2)

    # Update status text.
    status_text.text(
        'The latest random number is: %s' % new_rows[-1, 1])

    # Append data to the chart.
    chart.add_rows(new_rows)

    # Pretend we're doing some computation that takes time.
    time.sleep(0.1)

status_text.text('Done!')
st.balloons()
```

You can see this example live by running `streamlit hello` on your command
line.

## Append data to a table or chart

In Streamlit, you can not only replace entire elements in your app, but also
modify the data behind those elements. Here is how:

```python
import numpy as np
import time

# Get some data.
data = np.random.randn(10, 2)

# Show the data as a chart.
chart = st.line_chart(data)

# Wait 1 second, so the change is clearer.
time.sleep(1)

# Grab some more data.
data2 = np.random.randn(10, 2)

# Append the new data to the existing chart.
chart.add_rows(data2)
```

## Return the value of a Streamlit call

Coming soon! Ping us in the [community forum](https://discuss.streamlit.io/) if you just can't wait and have to have this info immediately.

## Advanced caching

Coming soon! Ping us in the [community forum](https://discuss.streamlit.io/) if you just can't wait and have to have this info immediately.
