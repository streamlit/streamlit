# Install Streamlit

## Prerequisites

Before you get started, you're going to need a few things:

- Your favorite IDE or text editor
- [Python 3.6 - 3.8](https://www.python.org/downloads/)
- [PIP](https://pip.pypa.io/en/stable/installing/)

If you haven't already, take a few minutes to read through [Main
concepts](main_concepts.md) to understand Streamlit's data flow model.

## Set up your virtual environment

Regardless of which package management tool you're using, we recommend running
the commands on this page in a virtual environment. This ensures that the dependencies
pulled in for Streamlit don't impact any other Python projects
you're working on.

Below are a few tools you can use for environment management:

- [pipenv](https://pipenv.pypa.io/en/latest/)
- [poetry](https://python-poetry.org/)
- [venv](https://docs.python.org/3/library/venv.html)
- [virtualenv](https://virtualenv.pypa.io/en/latest/)
- [conda](https://www.anaconda.com/distribution/)

## Install Streamlit

```bash
pip install streamlit
```

Now run the hello world app to make sure everything is working:

```bash
streamlit hello
```

## Import Streamlit

Now that everything's installed, let's create a new Python script and import
Streamlit.

1. Create a new Python file named `first_app.py`, then open it with your IDE
   or text editor.
2. Next, import Streamlit.

   ```python
   import streamlit as st
   # To make things easier later, we're also importing numpy and pandas for
   # working with sample data.
   import numpy as np
   import pandas as pd
   ```

3. Run your app. A new tab will open in your default browser. It'll be blank
   for now. That's OK.

   ```bash
   streamlit run first_app.py
   ```

   Running a Streamlit app is no different than any other Python script.
   Whenever you need to view the app, you can use this command.

   ```eval_rst
   .. tip::
      Did you know you can also pass a URL to `streamlit run`? This is great when combined with Github Gists. For example:

      `$ streamlit run https://raw.githubusercontent.com/streamlit/demo-uber-nyc-pickups/master/streamlit_app.py`
   ```

4. You can kill the app at any time by typing **Ctrl+c** in the terminal.
