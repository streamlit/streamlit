```eval_rst
.. toctree::
   :caption: Documentation
   :maxdepth: 2
   :hidden:

   Home <https://streamlit.io/docs/>
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

  GitHub <https://github.com/streamlit/streamlit>
  Community forum < https://discuss.streamlit.io/>
  troubleshooting

```

# Welcome to Streamlit

Streamlit is an open-source Python library that makes it ridiculously easy to turn your Python script into an interactive app. With just a text editor, a browser and a few lines of pure Python, you can build an interactive frontend for your model or datastore -- converting it into a tool, dashboard, demo, or app in minutes.

Getting started is easy. Install Streamlit, import it, write some code, and run your script. Streamlit watches for changes on each save and updates automatically, visualizing your output while you’re coding. Your code runs from top to bottom, always from a clean state, just like running an ordinary script. There is no hidden state and no need for callbacks. You can view your code as a pure data flow model where you [cache anything that is expensive](api.md#optimize-performance). It’s a very simple and powerful app model that lets you build rich UIs incredibly quickly. Read more in [Streamlit’s Core Mechanics](core_mechanics.md).

## Install Streamlit

Follow these steps and you'll have a sample app running in less than 5 minutes.

1. Before you do anything else, make sure that you have [Python 2.7.0 or later / Python 3.6.x or later](https://www.python.org/downloads/).
2. Install Streamlit using [PIP](https://pip.pypa.io/en/stable/installing/):
   ```bash
   $ pip install streamlit
   ```
3. Run the hello world app:

   ```bash
   $ streamlit hello
   ```

4. That's it! In the next few seconds the sample app will open in a new tab in your default browser.

## Get started

The easiest way to learn how to use Streamlit is to try it out. Use our [get started guide](getting_started.md) to kick the tires, and learn the basics of building an app.

## Build your first app

[Create an app](tutorial/create_an_interactive_app.md) to explore an Uber dataset for pickups in New York City. You'll learn about caching, drawing charts, plotting data on a map, and how to use interactive widgets.

## Join the community

The quickest way to get help is to reach out on our [community forum](https://discuss.streamlit.io/). We'd love to hear your questions, ideas, and bugs - please share!
