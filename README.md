# Streamlit

This library lets you do realtime data-science. Here is an example of it's use for static data science:

## Installation

Install with:
```bash
pip install streamlit
```
Currently, streamlit requires Python 3.6.

## Static Example

Copy and paste this example and it should work:

```python
from streamlit import io
import numpy as np
import time

io.title('Streamlit Example')
io.write('Hello, World!')
io.write(np.random.randn(200, 200))

io.subheader('A Progress Bar')
bar = io.progress(0)
for i in range(100):
  bar.progress(i + 1)
  time.sleep(0.1)
```

## More Help

For more help and a complete API documentation, please run:
```bash
python -m streamlit help
```
