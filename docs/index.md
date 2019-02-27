# Streamlit documentation

Here are some links to help you get started with Streamlit, your new secret
weapon:

```eval_rst
.. toctree::
   :caption: Basics
   :maxdepth: 2

   getting_started
   tutorial/index

   core_mechanics

   cli
   troubleshooting


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


.. ......................................................
.. And now manually create the API table of contents,
.. because we want the functions to be present here too.

API
---

- :doc:`api/text`

  - :func:`streamlit.text`
  - :func:`streamlit.markdown`
  - :func:`streamlit.write`
  - :func:`streamlit.title`
  - :func:`streamlit.header`
  - :func:`streamlit.subheader`
  - :func:`streamlit.code`

- :doc:`api/data`

  - :func:`streamlit.dataframe`
  - :func:`streamlit.table`
  - :func:`streamlit.json`

- :doc:`api/charts`

  - :func:`streamlit.pyplot`
  - :func:`streamlit.altair_chart`
  - :func:`streamlit.vega_lite_chart`
  - :func:`streamlit.deck_gl_chart`
  - :func:`streamlit.line_chart`
  - :func:`streamlit.area_chart`
  - :func:`streamlit.bar_chart`
  - :func:`streamlit.map`
  - :func:`streamlit.image`
  - :func:`streamlit.audio`
  - :func:`streamlit.video`

- :doc:`api/echo`

  - :func:`streamlit.echo`

- :doc:`api/status`

  - :func:`streamlit.progress`
  - :func:`streamlit.spinner`
  - :func:`streamlit.balloons`
  - :func:`streamlit.error`
  - :func:`streamlit.warning`
  - :func:`streamlit.info`
  - :func:`streamlit.success`
  - :func:`streamlit.exception`

- :doc:`api/mutation`

  - :meth:`streamlit.DeltaGenerator.DeltaGenerator.add_rows`

- :doc:`api/optimization`

  - :func:`streamlit.cache`

- :doc:`api/other`

  - :func:`streamlit.empty`
  - :func:`streamlit.help`

.. :func:`genindex`
.. :func:`modindex`
.. :func:`search`
```
