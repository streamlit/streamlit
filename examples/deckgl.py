from streamlit import io, cache
import pandas as pd
import numpy as np

io.title('DeckGL example')

# Grab some data
bart_stop_stats = pd.read_json('./examples/bart_stop_stats.json')
bart_path_stats = pd.read_json('./examples/bart_path_stats.json')
bike_rental_stats = pd.read_json('./examples/bike_rental_stats.json')

io.deck_gl_map(
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

    # Now plot locations of Bart stops
    # ...and let's size the stops according to traffic
    }, {
        'type': 'ScatterplotLayer',
        'data': bart_stop_stats,
        'pickable': True,
        'autoHighlight': True,
        'radiusScale': 0.02,
        'encoding': {
            'radius': 'exits',
        },

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
        'strokeWidth': 10,
    }])

