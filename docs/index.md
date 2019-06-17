```eval_rst
.. toctree::
   :caption: Basics
   :maxdepth: 2
   :hidden:

   Home <https://streamlit.io/secret/docs/>
   getting_started
   tutorial/index

   core_mechanics

   cli
   troubleshooting
   changelog


.. ......................................................
.. Include everything in the API folder for the sidebar.

.. toctree::
   :caption: API
   :maxdepth: 2
   :hidden:

   api/text
   api/data
   api/charts
   api/echo
   api/status
   api/mutation
   api/optimization
   api/other
```

# Welcome to Streamlit

```eval_rst
.. important::
   **Important notice for release 0.40.0**

   Streamlit is more than 10x faster thanks to a new proxyless architecture. With this release also comes a new way to launch Streamlit:

   .. code-block:: bash

      $ streamlit run your_script.py [script args]

   To upgrade to the latest version of Streamlit, run:

   .. code-block:: bash

      # PIP
      $ pip install --upgrade streamlit

   .. code-block:: bash

      # Conda
      $ conda update streamlit

   Learn more about the `0.40.0 release <changelog.html>`_.
```

Streamlit is reinventing the data notebook for machine learning. With just a text editor and a browser you can visualize data, debug models, and create dazzling interactive demos in pure Python.

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

## Some helpful links

The left-hand navigation is the best way to move around our docs site, but we think these articles are important enough to list more than once:

* [Tutorials](tutorial/index.md)
* [API reference](api/text.md)
* [Troubleshooting guide](troubleshooting.md)
* [Slack support channel](https://streamlit.slack.com/messages/CG5K38YMT/)
