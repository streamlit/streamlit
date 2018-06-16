# deck_gl_map()

Draws a map using the [Deck.gl library](http://uber.github.io/deck.gl/#). This
allows you to plot data on top of maps, adding multiple layers of visual
information, including 3D layers and even point clouds.

As usual, our API closely follows Deck.gl's own API. So if you're not acquainted
with that yet, it's a good idea to take a look at
[their docs](http://uber.github.io/deck.gl/#/documentation/overview/introduction).


## Usage

Below is an example of how to use Streamlit's `deck_gl_map()` method:

```
my_data = [
  {'lat': 37.6, 'lon': -122.5, 'population': 12345, 'label': 'foo'},
  # ...
]

st.deck_gl_map(
    # Optional but very common argument. Sets up the map's default properties.
    viewport={
        'latitude': 37.76,
        'longitude': -122.4,
        'zoom': 11,
        'pitch': 50,
    },

    # Define your plot's layers here.
    # This one has two layers: a scatter plot and some text labels.
    layers=[{
        'type': 'ScatterplotLayer',
        'data': my_data,

        # User encodings to connect plot elements to columns from your data.
        'encoding': {
            # For each row r in my_data, the corresponding datapoint in the plot
            # will have a radius of size r['population'].
            # See getRadius in Deck.gl's documentation.
            'radius': 'population',
        },

    }, {
        'type': 'TextLayer',
        'data': my_data,
        'encoding': {
            # See getText in Deck.gl's documentation.
            'text': 'label',

            # See getColor in Deck.gl's documentation.
            'color': [0, 0, 0, 200],

            # See getSize in Deck.gl's documentation.
            'size': 15,
        },
    }]
  )
```

Some things to note:

1. All keys and keywords above support both `snake_case` and `camelCase`. But
   `snake_case` is preferred, since it is more Pythonic.
2. The `encoding` dict allows you to connect your dataframe's columns to
   different attributes in the plot. Behind the scenes, what is happening is
   that `'encoding': {'foo': 'bar'}` becomes `getFoo: row => row['bar']` in
   Deck.gl's JavaScript API.
   Meanwhile, non-string values such as `baz` in `'encoding': {'baz': 123}` 
   are passed to `getBaz` as constants.


## Supported layers

Right now we only support the following Deck.gl layers in Streamlit:

`ArcLayer`, `GridLayer`, `HexagonLayer`, `LineLayer`, `PointCloudLayer`,
`ScatterplotLayer`, `ScreenGridLayer`, `TextLayer`, 
