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

Streamlit is a free developer tool for machine learning engineers, designed to make the coding and introspection of models more joyful and efficient. With just a text editor and a browser you can rapidly load data, visualize, explore, interact, debug, and demo -- all in pure Python with no hidden state or callbacks.

Getting started is easy. Install Streamlit, import it, write some code, and run your script. Our tools watch for changes on each save, and will rerun the report instantly – with your permission. Did we mention, we love sharing? Whether you've written a full report that you want to share with your team or need a second set of eyes to inspect your work, Streamlit lets you easily share it with a unique URL.

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

## Build your first report

The next step is to build your first Streamlit report from scratch with our [get started guide](getting_started.md). When you're finished, you'll know how to structure a Streamlit report, visualize data, and add headings and text to organize your observations and conclusions.

## Learn common patterns

Now that you've put together a simple report with our Getting Started guide, learn about [Streamlit's core mechanics](core_mechanics.md). Here you'll learn more about different ways to add elements to a report, how to create animations, and techniques to speed up calculations.

## Some helpful links

The left-hand navigation is the best way to move around our docs site, but we think these articles are important enough to list more than once:

* [Tutorials](tutorial/index.md)
* [API reference](api.md)
* [Troubleshooting guide](troubleshooting.md)
* [Slack support channel](https://streamlit.slack.com/messages/CG5K38YMT/)
