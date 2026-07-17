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

import streamlit as st

# A short, real ttl so the stale-while-revalidate windows are observable in an e2e run:
# fresh [0, _TTL), stale grace [_TTL, 2*_TTL), hard expiry >= 2*_TTL. Kept large enough
# that the initial miss and the fresh-window rerun comfortably fit inside the fresh
# window even on a slow/loaded CI runner (avoids a premature refresh flipping the value).
_TTL_SECONDS = 6


@st.cache_resource(show_spinner=False)
def _execution_counter() -> dict[str, int]:
    # A process-global mutable counter that survives reruns and is readable from the
    # context-free background refresh thread (a global-scoped cache needs no session).
    return {"count": 0}


@st.cache_data(ttl=_TTL_SECONDS, refresh_mode="background", show_spinner=False)
def compute_value() -> int:
    """Each real execution bumps the shared counter, so reruns reveal whether the value
    was served from cache (unchanged) or recomputed (incremented).
    """
    counter = _execution_counter()
    counter["count"] += 1
    return counter["count"]


@st.cache_data(ttl=_TTL_SECONDS, refresh_mode="background", show_spinner=False)
def compute_with_display() -> int:
    # A display command inside a background-mode cached function: it renders live during
    # the miss, is not replayed on hits, and triggers a one-time warning.
    st.markdown("Inside cached function")
    return 1


st.markdown(f"Value: {compute_value()}")

compute_with_display()
