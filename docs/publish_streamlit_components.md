# Publish Streamlit Component to PyPI

Publishing your Streamlit Component to [PyPI](https://pypi.org/) makes it easily accessible to Python users around the world. This step is optional, of course...if you won't be releasing your component publicly, you can skip this section!

```eval_rst
.. note::
   For **Static Streamlit Components**, publishing a Python package to PyPI follows the same steps as the `core PyPI packaging instructions <https://packaging.python.org/tutorials/packaging-projects/>`_. A static Component likely contains only Python code, so once you have your `setup.py <https://packaging.python.org/tutorials/packaging-projects/#creating-setup-py>`_ file correct and `generate your distribution files <https://packaging.python.org/tutorials/packaging-projects/#generating-distribution-archives>`_, you're ready to `upload to PyPI <https://packaging.python.org/tutorials/packaging-projects/#uploading-the-distribution-archives>`_.

   **Bi-directional Streamlit Components** at minimum include both Python and JavaScript code, and as such, need a bit more preparation before they can be published on PyPI. The remainder of this page focuses on the bi-directional Component preparation process.
```

## Prepare Your Component

A bi-directional Streamlit Component varies slightly from a pure Python library in that it must contain the compiled frontend code. This is how base Streamlit works as well; when you `pip install streamlit`, you are getting a Python library where the HTML and frontend code contained within it are compiled into static assets.
