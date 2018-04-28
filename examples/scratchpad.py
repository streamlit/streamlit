#!./streamlit_run

from streamlit import io, cache
import numpy as np
import time
import pandas as pd
# import shapefile


# Uber data_key
data = pd.read_csv("labels_crowdai.csv")
io.write(data)

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
