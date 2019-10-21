# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Example of (almost) everything that's possible in streamlit."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims

setup_2_3_shims(globals())

from io import BytesIO
import requests

import streamlit as st

st.title("Ways you can format text in Streamlit")

st.write("Import streamlit with `import streamlit as st`.")

st.header("Markdown")

with st.echo():
    st.write(
        """
        The `write` function is Streamlit\'s bread and butter. You can use
        it to write _markdown-formatted_ text in your Streamlit app.
    """
    )

st.header("Preformatted")

with st.echo():
    st.text(
        "Here's preformatted text instead of _Markdown_!\n"
        "       ^^^^^^^^^^^^\n"
        "Rock on! \m/(^_^)\m/ "
    )

st.header("JSON")

with st.echo():
    st.json({"hello": "world"})

with st.echo():
    st.json('{"object":{"array":[1,true,"3"]}}')

st.header("Inline Code Blocks")

with st.echo():
    with st.echo():
        st.write("Use `st.echo()` to display inline code blocks.")

st.header("Alert boxes")

with st.echo():
    st.error("This is an error message")
    st.warning("This is a warning message")
    st.info("This is an info message")
    st.success("This is a success message")

st.header("Progress Bars")

with st.echo():
    for percent in [0, 25, 50, 75, 100]:
        st.write("%s%% progress:" % percent)
        st.progress(percent)

st.header("Help")

with st.echo():
    st.help(dir)

