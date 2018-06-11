from streamlit import io, cache
import pandas as pd
import numpy as np

io.title('DeckGL example')

DATE_TIME = 'date/time'
DATA_URL = 'https://s3-us-west-2.amazonaws.com/streamlit-demo-data/uber-raw-data-sep14.csv.gz'

@cache
def load_data(nrows):
    data = pd.read_csv(DATA_URL, nrows=nrows)
    data.rename(str.lower, axis='columns', inplace=True)
    data[DATE_TIME] = pd.to_datetime(data[DATE_TIME])
    return data

hour = 0
data = load_data(100000)
data = data[data[DATE_TIME].dt.hour == hour]


io.write("Here's a scatterplot map using the default layerless API")

io.deck_gl_map(data,
    viewport={
        'latitude': 40.77,
        'longitude': -73.97,
        'zoom': 11,
    })

io.write("Here's the same scatterplot map using the layer API")

io.deck_gl_map(
    viewport={
        'latitude': 40.77,
        'longitude': -73.97,
        'zoom': 11,
    },
    layers=[
        {
            'type': 'ScatterplotLayer',
            'data': data,
        },
    ])

# TODO: Add other layer types to this file.
