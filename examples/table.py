from streamlit import io
import numpy as np

io.write('Hello world.')

data = np.random.randn(5, 5)
io.write(data)

io.table(data)
