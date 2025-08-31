# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from __future__ import annotations

import unittest

import numpy as np
import pandas as pd
import pytest

from streamlit.elements.lib.options_selector_utils import index_


class Index_Test(unittest.TestCase):
    def test_index_list(self):
        assert index_([1, 2, 3, 4], 1) == 0
        assert index_([1, 2, 3, 4], 4) == 3

    def test_index_list_success(self):
        assert index_([1, 2, 3, 4], 2) == 1

    def test_index_list_fails(self):
        with pytest.raises(ValueError, match="5 is not in iterable"):
            index_([1, 2, 3, 4], 5)

    def test_index_tuple(self):
        assert index_((1, 2, 3, 4), 1) == 0
        assert index_((1, 2, 3, 4), 4) == 3

    def test_index_tuple_success(self):
        assert index_((1, 2, 3, 4), 2) == 1

    def test_index_tuple_fails(self):
        with pytest.raises(ValueError, match="5 is not in iterable"):
            index_((1, 2, 3, 4), 5)

    def test_index_numpy_array(self):
        assert index_(np.array([1, 2, 3, 4]), 1) == 0
        assert index_(np.array([1, 2, 3, 4]), 4) == 3

    def test_index_numpy_array_success(self):
        assert index_(np.array([1, 2, 3, 4]), 2) == 1

    def test_index_numpy_array_fails(self):
        with pytest.raises(ValueError, match="5 is not in iterable"):
            index_(np.array([1, 2, 3, 4]), 5)

    def test_index_pandas_series(self):
        assert index_(pd.Series([1, 2, 3, 4]), 1) == 0
        assert index_(pd.Series([1, 2, 3, 4]), 4) == 3

    def test_index_pandas_series_success(self):
        assert index_(pd.Series([1, 2, 3, 4]), 2) == 1

    def test_index_pandas_series_fails(self):
        with pytest.raises(ValueError, match="5 is not in iterable"):
            index_(pd.Series([1, 2, 3, 4]), 5)
