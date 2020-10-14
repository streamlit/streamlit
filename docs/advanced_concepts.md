# Cookbook

Now that you've mastered Streamlit's main concepts, let's take a look at some
advanced functionality, like styling data, adjusting the order of elements in a
report, and adding animations.

```eval_rst
.. note::
   We're adding these sections as quickly as we can, but please let us know
   what's important to you. Ping us in the `community forum
   <https://discuss.streamlit.io/>`_.
```

## Insert elements out of order

You can use the [`st.empty`](api.html#streamlit.empty) method as a placeholder,
to "save" a slot in your app that you can use later.

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

Let's combine some of the things you've learned to create compelling
animations in your app.

```python
progress_bar = st.progress(0)
status_text = st.empty()
chart = st.line_chart(np.random.randn(10, 2))

for i in range(100):
    # Update progress bar.
    progress_bar.progress(i + 1)

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
