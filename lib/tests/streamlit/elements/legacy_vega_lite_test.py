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

"""st._legacy_vega_lite unit test."""

import json

import pandas as pd
import pyarrow as pa

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase

df1 = pd.DataFrame([["A", "B", "C", "D"], [28, 55, 43, 91]], index=["a", "b"]).T

df2 = pd.DataFrame([["E", "F", "G", "H"], [11, 12, 13, 14]], index=["a", "b"]).T

autosize_spec = {"autosize": {"type": "fit", "contains": "padding"}}


class LegacyVegaLiteTest(DeltaGeneratorTestCase):
    """Test ability to marshall vega_lite_chart protos."""

    def test_no_args(self):
        """Test that an error is raised when called with no args."""
        with self.assertRaises(ValueError):
            st._legacy_vega_lite_chart()

    def test_none_args(self):
        """Test that an error is raised when called with args set to None."""
        with self.assertRaises(ValueError):
            st._legacy_vega_lite_chart(None, None)

    def test_pyarrow_table_data(self):
        """Test that an error is raised when called with `pyarrow.Table` data."""
        with self.assertRaises(StreamlitAPIException):
            st._legacy_vega_lite_chart(pa.Table.from_pandas(df1), {"mark": "rect"})

    def test_spec_but_no_data(self):
        """Test that it can be called with only data set to None."""
        st._legacy_vega_lite_chart(None, {"mark": "rect"})

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(c.HasField("data"), False)
        self.assertDictEqual(
            json.loads(c.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

    def test_spec_in_arg1(self):
        """Test that it can be called spec as the 1st arg."""
        st._legacy_vega_lite_chart({"mark": "rect"})

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(c.HasField("data"), False)
        self.assertDictEqual(
            json.loads(c.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

    def test_data_in_spec(self):
        """Test passing data=df inside the spec."""
        st._legacy_vega_lite_chart({"mark": "rect", "data": df1})

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(c.HasField("data"), True)
        self.assertDictEqual(
            json.loads(c.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

    def test_data_values_in_spec(self):
        """Test passing data={values: df} inside the spec."""
        st._legacy_vega_lite_chart({"mark": "rect", "data": {"values": df1}})

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(c.HasField("data"), True)
        self.assertDictEqual(
            json.loads(c.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

    def test_datasets_in_spec(self):
        """Test passing datasets={foo: df} inside the spec."""
        st._legacy_vega_lite_chart({"mark": "rect", "datasets": {"foo": df1}})

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(c.HasField("data"), False)
        self.assertDictEqual(
            json.loads(c.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

    def test_datasets_correctly_in_spec(self):
        """Test passing datasets={foo: df}, data={name: 'foo'} in the spec."""
        st._legacy_vega_lite_chart(
            {"mark": "rect", "datasets": {"foo": df1}, "data": {"name": "foo"}}
        )

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(c.HasField("data"), False)
        self.assertDictEqual(
            json.loads(c.spec),
            merge_dicts(autosize_spec, {"data": {"name": "foo"}, "mark": "rect"}),
        )

    def test_dict_unflatten(self):
        """Test passing a spec as keywords."""
        st._legacy_vega_lite_chart(df1, x="foo", boink_boop=100, baz={"boz": "booz"})

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(c.HasField("data"), True)
        self.assertDictEqual(
            json.loads(c.spec),
            merge_dicts(
                autosize_spec,
                {
                    "baz": {"boz": "booz"},
                    "boink": {"boop": 100},
                    "encoding": {"x": "foo"},
                },
            ),
        )

    def test_use_container_width(self):
        """Test that use_container_width=True autosets to full width."""
        st._legacy_vega_lite_chart(df1, {"mark": "rect"}, use_container_width=True)

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertDictEqual(
            json.loads(c.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

        self.assertEqual(c.use_container_width, True)

    def test_width_inside_spec(self):
        """Test the width up to Vega-Lite."""
        st._legacy_vega_lite_chart(df1, {"mark": "rect", "width": 200})

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertDictEqual(
            json.loads(c.spec),
            merge_dicts(autosize_spec, {"mark": "rect", "width": 200}),
        )


def merge_dicts(x, y):
    z = x.copy()
    z.update(y)
    return z
