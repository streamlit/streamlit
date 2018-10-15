import streamlit as st
import pandas as pd
import numpy as np
from dateutil.parser import parse


st.title('Vega Lite support')

st.header('Bar chart')

df = pd.DataFrame([['A', 'B', 'C', 'D'], [28, 55, 43, 91]], index=['a', 'b']).T

st.write('This...')

st.vega_lite_chart(df,
    mark='bar',
    x_field='a',
    x_type='ordinal',
    y_field='b',
    y_type='quantitative')

st.write('...is the same is this:')

st.vega_lite_chart(df, {
    'mark': 'bar',
    'encoding': {
      'x': {'field': 'a', 'type': 'ordinal'},
      'y': {'field': 'b', 'type': 'quantitative'}
    }
  })

# -

st.header('Line chart')

st.subheader('Single line')

st.write('The plot below also tests `st.add_rows()`')

df = pd.DataFrame({
    'day': range(100),
    'stock price': np.random.randn(100),
})

c = st.vega_lite_chart(df,
    mark='line',
    x_field='day',
    x_type='ordinal',
    y_field='stock price',
    y_type='quantitative')

# Testing add_rows support
df = pd.DataFrame({
    'day': range(100, 150),
    'stock price': np.zeros(50),
})
c.add_rows(df)

df = pd.DataFrame({
    'day': range(150, 200),
    'stock price': np.ones(50),
})
c.add_rows(df)

df = pd.DataFrame({
    'day': range(200, 250),
    'stock price': np.zeros(50),
})
c.add_rows(df)

df = pd.DataFrame({
    'day': range(250, 300),
    'stock price': np.ones(50),
})
c.add_rows(df)


st.subheader('Multiple lines')

df = pd.DataFrame({
    'stock A price': np.random.randn(100),
    'stock B price': np.random.randn(100),
    'stock C price': np.random.randn(100),
})

def stack_dataframe(df):
    """Stacks a dataframe.

    Takes a dataframe like:

      col1 col2 col3
      10   20   30
      11   21   31

    And returns the same data but stacked, like:

      keys values
      col1 10
      col1 11
      col2 20
      col2 21
      col3 30
      col3 31
    """
    df = df.stack()
    df = df.reset_index(level=1)
    df.columns = ['keys', 'values']
    df = df[['values', 'keys']]
    return df

df = stack_dataframe(df)

st.vega_lite_chart(df,
    mark='line',
    x_field='(index)',  # Magic field name. TODO: Support named indices in JS.
    x_type='ordinal',
    y_field='values',
    y_type='quantitative',
    color_field='keys',
    color_type='nominal',
)


# -

st.header('Scatter plot')

df = pd.DataFrame(np.random.randn(200, 3), columns=['a', 'b', 'c'])

st.vega_lite_chart(df, {
    'mark': 'circle',
    'encoding': {
      'x': {'field': 'a', 'type': 'quantitative'},
      'y': {'field': 'b', 'type': 'quantitative'},
      'size': {'field': 'c', 'type': 'quantitative'},
      'color': {'field': 'c', 'type': 'quantitative'},
    }
  })

# -

st.header('Box plot')

st.write(
    'This example is straight from the [Vega Lite docs]'
    '(https://vega.github.io/vega-lite/examples/interactive_query_widgets.html)'
    )

st.vega_lite_chart(None,
    {
      "$schema": "https://vega.github.io/schema/vega-lite/v2.json",
      "description": "A vertical 2D box plot showing median, min, and max in the US population distribution of age groups in 2000.",
      "data": {"url": "https://vega.github.io/vega-lite/data/population.json"},
      "mark": {
        "type": "boxplot",
        "extent": "min-max"
      },
      "encoding": {
        "x": {"field": "age","type": "ordinal"},
        "y": {
          "field": "people",
          "type": "quantitative",
          "axis": {"title": "population"}
        }
      }
    })

# -

st.header('Query widgets')

st.write(
    'This example is straight from the [Vega Lite docs]'
    '(https://vega.github.io/vega-lite/examples/interactive_query_widgets.html)'
    )

st.vega_lite_chart(None,
    {
      "$schema": "https://vega.github.io/schema/vega-lite/v2.json",
      "description": "Drag the sliders to highlight points.",
      "data": {"url": "https://vega.github.io/vega-lite/data/cars.json"},
      "transform": [{"calculate": "year(datum.Year)", "as": "Year"}],
      "layer": [{
        "selection": {
          "CylYr": {
            "type": "single", "fields": ["Cylinders", "Year"],
            "bind": {
              "Cylinders": {"input": "range", "min": 3, "max": 8, "step": 1},
              "Year": {"input": "range", "min": 1969, "max": 1981, "step": 1}
            }
          }
        },
        "mark": "circle",
        "encoding": {
          "x": {"field": "Horsepower", "type": "quantitative"},
          "y": {"field": "Miles_per_Gallon", "type": "quantitative"},
          "color": {
            "condition": {"selection": "CylYr", "field": "Origin", "type": "nominal"},
            "value": "grey"
          }
        }
      }, {
        "transform": [{"filter": {"selection": "CylYr"}}],
        "mark": "circle",
        "encoding": {
          "x": {"field": "Horsepower", "type": "quantitative"},
          "y": {"field": "Miles_per_Gallon", "type": "quantitative"},
          "color": {"field": "Origin", "type": "nominal"},
          "size": {"value": 100}
        }
      }]
    })

# -

st.header('Geo chart (WIP)')

DATA_URL = 'https://s3-us-west-2.amazonaws.com/streamlit-demo-data/uber-raw-data-sep14.csv.gz'
df = pd.read_csv(DATA_URL, nrows=1000)
df['hour'] = df['Date/Time'].apply(lambda x: parse(x).hour)
df = df.rename(str.lower, axis='columns')

st.vega_lite_chart(df, {
  "$schema": "https://vega.github.st/schema/vega-lite/v2.1.json",
  "height": 500,
  "projection": {
    "type": "albersUsa"
  },
  "mark": "circle",
  "encoding": {
    "longitude": {
      "field": "lon",
      "type": "quantitative"
    },
    "latitude": {
      "field": "lat",
      "type": "quantitative"
    },
    "size": {"value": 1},
    "color": {"field": "hour", "type": "quantitative"}
  }
})
