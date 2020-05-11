```eval_rst
.. toctree::
   :caption: Documentation
   :maxdepth: 2
   :hidden:

   getting_started
   main_concepts

   tutorial/index
   caching
   advanced_caching
   advanced_concepts

   api
   cli
   pre_release_features
   changelog

.. toctree::
  :caption: Support
  :maxdepth: 2
  :hidden:

  troubleshooting/index
  Frequently Asked Questions < https://github.com/streamlit/streamlit/wiki/FAQ>
  Community forum < https://discuss.streamlit.io/>
  Bug tracker <https://github.com/streamlit/streamlit/issues>
  GitHub <https://github.com/streamlit/streamlit>

```

# Welcome to Streamlit

Streamlit is an open-source Python library that makes it easy to build
beautiful custom web-apps for machine learning and data science.

To use it, just `pip install streamlit`, then import it, write a couple lines
of code, and run your script with `streamlit run [filename]`. Streamlit watches
for changes on each save and updates the app live while you're coding. Code
runs from top to bottom, always from a clean state, and with no need for
callbacks. It's a simple and powerful app model that lets you build rich UIs
incredibly quickly. To learn more about how Streamlit works, see [Main
concepts](main_concepts.md).

You may also want to check out [this four-part
video](https://www.youtube.com/watch?v=R2nr1uZ8ffc&list=PLgkF0qak9G49QlteBtxUIPapT8TzfPuB8)
recorded at our PyData talk on December 2019. In it we describe the motivation
behind Streamlit, then go over how to install and create apps with it.

## Install Streamlit

```eval_rst
.. raw:: html

  <iframe
    width="560"
    height="315"
    src="https://www.youtube.com/embed/sxLNCDnqyFc"
    style="margin: 0 0 2rem 0;"
    frameborder="0"
    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen></iframe>
```

Follow these steps and to get a sample app running in less than 5 minutes.

1. Make sure that you have [Python 3.6](https://www.python.org/downloads/) or greater installed.
1. Install Streamlit using [PIP](https://pip.pypa.io/en/stable/installing/):
   ```bash
   $ pip install streamlit
   ```
1. Run the hello world app:
   ```bash
   $ streamlit hello
   ```
1. That's it! In the next few seconds the sample app will open in a new tab in
   your default browser.

## Get started

The easiest way to learn how to use Streamlit is to actually try it out. Our
[get started guide](getting_started.md) walks you through the basics
of building a Streamlit app.

## Build your first app

```eval_rst
.. raw:: html

  <iframe
    width="560"
    height="315"
    src="https://www.youtube.com/embed/VtrFjkSGgKM"
    style="margin: 0 0 2rem 0;"
    frameborder="0"
    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen></iframe>
```

[Create an app](tutorial/create_a_data_explorer_app.md) to explore a dataset of
Uber ride pickups in New York City. You'll learn about caching, drawing charts,
plotting data on a map, and how to use interactive widgets.

## Join the community

The quickest way to get help is to reach out on our [community
forum](https://discuss.streamlit.io/). We love to hear our users' questions,
ideas, and bugs — please share!
