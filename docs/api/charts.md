# Displaying charts

Streamlit supports several different charting libraries, and our goal is to
continually add support for more. Right now, the most basic library in our
arsenal is [Matplotlib](https://matplotlib.org/). Then there are also
interactive charting libraries like [Vega
Lite](https://vega.github.io/vega-lite/) (2D charts) and
[deck.gl](https://github.com/uber/deck.gl) (maps and 3D charts). And
finally we also provide a few chart types that are "native" to Streamlit,
like `st.line_chart` and `st.area_chart`.

```eval_rst
.. autofunction:: streamlit.pyplot
.. autofunction:: streamlit.altair_chart
.. autofunction:: streamlit.vega_lite_chart
.. autofunction:: streamlit.plotly_chart
.. autofunction:: streamlit.bokeh_chart
.. autofunction:: streamlit.deck_gl_chart
.. autofunction:: streamlit.line_chart
.. autofunction:: streamlit.area_chart
.. autofunction:: streamlit.bar_chart
.. autofunction:: streamlit.map
.. autofunction:: streamlit.image
.. autofunction:: streamlit.audio
.. autofunction:: streamlit.video
```
