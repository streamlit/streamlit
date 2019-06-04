import numpy as np
import os
import pandas as pd
import streamlit as st


st.title('DeckGL example')

random_points = pd.DataFrame(
    np.random.randn(1000, 3) / [50, 50, .002] + [37.76, -122.4, 0],
    columns=['lat', 'lon', 'size'])


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
    # Using flattened dicts:
    viewport_latitude=37.76,
    viewport_longitude=-122.4,
    viewport_zoom=11,
    viewport_pitch=50,
    layers=[{
        'data': random_points,
        'type': 'HexagonLayer',
        'radius': 250,
        'extruded': True,
    }],
)


st.subheader('As both')

st.write('...this time with different sizes!')

st.deck_gl_chart(
    viewport={
        'latitude': 37.76,
        'longitude': -122.4,
        'zoom': 11,
        'pitch': 50,
    },
    layers=[{
        'data': random_points,
        'type': 'HexagonLayer',
        'radius': 250,
        'extruded': True,
    }, {
        'data': random_points,
        'type': 'ScatterplotLayer',
        # Testing that the "encoding" is set automatically:
        'getRadius': 'size',
    }],
)

st.subheader('Data')

st.write("Here's the data for that:")

st.write(random_points)

st.write('...and the same plot using Vega-Lite:')

st.vega_lite_chart(
    random_points,
    height=500,
    mark='circle',
    x_field='lon',
    x_type='quantitative',
    x_scale_domain=[random_points.min()[1], random_points.max()[1]],
    y_field='lat',
    y_type='quantitative',
    y_scale_domain=[random_points.min()[0], random_points.max()[0]],
    size_field='size',
    size_type='quantitative',
    selection_grid={
        'type': 'interval',
        'bind': 'scales',
    },
)


st.header('Testing custom column names')

random_points = pd.DataFrame(
    (np.random.randn(100, 4)
        / [50, 50, 50, 50]
        + [37.76, -122.4, 37.76, -122.4]),
    columns=['my_lat', 'my_lon', 'my_lat2', 'my_lon2'])

st.deck_gl_chart(
    viewport={
        'latitude': 37.76,
        'longitude': -122.4,
        'zoom': 11,
        'pitch': 50,
    },
    layers=[{
        'data': random_points,
        'type': 'ArcLayer',
        'getStrokeWidth': 10,
        'getLatitude': 'my_lat',
        'getLongitude': 'my_lon',
        'getTargetLatitude': 'my_lat2',
        'getTargetLongitude': 'my_lon2',
    }],
)


st.header('Bart stops and bike rentals')


@st.cache
def from_data_file(filename):
    dirname = os.path.dirname(__file__)
    return pd.read_json(os.path.join(dirname, 'data', filename))


# Grab some data
bart_stop_stats = from_data_file('bart_stop_stats.json')
bart_path_stats = from_data_file('bart_path_stats.json')
bike_rental_stats = from_data_file('bike_rental_stats.json')

# Move bart stop name to the 1st column, so it looks nicer when printed as a
# table.
bart_stop_names = bart_stop_stats['name']
bart_stop_stats.drop(labels=['name'], axis=1, inplace=True)
bart_stop_stats.insert(0, 'name', bart_stop_names)

st.deck_gl_chart(
    viewport={
        'latitude': 37.76,
        'longitude': -122.4,
        'zoom': 11,
        'pitch': 50,
    },

    layers=[{
        # Plot number of bike rentals throughtout the city
        'type': 'HexagonLayer',
        'data': bike_rental_stats,
        'radius': 200,
        'elevationScale': 4,
        'elevationRange': [0, 1000],
        'pickable': True,
        'extruded': True,

    }, {
        # Now plot locations of Bart stops
        # ...and let's size the stops according to traffic
        'type': 'ScatterplotLayer',
        'data': bart_stop_stats,
        'radiusScale': 10,
        'getRadius': 50,

    }, {
        # Now Add names of Bart stops
        'type': 'TextLayer',
        'data': bart_stop_stats,
        'getText': 'name',
        'getColor': [0, 0, 0, 200],
        'getSize': 15,

    }, {
        # And draw some arcs connecting the stops
        'type': 'ArcLayer',
        'data': bart_path_stats,
        'pickable': True,
        'autoHighlight': True,
        'getStrokeWidth': 10,
    }])

st.write(bart_stop_stats)
