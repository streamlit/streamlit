import streamlit as st
import pandas as pd
import numpy as np
from dateutil.parser import parse


st.title('Vega Lite support')

# --

st.header('Basic charts')

df = pd.DataFrame({'a': np.random.randn(50), 'b': np.random.randn(50)})

st.vega_lite.line_chart(df)
st.vega_lite.area_chart(df)

df = pd.DataFrame(np.random.randn(200, 3), columns=['a', 'b', 'c'])
st.vega_lite.scatter_chart(df)

# --

st.header('Custom charts')

df = pd.DataFrame([['A', 'B', 'C', 'D'], [28, 55, 43, 91]], index=['a', 'b']).T

# -

st.subheader('Bar chart')

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

st.subheader('Scatter plot')

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


st.subheader('Geo chart (WIP)')

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

st.vega_lite.geo_scatter_chart(df,
    map='https://raw.githubusercontent.com/bsmithgall/bsmithgall.github.io/master/js/json/nyc-boroughs.topojson',
    feature='nyc-borough-boundaries-polygon',
)
