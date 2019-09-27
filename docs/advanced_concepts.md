# Advanced concepts

{{ Needs some introductory text }}

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

## Animate elements

## Append data to a table or chart

## Return the value of a Streamlit call

Coming soon! Ping us in the [community forum](https://discuss.streamlit.io/) if you just can't wait and have to have this info immediately.

## Advanced caching

Coming soon! Ping us in the [community forum](https://discuss.streamlit.io/) if you just can't wait and have to have this info immediately.
