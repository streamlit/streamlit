# Get started

If you've made it this far, you probably have an idea of what you can do with Streamlit (if you don't, watch [this video](https://streamlit.io/secret/demo/)). In this guide, we'll introduce you to Streamlit's core features and how they are used to create a report.

The easiest way to learn how to use Streamlit is to try things out yourself. As you read through this guide, test each method. As long as your report is running, every time you add a new element to your script and save, Streamlit's UI will ask if you'd like to rerun the report and view the changes. This allows you to work in a fast interactive loop: you write some code, save it, review the output, write some more, and so on, until you’re happy with the results. The goal is to use Streamlit to review your code, debug it, perfect it, and share it. What's drawn in the report is completely up to you.

Use the links below to jump to a specific section:

```eval_rst
.. contents::
    :local:
    :depth: 1
```

## Prerequisites

Before you get started, you're going to need a few things:

* Your favorite IDE or text editor
* [Python 2.7.0 or later / Python 3.6.x or later](https://www.python.org/downloads/)
* One of these package management tools:
  * [PIP](https://pip.pypa.io/en/stable/installing/)
  * [Conda](https://docs.conda.io/projects/conda/en/latest/user-guide/install/)
* [Streamlit](index.md) - Follow these instructions to install Streamlit if you haven't already.

## Set up your virtual environment

Regardless of which package management tool you're using, we recommend running these commands in a virtual environment. This ensures that the dependencies pulled in for Streamlit don't impact any other your other Python projects you're working on.

If you're using Conda, you have access to virtual environments by default. If you need help getting a virtual environment setup, see [Managing environments](https://docs.conda.io/projects/conda/en/latest/user-guide/tasks/manage-environments.html).

If you're not using Conda, you have a few options:
* [virtualenv](https://virtualenv.pypa.io/en/latest/)
* [venv](https://docs.python.org/3/library/venv.html)
* [pipenv](https://docs.pipenv.org/en/latest/)

## Import Streamlit

Now that everything's installed, let's create a new Python script and import Streamlit.

1. Create a new Python file named `first_report.py`, then open it with your IDE or text editor.
2. Import Streamlit and add a title. At least one call to Streamlit is required to generate a report.

   ```Python
   import streamlit
   # To make things easier later, we're also importing numpy and pandas for working with sample data.
   import numpy
   import pandas

   # Don't worry, we'll explain this method in the next section. We need to make at least one
   # call to Streamlit in order to generate a report.
   streamlit.title("My first report")
   ```

3. Run your report. A new tab will open in your default browser, and you should see a title. In the next few sections we'll populate the report with additional text, tables, and charts.

   ```bash
   $ streamlit run first_report.py
   ```

   Running a Streamlit report is no different than any other Python script. Whenever you need to view the report, you can use this command.

4. You can kill the report at any time by typing **Ctrl+c** in the terminal.

## Add text to a report

A good report isn't just charts and data visualizations, it needs clear and detailed explanations. Streamlit provides a handful of methods that let you add titles, headers, and text to your reports.

```eval_rst
.. tip::
   This guide focuses on Streamlit's core features. We're adding new functionality all the time, so make sure that you check out our `API reference <api.html#display-text>`_ for a full list of features.
```

### Start with a title

Most reports start with a title. With Streamlit, you'll use [`streamlit.title`](api.html#streamlit.title) to add a title to your report.

```eval_rst
.. tip::
   Use `streamlit.title` sparingly. Most reports only need one.
```

This should look familiar. You added this line below the import statement:

```python
streamlit.title("My first report")
```

### Organize with headers

To help you organize the content of your report, there are two methods that allow you to create headers: [`streamlit.header()`](api.html#streamlit.header) and [`streamlit.subheader()`](api.html#streamlit.subheader).

```python
streamlit.header("I'm a large heading")
streamlit.subheader("I'm not a large heading")
```

### Write some sentences

There's more than one way to add text to your reports. Whether you're working with plain text, markdown, or want the flexibility to use both, Streamlit's got you covered. Let's take a look at each method and when you should use it. Don't forget, you need to save after adding a method to your report so that it'll show up in the browser.

If you want to add some simple fixed-width text to your report use [`streamlit.text()`](api.html#streamlit.text).

```python
streamlit.text("Welcome to Streamlit.")
```

There are times when you need more than plain text. With [`streamlit.markdown`](api.html#streamlit.text) you can write content for your report in [Github-flavored markdown](https://github.github.com/gfm/). This method is perfect for when you need to emphasize text with bold or italics, or add a link to related documentation.

```python
streamlit.markdown("**NOTE:** Markdown is perfect for when you want to *empahsize* elements in your report.")
```

There's one more method we're going to cover that allows you to add text to a report. [`streamlit.write()`](api.html##streamlit.write) is the only text method that accepts multiple arguments and data types. We consider it the "Swiss Army knife" of Streamlit commands.

You can pass almost anything to `streamlit.write()`: text, data, Matplotlib figures, Altair charts, and more. Don't worry, Streamlit will figure it our and render it the right way. While powerful, there are limitations, so we encourage you to review the [API reference](api.html#streamlit.write).

Let's take a look at how you can use `streamlit.write()` to display text and a Pandas data frame:

```eval_rst
.. note::
   Streamlit has dedicated methods that can be used to visualize data frames, charts, histograms and more. We'll cover those in the next section.
```

```python
streamlit.write("Here's our first attempt at using data to create a table:")
streamlit.write(pandas.DataFrame({
  'first column': [1, 2, 3, 4],
  'second column': [10, 20, 30, 40]
}))
```

## Visualize data

Text is great, but Streamlit's strength is the ability to quickly manipulate data, display it, and share it. In this section, you'll learn how to use Streamlit methods to create interactive tables, charts, histograms, and more.

```eval_rst
.. tip::
   This guide focuses on Streamlit's core features. We're adding new functionality all the time, so make sure that you check out our API reference for `data <api.html#display-data>`_ and `charts <api.html#display-charts>`_.
```

### Display data and tables

There are a few ways to display data (tables, arrays, data frames) in Streamlit reports. In the previous section, you were introduced to `streamlit.write()`, which can be used to write anything from text to tables. Now let's take a look at methods designed specifically for visualizing data. You might be asking yourself, "why wouldn't I always you `streamlit.write()`?" The main reason is that you can't reuse the slot in the report created by `streamlit.write()`. Put simply, you can't update any elements created with `streamlit.write()`.

Let's create a data frame. In this sample, you'll use Numpy to generate a random sample, and the [`streamlit.dataframe()`](api.html#streamlit.dataframe) method to draw the interactive table.

```eval_rst
.. note::
   This sample uses Numpy to generate a random sample, but you can use Pandas DataFrames, Numpy arrays, or plain Python arrays.
```

```Python
dataframe = numpy.random.randn(10, 20)
streamlit.dataframe(dataframe)
```

Let's expand on the first example using the Pandas `Styler` object to highlight some elements in the interactive table.

```eval_rst
.. note::
   If you used PIP to install Streamlit, you'll need to install Jinja2 to use the Styler object. To install Jinja2, run: `pip install jinja2`.
```

```Python
dataframe = pandas.DataFrame(
    numpy.random.randn(10, 20),
    columns=("col %d" % i for i in range(20)))

streamlit.dataframe(dataframe.style.highlight_max(axis=0))
```

Streamlit also has a method for static table generation: [`streamlit.table()`](api.html#streamlit.table).

```Python
dataframe = pandas.DataFrame(
    numpy.random.randn(10, 20),
    columns=("col %d" % i for i in range(20)))
streamlit.table(dataframe)
```

### Draw bar charts, line charts, and maps

Streamlit supports several popular data charting libraries that allow you to add different types of charts and data representations to your reports, like Matplotlib, Altair, Deck.Gl, and more. In this section, you'll add a bar chart, line chart, and a map to your report. If you'd like to see a full list of supported charts and libraries, see [API reference](api.html#display-charts).

The [`streamlit.bar_chart()`](api.html#streamlit.bar_chart) allows you to add bar charts to your report. This example uses a Pandas data frame with three columns as the data source.

```Python
chart_data = pandas.DataFrame(
    [[20, 30, 50]],
    columns=['a','b', 'c'])

streamlit.bar_chart(chart_data)
```

Drawing a line chart is just as easy as drawing a bar chart with [`streamlit.line_chart()`](api.html#streamlit.line_chart). The only difference is that we're going to generate a random sample using Numpy.

```Python
chart_data = pandas.DataFrame(
     numpy.random.randn(20, 3),
     columns=['a', 'b', 'c'])

streamlit.line_chart(chart_data)
```

With [`streamlit.map()`](api.html#streamlit.map) you can display data points on a map. Let's use Numpy to generate some sample data and plot it on San Francisco.

```Python
map_data = pandas.DataFrame(
    numpy.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
    columns=['lat', 'lon'])

streamlit.map(map_data)
```

## Update existing elements

Every time you update your report and save, Streamlit's UI will ask if you'd like to **rerun** the report. Then Streamlit, does a bunch of computer-sciencey magic to make sure your report is updated efficiently and rendered in the browser.

In this section, you'll learn how to update existing elements in a report.

### Replace text with text

Whenever you use a Streamlit method to place text, charts, or data into your Streamlit report, a reference to that element is returned. You can call methods on that reference to update the element with more data, or completely replace it with something else.

Let's start with an easy example. Here you're going to create a text element, then update (or overwrite) that element.

```Python
my_element = streamlit.text("Hello sun.")
# Draws "Hello sun" in the Streamlit report,
# and saves that reference. This slot can be reused.

my_element.text("Goodnight moon.")
# Replaces "Hello sun" with "Goodnight moon" in the report.
```

### Replace text with a data frame/chart

Now, let's replace the text element with a dataframe.

```Python
# You'll use time to simulate loading data
import time

# Draws "Loading data..." in the Streamlit report.
my_second_element = streamlit.text("Loading data...")

update_dataframe = pandas.DataFrame(
    numpy.random.randn(10, 20),
    columns=("col %d" % i for i in range(20)))

# Simulates loading a large data set.
time.sleep(5)

# Replaces "Loading data..." with a table containing sample data.
my_second_element.dataframe(update_dataframe)
```

### Append data to a chart

You can do more than just replace elements. You can also add to and modify existing elements, like charts and tables. Let's take a look at how you'd add a row to a line chart.

```Python
# Get some data.
data = numpy.random.randn(10, 2)

# Show the data as a chart.
chart = streamlit.line_chart(data)

# Wait 1 second, so the change is clearer.
time.sleep(1)

# Grab some more data.
data2 = numpy.random.randn(10, 2)

# Append the new data to the existing chart.
chart.add_rows(data2)
```

## Order the elements of a report

So far you've learned how to use the methods exposed by Streamlit to add new elements to a report. These have all been additive, with the assumption that you already know what you want to add to the report. What if you're unsure of the structure, or need to add a placeholder for content that isn't quite ready? That's where [`streamlit.empty()`](api.html#streamlit.empty) comes in handy. It allows you to add an empty slot to your report that you can update at any time.

Let's take a look at how you can use `streamlit.empty` to add structure to a report.

```Python
## Appends a title to the report.
streamlit.title("Report with placeholders")

# Appends some text to the report.
streamlit.text("Some interesting text about your interesting project.")

# Appends an empty slot to the report.
my_slot1 = streamlit.empty()

# Appends another empty slot to the report.
my_slot2 = streamlit.empty()

# Appends some more text to the report.
streamlit.text("This is where you provide a killer conclusion.")

# Replaces the first empty slot with a text string.
my_slot1.text("You can use a slot whenever you have something to say, draw, or represent.")

# Replaces the second empty slot with a chart.
my_slot2.line_chart(numpy.random.randn(20, 2))
```

## What's next?

* [Learn how to speed up your reports with caching](api/index.md#optimize-performance)
