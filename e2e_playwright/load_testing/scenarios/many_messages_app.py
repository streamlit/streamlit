# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""Many small messages app for load testing.

Tests the ForwardMsg cache system under concurrent access with many
small cacheable messages. Each message is large enough to be cached
by the ForwardMsg cache (messages > ~50KB are cached).

Based on e2e_playwright/forward_msg_cache.py.
"""

import streamlit as st

st.title("Load Test - Many Messages")

# ~1KB lorem ipsum text block
MESSAGE_1KB = "\n\n".join(
    2
    * [
        (
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus quis neque "
            "eu orci faucibus pellentesque. Vivamus dapibus pellentesque sem, vitae "
            "ultricies sem pharetra at. Curabitur eu congue magna, eu tempor libero. "
            "Donec vitae condimentum odio. Sed neque elit, porttitor eget laoreet "
            "volutpat, imperdiet et leo. Phasellus vel velit sit amet nulla hendrerit "
            "pharetra et non tortor. Lorem ipsum dolor sit amet, consectetur adipiscing "
            "elit. In malesuada sem sit amet felis vestibulum, maximus."
        )
    ]
)

# Configuration: 30 messages of ~50KB each (total ~1.5MB of cacheable content)
NUM_MESSAGES = 30
KB_PER_MESSAGE = 50

with st.container(height=300):
    for i in range(NUM_MESSAGES):
        st.markdown(
            f"**Message {i + 1}:** \n\n" + "\n\n".join(KB_PER_MESSAGE * [MESSAGE_1KB]),
        )


@st.fragment
def message_fragment():
    """Fragment with a cacheable message to test fragment + cache interaction."""
    st.button("Rerun fragment")
    with st.expander("Message in Fragment", expanded=False):
        st.markdown(
            "**Message in Fragment:** \n\n"
            + "\n\n".join(KB_PER_MESSAGE * [MESSAGE_1KB]),
        )


message_fragment()

st.button("Rerun")
