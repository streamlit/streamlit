---
title: "Tutorial"
---

Now that you have [already set Streamlit up](/docs/getting_started/), open up a
text editor and paste this in:

```python
import streamlit as st
import numpy as np
import time

# Let's give this report a title
st.title('Streamlit example')

# Now let's add some content.
# This command accepts Markdown, by the way!
st.write('Hello, world!')

st.header('Time for some data')

# Here's a random dataset...
df = np.random.randn(50, 7)
st.write(df)

# ...and a nice line chart
st.line_chart(df)

# Now let's pretend you're running a long computation
# and want to show a progress bar

st.header('Some long computation')

bar = st.progress(0)
for i in range(100):
  bar.progress(i + 1)
  time.sleep(0.1)

# Finally, let's add a fun animation to let you know your
# first Streamlit report was a success!
st.write('Done!')
st.balloons()
```

Now save this in a file called `hello.py` and run it:

```bash
$ python hello.py
```

TODO: Finish tutorial
