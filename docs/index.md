```eval_rst
.. toctree::
   :caption: Tutorials
   :maxdepth: 2
   :hidden:

   getting_started
   tutorial/create_a_data_explorer_app
   streamlit_components
   Self-driving car image browser <https://github.com/streamlit/demo-self-driving>

.. toctree::
  :caption: Topic Guides
  :maxdepth: 2
  :hidden:

  installation
  main_concepts
  deploy_streamlit_app
  caching
  advanced_concepts
  publish_streamlit_components

.. toctree::
  :caption: Reference Guides
  :maxdepth: 2
  :hidden:

  api
  streamlit_configuration
  develop_streamlit_components
  API cheat sheet <https://share.streamlit.io/daniellewisdl/streamlit-cheat-sheet/app.py>

.. toctree::
  :caption: Support
  :maxdepth: 2
  :hidden:

  Discussion forum <https://discuss.streamlit.io/>
  troubleshooting/index
  Frequently Asked Questions <streamlit_faq>
  changelog
  Source code & issue tracker <https://github.com/streamlit/streamlit/>
```

# Welcome to Streamlit

[Streamlit](https://streamlit.io/) is an open-source Python library that makes it easy to create and share beautiful, custom web apps for machine learning and data science.
In just a few minutes you can build and deploy powerful data apps - so let's get started!

1. Make sure that you have [Python 3.6 - Python 3.8](https://www.python.org/downloads/release/python-386/) installed.
2. Install Streamlit using [PIP](https://pip.pypa.io/en/stable/installing/) and run the 'hello world' app:

   ```shell
   pip install streamlit
   streamlit hello
   ```

3. That's it! In the next few seconds the sample app will open in a new tab in your default browser.

Still with us? Great! Now make your own app in just 3 more steps:

1. Open a new Python file, import Streamlit, and write some code

2. Run the file with:

   `streamlit run [filename]`

3. When you're ready, click 'Deploy' from the Streamlit menu to [share your app with the world](deploy_streamlit_app.md)!

Now that you're set up, let's dive into more of how Streamlit works and how to build great apps.

## How to use our docs

The docs are broken up into 5 sections that will help you get the most out of Streamlit.

- **Tutorials**: include our [Get Started](getting_started.md) guide and a few step-by-step examples to building different types of apps in Streamlit.

- **Topic guides**: give you background on how different parts of Streamlit work. Make sure to check out the sections on [Creating an app](main_concepts.md) and [Deploying an app](deploy_streamlit_app.md), and for you advanced users who want to level up your apps, be sure to read up on [Caching](caching.md) and [Components](develop_streamlit_components.md).

- **Cookbook**: provides short code snippets that you can copy in for specific use cases.

- **Reference guides**: are the bread and butter of how our [APIs](api.md) and [configuration files](streamlit_configuration.md) work and will give you short, actionable explanations of specific functions and features.

- **Support**: gives you more options for when you're stuck or want to talk about an idea. Check out our discussion forum as well as a number of [troubleshooting guides](/troubleshooting/index.md).

## **Join the community**

Streamlit is more than just a way to make data apps, it's also a community of creators that share their apps and ideas and help each other make their work better. Please come join us on the [community forum](https://discuss.streamlit.io/). We love to hear your questions, ideas, and help you work through your bugs — stop by today!
