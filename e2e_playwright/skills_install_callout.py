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
from streamlit.errors import StreamlitAPIException

st.title("Skills install callout e2e")
st.write("App used to e2e-test the in-error install-skills callout.")

# A plain (non-Streamlit) error must NOT get the callout — installing Streamlit
# skills won't fix a bug in the developer's own logic. Render it FIRST (before
# any eligible error) so the "no callout in the ValueError box" assertion
# depends on the is_streamlit_exception gate, not on the single callout slot
# already being claimed by an earlier Streamlit error.
st.exception(ValueError("A user-code error the skills can't help with"))

# Two Streamlit-raised exceptions (subclasses of streamlit.errors.Error) — the
# class of mistake the skills can actually fix. Rendering two exercises the
# single-callout dedup: both render, but the install callout appears in only one.
st.exception(StreamlitAPIException("Something broke (first error)"))
st.exception(StreamlitAPIException("Something else broke (second error)"))
