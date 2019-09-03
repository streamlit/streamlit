```eval_rst
.. toctree::
   :caption: Documentation
   :maxdepth: 2
   :hidden:

   Home <https://streamlit.io/secret/docs/>
   getting_started
   tutorial/index

   core_mechanics

   api
   cli
   changelog

.. toctree::
  :caption: Support
  :maxdepth: 2
  :hidden:

  troubleshooting
  Slack <https://streamlit.slack.com/messages/CG5K38YMT/>

```

# Welcome to Streamlit

Streamlit is an open-source Python library that makes it ridiculously easy to turn your Python script into an interactive app. With just a text editor, a browser and a few lines of pure Python, you can build an interactive frontend for your model or datastore -- converting it into a tool, dashboard, demo, or report in minutes.

Getting started is easy. Install Streamlit, import it, write some code, and run your script.  Streamlit watches for changes on each save and updates automatically, visualizing your output while you’re coding. Your code runs from top to bottom, always from a clean state, just like running an ordinary script. There is no hidden state and no need for callbacks. You can view your code as a pure data flow model where you [cache anything that is expensive](api.md#optimize-performance). It’s a very simple and powerful app model that lets you build rich UIs incredibly quickly. Read more in [Streamlit’s Core Mechanics](core_mechanics.md).

## Install Streamlit

Follow these steps and you'll have a sample report running in less than 5 minutes.

1. Before you do anything, you'll need to make sure that you have [Python 2.7.0 or later / Python 3.6.x or later](https://www.python.org/downloads/).
2. Install Streamlit using [PIP](https://pip.pypa.io/en/stable/installing/) or [Conda](https://docs.conda.io/projects/conda/en/latest/user-guide/install/):

    **PIP**
   ```bash
   $ pip install streamlit
   ```

   **Conda**

   ```bash
   # Add required channels.
   $ conda config --add channels conda-forge
   $ conda config --add channels https://repo.streamlit.io/streamlit-forge

   # Update conda (always a good idea)
   $ conda update conda

   # Install Streamlit!
   $ conda install streamlit
   ```

3. Run the hello world script from terminal:

   ```bash
   $ streamlit hello
   ```
4. That's it! In the next few seconds the sample report will open in a new tab in your default browser.

## Get started

The easiest way to learn how to use Streamlit is to try it out. Use our [get started guide](getting_started.md) to kick the tires, and learn the basics of building a report.

## Build your first interactive report

If you've got the basics covered, the next step is to [create an interactive report](tutorial/create_an_interactive_report.md) from scratch. When you're finished, you'll know how to fetch
and cache data, draw charts, plot information on a map, and use interactive widgets, like sliders and checkboxes, to filter results.

## Some helpful links

The left-hand navigation is the best way to move around our docs site, but we think these articles are important enough to list more than once:

* [Tutorials](tutorial/index.md)
* [API reference](api.md)
* [Troubleshooting guide](troubleshooting.md)
* [Slack support channel](https://streamlit.slack.com/messages/CG5K38YMT/)
