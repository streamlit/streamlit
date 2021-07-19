# Copyright 2018-2021 Streamlit Inc.
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

"""Unit tests for _legacy_data_frame."""

from unittest.mock import patch
import json
import unittest

import numpy as np
import pandas as pd
import pytest
import pyarrow as pa
import streamlit.elements.legacy_data_frame as data_frame

from google.protobuf import json_format

from streamlit.errors import StreamlitAPIException
from streamlit.proto.Common_pb2 import Int32Array
from streamlit.proto.DataFrame_pb2 import AnyArray
from streamlit.proto.DataFrame_pb2 import CSSStyle
from streamlit.proto.DataFrame_pb2 import CellStyle
from streamlit.proto.DataFrame_pb2 import CellStyleArray
from streamlit.proto.DataFrame_pb2 import Index
from streamlit.proto.DataFrame_pb2 import Table
from streamlit.proto.DataFrame_pb2 import DataFrame
from streamlit.proto.Delta_pb2 import Delta
from streamlit.proto.VegaLiteChart_pb2 import VegaLiteChart
from streamlit.proto.NamedDataSet_pb2 import NamedDataSet


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
        * cell_selector_regex isnt found
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
        df_int64 = pd.Int64Index(np.arange(1, 5))
        proto = Index()
        data_frame._marshall_index(df_int64, proto)
        self.assertEqual([1, 2, 3, 4], proto.int_64_index.data.data)

        # float64index
        df_float64 = pd.Float64Index(np.arange(1, 5))
        proto = Index()
        data_frame._marshall_index(df_float64, proto)
        self.assertEqual([1, 2, 3, 4], proto.float_64_index.data.data)

        # Period index
        df_period = pd.period_range(
            start="2005-12-21 08:45 ", end="2005-12-21 11:55", freq="H"
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
        bool_data = np.array([True, False], dtype=np.bool)
        bool_proto = AnyArray()

        data_frame._marshall_any_array(bool_data, bool_proto)
        self.assertEqual(bool_proto.int64s.data, bool_data.tolist())

        # object
        obj_data = np.array([json.dumps, json.dumps], dtype=np.object)
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

    def test_add_rows(self):
        """Test streamlit.data_frame.add_rows."""
        # Generic Data
        aa = AnyArray()
        aa.int64s.data.extend([1, 2])

        cell_style = CellStyle()
        cell_style.css.extend([_css_style("color", "black")])

        style = CellStyleArray()
        style.styles.extend([cell_style])

        # Delta DataFrame
        dt1 = Delta()
        dt1.new_element.data_frame.data.cols.extend([aa])
        dt1.new_element.data_frame.index.plain_index.data.int64s.data.extend([3, 4])
        dt1.new_element.data_frame.columns.plain_index.data.int64s.data.extend([5, 6])
        dt1.new_element.data_frame.style.cols.extend([style])

        dt2 = Delta()
        dt2.new_element.data_frame.data.cols.extend([aa])
        dt2.new_element.data_frame.index.plain_index.data.int64s.data.extend([3, 4])
        dt2.new_element.data_frame.columns.plain_index.data.int64s.data.extend([5, 6])
        dt2.new_element.data_frame.style.cols.extend([style])

        combined = Delta()
        aa_combined = AnyArray()
        aa_combined.int64s.data.extend([1, 2, 1, 2])

        style_combined = CellStyleArray()
        style_combined.styles.extend([cell_style, cell_style])

        combined.new_element.data_frame.data.cols.extend([aa_combined])
        row_index = combined.new_element.data_frame.index.plain_index
        row_index.data.int64s.data.extend([3, 4, 3, 4])
        col_index = combined.new_element.data_frame.columns.plain_index
        col_index.data.int64s.data.extend([5, 6])
        combined.new_element.data_frame.style.cols.extend([style_combined])

        # Test both not empty
        data_frame.add_rows(dt1, dt2)
        self.assertEqual(dt1, combined)

        # Test one empty
        dt0 = Delta()
        dt0.new_element.data_frame.data.cols.extend([])

        data_frame.add_rows(dt0, dt1)
        self.assertEqual(str(dt0), str(dt1))

        # Test both empty
        empty0 = Delta()
        empty0.new_element.data_frame.data.cols.extend([])

        empty1 = Delta()
        empty1.new_element.data_frame.data.cols.extend([])

        data_frame.add_rows(empty0, empty1)
        self.assertEqual(str(empty0), str(empty1))

        # Test different data shapes
        diff0 = Delta()
        diff0.new_element.data_frame.data.cols.extend([aa, aa])

        diff1 = Delta()
        diff1.new_element.data_frame.data.cols.extend([aa])

        with pytest.raises(ValueError) as e:
            data_frame.add_rows(diff0, diff1)

        err_msg = "Dataframes have incompatible shapes"
        self.assertEqual(err_msg, str(e.value))

    def test_concat_index(self):
        """Test streamlit.data_frame._concat_index."""
        # Empty
        idx0 = Index()
        idx0.plain_index.data.int64s.data.extend([])

        idx1 = Index()
        idx1.plain_index.data.int64s.data.extend([1, 2])

        data_frame._concat_index(idx0, idx1)
        self.assertEqual(idx0, idx1)

        # type mismatch
        idx2 = Index()
        idx2.plain_index.data.doubles.data.extend([3.0, 4.0])

        with pytest.raises(ValueError) as e:
            data_frame._concat_index(idx1, idx2)

        err_msg = "Cannot concatenate int64s with doubles."
        self.assertEqual(err_msg, str(e.value))

        # plain index
        idx3 = Index()
        idx3.plain_index.data.int64s.data.extend([5, 6])

        idx4 = Index()
        idx4.plain_index.data.int64s.data.extend([1, 2, 5, 6])

        data_frame._concat_index(idx1, idx3)
        self.assertEqual(idx1, idx4)

        # range index
        r_idx1 = Index()
        r_idx1.range_index.start = 2
        r_idx1.range_index.stop = 10

        r_idx2 = Index()
        r_idx2.range_index.start = 10
        r_idx2.range_index.stop = 20

        r_combined = Index()
        r_combined.range_index.start = 2
        r_combined.range_index.stop = 20

        data_frame._concat_index(r_idx1, r_idx2)
        self.assertEqual(r_idx1, r_combined)

        # multi
        int32_array = Int32Array()
        int32_array.data.extend([4, 5])

        m_idx1 = Index()
        m_idx1.multi_index.labels.extend([int32_array])

        m_idx2 = Index()
        m_idx2.multi_index.labels.extend([int32_array])

        with pytest.raises(NotImplementedError) as e:
            data_frame._concat_index(m_idx1, m_idx2)

        err_msg = "Cannot yet concatenate MultiIndices."
        self.assertEqual(err_msg, str(e.value))

        # int_64_index
        i_idx1 = Index()
        i_idx1.int_64_index.data.data.extend([1, 2])

        i_idx2 = Index()
        i_idx2.int_64_index.data.data.extend([3, 4])

        i_combined = Index()
        i_combined.int_64_index.data.data.extend([1, 2, 3, 4])

        data_frame._concat_index(i_idx1, i_idx2)
        self.assertEqual(i_idx1, i_combined)

        # datetime_index
        dt_idx1 = Index()
        dt_idx1.datetime_index.data.data.extend(["a", "b"])

        dt_idx2 = Index()
        dt_idx2.datetime_index.data.data.extend(["c", "d"])

        dt_combined = Index()
        dt_combined.datetime_index.data.data.extend(["a", "b", "c", "d"])

        data_frame._concat_index(dt_idx1, dt_idx2)
        self.assertEqual(dt_idx1, dt_combined)

        # timedelta_index
        td_idx1 = Index()
        td_idx1.timedelta_index.data.data.extend([1, 2])

        td_idx2 = Index()
        td_idx2.timedelta_index.data.data.extend([3, 4])

        td_combined = Index()
        td_combined.timedelta_index.data.data.extend([1, 2, 3, 4])

        data_frame._concat_index(td_idx1, td_idx2)
        self.assertEqual(td_idx1, td_combined)

        # Not implemented
        f_idx1 = Index()
        f_idx1.float_64_index.data.data.extend([1.0, 2.0])

        f_idx2 = Index()
        f_idx2.float_64_index.data.data.extend([3.0, 4.0])

        with pytest.raises(NotImplementedError) as e:
            data_frame._concat_index(f_idx1, f_idx2)

        err_msg = 'Cannot concatenate "float_64_index" indices.'
        self.assertEqual(err_msg, str(e.value))

    def test_concat_any_array(self):
        """Test streamlit.data_frame._concat_any_array."""
        aa0 = AnyArray()
        aa0.int64s.data.extend([])

        aa1 = AnyArray()
        aa1.int64s.data.extend([1, 2])

        aa2 = AnyArray()
        aa2.int64s.data.extend([3, 4])

        aa3 = AnyArray()
        aa3.doubles.data.extend([5.0, 6.0])

        combined = AnyArray()
        combined.int64s.data.extend([1, 2, 3, 4])

        # both not empty
        data_frame._concat_any_array(aa1, aa2)
        self.assertEqual(aa1, combined)

        # empty
        data_frame._concat_any_array(aa0, aa1)
        self.assertEqual(aa0, aa1)

        # types dont match
        with pytest.raises(ValueError) as e:
            data_frame._concat_any_array(aa2, aa3)

        err_msg = "Cannot concatenate int64s with doubles."
        self.assertEqual(err_msg, str(e.value))

    def test_concat_cell_style_array(self):
        """Test streamlit.data_frame._concat_cell_style_array."""
        cell_style1 = CellStyle()
        cell_style1.css.extend([_css_style("color", "black")])

        cell_style2 = CellStyle()
        cell_style2.css.extend([_css_style("vertical-align", "middle")])

        style0 = CellStyleArray()

        style1 = CellStyleArray()
        style1.styles.extend([cell_style1])

        style2 = CellStyleArray()
        style2.styles.extend([cell_style2])

        # Combine 1 and 2
        style3 = CellStyleArray()
        style3.styles.extend([cell_style1, cell_style2])

        # not empty
        data_frame._concat_cell_style_array(style1, style2)
        self.assertEqual(str(style1), str(style3))

        # style0 is empty
        data_frame._concat_cell_style_array(style0, style1)
        self.assertEqual(str(style0), str(style1))

    def test_get_data_frame(self):
        """Test streamlit.data_frame._get_data_frame."""
        # Test delta not new_element or add_rows
        with pytest.raises(ValueError) as e:
            delta = Delta()
            data_frame._get_data_frame(delta)

        err_msg = "Cannot extract DataFrame from None."
        self.assertEqual(err_msg, str(e.value))

        # Generic Data
        aa = AnyArray()
        aa.int64s.data.extend([1, 2, 3])

        # Delta DataFrame
        delta_df = Delta()
        delta_df.new_element.data_frame.data.cols.extend([aa])
        df = data_frame._get_data_frame(delta_df)
        self.assertEqual(df, delta_df.new_element.data_frame)

        # Delta Table
        delta_table = Delta()
        delta_table.new_element.table.data.cols.extend([aa])
        df = data_frame._get_data_frame(delta_table)
        self.assertEqual(df, delta_table.new_element.table)

        # Vega-Lite Chart
        delta_vega = Delta()
        delta_vega.new_element.vega_lite_chart.data.data.cols.extend([aa])
        df = data_frame._get_data_frame(delta_vega)
        self.assertEqual(df, delta_vega.new_element.vega_lite_chart.data)

        # Vega-Lite Chart w/ named dataset
        delta_vega_dataset = Delta()

        ds1 = NamedDataSet()
        ds1.name = "dataset 1"
        ds1.has_name = True
        ds1.data.data.cols.extend([aa])

        delta_vega_dataset.new_element.vega_lite_chart.datasets.extend([ds1])

        df = data_frame._get_data_frame(delta_vega_dataset, "dataset 1")
        self.assertEqual(
            df, delta_vega_dataset.new_element.vega_lite_chart.datasets[0].data
        )

        # Vega-Lite Chart w/ unnamed dataset
        delta_vega_unnamed_dataset = Delta()

        ds2 = NamedDataSet()
        ds2.has_name = False
        ds2.data.data.cols.extend([aa])

        delta_vega_unnamed_dataset.new_element.vega_lite_chart.datasets.extend([ds2])

        df = data_frame._get_data_frame(delta_vega_unnamed_dataset)
        self.assertEqual(
            df, delta_vega_unnamed_dataset.new_element.vega_lite_chart.datasets[0].data
        )

        # add_rows w/ name
        delta_add_rows = Delta()
        delta_add_rows.add_rows.name = "named dataset"
        delta_add_rows.add_rows.has_name = True
        delta_add_rows.add_rows.data.data.cols.extend([aa])
        df = data_frame._get_data_frame(delta_add_rows, "named dataset")
        self.assertEqual(df, delta_add_rows.add_rows.data)

        # add_rows w/out name
        with pytest.raises(ValueError) as e:
            delta_add_rows_noname = Delta()
            delta_add_rows_noname.add_rows.name = "named dataset"
            delta_add_rows_noname.add_rows.has_name = True
            delta_add_rows_noname.add_rows.data.data.cols.extend([aa])
            df = data_frame._get_data_frame(delta_add_rows_noname)

        err_msg = 'No dataset found with name "None".'
        self.assertEqual(err_msg, str(e.value))

    def test_get_or_create_dataset(self):
        """Test streamlit.data_frame._get_or_create_dataset."""
        chart = VegaLiteChart()

        ds1 = NamedDataSet()
        ds1.name = "dataset 1"
        ds1.has_name = True

        aa = AnyArray()
        aa.int64s.data.extend([1, 2, 3])
        ds1.data.data.cols.extend([aa])

        ds2 = NamedDataSet()
        ds2.name = "dataset 2"
        ds2.has_name = True

        chart.datasets.extend([ds1, ds2])

        ret = data_frame._get_or_create_dataset(chart.datasets, "dataset 1")
        self.assertEqual(ret, ds1.data)

    def test_index_len(self):
        """Test streamlit.data_frame._index_len."""
        # Plain
        plain_idx = Index()
        plain_idx.plain_index.data.int64s.data.extend([1, 2, 3])
        self.assertEqual(3, data_frame._index_len(plain_idx))

        # Range
        range_idx = Index()
        range_idx.range_index.start = 2
        range_idx.range_index.stop = 10
        self.assertEqual(8, data_frame._index_len(range_idx))

        # Multi with no labels
        multi_idx = Index()
        multi_idx.multi_index.levels.extend([plain_idx, range_idx])
        self.assertEqual(0, data_frame._index_len(multi_idx))

        # Multi with labels
        int32_array = Int32Array()
        int32_array.data.extend([4, 5])
        multi_idx.multi_index.labels.extend([int32_array])
        self.assertEqual(2, data_frame._index_len(multi_idx))

        # Datetime
        dt_idx = Index()
        dt_idx.datetime_index.data.data.extend(["a", "b", "c"])
        self.assertEqual(3, data_frame._index_len(dt_idx))

        # TimeDelta
        td_idx = Index()
        td_idx.timedelta_index.data.data.extend([1, 2, 3, 4])
        self.assertEqual(4, data_frame._index_len(td_idx))

        # Ine64
        i64_idx = Index()
        i64_idx.int_64_index.data.data.extend([1, 2, 3, 4, 5])
        self.assertEqual(5, data_frame._index_len(i64_idx))

        # Float64
        f64_idx = Index()
        f64_idx.float_64_index.data.data.extend([1.0, 2.0, 3.0, 4.0, 5.0, 6.0])
        self.assertEqual(6, data_frame._index_len(f64_idx))

    def test_any_array_len(self):
        """Test streamlit.data_frame._any_array_len."""
        data = [
            ("strings", 2, ["a", "b"]),
            ("int64s", 3, [1, 2, 3]),
            ("doubles", 4, [1.0, 2.0, 3.0, 4.0]),
            # datetimes and timedeltas are just stored as strings/ints and aren't
            # python data types.
            ("datetimes", 5, ["a", "b", "c", "d", "e"]),
            ("timedeltas", 6, [1, 2, 3, 4, 5, 6]),
        ]

        for kind, length, array in data:
            aa = AnyArray()
            pb = getattr(aa, kind)
            pb.data.extend(array)
            self.assertEqual(length, data_frame._any_array_len(aa))
