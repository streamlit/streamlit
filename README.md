# Streamlit

Streamlit is a magical frontend for data science and machine learning.
Here is an example of how to use it:

## Installation

Install with:
```bash
$ pip install streamlit
```

## Static Example

Copy and paste this example into a file such as `program.py`:

```python
import streamlit as st
import numpy as np
import time

st.title('Streamlit Example')
st.write('Hello, World!')
st.write(np.random.randn(200, 200))

st.subheader('A Progress Bar')
bar = st.progress(0)
for i in range(100):
  bar.progress(i + 1)
  time.sleep(0.1)
```

Then run it with `streamlit run program.py`, which should start Streamlit. 

## More Help

For more help and a complete API documentation, please run:
```bash
$ streamlit docs
```

## Contributing to Streamlit

See the [wiki](https://github.com/streamlit/streamlit/wiki/Contributing-to-Streamlit).
