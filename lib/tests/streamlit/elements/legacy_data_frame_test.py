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

"""Unit tests for _legacy_data_frame."""

import json
import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd
import pyarrow as pa
import pytest
from google.protobuf import json_format

import streamlit as st
import streamlit.elements.legacy_data_frame as data_frame
from streamlit.errors import StreamlitAPIException
from streamlit.proto.DataFrame_pb2 import AnyArray, CSSStyle, DataFrame, Index, Table
from tests.delta_generator_test_case import DeltaGeneratorTestCase


def _css_style(prop, value):
    css_pb = CSSStyle()
    css_pb.property = prop
    css_pb.value = value
    return css_pb


class LegacyDataFrameProtoTest(unittest.TestCase):
    """Test streamlit.data_frame."""

    def test_marshall_data_frame(self):
        """Test streamlit.data_frame.marshall_data_frame."""
        pass

    def test_is_pandas_styler(self):
        """Test streamlit.data_frame._is_pandas_styler.

        Need to test the following:
        * object is of type pandas.io.formats.style.Styler
        """
        pass

    def test_marshall_styles(self):
        """Test streamlit.data_frame._marshall_styles.

        Need to test the following:
        * styler is:
          * None
          * not None
        * display_values is:
          * None
          * not None
        """
        pass

    def test_get_css_styles(self):
        """Test streamlit.data_frame._get_css_styles.

        Need to test the following:
        * cell_selector_regex isn't found
        * cell_style['props'] isn't a list
        * cell_style['props'] does not equal 2
        * style has name and value
        * style does not have name and value
        """
        pass

    def test_get_custom_display_values(self):
        """Test streamlit.data_frame._get_custom_display_values.

        Need to test the following:
        * row_header regex is found
          * we find row header more than once.
        * cell_selector regex isn't found.
        * has_custom_display_values
          * true
          * false
        """
        pass

    def test_marshall_pyarrow_table_data(self):
        """Test that an error is raised when called with `pyarrow.Table` data."""
        df = pd.DataFrame(data={"col1": [1, 2], "col2": [3, 4]})
        proto = DataFrame()

        with self.assertRaises(StreamlitAPIException):
            data_frame.marshall_data_frame(pa.Table.from_pandas(df), proto)

    @pytest.mark.filterwarnings("ignore::FutureWarning")
    def test_marshall_index(self):
        """Test streamlit.data_frame._marshall_index."""
        df = pd.DataFrame(data={"col1": [1, 2], "col2": [3, 4]})

        # Plain Index
        proto = Index()
        data_frame._marshall_index(df.columns, proto)
        self.assertEqual(["col1", "col2"], proto.plain_index.data.strings.data)

        # Range Index
        proto = Index()
        data_frame._marshall_index(df.index, proto)
        self.assertEqual(0, proto.range_index.start)
        self.assertEqual(2, proto.range_index.stop)

        # Range Index with NaNs
        df_nan = pd.DataFrame(data={"col1": [], "col2": []})
        proto = Index()
        data_frame._marshall_index(df_nan.index, proto)
        self.assertEqual(0, proto.range_index.start)
        self.assertEqual(0, proto.range_index.stop)

        # multi index
        df_multi = pd.MultiIndex.from_arrays([[1, 2], [3, 4]], names=["one", "two"])
        proto = Index()
        data_frame._marshall_index(df_multi, proto)
        self.assertEqual([1, 2], proto.multi_index.levels[0].int_64_index.data.data)
        self.assertEqual([0, 1], proto.multi_index.labels[0].data)

        # datetimeindex
        truth = [
            "2019-04-01T10:00:00-07:00",
            "2019-04-01T11:00:00-07:00",
            "2019-04-01T12:00:00-07:00",
        ]
        df_dt = pd.date_range(
            start="2019/04/01 10:00", end="2019/04/01 12:00", freq="H"
        )
        proto = Index()
        obj_to_patch = "streamlit.elements.legacy_data_frame.tzlocal.get_localzone"
        with patch(obj_to_patch) as p:
            p.return_value = "America/Los_Angeles"
            data_frame._marshall_index(df_dt, proto)
            self.assertEqual(truth, proto.datetime_index.data.data)

        # timedeltaindex
        df_td = pd.to_timedelta(np.arange(1, 5), unit="ns")
        proto = Index()
        data_frame._marshall_index(df_td, proto)
        self.assertEqual([1, 2, 3, 4], proto.timedelta_index.data.data)

        # int64index
        df_int64 = pd.Index(np.arange(1, 5), dtype="int64")
        proto = Index()
        data_frame._marshall_index(df_int64, proto)
        self.assertEqual([1, 2, 3, 4], proto.int_64_index.data.data)

        # float64index
        df_float64 = pd.Index(np.arange(1, 5), dtype="float64")
        proto = Index()
        data_frame._marshall_index(df_float64, proto)
        self.assertEqual([1, 2, 3, 4], proto.float_64_index.data.data)

        # Period index
        df_period = pd.period_range(
            start="2005-12-21 08:45", end="2005-12-21 11:55", freq="H"
        )
        proto = Index()
        with pytest.raises(NotImplementedError) as e:
            data_frame._marshall_index(df_period, proto)
        err_msg = (
            "Can't handle <class 'pandas.core.indexes.period.PeriodIndex'>" " yet."
        )
        self.assertEqual(err_msg, str(e.value))

    def test_marshall_table(self):
        """Test streamlit.data_frame._marshall_table."""
        proto = Table()
        data_frame._marshall_table([[1, 2], [3, 4]], proto)
        ret = json.loads(json_format.MessageToJson(proto))
        ret = [x["int64s"]["data"] for x in ret["cols"]]
        truth = [["1", "2"], ["3", "4"]]
        self.assertEqual(ret, truth)

    @pytest.mark.filterwarnings("ignore::DeprecationWarning")
    def test_marshall_any_array(self):
        """Test streamlit.data_frame._marshall_any_array."""
        # list
        list_data = [1, 2]
        list_proto = AnyArray()

        data_frame._marshall_any_array(list_data, list_proto)
        self.assertEqual(list_proto.int64s.data, list_data)

        # wrong shape
        with pytest.raises(ValueError) as e:
            data_frame._marshall_any_array([[1, 2], [3, 4]], AnyArray())
        err_msg = "Array must be 1D."
        self.assertEqual(err_msg, str(e.value))

        # float
        float_data = pd.Series(np.array([1.0, 2.0]), dtype=np.floating)
        float_proto = AnyArray()

        data_frame._marshall_any_array(float_data, float_proto)
        self.assertEqual(float_proto.doubles.data, float_data.tolist())

        # timedelta64
        td_data = np.array([1, 2], dtype=np.timedelta64)
        td_proto = AnyArray()

        data_frame._marshall_any_array(td_data, td_proto)
        self.assertEqual(td_proto.timedeltas.data, td_data.tolist())

        # int
        int_data = np.array([1, 2], dtype=np.integer)
        int_proto = AnyArray()

        data_frame._marshall_any_array(int_data, int_proto)
        self.assertEqual(int_proto.int64s.data, int_data.tolist())

        # bool
        bool_data = np.array([True, False], dtype=np.bool_)
        bool_proto = AnyArray()

        data_frame._marshall_any_array(bool_data, bool_proto)
        self.assertEqual(bool_proto.int64s.data, bool_data.tolist())

        # object
        obj_data = np.array([json.dumps, json.dumps], dtype=np.object_)
        obj_proto = AnyArray()
        truth = [str(json.dumps), str(json.dumps)]

        data_frame._marshall_any_array(obj_data, obj_proto)
        self.assertEqual(obj_proto.strings.data, truth)

        # StringDtype
        string_data = pd.Series(["foo", "bar", "baz"], dtype="string")
        string_proto = AnyArray()
        data_frame._marshall_any_array(string_data, string_proto)
        self.assertEqual(string_proto.strings.data, string_data.tolist())

        # No timezone
        dt_data = pd.Series([np.datetime64("2019-04-09T12:34:56")])
        dt_proto = AnyArray()

        obj_to_patch = "streamlit.elements.legacy_data_frame.tzlocal.get_localzone"
        with patch(obj_to_patch) as p:
            p.return_value = "America/Los_Angeles"
            data_frame._marshall_any_array(dt_data, dt_proto)
            self.assertEqual("2019-04-09T12:34:56", dt_proto.datetimes.data[0])

        # With timezone
        dt_data = pd.Series([np.datetime64("2019-04-09T12:34:56")])
        dt_data = dt_data.dt.tz_localize("UTC")
        dt_proto = AnyArray()
        data_frame._marshall_any_array(dt_data, dt_proto)
        self.assertEqual("2019-04-09T12:34:56+00:00", dt_proto.datetimes.data[0])

        # string
        str_data = np.array(["random", "string"])
        str_proto = AnyArray()

        with pytest.raises(NotImplementedError, match="^Dtype <U6 not understood.$"):
            data_frame._marshall_any_array(str_data, str_proto)


class LegacyDataframeTest(DeltaGeneratorTestCase):
    """Test ability to marshall legacy_dataframe proto."""

    def test_st_legacy_dataframe(self):
        """Test st._legacy_dataframe."""
        df = pd.DataFrame({"one": [1, 2], "two": [11, 22]})

        st._legacy_dataframe(df)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.data_frame.data.cols[0].int64s.data, [1, 2])
        self.assertEqual(
            el.data_frame.columns.plain_index.data.strings.data, ["one", "two"]
        )


class LegacyTableAPITest(DeltaGeneratorTestCase):
    """Test st._legacy_table API."""

    def test_st_legacy_table(self):
        """Test st._legacy_table."""
        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        st._legacy_table(df)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.table.data.cols[0].int64s.data, [1, 3])
        self.assertEqual(el.table.data.cols[1].int64s.data, [2, 4])
        self.assertEqual(
            el.table.columns.plain_index.data.strings.data, ["col1", "col2"]
        )
