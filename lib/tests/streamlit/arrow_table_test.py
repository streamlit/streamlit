# -*- coding: utf-8 -*-
# Copyright 2018-2020 Streamlit Inc.
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

"""Arrow Table unit test."""

from tests import testutil
import numpy as np
import pandas as pd
import streamlit as st


class ArrowTableTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall arrow_table protos."""

    def test_table_uuid(self):
        df = create_mock_dataframe()
        styler = df.style
        styler.set_uuid("custom_uuid")
        st._arrow_table(styler)

        proto = self.get_delta_from_queue().new_element.arrow_table
        self.assertEqual(proto.uuid, "custom_uuid")

    def test_table_caption(self):
        df = create_mock_dataframe()
        styler = df.style
        styler.set_caption("The caption")
        st._arrow_table(styler)

        proto = self.get_delta_from_queue().new_element.arrow_table
        self.assertEqual(proto.caption, "The caption")

    def test_table_styles(self):
        df = create_mock_dataframe()
        styler = df.style
        # NB: If UUID is not set a random UUID will be assigned to the table.
        styler.set_uuid("custom_uuid")
        styler.set_table_styles(
            [{"selector": ".blank", "props": [("background-color", "red")]}]
        )
        st._arrow_table(styler)

        proto = self.get_delta_from_queue().new_element.arrow_table
        self.assertEqual(
            proto.styles, "#T_custom_uuid .blank { background-color: red }"
        )

    def test_table_cell_styles(self):
        df = create_mock_dataframe()
        styler = df.style
        # NB: If UUID is not set a random UUID will be assigned to the table.
        styler.set_uuid("custom_uuid")
        styler.highlight_max(axis=None)
        st._arrow_table(styler)

        proto = self.get_delta_from_queue().new_element.arrow_table

        self.assertEqual(
            proto.styles, "#T_custom_uuidrow1_col2 { background-color: yellow }"
        )


def create_mock_dataframe():
    grid = np.arange(0, 6, 1).reshape(2, 3)
    df = pd.DataFrame(
        grid,
        index=[[0, 1], ["r1", "r2"]],
        columns=[[2, 3, 4], ["c1", "c2", "c3"], [True, False, True]],
    )
    return df
