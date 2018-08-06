---
title: "Tutorial, part 2"
draft: true
---

At this point, you have probably [already set Streamlit
up](/docs/getting_started/), and even created [your first Streamlit
report](/docs/tutorial). So now let's get down to a more concrete example of 
how you'd use Streamlit when trying to accomplish a real world task.

TODO(tvst): Write this.

## Preparing the imports

```python
import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
```

## Fetching some data

```python
DATE_COLUMN = 'date/time'
DATA_URL = ('https://s3-us-west-2.amazonaws.com/'
            'streamlit-demo-data/uber-raw-data-sep14.csv.gz')

def load_data(nrows):
    data = pd.read_csv(DATA_URL, nrows=nrows)
    lowercase = lambda x: str(x).lower()
    data.rename(lowercase, axis='columns', inplace=True)
    data[DATE_COLUMN] = pd.to_datetime(data[DATE_COLUMN])
    return data

data = load_data(100000)

st.title('Uber pickups in NYC')

st.subheader(f'Raw data')
st.write(data)
```

## Caching the data

```python
@st.cache
def load_data(nrows):
```

## Drawing a histogram

```python
st.subheader(f'Number of pickups by hour')
st.bar_chart(np.histogram(filtered_data.dt.hour, bins=12, range=(0,12))[0])
```

## Drawing a map

```python
st.subheader(f'Map of all pickups')
st.map(filtered_data)
```

## Filtering by hour

```python
# Some number in the range 0-23
hour_to_filter = 12
filtered_data = data[data[DATE_COLUMN].dt.hour == hour_to_filter]

st.subheader(f'Raw data at {hour_to_filter}h')
st.write(filtered_data)

st.subheader(f'Number of pickups by minute at {hour_to_filter}h')
st.bar_chart(np.histogram(filtered_data.dt.minute, bins=60, range=(0,60))[0])

st.subheader(f'Map of all pickups at {hour_to_filter}h')
st.map(filtered_data)
```

## Appendix: the final script

This is what `uber_pickups.py` should look like when you're done with this
tutorial:

```python
import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

DATE_COLUMN = 'date/time'
DATA_URL = ('https://s3-us-west-2.amazonaws.com/'
            'streamlit-demo-data/uber-raw-data-sep14.csv.gz')

@st.cache
def load_data(nrows):
    data = pd.read_csv(DATA_URL, nrows=nrows)
    lowercase = lambda x: str(x).lower()
    data.rename(lowercase, axis='columns', inplace=True)
    data[DATE_COLUMN] = pd.to_datetime(data[DATE_COLUMN])
    return data

st.title('Uber pickups in NYC')

data = load_data(100000)

st.subheader(f'Raw data')
st.write(data)

st.subheader(f'Number of pickups by hour')
st.bar_chart(np.histogram(filtered_data.dt.hour, bins=12, range=(0,12))[0])

st.subheader(f'Map of all pickups')
st.map(filtered_data)

# Some number in the range 0-23
hour_to_filter = 12
filtered_data = data[data[DATE_COLUMN].dt.hour == hour_to_filter]

st.subheader(f'Raw data at {hour_to_filter}h')
st.write(filtered_data)

st.subheader(f'Number of pickups by minute at {hour_to_filter}h')
st.bar_chart(np.histogram(filtered_data.dt.minute, bins=60, range=(0,60))[0])

st.subheader(f'Map of all pickups at {hour_to_filter}h')
st.map(filtered_data)
```
