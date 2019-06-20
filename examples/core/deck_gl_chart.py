import streamlit as st
import numpy as np
import pandas as pd

np.random.seed(12345)

data = np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4]
df = pd.DataFrame(data, columns=['lat', 'lon'])

# Test syntax sugar for scatterplot basic charts:
#   st.deck_gl_chart(df).
viewport = {
    'latitude': 37.76,
    'longitude': -122.4,
    'zoom': 11,
    'pitch': 50,
}
st.deck_gl_chart(df, viewport=viewport)

# Test a similar chart but with a full dict spec:
#   st.deck_gl_chart(spec=spec_dict)
spec = {
    'viewport': {
        'latitude': 37.76,
        'longitude': -122.4,
        'zoom': 11,
        'pitch': 50,
    },
    'layers': [{
        'data': df,
        'type': 'ScatterplotLayer',
        'radius': 250,
        'extruded': True,
    }],
}
st.deck_gl_chart(spec=spec)


# Test a similar chart but with spec sent as keywords.
#   st.deck_gl_chart(foo=bar, boz=bonk)
st.deck_gl_chart(
    viewport = {
        'latitude': 37.76,
        'longitude': -122.4,
        'zoom': 11,
        'pitch': 50,
    },
    layers = [{
        'data': df,
        'type': 'ScatterplotLayer',
        'radius': 250,
    }]
)


# Test a similar chart but with spec sent a flattened dict.
st.deck_gl_chart(
    viewport_latitude=37.76,
    viewport_longitude=-122.4,
    viewport_zoom=11,
    viewport_pitch=50,
    layers=[{
        'data': df,
        'type': 'ScatterplotLayer',
        'radius': 250,
    }],
)


# Test custom column names (not "latitude" and "longitude").
st.deck_gl_chart(
    viewport = {
        'latitude': 37.76,
        'longitude': -122.4,
        'zoom': 11,
        'pitch': 50,
    },
    layers = [{
        'data': pd.DataFrame(data, columns=['my_lat', 'my_lon']),
        'type': 'ScatterplotLayer',
        'radius': 250,
        'getLatitude': 'my_lat',
        'getLongitude': 'my_lon',
    }]
)


# Test two layers on top of one another.
st.deck_gl_chart(
    viewport={
        'latitude': 37.76,
        'longitude': -122.4,
        'zoom': 11,
        'pitch': 50,
    },
    layers=[{
        'data': df,
        'type': 'HexagonLayer',
        'radius': 250,
        'extruded': True,
    }, {
        'data': df,
        'type': 'ScatterplotLayer',
        'radius': 250,
    }],
)
