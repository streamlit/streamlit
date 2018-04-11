#!./streamlit_run

from streamlit import io, cache
import numpy as np
import pandas as pd

histogram_ref = 'https://docs.scipy.org/doc/numpy-1.12.0/reference/generated/numpy.histogram.html'

io.write("Here's some fake data, normally distributed.")
data = np.random.randn(4000)
freq, bins = np.histogram(data, bins=20)
# io.write(freq)
# io.write(bins)
hist = pd.DataFrame(np.array([freq, bins[:-1]]).T, columns=['freq', 'bins'])
hist = hist.set_index('bins')
# hist.index = pd.date_range('1/2/2011', periods=20, freq='M')
# hist.index = hist.index - hist.index[0]

io.write(hist)
io.bar_chart(hist)

# io.write(freq)
# io.write(bins)
# io.write(freq.shape)
# io.write(bins.shape)
# # hist = np.array(list(hist))
# # io.write(hist.dtype)
# # hist = pd.DataFrame()
# # io.write(hist)
