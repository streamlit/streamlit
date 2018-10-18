import numpy as np
import os
import pandas as pd
import streamlit as st


st.title('DeckGL example')

random_points = pd.DataFrame(
    np.random.randn(1000, 2) / 50 + [37.76, -122.4],
    columns=['lat', 'lon'])


st.header('Random data')

st.subheader('As a scatter plot')

st.deck_gl_chart(
    random_points,
    viewport={
        'latitude': 37.76,
        'longitude': -122.4,
        'zoom': 11,
        'pitch': 50,
        'radiusScale': 1000,
    },
)


st.subheader('As a histogram plot')

st.deck_gl_chart(
    viewport={
        'latitude': 37.76,
        'longitude': -122.4,
        'zoom': 11,
        'pitch': 50,
        'radiusScale': 1000,
    },
    layers=[{
        'data': random_points,
        'type': 'HexagonLayer',
        'radius': 250,
        'extruded': True,
    }],
)

st.subheader('Data')

st.write("Here's the data for that:")

st.write(random_points)

st.write('...and the same plot using Vega Lite:')

st.vega_lite_chart(
    random_points,
    mark='circle',
    x_field='lat',
    x_type='quantitative',
    x_scale_domain=[random_points.min()[0], random_points.max()[0]],
    y_field='lon',
    y_type='quantitative',
    y_scale_domain=[random_points.min()[1], random_points.max()[1]],
    selection_grid={
        'type': 'interval',
        'bind': 'scales',
    },
)


st.header('Multilayer example')

@st.cache
def from_data_file(filename):
    dirname = os.path.dirname(__file__)
    return pd.read_json(os.path.join(dirname, 'data', filename))

# Grab some data
bart_stop_stats = from_data_file('bart_stop_stats.json')
bart_path_stats = from_data_file('bart_path_stats.json')
bike_rental_stats = from_data_file('bike_rental_stats.json')

st.deck_gl_chart(
    viewport={
        'latitude': 37.76,
        'longitude': -122.4,
        'zoom': 11,
        'pitch': 50,
    },

    # Plot number of bike rentals throughtout the city
    layers=[{
        'type': 'HexagonLayer',
        'data': bike_rental_stats,
        'radius': 200,
        'elevationScale': 4,
        'elevationRange': [0, 1000],
        'pickable': True,
        'extruded': True,

    # # Now plot locations of Bart stops
    # # ...and let's size the stops according to traffic
    # }, {
    #     'type': 'ScatterplotLayer',
    #     'data': bart_stop_stats,
    #     'pickable': True,
    #     'autoHighlight': True,
    #     'radiusScale': 0.002,  # XXX
    #     'encoding': {
    #         'radius': 'exits',
    #     },

    # Now Add names of Bart stops
    }, {
        'type': 'TextLayer',
        'data': bart_stop_stats,
        'encoding': {
            'text': 'name',
            'color': [0, 0, 0, 200],
            'size': 15,
        },

    # And draw some arcs connecting the stops
    }, {
        'type': 'ArcLayer',
        'data': bart_path_stats,
        'pickable': True,
        'autoHighlight': True,
        'encoding': {
            'strokeWidth': 10,
        },
    }])
