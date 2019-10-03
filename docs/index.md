```eval_rst
.. toctree::
   :caption: Documentation
   :maxdepth: 2
   :hidden:

   Home <https://streamlit.io/docs/>
   main_concepts
   getting_started

   tutorial/index
   advanced_concepts

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

Streamlit is an open-source Python library that makes it easy to build
beautiful apps for machine learning.

Install Streamlit, import it, write some code, and run your script. Streamlit
watches for changes on each save and updates automatically, visualizing your
output while you're coding. Code runs from top to bottom, always from a clean
state, and with no need for callbacks. It's a simple and powerful app model
that lets you build rich UIs incredibly quickly. To learn more about how
Streamlit works, see [Main concepts](main_concepts.md).

```eval_rst
.. raw:: html

  <iframe
    width="560"
    height="315"
    src="https://www.youtube.com/embed/B2iAodr0fOo"
    style="margin: 0 0 2rem 0;"
    frameborder="0"
    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen></iframe>
```

## Install Streamlit

Follow these steps and you'll have a sample app running in less than 5 minutes.

1. Before you do anything else, make sure that you have [Python 2.7.0 or later
   / Python 3.6.x or later](https://www.python.org/downloads/).
2. Install Streamlit using [PIP](https://pip.pypa.io/en/stable/installing/):
   ```bash
   $ pip install streamlit
   ```
3. Run the hello world app:

   ```bash
   $ streamlit hello
   ```

4. That's it! In the next few seconds the sample app will open in a new tab in
   your default browser.

## Get started

The easiest way to learn how to use Streamlit is to try it out. Use our [get
started guide](getting_started.md) to kick the tires, and learn the basics of
building an app.

## Build your first app

[Create an app](tutorial/create_a_data_explorer_app.md) to explore an Uber
dataset for pickups in New York City. You'll learn about caching, drawing
charts, plotting data on a map, and how to use interactive widgets.

## Join the community

The quickest way to get help is to reach out on our [community
forum](https://discuss.streamlit.io/). We'd love to hear your questions, ideas,
and bugs — please share!
