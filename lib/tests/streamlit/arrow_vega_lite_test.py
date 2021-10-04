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

import json

import pandas as pd
import pyarrow as pa
from tests import testutil

import streamlit as st
from streamlit.type_util import bytes_to_data_frame, pyarrow_table_to_bytes

df1 = pd.DataFrame([["A", "B", "C", "D"], [28, 55, 43, 91]], index=["a", "b"]).T
df2 = pd.DataFrame([["E", "F", "G", "H"], [11, 12, 13, 14]], index=["a", "b"]).T
autosize_spec = {"autosize": {"type": "fit", "contains": "padding"}}


class ArrowVegaLiteTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall arrow_vega_lite_chart protos."""

    def test_no_args(self):
        """Test that an error is raised when called with no args."""
        with self.assertRaises(ValueError):
            st._arrow_vega_lite_chart()

    def test_none_args(self):
        """Test that an error is raised when called with args set to None."""
        with self.assertRaises(ValueError):
            st._arrow_vega_lite_chart(None, None)

    def test_spec_but_no_data(self):
        """Test that it can be called with only data set to None."""
        st._arrow_vega_lite_chart(None, {"mark": "rect"})

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        self.assertEqual(proto.HasField("data"), False)
        self.assertDictEqual(
            json.loads(proto.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

    def test_spec_in_arg1(self):
        """Test that it can be called with spec as the 1st arg."""
        st._arrow_vega_lite_chart({"mark": "rect"})

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        self.assertEqual(proto.HasField("data"), False)
        self.assertDictEqual(
            json.loads(proto.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

    def test_data_in_spec(self):
        """Test passing data=df inside the spec."""
        st._arrow_vega_lite_chart({"mark": "rect", "data": df1})

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.data.data), df1, check_dtype=False
        )
        self.assertDictEqual(
            json.loads(proto.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

    def test_data_values_in_spec(self):
        """Test passing data={values: df} inside the spec."""
        st._arrow_vega_lite_chart({"mark": "rect", "data": {"values": df1}})

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.data.data), df1, check_dtype=False
        )
        self.assertDictEqual(
            json.loads(proto.spec),
            merge_dicts(autosize_spec, {"data": {}, "mark": "rect"}),
        )

    def test_datasets_in_spec(self):
        """Test passing datasets={foo: df} inside the spec."""
        st._arrow_vega_lite_chart({"mark": "rect", "datasets": {"foo": df1}})

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        self.assertEqual(proto.HasField("data"), False)
        self.assertDictEqual(
            json.loads(proto.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

    def test_datasets_correctly_in_spec(self):
        """Test passing datasets={foo: df}, data={name: 'foo'} in the spec."""
        st._arrow_vega_lite_chart(
            {"mark": "rect", "datasets": {"foo": df1}, "data": {"name": "foo"}}
        )

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        self.assertEqual(proto.HasField("data"), False)
        self.assertDictEqual(
            json.loads(proto.spec),
            merge_dicts(autosize_spec, {"data": {"name": "foo"}, "mark": "rect"}),
        )

    def test_dict_unflatten(self):
        """Test passing a spec as keywords."""
        st._arrow_vega_lite_chart(df1, x="foo", boink_boop=100, baz={"boz": "booz"})

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.data.data), df1, check_dtype=False
        )
        self.assertDictEqual(
            json.loads(proto.spec),
            merge_dicts(
                autosize_spec,
                {
                    "baz": {"boz": "booz"},
                    "boink": {"boop": 100},
                    "encoding": {"x": "foo"},
                },
            ),
        )

    def test_pyarrow_table_data(self):
        """Test that you can pass pyarrow.Table as data."""
        table = pa.Table.from_pandas(df1)
        st._arrow_vega_lite_chart(table, {"mark": "rect"})

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart

        self.assertEqual(proto.HasField("data"), True)
        self.assertEqual(proto.data.data, pyarrow_table_to_bytes(table))

    def test_arrow_add_rows(self):
        """Test that you can call _arrow_add_rows on arrow_vega_lite_chart (with data)."""
        chart = st._arrow_vega_lite_chart(df1, {"mark": "rect"})

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        self.assertEqual(proto.HasField("data"), True)

        chart._arrow_add_rows(df2)

        proto = self.get_delta_from_queue().arrow_add_rows
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.data.data), df2, check_dtype=False
        )

    def test_no_args_add_rows(self):
        """Test that you can call _arrow_add_rows on a arrow_vega_lite_chart (without data)."""
        chart = st._arrow_vega_lite_chart({"mark": "rect"})

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        self.assertEqual(proto.HasField("data"), False)

        chart._arrow_add_rows(df1)

        proto = self.get_delta_from_queue().arrow_add_rows
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.data.data), df1, check_dtype=False
        )

    def test_use_container_width(self):
        """Test that use_container_width=True autosets to full width."""
        st._arrow_vega_lite_chart(df1, {"mark": "rect"}, use_container_width=True)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        self.assertDictEqual(
            json.loads(proto.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

        self.assertEqual(proto.use_container_width, True)

    def test_width_inside_spec(self):
        """Test that Vega-Lite sets the width."""
        st._arrow_vega_lite_chart(df1, {"mark": "rect", "width": 200})

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        self.assertDictEqual(
            json.loads(proto.spec),
            merge_dicts(autosize_spec, {"mark": "rect", "width": 200}),
        )


def merge_dicts(x, y):
    z = x.copy()
    z.update(y)
    return z
