from streamlit import io, cache
import pandas as pd
import numpy as np

DATE_TIME = 'date/time'
DATA_URL = 'https://s3-us-west-2.amazonaws.com/streamlit-demo-data/uber-raw-data-sep14.csv.gz'

io.title('Uber Example')

@cache
def load_data(nrows):
    data = pd.read_csv(DATA_URL, nrows=nrows)
    data.rename(str.lower, axis='columns', inplace=True)
    data[DATE_TIME] = pd.to_datetime(data[DATE_TIME])
    return data

def display_uber_data(hour):
    data = load_data(100000)
    data = data[data[DATE_TIME].dt.hour == hour]

    io.subheader(f'Geo Data at {hour}h')
    io.map(data[data[DATE_TIME].dt.hour == hour])

    io.subheader(f'Usage By Minute at {hour}h')
    io.bar_chart(np.histogram(data[DATE_TIME].dt.minute, bins=60, range=(0,60))[0])

    io.subheader(f'Raw Data at {hour}h')
    io.write(data)

if __name__ == '__main__':
    hour = 16
    assert 0 <= hour < 24
    display_uber_data(hour)
