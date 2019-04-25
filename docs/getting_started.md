```eval_rst
:tocdepth: 1
```

# Get started

If you've made it this far, you probably have an idea of what you can do with Streamlit (if you don't, watch [this video](replace-with-link-to-demo)). In this guide, we'll introduce you to the core features and how they are used to create a report.

The easiest way to learn to use Streamlit is to try things out. As you read through this guide, test each method. As long as your report is running, every time you save, the changes are displayed in the browser almost instantly.

## Prerequisites

Before you get started, you're going to need a few things:

* Your favorite IDE or text editor
* [Python 2.7.0 or later / Python 3.6.x or later](https://www.python.org/downloads/)
* One of these package management tools:
  * [PIP](https://pip.pypa.io/en/stable/installing/)
  * [Conda](https://docs.conda.io/projects/conda/en/latest/user-guide/install/)

## Install Streamlit

Regardless of which package management tool you're using, we recommend running these commands in a virtual environment. This ensures that the dependencies pulled in for Streamlit don't impact any other your other Python projects you're working on.

### PIP

If you're using PIP to install Streamlit, don't worry, some of the more popular data science and machine learning libraries like Numpy and Pandas are downloaded during installation.

Run this command to install Streamlit via PIP:

```bash
pip install streamlit
```

### Conda

Run this command to install Streamlit with Conda:

```bash
# Add required channels.
conda config --add channels conda-forge
conda config --add channels https://repo.streamlit.io/streamlit-forge

# Install Streamlit!
conda install streamlit
```

## Import Streamlit

Now that everything's installed, you'll need to create a file for your report and import Streamlit.

1. Create a new Python file named `first_report.py`, then open it with your IDE or text editor.
2. Import Streamlit: <<Consider adding a single line, like title or welcome.>>

   ```Python
   import streamlit

   # Don't worry, we'll explain this method in
   # the next section.
   streamlit.title("My first report")
   ```

3. Run your report. This will open a new tab in your default browser. You won't see much -- just a title -- but in the next few sections we'll populate the report with text, charts, and histograms.

   ```bash
   python first_report.py
   ```

   Running a Streamlit report is no different than any other Python script. Whenever you need to view the report, you can use this command.

## Add text to a report

A good report isn't just charts and data visualizations, it needs clear and detailed explanations. Streamlit provides a handful of methods that let you add titles, headers, and text to your reports.

```eval_rst
.. tip::
   This guide focuses on Streamlit's core features. We're adding new functionality all the time, so make sure that you check out our [API reference](https://streamlit.io/secret/docs/api/text.html) for a full list of features.
```

### Start with a title

Most reports start with a title. With Streamlit, you'll use [`streamlite.title`](https://streamlit.io/secret/docs/api/text.html#streamlit.title) to add a title to your report.

```eval_rst
.. tip::
   Use `streamlit.title` sparingly. Most reports only need one.
```

This should look familiar. You added this line below the import statement:

```python
streamlit.title("My first report")
```

### Organize with headers

To help you organize the content of your report, there are two methods that allow you to create headers: [`streamlit.header()`](https://streamlit.io/secret/docs/api/text.html#streamlit.header) and [`streamlit.subheader()`](https://streamlit.io/secret/docs/api/text.html#streamlit.subheader).

```python
streamlit.header("I'm a large heading")
streamlit.subheader("I'm not a large heading")
```

### Write some sentences

There's more than one way to add text to your reports. Whether you're working with plain text, markdown, or want the flexibility to use both, Streamlit's got you covered. Let's take a look at each method and when you should use it. Don't forget, you need to save after adding a method to your report so that it'll show up in the browser.

If you want to add some simple fixed-width text to your report use [`streamlit.text()`](https://streamlit.io/secret/docs/api/text.html#streamlit.text).

```python
streamlit.text("Welcome to Streamlit.")
```

There are times when you need more than plain text. With [`streamlit.markdown`](https://streamlit.io/secret/docs/api/text.html#streamlit.text) you can write content for your report in [Github-flavored markdown](https://github.github.com/gfm/). This method is perfect for when you need to empahize text with bold or italics, or add a link to related documentation.

```python
streamlit.markdown("**NOTE:** Markdown is perfect for when you want to *empahsize* elements in your report.")
```

There's one more method we're going to cover that allows you to add text to a report. [`streamlit.write()`](https://streamlit.io/secret/docs/api/text.html#streamlit.write) is the only text method that accepts multiple arguments and data types. We consider it the "Swiss Army knife" of Streamlit commands. It's behavior will change depending on the content that's provided. However, it's not without limitations, so we encourage you to review the [API reference](https://streamlit.io/secret/docs/api/text.html#streamlit.write).

Let's take a look at how you can use `streamlit.write()` to display text and a Pandas data frame:

```eval_rst
.. note::
   Streamlit has dedicated methods that can be used to create data frames, charts, histograms and more. We'll cover those in the next section.
```

```python
import streamlit
import pandas

streamlit.write("Here's our first attempt at using data to create a table:")
streamlit.write(pandas.DataFrame({
  'first column': [1, 2, 3, 4],
  'second column': [10, 20, 30, 40]
}))
```

## Visualize data

Text is great, but Streamlit's true power comes from the ability to quickly manipulate data, display it, and share it. In this section, you'll learn how to use Streamlit commands that are used with data frames, charts, histograms, and more.

```eval_rst
.. tip::
   This guide focuses on Streamlit's core features. We're adding new functionality all the time, so make sure that you check out our API reference for [data](https://streamlit.io/secret/docs/api/data.html) and [charts](https://streamlit.io/secret/docs/api/charts.html).
```

## Update text, charts, and tables

<< Explain that any element can be updated... >>

### Replace text with text

<< Not sure this needs a heading, but there should be a representative example... >>

### Replace text with a data frame/chart

<< Not sure this needs a heading, but there should be a representative example... >>

### Append data to a table

<< Not sure this needs a heading, but there should be a representative example... >>

## Order report elements