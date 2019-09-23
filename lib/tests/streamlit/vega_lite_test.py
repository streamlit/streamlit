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

"""vega_lite unit test."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims

setup_2_3_shims(globals())

import unittest
import pandas as pd
import json

from tests import testutil
import streamlit as st


df1 = pd.DataFrame([["A", "B", "C", "D"], [28, 55, 43, 91]], index=["a", "b"]).T

df2 = pd.DataFrame([["E", "F", "G", "H"], [11, 12, 13, 14]], index=["a", "b"]).T

autosize_spec = {"width": 0, "autosize": {"type": "fit", "contains": "padding"}}


class VegaLiteTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall vega_lite_chart protos."""

    def test_no_args(self):
        """Test that an error is raised when called with no args."""
        with self.assertRaises(ValueError):
            st.vega_lite_chart()

    def test_none_args(self):
        """Test that an error is raised when called with args set to None."""
        with self.assertRaises(ValueError):
            st.vega_lite_chart(None, None)

    def test_spec_but_no_data(self):
        """Test that it can be called with only data set to None."""
        st.vega_lite_chart(None, {"mark": "rect"})

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(c.HasField("data"), False)
        self.assertDictEqual(
            json.loads(c.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

    def test_spec_in_arg1(self):
        """Test that it can be called spec as the 1st arg."""
        st.vega_lite_chart({"mark": "rect"})

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(c.HasField("data"), False)
        self.assertDictEqual(
            json.loads(c.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

    def test_data_in_spec(self):
        """Test passing data=df inside the spec."""
        st.vega_lite_chart({"mark": "rect", "data": df1})

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(c.HasField("data"), True)
        self.assertDictEqual(
            json.loads(c.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

    def test_data_values_in_spec(self):
        """Test passing data={values: df} inside the spec."""
        st.vega_lite_chart({"mark": "rect", "data": {"values": df1}})

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(c.HasField("data"), True)
        self.assertDictEqual(
            json.loads(c.spec), merge_dicts(autosize_spec, {"data": {}, "mark": "rect"})
        )

    def test_datasets_in_spec(self):
        """Test passing datasets={foo: df} inside the spec."""
        st.vega_lite_chart({"mark": "rect", "datasets": {"foo": df1}})

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(c.HasField("data"), False)
        self.assertDictEqual(
            json.loads(c.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

    def test_datasets_correctly_in_spec(self):
        """Test passing datasets={foo: df}, data={name: 'foo'} in the spec."""
        st.vega_lite_chart(
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
        st.vega_lite_chart(df1, x="foo", boink_boop=100, baz={"boz": "booz"})

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

    def test_add_rows(self):
        """Test that you can call add_rows on a vega_lite_chart(None)."""
        x = st.vega_lite_chart(df1, {"mark": "rect"})

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(len(c.data.data.cols[0].strings.data), 4)

        x.add_rows(df2)

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(len(c.data.data.cols[0].strings.data), 8)
        self.assertDictEqual(
            json.loads(c.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(c.HasField("data"), True)

    def test_no_args_add_rows(self):
        """Test that you can call add_rows on a vega_lite_chart(None)."""
        x = st.vega_lite_chart({"mark": "rect"})

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(c.HasField("data"), False)

        x.add_rows(df1)

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(len(c.data.data.cols[0].strings.data), 4)

    def test_width_zero(self):
        """Test that width=0 autosets to full width."""
        st.vega_lite_chart(df1, {"mark": "rect"}, width=0)

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertDictEqual(
            json.loads(c.spec), merge_dicts(autosize_spec, {"mark": "rect"})
        )

    def test_width_positive(self):
        """Test that width > 0 sets the width."""
        st.vega_lite_chart(df1, {"mark": "rect"}, width=500)

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertDictEqual(
            json.loads(c.spec),
            merge_dicts(autosize_spec, {"mark": "rect", "width": 500}),
        )

    def test_width_neg_one(self):
        """Test that width=-1 leaves the width up to Vega-Lite."""
        st.vega_lite_chart(df1, {"mark": "rect"}, width=-1)

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertDictEqual(json.loads(c.spec), {"mark": "rect"})

    def test_width_inside_spec(self):
        """Test that {width:-1} leaves the width up to Vega-Lite."""
        st.vega_lite_chart(df1, {"mark": "rect", "width": 500})

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertDictEqual(json.loads(c.spec), {"mark": "rect", "width": 500})

    def test_autosize_set(self):
        """Test that autosize doesn't get overriden."""
        st.vega_lite_chart(df1, {"mark": "rect", "autosize": None}, width=500)

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertDictEqual(
            json.loads(c.spec), {"mark": "rect", "autosize": None, "width": 500}
        )


def merge_dicts(x, y):
    z = x.copy()
    z.update(y)
    return z
