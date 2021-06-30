# Visualising rent prices with Streamlit

When you're looking for a new apartment to rent, it's often hard to figure out if a price for a specific place is "good" or "fair".

It's useful to have a visual overview of prices of similar properties in the same area.

In this tutorial, we'll use Streamlit to visualise rental prices in Bern, Switzerland, and allow the user to filter by number of rooms and area.

![Rent Prices App](/_static/img/rent-prices-tutorial/app-overview.jpg)

This tutorial expands on the Streamlit [data explorer](https://docs.streamlit.io/en/stable/tutorial/create_a_data_explorer_app.html) example by adding some more advanced controls, including

- A double-sided slider, to select the min and max number of rooms
- Dynamically updating text - the mean, median, minimum and maximum prices are updated based on the user selection
- A more advanced chart, using the Altair API directly and including custom ticks and mouse-over "tooltip" text for each data point.
- A multi-select option to choose to filter available cities.

We'll go through all of this step by step so that you can easily pull our the parts you need into your own application.

## Reading our data

Our dataset contains a number of columns. It's already clean, so we don't need to make many changes. We are mainly interested in the "price", "num_rooms" and "city" columns.

![Overview of the dataset](/_static/img/rent-prices-tutorial/data-overview.png)

Create a file called `app.py` and add the following code.

```python
import streamlit as st
import pandas as pd
import altair as alt

DATA_SOURCE = "./data/bern_rentals.csv"


@st.cache
def load_data():
    data = pd.read_csv(DATA_SOURCE)
    data['date'] = pd.to_datetime(data['date'])
    data['Size'] = data['size'].apply(lambda x: f'{x:.0f} sqm')
    data['Price'] = data['price'].apply(lambda x: f'CHF {x:.0f}')
    return data
```

This imports the libraries we will be using.

- **streamlit** - to do interactive visualisation and real-time updates of our data
- **pandas** - to read our CSV file
- **altair** - to build a customized chart

We then define a `load_data` function which reads the file and c
reates some convenient human-readable versions. The `Price` colum
n is based on the existing `price` column (note the capitalisatio
n difference)n and formats each price as an integer with a curren
cy string (`CHF`, which is what the Swiss use for their currency
instead of a symbol like "\$") and similarly for the Size.

This function then gives us a Pandas dataframe from the file, which we can use to pass data to Streamlit and filter based on user input.

## Adding text to our application

Right below, add the following code

```python
st.title('Bern Rental Prices')
data_load_state = st.text('Loading data...')
data = load_data()
data_load_state.text("")
```

This sets the title of the page and gives some text to display while the data is loading, which it then removes once the data has loaded.

## Adding user controls to our application

Now let's set up some controls for our user to filter the data. Add the following to your `app.py` file below the existing code.

```python
st.subheader('Choose filters')

city_options = list(set(data['city']))
rooms_filter = st.slider('Number of rooms', 1.0, 10.0, (1.0, 10.0), step=0.5)
cities_filter = st.multiselect('Cities', city_options, default=['Bern'])
```

This sets up some user controls. A slider for the user to set the min and max number of rooms. We specify that the user can select between 1 and 10 rooms and we set the default to include all sizes (1-10).

We then set up a `multiselect`, which restricts the choices a user can choose from but lets them choose many (unlike an `options` control, where the user can only select one option). We create a set from our `city` column to get all the unique cities in our dataset (most are in Bern, but there are some in outlying towns too).

## Filtering the data based on user input and calculating aggregate statistics

Now add the following code to your `app.py` file - again, below the existing code.

```python
filtered_data = data[data['num_rooms'].between(rooms_filter[0], rooms_filter[1])]
filtered_data = filtered_data[filtered_data['city'].isin(cities_filter)]
avg = filtered_data['price'].mean()
med = filtered_data['price'].median()
mn = filtered_data['price'].min()
mx = filtered_data['price'].max()

st.markdown(f"### Avg. CHF {avg:.0f} | Med. CHF {med:.0f} | Min. CHF {mn:.0f} | Max CHF {mx:.0f}")
```

This will create a new dataframe called `filtered_data` which pulls data from our main dataframe based on the user's choices. We first remove all rows where the `num_rooms` value falls outside the user's chosen range (chosen from the double slider) and then remove rows where the user has not included that city.

We can now calculate the mean, median, minimum and maximum prices of the remaining properties. Pandas provides convenient functions for all of these.

Finally, we add a markdown row - equivalent to an `<h3>` HTML tag to make the aggregate numbers more noticable and show the user this data.

## Adding a visualisation

Viewing the aggregate data is useful but doesn't help the user as much as being able to visualise this dataset. Let's add a chart with one point for each property. This will show how properties tend to get more expensive as you add more rooms.

Add the following code, again below the existing code in `app.py`.

```python
ticks = [float(x)/10 for x in range(10,80,5)]
chart = alt.Chart(filtered_data).mark_point().encode(
    x=alt.X('num_rooms', axis=alt.Axis(values=ticks)),
    y='price',
    color='city',
    tooltip=['description', 'post_code', 'Size', 'Price']
).interactive()
st.altair_chart(chart)
```

Streamlit provides some higher-level convenience functions around the plotting library Altair, but we want to customize some aspects so we will drop down a layer and use the Altair API directly.

There aren't any properties with more than 8 rooms in our dataset, so we will hardcode the chart to show a range from 1 room to 8 rooms on the X axis. Swiss properties also often have 'half' rooms - a large hallway or kitchen is often counted as a 'half' room, so we will create a range from `[1.0, 1.5, 2.0 ... 7.5, 8.0]` to set our X ticks.

We can then create the Chart using points and specify that we want `num_rooms` as the X-axis and `price` as the Y-axis. We'll also set a tool tip (mouseover text) for each point to show the description, post code, size, and price for each property and specify that the chart should be interactive (the user can pan around and zoom in and out).

Finally we add the chart to our UI by passing it to `st.altair_chart`.

## Running the application

That's it! You can run the application with `streamlit run app.py` and you should be able to see the visualisation and change the filters as you want.
