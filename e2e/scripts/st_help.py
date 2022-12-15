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

import re

import pandas as pd

import streamlit as st

# Testing case where there are no docs.
st.help(st.net_util)

# Testing case where there are no members.
st.help(globals)

# Test case where there the docs need to scroll,
# and test case where some member doesn't have docs.
st.help(re)


class Foo:
    """My docstring"""

    def __init__(self):
        self.mymember = 123


f = Foo()

f
