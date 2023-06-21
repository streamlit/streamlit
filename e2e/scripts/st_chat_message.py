# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(0)


# Generate a random dataframe
df = pd.DataFrame(
    np.random.randn(5, 5),
    columns=("col_%d" % i for i in range(5)),
)


with st.chat_message("user"):
    st.write("Hello…")

with st.chat_message("assistant"):
    st.write(
        """
Hello, here is a code snippet:

```python
import streamlit as st
with st.chat_message("assistant"):
     st.write("Hello, here is a code snippet...")
```
"""
    )

with st.chat_message("user", avatar="🧑"):
    st.write(
        """
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris tristique est
at tincidunt pul vinar. Nam pulvinar neque sapien, eu pellentesque metus pellentesque
at. Ut et dui molestie, iaculis magna sed.
"""
    )

with st.chat_message("dog", avatar="https://static.streamlit.io/examples/dog.jpg"):
    st.write("Woof woof! I'm a dog and I like charts:")
    st.line_chart(df, use_container_width=True)

cat = st.chat_message("cat", avatar="https://static.streamlit.io/examples/cat.jpg")
cat.write("I'm a cat and I like this dataset:")
cat.dataframe(df, use_container_width=True)
cat.text_input("What's your name?")


with st.chat_message("Bot"):
    with st.expander("See more", expanded=True):
        st.write("Lorem ipsum dolor sit amet")

st.chat_message("user")
