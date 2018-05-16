from streamlit import io, cache
import numpy as np
import time
import pandas as pd
# import shapefile

with io.echo():
    io.empty()
    my_bar = io.progress(0)
    for i in range(100):
        my_bar.progress(i + 1)
        time.sleep(0.1)
    n_elts = int(time.time() * 10) % 5 + 3
    for i in range(n_elts):
        io.text('.' * i)
    io.write(n_elts)
    for i in range(n_elts):
        io.text('.' * i)
    io.success('done')

### NYC green taxi data

# @cache
# def load_taxi_data(n_rows):
#     return pd.read_csv('taxi_data/2017_Green_Taxi_Trip_Data.csv')[:n_rows]
#
# taxi_data = load_taxi_data(10000)
# io.write('read the file', len(taxi_data))
# io.write(taxi_data)
# counts, distances = np.histogram(taxi_data['trip_distance'], bins=10, range=(0,10.0))
# counts = pd.DataFrame.from_dict({'counts': counts, 'distances': distances[:-1]})
# io.bar_chart(counts.set_index('distances'), height=300)
# io.help(np.histogram)
