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

"""Arrow Dataframe dimension parameters test."""

import pandas as pd
from parameterized import parameterized

import streamlit as st
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import (
    HeightConfigFields,
    WidthConfigFields,
)


class ArrowDataFrameDimensionsTest(DeltaGeneratorTestCase):
    """Test the layout configuration in st.dataframe for different dimension options."""

    def test_no_dimensions(self):
        """Test default behavior when no dimension parameters are passed."""
        df = pd.DataFrame({"A": [1, 2, 3, 4, 5]})

        st.dataframe(df)
        element = self.get_delta_from_queue().new_element

        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert element.width_config.use_stretch is True

        # Should not set height config for default auto behavior
        assert element.height_config.WhichOneof("height_spec") is None

    @parameterized.expand(
        [
            # Width only (height remains unset)
            (
                {"width": 400},
                (WidthConfigFields.PIXEL_WIDTH, "pixel_width", 400),
                (None, None, None),
            ),
            (
                {"width": "stretch"},
                (WidthConfigFields.USE_STRETCH, "use_stretch", True),
                (None, None, None),
            ),
            (
                {"width": "content"},
                (WidthConfigFields.USE_CONTENT, "use_content", True),
                (None, None, None),
            ),
            # Height only (width gets default "stretch")
            (
                {"height": 300},
                (WidthConfigFields.USE_STRETCH, "use_stretch", True),
                (HeightConfigFields.PIXEL_HEIGHT, "pixel_height", 300),
            ),
            (
                {"height": "auto"},
                (WidthConfigFields.USE_STRETCH, "use_stretch", True),
                (None, None, None),  # auto doesn't set height config
            ),
            # Combinations
            (
                {"width": 200, "height": 250},
                (WidthConfigFields.PIXEL_WIDTH, "pixel_width", 200),
                (HeightConfigFields.PIXEL_HEIGHT, "pixel_height", 250),
            ),
        ]
    )
    def test_dimension_values(self, kwargs, expected_width, expected_height):
        """Test that width and height values set layout config correctly."""
        df = pd.DataFrame({"A": [1, 2, 3, 4, 5]})

        st.dataframe(df, **kwargs)
        element = self.get_delta_from_queue().new_element

        width_field, width_attr, width_value = expected_width
        if width_field is not None:
            assert element.width_config.WhichOneof("width_spec") == width_field.value
            assert getattr(element.width_config, width_attr) == width_value

        height_field, height_attr, height_value = expected_height
        if height_field is not None:
            assert element.height_config.WhichOneof("height_spec") == height_field.value
            assert getattr(element.height_config, height_attr) == height_value
        else:
            assert element.height_config.WhichOneof("height_spec") is None

    @parameterized.expand(
        [
            # use_container_width=True cases - always results in "stretch"
            (None, True, WidthConfigFields.USE_STRETCH, "use_stretch", True),
            ("stretch", True, WidthConfigFields.USE_STRETCH, "use_stretch", True),
            ("content", True, WidthConfigFields.USE_STRETCH, "use_stretch", True),
            (400, True, WidthConfigFields.USE_STRETCH, "use_stretch", True),
            # use_container_width=False cases - respects width parameter
            (None, False, WidthConfigFields.USE_CONTENT, "use_content", True),
            ("stretch", False, WidthConfigFields.USE_CONTENT, "use_content", True),
            ("content", False, WidthConfigFields.USE_CONTENT, "use_content", True),
            (400, False, WidthConfigFields.PIXEL_WIDTH, "pixel_width", 400),
        ]
    )
    def test_use_container_width_behavior(
        self, width_param, use_container_width, expected_field, field_name, field_value
    ):
        """Test that use_container_width parameter properly overrides width parameter."""
        df = pd.DataFrame({"A": [1, 2, 3, 4, 5]})

        kwargs = {"use_container_width": use_container_width}
        if width_param is not None:
            kwargs["width"] = width_param

        st.dataframe(df, **kwargs)

        element = self.get_delta_from_queue().new_element
        assert element.width_config.WhichOneof("width_spec") == expected_field.value
        assert getattr(element.width_config, field_name) == field_value
