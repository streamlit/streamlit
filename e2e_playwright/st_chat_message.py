# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

import streamlit as st

TEST_ASSETS_DIR = Path(__file__).parent / "test_assets"
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

st.chat_message("human")


image1 = Image.new("RGB", (10, 255), "red")
st.chat_message("user", avatar=image1).write("Red local image")

image2 = Image.new("RGB", (10, 10), "blue")
st.chat_message("assistant", avatar=image2).write("Blue local image")
st.chat_message("assistant", avatar=image2).write(
    "Another message with the same blue avatar."
)

# Test avatar using local image
CAT_IMAGE_PATH = TEST_ASSETS_DIR / "cat.jpg"
st.chat_message("user", avatar=str(CAT_IMAGE_PATH)).write("Cat avatar using str path")
st.chat_message("user", avatar=CAT_IMAGE_PATH).write("Cat avatar using Path")

with st.chat_message("user", avatar=":material/airline_seat_recline_extra:"):
    st.write("Hello from USER, non-emoji icon.")

with st.chat_message("AI", avatar=":material/photo_album:"):
    st.write("Hello from AI, non-emoji icon.")

query = "This is a hardcoded user message"
sources = "example sources"
llm_response = "some response"

past_messages = st.empty()

if "messages" not in st.session_state:
    st.session_state.messages = []

with past_messages.container():
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
            if message["role"] != "user":
                with st.expander("See sources"):
                    st.markdown(message["sources"])

with st.chat_message("user"):
    st.markdown(query)

user_message = {"role": "user", "content": query, "sources": ""}
st.session_state.messages.append(user_message)

with st.chat_message("assistant"):
    displayed_response = st.empty()
    with displayed_response.container():
        st.markdown(llm_response)
        with st.expander("See sources"):
            st.markdown(sources)

assistant_message = {"role": "assistant", "content": llm_response, "sources": sources}
st.session_state.messages.append(assistant_message)
