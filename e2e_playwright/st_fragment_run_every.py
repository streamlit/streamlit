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

"""Exercise standalone and nested fragment `run_every` cleanup behavior."""

from uuid import uuid4

import streamlit as st


@st.fragment(run_every=1.0)
def my_auto_updating_fragment() -> None:
    """Render a standalone auto-updating fragment for baseline coverage."""

    st.write(f"standalone uuid in fragment: {uuid4()}")


@st.fragment
def nested_fragment_parent() -> None:
    """Conditionally render the nested fragment tree for hide/show testing."""

    if st.toggle("Show nested auto fragment", value=True):
        nested_fragment_child()


@st.fragment
def nested_fragment_child() -> None:
    """Add an extra fragment boundary around the nested auto-rerun child."""

    nested_auto_updating_fragment()


@st.fragment(run_every=1.0)
def nested_auto_updating_fragment() -> None:
    """Render the nested fragment whose timer must be cleaned up when hidden."""

    st.write(f"nested uuid in fragment: {uuid4()}")


my_auto_updating_fragment()
nested_fragment_parent()
