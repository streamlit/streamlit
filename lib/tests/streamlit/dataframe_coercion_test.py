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

"""Tests coercing various objects to DataFrames"""

from streamlit import type_util

import unittest
import pandas as pd
import numpy as np
import pyarrow as pa


class DataFrameCoercionTest(unittest.TestCase):
    def test_dict_of_lists(self):
        """Test that a DataFrame can be constructed from a dict
        of equal-length lists
        """
        d = {"a": [1], "b": [2], "c": [3]}
        df = type_util.convert_anything_to_df(d)
        self.assertEqual(type(df), pd.DataFrame)
        self.assertEqual(df.shape, (1, 3))

    def test_empty_numpy_array(self):
        """Test that a single-column empty DataFrame can be constructed
        from an empty numpy array.
        """
        arr = np.array([])
        df = type_util.convert_anything_to_df(arr)
        self.assertEqual(type(df), pd.DataFrame)
        self.assertEqual(df.shape, (0, 1))

    def test_styler(self):
        """Test that a DataFrame can be constructed from a pandas.Styler"""
        d = {"a": [1], "b": [2], "c": [3]}
        styler = pd.DataFrame(d).style.format("{:.2%}")
        df = type_util.convert_anything_to_df(styler)
        self.assertEqual(type(df), pd.DataFrame)
        self.assertEqual(df.shape, (1, 3))

    def test_pyarrow_table(self):
        """Test that a DataFrame can be constructed from a pyarrow.Table"""
        d = {"a": [1], "b": [2], "c": [3]}
        table = pa.Table.from_pandas(pd.DataFrame(d))
        df = type_util.convert_anything_to_df(table)
        self.assertEqual(type(df), pd.DataFrame)
        self.assertEqual(df.shape, (1, 3))
